<script lang="ts">
	import type { PageData } from './$types';
	import type {
		NormalizedProbe,
		NormalizedIncident,
		DashboardDelta,
		GridLayout,
		ProbeStatus
	} from '$lib/types';
	import { page } from '$app/stores';
	import { goto, afterNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { connectSSE, type ConnectionStatus } from '$lib/utils/sse-client';
	import { calculateGrid } from '$lib/utils/grid-calculator';
	import { sortProbesSmart } from '$lib/utils/sort';
	import {
		enterTvMode,
		exitTvMode,
		onTvModeChange,
		startInactivityDetection
	} from '$lib/utils/tv-mode';
	import Header from '$lib/components/Header.svelte';
	import ProbeGrid from '$lib/components/ProbeGrid.svelte';
	import IncidentBar from '$lib/components/IncidentBar.svelte';
	import DetailModal from '$lib/components/DetailModal.svelte';
	import SkipLink from '$lib/components/SkipLink.svelte';
	import KeyboardHelpModal from '$lib/components/KeyboardHelpModal.svelte';
	import LoaderCircle from 'lucide-svelte/icons/loader-circle';
	import ArrowDown from 'lucide-svelte/icons/arrow-down';
	import { toggleFullscreen } from '$lib/utils/fullscreen';
	import {
		playAlertDown,
		playAlertRecovery,
		playAlertCritical,
		unlockAudio,
		toggleSound
	} from '$lib/utils/sounds';
	import { applyTheme, type Theme } from '$lib/utils/theme';
	import {
		t as translate,
		onLocaleChange,
		getLocale,
		type SupportedLocale,
		type TranslationKey
	} from '$lib/i18n';

	let { data }: { data: PageData } = $props();

	let currentLocale = $state<SupportedLocale>(getLocale());
	let isKeyboardHelpOpen = $state(false);
	const t = (key: TranslationKey | string, params?: Record<string, string | number>) =>
		translate(key, params, currentLocale);

	// svelte-ignore state_referenced_locally
	let probes = $state<NormalizedProbe[]>(data.initialState?.probes ? [...data.initialState.probes] : []);
	// svelte-ignore state_referenced_locally
	let incidents = $state<NormalizedIncident[]>(data.initialState?.incidents ? [...data.initialState.incidents] : []);
	// svelte-ignore state_referenced_locally
	let lastUpdate = $state<string>(data.initialState?.lastUpdate ?? '');
	// svelte-ignore state_referenced_locally
	let _source = $state<string>(data.initialState?.source ?? 'unknown');
	let connectionStatus = $state<ConnectionStatus>('connected');

	// Previous status registry for fine detection of UP -> DOWN transitions
	// svelte-ignore state_referenced_locally
	let previousStatuses = $state<Record<string, ProbeStatus>>(
		data.initialState?.probes
			? Object.fromEntries(data.initialState.probes.map((p) => [p.id, p.status]))
			: {}
	);

	// Set of probe IDs currently flashing (UP -> DOWN)
	let flashingProbeIds = $state<Set<string>>(new Set());

	// Border flash on main container on UP -> DOWN transition
	let containerFlashing = $state(false);
	let flashTimer: ReturnType<typeof setTimeout> | null = null;

	function triggerContainerFlash() {
		containerFlashing = true;
		if (flashTimer) clearTimeout(flashTimer);
		flashTimer = setTimeout(() => {
			containerFlashing = false;
		}, 2000);
	}

	// Mass critical alert: >= 30% of probes are DOWN -> bg-red-950/20 background
	const downCount = $derived(probes.filter((p) => p.status === 'down').length);
	const isCriticalDownRatio = $derived(probes.length > 0 && downCount / probes.length >= 0.3);

	// Grid DOM container for ResizeObserver
	let gridContainer: HTMLElement | null = $state(null);
	let containerWidth = $state<number>(1920);
	let containerHeight = $state<number>(992);
	let innerWidth = $state<number>(1920);

	// Mobile mode detection (< 768px) for responsive layout and touch interactions
	const isMobile = $derived(innerWidth < 768);

	// Selected probe state for detail view (fullscreen modal on mobile / side-panel on desktop)
	let selectedProbe = $state<NormalizedProbe | null>(null);

	function handleSelectProbe(probe: NormalizedProbe) {
		if (!isTvMode) {
			selectedProbe = probe;
		}
	}

	function handleProbeDetailCustomEvent(e: Event) {
		if (!isTvMode && 'detail' in e) {
			selectedProbe = (e as CustomEvent<NormalizedProbe>).detail;
		}
	}

	// Mobile pull-to-refresh touch gesture handling
	let touchStartY = 0;
	let isPulling = $state(false);
	let pullDistance = $state(0);
	let isRefreshing = $state(false);

	function handleTouchStart(e: TouchEvent) {
		if (!isMobile || isRefreshing) return;
		if (gridContainer && gridContainer.scrollTop <= 0) {
			touchStartY = e.touches[0].clientY;
			isPulling = true;
		}
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isPulling || isRefreshing) return;
		if (gridContainer && gridContainer.scrollTop > 0) {
			isPulling = false;
			pullDistance = 0;
			return;
		}
		const currentY = e.touches[0].clientY;
		const diffY = currentY - touchStartY;
		if (diffY > 0) {
			pullDistance = Math.min(80, Math.floor(diffY * 0.45));
		} else {
			pullDistance = 0;
		}
	}

	async function handleTouchEnd() {
		if (!isPulling || isRefreshing) return;
		isPulling = false;
		if (pullDistance >= 50) {
			await performRefresh();
		}
		pullDistance = 0;
	}

	// Main dashboard DOM container for anti burn-in and fullscreen
	let dashboardContainer: HTMLElement | null = $state(null);
	// Reads ?tv=1 URL parameter for initial state (SSR + hydration)
	let isTvActiveState = $state($page.url.searchParams.get('tv') === '1');
	const isTvMode = $derived(isTvActiveState);

	// Cleans ?tv=1 parameter from browser URL and SvelteKit router store
	function cleanTvParamFromUrl(): void {
		if (typeof window === 'undefined') return;
		const currentUrl = new URL(window.location.href);
		if (currentUrl.searchParams.has('tv')) {
			currentUrl.searchParams.delete('tv');
			void goto(currentUrl.pathname + (currentUrl.search ? currentUrl.search : ''), {
				replaceState: true,
				keepFocus: true,
				noScroll: true
			});
		}
	}

	// Compact header enabled in TV mode (h-8) or when probe count exceeds 100
	const isCompactHeader = $derived(isTvMode || probes.length > 100);

	// Zero-scroll mode with contiguous pixel look on mobile (default enabled for compact view)
	let forceZeroScroll = $state(true);

	function toggleZeroScroll() {
		forceZeroScroll = !forceZeroScroll;
	}

	// 1. Smart sort: DOWN first (top-left), then DEGRADED, UP by criticality, etc.
	const sortedProbes = $derived(sortProbesSmart(probes));

	// 2. Dynamic adaptive grid calculation (zero scroll)
	const layout: GridLayout = $derived(
		calculateGrid({
			viewportWidth: containerWidth,
			viewportHeight: containerHeight,
			probeCount: sortedProbes.length,
			headerHeight: 0, // Height is handled by container padding
			incidentBarHeight: 0,
			isMobile,
			forceZeroScroll: isMobile && forceZeroScroll
		})
	);

	// 3. SSE subscription (Server-Sent Events) for real-time streaming and pull-to-refresh
	let disconnectSSE: (() => void) | null = null;

	function setupSSE() {
		if (disconnectSSE) {
			disconnectSSE();
			disconnectSSE = null;
		}

		disconnectSSE = connectSSE(
			(initialState) => {
				probes = [...initialState.probes];
				incidents = [...initialState.incidents];
				lastUpdate = initialState.lastUpdate;
				_source = initialState.source;

				const initStatusMap: Record<string, ProbeStatus> = {};
				for (const p of initialState.probes) {
					initStatusMap[p.id] = p.status;
				}
				previousStatuses = initStatusMap;
			},
			(delta: DashboardDelta) => {
				// A. Detect UP -> DOWN and DOWN -> UP transitions with sound alerts
				if (delta.changed.length > 0) {
					let upToDownCount = 0;
					let downToUpCount = 0;
					const updatedPrev = { ...previousStatuses };
					const newFlashing = new Set<string>();

					const probeMap = new Map(probes.map((p) => [p.id, p]));
					for (const updated of delta.changed) {
						const oldStatus = previousStatuses[updated.id];
						if (oldStatus === 'up' && updated.status === 'down') {
							upToDownCount++;
							newFlashing.add(updated.id);
						} else if (oldStatus === 'down' && updated.status === 'up') {
							downToUpCount++;
						}
						updatedPrev[updated.id] = updated.status;
						probeMap.set(updated.id, updated);
					}

					previousStatuses = updatedPrev;
					probes = Array.from(probeMap.values());

					// Keep currently open probe synchronized with SSE updates
					if (selectedProbe && probeMap.has(selectedProbe.id)) {
						selectedProbe = probeMap.get(selectedProbe.id)!;
					}

					// Trigger flash on cards of newly DOWN probes
					if (newFlashing.size > 0) {
						flashingProbeIds = newFlashing;
						setTimeout(() => {
							flashingProbeIds = new Set();
						}, 2000);
					}

					// Visual flash on main container if at least one probe went DOWN
					if (upToDownCount > 0) {
						triggerContainerFlash();
					}

					// Audio notifications based on monitoring rules:
					// - >= 3 probes pass DOWN simultaneously: critical alert (3 beeps)
					// - At least 1 probe passes DOWN: outage alert (high beep)
					// - Probe recovery DOWN -> UP: recovery alert (double beep)
					if (upToDownCount >= 3) {
						playAlertCritical();
					} else if (upToDownCount > 0) {
						playAlertDown();
					} else if (downToUpCount > 0) {
						playAlertRecovery();
					}
				}

				// B. Merge new and resolved incidents
				if (delta.newIncidents.length > 0 || delta.resolvedIncidentIds.length > 0) {
					const incidentMap = new Map(incidents.map((i) => [i.id, i]));
					for (const newInc of delta.newIncidents) {
						incidentMap.set(newInc.id, newInc);
					}
					for (const resolvedId of delta.resolvedIncidentIds) {
						const existing = incidentMap.get(resolvedId);
						if (existing && !existing.resolvedAt) {
							existing.resolvedAt = delta.timestamp;
						}
					}
					incidents = Array.from(incidentMap.values());
				}

				// C. Event timestamp
				lastUpdate = delta.timestamp;
			},
			(heartbeat) => {
				lastUpdate = heartbeat.timestamp;
			},
			(status) => {
				connectionStatus = status;
			}
		);
	}

	async function performRefresh() {
		isRefreshing = true;
		try {
			// Forced SSE reconnection (immediately triggers full 'init' snapshot)
			setupSSE();
			// Animation delay for pull-to-refresh
			await new Promise((resolve) => setTimeout(resolve, 600));
		} finally {
			isRefreshing = false;
		}
	}

	// 4. Client-side lifecycle initialization (onMount)
	onMount(() => {
		// Launch SSE connection once
		setupSSE();

		// ResizeObserver monitoring the grid container
		let observer: ResizeObserver | null = null;
		let debounceTimer: ReturnType<typeof setTimeout> | null = null;

		if (gridContainer) {
			let isFirstMeasurement = true;

			observer = new ResizeObserver((entries) => {
				const entry = entries[0];
				if (!entry) return;

				const { width, height } = entry.contentRect;
				if (width <= 0 || height <= 0) return;

				if (isFirstMeasurement) {
					isFirstMeasurement = false;
					if (width !== containerWidth || height !== containerHeight) {
						containerWidth = width;
						containerHeight = height;
					}
					return;
				}

				if (debounceTimer) clearTimeout(debounceTimer);
				debounceTimer = setTimeout(() => {
					if (width !== containerWidth || height !== containerHeight) {
						containerWidth = width;
						containerHeight = height;
					}
				}, 150);
			});

			observer.observe(gridContainer);
		}

		// If tv=1: call enterTvMode() at mount with the grid container
		if ($page.url.searchParams.get('tv') === '1') {
			void enterTvMode(gridContainer);
		}

		// Continual synchronization with TV mode state
		const unsubTv = onTvModeChange((active) => {
			isTvActiveState = active;
			if (!active) {
				cleanTvParamFromUrl();
			}
		});

		// Inactivity detection: reactivates TV mode after 30s of inactivity if ?tv=1 was requested
		let cleanupInactivity = () => {};
		if ($page.url.searchParams.get('tv') === '1') {
			cleanupInactivity = startInactivityDetection(30_000, () => {
				void enterTvMode(gridContainer);
			});
		}

		// Listen for bubbled 'probe-detail' custom event
		const handleCustomProbeDetail = (e: Event) => {
			handleProbeDetailCustomEvent(e);
		};
		window.addEventListener('probe-detail', handleCustomProbeDetail);

		// Unlock AudioContext on first user interaction (browser autoplay policy)
		const unlockHandler = () => {
			unlockAudio();
		};
		window.addEventListener('pointerdown', unlockHandler, { once: true });
		window.addEventListener('keydown', unlockHandler, { once: true });

		const unsubLocale = onLocaleChange((loc) => {
			currentLocale = loc;
		});

		return () => {
			if (disconnectSSE) disconnectSSE();
			if (flashTimer) clearTimeout(flashTimer);
			if (debounceTimer) clearTimeout(debounceTimer);
			if (observer) observer.disconnect();
			unsubTv();
			unsubLocale();
			cleanupInactivity();
			window.removeEventListener('probe-detail', handleCustomProbeDetail);
			window.removeEventListener('pointerdown', unlockHandler);
			window.removeEventListener('keydown', unlockHandler);
			void exitTvMode();
		};
	});

	// Monitor route changes (?tv=1) via afterNavigate
	afterNavigate(({ to }) => {
		const shouldEnterTv = to?.url.searchParams.get('tv') === '1';
		if (shouldEnterTv && !isTvActiveState) {
			void enterTvMode(gridContainer);
		}
	});

	// Global keyboard navigation: '?' (help), 'F' (fullscreen), 'M' (sound), 'T' (theme), 'Escape'
	function handleGlobalKeydown(event: KeyboardEvent): void {
		const target = event.target as HTMLElement | null;
		const isInput =
			target &&
			(target.tagName === 'INPUT' ||
				target.tagName === 'TEXTAREA' ||
				target.tagName === 'SELECT' ||
				target.isContentEditable);

		if (isInput) return;

		if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
			event.preventDefault();
			isKeyboardHelpOpen = !isKeyboardHelpOpen;
		} else if (event.key === 'f' || event.key === 'F') {
			event.preventDefault();
			void toggleFullscreen(dashboardContainer ?? undefined);
		} else if (event.key === 'm' || event.key === 'M') {
			event.preventDefault();
			toggleSound();
		} else if (event.key === 't' || event.key === 'T') {
			event.preventDefault();
			const themes: Theme[] = ['dark', 'light', 'amoled'];
			const current = (typeof document !== 'undefined'
				? (document.documentElement.getAttribute('data-theme-mode') as Theme)
				: 'dark') || 'dark';
			const nextIndex = (themes.indexOf(current) + 1) % themes.length;
			applyTheme(themes[nextIndex]);
		} else if (event.key === 'Escape') {
			if (isKeyboardHelpOpen) {
				isKeyboardHelpOpen = false;
			} else if (selectedProbe) {
				selectedProbe = null;
			} else if (isTvMode) {
				void exitTvMode();
				cleanTvParamFromUrl();
			}
		}
	}

	// Disable navigation / modal clicks in TV mode (header controls remain accessible)
	function handleClickCapture(event: MouseEvent): void {
		if (isTvMode) {
			const target = event.target as HTMLElement | null;
			if (target?.closest('header')) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			event.stopImmediatePropagation();
		}
	}
