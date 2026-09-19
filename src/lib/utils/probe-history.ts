import type {
	NormalizedIncident,
	NormalizedProbe,
	ProbeStatusEvent,
	UptimeBarSlot
} from '$lib/types';

/**
 * Statistiques synthétiques de l'historique sur la fenêtre glissante de 24 heures.
 */
export interface ProbeHistoryStats {
	totalIncidents: number;
	downtimeSeconds: number;
	availabilityPercentage: number;
	longestOutageSeconds: number;
	currentStreakSeconds: number;
}

/** Durée d'une journée en millisecondes */
const DAY_MS = 24 * 60 * 60 * 1000;
/** Durée d'une heure en millisecondes */
const HOUR_MS = 60 * 60 * 1000;

import type { SupportedLocale } from '$lib/types';

/**
 * Construit les 24 créneaux horaires représentant les 24 dernières heures
 * (de H-24 jusqu'à maintenant).
 *
 * @param incidents  Liste des incidents affectant la sonde.
 * @param nowInput   Date de référence (défaut : Date.now()).
 * @param locale     Langue pour les libellés (défaut : 'fr').
 * @returns          Tableau de 24 UptimeBarSlot ordonnés chronologiquement (slot 0 = H-24).
 */
export function build24hSlots(
	incidents: NormalizedIncident[],
	nowInput: Date | number = Date.now(),
	locale: SupportedLocale = 'fr'
): UptimeBarSlot[] {
	const nowMs = typeof nowInput === 'number' ? nowInput : nowInput.getTime();
	const windowStartMs = nowMs - DAY_MS;
	const slots: UptimeBarSlot[] = [];

	for (let i = 0; i < 24; i++) {
		const slotStartMs = windowStartMs + i * HOUR_MS;
		const slotEndMs = slotStartMs + HOUR_MS;

		const slotStartDate = new Date(slotStartMs);
		const slotEndDate = new Date(slotEndMs);

		let incidentCount = 0;
		let downtimeSeconds = 0;
		let hasDown = false;
		let hasDegraded = false;

		for (const inc of incidents) {
			const incStart = new Date(inc.startedAt).getTime();
			const incEnd = inc.resolvedAt ? new Date(inc.resolvedAt).getTime() : nowMs;

			// Vérification du chevauchement avec le créneau horaire
			if (incStart < slotEndMs && incEnd > slotStartMs) {
				incidentCount++;
				if (inc.type === 'down') {
					hasDown = true;
				} else if (inc.type === 'degraded') {
					hasDegraded = true;
				}

				const overlapStart = Math.max(slotStartMs, incStart);
				const overlapEnd = Math.min(slotEndMs, incEnd);
				const overlapSec = Math.max(0, Math.round((overlapEnd - overlapStart) / 1000));
				downtimeSeconds += overlapSec;
			}
		}

		// Statut dominant du créneau
		let status: 'up' | 'down' | 'degraded' | 'paused' | 'empty' = 'up';
		if (hasDown) {
			status = 'down';
		} else if (hasDegraded) {
			status = 'degraded';
		}

		// Formatage du libellé pour infobulle
		const timeFormat: Intl.DateTimeFormatOptions = {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		};
		const startFormatted = slotStartDate.toLocaleTimeString([], timeFormat);
		const endFormatted = slotEndDate.toLocaleTimeString([], timeFormat);

		const isFr = locale === 'fr';
		let statusLabel = isFr ? '100% opérationnel' : '100% operational';
		if (status === 'down') {
			const dStr = formatDurationCompact(downtimeSeconds, locale);
			statusLabel = isFr ? `Panne (${dStr})` : `Outage (${dStr})`;
		} else if (status === 'degraded') {
			const dStr = formatDurationCompact(downtimeSeconds, locale);
			statusLabel = isFr ? `Dégradé (${dStr})` : `Degraded (${dStr})`;
		}

		const label = `${startFormatted} – ${endFormatted} : ${statusLabel}`;

		slots.push({
			index: i,
			startTime: slotStartDate.toISOString(),
			endTime: slotEndDate.toISOString(),
			status,
			label,
			incidentCount,
			downtimeSeconds
		});
	}

	return slots;
}

/**
 * Construit la liste chronologique des événements d'incident (DOWN, DEGRADED, UP)
 * pour une sonde donnée, triés antéchronologiquement (le plus récent en tête).
 */
