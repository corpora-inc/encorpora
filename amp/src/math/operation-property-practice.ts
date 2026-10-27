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
  "identity-mult": "a number times 1 is the same number",
  "commutative-add": "swapping the order of two addends keeps the sum",
  "commutative-mult": "swapping the order of two factors keeps the product",
  "associative-add": "regrouping three addends keeps the sum",
  "associative-mult": "regrouping three factors keeps the product",
  distributive:
    "a factor multiplies each addend of a sum and the products are added",
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
          feedback: `This equation shows the ${names[p]}: ${meaning[p]}. The question names the ${names[m.property]}, where ${meaning[m.property]}.`,
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
        hint: `Each left side begins with $${a}$. Compare it with the right side of each equation. The ${names[m.property]} says that ${meaning[m.property]}, so look for the equation where only that change happens.`,
        explanation: [
          `The ${names[m.property]}: ${meaning[m.property]}.`,
          `${equationOf(m.property, a, b, c)} changes exactly that between its two sides, and both sides are equal.`,
          "The other equations are also true, but each one shows a different property.",
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
          feedback: `The ${names[p]} says that ${meaning[p]}. Compare how $${a}$, $${b}$ and $${c}$ sit on the left and right of the equation: that is not the change here.`,
        })),
      ],
      hint: `Compare the left side and the right side of ${shown}. Ask what changed between them: the order of the numbers, how they are grouped, or nothing but a 0 or a 1 being combined.`,
      explanation: [
        `Compare the two sides of ${shown}: ${m.property.startsWith("identity") ? "one number is combined with 0 or 1 and stays the same" : m.property.startsWith("commutative") ? "the same two numbers are in the opposite order" : m.property.startsWith("associative") ? "the same three numbers are in the same order with the parentheses moved" : "one factor multiplies a sum on the left and each addend on the right"}.`,
        `That is the ${names[m.property]}: ${meaning[m.property]}.`,
      ],
    });
  },
});

export const operationPropertyTemplates = [operationPropertyTemplate] as const;
export const operationPropertyGenerate = dispatch(operationPropertyTemplates, {
  "operation-property-identify": (seed) =>
    operationPropertyFamily.generate(seed).problem,
});
