# AGENTS.md — How we ship

This repo runs **trunk-based**: `main` is the one source of truth and it streams straight to
production. There is **no integration branch** and **no human in the merge path**. Many agent-workers
push small changes continuously; machine-enforced gates keep `main` sacred. The model is identical
whether 2 or 20 workers are streaming (*try 0, stay with 1, scale to N* — see `bonsai/`).

> The software is the product. No process survives here unless it makes shipping a change **faster**.

## The loop

1. **Claim** one issue from the **Inbox** column of the project board. WIP = 1 — finish it before
   taking another (*avoid context switching*).
2. **Worktree.** Work in your own git worktree off the latest `main`:
   `git worktree add -b agent/<issue#>-<slug> <path> origin/main`
3. **Build small.** Aim for the smallest change that is a real improvement (*incremental change*).
   One issue can become several small PRs — that's good.
4. **Stay close to the trunk.** Continuously merge the latest `main` into your branch as you work
   (`git fetch origin main && git merge origin/main`). Long-lived/stale branches are the enemy.
5. **PR.** Open a PR linked to the issue (`Closes #<issue#>`). Keep the title clean — it becomes the
   squash-commit message.
6. **Gates, not gatekeepers.** Merge is blocked until all required checks are green (below). No human
   approval is required. When green, it **auto-merges via the merge queue** as one squashed commit and
   the issue moves to **Done**.
7. **Prune.** Remove your worktree/branch when merged. Delete what you don't need.

## The gates (what "green" means)

A PR merges only when these required checks pass:

- **`ci`** — build + test + typecheck for every changed area.
- **`adversarial-review`** — independent agents review the diff (correctness / security / pack
  back-compat) and emit pass/fail. This is the gatekeeper now.
- **`secret-scan`** — no secrets, no oversized non-LFS blobs.
- **`pack-backcompat`** — changed packs still work for older app versions (see checklist).

`main` is **squash-merge only**, branches must be **up to date with `main`** before merging, and the
**merge queue** serializes everyone so `main` never takes a semantic conflict.

> Some gates are still being built — see the `[trunk]` tracking issues. Until one is live, its
> discipline is still expected of you manually. Prune this note once they're all enforced.

## Releases stream from `main`

Three release surfaces, all downstream of merge:

- **Content/app packs** → auto-deploy to GitHub Pages on merge (`.github/workflows/deploy-pages.yml`).
  Bumping a pack's `manifest.json` `version` is what ships an update to users.
- **Native app** (Corpán, currently 0.19.2) → app-store release, tagged from `main` (no integration
  branch). Many pack PRs land between app releases; never break the shipped app version.
- **Narration / phrase packs** → S3/CloudFront via `ttsctl publish` (out of band).

## Pack back-compat checklist (do not break shipped users)

Many users never upgrade. The catalog's version-routing is our public contract.

- The app filters the catalog by `minAppVersion` / `maxAppVersion` / `platforms`
  (`corpan/corpan-app/src/contentPacks/catalog.ts`, tested in `catalogFilter.test.ts`).
- If a pack change needs a newer app, **add a version-gated catalog entry** — do not mutate the entry
  older apps resolve. Keep the old pack version resolvable for old `minAppVersion` ranges.
- Validate the manifest schema; run the pack's own `npm test` + `typecheck`.
- Graceful degradation over hard breaks. 0.20.0 users get the new experience; 0.19.2 users keep working.

## Registering a new pack

1. Create the pack under `corpan/packs/<id>/` with a valid `manifest.json` (`id`, `name`, `version`,
   `entry`, …). See `corpan/packs/PACK_DEV.md`.
2. Add its build to `.github/workflows/deploy-pages.yml` so it bundles + publishes on merge.
3. Add a catalog entry with the right `minAppVersion`/`platforms`.
4. Open the PR; the gates handle the rest.

## Fail-forward

Production over perfection-in-a-branch. If something slips through, the fastest fix is another small
PR to `main`, not a rollback drama. Streaming-version URLs make most pack issues a forward fix.

## What needs a human

Almost nothing. Label `needs-human` only for things automation can't yet judge — mostly visual/UX.
Those wait for the periodic human + physical-device/CDP sweep. Everything else: ship it.

## What we deliberately don't do

No priorities, no estimation, no `type:*`/`area:*`/`risk:*` label taxonomy, no dependency fields, no
long-lived branches, no disposable integration branch, no mandatory human approvals. Order your own
work by what unblocks the most downstream value. Add process back only when it provably ships faster.
