# Privacy

Doublespeed makes no network requests and has no analytics. To do its job it reads a few things
on your device, listed below. Nothing it reads leaves your browser, except your settings, which
your browser's own sync copies to your other devices if you have it on.

## What it reads

A video can be on any site and inside any frame, so Doublespeed runs on every page. There it reads:

- **The page's address,** to check the page's site against your site list. The popup reads the
  tab's address too, to name the site and to tell whether Doublespeed can run there, and the
  background reads it to give the frames inside a page the page's own site.
- **Each video and its source address,** to set its speed and to notice when a player moves on to a
  new video. Of each video it reads its own state, such as its speed, its length, whether it's
  playing and where it sits on the screen (to place the speed label).
- **When you last clicked or pressed a key on a page,** to tell a speed you chose from one the site
  set. It never records which key you pressed or where you clicked.

Apart from searching the page's elements for videos, it reads nothing else from the page: no text,
no images, and no pictures or sound from the videos.

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
- **The time of your last click or key press on a page,** in that page's memory. It lives only
  there and goes with the page.

Uninstalling Doublespeed removes what it keeps in that browser.

## In the stores' terms

The Chrome Web Store counts data an extension handles on your device too. In its terms, what
Doublespeed reads is **web history** (the page and video addresses above, and the sites in your
site list) and **user activity** (the time of your last click or key press), and from version
1.0.0 its form on the store declares both. It reads no website content.

Doublespeed's use of this data complies with the
[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/policies#protecting_user_privacy),
including the Limited Use requirements. It uses the data only to control the speed of videos, as
described here. It never sends the data anywhere itself: its developer never receives it, no
person reads it, and Doublespeed doesn't sell it, transfer it to third parties, or use it for
advertising or credit decisions.

On Firefox, the add-on declares that it collects no data, which Mozilla defines as data handled
outside the add-on or the browser.

## Checking this

The source is public under the MIT licence, so anyone can confirm all of the above. Questions go to
[GitHub issues](https://github.com/GWSoT/doublespeed/issues). If this policy ever changes, the
change shows in this file's history.

Last updated: 2026-11-18.
