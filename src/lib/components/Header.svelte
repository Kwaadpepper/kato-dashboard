<script lang="ts">
	import { onMount } from 'svelte';
	import type { NormalizedProbe } from '$lib/types';
	import { applyTheme, onThemeChange, type Theme } from '$lib/utils/theme';
	import { toggleSound, onSoundChange } from '$lib/utils/sounds';
	import Settings from 'lucide-svelte/icons/settings';
	import Check from 'lucide-svelte/icons/check';
	import Volume2 from 'lucide-svelte/icons/volume-2';
	import VolumeX from 'lucide-svelte/icons/volume-x';
	import Grid2x2 from 'lucide-svelte/icons/grid-2x2';
	import Smartphone from 'lucide-svelte/icons/smartphone';
	import Maximize from 'lucide-svelte/icons/maximize';
	import Minimize from 'lucide-svelte/icons/minimize';
	import Keyboard from 'lucide-svelte/icons/keyboard';
	import { toggleFullscreen, onFullscreenChange } from '$lib/utils/fullscreen';
	import {
		t as translate,
		onLocaleChange,
		setLocale,
		getLocale,
		LOCALE_OPTIONS,
		type SupportedLocale,
		type TranslationKey
	} from '$lib/i18n';

	let {
		probes = [],
		lastUpdate = '',
		compact = false,
		connectionStatus = 'connected',
		isMobile = false,
		forceZeroScroll = true,
		ontoggleZeroScroll,
		onopenkeyboardhelp
	}: {
		probes: NormalizedProbe[];
		lastUpdate?: string;
		compact?: boolean;
		connectionStatus?: 'connected' | 'disconnected' | 'reconnecting';
		isMobile?: boolean;
		forceZeroScroll?: boolean;
		ontoggleZeroScroll?: () => void;
		onopenkeyboardhelp?: () => void;
	} = $props();

	import {
		onMarqueeChange,
		setMarqueeSpeed,
		setMarqueeDuration,
		MARQUEE_SPEED_PRESETS,
		type MarqueeSpeed
	} from '$lib/utils/marquee';
	import {
		onClockConfigChange,
		setTimeFormat,
		setTimeZone,
		setShowSeconds,
		formatClock,
		TIME_ZONE_PRESETS,
		getTimeZoneShortLabel,
		type ClockConfig
	} from '$lib/utils/clock';

	let clockConfig = $state<ClockConfig>({
		format: '24h',
		timeZone: 'local',
		showSeconds: true
	});

	let currentTime = $state('00:00:00');
	let compactTime = $state('00:00');
	let timeZoneBadge = $state('');
	let now = $state(Date.now());
	let isSettingsOpen = $state(false);
	let settingsContainer = $state<HTMLElement | null>(null);
	let settingsButtonElement = $state<HTMLButtonElement | null>(null);

	function handleWindowClick(event: MouseEvent) {
		if (!isSettingsOpen) return;
		const target = event.target as Node | null;
		if (settingsContainer && !settingsContainer.contains(target)) {
			isSettingsOpen = false;
			event.preventDefault();
			event.stopPropagation();
		}
	}
	let activeLocale = $state<SupportedLocale>(getLocale());
	const t = (key: TranslationKey | string, params?: Record<string, string | number>) =>
		translate(key, params, activeLocale);
	let activeTheme = $state<Theme>('dark');
	let isSoundOn = $state(false);
	let isFullscreenActive = $state(false);
	let currentMarqueeSpeed = $state<MarqueeSpeed>('slow');
	let currentMarqueeDuration = $state(60);

	function updateCurrentTime() {
		const d = new Date();
		currentTime = formatClock(d, clockConfig, { locale: activeLocale });
		compactTime = formatClock(d, clockConfig, { forceNoSeconds: true, locale: activeLocale });
		timeZoneBadge = clockConfig.timeZone !== 'local' ? getTimeZoneShortLabel(clockConfig.timeZone) : '';
		now = Date.now();
	}

	// Subscriptions for theme, locale, sound, marquee, clock, and fullscreen
	onMount(() => {
		const unsubscribe = onThemeChange((theme) => {
			activeTheme = theme;
		});
		const unsubLocale = onLocaleChange((loc) => {
			activeLocale = loc;
			updateCurrentTime();
		});
		const unsubSound = onSoundChange((enabled) => {
			isSoundOn = enabled;
		});
		const unsubFullscreen = onFullscreenChange((fs) => {
			isFullscreenActive = fs;
		});
		const unsubMarquee = onMarqueeChange((cfg) => {
			currentMarqueeSpeed = cfg.speed;
			currentMarqueeDuration = cfg.duration;
		});
		const unsubClock = onClockConfigChange((cfg) => {
			clockConfig = cfg;
			updateCurrentTime();
		});

		// Clock and freshness updated every second (isolated outside $effect scheduler)
		updateCurrentTime();
		const interval = setInterval(updateCurrentTime, 1000);

		return () => {
			unsubscribe();
			unsubLocale();
			unsubSound();
			unsubFullscreen();
			unsubMarquee();
			unsubClock();
			clearInterval(interval);
		};
	});

	function handleToggleSound() {
		isSoundOn = toggleSound();
	}

	const themeOptions = $derived<Array<{ id: Theme; label: string; icon: string }>>([
		{ id: 'dark', label: t('settings.themeDark'), icon: '🌙' },
		{ id: 'light', label: t('settings.themeLight'), icon: '☀️' },
		{ id: 'amoled', label: t('settings.themeAmoled'), icon: '⬛' },
		{ id: 'auto', label: t('settings.themeAuto'), icon: '💻' }
	]);

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

	// Elapsed time in seconds since lastUpdate
	const freshnessSeconds = $derived.by(() => {
		if (!lastUpdate) return 0;
		const updateMs = new Date(lastUpdate).getTime();
		return Math.max(0, Math.floor((now - updateMs) / 1000));
	});

	// Freshness indicator: turns red immediately if disconnected or > 60s
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

