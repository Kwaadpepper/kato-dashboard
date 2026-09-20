/**
 * fullscreen.ts
 *
 * Fullscreen API utility module for Kato Dashboard.
 * Enables reactive toggling, entering, and exiting of fullscreen mode.
 */

type FullscreenListener = (isFullscreen: boolean) => void;
const listeners = new Set<FullscreenListener>();

let isFullscreenState = false;

function notifyListeners(): void {
	for (const listener of listeners) {
		try {
			listener(isFullscreenState);
		} catch (err) {
			console.error('[Fullscreen] Listener error:', err);
		}
	}
}

/**
 * Returns true if document is currently in fullscreen mode.
 */
export function isFullscreen(): boolean {
	if (typeof document === 'undefined') return false;
	return !!document.fullscreenElement;
}

/**
 * Toggles fullscreen state (enters or exits).
 */
export async function toggleFullscreen(element?: HTMLElement): Promise<boolean> {
	if (typeof document === 'undefined') return false;

	try {
		if (document.fullscreenElement) {
			if (document.exitFullscreen) {
				await document.exitFullscreen();
			}
			isFullscreenState = false;
		} else {
			const target = element ?? document.documentElement;
			if (target.requestFullscreen) {
				await target.requestFullscreen();
			}
			isFullscreenState = true;
		}
	} catch (err) {
		console.warn('[Fullscreen] Error toggling fullscreen:', err);
		isFullscreenState = !!document.fullscreenElement;
	}

	notifyListeners();
	return isFullscreenState;
}

/**
 * Requests fullscreen on target element or document.
 */
export async function enterFullscreen(element?: HTMLElement): Promise<boolean> {
	if (typeof document === 'undefined') return false;
	if (!document.fullscreenElement) {
		try {
			const target = element ?? document.documentElement;
			if (target.requestFullscreen) {
				await target.requestFullscreen();
			}
			isFullscreenState = true;
		} catch (err) {
			console.warn('[Fullscreen] Error entering fullscreen:', err);
		}
	}
	notifyListeners();
	return isFullscreen();
}

/**
 * Exits fullscreen mode.
 */
export async function exitFullscreen(): Promise<boolean> {
	if (typeof document === 'undefined') return false;
	if (document.fullscreenElement) {
		try {
			if (document.exitFullscreen) {
				await document.exitFullscreen();
			}
			isFullscreenState = false;
		} catch (err) {
			console.warn('[Fullscreen] Error exiting fullscreen:', err);
		}
	}
	notifyListeners();
	return isFullscreen();
}

/**
 * Subscribes to fullscreen state changes.
 */
export function onFullscreenChange(listener: FullscreenListener): () => void {
	listeners.add(listener);
	listener(isFullscreen());

	if (typeof document !== 'undefined') {
		const handler = () => {
			isFullscreenState = isFullscreen();
			notifyListeners();
		};
		document.addEventListener('fullscreenchange', handler);
		return () => {
			listeners.delete(listener);
			document.removeEventListener('fullscreenchange', handler);
		};
	}

	return () => {
		listeners.delete(listener);
	};
}
