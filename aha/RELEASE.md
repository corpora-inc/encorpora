# ¡AHA! internal beta delivery

Package / bundle identifier: `inc.corpora.aha`. Read the release version from
`aha-app/src-tauri/tauri.conf.json`; do not infer a delivered build from this file.

## Delivery status

As of September 28, 2026:

| Target | Verified distribution evidence | Remaining blocker |
|---|---|---|
| TestFlight internal | Version `0.1.0`, build `0.1.0.29843614`: signed upload, Apple `VALID` processing, assignment to the existing nonempty internal group, and `IN_BETA_TESTING` verified | Actual tester installation and restart confirmation remain unverified |
| Google Play internal | Version `0.1.0`, build `29843596`: signed AAB, exact newly completed internal release verified through the official API, and saved existing audience verified through Console attestation | Physical store installation remains unverified |

The [updated iOS release](https://github.com/corpora-inc/encorpora/actions/runs/36458896328)
verified the signed upload, Apple `VALID` processing, and `IN_BETA_TESTING` for the
existing nonempty internal group. The retained IPA's bundle, visible name, ASCII
executable and version were independently checked. Its SHA-256 is
`2967596c6b90fbe7aff8d5a6deb3b87ca8d7b33ee18bde7343dae5a02bf99065`.

The [updated Android release](https://github.com/corpora-inc/encorpora/actions/runs/36456923121)
passed bundle identity, signing, 16 KiB compatibility, completed-track and audience
verification. Its signed AAB SHA-256 is
`3dab167e1e04a82c41ce432281a31902b300fd8d49e9db67370c05bfbcd6e927`.
That combined run stopped on iOS before native compilation due to the test-clock
race fixed in #845; it must not be described as a successful whole workflow.

The earlier [Android artifact run](https://github.com/corpora-inc/encorpora/actions/runs/36358416568)
passed package, signing, and 16 KiB checks. Its initial Console upload was completed
through the official publishing API, with retained pre/post track evidence and no
duplicate upload. The [iOS run](https://github.com/corpora-inc/encorpora/actions/runs/36359478967)
built and uploaded successfully but failed its final check on an unsupported Apple
relationship-read endpoint. A reviewed corrected helper subsequently verified that
same existing build and group; the original workflow is still a failed run.

On September 28, the existing authorized owner email list was confirmed saved and
selected for AHA's internal track after reloading Play Console. Existing audience
selections were left unchanged. Private screenshot and Console-observation evidence
support the build-scoped audience attestation; this does not prove installation.

An authorized tester must still install through each store and confirm the native
learning/restart journey. Live paid AI acceptance awaits production activation.
Operational details, retained evidence, and signing configuration belong in the [private infrastructure runbooks](https://github.com/corpora-inc/infra-private), never public logs or screenshots.

## External TestFlight follow-through

On September 28 the owner authorized an additional AHA-only external tester.
The external group and tester membership were created, build `0.1.0.29843614`
was assigned, and Apple accepted the beta review submission. Latest readback:
`WAITING_FOR_BETA_REVIEW`; automatic notification is enabled. EMAIL invitation
type does not establish actual delivery, acceptance or installation.

Existing internal TestFlight access remains active without external beta review.
The owner accepted the external route; do not add App Store Connect roles to
avoid review. Review metadata accurately describes local practice and the pending
paid-AI activation. Follow approval, invitation and actual installation in
[#848](https://github.com/corpora-inc/encorpora/issues/848). Audience and contact
details stay in the private infrastructure runbook.

## Reproducible release path

`.github/workflows/release-aha.yml` handles AHA tags (`aha-v<version>`) and manual
runs on `main`. It does not react to other products’ changes. Tag versions must
match Tauri configuration, and the selected commit must be on trunk. The workflow
uses Node 24, Rust 1.97.1, Android SDK 36 / NDK 28.2.13676358, and a macOS 26
runner with its installed Xcode selected by the workflow.
The npm lockfile and source-pinned Rust dependencies belong to the app’s build.

After app records and existing authorized testing audiences are configured:

```bash
gh workflow run release-aha.yml --repo corpora-inc/encorpora --ref main -f platforms=both
```

Tester notes: add `-f release_notes='…'` to set TestFlight “What to Test” and the
Play internal release notes (en-US). Without it, the run writes “Build N from
<sha>” plus the subjects of recent `aha/` commits (since the previous `aha-v*` tag
or successful release run, at most 30). Notes are sanitized (emails, handles, tokens and keys are
redacted) and truncated to 4000 characters for TestFlight and 500 for Play. The
TestFlight text is set after the build is verified; a failure there is reported
without failing delivery.

Normal delivery checks app/audience access before expensive builds. Android requires
a completed internal release; it will not silently substitute a draft on a new
app. If Play requires the initial release to be completed in Console, finish that
normal setup action and rerun verification. No workflow step invites new people,
creates public releases, or purchases credits.

Signing material is injected through existing platform secret storage. Missing
configuration fails the run. Account-specific values and setup instructions are
kept in private runbooks. The optional native Free2Z public-client configuration
does not enable an unverified gateway or authorize paid tests by itself.

Only one AHA release runs at a time. Build numbers use minutes since the Unix
epoch; pre-upload snapshots and upload timestamps reject duplicate evidence.
GitHub keeps only one pending run per concurrency group, so a superseded pending
release must be dispatched again if still needed.

## Artifact and acceptance checks

- iOS checks the provisioning profile’s bundle, expiry, and distribution type;
  installs AHA icons; exports a signed IPA; and checks its bundle/build identity.
  It waits for Apple processing, assigns the build only to the configured existing
  internal group, confirms that group has a tester, and requires internal beta
  availability. Upload transfer success alone does not pass.
- Android checks the AAB package/version/minimum/target SDK and requested
  permissions. Every bundled `.so` must have 16 KiB-compatible ELF LOAD segments
  and RELRO endpoints; bundle metadata must request 16 KiB APK packaging.
  The upload uses the app-specific upload key, then verifies a newly added,
  completed internal release and a configured existing group audience.
- The Play API does not expose every Console email-list configuration. If it
  cannot verify an existing group audience, release requires the one-build
  Console evidence described below. Neither an API group reference nor an
  operator attestation proves installation.
- Both platforms still require an authorized tester’s real installation and the
  native learning/authentication/recovery journey. Record the actual device,
  version/build, processing state, audience availability, and install outcome.
  No release workflow can demonstrate learning gains or live Free2Z readiness.

Artifacts are named `aha-ios-<build>` and `aha-android-<build>` and retained for 14
days. Inspect the completed run for its actual artifact path; do not assume an
artifact exists after a failed preflight. AAB checks precede signing, so a preserved
artifact from a failed signing step is not a signed deliverable.

## Initial Android Console setup

A newly created app can need a first signed bundle in Console before track setup
works. Dispatch `platforms=android-artifact` to produce that concrete bundle. This
mode checks access to the exact app, builds and signs the AAB, and keeps the same
package/version/SDK/permission/16 KiB checks. It runs no iOS job and skips all store
upload, audience, and release-verification steps. Its summary explicitly reports
an **artifact-only** outcome, never tester delivery.

Use the signed artifact for the normal initial Console flow. After the owner has
completed any required declarations and an existing audience is configured,
verify the exact uploaded version and completed internal track. Do not upload the
same version again just to make an automated workflow green. Retain a pre-upload
track snapshot when performing a manual first upload, so later verification can
prove it is a newly added release. An artifact-only run cannot satisfy delivery
acceptance on its own.

## Console email-list audiences

Play's public tester API returns Google Group references, not Console email-list
membership. For an existing authorized email audience, verify the exact AHA
internal track in Console and retain evidence privately. Do not create a Google
Group merely to satisfy the API or add new people to an audience.

A manual Android dispatch may supply `build_number` and
`play_email_audience_attestation` together. Reserve a unique build number using
minutes since the Unix epoch; the gate accepts only the preceding hour through
five minutes ahead of its clock. The JSON attestation has exactly these fields:

- `version`: integer `1`.
- `bundleId`: `inc.corpora.aha`; `track`: `internal`.
- `versionCode`: the exact reserved build number as a string.
- `verifiedAt`: UTC Unix seconds of the actual Console observation.
- `existingTesterCount`: integer from 1 to 100, all already authorized.
- `evidenceSha256`: lowercase SHA-256 of the retained private evidence.

Keep names, email addresses, screenshots, account identifiers, and access details
out of workflow inputs and logs. Include a random evidence identifier in the
private evidence before hashing, so its digest cannot be guessed from a tester's
identity. The digest references operator-reviewed evidence; it is not proof from
the Play API. Do not produce an attestation until the selected audience has
actually been saved and re-read in Console.

The attestation must be no more than one hour old at preflight and must predate
the run. After native building, the same exact build and run may use it for up to
four hours. Expired evidence requires fresh Console verification; do not reupload
or generate another release automatically. The output explicitly says
**Console-attested**, and still requires a newly added completed internal release.
An authorized tester's installation remains separate acceptance evidence.

## Local verification

```bash
python3 -m unittest discover -s aha/scripts -p 'test_*.py'
actionlint .github/workflows/release-aha.yml
python3 aha/scripts/release_verify.py elf /path/to/app.aab
```

The verifier tests use synthetic ELF files and mocked store responses. They
cover malformed/no-load ELF files, invalid LOAD/RELRO alignment, a later invalid
library in a bundle, empty bundles, wrong/external/empty TestFlight groups,
processed-but-unavailable and stale builds, draft Play releases, and absent
audiences. These tests do not establish a live store upload.

Public support/privacy pages are published by the existing website workflow at
`/aha/`, `/aha/support/`, and `/aha/privacy/`. Confirm their live HTTP responses
before entering them in store metadata. The AHA policy describes local learning
storage and prospective Free2Z data flow separately from offline-only products.
