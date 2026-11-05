import { templates } from "../math/engine";
import { skills, standards } from "./catalog";
import { buildGapLedger } from "./gap-ledger";

/**
 * Practice judgment for grade 4. The source ledger still marks every linked
 * row partial and leaves coverageComplete false. "Full" here means the row's
 * mathematical demand is generated. A standing limit (a drawing the learner
 * makes, a free explanation, or a timed fluency check) does not by itself
 * keep a row partial. Prime factorization, two-digit divisors, and thousandths
 * were moved out of grade 4 on purpose and are not linked.
 */
export type Grade4Status = "full" | "partial" | "none" | "out-of-scope";

export interface Grade4Line {
  framework: string;
  id: string;
  text: string;
  status: Grade4Status;
  templates: readonly string[];
  /** Empty when the row is full. */
  gap: string;
}

interface CcssRow {
  id: string;
  status: Grade4Status;
  templates: readonly string[];
  gap?: string;
}

const ccssRows: readonly CcssRow[] = [
  {
    id: "4.OA.A.1",
    status: "full",
    templates: [
      "comparison-amount",
      "comparison-factor",
      "mcas-comparison-equations-select",
      "times-as-many-counts",
      "times-as-many-comparison",
    ],
  },
  {
    id: "4.OA.A.2",
    status: "full",
    templates: [
      "comparison-amount",
      "comparison-factor",
      "mcas-comparison-equations-select",
      "times-as-many-comparison",
    ],
  },
  {
    id: "4.OA.A.3",
    status: "full",
    templates: [
      "full-kits",
      "seats-needed",
      "kit-leftovers",
      "strip-diagram-equation",
    ],
  },
  {
    id: "4.OA.B.4",
    status: "partial",
    templates: [
      "factor-pairs-select",
      "factor-partner",
      "multiples-select",
      "prime-composite-sort",
      "divisibility-rule-check",
    ],
    gap: "1 is not asked, and the item does not state that the number is a multiple of each of its factors. Prime factorization is grade 6 and is not linked.",
  },
  {
    id: "4.OA.C.5",
    status: "partial",
    templates: [
      "rule-pattern-term",
      "rule-pattern-feature",
      "pattern-rule-choice",
    ],
    gap: "A later term and a feature are generated. A free explanation is not.",
  },
  {
    id: "4.NBT.A.1",
    status: "partial",
    templates: [
      "digit-value-ratio",
      "place-shift-value",
      "multidigit-digit-value",
    ],
    gap: "A comparison can use a factor of 100 or 1,000, so it is not limited to the neighboring place. Dividing the whole number by ten is not its own item.",
  },
  {
    id: "4.NBT.A.2",
    status: "full",
    templates: [
      "place-value-forms-select",
      "number-name-numeral",
      "expanded-whole-slots",
      "compare-symbol-blanks",
      "compare-multidigit",
    ],
  },
  {
    id: "4.NBT.A.3",
    status: "full",
    templates: ["round-large"],
  },
  {
    id: "4.NBT.B.4",
    status: "partial",
    templates: ["add-multidigit", "subtract-multidigit"],
    gap: "The result of a four- to six-digit sum or difference is checked. The written algorithm is not.",
  },
  {
    id: "4.NBT.B.5",
    status: "full",
    templates: [
      "multiply-by-one-digit",
      "multiply-two-digit",
      "area-model-product",
      "tens-contribution",
    ],
  },
  {
    id: "4.NBT.B.6",
    status: "full",
    templates: [
      "divide-by-one-digit",
      "division-remainder",
      "quotient-remainder-one-digit",
      "division-area-model",
    ],
  },
  {
    id: "4.NF.A.1",
    status: "partial",
    templates: [
      "equivalent-numerator",
      "equivalent-denominator",
      "fraction-equivalence-choice",
      "equivalent-fractions-select",
      "equivalent-fractions-number-line",
    ],
    gap: "Equivalents are generated from numbers, strips, and one marked point on a number line. A written explanation of the part size is not.",
  },
  {
    id: "4.NF.A.2",
    status: "full",
    templates: [
      "compare-unlike-fractions",
      "order-fractions-slots",
      "fraction-choice-compare",
      "compare-fractions-symbol-blanks",
    ],
  },
  {
    id: "4.NF.B.3",
    status: "full",
    templates: [
      "fraction-decompositions-select",
      "like-fraction-missing-part",
      "like-fraction-difference",
      "like-fraction-sum-story",
      "mixed-fraction-difference",
      "mixed-fraction-sum",
    ],
  },
  {
    id: "4.NF.B.4",
    status: "full",
    templates: [
      "whole-times-fraction",
      "fraction-of-set",
      "unit-fraction-multiple-blanks",
    ],
  },
  {
    id: "4.NF.C.5",
    status: "partial",
    templates: ["tenths-as-hundredths"],
    gap: "Tenths are rewritten as hundredths and can be added to hundredths. A sum that keeps both denominators visible is not certified.",
  },
  {
    id: "4.NF.C.6",
    status: "full",
    templates: [
      "decimal-grid-read",
      "decimal-mixed-number-blanks",
      "tenths-as-hundredths",
      "decimal-line-point",
      "decimal-fraction-locate",
    ],
  },
  {
    id: "4.NF.C.7",
    status: "full",
    templates: [
      "compare-decimals-hundredths",
      "compare-decimals-symbol-blanks",
    ],
  },
  {
    id: "4.MD.A.1",
    status: "partial",
    templates: [
      "unit-relative-size",
      "metric-length-rename",
      "customary-unit-rename",
      "unit-rename-larger",
      "rename-time-units",
      "conversion-table-slots",
    ],
    gap: "Both conversion directions are generated for length, mass, capacity, and hours and minutes. Seconds are not in the conversion table.",
  },
  {
    id: "4.MD.A.2",
    status: "partial",
    templates: [
      "elapsed-time-intervals",
      "money-decimal-story",
      "decimal-sum-difference",
      "money-model-decimal",
      "measurement-line-fraction-story",
      "conversion-chain-story",
      "metric-length-rename",
      "customary-unit-rename",
    ],
    gap: "Time, money, and some length stories are generated. All four operations are not assessed on distance, liquid volume, and mass.",
  },
  {
    id: "4.MD.A.3",
    status: "partial",
    templates: [
      "rectangle-formula-select",
      "rectangle-missing-area-side",
      "same-area-border-choice",
      "same-border-area-choice",
      "composite-rectangle-measure",
    ],
    gap: "Grade-4 items choose a rectangle formula, find a missing area side, or measure a figure of two rectangles. The whole-number border items are the grade 3 perimeter skill and are not served as grade 4 practice.",
  },
  {
    id: "4.MD.B.4",
    status: "full",
    templates: [
      "fraction-plot-difference",
      "line-plot-build-slots",
      "line-plot-data-match",
      "line-plot-center-range",
      "dot-plot-arithmetic",
    ],
  },
  {
    id: "4.MD.C.5",
    status: "full",
    templates: ["turn-degrees"],
  },
  {
    id: "4.MD.C.6",
    status: "partial",
    templates: ["protractor-reading"],
    gap: "A drawn angle is measured. Sketching an angle of a given measure is not.",
  },
  {
    id: "4.MD.C.7",
    status: "full",
    templates: ["adjacent-angles", "adjacent-angle-equation"],
  },
  {
    id: "4.G.A.1",
    status: "full",
    templates: ["line-ray-segment", "line-relationship", "angle-classify"],
  },
  {
    id: "4.G.A.2",
    status: "partial",
    templates: [
      "shape-sides-select",
      "quadrilateral-attributes",
      "classify-triangle-angles",
      "triangle-sides-angles-blanks",
    ],
    gap: "Triangles and quadrilaterals are classified from sides and angles. An angle of a stated degree, other than a right angle, is not the sorting rule.",
  },
  {
    id: "4.G.A.3",
    status: "partial",
    templates: ["symmetry-line-count", "symmetry-line-check"],
    gap: "Lines of symmetry are counted and checked. Drawing the line is not.",
  },
];

