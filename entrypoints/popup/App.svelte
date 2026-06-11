<script lang="ts">
  import { version } from '../../package.json';
</script>

<main>
  <h1>TimePrice</h1>
  <p class="version">v{version}</p>
  <p class="hint">Nastavení sazby přijde v tasku 03.</p>
</main>

<style>
  main {
    padding: 1rem 1.25rem;
    text-align: center;
  }

  h1 {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 700;
  }

  .version {
    margin: 0.25rem 0 1rem;
    font-size: 0.85rem;
    opacity: 0.6;
  }

  .hint {
    margin: 0;
    font-size: 0.9rem;
    opacity: 0.8;
  }
</style>
