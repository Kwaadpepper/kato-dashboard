<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { getInitialTheme, applyTheme, onThemeChange, type Theme, type ResolvedTheme } from '$lib/utils/theme';

	let { children } = $props();
	let currentTheme = $state<Theme>('dark');
	let currentResolved = $state<ResolvedTheme>('dark');

	onMount(() => {
		// Initialise le thème stocké ou par défaut
		const initial = getInitialTheme();
		applyTheme(initial);
		currentTheme = initial;

		// S'abonne aux bascules de thème et aux changements prefers-color-scheme en mode 'auto'
		const unsubscribe = onThemeChange((theme, resolved) => {
			currentTheme = theme;
			currentResolved = resolved;
		});

		return unsubscribe;
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Kato — Wallboard High-Density Monitoring</title>
</svelte:head>

<div
	class="min-h-screen w-full flex flex-col transition-colors duration-200 bg-[var(--kato-bg-primary)] text-[var(--kato-text-primary)]"
	data-theme={currentResolved}
	data-theme-mode={currentTheme}
>
	{@render children()}
</div>
