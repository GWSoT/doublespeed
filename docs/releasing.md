# Releasing

A release is a version tag. [`release.yml`](../.github/workflows/release.yml) turns the tag into a
GitHub release that holds the packages, and uploads them to the Chrome Web Store and
addons.mozilla.org (AMO) for review.

## Release a version

1. Bump `version` in `package.json` (`npm version <version> --no-git-tag-version` also updates the
   lockfile) and merge that to main.
2. Tag the merged commit and push the tag:

   ```sh
   git switch main && git pull --ff-only
   git tag v<version>
   git push origin v<version>
   ```

The workflow then:

1. **Checks and packages.** It fails if the tag isn't `v` plus `package.json`'s version. It runs
   `make lint`, `make test` and `make e2e`, then `make zip`, and makes the source package for AMO
   with `git archive`.
2. **Creates the GitHub release** with the Chrome package, the Firefox package and the source
   package, and generated notes.
3. **Uploads to the stores** with `wxt submit`, and sends each upload to review.

The API uploads the package only. A change to a listing's text, images, privacy answers or
visibility is made in the store's dashboard, by hand, before the tag is pushed.

## Run it by hand

Actions → Release → Run workflow takes an existing tag and one of:

- **check:** sign in to each store with its secrets and upload nothing. Use it after setting or
  rotating a secret.
- **submit:** the same as pushing the tag.
- **skip:** the GitHub release only.

A tag older than `release.yml` has no workflow of its own to run, so its release is made this way.

## Secrets

They belong to the `stores` environment (Settings → Environments). Adding a required reviewer
there makes every upload wait for an approval. A store whose secrets are missing is skipped with a
warning, and the rest of the release goes on.

**Chrome Web Store** (API v2, with a service account):

| Secret | Where it comes from |
|---|---|
| `CHROME_PUBLISHER_ID` | The developer dashboard: Publisher → Settings. |
| `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL` | The service account's email. |
| `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY` | The `private_key` of the service account's JSON key, with its line breaks. |

To make the service account ([Chrome's guide][cws-sa]):

1. In the Google Cloud console, create or pick a project and enable the Chrome Web Store API.
2. Create a service account in it (IAM & Admin → Service Accounts). It needs no roles.
3. Create a JSON key for it (Keys → Add key).
4. In the Chrome Web Store developer dashboard, add the service account's email under Account. A
   publisher can have one service account.

The variable `CHROME_PUBLISH_TYPE` (on the environment or the repo) is `DEFAULT_PUBLISH` when
unset: the version goes live once its review passes. `STAGED_PUBLISH` makes it wait for the
dashboard's publish button.

**addons.mozilla.org:**

| Secret | Where it comes from |
|---|---|
| `FIREFOX_JWT_ISSUER` | "JWT issuer" at <https://addons.mozilla.org/developers/addon/api/key/>. |
| `FIREFOX_JWT_SECRET` | "JWT secret" on the same page. |

`wxt submit` can't create a listing, so AMO's first version is submitted by hand from the
Developer Hub ([`store/listing.md`](../store/listing.md)). Until then the AMO step fails on a real
run.

[cws-sa]: https://developer.chrome.com/docs/webstore/service-accounts
