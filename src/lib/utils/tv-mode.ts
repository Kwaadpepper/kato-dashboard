/**
 * tv-mode.ts
 *
 * Gestionnaire du mode TV pour le tableau de bord Kato (affichage mural 24/7).
 * - Plein écran automatique (requestFullscreen) avec repli gracieux
 * - Masquage automatique du curseur après 5s d'inactivité
 * - Protection anti-marquage d'écran (drift CSS ±3px toutes les 10 min)
 * - Maintien de l'écran allumé via Screen Wake Lock API
 * - Détection d'inactivité globale (30s) avec passage automatique en mode TV
 * - Sortie du mode TV via la touche 'Escape'
 */

export interface TvModeOptions {
	/** Élément conteneur sur lequel appliquer le drift anti burn-in (défaut : #tv-container ou body) */
	container?: HTMLElement | null;
	/** Délai en ms avant de masquer le curseur (défaut : 5000ms) */
	cursorTimeoutMs?: number;
}

// État interne du mode TV
let isTvActive = false;
let activeContainer: HTMLElement | null = null;
let cursorTimer: ReturnType<typeof setTimeout> | null = null;
let cursorTimeout = 5000;
let wakeLockSentinel: WakeLockSentinel | null = null;
let wasInFullscreen = false;

// Auditeurs de changement d'état
type TvModeListener = (active: boolean) => void;
const listeners = new Set<TvModeListener>();

function notifyListeners(active: boolean): void {
	for (const listener of listeners) {
		try {
			listener(active);
		} catch (err) {
			console.error('[TV-Mode] Listener error:', err);
		}
	}
}

/**
 * Retourne vrai si le mode TV est actuellement actif.
 */
export function isTvModeActive(): boolean {
	return isTvActive;
}

/**
 * S'abonne aux changements d'état du mode TV.
 * Retourne une fonction de désabonnement.
 */
export function onTvModeChange(listener: TvModeListener): () => void {
	listeners.add(listener);
	listener(isTvActive);
	return () => {
		listeners.delete(listener);
	};
}

/* ============================================================================
 * 1. GESTION DU CURSEUR (cache après 5s d'inactivité)
 * ============================================================================ */

function hideCursor(): void {
	if (typeof document === 'undefined') return;
	document.documentElement.classList.add('tv-cursor-hidden');
	document.body.classList.add('tv-cursor-hidden');
}

function showCursor(): void {
	if (typeof document === 'undefined') return;
	document.documentElement.classList.remove('tv-cursor-hidden');
	document.body.classList.remove('tv-cursor-hidden');
}

function handleMouseMove(): void {
	if (!isTvActive) return;
	showCursor();
	if (cursorTimer) clearTimeout(cursorTimer);
	cursorTimer = setTimeout(hideCursor, cursorTimeout);
}

function startCursorTimer(timeoutMs = 5000): void {
	if (typeof window === 'undefined') return;
	cursorTimeout = timeoutMs;
	stopCursorTimer();

	window.addEventListener('mousemove', handleMouseMove, { passive: true });
	window.addEventListener('pointermove', handleMouseMove, { passive: true });

	// Masquage initial après le délai configuré
	cursorTimer = setTimeout(hideCursor, cursorTimeout);
}

function stopCursorTimer(): void {
	if (typeof window === 'undefined') return;
	if (cursorTimer) {
		clearTimeout(cursorTimer);
		cursorTimer = null;
	}
	window.removeEventListener('mousemove', handleMouseMove);
	window.removeEventListener('pointermove', handleMouseMove);
	showCursor();
}

/* ============================================================================
 * 2. PROTECTION ANTI BURN-IN (Drift ±3px / 10min via animate-kato-drift)
 * ============================================================================ */

function resolveDriftContainer(container?: HTMLElement | null): HTMLElement | null {
	if (container) return container;
	if (typeof document === 'undefined') return null;
	return document.getElementById('tv-container') ?? document.body;
}

function startDrift(container?: HTMLElement | null): void {
	const el = resolveDriftContainer(container);
	activeContainer = el;
	if (el) {
		el.classList.add('animate-kato-drift');
	}
}

function stopDrift(): void {
	if (activeContainer) {
		activeContainer.classList.remove('animate-kato-drift');
		activeContainer = null;
	}
	if (typeof document !== 'undefined') {
		document.body.classList.remove('animate-kato-drift');
		const el = document.getElementById('tv-container');
		if (el) el.classList.remove('animate-kato-drift');
	}
}

