import type { DashboardDelta, DashboardState } from '$lib/types';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { connectSSE, type ConnectionStatus } from './sse-client.ts';

class MockEventSource {
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSED = 2;

	public readyState = MockEventSource.CONNECTING;
	public url: string;
	public onopen: (() => void) | null = null;
	public onerror: ((error: unknown) => void) | null = null;
	private listeners: Record<string, Array<(event: MessageEvent) => void>> = {};
	public isClosed = false;

	constructor(url: string) {
		this.url = url;
		// Simulated instances registered for test harness
		MockEventSource.instances.push(this);
	}

	static instances: MockEventSource[] = [];

	addEventListener(type: string, listener: (event: MessageEvent) => void): void {
		if (!this.listeners[type]) {
			this.listeners[type] = [];
		}
		this.listeners[type].push(listener);
	}

	removeEventListener(type: string, listener: (event: MessageEvent) => void): void {
		if (!this.listeners[type]) return;
		this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
	}

	emitEvent(type: string, data: unknown): void {
		const payload = { data: JSON.stringify(data) } as MessageEvent;
		const handlers = this.listeners[type] ? [...this.listeners[type]] : [];
		for (const h of handlers) {
			h(payload);
		}
	}

	simulateOpen(): void {
		this.readyState = MockEventSource.OPEN;
		if (this.onopen) {
			this.onopen();
		}
	}

	simulateError(close = false): void {
		if (close) {
			this.readyState = MockEventSource.CLOSED;
		}
		if (this.onerror) {
			this.onerror(new Error('Simulated network error'));
		}
	}

	close(): void {
		this.readyState = MockEventSource.CLOSED;
		this.isClosed = true;
	}
}

describe('sse-client utility module', () => {
	const originalEventSource = globalThis.EventSource;

	beforeEach(() => {
		MockEventSource.instances = [];
		// @ts-expect-error Mocking EventSource for tests
		globalThis.EventSource = MockEventSource;
	});

	afterEach(() => {
		globalThis.EventSource = originalEventSource;
	});

	it('should connect, handle init event and notify connected status', () => {
		let receivedInit: DashboardState | null = null;
		let receivedStatus: ConnectionStatus | null = null;

		const disconnect = connectSSE(
			(state) => {
				receivedInit = state;
			},
			() => {},
			() => {},
			(status) => {
				receivedStatus = status;
			}
		);

		assert.equal(MockEventSource.instances.length, 1);
		const instance = MockEventSource.instances[0];
		assert.equal(instance.url, '/api/events');

		// Simulate open
		instance.simulateOpen();
		assert.equal(receivedStatus, 'connected');

		// Simulate init payload
		const mockState: DashboardState = {
			probes: [],
			incidents: [],
			lastUpdate: '2026-09-19T12:00:00.000Z',
			source: 'mock'
		};
		instance.emitEvent('init', mockState);
		assert.deepEqual(receivedInit, mockState);

		disconnect();
		assert.equal(instance.isClosed, true);
	});

	it('should receive update and heartbeat events', () => {
		let receivedDelta: DashboardDelta | null = null;
		let receivedHeartbeat: { timestamp: string } | null = null;

		const disconnect = connectSSE(
			() => {},
			(delta) => {
				receivedDelta = delta;
			},
			(hb) => {
				receivedHeartbeat = hb;
			}
		);

		const instance = MockEventSource.instances[0];

		// Emit delta
		const mockDelta: DashboardDelta = {
			changed: [],
			newIncidents: [],
			resolvedIncidentIds: [],
			timestamp: '2026-09-19T12:01:00.000Z'
		};
		instance.emitEvent('update', mockDelta);
		assert.deepEqual(receivedDelta, mockDelta);

		// Emit heartbeat
		const mockHb = { timestamp: '2026-09-19T12:01:15.000Z' };
		instance.emitEvent('heartbeat', mockHb);
		assert.deepEqual(receivedHeartbeat, mockHb);

		disconnect();
	});

	it('should transition to disconnected on error and reconnect when closed', async () => {
		const statuses: ConnectionStatus[] = [];

		const disconnect = connectSSE(
			() => {},
			() => {},
			() => {},
			(status) => {
				statuses.push(status);
			}
		);

		const instance1 = MockEventSource.instances[0];
		instance1.simulateOpen();
		assert.ok(statuses.includes('connected'));

		// Simulate error with connection close
		instance1.simulateError(true);
		assert.ok(statuses.includes('disconnected'));
		assert.ok(statuses.includes('reconnecting'));

		disconnect();
	});

	it('should cleanly abort reconnection on disconnect', () => {
		const statuses: ConnectionStatus[] = [];

		const disconnect = connectSSE(
			() => {},
			() => {},
			() => {},
			(status) => {
				statuses.push(status);
			}
		);

		const instance1 = MockEventSource.instances[0];
		instance1.simulateError(true);

		// Appel disconnect avant le timer de 3s
		disconnect();

		// S'assurer qu'aucune nouvelle instance n'est créée
		assert.equal(MockEventSource.instances.length, 1);
		assert.equal(instance1.isClosed, true);
	});
});