</script>

<svelte:window
	bind:innerWidth
	onkeydown={handleGlobalKeydown}
/>

<svelte:head>
	<title>{currentLocale ? t('common.pageTitle', { count: sortedProbes.length }) : ''}</title>
</svelte:head>

<!-- Accessibility skip links (WCAG 2.1) -->
<SkipLink hasIncidents={incidents.filter((i) => i.resolvedAt === null).length > 0} />

<!-- Strict fullscreen zero-scroll container (100vw / 100vh) on desktop -->
<div
	id="tv-container"
	bind:this={dashboardContainer}
	inert={Boolean(selectedProbe || isKeyboardHelpOpen)}
	onclickcapture={handleClickCapture}
	onauxclickcapture={handleClickCapture}
	oncontextmenucapture={(e) => {
		if (isTvMode) {
			e.preventDefault();
			e.stopPropagation();
		}
	}}
	class="h-screen w-screen overflow-hidden flex flex-col transition-colors duration-500 text-[var(--kato-text-primary)] select-none {isCriticalDownRatio
		? 'bg-red-950/20'
		: 'bg-[var(--kato-bg-primary)]'} {containerFlashing ? 'animate-kato-border-flash' : ''} {isTvMode
		? 'tv-mode'
		: ''} {isCompactHeader
		? 'pt-8'
		: 'pt-12'} pb-8 sm:pb-10"
