import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { MonitoringAdapter, NormalizedProbe } from '$lib/types';
import {
    clearAdapters,
    getAdapterByName,
    getAdapterForProbe,
    getAllAdapters,
    registerAdapter,
    setActiveAdapter
} from './adapter.ts';

function createDummyAdapter(name: string, type?: string): MonitoringAdapter {
	return {
		name,
		type,
		initialize: async () => {},
		fetchProbes: async () => [],
		fetchIncidents: async () => [],
		getPollingInterval: () => 30000
	};
}

describe('Adapter Registry', () => {
	beforeEach(() => {
		clearAdapters();
	});

	it('should register and retrieve multiple adapters by name', () => {
		const kuma1 = createDummyAdapter('kuma_prod', 'uptimekuma');
		const kuma2 = createDummyAdapter('kuma_lan', 'uptimekuma');
		const robot = createDummyAdapter('robot_main', 'uptimerobot');

		registerAdapter(kuma1);
		registerAdapter(kuma2);
		registerAdapter(robot);

		assert.equal(getAllAdapters().length, 3);
		assert.equal(getAdapterByName('kuma_prod'), kuma1);
		assert.equal(getAdapterByName('kuma_lan'), kuma2);
		assert.equal(getAdapterByName('robot_main'), robot);
		assert.equal(getAdapterByName('nonexistent'), undefined);
	});

	it('should set first registered adapter as active adapter fallback', () => {
		const mock = createDummyAdapter('mock');
		const kuma = createDummyAdapter('kuma_prod');

		registerAdapter(mock);
		registerAdapter(kuma);

		assert.equal(getAdapterForProbe('unknown:999'), mock);
	});

	it('should resolve adapter for probe via probe.source in store', () => {
		const kuma1 = createDummyAdapter('kuma_prod', 'uptimekuma');
		const robot = createDummyAdapter('robot_main', 'uptimerobot');

		registerAdapter(kuma1);
		registerAdapter(robot);

		const fakeProbe: NormalizedProbe = {
			id: 'custom:probe-1',
			source: 'kuma_prod',
			name: 'Test Probe',
			url: 'https://test.lan',
			status: 'up',
			responseTime: 50,
			uptime24h: 100,
			uptime7d: 100,
			lastCheck: new Date().toISOString(),
			group: null,
			criticality: 'medium'
		};

		const mockStore = {
			getProbe: (id: string) => (id === 'custom:probe-1' ? fakeProbe : undefined)
		};

		const resolved = getAdapterForProbe('custom:probe-1', mockStore);
		assert.equal(resolved, kuma1);
	});

	it('should resolve adapter for probe via prefix matching when not in store', () => {
		const kumaLan = createDummyAdapter('kuma_lan', 'uptimekuma');
		const robotMain = createDummyAdapter('robot_main', 'uptimerobot');

		registerAdapter(kumaLan);
		registerAdapter(robotMain);

		assert.equal(getAdapterForProbe('kuma_lan:42'), kumaLan);
		assert.equal(getAdapterForProbe('robot_main:108'), robotMain);
	});

	it('should resolve legacy prefixes (ur, uk, mock)', () => {
		const kuma = createDummyAdapter('uptimekuma', 'uptimekuma');
		const robot = createDummyAdapter('uptimerobot', 'uptimerobot');
		const mock = createDummyAdapter('mock', 'mock');

		registerAdapter(kuma);
		registerAdapter(robot);
		registerAdapter(mock);

		assert.equal(getAdapterForProbe('ur:12345'), robot);
		assert.equal(getAdapterForProbe('uk:service_status'), kuma);
		assert.equal(getAdapterForProbe('mock:1'), mock);
	});
});
