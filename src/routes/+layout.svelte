<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import type { LayoutData } from './$types';
	import { getInitialTheme, applyTheme, onThemeChange, type Theme, type ResolvedTheme } from '$lib/utils/theme';
	import { initLocale, onLocaleChange, type SupportedLocale } from '$lib/i18n';
	import { initClockConfig } from '$lib/utils/clock';
	import { initSound } from '$lib/utils/sounds';
	import { initMarqueeConfig } from '$lib/utils/marquee';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	let currentTheme = $state<Theme>('dark');
	let currentResolved = $state<ResolvedTheme>('dark');
	let currentLocale = $state<SupportedLocale>('en');

	onMount(() => {
		const defaults = data.defaultSettings;

		// 1. Initialize language (localStorage > BFF env vars > fallback 'en')
		const initialLoc = initLocale(defaults?.locale);
		currentLocale = initialLoc;
		const unsubLocale = onLocaleChange((loc) => {
			currentLocale = loc;
		});

		// 2. Initialize theme (localStorage > BFF env vars > fallback 'dark')
		const initialTheme = getInitialTheme(defaults?.theme);
		applyTheme(initialTheme);
		currentTheme = initialTheme;
		const unsubTheme = onThemeChange((theme, resolved) => {
			currentTheme = theme;
			currentResolved = resolved;
		});

		// 3. Initialize clock, audio alerts, and marquee scrolling configuration
		if (defaults) {
			initClockConfig({
				format: defaults.timeFormat,
				timeZone: defaults.timeZone,
				showSeconds: defaults.showSeconds
			});
			initSound(defaults.soundEnabled);
			initMarqueeConfig(defaults.marqueeSpeed);
		}

		return () => {
			unsubLocale();
			unsubTheme();
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Kato — High-Density Wallboard Monitoring</title>
</svelte:head>

<div
	class="min-h-screen w-full flex flex-col transition-colors duration-200 bg-[var(--kato-bg-primary)] text-[var(--kato-text-primary)]"
	data-theme={currentResolved}
	data-theme-mode={currentTheme}
	data-lang={currentLocale}
>
	{@render children()}
</div>
