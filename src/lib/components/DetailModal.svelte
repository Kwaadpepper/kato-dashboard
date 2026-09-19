<script lang="ts">
	import type { NormalizedIncident, NormalizedProbe } from '$lib/types';
	import { STATUS_COLORS } from '$lib/utils/colors';
	import {
		build24hSlots,
		buildProbeHistoryEvents,
		computeProbeHistoryStats,
		formatDurationCompact,
		formatEventDateTime
	} from '$lib/utils/probe-history';
	import X from 'lucide-svelte/icons/x';
	import ExternalLink from 'lucide-svelte/icons/external-link';
	import Activity from 'lucide-svelte/icons/activity';
	import Clock from 'lucide-svelte/icons/clock';
	import Shield from 'lucide-svelte/icons/shield';
	import CircleCheck from 'lucide-svelte/icons/circle-check';
	import History from 'lucide-svelte/icons/history';
	import LoaderCircle from 'lucide-svelte/icons/loader-circle';

	let {
		probe,
		incidents = [],
		onclose
	}: {
		probe: NormalizedProbe | null;
		incidents?: NormalizedIncident[];
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
		return formatDurationCompact(diffSec);
	}

	let serverIncidents = $state<NormalizedIncident[] | null>(null);
	let isFetchingHistory = $state(false);
	let nowTime = $state(Date.now());

	// Rafraîchissement automatique de la pendule toutes les 5 secondes tant que la modale est affichée
	$effect(() => {
		if (!probe) return;
		const timer = setInterval(() => {
			nowTime = Date.now();
		}, 5000);
		return () => clearInterval(timer);
	});

	// Récupération optionnelle en arrière-plan des logs serveur / fournisseur
	$effect(() => {
		const targetProbeId = probe?.id;
		if (!targetProbeId) {
			serverIncidents = null;
			return;
		}

		let aborted = false;
		const controller = new AbortController();

		async function fetchHistory(id: string) {
			isFetchingHistory = true;
			try {
				const res = await fetch(`/api/probes/${encodeURIComponent(id)}/history`, {
					signal: controller.signal
				});
				if (res.ok) {
					const data = (await res.json()) as { incidents?: NormalizedIncident[] };
					if (!aborted && Array.isArray(data.incidents)) {
						serverIncidents = data.incidents;
					}
				}
			} catch {
				// Repli silencieux et immédiat sur les incidents en mémoire
			} finally {
				if (!aborted) {
					isFetchingHistory = false;
				}
			}
		}

		void fetchHistory(targetProbeId);

		return () => {
			aborted = true;
			controller.abort();
		};
	});

	// Fusion transparente des incidents locaux (SSE) et de l'historique serveur
	const mergedIncidents = $derived.by(() => {
		if (!probe) return [];
		const base = incidents.filter((i) => i.probeId === probe.id);
		if (!serverIncidents || serverIncidents.length === 0) return base;

		const map = new Map<string, NormalizedIncident>();
		for (const inc of base) map.set(inc.id, inc);
		for (const inc of serverIncidents) map.set(inc.id, inc);
		return Array.from(map.values()).sort(
			(a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
		);
	});

	// 24 créneaux horaires d'1h pour la barre
	const slots = $derived(build24hSlots(mergedIncidents, nowTime));
	// Événements d'incidents antéchronologiques
	const historyEvents = $derived(probe ? buildProbeHistoryEvents(probe, mergedIncidents, nowTime) : []);
	// Synthèse métrique sur 24h
	const historyStats = $derived(probe ? computeProbeHistoryStats(probe, mergedIncidents, nowTime) : null);

	function getSlotBgClass(status: string): string {
		switch (status) {
			case 'down':
				return 'bg-rose-500 hover:bg-rose-400';
			case 'degraded':
				return 'bg-amber-500 hover:bg-amber-400';
			case 'paused':
				return 'bg-slate-600 hover:bg-slate-500';
			case 'up':
			default:
				return 'bg-emerald-500 hover:bg-emerald-400';
		}
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

					<!-- ========================================================= -->
					<!-- NOUVELLE SECTION : HISTORIQUE RÉCENT (24H)                 -->
					<!-- ========================================================= -->
					<div class="space-y-3 pt-2">
						<div class="flex items-center justify-between">
							<span class="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-sans">
								<History class="w-3.5 h-3.5 text-slate-400" />
								<span>Historique Récent (24h)</span>
							</span>
							<div class="flex items-center gap-2">
								{#if isFetchingHistory}
									<LoaderCircle class="w-3 h-3 text-slate-400 animate-spin" />
								{/if}
								<span
									class="text-[11px] font-mono px-2 py-0.5 rounded border {historyStats && historyStats.totalIncidents > 0
										? 'bg-amber-950/50 text-amber-300 border-amber-800/40'
										: 'bg-emerald-950/50 text-emerald-300 border-emerald-800/40'}"
								>
									{historyStats && historyStats.totalIncidents > 0
										? `${historyStats.totalIncidents} coupure${historyStats.totalIncidents > 1 ? 's' : ''}`
										: '100% disponible'}
								</span>
							</div>
						</div>

						<!-- Frise temporelle horizontale de 24 créneaux (1 bloc = 1 heure) -->
						<div class="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-2.5">
							<div class="flex items-center justify-between text-[11px] font-mono text-slate-400">
								<span>Il y a 24h</span>
								<span class="text-emerald-400 font-semibold">
									{historyStats ? `${historyStats.availabilityPercentage.toFixed(2)}% dispo` : '—'}
								</span>
								<span>Maintenant</span>
							</div>

							<!-- Segments horaires avec infobulles natives au survol -->
							<div class="flex items-center gap-1 h-6 w-full py-0.5 select-none" role="img" aria-label="Disponibilité heure par heure sur 24 heures">
								{#each slots as slot (slot.index)}
									<div
										class="flex-1 h-full rounded-[1.5px] transition-transform duration-100 hover:scale-y-125 cursor-pointer {getSlotBgClass(slot.status)}"
										title="{slot.label}"
									></div>
								{/each}
							</div>

							<!-- Légende sous la barre -->
							<div class="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-800/80">
								<div class="flex items-center gap-1.5">
									<span class="w-2 h-2 rounded-xs bg-emerald-500"></span>
									<span>Opérationnel</span>
								</div>
								<div class="flex items-center gap-1.5">
									<span class="w-2 h-2 rounded-xs bg-amber-500"></span>
									<span>Dégradé</span>
								</div>
								<div class="flex items-center gap-1.5">
									<span class="w-2 h-2 rounded-xs bg-rose-500"></span>
									<span>Panne (DOWN)</span>
								</div>
							</div>
						</div>

						<!-- Mini KPIs de synthèse -->
						<div class="grid grid-cols-3 gap-2 text-center text-xs font-mono">
							<div class="p-2.5 rounded-lg bg-slate-800/30 border border-slate-700/40">
								<span class="text-[10px] uppercase text-slate-400 block font-sans">Incidents</span>
								<span class="font-bold text-sm {historyStats && historyStats.totalIncidents > 0 ? 'text-amber-400' : 'text-emerald-400'}">
									{historyStats?.totalIncidents ?? 0}
								</span>
							</div>
							<div class="p-2.5 rounded-lg bg-slate-800/30 border border-slate-700/40">
								<span class="text-[10px] uppercase text-slate-400 block font-sans">Indispo</span>
								<span class="font-bold text-sm text-slate-200">
									{formatDurationCompact(historyStats?.downtimeSeconds ?? 0)}
								</span>
							</div>
							<div class="p-2.5 rounded-lg bg-slate-800/30 border border-slate-700/40">
								<span class="text-[10px] uppercase text-slate-400 block font-sans">Séquence</span>
								<span class="font-bold text-sm text-slate-200">
									{formatDurationCompact(historyStats?.currentStreakSeconds ?? 0)}
								</span>
							</div>
						</div>

						<!-- Journal chronologique des bascules UP / DOWN -->
						<div class="rounded-xl bg-slate-800/30 border border-slate-700/50 p-3 space-y-2.5">
							<span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block font-mono">
								Journal des bascules
							</span>

							{#if historyEvents.length === 0}
								<!-- Cas nominal : 100% stable -->
								<div class="flex items-center gap-3 py-2 px-1 text-xs text-slate-300">
									<div class="w-7 h-7 rounded-full bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center shrink-0">
										<CircleCheck class="w-4 h-4 text-emerald-400" />
									</div>
									<div class="min-w-0">
										<p class="font-semibold text-emerald-300 text-xs">Aucune interruption sur les dernières 24h</p>
										<p class="text-[11px] text-slate-400">Le service est resté continuellement opérationnel.</p>
									</div>
								</div>
							{:else}
								<!-- Liste des incidents passés et en cours -->
								<div class="space-y-2 max-h-56 overflow-y-auto pr-1">
									{#each historyEvents as event (event.id)}
										<div class="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 flex items-start justify-between gap-3 text-xs font-mono">
											<div class="flex items-start gap-2.5 min-w-0 flex-1">
												<span
													class="w-2.5 h-2.5 rounded-full mt-1 shrink-0 {event.status === 'down'
														? 'bg-rose-500 shadow-xs'
														: event.status === 'degraded'
															? 'bg-amber-400'
															: 'bg-emerald-400'} {event.resolvedAt === null ? 'animate-ping' : ''}"
												></span>

												<div class="min-w-0 flex-1">
													<p class="font-bold {event.status === 'down' ? 'text-rose-300' : event.status === 'degraded' ? 'text-amber-300' : 'text-emerald-300'}">
														{#if event.resolvedAt === null}
															Panne en cours (DOWN)
														{:else if event.status === 'down'}
															Coupure (DOWN → UP)
														{:else}
															Instabilité (DEGRADED)
														{/if}
													</p>

													<p class="text-[11px] text-slate-400 mt-0.5">
														Début : {formatEventDateTime(event.timestamp, nowTime)}
													</p>

													{#if event.resolvedAt}
														<p class="text-[11px] text-emerald-400/90 mt-0.5">
															Rétabli : {formatEventDateTime(event.resolvedAt, nowTime)}
														</p>
													{/if}

													{#if event.cause}
														<p class="text-[10px] text-slate-300 font-sans mt-1 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/50 inline-block">
															{event.cause}
														</p>
													{/if}
												</div>
											</div>

											<div class="shrink-0 text-right">
												{#if event.resolvedAt === null}
													<span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 animate-pulse">
														En cours ({formatDurationCompact(event.duration ?? 0)})
													</span>
												{:else if event.duration}
													<span class="inline-block text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
														{formatDurationCompact(event.duration)}
													</span>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							{/if}
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
