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
	import LoaderCircle from 'lucide-svelte/icons/loader-circle';
	import ArrowDown from 'lucide-svelte/icons/arrow-down';
	import { toggleFullscreen } from '$lib/utils/fullscreen';
	import {
		playAlertDown,
		playAlertRecovery,
		playAlertCritical,
		unlockAudio
	} from '$lib/utils/sounds';
	import {
		t as translate,
		onLocaleChange,
		getLocale,
		type SupportedLocale,
		type TranslationKey
	} from '$lib/i18n';

	let { data }: { data: PageData } = $props();

	let currentLocale = $state<SupportedLocale>(getLocale());
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

	// Registre des statuts précédents pour la détection fine des transitions UP → DOWN
	// svelte-ignore state_referenced_locally
	let previousStatuses = $state<Record<string, ProbeStatus>>(
		data.initialState?.probes
			? Object.fromEntries(data.initialState.probes.map((p) => [p.id, p.status]))
			: {}
	);

	// Ensemble des identifiants de sondes en train de clignoter (UP → DOWN)
	let flashingProbeIds = $state<Set<string>>(new Set());

	// Flash sur la bordure du container principal lors d'une bascule UP → DOWN
	let containerFlashing = $state(false);
	let flashTimer: ReturnType<typeof setTimeout> | null = null;

	function triggerContainerFlash() {
		containerFlashing = true;
		if (flashTimer) clearTimeout(flashTimer);
		flashTimer = setTimeout(() => {
			containerFlashing = false;
		}, 2000);
	}

	// Alerte critique de masse : ≥ 30% des sondes sont DOWN → fond bg-red-950/20
	const downCount = $derived(probes.filter((p) => p.status === 'down').length);
	const isCriticalDownRatio = $derived(probes.length > 0 && downCount / probes.length >= 0.3);

	// Conteneur DOM de la grille pour le ResizeObserver
	let gridContainer: HTMLElement | null = $state(null);
	let containerWidth = $state<number>(1920);
	let containerHeight = $state<number>(992);
	let innerWidth = $state<number>(1920);

	// Détection précise du mode mobile (< 768px) pour adaptation du layout et du tactile
	const isMobile = $derived(innerWidth < 768);

	// État de sélection d'une sonde pour la vue détaillée (Modal fullscreen mobile / Side-panel desktop)
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

	// Gestion du geste tactile "Pull-to-refresh" natif sur mobile
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

	// Conteneur DOM principal du dashboard pour l'anti burn-in et le plein écran
	let dashboardContainer: HTMLElement | null = $state(null);
	// Lit le paramètre URL ?tv=1 via $page.url.searchParams pour l'état initial (SSR + hydratation)
	let isTvActiveState = $state($page.url.searchParams.get('tv') === '1');
	const isTvMode = $derived(isTvActiveState);

	// Nettoie proprement le paramètre ?tv=1 de l'URL du navigateur et du store SvelteKit
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

	// Mode compact activé en mode TV (h-8) ou si le parc comporte plus de 100 sondes
	const isCompactHeader = $derived(isTvMode || probes.length > 100);

	// Mode Zéro-scroll avec pixels collés sur mobile (activé par défaut pour vue 100% compacte)
	let forceZeroScroll = $state(true);

	function toggleZeroScroll() {
		forceZeroScroll = !forceZeroScroll;
	}

	// 1. Tri intelligent : DOWN en tête (haut-gauche), puis DEGRADED, UP par criticité, etc.
	const sortedProbes = $derived(sortProbesSmart(probes));

	// 2. Calcul dynamique de la géométrie de grille adaptative (zéro scroll)
	const layout: GridLayout = $derived(
		calculateGrid({
			viewportWidth: containerWidth,
			viewportHeight: containerHeight,
			probeCount: sortedProbes.length,
			headerHeight: 0, // La hauteur est déjà réservée par le padding du conteneur
			incidentBarHeight: 0,
			isMobile,
			forceZeroScroll: isMobile && forceZeroScroll
		})
	);

	// 3. Souscription SSE (Server-Sent Events) pour les flux temps réel et reconnexion au pull-to-refresh
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
				// A. Détection des transitions UP → DOWN et DOWN → UP avec alertes sonores
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

					// Maintient la sonde actuellement ouverte synchronisée avec les mises à jour SSE
					if (selectedProbe && probeMap.has(selectedProbe.id)) {
						selectedProbe = probeMap.get(selectedProbe.id)!;
					}

					// Active le flash sur les cartes de sondes qui viennent de tomber (sans aucun $effect enfant)
					if (newFlashing.size > 0) {
						flashingProbeIds = newFlashing;
						setTimeout(() => {
							flashingProbeIds = new Set();
						}, 2000);
					}

					// Flash visuel sur le container principal si au moins une sonde est tombée
					if (upToDownCount > 0) {
						triggerContainerFlash();
					}

					// Notifications sonores selon les règles de surveillance :
					// - ≥ 3 sondes passent DOWN simultanément : alerte critique (3 beeps)
					// - Au moins 1 sonde passe DOWN : alerte coupure (beep aigu)
					// - Rétablissement d'une sonde DOWN → UP : alerte retour à la normale (double beep)
					if (upToDownCount >= 3) {
						playAlertCritical();
					} else if (upToDownCount > 0) {
						playAlertDown();
					} else if (downToUpCount > 0) {
						playAlertRecovery();
					}
				}

				// B. Fusion des incidents nouveaux et résolus
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

				// C. Horodatage de l'événement
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
			// Reconnexion forcée SSE (déclenche immédiatement l'envoi du snapshot complet 'init')
			setupSSE();
			// Délai visuel de confort pour l'animation pull-to-refresh
			await new Promise((resolve) => setTimeout(resolve, 600));
		} finally {
			isRefreshing = false;
		}
	}

	// 4. Cycle de vie initialisé sur le client (onMount) pour éviter les re-renders récursifs
	onMount(() => {
		// Démarrage de la connexion SSE une seule fois
		setupSSE();

		// ResizeObserver supervisant le conteneur de grille
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

		// Si tv=1 : appelle enterTvMode() au mount avec le conteneur de grille
		if ($page.url.searchParams.get('tv') === '1') {
			void enterTvMode(gridContainer);
		}

		// Synchronisation continue avec l'état effectif du mode TV
		const unsubTv = onTvModeChange((active) => {
			isTvActiveState = active;
			if (!active) {
				cleanTvParamFromUrl();
			}
		});

		// Détection d'inactivité : réactive le mode TV après 30s d'inactivité uniquement si le mode TV a été explicitement demandé (?tv=1)
		let cleanupInactivity = () => {};
		if ($page.url.searchParams.get('tv') === '1') {
			cleanupInactivity = startInactivityDetection(30_000, () => {
				void enterTvMode(gridContainer);
			});
		}

		// Écoute de l'événement personnalisé 'probe-detail' propagé par bullage
		const handleCustomProbeDetail = (e: Event) => {
			handleProbeDetailCustomEvent(e);
		};
		window.addEventListener('probe-detail', handleCustomProbeDetail);

		// Déverrouillage de l'AudioContext dès le premier geste utilisateur (politique autoplay)
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

	// Surveillance des changements de navigation (?tv=1) via afterNavigate (sans $effect réactif)
	afterNavigate(({ to }) => {
		const shouldEnterTv = to?.url.searchParams.get('tv') === '1';
		if (shouldEnterTv && !isTvActiveState) {
			void enterTvMode(gridContainer);
		}
	});

	// Gestionnaire global du clavier : 'F' (plein écran), 'Escape' (mode TV / modale)
	function handleGlobalKeydown(event: KeyboardEvent): void {
		const target = event.target as HTMLElement | null;
		const isInput =
			target &&
			(target.tagName === 'INPUT' ||
				target.tagName === 'TEXTAREA' ||
				target.tagName === 'SELECT' ||
				target.isContentEditable);

		if (isInput) return;

		if (event.key === 'f' || event.key === 'F') {
			event.preventDefault();
			void toggleFullscreen(dashboardContainer ?? undefined);
		} else if (event.key === 'Escape') {
			if (selectedProbe) {
				selectedProbe = null;
			} else if (isTvMode) {
				void exitTvMode();
				cleanTvParamFromUrl();
			}
		}
	}

	// Neutralisation des clics de navigation / modale en mode TV (les contrôles de l'en-tête restent accessibles)
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

<!-- Conteneur plein écran strict zéro scroll (100vw / 100vh) sur desktop -->
<div
	id="tv-container"
	bind:this={dashboardContainer}
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
	<!-- En-tête supérieur (Header fixe) -->
	<Header
		{probes}
		{lastUpdate}
		compact={isCompactHeader}
		{connectionStatus}
		{isMobile}
		{forceZeroScroll}
		ontoggleZeroScroll={toggleZeroScroll}
	/>

	<!-- Bannière "Connexion perdue" en cas d'interruption serveur ou réseau -->
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

	<!-- Zone principale de la grille supervisée par ResizeObserver (drift anti burn-in isolé) -->
	<main
		bind:this={gridContainer}
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
		class="flex-1 w-full h-full relative {isTvMode ? 'animate-kato-drift' : ''} {layout.overflows ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden'}"
	>
		<!-- Indicateur visuel Pull-to-refresh natif sur mobile -->
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

	<!-- Bandeau d'alertes inférieur (IncidentBar fixe) -->
	<IncidentBar {incidents} tvMode={isTvMode} />
</div>

<!-- Modal plein écran sur mobile / Panneau latéral sur desktop -->
<DetailModal
	probe={selectedProbe}
	{incidents}
	onclose={() => (selectedProbe = null)}
/>
