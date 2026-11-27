# crane/eval

The held-out evaluation set for the crane pack, and the source text it was
verified against. The harness that runs it is `harvest/eval` (corpus-agnostic);
`eval.yaml` here configures it for this corpus.

```sh
cd harvest/eval
python3 -m venv .venv && .venv/bin/pip install pyyaml
.venv/bin/python -m harvest_eval run --config ../../crane/eval/eval.yaml \
    --pack <crane pack dir or .sqlite> --binary <harvest> --out <dir>
```

## Files

| Path | What |
|---|---|
| `heldout-v1.jsonl` | 342 items, one JSON object per line. |
| `heldout-v2.jsonl` | 73 fresh items (59 answerable, 14 must-decline), written after the core lane tuned its dense gate on v1; same process and checks. See `results/2026-11-27-dense-gate/README.md`. |
| `authoring/raw-v2/`, `authoring/review-v2.json`, `authoring/verify-log-v2.json` | v2's authored batches, independent check and verification log. |
| `sources/registry.json` | Source editions: eCFR URL, "up to date as of" date, SHA-256 of the fetched bytes. |
| `sources/sections-2026-11-24.jsonl` | The source split into citation-path sections (own text only). Gold ids and quotes are verified against it. |
| `tools/ecfr_sections.py` | Fetches the eCFR XML and splits it into sections. |
| `tools/author.py` | Authoring prompts and batches (Opus). Raw outputs in `authoring/raw/`; `--set v2 --avoid heldout-v1.jsonl` writes the v2 batches. |
| `tools/review.py` | Independent check of every item by a second model (Sonnet). Verdicts in `authoring/review-v1.json`. |
| `tools/build_set.py` | Deterministic verification, review application, dedupe, ids. |
| `tools/overrides.json` | Every edit made after the independent check, each with its reason. |
| `eval.yaml` | Harness config: backends, baselines, judge. |
| `results/<date>-<name>/` | Measured runs: config, every response, report, findings (`README.md`). |
| `tools/decline_analysis.py` | Splits a harvest backend's declines into gate declines and retrieval misses. |

## Sources

eCFR, Title 29, **up to date as of 2026-11-24** (latest amendment 2026-11-23),
fetched 2026-11-27 from the versioner API
(`https://www.ecfr.gov/api/versioner/v1/full/2026-11-24/title-29.xml?…`). US
government work, public domain.

| Source | Query | SHA-256 of the XML |
|---|---|---|
| 29 CFR 1926 Subpart CC, §§1926.1400–1926.1443 and Appendices A–C | `part=1926&subpart=CC` | `f0e56134713ccd6e03fca1def56204cb339ae6b24f7a8f33dc1f56cff6eb2838` |
| 29 CFR 1910.179 Overhead and gantry cranes | `part=1910&section=1910.179` | `1fb1af7575fe1a5f437873dcecb7c833c7dd98bec06ab2096014fcc5bdb90bc0` |
| 29 CFR 1910.180 Crawler locomotive and truck cranes | `part=1910&section=1910.180` | `ba61f05535c94de607cfcf109e3e7ae13bd926edb69b608b0fc514bccb986634` |
| 29 CFR 1910.184 Slings | `part=1910&section=1910.184` | `d732c84ebd15ec3e503cf9a3a872ea647e81600066f7c12244968ad47a351765` |

Two independent fetches gave identical bytes. Reproduce:

```sh
python3 crane/eval/tools/ecfr_sections.py fetch --date 2026-11-24 --out /tmp/ecfr
python3 crane/eval/tools/ecfr_sections.py split --src /tmp/ecfr --out /tmp/sections.jsonl
```

The split yields 2,177 sections. Ids follow CONTRACT.md citation paths:
`29cfr1926.1408(a)(2)(iii)(A)` (eCFR levels a / 1 / i / A / italic 1 / italic i;
an ambiguous "(i)", "(v)" or "(x)" is read as a letter or a roman numeral by
whichever reading lets the following labels place), tables as
`29cfr1926.1408-tableA` and `29cfr1910.184-tableN-184-1`, appendices as
`29cfr1926-subpartCC-appA` with paragraphs `29cfr1926-subpartCC-appC(b)(1)`.
Text is the source text with whitespace collapsed and leading paragraph labels
removed; unlabeled paragraphs (definitions, notes) join the paragraph before
them. The source skips one label (§1926.1412(b)(1) is followed by (b)(4)); the
split keeps the source's numbering. Appendix A is figures only and has no text.

**The pipeline lane spells appendix and table ids its own way until the
CONTRACT fixes one.** `harvest_eval check-ids --set heldout-v1.jsonl --pack
<pack>` lists any gold id a pack lacks; map differences with `match.aliases`
in `eval.yaml`.

## How the set was made

Independent of the bake: written from the official text above with its own
prompts, by a separate process that never read `crane/content/`, the pack, or
the pipeline's prompts or caches.

1. **Author** (`tools/author.py`, `claude-opus-5-5`). 22 batches, each given
   the full text of a group of sections with their ids in brackets and asked
   for 10–18 questions phrased the way people ask on a job site: slang,
   vague, voice-to-text, typos, multi-part, scenario, formal. Each item has a
   concise gold answer, the most specific gold paragraphs, and the shortest
   verbatim key quote when the answer turns on a limit, distance, interval,
   capacity or duty. Two more batches wrote must-decline questions from the
   table of contents only. A supplement batch (B22) filled thin topics (wind
   and weather, multiple-crane lifts, load charts, ground conditions).
