# Dynawalla — mobile release setup

Everything `.github/workflows/release-dynawalla.yml` needs before it can ship
`inc.corpora.dynawalla` to TestFlight internal and Play internal.

**No credential value appears in this repository, ever.** This file lists secret
**names** and how to produce each value. The repository is public (`G-11`).

## Status

| | |
|---|---|
| Local build viability | **proven, unsigned** — a release AAB and an iOS device archive were both built from this tree. The iOS archive needed `CODE_SIGNING_ALLOWED: NO`, because no App ID exists for `inc.corpora.dynawalla` yet and no provisioning profile can cover it. **A signed archive has never been produced.** |
| App Store Connect app record | **does not exist** (founder, browser-only) |
| Play app record | **does not exist** (founder, browser-only) |
| The four new credentials | **do not exist** |
| The workflow end to end | **never executed** — everything from `Import signing certificate` / `Sign the AAB` onward, including both upload and both verification steps, is unrun |

The workflow **fails hard** on a missing secret rather than skipping with a
warning, so until the list below is complete a release run is a red X that
names the missing secret. That is deliberate: `release-mobile.yml`'s
skip-and-report-success behaviour means a mis-scoped secret produces a green run
that shipped nothing.

## Founder actions, in order

Nothing below can be worked around in code.

### Browser only — no API exists

1. **Create the App Store Connect app record** for `inc.corpora.dynawalla`.
   Apple's OpenAPI spec has no app-create operation and their documentation says
   to use the website. Do not look for the endpoint.
2. **Create the Play app record** with package name `inc.corpora.dynawalla`.
   `androidpublisher` cannot create your own app record.
   **Do not call `appstoreappsreview.createappstorehostedapp`** — it reads like
   the endpoint you want and it is the registration pipeline for *third-party
   Android app stores*.
3. **Grant the existing Play service account per-app access** to the new record
   (`Release to testing tracks` is enough). Per-app grants do **not** inherit:
   the same service account already returns **403** on two sibling apps on this
   account. Possibly reachable via `androidpublisher grants.create`, which needs
   the numeric Play developer account id that is not recorded anywhere in this
   repo — treat it as manual until proven otherwise.
4. **Enrol the app in Play App Signing** and upload the new upload key.
5. **Publish the first Play release from the Console.** On an app that has never
   been published the API can only create *draft* releases. This is Google's
   anti-abuse gate, not a bug. Afterwards, set the repository **variable**
   `DYNAWALLA_PLAY_RELEASE_STATUS` to `completed`; until then the workflow's
   default of `draft` is correct.
6. **Check the Play developer account type.** The closed-testing gate (12
   testers for 14 continuous days) applies to *personal* accounts created after
   2023-11-13; organization accounts are exempt, and this account's type is
   unverified. If it applies it is a two-week calendar hit that no engineering
   recovers — check it early.

### API-automatable — `corpan/infra/asc/asc_monetization.py` and `corpan/infra/play/play_monetization.py` are already keyed off a bundle id / package name

- Register the Apple **bundle id** `inc.corpora.dynawalla` and its capabilities.
- Mint the **App Store provisioning profile**. It must be named exactly
  **`dynawalla appstore ci`** — the workflow pins that name in both
  `PROVISIONING_PROFILE_SPECIFIER` and `ExportOptions.plist`, and verifies it
  before building. Bind it to the new bundle id and the existing
  `Apple Distribution: Corpora Inc` certificate.
- Age rating, category, `kidsAgeBand`, Play Data safety, store listings,
  screenshots, beta groups, TestFlight distribution, track promotion.

## GitHub Actions secrets

Settings → Secrets and variables → Actions.

### Reused from Corpán — already set, nothing to do

These are repository secrets today and the workflow reads them directly.

| Secret | What it is | Why it is reusable |
|---|---|---|
| `APPLE_DIST_CERT_P12` | `Apple Distribution: Corpora Inc`, base64 `.p12` | Team-wide, expires 2027-04-16. A distribution certificate signs any bundle id in team `F9AV5HKF6N`; it is the *profile* that is per-app. |
| `APPLE_DIST_CERT_PASSWORD` | the password on that `.p12` | same artifact |
| `ASC_KEY_ID` | App Store Connect API key id | The existing key is a **Team** key with Admin scope; it returns 200 on `/v1/bundleIds`, `/v1/certificates`, `/v1/profiles` and `/v1/users`. It does **not** need re-minting — budget zero time for this. |
| `ASC_ISSUER_ID` | issuer id (one per team) | same key |
| `ASC_API_KEY_P8` | the `.p8` private key contents | same key |
| `PLAY_SERVICE_ACCOUNT_JSON` | Play publishing service account | The **identity** is reused. Its **access is not** — it still needs the per-app grant in founder action 3, and without it every call to this package returns 403. |

### New and mandatory — four secrets

