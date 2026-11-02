import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  pick,
  type ChoiceOption,
} from "./chain-kit";

export const operationPropertyTemplate: TemplateMetadata = {
  id: "operation-property-identify",
  version: 1,
  requiredResponseCapability: "single-choice-v1",
  title: "Which property is it?",
  skillId: "operation-properties",
  gradeBand: "3–5",
  difficultyOffset: 0.2,
  description:
    "Pick the equation that shows a named property of addition or multiplication (identity, commutative, associative, distributive), or name the property a given equation shows.",
};

export const propertyIds = [
  "identity-add",
  "identity-mult",
  "commutative-add",
  "commutative-mult",
  "associative-add",
  "associative-mult",
  "distributive",
] as const;
export type PropertyId = (typeof propertyIds)[number];

const names: Record<PropertyId, string> = {
  "identity-add": "identity property of addition",
  "identity-mult": "identity property of multiplication",
  "commutative-add": "commutative property of addition",
  "commutative-mult": "commutative property of multiplication",
  "associative-add": "associative property of addition",
  "associative-mult": "associative property of multiplication",
  distributive: "distributive property of multiplication over addition",
};
/** What the property says, in one clause, for feedback. */
const meaning: Record<PropertyId, string> = {
  "identity-add": "adding 0 leaves a number unchanged",
  "identity-mult": "a number times 1 is still the same number",
  "commutative-add":
    "swapping the order of two numbers being added keeps the same total",
  "commutative-mult":
    "swapping the order of two numbers being multiplied keeps the same answer",
  "associative-add":
    "moving the parentheses to group three added numbers differently keeps the same total",
  "associative-mult":
    "moving the parentheses to group three multiplied numbers differently keeps the same answer",
  distributive:
    "multiplying a sum by a number equals multiplying each part by it, then adding",
};
/** What changes between the two sides of each property's equation. */
const change: Record<PropertyId, string> = {
  "identity-add": "a number is added to 0 and stays the same",
  "identity-mult": "a number is multiplied by 1 and stays the same",
  "commutative-add": "the same two numbers are added in the opposite order",
  "commutative-mult":
    "the same two numbers are multiplied in the opposite order",
  "associative-add":
    "the same three numbers are added in the same order, with the parentheses moved",
  "associative-mult":
    "the same three numbers are multiplied in the same order, with the parentheses moved",
  distributive:
    "one number multiplies a sum on the left, and each part of the sum on the right",
};

/** The equation that shows a property, written with the instance's numbers. */
export function equationOf(p: PropertyId, a: number, b: number, c: number) {
  switch (p) {
    case "identity-add":
      return `$${a}+0=${a}$`;
    case "identity-mult":
      return `$${a}\\times1=${a}$`;
    case "commutative-add":
      return `$${a}+${b}=${b}+${a}$`;
    case "commutative-mult":
      return `$${a}\\times${b}=${b}\\times${a}$`;
    case "associative-add":
      return `$(${a}+${b})+${c}=${a}+(${b}+${c})$`;
    case "associative-mult":
      return `$(${a}\\times${b})\\times${c}=${a}\\times(${b}\\times${c})$`;
    case "distributive":
      return `$${a}\\times(${b}+${c})=${a}\\times${b}+${a}\\times${c}$`;
  }
}
/** Value of both sides, used by the independent test. */
export function sides(p: PropertyId, a: number, b: number, c: number) {
  switch (p) {
    case "identity-add":
      return [a + 0, a];
    case "identity-mult":
      return [a * 1, a];
    case "commutative-add":
      return [a + b, b + a];
    case "commutative-mult":
      return [a * b, b * a];
    case "associative-add":
      return [a + b + c, a + b + c];
    case "associative-mult":
      return [a * b * c, a * b * c];
    case "distributive":
      return [a * (b + c), a * b + a * c];
  }
}

const axes = {
  ask: defineAxis("ask", ["pick-equation", "name-property"] as const),
};
interface Model {
  ask: "pick-equation" | "name-property";
  property: PropertyId;
  a: number;
  b: number;
  c: number;
}
const model = (
  r: (lo: number, hi: number) => number,
  a: { ask: Model["ask"] },
): Model => {
  const [x, y, z] = [r(2, 9), r(2, 9), r(2, 9)];
  if (new Set([x, y, z]).size < 3) throw new Error("Need three retries");
  return { ask: a.ask, property: pick(r, propertyIds), a: x, b: y, c: z };
};

