import { defineLedger } from "./types";

export const mcas2025Grade8 = defineLedger(
  {
    id: "mcas-2025-8",
    test: "MCAS grade 8 mathematics",
    form: "Spring 2025 released items",
    url: "https://www.doe.mass.edu/mcas/2025/release/g8-math.pdf",
    edition: "Spring 2025, grade 8 released paper items",
    retrievedAt: "2026-10-26",
    sha256: "7dbfcaac5ce7cc01b69b905c2991d6c64c2f9c3266238ec96849d95075ec1ddf",
    complete: false,
  },
  { labeledBy: "agent:assessment-sample", labeledAt: "2026-10-22" },
  [
    {
      section: "Session 1",
      item: { number: "1", page: "printed p.5" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["8.EE.C.8"],
      archetypeIds: ["system.solve"],
      demand: "Solve a linear system for coordinates",
      status: "partial",
      templateIds: ["linear-system-pair"],
      limitations:
        "Algebraic solving exists; graphical representation and exact exam response format require separate verification.",
    },
    {
      section: "Session 1",
      item: { number: "2", page: "printed p.6" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["8.F.A.1"],
      archetypeIds: ["function.point-removal", "function.identify"],
      demand: "Remove a point to make a function",
      status: "covered",
      templateIds: ["relation-function-choice", "relation-point-removal"],
      limitations:
        "The plotted task selects one choice naming every valid single-point removal. Direct point removal, native multiselect, and constructed justification are unassessed.",
    },
    {
      section: "Session 1",
      item: { number: "10", page: "printed p.13" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["8.SP.A.3"],
      archetypeIds: ["linear.meaning"],
      demand: "Interpret a model intercept in context",
      status: "covered",
      templateIds: ["recover-linear-intercept", "linear-initial-value-meaning"],
      limitations:
        "Intercept calculation and one-choice interpretation of an explicitly stated linear model are assessed. Fitting a model from data, graph-only inference, and constructed explanations remain unassessed by these families.",
    },
    {
      section: "Session 2",
      item: { number: "16", page: "printed pp.20–21" },
      responseFormat: "constructed",
      calculator: "permitted",
      standards: ["8.G.A.1"],
      archetypeIds: ["triangle.congruence-transformations"],
      demand: "Explain congruence through composed transformations",
      status: "missing",
      templateIds: [],
      limitations:
        "Constructed explanation and composition verification require a rubric and response support.",
    },
    {
      section: "Session 2",
      item: {
        number: "19",
        page: "printed p.23; PDF p.25; standard map printed p.25",
      },
      responseFormat: "multi-select",
      calculator: "permitted",
      standards: ["8.EE.B.6"],
      archetypeIds: ["line.slope-triangles"],
      demand: "Relate similar triangles to equal slopes",
      status: "covered",
      templateIds: ["slope-triangle-statements"],
      limitations:
        "Original three-of-six statement selections compare right triangles on one nonvertical line, including matching angles, similarity versus congruence, lengths and equal signed slopes. Separated triangles with horizontal and vertical legs are used; constructed proofs, arbitrary orientations and full 8.EE.B.6 coverage are not established. This occurrence does not estimate frequency.",
    },
  ],
);
