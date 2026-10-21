# Standalone mathematics lessons

For new and substantially revised lessons, follow the plain explanation → worked example → visualization → optional useful application → precise statement sequence in [the content-family playbook](../../docs/content-family-playbook.md). Define terms before first use and preserve rigorous conditions throughout. Existing lessons do not require a bulk rewrite.

A lesson must teach its stated objective to a learner who has not read another AMP lesson. Repeat a needed definition rather than relying on a link or a prerequisite label. State any basic skills the lesson genuinely requires.

- Define vocabulary and notation before using them to explain a procedure. Connect each symbol to the quantity it represents. For fractions, explain the whole, equal parts, numerator, and denominator; for right triangles, explain a triangle, a right angle, the legs, and the hypotenuse.
- Explain why a method works before turning it into a rule. Show what stays unchanged during a transformation and why the next step is valid. Preserve explicit algebraic and arithmetic steps.
- Concision removes empty words, repetition without purpose, and motivational filler. It must not remove definitions, reasoning, intermediate steps, useful comparisons, or checks. Use enough space to make the explanation complete.
- Use plain language alongside proper mathematical vocabulary. Do not substitute an unexplained technical synonym for an explanation.
- Match every diagram to the actual quantities. Make the whole or unit explicit, preserve scale when scale carries meaning, and distinguish given information from the answer. Include a text description that communicates the mathematical relationship without color.
- Write learner material as a finished lesson. Do not include development status, production notes, coverage disclaimers, or discussion of the authoring process. Keep coverage limitations in the curriculum audit and production documentation.
- Inspect rendered Letter and A4 pages. Fractions, roots, exponents, and adjacent steps need visible separation; a bounding-box pass alone does not establish good spacing. Check figure labels, page breaks, answer labels, and the relationship between prose and diagrams.
- Before applying a revised lesson pattern broadly, independently review a representative lesson for mathematical meaning and first-time-learner clarity, and inspect its exported pages visually.
- Every problem hint is one teaching step for its own instance: the generator writes it from the template's givens, names at least one number the prompt states, points to the method's first move, and never states the answer. Every method has a `watch` line (the most common error, stated as what to do) and at least two steps. `tests/instance-hints.test.ts` enforces these rules for every template.

## Mathematical typography

Every mathematical symbol, variable, expression or equation a learner reads is typeset as math. This covers prompts, hints, methods (steps, terms and `watch`), principles, lessons (all text and worked examples), choice labels, choice feedback, explanations, worksheets, publications and answer-field labels.

- Wrap each variable in TeX: `$a$`, `$r = 12 \div 2 = 6$ cm`, `$C$`, `$x$-axis`. KaTeX sets variables in italic. A lone letter is never typeset on its own, so a bare "a" or "r" reads as an upright word.
- Write `$\pi$`, never the word "pi" or a bare "π", wherever the number is meant. The one sentence that introduces the name may say "the ratio $\pi$ (pi)".
- Units are text outside the math (`$r = 4$ m`, `$9\pi$ square centimeters`), or `\text{cm}` inside it, consistently within a text.
- The article "a", the pronoun "I", and a letter that names an object ("Store A", "Shape B", "an L-shaped face") are prose. The variable $a$, a point $P$, an event $A$, a named segment, line or polygon (segment $AB$, triangle $ABC$) and an angle ($\angle ABC$) are math. Write $x$-coordinate, $y$-axis and $y$-intercept.
- Generators: wrap an interpolated variable as `$${v}$`, a whole formula as one span (`formula()` in `src/math/polish.ts` sets `1/2x` as `\tfrac{1}{2}x`), and never wrap a helper's TeX fragment twice. A single-letter answer label ("x", "x-coordinate", "sin A") is typeset centrally by `mathLabel()`.
- A plain formula with an operation ("3 × 4 = 12", "r = 6 ÷ 2") is typeset automatically by MathText and PrintMathText; prefer explicit `$…$` in new text. Never wrap a bare number alone (`$12$` prints as currency).
- Titles (template, lesson and section) render as plain text: keep them free of TeX and symbols.

`tests/math-typography.test.ts` enforces this, and also fails on TeX that KaTeX cannot parse, for every template over 20 seeds and for all static lesson, method and principle text, through both typesetters. Its allowlist (`tests/fixtures/math-typography.ts`) is short and gives a reason for each entry; extend it only for prose that cannot be math. The independent oracles read a typeset name ($x$, $A(1, 2)$, $\angle ABC$) as its plain text (`plain_reading` in `scripts/independent-math-review.py`); a formula with an operation keeps its TeX so written arithmetic is still checked.
