<script lang="ts">
  // The popup (SPEC §1, ADR-0005): the switch for the page site, this tab's speed and the default
  // speed. The switch and the default live in `storage.sync`; every content script picks up the
  // popup's writes from `storage.onChanged`, so videos react without a reload. The tab's speed
  // comes from the frames' reports in `storage.session` (the badge's), and −/+ sends the same
  // message to the tab as the shortcuts. The background first drops the reports of pages the tab
  // has left. Where the extension can't run, the switch's place says why, with a grant button
  // when site access is withheld (SPEC §2.2).
  import { onMount } from 'svelte';
  import { ACCESS_GRANT_KEY, accessGrantRequest } from '../../src/lib/access-grant';
  import {
    applyChanges,
    parseStored,
    SETTINGS_KEY,
    siteKey,
    type SiteRule,
    type StorageItems,
    type Stored,
  } from '../../src/lib/settings';
  import {
    accessOrigins,
    runsOnFiles,
    siteSwitch,
    type PageAccess,
    type UnavailableReason,
  } from '../../src/lib/site-switch';
  import { canStepSpeed, stepSpeed } from '../../src/lib/speed';
  import { SPEED_COMMANDS, shortcutText, speedCommandMessage, type SpeedCommand } from '../../src/lib/speed-commands';
  import { parseTabFrames, tabKey, tabSpeed, type CheckTabMessage, type TabFrames } from '../../src/lib/tab-speed';

  type MessageName = Parameters<typeof browser.i18n.getMessage>[0];
  const t = (key: MessageName, ...substitutions: string[]) => browser.i18n.getMessage(key, substitutions);
  const speedLabel = (speed: number) => t('speedValue', String(speed));

  let tabUrl = $state<string | undefined>();
  let tabId = $state<number | undefined>();
  let access = $state.raw<PageAccess | null>(null);
  /** The tab's frame reports, once the background has checked them; `null` until then. */
  let frames = $state.raw<TabFrames | null>(null);
  /** The check is done, so changes to the reports can be shown as they come. */
  let checked = false;
  let stored = $state.raw<Stored | null>(null);
  /** The speed shortcuts as the browser has them bound; unbound ones are left out. */
  let shortcuts = $state.raw<{ command: SpeedCommand; keys: string }[]>([]);
  let saveFailed = $state(false);
  /** Writes not yet finished. Reads wait for them, so a quick second click builds on the first. */
  let writing = 0;

  const site = $derived(stored && access && siteSwitch(tabUrl, stored.rules, access));
  const defaultSpeed = $derived(stored?.settings.defaultSpeed);
  const tab = $derived(tabSpeed(frames ?? {}));
  const showHint = $derived(stored !== null && !stored.settings.shortcutHintDismissed && shortcuts.length > 0);
  const HINT_LABELS = {
    'speed-up': 'popupHintSpeedUp',
    'slow-down': 'popupHintSlowDown',
    'toggle-speed': 'popupHintToggle',
  } as const satisfies Record<SpeedCommand, MessageName>;
  const UNAVAILABLE_NOTES = {
    noAccess: 'popupNoAccess',
    browserPage: 'popupPageBrowser',
    browserPageOrFile: 'popupPageBrowserOrFile',
    store: 'popupPageStore',
    // Chrome links to its switch; an extension can't open Firefox's, so the note says where it is.
    noFileAccess: import.meta.env.FIREFOX ? 'popupNoFileAccessFirefox' : 'popupNoFileAccess',
    noSite: 'popupPageNoSite',
  } as const satisfies Record<UnavailableReason, MessageName>;

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

  /** The active tab's URL and the access that decides the switch; again when access changes. */
  async function loadTab() {
    try {
      // The URL is hidden on pages we have no access to, which `siteSwitch` reports.
      const tab =
        tabId === undefined
          ? (await browser.tabs.query({ active: true, currentWindow: true }))[0]
          : await browser.tabs.get(tabId);
      tabUrl = tab?.url;
      tabId = tab?.id;
    } catch {
      tabUrl = undefined;
    }
    let siteAccess = false;
    let files = true;
    try {
      siteAccess = await browser.permissions.contains({ origins: accessOrigins(tabUrl) });
      const [allowed, firefoxVersion] = await Promise.all([
        browser.extension.isAllowedFileSchemeAccess(),
        import.meta.env.FIREFOX ? firefoxBrowserVersion() : undefined,
      ]);
      files = runsOnFiles(tabUrl, allowed, firefoxVersion);
    } catch {
      // Treated as withheld: the grant button is the way out.
    }
    access = { site: siteAccess, files };
  }

  /** Firefox's version; `runtime.getBrowserInfo()` is Firefox-only, so the types lack it. */
  async function firefoxBrowserVersion(): Promise<string> {
    const runtime = browser.runtime as typeof browser.runtime & { getBrowserInfo(): Promise<{ version: string }> };
    return (await runtime.getBrowserInfo()).version;
  }

  async function refreshTab() {
    if (tabId === undefined) {
      frames = {};
      return;
    }
    const key = tabKey(tabId);
    try {
      frames = parseTabFrames((await browser.storage.session.get(key))[key]);
    } catch {
      frames = {};
    }
  }

  /**
   * The tab's reports, after the background has dropped those of pages the tab has left: a page's
   * withdrawal doesn't arrive when the tab moves to a browser page (issue #26).
   */
  async function checkTab() {
    if (tabId !== undefined) {
      try {
        await browser.runtime.sendMessage({ type: 'checkTab', tabId } satisfies CheckTabMessage);
      } catch {
        // No answer from the background: show the reports as they are.
      }
    }
    checked = true;
    await refreshTab();
  }

  onMount(() => {
    // Listening before the first reads, so nothing changed meanwhile is missed.
    const onChanged = () => void refresh();
    const onSessionChanged = (changes: Record<string, unknown>) => {
      if (checked && tabId !== undefined && tabKey(tabId) in changes) void refreshTab();
    };
    const onPermissions = () => void loadTab();
    browser.storage.sync.onChanged.addListener(onChanged);
    browser.storage.session.onChanged.addListener(onSessionChanged);
    browser.permissions.onAdded.addListener(onPermissions);
    browser.permissions.onRemoved.addListener(onPermissions);
    void (async () => {
      await loadTab();
      await Promise.all([refresh(), checkTab()]);
    })();
    void (async () => {
      try {
        const bound = await browser.commands.getAll();
        shortcuts = SPEED_COMMANDS.flatMap((command) => {
          const keys = bound.find((c) => c.name === command)?.shortcut;
          return keys ? [{ command, keys: shortcutText(keys) }] : [];
        });
      } catch {
        shortcuts = [];
      }
    })();
    return () => {
      browser.storage.sync.onChanged.removeListener(onChanged);
      browser.storage.session.onChanged.removeListener(onSessionChanged);
      browser.permissions.onAdded.removeListener(onPermissions);
      browser.permissions.onRemoved.removeListener(onPermissions);
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

  /**
   * Asks for access to every site. The request goes first, straight from the click: Firefox
   * only prompts during the user's input. The background reloads the tab once it's granted; a
   * refusal withdraws the request, if the popup is still open to see it.
   */
  function grantAccess() {
    const answer = browser.permissions.request({ origins: ['<all_urls>'] });
    if (tabId === undefined) return;
    const recorded = browser.storage.session.set({ [ACCESS_GRANT_KEY]: accessGrantRequest(tabId, Date.now()) });
    Promise.all([answer, recorded])
      .then(([granted]) => (granted ? undefined : browser.storage.session.remove(ACCESS_GRANT_KEY)))
      .catch(() => {});
  }

  /** Chrome's details page for the extension, where "Allow access to file URLs" is. */
  function openFileAccess() {
    browser.tabs.create({ url: `chrome://extensions/?id=${browser.runtime.id}` }).then(
      () => window.close(),
      () => {},
    );
  }

  /** −/+ for this tab: the shortcuts' message, to every frame. The display follows the reports. */
  function stepTab(command: SpeedCommand) {
    if (tabId === undefined) return;
    browser.tabs.sendMessage(tabId, speedCommandMessage(command)).catch(() => {
      // The tab's content scripts are gone (it navigated); the reports will say so.
    });
  }

  function dismissHint() {
    if (!stored) return;
    void save({ [SETTINGS_KEY]: { ...stored.settings, shortcutHintDismissed: true } });
  }

  function stepDefault(direction: 1 | -1) {
    if (!stored) return;
    void save({ [SETTINGS_KEY]: { ...stored.settings, defaultSpeed: stepSpeed(stored.settings.defaultSpeed, direction) } });
  }

  /** The options page, in a tab of its own. Firefox leaves the popup open unless it's closed. */
  function openSiteList() {
    browser.runtime.openOptionsPage().then(
      () => window.close(),
      () => {},
    );
  }
</script>

<main>
  <h1>{t('extName')}</h1>

  {#if site && defaultSpeed !== undefined}
    <section class="row site">
      <div class="text">
        {#if site.state === 'unavailable'}
          <p class="note" id="site-note">{t(UNAVAILABLE_NOTES[site.reason])}</p>
          {#if site.reason === 'noAccess'}
            <button class="grant" onclick={grantAccess}>{t('popupGrantAccess')}</button>
          {:else if site.reason === 'browserPageOrFile' || (site.reason === 'noFileAccess' && !import.meta.env.FIREFOX)}
            <button class="link" onclick={openFileAccess}>{t('popupFileAccess')}</button>
          {/if}
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
          {#if frames === null}
            <!-- Still checking: nothing rather than a speed the tab may no longer have. -->
          {:else if tab.kind === 'speed'}
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

    {#if showHint}
      <section class="hint" aria-labelledby="hint-title">
        <h2 id="hint-title">{t('popupHintTitle')}</h2>
        <dl>
          {#each shortcuts as { command, keys } (command)}
            <dt><kbd>{keys}</kbd></dt>
            <dd>{t(HINT_LABELS[command])}</dd>
          {/each}
        </dl>
        <button class="dismiss" onclick={dismissHint}>{t('popupHintDismiss')}</button>
      </section>
    {/if}

    {#if saveFailed}
      <p class="error" role="alert">{t('popupSaveFailed')}</p>
    {/if}
  {/if}

  <footer>
    <button class="link" onclick={openSiteList}>{t('popupSiteList')}</button>
  </footer>
</main>

<style>
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

  .hint {
    margin: 0.25rem 0 0.5rem;
    padding: 0.625rem 0.75rem;
    border-radius: 0.5rem;
    background: var(--button);
    font-size: 0.8rem;
  }
  .hint h2 {
    margin: 0 0 0.375rem;
    font-size: 0.8rem;
    font-weight: 600;
  }
  .hint dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.25rem 0.625rem;
    align-items: center;
    margin: 0 0 0.5rem;
  }
  .hint dt,
  .hint dd {
    margin: 0;
  }
  .hint dd {
    color: var(--muted);
  }
  kbd {
    display: inline-block;
    min-width: 2.25rem;
    padding: 0.0625rem 0.375rem;
    border: 1px solid var(--line);
    border-radius: 0.25rem;
    background: var(--bg);
    font: inherit;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
  .dismiss,
  .grant {
    padding: 0.25rem 0.625rem;
    border: none;
    border-radius: 0.375rem;
    background: var(--accent);
    color: var(--bg);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .grant {
    margin-top: 0.5rem;
  }
  .site .link {
    margin-top: 0.375rem;
  }
  .dismiss:focus-visible,
  .grant:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .error {
    margin: 0 0 0.25rem;
    color: var(--error);
    font-size: 0.8rem;
  }

  footer {
    margin-top: 0.25rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--line);
  }
  .link {
    padding: 0;
    border: none;
    background: none;
    color: var(--accent);
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .link:hover {
    text-decoration: underline;
  }
  .link:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
