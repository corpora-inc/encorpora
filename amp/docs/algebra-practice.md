# Algebra practice and teaching pages

Balance and Change connects illustrated instruction with bounded practice in substitution, equivalent expressions, equations, rates, functions, proportional rules, plan comparisons and distance graphs. These questions enter the same mixed practice scheduler as other implemented topics. Learners can open teaching support from a problem and return to the practice sequence.

Sixteen additional families are defined in `src/content/algebra-definitions.ts`. Each record names its skill, exact teaching page, assessed decision and parameter domain. `books/balance-and-change/practice.ts` describes response limits; the editorial alignments attach selected standards without claiming complete coverage. Five concise reference lessons provide an alternate explanation and worked example.

Numeric answers use exact integers or fractions. Five families use single-choice responses and require the `single-choice-v1` client capability. Choice order is shuffled before assigning public option identifiers. Correct answers, hints, explanations and misconception feedback stay on the grading side until the corresponding authorized action.

A result alone does not demonstrate a constructed explanation or equation, a complete standard, transfer to unfamiliar contexts, or durable mastery. The coverage records preserve these distinctions. For example, identifying a proportional algebraic rule with a signed multiplier is narrower than interpreting every physical ratio situation in grade seven.

The independent Python reviewer reconstructs mathematical answers from the public prompts, choices and figures. It uses exact rational arithmetic, checks that each choice question has one correct option, and rejects contradictory givens. The audit includes at least 256 deterministic cases per family and separate handwritten boundary cases. Browser verification exercises answer submission, selected-distractor feedback, teaching support and mixed continuation at phone, landscape and desktop sizes. These checks complement editorial review; they do not establish classroom effectiveness or a calibrated learning-outcome claim.
