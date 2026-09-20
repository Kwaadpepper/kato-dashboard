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
	let drawerNow = $state(Date.now());

	// File d'attente FIFO et gestionnaire d'isolation de performance
	// svelte-ignore state_referenced_locally
	const queueManager = createIncidentQueue(incidents, tvMode, getLocale());
	let queueState = $state<IncidentQueueState>(queueManager.getState());

	onMount(() => {
		// Abonnement à la vitesse limite de défilement
		const unsubMarquee = onMarqueeChange((config) => {
			marqueeDuration = config.duration;
		});

		// Abonnement aux changements de langue
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

	// Synchronise les incidents entrants dans la file avant le rendu DOM (même batch, pas de microtask cascade)
	$effect.pre(() => {
		queueManager.setIncidents(incidents, tvMode);
		queueState = queueManager.getState();
	});

	// Rafraîchit l'horodatage uniquement dans le tiroir mobile déplié
	$effect(() => {
		if (!isExpanded || tvMode) return;
		const timer = setInterval(() => {
			drawerNow = Date.now();
		}, 2000);
		return () => clearInterval(timer);
	});

	// Répète les éléments pour garantir une continuité parfaite sans trou visuel sur tout écran
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
		// Déclenché à la fin de chaque cycle (translation 0% -> -50%)
		// Le lot a défilé jusqu'au bout : on applique les nouveaux événements de la file
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
	<!-- CAS NOMINAL : Aucun incident actif                                    -->
	<!-- Isolation stricte : aucun recalcul layout sur le reste du dashboard   -->
	<!-- ===================================================================== -->
	<footer
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
	<!-- CAS CRITIQUE : Incidents en cours                                     -->
	<!-- File d'attente FIFO + GPU Compositor thread pour 60fps stable         -->
	<!-- ===================================================================== -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<footer
		class="fixed bottom-0 left-0 right-0 z-40 bg-red-950 border-t border-red-800/60 flex flex-col text-red-200 select-none transition-[max-height] duration-200 shadow-2xl {isExpanded ? 'max-h-80' : 'h-8 sm:h-10'}"
		role="alert"
		aria-live="assertive"
		style="contain: layout paint; transform: translate3d(0, 0, 0);"
	>
		<!-- Barre principale : clic pour étendre sur mobile -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="h-8 sm:h-10 w-full flex items-center px-3 sm:px-4 cursor-pointer sm:cursor-default shrink-0 overflow-hidden"
			onclick={toggleExpand}
		>
			<!-- Compteur d'alertes ancré à gauche avec nombre d'incidents actifs réels -->
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

			<!-- Zone d'affichage : défilement continu infini sans accroc (0% -> -50% GPU) -->
			<div class="flex-1 overflow-hidden relative" style="contain: layout paint; transform: translate3d(0, 0, 0);">
				<div
					class={tvMode
						? 'animate-kato-marquee flex items-center will-change-transform'
						: 'flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar'}
					style="--kato-marquee-duration: {marqueeDuration}s;"
					onanimationiteration={handleAnimationIteration}
				>
					<!-- Bloc 1 : premier lot continu -->
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

					<!-- Bloc 2 : duplication exacte pour boucle infinie transparente à 60fps (en TV) -->
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

			<!-- Indicateur Chevron sur mobile (pour déplier / replier) -->
			{#if !tvMode}
				<button
					type="button"
					onclick={(e) => {
						e.stopPropagation();
						toggleExpand();
					}}
					class="sm:hidden p-1 text-red-300 hover:text-white shrink-0 ml-2"
					aria-label={isExpanded ? t('incidentBar.collapseAria') : t('incidentBar.expandAria')}
				>
					{#if isExpanded}
						<ChevronDown class="w-4 h-4" />
					{:else}
						<ChevronUp class="w-4 h-4" />
					{/if}
				</button>
			{/if}
		</div>

		<!-- Liste déroulante des incidents quand déplié sur mobile -->
		{#if isExpanded && !tvMode}
			<div class="border-t border-red-900/60 bg-red-950/95 overflow-y-auto max-h-64 p-3 space-y-2 divide-y divide-red-900/40">
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
