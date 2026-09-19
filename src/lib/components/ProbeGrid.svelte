<script lang="ts">
	import type { GridLayout, NormalizedProbe } from '$lib/types';
	import ProbeCell from '$lib/components/ProbeCell.svelte';
	import ProbeDot from '$lib/components/ProbeDot.svelte';
	import { flip } from 'svelte/animate';

	let {
		probes = [],
		layout
	}: {
		probes: NormalizedProbe[];
		layout: GridLayout;
	} = $props();

	// Style dynamique de la grille CSS Grid calculé par l'algorithme adaptatif
	const gridStyle = $derived(
		`grid-template-columns: repeat(${layout.columns}, minmax(0, ${layout.cellSize}px)); ` +
		`grid-auto-rows: ${layout.cellSize}px; ` +
		`gap: ${layout.gap}px;`
	);
</script>

<div
	class="w-full h-full flex items-center justify-center overflow-hidden p-2 sm:p-4 select-none"
>
	<div
		class="grid justify-center items-center content-center transition-all duration-200"
		style={gridStyle}
	>
		{#each probes as probe (probe.id)}
			<div
				animate:flip={{ duration: 300 }}
				class="w-full h-full flex items-center justify-center"
			>
				{#if layout.density === 'large' || layout.density === 'medium' || layout.density === 'compact'}
					<ProbeCell {probe} density={layout.density} cellSize={layout.cellSize} />
				{:else}
					<ProbeDot {probe} density={layout.density} cellSize={layout.cellSize} />
				{/if}
			</div>
		{/each}
	</div>
</div>
