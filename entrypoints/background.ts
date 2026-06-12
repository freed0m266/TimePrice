export default defineBackground(() => {
  // Placeholder service worker. Lifecycle/storage wiring arrives in later tasks.
  // Debug log only while developing (`wxt` serve); production builds stay silent (task 12 §4).
  if (import.meta.env.COMMAND === 'serve') {
    console.debug('[TimePrice] background loaded');
  }
});
