import { InstanceBase, runEntrypoint, InstanceStatus } from '@companion-module/base'
import UpgradeScripts from './upgrades.js'
import os from 'os'
import si from 'systeminformation'

const updateInterval = 1000

class Host_Info extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.updateTimer = {}
		this.moduleUptime = 0
	}

	async init(config) {
		this.config = config
		this.updateStatus(InstanceStatus.Ok)
		this.updateVariableDefinitions()
		this.updateVariableValues()
	}

	// When module gets deleted
	async destroy() {
		this.log('debug', 'destroy')
		if (this.updateTimer) {
			clearTimeout (this.updateTimer)
			delete this.updateTimer

		}
	}

	async configUpdated(config) {
		this.config = config
	}

	// Return config fields for web config
	getConfigFields() {
		return [ 
			{
				type: 'static-text',
				id: 'pass',
				label: '',
				value: '',
				width: 4,
				default: '',
			},
		]
	}

	async updateChangingVariables() {
		let vars = []
		let loadavg = os.loadavg()
		this.moduleUptime += 1
		try {
			//const cpu = await si.cpu();
			const speed = await si.cpuCurrentSpeed() //avg
			//const temp = await si.cpuTemperature()//main
			const timeStamp = await si.time() //current, timezone
			const time = new Date(timeStamp.current)
			const load = await si.currentLoad() //avgLoad, currentLoad
			vars['cpuSpeed'] = speed.avg
			vars['loadCurrent'] = Math.round(load.currentLoad)
			vars['systemTime'] = time
			vars['systemTimeZone'] = timeStamp.timezone
		} catch (e) {
			console.log(e)
			vars['cpuSpeed'] = 'unknown'
			vars['cpuTemp'] = 'unknown'
			vars['loadCurrent'] = 'unknown'
			vars['systemTime'] = 'unknown'
			vars['systemTimeZone'] ='unknown'
		}
		vars['freemem'] = os.freemem()
		vars['freememPercent'] = Math.round(os.freemem() / os.totalmem() * 100)
		vars['loadav_1'] = loadavg[0]
		vars['loadav_5'] = loadavg[1]
		vars['loadav_15'] = loadavg[2]
		vars['moduleUptime'] = this.moduleUptime
		vars['uptime'] = os.uptime()
		this.setVariableValues(vars)
		this.updateTimer = setTimeout(() => {
			this.updateChangingVariables()
		}, updateInterval)
	}

	async updateVariableValues() {
		let vars = []
		let loadavg = os.loadavg()
		let userInfo = os.userInfo()
		try {
			//const cpu = await si.cpu();
			const speed = await si.cpuCurrentSpeed() //avg
			//const temp = await si.cpuTemperature()//main
			const os = await si.osInfo()
			const timeStamp = await si.time() //current, timezone
			const load = await si.currentLoad() //avgLoad, currentLoad
			const time = new Date(timeStamp.current)
			vars['cpuSpeed'] = speed.avg
			vars['fqdn'] = os.fqdn
			vars['loadCurrent'] = Math.round(load.currentLoad)
			vars['systemTime'] = time
			vars['systemTimeZone'] = timeStamp.timezone
		} catch (e) {
			console.log(e)
			vars['cpuSpeed'] = 'unknown'
			vars['loadCurrent'] = 'unknown'
			vars['systemTime'] = 'unknown'
			vars['systemTimeZone'] ='unknown'
		}
		vars['arch'] = os.arch()
		vars['freemem'] = os.freemem()
		vars['freememPercent'] = Math.round(os.freemem() / os.totalmem() * 100)
		vars['hostname'] = os.hostname()
		vars['loadAvg_1'] = loadavg[0]
		vars['loadAvg_5'] = loadavg[1]
		vars['loadAvg_15'] = loadavg[2]
		vars['machine'] = os.machine()
		vars['moduleUptime'] = this.moduleUptime
		vars['platform'] = os.platform()
		vars['release'] = os.release()
		vars['totalmem'] = os.totalmem()
		vars['type'] = os.type()
		vars['user'] = userInfo.username
		vars['uptime'] = os.uptime()
		vars['version'] = os.version()
		this.setVariableValues(vars)
		this.updateTimer = setTimeout(() => {
			this.updateChangingVariables()
		}, updateInterval)
	}

	updateVariableDefinitions() {
		this.setVariableDefinitions([
			{ variableId: 'arch', name: 'Architecture' },
			{ variableId: 'cpuSpeed', name: 'CPU Current Average Speed (GHz)' },
			{ variableId: 'fqdn', name: 'Fully Qualified Domain Name' },
			{ variableId: 'freemem', name: 'Free Memory (b)' },
			{ variableId: 'freememPercent', name: 'Free Memory (%)' },
			{ variableId: 'hostname', name: 'Host Name' },
			{ variableId: 'loadAvg_1', name: 'Load Average: 1 Minute' },
			{ variableId: 'loadAvg_5', name: 'Load Average: 5 Minute' },
			{ variableId: 'loadAvg_15', name: 'Load Average: 15 Minute' },
			{ variableId: 'loadCurrent', name: 'Load Current (%)' },
			{ variableId: 'machine', name: 'Machine' },
			{ variableId: 'moduleUptime', name: 'Module Uptime (s)' },
			{ variableId: 'platform', name: 'Platform' },
			{ variableId: 'release', name: 'Release' },
			{ variableId: 'systemTime', name: 'System Time' },
			{ variableId: 'systemTimeZone', name: 'System Time Zone' },
			{ variableId: 'totalmem', name: 'Total Memory (b)' },
			{ variableId: 'type', name: 'Type' },
			{ variableId: 'user', name: 'User Name' },
			{ variableId: 'uptime', name: 'Uptime (s)' },
			{ variableId: 'version', name: 'Version' },
		])
	}
}

runEntrypoint(Host_Info, UpgradeScripts)