/** Rows whose mathematical demand is generated. Every other linked row stays partial. */
const fullKeys = new Set<string>([
  ...ccssRows.filter((row) => row.status === "full").map((row) => `CCSS:${row.id}`),
  "GA:4.NR.1.1",
  "GA:4.NR.1.3",
  "GA:4.NR.1.4",
  "GA:4.NR.2.2",
  "GA:4.NR.2.3",
  "GA:4.NR.2.4",
  "GA:4.NR.4.6",
  "GA:4.PAR.3.1",
  "GA:4.MDR.6.3",
  "AR:4.NPV.6",
  "AR:4.CAR.2",
  "AR:4.CAR.4",
  "AR:4.CAR.5",
  "AZ:4.NBT.A.3",
  "AZ:4.NBT.B.6",
  "AZ:4.NF.B.3",
  "AZ:4.NF.C.7",
  "FL:MA.4.NSO.2.4",
  "FL:MA.4.NSO.2.6",
  "FL:MA.4.NSO.2.7",
  "TX:TX.4.2.D",
  "TX:TX.4.3.D",
]);

const cell = (value: string) =>
  value.replaceAll("|", "\\|").replaceAll("\n", " ");

const unique = (ids: readonly string[]) => [...new Set(ids)];
const gradeBandOf = new Map(skills.map((skill) => [skill.id, skill.gradeBand]));
const skillOfTemplate = new Map(
  templates.map((template) => [template.id, template.skillId]),
);
const isGrade4Template = (id: string) =>
  gradeBandOf.get(skillOfTemplate.get(id) ?? "") === "4";

