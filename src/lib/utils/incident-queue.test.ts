import type { NormalizedIncident } from '$lib/types';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
    IncidentQueueManager,
    createIncidentQueue,
    formatIncidentDuration
} from './incident-queue.ts';

function createMockIncident(id: string, name: string, type: 'down' | 'degraded' = 'down'): NormalizedIncident {
	return {
		id,
		probeId: `probe-${id}`,
		probeName: name,
		type,
		startedAt: new Date(Date.now() - 30_000).toISOString(), // 30s ago
		resolvedAt: null,
		duration: 30
	};
}

describe('incident-queue utility module', () => {
	describe('formatIncidentDuration', () => {
		it('should return 0s for invalid or empty timestamp', () => {
			assert.equal(formatIncidentDuration(''), '0s');
			assert.equal(formatIncidentDuration('invalid-date'), '0s');
		});

		it('should format seconds correctly', () => {
			const now = 100_000;
			const startedAt = new Date(now - 25_000).toISOString();
			assert.equal(formatIncidentDuration(startedAt, now), '0m 25s');
		});

		it('should format minutes and seconds correctly', () => {
			const now = 100_000;
			const startedAt = new Date(now - 145_000).toISOString(); // 2m 25s
			assert.equal(formatIncidentDuration(startedAt, now), '2m 25s');
		});

		it('should format hours, minutes and seconds correctly', () => {
			const now = 10_000_000;
			const startedAt = new Date(now - 3_665_000).toISOString(); // 1h 1m 5s
			assert.equal(formatIncidentDuration(startedAt, now), '1h 1m 5s');
		});

		it('should format days and hours correctly', () => {
			const now = 200_000_000;
			const startedAt = new Date(now - (86400 * 2 + 3600 * 3 + 60 * 10) * 1000).toISOString();
			assert.equal(formatIncidentDuration(startedAt, now), '2d 3h 10m');
			assert.equal(formatIncidentDuration(startedAt, now, 'fr'), '2j 3h 10m');
		});
	});

	describe('IncidentQueueManager FIFO cycle logic', () => {
		let queue: IncidentQueueManager;

		beforeEach(() => {
			queue = createIncidentQueue([], false);
		});

		it('should initialize with empty state when no incidents are provided', () => {
			const state = queue.getState();
			assert.equal(state.displayed.length, 0);
			assert.equal(state.activeCount, 0);
			assert.equal(state.pendingCount, 0);
			assert.equal(state.isScrolling, false);
			assert.equal(state.cycleCount, 0);
		});

		it('should immediately start scrolling when first incidents arrive', () => {
			const inc1 = createMockIncident('1', 'Auth Service');
			queue.setIncidents([inc1], true);

			const state = queue.getState();
			assert.equal(state.displayed.length, 1);
			assert.equal(state.displayed[0]?.probeName, 'Auth Service');
			assert.equal(state.activeCount, 1);
			assert.equal(state.pendingCount, 0);
			assert.equal(state.isScrolling, true);
			assert.equal(state.cycleCount, 1);
		});

		it('should preserve displayed items while scrolling and place new incidents into the FIFO queue', () => {
			const inc1 = createMockIncident('1', 'Auth Service');
			queue.setIncidents([inc1], true);

			// A second incident occurs during scrolling
			const inc2 = createMockIncident('2', 'Database Primary');
			queue.setIncidents([inc1, inc2], true);

			const state = queue.getState();
			// Displayed items are preserved until current scroll cycle completes
			assert.equal(state.displayed.length, 1);
			assert.equal(state.displayed[0]?.id, '1');
			// Pending queue now contains both incidents ready for the next cycle
			assert.equal(state.activeCount, 2);
			assert.equal(state.pendingCount, 2);
			assert.equal(state.cycleCount, 1);
		});

		it('should promote queued incidents to displayed when cycle completes', () => {
			const inc1 = createMockIncident('1', 'Auth Service');
			queue.setIncidents([inc1], true);

			const inc2 = createMockIncident('2', 'Database Primary');
			queue.setIncidents([inc1, inc2], true);

			// Animation completes its scroll cycle
			queue.onCycleComplete();

			const state = queue.getState();
			// New cycle begins with both incidents
			assert.equal(state.displayed.length, 2);
			assert.equal(state.displayed[0]?.id, '1');
			assert.equal(state.displayed[1]?.id, '2');
			assert.equal(state.pendingCount, 0);
			assert.equal(state.cycleCount, 2);
		});

		it('should let resolved incidents finish their scroll before removing them', () => {
			const inc1 = createMockIncident('1', 'Auth Service');
			const inc2 = createMockIncident('2', 'Database Primary');
			queue.setIncidents([inc1, inc2], true);

			// Incident 1 resolves while scrolling
			const inc1Resolved = { ...inc1, resolvedAt: new Date().toISOString() };
			queue.setIncidents([inc1Resolved, inc2], true);

			// During scrolling, incident 1 stays visible until scroll completes
			let state = queue.getState();
			assert.equal(state.displayed.length, 2);
			assert.equal(state.activeCount, 1);
			assert.equal(state.pendingCount, 1);

			// Cycle completes: queue is flushed, incident 1 removed in the next cycle
			queue.onCycleComplete();

			state = queue.getState();
			assert.equal(state.displayed.length, 1);
			assert.equal(state.displayed[0]?.id, '2');
			assert.equal(state.pendingCount, 0);
		});

		it('should transition to empty state only AFTER current cycle finishes when all incidents resolve', () => {
			const inc1 = createMockIncident('1', 'Auth Service');
			queue.setIncidents([inc1], true);

			// All incidents resolve during scrolling
			const inc1Resolved = { ...inc1, resolvedAt: new Date().toISOString() };
			queue.setIncidents([inc1Resolved], true);

			// Item 1 continues scrolling to the end
			let state = queue.getState();
			assert.equal(state.displayed.length, 1);
			assert.equal(state.activeCount, 0);
			assert.equal(state.pendingCount, 0);
			assert.equal(state.isScrolling, true);

			// End of animation cycle: transition to idle empty state
			queue.onCycleComplete();

			state = queue.getState();
			assert.equal(state.displayed.length, 0);
			assert.equal(state.isScrolling, false);
		});

		it('should refresh duration snapshot at each cycle completion when no events changed', () => {
			const inc1 = createMockIncident('1', 'Auth Service');
			queue.setIncidents([inc1], true);

			const initialDuration = queue.getState().displayed[0]?.formattedDuration;
			assert.ok(initialDuration);

			// Cycle completed without new events
			queue.onCycleComplete();

			const state = queue.getState();
			assert.equal(state.displayed.length, 1);
			assert.equal(state.cycleCount, 2);
		});

		it('should immediately update without queuing when shouldAnimate is false', () => {
			const inc1 = createMockIncident('1', 'Auth Service');
			queue.setIncidents([inc1], false);

			let state = queue.getState();
			assert.equal(state.displayed.length, 1);
			assert.equal(state.isScrolling, false);

			const inc2 = createMockIncident('2', 'Database Primary');
			queue.setIncidents([inc1, inc2], false);

			state = queue.getState();
			assert.equal(state.displayed.length, 2);
			assert.equal(state.isScrolling, false);
		});

		it('should support immediate flush()', () => {
			const inc1 = createMockIncident('1', 'Auth Service');
			queue.setIncidents([inc1], true);

			const inc2 = createMockIncident('2', 'Database Primary');
			queue.setIncidents([inc1, inc2], true);

			// Immediate flush
			queue.flush();

			const state = queue.getState();
			assert.equal(state.displayed.length, 2);
			assert.equal(state.pendingCount, 0);
		});

		it('should notify subscribers on state changes', () => {
			const notifications: number[] = [];
			const unsubscribe = queue.subscribe((state) => {
				notifications.push(state.displayed.length);
			});

			const inc1 = createMockIncident('1', 'Auth Service');
			queue.setIncidents([inc1], true);

			unsubscribe();
			queue.reset();

			assert.deepEqual(notifications, [0, 1]);
		});
	});
});
