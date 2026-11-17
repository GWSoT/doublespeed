# Privacy

Doublespeed collects nothing. It makes no network requests and has no analytics, and nothing it
sees on a page leaves your browser.

## What it keeps

- **Your settings,** in the browser's extension storage: your default speed, the sites you turned
  it off on and when you added each one, and whether you've closed the shortcut hint. If your
  browser's own sync is on (Chrome Sync, Firefox Sync), the browser copies these to your other
  devices. Doublespeed never sends them anywhere itself.
- **Each tab's video speed,** for the toolbar badge and the popup. It's kept in session storage,
  which the browser clears when it closes.
- **The time of your last click or key press on a page,** in that page's memory, to tell a speed
  you chose from one the site set. It never records which key you pressed or where you clicked,
  and it's gone when you leave the page.

Uninstalling Doublespeed removes all of it.

## Why it runs on every site

A video can be on any site and inside any frame, so Doublespeed runs on every page. There it finds
the video elements and sets their speed, notes when you last clicked or pressed a key (see
above), and checks the page's address against your site list. It reads nothing else from the
page.

## Checking this

The source is public under the MIT licence, so anyone can confirm all of the above. On Firefox,
the add-on also declares that it collects no data. Questions go to
[GitHub issues](https://github.com/GWSoT/doublespeed/issues). If this policy ever changes, the
change shows in this file's history.

Last updated: 2026-11-17.
