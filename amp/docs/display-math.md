# Display mathematics in prompts

A complete equation, expression or inequality after a colon or a short command
such as “Solve”, “Simplify”, “Evaluate” or “Factor” appears on a centred line
below its introduction. It has no final sentence punctuation. Mathematics that
belongs to a sentence stays inline, including units and instructions after the
formula. Clock times and currency amounts are prose.

`src/content/prompt-structure.ts` makes this decision for both `MathText` and
`PrintMathText`. It accepts explicit TeX, supported plain expressions and legacy
blank boxes. Semicolon-separated equations form a stacked system. A formula on
its own in a choice or label keeps that surface's layout.

`polishProblem` removes punctuation from final display mathematics after the
shared copy-edit pass, including clause variants that preserve their authored
algebra. Frozen versions retain their original payloads for reproducible reprints.
For current versions it formats prompts without changing
operands, answers, grading or problem identifiers. Renderers also recognize
unmodified saved prompts and static lesson text. Hints and worked explanations
retain their authored source; their renderers apply the same display rule.

The shared `DisplayMath` component supplies accessible KaTeX HTML and MathML.
Long formulas wrap between operators. A fraction, radical or matrix that cannot
wrap scales to its column. Web displays remeasure after font loading and container
resizing. Workbook pagination measures displays in their final columns before
allocating writing space; standalone lesson publications fit after fonts load.
Print keeps white paper under either system colour scheme.

## Surfaces

- Practice, answer review, hints and generated lesson examples use `MathText`.
- Reference lessons, worksheets, lesson publications and daily workbook PDFs use
  `PrintMathText` and the same display markup and rules.
- The separately authored books under `src/publishing` use their own book schema
  and fraction renderer. They do not consume generated practice prompts; their
  page composition and typography are independent of this formatting rule.

## Verification

`tests/prompt-structure.test.ts` checks structure, punctuation, unchanged inline
prose, clock times, currency, systems and matching web/print markup.
`tests/prompt-display-inventory.test.ts` visits every registered template with
20 deterministic seeds at its current version and version one. It independently
checks that command/colon introductions reach a display and checks final
punctuation in current prompts; frozen prompts, hints and worked steps are
checked through both renderers. It also renders representative
web and print displays from every affected family. The inventory lint runs in
`npm run test:content`.

Run `node --import tsx scripts/verify-display-equations.ts` for browser evidence.
`DISPLAY_REVIEW_OUT` selects its artifact directory and `DISPLAY_REVIEW_PORT`
selects a loopback port (default 4810). It captures actual practice components,
lesson/review mathematics and composed workbook pages at 320, 390, 768 and
1280 pixels in light and dark themes. It asserts centring, wrapping, fraction
scaling, retained figures, no horizontal math overflow and valid PDF pagination.

The independent mathematical oracles try the original text first, then an
equivalent reading with terminal sentence punctuation for prose parsers.
Answers, option labels and mathematical operators are preserved. Print audits
read each formula’s authored source through `data-plain`; browser checks verify
the visible display and punctuation.
