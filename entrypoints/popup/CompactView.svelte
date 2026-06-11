<script lang="ts">
  import Button from '@/ui/Button.svelte';
  import Toggle from '@/ui/Toggle.svelte';
  import { settings } from './settings.svelte';
  import { STRINGS } from './strings';

  interface Props {
    /** Switch the popup back into the rate editor. */
    onChangeRate: () => void;
  }
  let { onChangeRate }: Props = $props();

  const t = STRINGS.compact;

  const rateText = $derived(settings.current.netHourlyRateCzk?.toLocaleString('cs-CZ') ?? '—');
</script>

<section>
  <div class="rate-row">
    <div>
      <p class="rate-label">{t.rateLabel}</p>
      <p class="rate-value">{rateText} <span class="unit">{t.rateSuffix}</span></p>
    </div>
    <Button variant="ghost" onclick={onChangeRate}>{t.change}</Button>
  </div>

  <div class="controls">
    <Toggle
      id="tp-enabled"
      label={t.globalToggle}
      checked={settings.current.enabled}
      onchange={(value) => settings.patch({ enabled: value })}
    />
    <p class="hint">
      {settings.current.enabled ? t.globalToggleHint : t.globalOffHint}
    </p>

    <!-- Per-site control is wired up in task 09; reserve the space with a disabled
         placeholder so the compact layout doesn't shift later. -->
    <div class="placeholder">
      <Toggle id="tp-persite" label={t.perSiteToggle} checked={false} disabled />
      <p class="badge">{t.perSitePlaceholder}</p>
    </div>
  </div>
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
  }

  .rate-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .rate-label {
    margin: 0;
    font-size: 0.8rem;
    color: var(--tp-fg-muted);
  }

  .rate-value {
    margin: 0.1rem 0 0;
    font-size: 1.5rem;
    font-weight: 700;
  }

  .rate-value .unit {
    font-size: 0.9rem;
    font-weight: 400;
    color: var(--tp-fg-muted);
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    border-top: 1px solid var(--tp-border);
    padding-top: 1rem;
  }

  .hint {
    margin: 0;
    font-size: 0.82rem;
    color: var(--tp-fg-muted);
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: 0.3rem;
  }

  .badge {
    margin: 0;
    align-self: flex-start;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--tp-fg-muted);
    border: 1px solid var(--tp-border);
    border-radius: 999px;
    padding: 0.12rem 0.5rem;
  }
</style>
