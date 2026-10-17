/** Editorial requirement inventory for the arithmetic/place-value slice; not full-standard certification. */
export interface ElementaryRequirement {
  sourceId: string;
  sourceUrl: string;
  reviewedAt: "2026-10-17";
  objective: string;
  templateIds: string[];
  remainingRequirements: string;
  status: "partial-practice" | "planned";
}
// source identifier | original navigation label | bounded task families | evidence still needed
const rows = `
K.OA.A.1|Represent joining and separating|join-within-10,take-away-within-10|Learner-created drawings, physical actions, oral explanations and other representations.
K.OA.A.2|Small arithmetic stories|join-within-10,take-away-within-10|Additional story structures and learner-selected representations.
K.OA.A.3|Several decompositions|number-bond-missing|Give multiple distinct decompositions of the same whole and explain them.
K.OA.A.4|Complete ten|ten-frame-complement|Learner-created equations and drawings connecting the complement to ten.
K.OA.A.5|Fluency through five||Independent recall evidence over time; untimed correct answers do not establish fluency.
K.NBT.A.1|Ten and extras|teen-frame-compose|Learner-created composition and decomposition records, including drawings.
1.OA.A.1|Unknown story amounts|unknown-addend-story,missing-start-story|Comparison stories, unknown results, all unknown positions and independent representation choice.
1.OA.A.2|Three small addends|three-addend-story|Learner-generated drawings and equations for the same story.
1.OA.B.3|Useful operation properties|three-addend-story|Explain why regrouping or reversing addends preserves a sum and use it deliberately.
1.OA.B.4|Subtraction as missing addition|unknown-addend-story|Translate subtraction into a missing-addend equation independently.
1.OA.C.5|Counting with arithmetic|continue-count-to-120|Observe counting-on and counting-back strategies rather than only a next-number response.
1.OA.C.6|Strategies and fluency|make-ten-remainder,subtract-through-ten|Near doubles, linked facts, counting strategies, and independent fluency evidence within ten.
1.OA.D.7|Meaning of equality|balanced-addition|Classify true and false equations with varied operations and justify decisions.
1.OA.D.8|Unknown equation entries|number-bond-missing,balanced-addition|All unknown positions in addition and subtraction equations without scaffolding.
1.NBT.A.1|Read count and record|continue-count-to-120|Read numerals aloud and write numerals for object collections through120.
1.NBT.B.2|Tens and ones|tens-ones-model|Explain digit meanings and construct multiple representations.
1.NBT.B.2.a|One ten equals ten ones|tens-ones-model|Physically bundle ten ones and explain the equivalence.
1.NBT.B.2.b|Teen composition|teen-frame-compose|Connect teen-frame quantities to two-digit place notation independently.
1.NBT.B.2.c|Whole tens|tens-ones-model,subtract-whole-tens|Verify all whole tens10–90 and explain the zero ones place.
1.NBT.B.3|Two-digit comparison||Use >, = and < with place-value reasoning.
1.NBT.C.4|Add using unit groups|add-ones-regroup|Two-digit plus multiples-of-ten cases, learner-written methods and explanation of exchanges.
1.NBT.C.5|Change one ten|ten-more-or-less|Explain mentally without counting; extend bounded20–79 start values to all intended two-digit cases.
1.NBT.C.6|Subtract whole tens|subtract-whole-tens|Learner-created models and written explanations of the method.
2.OA.A.1|Two-step stories|two-step-change|Comparison structures, other operation orders, unknowns in all positions and learner modeling.
2.OA.B.2|Recall small facts||Repeated independent fluency and memory evidence; this slice does not certify recall.
2.OA.C.3|Pairing and parity||Pair groups through20, determine parity and write equal-addend equations.
2.OA.C.4|Arrays and repeated sums||Create and interpret arrays up to5 by5 and record repeated-addition equations.
2.NBT.A.1|Hundreds tens and ones|hundreds-model,expanded-form-missing,exchange-base-ten|Explain digit meaning and construct representations beyond numeric entry.
2.NBT.A.1.a|One hundred equals ten tens|exchange-base-ten|Physically bundle ten tens and explain preserved value.
2.NBT.A.1.b|Whole hundreds|hundreds-model|Systematically verify whole hundreds100–900 and both zero-place meanings.
2.NBT.A.2|Count in equal steps|skip-count-missing|Full counting within1000, arbitrary supported starts and learner-generated count sequences.
2.NBT.A.3|Three number representations|hundreds-model,expanded-form-missing|Number-name reading and writing, full expanded-form composition and boundary value1000.
2.NBT.A.4|Three-digit comparison||Use >, = and < with hundreds/tens/ones reasoning.
2.NBT.B.5|Fluent two-digit arithmetic|add-ones-regroup|General two-digit addition and subtraction, strategy flexibility and fluency evidence.
2.NBT.B.6|Several two-digit addends|add-several-two-digit|Larger addends outside10–59 and learner explanations of regrouping or grouping choices.
2.NBT.B.7|Exchange during calculation|add-with-regrouping,subtract-with-regrouping|Full operation domain including nonexchange cases; learner models and written-method explanations.
2.NBT.B.8|Mental changes by units||Mental plus/minus10 and100 across the complete100–900 starting domain with reasoning.
2.NBT.B.9|Explain arithmetic strategies||Independent learner explanation; generated worked solutions teach but do not assess reasoning.
`;
export const elementaryRequirements: ElementaryRequirement[] = rows
  .trim()
  .split("\n")
  .map((row) => {
    const [sourceId, objective, ids, remainingRequirements] = row.split(
      "|",
    ) as [string, string, string, string];
    return {
      sourceId,
      objective,
      templateIds: ids ? ids.split(",") : [],
      remainingRequirements,
      sourceUrl: `https://www.thecorestandards.org/Math/Content/${sourceId.replaceAll(".", "/")}/`,
      reviewedAt: "2026-10-17",
      status: ids ? "partial-practice" : "planned",
    };
  });