/* ============================================================================
 * 3. SCREEN WAKE LOCK API (maintien de l'écran allumé)
 * ============================================================================ */

async function acquireWakeLock(): Promise<void> {
	if (typeof navigator === 'undefined') return;
	if (!('wakeLock' in navigator) || !navigator.wakeLock || typeof navigator.wakeLock.request !== 'function') {
		return;
	}

	try {
		wakeLockSentinel = await navigator.wakeLock.request('screen');
		wakeLockSentinel.addEventListener('release', () => {
			wakeLockSentinel = null;
		});
	} catch (err) {
		console.warn('[TV-Mode] Screen Wake Lock not available or rejected:', err);
	}
}

async function releaseWakeLock(): Promise<void> {
	if (wakeLockSentinel) {
		try {
			await wakeLockSentinel.release();
		} catch (err) {
			console.warn('[TV-Mode] Error releasing Screen Wake Lock:', err);
		} finally {
			wakeLockSentinel = null;
		}
	}
}

function handleVisibilityChange(): void {
	if (typeof document === 'undefined') return;
	if (isTvActive && document.visibilityState === 'visible' && !wakeLockSentinel) {
		void acquireWakeLock();
	}
}

/* ============================================================================
 * 4. PLEIN ÉCRAN & ÉVÉNEMENTS GLOBAUX
 * ============================================================================ */

function handleFullscreenChange(): void {
	if (typeof document === 'undefined') return;
	if (document.fullscreenElement) {
		wasInFullscreen = true;
	} else if (wasInFullscreen) {
		wasInFullscreen = false;
		if (isTvActive) {
			void exitTvMode();
		}
	}
}

function handleEscapeKey(e: KeyboardEvent): void {
	if (e.key === 'Escape' && isTvActive) {
		void exitTvMode();
	}
}

// Réessai du plein écran au premier geste utilisateur si le navigateur l'avait bloqué au mount
function handleUserGestureForFullscreen(): void {
	if (typeof document === 'undefined') return;
	if (isTvActive && !document.fullscreenElement && document.documentElement.requestFullscreen) {
		try {
			const req = document.documentElement.requestFullscreen();
			if (req && typeof req.catch === 'function') {
				req.catch(() => {});
			}
		} catch {
			// Ignorer les erreurs d'activation différée
		}
	}
}

/* ============================================================================
 * 5. FONCTIONS PRINCIPALES D'ACTIVATION / SORTIE
 * ============================================================================ */

/**
 * Active le mode TV pour l'affichage permanent :
 * - Active le plein écran (requestFullscreen) avec capture d'erreur
 * - Démarre le timer curseur (masquage après 5s d'inactivité)
 * - Active le drift anti burn-in (±3px toutes les 10min via animate-kato-drift)
 * - Maintient l'écran allumé via Wake Lock API
 */
export async function enterTvMode(
	optionsOrContainer?: TvModeOptions | HTMLElement | null
): Promise<void> {
	if (typeof document === 'undefined') return;

	let container: HTMLElement | null = null;
	let cursorMs = 5000;

	if (optionsOrContainer) {
		if ('nodeType' in optionsOrContainer) {
			container = optionsOrContainer as HTMLElement;
		} else {
			container = optionsOrContainer.container ?? null;
			cursorMs = optionsOrContainer.cursorTimeoutMs ?? 5000;
		}
	}

	// Évite les doubles activations redondantes
	if (isTvActive) {
		if (container && activeContainer !== container) {
			stopDrift();
			startDrift(container);
		}
		return;
	}

	isTvActive = true;
	notifyListeners(true);

	// 1. Plein écran
	if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
		try {
			const req = document.documentElement.requestFullscreen();
			if (req && typeof req.then === 'function') {
				req.then(() => {
					wasInFullscreen = true;
				}).catch((err) => {
					console.warn('[TV-Mode] Fullscreen request rejected:', err);
				});
			} else {
				wasInFullscreen = true;
			}
		} catch (err) {
			console.warn('[TV-Mode] Fullscreen error:', err);
		}
	} else if (document.fullscreenElement) {
		wasInFullscreen = true;
	}

	// 2. Timer curseur (masquage après 5s d'inactivité)
	startCursorTimer(cursorMs);

	// 3. Drift anti burn-in
	startDrift(container);

	// 4. Wake Lock API
	void acquireWakeLock();

	// 5. Enregistrement des écouteurs globaux
	if (typeof window !== 'undefined') {
		window.addEventListener('keydown', handleEscapeKey);
		window.addEventListener('keypress', handleEscapeKey);
		window.addEventListener('click', handleUserGestureForFullscreen, { capture: true, once: true });
		document.addEventListener('fullscreenchange', handleFullscreenChange);
		document.addEventListener('visibilitychange', handleVisibilityChange);
	}
}

