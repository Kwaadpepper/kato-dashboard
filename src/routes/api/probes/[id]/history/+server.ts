import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isAuthEnabled, isValidSession, SESSION_COOKIE_NAME } from '$lib/server/auth';
import { getActiveAdapter } from '$lib/server/adapter';
import { store } from '$lib/server/store';
import type { NormalizedIncident } from '$lib/types';

/** Durée de mise en cache mémoire (2 minutes en ms) pour préserver les quotas d'appels API */
const CACHE_TTL_MS = 2 * 60 * 1000;

interface CachedEntry {
	timestamp: number;
	incidents: NormalizedIncident[];
}

/** Cache en mémoire des historiques individuels par ID de sonde */
const historyCache = new Map<string, CachedEntry>();

export const GET: RequestHandler = async ({ params, cookies }) => {
	// Contrôle d'accès si l'authentification est activée
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

	// 1. Vérification du cache mémoire
	const cached = historyCache.get(probeId);
	if (cached && now - cached.timestamp < CACHE_TTL_MS) {
		return json({
			probeId,
			source: 'cache',
			incidents: cached.incidents
		});
	}

	let incidents: NormalizedIncident[] = [];
	const adapter = getActiveAdapter();

	// 2. Interrogation de l'adaptateur si la méthode unitaire est disponible
	if (adapter && typeof adapter.fetchProbeHistory === 'function') {
		try {
			incidents = await adapter.fetchProbeHistory(probeId);
		} catch (err) {
			console.warn(`[API History] Erreur lors de la récupération pour ${probeId} :`, err);
		}
	}

	// 3. Repli sur les incidents du store local en RAM
	if (!incidents || incidents.length === 0) {
		incidents = store.getIncidents().filter((i) => i.probeId === probeId);
	} else {
		// Fusionner d'éventuels incidents du store en direct
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

	// 4. Mise en cache mémoire
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
