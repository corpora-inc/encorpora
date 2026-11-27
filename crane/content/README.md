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
python -m venv .venv && .venv/bin/pip install pyyaml        # any venv
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
.venv/bin/python crane/content/tasks/run.py procedures|questions|answers|lessons|glossary [--limit N] [--only ids]
```

Outputs are cached by prompt and input hash under `~/.cache/crane-content/gen`,
so a run stops cleanly at the weekly-usage ceiling (`HARVEST_USAGE_CEILING`,
default 60%) and resumes without repeating work. `--write-only` rebuilds the
files from cache.
