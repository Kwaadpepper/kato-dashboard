<script lang="ts">
  import {
    getLocale,
    onLocaleChange,
    t as translate,
    type SupportedLocale,
    type TranslationKey,
  } from "$lib/i18n";
  import { onMount } from "svelte";

  let {
    hasIncidents = false,
  }: {
    hasIncidents?: boolean;
  } = $props();

  let activeLocale = $state<SupportedLocale>(getLocale());
  const t = (
    key: TranslationKey | string,
    params?: Record<string, string | number>,
  ) => translate(key, params, activeLocale);

  onMount(() => onLocaleChange((loc) => (activeLocale = loc)));
</script>

<nav aria-label={t("skipLink.navAria")} class="relative z-50">
  <a href="#main-content" class="skip-link sr-only focus:not-sr-only">
    {t("skipLink.mainContent")}
  </a>
  {#if hasIncidents}
    <a
      href="#incident-bar"
      class="skip-link sr-only focus:not-sr-only"
      style="left: 280px !important;"
    >
      {t("skipLink.incidentBar")}
    </a>
  {/if}
</nav>
