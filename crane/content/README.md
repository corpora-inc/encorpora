# crane/content

What the crane pack teaches, tests and walks people through. Everything here is
grounded in the federal crane rules (29 CFR 1926 Subpart CC, 1910.179, .180,
.184, from the eCFR) and checked deterministically against their text. Our
practice items are original; nothing here implies affiliation with or
endorsement by OSHA or any certification body.

| Path | What |
|---|---|
| `blueprint.yaml` | Topic tree, skills (the practice engine's units), exam blueprint verified against the current candidate handbook, equipment variants. |
| `procedures/*.yaml` | Field procedures: role-tiered steps, check kind, citations, deficiency guidance with verbatim quotes. Every deficiency cites its rule; `tasks/procedures/citations.yaml` supplies the ones the generator left uncited. |
| `app.yaml` | Practice prerequisites and Ask starters, written into the pack's `pack_meta` with `exams.json`. |
| `tools/powerline/` | Table A / Table T clearance data (verbatim, cited) and `clearance.ts`. |
| `tools/loadcharts/` | Original fictional load charts and exact practice-problem generators. |
| `tools/signals/` | Appendix A hand signals: traced official figures and verbatim captions. |
| `diagrams/` | Teaching SVGs with captions, alt text and cited sections. |
| `data/questions/<topic>.jsonl` | Question bank (MC with a rationale per choice; free-text with rubrics). |
| `data/answers/<topic>.jsonl` | Answer cache: canonical questions, cited answer segments, aliases. |
| `data/lessons/<topic>.json` | Lessons per topic in answer-segment JSON with diagram slots. |
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
- Questions: 4 distinct choices, a rationale each, and a key that does not stand out
  by length (over 1.5x the longest distractor and 20+ characters longer fails).
  Free-text sample answers must pass their own rubric under the practice grader.
- Answers open with a text segment whose first sentence is the direct answer: Yes or
  No for a yes/no question, a number for a how-many or how-far question.
- Answer-cache intent (`tasks/intent.py`, the engine's alias similarity ported): an
  answer whose question reaches the cache threshold (0.75) against an earlier answer's
  question is a duplicate and fails; an alias within 0.6 of another answer's question
  or alias, or of a practice question of another skill, is dropped; an answer left
  with fewer than 3 paraphrases fails.
