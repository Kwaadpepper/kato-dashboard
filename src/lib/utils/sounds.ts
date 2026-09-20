/**
 * Web Audio API sound notification module for Kato Dashboard.
 * Generates pure synthesizer alert sounds (OscillatorNode + GainNode)
 * without requiring any external audio files.
 */

export const SOUND_STORAGE_KEY = 'kato-sound-enabled';

let audioCtx: AudioContext | null = null;
let soundEnabledState = false;

type SoundListener = (enabled: boolean) => void;
const listeners = new Set<SoundListener>();

/**
 * Initializes or retrieves the singleton AudioContext instance.
 * Handles cross-browser compatibility and auto-resumes from 'suspended' state.
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
			// Blocked by browser autoplay policy until user interaction occurs
		});
	}

	return audioCtx;
}

/**
 * Unlocks AudioContext upon user interaction (click, keypress).
 */
export function unlockAudio(): void {
	const ctx = getAudioContext();
	if (ctx && ctx.state === 'suspended') {
		void ctx.resume();
	}
}

/**
 * Checks whether audio notifications are enabled (from localStorage or BFF default).
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
		console.warn('[Sounds] Failed to read from localStorage:', err);
	}
	if (typeof bffDefault === 'boolean') {
		soundEnabledState = bffDefault;
	}
	return soundEnabledState;
}

/**
 * Initializes sound state considering BFF default setting.
 */
export function initSound(bffDefault?: boolean): boolean {
	return isSoundEnabled(bffDefault);
}

/**
 * Enables or disables audio notifications and persists state in localStorage.
 */
export function setSoundEnabled(enabled: boolean): void {
	soundEnabledState = enabled;
	if (typeof window !== 'undefined') {
		try {
			localStorage.setItem(SOUND_STORAGE_KEY, String(enabled));
		} catch (err) {
			console.warn('[Sounds] Failed to write to localStorage:', err);
		}
		if (enabled) {
			unlockAudio();
		}
	}
	for (const listener of listeners) {
		try {
			listener(enabled);
		} catch (e) {
			console.error('[Sounds] Error in sound listener:', e);
		}
	}
}

/**
 * Toggles audio notification state.
 */
export function toggleSound(): boolean {
	const next = !isSoundEnabled();
	setSoundEnabled(next);
	return next;
}

/**
 * Subscribes to sound state changes.
 */
export function onSoundChange(listener: SoundListener): () => void {
	listeners.add(listener);
	listener(isSoundEnabled());
	return () => {
		listeners.delete(listener);
	};
}

/**
 * Plays an audio beep using OscillatorNode and GainNode with clean fade-out.
 *
 * @param frequency Frequency in Hertz (e.g. 880, 440)
 * @param durationMs Beep duration in milliseconds
 * @param type Waveform ('sine', 'triangle', 'square', 'sawtooth'), default: 'sine'
 * @param startDelayMs Delay before playback in milliseconds (for sequencing multiple beeps)
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

		// Clean sound envelope: rapid attack (5ms), sustain and exponential decay to prevent clicks
		const attackSec = 0.005;
		const maxGain = 0.15; // Moderate volume

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
		console.warn('[Sounds] Unable to emit Web Audio sound:', err);
	}
}

/**
 * DOWN Probe Alert: High-pitched beep (880Hz, 200ms).
 */
export function playAlertDown(): void {
	playBeep(880, 200, 'sine');
}

/**
 * Recovery Alert (DOWN -> UP): Double low beep (440Hz, 100ms x 2).
 */
export function playAlertRecovery(): void {
	playBeep(440, 100, 'sine', 0);
	playBeep(440, 100, 'sine', 150);
}

/**
 * Critical Alert (>= 3 probes DOWN simultaneously): 3 high-pitched beeps (880Hz).
 */
export function playAlertCritical(): void {
	playBeep(880, 120, 'sine', 0);
	playBeep(880, 120, 'sine', 160);
	playBeep(880, 120, 'sine', 320);
}
