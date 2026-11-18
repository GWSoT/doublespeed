# Store listing

What goes into the Chrome Web Store's developer dashboard, field by field. The item is
`adocdalonhmgamdohammiefgchljljef`, published by GWOSTIK. 0.1.0 went to review, unlisted, on
2026-11-17 and was rejected the next day for its description; 0.1.1 went to review on 2026-11-18
with the text below (ROADMAP risk 4). The images are in [`images/`](images/), made by
`make store-images`; the store icon is [`public/icon/128.png`](../public/icon/128.png), made by
`make icons`. addons.mozilla.org reuses the same text in Phase 4.

The name and the one-line summary come from the manifest (`extName` and `extDescription` in
[`messages.json`](../public/_locales/en/messages.json)), so they aren't repeated here.

## Store listing tab

**Description:** Google's keyword-spam policy ([troubleshooting][keyword-spam]) rules out lists
of sites "without substantial added value" and "unnatural repetition of the same keyword more
than 5 times". A bullet naming six sites got 0.1.0 rejected ("Yellow Argon"), so our own rule is
stricter: name no sites, except music.youtube.com to say it starts off there, and use no keyword
more than five times. The text below is what 0.1.1 went to review with;
[Before the next upload](#before-the-next-upload) says what to change in it.

[keyword-spam]: https://developer.chrome.com/docs/webstore/troubleshooting/#keyword-stuffing

```text
Doublespeed plays every video on the web at 2× from the first frame, so you never have to hunt for a speed menu again.

• Every video, everywhere: video and streaming sites, social feeds, news sites, embedded players, and players with no speed menu at all.
• Your choice wins: change a video's speed with the site's own menu or with the shortcuts, and that video keeps it. The next video starts at your default again.
• Sites can't quietly reset it: when a player puts itself back to 1×, Doublespeed sets it back.
• Shortcuts: Alt+. faster, Alt+, slower (0.25× steps), Alt+R to switch between 1× and your default. Change them at chrome://extensions/shortcuts.
• Always know your speed: a small label shows on the video when you change it, and the toolbar icon shows the tab's speed.
• Off where you want it: turn it off for a site from the popup. music.youtube.com starts off.
• Your default: 2× unless you pick another speed in the popup.

Live streams are left alone, since they can't play faster than they're broadcast.

Private by design: Doublespeed collects nothing and makes no network requests. Your settings stay in your browser's storage.
```

**Category:** Tools. **Language:** English.

**Homepage URL:** `https://github.com/GWSoT/doublespeed`. **Support URL:**
`https://github.com/GWSoT/doublespeed/issues`.

**Graphic assets:**
- **Store icon:** `public/icon/128.png`.
- **Screenshot:** `images/screenshot-1280x800.png`.
- **Small promo tile:** `images/promo-tile-440x280.png`.

## Privacy tab

**Single purpose:**

```text
Doublespeed controls the playback speed of videos on web pages. It plays every video at the user's default speed (2× unless they change it), and lets them change that speed or turn it off for a site.
```

**Permission justifications:**

| Permission | Justification |
|---|---|
| `storage` | `Saves the user's settings: their default speed, the sites they turned it off on, and whether they've seen the shortcut hint. It also keeps each tab's video speed for the toolbar badge and the popup.` |
| Host permission (`<all_urls>`) | `Videos can be on any site and inside any frame, so the content script has to run on every page to find each video element and set its playback speed. To tell a speed the user chose from one the site set, it keeps only the time of the user's last click or key press in the page, never which key or where. Nothing from the page is stored or sent anywhere. Users can turn it off for any site from the popup.` |

**Remote code:** No, I am not using remote code.

**Data usage:** tick none of the data types. The form asks what is collected, and nothing is: the
page address is only compared with the site list in memory and never kept, and the privacy policy
says so. Tick all three certifications (no selling or transfer, no use unrelated to the single
purpose, no use for credit decisions).

**Privacy policy URL:** `https://github.com/GWSoT/doublespeed/blob/main/PRIVACY.md`. Google
requires one from every extension that handles user data, even only on the device
([User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)), and
Doublespeed reads each page's address to check it against the site list. 0.1.0 went without one;
0.1.1 has it.

## Distribution tab

**Payments:** free. **Visibility:** unlisted until launch (ROADMAP risk 4), then public.
**Regions:** all.

## Test instructions tab

```text
No account or setup needed. Open any video, for example https://www.youtube.com/watch?v=jNQXAC9IVRw. It plays at 2×, and the toolbar icon shows "2×". Press Alt+. to go to 2.25×; a label shows the new speed on the video. Click the toolbar icon to turn it off for the site.
```

## Before the next upload

0.1.1's listing went to review as written above. Change these with the next package rather than
by withdrawing that review:

- **Description, keyword count:** "video" is in it seven times and "speed" six, not counting
  "Doublespeed"; bring each to five or fewer. 0.1.0 had six of each and was flagged only for its
  list; 0.1.1's rewritten first bullet added the seventh "video".
- **Description, claims:** three have exceptions. Word them so they hold.
  - "every video on the web at 2× from the first frame" misses sites where the user withheld its
    access (SPEC §2.2), and a custom-element player defined after load that autoplays with no
    later DOM change or click (SPEC §5's known gap).
  - "Doublespeed sets it back" stops once a site resets the speed of the same source more than
    ~5 times in ~10 s (SPEC §3.2, rule 4).
  - "a small label shows on the video when you change it" holds only for Doublespeed's shortcuts
    and popup, not the site's own speed menu (SPEC §3.1, speed label).
- **Test instructions:** clicking the toolbar icon opens the popup; turning the site off is the
  popup's switch. Say both steps.
- **addons.mozilla.org:** the description's shortcut line points to
  `chrome://extensions/shortcuts`. For Firefox, give the steps the options page shows where
  Firefox can't open the settings itself: open about:addons, click the gear button, and choose
  Manage Extension Shortcuts.
- **Host permission justification:** "Nothing from the page is stored" reads as if nothing is
  kept, while the storage justification says each tab's video speed is. Make the two agree with
  [`PRIVACY.md`](../PRIVACY.md).
