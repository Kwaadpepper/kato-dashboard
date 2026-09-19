import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	build24hSlots,
	buildProbeHistoryEvents,
	computeProbeHistoryStats,
	formatDurationCompact,
	formatEventDateTime
} from './probe-history.ts';
import type { NormalizedIncident, NormalizedProbe } from '$lib/types';

describe('probe-history utility module', () => {
	const fixedNow = new Date('2026-09-19T18:00:00.000Z');
	const fixedNowMs = fixedNow.getTime();

	const mockProbe: NormalizedProbe = {
		id: 'test:probe-1',
		source: 'test',
		name: 'API Production',
		url: 'https://api.example.com',
		status: 'up',
		responseTime: 45,
		uptime24h: 99.8,
		uptime7d: 99.9,
		lastCheck: fixedNow.toISOString(),
		group: 'APIs',
		criticality: 'critical'
	};

	describe('build24hSlots', () => {
		it('should generate exactly 24 hourly slots in chronological order', () => {
			const slots = build24hSlots([], fixedNow);
			assert.equal(slots.length, 24);
			assert.equal(slots[0].index, 0);
			assert.equal(slots[23].index, 23);

			// Slot 0 starts 24h before fixedNow
			const expectedStart = new Date(fixedNowMs - 24 * 3600 * 1000).toISOString();
			assert.equal(slots[0].startTime, expectedStart);

			// Slot 23 ends at fixedNow
			assert.equal(slots[23].endTime, fixedNow.toISOString());

			// All slots are 'up' when no incidents exist
			for (const slot of slots) {
				assert.equal(slot.status, 'up');
				assert.equal(slot.incidentCount, 0);
				assert.equal(slot.downtimeSeconds, 0);
			}
		});

		it('should mark slots overlapping with an outage as down with correct downtime', () => {
			// Incident 2 hours ago lasting 30 minutes (from 15:30 to 16:00, which falls in slot 21)
			const outageStart = new Date(fixedNowMs - 2.5 * 3600 * 1000).toISOString(); // 15:30
			const outageEnd = new Date(fixedNowMs - 2.0 * 3600 * 1000).toISOString(); // 16:00

			const incident: NormalizedIncident = {
				id: 'inc:1',
				probeId: 'test:probe-1',
				probeName: 'API Production',
				type: 'down',
				startedAt: outageStart,
				resolvedAt: outageEnd,
				duration: 1800,
				cause: 'HTTP 503 Service Unavailable'
			};

			const slots = build24hSlots([incident], fixedNow);
			assert.equal(slots.length, 24);

			// Slot 21 (15:00 - 16:00) should be 'down'
			const slot21 = slots[21];
			assert.equal(slot21.status, 'down');
			assert.equal(slot21.incidentCount, 1);
			assert.equal(slot21.downtimeSeconds, 1800);
			assert.match(slot21.label, /Panne/);

			// Adjacent slots should remain 'up'
			assert.equal(slots[20].status, 'up');
			assert.equal(slots[22].status, 'up');
		});

		it('should mark slots as degraded if only degraded incidents occur', () => {
			const degStart = new Date(fixedNowMs - 1.5 * 3600 * 1000).toISOString();
			const degEnd = new Date(fixedNowMs - 1.2 * 3600 * 1000).toISOString();

			const incident: NormalizedIncident = {
				id: 'inc:deg-1',
				probeId: 'test:probe-1',
				probeName: 'API Production',
				type: 'degraded',
				startedAt: degStart,
				resolvedAt: degEnd,
				duration: 1080
			};

			const slots = build24hSlots([incident], fixedNow);
			const slot22 = slots[22];
			assert.equal(slot22.status, 'degraded');
			assert.match(slot22.label, /Dégradé/);
		});
	});

	describe('buildProbeHistoryEvents', () => {
		it('should return empty list when no incidents match the probe', () => {
			const otherIncident: NormalizedIncident = {
				id: 'inc:other',
				probeId: 'other:probe-2',
				probeName: 'Other Probe',
				type: 'down',
				startedAt: new Date(fixedNowMs - 3600000).toISOString(),
				resolvedAt: new Date(fixedNowMs - 1800000).toISOString(),
				duration: 1800
			};

			const events = buildProbeHistoryEvents(mockProbe, [otherIncident], fixedNow);
			assert.equal(events.length, 0);
		});

		it('should format resolved and active incidents with causes and durations', () => {
			const pastIncident: NormalizedIncident = {
				id: 'inc:past',
				probeId: mockProbe.id,
				probeName: mockProbe.name,
				type: 'down',
				startedAt: new Date(fixedNowMs - 7200000).toISOString(),
				resolvedAt: new Date(fixedNowMs - 6600000).toISOString(),
				duration: 600,
				cause: 'Gateway Timeout 504'
			};

			const activeIncident: NormalizedIncident = {
				id: 'inc:active',
				probeId: mockProbe.id,
				probeName: mockProbe.name,
				type: 'down',
				startedAt: new Date(fixedNowMs - 600000).toISOString(),
				resolvedAt: null,
				duration: null,
				cause: 'Connection Refused'
			};

			const events = buildProbeHistoryEvents(
				{ ...mockProbe, status: 'down' },
				[pastIncident, activeIncident],
				fixedNow
			);

			assert.equal(events.length, 2);
			// Newest first (active incident at -10min vs past at -2h)
			assert.equal(events[0].id, 'inc:active');
			assert.equal(events[0].status, 'down');
			assert.equal(events[0].resolvedAt, null);
			assert.equal(events[0].duration, 600); // 10 minutes elapsed
			assert.equal(events[0].cause, 'Connection Refused');

			assert.equal(events[1].id, 'inc:past');
			assert.equal(events[1].duration, 600);
			assert.equal(events[1].cause, 'Gateway Timeout 504');
		});
	});

	describe('computeProbeHistoryStats', () => {
		it('should compute 100% availability and 0 downtime for pristine probe', () => {
			const stats = computeProbeHistoryStats(
				{ ...mockProbe, uptime24h: 100 },
				[],
				fixedNow
			);

			assert.equal(stats.totalIncidents, 0);
			assert.equal(stats.downtimeSeconds, 0);
			assert.equal(stats.availabilityPercentage, 100);
			assert.equal(stats.longestOutageSeconds, 0);
			assert.equal(stats.currentStreakSeconds, 86400);
		});

		it('should compute cumulative downtime and longest outage accurately', () => {
			const inc1: NormalizedIncident = {
				id: 'inc:1',
				probeId: mockProbe.id,
				probeName: mockProbe.name,
				type: 'down',
				startedAt: new Date(fixedNowMs - 10000000).toISOString(),
				resolvedAt: new Date(fixedNowMs - 9700000).toISOString(),
				duration: 300
			};
			const inc2: NormalizedIncident = {
				id: 'inc:2',
				probeId: mockProbe.id,
				probeName: mockProbe.name,
				type: 'down',
				startedAt: new Date(fixedNowMs - 5000000).toISOString(),
				resolvedAt: new Date(fixedNowMs - 4100000).toISOString(),
				duration: 900
			};

			const stats = computeProbeHistoryStats(
				{ ...mockProbe, uptime24h: null },
				[inc1, inc2],
				fixedNow
			);

			assert.equal(stats.totalIncidents, 2);
			assert.equal(stats.downtimeSeconds, 1200);
			assert.equal(stats.longestOutageSeconds, 900);
			// Availability = (86400 - 1200) / 86400 * 100 = 98.61%
			assert.equal(stats.availabilityPercentage, 98.61);
		});
	});

	describe('formatDurationCompact', () => {
		it('should format seconds, minutes, hours and days', () => {
			assert.equal(formatDurationCompact(0), '0s');
			assert.equal(formatDurationCompact(45), '45s');
			assert.equal(formatDurationCompact(60), '1m');
			assert.equal(formatDurationCompact(125), '2m 5s');
			assert.equal(formatDurationCompact(3600), '1h');
			assert.equal(formatDurationCompact(7320), '2h 2m');
			assert.equal(formatDurationCompact(90000), '1j 1h');
		});
	});

	describe('formatEventDateTime', () => {
		it('should format today, yesterday and past dates', () => {
			const todayIso = new Date('2026-09-19T14:30:00.000Z').toISOString();
			const resultToday = formatEventDateTime(todayIso, fixedNow);
			assert.match(resultToday, /Aujourd'hui à \d{2}:\d{2}/);

			const yesterdayIso = new Date('2026-09-18T20:15:00.000Z').toISOString();
			const resultYesterday = formatEventDateTime(yesterdayIso, fixedNow);
			assert.match(resultYesterday, /Hier à \d{2}:\d{2}/);

			const pastIso = new Date('2026-09-15T10:00:00.000Z').toISOString();
			const resultPast = formatEventDateTime(pastIso, fixedNow);
			assert.match(resultPast, /15\/09 à \d{2}:\d{2}/);
		});
	});
});
