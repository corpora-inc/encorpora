# Release bar: first report, 2026-11-27

The first check of the crane engine against the release bar (`../../README.md`,
"Release bar"; `../../release-bar.yaml`; `harvest_eval gate`). This is an
**interim report on heldout-v2** (73 items). The certifying set, heldout-v3
(323 items, hidden), is frozen and waits for the full answer cache and the core
lane's answer-quality fixes before it is run.

Systems: `main` at `e113660ed` (#2580 local support, #2588 answer first and
tables, #2589 coverage gate 0.4, #2591 evidence sentences), pack built from the
same commit, dense retrieval and `--dense-gate 0.2:0.77` as in
`../2026-11-27-dense-gate/`. The frontier comparisons are in
`../2026-11-27-frontier/`.

## Against the bar (heldout-v2)

| Criterion | Bar | Engine + gpt-oss 20B | Engine, model off | Sonnet alone | Opus alone |
|---|---|---|---|---|---|
| Fully correct (59 answerable) | ≥ 90% | **47.5%** (35.6–61.0) | **37.3%** (25.4–49.2) | 84.7% (74.6–93.2) | 79.7% (67.8–89.8) |
| Correct declines (14 must-decline) | ≥ 95% | 92.9% | 92.9% | 100% | 100% |
| Unsupported claims in shipped answers | 0 | **6** (in 5 answers) | **7** (in 3 answers) | 21.4% of claims; 86% of answers | 35.7% of claims; 100% of answers |
| Every quote verbatim | 100% | 100% (177) | 100% | no quotes | no quotes |
| Every citation real | 100% | 100% | 100% | 96.0% | 89.6% |
| Beats Sonnet and Opus alone on fully correct | yes | no | no | – | – |
| Set not in the bake | no copies | 0 copies, 0 look-alikes | same | – | – |
| Set size | ≥ 300 | 73: interim only | | | |
| **Gate** | | **FAIL** | **FAIL** | | |

Gate outputs: `heldout-v2/gate-harvest-gpt-oss-20b-dense-gate.md` and
`heldout-v2/gate-harvest-model-off-dense-gate.md` (with JSON).

## What fails and why

1. **Fully correct is about half the bar (47.5% against 90%).** Of the 59
   answerable items, the gpt-oss system gets 28 fully correct, 14 partly, 6
   wrong, and declines 11 (19% of answerable items). The 14 partial answers
   fall into three kinds, per the judge: a required part left out (a deadline,
   a second condition, the second half of a two-part question); the right rule
   quoted but never applied to the question ("never says the 2005 crane is
   OK"); or an unrelated passage mixed in (a land rule in a floating-crane
   answer, construction rules in a general-industry one). Sonnet alone answers
   85% from memory but cannot pass either, with 21% of its claims unsupported.
2. **Unsupported claims are back, now that model text is kept.** #2591 lets
   gpt-oss's text survive in 48 of 73 answers (9 before), and 5 of those
   answers carry an unsupported claim. With the model off, 3 answers carry one:
   the new answer-first lines (#2588) that lead with a baked fact or
   explanation sentence. The bar allows none.
3. **One decline is missed:** crane-v2-0066 (an ASME B30.7 question) gets a
   partial answer instead of a decline, so declines are 13 of 14 (92.9%, bar
   95%).
4. **Weak topics** (fully correct, gpt-oss system; v2 has 1–10 items per
   topic, so these are signals, not measurements): operational aids 0 of 4,
   power lines 3 of 10, operator duties 1 of 4, wire rope 1 of 4, crawler/truck/
   locomotive 1 of 3, and assembly/disassembly, rigging, operator
   qualification and tower cranes at half. The topics at or near 100% are
   overhead and gantry, derricks, inspections and safety devices.
5. **Quotes and citations already meet the bar** in every engine run (100%
   verbatim, 100% real). The frontier models do not (Sonnet 96%, Opus 90% of
   citations exist).

## heldout-v3 (hidden, certifying)

Written like v1 and v2 by `tools/author.py --set v3 --avoid heldout-v1.jsonl
heldout-v2.jsonl`:

| Check | Result |
|---|---|
| Authored | 338 items in 26 batches: the v1 section groups at 12 each, one batch for §1926.1443 and the appendices, one on wind, load charts and multiple-crane lifts, three must-decline batches (`claude-opus-5-5`, $5.26) |
| Independent check (`claude-sonnet-5-5`) | 313 keep, 22 flag, 3 drop; 25 gold answers corrected |
| Eval-lane resolution of the 22 flags (read against the full text) | 7 were the checker's truncated context, cleared; 2 needed one more gold paragraph, added; 3 gold answers fixed; 6 questions did not say which industry or rope type, now stated; 1 dropped as ambiguous; 3 kept for an expert (one with its gold reworded). Of the checker's 25 corrected answers, the 8 that name sections outside their gold were each checked as correct cross-references |
| Near-duplicates dropped (against v1, v2 and each other) | 11 |
| Gold section ids / key quotes exact against the eCFR split | 463 / 463, 254 / 254 |
| Spot check | 12 random items (9 answerable, 3 must-decline) against the section text: all correct |
| Items | **323**: 265 answerable, 58 must-decline (18%); 53 marked for expert review |
| Coverage of the v2 gaps | §1926.1443 (1 item), Appendix B (4), Appendix C (15), Appendix A by reference (2) |
| sha256 | `b31eb13f8f4c79da2a2cd8a50b8e4910a928a37db605f6e748702abb4b5cb6ae` (registered in `release-bar.yaml`) |

The set, its authoring outputs and every item-level result stay in the lab's
private store. This repository holds only the hash, the tooling and aggregate
results.

## Spend

| | Claude-reported cost |
|---|---|
| v3 authoring (Opus) | $5.26 |
| v3 independent check (Sonnet, 34 calls) | not recorded by the tool |
| Sonnet alone and Opus alone answers on v2 | $1.22 + $2.62 |
| Judging v2 (frontier $8.94, engine $2.71) | $11.65 |

Weekly Claude usage reached 57% during this work, past the content lane's 55%
runner ceiling. So the v3 judged runs (about 2,000 judge items across four
systems) are held for the one final measurement, not spent twice.

## Next: the full measurement

When the full answer cache (2,334+ answers, alias repair) and the core
answer-quality fixes are on `main`: build the pack, run the engine (model off
and with gpt-oss) plus Sonnet and Opus alone on heldout-v3 and v2, gate each
engine system, and list every failing criterion and category with its items'
reasons (ids only for v3).
