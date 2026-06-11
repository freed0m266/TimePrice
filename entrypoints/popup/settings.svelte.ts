// Popup-local reactive mirror of the persisted settings (task 02 store).
//
// Holds one reactive copy of `AppSettings` for the whole popup. Reads are instant and
// fine-grained (Svelte deep proxy); writes go through the task-02 `saveSettings`, with a
// debounced path so that typing into the rate field can't flood `storage.sync`
// (documented risk in task 02). External changes (e.g. another popup, or a future
// background write) flow back in via `onSettingsChanged`.

import { DEFAULT_SETTINGS, type AppSettings } from '@/settings/schema';
import { loadSettings, onSettingsChanged, saveSettings } from '@/settings/store';

const SAVE_DEBOUNCE_MS = 300;

class PopupSettings {
  /** Live, reactive settings. Components read fields off this directly. */
  current = $state<AppSettings>({ ...DEFAULT_SETTINGS });
  /** False until the first load resolves, so the UI can avoid flashing defaults. */
  loaded = $state(false);

  #pending: Partial<AppSettings> = {};
  #timer: ReturnType<typeof setTimeout> | undefined;
  #unsubscribe: (() => void) | undefined;

  async init(): Promise<void> {
    this.current = await loadSettings();
    this.loaded = true;
    // Keep the local copy in sync with writes from other contexts. Our own writes also
    // echo back here (harmless): we re-overlay any still-pending local edits so an
    // in-flight debounced change isn't clobbered by the echo of an earlier save.
    this.#unsubscribe = onSettingsChanged((next) => {
      this.current = { ...next, ...this.#pending };
    });
  }

  dispose(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.flush();
  }

  /** Update local state and persist immediately — for discrete actions (toggles, CTA). */
  patch(partial: Partial<AppSettings>): void {
    this.current = { ...this.current, ...partial };
    this.#pending = { ...this.#pending, ...partial };
    this.#clearTimer();
    void this.#flushPending();
  }

  /** Update local state now, persist after a 300 ms quiet period — for typing/sliders. */
  patchDebounced(partial: Partial<AppSettings>): void {
    this.current = { ...this.current, ...partial };
    this.#pending = { ...this.#pending, ...partial };
    this.#clearTimer();
    this.#timer = setTimeout(() => void this.#flushPending(), SAVE_DEBOUNCE_MS);
  }

  /** Force any queued write out now (e.g. before leaving the edit view / closing). */
  flush(): void {
    this.#clearTimer();
    void this.#flushPending();
  }

  #clearTimer(): void {
    if (this.#timer !== undefined) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }
  }

  async #flushPending(): Promise<void> {
    const toSave = this.#pending;
    this.#pending = {};
    if (Object.keys(toSave).length === 0) return;
    await saveSettings(toSave);
  }
}

export const settings = new PopupSettings();
