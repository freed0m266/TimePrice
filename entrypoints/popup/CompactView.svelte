<script lang="ts">
  import { onMount } from 'svelte';
  import { isBuiltinBlocked } from '@/settings/blocklist';
  import { registrableDomain } from '@/settings/domain';
  import Button from '@/ui/Button.svelte';
  import Toggle from '@/ui/Toggle.svelte';
  import { getActiveTabHost } from './activeTab';
  import { settings } from './settings.svelte';
  import { STRINGS } from './strings';

  interface Props {
    /** Switch the popup back into the rate editor. */
    onChangeRate: () => void;
  }
  let { onChangeRate }: Props = $props();

  const t = STRINGS.compact;

  const rateText = $derived(settings.current.netHourlyRateCzk?.toLocaleString('cs-CZ') ?? '—');

  // Active tab → per-site toggle. `host` is null until resolved or when there is no web page
  // to target (chrome://, extension pages); `hostResolved` gates the UI so it doesn't flash.
  let host = $state<string | null>(null);
  let hostResolved = $state(false);
  onMount(async () => {
    host = await getActiveTabHost();
    hostResolved = true;
  });

  const domain = $derived(host ? registrableDomain(host) : '');
  const blocked = $derived(domain !== '' && isBuiltinBlocked(domain));
  // Per-site state defaults to "on" (absent override). Global off and the built-in blocklist
  // both force it off and disable the control — the hierarchy is global → blocklist → site.
  const siteOff = $derived(domain !== '' && settings.current.siteOverrides[domain] === 'off');
  const siteEnabled = $derived(settings.current.enabled && !blocked && !siteOff);

  /** Write the per-site override. Enabling deletes the key so the map stays tidy (default-on). */
  function setSiteEnabled(enabled: boolean): void {
    if (domain === '') return;
    const next = { ...settings.current.siteOverrides };
    if (enabled) delete next[domain];
    else next[domain] = 'off';
    settings.patch({ siteOverrides: next });
  }

  const perSiteHint = $derived(
    blocked
      ? t.perSiteBlockedHint
      : !settings.current.enabled
        ? t.perSiteGlobalOffHint
        : siteEnabled
          ? t.perSiteOnHint
          : t.perSiteOffHint,
  );
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

    <!-- Hover-swap direction: when on, pages show prices and reveal the time on hover (task 20).
         Display-only, so it stays usable even while a per-site/global toggle is off. -->
    <div class="invert">
      <Toggle
        id="tp-invert"
        label={t.invertToggle}
        checked={settings.current.invertHover}
        onchange={(value) => settings.patch({ invertHover: value })}
      />
      <p class="hint">
        {settings.current.invertHover ? t.invertOnHint : t.invertOffHint}
      </p>
    </div>

    <!-- Per-site toggle: turn TimePrice off/on for just the active tab's domain. Disabled
         (and forced off) when global is off or the domain is on the built-in blocklist. -->
    {#if hostResolved}
      <div class="per-site">
        {#if domain === ''}
          <p class="hint">{t.perSiteNoHostHint}</p>
        {:else}
          <Toggle
            id="tp-persite"
            label={`${t.perSitePrefix} ${domain}`}
            checked={siteEnabled}
            disabled={blocked || !settings.current.enabled}
            onchange={setSiteEnabled}
          />
          <p class="hint">{perSiteHint}</p>
        {/if}
      </div>
    {/if}
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

  .invert {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin-top: 0.3rem;
    padding-top: 0.6rem;
    border-top: 1px solid var(--tp-border);
  }

  .per-site {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin-top: 0.3rem;
    padding-top: 0.6rem;
    border-top: 1px solid var(--tp-border);
  }
</style>
