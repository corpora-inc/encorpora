import { defineLedger } from "./types";

/** Framework requirements rather than released questions; their response
 * format is unspecified, so they record related practice at most. */
export const satFramework2026 = defineLedger(
  {
    id: "sat-framework-2026",
    test: "SAT framework requirements",
    form: "Assessment Framework for the Digital SAT Suite, Appendix B",
    url: "https://satsuite.collegeboard.org/media/pdf/assessment-framework-for-digital-sat-suite.pdf",
    edition: "Version 4, September 2026",
    retrievedAt: "2026-10-26",
    sha256: "e1238b7840eb4c9af93a20e1bc415eafbf316b6a8adc6c131df5345ddca9549b",
    complete: false,
  },
  {
    labeledBy: "agent:assessment-sample",
    labeledAt: "2026-10-22",
    section: "Appendix B",
  },
  [
    {
      item: { number: "Table A37, margin of error", page: "PDF p.201" },
      responseFormat: "other",
      standards: ["sat.psda.inference-margin-of-error"],
      archetypeIds: ["inference.margin"],
      demand: "Interpret a sample estimate and margin of error",
      status: "partial",
      templateIds: ["margin-of-error-interval", "sample-size-margin"],
      limitations:
        "Interval selection and sample-size effects are practiced; mean estimation and other inference demands need further practice. A framework requirement has no single response format.",
    },
    {
      item: { number: "Table A38, radians and unit circle", page: "PDF p.203" },
      responseFormat: "other",
      standards: ["sat.geo.circles"],
      archetypeIds: [
        "circle.arc-sector",
        "circle.angle-units",
        "circle.unit-trig",
      ],
      demand: "Use radian measure and unit-circle ratios",
      status: "partial",
      templateIds: [
        "radian-arc-ratio",
        "degree-radian-conversion",
        "unit-circle-coordinate",
      ],
      limitations:
        "Arc-to-radius angles, degree-radian conversion and special-angle unit-circle coordinates are practiced; this requirement is not a single item, so the release format is not established.",
    },
    {
      item: { number: "Table A37, sampling and assignment", page: "PDF p.201" },
      responseFormat: "other",
      standards: ["sat.psda.evaluating-statistical-claims"],
      archetypeIds: ["study.scope"],
      demand: "Distinguish random sampling from random assignment",
      status: "partial",
      templateIds: [
        "representative-sample-choice",
        "study-design-choice",
        "scope-of-inference-choice",
      ],
      limitations:
        "One-choice cases distinguish sampling from assignment and their joint population-generalization and causal conclusions. Written study design, nonresponse and compliance effects, and statistical-significance calculations require separate practice.",
    },
  ],
);
