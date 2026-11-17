<script lang="ts">
  // The options page (SPEC §1, ADR-0004): the disabled sites with remove buttons, the Add site
  // field (the only place `*.` rules are made), and the shortcuts with a way to change them.
  // The list lives in `storage.sync` and follows changes made elsewhere (the popup, another
  // synced browser) while the page is open. Every content script picks up this page's writes
  // from `storage.onChanged`, so videos react without a reload.
  import { onMount, tick } from 'svelte';
  import { applyChanges, parseStored, siteKey, type SiteRule, type StorageItems, type Stored } from '../../src/lib/settings';
  import { checkAddSite, isSyncFullError, siteList, type AddSiteCheck, type SiteListEntry } from '../../src/lib/site-list';
  import { SPEED_COMMANDS, shortcutText, type SpeedCommand } from '../../src/lib/speed-commands';

  type MessageName = Parameters<typeof browser.i18n.getMessage>[0];
  const t = (key: MessageName, ...substitutions: string[]) => browser.i18n.getMessage(key, substitutions);

  let stored = $state.raw<Stored | null>(null);
  let input = $state('');
  let includeSubdomains = $state(false);
  /** Why the last write failed, until the next try. */
  let failure = $state<'full' | 'failed' | null>(null);
  /** The speed shortcuts as the browser has them bound; `null` keys when one is unbound. */
  let shortcuts = $state.raw<{ command: SpeedCommand; keys: string | null }[]>([]);
  let field: HTMLInputElement | undefined = $state();
  let list: HTMLUListElement | undefined = $state();
  /** Removals not yet written. Reads wait for them, so a removed site doesn't flicker back. */
  let removing = 0;

  const sites = $derived(stored ? siteList(stored.rules) : []);
  /** A typed `*.` already means subdomains, so the checkbox shows ticked and can't be changed. */
  const typedWildcard = $derived(input.trim().startsWith('*.'));
  const check = $derived(stored && checkAddSite(input, includeSubdomains, stored.rules));

  const SHORTCUT_LABELS = {
    'speed-up': 'commandSpeedUp',
    'slow-down': 'commandSlowDown',
    'toggle-speed': 'commandToggleSpeed',
  } as const satisfies Record<SpeedCommand, MessageName>;

  // Firefox 137+ opens its own shortcut settings. Chrome has a page for them. Older Firefox has
  // neither, and an extension can't open `about:addons`, so the page gives the steps instead.
  const commands = browser.commands as typeof browser.commands & { openShortcutSettings?: () => Promise<void> };
  const shortcutSettings: 'open' | 'page' | 'steps' =
    typeof commands.openShortcutSettings === 'function' ? 'open' : import.meta.env.FIREFOX ? 'steps' : 'page';

  async function refresh() {
    if (removing) return;
    let items: StorageItems = {};
    try {
      items = await browser.storage.sync.get(null);
    } catch {
      // Storage unavailable: show an empty list; a change will report that it couldn't save.
    }
    if (!removing) stored = parseStored(items);
  }

  async function readShortcuts() {
    try {
      const bound = await browser.commands.getAll();
      shortcuts = SPEED_COMMANDS.map((command) => {
        const keys = bound.find((c) => c.name === command)?.shortcut;
        return { command, keys: keys ? shortcutText(keys) : null };
      });
    } catch {
      shortcuts = [];
    }
  }

  onMount(() => {
    // Listening before the first read, so nothing changed meanwhile is missed.
    const onChanged = () => void refresh();
    // Back from the browser's shortcut settings: show the new bindings.
    const onFocus = () => void readShortcuts();
    browser.storage.sync.onChanged.addListener(onChanged);
    window.addEventListener('focus', onFocus);
    void refresh();
    void readShortcuts();
    return () => {
      browser.storage.sync.onChanged.removeListener(onChanged);
      window.removeEventListener('focus', onFocus);
    };
  });

  function statusText(check: AddSiteCheck): string {
    if (check.ok) return t(check.wildcard ? 'optionsPreviewWildcard' : 'optionsPreviewExact', check.host);
    switch (check.reason) {
      case 'empty':
        return '';
      case 'invalid':
        return t('optionsInvalid');
      case 'noSubdomains':
        return t('optionsNoSubdomains', check.host);
      case 'duplicate':
        return t('optionsDuplicate', check.pattern);
      case 'covered':
        return t('optionsCovered', check.by);
    }
  }

  async function add(event: SubmitEvent) {
    event.preventDefault();
    if (!check?.ok) return;
    failure = null;
    try {
      await browser.storage.sync.set({
        [siteKey(check.pattern)]: { disabled: true, added: new Date().toISOString() } satisfies SiteRule,
      });
      input = '';
      includeSubdomains = false;
    } catch (error) {
      failure = isSyncFullError(error) ? 'full' : 'failed';
    }
    await refresh();
  }

  async function remove(entry: SiteListEntry, index: number) {
    if (!stored) return;
    failure = null;
    const key = siteKey(entry.pattern);
    stored = applyChanges(stored, { [key]: {} });
    removing++;
    // Keep keyboard focus in the list: on the next site's button, else the last one, else the field.
    await tick();
    const buttons = list?.querySelectorAll('button') ?? [];
    (buttons[Math.min(index, buttons.length - 1)] ?? field)?.focus();
    try {
      await browser.storage.sync.remove(key);
    } catch {
      failure = 'failed';
    } finally {
      removing--;
      // Back to what storage holds: the same as shown, unless the removal failed.
      void refresh();
    }
  }

  function openShortcutSettings() {
    const opened = commands.openShortcutSettings
      ? commands.openShortcutSettings()
      : browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
    opened.catch(() => {});
  }
</script>

