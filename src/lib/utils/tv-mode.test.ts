import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Classe utilitaire pour émuler les classes CSS
class MockClassList {
	private classes = new Set<string>();

	add(...tokens: string[]): void {
		for (const t of tokens) this.classes.add(t);
	}

	remove(...tokens: string[]): void {
		for (const t of tokens) this.classes.delete(t);
	}

	contains(token: string): boolean {
		return this.classes.has(token);
	}

	get value(): string {
		return Array.from(this.classes).join(' ');
	}
}

// Classe utilitaire pour émuler un élément DOM minimal
class MockElement {
	classList = new MockClassList();
	style = {
		removeProperty: (_prop: string) => {}
	};
	nodeType = 1;
	id: string;

	constructor(id = '') {
		this.id = id;
	}

	requestFullscreen(): Promise<void> {
		return Promise.resolve();
	}
}

// Système de bus d'événements minimal
class MockEventTarget {
	private listeners: Record<string, Function[]> = {};

	addEventListener(event: string, handler: Function, _options?: unknown): void {
		if (!this.listeners[event]) this.listeners[event] = [];
		this.listeners[event].push(handler);
	}

	removeEventListener(event: string, handler: Function): void {
		if (!this.listeners[event]) return;
		this.listeners[event] = this.listeners[event].filter((h) => h !== handler);
	}

	dispatchEvent(event: string, eventObj: unknown = {}): void {
		const handlers = this.listeners[event] ? [...this.listeners[event]] : [];
		for (const h of handlers) {
			h(eventObj);
		}
	}

	getListenerCount(event: string): number {
		return this.listeners[event]?.length ?? 0;
	}
}

