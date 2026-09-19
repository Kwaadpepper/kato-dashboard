<script lang="ts">
	import type { GridDensity, NormalizedProbe, ProbeStatus } from '$lib/types';
	import { STATUS_COLORS } from '$lib/utils/colors';
	import CircleCheck from 'lucide-svelte/icons/circle-check';
	import CircleX from 'lucide-svelte/icons/circle-x';
	import TriangleAlert from 'lucide-svelte/icons/triangle-alert';
	import CirclePause from 'lucide-svelte/icons/circle-pause';
	import LoaderCircle from 'lucide-svelte/icons/loader-circle';
	import Wrench from 'lucide-svelte/icons/wrench';

	let {
		probe,
		prevStatus,
		isFlashing = false,
		density = 'medium',
		cellSize: _cellSize = 120,
		onselect
	}: {
		probe: NormalizedProbe;
		prevStatus?: ProbeStatus;
		isFlashing?: boolean;
		density: GridDensity;
		cellSize?: number;
		onselect?: (probe: NormalizedProbe) => void;
	} = $props();

	const color = $derived(STATUS_COLORS[probe.status] ?? STATUS_COLORS.up);
	const isDown = $derived(probe.status === 'down');
	const isDownOver1Min = $derived.by(() => {
		if (!isDown) return false;
		if (probe.downSince) {
			return Date.now() - new Date(probe.downSince).getTime() > 60_000;
		}
		return false;
	});

	// Détection des transitions d'état UP → DOWN (flashing sans aucun $effect récursif)
	const shouldFlash = $derived(isFlashing || (prevStatus === 'up' && probe.status === 'down'));

	function triggerSelect(target: EventTarget | null) {
		const customEvent = new CustomEvent('probe-detail', {
			detail: probe,
			bubbles: true,
			composed: true
		});
		if (target && 'dispatchEvent' in target) {
			(target as HTMLElement).dispatchEvent(customEvent);
		}
		onselect?.(probe);
	}

	function handleClick(e: MouseEvent) {
		triggerSelect(e.currentTarget);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			triggerSelect(e.currentTarget);
		}
	}

	const responseTimeDisplay = $derived(
		probe.responseTime !== null ? `${probe.responseTime} ms` : '—'
	);

	const uptimeDisplay = $derived(
		probe.uptime24h !== null ? `${probe.uptime24h.toFixed(2)}%` : '—'
	);

	// Classes d'arrière-plan et de bordure basées sur les CSS Custom Properties pour les 3 thèmes
	const cardStyleClasses = $derived(
		`probe-card probe-card-${probe.status} border`
	);

	// Classes d'arrière-plan et bordure pour le mode compact
	const compactStyleClasses = $derived(
		`probe-card probe-card-${probe.status} border`
	);
</script>

