<script lang="ts">
  const name = browser.i18n.getMessage('extName');
  const { version } = browser.runtime.getManifest();
</script>

<main>
  <h1>{name}</h1>
  <p>v{version}</p>
</main>

<style>
  main {
    min-width: 16rem;
    padding: 0.75rem 1rem;
    font: 14px/1.4 system-ui, sans-serif;
  }
  h1 {
    margin: 0;
    font-size: 1rem;
  }
  p {
    margin: 0.25rem 0 0;
    opacity: 0.7;
  }
</style>