export function grade4CoverageLines(): readonly Grade4Line[] {
  const byStandard = new Map(standards.map((standard) => [standard.id, standard]));
  const ccss = ccssRows.map((row): Grade4Line => {
    const standard = byStandard.get(row.id);
    if (!standard) throw new Error(`Unknown CCSS standard ${row.id}`);
    return {
      framework: "CCSS",
      id: row.id,
      text: standard.description,
      status: row.status,
      templates: row.templates,
      gap: row.gap ?? "",
    };
  });
  const report = buildGapLedger();
  if (!report.valid) throw new Error(report.errors.join("\n"));
  const wanted = report.sourceReconciliation.slices.filter(
    (slice) =>
      slice.grade === "4" ||
      slice.requirements.some((requirement) =>
        requirement.id.startsWith("MA.4."),
      ),
  );
  const states = wanted.flatMap((slice) => {
    const framework =
      slice.targetId === "US.GA"
        ? "Georgia"
        : slice.targetId === "US.FL"
          ? "Florida"
          : slice.targetId === "US.TX"
            ? "Texas"
            : slice.targetId === "US.AR"
              ? "Arkansas"
              : slice.targetId === "US.AZ"
                ? "Arizona"
                : slice.targetId;
    return slice.requirements
      .filter(
        (requirement) =>
          slice.grade === "4" || requirement.id.startsWith("MA.4."),
      )
      .map((requirement): Grade4Line => {
        const tasks = slice.tasks.filter((task) =>
          task.requirementIds.includes(requirement.id),
        );
        const linked = unique(tasks.flatMap((task) => task.templateIds));
        const grade4 = linked.filter(isGrade4Template);
        const shown = grade4.length ? grade4 : linked;
        const key = `${framework === "Georgia" ? "GA" : framework === "Florida" ? "FL" : framework === "Texas" ? "TX" : framework === "Arkansas" ? "AR" : "AZ"}:${requirement.id}`;
        const process =
          requirement.reconciliation === "cross-cutting" ||
          requirement.id === "TX.4.1";
        const note = unique(tasks.map((task) => task.limitations)).join(" ");
        const disclaimed =
          grade4.length === 0 &&
          /not served as grade 4 practice/.test(note);
        const status: Grade4Status = process
          ? "out-of-scope"
          : requirement.reconciliation === "unreviewed" || disclaimed
            ? "none"
            : fullKeys.has(key)
              ? "full"
              : "partial";
        const gap = process
          ? "Process standard. Item practice does not assess it."
          : status === "none" && requirement.reconciliation === "unreviewed"
            ? requirement.scope
            : status === "none" || status === "partial"
              ? note
              : "";
        return {
          framework,
          id: requirement.id,
          text: requirement.description,
          status,
          templates:
            status === "none" || status === "out-of-scope" ? [] : shown,
          gap,
        };
      });
  });
  return [...ccss, ...states];
}

