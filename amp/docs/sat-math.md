# SAT Math practice

AMP practices the published SAT Math testing points through its ordinary adaptive practice: Algebra, Advanced Math, Problem-Solving and Data Analysis, and Geometry and Trigonometry. Problems are original and deterministically generated, with hints, worked solutions, lessons, and printable lesson/workbook support. Reading and Writing, timed test simulation, and SAT score prediction are outside this feature.

In **Family settings → Learners**, select a learner and enable **SAT Math focus**. It excludes material beyond the SAT, including logarithms, complex arithmetic, geometric series, function composition/inverses, and advanced trigonometric identities. Foundations remain available, so a learner can repair arithmetic or fraction gaps. The setting does not impose an age or grade jump or reset progress. Turning it off restores the general practice pool.

The setting applies to the next automatically selected problem and to newly issued offline packs. An active problem stays answerable; an already downloaded offline pack keeps its contents. Deliberately selecting a lesson's practice can drill any available topic. Each learner has an independent setting. The web interface provides the setting; the native interface does not provide its editor.

## Coverage evidence

The source is College Board's [Assessment Framework for the Digital SAT Suite, version 4, September 2026](https://satsuite.collegeboard.org/media/pdf/assessment-framework-for-digital-sat-suite.pdf), Appendix B, SAT column, printed pages 183–194, tables A35–A38. The source was reviewed on October 23, 2026. AMP's local task identifiers and summaries are editorial crosswalks, not College Board standard codes.

Run from `amp/`:

```sh
npm run coverage:sat -- markdown
npm run coverage:sat -- json
```

The checklist links specific mathematical actions to runtime problem families and instructional bindings. Its structural audit rejects unknown families, missing instruction, duplicate task IDs, and mappings excluded by the SAT filter. Coverage spans equations and modeling, nonlinear representations, statistical reasoning, compound units, probability, geometry, and trigonometry. SAT practice includes multiple-choice and numeric responses using AMP's answer controls.

Each family has bounded numeric ranges and variants. A family binding does not certify every difficulty, representation, combination, or future SAT question. The independent mathematics inventory checks answers and figures; it does not establish psychometric calibration or predicted scores. AMP's calculator and practice interface do not reproduce the SAT testing application.

## Verification

`tests/sat.test.ts` checks the source crosswalk, eligibility, adaptive prerequisite behavior, and the independent prompt-based mathematics oracle. `tests/sat.integration.ts` checks persistence, ownership, sibling isolation, and preservation of active problems and evidence. The central independent inventory also checks the SAT families and deliberately corrupted cases. `scripts/verify-sat-ui.ts` exercises the setting and representative practice in a browser at phone, tablet, and desktop sizes in light and dark themes.