<main>
  <header>
    <img src="/icon/48.png" alt="" width="28" height="28" />
    <h1>{t('extName')}</h1>
  </header>

  <section aria-labelledby="sites-title">
    <h2 id="sites-title">{t('optionsSitesTitle')}</h2>
    <p class="intro">{t('optionsSitesIntro')}</p>

    <form onsubmit={add}>
      <label class="field-label" for="add-site">{t('optionsAddLabel')}</label>
      <div class="add">
        <input
          id="add-site"
          type="text"
          bind:this={field}
          bind:value={input}
          oninput={() => (failure = null)}
          placeholder={t('optionsAddPlaceholder')}
          autocomplete="off"
          spellcheck="false"
          aria-describedby="add-status"
        />
        <button type="submit" disabled={!check?.ok}>{t('optionsAddButton')}</button>
      </div>
      <label class="check">
        <input
          type="checkbox"
          checked={includeSubdomains || typedWildcard}
          disabled={typedWildcard}
          onchange={(event) => {
            includeSubdomains = event.currentTarget.checked;
            failure = null;
          }}
        />
        {t('optionsIncludeSubdomains')}
      </label>
      <p id="add-status" class="status" class:refused={check && !check.ok} aria-live="polite">
        {check ? statusText(check) : ''}
      </p>
      {#if failure}
        <p class="error" role="alert">{t(failure === 'full' ? 'optionsListFull' : 'optionsSaveFailed')}</p>
      {/if}
    </form>

    {#if stored}
      {#if sites.length}
        <ul class="sites" bind:this={list} aria-labelledby="sites-title">
          {#each sites as entry, index (entry.pattern)}
            <li>
              <span class="site">
                <span class="host">{entry.host}</span>
                {#if entry.wildcard}
                  <span class="note">{t('optionsSubdomains')}</span>
                {/if}
              </span>
              <button class="remove" aria-label={t('optionsRemoveSite', entry.pattern)} onclick={() => remove(entry, index)}>
                {t('optionsRemove')}
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">{t('optionsEmpty')}</p>
      {/if}
    {/if}
  </section>

  <section aria-labelledby="shortcuts-title">
    <h2 id="shortcuts-title">{t('optionsShortcutsTitle')}</h2>
    <dl class="shortcuts">
      {#each shortcuts as { command, keys } (command)}
        <div>
          <dt>{t(SHORTCUT_LABELS[command])}</dt>
          <dd>
            {#if keys}
              <kbd>{keys}</kbd>
            {:else}
              <span class="note">{t('optionsShortcutUnset')}</span>
            {/if}
          </dd>
        </div>
      {/each}
    </dl>
    {#if shortcutSettings === 'steps'}
      <p class="note">{t('optionsShortcutsSteps')}</p>
    {:else}
      <button class="link" onclick={openShortcutSettings}>{t('optionsShortcutsChange')}</button>
    {/if}
  </section>
</main>

<style>
  main {
    max-width: 36rem;
    margin: 0 auto;
    padding: 2rem 1rem 3rem;
    font: 15px/1.5 system-ui, sans-serif;
  }
  header {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    margin-bottom: 1.5rem;
  }
  h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }
  section + section {
    margin-top: 2.5rem;
  }
  h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }
  .intro,
  .note,
  .empty {
    color: var(--muted);
  }
  .intro {
    margin: 0.25rem 0 1rem;
  }
  .note {
    font-size: 0.875rem;
  }

  .field-label {
    display: block;
    margin-bottom: 0.25rem;
    font-weight: 600;
    font-size: 0.875rem;
  }
  .add {
    display: flex;
    gap: 0.5rem;
  }
  input[type='text'] {
    flex: 1;
    min-width: 0;
    padding: 0.375rem 0.625rem;
    border: 1px solid var(--track);
    border-radius: 0.375rem;
    background: var(--bg);
    color: var(--fg);
    font: inherit;
  }
  input[type='text']:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  button[type='submit'] {
    padding: 0.375rem 1rem;
    border: none;
    border-radius: 0.375rem;
    background: var(--accent);
    color: var(--bg);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  button[type='submit']:disabled {
    cursor: default;
    opacity: 0.4;
  }
  .check {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    margin-top: 0.5rem;
    font-size: 0.875rem;
  }
  .check input {
    margin: 0;
    accent-color: var(--accent);
  }
  .status {
    min-height: 1.5em;
    margin: 0.375rem 0 0;
    font-size: 0.875rem;
  }
  .status.refused,
  .error {
    color: var(--error);
  }
  .error {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
  }

  .sites {
    margin: 1rem 0 0;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--line);
  }
  .sites li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--line);
  }
  .site {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 0.5rem;
    min-width: 0;
  }
  .host {
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .remove {
    flex: none;
    padding: 0.25rem 0.75rem;
    border: none;
    border-radius: 0.375rem;
    background: var(--button);
    color: var(--fg);
    font: inherit;
    font-size: 0.875rem;
    cursor: pointer;
  }
  .empty {
    margin: 1rem 0 0;
  }

  .shortcuts {
    margin: 0.75rem 0;
    border-top: 1px solid var(--line);
  }
  .shortcuts div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--line);
  }
  .shortcuts dt,
  .shortcuts dd {
    margin: 0;
  }
  kbd {
    display: inline-block;
    min-width: 2.5rem;
    padding: 0.0625rem 0.5rem;
    border: 1px solid var(--line);
    border-radius: 0.25rem;
    background: var(--button);
    font: inherit;
    font-size: 0.875rem;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
  .link {
    padding: 0;
    border: none;
    background: none;
    color: var(--accent);
    font: inherit;
    cursor: pointer;
  }
  .link:hover {
    text-decoration: underline;
  }

  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
