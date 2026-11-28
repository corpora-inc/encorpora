# Content quality log

Short record of what each generation pass looked like on review, what changed,
and the verification rates. Newest first.

## 2026-11-27 question bank, all 213 skills (Codex, prompt v4)

- Written by Codex gpt-6-astra under prompt v4 for every skill, including the 43 skills that had Sonnet v3 rows; those rows are replaced. Same prompt and the same writer checks as the other models.
- 1,708 facts, 3,434 MC and 426 free-text items. 3,823 of 3,860 pass (99.0%).
- The 37 failures stay in the files marked fail: 23 refer to their prompt, 10 have a sample answer that fails its own rubric, 3 have a quote not verbatim in 1926.1405, 1 has duplicate choices.
- Key length: the correct choice is the uniquely longest in 12.6% of passing MC (430 of 3,408). That is below the 25% of picking at random; Sonnet v3 was at 31%.
- The 60-skill sample had the same pass rate as Sonnet v3 (297/298 against 998/1004). I read 8 random items: correct, quote-backed and well distracted.
- Cost: 213 Codex calls, 1.20M output tokens including reasoning; no dollar cost on the Claude ledger.

## 2026-11-27 lessons and glossary (full run)

- Lessons: Opus, prompt v1, all 18 topics, 136 lessons, 715 quotes exact, 4 repaired (typography). 135 pass. 1 fails: it quotes the 1910.180(j) heading as "overhead electric lines", but the source says "overhead lines". It stays in the file marked fail; `verify.py` now skips rows their writer failed. 52 diagram slots, all valid ids.
- Read the wind lesson in full. The physics is right (wind pressure about 0.00256 V² psf, so about 1 psf at 20 mph and 4 at 40) and labeled as physics. The rule duty is quoted (1926.1417(n) competent person). It ends with self-checks.
- Glossary: Sonnet, 349 terms. 241 are rule-defined, each with a verbatim quote, all pass; 108 are field terms marked practice.
- Cost in the run ledger: lessons $7.14 / 255k output tokens (Opus), glossary $0.62 / 52k (Sonnet).

## 2026-11-27 questions v3 resume, table rows, oversized definitions

- 48 skills were generated with prompt v3 before the run stopped (rules, roles, site, powerlines, part of signals). Six had bad input. The 1926.1401 definitions node (21k chars) is larger than the 20k prompt budget, so `ground()` returned only the truncation marker: rules.definitions, roles.competent-vs-qualified and site.fall-zone got no rule text (one came back as a "NOT FOR USE" placeholder); powerlines.dedicated-spotter and roles.ad-director lost the definitions they cite. ops.multi-drum cited only Appendix A, which is figures with no text. Fix: an oversized node is split into definitions, placed after the other sections, terms that appear in that text first; `skill_text()` fails on a skill with no rule text; ops.multi-drum cites the main/auxiliary hoist rules. Those six regenerate on the next run; their old outputs do not ship.
- Written: 43 skills, 424 facts, 918 MC + 86 free text, 1002/1004 pass. The 2 failures quote the 1926.1420 heading as text; they stay in the file with verdict fail and do not ship.
- Table rows: the pipeline stage joins table cells with " | ", our index joined them with spaces, so 33 questions and 9 answers that quote Table A or Table T passed here and failed at import. The index now renders rows like the stage, repair maps space-joined cells onto the row, and clearance.json and diagrams.yaml were updated. The pipeline importer now agrees row for row: questions 1002/1004, answers 87/87, procedures 10/10, topics 18/18.
- Read 14 random MC: correct, cited, distractors are real job-site mistakes. Left for prompt v4: one variant's quote names the options without proving what they are (1408(a)(2) "Option (1), Option (2), or Option (3)"), and the correct choice is the uniquely longest 31% of the time (25% by chance).
- The v2 pilot rows for inspections.shift, loadchart.net-capacity, rigging.sling-angle and signals.voice are not shipped; they predate the quote-proves-answer rule and regenerate under v3.

## 2026-11-27 procedures pilot (shift inspection, power line work)

- Opus, prompt v1. 69 steps, 61/61 quotes exact on first pass, 0 repaired, 0 failures.
- Read in full: steps follow site order, role tiers differ in substance (trainee: what and why; operator: the check; inspector: what to verify and record). Deficiency actions are concrete (stop, tag out, replace spotter). Kept as is; ran the other eight.

## 2026-11-27 question bank and answer cache pilot (5 skills: Table A, sling angle, shift inspection, voice signals, net capacity)

- Sonnet. Questions: 47 facts, 107 MC + 10 free text, 117/117 verified, 0 repaired. Answers: 87 answers, 586 aliases, 85/87 on first pass.
- Read ~50 of each. MC: distractors are real mistakes (two calendar days vs two working days; 6 degrees vs 5 from vertical); rationales explain each choice. Two weaknesses: one variant's answer ("prior to the lift") was not proved by its fact's quote, and the correct choice is the longest 33% of the time (25% expected). Prompt v3: every variant must be proved by its fact's quote, or become its own fact.
- Free-text rubrics now use the practice engine's keyword-rubric shape (`points[].any`, `pass`); the writer fails any item whose sample answer does not pass its own rubric under the engine's grader.
- Answers: lead with the direct answer, quote every limit, practice labeled as practice; sling-angle factors checked by hand (1/sin: 70° 1.064, 50° 1.305, 40° 1.556, 35° 1.743). Aliases mix plain, search-box, slang and voice styles ("so uh nobody knows the voltage can we still pick").
- The 2 failures quoted a section heading as if it were text. Headings are not section text; the writer now turns a heading "quote" into a cite. 87/87 pass.
- Procedures (all 10): 356 steps, 305/305 quotes exact, 0 repaired. Personnel lift read in full: trial lift, 125% proof test held five minutes, 50% limit, pre-lift meeting all present and cited.
