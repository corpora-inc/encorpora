import { createHash } from "node:crypto";
import { measurementDefinitions } from "../content/measurement-definitions.js";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";

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
    choices: Choice[] | undefined;
  const measure = (value: number, unit: "cm" | "m" = "cm") => ({ value, unit });
  switch (templateId) {
    case "shifted-ruler-length":
    case "fractional-ruler-length": {
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
      prompt = "The strip runs from A to B. What is its length in cm?";
      answer = rational(end - start, denominator);
      label = "Length in cm";
      hint =
        "Length counts the spaces between the two ends. Subtract the starting position from the ending position.";
      explanation = [
        `A is at ${rational(start, denominator)} cm; B is at ${rational(end, denominator)} cm.`,
        `${rational(end, denominator)} − ${rational(start, denominator)} = ${answer} cm.`,
        whole
          ? "The starting mark is a position, not an extra unit of length."
          : `Each small space is 1/${denominator} cm. There are ${end - start} of those spaces between the ends.`,
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
        hint =
          "Walk every outside edge. A rectangle has two sides of each displayed length.";
        explanation = [
          `The four sides are ${width}, ${height}, ${width}, and ${height} cm.`,
          `${width} + ${height} + ${width} + ${height} = ${perimeter} cm.`,
          `Equivalently, double the adjacent-side sum: 2 × (${width} + ${height}) = ${perimeter}.`,
        ];
      } else if (fromArea) {
        prompt = `This rectangle covers ${area} square cm. Find its missing side in cm.`;
        answer = String(height);
        label = "Missing side in cm";
        hint =
          "Area equals one side multiplied by the perpendicular side. Find the missing factor.";
        explanation = [
          `${width} × ? = ${area}.`,
          `${area} ÷ ${width} = ${height}, so the missing side is ${height} cm.`,
          `Check: ${width} cm × ${height} cm covers ${area} square cm.`,
        ];
      } else {
        prompt = `This rectangle has perimeter ${perimeter} cm. Find its missing side in cm.`;
        answer = String(height);
        label = "Missing side in cm";
        hint =
          "Half the perimeter is the sum of two adjacent sides. Remove the known side from that sum.";
        explanation = [
          `Half the border is ${perimeter} ÷ 2 = ${width + height} cm.`,
          `The missing side is ${width + height} − ${width} = ${height} cm.`,
          `Check all four sides: ${width} + ${height} + ${width} + ${height} = ${perimeter} cm.`,
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
                  ? "Cubic units measure three-dimensional volume."
                  : cover
                    ? "Centimeters measure length; covering a surface needs square units."
                    : "Square centimeters measure area, not the length around an edge.",
            }),
      }));
      hint =
        "Decide whether you are measuring along a path or covering a surface. The shape of the unit matters.";
      explanation = cover
        ? [
            "A unit square has a side of 1 cm and covers 1 square cm.",
            "Counting the square units needed to cover the card measures its area.",
          ]
        : [
            "A centimeter is a unit of length.",
            "The ribbon follows the outside edge. Its length is a perimeter, so centimeters are appropriate.",
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
              feedback: `Compare ${sameArea ? "all four side lengths" : "the two side-length products"}. Equal ${sameArea ? "area" : "perimeter"} does not force equal ${sameArea ? "perimeter" : "area"}.`,
            }),
      }));
      hint = sameArea
        ? "Equal covering does not guarantee equal borders. Add all four sides for each rectangle."
        : "The same ribbon length can surround different areas. Multiply each pair of perpendicular sides.";
      explanation = [
        sameArea
          ? `A: 2 × (${a[0]} + ${a[1]}) = ${valueA} cm. B: 2 × (${b[0]} + ${b[1]}) = ${valueB} cm.`
          : `A: ${a[0]} × ${a[1]} = ${valueA} square cm. B: ${b[0]} × ${b[1]} = ${valueB} square cm.`,
        `Rectangle ${winner} has the ${sameArea ? "shorter border" : "greater area"}. Equal ${sameArea ? "areas" : "perimeters"} alone do not determine that comparison.`,
      ];
      break;
    }
    case "metric-length-rename":
    case "metric-length-reverse": {
      const reverse = templateId === "metric-length-reverse",
        km = !!r(0, 1),
        factor = km ? 1000 : 100;
      const large = km ? "km" : "m",
        small = km ? "m" : "cm",
        n = reverse ? (km ? r(25, 3000) : r(1, 900)) : r(1, 12),
        from = reverse ? small : large,
        to = reverse ? large : small;
      prompt = `Write ${n} ${from} in ${to}.`;
      answer = reverse ? rational(n, factor) : String(n * factor);
      label = `Length in ${to}`;
      hint = reverse
        ? "A larger unit holds many smaller units. Divide the smaller-unit count by the number in one larger unit."
        : "Changing to a smaller unit increases the count. Use the number of smaller units in one larger unit.";
      explanation = [
        `1 ${large} = ${factor} ${small}.`,
        `${n} ${reverse ? "÷" : "×"} ${factor} = ${answer}, so ${n} ${from} = ${answer} ${to}.`,
        "The physical length stays the same; only its unit and numerical name change.",
      ];
      break;
    }
    case "mixed-length-total": {
      const meters = r(1, 8),
        cm = r(1, 99);
      prompt = `A strip is ${meters} m long, and another is ${cm} cm long. What is their total length in cm?`;
      answer = String(meters * 100 + cm);
      label = "Total length in cm";
      hint =
        "Rename the meters in centimeters before adding. Add quantities measured in the same unit.";
      explanation = [
        `${meters} m = ${meters} × 100 cm = ${meters * 100} cm.`,
        `${meters * 100} + ${cm} = ${answer} cm.`,
        `Adding ${meters} + ${cm} directly would mix two different unit sizes.`,
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
      hint =
        "Use one unit for both dimensions, then count two sides of each length.";
      explanation = [
        `${meters} m = ${meters * 100} cm.`,
        `2 × (${meters * 100} + ${cm}) = ${answer} cm.`,
        "Converting the unit does not change the rectangle. Counting only two adjacent sides would give half its perimeter.",
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
              feedback: `This pair has area ${w * h} square cm and perimeter ${2 * (w + h)} cm. Check both conditions.`,
            }),
      }));
      if (existence)
        choices.push({
          label: "No such rectangle",
          ...(!possible.length
            ? { correct: true as const }
            : {
                feedback:
                  "At least one positive whole-number factor pair meets both conditions.",
              }),
        });
      hint =
        "List every positive whole-number factor pair of the area. Check the full perimeter of each; turning a rectangle does not create a new pair.";
      explanation = [
        `All possible side pairs are ${pairs.map(([w, h]) => `${w} cm by ${h} cm`).join(", ")}.`,
        `Their perimeters are ${pairs.map(([w, h]) => 2 * (w + h)).join(", ")} cm, respectively.`,
        possible.length
          ? `${possible[0]![0]} cm by ${possible[0]![1]} cm meets both conditions.`
          : `None has perimeter ${target} cm. The impossibility concerns positive whole-number sides; it is not a claim about every real-valued rectangle.`,
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
      prompt = `Need ${need} m of ribbon; pieces join without loss. A: whole ${size} m packs at $${price} each. B: any length at $${rate}/m. No other charges. Which costs less?`;
      const winner = a === b ? "Same cost" : a < b ? "A" : "B";
      choices = ["A", "B", "Same cost"].map((name) => ({
        label: name,
        ...(name === winner
          ? { correct: true as const }
          : {
              feedback:
                "Use enough complete packs for A. B can supply exactly the needed length; compare total bills.",
            }),
      }));
      hint =
        "A cannot sell part of a pack. Round the number of packs up to cover the required length before comparing costs.";
      explanation = [
        `A needs ${packs} complete ${packs === 1 ? "pack" : "packs"}: ${packs} × ${size} = ${packs * size} m, costing $${a}.`,
        `B supplies exactly ${need} m for ${need} × $${rate} = $${b}.`,
        a === b
          ? `The bills tie. A leaves ${packs * size - need} m unused; that does not change the stated cost.`
          : `${winner} costs less. A's ${packs * size - need} m of unused ribbon does not reduce its bill.`,
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
  };
}
