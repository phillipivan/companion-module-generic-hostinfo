import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ModuleInstance, { TEMPERATURE_INTERVAL, UPDATE_INTERVAL } from '../main.js'
import { UNKNOWN } from '../variables.js'
import { fakeSi } from './fixtures.js'

vi.mock('node:os', async () => ({ default: (await import('./fixtures.js')).fakeOs }))
vi.mock('systeminformation', async () => ({ default: (await import('./fixtures.js')).fakeSi }))

// Enough of InstanceBase to construct the module without a Companion host
vi.mock('@companion-module/base', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@companion-module/base')>()
	class InstanceBase {
		constructor(_internal: unknown) {}
		log = vi.fn()
		updateStatus = vi.fn()
		setVariableDefinitions = vi.fn()
		setVariableValues = vi.fn()
	}
	return { ...actual, InstanceBase }
})

type FakeBase = {
	log: ReturnType<typeof vi.fn>
	setVariableValues: ReturnType<typeof vi.fn>
}

type Values = Record<string, unknown>

/** The values each setVariableValues call set, keeping only the calls that set `key` */
function setsOf(base: FakeBase, key: string): Values[] {
	return base.setVariableValues.mock.calls.map(([values]) => values as Values).filter((values) => key in values)
}

function warnings(base: FakeBase): unknown[][] {
	return base.log.mock.calls.filter(([level]) => level === 'warn')
}

async function startInstance(): Promise<{ instance: ModuleInstance; base: FakeBase }> {
	const instance = new ModuleInstance({})
	await instance.init({})
	await vi.advanceTimersByTimeAsync(0)
	return { instance, base: instance as unknown as FakeBase }
}

beforeEach(() => {
	vi.useFakeTimers()
	// restores each fake's own implementation, undoing any a test set
	vi.resetAllMocks()
})
afterEach(() => {
	vi.useRealTimers()
})

describe('updates', () => {
	it('sets every variable at startup, then the changing ones each interval', async () => {
		const { instance, base } = await startInstance()

		expect(setsOf(base, 'freemem')).toHaveLength(1)
		expect(setsOf(base, 'freemem')[0]).toHaveProperty('hostname', 'studio-mac')

		await vi.advanceTimersByTimeAsync(UPDATE_INTERVAL * 3)

		const sets = setsOf(base, 'freemem')
		expect(sets).toHaveLength(4)
		expect(sets.at(-1)).toMatchObject({ moduleUptime: 3, loadAvg_1: 1.5 })
		expect(sets.at(-1)).not.toHaveProperty('hostname')
		await instance.destroy()
	})

	it('stops on destroy', async () => {
		const { instance, base } = await startInstance()
		await instance.destroy()
		base.setVariableValues.mockClear()

		await vi.advanceTimersByTimeAsync(UPDATE_INTERVAL * 5)

		expect(base.setVariableValues).not.toHaveBeenCalled()
	})

	// destroy cleared the timer, but a read still awaiting systeminformation set a new one when it finished
	it('stops on destroy while a read is in flight', async () => {
		const { instance, base } = await startInstance()
		let finishRead: () => void = () => {}
		fakeSi.currentLoad.mockImplementationOnce(
			async () => new Promise((resolve) => (finishRead = () => resolve({ currentLoad: 50 }))),
		)
		await vi.advanceTimersByTimeAsync(UPDATE_INTERVAL)
		base.setVariableValues.mockClear()

		await instance.destroy()
		finishRead()
		await vi.advanceTimersByTimeAsync(UPDATE_INTERVAL * 5)

		expect(base.setVariableValues).not.toHaveBeenCalled()
		expect(vi.getTimerCount()).toBe(0)
	})
})

describe('temperature', () => {
	it('is set at startup, then every ten seconds rather than every second', async () => {
		const { instance, base } = await startInstance()

		expect(setsOf(base, 'cpuTemp')).toEqual([{ cpuTemp: 48.3 }])

		await vi.advanceTimersByTimeAsync(TEMPERATURE_INTERVAL - 1)
		expect(fakeSi.cpuTemperature).toHaveBeenCalledTimes(1)

		fakeSi.cpuTemperature.mockResolvedValueOnce({ main: 61, cores: [], max: 61 })
		await vi.advanceTimersByTimeAsync(1)

		expect(fakeSi.cpuTemperature).toHaveBeenCalledTimes(2)
		expect(setsOf(base, 'cpuTemp').at(-1)).toEqual({ cpuTemp: 61 })
		await instance.destroy()
	})

	// a slow PowerShell or sensors call must not hold up the every-second variables
	it('does not hold up the other variables while a read is slow', async () => {
		const { instance, base } = await startInstance()
		fakeSi.cpuTemperature.mockImplementationOnce(async () => new Promise(() => {}))
		await vi.advanceTimersByTimeAsync(TEMPERATURE_INTERVAL)
		base.setVariableValues.mockClear()

		await vi.advanceTimersByTimeAsync(UPDATE_INTERVAL * 5)

		expect(setsOf(base, 'freemem')).toHaveLength(5)
		await instance.destroy()
	})

	it('stops on destroy', async () => {
		const { instance, base } = await startInstance()
		await instance.destroy()

		await vi.advanceTimersByTimeAsync(TEMPERATURE_INTERVAL * 3)

		expect(fakeSi.cpuTemperature).toHaveBeenCalledTimes(1)
		expect(setsOf(base, 'cpuTemp')).toHaveLength(1)
		expect(vi.getTimerCount()).toBe(0)
	})
})

describe('read failures', () => {
	it('keeps updating, and logs once per run of failures rather than every second', async () => {
		const { instance, base } = await startInstance()
		fakeSi.currentLoad.mockRejectedValue(new Error('currentLoad failed'))

		await vi.advanceTimersByTimeAsync(UPDATE_INTERVAL * 3)

		expect(setsOf(base, 'loadCurrent').at(-1)).toHaveProperty('loadCurrent', UNKNOWN)
		expect(warnings(base)).toEqual([['warn', 'Could not read system information: currentLoad failed']])

		fakeSi.currentLoad.mockResolvedValueOnce({ currentLoad: 10 })
		await vi.advanceTimersByTimeAsync(UPDATE_INTERVAL * 2)

		expect(warnings(base)).toHaveLength(2)
		await instance.destroy()
	})

	// with one flag shared between the loops, each good temperature read reset it, so a lasting failure of the
	// every-second read was logged again every ten seconds
	it("keeps the two loops apart, so a good temperature read does not repeat the other loop's warning", async () => {
		const { instance, base } = await startInstance()
		fakeSi.currentLoad.mockRejectedValue(new Error('currentLoad failed'))

		await vi.advanceTimersByTimeAsync(TEMPERATURE_INTERVAL * 3)

		expect(fakeSi.cpuTemperature.mock.calls.length).toBeGreaterThan(1)
		expect(warnings(base)).toHaveLength(1)
		await instance.destroy()
	})

	it('logs a failing temperature read once', async () => {
		const { instance, base } = await startInstance()
		fakeSi.cpuTemperature.mockRejectedValue(new Error('sensors failed'))

		await vi.advanceTimersByTimeAsync(TEMPERATURE_INTERVAL * 3)

		expect(setsOf(base, 'cpuTemp').at(-1)).toEqual({ cpuTemp: UNKNOWN })
		expect(warnings(base)).toEqual([['warn', 'Could not read system information: sensors failed']])
		await instance.destroy()
	})
})
