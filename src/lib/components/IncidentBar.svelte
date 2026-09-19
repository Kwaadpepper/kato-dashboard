<script lang="ts">
	import type { NormalizedIncident } from '$lib/types';

	let {
		incidents = [],
		tvMode = false
	}: {
		incidents: NormalizedIncident[];
		tvMode?: boolean;
	} = $props();

	let now = $state(Date.now());

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
</script>

{#if activeIncidents.length === 0}
	<!-- ===================================================================== -->
	<!-- CAS NOMINAL : Aucun incident actif                                    -->
	<!-- ===================================================================== -->
	<footer
		class="fixed bottom-0 left-0 right-0 z-40 h-10 bg-slate-900/90 border-t border-slate-700/50 flex items-center justify-center select-none"
		role="status"
		aria-live="polite"
	>
		<span class="text-slate-400 text-sm font-medium flex items-center gap-2">
			<span class="w-2 h-2 rounded-full bg-emerald-500"></span>
			✓ Aucun incident actif
		</span>
	</footer>
{:else}
	<!-- ===================================================================== -->
	<!-- CAS CRITIQUE : Incidents en cours                                     -->
	<!-- ===================================================================== -->
	<footer
		class="fixed bottom-0 left-0 right-0 z-40 h-10 bg-red-950/80 border-t border-red-800/60 backdrop-blur-sm overflow-hidden flex items-center px-4 text-red-200 select-none"
		role="alert"
		aria-live="assertive"
	>
		<!-- Compteur d'alertes ancré à gauche -->
		<div
			class="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-red-300 shrink-0 pr-4 border-r border-red-800/60 mr-4"
		>
			<span class="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
			Incidents ({activeIncidents.length})
		</div>

		<!-- Zone d'affichage : défilement continu en TV, scroll horizontal en desktop -->
		<div class="flex-1 overflow-hidden">
			<div
				class={tvMode
					? 'animate-marquee flex items-center gap-8'
					: 'flex items-center gap-6 overflow-x-auto no-scrollbar'}
			>
				{#each activeIncidents as incident (incident.id)}
					<div class="flex items-center gap-2 shrink-0 text-sm text-red-200 font-mono">
						<span class="w-2 h-2 rounded-full bg-red-400 shrink-0 animate-pulse"></span>
						<span class="font-bold text-white">{incident.probeName}</span>
						<span class="text-xs text-red-300">
							{incident.type === 'down' ? 'DOWN' : 'DEGRADED'} depuis {formatDuration(
								incident.startedAt,
								now
							)}
						</span>
					</div>
				{/each}
			</div>
		</div>
	</footer>
{/if}
