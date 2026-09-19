<script lang="ts">
	import type { GridDensity, NormalizedProbe, ProbeStatus } from '$lib/types';
	import { STATUS_COLORS, getStatusLabel } from '$lib/utils/colors';
	import { cleanDisplayUrl } from '$lib/utils/url-cleaner';
	import {
		t as translate,
		getLocale,
		onLocaleChange,
		type SupportedLocale,
		type TranslationKey
	} from '$lib/i18n';
	import CircleCheck from 'lucide-svelte/icons/circle-check';
	import CircleX from 'lucide-svelte/icons/circle-x';
	import TriangleAlert from 'lucide-svelte/icons/triangle-alert';
	import CirclePause from 'lucide-svelte/icons/circle-pause';
	import LoaderCircle from 'lucide-svelte/icons/loader-circle';
	import Wrench from 'lucide-svelte/icons/wrench';
	import { onMount } from 'svelte';

	let {
		probe,
		prevStatus,
		isFlashing = false,
		density = 'medium',
		cellSize: _cellSize = 120,
		tabIndex = 0,
		onselect,
		oncellfocus
	}: {
		probe: NormalizedProbe;
		prevStatus?: ProbeStatus;
		isFlashing?: boolean;
		density: GridDensity;
		cellSize?: number;
		tabIndex?: number;
		onselect?: (probe: NormalizedProbe) => void;
		oncellfocus?: () => void;
	} = $props();

	let activeLocale = $state<SupportedLocale>(getLocale());
	const t = (key: TranslationKey | string, params?: Record<string, string | number>) =>
		translate(key, params, activeLocale);

	onMount(() => onLocaleChange((loc) => (activeLocale = loc)));

	const color = $derived(STATUS_COLORS[probe.status] ?? STATUS_COLORS.up);
	const statusLabel = $derived(getStatusLabel(probe.status, activeLocale));
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

	const displayUrl = $derived(cleanDisplayUrl(probe.url));

	// Classes d'arrière-plan et de bordure basées sur les CSS Custom Properties pour les 3 thèmes
	const cardStyleClasses = $derived(`probe-card probe-card-${probe.status} border`);

	// Classes d'arrière-plan et bordure pour le mode compact
	const compactStyleClasses = $derived(`probe-card probe-card-${probe.status} border`);
</script>

