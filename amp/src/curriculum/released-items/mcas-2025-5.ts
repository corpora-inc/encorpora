import { defineLedger } from "./types";

export const mcas2025Grade5 = defineLedger(
  {
    id: "mcas-2025-5",
    test: "MCAS grade 5 mathematics",
    form: "Spring 2025 released items",
    url: "https://www.doe.mass.edu/mcas/2025/release/g5-math.pdf",
    edition: "Spring 2025, grade 5 released paper items",
    retrievedAt: "2026-10-26",
    sha256: "6dedef5ac359436a52c8a110f97c2be202085f51761973df61d3570db686a801",
    complete: false,
  },
  {
    labeledBy: "agent:assessment-sample",
    labeledAt: "2026-10-22",
    section: "Released items",
  },
  [
    {
      item: { number: "1", page: "printed p.5" },
      responseFormat: "choice",
      standards: ["5.NBT.B.5"],
      archetypeIds: ["number.multidigit-multiply-context"],
      demand: "Multiply a three-digit by a two-digit whole number",
      status: "covered",
      templateIds: ["multiply-multidigit"],
      limitations:
        "Numeric entry of the same products; the released item's choice distractors and any contextual transfer are not separately verified.",
    },
    {
      item: { number: "4", page: "printed p.7" },
      responseFormat: "choice",
      standards: ["5.NBT.A.4"],
      archetypeIds: ["number.inverse-rounding", "number.round-decimal"],
      demand: "Find an input producing a rounded decimal",
      status: "covered",
      templateIds: ["round-decimal", "inverse-round-decimal"],
      limitations:
        "One-choice inverse rounding to a tenth or hundredth is assessed with half-up boundaries. General inverse intervals and multi-select responses are unassessed.",
    },
    {
      item: { number: "8", page: "printed p.11; PDF p.13" },
      responseFormat: "multi-select",
      standards: ["5.G.B.4"],
      archetypeIds: ["shape.quadrilateral-hierarchy"],
      demand: "Select three true quadrilateral hierarchy statements",
      status: "covered",
      templateIds: [
        "classify-quadrilateral",
        "quadrilateral-hierarchy-multiselect",
      ],
      limitations:
        "Original items select three true statements from five or six choices, including the released item's three-of-six format. Inclusive categories, inherited properties, and defining conditions are assessed; drawing a hierarchy, creating counterexamples, and written justification are unassessed. This sample does not establish full standard coverage.",
    },
    {
      item: { number: "9", page: "printed p.11" },
      responseFormat: "choice",
      standards: ["5.NF.B.3"],
      archetypeIds: ["number.fraction-as-division"],
      demand: "Recognize a fraction as a division expression",
      status: "covered",
      templateIds: ["whole-sharing-fraction", "fraction-division-expression"],
      limitations:
        "Numeric sharing and one-choice fraction-to-division recognition are assessed. Constructing an expression, explaining a model, and broader sharing contexts remain unassessed.",
    },
    {
      item: { number: "19", page: "printed p.21" },
      responseFormat: "multi-select",
      standards: ["5.NBT.A.3"],
      archetypeIds: ["number.decimal-expanded-compare"],
      demand: "Expanded decimals and multiple comparisons",
      status: "partial",
      templateIds: ["expanded-decimal", "compare-decimals-thousandths"],
      limitations:
        "Components exist; multipart multi-select format and linked scoring are unassessed.",
    },
  ],
);