>
	<!-- Fixed Header -->
	<Header
		{probes}
		{lastUpdate}
		compact={isCompactHeader}
		{connectionStatus}
		{isMobile}
		{forceZeroScroll}
		ontoggleZeroScroll={toggleZeroScroll}
		onopenkeyboardhelp={() => (isKeyboardHelpOpen = true)}
	/>

	<!-- "Connection lost" alert banner on server or network disruption -->
	{#if connectionStatus !== 'connected'}
		<div
			class="fixed {isCompactHeader ? 'top-8' : 'top-12'} left-0 right-0 z-40 bg-red-600 text-white font-medium text-xs sm:text-sm py-1 px-4 flex items-center justify-center gap-2 shadow-lg backdrop-blur-xs transition-all animate-pulse"
			role="alert"
			aria-live="assertive"
		>
			<span class="w-2 h-2 rounded-full bg-white animate-ping" aria-hidden="true"></span>
			<span class="font-bold">{t('common.connectionLost')}</span>
			<span class="text-red-100 text-xs hidden sm:inline">{t('common.reconnecting')}</span>
		</div>
	{/if}

	<!-- Main grid area supervised by ResizeObserver (isolated anti burn-in drift) -->
	<main
		id="main-content"
		tabindex="-1"
		bind:this={gridContainer}
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
		class="flex-1 w-full h-full relative focus:outline-none {isTvMode ? 'animate-kato-drift' : ''} {layout.overflows ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden'}"
	>
		<!-- Native mobile pull-to-refresh indicator -->
		{#if isMobile && (pullDistance > 0 || isRefreshing)}
			<div
				class="w-full flex items-center justify-center gap-2 py-2 text-xs font-mono bg-slate-900/95 border-b border-slate-800 transition-all duration-150 select-none shrink-0"
				style="height: {isRefreshing ? 42 : Math.max(30, pullDistance)}px;"
			>
				{#if isRefreshing}
					<LoaderCircle class="w-4 h-4 text-emerald-400 animate-spin" />
					<span class="text-slate-300">{t('pullToRefresh.refreshing')}</span>
				{:else if pullDistance >= 50}
					<ArrowDown class="w-4 h-4 text-emerald-400 rotate-180 transition-transform duration-200" />
					<span class="text-emerald-400 font-semibold">{t('pullToRefresh.release')}</span>
				{:else}
					<ArrowDown class="w-4 h-4 text-slate-400 transition-transform duration-200" />
					<span class="text-slate-400">{t('pullToRefresh.pull', { distance: pullDistance })}</span>
				{/if}
			</div>
		{/if}

		{#if sortedProbes.length > 0}
			<ProbeGrid
				probes={sortedProbes}
				{layout}
				{previousStatuses}
				{flashingProbeIds}
				onselect={handleSelectProbe}
			/>
		{:else}
			<div class="w-full h-full flex flex-col items-center justify-center text-slate-500 font-mono text-sm">
				<span class="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></span>
				{t('common.loading')}
			</div>
		{/if}
	</main>

	<!-- Fixed lower IncidentBar -->
	<IncidentBar {incidents} tvMode={isTvMode} />
</div>

<!-- Fullscreen modal on mobile / Side-panel on desktop -->
<DetailModal
	probe={selectedProbe}
	{incidents}
	onclose={() => (selectedProbe = null)}
/>

<!-- Accessible keyboard shortcuts modal -->
<KeyboardHelpModal
	isOpen={isKeyboardHelpOpen}
	onclose={() => (isKeyboardHelpOpen = false)}
/>
