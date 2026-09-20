<script lang="ts">
	import type { NormalizedIncident } from '$lib/types';
	import { onMarqueeChange, getInitialMarqueeDuration } from '$lib/utils/marquee';
	import {
		createIncidentQueue,
		formatIncidentDuration,
		type IncidentQueueState
	} from '$lib/utils/incident-queue';
	import {
		t as translate,
		getLocale,
		onLocaleChange,
		type SupportedLocale,
		type TranslationKey
	} from '$lib/i18n';
	import ChevronUp from 'lucide-svelte/icons/chevron-up';
	import ChevronDown from 'lucide-svelte/icons/chevron-down';
	import Pause from 'lucide-svelte/icons/pause';
	import Play from 'lucide-svelte/icons/play';
	import { onMount } from 'svelte';

	let {
		incidents = [],
		tvMode = false
	}: {
		incidents: NormalizedIncident[];
		tvMode?: boolean;
	} = $props();

	let activeLocale = $state<SupportedLocale>(getLocale());
	const t = (key: TranslationKey | string, params?: Record<string, string | number>) =>
		translate(key, params, activeLocale);

	let marqueeDuration = $state(getInitialMarqueeDuration());
	let isExpanded = $state(false);
	let isPaused = $state(false);
	let drawerNow = $state(Date.now());

	// FIFO queue and performance isolation manager
	// svelte-ignore state_referenced_locally
	const queueManager = createIncidentQueue(incidents, tvMode, getLocale());
	let queueState = $state<IncidentQueueState>(queueManager.getState());

	onMount(() => {
		// Subscribe to marquee speed limit
		const unsubMarquee = onMarqueeChange((config) => {
			marqueeDuration = config.duration;
		});

		// Subscribe to locale changes
		const unsubLocale = onLocaleChange((loc) => {
			activeLocale = loc;
			queueManager.setLocale(loc);
			queueState = queueManager.getState();
		});

		return () => {
			unsubMarquee();
			unsubLocale();
			queueManager.reset();
		};
	});

	// Synchronize incoming incidents into queue before DOM render (same batch, avoids microtask cascade)
	$effect.pre(() => {
		queueManager.setIncidents(incidents, tvMode);
		queueState = queueManager.getState();
	});

	// Refresh timestamp only when mobile drawer is expanded
	$effect(() => {
		if (!isExpanded || tvMode) return;
		const timer = setInterval(() => {
			drawerNow = Date.now();
		}, 2000);
		return () => clearInterval(timer);
	});

	// Repeat items to guarantee continuous loop without visual gaps on wide screens
	const marqueeItems = $derived.by(() => {
		const items = queueState.displayed;
		if (items.length === 0) return [];
		let result = [...items];
		while (result.length < 8) {
			result = [...result, ...items];
		}
		return result;
	});

	function handleAnimationIteration() {
		// Fired at completion of each cycle (translation 0% -> -50%)
		// Batch finished scrolling: apply new queued events
		queueManager.onCycleComplete();
		queueState = queueManager.getState();
	}

	function toggleExpand() {
		if (!tvMode) {
			isExpanded = !isExpanded;
		}
	}
</script>

