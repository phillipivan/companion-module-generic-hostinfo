const { InstanceBase, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')
const os = require('os')

const updateInterval = 1000

class Host_Info extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.updateTimer = {}
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
		vars['freemem'] = os.freemem()
		vars['freememPercent'] = Math.round(os.freemem() / os.totalmem() * 100)
		vars['loadav_1'] = loadavg[0]
		vars['loadav_5'] = loadavg[1]
		vars['loadav_15'] = loadavg[2]
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
		vars['arch'] = os.arch()
		vars['freemem'] = os.freemem()
		vars['freememPercent'] = Math.round(os.freemem() / os.totalmem() * 100)
		vars['hostname'] = os.hostname()
		vars['loadav_1'] = loadavg[0]
		vars['loadav_5'] = loadavg[1]
		vars['loadav_15'] = loadavg[2]
		vars['machine'] = os.machine()
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
			{ variableId: 'freemem', name: 'Free Memory (b)' },
			{ variableId: 'freememPercent', name: 'Free Memory (%)' },
			{ variableId: 'hostname', name: 'Host Name' },
			{ variableId: 'loadav_1', name: 'Load Average: 1 Minute' },
			{ variableId: 'loadav_5', name: 'Load Average: 5 Minute' },
			{ variableId: 'loadav_15', name: 'Load Average: 15 Minute' },
			{ variableId: 'machine', name: 'Machine' },
			{ variableId: 'platform', name: 'Platform' },
			{ variableId: 'release', name: 'Release' },
			{ variableId: 'totalmem', name: 'Total Memory (b)' },
			{ variableId: 'type', name: 'Type' },
			{ variableId: 'user', name: 'User Name' },
			{ variableId: 'uptime', name: 'Up Time (s)' },
			{ variableId: 'version', name: 'Version' },
		])
	}
}

runEntrypoint(Host_Info, UpgradeScripts)
