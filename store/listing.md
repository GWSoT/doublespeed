# Store listing

What goes into the Chrome Web Store's developer dashboard and addons.mozilla.org's Developer Hub,
field by field.

- **In review now:** 0.1.1, unlisted, on the Chrome Web Store item
  `adocdalonhmgamdohammiefgchljljef` (publisher GWOSTIK). 0.1.0 went to review on 2026-11-17 and
  was rejected the next day for its description; 0.1.1 went to review on 2026-11-18 (ROADMAP
  risk 4). [What 0.1.1 went to review with](#011-in-review-since-2026-11-18) is recorded at the
  end, unchanged.
- **Goes with the next upload:** 1.0.0, as an update to the same Chrome item once 0.1.1's review
  ends, and as the first submission to addons.mozilla.org (AMO). Its text is below. Change the
  Chrome listing with that package rather than by withdrawing 0.1.1's review.

The images are in [`images/`](images/), made by `make store-images`; the store icon is
[`public/icon/128.png`](../public/icon/128.png), made by `make icons`. The name and the Chrome
summary come from the manifest (`extName` and `extDescription` in
[`messages.json`](../public/_locales/en/messages.json)). For 1.0.0 the summary drops "every":
"Plays web videos at 2× by default. Change the speed per video, or turn it off per site."

## Chrome Web Store, 1.0.0

### Store listing tab

**Description:** no site names but music.youtube.com, and "video" and "speed" five times or fewer each
([Keywords](#keywords)).

```text
Doublespeed plays web videos at 2× by default, so you don't have to hunt for a speed menu.

• Embedded players, and ones without such a menu, work too.
• Your choice wins: set a speed with the shortcuts and Doublespeed keeps to it until the next video, which starts at your default again. A pick in the player's own menu is kept the same way, when the player applies it within a second of your click or key press.
• Sites don't quietly undo your choice: if one changes it when you haven't just clicked or pressed a key, Doublespeed sets it back. A site that keeps at it (more than five times in ten seconds) is left alone until the next video, or until you use a shortcut.
• Shortcuts: Alt+. faster and Alt+, slower, in 0.25× steps. Alt+R goes to 1×, and from 1× back to your default. Change them at chrome://extensions/shortcuts.
• See your speed: after a shortcut, or the popup's −/+ for the tab, a small label shows the new speed on each changed player in view. Pin the toolbar icon to see the tab's speed on it.
• Off where you want it: turn it off for a site from the popup. music.youtube.com starts off.
• Your default: 2× unless you set another in the popup, from 0.25× to 4×.

Live streams that report no end are left alone.

Privacy: no network requests and no analytics. Doublespeed reads each page's address, to check it against your list of sites where it's off, and the address of what's playing, to notice when it moves on. It notes when you last clicked or pressed a key, never which key or where, to tell your choices from the site's. Nothing it reads leaves your browser, except your settings, which your browser's own sync copies to your other devices if you have it on.
```

**Category:** Tools. **Language:** English.

**Homepage URL:** `https://github.com/GWSoT/doublespeed`. **Support URL:**
`https://github.com/GWSoT/doublespeed/issues`.

**Graphic assets:**
- **Store icon:** `public/icon/128.png`.
- **Screenshot:** `images/screenshot-1280x800.png`.
- **Small promo tile:** `images/promo-tile-440x280.png`, now reading "Web videos at 2×" (0.1.1's
  said "Every video at 2×").

### Privacy tab

**Single purpose:**

```text
Doublespeed controls the playback speed of videos on web pages. It sets videos to the user's default speed (2× unless they change it), and lets the user change a video's speed or turn Doublespeed off for a site.
```

**Permission justifications:**

| Permission | Justification |
|---|---|
| `storage` | `Keeps the user's settings in storage.sync, which the browser copies to the user's other devices if they have its sync on: their default speed, the sites Doublespeed is off on (with the date each was added), and whether they've closed the shortcut hint. In storage.session, which the browser clears when it closes, it keeps, for each frame of each tab, its video's speed, whether it's playing, when it last started and whether the site is off, with the ids that tell the frames and their documents apart, for the toolbar badge and the popup. While the user is giving Doublespeed its site access back from the popup, it also keeps which tab asked and when, to reload that tab once access is granted.` |
| Host permission (`<all_urls>`) | `Videos can be on any site and inside any frame, so the content script runs on every page to find each video element and set its playback speed. On each page it reads the page's address, to check it against the user's list of sites where Doublespeed is off, and each video's source address and state (its speed, length, whether it's playing and where it is on screen), to notice a new video, to show the tab's speed and to place the speed label. It notes the time of the user's last click or key press, but not which key or where, to tell a speed the user chose from one the site set. The source addresses and the input time stay in the page's memory. The popup and the background read the tab's address too, to name its site and to apply the site list inside frames. What it stores is listed under storage. Doublespeed itself sends nothing anywhere: it makes no network requests.` |

  The host justification is 879 characters; the dashboard's limit for it is unverified (it shows a
  counter), so check the counter when pasting.

**Remote code:** No, I am not using remote code.

**Data usage:** tick **Web history** and **User activity**, and leave the other seven unticked
([Data usage](#data-usage) says why). Tick all three certifications (no selling or transfer, no
use unrelated to the single purpose, no use for credit decisions).

**Privacy policy URL:** `https://github.com/GWSoT/doublespeed/blob/main/PRIVACY.md`. That is the URL
once 1.0.0 is published. For 1.0.0's draft, use the `privacy-1-0-0` branch's file, which names the
two data types and carries the Limited Use statement ([Limited Use](#limited-use)); main's keeps
the text 0.1.1 went to review with until then ([Still open](#still-open)).

### Distribution tab

**Payments:** free. **Visibility:** unlisted until launch (ROADMAP risk 4), then public.
**Regions:** all.

### Test instructions tab

```text
No account or setup needed. Use a fresh browser profile: settings synced from another browser would replace the defaults these steps assume.

1. Open https://www.youtube.com/watch?v=aqz-KE-bpKQ (a ten-minute film). The video plays at 2×.
2. Pin Doublespeed from the Extensions menu (the puzzle-piece button in the toolbar). Its icon then shows "2×", the tab's speed.
3. Press Alt+. (Option+. on a Mac). The video goes to 2.25×, a label with the new speed shows on it for about a second, and the icon shows "2.25".
4. Click Doublespeed's toolbar icon to open its popup. It shows youtube.com with a switch beside it, and "Videos play at your default speed." under it.
5. Click the switch to turn Doublespeed off for youtube.com. The popup now reads "Off. The site sets the speed.", the video goes back to the speed it had before Doublespeed changed it (1×), and the icon shows "off".
```

## addons.mozilla.org, 1.0.0

Submitted from the Developer Hub's Submit a New Add-on, "On this site". Not before
[#32](https://github.com/GWSoT/doublespeed/issues/32) is settled: Mozilla's policies say "Data from
private browsing sessions must not be stored" ([Add-on Policies][amo-policies], 6.3), and in a
private window the user allowed it in, Doublespeed stores the tab's reports and, if they turn a
site off there, the site.

### Upload Version

- **File:** `.output/doublespeed-1.0.0-firefox.zip`, from `make zip` or CI's `doublespeed-zips`
  artifact.
- **Compatible platforms:** Firefox only, not Firefox for Android (SPEC §7).
- **Source code:** yes. The package is bundled and minified, which Mozilla's
  [source code submission][amo-source] policy says needs the source and its build steps. Upload a
  `git archive` of the commit the package was built from:

  ```sh
  git archive --format=zip -o doublespeed-1.0.0-source.zip <commit>
  ```

  Not WXT's own `doublespeed-1.0.0-sources.zip`: it takes every file in the checkout that isn't on
  its exclude list, gitignored and local ones included (in this checkout, `scratch/`), and leaves
  out the unit tests. [Source package, checked](#source-package-checked) has the rebuild that
  shows the archive gives an identical add-on.

[amo-source]: https://extensionworkshop.com/documentation/publish/source-code-submission/

### Describe Add-on

- **Name:** Doublespeed, from the manifest.
- **Add-on URL:** `doublespeed`, if it's free.
- **Summary:** replace the manifest's with this, 57 characters:

  ```text
  Plays web videos at 2× by default, or the speed you pick.
  ```

  AMO's summary limit is 250 characters ([listing guide][amo-listing]), but its describe form has a
  switch, `content-optimization`, that caps the name and the summary together at 70
  ([`CombinedNameSummaryCleanMixin`][amo-70] in addons-server; the switch's state on the live site
  is unverified). The manifest's summary with the name is 98.
- **Description (Markdown):** AMO renders the description as Markdown, which joins lines with no
  blank line between them into one paragraph, so the bullets are a Markdown list. The shortcut line
  gives the steps the options page shows on Firefox. The last line links the privacy policy, as
  Mozilla's [policies FAQ][amo-faq] recommends.

  ```text
  Doublespeed plays web videos at 2× by default, so you don't have to hunt for a speed menu.

  - Embedded players, and ones without such a menu, work too.
  - Your choice wins: set a speed with the shortcuts and Doublespeed keeps to it until the next video, which starts at your default again. A pick in the player's own menu is kept the same way, when the player applies it within a second of your click or key press.
  - Sites don't quietly undo your choice: if one changes it when you haven't just clicked or pressed a key, Doublespeed sets it back. A site that keeps at it (more than five times in ten seconds) is left alone until the next video, or until you use a shortcut.
  - Shortcuts: Alt+. faster and Alt+, slower, in 0.25× steps. Alt+R goes to 1×, and from 1× back to your default. To change them, open about:addons, click the gear button, and choose Manage Extension Shortcuts.
  - See your speed: after a shortcut, or the popup's −/+ for the tab, a small label shows the new speed on each changed player in view. Pin the toolbar icon to see the tab's speed on it.
  - Off where you want it: turn it off for a site from the popup. music.youtube.com starts off.
  - Your default: 2× unless you set another in the popup, from 0.25× to 4×.

  Live streams that report no end are left alone.

  Privacy: no network requests and no analytics. Doublespeed reads each page's address, to check it against your list of sites where it's off, and the address of what's playing, to notice when it moves on. It notes when you last clicked or pressed a key, never which key or where, to tell your choices from the site's. Nothing it reads leaves your browser, except your settings, which your browser's own sync copies to your other devices if you have it on. Privacy policy: https://github.com/GWSoT/doublespeed/blob/main/PRIVACY.md
  ```

- **This add-on is experimental:** no. **Requires payment:** no.
- **Firefox categories:** Photos, Music & Videos. One only: Mozilla's
  [listing guide][amo-listing] advises against a second category when one fits.
- **Firefox for Android categories:** none, since it isn't compatible.
- **Support email:** optional; GitHub issues covers support.
  **Support website:** `https://github.com/GWSoT/doublespeed/issues`.
- **License:** MIT License.
- **This add-on has a privacy policy:** leave unticked. AMO asks for one "if any data is being
  transmitted from the user's device" ([submitting an add-on][amo-submit]), and none is; the
  description links `PRIVACY.md`.
- **Notes for Reviewers:**

  ```text
  No account or setup needed. Use a fresh browser profile: settings synced from another browser would replace the defaults these steps assume.

  If the video in step 1 plays at 1×, open Doublespeed's popup from the Extensions button. If it says "Doublespeed doesn't have access to this page", Firefox hasn't granted it site access: click "Allow on all sites" and allow it, and the page reloads with Doublespeed running.

  1. Open https://www.youtube.com/watch?v=aqz-KE-bpKQ (a ten-minute film). The video plays at 2×.
  2. Pin Doublespeed from the Extensions button (the puzzle piece in the toolbar). Its icon then shows "2×", the tab's speed.
  3. Press Alt+. (Option+. on a Mac). The video goes to 2.25×, a label with the new speed shows on it for about a second, and the icon shows "2.25".
  4. Click Doublespeed's toolbar icon to open its popup. It shows youtube.com with a switch beside it, and "Videos play at your default speed." under it.
  5. Click the switch to turn Doublespeed off for youtube.com. The popup now reads "Off. The site sets the speed.", the video goes back to the speed it had before Doublespeed changed it (1×), and the icon shows "off".

  Source code: the add-on is bundled and minified by WXT (Vite), so its source is attached: the repository's files at the release commit, also public at https://github.com/GWSoT/doublespeed. To build it, with Node 22.12 or later and npm, run in the unzipped folder:

    npm ci
    npm run build:firefox

  The add-on is then in .output/firefox-mv3/, file for file the same as the uploaded package. This was checked on Linux ARM64 (Docker's node:24.14.0-slim, Debian) with Node 24.14.0 and npm 11.9.0, the versions of your default environment, and on macOS with Node 24. The steps are in the README too.

  Data: the manifest declares no data collection. Doublespeed makes no network requests. It keeps its settings in storage.sync, which Firefox Sync copies to the user's other devices if they have it on; nothing else leaves the browser.
  ```

The notes' "file for file the same" sentence is true of 1.0.0 only once the rebuild in
[Still open](#still-open) has passed; paste it after that.

After submission, on the add-on's Edit Product Page:

- **Homepage:** `https://github.com/GWSoT/doublespeed`.
- **Icon:** the package's.
- **Screenshot:** `images/screenshot-1280x800.png`. Its browser window is drawn in Chrome's style.

### Data collection in the manifest

`data_collection_permissions: { required: ['none'] }` stays as it is in
[`wxt.config.ts`](../wxt.config.ts).
[addons.mozilla.org's data collection](#addonsmozillaorgs-data-collection) says why.

[amo-listing]: https://extensionworkshop.com/documentation/develop/create-an-appealing-listing/
[amo-70]: https://github.com/mozilla/addons-server/blob/master/src/olympia/devhub/forms.py
[amo-faq]: https://extensionworkshop.com/documentation/publish/add-on-policies-faq/
[amo-submit]: https://extensionworkshop.com/documentation/publish/submitting-an-add-on/

## Why the text reads this way

Sources were read on 2026-11-18. Google's policy pages still show older "last updated" dates, but
Google changed the Limited Use and Disclosure Requirements policies on 2026-07-01, enforced from
2026-08-01 ([announcement][cws-2026]); the quotes are from the pages as they read now.

[cws-2026]: https://developer.chrome.com/blog/cws-policy-updates-2026

### Keywords

Google's keyword-spam policy ([Listing Requirements][cws-listing]) rules out "Lists of
sites/brands/keywords without substantial added value" and "Unnatural repetition of the same
keyword more than 5 times". A bullet naming six sites got 0.1.0 rejected ("Yellow Argon"). Our own
rule is stricter: no site names, except music.youtube.com to say it starts off there, and no
keyword more than five times. 0.1.1's description has "video" seven times and "speed" six.

Counted case aside, plurals included. The list is every word of the description's subject matter,
since a word swapped in for "video" or "speed" counts the same, and the name on its own line: it
holds "speed", so it is taken out before the other words are counted and kept to five itself.

```sh
desc() { awk -v h="$1" 'index($0, h) == 1 {f = 1} f && /^ *```/ {if (p) exit; p = 1; next} p' store/listing.md; }
count() { desc "$1" | grep -oi 'doublespeed' | wc -l | tr -d ' \n'; printf ' doublespeed, '
  desc "$1" | perl -pe 's/doublespeed//gi' | grep -oiE 'video|speed|player|default|shortcut|site|menu|popup' |
  tr A-Z a-z | sort | uniq -c | tr '\n' ' '; echo; }
count '**Description:**'                # Chrome
count '- **Description (Markdown):**'   # AMO
```

Chrome: 4 doublespeed, 4 default, 3 menu, 4 player, 3 popup, 5 shortcut, 5 site, 5 speed, 3 video.
AMO: the same, but 5 doublespeed, the fifth in the privacy policy's address.

The Chrome summary adds two of "video" and one each of "speed", "default" and "site", and the AMO
summary one each of "video", "speed" and "default". The summary is its own field, and the counts
above are the description's.

[cws-listing]: https://developer.chrome.com/docs/webstore/program-policies/policies#listing_requirements

### Claims, checked against SPEC and the code

| Claim | Holds because | Left out on purpose |
|---|---|---|
| "Plays web videos at 2× by default" (summary, description, single purpose: "sets videos to the user's default speed") | Rule 1 sets the default speed on each new source (`src/lib/speed-rules.ts:109`); the default is 2× on install (SPEC §4). | "every" and "from the first frame": live videos are left alone (`speed-rules.ts:106`); a video can play before the content script has read its settings, since it reads them before it looks for videos (`entrypoints/content.ts:25`, `:52`); a custom-element player defined after load that autoplays with no DOM change and no click is SPEC §5's known gap; a closed shadow root on a built-in element isn't looked into (`src/content/video-finder.ts:177`); and nothing runs where the browser withholds site access (SPEC §2.2). |
| "Embedded players, and ones without such a menu, work too." | The content script runs in every frame, `about:blank` ones included (`content.ts:11–15`), and every frame follows the page site (`src/content/frame-settings.ts:59–61`, `entrypoints/background.ts:24`). Rule 1 doesn't depend on the player. Real sites: a blog's YouTube embed passed the Phase 1 check. | With Chrome's site access set to specific sites, a frame from another site gets no content script; the claim assumes the access Doublespeed asks for. |
| "set a speed with the shortcuts and Doublespeed keeps to it until the next video … A pick in the player's own menu is kept the same way, when the player applies it within a second of your click or key press." | Rule 3: a `ratechange` within 1 s of a trusted click or key press in the video's frame, made after the default was applied, becomes the override (`speed-rules.ts:184–191`), and a player's own menu is in the video's frame. Shortcuts: rule 5 (`speed-rules.ts:146–157`). The override is the target speed until the source changes (SPEC §3.1). | An embedding page's own speed controls outside the player's frame: the click is in the parent frame, which rule 3 doesn't see, so the change counts as a site reset (SPEC §3.2, rules 3–4). Hence "the player's own menu". And a menu that doesn't know the speed Doublespeed set: YouTube's steps from the speed YouTube believes it's at (1×), so at 2× choosing Normal there changes nothing and `>` gives 1.25× (real-Chrome check, 2026-11-16; it comes with staying in the isolated world, ROADMAP Phase 1's decision table). Doublespeed keeps to whatever speed the menu does set, which is all the bullet says, and the shortcuts come first in it because Alt+R gives 1× everywhere. A pick the player applies more than a second after the click counts as a site reset and is undone, hence "within a second". After Doublespeed has left a site alone (rule 4), a menu pick still plays but isn't recorded as an override (`speed-rules.ts:170`); nothing undoes it before the next video. |
| "the next video, which starts at your default again" | A new source starts rule 1 over (`speed-rules.ts:104–109`). | |
| "if one changes it when you haven't just clicked or pressed a key, Doublespeed sets it back" | Rule 4 re-sets the target speed (`speed-rules.ts:193–198`). | A change within a second of a click or key press in that frame counts as the user's (rule 3), even when the player made it, and it replaces an override a shortcut set before it. Hence "when you haven't just clicked or pressed a key", which qualifies "keeps to it" in the bullet above too. |
| "A site that keeps at it (more than five times in ten seconds) is left alone until the next video, or until you use a shortcut." | `RESET_LIMIT` 5 and `RESET_WINDOW_MS` 10 s (`speed-rules.ts:15–16`, `:197`); a new source starts over; rule 5 takes a source back from the site (`speed-rules.ts:154`). | |
| "Alt+. faster and Alt+, slower, in 0.25× steps. Alt+R goes to 1×, and from 1× back to your default." | The commands in `wxt.config.ts`; `stepSpeed` moves to the next 0.25 step within 0.25×–4× (`src/lib/speed.ts`); `commandedSpeed` (`src/lib/speed-commands.ts`). | They do nothing on a disabled site or to live videos (rule 5); the text doesn't say they do. |
| "Change them at chrome://extensions/shortcuts" (Chrome); "open about:addons, click the gear button, and choose Manage Extension Shortcuts" (AMO) | Chrome's page. Firefox, checked 2026-11-18 on 128.14 ESR and 160.0: about:addons' gear button ("Tools for all add-ons") has "Manage Extension Shortcuts"; the options page shows those steps on 128 (`optionsShortcutsSteps`) and a "Change shortcuts" button on 160, which has `commands.openShortcutSettings()` (`entrypoints/options/App.svelte:38–42`). | |
| "after a shortcut, or the popup's −/+ for the tab, a small label shows the new speed on each changed player in view" | Each video `control()` changed gets a label (`content.ts:64`), unless it's out of view or hidden (`src/content/speed-label.ts:139–151`). | Not the default speed's −/+, nor the site's own menu: neither goes through rule 5 (SPEC §3.2, rule 5). |
| "Pin the toolbar icon to see the tab's speed on it." | The badge (SPEC §1; `src/background/tab-badges.ts`). | It doesn't assume the icon is on the toolbar already. |
| "turn it off for a site from the popup. music.youtube.com starts off." | The popup's switch writes the site's exact-hostname rule (`src/lib/site-switch.ts`, `entrypoints/popup/App.svelte:196`); music.youtube.com is seeded on install (`src/lib/settings.ts:43`). | Seeding is skipped when sync brings settings from another browser (SPEC §4); that user's own list applies. |
| "2× unless you set another in the popup, from 0.25× to 4×" | `speed.ts:8–12`; the popup's default −/+. | |
| "Live streams that report no end are left alone." | A live video is one whose duration is `Infinity`, left alone for good, rewound or not (`speed-rules.ts:67`, `:106`; SPEC §3.1). | A live player can report a finite duration and is then sped up like any video: hls.js does by default (`liveDurationInfinity: false` in its `docs/API.md`). Hence "that report no end". Checked on the live fixture only, not on a real site. |
| The privacy paragraph | No `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` or `sendBeacon` anywhere in `entrypoints/` or `src/`. Page address: `frame-settings.ts:59`, `background.ts:24`, `App.svelte:87`. Source address: `src/content/speed-engine.ts:79–84`. Input time: `src/content/user-input.ts:10`. Settings in `storage.sync` (SPEC §4). | |
| Storage and host permission justifications | SPEC §4's two tables; the reads as for the privacy paragraph. | |
| Test instructions | `popupSiteOn`, `popupSiteOff`, `badgeOff`, `popupNoAccess` and `popupGrantAccess` in `messages.json`; a speed that isn't whole drops its × on the badge (`src/lib/tab-speed.ts:116–117`); the popup drops `www.` (`src/lib/site-patterns.ts:17–20`); turning a site off puts back each video's speed from before (rule 6, `speed-rules.ts:135`). | |

### Data usage

**Decision:** tick **Web history** and **User activity**. Leave **Website content** and the other
six unticked.

**Why anything is ticked.** Doublespeed makes no network requests itself, so it handles user data on the device (the browser's
sync copies the settings, if it's on), and Google's rules
count that:

- [User Data FAQ][faq-local], 3: "Extensions are required to disclose how they handle user data,
  even when data is processed or stored locally on a user's device and is not transmitted to
  external servers or third parties."
- [User Data FAQ][faq-handle], 2: "by 'handle' we mean collecting, transmitting, using, or sharing
  user data", including "Collecting web browsing activity and any information about the website
  content or resources a user requests or interacts with, including the domains or URLs the
  browser interacts with".
- [User Data FAQ][faq-examples], 4, lists among user data "Web browsing activity (which is any
  information about the websites or other web resources a user requests or interacts with,
  including the domains or URLs the browser interacts with)".
- [Listing Requirements][cws-listing]: "If the information listed in your privacy fields
  contradicts the information provided in your privacy policy, or the behavior of your extension,
  your extensions may be removed from the Store." The [User Data FAQ][faq-inconsistent] says the
  same of "Any discrepancies between the developer dashboard disclosures, your privacy policy, and
  the behavior of your item".

With nothing ticked, the store page says "The developer has disclosed that it will not collect or
use your data" (as on Video Speed Controller's and uBlock Origin Lite's pages, 2026-11-18).
Doublespeed uses page addresses, so that sentence wouldn't hold. With boxes ticked, the page says
"Doublespeed handles the following:" and lists them, and "handle" is the FAQ's word for
collecting, transmitting, using or sharing.

**What Doublespeed reads and keeps:**

- **Reads:** page addresses (the top frame's hostname, `frame-settings.ts:59`; the tab's address in
  the background for iframes, `background.ts:24`, and in the popup, `App.svelte:87`), each video's
  source address (`speed-engine.ts:79–84`) and state, and the time of the last trusted click or key
  press (`user-input.ts:10`).
- **Keeps, in a page's memory:** the source addresses (an internal id for a `srcObject` stream) and
  the input time. Both go with the page.
- **Keeps, in session storage:** each tab's video speed, whether it's playing, when it last started
  and whether its site is off; and which tab last asked for site access back. The browser clears it
  when it closes, at the latest.
- **Keeps, in sync storage:** the settings. The only addresses there are the site list's patterns,
  music.youtube.com included, each with the date it was added.

**Each box,** with the form's definitions as noted from the dashboard on 2026-11-18 (paraphrased,
not quoted):

- **Web history,** the list of pages the user opened, plus related data such as page titles and
  visit times: ticked. It's the form's only box for web browsing activity, which Doublespeed
  handles: page addresses, video source addresses, and the site list, sites with the date each was
  added.
- **User activity,** for example network monitoring, clicks, mouse position, scrolling or key
  presses: ticked. Every trusted click and key press on every page updates the time of the last
  one. Never which key or where.
- **Website content,** for example text, images, sounds, videos or hyperlinks: not ticked.
  Doublespeed reads no page content. It searches the element tree for `<video>` elements and reads
  each video's state (speed, duration, ready state, whether it's playing, its position for the
  label), never its pictures or sound. Information about the content a user requests is, in FAQ 2's
  own list, web browsing activity, so the video addresses go under web history. This is the closest
  call: if a reviewer reads "videos" as the video elements Doublespeed controls, tick it and add it
  to `PRIVACY.md`. One edge: a video whose source is a `data:` address carries its own bytes in
  that address, which Doublespeed keeps as the source key like any other (`speed-engine.ts:78`) and
  never decodes. How Google classes that is unverified; look at this box again before pasting.

**What follows from it:** "collects nothing" is gone from 1.0.0's description and from the README.
`PRIVACY.md`, SPEC §6 and ADR-0006 (a dated amendment; ADRs keep their decided text) change when
1.0.0 is published, not before: the policy URL of 0.1.1, in review now, is `PRIVACY.md` on main,
and a policy naming two data types beside a form with no box ticked is the discrepancy the FAQ
quoted above warns of. Their text is ready on the `privacy-1-0-0` branch
([Still open](#still-open)). 0.1.1 itself already handles both data types with neither declared;
that mismatch stands until 1.0.0's form replaces it.

[faq-local]: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq#3_does_an_extension_need_to_disclose_user_data_handling_if_the_data_is_only_processed_or_stored_locally_on_a_users_device
[faq-handle]: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq#ques_2
[faq-examples]: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq#ques_3
[faq-inconsistent]: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq#3_what_happens_if_there_are_inconsistencies_between_my_items_privacy_policy_the_disclosures_provided_through_the_developer_dashboard_and_the_behavior_of_my_item

### Limited Use

`PRIVACY.md` must carry the statement, and the `privacy-1-0-0` version does:

- [Program Policies, Limited Use][cws-limited]: "An affirmative statement that your use of the data
  complies with the Limited Use restrictions must be disclosed on a website belonging to your
  extension; for example, a link on a homepage to a dedicated page or privacy policy noting: 'The
  use of information received from Google APIs will adhere to the Chrome Web Store User Data
  Policy, including the Limited Use requirements.'"
- [User Data FAQ, Limited uses][faq-limited], 1: "All extensions that request user data must show
  a Limited Use disclosure on your project's homepage or on a page one click away from the
  homepage; for example, in your privacy policy. This Limited Use disclosure should be written by
  you, the developer, and should clearly describe the app's compliance with the Chrome Web Store
  User Data Policy, including the Limited Use requirements."

The homepage is the repository, whose README links `PRIVACY.md`: one click away. The statement
says the data is used only to control the speed of videos, never sent anywhere by Doublespeed, and
not sold, transferred to third parties, seen by anyone on the developer's side, or used for advertising or
credit decisions: the four elements the FAQ lists (allowed use, allowed transfer, prohibited advertising,
prohibited human interaction).

[cws-limited]: https://developer.chrome.com/docs/webstore/program-policies/policies#limited_use
[faq-limited]: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq#limited-use

### Disclosure before installation

[Disclosure Requirements][cws-disclosure], as changed in 2026: "If your Product handles any user
data, then prior to installation, it must: Prominently disclose what user data will be collected
and how it will be used. Obtain the user's affirmative and informed consent for such use." Google's
[announcement][cws-2026] adds that this applies "regardless of whether the data is closely related
to the extension's single purpose". Before installation, the only places to disclose are the
listing and the browser's install prompt, so the description's privacy paragraph says what
Doublespeed reads and why, and the privacy fields declare it. Whether that is enough, Google's own
pages disagree:

- [Troubleshooting, "User data policy - prominent disclosure"][cws-nickel] (notification Purple
  Nickel): "Prominent disclosure of data collection in the extension's Chrome Web Store listing is
  sufficient." But that page predates the 2026 change: its "Relevant policy" block still quotes
  "prior to the collection", and it still allows undisclosed collection that is "consistent with
  the extension's single purpose", the exception the announcement removed. It is the older of the
  two pages.
- [User Data FAQ][faq-prominent], 10: "The prominent disclosure and consent must occur within the
  Product's user interface. Disclosures in the Chrome Web Store description or inline installation
  page do not satisfy this requirement." That answer is on the live FAQ beside answer 3 on locally
  handled data, which is new with the 2026 change, so it can't be read as superseded. It doesn't
  fit the policy's own words: a screen in the product's interface can only show after installation.

Doublespeed handles user data in Google's sense whether or not the boxes are ticked; ticking them
makes that visible to a reviewer, who may go by answer 10. It has no screen of its own (ADR-0005:
no welcome tab), and the content script starts noting the input time
from `document_start`, before the page's own scripts (`entrypoints/content.ts:18`) and before any
of its interface shows. Going to review like that is a
known risk, for the owner to accept or not: [Still open](#still-open).

[cws-nickel]: https://developer.chrome.com/docs/webstore/troubleshooting#udp-prominent-disclosure
[cws-disclosure]: https://developer.chrome.com/docs/webstore/program-policies/policies#disclosure_requirements
[faq-prominent]: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq#ques_10

### addons.mozilla.org's data collection

Mozilla counts only data that leaves the add-on or the browser, so the declaration stays `none`:

- [Add-on Policies][amo-policies], 6: "For the purposes of this policy, data transmission refers to
  any data that is collected, used, transferred, shared, or handled outside of the add-on or the
  local browser." The [Dec 1, 2026 policies][amo-preview] keep this section as it is.
- [Firefox built-in consent][amo-consent]: "If your extension doesn't collect or transmit any data,
  you indicate that by specifying the none required permission in the manifest". The same page
  says custom consent on Firefox 139 and earlier is only for an extension that "collects data", so
  Firefox 128 needs nothing more, and the manifest doesn't change.

Unverified: whether Mozilla counts `storage.sync`, which Firefox Sync copies to the user's other
devices, as data handled outside the browser. Its docs don't say. The browser does that copying,
not Doublespeed, so the declaration stays `none`, and the notes for reviewers say so plainly so the
reviewer can object.

[amo-policies]: https://extensionworkshop.com/documentation/publish/add-on-policies/
[amo-preview]: https://extensionworkshop.com/documentation/publish/add-on-policies-preview-2026-12/
[amo-consent]: https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/

### Source package, checked

On 2026-11-18, with the 0.1.1 code and this branch's `messages.json`:

1. `git archive` of this branch's tree gave the source package: 132 files, no `scratch/`.
2. In Docker's `node:24.14.0-slim` (Linux ARM64, Node 24.14.0, npm 11.9.0, glibc), the build steps
   in the notes for reviewers (`npm ci`, then `npm run build:firefox`) ran from the unzipped package.
3. `diff -r` of the result against the files of the package `npm run zip:firefox` had made on
   macOS (Node 24.22.1) found no difference in any of the 16 files.

AMO's default reviewer build environment is Ubuntu 24.04 on ARM64 with Node 24.14.0 and npm 11.9.0
([source code submission][amo-source]). The check ran on Debian with the same Node and npm, not on
Ubuntu, and the notes say so. The same page asks for the build steps in a README inside the source
package, so [`README.md`](../README.md) has them.

## Still open

Only the owner can do or decide these.

- **Private windows on Firefox, before the AMO submission:**
  [#32](https://github.com/GWSoT/doublespeed/issues/32).
- **The order of the release:** settle #32 first, since either fix changes a package; then bump the
  version to 1.0.0 and build once, so both stores get the same commit; upload to Chrome; submit to
  AMO no earlier than the `PRIVACY.md` merge below, since AMO's description links it. Or say that
  Firefox ships later, as 1.0.1.
- **`PRIVACY.md`, with 1.0.0:** the new policy (with SPEC §6 and ADR-0006's amendment) is on the
  `privacy-1-0-0` branch. Uploading and publishing are separate: while 1.0.0 is in review, the
  published item keeps its old form. So give 1.0.0's draft the branch's file as its policy URL,
  `https://github.com/GWSoT/doublespeed/blob/privacy-1-0-0/PRIVACY.md`, and when 1.0.0 is
  published, merge the branch and set the URL back to main's. Rebase it onto main first
  (`git rebase --onto main 34bfad8 privacy-1-0-0`), since main is squash-merged
  ([Data usage](#data-usage)).
- **In the Chrome dashboard, once 0.1.1's review ends:** upload 1.0.0, paste the text above, tick
  **Web history** and **User activity**, and check that the form's definitions still read as noted
  in [Data usage](#data-usage).
- **On AMO:** submit 1.0.0 with the source package, as above.
- **The screenshot:** it predates the popup's Site list link, which `make store-images` now draws.
  Re-render and commit it before 1.0.0? Recommended: yes, so it shows the popup as it is. Nothing
  in this text depends on it.
- **An in-product disclosure?** Should Doublespeed show its own data disclosure and ask for consent
  (a welcome tab or a first-run popup panel)? Google's troubleshooting page says disclosure in the
  listing is sufficient, and FAQ 10, still live, says it isn't
  ([Disclosure before installation](#disclosure-before-installation)). Recommended: go to review
  without one. Doublespeed sends nothing anywhere, and a screen would undo ADR-0005. The only
  current support for "the listing is enough" is the policy's own "prior to installation"; the
  troubleshooting page that says so outright is the older text. The risk to accept: a
  reviewer who goes by FAQ 10 can reject 1.0.0 for it, which would be this publisher's second
  policy rejection, and the Program Policies' Repeat Abuse section says "Serious or repeated
  violations … will result in the suspension of your developer account". If a review asks for a
  screen, it gets its own ADR.
- **The source package, again at 1.0.0:** the rebuild in
  [Source package, checked](#source-package-checked) used 0.1.1's code. Before submitting to AMO,
  rebuild from the 1.0.0 source zip the same way and compare it with the 1.0.0 package.
- **The host justification's length:** check it against the dashboard's counter when pasting.
- **The test video:** check, signed out, that the film in the test instructions still plays and at
  2×.

## 0.1.1, in review since 2026-11-18

What 0.1.1 went to review with, field by field, as the evidence for the review timeline. The
manifest summary was "Plays every web video at 2× by default. Change the speed per video, or turn
it off per site." The images were those in `store/images/` at `1851208`, the promo tile reading
"Every video at 2×". The category, homepage and support URLs, store icon, remote-code answer,
privacy policy URL and distribution were as for 1.0.0 above.

**Description:**

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

**Single purpose:**

```text
Doublespeed controls the playback speed of videos on web pages. It plays every video at the user's default speed (2× unless they change it), and lets them change that speed or turn it off for a site.
```

**Permission justifications:**

| Permission | Justification |
|---|---|
| `storage` | `Saves the user's settings: their default speed, the sites they turned it off on, and whether they've seen the shortcut hint. It also keeps each tab's video speed for the toolbar badge and the popup.` |
| Host permission (`<all_urls>`) | `Videos can be on any site and inside any frame, so the content script has to run on every page to find each video element and set its playback speed. To tell a speed the user chose from one the site set, it keeps only the time of the user's last click or key press in the page, never which key or where. Nothing from the page is stored or sent anywhere. Users can turn it off for any site from the popup.` |

**Data usage:** none of the data types ticked; all three certifications ticked.

**Test instructions:**

```text
No account or setup needed. Open any video, for example https://www.youtube.com/watch?v=jNQXAC9IVRw. It plays at 2×, and the toolbar icon shows "2×". Press Alt+. to go to 2.25×; a label shows the new speed on the video. Click the toolbar icon to turn it off for the site.
```

What 1.0.0 changes in it, and why: the description's keyword counts and four claims with
exceptions ([Keywords](#keywords), [Claims](#claims-checked-against-spec-and-the-code)); the data
usage boxes ([Data usage](#data-usage)); the Limited Use statement ([Limited Use](#limited-use));
the test instructions, which skipped opening the popup and its switch; and the two justifications,
which left out the source addresses, the session data and the site list.
