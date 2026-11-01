# Standalone mathematics lessons

Every lesson follows **plain explanation and intuition → worked example → method → watch for → principle and definitions**. Reference lessons label their sections with `stage: "intuition"`, `"method"`, or `"formal"`. The summary is the short plain-language opening, and intuition sections may expand it. The shared renderer places the worked example and pitfalls between the layers. Problem lessons (`ProblemMethod`) put `intuition` before their generated example, fall back to the reference summary, and keep `goal` as the task description. The closing section gives the full mathematical statement, definitions, assumptions and restrictions.

A lesson must teach its stated objective to a learner who has not read another AMP lesson. State any basic skills the lesson genuinely requires.

## Plain-language standard

Write for a learner one level below the lesson's grade band who may have forgotten earlier vocabulary. A learner reaching above their level must be able to piece the lesson together from the page alone. Repetition is good. Each rule can be checked: `npm run review:plain` judges all of them, and `tests/plain-language.test.ts` enforces rules 2, 3, 4 and 6.

1. **Open in everyday words.** The summary and intuition say what the idea is and why it works. Define every term they use right there, or leave it out.
2. **Define at first use, in that sentence.** The sentence where a term first appears says what it means. Use "is called", "means", "stands for", "is a/an/the", "are", an appositive ("the denominator, the bottom number, …" or "the denominator (the bottom number)"), "we write", or a colon. A glossary entry, a `terms` list or a closing definition does not count, so define the term anyway.
3. **Repeat after a gap.** If a later section uses a term again after a gap, restate it in a short clause. Each practice lesson is shown on its own screen, so define its terms there too.
4. **Assume no earlier vocabulary.** Higher levels restate basic words in a clause: "the denominator, the bottom number of a fraction", or "an integer, a whole number or its negative".
5. **Explain a symbol before using it.** This covers ², √, |x|, f(x), ≤ and ≥, ±, ≠, Σ, π and subscripts. Say it in words and say what it does: "$x^2$ ($x$ squared, meaning $x$ times $x$)".
6. **One idea per sentence.** Aim for 20 words or fewer, and never write more than 35. Split a semicolon or a trailing "which" clause into its own sentence.
7. **Numbers before letters.** Show the idea with concrete numbers first. Then give the pattern with letters. The formal statement comes last, in the closing `formal` section or the `principle`.
8. **Explain before naming.** A summary, goal or objective never names a property or theorem before the lesson has explained it. This includes the zero-product property, the distributive property and the Pythagorean theorem. Say what the rule does first, then give its name.
9. **Steps say why.** Each worked step gives its reason as well as its action: "Subtract 3 from both sides so $2x$ stands alone. Both sides stay equal."
10. **Stay exact.** Plain words never trade away accuracy. Keep conditions ($a \ne 0$, "a real number"), restrictions and exceptions, and say them plainly.

### Before and after

The summary of `quadratic-factored-solutions` (`quadratic-lessons.ts`) names a property it has not explained and uses three undefined terms:

> **Before:** Use the zero-product property to find the complete real solution set.
>
> **After:** If two numbers multiply to make zero, at least one of them is zero. In $(x - 2)(x + 3) = 0$, the factors (the parts being multiplied) are $x - 2$ and $x + 3$. So $x - 2 = 0$ or $x + 3 = 0$. That gives $x = 2$ or $x = -3$. A value that makes the equation true is called a solution. This finds every solution.

The intuition of `quadratic-real-solution-count` (`quadratic-lessons.ts`) starts with letters and symbols, then names the discriminant before showing what it does:

> **Before:** A quadratic has the form $ax^2+bx+c=0$ with $a\ne0$; $a$, $b$, and $c$ are its signed number coefficients. Its discriminant is $D=b^2-4ac$.
>
> **After:** In $2x^2 + 3x - 5 = 0$, $x^2$ ($x$ squared) means $x$ times $x$. An equation like this, with an $x^2$ part and nothing like $x^3$ ($x$ times $x$ times $x$), is called a quadratic. Its coefficients are the numbers that multiply each part: $2$ multiplies $x^2$, and $3$ multiplies $x$. The last number, $-5$, stands alone. Square the middle number. Then subtract 4 times the first and last numbers multiplied together: $3^2 - 4 \times 2 \times (-5) = 9 + 40 = 49$. This number is called the discriminant. Its sign tells how many different real-number solutions (values on the number line that make the equation true) there are.

### Checking a rewrite

- `npm run review:plain -- --file src/content/<file>.ts --run <name>` asks a Codex judge to read each lesson as a learner one band below. It covers the reference lesson and the practice lesson of every template. Select with `--lesson`, `--template`, `--strand`, `--band`, `--sample` or `--all`, and use `--print` to see the exact text it reads. It writes `artifacts/plain-language/<name>.json` and `<name>.md`. A run uses effort `high` by default (a few minutes per lesson, eight lessons at a time); `--effort medium` is faster for a first pass. Reusing a run name skips lessons already judged on unchanged text and retries failures. Quote the before and after counts in the PR, and resolve every high and medium finding or explain why it is wrong.
- `tests/plain-language.test.ts` (in `npm run test:content`, which runs after merge) walks every reference lesson and every practice lesson in render order. A practice lesson covers its opening, method, watch for, principle and terms; the generated example is not walked. It links glossary terms (`src/glossary/`) on each screen.
  - The first use of every glossary term on a screen must sit in a defining sentence. Rule 2's patterns count, as do "has", "let … be", "we write … for" and "the longest side is the hypotenuse".
  - Words the glossary places in kindergarten to grade 2 count as known from grade 3 on.
  - No sentence in a summary, intuition, practice opening or goal may exceed 35 words.
  - Existing violations are in `tests/fixtures/plain-language-baseline.json`, keyed by screen: `lesson:<lesson id>` or `practice:<template id>`. Each screen lists its undefined term ids and its long sentences (by their first eight words).
  - The baseline only shrinks. The test fails on a new violation and on a fixed one still listed. Run it before pushing a rewrite: `node --import tsx --test tests/plain-language.test.ts`.
  - After a rewrite, `npm run plain:baseline` removes the entries you cleared and refuses to record new ones. `--report` prints counts per band.
  - A glossary entry your PR adds is new to every lesson: `npm run plain:baseline -- --new-terms=<id>,<id>` records its violations, and refuses ids that were already in the glossary.
  - After a merge conflict in the baseline, run `git checkout origin/main -- tests/fixtures/plain-language-baseline.json`, then `npm run plain:baseline`.

## Writing rules

- Terms are defined once, in the shared glossary (`src/glossary/`, see `docs/glossary.md`). A method's `terms` lists glossary ids, optionally `[id, note]` for this problem's symbols or convention; add a missing term to the glossary rather than defining it locally. Give an ambiguous word (range, mean, product, similar) its sense in `senses`, or list an ordinary use in `noLink`. The glossary does not replace the definition at first use (rule 2).
- Connect each symbol to the quantity it represents. For fractions, explain the whole, equal parts, numerator, and denominator. For right triangles, explain a triangle, a right angle, the legs, and the hypotenuse.
- Explain why a method works before turning it into a rule. Show what stays unchanged during a transformation and why the next step is valid. Preserve explicit algebraic and arithmetic steps.
- Concision removes empty words, repetition without purpose, and motivational filler. It must not remove definitions, reasoning, intermediate steps, useful comparisons, or checks. Use enough space to make the explanation complete.
- Teach proper mathematical vocabulary, each word with its plain meaning. Never substitute an unexplained technical synonym for an explanation.
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