| Secret | What it is | How to produce it |
|---|---|---|
| `DYNAWALLA_APPLE_PROVISIONING_PROFILE` | the App Store `.mobileprovision` for `inc.corpora.dynawalla`, base64 | Mint the profile named `dynawalla appstore ci` (ASC API or the developer portal), download it, then `base64 -i dynawalla.mobileprovision \| pbcopy`. **New, not optional:** profiles bind to one explicit bundle id, no wildcard spans both `com.corpora.*` and `inc.corpora.*`, and wildcards cannot carry IAP. Never copy another product's profile or its UUID. |
| `DYNAWALLA_ANDROID_KEYSTORE_B64` | a **new** upload keystore, base64 | `keytool -genkeypair -v -keystore dynawalla-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000` then `base64 -i dynawalla-upload.jks \| pbcopy`. Deliberately separate from Corpán's so one compromised key cannot risk two shipping apps. Keep the `.jks` out of the repo — `src-tauri/.gitignore` ignores `*.jks`, and the hygiene job would fail the PR anyway. |
| `DYNAWALLA_ANDROID_KEYSTORE_PASSWORD` | the store password you chose above | you choose it |
| `DYNAWALLA_ANDROID_KEY_ALIAS` | the key alias you chose above | `upload` if you follow the command above |

`DYNAWALLA_ANDROID_KEY_PASSWORD` is deliberately **not** in the list: `jarsigner`
signing an AAB with a single-key keystore only needs `-storepass`. Add it only if
the keystore is ever created with a key password that differs from the store
password, and wire it as `-keypass` at the same time.

Team ID `F9AV5HKF6N`, bundle id `inc.corpora.dynawalla` and the profile name are
**not** secrets — they are public in every shipped artifact and are committed.

### Repository variable

| Variable | Default | Meaning |
|---|---|---|
| `DYNAWALLA_PLAY_RELEASE_STATUS` | `draft` when unset | Set to `completed` only after founder action 5. |

## AWS

A **new** secret path `dynawalla/store/credentials` in AWS Secrets Manager for
anything the store tooling needs outside CI. Do **not** widen
`corpan/content-packs/verify` — a live purchase-verify lambda reads it. Sharing a
developer account is not a reason to share a secret.

## GitHub environments

`RELEASE_ENGINEERING.md` plans `dynawalla-ios` and `dynawalla-android`
environments. This workflow deliberately uses **repository** secrets and declares
no `environment:` key, because the environment split only pays for itself
alongside the reusable-workflow extraction — `secrets: inherit` passes repository
and organisation secrets only, so environment secrets have to resolve from the
`environment:` key of the consuming job *in the called workflow*. Doing the split
here would mean moving Corpán's live secrets too. It is a follow-up.

## What the workflow does with them

- Fails hard, naming each missing secret, before doing any work.
- Verifies the provisioning profile's `application-identifier` is
  `F9AV5HKF6N.inc.corpora.dynawalla` and its `Name` is `dynawalla appstore ci`
  *before* building, so a wrong profile costs seconds rather than an hour.
- Reads the finished IPA and AAB back and asserts the bundle id / applicationId,
  the build number, `targetSdk`, `ITSAppUsesNonExemptEncryption`, the iOS SDK
  version, the App Store icon's absence of an alpha channel (ITMS-90717), the
  absence of tracking APIs and of the forbidden Android permissions, and the
  presence of native debug symbols.
  Every one of those absence checks first proves its input was readable — an
  assertion whose "pass" branch is reachable when the file is missing is not an
  assertion.
- After each upload, queries App Store Connect and Play and fails unless **this
  run** put the build there. Presence is not enough: the build number is
  minutes-since-epoch, so the duplicate these checks exist to catch is already
  on the store under the wanted number. TestFlight requires the build's
  `uploadedDate` to be at or after the moment the run started; Play snapshots
  the track *before* the upload and requires the versionCode to have been
  **added**.

## Build numbers

Minutes since the epoch (~29,750,000 today), shared by both platforms in a run.
Monotonic by construction; safely under Play's 2,100,000,000 ceiling.

**Never** switch to `github.run_number`: it is scoped to a workflow *file path*
and restarts at 1 on rename, so the number would **decrease**, and both stores
reject that at the end of a long job rather than at PR time.

Two runs cannot compute the same minute because `concurrency.group` is a single
constant for this workflow, so releases never overlap and one run takes far
longer than a minute. If that ever stops holding, the post-upload verification
does catch the duplicate — but only because both verifiers correlate the build
with **this run** (TestFlight: `uploadedDate` ≥ the run's start; Play: the
versionCode was absent from a pre-upload snapshot of the track). A presence-only
check would have passed on exactly that duplicate, because a colliding build
already carries the number being looked for.

**The cost of that constant concurrency group.** GitHub's queue depth per
concurrency group is one: when a run queues behind an in-progress run, any
*previously pending* run in the group is **cancelled**. With a ~60-minute iOS
job, three version bumps merged inside an hour means the middle release never
ships, and it is reported as `cancelled` rather than `failure`.

That is accepted deliberately. Removing the constant group re-opens the
same-minute collision, and the fix for that —
`max(preflight_highest + 1, minutes_since_epoch)` behind a store-querying
preflight — is a change to the number-generation scheme that
`RELEASE_ENGINEERING.md` and RISKS R-12 both reserve for its own PR and its own
verification run. This workflow has never executed end to end, so a preflight
added here could not be verified either.

**If a release is dropped this way:** push the tag `dynawalla-v<version>` for
the skipped version, or re-run from the Actions tab via `workflow_dispatch`.
