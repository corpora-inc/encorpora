/** Bounded decisions taught in Balance and Change; no whole-standard claim. */
const rows = `
substitute-linear-expression|Put a value into a rule|variable-expressions|substitution|numeric|Evaluate a signed linear expression at an integer or half-integer input.|Nonzero coefficient −6…6, constant −9…9, input n/2 for n=−12…12.
distributive-expression-choice|Multiply into parentheses|expression-properties|equivalent|choice|Recognize an equivalent expansion of a signed grouped expression.|Integer coefficient with absolute value 2…6 and nonzero constant −6…6; three distinct linear options.
combine-like-coefficient|Collect the x terms|linear-expressions|like-terms|numeric|Find only the coefficient of x after combining like terms.|Two nonzero integer coefficients −8…8 and a constant −9…9; a zero combined coefficient is possible.
grouped-linear-equation|Unwrap an equation|linear-equations|grouped-equation|numeric|Solve a grouped linear equation with an exact rational result.|Nonzero integer outer coefficient −6…6, inner constant −8…8, right side −20…20.
negative-coefficient-equation|Undo a negative multiplier|linear-equations|negative-coefficient|numeric|Solve an equation with a negative coefficient.|Coefficient −6…−1 and constants −12…12; exact rational result.
rational-coefficient-equation|Undo a fraction multiplier|linear-equations|rational-equations|numeric|Solve an equation whose x coefficient is a noninteger fraction.|Numerator ±1,±3,±5; denominator 2,4,6 excluding integral ratios; constants −9…9.
both-sides-linear-equation|Bring the unknowns together|linear-equations|both-sides|numeric|Solve a unique-solution equation with variables on both sides.|Distinct nonzero integer coefficients −6…6 and constants −12…12.
check-equation-candidate|Test a proposed answer|linear-equations|check-original|choice|Select the correct substitution check of a proposed integer value.|Nonzero integer coefficient −6…6, constant −9…9, candidate −6…6; true and false proposals.
unequal-step-rate|Look past the step sizes|slope|unequal-steps|numeric|Find a constant rate from linear observations with unequal input steps.|Signed nonzero numerator −6…6 over denominator 1…4; first input 0…3, unequal positive steps 1…4, intercept −5…5.
recover-linear-intercept|Find the output at zero|linear-models|intercept|numeric|Recover a zero-input output from a stated rate and another observation.|Signed nonzero numerator −6…6 over denominator 1…4; known input 1…6, integer intercept −8…8.
predict-linear-output|Extend a linear pattern|linear-models|build-model|numeric|Predict an output from two points under an explicit linear assumption.|Signed nonzero numerator −6…6 over denominator 1…4, intercept −5…5; inputs 0…2 and 3…5, requested input 6…9.
relation-function-choice|One input, one output?|function-notation|function|choice|Identify a finite relation with exactly one output for each input.|Integer pairs −5…5; valid duplicate records or shared outputs; invalid options repeat an input with different outputs.
proportional-rule-choice|Find a proportional rule|proportional-relationships|proportional|choice|Recognize a real-valued rule y=kx among affine rules with nonzero intercepts.|Nonzero integer k −6…6 and nonzero intercept −8…8; algebraic signed rules rather than physical price contexts.
shared-plan-input|Find when two plans meet|linear-systems|intersection|numeric|Find the nonnegative input where two affine cost rules agree.|Higher rate 2…8, lower rate 1…7 below it; fixed fee 1…20; input domain 0…24, exact rational crossing.
first-cheaper-whole-input|Find the first lower price|linear-models|whole-inputs|numeric|Find the first whole input at which a fixed-fee plan is strictly cheaper.|Higher rate 2…8, lower rate 1…7 below it, fee 1…20, whole inputs 0…24; includes ties and fractional crossing thresholds.
distance-graph-meaning|Read a distance graph|qualitative-graphs|qualitative|choice|Interpret a level or falling distance-from-home segment without inferring a route or motion speed.|Time 0…4, initial distance 4…8, final distance equal or 1…3 lower; graph axes and units stated in the prompt.
`;
export const algebraDefinitions = rows
  .trim()
  .split("\n")
  .map((row) => {
    const [id, title, skillId, pageId, mode, description, domain] = row.split(
      "|",
    ) as [string, string, string, string, "numeric" | "choice", string, string];
    return { id, title, skillId, pageId, mode, description, domain };
  });
