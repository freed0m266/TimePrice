<script lang="ts">
  import CompactView from './CompactView.svelte';
  import OnboardingView from './OnboardingView.svelte';
  import { settings } from './settings.svelte';

  // The view is driven by an explicit mode, not directly by `netHourlyRateCzk`, so that
  // typing/saving a rate during onboarding doesn't yank the user into the compact view
  // mid-edit. Initial mode is decided once, the first time settings finish loading.
  let mode = $state<'edit' | 'compact' | null>(null);

  $effect(() => {
    if (mode === null && settings.loaded) {
      mode = settings.current.netHourlyRateCzk === null ? 'edit' : 'compact';
    }
  });
</script>

<main>
  <header>
    <h1>TimePrice</h1>
  </header>

  {#if !settings.loaded || mode === null}
    <p class="loading" aria-busy="true">…</p>
  {:else if mode === 'edit'}
    <OnboardingView onDone={() => (mode = 'compact')} />
  {:else}
    <CompactView onChangeRate={() => (mode = 'edit')} />
  {/if}
</main>

<style>
  main {
    padding: 1rem 1.1rem 1.25rem;
  }

  header {
    margin-bottom: 1rem;
  }

  h1 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .loading {
    margin: 0;
    text-align: center;
    color: var(--tp-fg-muted);
  }
</style>
