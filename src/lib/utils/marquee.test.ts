import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
	getInitialMarqueeSpeed,
	getInitialMarqueeDuration,
	setMarqueeSpeed,
	setMarqueeDuration,
	getMarqueeConfig,
	onMarqueeChange,
	MARQUEE_STORAGE_KEY,
	MARQUEE_DURATION_STORAGE_KEY
} from './marquee.ts';

// Mock minimal de window et localStorage pour tests Node
class MockLocalStorage {
	private store = new Map<string, string>();

	getItem(key: string): string | null {
		return this.store.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.store.set(key, value);
	}

	removeItem(key: string): void {
		this.store.delete(key);
	}

	clear(): void {
		this.store.clear();
	}
}

const mockStorage = new MockLocalStorage();
(globalThis as unknown as { window: unknown }).window = globalThis;
(globalThis as unknown as { localStorage: unknown }).localStorage = mockStorage;

describe('marquee utility module', () => {
	beforeEach(() => {
		mockStorage.clear();
		setMarqueeSpeed('slow');
	});

	it('should default to slow speed (60s limit) when localStorage is empty', () => {
		assert.equal(getInitialMarqueeSpeed(), 'slow');
		assert.equal(getInitialMarqueeDuration(), 60);
	});

	it('should persist speed preset to localStorage when set', () => {
		setMarqueeSpeed('normal');
		assert.equal(mockStorage.getItem(MARQUEE_STORAGE_KEY), 'normal');
		assert.equal(mockStorage.getItem(MARQUEE_DURATION_STORAGE_KEY), '40');
		assert.equal(getMarqueeConfig().duration, 40);
		assert.equal(getMarqueeConfig().speed, 'normal');
	});

	it('should allow setting custom duration and clamp to valid bounds (15s to 180s)', () => {
		setMarqueeDuration(10); // under min 15
		assert.equal(getMarqueeConfig().duration, 15);
		assert.equal(getMarqueeConfig().speed, 'fast');

		setMarqueeDuration(90);
		assert.equal(getMarqueeConfig().duration, 90);
		assert.equal(getMarqueeConfig().speed, 'slow');

		setMarqueeDuration(250); // over max 180
		assert.equal(getMarqueeConfig().duration, 180);
	});

	it('should notify subscribers on speed change', () => {
		let receivedDuration = 0;
		let receivedSpeed = '';

		const unsubscribe = onMarqueeChange((cfg) => {
			receivedSpeed = cfg.speed;
			receivedDuration = cfg.duration;
		});

		assert.equal(receivedSpeed, 'slow');
		assert.equal(receivedDuration, 60);

		setMarqueeSpeed('fast');
		assert.equal(receivedSpeed, 'fast');
		assert.equal(receivedDuration, 25);

		unsubscribe();
	});
});
