/**
 * marquee.ts
 *
 * Speed configuration manager for incident marquee scrolling (IncidentBar).
 * Defines and persists scroll speed presets (animation duration in seconds).
 */

export type MarqueeSpeed = 'slow' | 'normal' | 'fast';

export interface MarqueeConfig {
	speed: MarqueeSpeed;
	duration: number; // in seconds
}

export const MARQUEE_STORAGE_KEY = 'kato-marquee-speed';
export const MARQUEE_DURATION_STORAGE_KEY = 'kato-marquee-duration';

export const MARQUEE_SPEED_PRESETS: Record<
	MarqueeSpeed,
	{ label: string; description: string; duration: number; icon: string }
> = {
	slow: {
		label: 'Slow',
		description: 'Relaxed speed for comfortable reading (60s)',
		duration: 60,
		icon: '🐢'
	},
	normal: {
		label: 'Normal',
		description: 'Standard balanced scrolling (40s)',
		duration: 40,
		icon: '🚶'
	},
	fast: {
		label: 'Fast',
		description: 'Accelerated scrolling (25s)',
		duration: 25,
		icon: '⚡'
	}
};

type MarqueeListener = (config: MarqueeConfig) => void;
const listeners = new Set<MarqueeListener>();

let currentSpeed: MarqueeSpeed = 'slow';
let currentDuration = 60; // Default: 60s (smooth, readable speed)

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
 * Retrieves the initial marquee speed preset from localStorage or BFF (default: 'slow').
 */
export function getInitialMarqueeSpeed(bffDefault?: MarqueeSpeed): MarqueeSpeed {
	if (typeof window === 'undefined') return bffDefault ?? 'slow';
	try {
		const saved = localStorage.getItem(MARQUEE_STORAGE_KEY) as MarqueeSpeed | null;
		if (saved && saved in MARQUEE_SPEED_PRESETS) {
			return saved;
		}
	} catch (err) {
		console.warn('[Marquee] Error reading localStorage:', err);
	}
	if (bffDefault && bffDefault in MARQUEE_SPEED_PRESETS) {
		return bffDefault;
	}
	return 'slow';
}

/**
 * Retrieves the initial marquee animation duration in seconds (default: 60s).
 */
export function getInitialMarqueeDuration(bffDefaultSpeed?: MarqueeSpeed): number {
	if (typeof window === 'undefined') {
		const speed = bffDefaultSpeed ?? 'slow';
		return MARQUEE_SPEED_PRESETS[speed]?.duration ?? 60;
	}
	try {
		const savedDuration = localStorage.getItem(MARQUEE_DURATION_STORAGE_KEY);
		if (savedDuration !== null) {
			const parsed = parseInt(savedDuration, 10);
			if (!isNaN(parsed) && parsed >= 15 && parsed <= 180) {
				return parsed;
			}
		}
		const speed = getInitialMarqueeSpeed(bffDefaultSpeed);
		return MARQUEE_SPEED_PRESETS[speed].duration;
	} catch (err) {
		console.warn('[Marquee] Error reading marquee duration:', err);
	}
	return 60;
}

/**
 * Initializes marquee configuration from local storage and BFF defaults.
 */
export function initMarqueeConfig(bffDefault?: MarqueeSpeed): MarqueeConfig {
	currentSpeed = getInitialMarqueeSpeed(bffDefault);
	currentDuration = getInitialMarqueeDuration(bffDefault);
	return { speed: currentSpeed, duration: currentDuration };
}

/**
 * Sets the marquee speed by preset ('slow', 'normal', 'fast') and persists the choice.
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
			console.warn('[Marquee] Error writing to localStorage:', err);
		}
	}

	notifyListeners();
}

/**
 * Sets a custom marquee scroll duration in seconds (clamped between 15s and 180s).
 */
export function setMarqueeDuration(durationSeconds: number): void {
	const clamped = Math.max(15, Math.min(180, Math.round(durationSeconds)));
	currentDuration = clamped;

	// Determine the nearest preset
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
			console.warn('[Marquee] Error writing marquee duration:', err);
		}
	}

	notifyListeners();
}

/**
 * Returns the current marquee configuration.
 */
export function getMarqueeConfig(): MarqueeConfig {
	return { speed: currentSpeed, duration: currentDuration };
}

/**
 * Subscribes to marquee speed updates.
 */
export function onMarqueeChange(listener: MarqueeListener): () => void {
	listeners.add(listener);
	listener({ speed: currentSpeed, duration: currentDuration });
	return () => {
		listeners.delete(listener);
	};
}