export function grade4Summary(lines: readonly Grade4Line[]) {
  const count = (status: Grade4Status) =>
    lines.filter((line) => line.status === status).length;
  const full = count("full");
  const partial = count("partial");
  const uncovered = count("none");
  const outOfScope = count("out-of-scope");
  return {
    full,
    partial,
    none: uncovered + outOfScope,
    uncovered,
    outOfScope,
    rows: lines.length,
  };
}

const frameworkOrder = [
  "CCSS",
  "Georgia",
  "Florida",
  "Texas",
  "Arkansas",
  "Arizona",
] as const;

export function renderGrade4Coverage(
  lines: readonly Grade4Line[] = grade4CoverageLines(),
): string {
  const skillOf = new Map(templates.map((template) => [template.id, template.skillId]));
  const aligned = new Map(
    skills.map((skill) => [
      skill.id,
      new Set(skill.alignments.map((alignment) => alignment.standardId)),
    ]),
  );
  for (const line of lines.filter((item) => item.framework === "CCSS"))
    for (const id of line.templates) {
      const skillId = skillOf.get(id);
      if (!skillId || !aligned.get(skillId)?.has(line.id))
        throw new Error(`${id} is not aligned to ${line.id}`);
    }
  const parts = [
    "# Grade 4 coverage",
    "",
    "New Hampshire uses the Common Core State Standards verbatim. Arizona 2016 is that text with edits, inventoried on its own. This page is the practice judgment for grade 4. The source ledger still records every linked row as partial and leaves `coverageComplete` false.",
    "",
    "Full means the row's mathematical demand is generated. Partial means a named part is still missing; the gap is the inventory note. Out of scope means a process standard, which item practice does not assess. None means the row has no item. Prime factorization, two-digit divisors, and thousandths were moved out of grade 4 on purpose and are not linked.",
    "",
    "Problem types are the template ids. A type is listed only when a generated item asks for that row, not merely the same topic. When a row also links an other-grade template, the table lists the grade-4 types. The inventory note names the other-grade link.",
    "",
  ];
  for (const framework of frameworkOrder) {
    const group = lines.filter((line) => line.framework === framework);
    const summary = grade4Summary(group);
    parts.push(
      `## ${framework}`,
      "",
      `${summary.full} full / ${summary.partial} partial / ${summary.none} none.`,
      "",
      `${summary.outOfScope} out of scope. ${summary.uncovered} with no item.`,
      "",
      "| Code | Standard | Status | AMP problem types |",
      "| --- | --- | --- | --- |",
      ...group.map(
        (line) =>
          `| ${line.id} | ${cell(line.text)} | ${line.status === "out-of-scope" ? "out of scope" : line.status} | ${cell(line.templates.join(", ") || "—")} |`,
      ),
      "",
      "### Remaining gaps",
      "",
    );
    const gaps = group.filter((line) => line.status !== "full");
    if (!gaps.length) parts.push("None.", "");
    else
      parts.push(
        ...gaps.map(
          (line) =>
            `- **${line.id}** (${line.status === "out-of-scope" ? "out of scope" : line.status}): ${line.gap}`,
        ),
        "",
      );
  }
  return parts.join("\n");
}
