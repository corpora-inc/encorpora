# Dynawalla — Store

App Store and Google Play bootstrap, compliance posture, and what is automatable.

**No credential value ever appears in this repository.** Secrets are referenced by their
GitHub secret **name** or their AWS Secrets Manager **path** only — never a key id, an
issuer id, a provisioning-profile UUID, a keystore password, a `.p8`, or a
service-account JSON. The repository is public (`G-11`).

## Identity

| | Value |
|---|---|
| Bundle id / applicationId | `inc.corpora.dynawalla` (founder decision #6 — note `inc.`, not `com.`) |
| Working product name | Dynawalla: Apprentice of Numbers — [ADR-0016](DECISIONS/ADR-0016-app-store-product-name.md) |
| iOS deployment target | 16.0, `ITSAppUsesNonExemptEncryption: false` |
| Android | `minSdk 26`, `compileSdk 36`, `targetSdk 36` |

**Two bundle-id conventions now coexist permanently.** `com.corpora.corpan` is immutable
in both stores. Any tooling deriving paths, keychain entries, `os_log` subsystems or
store lookups from a bundle-id prefix must take it as a **parameter** — a `corpan`
literal already appears in 7+ Rust/Swift/Kotlin sites (RISKS R-40).

> ## ⚠ The single most expensive mistake available in this document
>
> **The Play package name is locked FOREVER by the first uploaded AAB.** Not until the
> first release — by the first *upload*. It cannot be changed afterwards without Google
> support, and in practice it cannot be changed at all.
>
> **Read the generated Gradle `applicationId` with your own eyes and confirm it is
> exactly `inc.corpora.dynawalla` before that file is uploaded.** A Tauri-template
> default or a `com.corpora.dynawalla` typo ends the naming convention for that app
> record permanently. `X-03` exists for this reason alone (RISKS R-36).

**Android target API 36 is mandatory for new apps from 2026-08-31.** Dynawalla ships at
36 from PR-1.2, so this is don't-regress rather than migrate.

## Credentials

Account topology is [ADR-0015](DECISIONS/ADR-0015-developer-account-topology.md):
**same Corpora accounts as Corpán**, decided 2026-07-25. The matrix below was verified
live by GET-only API calls on that date.

| Credential | Reused or new |
|---|---|
| Apple Distribution certificate | **Reused** — `Apple Distribution: Corpora Inc`, expires 2027-04-16, team-wide. |
| Apple Team ID | **Reused** — `F9AV5HKF6N`. |
| iOS provisioning profile | **New.** Profiles bind to one explicit bundle id; no wildcard spans both `com.corpora.*` and `inc.corpora.*`, and **wildcards cannot carry IAP**. |
| Android upload keystore | **New**, deliberately separate, so one compromised key does not risk two shipping apps. |
| Play App Signing | **New enrolment.** |
| Play service account | **Identity reused; access is not.** It needs an **explicit per-app permission grant** on the new app record (`G-09`). **Proven:** the SA returns **403** on `com.corpora.homeschool` and `com.pako.app` — two sibling apps on the same account are already invisible to it. |
| ASC API key | **Reused as-is.** It does **not** need re-minting — see below. |
| ASC / Play tooling | **Reused** — `corpan/infra/asc/asc_monetization.py` and `corpan/infra/play/play_monetization.py` are already parameterized by bundle id / package name. |
| AWS secret | **New** path `dynawalla/store/credentials`. Do **not** widen `corpan/content-packs/verify` — a live purchase-verify lambda reads it. |

**Correction (2026-07-25): the ASC API key does not need re-minting at Admin role.** This
document previously said it "almost certainly" did. It does not: the existing key returns
200 on `/v1/bundleIds`, `/v1/certificates`, `/v1/profiles`, `/v1/devices` **and** on the
Admin-scoped `/v1/users`. It is already a Team key with Admin scope. Apple's actual rule
is that *Individual* keys cannot use the Provisioning endpoints; Team keys can. Budget
zero time for this.

GitHub environments: `dynawalla-ios`, `dynawalla-android` (alongside `corpan-ios`,
`corpan-android`). Note that `secrets: inherit` passes repository and organisation secrets
**only** — environment secrets resolve from the `environment:` key of the consuming job in
the *called* workflow. See [RELEASE_ENGINEERING.md](RELEASE_ENGINEERING.md).

**Do not copy any provisioning-profile UUID out of another product's setup document into
Dynawalla's configuration.** A profile bound to a different bundle id produces an
unsignable App Store build; there is at least one document in this repo that instructs
exactly that, and it is on the M0a expunge list.

## What is automatable, and what is not

Drive both stores by API. The browser is for the two things that have no API.

**Automatable** (reusing the existing parameterized ASC and Play tooling under
`corpan/infra/asc/` and `corpan/infra/play/`, both already keyed off a bundle-id /
package-name variable):

- Bundle ids, capabilities, certificates, provisioning profiles.
- Category, age-rating declaration including `kidsAgeBand`.
- Beta groups and TestFlight distribution.
- Store listings, screenshots, descriptions.
- Play Data safety declaration.
- IAP products and subscription groups, if
  [ADR-0013](DECISIONS/ADR-0013-monetization-model.md) calls for them.
- Build uploads, track promotion, release notes.

**Not automatable — budget founder console time:**

1. **Creating the App Store Connect app record.** There is no app-create operation in the
   API. Verified against Apple's OpenAPI spec 4.4.1: 966 paths, **no `apps_createInstance`
   operation**; `POST /v1/apps` 404s. Apple's own documentation says it outright:
   *"Don't use this API to create new apps; instead, create new apps on the App Store
   Connect website."* Stop looking for the endpoint.
2. **Creating the Play app record.** `androidpublisher` v3 has **no method to create your
   own app record.**
   **Trap — and note this is a *Google* method, not an Apple one:** the same API does
   contain `appstoreappsreview.createappstorehostedapp`
   (`POST .../androidpublisher/v3/appstore/{appStorePackageName}/apps:create`). It reads
   exactly like the endpoint you want. It is the pipeline for **third-party Android app
   stores** to register apps they host, not for publishing your own app to Google Play.
   Do not call it.
3. **The first Play release publish.** On a never-published app the API can only create
   **draft** releases. This is Google's anti-abuse gate, not a code bug, and should not be
   debugged as one — budget one Console-side publish (`G-10`).
4. **Play promo codes**, if ever needed.

Items 1–3 are roughly ten minutes of founder time and they sit on M1's critical path
(RISKS R-37).

**Possibly automatable, worth ten minutes of investigation:** `G-09`, granting the
service account per-app access, may be reachable via `androidpublisher`
**`grants.create`** — which needs the **numeric Play developer account id**, and that id
is **not recorded anywhere in this repo**. Treat this as a possible automation win, not a
certainty, and plan the founder console step as though it is manual until it is proven
otherwise.

**Operational findings, 2026-07-25:**

- The **Play Developer Reporting API is disabled** on GCP project `corpora1`, so the
  account's apps cannot be enumerated by API — they can only be probed by known package
  name. Any tooling that wants a list must be given one.
- **Play's closed-testing gate (12 testers for 14 continuous days) applies to *personal*
  developer accounts created after 2023-11-13; organization accounts are exempt.** The
  Corpora account's type is **unverified**. This is a founder console check and it is
  worth doing early: if it bites, it is a **two-week calendar hit on M1** that no amount
  of engineering recovers.

## Compliance posture

The decision itself is [ADR-0001](DECISIONS/ADR-0001-kids-category-posture.md). The
**category election** is **a one-way door** — Apple Guideline 1.3 states the requirements
continue to bind "in subsequent updates, even if you decide to deselect the category" —
and it is deliberately **deferred to submission**, after monetization is wired, because
Play's Families Policy and the Kids Category both constrain how a purchase may be
surfaced to a child. It must be written into the ADR before M1's first submission
(`G-01`); submitting without it is electing by accident. Note that the door is a
**readable API field**: `isOrEverWasMadeForKids` on `/v1/apps/{id}` is the permanent,
queryable record of the election.

The default if nothing changes is to match Corpán, which was verified live 2026-07-25:
**EDUCATION / REFERENCE, 4+, all declarations `NONE`, `kidsAgeBand: null`,
`isOrEverWasMadeForKids: false`.** All four Corpora apps are 4+ Education-or-Lifestyle and
**none has ever been in the Kids Category**, so a Kids submission would be the first and
inherits no in-house precedent.

**No Apple Kids band expresses this product at any V1 scope.** Apple requires choosing
**exactly one** of 5-and-under / 6-8 / 9-11 — a choice among three, not a maximum age.
Play's declaration is multi-select and expresses a range directly. Grades 1–6 ≈ ages 6–12
and **grades 1–5 ≈ ages 6–11, which still spans two Apple bands**, so the ADR-0002 scope
cut does not resolve this. Electing Kids forces one of: declare a band that misstates the
range, ship two SKUs, cut V1 down to a single band, or skip the category (a trap under
2.3.8 / 5.1.4(b)). Open founder decision — see
[ADR-0001](DECISIONS/ADR-0001-kids-category-posture.md).

The strict engineering posture is **Accepted unconditionally** as of 2026-07-25,
independent of the election, so nothing below waits on it:

- **No third-party analytics SDK, no advertising SDK, in either bundle.** Enforced by a
  CI dependency audit that is cross-checked against the submitted Play Data safety
  declaration (`G-05`). This is the only mechanical enforcement — every dependency
  addition is a compliance decision. The **forbidden categories** are wider than most
  teams assume and are listed in [RISKS.md](RISKS.md) R-47; the one that surprises people
  is **third-party crash reporters** (Crashlytics, Sentry, Bugsnag), because 1.3 names
  *device information* explicitly.
- **Play's hard identifier list for child-directed apps**, none of which may ever be
  transmitted: **AAID, SIM Serial, Build Serial, BSSID, MAC, SSID, IMEI, IMSI**. Never
  request the phone number via `TelephonyManager`. **No location permissions at all** —
  not coarse, not "only while using" (`G-06`).
- **All instrumentation is on-device.** There is no server profile, no account, and no
  telemetry endpoint. The practical consequence is that the product's feel **cannot be
  A/B tested remotely**, which is why direct observation is the binding instrument
  rather than a supplement ([PLAYTEST-PROTOCOL.md](PLAYTEST-PROTOCOL.md)).
- **A parental gate stands in front of every link-out and every purchase flow** (`G-08`).
  The primitive ships in M1's shell, not at M10, so no surface is ever built without one.
  **The challenge is never arithmetic** — Apple's canonical gate is a maths problem, which
  is exactly why it is useless *here*: a grade-4 child beats their parent to `6 × 7`.
  (Apple permits arithmetic gates; this is our judgement, not a store rule.)
  Reading load is the real barrier. Randomized, non-persistent across sessions, one
  component used on both platforms (Play mandates no general gate). Full design
  constraints in [ADR-0005](DECISIONS/ADR-0005-shell-and-routing.md); guarded surfaces in
  [ADR-0001](DECISIONS/ADR-0001-kids-category-posture.md).
- **No nudge techniques.** The UK Children's Code Standard 13 restricts them and
  Standard 5 cautions against using children's data to keep them on a platform. The
  forbidden mechanics list in [MISSION.md](MISSION.md) is stricter than either.
- **The privacy policy ships in-app and in both listings** — required by both stores
  regardless of what is collected, and it must describe **retention and deletion**. Render
  the in-app copy as a **screen, not an external URL**: an external URL needs a parental
  gate in front of it, an in-app screen does not.

Apple age rating and Play target-audience/content-rating declarations must be **complete
and consistent with actual behaviour and with the CI audit** (`G-07`) — an inconsistency
between the declaration and the bundle is a review rejection at best.

### The disclosure posture this buys

Both stores define "collect" as **transmitting off-device**. Local-first therefore yields
**Apple "Data Not Collected"** and **Play "no data collected, no data shared"** — the
strongest declarations either store offers, and they are earned by the architecture rather
than argued for.

**Exactly two things break it**, and both are choices this program has already made
against:

1. **A third-party crash SDK** → a Diagnostics disclosure.
2. **A receipt-validation backend** → a Purchases disclosure. This is the live one:
   [ADR-0013](DECISIONS/ADR-0013-monetization-model.md) wires a subscription, so
   **keep entitlements local** or the declaration changes.

### Planned mechanical gates

Recommended, **not implemented here** — `.github/**` belongs to another agent, and these
are recorded as planned work rather than smuggled in. Priority order:

1. **A network-egress test.** Run the app under a proxy and assert **zero** outbound
   requests on a cold launch and through a complete lesson. This converts "we collect
   nothing" from a claim into a test, and it is the highest-value guard here by a wide
   margin — it catches a chatty transitive dependency that no manifest inspection would.
2. **Merged-manifest assertions on Android**: the *merged* `AndroidManifest.xml` contains
   no `AD_ID` permission, no `ACCESS_*_LOCATION`, no `READ_PHONE_STATE`, and
   `targetSdk >= 36`. Merged, not the source manifest — a dependency contributes
   permissions the app never wrote.
3. **iOS binary and plist assertions**: no reference to `ASIdentifierManager` or
   `ATTrackingManager`, and **no `NSUserTrackingUsageDescription` in `Info.plist`**. A
   Kids app must never show the ATT prompt.
4. **Fail the build on any newly-appearing third-party `PrivacyInfo.xcprivacy`** — a new
   one appearing is a new SDK arriving, which is a compliance decision that must not pass
   silently.

### Do not plan on adding ads later

**Play's Families Self-Certified Ads SDK program is currently not accepting new
applicants**; Google says the application window will reopen, on no stated date. "Ship
clean now, monetize with ads if the subscription underperforms" is **not an available
fallback** — it depends on a window that is shut today and may or may not be open when
we want it. Price that uncertainty into R-45.

## Release trigger

Tag `dynawalla-v*` triggers `release-dynawalla.yml`, which calls the shared reusable
workflow. `workflow_dispatch` is the fallback. A merge to `main` does **not** trigger a
release — the old version-bump detector is silently defeated by a batched merge queue
(`C-11`, RISKS R-14).

Build numbers are minutes-since-epoch and **do not change**. See
[RELEASE_ENGINEERING.md](RELEASE_ENGINEERING.md) for why, and for the preflight that
catches a non-monotonic number in ten seconds instead of sixty minutes.
