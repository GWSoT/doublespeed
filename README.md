<img src="assets/icon.svg" width="64" height="64" alt="">

# Doublespeed

A Chrome and Firefox extension that plays every web video at 2× by default. Change the speed
of any video with `Alt+.` / `Alt+,`, flip between 1× and your default with `Alt+R`, and turn it
off for sites where 2× makes no sense. It collects nothing and makes no network requests.

Status: in development, not yet on the stores. See [ROADMAP.md](ROADMAP.md) for where it's at and
[SPEC.md](SPEC.md) for how it behaves.

## Run it

Needs Node 22+.

```sh
make install     # npm ci
make dev         # opens Chrome with the extension loaded and reloading on save
make dev-firefox # the same in Firefox
make test        # unit tests
make lint        # type checks (svelte-check) and Mozilla's web-ext lint
make build       # .output/chrome-mv3 and .output/firefox-mv3
make zip         # store-ready zips in .output/
```

To try a build by hand: load `.output/chrome-mv3` from `chrome://extensions` (Developer mode →
Load unpacked), or `.output/firefox-mv3/manifest.json` from `about:debugging` → This Firefox →
Load Temporary Add-on.

## License

[MIT](LICENSE)