{#if density === 'large'}
	<!-- ===================================================================== -->
	<!-- MODE LARGE (1-12 sondes) : Carte détaillée structurée en 3 zones      -->
	<!-- ===================================================================== -->
	<div
		id={`probe-cell-${probe.id}`}
		class="w-full h-full rounded-xl p-3.5 sm:p-4 shadow-lg flex flex-col justify-between relative overflow-hidden select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kato-focus-ring)] focus-visible:ring-offset-2 {cardStyleClasses} {isDown
			? 'animate-kato-pulse'
			: ''} {isDownOver1Min ? 'kato-glow-red' : ''} {shouldFlash
			? 'animate-kato-border-flash'
			: ''}"
		title="{probe.name} ({probe.status.toUpperCase()})"
		tabindex={tabIndex}
		role="button"
		aria-label={t('probe.cellAria', {
			name: probe.name,
			status: statusLabel,
			uptime: uptimeDisplay,
			latency: responseTimeDisplay
		})}
		onclick={handleClick}
		onkeydown={handleKeydown}
		onfocus={oncellfocus}
	>
		<!-- Zone 1 : En-tête (URL épurée à gauche + Indicateur statut unique à droite) -->
		<div class="flex justify-between items-center gap-2 min-w-0">
			{#if displayUrl}
				<span
					class="text-[11px] text-[var(--kato-text-secondary)] font-mono truncate max-w-[75%]"
					title={probe.url}
				>
					{displayUrl}
				</span>
			{:else}
				<span></span>
			{/if}

			<!-- Indicateur statut unique sans doublon -->
			<div class="shrink-0 flex items-center" aria-hidden="true">
				{#if probe.status === 'up'}
					<CircleCheck class="w-4 h-4 text-emerald-400" />
				{:else if probe.status === 'down'}
					<CircleX class="w-4 h-4 text-red-400 animate-pulse" />
				{:else if probe.status === 'degraded'}
					<TriangleAlert class="w-4 h-4 text-amber-400" />
				{:else if probe.status === 'paused'}
					<CirclePause class="w-4 h-4 text-slate-400" />
				{:else if probe.status === 'pending'}
					<LoaderCircle class="w-4 h-4 text-blue-400 animate-spin" />
				{:else if probe.status === 'maintenance'}
					<Wrench class="w-4 h-4 text-violet-400" />
				{/if}
			</div>
		</div>

		<!-- Zone 2 : Cœur / Centre (Nom du service mis en valeur sur 2 à 3 lignes) -->
		<div class="my-auto py-2 flex items-center">
			<h2
				class="font-semibold text-[var(--kato-text-primary)] line-clamp-3 break-words"
				style="font-size: clamp(0.95rem, 5.5cqi, 1.4rem); line-height: 1.25;"
				title={probe.name}
			>
				{probe.name}
			</h2>
		</div>

		<!-- Zone 3 : Pied de carte (Mini-pills Uptime 24h & Latence) -->
		<div class="flex items-center justify-between gap-1.5 pt-1">
			<div class="kato-pill">
				<span class="kato-pill-label">{t('probe.uptime24h')}</span>
				<span class="kato-pill-value text-xs sm:text-sm">{uptimeDisplay}</span>
			</div>
			<div class="kato-pill">
				<span class="kato-pill-label">{t('probe.latency')}</span>
				<span class="kato-pill-value text-xs sm:text-sm">{responseTimeDisplay}</span>
			</div>
		</div>
	</div>

{:else if density === 'medium'}
	<!-- ===================================================================== -->
	<!-- MODE MEDIUM (13-48 sondes) : Carte intermédiaire compacte en 3 zones  -->
	<!-- ===================================================================== -->
	<div
		id={`probe-cell-${probe.id}`}
		class="w-full h-full rounded-lg p-2.5 sm:p-3 flex flex-col justify-between relative overflow-hidden shadow-md select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kato-focus-ring)] focus-visible:ring-offset-2 {cardStyleClasses} {isDown
			? 'animate-kato-pulse'
			: ''} {isDownOver1Min ? 'kato-glow-red' : ''} {shouldFlash
			? 'animate-kato-border-flash'
			: ''}"
		title="{probe.name} ({probe.status.toUpperCase()})"
		tabindex={tabIndex}
		role="button"
		aria-label={t('probe.cellAria', {
			name: probe.name,
			status: statusLabel,
			uptime: uptimeDisplay,
			latency: responseTimeDisplay
		})}
		onclick={handleClick}
		onkeydown={handleKeydown}
		onfocus={oncellfocus}
	>
		<!-- Zone 1 : En-tête (Indicateur statut unique) -->
		<div class="flex items-center justify-end min-w-0">
			<span class="w-2.5 h-2.5 rounded-full shrink-0 {color.bgClass} shadow-xs" aria-hidden="true"></span>
		</div>

		<!-- Zone 2 : Cœur / Centre (Nom sur 2 lignes) -->
		<div class="my-auto py-1 flex items-center">
			<h2
				class="font-medium text-[var(--kato-text-primary)] line-clamp-2 break-words"
				style="font-size: clamp(0.78rem, 5.2cqi, 1.05rem); line-height: 1.25;"
				title={probe.name}
			>
				{probe.name}
			</h2>
		</div>

		<!-- Zone 3 : Pied de carte (Mini-pills Uptime + Latence) -->
		<div class="flex items-center justify-between gap-1 w-full pt-1">
			<div class="kato-pill text-[11px] py-0.5 px-1.5">
				<span class="kato-pill-label text-[9px]">{t('probe.uptime24h')}</span>
				<span class="kato-pill-value text-[11px] sm:text-xs">{uptimeDisplay}</span>
			</div>
			<div class="kato-pill text-[11px] py-0.5 px-1.5">
				<span class="kato-pill-value text-[11px] sm:text-xs">{responseTimeDisplay}</span>
			</div>
		</div>
	</div>

{:else}
	<!-- ===================================================================== -->
	<!-- MODE COMPACT (49-120 sondes) : Cellule verticale empilée              -->
	<!-- ===================================================================== -->
	<div
		id={`probe-cell-${probe.id}`}
		class="w-full h-full rounded-md p-2 relative flex flex-col justify-between overflow-hidden border shadow-xs select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kato-focus-ring)] focus-visible:ring-offset-2 {compactStyleClasses} {isDown
			? 'animate-kato-pulse'
			: ''} {isDownOver1Min ? 'kato-glow-red' : ''} {shouldFlash
			? 'animate-kato-border-flash'
			: ''}"
		title="{probe.name} — {probe.status.toUpperCase()} ({responseTimeDisplay})"
		tabindex={tabIndex}
		role="button"
		aria-label="{probe.name} : {statusLabel}, {t('probe.latency').toLowerCase()} {responseTimeDisplay}"
		onclick={handleClick}
		onkeydown={handleKeydown}
		onfocus={oncellfocus}
	>
		<!-- Zone 1 : En-tête (Indicateur statut dans le coin supérieur) -->
		<div class="flex items-center justify-end w-full">
			<span class="w-2 h-2 rounded-full shrink-0 {color.bgClass} shadow-xs" aria-hidden="true"></span>
		</div>

		<!-- Zone 2 : Cœur / Centre (Nom sur 2 lignes centré) -->
		<div class="my-auto py-0.5 flex items-center justify-center text-center px-0.5">
			<h2
				class="font-medium text-[var(--kato-text-primary)] line-clamp-2 break-words text-center"
				style="font-size: clamp(0.68rem, 5cqi, 0.85rem); line-height: 1.15;"
				title={probe.name}
			>
				{probe.name}
			</h2>
		</div>

		<!-- Zone 3 : Pied de carte (Latence en mono centrée) -->
		<div class="flex items-center justify-center w-full">
			<span class="text-[10px] sm:text-[11px] font-mono text-[var(--kato-text-secondary)]">
				{responseTimeDisplay}
			</span>
		</div>
	</div>
{/if}
