import { defineLedger } from "./types";

export const ny2026Grade7 = defineLedger(
  {
    id: "ny-2026-7",
    test: "New York State grade 7 mathematics",
    form: "Spring 2026 released questions",
    url: "https://www.nysedregents.org/ei/math/2026/2026-released-items-math-g7.pdf",
    edition: "Spring 2026, grade 7 released mathematics questions",
    retrievedAt: "2026-10-26",
    sha256: "8c6be4db568fc9541fc233dd8231c1fba1eac7ad1611fbdee72e15e97e65ee28",
    complete: false,
  },
  { labeledBy: "agent:assessment-sample", labeledAt: "2026-10-23" },
  [
    {
      section: "Session 1",
      item: {
        number: "17",
        page: "printed p.10; PDF p.12; standard map PDF p.38",
      },
      responseFormat: "choice",
      standards: ["NY-7.RP.3"],
      archetypeIds: ["percent.successive"],
      demand:
        "Apply a discount, then tax to the discounted price, and round the final amount to cents",
      status: "covered",
      templateIds: ["successive-percent-change"],
      limitations:
        "Original numeric-response problems assess two stated changes with a changing base and final-only half-up cent rounding, including decimal rates. Selecting among the released item's distractors, inverse recovery, stepwise rounding and constructed justification are not assessed. This occurrence does not establish frequency or complete standards coverage.",
    },
  ],
);