/**
 * Désactive le mode TV :
 * - Quitte le plein écran si actif
 * - Restaure le curseur immédiatement
 * - Arrête le drift anti burn-in
 * - Libère le Screen Wake Lock
 */
export async function exitTvMode(): Promise<void> {
	if (typeof document === 'undefined') return;
	if (!isTvActive) return;

	isTvActive = false;
	notifyListeners(false);

	// 1. Quitter le plein écran
	if (document.fullscreenElement && document.exitFullscreen) {
		try {
			const exit = document.exitFullscreen();
			if (exit && typeof exit.catch === 'function') {
				exit.catch((err) => {
					console.warn('[TV-Mode] Exit fullscreen rejected:', err);
				});
			}
		} catch (err) {
			console.warn('[TV-Mode] Exit fullscreen error:', err);
		}
	}
	wasInFullscreen = false;

	// 2. Restaurer le curseur
	stopCursorTimer();

	// 3. Arrêter le drift
	stopDrift();

	// 4. Libérer le wake lock
	await releaseWakeLock();

	// 5. Nettoyer les écouteurs globaux
	if (typeof window !== 'undefined') {
		window.removeEventListener('keydown', handleEscapeKey);
		window.removeEventListener('keypress', handleEscapeKey);
		window.removeEventListener('click', handleUserGestureForFullscreen, { capture: true });
		document.removeEventListener('fullscreenchange', handleFullscreenChange);
		document.removeEventListener('visibilitychange', handleVisibilityChange);
	}

	// 6. Réarmer immédiatement la détection d'inactivité si elle est active
	if (inactivityResetFn) {
		inactivityResetFn();
	}
}

/**
 * Bascule l'état du mode TV (actif / inactif).
 */
export async function toggleTvMode(
	optionsOrContainer?: TvModeOptions | HTMLElement | null
): Promise<void> {
	if (isTvActive) {
		await exitTvMode();
	} else {
		await enterTvMode(optionsOrContainer);
	}
}

/* ============================================================================
 * 6. DÉTECTION D'INACTIVITÉ (si pas de mousemove/keypress pendant 30s → auto-enter)
 * ============================================================================ */

let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
let inactivityCleanup: (() => void) | null = null;
let inactivityResetFn: (() => void) | null = null;

/**
 * Surveille l'inactivité de l'utilisateur (30s par défaut sans mousemove/keypress).
 * Active automatiquement le mode TV en l'absence d'activité.
 *
 * @param timeoutMs Délai d'inactivité avant auto-enter (défaut : 30 000 ms)
 * @param onInactive Action à exécuter à l'expiration (défaut : enterTvMode)
 * @returns Fonction de nettoyage désactivant la surveillance
 */
export function startInactivityDetection(
	timeoutMs = 30_000,
	onInactive: () => void = () => {
		void enterTvMode();
	}
): () => void {
	if (typeof window === 'undefined') return () => {};

	stopInactivityDetection();

	function resetTimer(): void {
		if (inactivityTimer) {
			clearTimeout(inactivityTimer);
			inactivityTimer = null;
		}
		// Ne déclenche l'auto-enter que si le mode TV n'est pas déjà actif
		if (!isTvActive) {
			inactivityTimer = setTimeout(() => {
				if (!isTvActive) {
					onInactive();
				}
			}, timeoutMs);
		}
	}

	inactivityResetFn = resetTimer;

	const activityEvents = ['mousemove', 'mousedown', 'keydown', 'keypress', 'touchstart', 'scroll', 'wheel'];
	const eventOptions = { passive: true };

	for (const event of activityEvents) {
		window.addEventListener(event, resetTimer, eventOptions);
	}

	// Déclenche le compte à rebours initial
	resetTimer();

	inactivityCleanup = () => {
		if (inactivityTimer) {
			clearTimeout(inactivityTimer);
			inactivityTimer = null;
		}
		for (const event of activityEvents) {
			window.removeEventListener(event, resetTimer);
		}
		inactivityCleanup = null;
		inactivityResetFn = null;
	};

	return inactivityCleanup;
}

/**
 * Arrête la détection d'inactivité active.
 */
export function stopInactivityDetection(): void {
	if (inactivityCleanup) {
		inactivityCleanup();
	}
	inactivityResetFn = null;
}
