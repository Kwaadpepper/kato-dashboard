<script lang="ts">
	import type { NormalizedProbe } from '$lib/types';
	import { applyTheme, onThemeChange, type Theme } from '$lib/utils/theme';
	import { toggleSound, onSoundChange } from '$lib/utils/sounds';
	import Settings from 'lucide-svelte/icons/settings';
	import Check from 'lucide-svelte/icons/check';
	import Volume2 from 'lucide-svelte/icons/volume-2';
	import VolumeX from 'lucide-svelte/icons/volume-x';
	import Grid2x2 from 'lucide-svelte/icons/grid-2x2';
	import Smartphone from 'lucide-svelte/icons/smartphone';

	let {
		probes = [],
		lastUpdate = '',
		compact = false,
		connectionStatus = 'connected',
		isMobile = false,
		forceZeroScroll = true,
		ontoggleZeroScroll
	}: {
		probes: NormalizedProbe[];
		lastUpdate?: string;
		compact?: boolean;
		connectionStatus?: 'connected' | 'disconnected' | 'reconnecting';
		isMobile?: boolean;
		forceZeroScroll?: boolean;
		ontoggleZeroScroll?: () => void;
	} = $props();

	import {
		onMarqueeChange,
		setMarqueeSpeed,
		setMarqueeDuration,
		MARQUEE_SPEED_PRESETS,
		type MarqueeSpeed
	} from '$lib/utils/marquee';

	let currentTime = $state('00:00:00');
	let now = $state(Date.now());
	let isSettingsOpen = $state(false);
	let activeTheme = $state<Theme>('dark');
	let isSoundOn = $state(false);
	let currentMarqueeSpeed = $state<MarqueeSpeed>('slow');
	let currentMarqueeDuration = $state(60);

	// Abonnements aux bascules de thème, de son et de vitesse de défilement
	$effect(() => {
		const unsubscribe = onThemeChange((theme) => {
			activeTheme = theme;
		});
		const unsubSound = onSoundChange((enabled) => {
			isSoundOn = enabled;
		});
		const unsubMarquee = onMarqueeChange((cfg) => {
			currentMarqueeSpeed = cfg.speed;
			currentMarqueeDuration = cfg.duration;
		});
		return () => {
			unsubscribe();
			unsubSound();
			unsubMarquee();
		};
	});

	function handleToggleSound() {
		isSoundOn = toggleSound();
	}

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
		if (upRatio > 95) return 'var(--status-up-text)';
		if (upRatio > 80) return 'var(--status-degraded-text)';
		return 'var(--status-down-text)';
	});

	// Temps écoulé en secondes depuis lastUpdate
	const freshnessSeconds = $derived.by(() => {
		if (!lastUpdate) return 0;
		const updateMs = new Date(lastUpdate).getTime();
		return Math.max(0, Math.floor((now - updateMs) / 1000));
	});

	// Indicateur de fraîcheur : passe immédiatement en rouge si déconnecté ou > 60s
	const isFreshnessRed = $derived(connectionStatus !== 'connected' || freshnessSeconds >= 60);

	const freshnessClass = $derived.by(() => {
		if (isFreshnessRed) {
			return 'freshness-indicator-red font-bold animate-pulse';
		}
		if (freshnessSeconds < 30) {
			return 'freshness-indicator-green';
		}
		return 'freshness-indicator-amber';
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
				: 'text-sm sm:text-base'} {upRatio <= 80 ? 'animate-pulse' : ''}"
			style="color: {scoreColor};"
			aria-label="{countUp} sur {total} sondes opérationnelles"
		>
			{countUp}/{total} UP
		</span>

		<!-- Badges Compteurs : masqués en-dessous de 480px, réduits entre 480px et 768px -->
		<div
			class="hidden min-[480px]:flex items-center gap-1 sm:gap-1.5 flex-wrap"
			role="group"
			aria-label="Compteurs de sondes par statut"
		>
			<!-- UP (vert) -->
			{#if !compact || countUp > 0}
				<span
					class="status-badge-up flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium font-mono shrink-0"
					title="Sondes opérationnelles ({countUp})"
					aria-label="{countUp} sondes opérationnelles"
				>
					<span class="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true"></span>
					<span>{countUp}</span>
				</span>
			{/if}

			<!-- DEGRADED (ambre) -->
			{#if !compact || countDegraded > 0}
				<span
					class="status-badge-degraded flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium font-mono shrink-0"
					title="Sondes dégradées ({countDegraded})"
					aria-label="{countDegraded} sondes dégradées"
				>
					<span class="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true"></span>
					<span>{countDegraded}</span>
				</span>
			{/if}

			<!-- DOWN (rouge) -->
			{#if !compact || countDown > 0}
				<span
					class="status-badge-down flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium font-mono shrink-0 {countDown >
					0
						? 'animate-pulse'
						: ''}"
					title="Sondes en panne ({countDown})"
					aria-label="{countDown} sondes en panne"
				>
					<span class="w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden="true"></span>
					<span>{countDown}</span>
				</span>
			{/if}

			<!-- PAUSED (gris) -->
			{#if !compact || countPaused > 0}
				<span
					class="status-badge-paused flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium font-mono shrink-0"
					title="Sondes en pause ({countPaused})"
					aria-label="{countPaused} sondes en pause"
				>
					<span class="w-1.5 h-1.5 rounded-full bg-slate-400" aria-hidden="true"></span>
					<span>{countPaused}</span>
				</span>
			{/if}

			<!-- PENDING (bleu) -->
			{#if countPending > 0}
				<span
					class="status-badge-pending flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium font-mono shrink-0"
					title="Sondes en attente ({countPending})"
					aria-label="{countPending} sondes en attente"
				>
					<span class="w-1.5 h-1.5 rounded-full bg-blue-500" aria-hidden="true"></span>
					<span>{countPending}</span>
				</span>
			{/if}

			<!-- MAINTENANCE (violet) -->
			{#if countMaintenance > 0}
				<span
					class="status-badge-maintenance flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium font-mono shrink-0"
					title="Sondes en maintenance ({countMaintenance})"
					aria-label="{countMaintenance} sondes en maintenance"
				>
					<span class="w-1.5 h-1.5 rounded-full bg-violet-500" aria-hidden="true"></span>
					<span>{countMaintenance}</span>
				</span>
			{/if}
		</div>
	</div>

	<!-- Spacer -->
	<div class="flex-1"></div>

	<!-- Section droite : Horloge, Fraîcheur et Paramètres de Thème -->
	<div class="flex items-center gap-2 sm:gap-3 shrink-0">
		<!-- Horloge : format HH:MM sur mobile (<768px), HH:MM:SS sur desktop -->
		<span class="text-[var(--kato-text-secondary)] font-mono text-xs sm:text-sm" aria-label="Horloge locale : {currentTime}">
			<span class="inline md:hidden">{currentTime.slice(0, 5)}</span>
			<span class="hidden md:inline">{currentTime}</span>
		</span>

		<!-- Indicateur de fraîcheur : visible en mode standard, en mode TV et systématiquement si déconnecté ou alerte -->
		{#if !compact || isFreshnessRed}
			<span
				class="{connectionStatus !== 'connected' ? 'flex' : 'hidden min-[480px]:flex'} font-mono text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-md border items-center gap-1 shrink-0 {freshnessClass}"
				title={connectionStatus !== 'connected'
					? 'Connexion perdue avec le serveur SSE'
					: 'Délai depuis la dernière réception de données'}
				aria-label={connectionStatus !== 'connected'
					? `Connexion perdue. Données reçues il y a ${freshnessSeconds} secondes`
					: `Dernière mise à jour reçue il y a ${freshnessSeconds} secondes`}
			>
				{#if connectionStatus !== 'connected'}
					<span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" aria-hidden="true"></span>
				{/if}
				↻ {freshnessSeconds}s
			</span>
		{/if}

		<!-- Bascule mode mobile : Grille Zéro-Scroll (pixels collés) / Défilement tactile (44px) -->
		{#if isMobile}
			<button
				type="button"
				onclick={ontoggleZeroScroll}
				class="p-1 rounded-md transition-colors cursor-pointer {forceZeroScroll
					? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40'
					: 'text-[var(--kato-text-secondary)] hover:text-[var(--kato-text-primary)] hover:bg-slate-800/30'}"
				title={forceZeroScroll
					? 'Mode Zéro-scroll actif (Pixels collés). Cliquer pour passer en mode tactile (44px, défilement)'
					: 'Mode tactile actif (44px, défilement). Cliquer pour passer en mode zéro-scroll (pixels collés)'}
				aria-label={forceZeroScroll
					? 'Passer en mode tactile avec défilement'
					: 'Passer en mode zéro-scroll avec pixels collés'}
			>
				{#if forceZeroScroll}
					<Grid2x2 class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
				{:else}
					<Smartphone class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
				{/if}
			</button>
		{/if}

		<!-- Mini toggle son (🔊/🔇) -->
		<button
			type="button"
			onclick={handleToggleSound}
			class="p-1 rounded-md transition-colors cursor-pointer {isSoundOn
				? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40'
				: 'text-[var(--kato-text-secondary)] hover:text-[var(--kato-text-primary)] hover:bg-slate-800/30'}"
			title={isSoundOn ? 'Désactiver les alertes sonores (Actif)' : 'Activer les alertes sonores (Coupé)'}
			aria-label={isSoundOn ? 'Désactiver les alertes sonores' : 'Activer les alertes sonores'}
		>
			{#if isSoundOn}
				<Volume2 class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
			{:else}
				<VolumeX class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
			{/if}
		</button>

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

				<!-- Dropdown sélecteur de thème et paramètres -->
				<div
					class="absolute right-0 top-full mt-2 w-56 rounded-lg bg-[var(--kato-bg-secondary)] border border-[var(--kato-border)] shadow-2xl py-1 z-50 text-xs font-sans"
				>
					<div class="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--kato-text-secondary)] border-b border-[var(--kato-border)]">
						Thème
					</div>
					{#each themeOptions as opt (opt.id)}
						<button
							type="button"
							onclick={() => {
								applyTheme(opt.id);
							}}
							class="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-slate-800/30 transition-colors cursor-pointer {activeTheme === opt.id ? 'text-emerald-400 font-medium' : 'text-[var(--kato-text-primary)]'}"
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

					<!-- Section Réglage Vitesse Limite Défilement Incidents -->
					<div class="px-3 py-1.5 mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--kato-text-secondary)] border-t border-b border-[var(--kato-border)] flex items-center justify-between">
						<span>Défilement incidents</span>
						<span class="font-mono text-emerald-400">{currentMarqueeDuration}s</span>
					</div>

					{#each Object.entries(MARQUEE_SPEED_PRESETS) as [key, preset] (key)}
						<button
							type="button"
							onclick={() => {
								setMarqueeSpeed(key as MarqueeSpeed);
							}}
							class="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-slate-800/30 transition-colors cursor-pointer {currentMarqueeSpeed === key ? 'text-emerald-400 font-medium' : 'text-[var(--kato-text-primary)]'}"
							title={preset.description}
						>
							<div class="flex items-center gap-2">
								<span>{preset.icon}</span>
								<span>{preset.label} ({preset.duration}s)</span>
							</div>
							{#if currentMarqueeSpeed === key}
								<Check class="w-3.5 h-3.5 text-emerald-400" />
							{/if}
						</button>
					{/each}

					<!-- Curseur de réglage fin de la vitesse limite -->
					<div class="px-3 py-2 border-t border-[var(--kato-border)] flex flex-col gap-1.5 bg-slate-950/20">
						<div class="flex items-center justify-between text-[11px] text-[var(--kato-text-secondary)]">
							<span>Vitesse limite :</span>
							<span class="font-mono font-bold text-[var(--kato-text-primary)]">{currentMarqueeDuration}s</span>
						</div>
						<input
							type="range"
							min="15"
							max="120"
							step="5"
							value={currentMarqueeDuration}
							oninput={(e) => {
								const val = parseInt((e.target as HTMLInputElement).value, 10);
								if (!isNaN(val)) setMarqueeDuration(val);
							}}
							class="w-full accent-emerald-500 cursor-pointer h-1.5 rounded-lg bg-slate-700"
							aria-label="Réglage de la durée du défilement des incidents"
						/>
						<div class="flex justify-between text-[9px] text-[var(--kato-text-secondary)]">
							<span>Rapide (15s)</span>
							<span>Lent (120s)</span>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
</header>
