<script lang="ts">
	import type { NormalizedProbe } from '$lib/types';
	import { STATUS_COLORS } from '$lib/utils/colors';

	let {
		probe,
		density = 'micro',
		cellSize = 32
	}: {
		probe: NormalizedProbe;
		density: 'micro' | 'pixel';
		cellSize?: number;
	} = $props();

	const color = $derived(STATUS_COLORS[probe.status] ?? STATUS_COLORS.up);
	const isDown = $derived(probe.status === 'down');
	const isDownOver1Min = $derived.by(() => {
		if (!isDown) return false;
		if (probe.downSince) {
			return Date.now() - new Date(probe.downSince).getTime() > 60_000;
		}
		return false;
	});

	// Dimensions adaptées à cellSize :
	// - pixel : 10px à 16px
	// - micro : 16px à 32px
	const dotStyle = $derived.by(() => {
		if (density === 'pixel') {
			const size = Math.max(8, Math.min(16, Math.floor(cellSize * 0.7)));
			return `width: ${size}px; height: ${size}px;`;
		} else {
			const size = Math.max(16, Math.min(32, Math.floor(cellSize * 0.75)));
			return `width: ${size}px; height: ${size}px;`;
		}
	});

	const tooltipText = $derived(
		`${probe.name} — ${probe.status.toUpperCase()}${
			probe.responseTime !== null ? ` (${probe.responseTime}ms)` : ''
		}${probe.uptime24h !== null ? ` • 24h: ${probe.uptime24h}%` : ''}`
	);
</script>

<div
	class="relative group flex items-center justify-center w-full h-full select-none"
	title={tooltipText}
>
	<div
		style={dotStyle}
		class="{density === 'pixel'
			? 'rounded-xs hover:ring-2 hover:ring-white/40'
			: 'rounded-full'} {color.bgClass} hover:scale-125 transition-transform duration-150 cursor-pointer shadow-sm {isDown
			? 'animate-kato-pulse'
			: ''} {isDownOver1Min ? 'kato-glow-red' : ''}"
		role="status"
		aria-label="{probe.name}: {probe.status}"
	></div>

	<!-- Tooltip contextuel au survol -->
	<div
		class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center z-50 pointer-events-none"
	>
		<div
			class="bg-slate-900 text-white text-[11px] rounded py-1 px-2.5 shadow-2xl border border-slate-700 whitespace-nowrap font-mono"
		>
			<p class="font-bold text-slate-100 truncate max-w-[200px]">{probe.name}</p>
			<p class={color.textClass}>
				{probe.status.toUpperCase()}{probe.responseTime !== null
					? ` — ${probe.responseTime}ms`
					: ''}
			</p>
			{#if probe.uptime24h !== null}
				<p class="text-slate-400 text-[10px]">Uptime: {probe.uptime24h}%</p>
			{/if}
		</div>
		<div class="w-1.5 h-1.5 bg-slate-900 border-r border-b border-slate-700 rotate-45 -mt-1"></div>
	</div>
</div>
