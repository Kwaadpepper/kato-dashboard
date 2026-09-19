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
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { connectSSE } from '$lib/utils/sse-client';
	import { calculateGrid, HEADER_HEIGHT, INCIDENT_BAR_HEIGHT } from '$lib/utils/grid-calculator';
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

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally
	let probes = $state<NormalizedProbe[]>(data.initialState?.probes ? [...data.initialState.probes] : []);
	// svelte-ignore state_referenced_locally
	let incidents = $state<NormalizedIncident[]>(data.initialState?.incidents ? [...data.initialState.incidents] : []);
	// svelte-ignore state_referenced_locally
	let lastUpdate = $state<string>(data.initialState?.lastUpdate ?? '');
	// svelte-ignore state_referenced_locally
	let source = $state<string>(data.initialState?.source ?? 'unknown');

	// Registre des statuts précédents pour la détection fine des transitions UP → DOWN
	// svelte-ignore state_referenced_locally
	let previousStatuses = $state<Record<string, ProbeStatus>>(
		data.initialState?.probes
			? Object.fromEntries(data.initialState.probes.map((p) => [p.id, p.status]))
			: {}
	);

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
			isMobile
		})
	);

	// 3. ResizeObserver avec debounce 150ms pour recalculer optimalement le layout
	$effect(() => {
		if (!gridContainer) return;

		let debounceTimer: ReturnType<typeof setTimeout> | null = null;
		let isFirstMeasurement = true;

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;

			const { width, height } = entry.contentRect;
			if (width <= 0 || height <= 0) return;

			// Premier calcul immédiat sans délai pour affichage instantané
			if (isFirstMeasurement) {
				isFirstMeasurement = false;
				containerWidth = width;
				containerHeight = height;
				return;
			}

			// Debounce 150ms lors des redimensionnements utilisateur
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				containerWidth = width;
				containerHeight = height;
			}, 150);
		});

		observer.observe(gridContainer);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			observer.disconnect();
		};
	});

	// 4. Souscription SSE (Server-Sent Events) pour les flux temps réel et reconnexion au pull-to-refresh
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
				source = initialState.source;

				const initStatusMap: Record<string, ProbeStatus> = {};
				for (const p of initialState.probes) {
					initStatusMap[p.id] = p.status;
				}
				previousStatuses = initStatusMap;
			},
			(delta: DashboardDelta) => {
				// A. Détection des transitions UP → DOWN et fusion des sondes mises à jour
				if (delta.changed.length > 0) {
					let hasUpToDownTransition = false;
					const updatedPrev = { ...previousStatuses };

					const probeMap = new Map(probes.map((p) => [p.id, p]));
					for (const updated of delta.changed) {
						const oldStatus = previousStatuses[updated.id];
						if (oldStatus === 'up' && updated.status === 'down') {
							hasUpToDownTransition = true;
						}
						updatedPrev[updated.id] = updated.status;
						probeMap.set(updated.id, updated);
					}

					previousStatuses = updatedPrev;
					probes = Array.from(probeMap.values());

					// Flash visuel sur le container principal si au moins une sonde est tombée
					if (hasUpToDownTransition) {
						triggerContainerFlash();
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

	$effect(() => {
		setupSSE();

		return () => {
			if (disconnectSSE) disconnectSSE();
			if (flashTimer) clearTimeout(flashTimer);
		};
	});

	// 5. Gestion du mode TV : initialisation ?tv=1, synchronisation et détection d'inactivité (30s)
	onMount(() => {
		// Si tv=1 : appelle enterTvMode() au mount
		if ($page.url.searchParams.get('tv') === '1') {
			void enterTvMode(dashboardContainer);
		}

		// Synchronisation continue avec l'état effectif du mode TV
		const unsubTv = onTvModeChange((active) => {
			isTvActiveState = active;
			if (!active) {
				cleanTvParamFromUrl();
			}
		});

		// Détection d'inactivité : si pas de mousemove/keypress pendant 30s → auto-enter
		const cleanupInactivity = startInactivityDetection(30_000, () => {
			void enterTvMode(dashboardContainer);
		});

		// Écoute de l'événement personnalisé 'probe-detail' propagé par bullage
		const handleCustomProbeDetail = (e: Event) => {
			handleProbeDetailCustomEvent(e);
		};
		window.addEventListener('probe-detail', handleCustomProbeDetail);

		return () => {
			unsubTv();
			cleanupInactivity();
			window.removeEventListener('probe-detail', handleCustomProbeDetail);
			void exitTvMode();
		};
	});

	// Surveillance dynamique des changements de paramètre d'URL (?tv=1)
	$effect(() => {
		const shouldEnterTv = $page.url.searchParams.get('tv') === '1';
		if (shouldEnterTv && !isTvActiveState) {
			void enterTvMode(dashboardContainer);
		}
	});

	// Écouteur touche 'Escape' pour quitter le mode TV
	function handleEscapeKey(event: KeyboardEvent): void {
		if (event.key === 'Escape' && isTvMode) {
			void exitTvMode();
			cleanTvParamFromUrl();
		}
	}

	// Neutralisation des clics en mode TV (tooltips au hover uniquement, pas de clic)
	function handleClickCapture(event: MouseEvent): void {
		if (isTvMode) {
			event.preventDefault();
			event.stopPropagation();
			event.stopImmediatePropagation();
		}
	}
</script>

<svelte:window
	bind:innerWidth
	onkeydown={handleEscapeKey}
	onkeypress={handleEscapeKey}
/>

<svelte:head>
	<title>Kato Dashboard ({sortedProbes.length} sondes)</title>
</svelte:head>

<!-- Conteneur plein écran strict zéro scroll (100vw / 100vh) sur desktop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
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
	class="h-screen w-screen overflow-hidden flex flex-col transition-colors duration-500 text-white select-none {isCriticalDownRatio
		? 'bg-red-950/20'
		: 'bg-slate-950'} {containerFlashing ? 'animate-kato-border-flash' : ''} {isTvMode
		? 'animate-kato-drift tv-mode'
		: ''} {isCompactHeader
		? 'pt-8'
		: 'pt-12'} pb-8 sm:pb-10"
>
	<!-- En-tête supérieur (Header fixe) -->
	<Header {probes} {lastUpdate} compact={isCompactHeader} />

	<!-- Zone principale de la grille supervisée par ResizeObserver -->
	<main
		bind:this={gridContainer}
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
		class="flex-1 w-full h-full relative {isMobile || layout.overflows ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden'}"
	>
		<!-- Indicateur visuel Pull-to-refresh natif sur mobile -->
		{#if isMobile && (pullDistance > 0 || isRefreshing)}
			<div
				class="w-full flex items-center justify-center gap-2 py-2 text-xs font-mono bg-slate-900/95 border-b border-slate-800 transition-all duration-150 select-none shrink-0"
				style="height: {isRefreshing ? 42 : Math.max(30, pullDistance)}px;"
			>
				{#if isRefreshing}
					<LoaderCircle class="w-4 h-4 text-emerald-400 animate-spin" />
					<span class="text-slate-300">Actualisation des sondes...</span>
				{:else if pullDistance >= 50}
					<ArrowDown class="w-4 h-4 text-emerald-400 rotate-180 transition-transform duration-200" />
					<span class="text-emerald-400 font-semibold">Relâchez pour actualiser</span>
				{:else}
					<ArrowDown class="w-4 h-4 text-slate-400 transition-transform duration-200" />
					<span class="text-slate-400">Tirez pour actualiser ({pullDistance}px)</span>
				{/if}
			</div>
		{/if}

		{#if sortedProbes.length > 0}
			<ProbeGrid
				probes={sortedProbes}
				{layout}
				{previousStatuses}
				onselect={handleSelectProbe}
			/>
		{:else}
			<div class="w-full h-full flex flex-col items-center justify-center text-slate-500 font-mono text-sm">
				<span class="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></span>
				Chargement des sondes de supervision...
			</div>
		{/if}
	</main>

	<!-- Bandeau d'alertes inférieur (IncidentBar fixe) -->
	<IncidentBar {incidents} tvMode={isTvMode} />
</div>

<!-- Modal plein écran sur mobile / Panneau latéral sur desktop -->
<DetailModal
	probe={selectedProbe}
	onclose={() => (selectedProbe = null)}
/>
