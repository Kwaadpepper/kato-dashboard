/**
 * incident-queue.ts
 *
 * Gestionnaire de file d'attente (FIFO) et d'isolation de performance pour le bandeau d'incidents.
 * - Garantit l'indépendance de performance (aucun recalcul de layout global, pas de re-render continu)
 * - Assure que les éléments en cours de défilement vont jusqu'au bout avant d'appliquer de nouveaux événements
 * - File d'attente tampon (pending queue) pour les nouveaux incidents ou résolutions
 */

import type { NormalizedIncident, SupportedLocale } from '$lib/types';

export interface DisplayedIncident {
	id: string;
	probeName: string;
	type: 'down' | 'degraded';
	startedAt: string;
	formattedDuration: string;
}

export interface IncidentQueueState {
	/** Incidents actuellement visibles et en défilement sur le bandeau */
	displayed: DisplayedIncident[];
	/** Nombre total d'incidents actifs réels (incluant ceux en file d'attente) */
	activeCount: number;
	/** Nombre d'incidents en attente dans la file pour le prochain cycle */
	pendingCount: number;
	/** Indique si le bandeau a un défilement actif */
	isScrolling: boolean;
	/** Compteur du cycle courant (incrémenté à chaque nouveau cycle) */
	cycleCount: number;
}

export type IncidentQueueListener = (state: IncidentQueueState) => void;

/**
 * Formate la durée écoulée depuis startedAt de façon concise et lisible.
 * Ex: "2m 14s", "1h 05m 12s", "1j 3h 10m" (FR) ou "1d 3h 10m" (EN)
 */
export function formatIncidentDuration(
	startedAt: string,
	currentMs = Date.now(),
	locale: SupportedLocale = 'fr'
): string {
	if (!startedAt) return '0s';
	const startMs = new Date(startedAt).getTime();
	if (isNaN(startMs)) return '0s';
	const diffSec = Math.max(0, Math.floor((currentMs - startMs) / 1000));
	const days = Math.floor(diffSec / 86400);
	const hours = Math.floor((diffSec % 86400) / 3600);
	const mins = Math.floor((diffSec % 3600) / 60);
	const secs = diffSec % 60;
	const dayUnit = locale === 'en' ? 'd' : 'j';

	if (days > 0) return `${days}${dayUnit} ${hours}h ${mins}m`;
	if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
	return `${mins}m ${secs}s`;
}

function snapshotIncident(
	inc: NormalizedIncident,
	nowMs = Date.now(),
	locale: SupportedLocale = 'fr'
): DisplayedIncident {
	return {
		id: inc.id,
		probeName: inc.probeName,
		type: inc.type,
		startedAt: inc.startedAt,
		formattedDuration: formatIncidentDuration(inc.startedAt, nowMs, locale)
	};
}

export class IncidentQueueManager {
	private displayed: DisplayedIncident[] = [];
	private pendingQueue: NormalizedIncident[] | null = null;
	private lastActiveIncidents: NormalizedIncident[] = [];
	private isScrolling = false;
	private cycleCount = 0;
	private locale: SupportedLocale = 'fr';
	private listeners = new Set<IncidentQueueListener>();

	constructor(
		initialIncidents: NormalizedIncident[] = [],
		initialScrolling = false,
		locale: SupportedLocale = 'fr'
	) {
		this.locale = locale;
		this.isScrolling = initialScrolling;
		this.setIncidents(initialIncidents, initialScrolling);
	}

	public setLocale(locale: SupportedLocale): void {
		this.locale = locale;
		const now = Date.now();
		this.displayed = this.displayed.map((item) => ({
			...item,
			formattedDuration: formatIncidentDuration(item.startedAt, now, this.locale)
		}));
		this.notify();
	}

	public getState(): IncidentQueueState {
		return {
			displayed: [...this.displayed],
			activeCount: this.lastActiveIncidents.length,
			pendingCount: this.pendingQueue !== null ? this.pendingQueue.length : 0,
			isScrolling: this.isScrolling,
			cycleCount: this.cycleCount
		};
	}

	public subscribe(listener: IncidentQueueListener): () => void {
		this.listeners.add(listener);
		listener(this.getState());
		return () => {
			this.listeners.delete(listener);
		};
	}

	private notify(): void {
		const state = this.getState();
		for (const listener of this.listeners) {
			try {
				listener(state);
			} catch (err) {
				console.error('[IncidentQueue] Listener error:', err);
			}
		}
	}

