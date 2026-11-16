<script lang="ts">
  // The popup, first version (SPEC §1, ADR-0005): the switch for the page site and the default
  // speed. Everything it shows comes from `storage.sync`; every content script picks up its
  // writes from `storage.onChanged`, so videos react without a reload.
  import { onMount } from 'svelte';
  import {
    applyChanges,
    parseStored,
    SETTINGS_KEY,
    siteKey,
    type SiteRule,
    type StorageItems,
    type Stored,
  } from '../../src/lib/settings';
  import { siteSwitch } from '../../src/lib/site-switch';
  import { canStepSpeed, stepSpeed } from '../../src/lib/speed';

  type MessageName = Parameters<typeof browser.i18n.getMessage>[0];
  const t = (key: MessageName, ...substitutions: string[]) => browser.i18n.getMessage(key, substitutions);
  const speedLabel = (speed: number) => t('speedValue', String(speed));

  let tabUrl = $state<string | undefined>();
  let stored = $state.raw<Stored | null>(null);
  let saveFailed = $state(false);
  /** Writes not yet finished. Reads wait for them, so a quick second click builds on the first. */
  let writing = 0;

  const site = $derived(stored && siteSwitch(tabUrl, stored.rules));
  const defaultSpeed = $derived(stored?.settings.defaultSpeed);

  async function refresh() {
    if (writing) return;
    let items: StorageItems = {};
    try {
      items = await browser.storage.sync.get(null);
    } catch {
      // Storage unavailable: show the defaults; a change will report that it couldn't save.
    }
    if (!writing) stored = parseStored(items);
  }

  onMount(() => {
    // Listening before the first read, so nothing changed meanwhile is missed.
    const onChanged = () => void refresh();
    browser.storage.sync.onChanged.addListener(onChanged);
    void (async () => {
      try {
        // The URL is hidden on pages we have no access to, which `siteSwitch` reports.
        tabUrl = (await browser.tabs.query({ active: true, currentWindow: true }))[0]?.url;
      } catch {
        tabUrl = undefined;
      }
      await refresh();
    })();
    return () => browser.storage.sync.onChanged.removeListener(onChanged);
  });

  /** Shows `items` at once, then saves them. `undefined` removes an item. */
  async function save(items: Record<string, unknown>) {
    if (!stored) return;
    stored = applyChanges(stored, Object.fromEntries(Object.entries(items).map(([k, v]) => [k, { newValue: v }])));
    saveFailed = false;
    writing++;
    try {
      const removed = Object.keys(items).filter((key) => items[key] === undefined);
      const kept = Object.fromEntries(Object.entries(items).filter(([, value]) => value !== undefined));
      if (removed.length) await browser.storage.sync.remove(removed);
      if (Object.keys(kept).length) await browser.storage.sync.set(kept);
    } catch {
      saveFailed = true;
    } finally {
      writing--;
      // Back to what storage holds: the same as shown, unless a write failed.
      void refresh();
    }
  }

  function toggleSite() {
    if (site?.state === 'on') {
      void save({ [siteKey(site.pattern)]: { disabled: true, added: new Date().toISOString() } satisfies SiteRule });
    } else if (site?.state === 'off') {
      void save({ [siteKey(site.pattern)]: undefined });
    }
  }

  function stepDefault(direction: 1 | -1) {
    if (!stored) return;
    void save({ [SETTINGS_KEY]: { ...stored.settings, defaultSpeed: stepSpeed(stored.settings.defaultSpeed, direction) } });
  }
</script>

