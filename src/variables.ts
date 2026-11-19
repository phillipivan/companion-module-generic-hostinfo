import type { CompanionVariableDefinitions } from '@companion-module/base'
import os from 'node:os'
import si from 'systeminformation'
import type ModuleInstance from './main.js'

/** Shown in place of a value systeminformation could not read */
export const UNKNOWN = 'unknown'
type Unknown = typeof UNKNOWN

export type VariablesSchema = {
	arch: string
	cpuSpeed: number | Unknown
	cpuTemp: number | Unknown
	fqdn: string
	freemem: number
	freememPercent: number
	hostname: string
	loadAvg_1: number
	loadAvg_5: number
	loadAvg_15: number
	loadCurrent: number | Unknown
	machine: string
	moduleUptime: number
	platform: NodeJS.Platform
	release: string
	systemTime: string
	systemTimeZone: string
	totalmem: number
	type: string
	user: string
	uptime: number
	version: string
}

export const VariableDefinitions: CompanionVariableDefinitions<VariablesSchema> = {
	arch: { name: 'Architecture' },
	cpuSpeed: { name: 'CPU Current Average Speed (GHz)' },
	cpuTemp: { name: 'CPU Temperature (°C)' },
	fqdn: { name: 'Fully Qualified Domain Name' },
	freemem: { name: 'Free Memory (b)' },
	freememPercent: { name: 'Free Memory (%)' },
	hostname: { name: 'Host Name' },
	loadAvg_1: { name: 'Load Average: 1 Minute' },
	loadAvg_5: { name: 'Load Average: 5 Minute' },
	loadAvg_15: { name: 'Load Average: 15 Minute' },
	loadCurrent: { name: 'Load Current (%)' },
	machine: { name: 'Machine' },
	moduleUptime: { name: 'Module Uptime (s)' },
	platform: { name: 'Platform' },
	release: { name: 'Release' },
	systemTime: { name: 'System Time' },
	systemTimeZone: { name: 'System Time Zone' },
	totalmem: { name: 'Total Memory (b)' },
	type: { name: 'Type' },
	user: { name: 'User Name' },
	uptime: { name: 'Uptime (s)' },
	version: { name: 'Version' },
}

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	self.setVariableDefinitions(VariableDefinitions)
}

/** Variables refreshed every update interval */
export type ChangingVariables = Pick<
	VariablesSchema,
	| 'cpuSpeed'
	| 'freemem'
	| 'freememPercent'
	| 'loadAvg_1'
	| 'loadAvg_5'
	| 'loadAvg_15'
	| 'loadCurrent'
	| 'moduleUptime'
	| 'systemTime'
	| 'systemTimeZone'
	| 'uptime'
>

export interface ReadResult<T> {
	values: T
	/** Set when systeminformation failed; the affected values read `unknown` */
	error?: unknown
}

export async function readChangingValues(moduleUptime: number): Promise<ReadResult<ChangingVariables>> {
	const [loadAvg1, loadAvg5, loadAvg15] = os.loadavg()
	const fromOs = {
		freemem: os.freemem(),
		freememPercent: Math.round((os.freemem() / os.totalmem()) * 100),
		loadAvg_1: loadAvg1,
		loadAvg_5: loadAvg5,
		loadAvg_15: loadAvg15,
		moduleUptime,
		uptime: os.uptime(),
	}
	try {
		const speed = await si.cpuCurrentSpeed()
		const timeStamp = si.time()
		const load = await si.currentLoad()
		return {
			values: {
				...fromOs,
				cpuSpeed: speed.avg,
				loadCurrent: Math.round(load.currentLoad),
				systemTime: new Date(timeStamp.current).toISOString(),
				systemTimeZone: timeStamp.timezone,
			},
		}
	} catch (error) {
		return {
			values: { ...fromOs, cpuSpeed: UNKNOWN, loadCurrent: UNKNOWN, systemTime: UNKNOWN, systemTimeZone: UNKNOWN },
			error,
		}
	}
}

/** Every variable but the temperature, read once at startup */
export async function readAllValues(moduleUptime: number): Promise<ReadResult<Omit<VariablesSchema, 'cpuTemp'>>> {
	let user: string
	try {
		user = os.userInfo().username
	} catch {
		// throws where the user has no passwd entry, such as some containers
		user = UNKNOWN
	}
	let fqdn: string
	let fqdnError: unknown
	try {
		fqdn = (await si.osInfo()).fqdn
	} catch (error) {
		fqdn = UNKNOWN
		fqdnError = error
	}
	const changing = await readChangingValues(moduleUptime)
	return {
		values: {
			...changing.values,
			arch: os.arch(),
			fqdn,
			hostname: os.hostname(),
			machine: os.machine(),
			platform: os.platform(),
			release: os.release(),
			totalmem: os.totalmem(),
			type: os.type(),
			user,
			version: os.version(),
		},
		error: changing.error ?? fqdnError,
	}
}

/** systeminformation types `main` as a number, but it is null wherever the platform gives no reading */
interface CpuTemperatureReading {
	main: number | null
}

/** Read on its own, slower timer */
export async function readCpuTemperature(): Promise<ReadResult<Pick<VariablesSchema, 'cpuTemp'>>> {
	try {
		const reading: CpuTemperatureReading = await si.cpuTemperature()
		// Windows averages its thermal zones, so round to keep the text short
		return { values: { cpuTemp: reading.main === null ? UNKNOWN : Math.round(reading.main * 10) / 10 } }
	} catch (error) {
		return { values: { cpuTemp: UNKNOWN }, error }
	}
}
