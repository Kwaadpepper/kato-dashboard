import { getAdapterForProbe } from '$lib/server/adapter';
import { isAuthEnabled, isValidSession, SESSION_COOKIE_NAME } from '$lib/server/auth';
import { store } from '$lib/server/store';
import type { NormalizedIncident } from '$lib/types';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Memory cache TTL (2 minutes in ms) to preserve API call quotas */
const CACHE_TTL_MS = 2 * 60 * 1000;

interface CachedEntry {
	timestamp: number;
	incidents: NormalizedIncident[];
}

/** In-memory cache of individual histories by probe ID */
const historyCache = new Map<string, CachedEntry>();

export const GET: RequestHandler = async ({ params, cookies }) => {
	// Access control when authentication is enabled
	if (isAuthEnabled()) {
		const token = cookies.get(SESSION_COOKIE_NAME);
		if (!isValidSession(token)) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
	}

	const probeId = params.id;
	if (!probeId) {
		return json({ error: 'Missing probe ID' }, { status: 400 });
	}

	const now = Date.now();

	// 1. Check memory cache
	const cached = historyCache.get(probeId);
	if (cached && now - cached.timestamp < CACHE_TTL_MS) {
		return json({
			probeId,
			source: 'cache',
			incidents: cached.incidents
		});
	}

	let incidents: NormalizedIncident[] = [];
	const adapter = getAdapterForProbe(probeId, store);

	// 2. Query adapter if unit history method is available
	if (adapter && typeof adapter.fetchProbeHistory === 'function') {
		try {
			incidents = await adapter.fetchProbeHistory(probeId);
		} catch (err) {
			console.warn(`[API History] Error fetching history for ${probeId}:`, err);
		}
	}

	// 3. Fallback to RAM store incidents
	if (!incidents || incidents.length === 0) {
		incidents = store.getIncidents().filter((i) => i.probeId === probeId);
	} else {
		// Merge live store incidents if any
		const storeMatches = store.getIncidents().filter((i) => i.probeId === probeId);
		const map = new Map<string, NormalizedIncident>();
		for (const inc of storeMatches) {
			map.set(inc.id, inc);
		}
		for (const inc of incidents) {
			map.set(inc.id, inc);
		}
		incidents = Array.from(map.values()).sort(
			(a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
		);
	}

	// 4. Cache in memory
	historyCache.set(probeId, {
		timestamp: now,
		incidents
	});

	return json({
		probeId,
		source: adapter?.name ?? 'store',
		incidents
	});
};
