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
    permissions: ['storage'],
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
