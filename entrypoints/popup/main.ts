import { mount } from 'svelte';
import App from './App.svelte';
import { settings } from './settings.svelte';
import './style.css';

// Kick off the storage read before mounting; the UI shows a brief loading state until
// `settings.loaded` flips.
void settings.init();

const app = mount(App, {
  target: document.getElementById('app')!,
});

// Popups are torn down without warning — flush any debounced write so a just-typed rate
// or toggle isn't lost if the user closes the popup inside the debounce window.
window.addEventListener('pagehide', () => settings.flush());

export default app;
