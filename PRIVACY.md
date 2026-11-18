# Privacy

Doublespeed collects nothing. It makes no network requests and has no analytics, and nothing it
sees on a page leaves your browser, except your site list, which your browser's own sync copies
to your other devices if you have it on (see below).

## What it keeps

- **Your settings,** in the browser's extension storage: your default speed, your site list (the
  sites it's off on, music.youtube.com from the start plus the ones you add, and when each was
  added), and whether you've closed the shortcut hint. If your browser's own sync is on (Chrome
  Sync, Firefox Sync), the browser copies these to your other devices. Doublespeed never sends them
  anywhere itself.
- **Each tab's video speed,** whether it's playing, when it last started and whether the tab's site
  is turned off, for the toolbar badge and the popup. When you ask the popup to give Doublespeed
  back its site access, it also notes which tab asked and when, so it can reload that tab once
  access comes back, and clears the note then. Both are kept in session storage, which the browser
  clears when it closes.
- **Each video's source address,** in that page's memory, to notice when a player moves on to a
  new video. It lives only there and goes with the page.
- **The time of your last click or key press on a page,** in that page's memory, to tell a speed
  you chose from one the site set. It never records which key you pressed or where you clicked,
  and it lives only there and goes with the page.

Uninstalling Doublespeed removes all of it.

## Why it runs on every site

A video can be on any site and inside any frame, so Doublespeed runs on every page. There it finds
the video elements and their source addresses (see above) and sets their speed, notes when you
last clicked or pressed a key, and checks the page's address against your site list. Beyond each
video's own state, such as its speed, its length, whether it's playing and where it sits on the
screen (to place the speed label), it reads nothing else from the page.

## Checking this

The source is public under the MIT licence, so anyone can confirm all of the above. On Firefox,
the add-on also declares that it collects no data. Questions go to
[GitHub issues](https://github.com/GWSoT/doublespeed/issues). If this policy ever changes, the
change shows in this file's history.

Last updated: 2026-11-18.
