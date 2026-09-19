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
		density = 'medium',
		cellSize = 120,
		onselect
	}: {
		probe: NormalizedProbe;
		prevStatus?: ProbeStatus;
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

	// Détection des transitions d'état UP → DOWN pour déclencher le border flash de 2 secondes
	let isFlashing = $state(false);

	$effect(() => {
		if (prevStatus === 'up' && probe.status === 'down') {
			isFlashing = true;
			const timer = setTimeout(() => {
				isFlashing = false;
			}, 2000);
			return () => clearTimeout(timer);
		}
	});

	function handleClick(e: MouseEvent) {
		const customEvent = new CustomEvent('probe-detail', {
			detail: probe,
			bubbles: true,
			composed: true
		});
		(e.currentTarget as HTMLElement).dispatchEvent(customEvent);
		onselect?.(probe);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleClick(e as any);
		}
	}

	const responseTimeDisplay = $derived(
		probe.responseTime !== null ? `${probe.responseTime} ms` : '—'
	);

	const uptimeDisplay = $derived(
		probe.uptime24h !== null ? `${probe.uptime24h.toFixed(2)}%` : '—'
	);

	// Classes d'arrière-plan et de bordure pour les modes large et medium
	const cardStyleClasses = $derived(
		`${color.cardBgClass} border ${color.borderClass}`
	);

	// Classes d'arrière-plan et bordure spécifiques au mode compact (fond teinté plus sombre)
	const compactStyleClasses = $derived.by(() => {
		switch (probe.status) {
			case 'up':
				return 'bg-emerald-950/40 border-emerald-800/40';
			case 'down':
				return 'bg-red-950/50 border-red-800/60';
			case 'degraded':
				return 'bg-amber-950/40 border-amber-800/40';
			case 'paused':
				return 'bg-slate-800/40 border-slate-700/40';
			case 'pending':
				return 'bg-blue-950/40 border-blue-800/40';
			case 'maintenance':
				return 'bg-violet-950/40 border-violet-800/40';
			default:
				return 'bg-slate-900/40 border-slate-800/40';
		}
	});
</script>

{#if density === 'large'}
	<!-- ===================================================================== -->
	<!-- MODE LARGE (1-12 sondes) : Carte détaillée maximale                   -->
	<!-- ===================================================================== -->
	<div
		class="rounded-xl p-4 shadow-lg flex flex-col justify-between h-full relative overflow-hidden transition-all duration-200 select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50 {cardStyleClasses} {isDown
			? 'animate-kato-pulse'
			: ''} {isDownOver1Min ? 'kato-glow-red' : ''} {isFlashing ? 'animate-kato-border-flash' : ''}"
		title="{probe.name} ({probe.status.toUpperCase()})"
		tabindex="0"
		role="button"
		onclick={handleClick}
		onkeydown={handleKeydown}
	>
		<!-- En-tête de la carte : Nom + URL + Icône statut -->
		<div class="flex justify-between items-start gap-2 min-w-0">
			<div class="min-w-0 flex-1">
				<h3 class="text-base font-semibold text-white truncate" title={probe.name}>
					{probe.name}
				</h3>
				{#if probe.url}
					<p class="text-xs text-slate-400 font-mono truncate mt-0.5" title={probe.url}>
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
				<span class="text-[10px] text-slate-400 uppercase tracking-wider block font-sans">
					Uptime 24h
				</span>
				<span class="text-2xl font-bold font-mono tracking-tight text-white">
					{uptimeDisplay}
				</span>
			</div>
			<div class="text-right">
				<span class="text-[10px] text-slate-400 uppercase tracking-wider block font-sans">
					Latence
				</span>
				<span class="text-sm font-mono text-slate-200">
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
			: ''} {isDownOver1Min ? 'kato-glow-red' : ''} {isFlashing ? 'animate-kato-border-flash' : ''}"
		title="{probe.name} ({probe.status.toUpperCase()})"
		tabindex="0"
		role="button"
		onclick={handleClick}
		onkeydown={handleKeydown}
	>
		<!-- Ligne supérieure : Nom + Pastille -->
		<div class="flex items-center justify-between gap-2 min-w-0">
			<h3 class="text-sm font-medium text-white truncate" title={probe.name}>
				{probe.name}
			</h3>
			<span class="w-2.5 h-2.5 rounded-full shrink-0 {color.bgClass} shadow-xs"></span>
		</div>

		<!-- Ligne inférieure : Uptime + Latence -->
		<div class="mt-2 flex items-baseline justify-between gap-2">
			<span class="text-lg font-bold font-mono text-slate-100">
				{uptimeDisplay}
			</span>
			<span class="text-xs font-mono text-slate-300">
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
			: ''} {isDownOver1Min ? 'kato-glow-red' : ''} {isFlashing ? 'animate-kato-border-flash' : ''}"
		title="{probe.name} — {probe.status.toUpperCase()} ({responseTimeDisplay})"
		tabindex="0"
		role="button"
		onclick={handleClick}
		onkeydown={handleKeydown}
	>
		<!-- Bande couleur verticale plaquée à gauche -->
		<div class="w-1 h-full rounded-full absolute left-0 top-0 bottom-0 {color.bgClass}"></div>

		<!-- Nom tronqué avec padding gauche pour la bande -->
		<span class="text-xs font-medium text-white truncate pl-2" title={probe.name}>
			{probe.name}
		</span>

		<!-- Temps de réponse ou badge statut -->
		<span class="text-[11px] font-mono text-slate-300 shrink-0 ml-1.5">
			{responseTimeDisplay}
		</span>
	</div>
{/if}
