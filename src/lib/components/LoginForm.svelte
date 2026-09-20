<script lang="ts">
  import { t } from "$lib/i18n";

  let {
    hasError = false,
  }: {
    hasError?: boolean;
  } = $props();
</script>

<div
  class="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 select-none"
>
  <div
    class="w-full max-w-sm mx-auto rounded-2xl bg-slate-800/50 p-8 backdrop-blur-sm border border-slate-700/50 shadow-2xl"
  >
    <!-- KATO Logo -->
    <h1 class="text-2xl font-black tracking-widest text-white text-center mb-6">
      KATO
      <span class="sr-only">{t("login.securityBadge")}</span>
    </h1>

    <!-- Authentication form -->
    <form method="POST" class="space-y-4" novalidate={false}>
      <div>
        <label for="password" class="sr-only">{t("login.passwordLabel")}</label>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          id="password"
          name="password"
          type="password"
          required
          autofocus
          autocomplete="current-password"
          placeholder={t("login.passwordPlaceholder")}
          aria-invalid={hasError}
          aria-describedby={hasError ? "login-error" : undefined}
          class="w-full rounded-lg bg-slate-700/50 border border-slate-600 px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kato-focus-ring)] focus-visible:ring-offset-2 transition-all font-mono text-sm"
        />
      </div>

      <button
        type="submit"
        class="w-full mt-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 px-4 py-3 font-medium text-white transition-colors duration-150 shadow-lg shadow-emerald-900/30 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kato-focus-ring)] focus-visible:ring-offset-2"
      >
        {t("login.unlock")}
      </button>

      <!-- Error message on invalid authentication -->
      {#if hasError}
        <div
          id="login-error"
          class="mt-4 p-3 rounded-lg bg-red-950/50 border border-red-800/60 text-xs font-semibold text-red-300 text-center animate-kato-pulse"
          role="alert"
          aria-live="assertive"
        >
          {t("login.invalidPassword")}
        </div>
      {/if}
    </form>
  </div>
</div>
