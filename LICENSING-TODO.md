# Licensing — undecided, needs a founder call

Not a license. Not a rights statement. This file records an open question found
during a docs audit so it does not get lost. Nothing here grants or reserves
anything.

## Observable facts

- No `LICENSE`, `LICENCE`, or `COPYING` file exists in this repository.
- `gh api repos/corpora-inc/encorpora --jq .license` returns `null` — GitHub's
  license detector finds nothing.
- The repository is public.
- At least one shipped design decision assumes an open-source posture in-tree:
  `corpan/corpan-app/src/store/entitlements.ts:35` justifies preferring a stale
  Plus flag over ever blocking an offline subscriber with "the app is open
  source anyway."

## The question for the founder

Which license, and does that license invite outside forks and pull requests?
The three usual answers pull in different directions: permissive (MIT/Apache-2.0)
allows closed forks; copyleft (AGPL-3.0) invites contribution but constrains
commercial redistribution; source-available reserves rights explicitly.

Until that is decided, do not publish a license file or a rights statement —
either one is a legal posture and it is the founder's to set, not a doc PR's.
