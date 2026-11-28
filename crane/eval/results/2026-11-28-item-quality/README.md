# Question bank: item quality and difficulty, baseline 2026-11-28

The practice bank on `main` at `f520106f9` (#2593: 3,860 items for 213
skills, 3,434 multiple choice and 426 free text), measured with
`harvest_eval items` (`harvest/eval/README.md`, "Item quality"). The founder
found the bank far too easy. These numbers say how easy, and why.

- **`deterministic-pack/`**: deterministic gates on all 3,860 items, checked
  against the pack built from `main` `e113660ed` (the pipeline's own section
  ids).
- **`model-passes/`**: model passes on a stratified sample of 746 multiple-choice
  items (every skill first, then random fill): 300 at intended difficulty 0.2,
  300 at 0.5, and all 146 multiple-choice items at 0.8.

  The model was gpt-oss-120b (MXFP4) under llama-server on the lab machine.
  Every option list was shuffled per item, so the key's position carries no
  signal. Claude cost was $0.

## Headline

| Gate | Result | A bank at exam difficulty |
|---|---|---|
| **Key picked from the options alone, no stem** | **62.5%** (466 of 746) | near 25% (chance with 4 options) |
| **Answered correctly with no rule text** (strong general model) | **84.1%** | well below the pass mark for hard items |
| **The key shares the most words with the item's own rule quote** | **85.5%** of 3,434 | about 25% |
| Key is strictly the longest option | 12.6% | about 25% (the bank already avoids this tell) |
| Answered correctly with the cited rule text | 98.6% (702 of 712 asked so far) | near 100% |
| Every option has a rationale | 100% | 100% |
| Every quote verbatim (pack) | 100% | 100% |
| Every cited section exists (pack) | 99.5%: 18 rule-basis free-text items cite no section | 100% |
| Key position | 845 / 873 / 830 / 886 | even |

**Calibration against the intended tiers:**

| Intended difficulty | Items asked | Options only | No rule text | With rule text |
|---|---|---|---|---|
| 0.2 (easy) | 300 | 58.0% | 82.3% | 99.0% |
| 0.5 (medium) | 300 | 72.0% | 90.7% | 98.9% |
| 0.8 (hard) | 146 | 52.1% | 74.0% | 97.2% |

## Findings

1. **The bank gives its answers away.** A strong model shown only the four
   options, with no question, picks the key 62.5% of the time. That is two and
   a half times chance. The tell is wording: in 85.5% of items the key is the
   option closest to the rule's own words, while the distractors are written
   in other words. Length is not a tell (the key is the longest option only
   12.6% of the time). The bank already controls for length, not for wording.
2. **General knowledge passes it.** With no crane rule text, the strong model
   answers 84.1% correctly, 82–91% on easy and medium items. The NCCCO core
   exam's 70% practice pass mark would be cleared without studying the rules.
3. **The tiers don't separate.** Medium items (0.5) come out *easier* than easy
   items (0.2) on every pass. Hard items (0.8) are only somewhat harder: 74%
   answered with no context, 52% from the options alone. The intended
   difficulty is not a measured difficulty.
4. **Keys are almost always right.** With the cited rule text, the model
   answers 98.6%. The 10 misses are the candidates for a wrong key or an
   ambiguous item: `q.inspections.testing.94ade8e941`,
   `q.inspections.testing.0bf1d992ac`, `q.loadchart.jib.a57282b2d9`,
   `q.loadchart.rated-capacity-rules.c2ee1998b9`, `q.ops.dynamic-loading.9372bac788`,
   `q.ops.attachments.c4450d8c94`, `q.other.sideboom-small-piledriver.2fb78bcb08`,
   `q.powerlines.table-a.10f51a82e5`, `q.powerlines.table-a.a8dd72e575`,
   `q.signals.one-signaler.c40f02ab03`.
5. **Integrity is good.** Every option has a rationale, every quote is verbatim,
   the keys are evenly placed, and every rule item but 18 free-text ones cites an
   existing section. The 153 multiple-choice items that cite no section are
   practice items (basis `practice`, mostly load-chart readings), which is by
   design.
6. **Too easy everywhere, worst in a few topics** (from the options alone, and
   with no rule text):
   - **site:** 79% and 94%;
   - **weather:** 87% and 100% (n = 15);
   - **roles:** 71% and 94%;
   - **signals:** 71% and 89%;
   - **other equipment:** 76% and 87%.

   Technical (30% from the options alone) and rules (40%) are the least
   guessable. See `model-passes/report.md` for every topic.
7. **421 of 746 sampled items (12.3%) are answered by every pass, including from
   the options alone.** `model-passes/items.csv` (`everyone_correct`) lists them
   for rewriting first.

## What would fix it (for the content lane)

- Write distractors in the rule's own vocabulary, and paraphrase the key, so
  that matching the rule's wording stops pointing to the key. Re-run
  `key_most_like_rule` until it is near 25%.
- Make distractors true-sounding near misses: the right number with the wrong
  condition, the neighbouring row of a table, the general-industry rule in a
  construction question. That moves `options_only` toward chance and
  `no_context` down.
- Set the difficulty tiers from measured solve rates (`no_context`, and later
  real learners), not from the author's guess.

## Still to run (GPU time on the lab machine)

These runs used the shared GPU and yielded it to the core lane's Instructor
tier measurement:

- **The `review` judge** (300 items): key correct per the rule, the rule supports
  the key, a single best answer, and the plausibility of each distractor.
- **The weak model's no-context pass** (gpt-oss-20b): 356 of 746 are done, but
  in bank order, so they are not reported.
- **The last 34 crane-aware items.**

Every answer is cached, so finishing costs only these calls. Weekly Claude usage
is at 67%, so the review stays on the local model.

## Reproduce

```sh
cd harvest/eval
.venv/bin/python -m harvest_eval items --bank ../../crane/content/data/questions --sections <pack> \
    --out <dir> --passes deterministic
.venv/bin/python -m harvest_eval items --bank ../../crane/content/data/questions \
    --sections ../../crane/eval/sources/sections-2026-11-24.jsonl \
    "--alias=^29cfr1926\.cc\.app=29cfr1926-subpartCC-app" "--alias=-table-=-table" \
    --out <dir> --per-tier 300 --passes deterministic options_only no_context crane_aware \
    --strong 'http://<lab>:<port>/v1#gpt-oss-120b'
```

The lab machine's heat guard (95°C) stopped sustained gpt-oss-120b runs three
times. Bursts of a few minutes with cooling between them, at 2 server slots,
finished the passes.
