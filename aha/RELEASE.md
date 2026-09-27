# ¡AHA! internal beta delivery

Package / bundle identifier: `inc.corpora.aha`. Read the release version from
`aha-app/src-tauri/tauri.conf.json`; do not infer a delivered build from this file.

## Delivery status

As of September 27, 2026:

| Target | Verified distribution evidence | Remaining blocker |
|---|---|---|
| TestFlight internal | No uploaded, processed AHA build or tester availability verified | App record and an existing authorized internal tester are verified; signed build upload, processing, and installation remain unverified |
| Google Play internal | No AHA internal release or tester availability verified | App-creation access is available; the owner must review the required policy/export declarations and complete app setup |

These are observed access/setup blockers. Neither an unsigned native build nor a
browser preview satisfies either delivery target. Operational details and signing
configuration belong in the [private infrastructure runbooks](https://github.com/corpora-inc/infra-private), never public logs or screenshots.

## Reproducible release path

`.github/workflows/release-aha.yml` handles AHA tags (`aha-v<version>`) and manual
runs on `main`. It does not react to other products’ changes. Tag versions must
match Tauri configuration, and the selected commit must be on trunk. The workflow
uses Node 24, Rust 1.97.1, Android SDK 36 / NDK 28.2.13676358, and Xcode 26 runners.
The npm lockfile and source-pinned Rust dependencies belong to the app’s build.

After app records and existing authorized testing audiences are configured:

```bash
gh workflow run release-aha.yml --repo corpora-inc/encorpora --ref main -f platforms=both
```

The workflow checks app/audience access before expensive builds. Android requires
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
  cannot verify an existing group audience, the check fails explicitly; an
  operator must verify the Console audience and actual tester access. An API
  group reference by itself does not prove membership or installation.
- Both platforms still require an authorized tester’s real installation and the
  native learning/authentication/recovery journey. Record the actual device,
  version/build, processing state, audience availability, and install outcome.
  No release workflow can demonstrate learning gains or live Free2Z readiness.

Artifacts are named `aha-ios-<build>` and `aha-android-<build>` and retained for 14
days. Inspect the completed run for its actual artifact path; do not assume an
artifact exists after a failed preflight. AAB checks precede signing, so a preserved
artifact from a failed signing step is not a signed deliverable.

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
