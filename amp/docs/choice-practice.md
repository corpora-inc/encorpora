# Interpretation practice

Practice includes deterministic single-choice questions alongside numeric and
fraction entry. The three interpretation families ask learners to recognize an
equivalent fraction, classify a linear equation's real solution set, and match a
line to its equation. They participate in the same mixed practice scheduler;
selecting a topic starts one focused question before returning to the mix.

## Contract and grading

A public response is either `{kind: "number" | "fraction", label}` or
`{kind: "choice", label, options: [{id, label}]}`. Choice responses contain two to
four distinct statements. IDs are `option-a` through `option-d` and identify
positions after a deterministic shuffle. They carry no correctness metadata.

The grading record retains the correct option ID, explanation, hint, and private
feedback keyed by incorrect option IDs. The server validates a submitted ID
against the owned, stored problem before grading. Choice labels are presentation
text, not accepted submission values. Retries reuse the original request ID and
response; an answered instance cannot earn a second attempt. Numeric entry keeps
its exact fraction and decimal normalization.

After an incorrect choice, the explanation begins with feedback about that
specific statement. Screens and printed solutions display the mathematical
statement rather than the internal option ID. Native radio controls support arrow
keys and Space. On a small phone, a focused answer panel retains the question and
model; checking an answer replaces that panel with focused feedback.

## Scope

| Family | Skill and standard component | Assessed task | Further evidence needed |
| --- | --- | --- | --- |
| `fraction-equivalence-choice` | Fraction equivalence; 4.NF.A.1 | Choose an equivalent proper fraction with denominator 2, 3, 4, or 6 and scale factor 2 or 3. | Learner-created models and explanations; broader values and transfer. |
| `equation-solution-count` | Linear equations; 8.EE.C.7.a | Classify one, none, or infinitely many real solutions for positive integer coefficients on both sides. | Construct examples, justify each class, and handle distribution, rational coefficients, and wider equation forms. |
| `graph-equation-choice` | Linear models; 8.F.B.4 | Select a rule for an increasing line from two annotated points, with integer slope 1–3 and intercept 4–6. | Construct a rule independently; interpret contextual units; decreasing, fractional, and nonlinear models. |

These are partial assessments. Guessing can produce a correct selection; repeated
choice success does not certify explanation, fluency, or complete skill mastery.
The scheduler stores observed task evidence and uses a heuristic for revisits.

## Verification

Run `npm test`, `npm run review:math`, and `npm run build`. With an isolated
PostgreSQL test database, run `npm run test:db` and `npm run test:choice-ui` using
`AMP_TEST_DATABASE_URL`. Set `AMP_BROWSER=webkit` for the WebKit choice journey.
The independent oracle checks every family at 256 or more seeds. Device checks
also inspect actual diagrams, option text, focus, and action placement.