2. **Independent check** (`tools/review.py`, `claude-sonnet-5-5`). Every
   answerable item was checked against the full text of its gold sections;
   every must-decline item against the ten sections sharing the most words
   with it. Verdicts: keep, flag for an expert, drop, or a corrected gold
   answer.
3. **Deterministic verification** (`tools/build_set.py`). Every gold id must
   exist in the split; every key quote must be an exact substring of its
   section's text after whitespace normalization, re-pointed to the most
   specific paragraph that contains it; table quotes may be split on the cell
   separator. Near-duplicate questions (token Jaccard ≥ 0.6) are dropped.
4. **Spot check by the eval lane.** 14 random items plus every flagged item
   (29 in all) read against their section text. That found one wrong gold
   answer (the horn item: §1926.1415(a)(7)(i) allows a horn "on the equipment
   and immediately available", which the first gold denied) and nine
   questions that did not say whether construction or general industry
   applied. All are fixed in `tools/overrides.json`.

## Verification results (v1)

| Check | Result |
|---|---|
| Authored | 351 items (299 answerable, 52 must-decline), `claude-opus-5-5` |
| Independent check (`claude-sonnet-5-5`) | 336 keep, 15 flag, 0 drop; 22 gold answers corrected |
| Flags resolved | 3 were the checker's truncated context, cleared; 12 fixed or kept for an expert (`overrides.json`) |
| Near-duplicates dropped | 8 (the supplement batch re-asked earlier items) |
| Gold section ids that exist in the split | 505 / 505 |
| Key quotes that are exact substrings of their section | 282 / 282 |
| Dropped by the eval lane | 1 must-decline item naming a source that may join the corpus |
| Items in v1 | **342**: 291 answerable, 51 must-decline |

Rebuild the set from the committed outputs (byte-identical; for v2 use `--raw crane/eval/authoring/raw-v2 --review crane/eval/authoring/review-v2.json --overrides crane/eval/tools/overrides-v2.json --avoid crane/eval/heldout-v1.jsonl --id-prefix crane-v2 --out heldout-v2.jsonl`):

```sh
python3 crane/eval/tools/build_set.py --sections crane/eval/sources/sections-2026-11-24.jsonl \
    --raw crane/eval/authoring/raw --review crane/eval/authoring/review-v1.json \
    --overrides crane/eval/tools/overrides.json --out heldout-v1.jsonl --log verify-log.json
```

Re-run the checks: `cd harvest/eval && python3 -m harvest_eval check-ids
--set ../../crane/eval/heldout-v1.jsonl --pack
../../crane/eval/sources/sections-2026-11-24.jsonl`.

## Composition

- **Topics** (answerable): inspections 29, power lines 26, assembly/disassembly
  21, wire rope 19, overhead and gantry 17, signals 15, operator qualification
  15, scope and definitions 14, rigging and slings 14, personnel lifts 13,
  operator duties 11, operational aids 11, load charts 9, floating cranes 9,
  training 8, ground conditions 7, crawler/locomotive/truck 7, tower cranes 6,
  multiple-crane lifts 6, design and modification 6, wind and weather 5 (plus
  wind questions filed under personnel lifts, tower cranes and floating
  cranes), safety devices 5, fall protection 5, derricks 5, work area control
  4, sideboom/pile driver/small equipment 4.
- **Must-decline** (51): non-crane 9, a specific crane's load chart 8,
  manufacturer procedures 8, other jurisdictions or bodies 6, legal advice 7,
  ASME B30 text 7, other 6.
- **Equipment-specific**: 122 answerable items name the equipment (overhead,
  crawler, tower, floating, derrick, locomotive, truck, articulating, boom
  truck, rough-terrain, gantry, digger derrick, pile driver, sideboom,
  small-capacity, personnel platform).
- **Asking style**: slang, voice-to-text, scenario, multi-part, vague, typo,
  formal, each 35–61 items. **Difficulty**: about 35% easy, 46% medium, 19% hard.
- **Expert review needed**: 41 items, each with a reason.

## Item schema

```json
{"id": "crane-v1-0001",
 "question": "how close can i get the stick to a 138kv line if were going by table A",
 "style": "slang|vague|voice|typo|multi-part|formal|scenario",
 "category": "power-lines",
 "gold_answer": "1–3 sentences with the exact numbers and conditions.",
 "section_ids": ["29cfr1926.1408-tableA"],
 "nearest_section_ids": [],
 "key_quote": {"section_id": "29cfr1926.1408-tableA", "text": "verbatim substring", "match": "exact|table-cells"},
 "must_decline": false,
 "equipment": "crawler-crane|tower-crane|…|null",
 "variant": "free text, e.g. lattice boom, outriggers fully extended|null",
 "difficulty": "easy|medium|hard",
 "expert_review": {"needed": true, "why": "one line"},
 "provenance": {"author": "claude-opus-5-5", "batch": "B04-01", "authored_at": "2026-11-27"}}
```

- `section_ids` are empty and `nearest_section_ids` name where a good decline
  points when `must_decline` is true.
- `equipment` is set when the answer applies only to one kind of equipment or
  configuration.
- `expert_review.needed` marks items whose answer depends on interpretation,
  an exception chain or field practice. No credentialed crane expert has
  reviewed the set yet; until one does, treat those items' gold as the
  model's reading of the text.

## Limits

- Authored and checked by models, verified deterministically, and sampled by
  a person; not yet reviewed by a credentialed crane expert.
- English only. US federal text only: no OSHA guidance publications, state
  plans, USACE EM 385-1-1 or NAVFAC P-307 yet.
- A future edition of the CFR can change gold answers. Re-run the split for a
  new date and `check-ids` to see which items moved.
