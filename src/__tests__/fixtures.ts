import { vi } from 'vitest'

/** Stand-ins for node:os and systeminformation, so the values are known and nothing touches the real host */
export const fakeOs = {
	arch: vi.fn(() => 'arm64'),
	freemem: vi.fn(() => 4_000_000_000),
	hostname: vi.fn(() => 'studio-mac'),
	loadavg: vi.fn(() => [1.5, 1.25, 1]),
	machine: vi.fn(() => 'arm64'),
	platform: vi.fn((): NodeJS.Platform => 'darwin'),
	release: vi.fn(() => '25.0.0'),
	totalmem: vi.fn(() => 16_000_000_000),
	type: vi.fn(() => 'Darwin'),
	uptime: vi.fn(() => 3600),
	userInfo: vi.fn(() => ({ username: 'operator' })),
	version: vi.fn(() => 'Darwin Kernel Version 25.0.0'),
}

/** 2026-11-19T10:00:00.000Z */
export const SYSTEM_TIME_MS = Date.UTC(2026, 10, 19, 10, 0, 0)

export const fakeSi = {
	cpuCurrentSpeed: vi.fn(async () => Promise.resolve({ avg: 3.2 })),
	cpuTemperature: vi.fn(async () =>
		Promise.resolve<{ main: number | null; cores: number[]; max: number | null }>({ main: 48.25, cores: [], max: 50 }),
	),
	currentLoad: vi.fn(async () => Promise.resolve({ currentLoad: 12.6 })),
	osInfo: vi.fn(async () => Promise.resolve({ fqdn: 'studio-mac.local' })),
	time: vi.fn(() => ({ current: SYSTEM_TIME_MS, timezone: 'GMT+1100', uptime: 3600 })),
}
