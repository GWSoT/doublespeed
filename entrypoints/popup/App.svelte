<script lang="ts">
  // The popup (SPEC §1, ADR-0005): the switch for the page site, this tab's speed and the default
  // speed. The switch and the default live in `storage.sync`; every content script picks up the
  // popup's writes from `storage.onChanged`, so videos react without a reload. The tab's speed
  // comes from the frames' reports in `storage.session` (the badge's), and −/+ sends the same
  // message to the tab as the shortcuts.
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
  import { speedCommandMessage, type SpeedCommand } from '../../src/lib/speed-commands';
  import { parseTabFrames, tabKey, tabSpeed, type TabFrames } from '../../src/lib/tab-speed';

  type MessageName = Parameters<typeof browser.i18n.getMessage>[0];
  const t = (key: MessageName, ...substitutions: string[]) => browser.i18n.getMessage(key, substitutions);
  const speedLabel = (speed: number) => t('speedValue', String(speed));

  let tabUrl = $state<string | undefined>();
  let tabId = $state<number | undefined>();
  let frames = $state.raw<TabFrames>({});
  let stored = $state.raw<Stored | null>(null);
  let saveFailed = $state(false);
  /** Writes not yet finished. Reads wait for them, so a quick second click builds on the first. */
  let writing = 0;

  const site = $derived(stored && siteSwitch(tabUrl, stored.rules));
  const defaultSpeed = $derived(stored?.settings.defaultSpeed);
  const tab = $derived(tabSpeed(frames));

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

  async function refreshTab() {
    if (tabId === undefined) return;
    const key = tabKey(tabId);
    try {
      frames = parseTabFrames((await browser.storage.session.get(key))[key]);
    } catch {
      frames = {};
    }
  }

  onMount(() => {
    // Listening before the first reads, so nothing changed meanwhile is missed.
    const onChanged = () => void refresh();
    const onSessionChanged = (changes: Record<string, unknown>) => {
      if (tabId !== undefined && tabKey(tabId) in changes) void refreshTab();
    };
    browser.storage.sync.onChanged.addListener(onChanged);
    browser.storage.session.onChanged.addListener(onSessionChanged);
    void (async () => {
      try {
        // The URL is hidden on pages we have no access to, which `siteSwitch` reports.
        const [active] = await browser.tabs.query({ active: true, currentWindow: true });
        tabUrl = active?.url;
        tabId = active?.id;
      } catch {
        tabUrl = undefined;
      }
      await Promise.all([refresh(), refreshTab()]);
    })();
    return () => {
      browser.storage.sync.onChanged.removeListener(onChanged);
      browser.storage.session.onChanged.removeListener(onSessionChanged);
    };
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

  /** −/+ for this tab: the shortcuts' message, to every frame. The display follows the reports. */
  function stepTab(command: SpeedCommand) {
    if (tabId === undefined) return;
    browser.tabs.sendMessage(tabId, speedCommandMessage(command)).catch(() => {
      // The tab's content scripts are gone (it navigated); the reports will say so.
    });
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
      <span class="label" id="tab-speed-label">{t('popupTabSpeed')}</span>
      <div class="stepper" role="group" aria-labelledby="tab-speed-label">
        <button
          aria-label={t('commandSlowDown')}
          disabled={tab.kind !== 'speed' || !canStepSpeed(tab.speed, -1)}
          onclick={() => stepTab('slow-down')}>−</button
        >
        <output aria-live="polite" class:quiet={tab.kind !== 'speed'}>
          {#if tab.kind === 'speed'}
            {speedLabel(tab.speed)}
          {:else if tab.kind === 'off'}
            {t('popupTabOff')}
          {:else}
            {t('popupTabNoVideo')}
          {/if}
        </output>
        <button
          aria-label={t('commandSpeedUp')}
          disabled={tab.kind !== 'speed' || !canStepSpeed(tab.speed, 1)}
          onclick={() => stepTab('speed-up')}>+</button
        >
      </div>
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
    min-width: 4.5rem;
    text-align: center;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  output.quiet {
    color: var(--muted);
    font-weight: 400;
    font-size: 0.8rem;
  }

  .error {
    margin: 0 0 0.25rem;
    color: var(--error);
    font-size: 0.8rem;
  }
</style>