export function buildProbeHistoryEvents(
	probe: NormalizedProbe,
	incidents: NormalizedIncident[],
	nowInput: Date | number = Date.now()
): ProbeStatusEvent[] {
	const nowMs = typeof nowInput === 'number' ? nowInput : nowInput.getTime();
	const windowStartMs = nowMs - DAY_MS;

	// Filtrer les incidents appartenant à cette sonde et chevauchant les 24h
	const probeIncidents = incidents.filter((inc) => {
		if (inc.probeId !== probe.id) return false;
		const incEnd = inc.resolvedAt ? new Date(inc.resolvedAt).getTime() : nowMs;
		return incEnd >= windowStartMs;
	});

	const events: ProbeStatusEvent[] = [];

	for (const inc of probeIncidents) {
		const startedMs = new Date(inc.startedAt).getTime();

		let duration = inc.duration;
		if (duration === null || duration === undefined) {
			// Incident actif en cours : calculer la durée jusqu'à maintenant
			duration = Math.max(1, Math.round((nowMs - startedMs) / 1000));
		}

		events.push({
			id: inc.id,
			status: inc.type,
			timestamp: inc.startedAt,
			resolvedAt: inc.resolvedAt,
			duration,
			cause: inc.cause || (inc.type === 'down' ? 'Interruption de service' : 'Instabilité / latence')
		});
	}

	// Tri antéchronologique (les plus récents en premier)
	return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Calcule les métriques synthétiques de disponibilité et de fiabilité sur 24h.
 */
export function computeProbeHistoryStats(
	probe: NormalizedProbe,
	incidents: NormalizedIncident[],
	nowInput: Date | number = Date.now()
): ProbeHistoryStats {
	const nowMs = typeof nowInput === 'number' ? nowInput : nowInput.getTime();
	const windowStartMs = nowMs - DAY_MS;

	const probeIncidents = incidents.filter((inc) => {
		if (inc.probeId !== probe.id) return false;
		const incEnd = inc.resolvedAt ? new Date(inc.resolvedAt).getTime() : nowMs;
		return incEnd >= windowStartMs;
	});

	let downtimeSeconds = 0;
	let longestOutageSeconds = 0;
	let lastResolvedMs = 0;

	for (const inc of probeIncidents) {
		const incStart = Math.max(windowStartMs, new Date(inc.startedAt).getTime());
		const incEnd = inc.resolvedAt
			? Math.min(nowMs, new Date(inc.resolvedAt).getTime())
			: nowMs;

		const durationSec = Math.max(0, Math.round((incEnd - incStart) / 1000));
		downtimeSeconds += durationSec;

		if (durationSec > longestOutageSeconds) {
			longestOutageSeconds = durationSec;
		}

		if (inc.resolvedAt) {
			const resMs = new Date(inc.resolvedAt).getTime();
			if (resMs > lastResolvedMs) {
				lastResolvedMs = resMs;
			}
		}
	}

	// Disponibilité en pourcentage
	let availabilityPercentage = 100;
	if (probe.uptime24h !== null && probe.uptime24h !== undefined) {
		availabilityPercentage = probe.uptime24h;
	} else if (downtimeSeconds > 0) {
		const totalWindowSec = 86400;
		const ratio = Math.max(0, (totalWindowSec - downtimeSeconds) / totalWindowSec);
		availabilityPercentage = Math.round(ratio * 10000) / 100;
	}

	// Durée de la séquence continue actuelle
	let currentStreakSeconds: number;
	if (probe.status === 'down') {
		const startMs = probe.downSince
			? new Date(probe.downSince).getTime()
			: probeIncidents.find((i) => i.resolvedAt === null)?.startedAt
				? new Date(probeIncidents.find((i) => i.resolvedAt === null)!.startedAt).getTime()
				: nowMs;
		currentStreakSeconds = Math.max(0, Math.round((nowMs - startMs) / 1000));
	} else if (lastResolvedMs > 0) {
		currentStreakSeconds = Math.max(0, Math.round((nowMs - lastResolvedMs) / 1000));
	} else {
		// Aucune panne récente : au moins 24h
		currentStreakSeconds = 86400;
	}

	return {
		totalIncidents: probeIncidents.length,
		downtimeSeconds,
		availabilityPercentage,
		longestOutageSeconds,
		currentStreakSeconds
	};
}

/**
 * Formate une durée en secondes sous une forme compacte et lisible.
 * Exemples : "45s", "3m 12s", "2h 15m", "1j 4h" (FR) ou "1d 4h" (EN).
 */
export function formatDurationCompact(seconds: number, locale: SupportedLocale = 'fr'): string {
	if (!seconds || seconds <= 0) return '0s';

	const sec = Math.floor(seconds);
	if (sec < 60) return `${sec}s`;

	const minutes = Math.floor(sec / 60);
	const remainingSec = sec % 60;

	if (minutes < 60) {
		return remainingSec > 0 ? `${minutes}m ${remainingSec}s` : `${minutes}m`;
	}

	const hours = Math.floor(minutes / 60);
	const remainingMin = minutes % 60;

	if (hours < 24) {
		return remainingMin > 0 ? `${hours}h ${remainingMin}m` : `${hours}h`;
	}

	const days = Math.floor(hours / 24);
	const remainingHours = hours % 24;
	const dayUnit = locale === 'en' ? 'd' : 'j';
	return remainingHours > 0 ? `${days}${dayUnit} ${remainingHours}h` : `${days}${dayUnit}`;
}

/**
 * Formate une date ISO en heure et jour relatifs lisibles.
 * Exemples : "Aujourd'hui à 14:30", "Hier à 22:15", "19/09 à 14:30" (FR)
 * ou "Today at 14:30", "Yesterday at 22:15", "09/19 at 14:30" (EN).
 */
export function formatEventDateTime(
	isoString: string,
	nowInput: Date | number = Date.now(),
	locale: SupportedLocale = 'fr'
): string {
	if (!isoString) return '—';

	const date = new Date(isoString);
	if (isNaN(date.getTime())) return '—';

	const now = typeof nowInput === 'number' ? new Date(nowInput) : nowInput;
	const isToday =
		date.getDate() === now.getDate() &&
		date.getMonth() === now.getMonth() &&
		date.getFullYear() === now.getFullYear();

	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);
	const isYesterday =
		date.getDate() === yesterday.getDate() &&
		date.getMonth() === yesterday.getMonth() &&
		date.getFullYear() === yesterday.getFullYear();

	const timeStr = date.toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});

	if (locale === 'en') {
		if (isToday) return `Today at ${timeStr}`;
		if (isYesterday) return `Yesterday at ${timeStr}`;
		const day = String(date.getDate()).padStart(2, '0');
		const month = String(date.getMonth() + 1).padStart(2, '0');
		return `${month}/${day} at ${timeStr}`;
	}

	if (isToday) {
		return `Aujourd'hui à ${timeStr}`;
	}
	if (isYesterday) {
		return `Hier à ${timeStr}`;
	}

	const day = String(date.getDate()).padStart(2, '0');
	const month = String(date.getMonth() + 1).padStart(2, '0');
	return `${day}/${month} à ${timeStr}`;
}
