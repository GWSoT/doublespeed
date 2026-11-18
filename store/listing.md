# Store listing

What goes into the Chrome Web Store's developer dashboard, field by field. The item is
`adocdalonhmgamdohammiefgchljljef`, published by GWOSTIK. 0.1.0 went to review, unlisted, on
2026-11-17 and was rejected the next day for its description; 0.1.1 went to review on 2026-11-18
with the text below (ROADMAP risk 4). The images are in [`images/`](images/), made by
`make store-images`; the store icon is [`public/icon/128.png`](../public/icon/128.png), made by
`make icons`. addons.mozilla.org reuses the same text in Phase 3.

The name and the one-line summary come from the manifest (`extName` and `extDescription` in
[`messages.json`](../public/_locales/en/messages.json)), so they aren't repeated here.

## Store listing tab

**Description:** keep to Google's keyword-spam rules
([troubleshooting page](https://developer.chrome.com/docs/webstore/troubleshooting/#keyword-stuffing)).
No lists of the sites it works on: a bullet naming six of them got 0.1.0 rejected ("Yellow
Argon"). Naming one site for a reason, like music.youtube.com below, isn't a list; the policy
targets lists "without substantial added value". No keyword more than five times either. The
text below is what 0.1.1 went to review with; [Before the next upload](#before-the-next-upload)
says what to change in it.

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

**Data usage:** tick none of the data types. Tick all three certifications (no selling or
transfer, no use unrelated to the single purpose, no use for credit decisions).

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

- **Description, keyword count:** "video" is in it seven times; bring it to five or fewer. 0.1.0
  had the same count and was flagged only for its list.
- **Description, claims:** "every video on the web at 2× from the first frame" and "Doublespeed
  sets it back" both have exceptions: the late-defined players SPEC §5 calls the known gap, and a
  source that resets more than ~5 times in ~10 s (SPEC §3.2, rule 4). Word them so they hold.
- **Host permission justification:** "Nothing from the page is stored" reads as if nothing is
  kept, while the storage justification says each tab's video speed is. Make the two agree with
  [`PRIVACY.md`](../PRIVACY.md).
