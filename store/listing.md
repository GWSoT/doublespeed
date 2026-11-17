# Store listing

What goes into the Chrome Web Store's developer dashboard, field by field. The images are in
[`images/`](images/), made by `make store-images`; the store icon is
[`public/icon/128.png`](../public/icon/128.png), made by `make icons`. addons.mozilla.org reuses
the same text in Phase 3.

The name and the one-line summary come from the manifest (`extName` and `extDescription` in
[`messages.json`](../public/_locales/en/messages.json)), so they aren't repeated here.

## Store listing tab

**Description:**

```text
Doublespeed plays every video on the web at 2× from the first frame, so you never have to hunt for a speed menu again.

• Every video, everywhere: YouTube, Netflix, Vimeo, Twitch, X, Reddit, news sites, embedded players, and players with no speed menu at all.
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

**Privacy policy URL:** left empty. The store asks for one only when user data is collected,
and none is. `PRIVACY.md` lands in Phase 4, when the repo goes public.

## Distribution tab

**Payments:** free. **Visibility:** unlisted for the first upload (ROADMAP risk 4), public at
launch. **Regions:** all.

## Test instructions tab

```text
No account or setup needed. Open any video, for example https://www.youtube.com/watch?v=jNQXAC9IVRw. It plays at 2×, and the toolbar icon shows "2×". Press Alt+. to go to 2.25×; a label shows the new speed on the video. Click the toolbar icon to turn it off for the site.
```