<svelte:window
	onclickcapture={handleWindowClick}
	onkeydown={(e) => {
		if (e.key === 'Escape' && isSettingsOpen) {
			isSettingsOpen = false;
			settingsButtonElement?.focus();
		}
	}}
/>

<header
	class="fixed top-0 left-0 right-0 z-50 w-full bg-[var(--kato-bg-secondary)]/90 backdrop-blur-sm border-b border-[var(--kato-border)] flex items-center px-4 justify-between transition-colors duration-150 select-none {compact
		? 'h-8 text-xs'
		: 'h-12 text-sm'}"
>
	<div class="flex items-center gap-3 sm:gap-4 min-w-0">
		<!-- KATO Logo (Main h1 title, WCAG 2.1) -->
		<h1
			class="hidden md:inline font-bold text-[var(--kato-text-primary)] tracking-wider select-none shrink-0 {compact
				? 'text-sm font-extrabold'
				: 'text-lg'}"
		>
			KATO
			<span class="sr-only"> — High-density monitoring dashboard</span>
		</h1>

		<!-- Overall score: {up}/{total} UP -->
		<span
			class="font-mono font-bold shrink-0 {compact
				? 'text-xs'
				: 'text-sm sm:text-base'} {upRatio <= 80 ? 'animate-pulse' : ''}"
			style="color: {scoreColor};"
			aria-label={t('header.scoreAria', { countUp, total })}
		>
			{countUp}/{total} UP
		</span>

		<!-- Counter Badges: hidden below 480px, reduced between 480px and 768px -->
		<div
			class="hidden min-[480px]:flex items-center gap-1 sm:gap-1.5 flex-wrap"
			role="group"
			aria-label={t('header.statusCountsGroup')}
		>
			<!-- UP (green) -->
			{#if !compact || countUp > 0}
				<span
					class="status-badge-up flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium font-mono shrink-0"
					title={t('header.badgeUpTitle', { count: countUp })}
					aria-label={t('header.badgeUpAria', { count: countUp })}
				>
					<span class="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true"></span>
					<span>{countUp}</span>
				</span>
			{/if}

			<!-- DEGRADED (amber) -->
			{#if !compact || countDegraded > 0}
				<span
					class="status-badge-degraded flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium font-mono shrink-0"
					title={t('header.badgeDegradedTitle', { count: countDegraded })}
					aria-label={t('header.badgeDegradedAria', { count: countDegraded })}
				>
					<span class="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true"></span>
					<span>{countDegraded}</span>
				</span>
			{/if}

			<!-- DOWN (red) -->
			{#if !compact || countDown > 0}
				<span
					class="status-badge-down flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium font-mono shrink-0 {countDown >
					0
						? 'animate-pulse'
						: ''}"
					title={t('header.badgeDownTitle', { count: countDown })}
					aria-label={t('header.badgeDownAria', { count: countDown })}
				>
					<span class="w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden="true"></span>
					<span>{countDown}</span>
				</span>
			{/if}

			<!-- PAUSED (gray) -->
			{#if !compact || countPaused > 0}
				<span
					class="status-badge-paused flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium font-mono shrink-0"
					title={t('header.badgePausedTitle', { count: countPaused })}
					aria-label={t('header.badgePausedAria', { count: countPaused })}
				>
					<span class="w-1.5 h-1.5 rounded-full bg-slate-400" aria-hidden="true"></span>
					<span>{countPaused}</span>
				</span>
			{/if}

			<!-- PENDING (blue) -->
			{#if countPending > 0}
				<span
					class="status-badge-pending flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium font-mono shrink-0"
					title={t('header.badgePendingTitle', { count: countPending })}
					aria-label={t('header.badgePendingAria', { count: countPending })}
				>
					<span class="w-1.5 h-1.5 rounded-full bg-blue-500" aria-hidden="true"></span>
					<span>{countPending}</span>
				</span>
			{/if}

			<!-- MAINTENANCE (purple) -->
			{#if countMaintenance > 0}
				<span
					class="status-badge-maintenance flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium font-mono shrink-0"
					title={t('header.badgeMaintenanceTitle', { count: countMaintenance })}
					aria-label={t('header.badgeMaintenanceAria', { count: countMaintenance })}
				>
					<span class="w-1.5 h-1.5 rounded-full bg-violet-500" aria-hidden="true"></span>
					<span>{countMaintenance}</span>
				</span>
			{/if}
		</div>
	</div>

	<!-- Spacer -->
	<div class="flex-1"></div>

	<!-- Right section: Clock, Freshness, and Theme settings -->
	<div class="flex items-center gap-2 sm:gap-3 shrink-0">
		<!-- Clock: full format on desktop, compact on mobile -->
		<span
			class="text-[var(--kato-text-secondary)] font-mono text-xs sm:text-sm flex items-center gap-1 shrink-0"
			aria-label={t('header.clockAria', {
				format: clockConfig.format,
				timeZone: clockConfig.timeZone,
				time: currentTime
			})}
		>
			<span class="inline md:hidden">{compactTime}</span>
			<span class="hidden md:inline">{currentTime}</span>
			{#if timeZoneBadge}
				<span class="text-[9px] px-1 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold border border-slate-700/60 shrink-0">
					{timeZoneBadge}
				</span>
			{/if}
		</span>

		<!-- Freshness indicator: visible in standard mode, TV mode, and always on alert/disconnect -->
		{#if !compact || isFreshnessRed}
			<span
				class="{connectionStatus !== 'connected' ? 'flex' : 'hidden min-[480px]:flex'} font-mono text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-md border items-center gap-1 shrink-0 {freshnessClass}"
				title={connectionStatus !== 'connected'
					? t('header.freshnessLostTitle')
					: t('header.freshnessDelayTitle')}
				aria-label={connectionStatus !== 'connected'
					? t('header.freshnessLostAria', { seconds: freshnessSeconds })
					: t('header.freshnessDelayAria', { seconds: freshnessSeconds })}
			>
				{#if connectionStatus !== 'connected'}
					<span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" aria-hidden="true"></span>
				{/if}
				↻ {freshnessSeconds}s
			</span>
		{/if}

		<!-- Mobile mode toggle: Zero-Scroll Grid / Touch scroll (44px) -->
		{#if isMobile}
			<button
				type="button"
				onclick={ontoggleZeroScroll}
				class="p-1 rounded-md transition-colors cursor-pointer {forceZeroScroll
					? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40'
					: 'text-[var(--kato-text-secondary)] hover:text-[var(--kato-text-primary)] hover:bg-slate-800/30'}"
				title={forceZeroScroll
					? t('header.zeroScrollActiveTitle')
					: t('header.touchActiveTitle')}
				aria-label={forceZeroScroll
					? t('header.zeroScrollActiveAria')
					: t('header.touchActiveAria')}
			>
				{#if forceZeroScroll}
					<Grid2x2 class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
				{:else}
					<Smartphone class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
				{/if}
			</button>
		{/if}

		<!-- Sound toggle (🔊/🔇) -->
		<button
			type="button"
			onclick={handleToggleSound}
			class="p-1 rounded-md transition-colors cursor-pointer {isSoundOn
				? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40'
				: 'text-[var(--kato-text-secondary)] hover:text-[var(--kato-text-primary)] hover:bg-slate-800/30'}"
			title={isSoundOn ? t('header.soundDisableTitle') : t('header.soundEnableTitle')}
			aria-label={isSoundOn ? t('header.soundDisableAria') : t('header.soundEnableAria')}
		>
			{#if isSoundOn}
				<Volume2 class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
			{:else}
				<VolumeX class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
			{/if}
		</button>

		<!-- Fullscreen toggle -->
		<button
			type="button"
			onclick={() => void toggleFullscreen()}
			class="p-1 rounded-md transition-colors cursor-pointer {isFullscreenActive
				? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40'
				: 'text-[var(--kato-text-secondary)] hover:text-[var(--kato-text-primary)] hover:bg-slate-800/30'}"
			title={isFullscreenActive ? t('header.fullscreenExitTitle') : t('header.fullscreenEnterTitle')}
			aria-label={isFullscreenActive ? t('header.fullscreenExitAria') : t('header.fullscreenEnterAria')}
		>
			{#if isFullscreenActive}
				<Minimize class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
			{:else}
				<Maximize class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
			{/if}
		</button>

		<!-- Keyboard shortcuts button (?) -->
		<button
			type="button"
			onclick={onopenkeyboardhelp}
			class="p-1 rounded-md text-[var(--kato-text-secondary)] hover:text-[var(--kato-text-primary)] hover:bg-slate-800/30 transition-colors cursor-pointer"
			title="{t('keyboardHelp.title')} (?)"
			aria-label="{t('keyboardHelp.title')} (?)"
		>
			<Keyboard class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
		</button>

		<!-- Settings menu button / Theme selector -->
		<div class="relative" bind:this={settingsContainer}>
			<button
				bind:this={settingsButtonElement}
				type="button"
				onclick={() => (isSettingsOpen = !isSettingsOpen)}
				class="p-1 rounded-md text-[var(--kato-text-secondary)] hover:text-[var(--kato-text-primary)] hover:bg-slate-800/30 transition-colors cursor-pointer"
				title={t('header.settingsTitle')}
				aria-label={t('header.settingsAria')}
				aria-expanded={isSettingsOpen}
				aria-haspopup="dialog"
				aria-controls="settings-dropdown"
			>
				<Settings class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
			</button>

			{#if isSettingsOpen}
				<!-- Language, theme, and settings dropdown -->
				<div
					id="settings-dropdown"
					role="region"
					aria-label={t('header.settingsAria')}
					class="absolute right-0 top-full mt-2 w-60 max-h-[80vh] overflow-y-auto rounded-lg bg-[var(--kato-bg-secondary)] border border-[var(--kato-border)] shadow-2xl py-1 z-50 text-xs font-sans"
				>
					<!-- Language section -->
					<div class="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--kato-text-secondary)] border-b border-[var(--kato-border)] flex items-center justify-between">
						<span>{t('settings.sectionLanguage')}</span>
					</div>
					{#each LOCALE_OPTIONS as opt (opt.id)}
						<button
							type="button"
							onclick={() => {
								setLocale(opt.id);
							}}
							class="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-slate-800/30 transition-colors cursor-pointer {activeLocale === opt.id ? 'text-emerald-400 font-medium' : 'text-[var(--kato-text-primary)]'}"
						>
							<div class="flex items-center gap-2">
								<span>{opt.flag}</span>
								<span>{opt.label}</span>
							</div>
							{#if activeLocale === opt.id}
								<Check class="w-3.5 h-3.5 text-emerald-400" />
							{/if}
						</button>
					{/each}
					<!-- Display / Fullscreen section -->
					<div class="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--kato-text-secondary)] border-b border-[var(--kato-border)] flex items-center justify-between">
						<span>{t('settings.sectionDisplay')}</span>
					</div>
					<button
						type="button"
						onclick={() => void toggleFullscreen()}
						class="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-slate-800/30 transition-colors cursor-pointer {isFullscreenActive ? 'text-emerald-400 font-medium' : 'text-[var(--kato-text-primary)]'}"
						aria-label={isFullscreenActive ? t('header.fullscreenExitAria') : t('header.fullscreenEnterAria')}
					>
						<div class="flex items-center gap-2">
							{#if isFullscreenActive}
								<Minimize class="w-3.5 h-3.5 text-emerald-400" />
								<span>{t('settings.fullscreenActive')}</span>
							{:else}
								<Maximize class="w-3.5 h-3.5" />
								<span>{t('settings.fullscreenInactive')}</span>
							{/if}
						</div>
						{#if isFullscreenActive}
							<Check class="w-3.5 h-3.5 text-emerald-400" />
						{/if}
					</button>

					<div class="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--kato-text-secondary)] border-t border-b border-[var(--kato-border)]">
						{t('settings.sectionTheme')}
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

					<!-- Incident Marquee Speed Limit section -->
					<div class="px-3 py-1.5 mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--kato-text-secondary)] border-t border-b border-[var(--kato-border)] flex items-center justify-between">
						<span>{t('settings.sectionMarquee')}</span>
						<span class="font-mono text-emerald-400">{currentMarqueeDuration}s</span>
					</div>

					{#each Object.entries(MARQUEE_SPEED_PRESETS) as [key, preset] (key)}
						<button
							type="button"
							onclick={() => {
								setMarqueeSpeed(key as MarqueeSpeed);
							}}
							class="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-slate-800/30 transition-colors cursor-pointer {currentMarqueeSpeed === key ? 'text-emerald-400 font-medium' : 'text-[var(--kato-text-primary)]'}"
							title={key === 'slow' ? t('settings.marqueeSlowDesc') : key === 'normal' ? t('settings.marqueeNormalDesc') : t('settings.marqueeFastDesc')}
						>
							<div class="flex items-center gap-2">
								<span>{preset.icon}</span>
								<span>{key === 'slow' ? t('settings.marqueeSlow') : key === 'normal' ? t('settings.marqueeNormal') : t('settings.marqueeFast')} ({preset.duration}s)</span>
							</div>
							{#if currentMarqueeSpeed === key}
								<Check class="w-3.5 h-3.5 text-emerald-400" />
							{/if}
						</button>
					{/each}

					<!-- Marquee speed slider -->
					<div class="px-3 py-2 border-t border-[var(--kato-border)] flex flex-col gap-1.5 bg-slate-950/20">
						<label for="marquee-duration-slider" class="flex items-center justify-between text-[11px] text-[var(--kato-text-secondary)]">
							<span>{t('settings.marqueeLimit')}</span>
							<span class="font-mono font-bold text-[var(--kato-text-primary)]">{currentMarqueeDuration}s</span>
						</label>
						<input
							id="marquee-duration-slider"
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
							aria-label={t('settings.marqueeAria')}
						/>
						<div class="flex justify-between text-[9px] text-[var(--kato-text-secondary)]">
							<span>{t('settings.marqueeFastLabel')}</span>
							<span>{t('settings.marqueeSlowLabel')}</span>
						</div>
					</div>

					<!-- Clock & Timezone section -->
					<div class="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--kato-text-secondary)] border-t border-b border-[var(--kato-border)] flex items-center justify-between">
						<span>{t('settings.sectionClock')}</span>
						<span class="font-mono text-emerald-400">{clockConfig.format}</span>
					</div>

					<!-- 24h / 12h format -->
					<div class="px-3 py-1.5 flex items-center justify-between gap-2 text-xs">
						<span class="text-[var(--kato-text-secondary)]">{t('settings.clockFormat')}</span>
						<div class="flex items-center gap-1 bg-slate-900/60 p-0.5 rounded border border-[var(--kato-border)]">
							<button
								type="button"
								onclick={() => setTimeFormat('24h')}
								class="px-2 py-0.5 rounded font-mono text-[11px] transition-colors cursor-pointer {clockConfig.format === '24h' ? 'bg-emerald-600 text-white font-bold shadow-xs' : 'text-slate-400 hover:text-white'}"
								aria-label={t('settings.clock24hAria')}
							>
								24h
							</button>
							<button
								type="button"
								onclick={() => setTimeFormat('12h')}
								class="px-2 py-0.5 rounded font-mono text-[11px] transition-colors cursor-pointer {clockConfig.format === '12h' ? 'bg-emerald-600 text-white font-bold shadow-xs' : 'text-slate-400 hover:text-white'}"
								aria-label={t('settings.clock12hAria')}
							>
								12h
							</button>
						</div>
					</div>

					<!-- Show / hide seconds -->
					<div class="px-3 py-1.5 flex items-center justify-between gap-2 text-xs">
						<span class="text-[var(--kato-text-secondary)]">{t('settings.clockSeconds')}</span>
						<button
							type="button"
							onclick={() => setShowSeconds(!clockConfig.showSeconds)}
							class="px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer flex items-center gap-1 border border-[var(--kato-border)] {clockConfig.showSeconds ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60' : 'bg-slate-800/40 text-slate-400'}"
							aria-label={clockConfig.showSeconds ? t('settings.secondsHideAria') : t('settings.secondsShowAria')}
						>
							{#if clockConfig.showSeconds}
								<Check class="w-3 h-3 text-emerald-400" />
								<span>{t('settings.secondsShown')}</span>
							{:else}
								<span>{t('settings.secondsHidden')}</span>
							{/if}
						</button>
					</div>

					<!-- Timezone -->
					<div class="px-3 py-1.5 pb-2 flex flex-col gap-1 text-xs">
						<label for="timezone-select" class="text-[var(--kato-text-secondary)] text-[11px]">
							{t('settings.clockTimezone')}
						</label>
						<select
							id="timezone-select"
							value={clockConfig.timeZone}
							onchange={(e) => setTimeZone((e.target as HTMLSelectElement).value)}
							class="w-full rounded bg-slate-900 border border-[var(--kato-border)] px-2 py-1 text-xs text-[var(--kato-text-primary)] font-sans focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
							aria-label={t('settings.timezoneSelectAria')}
						>
							{#each TIME_ZONE_PRESETS as tz (tz.id)}
								<option value={tz.id}>{tz.label}</option>
							{/each}
						</select>
					</div>
				</div>
			{/if}
		</div>
	</div>
</header>
