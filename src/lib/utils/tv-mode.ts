/**
 * tv-mode.ts
 *
 * TV Mode manager for Kato Dashboard (24/7 wallboard display).
 * - Automatic fullscreen (requestFullscreen) with graceful fallback
 * - Automatic cursor hiding after 5s of inactivity
 * - Anti burn-in screen protection (CSS drift ±3px every 10 min)
 * - Keeps screen awake via Screen Wake Lock API
 * - Global inactivity detection (30s) for automatic TV mode transition
 * - TV mode exit via 'Escape' key
 */

export interface TvModeOptions {
	/** Container element to apply anti burn-in drift to (default: #tv-container or body) */
	container?: HTMLElement | null;
	/** Inactivity timeout in ms before hiding cursor (default: 5000ms) */
	cursorTimeoutMs?: number;
}

// Internal TV mode state
let isTvActive = false;
let activeContainer: HTMLElement | null = null;
let cursorTimer: ReturnType<typeof setTimeout> | null = null;
let cursorTimeout = 5000;
let wakeLockSentinel: WakeLockSentinel | null = null;
let wasInFullscreen = false;

// State change listeners
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
 * Returns true if TV mode is currently active.
 */
export function isTvModeActive(): boolean {
	return isTvActive;
}

/**
 * Subscribes to TV mode state transitions.
 * Returns an unsubscribe callback.
 */
export function onTvModeChange(listener: TvModeListener): () => void {
	listeners.add(listener);
	listener(isTvActive);
	return () => {
		listeners.delete(listener);
	};
}

/* ============================================================================
 * 1. CURSOR MANAGEMENT (Hide after 5s of inactivity)
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

	// Initial hide after configured delay
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
 * 2. ANTI BURN-IN PROTECTION (Drift ±3px / 10min via animate-kato-drift)
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
 * 3. SCREEN WAKE LOCK API (Keep screen turned on)
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
 * 4. FULLSCREEN & GLOBAL EVENT LISTENERS
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

// Fullscreen gesture retry if browser initially blocked automatic request on load
function handleUserGestureForFullscreen(e?: Event): void {
	if (typeof document === 'undefined') return;

	const target = e?.target as HTMLElement | null;
	if (target?.closest?.('header')) {
		return;
	}

	if (typeof window !== 'undefined') {
		window.removeEventListener('click', handleUserGestureForFullscreen, { capture: true });
	}

	if (isTvActive && !document.fullscreenElement && document.documentElement.requestFullscreen) {
		try {
			const req = document.documentElement.requestFullscreen();
			if (req && typeof req.catch === 'function') {
				req.catch(() => {});
			}
		} catch {
			// Silently ignore user gesture rejection
		}
	}
}

/* ============================================================================
 * 5. CORE ACTIVATION & DEACTIVATION FUNCTIONS
 * ============================================================================ */

/**
 * Activates TV mode for continuous unattended display:
 * - Requests fullscreen with error fallback
 * - Starts inactivity cursor timer (hides after 5s)
 * - Enables anti burn-in drift (±3px every 10min via animate-kato-drift)
 * - Keeps screen awake via Screen Wake Lock API
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

	// Avoid redundant activations
	if (isTvActive) {
		if (container && activeContainer !== container) {
			stopDrift();
			startDrift(container);
		}
		return;
	}

	isTvActive = true;
	notifyListeners(true);

	// 1. Fullscreen
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

	// 2. Cursor timer
	startCursorTimer(cursorMs);

	// 3. Anti burn-in drift
	startDrift(container);

	// 4. Wake Lock API
	void acquireWakeLock();

	// 5. Global event listeners
	if (typeof window !== 'undefined') {
		window.addEventListener('keydown', handleEscapeKey);
		window.addEventListener('keypress', handleEscapeKey);
		window.addEventListener('click', handleUserGestureForFullscreen, { capture: true });
		document.addEventListener('fullscreenchange', handleFullscreenChange);
		document.addEventListener('visibilitychange', handleVisibilityChange);
	}
}

/**
 * Deactivates TV mode:
 * - Exits fullscreen if active
 * - Restores mouse cursor immediately
 * - Stops anti burn-in drift
 * - Releases Screen Wake Lock
 */
export async function exitTvMode(): Promise<void> {
	if (typeof document === 'undefined') return;
	if (!isTvActive) return;

	isTvActive = false;
	notifyListeners(false);

	// 1. Exit fullscreen
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

	// 2. Restore cursor
	stopCursorTimer();

	// 3. Stop drift
	stopDrift();

	// 4. Release wake lock
	await releaseWakeLock();

	// 5. Clean up event listeners
	if (typeof window !== 'undefined') {
		window.removeEventListener('keydown', handleEscapeKey);
		window.removeEventListener('keypress', handleEscapeKey);
		window.removeEventListener('click', handleUserGestureForFullscreen, { capture: true });
		document.removeEventListener('fullscreenchange', handleFullscreenChange);
		document.removeEventListener('visibilitychange', handleVisibilityChange);
	}

	// 6. Rearm inactivity timer if active
	if (inactivityResetFn) {
		inactivityResetFn();
	}
}

/**
 * Toggles TV mode state.
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
 * 6. INACTIVITY DETECTION (Auto-enter TV mode after 30s of inactivity)
 * ============================================================================ */

let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
let inactivityCleanup: (() => void) | null = null;
let inactivityResetFn: (() => void) | null = null;

/**
 * Monitors user inactivity (default: 30s without mousemove/keypress).
 * Automatically transitions to TV mode when inactive.
 *
 * @param timeoutMs Inactivity timeout in ms (default: 30,000ms)
 * @param onInactive Callback executed on timeout (default: enterTvMode)
 * @returns Cleanup function to stop monitoring
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
 * Stops active inactivity detection.
 */
export function stopInactivityDetection(): void {
	if (inactivityCleanup) {
		inactivityCleanup();
	}
	inactivityResetFn = null;
}
