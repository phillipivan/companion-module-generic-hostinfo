import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readAllValues, readChangingValues, readCpuTemperature, UNKNOWN, VariableDefinitions } from '../variables.js'
import { fakeOs, fakeSi } from './fixtures.js'

vi.mock('node:os', async () => ({ default: (await import('./fixtures.js')).fakeOs }))
vi.mock('systeminformation', async () => ({ default: (await import('./fixtures.js')).fakeSi }))

beforeEach(() => {
	// restores each fake's own implementation, undoing any a test set
	vi.resetAllMocks()
})

describe('readAllValues', () => {
	it('with the temperature, sets every defined variable, and nothing else', async () => {
		const { values, error } = await readAllValues(0)
		const temperature = await readCpuTemperature()

		expect(error).toBeUndefined()
		expect(Object.keys({ ...values, ...temperature.values }).sort()).toEqual(Object.keys(VariableDefinitions).sort())
	})

	it('reads the host', async () => {
		const { values } = await readAllValues(0)

		expect(values).toEqual({
			arch: 'arm64',
			cpuSpeed: 3.2,
			fqdn: 'studio-mac.local',
			freemem: 4_000_000_000,
			freememPercent: 25,
			hostname: 'studio-mac',
			loadAvg_1: 1.5,
			loadAvg_5: 1.25,
			loadAvg_15: 1,
			loadCurrent: 13,
			machine: 'arm64',
			moduleUptime: 0,
			platform: 'darwin',
			release: '25.0.0',
			systemTime: '2026-11-19T10:00:00.000Z',
			systemTimeZone: 'GMT+1100',
			totalmem: 16_000_000_000,
			type: 'Darwin',
			user: 'operator',
			uptime: 3600,
			version: 'Darwin Kernel Version 25.0.0',
		})
	})

	it('reports the user as unknown where the OS has no entry for them', async () => {
		fakeOs.userInfo.mockImplementationOnce(() => {
			throw new Error('ENOENT: no such file or directory, uv_os_get_passwd')
		})

		const { values } = await readAllValues(0)

		expect(values.user).toBe(UNKNOWN)
		expect(values.hostname).toBe('studio-mac')
	})

	it('reports the FQDN as unknown, and the error, when the OS query fails', async () => {
		const failure = new Error('osInfo failed')
		fakeSi.osInfo.mockRejectedValueOnce(failure)

		const { values, error } = await readAllValues(0)

		expect(values.fqdn).toBe(UNKNOWN)
		expect(values.cpuSpeed).toBe(3.2)
		expect(error).toBe(failure)
	})
})

describe('readChangingValues', () => {
	// The 1 s update wrote loadav_1/5/15, which have no definition, so the load averages only ever showed the first read
	it('only sets defined variables', async () => {
		const { values } = await readChangingValues(5)

		for (const key of Object.keys(values)) expect(VariableDefinitions).toHaveProperty(key)
	})

	it('refreshes the load averages', async () => {
		fakeOs.loadavg.mockReturnValueOnce([2, 3, 4])

		const { values } = await readChangingValues(5)

		expect(values).toMatchObject({ loadAvg_1: 2, loadAvg_5: 3, loadAvg_15: 4, moduleUptime: 5 })
	})

	it('reports what systeminformation provides as unknown when it fails, and keeps the rest', async () => {
		const failure = new Error('currentLoad failed')
		fakeSi.currentLoad.mockRejectedValueOnce(failure)

		const { values, error } = await readChangingValues(5)

		expect(error).toBe(failure)
		expect(values).toEqual({
			cpuSpeed: UNKNOWN,
			freemem: 4_000_000_000,
			freememPercent: 25,
			loadAvg_1: 1.5,
			loadAvg_5: 1.25,
			loadAvg_15: 1,
			loadCurrent: UNKNOWN,
			moduleUptime: 5,
			systemTime: UNKNOWN,
			systemTimeZone: UNKNOWN,
			uptime: 3600,
		})
	})
})

describe('readCpuTemperature', () => {
	it('reads the main temperature, to one decimal place', async () => {
		fakeSi.cpuTemperature.mockResolvedValueOnce({ main: 47.666, cores: [], max: 50 })

		expect(await readCpuTemperature()).toEqual({ values: { cpuTemp: 47.7 } })
	})

	// systeminformation's types say number, but it resolves null where the platform gives no reading, as on macOS
	// without its optional sensor package. That is unsupported, not a failure, so there is nothing to log.
	it('reports unknown, without an error, where the platform gives no reading', async () => {
		fakeSi.cpuTemperature.mockResolvedValueOnce({ main: null, cores: [], max: null })

		expect(await readCpuTemperature()).toEqual({ values: { cpuTemp: UNKNOWN } })
	})

	it('reports unknown, and the error, when the read fails', async () => {
		const failure = new Error('sensors failed')
		fakeSi.cpuTemperature.mockRejectedValueOnce(failure)

		expect(await readCpuTemperature()).toEqual({ values: { cpuTemp: UNKNOWN }, error: failure })
	})
})
