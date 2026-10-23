/** A purposive gap-finding sample, not an estimate of test frequency or state coverage.
 * Descriptions are original summaries; source questions and artwork are not copied. */
export const assessmentSources = [
  {
    id: "sat-framework-2026",
    url: "https://satsuite.collegeboard.org/media/pdf/assessment-framework-for-digital-sat-suite.pdf",
    version: "Version 4, September 2026",
    reviewedAt: "2026-10-22",
  },
  {
    id: "sat-practice-10",
    url: "https://satsuite.collegeboard.org/media/pdf/sat-practice-test-10-digital.pdf",
    version: "Practice Test 10, nonadaptive paper form of the digital test",
    reviewedAt: "2026-10-22",
  },
  {
    id: "mcas-2025-5",
    url: "https://www.doe.mass.edu/mcas/2025/release/g5-math.pdf",
    version: "Spring 2025, grade 5 released paper items",
    reviewedAt: "2026-10-22",
  },
  {
    id: "mcas-2025-8",
    url: "https://www.doe.mass.edu/mcas/2025/release/g8-math.pdf",
    version: "Spring 2025, grade 8 released paper items",
    reviewedAt: "2026-10-22",
  },
  {
    id: "mcas-2025-10",
    url: "https://www.doe.mass.edu/mcas/2025/release/g10-math.pdf",
    version: "Spring 2025, grade 10 released paper items",
    reviewedAt: "2026-10-22",
  },
] as const;
export interface AssessmentSampleItem {
  sourceId: (typeof assessmentSources)[number]["id"];
  item: string;
  requirement: string;
  templateIds: readonly string[];
  /** Unassessed parts, response-format differences, or scope limits. Never implies complete coverage. */
  limitations: string;
}
export const assessmentSample: readonly AssessmentSampleItem[] = [
  {
    sourceId: "mcas-2025-5",
    item: "1; printed p.5",
    requirement: "Contextual multidigit multiplication",
    templateIds: ["multiply-multidigit"],
    limitations:
      "Arithmetic exists; independently verify the contextual transfer and choice distractors.",
  },
  {
    sourceId: "mcas-2025-5",
    item: "4; printed p.7",
    requirement: "Find an input producing a rounded decimal",
    templateIds: ["round-decimal"],
    limitations:
      "Forward rounding exists; inverse rounding and interval endpoints need dedicated practice.",
  },
  {
    sourceId: "mcas-2025-5",
    item: "8; printed p.11",
    requirement: "Select every true quadrilateral classification",
    templateIds: ["classify-quadrilateral"],
    limitations:
      "Related classification exists; selecting all valid statements is not the same response as one choice.",
  },
  {
    sourceId: "mcas-2025-5",
    item: "9; printed p.11",
    requirement: "Interpret division as a fraction",
    templateIds: ["whole-sharing-fraction"],
    limitations:
      "Related numeric sharing; verify expression-interpretation choices separately.",
  },
  {
    sourceId: "mcas-2025-5",
    item: "19; printed p.21",
    requirement: "Expanded decimals and multiple comparisons",
    templateIds: ["expanded-decimal", "compare-decimals-thousandths"],
    limitations:
      "Components exist; multipart multi-select format and linked scoring are unassessed.",
  },
  {
    sourceId: "mcas-2025-8",
    item: "1; printed p.5",
    requirement: "Solve a linear system for coordinates",
    templateIds: ["linear-system-pair"],
    limitations:
      "Algebraic solving exists; graphical representation and exact exam response format require separate verification.",
  },
  {
    sourceId: "mcas-2025-8",
    item: "2; printed p.6",
    requirement: "Remove a point to make a function",
    templateIds: ["relation-function-choice", "relation-point-removal"],
    limitations:
      "The plotted task selects one choice naming every valid single-point removal. Direct point removal, native multiselect, and constructed justification are unassessed.",
  },
  {
    sourceId: "mcas-2025-8",
    item: "10; printed p.13",
    requirement: "Interpret a model intercept in context",
    templateIds: ["recover-linear-intercept"],
    limitations:
      "Related intercept calculation exists; verbal interpretation of the parameter and units needs direct verification.",
  },
  {
    sourceId: "mcas-2025-8",
    item: "16; printed pp.20–21",
    requirement: "Explain congruence through composed transformations",
    templateIds: [],
    limitations:
      "Constructed explanation and composition verification require a rubric and response support.",
  },
  {
    sourceId: "mcas-2025-8",
    item: "19; printed p.23",
    requirement: "Relate similar triangles to equal slopes",
    templateIds: [],
    limitations:
      "Combines similarity, slope reasoning and multiple statements; isolated numeric slopes do not close it.",
  },
  {
    sourceId: "mcas-2025-10",
    item: "2; printed p.4",
    requirement: "Identify a sector-area expression",
    templateIds: ["sector-area-coefficient"],
    limitations:
      "Numeric coefficient exists; expression selection and complementary-angle reasoning need explicit cases.",
  },
  {
    sourceId: "mcas-2025-10",
    item: "3; printed p.5",
    requirement: "Justify successive equation steps",
    templateIds: ["equation-step-property"],
    limitations:
      "Single-step reason practice does not establish a complete multi-step justification.",
  },
  {
    sourceId: "mcas-2025-10",
    item: "10; printed p.10",
    requirement: "Read corresponding parts from congruence notation",
    templateIds: [],
    limitations:
      "Congruence correspondence and selecting all parts need direct practice.",
  },
  {
    sourceId: "mcas-2025-10",
    item: "25; printed p.25",
    requirement: "Use a measurement-error bound",
    templateIds: ["measurement-error-bound"],
    limitations:
      "Explicit absolute/relative bounds implemented; other precision conventions and the original choice format are not certified.",
  },
  {
    sourceId: "mcas-2025-10",
    item: "27; printed pp.27–28",
    requirement: "Evaluate and interpret a contextual quadratic",
    templateIds: ["function-evaluation"],
    limitations:
      "Evaluation component exists; contextual domain restrictions, multipart reasoning and written interpretation remain distinct.",
  },
  {
    sourceId: "sat-practice-10",
    item: "Math module 1, 22; printed p.39",
    requirement: "Scale area using a linear scale factor",
    templateIds: ["scale-drawing"],
    limitations:
      "Length and area scaling exist; verify inverse direction and the particular geometric context separately.",
  },
  {
    sourceId: "sat-practice-10",
    item: "Math module 1, 25; printed p.39",
    requirement: "Undo a large percentage increase",
    templateIds: ["percent-change-original"],
    limitations:
      "Inverse percent change exists; this family currently stops at smaller increases than the sampled item.",
  },
  {
    sourceId: "sat-practice-10",
    item: "Math module 1, 27; printed p.40",
    requirement: "Sum roots after rearranging a quadratic",
    templateIds: ["quadratic-expanded-solutions"],
    limitations:
      "Solving related quadratics exists; root-sum reasoning from rearranged expressions is a separate transfer.",
  },
  {
    sourceId: "sat-practice-10",
    item: "Math module 2, 24; printed p.49",
    requirement: "Choose a parameter giving one quadratic root",
    templateIds: ["quadratic-real-solution-count"],
    limitations:
      "Counting roots for fixed coefficients exists; solving a discriminant constraint for a parameter needs direct practice.",
  },
  {
    sourceId: "sat-practice-10",
    item: "Math module 2, 26; printed p.50",
    requirement: "Bound means from grouped integer data",
    templateIds: [],
    limitations:
      "Histogram reading and means do not establish extremal reasoning with bin endpoints.",
  },
  {
    sourceId: "sat-framework-2026",
    item: "Appendix B, Table A37; PDF p.201",
    requirement: "Interpret a sample estimate and margin of error",
    templateIds: ["margin-of-error-interval"],
    limitations:
      "Interval selection implemented; sample-size effects, mean estimation and other inference demands need further practice.",
  },
  {
    sourceId: "sat-framework-2026",
    item: "Appendix B, Table A38; PDF p.203",
    requirement: "Use radian measure and unit-circle ratios",
    templateIds: ["radian-arc-ratio"],
    limitations:
      "Arc-to-radius angle implemented; conversions and signed unit-circle trigonometric values remain missing.",
  },
  {
    sourceId: "sat-framework-2026",
    item: "Appendix B, Table A37; PDF p.201",
    requirement: "Distinguish sampling and random assignment",
    templateIds: ["representative-sample-choice", "study-design-choice"],
    limitations:
      "Reuses existing families; joint population-generalization and causal conclusions require further explicit cases.",
  },
];
export function buildAssessmentSampleAudit(templateIds: readonly string[]) {
  const known = new Set(templateIds);
  return {
    version: "2026-10-22.1",
    purpose: "purposive-gap-finding",
    frequencyEstimate: false,
    completeStandardsInventory: false,
    sources: assessmentSources,
    items: assessmentSample.map((item) => ({
      ...item,
      status: item.templateIds.some((id) => known.has(id))
        ? "related-practice-present"
        : "practice-gap",
      availableTemplateIds: item.templateIds.filter((id) => known.has(id)),
    })),
  };
}
