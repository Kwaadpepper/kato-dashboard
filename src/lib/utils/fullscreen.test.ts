import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
	isFullscreen,
	toggleFullscreen,
	enterFullscreen,
	exitFullscreen,
	onFullscreenChange
} from './fullscreen.ts';

// Mock du DOM pour tester l'API Fullscreen
class MockDocument {
	fullscreenElement: HTMLElement | null = null;
	private eventListeners = new Map<string, Set<() => void>>();

	addEventListener(event: string, listener: () => void) {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, new Set());
		}
		this.eventListeners.get(event)!.add(listener);
	}

	removeEventListener(event: string, listener: () => void) {
		this.eventListeners.get(event)?.delete(listener);
	}

	dispatchEvent(event: string) {
		const handlers = this.eventListeners.get(event);
		if (handlers) {
			for (const h of handlers) h();
		}
	}

	exitFullscreen = async () => {
		this.fullscreenElement = null;
		this.dispatchEvent('fullscreenchange');
	};

	documentElement = {
		requestFullscreen: async () => {
			this.fullscreenElement = this.documentElement as unknown as HTMLElement;
			this.dispatchEvent('fullscreenchange');
		}
	};
}

const mockDoc = new MockDocument();
(globalThis as unknown as { document: unknown }).document = mockDoc;

describe('fullscreen utility module', () => {
	beforeEach(() => {
		mockDoc.fullscreenElement = null;
	});

	it('should accurately detect when not in fullscreen', () => {
		assert.equal(isFullscreen(), false);
	});

	it('should enter fullscreen with enterFullscreen()', async () => {
		await enterFullscreen();
		assert.equal(isFullscreen(), true);
	});

	it('should exit fullscreen with exitFullscreen()', async () => {
		await enterFullscreen();
		assert.equal(isFullscreen(), true);

		await exitFullscreen();
		assert.equal(isFullscreen(), false);
	});

	it('should toggle fullscreen with toggleFullscreen()', async () => {
		assert.equal(isFullscreen(), false);

		await toggleFullscreen();
		assert.equal(isFullscreen(), true);

		await toggleFullscreen();
		assert.equal(isFullscreen(), false);
	});

	it('should notify subscribers when fullscreen state changes', async () => {
		let state = false;
		const unsubscribe = onFullscreenChange((val) => {
			state = val;
		});

		assert.equal(state, false);

		await toggleFullscreen();
		assert.equal(state, true);

		await toggleFullscreen();
		assert.equal(state, false);

		unsubscribe();
	});
});
