import type { SomeCompanionConfigField } from '@companion-module/base'

/** The module has nothing to configure */
export type ModuleConfig = Record<string, never>

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'static-text',
			id: 'pass',
			label: '',
			value: '',
			width: 4,
		},
	]
}
