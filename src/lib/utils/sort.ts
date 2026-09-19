import type { Criticality, NormalizedProbe, ProbeStatus } from '$lib/types';

/**
 * Poids de tri par statut opérationnel.
 * Ordre de priorité : DOWN en premier (0), puis DEGRADED (1), UP (2), PAUSED (3), etc.
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
 * Poids de tri par niveau de criticité.
 * Ordre de priorité : critical (0), high (1), medium (2), low (3).
 */
const CRITICALITY_PRIORITY: Record<Criticality, number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3
};

/**
 * Trie les sondes selon l'algorithme de tri intelligent (Smart Sort) de Kato :
 * 1. Les sondes DOWN sont systématiquement promues en haut à gauche de la grille
 * 2. Les sondes DEGRADED suivent immédiatement les DOWN
 * 3. Les sondes UP sont ordonnées par niveau de criticité décroissante
 * 4. Les sondes PAUSED, PENDING et MAINTENANCE ferment la marche
 * 5. En cas d'égalité, tri alphabétique naturel par nom
 *
 * @param probes Liste des sondes à ordonner
 * @returns Nouvelle liste triée
 */
export function sortProbesSmart(probes: NormalizedProbe[]): NormalizedProbe[] {
	return [...probes].sort((a, b) => {
		// 1. Tri par statut
		const statusDiff = (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99);
		if (statusDiff !== 0) {
			return statusDiff;
		}

		// 2. Si les deux sont UP : tri par niveau de criticité
		if (a.status === 'up' && b.status === 'up') {
			const critDiff =
				(CRITICALITY_PRIORITY[a.criticality] ?? 99) -
				(CRITICALITY_PRIORITY[b.criticality] ?? 99);
			if (critDiff !== 0) {
				return critDiff;
			}
		}

		// 3. Si les deux sont DOWN : priorité à l'incident le plus récent
		if (a.status === 'down' && b.status === 'down' && a.downSince && b.downSince) {
			const timeDiff = new Date(b.downSince).getTime() - new Date(a.downSince).getTime();
			if (timeDiff !== 0) {
				return timeDiff;
			}
		}

		// 4. Tri alphabétique de repli
		return a.name.localeCompare(b.name, 'fr', { numeric: true });
	});
}
