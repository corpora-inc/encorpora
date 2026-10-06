# AHA continuation handoff

Snapshot: September 28, 2026. Start here in a fresh session, then recheck the
linked issues and service/store state. This is a stopping point, not a claim of
completed live AI acceptance.

## What is delivered

¡AHA! is a standalone Tauri app (`inc.corpora.aha`) with original K–8 standards
and prerequisite graph, adaptive practice, hints, local SQLite progress and
bounded structured visuals. Its learning engine is independent of Dynawalla.
It separates conceptual evidence, arithmetic fluency and delayed retention.
There are 90 verified numerical facets and 139 guided-only standards: do not
claim complete mastery assessment for every standard or undergraduate coverage.
Local variants are usable while AI is disconnected and are labeled accordingly.

| Platform | Delivered build | Source | Verified outcome |
|---|---|---|---|
| iOS | `0.1.0.29843614` | `133d2e45692d53ae436f8efbff8e96f2a9a84f73` | Signed upload, Apple VALID, existing internal group IN_BETA_TESTING |
| Android | `29843596` (version `0.1.0`) | `fddee28b093ef881ec6f872acaef20465e45e679` | Signed AAB, completed internal track, existing audience Console-attested |

The [iOS run](https://github.com/corpora-inc/encorpora/actions/runs/36458896328)
succeeded. The [combined run that delivered Android](https://github.com/corpora-inc/encorpora/actions/runs/36456923121)
failed on an iOS test-clock issue subsequently fixed in #845; its Android job
succeeded. Do not call that entire run green. Artifact hashes and delivery
mechanics are in [RELEASE.md](RELEASE.md).

Merged implementation: #840 adaptive practice; #842 experience polish; #843
current Free2Z SDK and durable answer recovery; #845 test-clock fix. #846
recorded the delivery evidence. No app code is awaiting merge at this snapshot.
The earlier native startup crash was fixed in #831: executable `aha`, display
name `¡AHA!`. Do not restore a Unicode executable name.

## What is and is not verified

- 99 frontend tests, 16 native tests and controller/SDK browser regressions passed
  at the documented implementation revisions. Browser tests use explicit fake
  native IPC; they are not production service evidence.
- Actual iOS simulator and Android emulator learning, restart and backup
  journeys passed. Later upgrades retained 12 and 17 existing local records,
  respectively. See [ACCEPTANCE.md](ACCEPTANCE.md) for exact scope and revisions.
- Physical TestFlight/Play installations and the full live AHA authentication,
  generated lesson, billing and recovery journey remain unverified.
- An explicitly authorized external tester was added to an AHA-only group;
  latest iOS build was assigned and submitted for beta review. Last API check:
  `WAITING_FOR_BETA_REVIEW`, automatic notification enabled. Group membership
  and EMAIL invitation type are verified; email delivery/acceptance and install
  are not. Internal access is unaffected. The owner accepted the external-review
  route. Keep identities, group IDs and review contact details private.

## Free2Z activation boundary

Both delivered builds use supported SDK source revision
`534d2a58c5baa6fa67ccd8a0d5ab1e18adb5b860`; source now pins the release tag `sdk-v0.2.0` (`40bfabff`, tool calling and `reasoning_effort` over `d63959f9`) for the next build. `d63959f9` added
schema member order preserved end to end (zuu #1143), typed catalogue capabilities, `preflight()`, native refusal details (`required_2z`) and distinct sign-in codes
(`user_cancelled`, `browser_unavailable`, `timeout`) on top of `42acc57f`'s opt-in `response_format` (#884). It keeps everything `e95becd6`
added: the sign-in spend-cap hint and `enforcement_reason` decoding, where a reason that contradicts
`enforced` fails `grant()` closed. Source now applies the production
"budget optional" policy (#879): any app budget the user sets in Free2Z, or none, with
`enforced: false` (e.g. `platform_disabled`) meaning no paid calls and local practice. Sign-in
suggests an optional 100 2Z monthly budget. Delivered builds still carry the test-era 500 2Z
total gate. The new policy is fixture-tested, not live-verified; see
[INTEGRATION_STATUS.md](INTEGRATION_STATUS.md#spending-policy-budget-optional-879). Builds use the registered native client, runtime
grant verification and advertised model discovery. There is no compile-time
AI-disable switch left to change. Backend activation is intended to work with
these binaries if the published contract and client configuration stay stable;
that expectation is not an end-to-end acceptance result.

Canonical SDK docs: [integration guide](https://github.com/free2z/zuu/blob/main/docs/free2z/sdk/INTEGRATION.md).
Read current docs and the private backend coordination thread referenced in the
private runbook before testing. The latest coordination update at handoff says
paid AI remains disabled, the SDK pin/API are unchanged, and the backend agent
will provide the first reconciled paid receipt/replay/balance checkpoint and
remaining shared allowance. Backend sign-in/balance evidence is not proof of
AHA mobile sign-in. No AHA paid call or purchase has occurred.

Do not begin paid acceptance until that checkpoint and remaining shared budget
are reconciled. No top-ups are authorized. The account-specific authorization
and aggregate limits are in the private runbook. Fresh service-enforced grants
and an estimate within balance and any app budget remainder must pass the app's checks. Never bypass grant
verification, fabricate receipts or substitute mocks to claim completion.

## Next worker: execution order

1. Fetch current `origin/main`, read this file and linked issue comments, and
   claim one issue in an isolated worktree using the trunk runbook. Do not resume
   an old worktree as though it were current trunk.
2. Read `operations/AHA_BETA_STATUS.md` in the private infrastructure repository.
   It contains backend coordination, access instructions and retained evidence
   locations. Keep all account/tester/credential details off public surfaces.
3. Recheck external review and invitation availability under #848. Do not grant
   company roles or enable a public link. Routine review feedback can be handled
   through accurate metadata or a small app fix; new legal agreements require
   the owner. No new upload is needed merely to poll review.
4. Under #811, obtain actual store-install evidence on each platform: local
   correct/incorrect answers, hints and force-close/reopen persistence. Record
   exact build/device/outcome, separating emulator from physical evidence.
5. Under #808, once the backend checkpoint is ready, test native browser login,
   callback/session persistence, balance, enforced current grant and models on
   both platforms. Use the remaining shared allowance for a generated lesson,
   independent grading, settled charge and durable answer/recovery checks.
   Unknown settlement blocks new calls. Recovery must reuse the original request
   identity; coordinate spending with the backend agent, not a fresh budget.
6. Finish the live/physical matrix in [ACCEPTANCE.md](ACCEPTANCE.md). If a bug or
   contract mismatch requires code, land a focused PR through all gates, then
   release only the affected platform(s) and verify actual store availability.
   Do not rebuild automatically just because the backend became healthy.
7. Update the linked evidence docs and close issues only against their actual
   acceptance criteria. A future worker must still be able to distinguish
   source, mock, native, store and live-service results.

## Follow-up issues

- [#808 — live Free2Z integration acceptance](https://github.com/corpora-inc/encorpora/issues/808).
- [#811 — physical/native and integrated learning acceptance](https://github.com/corpora-inc/encorpora/issues/811).
- [#848 — external TestFlight review and tester installation](https://github.com/corpora-inc/encorpora/issues/848).
- #812 internal delivery is closed; physical/live acceptance remains in the
  issues above. Do not reopen delivery solely because live AI is pending.

## Workspace and operational safety

The primary checkout has unrelated untracked Dynawalla files. Preserve them;
never clean/reset it to make cleanup pass. Several already-merged AHA worktrees
have been retained because the trunk cleanup preflight requires a clean primary
checkout. Their regenerable build caches were removed. Exact local inventory
and retained evidence are in the private runbook. New work starts from fetched
`origin/main`, not the stale local primary HEAD. Never force-remove a worktree.

The Project API lacked `read:project` scope; issue creation works, but board
transitions were not verified. Do not claim a Doing/Done board move.

Use [README.md](README.md) for development commands, [BUILD_STATUS.md](BUILD_STATUS.md)
for implementation boundaries, [INTEGRATION_STATUS.md](INTEGRATION_STATUS.md)
for SDK invariants, [RELEASE.md](RELEASE.md) for release verification and
[ACCEPTANCE.md](ACCEPTANCE.md) for actual testing evidence. Store artifacts,
screenshots and operational identities belong outside this public repository.
