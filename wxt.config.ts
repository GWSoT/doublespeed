import { defineConfig } from 'wxt';

// Manifest V3 for every browser (ADR-0002). WXT would otherwise build Firefox as MV2.
export default defineConfig({
  modules: ['@wxt-dev/module-svelte'],
  manifestVersion: 3,
  dev: {
    // Kept off the ports other projects claim; recorded in CLAUDE.md.
    server: { port: 3210 },
  },
  manifest: ({ browser }) => ({
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    // The only two permissions (SPEC §6). The content script's `<all_urls>` match lets it run
    // everywhere; the host permission also lets the popup read the active tab's URL.
    permissions: ['storage'],
    host_permissions: ['<all_urls>'],
    // The shortcuts (ADR-0005). Users rebind them by these names, so the names never change.
    // Neither browser allows `/` in a shortcut, which is why the toggle is Alt+R.
    commands: {
      'speed-up': { suggested_key: { default: 'Alt+Period' }, description: '__MSG_commandSpeedUp__' },
      'slow-down': { suggested_key: { default: 'Alt+Comma' }, description: '__MSG_commandSlowDown__' },
      'toggle-speed': { suggested_key: { default: 'Alt+R' }, description: '__MSG_commandToggleSpeed__' },
    },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'doublespeed@gwsot.github.io',
              strict_min_version: '128.0',
              // ADR-0006: the extension collects nothing.
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : { minimum_chrome_version: '120' }),
  }),
});
