import { run } from '@/content/index';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    // Baseline one-shot activation (task 07). The MutationObserver (task 08) and live
    // settings reaction (task 09) extend this; for now we convert once after load.
    void run();
  },
});
