<script lang="ts">
	import type { NormalizedIncident } from '$lib/types';
	import { onMarqueeChange, getInitialMarqueeDuration } from '$lib/utils/marquee';

	let {
		incidents = [],
		tvMode = false
	}: {
		incidents: NormalizedIncident[];
		tvMode?: boolean;
	} = $props();

	let now = $state(Date.now());
	let marqueeDuration = $state(getInitialMarqueeDuration());

	// Abonnement à la vitesse limite de défilement
	$effect(() => {
		const unsubscribe = onMarqueeChange((config) => {
			marqueeDuration = config.duration;
		});
		return unsubscribe;
	});

	// Compteur temps réel rafraîchi chaque seconde pour actualiser la durée de panne
	$effect(() => {
		const timer = setInterval(() => {
			now = Date.now();
		}, 1000);
		return () => clearInterval(timer);
	});

	// Filtrage strict sur les incidents actifs (non encore résolus)
	const activeIncidents = $derived(
		incidents.filter((inc) => inc.resolvedAt === null)
	);

	/**
	 * Formate la durée écoulée depuis le déclenchement de l'incident.
	 * Ex: "2m 14s", "1h 05m 12s", "1j 3h 10m"
	 */
	function formatDuration(startedAt: string, currentMs: number): string {
		if (!startedAt) return '0s';
		const startMs = new Date(startedAt).getTime();
		const diffSec = Math.max(0, Math.floor((currentMs - startMs) / 1000));
		const days = Math.floor(diffSec / 86400);
		const hours = Math.floor((diffSec % 86400) / 3600);
		const mins = Math.floor((diffSec % 3600) / 60);
		const secs = diffSec % 60;

		if (days > 0) return `${days}j ${hours}h ${mins}m`;
		if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
		return `${mins}m ${secs}s`;
	}
	import ChevronUp from 'lucide-svelte/icons/chevron-up';
	import ChevronDown from 'lucide-svelte/icons/chevron-down';

	let isExpanded = $state(false);

	function toggleExpand() {
		if (!tvMode) {
			isExpanded = !isExpanded;
		}
	}
</script>

{#if activeIncidents.length === 0}
	<!-- ===================================================================== -->
	<!-- CAS NOMINAL : Aucun incident actif                                    -->
	<!-- ===================================================================== -->
	<footer
		class="fixed bottom-0 left-0 right-0 z-40 h-8 sm:h-10 bg-[var(--kato-bg-secondary)]/90 border-t border-[var(--kato-border)] flex items-center justify-center select-none transition-colors duration-150"
		role="status"
		aria-live="polite"
	>
		<span class="text-[var(--kato-text-secondary)] text-xs sm:text-sm font-medium flex items-center gap-2">
			<span class="w-2 h-2 rounded-full bg-emerald-500"></span>
			✓ Aucun incident actif
		</span>
	</footer>
{:else}
	<!-- ===================================================================== -->
	<!-- CAS CRITIQUE : Incidents en cours                                     -->
	<!-- ===================================================================== -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<footer
		class="fixed bottom-0 left-0 right-0 z-40 bg-red-950/90 border-t border-red-800/60 backdrop-blur-sm flex flex-col text-red-200 select-none transition-all duration-200 shadow-2xl {isExpanded ? 'max-h-80' : 'h-8 sm:h-10'}"
		role="alert"
		aria-live="assertive"
	>
		<!-- Barre principale : tapez pour étendre sur mobile -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="h-8 sm:h-10 w-full flex items-center px-3 sm:px-4 cursor-pointer sm:cursor-default shrink-0 overflow-hidden"
			onclick={toggleExpand}
		>
			<!-- Compteur d'alertes ancré à gauche -->
			<div
				class="flex items-center gap-1.5 sm:gap-2 font-bold text-[11px] sm:text-xs uppercase tracking-wider text-red-300 shrink-0 pr-2.5 sm:pr-4 border-r border-red-800/60 mr-2 sm:mr-4"
			>
				<span class="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-500 animate-ping"></span>
				Incidents ({activeIncidents.length})
			</div>

			<!-- Zone d'affichage : défilement continu en TV, scroll horizontal en desktop -->
			<div class="flex-1 overflow-hidden">
				<div
					class={tvMode
						? 'animate-kato-marquee flex items-center gap-8'
						: 'flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar'}
					style="--kato-marquee-duration: {marqueeDuration}s;"
				>
					{#each activeIncidents as incident (incident.id)}
						<div class="flex items-center gap-1.5 sm:gap-2 shrink-0 text-xs sm:text-sm text-red-200 font-mono">
							<span class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-400 shrink-0 animate-pulse"></span>
							<span class="font-bold text-white truncate max-w-[120px] sm:max-w-none">{incident.probeName}</span>
							<span class="text-[11px] sm:text-xs text-red-300">
								{incident.type === 'down' ? 'DOWN' : 'DEGRADED'} ({formatDuration(
									incident.startedAt,
									now
								)})
							</span>
						</div>
					{/each}
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
					aria-label={isExpanded ? 'Réduire les incidents' : 'Déplier les incidents'}
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
				{#each activeIncidents as incident (incident.id)}
					<div class="pt-2 first:pt-0 flex items-center justify-between gap-2 text-xs font-mono">
						<div class="flex items-center gap-2 min-w-0">
							<span class="w-2 h-2 rounded-full bg-red-400 shrink-0 animate-pulse"></span>
							<span class="font-semibold text-white truncate">{incident.probeName}</span>
						</div>
						<div class="shrink-0 flex items-center gap-2">
							<span class="px-1.5 py-0.5 rounded bg-red-900/60 text-red-200 uppercase font-bold text-[10px]">
								{incident.type}
							</span>
							<span class="text-red-300 text-[11px]">
								{formatDuration(incident.startedAt, now)}
							</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</footer>
{/if}
