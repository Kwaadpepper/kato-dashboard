<script lang="ts">
	import type { NormalizedProbe } from '$lib/types';
	import { applyTheme, onThemeChange, type Theme, type ResolvedTheme } from '$lib/utils/theme';
	import Settings from 'lucide-svelte/icons/settings';
	import Check from 'lucide-svelte/icons/check';

	let {
		probes = [],
		lastUpdate = '',
		compact = false
	}: {
		probes: NormalizedProbe[];
		lastUpdate?: string;
		compact?: boolean;
	} = $props();

	let currentTime = $state('00:00:00');
	let now = $state(Date.now());
	let isSettingsOpen = $state(false);
	let activeTheme = $state<Theme>('dark');
	let activeResolved = $state<ResolvedTheme>('dark');

	// Abonnements aux bascules de thème
	$effect(() => {
		const unsubscribe = onThemeChange((theme, resolved) => {
			activeTheme = theme;
			activeResolved = resolved;
		});
		return unsubscribe;
	});

	const themeOptions: Array<{ id: Theme; label: string; icon: string }> = [
		{ id: 'dark', label: 'Sombre', icon: '🌙' },
		{ id: 'light', label: 'Clair', icon: '☀️' },
		{ id: 'amoled', label: 'AMOLED', icon: '⬛' },
		{ id: 'auto', label: 'Auto (OS)', icon: '💻' }
	];

	// Horloge et indicateur de fraîcheur mis à jour chaque seconde
	$effect(() => {
		function tick() {
			const d = new Date();
			currentTime = d.toTimeString().split(' ')[0];
			now = Date.now();
		}
		tick();
		const interval = setInterval(tick, 1000);
		return () => clearInterval(interval);
	});

	const total = $derived(probes.length);
	const countUp = $derived(probes.filter((p) => p.status === 'up').length);
	const countDown = $derived(probes.filter((p) => p.status === 'down').length);
	const countDegraded = $derived(probes.filter((p) => p.status === 'degraded').length);
	const countPaused = $derived(probes.filter((p) => p.status === 'paused').length);
	const countPending = $derived(probes.filter((p) => p.status === 'pending').length);
	const countMaintenance = $derived(probes.filter((p) => p.status === 'maintenance').length);

	const upRatio = $derived(total > 0 ? (countUp / total) * 100 : 100);

	const scoreColor = $derived.by(() => {
		if (upRatio > 95) return 'text-emerald-400';
		if (upRatio > 80) return 'text-amber-400';
		return 'text-red-400 animate-pulse';
	});

	// Temps écoulé en secondes depuis lastUpdate
	const freshnessSeconds = $derived.by(() => {
		if (!lastUpdate) return 0;
		const updateMs = new Date(lastUpdate).getTime();
		return Math.max(0, Math.floor((now - updateMs) / 1000));
	});

	const freshnessColor = $derived.by(() => {
		if (freshnessSeconds < 30) {
			return 'text-emerald-400 border-emerald-900/40 bg-emerald-950/20';
		}
		if (freshnessSeconds < 60) {
			return 'text-amber-400 border-amber-900/40 bg-amber-950/20';
		}
		return 'text-red-400 border-red-900/50 bg-red-950/30 animate-pulse';
	});
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && isSettingsOpen) isSettingsOpen = false; }} />

<header
	class="fixed top-0 left-0 right-0 z-50 w-full bg-[var(--kato-bg-secondary)]/90 backdrop-blur-sm border-b border-[var(--kato-border)] flex items-center px-4 justify-between transition-colors duration-150 select-none {compact
		? 'h-8 text-xs'
		: 'h-12 text-sm'}"
