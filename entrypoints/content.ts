export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    // Placeholder. Price detection, conversion and DOM mutation arrive in tasks 04–08.
    // Default-on vs. per-site gating is runtime logic (task 09), not a manifest concern.
    console.debug('[TimePrice] content loaded');
  },
});
