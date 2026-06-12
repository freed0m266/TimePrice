import { run } from '@/content/index';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    // Activate the live content engine: first pass + MutationObserver + settings reaction
    // (tasks 07–08). The returned teardown is unused here — the page lifetime tears
    // everything down — but exists for deterministic teardown in tests.
    void run();
  },
});
