<img src="assets/icon.svg" width="64" height="64" alt="">

# Doublespeed

A Chrome and Firefox extension that plays web videos at 2× by default. Change the speed
of a video with `Alt+.` / `Alt+,`, flip between 1× and your default with `Alt+R`, and turn it
off for sites where 2× makes no sense. It makes no network requests and has no analytics; see
[PRIVACY.md](PRIVACY.md).

Status: in development, not yet on the stores. See [ROADMAP.md](ROADMAP.md) for where it's at and
[SPEC.md](SPEC.md) for how it behaves.

## Run it

Needs Node 22.12+.

```sh
make install     # npm ci
make dev         # opens Chrome with the extension loaded and reloading on save
make dev-firefox # the same in Firefox
make test        # unit tests
make e2e         # Playwright end-to-end tests (first: npx playwright install chromium)
make lint        # type checks (svelte-check) and Mozilla's web-ext lint
make build       # .output/chrome-mv3 and .output/firefox-mv3
make zip         # store-ready zips in .output/
```

Without make, `npm ci` and then `npm run build:firefox` build the Firefox add-on into
`.output/firefox-mv3/` (`npm run build` for Chrome, into `.output/chrome-mv3/`). Those two commands
are all a build from the source package needs; they were checked on Linux ARM64 in Docker's `node:24.14.0-slim` image (Debian) with Node
24.14.0 and npm 11.9.0, and on macOS with Node 24.

To try a build by hand: load `.output/chrome-mv3` from `chrome://extensions` (Developer mode →
Load unpacked), or `.output/firefox-mv3/manifest.json` from `about:debugging` → This Firefox →
Load Temporary Add-on.

## License

[MIT](LICENSE)
