<script lang="ts">
  import Button from '@/ui/Button.svelte';
  import NumberField from '@/ui/NumberField.svelte';
  import { MAX_RATE_CZK, PRESET_RATES, SAMPLE_PRICES } from './constants';
  import { formatTimePreview } from './format';
  import { settings } from './settings.svelte';
  import { STRINGS } from './strings';

  interface Props {
    /** Called once a valid rate is committed (advances the popup to the compact view). */
    onDone: () => void;
  }
  let { onDone }: Props = $props();

  const t = STRINGS.onboarding;

  // Editable rate, seeded from whatever is already stored (set when re-editing, null on
  // a fresh install). The live preview and persistence both derive from this.
  let rate = $state<number | null>(settings.current.netHourlyRateCzk);

  const isValid = $derived(
    rate !== null && Number.isFinite(rate) && rate > 0 && rate <= MAX_RATE_CZK,
  );
  // Only nag once the user has actually typed something wrong (not on an empty field).
  const showInvalid = $derived(rate !== null && !isValid);

  // Persist the rate whenever it changes to a valid, different value — debounced so
  // fast typing can't flood storage.sync. The equality guard makes mount (and the echo
  // of our own write) a no-op, so re-entering the editor never re-saves on its own.
  $effect(() => {
    const r = rate;
    if (r === null || !Number.isFinite(r) || r <= 0 || r > MAX_RATE_CZK) return;
    if (r === settings.current.netHourlyRateCzk) return;
    settings.patchDebounced({ netHourlyRateCzk: r });
  });

  let radioEls = $state<HTMLButtonElement[]>([]);

  const selectedIndex = $derived(PRESET_RATES.findIndex((p) => p === rate));
  // Roving tabindex: the selected preset is the tab stop; if none match, the first is.
  const rovingIndex = $derived(selectedIndex === -1 ? 0 : selectedIndex);

  function moveTo(index: number) {
    const value = PRESET_RATES[index];
    if (value === undefined) return;
    rate = value;
    radioEls[index]?.focus();
  }

  function onPresetKeydown(event: KeyboardEvent, index: number) {
    const last = PRESET_RATES.length - 1;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        moveTo(index === last ? 0 : index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        moveTo(index === 0 ? last : index - 1);
        break;
      case 'Home':
        event.preventDefault();
        moveTo(0);
        break;
      case 'End':
        event.preventDefault();
        moveTo(last);
        break;
      case 'Enter':
        event.preventDefault();
        commit();
        break;
      // Space falls through to the native button click → onclick selects.
    }
  }

  function commit() {
    if (!isValid) return;
    settings.flush();
    onDone();
  }

  function onRateKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    }
  }

  function priceCzk(value: number): string {
    return `${value.toLocaleString('cs-CZ')} Kč`;
  }
</script>

<section>
  <p class="claim">{t.claim}</p>

  <div class="presets" role="radiogroup" aria-label={t.presetLegend}>
    {#each PRESET_RATES as preset, i (preset)}
      <button
        type="button"
        class="preset"
        class:selected={rate === preset}
        role="radio"
        aria-checked={rate === preset}
        tabindex={rovingIndex === i ? 0 : -1}
        bind:this={radioEls[i]}
        onclick={() => (rate = preset)}
        onkeydown={(e) => onPresetKeydown(e, i)}
      >
        {preset.toLocaleString('cs-CZ')}
        <span class="unit">{t.rateSuffix}</span>
      </button>
    {/each}
  </div>

  <div class="custom">
    <NumberField
      id="tp-rate"
      label={t.customLabel}
      bind:value={rate}
      min={1}
      max={MAX_RATE_CZK}
      step="any"
      suffix={t.rateSuffix}
      invalid={showInvalid}
      onkeydown={onRateKeydown}
    />
    {#if showInvalid}
      <p class="error" role="alert">{t.invalidRate}</p>
    {/if}
  </div>

  <div class="preview">
    <h2>{t.previewHeading}</h2>
    {#if isValid}
      <ul>
        {#each SAMPLE_PRICES as price (price)}
          <li>
            <span class="from">{priceCzk(price)}</span>
            <span class="arrow" aria-hidden="true">→</span>
            <span class="to">
              {formatTimePreview(price, rate, settings.current)}
            </span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="preview-empty">{t.previewEmpty}</p>
    {/if}
  </div>

  <Button type="button" disabled={!isValid} onclick={commit}>{t.cta}</Button>

  <p class="net-hint">{t.netHint}</p>
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .claim {
    margin: 0;
    font-size: 1rem;
    line-height: 1.4;
  }

  .presets {
    display: flex;
    gap: 0.5rem;
  }

  .preset {
    flex: 1;
    appearance: none;
    border: 1px solid var(--tp-border);
    border-radius: 8px;
    background: var(--tp-surface);
    color: inherit;
    padding: 0.55rem 0.25rem;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
  }

  .preset .unit {
    font-size: 0.7rem;
    font-weight: 400;
    color: var(--tp-fg-muted);
  }

  .preset.selected {
    border-color: var(--tp-accent);
    background: var(--tp-accent);
    color: var(--tp-accent-fg);
  }

  .preset.selected .unit {
    color: var(--tp-accent-fg);
  }

  .preset:focus-visible {
    outline: 2px solid var(--tp-accent);
    outline-offset: 2px;
  }

  .error {
    margin: 0.35rem 0 0;
    font-size: 0.8rem;
    color: var(--tp-danger);
  }

  .preview {
    border: 1px solid var(--tp-border);
    border-radius: 8px;
    padding: 0.75rem 0.9rem;
    background: var(--tp-surface);
  }

  .preview h2 {
    margin: 0 0 0.5rem;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--tp-fg-muted);
  }

  .preview ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .preview li {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: baseline;
    gap: 0.5rem;
  }

  .preview .from {
    text-align: right;
    color: var(--tp-fg-muted);
  }

  .preview .arrow {
    color: var(--tp-fg-muted);
  }

  .preview .to {
    font-weight: 700;
  }

  .preview-empty {
    margin: 0;
    font-size: 0.9rem;
    color: var(--tp-fg-muted);
  }

  .net-hint {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.4;
    color: var(--tp-fg-muted);
  }
</style>
