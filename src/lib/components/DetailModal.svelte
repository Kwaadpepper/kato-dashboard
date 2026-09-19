<script lang="ts">
	import type { NormalizedProbe } from '$lib/types';
	import { STATUS_COLORS } from '$lib/utils/colors';
	import X from 'lucide-svelte/icons/x';
	import ExternalLink from 'lucide-svelte/icons/external-link';
	import Activity from 'lucide-svelte/icons/activity';
	import Clock from 'lucide-svelte/icons/clock';
	import Shield from 'lucide-svelte/icons/shield';
	import Server from 'lucide-svelte/icons/server';

	let {
		probe,
		onclose
	}: {
		probe: NormalizedProbe | null;
		onclose: () => void;
	} = $props();

	const color = $derived(probe ? STATUS_COLORS[probe.status] ?? STATUS_COLORS.up : STATUS_COLORS.up);

	// Gestion de la touche Échap pour refermer la vue détail
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose();
		}
	}

	function formatDuration(downSince?: string): string {
		if (!downSince) return 'récent';
		const diffSec = Math.max(0, Math.floor((Date.now() - new Date(downSince).getTime()) / 1000));
		const mins = Math.floor(diffSec / 60);
		const secs = diffSec % 60;
		if (mins > 60) {
			const hours = Math.floor(mins / 60);
			return `${hours}h ${mins % 60}m`;
		}
		return `${mins}m ${secs}s`;
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if probe}
	<!-- Overlay d'arrière-plan (fermeture au clic hors panneau) -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end transition-opacity duration-200"
		onclick={onclose}
	>
		<!-- Conteneur modal : Plein écran sur mobile (<640px), Panneau latéral (side-panel) sur Desktop -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="w-full h-full sm:max-w-md sm:h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between overflow-y-auto select-none"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-labelledby="probe-detail-title"
			tabindex="-1"
		>
			<!-- ============================================================= -->
			<!-- EN-TÊTE DE LA FICHE DÉTAILLÉE                                 -->
			<!-- ============================================================= -->
			<div>
				<div class="p-6 border-b border-slate-800 flex items-start justify-between gap-4">
					<div class="min-w-0 flex-1">
						{#if probe.group}
							<span
								class="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700 font-mono mb-2"
							>
								{probe.group}
							</span>
						{/if}
						<h2
							id="probe-detail-title"
							class="text-xl font-bold text-white truncate"
							title={probe.name}
						>
							{probe.name}
						</h2>
						{#if probe.url}
							<a
								href={probe.url}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-emerald-400 truncate mt-1.5 max-w-full transition-colors"
							>
								<span class="truncate">{probe.url}</span>
								<ExternalLink class="w-3.5 h-3.5 shrink-0" />
							</a>
						{/if}
					</div>

					<!-- Bouton Fermer (accessible au tactile) -->
					<button
						onclick={onclose}
						class="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
						aria-label="Fermer la vue détail"
					>
						<X class="w-5 h-5" />
					</button>
				</div>

				<!-- ============================================================= -->
				<!-- CORPS : STATUT, MÉTRIQUES & DISPONIBILITÉ                     -->
				<!-- ============================================================= -->
				<div class="p-6 space-y-6">
					<!-- Statut Actuel & Alerte -->
					<div>
						<span class="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2 font-sans">
							Statut Actuel
						</span>
						<div
							class="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold border {color.cardBgClass} {color.borderClass} {color.textClass}"
						>
							<span class="w-2.5 h-2.5 rounded-full {color.bgClass} shadow-xs {probe.status === 'down' ? 'animate-pulse' : ''}"></span>
							<span>{color.label}</span>
							<span class="text-xs opacity-75 font-mono uppercase">({probe.status})</span>
						</div>

						{#if probe.status === 'down' && probe.downSince}
							<div class="mt-3 p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-xs text-red-300 flex items-center gap-2">
								<Clock class="w-4 h-4 text-red-400 shrink-0" />
								<span>En panne depuis <strong>{formatDuration(probe.downSince)}</strong></span>
							</div>
						{/if}
					</div>

					<!-- Métriques de Performance (Latence & Uptime) -->
					<div class="grid grid-cols-2 gap-3">
						<!-- Latence / Response time -->
						<div class="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
							<div class="flex items-center gap-1.5 text-slate-400 text-xs mb-1.5">
								<Activity class="w-3.5 h-3.5" />
								<span>Latence</span>
							</div>
							<p class="text-2xl font-bold font-mono text-white">
								{probe.responseTime !== null ? `${probe.responseTime} ms` : '—'}
							</p>
						</div>

						<!-- Uptime 24 Heures -->
						<div class="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
							<div class="flex items-center gap-1.5 text-slate-400 text-xs mb-1.5">
								<Clock class="w-3.5 h-3.5" />
								<span>Uptime 24h</span>
							</div>
							<p class="text-2xl font-bold font-mono text-emerald-300">
								{probe.uptime24h !== null ? `${probe.uptime24h.toFixed(2)}%` : '—'}
							</p>
						</div>
					</div>

					<!-- Uptime 7 Jours & Criticité -->
					<div class="grid grid-cols-2 gap-3">
						<div class="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
							<div class="flex items-center gap-1.5 text-slate-400 text-xs mb-1.5">
								<Clock class="w-3.5 h-3.5" />
								<span>Uptime 7j</span>
							</div>
							<p class="text-lg font-bold font-mono text-slate-200">
								{probe.uptime7d !== null ? `${probe.uptime7d.toFixed(2)}%` : '—'}
							</p>
						</div>

						<div class="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
							<div class="flex items-center gap-1.5 text-slate-400 text-xs mb-1.5">
								<Shield class="w-3.5 h-3.5" />
								<span>Criticité</span>
							</div>
							<p class="text-sm font-semibold font-mono uppercase text-slate-200">
								{probe.criticality}
							</p>
						</div>
					</div>

					<!-- Métadonnées système -->
					<div class="p-4 rounded-xl bg-slate-800/20 border border-slate-800 text-xs font-mono space-y-2 text-slate-400">
						<div class="flex justify-between">
							<span>ID Sonde</span>
							<span class="text-slate-300 select-all">{probe.id}</span>
						</div>
						<div class="flex justify-between">
							<span>Source</span>
							<span class="text-slate-300">{probe.source}</span>
						</div>
						<div class="flex justify-between">
							<span>Dernier contrôle</span>
							<span class="text-slate-300">{new Date(probe.lastCheck).toLocaleTimeString()}</span>
						</div>
					</div>
				</div>
			</div>

			<!-- ============================================================= -->
			<!-- BAS DE VOLET : BOUTON FERMER                                  -->
			<!-- ============================================================= -->
			<div class="p-6 border-t border-slate-800">
				<button
					onclick={onclose}
					class="w-full py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm transition-colors cursor-pointer shadow-md"
				>
					Fermer
				</button>
			</div>
		</div>
	</div>
{/if}
