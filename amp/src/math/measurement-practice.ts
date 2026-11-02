import { createHash } from "node:crypto";
import { measurementDefinitions } from "../content/measurement-definitions.js";
import type {
  GeneratedProblem,
  ProblemVariant,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
import { sweepChoose, sweepVariant } from "./number-domain-axes.js";
import { axisRecord, chooseAxes, defineAxis } from "./variation/axes.js";

/** What the metric renaming items are about: lengths (legacy), capacities in
 * liters and milliliters, or masses in kilograms and grams. */
export const metricQuantityAxes = {
  quantity: defineAxis("quantity", ["length", "capacity", "mass"] as const, {
    legacy: "length",
  }),
};
import { sceneSchema } from "./scene/spec.js";

const visual = new Set([
  "shifted-ruler-length",
  "fractional-ruler-length",
  "rectangle-border-length",
  "rectangle-missing-border-side",
  "rectangle-missing-area-side",
  "same-area-border-choice",
  "same-border-area-choice",
  "mixed-unit-border",
]);
export const measurementTemplates: readonly TemplateMetadata[] =
  measurementDefinitions.map((d) => ({
    id: d.id,
    title: d.title,
    skillId: d.skillId,
    description: d.description,
    version: 1,
    gradeBand: d.gradeBand,
    ...(d.mode === "choice"
      ? { requiredResponseCapability: "single-choice-v1" as const }
      : {}),
    ...(visual.has(d.id)
      ? { requiredFigureCapability: "measurement-models-v1" as const }
      : {}),
  }));
function random(id: string, seed: string) {
  let counter = 0;
  return (lo: number, hi: number) => {
    const span = hi - lo + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do {
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    } while (value >= limit);
    return lo + (value % span);
  };
}
function rational(n: number, d = 1) {
  let a = Math.abs(n),
    b = d;
  while (b) [a, b] = [b, a % b];
  return d / a === 1 ? String(n / a) : `${n / a}/${d / a}`;
}
function factorPairs(area: number): [number, number][] {
  const pairs: [number, number][] = [];
  for (let width = 1; width * width <= area; width++)
    if (area % width === 0) pairs.push([width, area / width]);
  return pairs;
}
type Choice = { label: string; correct?: true; feedback?: string };
export function generateMeasurementProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = measurementTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown measurement template: ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  let prompt = "",
    answer = "",
    hint = "",
    label = "Value",
    explanation: string[] = [],
    figure: SemanticFigure | undefined,
    choices: Choice[] | undefined,
    variant: ProblemVariant | undefined;
  const measure = (value: number, unit: "cm" | "m" = "cm") => ({ value, unit });
  switch (templateId) {
    case "shifted-ruler-length":
    case "fractional-ruler-length": {
      const axes =
        templateId === "fractional-ruler-length"
          ? sweepChoose("fractional-ruler-length", seed)
          : undefined;
      if (axes) variant = sweepVariant(axes.ruler, axes);
      if (axes?.ruler === "inch-ruler") {
        // An object on an inch ruler: its ends sit on ticks, and its length
        // in lowest terms has the ruler's own part as denominator.
        const parts = ([2, 4, 8] as const)[r(0, 2)]!,
          length = parts === 8 ? 4 : r(4, 6),
          start = r(0, 3) === 0 ? r(1, 2) : 0,
          room = (length - start) * parts,
          spaces = 2 * r(Math.ceil(parts / 2), Math.floor((room - 1) / 2)) + 1,
          end = start * parts + spaces;
        const shape = r(0, 1) ? "pencil" : "ribbon",
          noun = shape;
        const partWord = { 2: "half", 4: "quarter", 8: "eighth" }[parts];
        figure = {
          kind: "scene",
          scene: sceneSchema.parse({
            v: 1,
            width: 360,
            elements: [
              {
                type: "ruler",
                id: "ruler",
                unit: "in",
                length,
                parts,
                object: { from: start * parts, to: end, shape },
              },
            ],
          }),
        };
        prompt =
          parts === 8
            ? `What is the length of the ${noun}, to the nearest eighth of an inch?`
            : `How long is the ${noun}, in inches?`;
        answer = rational(spaces, parts);
        label = "Length in inches";
        hint = `Each inch on this ruler is cut into ${parts} equal spaces, so each small space is $1/${parts}$ inch.${start ? ` The ${noun} starts at the ${start}-inch mark, not at 0.` : ""} Count the small spaces from one end of the ${noun} to the other, then write that count over ${parts}.`;
        explanation = [
          `Length is how far it is from one end to the other end.`,
          `Each inch is cut into ${parts} equal spaces, so each small space is $1/${parts}$ inch.`,
          start
            ? `The ${noun} starts at the ${start}-inch mark, not at 0, so count only the spaces it covers: ${spaces} spaces.`
            : `The ${noun} starts at 0. Count the small spaces to its other end: ${spaces} spaces.`,
          `${spaces} spaces of $1/${parts}$ inch make $${spaces}/${parts}$ inch${spaces === 1 ? "" : "es"}${`${spaces}/${parts}` === answer ? "" : `, which is $${answer}$`}.`,
          `The ${noun} is $${answer}$ inches long${parts === 8 ? ", to the nearest eighth of an inch" : ""}.`,
        ];
        break;
      }
      const whole = templateId === "shifted-ruler-length",
        denominator = whole ? 1 : ([2, 4] as const)[r(0, 1)]!,
        maxWhole = whole ? 12 : 3;
      const start = whole ? r(1, 6) : r(1, denominator * 2),
        end = whole ? start + r(1, 6) : r(start + 1, maxWhole * denominator);
      figure = {
        kind: "length-interval",
        denominator,
        maxWhole,
        startNumerator: start,
        endNumerator: end,
        unit: "cm",
      };
      prompt = "The strip runs from $A$ to $B$. What is its length in cm?";
      answer = rational(end - start, denominator);
      label = "Length in cm";
      hint = whole
        ? `A starts at the ${start} cm mark, not at 0. Read B's mark and subtract ${start}.`
        : `Each centimeter is cut into ${denominator} small spaces. Count the small spaces from $A$ to $B$, then write that count over ${denominator}.`;
      explanation = whole
        ? [
            `Length is how far it is from one end to the other end.`,
            `The strip does not start at 0. $A$ is at the ${start} cm mark and $B$ is at the ${end} cm mark.`,
            `The length is the distance between the marks, so subtract: ${end} − ${start} = ${answer}.`,
            `Counting the marks themselves would add 1 too many; count the spaces between them.`,
            `The strip is ${answer} cm long.`,
          ]
        : [
            `Length is how far it is from one end to the other end.`,
            `Each centimeter is cut into ${denominator} equal spaces, so each small space is 1/${denominator} cm: 1 of ${denominator} equal parts of a centimeter.`,
            `$A$ is at ${rational(start, denominator)} cm and $B$ is at ${rational(end, denominator)} cm. There ${end - start === 1 ? "is 1 small space" : `are ${end - start} small spaces`} between them.`,
            `${end - start === 1 ? "1 space" : `${end - start} spaces`} of 1/${denominator} cm ${end - start === 1 ? "is" : "make"} ${end - start}/${denominator} cm${`${end - start}/${denominator}` === answer ? "" : `, which is ${answer} cm`}.`,
            `The strip is ${answer} cm long.`,
          ];
      break;
    }
    case "rectangle-border-length":
    case "rectangle-missing-border-side":
    case "rectangle-missing-area-side": {
      const width = r(2, 12),
        height = r(2, 12),
        perimeter = 2 * (width + height),
        area = width * height;
      const known = templateId === "rectangle-border-length",
        fromArea = templateId === "rectangle-missing-area-side";
      figure = {
        kind: "measure-rectangle",
        width: measure(width),
        height: known ? measure(height) : null,
      };
      if (known) {
        prompt = "How many cm of ribbon go once around this rectangle?";
        answer = String(perimeter);
        label = "Perimeter in cm";
        hint = `Ribbon goes along all four sides: two sides of ${width} cm and two sides of ${height} cm.`;
        explanation = [
          `Ribbon that goes once around a shape measures its perimeter: the total length of all its sides.`,
          `A rectangle's opposite sides are equal, so its four sides are ${width}, ${height}, ${width} and ${height} cm.`,
          `Add all four: ${width} + ${height} + ${width} + ${height} = ${perimeter}.`,
          `A shortcut: one long side and one short side make half the trip, so 2 × (${width} + ${height}) = ${perimeter}.`,
          `${perimeter} cm of ribbon goes once around the rectangle.`,
        ];
      } else if (fromArea) {
        prompt = `This rectangle covers ${area} square cm. Find its missing side in cm.`;
        answer = String(height);
        label = "Missing side in cm";
        hint = `Area is side × side, so ${width} × □ = ${area}. Which length times ${width} covers ${area} square cm?`;
        explanation = [
          `Area is how many 1 cm squares cover the rectangle. It equals one side times the other side.`,
          `One side is ${width} cm, so ${width} × □ = ${area}.`,
          `Division undoes multiplication: ${area} ÷ ${width} = ${height}.`,
          `Check: ${width} rows of ${height} squares is ${width} × ${height} = ${area} square cm.`,
          `The missing side is ${height} cm.`,
        ];
      } else {
        prompt = `This rectangle has perimeter ${perimeter} cm. Find its missing side in cm.`;
        answer = String(height);
        label = "Missing side in cm";
        hint = `Half of the ${perimeter} cm border is one width plus one height. Take ${width} away from that half.`;
        explanation = [
          `The perimeter is the length all the way around: two equal long sides and two equal short sides.`,
          `So half the perimeter is one of each side: ${perimeter} ÷ 2 = ${width + height} cm.`,
          `One side is ${width} cm, so the other side is ${width + height} − ${width} = ${height} cm.`,
          `Check all four sides: ${width} + ${height} + ${width} + ${height} = ${perimeter} cm.`,
          `The missing side is ${height} cm.`,
        ];
      }
      break;
    }
    case "border-or-cover-unit": {
      const cover = !!r(0, 1);
      prompt = cover
        ? "Paper covers the flat face of a card. Which unit measures the area covered?"
        : "Ribbon runs once around a card. Which unit measures the length of ribbon?";
      const correct = cover ? "square cm" : "cm";
      choices = ["cm", "square cm", "cubic cm"].map((unit) => ({
        label: unit,
        ...(unit === correct
          ? { correct: true as const }
          : {
              feedback:
                unit === "cubic cm"
                  ? `A cubic centimeter is a small cube. Cubes fill space inside a box, but the ${cover ? "paper covers a flat face" : "ribbon is a line along an edge"}. Use ${cover ? "square cm" : "cm"}.`
                  : cover
                    ? "A centimeter measures length along a line. Paper covers a flat surface, so count the 1 cm squares that cover it: square cm."
                    : "A square centimeter is a small square that covers a surface. The ribbon is a line around the edge, so measure its length in cm.",
            }),
      }));
      hint = cover
        ? "Paper covers a flat surface, so count the unit squares that would cover it."
        : "Ribbon runs along a path around the edge, so measure how long that path is.";
      explanation = cover
        ? [
            "Area is how much flat surface something covers.",
            "Area is counted in unit squares. A square with 1 cm sides covers 1 square cm.",
            "The paper covers the flat face, so it measures area. The unit is square cm.",
          ]
        : [
            "A centimeter is a unit of length: it measures how long a line or path is.",
            "The ribbon runs along the outside edge, so its length is the perimeter, the distance around.",
            "Distance around is a length, so the unit is cm.",
          ];
      break;
    }
    case "same-area-border-choice":
    case "same-border-area-choice": {
      const sameArea = templateId === "same-area-border-choice";
      const pool = sameArea
        ? factorPairs([12, 18, 24][r(0, 2)]!).filter((p) => p[1] <= 12)
        : factorPairs(1);
      if (!sameArea) {
        const sum = r(5, 13);
        pool.splice(
          0,
          pool.length,
          ...Array.from(
            { length: Math.floor(sum / 2) },
            (_, i) => [i + 1, sum - i - 1] as [number, number],
          ),
        );
      }
      const first = r(0, pool.length - 1);
      let second = r(0, pool.length - 2);
      if (second >= first) second++;
      const a = pool[first]!,
        b = pool[second]!;
      figure = {
        kind: "rectangle-comparison",
        rectangles: [
          { width: a[0], height: a[1] },
          { width: b[0], height: b[1] },
        ],
        unit: "cm",
      };
      const valueA = sameArea ? 2 * (a[0] + a[1]) : a[0] * a[1],
        valueB = sameArea ? 2 * (b[0] + b[1]) : b[0] * b[1];
      const winner = (sameArea ? valueA < valueB : valueA > valueB) ? "A" : "B";
      prompt = sameArea
        ? "These rectangles have equal areas. Which needs less ribbon around its border?"
        : "These rectangles have equal perimeters. Which covers more area?";
      choices = ["A", "B", "They are equal"].map((name) => ({
        label: name,
        ...(name === winner
          ? { correct: true as const }
          : {
              feedback:
                name === "They are equal"
                  ? sameArea
                    ? `Equal areas do not mean equal borders. The border of $A$ is ${valueA} cm and the border of $B$ is ${valueB} cm.`
                    : `Equal borders do not mean equal areas. $A$ covers ${valueA} square cm and $B$ covers ${valueB} square cm.`
                  : sameArea
                    ? `Rectangle ${name}'s border is ${name === "A" ? valueA : valueB} cm, longer than ${name === "A" ? valueB : valueA} cm. Add all four sides of each rectangle and pick the smaller total.`
                    : `Rectangle ${name} covers ${name === "A" ? valueA : valueB} square cm, less than ${name === "A" ? valueB : valueA} square cm. Multiply the two sides of each rectangle and pick the larger area.`,
            }),
      }));
      hint = sameArea
        ? `Equal area does not mean equal border. Add all four sides of $A$ (${a[0]} by ${a[1]}) and of $B$ (${b[0]} by ${b[1]}).`
        : `An equal border does not mean equal area. Multiply the sides of $A$ (${a[0]} by ${a[1]}) and of $B$ (${b[0]} by ${b[1]}).`;
      explanation = sameArea
        ? [
            `Ribbon around the border measures the perimeter: the total of all four sides.`,
            `$A$ is ${a[0]} by ${a[1]}: its perimeter is 2 × (${a[0]} + ${a[1]}) = ${valueA} cm.`,
            `$B$ is ${b[0]} by ${b[1]}: its perimeter is 2 × (${b[0]} + ${b[1]}) = ${valueB} cm.`,
            `The areas match, but the borders do not. A long, thin rectangle has a longer border.`,
            `Rectangle ${winner} needs less ribbon.`,
          ]
        : [
            `Area is how many unit squares cover a rectangle: one side times the other.`,
            `$A$ is ${a[0]} by ${a[1]}: its area is ${a[0]} × ${a[1]} = ${valueA} square cm.`,
            `$B$ is ${b[0]} by ${b[1]}: its area is ${b[0]} × ${b[1]} = ${valueB} square cm.`,
            `The borders match, but the areas do not. A rectangle closer to a square covers more.`,
            `Rectangle ${winner} covers more area.`,
          ];
      break;
    }
    case "metric-length-rename":
    case "metric-length-reverse": {
      const axes = chooseAxes(templateId, seed, metricQuantityAxes);
      variant = {
        id: axes.quantity === "length" ? "legacy" : axes.quantity,
        axes: axisRecord(axes),
      };
      const reverse = templateId === "metric-length-reverse",
        km = !!r(0, 1),
        length = axes.quantity === "length",
        factor = length && !km ? 100 : 1000;
      const [large, small] =
        axes.quantity === "capacity"
          ? ["L", "mL"]
          : axes.quantity === "mass"
            ? ["kg", "g"]
            : km
              ? ["km", "m"]
              : ["m", "cm"];
      const n = reverse
          ? factor === 1000
            ? r(25, 3000)
            : r(1, 900)
          : r(1, 12),
        from = reverse ? small : large,
        to = reverse ? large : small;
      const word: Record<string, string> = {
        km: "kilometer",
        m: "meter",
        cm: "centimeter",
        L: "liter",
        mL: "milliliter",
        kg: "kilogram",
        g: "gram",
      };
      const quantity = { length: "Length", capacity: "Capacity", mass: "Mass" }[
        axes.quantity
      ];
      prompt = `Write ${n} ${from} in ${to}.`;
      answer = reverse ? rational(n, factor) : String(n * factor);
      label = `${quantity} in ${to}`;
      hint = reverse
        ? `Every ${factor} ${small} make 1 ${large}. How many groups of ${factor} are in ${n}?`
        : n === 1
          ? `How many ${word[small]}s make 1 ${word[large]}? ${length ? `A ${word[small]} is much shorter, so the count is large.` : `A ${word[small]} is much smaller than a ${word[large]}, so the count is large.`}`
          : `Each ${large} is ${factor} ${small}, and you have ${n} of them: ${n} groups of ${factor}.`;
      explanation = reverse
        ? [
            `1 ${large} means one ${word[large]}, and it is the same amount as ${factor} ${small}, or ${factor} ${word[small]}s.`,
            `A ${word[large]} is the bigger unit, so the amount takes fewer of them. Divide by ${factor}.`,
            `${n} ÷ ${factor} = ${answer}, which is ${n / factor} as a decimal.`,
            `The amount does not change; only the unit does. ${n} ${from} = ${answer} ${to}.`,
          ]
        : [
            `1 ${large} means one ${word[large]}, and it is the same amount as ${factor} ${small}, or ${factor} ${word[small]}s.`,
            `A ${word[small]} is the smaller unit, so it takes more of them. Each ${large} becomes ${factor} ${small}, so multiply by ${factor}.`,
            `${n} × ${factor} = ${answer}.`,
            `The amount does not change; only the unit does. ${n} ${from} = ${answer} ${to}.`,
          ];
      break;
    }
    case "mixed-length-total": {
      const meters = r(1, 8),
        cm = r(1, 99);
      prompt = `A strip is ${meters} m long, and another is ${cm} cm long. What is their total length in cm?`;
      answer = String(meters * 100 + cm);
      label = "Total length in cm";
      hint = `Rename ${meters} m in centimeters first (1 m = 100 cm). Then add the ${cm} cm.`;
      explanation = [
        `You can only add lengths in the same unit, so first write both in centimeters.`,
        `1 m is 100 cm, so ${meters} m is ${meters} × 100 = ${meters * 100} cm.`,
        `Now add: ${meters * 100} + ${cm} = ${answer}.`,
        `Adding ${meters} + ${cm} would mix meters and centimeters, which are different sizes.`,
        `The total length is ${answer} cm.`,
      ];
      break;
    }
    case "mixed-unit-border": {
      const meters = r(1, 4),
        cm = r(20, 300);
      figure = {
        kind: "measure-rectangle",
        width: measure(meters, "m"),
        height: measure(cm),
      };
      prompt =
        "Ribbon goes once around this rectangle. What is its full perimeter in cm?";
      answer = String(2 * (meters * 100 + cm));
      label = "Perimeter in cm";
      hint = `Write ${meters} m in cm first, so both sides use one unit. Then add all four sides.`;
      explanation = [
        `The perimeter is the total length of all four sides. All sides must use the same unit before you add.`,
        `1 m is 100 cm, so the ${meters} m side is ${meters} × 100 = ${meters * 100} cm.`,
        `A rectangle has two sides of each length: ${meters * 100} + ${cm} + ${meters * 100} + ${cm}.`,
        `That is 2 × (${meters * 100} + ${cm}) = ${answer}. Adding only two sides would give half the trip.`,
        `The perimeter is ${answer} cm.`,
      ];
      break;
    }
    case "rectangle-two-constraints-choice":
    case "rectangle-existence-choice": {
      const area = [12, 16, 18, 20, 24, 30, 36][r(0, 6)]!,
        pairs = factorPairs(area),
        compact = pairs[pairs.length - 1]!,
        minimum = 2 * (compact[0] + compact[1]);
      const existence = templateId === "rectangle-existence-choice";
      let selected: [number, number][];
      let target: number;
      if (existence) {
        const first = r(0, pairs.length - 1);
        let second = r(0, pairs.length - 2);
        if (second >= first) second++;
        selected = [pairs[first]!, pairs[second]!];
        const mode = r(0, 2);
        target =
          mode === 2
            ? minimum - 2
            : 2 * (selected[mode]![0] + selected[mode]![1]);
        prompt = `Use positive whole-number sides. Area: ${area} square cm. Perimeter: ${target} cm. Which statement is true?`;
      } else {
        selected = [compact, pairs[0]!, pairs[1]!];
        target = minimum;
        prompt = `Use positive whole-number sides. Area must be ${area} square cm; perimeter at most ${target} cm. Which rectangle works?`;
      }
      const possible = pairs.filter(([w, h]) =>
        existence ? 2 * (w + h) === target : 2 * (w + h) <= target,
      );
      choices = selected.map(([w, h]) => ({
        label: `${w} cm by ${h} cm`,
        ...(possible.some((p) => p[0] === w && p[1] === h)
          ? { correct: true as const }
          : {
              feedback: `${w} cm by ${h} cm has the right area, ${w} × ${h} = ${w * h} square cm. But its perimeter is 2 × (${w} + ${h}) = ${2 * (w + h)} cm, ${existence ? "not" : "more than"} ${target} cm. Check the perimeter too.`,
            }),
      }));
      if (existence)
        choices.push({
          label: "No such rectangle",
          ...(!possible.length
            ? { correct: true as const }
            : {
                feedback: `One of the listed rectangles works. Find each one's perimeter, 2 × (side + side), and look for ${target} cm.`,
              }),
        });
      hint = existence
        ? `List the whole-number side pairs with area ${area}: 1 by ${area}, 2 by ${area / 2}, and so on. Does any pair have a perimeter of exactly ${target} cm?`
        : `List the whole-number side pairs with area ${area}: 1 by ${area}, 2 by ${area / 2}, and so on. Find each perimeter and keep those at most ${target} cm.`;
      explanation = [
        `Area is one side times the other, and the perimeter is the total of all four sides.`,
        `Whole-number sides with area ${area} are pairs that multiply to ${area}: ${pairs.map(([w, h]) => `${w} by ${h}`).join(", ")}.`,
        `Their perimeters, 2 × (side + side), are ${pairs.map(([w, h]) => `${2 * (w + h)}`).join(", ")} cm, in the same order.`,
        possible.length
          ? existence
            ? `${possible[0]![0]} cm by ${possible[0]![1]} cm has perimeter ${target} cm, so it meets both conditions.`
            : `Only ${possible[0]![0]} cm by ${possible[0]![1]} cm has a perimeter of ${target} cm or less, so it works.`
          : `No pair has a perimeter of exactly ${target} cm, so no rectangle with whole-number sides fits.`,
      ];
      break;
    }
    case "whole-pack-ribbon-choice": {
      const need = r(3, 25),
        size = r(2, 6),
        price = r(2, 9),
        rate = r(1, 4),
        packs = Math.ceil(need / size),
        a = packs * price,
        b = need * rate;
      prompt = `Need ${need} m of ribbon; pieces join without loss. Offer A: whole ${size} m packs at ${price} ${price === 1 ? "dollar" : "dollars"} each. Offer B: any length at ${rate} ${rate === 1 ? "dollar" : "dollars"} per meter. No other charges. Which costs less?`;
      const winner = a === b ? "Same cost" : a < b ? "A" : "B";
      choices = ["A", "B", "Same cost"].map((name) => ({
        label: name,
        ...(name === winner
          ? { correct: true as const }
          : {
              feedback:
                winner === "Same cost"
                  ? `Both bills are ${a} dollars: A's ${packs} whole ${packs === 1 ? "pack costs" : "packs cost"} ${a} dollars, and B's ${need} m cost ${b} dollars. Neither costs less.`
                  : name === "Same cost"
                    ? `The bills differ: A costs ${a} dollars and B costs ${b} dollars. Offer A must buy whole packs, ${packs} of them.`
                    : `Offer ${name} costs more: ${name === "A" ? a : b} dollars against ${name === "A" ? b : a} dollars. For A, buy enough whole packs to cover ${need} m: ${packs} packs, even if some ribbon is left over.`,
            }),
      }));
      hint = `A sells only whole ${size} m packs: how many packs cover ${need} m? Compare that bill with B's ${need} × ${rate} dollars.`;
      explanation = [
        `Offer A sells only whole packs, so you must buy enough packs to reach at least ${need} m.`,
        `${packs} ${packs === 1 ? "pack gives" : "packs give"} ${packs} × ${size} = ${packs * size} m, enough for ${need} m. ${packs === 1 ? "It costs" : "They cost"} ${packs} × ${price} = ${a} dollars.`,
        `Offer B sells exactly ${need} m at ${rate} ${rate === 1 ? "dollar" : "dollars"} per meter: ${need} × ${rate} = ${b} dollars.`,
        packs * size > need
          ? `With A you still pay for the ${packs * size - need} m left over.`
          : `With A nothing is left over.`,
        a === b
          ? `Both offers cost ${a} dollars, so they cost the same.`
          : `Offer ${winner} costs less: ${Math.min(a, b)} dollars instead of ${Math.max(a, b)} dollars.`,
      ];
      break;
    }
    default:
      throw new Error(`Missing measurement generator: ${templateId}`);
  }
  let response: GeneratedProblem["public"]["response"] = {
    kind: "fraction",
    label,
  };
  let choiceFeedback: Record<string, string> | undefined;
  if (choices) {
    if (
      choices.filter((c) => c.correct).length !== 1 ||
      new Set(choices.map((c) => c.label)).size !== choices.length
    )
      throw new Error("Ambiguous measurement choices");
    for (let i = choices.length - 1; i > 0; i--) {
      const j = r(0, i);
      [choices[i], choices[j]] = [choices[j]!, choices[i]!];
    }
    choiceFeedback = {};
    response = {
      kind: "choice",
      label: "Choose one answer",
      options: choices.map((c, i) => {
        const id = `option-${"abcd"[i]}`;
        if (c.correct) answer = id;
        else choiceFeedback![id] = c.feedback!;
        return { id, label: c.label };
      }),
    };
  }
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([templateId, 1, seed]))
        .digest("hex"),
      templateId,
      templateVersion: 1,
      seed,
      prompt,
      skillId: meta.skillId,
      response,
      ...(figure ? { figure } : {}),
    },
    answer,
    hint,
    explanation,
    ...(choiceFeedback ? { choiceFeedback } : {}),
    ...(variant ? { variant } : {}),
  };
}