	/**
	 * Met à jour les incidents reçus (depuis SSE ou props).
	 * Règle d'or : si un défilement est en cours, on laisse défiler jusqu'au bout
	 * et on stocke la nouvelle version dans la file d'attente (FIFO).
	 *
	 * @param rawIncidents Liste brute des incidents reçus
	 * @param shouldAnimate Vrai si le mode défilement est actif (ex: mode TV)
	 */
	public setIncidents(rawIncidents: NormalizedIncident[], shouldAnimate = true): void {
		// Ne conserver que les incidents non résolus
		const active = rawIncidents.filter((inc) => inc.resolvedAt === null);
		this.lastActiveIncidents = active;

		// Si l'animation n'est pas active (mode statique / mobile non-TV) :
		// Mise à jour immédiate sans file d'attente
		if (!shouldAnimate) {
			const now = Date.now();
			this.displayed = active.map((inc) => snapshotIncident(inc, now, this.locale));
			this.pendingQueue = null;
			this.isScrolling = false;
			this.notify();
			return;
		}

		// Mode défilement actif :
		if (!this.isScrolling || this.displayed.length === 0) {
			// Rien ne défile actuellement : démarrer immédiatement avec les incidents actifs
			if (active.length > 0) {
				const now = Date.now();
				this.displayed = active.map((inc) => snapshotIncident(inc, now, this.locale));
				this.isScrolling = true;
				this.cycleCount++;
				this.pendingQueue = null;
			} else {
				this.displayed = [];
				this.isScrolling = false;
				this.pendingQueue = null;
			}
			this.notify();
		} else {
			// Un défilement est déjà en cours d'exécution :
			// ON NE TOUCHE PAS à this.displayed pour laisser les éléments aller jusqu'au bout !
			// On place la nouvelle liste dans la file d'attente (pendingQueue)
			this.pendingQueue = active;
			this.notify();
		}
	}

	/**
	 * Déclenché lorsque l'animation termine un cycle de défilement (onanimationiteration ou fin).
	 * À ce moment précis, les éléments ont défilé jusqu'au bout de l'écran.
	 * On dépile la file d'attente pour le cycle suivant.
	 */
	public onCycleComplete(): void {
		const now = Date.now();

		if (this.pendingQueue !== null) {
			// La file contient une mise à jour d'événements
			if (this.pendingQueue.length > 0) {
				this.displayed = this.pendingQueue.map((inc) => snapshotIncident(inc, now, this.locale));
				this.isScrolling = true;
				this.cycleCount++;
				this.pendingQueue = null;
			} else {
				// Tous les incidents ont été résolus pendant le cycle :
				// Les éléments ont fini de sortir de l'écran, on bascule à l'état nominal
				this.displayed = [];
				this.isScrolling = false;
				this.pendingQueue = null;
			}
			this.notify();
		} else if (this.displayed.length > 0) {
			// Aucun changement dans la file : rafraîchir les durées de panne pour le cycle suivant
			this.displayed = this.displayed.map((item) => ({
				...item,
				formattedDuration: formatIncidentDuration(item.startedAt, now, this.locale)
			}));
			this.cycleCount++;
			this.notify();
		}
	}

	/**
	 * Force l'actualisation immédiate sans attendre la fin du cycle (ex: sortie du mode TV).
	 */
	public flush(): void {
		const now = Date.now();
		const target = this.pendingQueue !== null ? this.pendingQueue : this.lastActiveIncidents;
		this.displayed = target.map((inc) => snapshotIncident(inc, now, this.locale));
		this.pendingQueue = null;
		this.isScrolling = this.displayed.length > 0;
		this.notify();
	}

	/**
	 * Réinitialise complètement la file.
	 */
	public reset(): void {
		this.displayed = [];
		this.pendingQueue = null;
		this.lastActiveIncidents = [];
		this.isScrolling = false;
		this.cycleCount = 0;
		this.notify();
	}
}

/**
 * Fabrique d'une nouvelle instance de gestionnaire de file d'attente.
 */
export function createIncidentQueue(
	initialIncidents: NormalizedIncident[] = [],
	initialScrolling = false,
	locale: SupportedLocale = 'fr'
): IncidentQueueManager {
	return new IncidentQueueManager(initialIncidents, initialScrolling, locale);
}
