import type { Criticality, NormalizedProbe, ProbeStatus } from '$lib/types';

/**
 * Operational status sort weights.
 * Priority order: DOWN first (0), then DEGRADED (1), UP (2), PAUSED (3), PENDING (4), MAINTENANCE (5).
 */
const STATUS_PRIORITY: Record<ProbeStatus, number> = {
	down: 0,
	degraded: 1,
	up: 2,
	paused: 3,
	pending: 4,
	maintenance: 5
};

/**
 * Criticality level sort weights.
 * Priority order: critical (0), high (1), medium (2), low (3).
 */
const CRITICALITY_PRIORITY: Record<Criticality, number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3
};

/**
 * Sorts probes according to Kato's smart sort algorithm:
 * 1. DOWN probes are systematically promoted to the top-left of the grid
 * 2. DEGRADED probes follow immediately after DOWN probes
 * 3. UP probes are ordered by descending operational criticality
 * 4. PAUSED, PENDING, and MAINTENANCE probes appear at the end
 * 5. Ties are resolved by natural alphabetical order by probe name
 *
 * @param probes List of probes to order
 * @returns Newly sorted probe array
 */
export function sortProbesSmart(probes: NormalizedProbe[]): NormalizedProbe[] {
	return [...probes].sort((a, b) => {
		// 1. Sort by operational status
		const statusDiff = (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99);
		if (statusDiff !== 0) {
			return statusDiff;
		}

		// 2. When both are UP: sort by criticality
		if (a.status === 'up' && b.status === 'up') {
			const critDiff =
				(CRITICALITY_PRIORITY[a.criticality] ?? 99) -
				(CRITICALITY_PRIORITY[b.criticality] ?? 99);
			if (critDiff !== 0) {
				return critDiff;
			}
		}

		// 3. When both are DOWN: prioritize most recent outage
		if (a.status === 'down' && b.status === 'down' && a.downSince && b.downSince) {
			const timeDiff = new Date(b.downSince).getTime() - new Date(a.downSince).getTime();
			if (timeDiff !== 0) {
				return timeDiff;
			}
		}

		// 4. Natural alphabetical fallback
		return a.name.localeCompare(b.name, undefined, { numeric: true });
	});
}