>
	<div class="flex items-center gap-3 sm:gap-4 min-w-0">
		<!-- Logo KATO (masqué sur mobile <768px pour gain d'espace) -->
		<span
			class="hidden md:inline font-bold text-[var(--kato-text-primary)] tracking-wider select-none shrink-0 {compact
				? 'text-sm font-extrabold'
				: 'text-lg'}"
		>
			KATO
		</span>

		<!-- Score Global : {up}/{total} UP -->
		<span
			class="font-mono font-bold shrink-0 {compact
				? 'text-xs'
				: 'text-sm sm:text-base'} {scoreColor}"
		>
			{countUp}/{total} UP
		</span>

		<!-- Badges Compteurs : masqués en-dessous de 480px, réduits entre 480px et 768px -->
		<div class="hidden min-[480px]:flex items-center gap-1 sm:gap-1.5 flex-wrap">
			<!-- UP (vert) -->
			{#if !compact || countUp > 0}
				<span
					class="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 shrink-0"
					title="Sondes UP"
				>
					<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
					{countUp}
				</span>
			{/if}

			<!-- DEGRADED (ambre) -->
			{#if !compact || countDegraded > 0}
				<span
					class="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium font-mono bg-amber-950/60 text-amber-300 border border-amber-800/50 shrink-0"
					title="Sondes dégradées"
				>
					<span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
					{countDegraded}
				</span>
			{/if}

			<!-- DOWN (rouge) -->
			{#if !compact || countDown > 0}
				<span
					class="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium font-mono bg-red-950/60 text-red-300 border border-red-800/60 shrink-0 {countDown >
					0
						? 'animate-pulse'
						: ''}"
					title="Sondes DOWN"
				>
					<span class="w-1.5 h-1.5 rounded-full bg-red-400"></span>
					{countDown}
				</span>
			{/if}

			<!-- PAUSED (gris) -->
			{#if !compact || countPaused > 0}
				<span
					class="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium font-mono bg-slate-800/50 text-slate-300 border border-slate-700/50 shrink-0"
					title="Sondes en pause"
				>
					<span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
					{countPaused}
				</span>
			{/if}

			<!-- PENDING (bleu) -->
			{#if countPending > 0}
				<span
					class="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium font-mono bg-blue-950/60 text-blue-300 border border-blue-800/50 shrink-0"
					title="Sondes en attente"
				>
					<span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
					{countPending}
				</span>
			{/if}

			<!-- MAINTENANCE (violet) -->
			{#if countMaintenance > 0}
				<span
					class="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium font-mono bg-violet-950/60 text-violet-300 border border-violet-800/50 shrink-0"
					title="Sondes en maintenance"
				>
					<span class="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
					{countMaintenance}
				</span>
			{/if}
		</div>
	</div>

	<!-- Spacer -->
	<div class="flex-1"></div>

	<!-- Section droite : Horloge, Fraîcheur et Paramètres de Thème -->
	<div class="flex items-center gap-2 sm:gap-3 shrink-0">
		<!-- Horloge : format HH:MM sur mobile (<768px), HH:MM:SS sur desktop -->
		<span class="text-[var(--kato-text-secondary)] font-mono text-xs sm:text-sm">
			<span class="inline md:hidden">{currentTime.slice(0, 5)}</span>
			<span class="hidden md:inline">{currentTime}</span>
		</span>

		<!-- Indicateur de fraîcheur (masqué en mode compact ou mobile pour concision) -->
		{#if !compact}
			<span
				class="hidden sm:flex font-mono text-xs px-2 py-0.5 rounded-md border items-center gap-1 {freshnessColor}"
				title="Délai depuis la dernière réception de données"
			>
				↻ {freshnessSeconds}s
			</span>
		{/if}

		<!-- Bouton Menu Paramètres / Sélecteur de thème -->
		<div class="relative">
			<button
				type="button"
				onclick={() => (isSettingsOpen = !isSettingsOpen)}
				class="p-1 rounded-md text-[var(--kato-text-secondary)] hover:text-[var(--kato-text-primary)] hover:bg-slate-800/30 transition-colors cursor-pointer"
				title="Changer le thème d'affichage"
				aria-label="Sélecteur de thème"
				aria-expanded={isSettingsOpen}
			>
				<Settings class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
			</button>

			{#if isSettingsOpen}
				<!-- Overlay transparent pour fermer au clic en dehors -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="fixed inset-0 z-40" onclick={() => (isSettingsOpen = false)}></div>

				<!-- Dropdown sélecteur de thème -->
				<div
					class="absolute right-0 top-full mt-2 w-44 rounded-lg bg-[var(--kato-bg-secondary)] border border-[var(--kato-border)] shadow-2xl py-1 z-50 text-xs font-sans"
				>
					<div class="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--kato-text-secondary)] border-b border-[var(--kato-border)]">
						Thème
					</div>
					{#each themeOptions as opt}
						<button
							type="button"
							onclick={() => {
								applyTheme(opt.id);
								isSettingsOpen = false;
							}}
							class="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-800/30 transition-colors cursor-pointer {activeTheme === opt.id ? 'text-emerald-400 font-medium' : 'text-[var(--kato-text-primary)]'}"
						>
							<div class="flex items-center gap-2">
								<span>{opt.icon}</span>
								<span>{opt.label}</span>
							</div>
							{#if activeTheme === opt.id}
								<Check class="w-3.5 h-3.5 text-emerald-400" />
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</header>
