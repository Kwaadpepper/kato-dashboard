/**
 * marquee.ts
 *
 * Gestionnaire du réglage de vitesse pour le défilement du bandeau d'incidents (IncidentBar).
 * Permet de définir et persister une vitesse limite de défilement (durée d'animation en secondes).
 */

export type MarqueeSpeed = 'slow' | 'normal' | 'fast';

export interface MarqueeConfig {
	speed: MarqueeSpeed;
	duration: number; // en secondes
}

export const MARQUEE_STORAGE_KEY = 'kato-marquee-speed';
export const MARQUEE_DURATION_STORAGE_KEY = 'kato-marquee-duration';

export const MARQUEE_SPEED_PRESETS: Record<
	MarqueeSpeed,
	{ label: string; description: string; duration: number; icon: string }
> = {
	slow: {
		label: 'Lente',
		description: 'Vitesse limitée pour une lecture confortable (60s)',
		duration: 60,
		icon: '🐢'
	},
	normal: {
		label: 'Normale',
		description: 'Défilement standard équilibré (40s)',
		duration: 40,
		icon: '🚶'
	},
	fast: {
		label: 'Rapide',
		description: 'Défilement accéléré (25s)',
		duration: 25,
		icon: '⚡'
	}
};

type MarqueeListener = (config: MarqueeConfig) => void;
const listeners = new Set<MarqueeListener>();

let currentSpeed: MarqueeSpeed = 'slow';
let currentDuration = 60; // Par défaut : 60s (vitesse calme et lisible)

function notifyListeners(): void {
	const config: MarqueeConfig = { speed: currentSpeed, duration: currentDuration };
	for (const listener of listeners) {
		try {
			listener(config);
		} catch (err) {
			console.error('[Marquee] Listener error:', err);
		}
	}
}

/**
 * Récupère la vitesse initialement configurée depuis le localStorage (défaut: 'slow').
 */
export function getInitialMarqueeSpeed(): MarqueeSpeed {
	if (typeof window === 'undefined') return 'slow';
	try {
		const saved = localStorage.getItem(MARQUEE_STORAGE_KEY) as MarqueeSpeed | null;
		if (saved && saved in MARQUEE_SPEED_PRESETS) {
			return saved;
		}
	} catch (err) {
		console.warn('[Marquee] Erreur lors de la lecture de localStorage:', err);
	}
	return 'slow';
}

/**
 * Récupère la durée de défilement initiale en secondes (défaut: 60s).
 */
export function getInitialMarqueeDuration(): number {
	if (typeof window === 'undefined') return 60;
	try {
		const savedDuration = localStorage.getItem(MARQUEE_DURATION_STORAGE_KEY);
		if (savedDuration !== null) {
			const parsed = parseInt(savedDuration, 10);
			if (!isNaN(parsed) && parsed >= 15 && parsed <= 180) {
				return parsed;
			}
		}
		const speed = getInitialMarqueeSpeed();
		return MARQUEE_SPEED_PRESETS[speed].duration;
	} catch (err) {
		console.warn('[Marquee] Erreur lors de la lecture de la durée:', err);
	}
	return 60;
}

/**
 * Initialise l'état du défilement depuis le stockage local.
 */
export function initMarqueeConfig(): MarqueeConfig {
	currentSpeed = getInitialMarqueeSpeed();
	currentDuration = getInitialMarqueeDuration();
	return { speed: currentSpeed, duration: currentDuration };
}

/**
 * Définit la vitesse selon un preset ('slow', 'normal', 'fast') et persiste le choix.
 */
export function setMarqueeSpeed(speed: MarqueeSpeed): void {
	if (!(speed in MARQUEE_SPEED_PRESETS)) return;

	currentSpeed = speed;
	currentDuration = MARQUEE_SPEED_PRESETS[speed].duration;

	if (typeof window !== 'undefined') {
		try {
			localStorage.setItem(MARQUEE_STORAGE_KEY, speed);
			localStorage.setItem(MARQUEE_DURATION_STORAGE_KEY, currentDuration.toString());
		} catch (err) {
			console.warn('[Marquee] Erreur d\'écriture dans localStorage:', err);
		}
	}

	notifyListeners();
}

/**
 * Définit une durée personnalisée de défilement en secondes (entre 15s et 180s).
 */
export function setMarqueeDuration(durationSeconds: number): void {
	const clamped = Math.max(15, Math.min(180, Math.round(durationSeconds)));
	currentDuration = clamped;

	// Détermine le preset le plus proche
	if (clamped >= 50) {
		currentSpeed = 'slow';
	} else if (clamped >= 32) {
		currentSpeed = 'normal';
	} else {
		currentSpeed = 'fast';
	}

	if (typeof window !== 'undefined') {
		try {
			localStorage.setItem(MARQUEE_STORAGE_KEY, currentSpeed);
			localStorage.setItem(MARQUEE_DURATION_STORAGE_KEY, clamped.toString());
		} catch (err) {
			console.warn('[Marquee] Erreur d\'écriture de la durée:', err);
		}
	}

	notifyListeners();
}

/**
 * Retourne la configuration courante du défilement.
 */
export function getMarqueeConfig(): MarqueeConfig {
	return { speed: currentSpeed, duration: currentDuration };
}

/**
 * S'abonne aux modifications de vitesse de défilement.
 */
export function onMarqueeChange(listener: MarqueeListener): () => void {
	listeners.add(listener);
	listener({ speed: currentSpeed, duration: currentDuration });
	return () => {
		listeners.delete(listener);
	};
}
