import type {
	DashboardDelta,
	DashboardState,
	NormalizedIncident,
	NormalizedProbe
} from '$lib/types';

/** Durée de la fenêtre glissante des incidents conservés en RAM (24h en ms) */
const INCIDENT_ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Seuil de tolérance pour les variations de temps de réponse (en ms).
 * En dessous de ce seuil, les micro-fluctuations ne génèrent pas de delta.
 */
const RESPONSE_TIME_JITTER_THRESHOLD_MS = 20;

type DeltaCallback = (delta: DashboardDelta) => void;

/**
 * Store in-memory singleton maintenant l'état courant du dashboard.
 *
 * Responsabilités :
 * - Stockage des sondes indexées par ID dans une Map.
 * - Détection différentielle (delta) à chaque mise à jour.
 * - Gestion des incidents avec fenêtre glissante 24h.
 * - Système pub/sub pour notifier l'endpoint SSE.
 */
class DashboardStore {
	/** Index principal des sondes (ID → sonde) */
	private probes: Map<string, NormalizedProbe> = new Map();

	/** Index des incidents actifs + résolus dans les 24h */
	private incidents: Map<string, NormalizedIncident> = new Map();

	/** Nom du fournisseur source actif */
	private sourceName = 'unknown';

	/** Horodatage de la dernière mise à jour */
	private lastUpdate = new Date().toISOString();

	/** Registre des abonnés SSE */
	private subscribers: Set<DeltaCallback> = new Set();

	// ============================================================================
	// LECTURE DE L'ÉTAT
	// ============================================================================

	/**
	 * Retourne un snapshot complet de l'état courant du dashboard.
	 * Utilisé pour l'événement SSE `init` lors d'une nouvelle connexion client.
	 */
	getState(): DashboardState {
		return {
			probes: Array.from(this.probes.values()),
			incidents: this.getIncidents(),
			lastUpdate: this.lastUpdate,
			source: this.sourceName
		};
	}

