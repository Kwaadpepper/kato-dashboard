/**
 * Module de notifications sonores Web Audio API pour Kato Dashboard.
 * Génère des alertes sonores pures par synthèse audio (OscillatorNode + GainNode),
 * sans aucun fichier audio externe.
 */

export const SOUND_STORAGE_KEY = 'kato-sound-enabled';

let audioCtx: AudioContext | null = null;
let soundEnabledState = false;

type SoundListener = (enabled: boolean) => void;
const listeners = new Set<SoundListener>();

/**
 * Initialise ou récupère le singleton AudioContext du navigateur.
 * Gère la compatibilité cross-browser et la sortie de l'état 'suspended'.
 */
export function getAudioContext(): AudioContext | null {
	if (typeof window === 'undefined') return null;

	if (!audioCtx) {
		const AudioContextClass =
			window.AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		if (AudioContextClass) {
			audioCtx = new AudioContextClass();
		}
	}

	if (audioCtx && audioCtx.state === 'suspended') {
		void audioCtx.resume().catch(() => {
			// Bloqué par la politique autoplay du navigateur tant qu'aucune interaction utilisateur n'a eu lieu
		});
	}

	return audioCtx;
}

/**
 * Déverrouille l'AudioContext lors d'une interaction utilisateur (clic, touche).
 */
export function unlockAudio(): void {
	const ctx = getAudioContext();
	if (ctx && ctx.state === 'suspended') {
		void ctx.resume();
	}
}

/**
 * Vérifie si les notifications sonores sont activées (lecture depuis localStorage ou BFF).
 */
export function isSoundEnabled(bffDefault?: boolean): boolean {
	if (typeof window === 'undefined') return bffDefault ?? false;
	try {
		const saved = localStorage.getItem(SOUND_STORAGE_KEY);
		if (saved !== null) {
			soundEnabledState = saved === 'true';
			return soundEnabledState;
		}
	} catch (err) {
		console.warn('[Sounds] Erreur de lecture de localStorage:', err);
	}
	if (typeof bffDefault === 'boolean') {
		soundEnabledState = bffDefault;
	}
	return soundEnabledState;
}

/**
 * Initialise l'état sonore avec prise en compte du réglage par défaut BFF.
 */
export function initSound(bffDefault?: boolean): boolean {
	return isSoundEnabled(bffDefault);
}

/**
 * Active ou désactive les notifications sonores et persiste l'état dans localStorage.
 */
export function setSoundEnabled(enabled: boolean): void {
	soundEnabledState = enabled;
	if (typeof window !== 'undefined') {
		try {
			localStorage.setItem(SOUND_STORAGE_KEY, String(enabled));
		} catch (err) {
			console.warn('[Sounds] Erreur d\'écriture dans localStorage:', err);
		}
		if (enabled) {
			unlockAudio();
		}
	}
	for (const listener of listeners) {
		try {
			listener(enabled);
		} catch (e) {
			console.error('[Sounds] Erreur dans le listener de son:', e);
		}
	}
}

/**
 * Alterne l'état d'activation du son.
 */
export function toggleSound(): boolean {
	const next = !isSoundEnabled();
	setSoundEnabled(next);
	return next;
}

/**
 * S'abonne aux changements d'état du son.
 */
export function onSoundChange(listener: SoundListener): () => void {
	listeners.add(listener);
	listener(isSoundEnabled());
	return () => {
		listeners.delete(listener);
	};
}

/**
 * Joue un bip sonore via un OscillatorNode et un GainNode avec fade-out propre.
 *
 * @param frequency Fréquence en Hertz (ex: 880, 440)
 * @param durationMs Durée du bip en millisecondes
 * @param type Forme d'onde ('sine', 'triangle', 'square', 'sawtooth'), défaut: 'sine'
 * @param startDelayMs Délai avant démarrage en millisecondes (pour séquencer plusieurs bips)
 */
export function playBeep(
	frequency: number,
	durationMs: number,
	type: OscillatorType = 'sine',
	startDelayMs = 0
): void {
	if (!isSoundEnabled()) return;

	const ctx = getAudioContext();
	if (!ctx) return;

	try {
		const startTime = ctx.currentTime + startDelayMs / 1000;
		const durationSec = durationMs / 1000;
		const stopTime = startTime + durationSec;

		const osc = ctx.createOscillator();
		const gain = ctx.createGain();

		osc.type = type;
		osc.frequency.setValueAtTime(frequency, startTime);

		// Enveloppe sonore nette : attaque rapide (5ms), palier et extinction exponentielle sans clic
		const attackSec = 0.005;
		const maxGain = 0.15; // Volume modéré

		gain.gain.setValueAtTime(0.0001, startTime);
		gain.gain.linearRampToValueAtTime(maxGain, startTime + attackSec);
		gain.gain.setValueAtTime(maxGain, Math.max(startTime + attackSec, stopTime - 0.02));
		gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

		osc.connect(gain);
		gain.connect(ctx.destination);

		osc.start(startTime);
		osc.stop(stopTime);

		osc.onended = () => {
			try {
				osc.disconnect();
				gain.disconnect();
			} catch {}
		};
	} catch (err) {
		console.warn('[Sounds] Impossible d\'émettre le son Web Audio:', err);
	}
}

/**
 * Alerte Sonde DOWN : Bip aigu (880Hz, 200ms).
 */
export function playAlertDown(): void {
	playBeep(880, 200, 'sine');
}

/**
 * Alerte Rétablissement DOWN → UP : Double bip grave (440Hz, 100ms × 2).
 */
export function playAlertRecovery(): void {
	playBeep(440, 100, 'sine', 0);
	playBeep(440, 100, 'sine', 150);
}

/**
 * Alerte Critique (≥ 3 sondes DOWN simultanément) : Séquence de 3 beeps aigus (880Hz).
 */
export function playAlertCritical(): void {
	playBeep(880, 120, 'sine', 0);
	playBeep(880, 120, 'sine', 160);
	playBeep(880, 120, 'sine', 320);
}
