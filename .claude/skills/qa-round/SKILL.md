---
name: qa-round
description: Run a broad UAT/QA round the local-first way — one round branch, a live persona preview (phone via tailnet), a coordinator triaging the founder's raw feedback into a ledger, rapid fixes, then one batch PR to production. Use for broad polish/UAT across many screens; independent features keep the normal trunk-pr lane.
---

# QA round

Two ways of working ship to `main`:

- **Feature lane** (default, `trunk-pr`): one independent change → worktree → PR → CI → merge. Orderly for separable work.
- **QA round** (this skill): broad UAT where feedback touches anything (copy, layout, IA, content, engine) and arrives faster than PRs can land. Integrate on one branch, iterate against a live local preview, ship one batch.

## Roles
- **Founder** — clicks through personas (phone or desktop), sends raw feedback and screenshots.
- **Coordinator** (main Claude session) — turns every note into a ledger row, sets scope and priority, dispatches, verifies by looking (390 and 1280, light/dark), reports in one line, owns the ship. Never edits the served worktree.
- **Integrator** (one agent) — owns the round branch and both worktrees, fixes most UI/IA items, merges worker branches, keeps the preview healthy.
- **Workers** — few, short-lived branches off the round branch for isolated hard pieces (engine) or bulk content (Grok); merged by the integrator.

## Branch and worktrees
- One round branch: `qa/<yyyy-mm-dd>` (the 2026-11 round used `design-pass-2`).
- **Served worktree** — what the preview runs; fast-forward only, never edited.
- **Merge worktree** — every edit and merge happens here; run the check; then fast-forward the served branch. The preview only moves between checked states.

## Preview
- `amp/scripts/design-preview.sh start|restart|reseed|status|check` with seeded personas (`amp/scripts/design-personas.ts`) and the one-click switcher at `/dev/personas` (development only).
- Machine-local state lives outside the repo and outside /tmp (a reboot wipes /tmp): `AMP_PREVIEW_RUN` folder with `preview.env` (tailnet allowed host, trusted origin, `AMP_SEARCH_DIR`), the search model (`npm run build:search` with `AMP_SEARCH_DIR`), helper scripts, the ledger.
- Phone access: `tailscale serve --bg --https=<port> http://127.0.0.1:<web port>` (tailnet only).
- A watcher alerts on a sustained compile error, 500 or failed persona sign-in. Dependency change → `npm install`; migration change → reseed.

## Ledger (private, durable)
One row per note: id · screen/persona · the founder's exact words · **scope** · priority · owner · status.
- **Scope is local** unless the founder says "in general", "always" or "everywhere". Never widen a note into a rule.
- **Priority:** P0 broken, wrong math, dead end, privacy or money bug · P1 below the bar on a main journey · P2 polish.
- **Status:** open → in progress → in preview → confirmed.
Reply to each burst with a short triage. Batch by screen/component so two owners never touch the same files.

## Loop per item
1. Note → ledger → dispatch with the quote and its scope.
2. Fix in the merge worktree with the one targeted check it needs (no broad reruns).
3. `design-preview.sh check` (conflict markers, tsc, vite build, pages, sign-in) → fast-forward served branch.
4. Coordinator screenshots and looks.
5. Mark "in preview", tell the founder in one line.

## Ship (when the founder says so, or at a coherent checkpoint)
1. Merge `origin/main` into the round branch.
2. Full checks once: tsc, `npm run build`, `test:core`, touched DB suites, CI-plan tests, gitleaks. Deploy-only steps (`build-pdf-release`, `verify-pdf-delivery` as uid 65532, search build) only if the round touched them.
3. One PR round-branch → main; land; watch the deploy; smoke production.
4. Close superseded worker PRs, clean merged worktrees (verify each head is contained in the shipped branch), start the next round from the shipped SHA.
