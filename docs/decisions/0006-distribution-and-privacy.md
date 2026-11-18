# ADR-0006 — Free, MIT, collects nothing; listed as "Doublespeed"

- **Status:** accepted
- **Date:** 2026-11-16
- **Deciders:** Nazar (grilling rounds 1 Q2, 2 Q9–Q10, 3 Q1, Q10)
- **Phase:** 0

## Context

An extension that reads every page needs trust, and both stores scrutinise `<all_urls>`.
"Speedo" is a famous swimwear trademark, and famous marks are protected outside their own
category, so a listing under that name risks takedown.

## Options considered

| Option | Consequence if chosen |
|---|---|
| **Free, MIT, public repo, no network or analytics** | Anyone can audit it; the privacy forms and policy are trivial. |
| Closed source or paid | Harder to trust with every page, more store paperwork. |
| Keep "Speedo" | Trademark-complaint risk on a public listing. |
| **"Doublespeed"** | No listing with that name on either store (checked 2026-11-16); a play on "doublespeak". |

## Decision

- **Pricing and licence:** free, MIT-licensed.
- **Privacy:** no analytics, no network requests, and a `PRIVACY.md` saying nothing is collected. Firefox's manifest declares `data_collection_permissions: none`.
  - *Amended 2026-11-18:* the Chrome Web Store counts data an extension handles on the device as user data, so `PRIVACY.md` now lists what Doublespeed reads and keeps instead of saying nothing is collected, and the store's privacy form declares web history and user activity ([`store/listing.md`](../../store/listing.md)). The practice is unchanged: nothing leaves the browser except the settings, through the browser's own sync. Mozilla's declaration covers only data handled outside the add-on or the browser, so it stays `none`.
- **Name:** listed as Doublespeed. The GitHub repo is renamed `GWSoT/doublespeed`, and the local folder keeps its old name.
- **Repo visibility:** private until just before the first store submission, then public.
- **Submissions:** the first submission to each store is by hand. `wxt submit` automation comes later.

## Consequences

**Enables** — a one-line privacy policy; store reviewers can read the source.

**Costs** — a formal trademark search wasn't done; do one before submitting.

**Binds** — the name on both listings.

## Revisit when

A trademark search or a store reviewer objects to the name, or the project wants revenue.
