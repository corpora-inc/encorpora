# crane/content

What the crane pack teaches, tests and walks people through. Everything here is
grounded in the federal crane rules (29 CFR 1926 Subpart CC, 1910.179, .180,
.184, from the eCFR) and checked deterministically against their text. Our
practice items are original; nothing here implies affiliation with or
endorsement by OSHA or any certification body.

| Path | What |
|---|---|
| `blueprint.yaml` | Topic tree, skills (the practice engine's units), exam blueprint verified against the current candidate handbook, equipment variants. |
| `procedures/*.yaml` | Field procedures: role-tiered steps, check kind, citations, deficiency guidance with verbatim quotes. |
| `tools/powerline/` | Table A / Table T clearance data (verbatim, cited) and `clearance.ts`. |
| `tools/loadcharts/` | Original fictional load charts and exact practice-problem generators. |
| `tools/signals/` | Appendix A hand signals: traced official figures and verbatim captions. |
| `diagrams/` | Teaching SVGs with captions, alt text and cited sections. |
| `data/questions/<topic>.jsonl` | Exam-prep bank: four-option items at three tiers, a why per option, a `note` (one line beyond the key: why it matters, the edge case, the rule people confuse it with), misconception labels, gate results. |
| `data/answers/<topic>.jsonl` | Answer cache: canonical questions, cited answer segments, aliases. |
| `data/lessons/<topic>.json` | Lessons per topic in answer-segment JSON with diagram slots. |
| `data/lessons/<topic>.skills.json` | One lesson per skill, built around the misconceptions its items' wrong options represent. |
| `data/course/tree.json` | The course knowledge tree for the instructor chat: guide, exam, domains, topics, skills (see `harvest/CONTRACT.md`, `course_node`). |
| `data/glossary.jsonl` | Glossary: rule-defined terms (quoted) and field terms (practice). |
| `tasks/` | Generation tasks: prompts, schemas, input builders, runner. |
| `verify/` | eCFR fetch and index (`ecfr.py`), citation/quote verifier (`verify.py`), tests. |

`corpus.yaml` (the source registry) belongs to the pipeline lane.

## Rows and the pack schema

Generated rows use the column names of `harvest/CONTRACT.md` (`question`,
`answer` + `answer_alias`, `lesson`, `term`, `procedure` + `proc_step`) with
natural JSON values (the pipeline JSON-encodes array columns), plus:

- `prov`: the provenance row (backend, model, prompt id/version/hash, input and
  output hashes, verifier, verdict). Only `verdict: pass` ships.
- `topic_id`, `skill_id`; for questions `fact`, `basis` (`rule` or `practice`)
  and `quotes` (the verbatim support); for answers `aliases`.

Section ids follow the CONTRACT citation paths: `29cfr1926.1408(a)(2)`. Tables
are part of their section's text (`29cfr1926.1408` holds Table A), one row at a
time with cells joined by ` | ` as in the pipeline's stage, so a table quote
reads `up to 50 | 10`. Appendices are `29cfr1926.cc.appA`, `.appB`, `.appC`.

## Verify

```sh
python -m venv .venv && .venv/bin/pip install pyyaml "snowballstemmer>=3,<4"   # any venv
.venv/bin/python crane/content/verify/ecfr.py                # fetch + index (cached in ~/.cache/crane-content)
.venv/bin/python crane/content/verify/verify.py              # every citation and quote in crane/content
.venv/bin/python -m unittest discover -s crane/content/verify
node --test 'crane/content/tools/powerline/*.test.ts'
```

A quote passes only if it is an exact substring (after whitespace
normalization) of the cited section's or paragraph's text, where a node's text
includes its subparagraphs. Generation prompts require each quote to come from
a single paragraph; the verifier does not reject a quote that runs across two
adjacent subparagraphs of the cited node. The generators
repair typography only (curly vs straight quotes, dashes, `§1926` vs `§ 1926`,
a space where a table row has ` | `) and may re-point a quote to the sibling
paragraph that contains it verbatim; anything else fails. The pipeline
re-verifies every imported row against its own stage, and the two must agree.

## Generate

```sh
# the runner calls the headless CLI from an empty directory itself
.venv/bin/python crane/content/tasks/run.py procedures|questions|answers|lessons|glossary [--limit N] [--only ids] [--model M]
```

`--model` (or `model:` in `task.yaml`) is `opus`, `sonnet` (Claude CLI) or
`codex:<model>` (`codex exec`, read-only, strict output schema). Every row's
`prov.model` names the model that wrote it, and every row passes the same
deterministic checks whichever model wrote it.

Outputs are cached by prompt, input and model under `~/.cache/crane-content/gen`,
so a run stops cleanly and resumes without repeating work. It stops before a
batch that would pass:

| Limit | Env | Default |
|---|---|---|
| Claude weekly usage | `HARVEST_USAGE_CEILING` | 55% |
| Run dollars (Claude-reported) | `HARVEST_BUDGET_USD` | 60 |
| Run output tokens (all backends; Codex reasoning counted) | `HARVEST_BUDGET_OUTPUT_TOKENS` | 4,000,000 |

The run budget is the sum over a ledger, `gen/budget/$HARVEST_BUDGET_ID.jsonl`,
one line per call with its model, dollars and output tokens, across tasks and
resumes. `--write-only` rebuilds the files from cache. The writer takes the
output for the current prompt version from any model (the task's model first);
for an input with none, it takes an output of a version listed under
`accept_versions` in `task.yaml`, so a partial re-run never drops verified rows.

## Writer checks

- Quotes and citations against the eCFR index (above).
- Questions (`tasks/questions`, one set per skill from each writing model): 4 distinct
  options with no combination option and no option contained in another; every option
  within 20% of the item's mean length (6 characters slack); a why for every option and
  a `beyond` line for the key; no placeholder text; rule items quote the rule verbatim,
  practice items name a public source (ASME B30.5 by chapter only). Then two gates,
  run by non-Claude or cross-family judges:
  - testwiseness (`gate_naive`, a non-Claude judge for every writer): a smart test-taker
    with no crane training reads the stem and options and answers on common sense and
    test-taking instinct alone; an item fails when that reader's top pick is the key
    with probability 0.4 or more;
  - solver (`gate_solve`): the judge answers the full item; it fails unless the judge
    picks the key with confidence 0.6 or more, sees no flaw, and rates the tier within
    one of the label (a tier-3 item rated tier 1 fails).
  Failed Opus items get one Opus rewrite round (`questions_fix`); other writers' failures
  are dropped unless their skill would fall below 8 passing items. Rewrites pass the same
  checks and gates, and a passing rewrite replaces its original. The key's extra line
  ships as the row's `note` (CONTRACT `question.note`). The writer reports how often the
  key is the longest and the shortest option across the bank (chance is about 25% each).
- Answers open with a text segment whose first sentence is the direct answer: Yes or
  No for a yes/no question, a number for a how-many or how-far question.
- Answer-cache intent (`tasks/intent.py`, the engine's alias similarity ported): an
  answer whose question reaches the cache threshold (0.75) against an earlier answer's
  question is a duplicate and fails; an alias within 0.6 of another answer's question
  or alias, or of a practice question of another skill, is dropped; an answer left
  with fewer than 3 paraphrases fails.
