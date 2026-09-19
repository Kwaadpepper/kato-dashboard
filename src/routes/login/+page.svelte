<script lang="ts">
	import type { ActionData } from './$types';
	import LoginForm from '$lib/components/LoginForm.svelte';
	import { t } from '$lib/i18n';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>{t('login.title')}</title>
</svelte:head>

<LoginForm hasError={Boolean(form?.error)} />
