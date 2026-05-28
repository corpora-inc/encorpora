# Prune Audit

Pipeline that scores every English entry in `db.sqlite3` for naturalness,
utility, and translatability — then computes a quota-driven kill list to
slim the corpus from 27,353 phrases to ~10,000.

## Scripts (run from `corpan/dja/`)

```sh
# 1. Score every entry via codex CLI (resumable, parallel)
python3 audit/run_audit.py --batch-size 50 --workers 10 --reasoning low

# 2. Build the kill list against per-level quotas
python3 audit/select_cuts.py
#   → audit/cut_list.csv (ranked, lowest-score-first)
#   → audit/keep_list.csv

# 3. Snapshot the DB, archive doomed rows, hard-delete
python3 audit/apply_cuts.py            # dry-run summary
python3 audit/apply_cuts.py --apply    # actually delete

# 4. Rebuild the release DB
python3 make_release_sqlite.py --in db.sqlite3 --out release.sqlite3
```

## Targets (per-CEFR keep quota)

| Level | Current | Keep | Cut |
|-------|---------|------|-----|
| A0    |   441   |  380 |  61 |
| A1    | 5,891   | 2,500| 3,391 |
| A2    | 6,444   | 2,800| 3,644 |
| B1    | 10,780  | 3,400| 7,380 |
| B2    | 3,389   |   800| 2,589 |
| C1    |   385   |   100|   285 |
| C2    |    23   |    20|     3 |
| TOTAL | 27,353  |10,000|17,353 |

Override with `--targets A0:380,A1:2500,...`.

## What gets scored

`pass2_scores.jsonl` (one JSON object per line):

```json
{"id":12345,"naturalness":4,"utility":3,"translatability":5,
 "suspected_dup_of":null,"cut":false,"reason":"natural everyday request"}
```

Composite score (used in `select_cuts.py`):

```
score = 0.4·naturalness + 0.4·utility + 0.2·translatability − 0.5·dup_penalty
```

Within each (level × first-domain) bucket, entries are sorted ascending by
score and the bottom N are cut to hit the per-level quota. Domain
proportionality is preserved.

## Reversibility

`apply_cuts.py --apply` does three things before deleting:

1. Snapshots `db.sqlite3 → db.sqlite3.pre-prune-<timestamp>`
2. Writes `audit/pruned_archive_<timestamp>.json` containing every deleted
   entry, all of its translations, and its domain links.
3. Then performs the SQL DELETEs (with explicit cascade — Django's
   on_delete=CASCADE doesn't run here, we DELETE dependents ourselves).

To restore: read `pruned_archive_<timestamp>.json` and INSERT the rows back
in. (A `restore_archive.py` could be added; not yet needed.)

## Codex CLI quota reset

The audit was started against `codex exec` (gpt-5.4). Codex hit a usage
ceiling around 12,900 lines of scoring. The remainder was filled by
parallel Claude Code sub-agents using the same rubric, writing to the same
JSONL via `fcntl.flock(LOCK_EX)`.

When codex resets you can re-run for a refresh:

```sh
rm audit/pass2_scores.jsonl audit/pass2_errors.jsonl
python3 audit/run_audit.py --batch-size 50 --workers 10
```

Or re-score only a level (e.g. for a different cut budget):

```sh
python3 audit/run_audit.py --levels B2,C1
```

## Subagent-chunks layout

`audit/subagent_chunks/chunk_NNN.json` are 200-entry JSON arrays produced by
the bridge script that fed unscored entries to Claude Code subagents when
codex was offline. Safe to delete after the audit finishes.

## Completed run (2026-04-29)

- Scored: 27,351 / 27,353 entries (99.99% — codex 12.9k + Sonnet 14.4k)
- Cut: 17,353 entries to per-level quotas (≤2 unscored fallback)
- DB: 27,353 → 10,000 entries
- Snapshot: `db.sqlite3.pre-prune-20260429-032038`
- Archive: `audit/pruned_archive_20260429-032038.json`
  (full entries + 503,237 translations + 30,298 domain links)
- 9 languages added, fully translated:
  sv, no, da, nl, fi, ms, sw, el, he — 90,000 new translations
  (codex burned 3 quota cycles; Sonnet subagents filled gaps in parallel)
- Romanizations: el (codex), he (codex 4,179 + deterministic Python 5,821)
- **Release: 82M → 34M** = 58% smaller while covering more languages.

## Observed cut patterns (sample)

- Templated drink/object slot-swaps: "I want a coffee/tea/juice/..."
- Color-swap padding: "She painted her room purple/red/blue/brown..."
- Day/month padding: "I love November/Tuesday/September because..."
- Idiom translatability fails: "break a leg", "raining cats and dogs",
  "a knot in my gut", "spill the beans"
- Dated tech: "rewind the VHS", "fax the form", "burn a DVD"
- Named entities: "Paris", "Microsoft", "Redmond", "Hollywood"
- Cultural references: "Sunday service", "Christmas shopping", "Super Bowl"
- ESL textbookese: "I am very happy to drink the water now"
- Tautologies and meta: "This sentence is easy to understand"
- Stilted register: "Manufacturing involves making things in factories"