{#if density === 'large'}
	<!-- ===================================================================== -->
	<!-- MODE LARGE (1-12 sondes) : Carte détaillée maximale                   -->
	<!-- ===================================================================== -->
	<div
		class="rounded-xl p-4 shadow-lg flex flex-col justify-between h-full relative overflow-hidden transition-all duration-200 select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50 {cardStyleClasses} {isDown
			? 'animate-kato-pulse'
			: ''} {isDownOver1Min ? 'kato-glow-red' : ''} {shouldFlash ? 'animate-kato-border-flash' : ''}"
		title="{probe.name} ({probe.status.toUpperCase()})"
		tabindex="0"
		role="button"
		aria-label="{probe.name} : {color.label}, uptime {uptimeDisplay}, latence {responseTimeDisplay}"
		onclick={handleClick}
		onkeydown={handleKeydown}
	>
		<!-- En-tête de la carte : Nom + URL + Icône statut -->
		<div class="flex justify-between items-start gap-2 min-w-0">
			<div class="min-w-0 flex-1">
				<h3 class="text-base font-semibold text-[var(--kato-text-primary)] truncate" title={probe.name}>
					{probe.name}
				</h3>
				{#if probe.url}
					<p class="text-xs text-[var(--kato-text-secondary)] font-mono truncate mt-0.5" title={probe.url}>
						{probe.url}
					</p>
				{/if}
			</div>

			<!-- Icône de statut Lucide -->
			<div class="shrink-0 flex items-center gap-1.5 mt-0.5">
				{#if probe.status === 'up'}
					<CircleCheck class="w-4 h-4 text-emerald-400" />
				{:else if probe.status === 'down'}
					<CircleX class="w-4 h-4 text-red-400" />
				{:else if probe.status === 'degraded'}
					<TriangleAlert class="w-4 h-4 text-amber-400" />
				{:else if probe.status === 'paused'}
					<CirclePause class="w-4 h-4 text-slate-400" />
				{:else if probe.status === 'pending'}
					<LoaderCircle class="w-4 h-4 text-blue-400 animate-spin" />
				{:else if probe.status === 'maintenance'}
					<Wrench class="w-4 h-4 text-violet-400" />
				{/if}
				<span class="w-2.5 h-2.5 rounded-full {color.bgClass} shadow-xs"></span>
			</div>
		</div>

		<!-- Corps / Bas de carte : Métriques Uptime & Latence -->
		<div class="mt-4 flex items-end justify-between gap-2">
			<div>
				<span class="text-[10px] text-[var(--kato-text-secondary)] uppercase tracking-wider block font-sans">
					Uptime 24h
				</span>
				<span class="text-2xl font-bold font-mono tracking-tight text-[var(--kato-text-primary)]">
					{uptimeDisplay}
				</span>
			</div>
			<div class="text-right">
				<span class="text-[10px] text-[var(--kato-text-secondary)] uppercase tracking-wider block font-sans">
					Latence
				</span>
				<span class="text-sm font-mono text-[var(--kato-text-secondary)]">
					{responseTimeDisplay}
				</span>
			</div>
		</div>
	</div>

{:else if density === 'medium'}
	<!-- ===================================================================== -->
	<!-- MODE MEDIUM (13-48 sondes) : Carte intermédiaire compacte             -->
	<!-- ===================================================================== -->
	<div
		class="rounded-lg p-3 flex flex-col justify-between h-full relative overflow-hidden shadow-md transition-all duration-200 select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50 {cardStyleClasses} {isDown
			? 'animate-kato-pulse'
			: ''} {isDownOver1Min ? 'kato-glow-red' : ''} {shouldFlash ? 'animate-kato-border-flash' : ''}"
		title="{probe.name} ({probe.status.toUpperCase()})"
		tabindex="0"
		role="button"
		aria-label="{probe.name} : {color.label}, uptime {uptimeDisplay}, latence {responseTimeDisplay}"
		onclick={handleClick}
		onkeydown={handleKeydown}
	>
		<!-- Ligne supérieure : Nom + Pastille -->
		<div class="flex items-center justify-between gap-2 min-w-0">
			<h3 class="text-sm font-medium text-[var(--kato-text-primary)] truncate" title={probe.name}>
				{probe.name}
			</h3>
			<span class="w-2.5 h-2.5 rounded-full shrink-0 {color.bgClass} shadow-xs"></span>
		</div>

		<!-- Ligne inférieure : Uptime + Latence -->
		<div class="mt-2 flex items-baseline justify-between gap-2">
			<span class="text-lg font-bold font-mono text-[var(--kato-text-primary)]">
				{uptimeDisplay}
			</span>
			<span class="text-xs font-mono text-[var(--kato-text-secondary)]">
				{responseTimeDisplay}
			</span>
		</div>
	</div>

{:else}
	<!-- ===================================================================== -->
	<!-- MODE COMPACT (49-120 sondes) : Cellule ultra-synthétique en ligne     -->
	<!-- ===================================================================== -->
	<div
		class="rounded-md p-2 relative flex items-center justify-between h-full overflow-hidden border shadow-xs transition-all duration-200 select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50 {compactStyleClasses} {isDown
			? 'animate-kato-pulse'
			: ''} {isDownOver1Min ? 'kato-glow-red' : ''} {shouldFlash ? 'animate-kato-border-flash' : ''}"
		title="{probe.name} — {probe.status.toUpperCase()} ({responseTimeDisplay})"
		tabindex="0"
		role="button"
		aria-label="{probe.name} : {color.label}, latence {responseTimeDisplay}"
		onclick={handleClick}
		onkeydown={handleKeydown}
	>
		<!-- Bande couleur verticale plaquée à gauche -->
		<div class="w-1 h-full rounded-full absolute left-0 top-0 bottom-0 {color.bgClass}"></div>

		<!-- Nom tronqué avec padding gauche pour la bande -->
		<span class="text-xs font-medium text-[var(--kato-text-primary)] truncate pl-2" title={probe.name}>
			{probe.name}
		</span>

		<!-- Temps de réponse ou badge statut -->
		<span class="text-[11px] font-mono text-[var(--kato-text-secondary)] shrink-0 ml-1.5">
			{responseTimeDisplay}
		</span>
	</div>
{/if}
