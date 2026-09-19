<script lang="ts">
	let {
		hasIncidents = false
	}: {
		hasIncidents?: boolean;
	} = $props();
</script>

<nav aria-label="Liens d'accès rapide" class="relative z-50">
	<a href="#main-content" class="skip-link sr-only focus:not-sr-only">
		Passer au contenu principal (Grille de sondes)
	</a>
	{#if hasIncidents}
		<a href="#incident-bar" class="skip-link sr-only focus:not-sr-only" style="left: 280px !important;">
			Passer à la barre d'incidents
		</a>
	{/if}
</nav>
