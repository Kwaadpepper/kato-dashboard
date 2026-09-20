/**
 * incident-queue.ts
 *
 * Queue manager (FIFO) and performance isolation module for the incident marquee bar.
 * - Guarantees performance isolation (no global layout shifts, avoids continuous re-renders)
 * - Ensures currently scrolling marquee items complete their cycle before applying new events
 * - Buffered queue (pending queue) for newly opened or resolved incidents
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
	/** Incidents currently displayed and scrolling on the marquee bar */
	displayed: DisplayedIncident[];
	/** Total count of actual active incidents (including queued ones) */
	activeCount: number;
	/** Count of incidents queued for the next scrolling cycle */
	pendingCount: number;
	/** Whether marquee scrolling is currently active */
	isScrolling: boolean;
	/** Monotonic cycle counter (incremented on each completed iteration) */
	cycleCount: number;
}

export type IncidentQueueListener = (state: IncidentQueueState) => void;

/**
 * Formats elapsed duration since startedAt concisely.
 * Examples: "2m 14s", "1h 05m 12s", "1d 3h 10m" (EN) or "1j 3h 10m" (FR).
 */
export function formatIncidentDuration(
	startedAt: string,
	currentMs = Date.now(),
	locale: SupportedLocale = 'en'
): string {
	if (!startedAt) return '0s';
	const startMs = new Date(startedAt).getTime();
	if (isNaN(startMs)) return '0s';
	const diffSec = Math.max(0, Math.floor((currentMs - startMs) / 1000));
	const days = Math.floor(diffSec / 86400);
	const hours = Math.floor((diffSec % 86400) / 3600);
	const mins = Math.floor((diffSec % 3600) / 60);
	const secs = diffSec % 60;
	const dayUnit = locale === 'fr' ? 'j' : 'd';

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
	 * Updates received incidents (from SSE or props).
	 * If scrolling is active, allow the current animation to complete and queue
	 * the new batch in the pending FIFO queue.
	 *
	 * @param rawIncidents Raw incident list
	 * @param shouldAnimate True if marquee animation is active
	 */
	public setIncidents(rawIncidents: NormalizedIncident[], shouldAnimate = true): void {
		const active = rawIncidents.filter((inc) => inc.resolvedAt === null);
		this.lastActiveIncidents = active;

		// Static / non-scrolling mode: immediate update without queueing
		if (!shouldAnimate) {
			const now = Date.now();
			this.displayed = active.map((inc) => snapshotIncident(inc, now, this.locale));
			this.pendingQueue = null;
			this.isScrolling = false;
			this.notify();
			return;
		}

		// Active scrolling mode:
		if (!this.isScrolling || this.displayed.length === 0) {
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
			// Scrolling in progress: buffer in pendingQueue until cycle finishes
			this.pendingQueue = active;
			this.notify();
		}
	}

	/**
	 * Invoked when the marquee animation completes a cycle.
	 * Flushes the pending queue into the displayed list.
	 */
	public onCycleComplete(): void {
		const now = Date.now();

		if (this.pendingQueue !== null) {
			if (this.pendingQueue.length > 0) {
				this.displayed = this.pendingQueue.map((inc) => snapshotIncident(inc, now, this.locale));
				this.isScrolling = true;
				this.cycleCount++;
				this.pendingQueue = null;
			} else {
				this.displayed = [];
				this.isScrolling = false;
				this.pendingQueue = null;
			}
			this.notify();
		} else if (this.displayed.length > 0) {
			// Refresh elapsed outage durations for next cycle
			this.displayed = this.displayed.map((item) => ({
				...item,
				formattedDuration: formatIncidentDuration(item.startedAt, now, this.locale)
			}));
			this.cycleCount++;
			this.notify();
		}
	}

	/**
	 * Forces immediate queue flush without waiting for cycle completion.
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
	 * Resets the incident queue state.
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
 * Factory creating a new IncidentQueueManager instance.
 */
export function createIncidentQueue(
	initialIncidents: NormalizedIncident[] = [],
	initialScrolling = false,
	locale: SupportedLocale = 'en'
): IncidentQueueManager {
	return new IncidentQueueManager(initialIncidents, initialScrolling, locale);
}
