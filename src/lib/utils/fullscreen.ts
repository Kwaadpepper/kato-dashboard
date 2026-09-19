/**
 * fullscreen.ts
 *
 * Utilitaire de gestion du plein écran (Fullscreen API) pour Kato Dashboard.
 * Permet de basculer, activer ou quitter le plein écran de façon réactive et sécurisée.
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
 * Retourne vrai si le document est actuellement en plein écran.
 */
export function isFullscreen(): boolean {
	if (typeof document === 'undefined') return false;
	return !!document.fullscreenElement;
}

/**
 * Bascule l'état plein écran (entre ou quitte).
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
		console.warn('[Fullscreen] Erreur lors du basculement plein écran:', err);
		isFullscreenState = !!document.fullscreenElement;
	}

	notifyListeners();
	return isFullscreenState;
}

/**
 * Entre en plein écran.
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
			console.warn('[Fullscreen] Erreur entrée plein écran:', err);
		}
	}
	notifyListeners();
	return isFullscreen();
}

/**
 * Quitte le plein écran.
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
			console.warn('[Fullscreen] Erreur sortie plein écran:', err);
		}
	}
	notifyListeners();
	return isFullscreen();
}

/**
 * S'abonne aux changements d'état du plein écran.
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