	/**
	 * Retourne les incidents dans la fenêtre glissante des 24 dernières heures,
	 * triés antéchronologiquement (les plus récents en premier).
	 */
	getIncidents(): NormalizedIncident[] {
		return Array.from(this.incidents.values()).sort(
			(a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
		);
	}

	// ============================================================================
	// MISE À JOUR ET DÉTECTION DE DELTA
	// ============================================================================

	/**
	 * Met à jour l'état du store avec une nouvelle liste de sondes.
	 *
	 * - Compare chaque sonde avec la version en mémoire.
	 * - Génère un DashboardDelta si des changements significatifs sont détectés.
	 * - Met à jour la liste d'incidents (ouverture et clôture).
	 * - Purge les incidents hors fenêtre glissante (> 24h).
	 * - Notifie les abonnés si un delta est produit.
	 *
	 * @returns Le delta produit, ou null si rien n'a changé.
	 */
	updateProbes(probes: NormalizedProbe[], source?: string): DashboardDelta | null {
		if (source) {
			this.sourceName = source;
		}

		const now = Date.now();
		const nowIso = new Date(now).toISOString();
		const changed: NormalizedProbe[] = [];
		const newIncidents: NormalizedIncident[] = [];
		const resolvedIncidentIds: string[] = [];

		// ── 1. Détection des changements ─────────────────────────────────────────
		for (const incoming of probes) {
			const existing = this.probes.get(incoming.id);

			if (!existing) {
				// Nouvelle sonde — toujours considérée comme un changement
				this.probes.set(incoming.id, { ...incoming });
				changed.push(incoming);

				// Ouvrir un incident si elle démarre DOWN
				if (incoming.status === 'down' || incoming.status === 'degraded') {
					const incident = this.openIncident(incoming, nowIso);
					this.incidents.set(incident.id, incident);
					newIncidents.push(incident);
				}
				continue;
			}

			// Vérifier si un changement significatif s'est produit
			const statusChanged = existing.status !== incoming.status;
			const responseTimeChanged = hasResponseTimeChanged(
				existing.responseTime,
				incoming.responseTime
			);
			const uptimeChanged =
				existing.uptime24h !== incoming.uptime24h || existing.uptime7d !== incoming.uptime7d;

			if (statusChanged || responseTimeChanged || uptimeChanged) {
				changed.push(incoming);
				this.probes.set(incoming.id, { ...incoming });

				if (statusChanged) {
					// ── Transition vers un état problématique ───────────────────────
					if (
						(incoming.status === 'down' || incoming.status === 'degraded') &&
						existing.status !== 'down' &&
						existing.status !== 'degraded'
					) {
						const incident = this.openIncident(incoming, nowIso);
						this.incidents.set(incident.id, incident);
						newIncidents.push(incident);
					}

					// ── Résolution : retour vers un état sain ────────────────────────
					if (
						incoming.status !== 'down' &&
						incoming.status !== 'degraded' &&
						(existing.status === 'down' || existing.status === 'degraded')
					) {
						const resolved = this.closeIncident(incoming.id, nowIso);
						resolvedIncidentIds.push(...resolved);
					}
				}
			} else {
				// Pas de changement significatif — on met quand même à jour lastCheck
				this.probes.set(incoming.id, { ...incoming });
			}
		}

		// ── 2. Purge de la fenêtre glissante (incidents > 24h résolus) ───────────
		this.purgeOldIncidents(now);

		// ── 3. Mise à jour de l'horodatage ───────────────────────────────────────
		this.lastUpdate = nowIso;

		// ── 4. Pas de changement significatif → pas de delta ─────────────────────
		if (changed.length === 0 && newIncidents.length === 0 && resolvedIncidentIds.length === 0) {
			return null;
		}

		const delta: DashboardDelta = {
			changed,
			newIncidents,
			resolvedIncidentIds,
			timestamp: nowIso
		};

		// ── 5. Notification des abonnés ───────────────────────────────────────────
		this.notifySubscribers(delta);

		return delta;
	}

	// ============================================================================
	// PUB/SUB
	// ============================================================================

	/**
	 * Enregistre un abonné pour recevoir les deltas en temps réel.
	 * Retourne une fonction d'unsubscribe à appeler lors de la déconnexion SSE.
	 */
	subscribe(callback: DeltaCallback): () => void {
		this.subscribers.add(callback);
		return () => {
			this.subscribers.delete(callback);
		};
	}

	// ============================================================================
	// MÉTHODES PRIVÉES
	// ============================================================================

	/**
	 * Crée un nouvel incident ouvert pour une sonde dégradée ou en panne.
	 */
	private openIncident(probe: NormalizedProbe, nowIso: string): NormalizedIncident {
		const incidentId = `inc:${probe.id}:${Date.now()}`;
		return {
			id: incidentId,
			probeId: probe.id,
			probeName: probe.name,
			type: probe.status === 'down' ? 'down' : 'degraded',
			startedAt: nowIso,
			resolvedAt: null,
			duration: null
		};
	}

	/**
	 * Clôture tous les incidents actifs d'une sonde et retourne leurs IDs.
	 */
	private closeIncident(probeId: string, nowIso: string): string[] {
		const resolved: string[] = [];
		const now = new Date(nowIso).getTime();

		for (const incident of this.incidents.values()) {
			if (incident.probeId === probeId && incident.resolvedAt === null) {
				incident.resolvedAt = nowIso;
				incident.duration = Math.max(
					1,
					Math.round((now - new Date(incident.startedAt).getTime()) / 1000)
				);
				resolved.push(incident.id);
			}
		}

		return resolved;
	}

	/**
	 * Supprime les incidents résolus dont la date de résolution est hors de
	 * la fenêtre glissante de 24 heures.
	 */
	private purgeOldIncidents(nowMs: number): void {
		const cutoff = nowMs - INCIDENT_ROLLING_WINDOW_MS;
		for (const [id, incident] of this.incidents) {
			if (incident.resolvedAt !== null) {
				const resolvedMs = new Date(incident.resolvedAt).getTime();
				if (resolvedMs < cutoff) {
					this.incidents.delete(id);
				}
			}
		}
	}

	/**
	 * Diffuse un delta à tous les abonnés enregistrés.
	 */
	private notifySubscribers(delta: DashboardDelta): void {
		for (const cb of this.subscribers) {
			try {
				cb(delta);
			} catch (err) {
				console.error('[Store] Erreur dans un callback abonné SSE :', err);
			}
		}
	}
}

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Détermine si la variation de temps de réponse dépasse le seuil de jitter.
 */
function hasResponseTimeChanged(a: number | null, b: number | null): boolean {
	if (a === null && b === null) return false;
	if (a === null || b === null) return true;
	return Math.abs(a - b) > RESPONSE_TIME_JITTER_THRESHOLD_MS;
}

// ============================================================================
// EXPORT DU SINGLETON
// ============================================================================

/**
 * Instance singleton du store partagée entre le poller et l'endpoint SSE.
 * Exportée au niveau module pour être accessible depuis hooks.server.ts et les routes.
 */
export const store = new DashboardStore();
export type { DashboardStore };
