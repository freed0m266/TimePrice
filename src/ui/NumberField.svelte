<script lang="ts">
  interface Props {
    id: string;
    label: string;
    value: number | null;
    min?: number;
    max?: number;
    step?: number | 'any';
    placeholder?: string;
    suffix?: string;
    invalid?: boolean;
    oninput?: () => void;
    onkeydown?: (event: KeyboardEvent) => void;
  }

  let {
    id,
    label,
    value = $bindable(null),
    min,
    max,
    step = 'any',
    placeholder,
    suffix,
    invalid = false,
    oninput,
    onkeydown,
  }: Props = $props();
</script>

<label for={id}>{label}</label>
<div class="field" class:invalid>
  <input
    {id}
    type="number"
    inputmode="decimal"
    bind:value
    {min}
    {max}
    {step}
    {placeholder}
    aria-invalid={invalid}
    oninput={() => oninput?.()}
    onkeydown={(e) => onkeydown?.(e)}
  />
  {#if suffix}<span class="suffix">{suffix}</span>{/if}
</div>

<style>
  label {
    display: block;
    font-size: 0.85rem;
    margin-bottom: 0.35rem;
    color: var(--tp-fg-muted);
  }

  .field {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid var(--tp-border);
    border-radius: 8px;
    padding: 0 0.7rem;
    background: var(--tp-surface);
  }

  .field:focus-within {
    border-color: var(--tp-accent);
    outline: 2px solid var(--tp-accent);
    outline-offset: 1px;
  }

  .field.invalid {
    border-color: var(--tp-danger);
  }

  input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 1.05rem;
    padding: 0.55rem 0;
    outline: none;
  }

  .suffix {
    color: var(--tp-fg-muted);
    font-size: 0.9rem;
    white-space: nowrap;
  }
</style>
