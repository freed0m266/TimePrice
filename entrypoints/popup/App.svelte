<script lang="ts">
  import { PRIVACY_POLICY_URL } from '@/constants/urls';
  import CompactView from './CompactView.svelte';
  import OnboardingView from './OnboardingView.svelte';
  import { settings } from './settings.svelte';
  import { STRINGS } from './strings';

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

  <footer>
    <!-- Opens in a new tab; rel guards against the opened page touching window.opener. -->
    <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer">
      {STRINGS.privacyLink}
    </a>
  </footer>
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

  footer {
    margin-top: 1.1rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--tp-border);
    text-align: center;
  }

  footer a {
    font-size: 0.78rem;
    color: var(--tp-fg-muted);
    text-decoration: none;
  }

  footer a:hover {
    text-decoration: underline;
  }
</style>
