# Dynawalla — agent delta

**This file is a delta.** The root [`AGENTS.md`](../AGENTS.md) is the runbook: worktree
→ small squash PR → gates → auto-merge. It applies here unchanged. Everything below is
what is *different* about `dynawalla/`.

Program state is in [`docs/`](docs/README.md). Read [`docs/STATUS.md`](docs/STATUS.md)
first — it tells you what exists.

## Before you write code

1. **[`docs/ACCEPTANCE_CRITERIA.md`](docs/ACCEPTANCE_CRITERIA.md) is the grading
   rubric.** Find the item your PR moves and quote its id in the PR body. If your work
   moves no item, say why it is still worth landing.
2. **[`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md) names your PR.** Work out of order only
   deliberately, and say so.
3. **Check [`docs/DECISIONS.md`](docs/DECISIONS.md) before proposing an architectural
   change.** Several ADRs exist specifically to stop a mistake being made twice. If you
   disagree with one, write a new ADR — never edit an accepted one in place.

## Rules specific to this tree

- **Never a fourth required status check.** Dynawalla jobs join `ci-gate.needs`. A
  path-gated required context never reports on PRs that miss its paths and blocks the
  merge queue forever.
- **No floats in `curriculum/` or `engine/`.** Exact integer/rational arithmetic only.
  `0.1 + 0.2 !== 0.3` marks correct decimal work wrong *deterministically*, so no flaky
  test ever fires. A lint suppression in those two directories is a review blocker.
- **`Exercise.prompt` is never a string.** It is a `PromptSpec` with a locale key and
  slots.
- **Skill ids are immutable forever.** They are mastery keys on learner devices. A rename
  is a new id plus `status: "deprecated"` + `supersededBy`.
- **A skill cannot go `active`** without a working generator (CG-7) *and* a registered,
  tested renderer for its answer schema and every required representation (CG-8). Do not
  satisfy CG-7 with multiple choice — CG-13 blocks it and
  [ADR-0002](docs/DECISIONS/ADR-0002-v1-scope-cut.md) explains why.
- **No new user-visible string without all five locales**, including CLDR plural
  categories. `npm run check:i18n` fails the build. **Translate directly** — do not
  resurrect the retired OpenAI translation scripts.
- **The work surface never waits for the world.** Nothing under `src/reactions/` or
  `src/world/` may import from `src/work/` or `engine/`; a boundary test fails the build
  if it does. Nothing awaits a reaction.
- **No streak, no timer, no loss.** The reaction weight function takes no run-length
  argument and a test asserts its signature.
- **Touching `src/work`, `src/reactions` or `src/world`?** Link the playtest evidence or
  say there is none.

## If your change touches native code

Read [ADR-0011](docs/DECISIONS/ADR-0011-native-workspace-and-patch-placement.md) in full
first. `[patch.crates-io]` lives in **each app's own `src-tauri/Cargo.toml`** and must
stay there; no manifest in this repo has a `[workspace]` section, so each app manifest is
its own implicit workspace root and a `[patch]` anywhere else is silently ignored — which
reverts Corpán to an `ndk-context` that aborts on Android Activity recreation, compiling
and passing every test on the way. Plugin identifiers and `links =` values never change.

## PR size

There is **no size limit**. `adversarial-review` chunks the diff, reviews every chunk
with every lens, and asserts the chunks reconstitute the diff exactly before calling a
model — so a large PR is reviewed in full or the check fails. It can no longer pass
having read a prefix.

Size is still a review-quality question, not a gate question: one generator family per
PR, one domain per node-promotion PR, because a reviewer holds one idea at a time. Split
a PR when it does two things, never to hit a byte count.

(This section previously said the gate truncated above `MAX_DIFF_BYTES` and told you to
split pre-emptively. That was true and is not any more — the hole was closed by chunking
rather than by the planned fail-and-split, and `MAX_DIFF_BYTES` no longer exists.)

## Never

Commit a keystore, `.p8`, service-account JSON, issuer id, key id, provisioning-profile
UUID, API token or any other credential. This repository is public. Name secrets by their
GitHub secret **name** only.
