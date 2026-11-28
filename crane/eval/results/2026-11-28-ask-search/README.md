# Ask as search, 2026-11-28

Ask is now a search over the index: the learner types a question and gets
ranked rule sections. The measure is whether **the right rule is among the
first results shown**, and how much typos and misspellings cost.

- System: `harvest search` at `main` `e113660ed` over the pack built from that
  commit (as in `../2026-11-27-release-bar/`), through the `harvest-search`
  backend (`config.yaml`).
- Sets: held-out v1 (291 answerable items) and v2 (59), plus three perturbed
  copies of each from `../../tools/perturb.py`:
  - `typo1`: one keyboard typo per question;
  - `typo10`: typos in about 10% of words of 4+ letters;
  - `misspell`: phonetic misspellings of crane words ("outriger", "too
    blocking", "personel"; questions without such a word get one typo instead:
    202 of 342 v1 questions and 46 of 73 v2 questions had one).

  Every perturbed question differs from its original. Digits, acronyms (NCCCO)
  and section labels ("Subpart CC") are never edited.
- v3 stays frozen and unused.

R@k is the share of answerable items whose gold rule appears in the first k
distinct sections shown. Two levels:
- **Section**: the right section, such as §1926.1408.
- **Paragraph**: the gold paragraph, or one containing it or contained by it.

## Lexical search (this PR)

| Set | Section R@1 | Section R@5 | Section R@10 | Paragraph R@1 | Paragraph R@3 | Paragraph R@5 | Paragraph R@10 | Section MRR@10 | Paragraph MRR@10 |
|---|---|---|---|---|---|---|---|---|---|
| v1 clean | 0.588 | **0.838** | 0.896 | 0.345 | 0.559 | **0.646** | 0.742 | 0.698 | 0.584 |
| v1 typo1 | 0.578 | 0.807 | 0.872 | 0.345 | 0.544 | 0.619 | 0.718 | 0.682 | 0.577 |
| v1 typo10 | 0.555 | 0.815 | 0.886 | 0.317 | 0.532 | 0.599 | 0.702 | 0.668 | 0.547 |
| v1 misspell | 0.547 | 0.777 | 0.857 | 0.316 | 0.494 | 0.566 | 0.673 | 0.653 | 0.532 |
| v2 clean | 0.538 | **0.826** | 0.877 | 0.312 | 0.521 | **0.633** | 0.713 | 0.673 | 0.572 |
| v2 typo1 | 0.538 | 0.826 | 0.843 | 0.304 | 0.547 | 0.650 | 0.708 | 0.668 | 0.571 |
| v2 typo10 | 0.436 | 0.809 | 0.843 | 0.253 | 0.462 | 0.555 | 0.662 | 0.610 | 0.492 |
| v2 misspell | 0.517 | 0.792 | 0.877 | 0.325 | 0.535 | 0.599 | 0.677 | 0.652 | 0.570 |

Findings:

1. **The right section is in the first five results for about 83% of
   questions** (v1 83.8%, v2 82.6%). The right paragraph is there for about
   64%. v2 was written after any tuning, and it matches v1.
2. **Typos cost a few points; misspellings cost more.** On v1 at paragraph
   R@5, one typo costs 2.7 points and typos in 10% of words cost 4.7.
   Phonetic misspellings of the crane words themselves cost 8.0, and 6.1 at
   section level. Lexical matching has no spelling tolerance, so a misspelled
   key term ("outriger") stops matching. The normalizer's synonym table could
   carry common misspellings, or the dense half could absorb them (next).
3. **The top result alone is right half the time** (section R@1 0.54–0.59),
   so a screen that shows one answer should show several sections.

## Dense search (pending)

The same runs with EmbeddingGemma 2 dense retrieval fused with lexical
(`search-dense` in `config.yaml`) need the embedder on the lab machine's GPU.
They run after the core lane's Instructor tier measurement and the item gates,
and will be added here.

## Reproduce

```sh
python3 crane/eval/tools/perturb.py --set crane/eval/heldout-v1.jsonl --mode typo1 --out /tmp/v1-typo1.jsonl
cd harvest/eval
.venv/bin/python -m harvest_eval run --config ../../crane/eval/results/2026-11-28-ask-search/config.yaml \
    --set /tmp/v1-typo1.jsonl --pack <pack> --binary <harvest> --backends search-lexical --no-judge --out <dir>
```

Each `<set>/results.json` holds the retrieval numbers. The `report.md` files
are the harness's standard report; with no judge and no answers, only their
retrieval table means anything.