export const operationPropertyFamily = chainFamily({
  template: operationPropertyTemplate,
  axes,
  model,
  variant: (m) => m.property,
  render: (m, _axes, r) => {
    const { a, b, c } = m;
    const others = propertyIds.filter((p) => p !== m.property);
    if (m.ask === "pick-equation") {
      const options: ChoiceOption[] = [
        { label: equationOf(m.property, a, b, c), correct: true },
        ...others.map((p) => ({
          label: equationOf(p, a, b, c),
          feedback: `This equation shows the ${names[p]}: ${meaning[p]}. The question asks for the ${names[m.property]}.`,
        })),
      ];
      // Keep the near-miss of the other operation, then fill from the rest.
      const twin = (
        {
          "identity-add": "identity-mult",
          "identity-mult": "identity-add",
          "commutative-add": "commutative-mult",
          "commutative-mult": "commutative-add",
          "associative-add": "associative-mult",
          "associative-mult": "associative-add",
          distributive: "associative-mult",
        } as Record<PropertyId, PropertyId>
      )[m.property];
      const rest = options.slice(1);
      const first = rest.find((o) => o.label === equationOf(twin, a, b, c))!;
      const pool = rest.filter((o) => o !== first);
      const picks = [first];
      while (picks.length < 3) {
        const next = pool.splice(r(0, pool.length - 1), 1)[0]!;
        picks.push(next);
      }
      return choiceSurface(r, {
        prompt: `Which equation shows the ${names[m.property]}?`,
        options: [options[0]!, ...picks],
        hint: `Each left side begins with $${a}$. Compare it with the right side of each equation. The ${names[m.property]} says that ${meaning[m.property]}. Look for the equation where only that change happens.`,
        explanation: [
          `A property is a rule that is true for every number. The ${names[m.property]} says that ${meaning[m.property]}.`,
          `In ${equationOf(m.property, a, b, c)}, ${change[m.property]}.`,
          `Both sides equal ${sides(m.property, a, b, c)[0]}, so the equation is true, and that change is the only one.`,
          "The other equations are true too, but each makes a different change, so each shows a different property.",
          `So ${equationOf(m.property, a, b, c)} shows the ${names[m.property]}.`,
        ],
      });
    }
    const shown = equationOf(m.property, a, b, c);
    const twinNames = others
      .filter((p) => p.split("-")[0] === m.property.split("-")[0])
      .concat(
        others.filter((p) => p.split("-")[0] !== m.property.split("-")[0]),
      );
    const wrongNames = twinNames.slice(0, 5);
    const picks = [] as PropertyId[];
    const pool = [...wrongNames];
    picks.push(pool.shift()!);
    while (picks.length < 3)
      picks.push(pool.splice(r(0, pool.length - 1), 1)[0]!);
    return choiceSurface(r, {
      prompt: `Which property does the equation ${shown} show?`,
      options: [
        { label: names[m.property], correct: true },
        ...picks.map((p) => ({
          label: names[p],
          feedback: `The ${names[p]} says that ${meaning[p]}. In ${shown}, ${change[m.property]}, so it shows a different property.`,
        })),
      ],
      hint: `Compare the left side and the right side of ${shown}. Ask what changed between them: the order of the numbers, how they are grouped, or nothing but a 0 or a 1 being combined.`,
      explanation: [
        `A property is a rule that is true for every number. Each property names one kind of change between two equal sides.`,
        `Compare the two sides of ${shown}: ${change[m.property]}.`,
        `Both sides equal ${sides(m.property, a, b, c)[0]}, so the change keeps the value.`,
        `The ${names[m.property]} says that ${meaning[m.property]}.`,
        `So the equation shows the ${names[m.property]}.`,
      ],
    });
  },
});

export const operationPropertyTemplates = [operationPropertyTemplate] as const;
export const operationPropertyGenerate = dispatch(operationPropertyTemplates, {
  "operation-property-identify": (seed) =>
    operationPropertyFamily.generate(seed).problem,
});
