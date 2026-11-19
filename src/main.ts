import { InstanceBase, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpgradeScripts } from './upgrades.js'
import {
	readAllValues,
	readChangingValues,
	readCpuTemperature,
	UpdateVariableDefinitions,
	type ReadResult,
	type VariablesSchema,
} from './variables.js'

export const UPDATE_INTERVAL = 1000
/** Reading the temperature runs shell commands on Linux and PowerShell on Windows, too heavy for every second */
export const TEMPERATURE_INTERVAL = 10_000

type Reader = () => Promise<ReadResult<Partial<VariablesSchema>>>

function describeError(err: unknown): string {
	return err instanceof Error ? err.message : JSON.stringify(err)
}

export type ModuleTypes = {
	config: ModuleConfig
	secrets: undefined
	actions: Record<string, never>
	feedbacks: Record<string, never>
	variables: VariablesSchema
}

export { UpgradeScripts }

export default class ModuleInstance extends InstanceBase<ModuleTypes> {
	config!: ModuleConfig // Setup in init()
	#controller = new AbortController()
	#timers = new Set<NodeJS.Timeout>()
	#moduleUptime = 0

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config
		this.updateStatus(InstanceStatus.Ok)
		UpdateVariableDefinitions(this)
		this.#poll(
			async () => readAllValues(this.#moduleUptime),
			async () => readChangingValues(++this.#moduleUptime),
			UPDATE_INTERVAL,
		)
		this.#poll(readCpuTemperature, readCpuTemperature, TEMPERATURE_INTERVAL)
	}

	// When module gets deleted
	async destroy(): Promise<void> {
		this.log('debug', 'destroy')
		// a read in flight sees this and neither sets values nor re-arms its timer
		this.#controller.abort()
		for (const timer of this.#timers) clearTimeout(timer)
		this.#timers.clear()
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config
	}

	// Return config fields for web config
	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	/**
	 * Runs `first`, then `next` every `interval` after each read finishes, until destroyed.
	 * Each loop logs the first failure of a run of failures, rather than one per read.
	 */
	#poll(first: Reader, next: Reader, interval: number): void {
		const { signal } = this.#controller
		let failing = false
		const run = async (read: Reader): Promise<void> => {
			try {
				const { values, error } = await read()
				if (signal.aborted) return
				this.setVariableValues(values)
				if (error === undefined) {
					failing = false
				} else if (!failing) {
					failing = true
					this.log('warn', `Could not read system information: ${describeError(error)}`)
				}
			} catch (err) {
				if (!signal.aborted) this.log('error', `Variable update failed: ${describeError(err)}`)
			} finally {
				if (!signal.aborted) {
					const timer = setTimeout(() => {
						this.#timers.delete(timer)
						void run(next)
					}, interval)
					this.#timers.add(timer)
				}
			}
		}
		void run(first)
	}
}
