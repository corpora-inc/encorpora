import { defineLedger } from "./types";

export const mcas2025Grade10 = defineLedger(
  {
    id: "mcas-2025-10",
    test: "MCAS grade 10 mathematics",
    form: "Spring 2025 released items",
    url: "https://www.doe.mass.edu/mcas/2025/release/g10-math.pdf",
    edition: "Spring 2025, grade 10 released paper items",
    retrievedAt: "2026-10-26",
    sha256: "01b4fa2c071b3fa5e9641a8ec7f241a78dc0de8a018b95d1d5229d8530442554",
    complete: false,
  },
  {
    labeledBy: "agent:assessment-sample",
    labeledAt: "2026-10-22",
    section: "Released items",
  },
  [
    {
      item: { number: "2", page: "printed p.4" },
      responseFormat: "choice",
      standards: ["G-C.B.5"],
      archetypeIds: ["circle.arc-sector"],
      demand: "Identify a sector-area expression",
      status: "partial",
      templateIds: ["sector-area-coefficient"],
      limitations:
        "Numeric coefficient exists; expression selection and complementary-angle reasoning need explicit cases.",
    },
    {
      item: { number: "3", page: "printed p.5" },
      responseFormat: "choice",
      standards: ["A-REI.A.1"],
      archetypeIds: ["linear.step-justification"],
      demand: "Justify successive equation steps",
      status: "partial",
      templateIds: ["equation-step-property"],
      limitations:
        "Single-step reason practice does not establish a complete multi-step justification.",
    },
    {
      item: { number: "10", page: "printed p.10" },
      responseFormat: "multi-select",
      standards: ["G-CO.B.7"],
      archetypeIds: ["triangle.congruence-correspondence"],
      demand: "Read corresponding parts from congruence notation",
      status: "missing",
      templateIds: [],
      limitations:
        "Congruence correspondence and selecting all parts need direct practice.",
    },
    {
      item: { number: "25", page: "printed p.25" },
      responseFormat: "choice",
      standards: ["N-Q.A.3"],
      archetypeIds: ["number.measurement-error-bound"],
      demand: "Use a measurement-error bound",
      status: "partial",
      templateIds: ["measurement-error-bound"],
      limitations:
        "Explicit absolute/relative bounds implemented; other precision conventions and the original choice format are not certified.",
    },
    {
      item: { number: "27", page: "printed pp.27–28" },
      responseFormat: "constructed",
      standards: ["F-IF.A.2"],
      archetypeIds: ["quadratic.context", "nonlinear.input-output"],
      demand: "Evaluate and interpret a contextual quadratic",
      status: "partial",
      templateIds: ["function-evaluation"],
      limitations:
        "Evaluation component exists; contextual domain restrictions, multipart reasoning and written interpretation remain distinct.",
    },
  ],
);