{#if queueState.displayed.length === 0 && queueState.activeCount === 0}
	<!-- ===================================================================== -->
	<!-- NOMINAL CASE: No active incidents                                     -->
	<!-- Strict containment: no layout recalculations on the rest of dashboard -->
	<!-- ===================================================================== -->
	<footer
		id="incident-bar"
		class="fixed bottom-0 left-0 right-0 z-40 h-8 sm:h-10 bg-[var(--kato-bg-secondary)] border-t border-[var(--kato-border)] flex items-center justify-center select-none transition-colors duration-150"
		role="status"
		aria-live="polite"
		style="contain: layout paint; transform: translate3d(0, 0, 0);"
	>
		<span class="text-[var(--kato-text-secondary)] text-xs sm:text-sm font-medium flex items-center gap-2">
			<span class="w-2 h-2 rounded-full bg-emerald-500"></span>
			{t('incidentBar.noIncidents')}
		</span>
	</footer>
{:else}
	<!-- ===================================================================== -->
	<!-- CRITICAL CASE: Ongoing incidents                                      -->
	<!-- FIFO queue + GPU Compositor thread for stable 60fps marquee           -->
	<!-- ===================================================================== -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<footer
		id="incident-bar"
		class="fixed bottom-0 left-0 right-0 z-40 bg-red-950 border-t border-red-800/60 flex flex-col text-red-200 select-none transition-[max-height] duration-200 shadow-2xl {isExpanded ? 'max-h-80' : 'h-8 sm:h-10'}"
		role="alert"
		aria-live="assertive"
		style="contain: layout paint; transform: translate3d(0, 0, 0);"
	>
		<!-- Main bar: click to expand on mobile -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="h-8 sm:h-10 w-full flex items-center px-3 sm:px-4 cursor-pointer sm:cursor-default shrink-0 overflow-hidden"
			onclick={toggleExpand}
		>
			<!-- Alert counter anchored left with active count -->
			<div
				class="flex items-center gap-1.5 sm:gap-2 font-bold text-[11px] sm:text-xs uppercase tracking-wider text-red-300 shrink-0 pr-2.5 sm:pr-4 border-r border-red-800/60 mr-2 sm:mr-4"
			>
				<span class="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-500"></span>
				{t('incidentBar.incidentsCount', { count: queueState.activeCount })}
				{#if queueState.pendingCount > 0}
					<span
						class="text-[9px] px-1 py-0.2 rounded bg-amber-900/60 text-amber-300 font-mono font-semibold"
						title={t('incidentBar.inQueueTooltip')}
					>
						{t('incidentBar.inQueue', { count: queueState.pendingCount })}
					</span>
				{/if}
			</div>

			<!-- Pause / Resume button (WCAG 2.2.2) -->
			<button
				type="button"
				onclick={(e) => {
					e.stopPropagation();
					isPaused = !isPaused;
				}}
				class="p-1 rounded text-red-300 hover:text-white hover:bg-red-900/60 transition-colors mr-2 cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kato-focus-ring)]"
				title={isPaused ? t('incidentBar.resumeMarquee') : t('incidentBar.pauseMarquee')}
				aria-label={isPaused ? t('incidentBar.resumeMarquee') : t('incidentBar.pauseMarquee')}
			>
				{#if isPaused}
					<Play class="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
				{:else}
					<Pause class="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
				{/if}
			</button>

			<!-- Display area: seamless continuous infinite marquee (0% -> -50% GPU) -->
			<div class="flex-1 overflow-hidden relative" style="contain: layout paint; transform: translate3d(0, 0, 0);">
				<div
					class="{tvMode
						? 'animate-kato-marquee flex items-center will-change-transform'
						: 'flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar'} {isPaused ? 'marquee-paused' : ''}"
					style="--kato-marquee-duration: {marqueeDuration}s;"
					onanimationiteration={handleAnimationIteration}
				>
					<!-- Block 1: primary stream -->
					<div class="flex items-center gap-8 pr-8 shrink-0">
						{#each marqueeItems as incident, idx (`b1-${incident.id}-${idx}`)}
							<div class="flex items-center gap-1.5 sm:gap-2 shrink-0 text-xs sm:text-sm text-red-200 font-mono">
								<span class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-400 shrink-0"></span>
								<span class="font-bold text-white truncate max-w-[140px] sm:max-w-none">{incident.probeName}</span>
								<span class="text-[11px] sm:text-xs text-red-300">
									{incident.type === 'down' ? 'DOWN' : 'DEGRADED'} ({incident.formattedDuration})
								</span>
							</div>
						{/each}
					</div>

					<!-- Block 2: exact duplicate for seamless 60fps loop (in TV mode) -->
					{#if tvMode}
						<div class="flex items-center gap-8 pr-8 shrink-0" aria-hidden="true">
							{#each marqueeItems as incident, idx (`b2-${incident.id}-${idx}`)}
								<div class="flex items-center gap-1.5 sm:gap-2 shrink-0 text-xs sm:text-sm text-red-200 font-mono">
									<span class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-400 shrink-0"></span>
									<span class="font-bold text-white truncate max-w-[140px] sm:max-w-none">{incident.probeName}</span>
									<span class="text-[11px] sm:text-xs text-red-300">
										{incident.type === 'down' ? 'DOWN' : 'DEGRADED'} ({incident.formattedDuration})
									</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<!-- Mobile Chevron indicator (to expand / collapse) -->
			{#if !tvMode}
				<button
					type="button"
					onclick={(e) => {
						e.stopPropagation();
						toggleExpand();
					}}
					class="sm:hidden p-1 text-red-300 hover:text-white shrink-0 ml-2 cursor-pointer"
					aria-label={isExpanded ? t('incidentBar.collapseAria') : t('incidentBar.expandAria')}
					aria-expanded={isExpanded}
					aria-controls="incidents-drawer-list"
				>
					{#if isExpanded}
						<ChevronDown class="w-4 h-4" />
					{:else}
						<ChevronUp class="w-4 h-4" />
					{/if}
				</button>
			{/if}
		</div>

		<!-- Expanded incident drawer on mobile -->
		{#if isExpanded && !tvMode}
			<div id="incidents-drawer-list" class="border-t border-red-900/60 bg-red-950/95 overflow-y-auto max-h-64 p-3 space-y-2 divide-y divide-red-900/40">
				{#each incidents.filter((i) => i.resolvedAt === null) as incident (incident.id)}
					<div class="pt-2 first:pt-0 flex items-center justify-between gap-2 text-xs font-mono">
						<div class="flex items-center gap-2 min-w-0">
							<span class="w-2 h-2 rounded-full bg-red-400 shrink-0"></span>
							<span class="font-semibold text-white truncate">{incident.probeName}</span>
						</div>
						<div class="shrink-0 flex items-center gap-2">
							<span class="px-1.5 py-0.5 rounded bg-red-900/60 text-red-200 uppercase font-bold text-[10px]">
								{incident.type}
							</span>
							<span class="text-red-300 text-[11px]">
								{formatIncidentDuration(incident.startedAt, drawerNow, activeLocale)}
							</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</footer>
{/if}
