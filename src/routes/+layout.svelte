<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Kato — Wallboard High-Density Monitoring</title>
</svelte:head>

<div class="bg-slate-950 text-white min-h-screen w-full flex flex-col" data-theme="dark">
	{@render children()}
</div>
