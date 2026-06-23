# AGENTS.md — Trunk-Streaming Runbook

This is the worker loop for everyone shipping change to `corpora-inc/encorpora`:
humans-with-agent-teams and the agents themselves. The process is **identical**
whether 2 or 20 streamers are working — nothing depends on any one person.

> **Bonsai is the spine** (`encorpora/bonsai/`): *try 0, stay with 1, scale to N.*
> The CEO is no longer the gate. Machine-enforced checks are. Green = it ships to
> production. **Prune this doc as it ages — delete what you don't need.**

## The board: Inbox → Doing → Done

One Project board. Three columns. It is a fast-draining queue, **not an archive**.

- **Inbox** — anyone (a human after an hour of Juice Squeeze, or an ideation agent)
  drops issues here using the one Task template.
- **Doing** — a worker pulls exactly one issue here. **WIP = 1.** You own it to done.
- **Done** — merging the PR moves it here. Backlog that just sits is overproduction.

No priorities, no estimates, no P0–P3, no `area:*`/`risk:*`/`type:*` namespaces, no
dependency fields. **Order your own work by bonsai judgment**: pick the
lowest-hanging fruit and whatever unblocks collaborators. Labels are near-zero:
default `bug`/`enhancement`, plus `pack` (content/app-pack surface, for filtering)
and `needs-human` (the rare item parked for the device/CDP sweep). That's it.

## The worker loop

1. **Claim** one Inbox issue → move it to Doing. WIP = 1.
2. **Worktree.** Work in your own git worktree off the latest `main`:
   `git worktree add ../wt-<issue> -b <branch> origin/main`.
   Branch name: `<verb>-<short-slug>` (e.g. `fix-catalog-dedupe`,
   `add-stargate-zh`). No long-lived branches. The integration branch is **dead**.
3. **Continuously integrate `main`.** Merge the latest `main` into your worktree
   often, and always right before you push. Stay close to the trunk version — the
   merge queue will reject a branch that isn't up to date, so keep it small and fresh.
4. **Small squash PR.** One coherent change. Open the PR; it auto-links its issue.
   `main` is **squash-merge only** → your PR lands as exactly one commit.
5. **Pass the gates** (see below). Fix anything red. A false positive that blocks the
   queue is itself a detrimental process — fix the gate, don't route around it.
6. **Auto-merge.** Enable it (`gh pr merge --squash --auto`). When every required
   check is green, the **merge queue** integrates the latest `main`, re-runs checks,
   and merges with **no human in the path**. The issue moves to Done.

## The gates (what green means)

Every PR to `main` must pass, as required status checks:

- **`ci-gate`** — aggregates the path-filtered build/test/typecheck jobs
  (corpan-app, lambda, web/io, changed packs, terraform). Skipped sub-jobs are fine;
  any failure fails the gate.
- **`adversarial-review`** — headless adversarial agents (correctness / security /
  pack-compat lenses) read your diff and post inline findings. Pass = no unresolved
  **high-severity** findings. This is the gate that replaces the human gatekeeper.
- **`hygiene`** — secret scan (gitleaks) + big-file guard. No secrets, no large
  non-LFS blobs.

Branches must be **up to date with `main`** before merge (the queue enforces this).

## Pack back-compat checklist (read before changing any pack)

Packs ship to production constantly and must never break installed app versions
(Corpán 0.19.2 today). Back-compat routing already exists — **reuse it, don't reinvent**:
`corpan/corpan-app/src/contentPacks/catalog.ts` (`minAppVersion` / `maxAppVersion` /
`platforms`) gated by `filterCatalogForApp` and covered by `catalogFilter.test.ts`.

- [ ] Changed pack's own `npm test` + `npm run tsc` pass (CI runs them on change).
- [ ] `manifest.json` parses and validates against the schema.
- [ ] If you changed a catalog entry, **older app versions still resolve a working
      pack** — add/adjust the assertion in `catalogFilter.test.ts`. Never lower a
      pack's floor without a compat route for users below it.
- [ ] Never change a published pack's `voiceId` on republish (phantom duplicates).
- [ ] Post-merge smoke confirms the live ZIP URL is reachable; if it goes red after
      deploy, that's a fail-forward fix, not a rollback.

## How to implement & register a new pack

1. Scaffold under `corpan/packs/<pack-id>/` with `package.json`, `manifest.json`,
   source, and a pack-level `AGENTS.md` (see `corpan/packs/stargate-reader/AGENTS.md`).
2. Build locally; ensure `npm run build` and `npm test` pass.
3. Register it in `corpan/corpan-app/src/contentPacks/catalog.ts` with correct
   `minAppVersion` / `platforms`. Full delivery model:
   `corpan/corpan-app/src/contentPacks/DELIVERY_PLAN.md` and one-time external setup
   in `PRODUCTION_SETUP.md` (same dir).
4. Content packs auto-deploy to Pages on merge to `main`; narration / phrase packs go
   to S3/CloudFront via `ttsctl publish` (see `~/projects/ttsctl/NARRATION_PIPELINE.md`).
5. Add a `catalogFilter.test.ts` assertion proving the new entry routes correctly and
   doesn't duplicate-list across platforms.

## Fail-forward policy

Production is the trunk. We don't gate behind a human and we don't roll back by
default. If something lands broken, the fix is **another small squash PR through the
same gates** — fast. Atomic deploys mean a partial publish can't poison the catalog.
If a gate is producing false positives, fix the gate in its own PR; don't disable it
and don't merge around it.

## The thin human practice (shrinking over time)

A small set of work genuinely needs eyes or a physical device — visual regressions,
on-device install flows. Tag those `needs-human`. A worker can attach visual evidence
with the screenshot script (`scripts/visual-sweep/`). Periodically a human drains the
`needs-human` pile on real hardware. This fraction is deliberately thin and trends
toward 0 as we automate more of it.
