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

**Description:** no site names, and "video" and "speed" five times or fewer each
([Keywords](#keywords)).

```text
Doublespeed plays web videos at 2× by default, so you don't have to hunt for a speed menu.

• Embedded players, and players without such a menu, play at your default too.
• Your choice wins: change the speed in the player's own menu or with the shortcuts, and Doublespeed keeps to it until the next video, which starts at your default again.
• Sites can't quietly undo it: when a player changes it by itself, not right after a click or key press of yours, Doublespeed puts yours back. A player that does that more than five times in ten seconds is left alone until the next video, so the two never loop; a shortcut takes over again.
• Shortcuts: Alt+. faster and Alt+, slower, in 0.25× steps. Alt+R goes to 1×, and from 1× back to your default. Change them at chrome://extensions/shortcuts.
• See where you are: a shortcut, or the popup's −/+ for the tab, shows the new speed in a small label on each player it changed that you can see. Pin Doublespeed's toolbar icon to see the tab's speed on it.
• Off where you want it: turn it off for a site from the popup. music.youtube.com starts off.
• Your default: 2× unless you set another in the popup, from 0.25× to 4×.

Live streams are left alone, even when you rewind them.

Privacy: Doublespeed makes no network requests and has no analytics. It reads each page's address, to check it against your list of sites where it's off, and the address of what each player plays, to notice when it moves on. It notes when you last clicked or pressed a key, never which key or where, to tell your choices from the site's. Nothing it reads leaves your browser, except your settings, which your browser's own sync copies to your other devices if you have it on.
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
| `storage` | `Keeps the user's settings in storage.sync: their default speed, the sites Doublespeed is off on (with the date each was added), and whether they've closed the shortcut hint. In storage.session, which the browser clears when it closes, it keeps each tab's video speed, whether it's playing, when it last started and whether the tab's site is off, for the toolbar badge and the popup. While the user is giving Doublespeed its site access back from the popup, it also keeps which tab asked and when, to reload that tab once access is granted.` |
| Host permission (`<all_urls>`) | `Videos can be on any site and inside any frame, so the content script runs on every page to find each video element and set its playback speed. On each page it reads the page's address, to check it against the user's list of sites where Doublespeed is off, and each video's source address and state (its speed, length, whether it's playing and where it is on screen), to notice a new video, to show the tab's speed and to place the speed label. It notes the time of the user's last click or key press, but not which key or where, to tell a speed the user chose from one the site set. The source addresses and the input time stay in the page's memory. The popup and the background read the tab's address too, to name its site and to apply the site list inside frames. Of what it reads, Doublespeed stores each tab's video speed, in session storage, for the toolbar badge and the popup, and the site list: the sites the user turned it off on, plus music.youtube.com, which starts off. Nothing is sent anywhere: it makes no network requests. Users can turn it off for any site from the popup.` |

**Remote code:** No, I am not using remote code.

**Data usage:** tick **Web history** and **User activity**, and leave the other seven unticked
([Data usage](#data-usage) says why). Tick all three certifications (no selling or transfer, no
use unrelated to the single purpose, no use for credit decisions).

**Privacy policy URL:** `https://github.com/GWSoT/doublespeed/blob/main/PRIVACY.md`. It now names
the two data types and carries the Limited Use statement ([Limited Use](#limited-use)).

### Distribution tab

**Payments:** free. **Visibility:** unlisted until launch (ROADMAP risk 4), then public.
**Regions:** all.

### Test instructions tab

```text
No account or setup needed.

1. Open https://www.youtube.com/watch?v=jNQXAC9IVRw. The video plays at 2×.
2. Pin Doublespeed from the Extensions menu (the puzzle-piece button in the toolbar). Its icon then shows "2×", the tab's speed.
3. Press Alt+. (Option+. on a Mac). The video goes to 2.25×, a label with the new speed shows on it for about a second, and the icon shows "2.25".
4. Click Doublespeed's toolbar icon to open its popup. It shows youtube.com with a switch beside it, and "Videos play at your default speed." under it.
5. Click the switch to turn Doublespeed off for youtube.com. The popup now reads "Off. The site sets the speed.", the video goes back to the speed it had before Doublespeed changed it (1×), and the icon shows "off".
```

## addons.mozilla.org, 1.0.0

Submitted from the Developer Hub's Submit a New Add-on, "On this site".

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

  - Embedded players, and players without such a menu, play at your default too.
  - Your choice wins: change the speed in the player's own menu or with the shortcuts, and Doublespeed keeps to it until the next video, which starts at your default again.
  - Sites can't quietly undo it: when a player changes it by itself, not right after a click or key press of yours, Doublespeed puts yours back. A player that does that more than five times in ten seconds is left alone until the next video, so the two never loop; a shortcut takes over again.
  - Shortcuts: Alt+. faster and Alt+, slower, in 0.25× steps. Alt+R goes to 1×, and from 1× back to your default. To change them, open about:addons, click the gear button, and choose Manage Extension Shortcuts.
  - See where you are: a shortcut, or the popup's −/+ for the tab, shows the new speed in a small label on each player it changed that you can see. Pin Doublespeed's toolbar icon to see the tab's speed on it.
  - Off where you want it: turn it off for a site from the popup. music.youtube.com starts off.
  - Your default: 2× unless you set another in the popup, from 0.25× to 4×.

  Live streams are left alone, even when you rewind them.

  Privacy: Doublespeed makes no network requests and has no analytics. It reads each page's address, to check it against your list of sites where it's off, and the address of what each player plays, to notice when it moves on. It notes when you last clicked or pressed a key, never which key or where, to tell your choices from the site's. Nothing it reads leaves your browser, except your settings, which your browser's own sync copies to your other devices if you have it on. Privacy policy: https://github.com/GWSoT/doublespeed/blob/main/PRIVACY.md
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
  No account or setup needed.

  1. Open https://www.youtube.com/watch?v=jNQXAC9IVRw. The video plays at 2×.
  2. Pin Doublespeed from the Extensions button (the puzzle piece in the toolbar). Its icon then shows "2×", the tab's speed.
  3. Press Alt+. (Option+. on a Mac). The video goes to 2.25×, a label with the new speed shows on it for about a second, and the icon shows "2.25".
  4. Click Doublespeed's toolbar icon to open its popup. It shows youtube.com with a switch beside it, and "Videos play at your default speed." under it.
  5. Click the switch to turn Doublespeed off for youtube.com. The popup now reads "Off. The site sets the speed.", the video goes back to the speed it had before Doublespeed changed it (1×), and the icon shows "off".

  If the popup instead says "Doublespeed doesn't have access to this page", Firefox hasn't granted it site access: click "Allow on all sites" and allow it, and the page reloads with Doublespeed running.

  Source code: the add-on is bundled and minified by WXT (Vite), so its source is attached: the repository's files at the release commit, also public at https://github.com/GWSoT/doublespeed. To build it, with Node 22 or later and npm, run in the unzipped folder:

    npm ci
    npm run build:firefox

  The add-on is then in .output/firefox-mv3/, file for file the same as the uploaded package. This was checked on Linux ARM64 with Node 24.14.0 and npm 11.9.0, as in your default environment, and on macOS with Node 24.

  Data: the manifest declares no data collection. Doublespeed makes no network requests. It keeps its settings in storage.sync, which Firefox Sync copies to the user's other devices if they have it on; nothing else leaves the browser.
  ```

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

Counted without "Doublespeed", case aside, plurals included:

```sh
count() { awk -v h="$1" 'index($0, h) == 1 {f = 1} f && /^ *```/ {if (p) exit; p = 1; next} p' store/listing.md |
  perl -pe 's/doublespeed//gi' | grep -oiE 'video|speed' | tr A-Z a-z | sort | uniq -c; }
count '**Description:**'                # Chrome: 4 speed, 3 video
count '- **Description (Markdown):**'   # AMO: 4 speed, 3 video
```

The Chrome summary adds two of "video" and one of "speed", and the AMO summary one of each, so even
counted together with its summary each description stays at five or fewer.

[cws-listing]: https://developer.chrome.com/docs/webstore/program-policies/policies#listing_requirements

### Claims, checked against SPEC and the code

| Claim | Holds because | Left out on purpose |
|---|---|---|
| "Plays web videos at 2× by default" (summary, description, single purpose: "sets videos to the user's default speed") | Rule 1 sets the default speed on each new source (`src/lib/speed-rules.ts:109`); the default is 2× on install (SPEC §4). | "every" and "from the first frame": live videos are left alone (`speed-rules.ts:106`); a video can play before the content script has read its settings, since it reads them before it looks for videos (`entrypoints/content.ts:25`, `:52`); a custom-element player defined after load that autoplays with no DOM change and no click is SPEC §5's known gap; a closed shadow root on a built-in element isn't looked into (`src/content/video-finder.ts:177`); and nothing runs where the browser withholds site access (SPEC §2.2). |
| "Embedded players, and players without such a menu, play at your default too." | The content script runs in every frame, `about:blank` ones included (`content.ts:11–15`), and every frame follows the page site (`src/content/frame-settings.ts:59–61`, `entrypoints/background.ts:24`). Rule 1 doesn't depend on the player. Real sites: a blog's YouTube embed passed the Phase 1 check. | With Chrome's site access set to specific sites, a frame from another site gets no content script; the claim assumes the access Doublespeed asks for. |
| "change the speed in the player's own menu or with the shortcuts, and Doublespeed keeps to it until the next video" | Rule 3: a `ratechange` within 1 s of a trusted click or key press in the video's frame, made after the default was applied, becomes the override (`speed-rules.ts:184–191`), and a player's own menu is in the video's frame. Shortcuts: rule 5 (`speed-rules.ts:146–157`). The override is the target speed until the source changes (SPEC §3.1). | An embedding page's own speed controls outside the player's frame: the click is in the parent frame, which rule 3 doesn't see, so the change counts as a site reset (SPEC §3.2, rules 3–4). Hence "the player's own menu". |
| "the next video, which starts at your default again" | A new source starts rule 1 over (`speed-rules.ts:104–109`). | |
| "when a player changes it by itself, not right after a click or key press of yours, Doublespeed puts yours back" | Rule 4 re-sets the target speed (`speed-rules.ts:193–198`). | A change within a second of a click or key press in that frame counts as the user's (rule 3), even when the player made it. Hence "not right after". |
| "more than five times in ten seconds is left alone until the next video … a shortcut takes over again" | `RESET_LIMIT` 5 and `RESET_WINDOW_MS` 10 s (`speed-rules.ts:15–16`, `:197`); a new source starts over; rule 5 takes a source back from the site (`speed-rules.ts:154`). | |
| "Alt+. faster and Alt+, slower, in 0.25× steps. Alt+R goes to 1×, and from 1× back to your default." | The commands in `wxt.config.ts`; `stepSpeed` moves to the next 0.25 step within 0.25×–4× (`src/lib/speed.ts`); `commandedSpeed` (`src/lib/speed-commands.ts`). | They do nothing on a disabled site or to live videos (rule 5); the text doesn't say they do. |
| "Change them at chrome://extensions/shortcuts" (Chrome); "open about:addons, click the gear button, and choose Manage Extension Shortcuts" (AMO) | Chrome's page. Firefox, checked 2026-11-18 on 128.14 ESR and 160.0: about:addons' gear button ("Tools for all add-ons") has "Manage Extension Shortcuts"; the options page shows those steps on 128 (`optionsShortcutsSteps`) and a "Change shortcuts" button on 160, which has `commands.openShortcutSettings()` (`entrypoints/options/App.svelte:38–42`). | |
| "a shortcut, or the popup's −/+ for the tab, shows the new speed in a small label on each player it changed that you can see" | Each video `control()` changed gets a label (`content.ts:64`), unless it's out of view or hidden (`src/content/speed-label.ts:139–151`). | Not the default speed's −/+, nor the site's own menu: neither goes through rule 5 (SPEC §3.2, rule 5). |
| "Pin Doublespeed's toolbar icon to see the tab's speed on it." | The badge (SPEC §1; `src/background/tab-badges.ts`). | It doesn't assume the icon is on the toolbar already. |
| "turn it off for a site from the popup. music.youtube.com starts off." | The popup's switch writes the site's exact-hostname rule (`src/lib/site-switch.ts`, `entrypoints/popup/App.svelte:196`); music.youtube.com is seeded on install (`src/lib/settings.ts:43`). | Seeding is skipped when sync brings settings from another browser (SPEC §4); that user's own list applies. |
| "2× unless you set another in the popup, from 0.25× to 4×" | `speed.ts:8–12`; the popup's default −/+. | |
| "Live streams are left alone, even when you rewind them." | A live video is one whose duration is `Infinity`, left alone for good (`speed-rules.ts:67`, `:106`; SPEC §3.1). | Checked on the live fixture only, not on a real site. A live player that reports a finite duration would be sped up like any video. |
| The privacy paragraph | No `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` or `sendBeacon` anywhere in `entrypoints/` or `src/`. Page address: `frame-settings.ts:59`, `background.ts:24`, `App.svelte:87`. Source address: `src/content/speed-engine.ts:79–84`. Input time: `src/content/user-input.ts:10`. Settings in `storage.sync` (SPEC §4). | |
| Storage and host permission justifications | SPEC §4's two tables; the reads as for the privacy paragraph. | |
| Test instructions | `popupSiteOn`, `popupSiteOff`, `badgeOff`, `popupNoAccess` and `popupGrantAccess` in `messages.json`; a speed that isn't whole drops its × on the badge (`src/lib/tab-speed.ts:116–117`); the popup drops `www.` (`src/lib/site-patterns.ts:17–20`); turning a site off puts back each video's speed from before (rule 6, `speed-rules.ts:135`). | |

### Data usage

**Decision:** tick **Web history** and **User activity**. Leave **Website content** and the other
six unticked.

**Why anything is ticked.** Doublespeed handles user data only on the device, and Google's rules
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
  to `PRIVACY.md`.

**What follows from it:** "collects nothing" is gone from the description, `PRIVACY.md` and the
README. `PRIVACY.md` names the two data types, and ADR-0006 has a dated amendment.

[faq-local]: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq#3_does_an_extension_need_to_disclose_user_data_handling_if_the_data_is_only_processed_or_stored_locally_on_a_users_device
[faq-handle]: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq#ques_2
[faq-examples]: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq#ques_3
[faq-inconsistent]: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq#3_what_happens_if_there_are_inconsistencies_between_my_items_privacy_policy_the_disclosures_provided_through_the_developer_dashboard_and_the_behavior_of_my_item

### Limited Use

`PRIVACY.md` must carry the statement, and now does:

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
not sold, transferred, or used for advertising or credit decisions: the four elements the FAQ
lists (allowed use, allowed transfer, prohibited advertising, prohibited human interaction).

[cws-limited]: https://developer.chrome.com/docs/webstore/program-policies/policies#limited_use
[faq-limited]: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq#limited-use

### Disclosure before installation

[Disclosure Requirements][cws-disclosure], as changed in 2026: "If your Product handles any user
data, then prior to installation, it must: Prominently disclose what user data will be collected
and how it will be used. Obtain the user's affirmative and informed consent for such use." Google's
[announcement][cws-2026] adds that this applies "regardless of whether the data is closely related
to the extension's single purpose". Before installation, the only places to disclose are the
listing and the browser's install prompt, so the description's privacy paragraph says what
Doublespeed reads and why, the privacy fields declare it, and installing is the consent.

[User Data FAQ][faq-prominent], 10, on the FAQ page that came with the 2019 policy, says instead
that "The prominent disclosure and consent must occur within the Product's user interface.
Disclosures in the Chrome Web Store description or inline installation page do not satisfy this
requirement." Doublespeed has no such screen (ADR-0005: no welcome tab).
[Still open](#still-open) asks whether to add one.

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
([source code submission][amo-source]), so the notes don't need to name a different one.

## Still open

Only the owner can do or decide these.

- **In the Chrome dashboard, once 0.1.1's review ends:** upload 1.0.0, paste the text above, tick
  **Web history** and **User activity**, and check that the form's definitions still read as noted
  in [Data usage](#data-usage).
- **On AMO:** submit 1.0.0 with the source package, as above.
- **The screenshot:** it predates the popup's Site list link, which `make store-images` now draws.
  Re-render and commit it before 1.0.0? Recommended: yes, so it shows the popup as it is. Nothing
  in this text depends on it.
- **An in-product disclosure?** Should Doublespeed show its own data disclosure and ask for consent
  (a welcome tab or a first-run popup panel), in case a reviewer reads FAQ 10 as still in force?
  Recommended: no. The 2026 policy text asks for disclosure "prior to installation", which the
  listing gives; nothing leaves the browser; and a screen would undo ADR-0005. If a review asks for
  one, it gets its own ADR.

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
