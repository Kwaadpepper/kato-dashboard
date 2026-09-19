import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { store } from './store.ts';
import type { NormalizedProbe } from '$lib/types';

describe('DashboardStore lifecycle and memory leak prevention', () => {
	it('should cleanly register and deregister subscribers without leaks', () => {
		const initialCount = store.getSubscriberCount();

		const unsub1 = store.subscribe(() => {});
		const unsub2 = store.subscribe(() => {});

		assert.equal(store.getSubscriberCount(), initialCount + 2);

		unsub1();
		assert.equal(store.getSubscriberCount(), initialCount + 1);

		unsub2();
		assert.equal(store.getSubscriberCount(), initialCount);
	});

	it('should dispatch updates to subscribers when probes change status', () => {
		const receivedDeltas: unknown[] = [];
		const unsub = store.subscribe((delta) => {
			receivedDeltas.push(delta);
		});

		const probe1: NormalizedProbe = {
			id: 'test-probe-1',
			name: 'Test Probe 1',
			url: 'https://test.kato.io',
			status: 'up',
			responseTime: 50,
			uptime24h: 100,
			uptime7d: 100,
			criticality: 'critical',
			lastCheck: new Date().toISOString(),
			group: 'APIs',
			source: 'test'
		};

		// Initial update
		store.updateProbes([probe1], 'test');

		// Transition to down
		const downProbe: NormalizedProbe = {
			...probe1,
			status: 'down',
			downSince: new Date().toISOString()
		};

		store.updateProbes([downProbe], 'test');

		assert.ok(receivedDeltas.length >= 1, 'Expected at least one delta dispatched');

		unsub();
	});

	it('should not crash or drop other subscribers if one subscriber throws an error', () => {
		let secondReceived = false;

		const unsubBad = store.subscribe(() => {
			throw new Error('Failing subscriber');
		});

		const unsubGood = store.subscribe(() => {
			secondReceived = true;
		});

		const probe: NormalizedProbe = {
			id: 'test-probe-2',
			name: 'Test Probe 2',
			url: 'https://test2.kato.io',
			status: 'down',
			responseTime: null,
			uptime24h: 90,
			uptime7d: 90,
			criticality: 'high',
			lastCheck: new Date().toISOString(),
			group: 'APIs',
			source: 'test'
		};

		store.updateProbes([probe], 'test');

		assert.equal(secondReceived, true, 'Healthy subscriber should still receive the update');

		unsubBad();
		unsubGood();
	});
});