describe('tv-mode module', () => {
	let mockWindow: MockEventTarget;
	let mockDocument: MockEventTarget & {
		documentElement: MockElement;
		body: MockElement;
		fullscreenElement: MockElement | null;
		exitFullscreen: () => Promise<void>;
		getElementById: (id: string) => MockElement | null;
		visibilityState: string;
	};
	let lastSentinel: MockEventTarget | null = null;
	let wakeLockReleased: boolean;
	let wakeLockRequested: boolean;
	let mockWakeLockReject: boolean;
	let mockFullscreenReject: boolean;

	// Sauvegarde de l'environnement global
	const originalWindow = (globalThis as unknown as { window?: unknown }).window;
	const originalDocument = (globalThis as unknown as { document?: unknown }).document;
	const originalNavigator = (globalThis as unknown as { navigator?: unknown }).navigator;

	beforeEach(() => {
		lastSentinel = null;
		wakeLockReleased = false;
		wakeLockRequested = false;
		mockWakeLockReject = false;
		mockFullscreenReject = false;

		mockWindow = new MockEventTarget();
		const docElement = new MockElement('html');
		const bodyElement = new MockElement('body');

		mockDocument = Object.assign(new MockEventTarget(), {
			documentElement: docElement,
			body: bodyElement,
			fullscreenElement: null as MockElement | null,
			visibilityState: 'visible',
			getElementById: (_id: string) => {
				return null;
			},
			exitFullscreen: () => {
				mockDocument.fullscreenElement = null;
				return Promise.resolve();
			}
		});

		docElement.requestFullscreen = () => {
			if (mockFullscreenReject) {
				return Promise.reject(new Error('Fullscreen denied'));
			}
			mockDocument.fullscreenElement = docElement;
			return Promise.resolve();
		};

		const mockNavigator = {
			wakeLock: {
				request: (_type: string) => {
					wakeLockRequested = true;
					if (mockWakeLockReject) {
						return Promise.reject(new Error('WakeLock denied'));
					}
					const sentinel = new MockEventTarget() as unknown as WakeLockSentinel;
					lastSentinel = sentinel as unknown as MockEventTarget;
					(sentinel as unknown as { released: boolean }).released = false;
					(sentinel as unknown as { release: () => Promise<void> }).release = () => {
						wakeLockReleased = true;
						return Promise.resolve();
					};
					return Promise.resolve(sentinel);
				}
			}
		};

		Object.defineProperty(globalThis, 'window', {
			value: mockWindow,
			configurable: true,
			writable: true
		});
		Object.defineProperty(globalThis, 'document', {
			value: mockDocument,
			configurable: true,
			writable: true
		});
		Object.defineProperty(globalThis, 'navigator', {
			value: mockNavigator,
			configurable: true,
			writable: true
		});
	});

	afterEach(async () => {
		// Import dynamique pour nettoyer l'état
		const tvMode = await import('./tv-mode.ts');
		await tvMode.exitTvMode();
		tvMode.stopInactivityDetection();

		Object.defineProperty(globalThis, 'window', {
			value: originalWindow,
			configurable: true,
			writable: true
		});
		Object.defineProperty(globalThis, 'document', {
			value: originalDocument,
			configurable: true,
			writable: true
		});
		Object.defineProperty(globalThis, 'navigator', {
			value: originalNavigator,
			configurable: true,
			writable: true
		});
	});

	it('should enter and exit TV mode correctly', async () => {
		const tvMode = await import('./tv-mode.ts');

		assert.equal(tvMode.isTvModeActive(), false);

		// 1. Enter TV Mode
		await tvMode.enterTvMode();
		assert.equal(tvMode.isTvModeActive(), true);
		assert.equal(mockDocument.fullscreenElement, mockDocument.documentElement);
		assert.equal(wakeLockRequested, true);
		assert.equal(mockDocument.body.classList.contains('animate-kato-drift'), true);

		// 2. Exit TV Mode
		await tvMode.exitTvMode();
		assert.equal(tvMode.isTvModeActive(), false);
		assert.equal(mockDocument.fullscreenElement, null);
		assert.equal(wakeLockReleased, true);
		assert.equal(mockDocument.body.classList.contains('animate-kato-drift'), false);
	});

	it('should handle requestFullscreen rejection gracefully without throwing', async () => {
		mockFullscreenReject = true;
		const tvMode = await import('./tv-mode.ts');

		// Doit réussir sans lever d'exception
		await assert.doesNotReject(async () => {
			await tvMode.enterTvMode();
		});

		assert.equal(tvMode.isTvModeActive(), true);
		await tvMode.exitTvMode();
	});

	it('should handle wakeLock rejection gracefully without throwing', async () => {
		mockWakeLockReject = true;
		const tvMode = await import('./tv-mode.ts');

		await assert.doesNotReject(async () => {
			await tvMode.enterTvMode();
		});

		assert.equal(tvMode.isTvModeActive(), true);
		await tvMode.exitTvMode();
	});

	it('should hide cursor after 5s and show cursor on mousemove', async () => {
		const tvMode = await import('./tv-mode.ts');

		// Entrée en mode TV avec un timeout court de 50ms pour le test
		await tvMode.enterTvMode({ cursorTimeoutMs: 50 });
		assert.equal(mockDocument.documentElement.classList.contains('tv-cursor-hidden'), false);

		// Attente de l'expiration du timer de curseur
		await new Promise((r) => setTimeout(r, 70));
		assert.equal(mockDocument.documentElement.classList.contains('tv-cursor-hidden'), true);
		assert.equal(mockDocument.body.classList.contains('tv-cursor-hidden'), true);

		// Mouvement de souris : le curseur doit réapparaître
		mockWindow.dispatchEvent('mousemove', {});
		assert.equal(mockDocument.documentElement.classList.contains('tv-cursor-hidden'), false);
		assert.equal(mockDocument.body.classList.contains('tv-cursor-hidden'), false);

		// Sortie du mode TV : le curseur doit être restauré
		await tvMode.exitTvMode();
		assert.equal(mockDocument.documentElement.classList.contains('tv-cursor-hidden'), false);
	});

	it('should apply drift to custom container element', async () => {
		const tvMode = await import('./tv-mode.ts');
		const customContainer = new MockElement('custom-container');

		await tvMode.enterTvMode(customContainer as unknown as HTMLElement);
		assert.equal(customContainer.classList.contains('animate-kato-drift'), true);

		await tvMode.exitTvMode();
		assert.equal(customContainer.classList.contains('animate-kato-drift'), false);
	});

	it('should notify subscribers when TV mode changes', async () => {
		const tvMode = await import('./tv-mode.ts');
		const states: boolean[] = [];

		const unsub = tvMode.onTvModeChange((active) => {
			states.push(active);
		});

		// Initial subscription emits current state (false)
		assert.deepEqual(states, [false]);

		await tvMode.enterTvMode();
		assert.deepEqual(states, [false, true]);

		await tvMode.exitTvMode();
		assert.deepEqual(states, [false, true, false]);

		unsub();
		await tvMode.enterTvMode();
		// Pas de nouvel appel après unsub
		assert.deepEqual(states, [false, true, false]);

		await tvMode.exitTvMode();
	});

	it('should exit TV mode when Escape key is pressed', async () => {
		const tvMode = await import('./tv-mode.ts');

		await tvMode.enterTvMode();
		assert.equal(tvMode.isTvModeActive(), true);

		// Simulate keydown event with Escape
		mockWindow.dispatchEvent('keydown', { key: 'Escape' });
		assert.equal(tvMode.isTvModeActive(), false);
	});

	it('should auto-enter TV mode after inactivity timeout', async () => {
		const tvMode = await import('./tv-mode.ts');

		// Start inactivity detection with 50ms for test
		const cleanup = tvMode.startInactivityDetection(50);
		assert.equal(tvMode.isTvModeActive(), false);

		// Await timeout trigger
		await new Promise((r) => setTimeout(r, 70));
		assert.equal(tvMode.isTvModeActive(), true);

		cleanup();
		await tvMode.exitTvMode();
	});

	it('should reset inactivity timer on user activity', async () => {
		const tvMode = await import('./tv-mode.ts');

		const cleanup = tvMode.startInactivityDetection(60);
		assert.equal(tvMode.isTvModeActive(), false);

		// User activity after 30ms (should reset the 60ms timer)
		await new Promise((r) => setTimeout(r, 30));
		mockWindow.dispatchEvent('mousemove', {});

		// After 40ms more (total 70ms from start, but only 40ms since reset)
		await new Promise((r) => setTimeout(r, 40));
		assert.equal(tvMode.isTvModeActive(), false);

		// After another 35ms (total 75ms since reset): TV mode should activate
		await new Promise((r) => setTimeout(r, 35));
		assert.equal(tvMode.isTvModeActive(), true);

		cleanup();
		await tvMode.exitTvMode();
	});

	it('should toggle TV mode with toggleTvMode()', async () => {
		const tvMode = await import('./tv-mode.ts');

		assert.equal(tvMode.isTvModeActive(), false);
		await tvMode.toggleTvMode();
		assert.equal(tvMode.isTvModeActive(), true);

		await tvMode.toggleTvMode();
		assert.equal(tvMode.isTvModeActive(), false);
	});

	it('should exit TV mode when document exits fullscreen externally', async () => {
		const tvMode = await import('./tv-mode.ts');

		await tvMode.enterTvMode();
		assert.equal(tvMode.isTvModeActive(), true);
		assert.equal(mockDocument.fullscreenElement, mockDocument.documentElement);

		// Simulate external exit from fullscreen by the browser
		mockDocument.fullscreenElement = null;
		mockDocument.dispatchEvent('fullscreenchange', {});

		assert.equal(tvMode.isTvModeActive(), false);
	});

	it('should exit TV mode on keypress Escape', async () => {
		const tvMode = await import('./tv-mode.ts');

		await tvMode.enterTvMode();
		assert.equal(tvMode.isTvModeActive(), true);

		mockWindow.dispatchEvent('keypress', { key: 'Escape' });
		assert.equal(tvMode.isTvModeActive(), false);
	});

	it('should handle multiple calls to enterTvMode and exitTvMode idempotently', async () => {
		const tvMode = await import('./tv-mode.ts');

		await tvMode.enterTvMode();
		await tvMode.enterTvMode();
		assert.equal(tvMode.isTvModeActive(), true);

		await tvMode.exitTvMode();
		await tvMode.exitTvMode();
		assert.equal(tvMode.isTvModeActive(), false);
	});

	it('should resolve and drift #tv-container if present in document', async () => {
		const tvMode = await import('./tv-mode.ts');
		const tvContainer = new MockElement('tv-container');
		mockDocument.getElementById = (id: string) => {
			if (id === 'tv-container') return tvContainer;
			return null;
		};

		await tvMode.enterTvMode();
		assert.equal(tvContainer.classList.contains('animate-kato-drift'), true);

		await tvMode.exitTvMode();
		assert.equal(tvContainer.classList.contains('animate-kato-drift'), false);
	});

	it('should re-acquire wakeLock on visibilitychange when tab becomes visible again', async () => {
		const tvMode = await import('./tv-mode.ts');

		await tvMode.enterTvMode();
		assert.equal(tvMode.isTvModeActive(), true);

		// Le navigateur libère automatiquement le wakelock en arrière-plan
		lastSentinel?.dispatchEvent('release', {});
		wakeLockRequested = false;

		mockDocument.visibilityState = 'visible';
		mockDocument.dispatchEvent('visibilitychange', {});

		assert.equal(wakeLockRequested, true);
		await tvMode.exitTvMode();
	});

	it('should resume inactivity detection after exiting TV mode', async () => {
		const tvMode = await import('./tv-mode.ts');

		// Démarre la détection d'inactivité avec 50ms
		const cleanup = tvMode.startInactivityDetection(50);
		assert.equal(tvMode.isTvModeActive(), false);

		// Entre manuellement en mode TV
		await tvMode.enterTvMode();
		assert.equal(tvMode.isTvModeActive(), true);

		// Sort du mode TV (ex: appui sur Escape)
		await tvMode.exitTvMode();
		assert.equal(tvMode.isTvModeActive(), false);

		// Attente de l'expiration du timer réarmé (70ms > 50ms) sans aucune activité
		await new Promise((r) => setTimeout(r, 70));

		// Le mode TV doit s'être auto-activé à nouveau grâce au réarmement
		assert.equal(tvMode.isTvModeActive(), true);

		cleanup();
		await tvMode.exitTvMode();
	});

	it('should remove user gesture click listener when exiting TV mode', async () => {
		const tvMode = await import('./tv-mode.ts');

		assert.equal(mockWindow.getListenerCount('click'), 0);

		// Entrée en mode TV : ajoute un listener click sur window pour retry
		await tvMode.enterTvMode();
		assert.equal(mockWindow.getListenerCount('click'), 1);

		// Sortie du mode TV : le listener doit être retiré proprement
		await tvMode.exitTvMode();
		assert.equal(mockWindow.getListenerCount('click'), 0);
	});

	it('should not emit redundant listener notifications on multiple enter or exit calls', async () => {
		const tvMode = await import('./tv-mode.ts');
		const emittedStates: boolean[] = [];

		const unsub = tvMode.onTvModeChange((active) => {
			emittedStates.push(active);
		});

		// Initial emission: [false]
		assert.deepEqual(emittedStates, [false]);

		await tvMode.enterTvMode();
		await tvMode.enterTvMode(); // Appel idempotent répété
		assert.deepEqual(emittedStates, [false, true]);

		await tvMode.exitTvMode();
		await tvMode.exitTvMode(); // Appel idempotent répété
		assert.deepEqual(emittedStates, [false, true, false]);

		unsub();
	});
});
