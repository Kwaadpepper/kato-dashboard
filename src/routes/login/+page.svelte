<script lang="ts">
	import type { ActionData } from './$types';
	import LoginForm from '$lib/components/LoginForm.svelte';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>Connexion — Kato Dashboard</title>
</svelte:head>

<LoginForm hasError={Boolean(form?.error)} />
