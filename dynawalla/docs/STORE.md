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

**Play's package name is locked by the first uploaded AAB** and cannot be changed without
Google support. Verify the generated Gradle `applicationId` **before** the first upload;
`X-03` exists for this reason alone.

**Android target API 36 is mandatory for new apps from 2026-08-31.** Dynawalla ships at
36 from PR-1.2, so this is don't-regress rather than migrate.

## Credentials

Account topology is [ADR-0015](DECISIONS/ADR-0015-developer-account-topology.md) and is
the founder's decision. Under the assumed same-account option:

| Credential | Reused or new |
|---|---|
| Apple Distribution certificate | **Reused** (team-wide) |
| iOS provisioning profile | **New.** Profiles bind to one explicit bundle id; no wildcard spans both `com.corpora.*` and `inc.corpora.*`, and **wildcards cannot carry IAP**. |
| Android upload keystore | **New**, deliberately separate, so one compromised key does not risk two shipping apps. |
| Play service account | **Reused** — but it does **not** inherit access. It needs an **explicit per-app permission grant** in Play Console on the new app record (`G-09`). |
| ASC API key | Reused; almost certainly needs re-minting at Admin role for app-record operations. |
| AWS secret | **New** path `dynawalla/store/credentials`, rather than widening the existing Corpán secret that a live purchase-verify lambda reads. |

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

1. **Creating the App Store Connect app record.** `POST /v1/apps` returns 404 and an ASC
   API key gets 403 on create.
2. **Creating the Play app record.** The `androidpublisher` v3 discovery document has no
   application-create method.
3. **The first Play release publish.** On a never-published app the API can only create
   **draft** releases. This is Google's anti-abuse gate, not a code bug, and should not be
   debugged as one — budget one Console-side publish (`G-10`).
4. **Play promo codes**, if ever needed.

Items 1–3 are roughly ten minutes of founder time and they sit on M1's critical path
(RISKS R-37).

## Compliance posture

The decision itself is [ADR-0001](DECISIONS/ADR-0001-kids-category-posture.md). The
**category election** is **a one-way door** — Apple Guideline 1.3 states the requirements
continue to bind "in subsequent updates, even if you decide to deselect the category" —
and it is deliberately **deferred to submission**, after monetization is wired, because
Play's Families Policy and the Kids Category both constrain how a purchase may be
surfaced to a child. It must be written into the ADR before M1's first submission
(`G-01`); submitting without it is electing by accident. The default if nothing changes
is to match Corpán's current category and rating (`TODO(store-recon)` — the specific
values are not asserted here).

The strict engineering posture is **Accepted unconditionally** as of 2026-07-25,
independent of the election, so nothing below waits on it:

- **No third-party analytics SDK, no advertising SDK, in either bundle.** Enforced by a
  CI dependency audit that is cross-checked against the submitted Play Data safety
  declaration (`G-05`). This is the only mechanical enforcement — every dependency
  addition is a compliance decision.
- **No AAID, IMEI, MAC address or phone number transmitted; no precise location
  collected** (`G-06`). Play's Families Policy forbids all of them for child users.
- **All instrumentation is on-device.** There is no server profile, no account, and no
  telemetry endpoint. The practical consequence is that the product's feel **cannot be
  A/B tested remotely**, which is why direct observation is the binding instrument
  rather than a supplement ([PLAYTEST-PROTOCOL.md](PLAYTEST-PROTOCOL.md)).
- **A parental gate stands in front of every link-out and every purchase flow** (`G-08`).
  The primitive ships in M1's shell, not at M10, so no surface is ever built without one.
  For a mathematics app an arithmetic challenge **is** the canonical Apple-acceptable
  gate, so this costs almost nothing here; the one catch is that its arithmetic must sit
  **above** the V1 curriculum band, or the children being taught grades 1–5 will solve
  the thing that exists to exclude them.
- **No nudge techniques.** The UK Children's Code Standard 13 restricts them and
  Standard 5 cautions against using children's data to keep them on a platform. The
  forbidden mechanics list in [MISSION.md](MISSION.md) is stricter than either.
- The privacy policy ships in-app and in both listings.

Apple age rating and Play target-audience/content-rating declarations must be **complete
and consistent with actual behaviour and with the CI audit** (`G-07`) — an inconsistency
between the declaration and the bundle is a review rejection at best.

## Release trigger

Tag `dynawalla-v*` triggers `release-dynawalla.yml`, which calls the shared reusable
workflow. `workflow_dispatch` is the fallback. A merge to `main` does **not** trigger a
release — the old version-bump detector is silently defeated by a batched merge queue
(`C-11`, RISKS R-14).

Build numbers are minutes-since-epoch and **do not change**. See
[RELEASE_ENGINEERING.md](RELEASE_ENGINEERING.md) for why, and for the preflight that
catches a non-monotonic number in ten seconds instead of sixty minutes.
