import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts.js";
import { random, shuffle } from "./distribution-practice.js";
import { serializeSelection } from "./selection-response.js";

export const quadrilateralHierarchyMultiselectTemplate: TemplateMetadata = {
  id: "quadrilateral-hierarchy-multiselect",
  version: 1,
  requiredResponseCapability: "multi-select-v1",
  title: "Choose every true shape statement",
  skillId: "shape-hierarchy",
  gradeBand: "3–5",
  description:
    "Select three true statements about quadrilateral categories, inherited properties, and the conditions that define a category.",
};

type Statement = { label: string; reason: string; check: string };

/** Original claims use inclusive categories; no trapezoid convention is needed. */
export function generateQuadrilateralHierarchyMultiselect(
  seed: string,
): GeneratedProblem {
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const meta = quadrilateralHierarchyMultiselectTemplate;
  const r = random(meta.id, seed);
  const short = r(2, 5);
  const long = short + r(2, 5);
  const angle = r(4, 8) * 10;
  const rectangle = `A rectangle ${short} cm wide and ${long} cm long has four right angles but unequal neighboring sides.`;
  const rhombus = `A rhombus can have four equal sides and alternating angles of $${angle}^\\circ$ and $${180 - angle}^\\circ$, with no right angles.`;
  const categoryCheck =
    "Compare the properties required by the first category with those required by the second.";
  const propertyCheck =
    "List the properties the named category requires, then compare them with the claim.";
  const conditionCheck =
    "Compare the given side or angle conditions with the definition of the claimed category.";
  const category: Statement[] = [
    {
      label:
        "Being a rectangle guarantees that a shape is also a parallelogram.",
      reason:
        "The four right angles of a rectangle make both pairs of opposite sides parallel, as a parallelogram requires.",
      check: categoryCheck,
    },
    {
      label:
        "A square belongs to both the rectangle group and the rhombus group.",
      reason:
        "Its four right angles meet the rectangle definition, and its four equal sides meet the rhombus definition.",
      check: categoryCheck,
    },
    {
      label: "A rhombus always belongs to the parallelogram group.",
      reason:
        "Every rhombus has two pairs of parallel opposite sides, as a parallelogram requires.",
      check: categoryCheck,
    },
    {
      label: "Every parallelogram also belongs to the quadrilateral group.",
      reason:
        "A parallelogram is a closed flat shape with four straight sides, so it is a quadrilateral.",
      check: categoryCheck,
    },
  ];
  const property: Statement[] = [
    {
      label: "Squares have 2 pairs of parallel opposite sides.",
      reason:
        "A square is a rectangle, and every rectangle has both pairs of opposite sides parallel.",
      check: propertyCheck,
    },
    {
      label: "Rectangles have opposite sides of equal length.",
      reason:
        "A rectangle is a parallelogram, so it has the parallelogram property of equal opposite sides.",
      check: propertyCheck,
    },
    {
      label: "Rhombuses have 4 sides of equal length.",
      reason:
        "Four equal side lengths are part of the definition of a rhombus.",
      check: propertyCheck,
    },
    {
      label: "Squares have 4 right angles.",
      reason:
        "A square is a rectangle, so each corner is a right angle, or square corner.",
      check: propertyCheck,
    },
  ];
  const condition: Statement[] = [
    {
      label: "Any rectangle with 4 equal sides must also be a square.",
      reason:
        "The rectangle already has four right angles. Four equal sides give it both features a square requires.",
      check: conditionCheck,
    },
    {
      label: "Any rhombus with 4 right angles must also be a square.",
      reason:
        "The rhombus already has four equal sides. Four right angles give it both features a square requires.",
      check: conditionCheck,
    },
    {
      label: "Any quadrilateral with 4 right angles must be a rectangle.",
      reason:
        "A quadrilateral with four right angles meets the definition of a rectangle, whether or not its sides are all equal.",
      check: conditionCheck,
    },
    {
      label: "Any quadrilateral with 4 equal sides must be a rhombus.",
      reason:
        "A quadrilateral with four equal sides meets the definition of a rhombus, whether or not it has right angles.",
      check: conditionCheck,
    },
  ];
  const falseCategory: Statement[] = [
    {
      label: "Being a rectangle guarantees that a shape is also a rhombus.",
      reason: `${rectangle} It is not a rhombus, which requires four equal sides.`,
      check: categoryCheck,
    },
    {
      label:
        "Being a parallelogram guarantees that a shape is also a rectangle.",
      reason: `${rhombus} This is a parallelogram but not a rectangle.`,
      check: categoryCheck,
    },
    {
      label: "Being a rhombus guarantees that a shape is also a square.",
      reason: `${rhombus} A square requires four right angles.`,
      check: categoryCheck,
    },
    {
      label: "Every quadrilateral belongs to the parallelogram group.",
      reason:
        "A quadrilateral can have just one pair of parallel sides. A parallelogram requires two pairs.",
      check: categoryCheck,
    },
  ];
  const falseProperty: Statement[] = [
    {
      label: "Every rectangle has 4 sides of equal length.",
      reason: `${rectangle} Only opposite sides must have equal lengths.`,
      check: propertyCheck,
    },
    {
      label: "Every rhombus has 4 right angles.",
      reason: `${rhombus} Equal sides do not require square corners.`,
      check: propertyCheck,
    },
    {
      label:
        "Any quadrilateral with 2 pairs of parallel sides must have 4 equal sides.",
      reason: `${rectangle} Its opposite sides are parallel, but its four sides are not all equal.`,
      check: conditionCheck,
    },
    {
      label: "Any quadrilateral with 4 equal sides must have 4 right angles.",
      reason: `${rhombus} Four equal sides alone do not guarantee right angles.`,
      check: conditionCheck,
    },
  ];
  const selected = [
    category,
    property,
    condition,
    falseCategory,
    falseProperty,
  ].map((bank, index) => ({
    ...bank[r(0, bank.length - 1)]!,
    correct: index < 3,
  }));
  if (r(5, 6) === 6) {
    const unusedFalse = [...falseCategory, ...falseProperty].filter(
      ({ label }) => !selected.some((statement) => statement.label === label),
    );
    selected.push({
      ...unusedFalse[r(0, unusedFalse.length - 1)]!,
      correct: false,
    });
  }
  const statements = shuffle(r, selected);
  const options = statements.map(({ label }, index) => ({
    id: `option-${"abcdef"[index]}`,
    label,
  }));
  const focusIndex = r(0, statements.length - 1);
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([meta.id, meta.version, seed]))
        .digest("hex"),
      templateId: meta.id,
      templateVersion: meta.version,
      seed,
      skillId: meta.skillId,
      prompt:
        "Choose the 3 statements that are always true about quadrilaterals. A shape may belong to more than one category.",
      response: {
        kind: "multi-select",
        label: "Choose 3 true statements",
        selectionCount: 3,
        options,
      },
    },
    answer: serializeSelection(
      options
        .filter((_, index) => statements[index]!.correct)
        .map(({ id }) => id),
    ),
    hint: `To find all 3 true statements, start with “${statements[focusIndex]!.label}” ${statements[focusIndex]!.check}`,
    explanation: statements.map(
      (statement) =>
        `“${statement.label}” ${statement.correct ? "True" : "False"}: ${statement.reason}`,
    ),
  };
}