<main>
  <h1>{t('extName')}</h1>

  {#if site && defaultSpeed !== undefined}
    <section class="row site">
      <div class="text">
        {#if site.state === 'unavailable'}
          <p class="note" id="site-note">
            {t(site.reason === 'restricted' ? 'popupPageRestricted' : 'popupPageNoSite')}
          </p>
        {:else}
          <h2 class="host">{site.site}</h2>
          <p class="note" id="site-note">
            {#if site.state === 'on'}
              {t('popupSiteOn')}
            {:else if site.state === 'off'}
              {t('popupSiteOff')}
            {:else}
              {t('popupSiteLocked', site.by)}
            {/if}
          </p>
        {/if}
      </div>
      <button
        class="switch"
        role="switch"
        aria-checked={site.state === 'on'}
        aria-label={site.state === 'unavailable' ? t('popupSiteSwitchUnavailable') : t('popupSiteSwitch', site.site)}
        aria-describedby="site-note"
        disabled={site.state !== 'on' && site.state !== 'off'}
        onclick={toggleSite}
      >
        <span class="knob"></span>
      </button>
    </section>

    <section class="row speed">
      <span class="label" id="default-speed-label">{t('popupDefaultSpeed')}</span>
      <div class="stepper" role="group" aria-labelledby="default-speed-label">
        <button
          aria-label={t('popupDefaultSlower')}
          disabled={!canStepSpeed(defaultSpeed, -1)}
          onclick={() => stepDefault(-1)}>−</button
        >
        <output aria-live="polite">{speedLabel(defaultSpeed)}</output>
        <button
          aria-label={t('popupDefaultFaster')}
          disabled={!canStepSpeed(defaultSpeed, 1)}
          onclick={() => stepDefault(1)}>+</button
        >
      </div>
    </section>

    {#if saveFailed}
      <p class="error" role="alert">{t('popupSaveFailed')}</p>
    {/if}
  {/if}
</main>

<style>
  :global(:root) {
    color-scheme: light dark;
    --bg: #ffffff;
    --fg: #1f1d24;
    --muted: #6b6775;
    --line: #e7e4ec;
    --accent: #7c3aed;
    --track: #cfcbd6;
    --button: #f3f1f6;
    --error: #b42318;
  }
  @media (prefers-color-scheme: dark) {
    :global(:root) {
      --bg: #1f1d24;
      --fg: #f3f1f6;
      --muted: #a8a3b3;
      --line: #36333e;
      --accent: #a78bfa;
      --track: #4a4654;
      --button: #2c2933;
      --error: #f97066;
    }
  }
  :global(body) {
    margin: 0;
    background: var(--bg);
    color: var(--fg);
  }

  main {
    width: 18rem;
    padding: 0.75rem 1rem;
    font: 14px/1.4 system-ui, sans-serif;
  }
  h1 {
    margin: 0 0 0.25rem;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--accent);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 0;
  }
  .row + .row {
    border-top: 1px solid var(--line);
  }
  .host {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .note {
    margin: 0.125rem 0 0;
    color: var(--muted);
    font-size: 0.8rem;
  }
  .site .note:only-child {
    margin: 0;
  }

  .switch {
    flex: none;
    position: relative;
    width: 2.5rem;
    height: 1.5rem;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: var(--track);
    cursor: pointer;
    transition: background 0.15s;
  }
  .switch[aria-checked='true'] {
    background: var(--accent);
  }
  .knob {
    position: absolute;
    top: 0.1875rem;
    left: 0.1875rem;
    width: 1.125rem;
    height: 1.125rem;
    border-radius: 50%;
    background: #ffffff;
    transition: transform 0.15s;
  }
  .switch[aria-checked='true'] .knob {
    transform: translateX(1rem);
  }
  .switch:disabled {
    cursor: default;
    opacity: 0.45;
  }
  .switch:focus-visible,
  .stepper button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .stepper {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .stepper button {
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: none;
    border-radius: 0.375rem;
    background: var(--button);
    color: var(--fg);
    font: inherit;
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
  }
  .stepper button:disabled {
    cursor: default;
    opacity: 0.4;
  }
  output {
    min-width: 3.25rem;
    text-align: center;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .error {
    margin: 0 0 0.25rem;
    color: var(--error);
    font-size: 0.8rem;
  }
</style>
