<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    type?: 'button' | 'submit';
    variant?: 'primary' | 'ghost';
    disabled?: boolean;
    onclick?: (event: MouseEvent) => void;
    children: Snippet;
  }

  let {
    type = 'button',
    variant = 'primary',
    disabled = false,
    onclick,
    children,
  }: Props = $props();
</script>

<button {type} {disabled} class={variant} {onclick}>
  {@render children()}
</button>

<style>
  button {
    appearance: none;
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 0.55rem 0.9rem;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition:
      background-color 0.12s ease,
      border-color 0.12s ease,
      opacity 0.12s ease;
  }

  button:disabled {
    cursor: default;
    opacity: 0.5;
  }

  .primary {
    background: var(--tp-accent);
    color: var(--tp-accent-fg);
  }

  .primary:not(:disabled):hover {
    background: var(--tp-accent-hover);
  }

  .ghost {
    background: transparent;
    color: var(--tp-accent);
    border-color: var(--tp-border);
  }

  .ghost:not(:disabled):hover {
    background: var(--tp-surface-hover);
  }

  button:focus-visible {
    outline: 2px solid var(--tp-accent);
    outline-offset: 2px;
  }
</style>
