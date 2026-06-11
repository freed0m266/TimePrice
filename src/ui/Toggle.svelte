<script lang="ts">
  interface Props {
    id: string;
    label: string;
    checked?: boolean;
    disabled?: boolean;
    /** Called with the new checked state. The parent owns the value (controlled). */
    onchange?: (checked: boolean) => void;
  }

  let { id, label, checked = false, disabled = false, onchange }: Props = $props();

  function handle(event: Event) {
    onchange?.((event.currentTarget as HTMLInputElement).checked);
  }
</script>

<label class="toggle" class:disabled for={id}>
  <span class="text">{label}</span>
  <input {id} type="checkbox" role="switch" {checked} {disabled} onchange={handle} />
  <span class="track" aria-hidden="true"></span>
</label>

<style>
  .toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    cursor: pointer;
  }

  .toggle.disabled {
    cursor: default;
    opacity: 0.5;
  }

  .text {
    font-size: 0.95rem;
  }

  /* Visually-hidden native checkbox: keeps it accessible + focusable, the <span.track>
     is the painted control. */
  input {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  .track {
    position: relative;
    flex: none;
    width: 38px;
    height: 22px;
    border-radius: 999px;
    background: var(--tp-border);
    transition: background-color 0.12s ease;
  }

  .track::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.12s ease;
  }

  input:checked + .track {
    background: var(--tp-accent);
  }

  input:checked + .track::after {
    transform: translateX(16px);
  }

  input:focus-visible + .track {
    outline: 2px solid var(--tp-accent);
    outline-offset: 2px;
  }
</style>
