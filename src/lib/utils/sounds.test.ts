import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('sounds utility module', () => {
	let mockStorage: Record<string, string> = {};
	let createdOscillators: any[] = [];
	let createdGains: any[] = [];

	beforeEach(() => {
		mockStorage = {};
		createdOscillators = [];
		createdGains = [];

		// Mock localStorage
		(globalThis as any).localStorage = {
			getItem: (key: string) => mockStorage[key] ?? null,
			setItem: (key: string, value: string) => {
				mockStorage[key] = value;
			},
			removeItem: (key: string) => {
				delete mockStorage[key];
			},
			clear: () => {
				mockStorage = {};
			}
		};

		// Mock AudioContext
		class MockGain {
			gain = {
				setValueAtTime: () => {},
				linearRampToValueAtTime: () => {},
				exponentialRampToValueAtTime: () => {}
			};
			connect = () => {};
			disconnect = () => {};
		}

		class MockOscillator {
			type = 'sine';
			frequency = {
				setValueAtTime: (freq: number) => {
					(this as any).freq = freq;
				}
			};
			connect = () => {};
			disconnect = () => {};
			start = () => {};
			stop = () => {};
			onended: (() => void) | null = null;
		}

		class MockAudioContext {
			currentTime = 0;
			state = 'suspended';
			destination = {};
			createGain = () => {
				const g = new MockGain();
				createdGains.push(g);
				return g;
			};
			createOscillator = () => {
				const o = new MockOscillator();
				createdOscillators.push(o);
				return o;
			};
			resume = async () => {
				this.state = 'running';
			};
		}

		(globalThis as any).window = {
			AudioContext: MockAudioContext
		};
	});

	it('should default soundEnabled to false when localStorage is empty', async () => {
		const { isSoundEnabled } = await import('./sounds.ts');
		assert.equal(isSoundEnabled(), false);
	});

	it('should persist soundEnabled to localStorage when set', async () => {
		const { isSoundEnabled, setSoundEnabled, toggleSound } = await import('./sounds.ts');

		setSoundEnabled(true);
		assert.equal(isSoundEnabled(), true);
		assert.equal(mockStorage['kato-sound-enabled'], 'true');

		const toggled = toggleSound();
		assert.equal(toggled, false);
		assert.equal(isSoundEnabled(), false);
		assert.equal(mockStorage['kato-sound-enabled'], 'false');
	});

	it('should not play audio when sound is disabled', async () => {
		const { setSoundEnabled, playBeep } = await import('./sounds.ts');
		setSoundEnabled(false);
		createdOscillators = [];

		playBeep(880, 200);
		assert.equal(createdOscillators.length, 0);
	});

	it('should play audio when sound is enabled', async () => {
		const { setSoundEnabled, playAlertDown, playAlertRecovery, playAlertCritical } =
			await import('./sounds.ts');
		setSoundEnabled(true);

		createdOscillators = [];
		playAlertDown();
		assert.equal(createdOscillators.length, 1);
		assert.equal((createdOscillators[0] as any).freq, 880);

		createdOscillators = [];
		playAlertRecovery();
		assert.equal(createdOscillators.length, 2);
		assert.equal((createdOscillators[0] as any).freq, 440);
		assert.equal((createdOscillators[1] as any).freq, 440);

		createdOscillators = [];
		playAlertCritical();
		assert.equal(createdOscillators.length, 3);
		assert.equal((createdOscillators[0] as any).freq, 880);
	});

	it('should notify subscribers on sound change', async () => {
		const { onSoundChange, setSoundEnabled } = await import('./sounds.ts');
		const history: boolean[] = [];

		const unsubscribe = onSoundChange((enabled) => {
			history.push(enabled);
		});

		setSoundEnabled(true);
		setSoundEnabled(false);
		unsubscribe();
		setSoundEnabled(true);

		assert.deepEqual(history.slice(-2), [true, false]);
	});
});
