<script lang="ts">
	import type { PageData } from './$types';
	import type { NormalizedProbe, NormalizedIncident, DashboardDelta, GridLayout } from '$lib/types';
	import { connectSSE } from '$lib/utils/sse-client';
	import { calculateGrid, HEADER_HEIGHT, INCIDENT_BAR_HEIGHT } from '$lib/utils/grid-calculator';
	import { sortProbesSmart } from '$lib/utils/sort';
	import Header from '$lib/components/Header.svelte';
	import ProbeGrid from '$lib/components/ProbeGrid.svelte';
	import IncidentBar from '$lib/components/IncidentBar.svelte';

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally
	let probes = $state<NormalizedProbe[]>(data.initialState?.probes ? [...data.initialState.probes] : []);
	// svelte-ignore state_referenced_locally
	let incidents = $state<NormalizedIncident[]>(data.initialState?.incidents ? [...data.initialState.incidents] : []);
	// svelte-ignore state_referenced_locally
	let lastUpdate = $state<string>(data.initialState?.lastUpdate ?? '');
	// svelte-ignore state_referenced_locally
	let source = $state<string>(data.initialState?.source ?? 'unknown');

	// Conteneur DOM de la grille pour le ResizeObserver
	let gridContainer: HTMLElement | null = $state(null);
	let containerWidth = $state<number>(1920);
	let containerHeight = $state<number>(992);

	// Détection rudimentaire du mode mobile pour garantir l'accessibilité tactile (cellules ≥ 44px)
	const isMobile = $derived.by(() => {
		if (typeof window === 'undefined') return false;
		return window.innerWidth < 768 || ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
	});

	// Détection du mode TV via le paramètre d'URL (?tv=1)
	const isTvMode = $derived.by(() => {
		if (typeof window === 'undefined') return false;
		return new URLSearchParams(window.location.search).get('tv') === '1';
	});

	// Mode compact activé en mode TV ou si le parc comporte plus de 100 sondes
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

	// 4. Souscription SSE (Server-Sent Events) pour les flux temps réel
	$effect(() => {
		const disconnect = connectSSE(
			(initialState) => {
				probes = [...initialState.probes];
				incidents = [...initialState.incidents];
				lastUpdate = initialState.lastUpdate;
				source = initialState.source;
			},
			(delta: DashboardDelta) => {
				// A. Fusion des sondes mises à jour
				if (delta.changed.length > 0) {
					const probeMap = new Map(probes.map((p) => [p.id, p]));
					for (const updated of delta.changed) {
						probeMap.set(updated.id, updated);
					}
					probes = Array.from(probeMap.values());
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

		return () => {
			disconnect();
		};
	});
</script>

<svelte:head>
	<title>Kato Dashboard ({sortedProbes.length} sondes)</title>
</svelte:head>

<!-- Conteneur plein écran strict zéro scroll (100vw / 100vh) -->
<div
	class="h-screen w-screen overflow-hidden flex flex-col bg-slate-950 text-white select-none {isCompactHeader
		? 'pt-8'
		: 'pt-12'} pb-10"
>
	<!-- En-tête supérieur (Header fixe) -->
	<Header {probes} {lastUpdate} compact={isCompactHeader} />

	<!-- Zone principale de la grille supervisée par ResizeObserver -->
	<main
		bind:this={gridContainer}
		class="flex-1 w-full h-full relative {layout.overflows ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden'}"
	>
		{#if sortedProbes.length > 0}
			<ProbeGrid probes={sortedProbes} {layout} />
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
