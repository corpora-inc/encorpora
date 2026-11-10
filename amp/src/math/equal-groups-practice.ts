import { createHash } from "node:crypto";
import { count, isAre, plural } from "./agreement.js";
import { grouped } from "./multi-part-support.js";
import { partialProducts, partialProductsHint } from "./scene/explanations.js";
import type { Step } from "./scene/timeline.js";
import { equalGroupsDefinitions } from "../content/equal-groups-definitions.js";
import type {
  GeneratedProblem,
  ProblemVariant,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
import {
  chooseAxes,
  defineAxis,
  surfaceStream,
  versionGatedAxes,
} from "./variation/axes.js";

/** Count the objects by twos, or name odd and even from the leftover.
 * Legacy still asks how many counters are left over. The answer stays a number. */
export const pairingAxes = {
  family: defineAxis(
    "family",
    ["legacy", "count-by-twos-total", "name-odd-or-even"] as const,
    {
      legacy: "legacy",
      weights: [4, 3, 3],
      silentLegacy: true,
      since: 2,
    },
  ),
} as const;
import {
  isSweepId,
  recordedSweepVariant,
  sweepChoose,
} from "./number-domain-axes.js";
import {
  comparisonAsk,
  comparisonCast,
  comparisonSmallAsk,
  groupQuestion,
  realisticGroup,
} from "./story-kit/operations.js";
const reprintsFromV1 = new Set([
  "comparison-amount",
  "full-kits",
  "kit-leftovers",
  "pairing-leftover",
  "seats-needed",
]);
export const equalGroupsTemplates: readonly TemplateMetadata[] =
  equalGroupsDefinitions.map(({ id, title, skillId, grade, description }) => ({
    id,
    title,
    skillId,
    description,
    version: reprintsFromV1.has(id) ? 2 : 1,
    ...(reprintsFromV1.has(id) ? { reprintsFrom: 1 } : {}),
    gradeBand: grade === "2" ? "K–2" : "3–5",
    ...(id === "tens-contribution"
      ? { requiredFigureCapability: "scenes-v1" as const }
      : {}),
  }));
function random(id: string, seed: string) {
  let counter = 0;
  return (low: number, high: number) => {
    const span = high - low + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do {
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    } while (value >= limit);
    return low + (value % span);
  };
}

export function generateEqualGroupsProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const template = equalGroupsTemplates.find((t) => t.id === templateId);
  if (!template)
    throw new Error(`Unknown equal-groups template: ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  const axes = isSweepId(templateId)
    ? (sweepChoose(templateId, seed) as Readonly<Record<string, string>>)
    : undefined;
  let prompt = "",
    answer = 0,
    label = "Number",
    hint = "",
    explanation: string[] = [],
    figure: SemanticFigure | undefined,
    hintCue: Step[] | undefined,
    pairingVariant: ProblemVariant | undefined;
  const counters = (
    total: number,
    groupSize: number,
    unit: string,
  ): SemanticFigure => ({ kind: "grouped-counters", total, groupSize, unit });
  const shown = (n: number) => grouped(n);
  const counted = (n: number, noun: string) =>
    `${shown(n)} ${n === 1 ? noun : plural(noun)}`;
  const article = (phrase: string) =>
    /^[aeiou]/i.test(phrase) ? `an ${phrase}` : `a ${phrase}`;
  switch (templateId) {
    case "full-kits":
    case "seats-needed":
    case "kit-leftovers": {
      const large = axes?.["number-domain"] === "up-to-9999";
      const size = large ? r(2, 9) : r(2, 8);
      const left = large ? r(0, size - 1) : 0;
      const complete = large
        ? r(100, Math.floor((9999 - left) / size))
        : r(1, 6);
      const remainder = large ? left : r(0, size - 1);
      const total = size * complete + remainder;
      const tellingKey =
        templateId === "full-kits"
          ? "story27"
          : templateId === "seats-needed"
            ? "telling25"
            : "scene25";
      const telling = axes?.[tellingKey] ?? "classic";
      const scene =
        large || telling !== "classic"
          ? realisticGroup(size, telling, large)
          : undefined;
      if (templateId === "seats-needed") {
        answer = complete + (remainder > 0 ? 1 : 0);
        if (!scene) {
          prompt = `${shown(total)} visitors need rides. Each van seats ${shown(size)} visitors. What is the fewest vans needed?`;
          label = "Vans needed";
          figure = large ? undefined : counters(total, size, "visitors");
          hint = `How many groups of ${shown(size)} fit in ${shown(total)}? If anyone is left over, they still need a van.`;
          explanation = [
            `Each van is one group of ${shown(size)} seats. Find how many groups of ${shown(size)} fit in ${shown(total)}.`,
            `${counted(complete, "full van")} ${complete === 1 ? "seats" : "seat"} ${shown(complete)} × ${shown(size)} = ${shown(size * complete)} visitors.`,
            remainder
              ? `${counted(remainder, "visitor")} still ${remainder === 1 ? "needs a seat" : "need seats"}. No one can be left behind, so one more van is needed, even though it is not full.`
              : `No visitors are left over, so no extra van is needed.`,
            `The fewest vans needed is ${shown(answer)}.`,
          ];
        } else {
          prompt = groupQuestion(
            scene,
            shown(total),
            shown(size),
            large,
            "seats",
          );
          label = `${scene.groups[0]!.toUpperCase()}${scene.groups.slice(1)} needed`;
          figure = large ? undefined : counters(total, size, scene.unit);
          hint = `How many groups of ${shown(size)} fit in ${shown(total)}? If any ${scene.unit} are left over, they still need ${article(scene.group)}.`;
          explanation = [
            `Each ${scene.group} holds ${shown(size)} ${scene.unit}. Find how many groups of ${shown(size)} fit in ${shown(total)}.`,
            `${counted(complete, `full ${scene.group}`)} ${complete === 1 ? "holds" : "hold"} ${shown(complete)} × ${shown(size)} = ${shown(size * complete)} ${scene.unit}.`,
            remainder
              ? `${counted(remainder, scene.one)} still ${remainder === 1 ? "needs a place" : "need places"}. One more ${scene.group} is needed so nothing is left out.`
              : `Nothing is left over, so no extra ${scene.group} is needed.`,
            `The fewest ${scene.groups} needed is ${shown(answer)}.`,
          ];
        }
      } else if (!scene) {
        prompt = `You have ${shown(total)} beads. Each full kit needs exactly ${shown(size)} beads. ${templateId === "full-kits" ? "How many full kits can you make?" : "After making as many full kits as possible, how many beads are left?"}`;
        answer = templateId === "full-kits" ? complete : remainder;
        label = templateId === "full-kits" ? "Full kits" : "Beads left";
        figure = large ? undefined : counters(total, size, "beads");
        hint =
          templateId === "full-kits"
            ? `How many groups of exactly ${shown(size)} beads can you make from ${shown(total)}? A partly filled kit does not count.`
            : `Make as many groups of ${shown(size)} from the ${shown(total)} beads as you can. The beads that cannot fill another group are left.`;
        explanation = [
          `Each kit is one group of exactly ${shown(size)} beads. Find how many groups of ${shown(size)} fit in ${shown(total)}.`,
          `${counted(complete, "kit")} ${complete === 1 ? "uses" : "use"} ${shown(complete)} × ${shown(size)} = ${shown(complete * size)} beads.`,
          `That leaves ${shown(total)} − ${shown(complete * size)} = ${shown(remainder)}. ${remainder === 0 ? "No beads are left." : `${shown(remainder)} is fewer than ${shown(size)}, so ${remainder === 1 ? "it cannot" : "they cannot"} fill another kit.`}`,
          templateId === "full-kits"
            ? `A kit that is only partly filled does not count. You can make ${counted(complete, "full kit")}.`
            : `The beads that cannot fill a kit are left over: ${counted(remainder, "bead")}.`,
        ];
      } else {
        const full = templateId === "full-kits";
        answer = full ? complete : remainder;
        prompt = groupQuestion(
          scene,
          shown(total),
          shown(size),
          large,
          full ? "full" : "left",
        );
        label = full
          ? `Full ${scene.groups}`
          : `${scene.unit[0]!.toUpperCase()}${scene.unit.slice(1)} left`;
        figure = large ? undefined : counters(total, size, scene.unit);
        hint = full
          ? `How many groups of exactly ${shown(size)} ${scene.unit} fit in ${shown(total)}? A partly filled ${scene.group} does not count.`
          : `Fill as many ${scene.groups} of ${shown(size)} as you can. The ${scene.unit} that cannot fill another ${scene.group} are left.`;
        explanation = [
          `Each ${scene.group} holds exactly ${shown(size)} ${scene.unit}. Find how many groups of ${shown(size)} fit in ${shown(total)}.`,
          `${counted(complete, scene.group)} ${complete === 1 ? "uses" : "use"} ${shown(complete)} × ${shown(size)} = ${shown(complete * size)} ${scene.unit}.`,
          `That leaves ${shown(total)} − ${shown(complete * size)} = ${shown(remainder)}. ${remainder === 0 ? `No ${scene.unit} are left.` : `${shown(remainder)} is fewer than ${shown(size)}, so ${remainder === 1 ? "it cannot" : "they cannot"} fill another ${scene.group}.`}`,
          full
            ? `A partly filled ${scene.group} does not count. You can fill ${counted(complete, `full ${scene.group}`)}.`
            : `What cannot fill ${article(scene.group)} is left over: ${counted(remainder, scene.one)}.`,
        ];
      }
      break;
    }
    case "share-whole-items": {
      const trays = r(2, 8),
        each = r(2, 8),
        total = trays * each;
      prompt = `Share ${total} counters equally among ${trays} trays. How many counters belong on each tray?`;
      answer = each;
      label = "Counters per tray";
      hint = `Deal the ${total} counters onto the ${trays} trays one at a time, or solve ${trays} × □ = ${total}.`;
      explanation = [
        `Sharing equally means every tray gets the same number of counters.`,
        `So ${trays} trays times the number on each tray must make ${total}: ${trays} × □ = ${total}.`,
        `Division finds the missing number: ${total} ÷ ${trays} = ${each}, because ${trays} × ${each} = ${total}.`,
        `Each tray gets ${each} counters.`,
      ];
      break;
    }
    case "measure-whole-pieces": {
      const size = r(2, 9),
        pieces = r(2, 9),
        total = size * pieces;
      prompt = `A ribbon is ${total} cm long. Cut it into pieces exactly ${size} cm long. How many pieces will you have?`;
      answer = pieces;
      label = "Pieces";
      hint = `How many ${size} cm lengths fit in ${total} cm? Think ${size} × □ = ${total}.`;
      explanation = [
        `Each piece uses ${size} cm of ribbon. Find how many ${size} cm lengths fit in ${total} cm.`,
        `That is division: ${total} ÷ ${size}. Think ${size} × □ = ${total}.`,
        `${size} × ${pieces} = ${total}, so ${pieces} pieces fit with no ribbon left.`,
        `You will have ${pieces} pieces.`,
      ];
      break;
    }
    case "small-array-total": {
      const rows = r(1, 5),
        columns = r(1, 5);
      figure = { kind: "unit-array", rows, columns };
      prompt = "How many unit squares are in the whole array?";
      answer = rows * columns;
      label = "Unit squares";
      hint =
        rows === 1
          ? "The array is a single row. Count its squares one at a time."
          : `There are ${rows} rows. Count the squares in one row; every row has the same number.`;
      explanation = [
        `An array is squares in equal rows, so every row has the same number of squares.`,
        `There ${rows === 1 ? "is 1 row" : `are ${rows} rows`}, with ${count(columns, "square")} in each row.`,
        `${rows} ${rows === 1 ? "row" : "rows"} of ${columns} is ${rows} × ${columns} = ${answer}.`,
        `The array has ${count(answer, "unit square")}.`,
      ];
      break;
    }
    case "pairing-leftover": {
      const family = chooseAxes(templateId, seed, pairingAxes).family;
      if (family === "count-by-twos-total") {
        const s = surfaceStream(templateId, `${seed}:twos`);
        const total = s(5, 16);
        const pairs = Math.floor(total / 2);
        const odd = total % 2 === 1;
        figure = counters(total, 2, "cups");
        prompt = "Count the cups by 2s. How many cups are there?";
        answer = total;
        label = "Cups";
        hint =
          "Count by 2s. Touch the cups two at a time, starting at 2. A leftover cup still counts.";
        const counted = Array.from({ length: pairs }, (_, i) => 2 * (i + 1));
        explanation = [
          `Count by 2s: ${counted.join(", ")}.`,
          odd
            ? `That uses ${pairs * 2} cups, and one more cup makes ${total}.`
            : `The last number is ${total}. Every cup is in a pair.`,
          `Counting the pairs as ones gives ${pairs}. That is not the number of cups.`,
          odd
            ? `Leaving out the leftover gives ${total - 1}. Counting the leftover as two gives ${total + 1}.`
            : "There is no leftover to drop or to count as two.",
          "The step is 2, and 2 is not how many cups there are.",
          `There are ${total} cups. ${pairs} pairs${odd ? " and one left" : ""}.`,
        ];
        pairingVariant = {
          id: "count-by-twos-total",
          axes: { family: "count-by-twos-total" },
        };
        break;
      }
      if (family === "name-odd-or-even") {
        const s = surfaceStream(templateId, `${seed}:parity`);
        const band = s(1, 5);
        const total =
          band <= 2
            ? [12, 14, 16, 18, 20][s(0, 4)]!
            : band === 3
              ? s(12, 20)
              : s(1, 20);
        if (total <= 16) figure = counters(total, 2, "cups");
        const leftover = total % 2;
        prompt = `Put the ${count(total, "cup")} into pairs. How many are left without a partner?`;
        answer = leftover;
        label = "Unpaired cups";
        hint = `Make pairs from the ${total} cups, two at a time. A cup without a partner is a leftover. The leftover tells odd or even.`;
        explanation = [
          `A pair is a group of 2. Make as many pairs as you can from the ${total} cups.`,
          `${count(Math.floor(total / 2), "pair")} ${Math.floor(total / 2) === 1 ? "uses" : "use"} ${2 * Math.floor(total / 2)} cups.`,
          leftover
            ? `${total} − ${2 * Math.floor(total / 2)} = 1. One cup is left, so ${total} is an odd number.`
            : `${total} − ${2 * Math.floor(total / 2)} = 0. No cup is left, so ${total} is an even number.`,
          leftover
            ? "Calling it even is wrong because the leftover is one, not a pair."
            : "Calling it odd is wrong because the leftover is zero.",
          `The ones digit of ${total} is ${total % 10}. ${[0, 2, 4, 6, 8].includes(total % 10) ? "That digit is even, so the number is even." : "That digit is odd, so the number is odd."}`,
        ];
        pairingVariant = {
          id: "name-odd-or-even",
          axes: { family: "name-odd-or-even" },
        };
        break;
      }
      const total = r(1, 20);
      figure = counters(total, 2, "counters");
      if (total > 16) figure = undefined;
      prompt = `Put ${total} counters into pairs. How many counters will be left without a partner?`;
      answer = total % 2;
      label = "Unpaired counters";
      hint = `Make pairs from the ${total} counters, two at a time. Does every counter get a partner?`;
      explanation = [
        `A pair is a group of 2, so make as many groups of 2 as you can.`,
        `${count(Math.floor(total / 2), "pair")} ${Math.floor(total / 2) === 1 ? "uses" : "use"} ${2 * Math.floor(total / 2)} counters.`,
        `${total} − ${2 * Math.floor(total / 2)} = ${answer}.`,
        answer
          ? `${total} is odd: making pairs always leaves 1 over. 1 counter is left without a partner.`
          : `${total} is even: it splits into pairs with none over. 0 counters are left without a partner.`,
      ];
      break;
    }
    case "equal-tray-total": {
      const trays = r(2, 8),
        each = r(2, 8);
      figure = counters(trays * each, each, "counters");
      prompt = `There are ${trays} trays with ${each} counters on each tray. How many counters are there altogether?`;
      answer = trays * each;
      label = "Counters altogether";
      hint = `${trays} trays of ${each} is ${trays} × ${each}. Skip-count by ${each} once for each tray.`;
      explanation = [
        `Each tray holds the same number, so the trays are ${trays} equal groups of ${each}.`,
        `Equal groups can be counted with multiplication: ${trays} groups of ${each} is ${trays} × ${each}.`,
        `Skip-count by ${each}, once per tray: ${Array.from({ length: trays }, (_, i) => each * (i + 1)).join(", ")}.`,
        `There are ${answer} counters altogether.`,
      ];
      break;
    }
    case "unknown-group-size": {
      const groups = r(2, 9),
        each = r(1, 9),
        total = groups * each;
      prompt = `${groups} equal bags hold ${total} marbles altogether. How many marbles are in each bag?`;
      answer = each;
      label = "Marbles per bag";
      hint = `Share the ${total} marbles equally into ${groups} bags: ${groups} × □ = ${total}.`;
      explanation = [
        `The bags are equal, so each bag holds the same number of marbles.`,
        `${groups} bags times the number in each bag makes ${total}: ${groups} × □ = ${total}.`,
        `Division finds the missing number: ${total} ÷ ${groups} = ${each}, because ${groups} × ${each} = ${total}.`,
        `Each bag holds ${count(each, "marble")}.`,
      ];
      break;
    }
    case "unknown-dividend": {
      const divisor = r(2, 9),
        quotient = r(0, 9);
      prompt = `□ ÷ ${divisor} = ${quotient}. What number belongs in the blank?`;
      answer = divisor * quotient;
      label = "Starting total";
      hint = `□ ÷ ${divisor} = ${quotient} means □ splits into ${divisor} equal groups of ${quotient}. Put the groups back together.`;
      explanation = [
        `□ ÷ ${divisor} = ${quotient} says: a number split into ${divisor} equal groups gives ${quotient} in each group.`,
        `Multiplication undoes division, so put the groups back together.`,
        `${divisor} groups of ${quotient} is ${divisor} × ${quotient} = ${answer}.`,
        `Check: ${answer} ÷ ${divisor} = ${quotient}. The number in the blank is ${answer}.`,
      ];
      break;
    }
    case "split-array-part": {
      const rows = r(3, 9),
        columns = r(2, 9),
        split = r(1, rows - 1),
        top = r(0, 1) === 0;
      figure = { kind: "unit-array", rows, columns, splitAfterRow: split };
      prompt = `The array is split into regions A and B. How many unit squares are in region ${top ? "A" : "B"}?`;
      answer = (top ? split : rows - split) * columns;
      label = "Squares in the region";
      hint = `Region ${top ? "A" : "B"} has only some of the rows. Count its rows, then multiply by the squares in one row.`;
      explanation = [
        `The line splits the array into two smaller arrays. Count only region ${top ? "A" : "B"}.`,
        `Region ${top ? "A" : "B"} has ${count(top ? split : rows - split, "row")}, and every row has ${count(columns, "square")}.`,
        `${top ? split : rows - split} × ${columns} = ${answer}.`,
        `Region ${top ? "A" : "B"} has ${count(answer, "unit square")}.`,
      ];
      break;
    }
    case "nested-bag-total": {
      const crates = r(2, 4),
        bags = r(2, 4),
        each = r(2, 6);
      prompt = `There are ${crates} crates. Each crate has ${bags} bags, and each bag holds ${each} balls. How many balls are there?`;
      answer = crates * bags * each;
      label = "Balls altogether";
      hint = `First find the number of bags: ${crates} crates with ${bags} bags each. Then each bag holds ${each} balls.`;
      explanation = [
        `Work in two steps: first count the bags, then the balls.`,
        `${crates} crates with ${bags} bags each is ${crates} × ${bags} = ${crates * bags} bags.`,
        `Each of the ${crates * bags} bags holds ${each} balls: ${crates * bags} × ${each} = ${answer}.`,
        `There are ${answer} balls. Multiplying in another order gives the same total.`,
      ];
      break;
    }
    case "zero-one-groups": {
      const special = r(0, 1),
        other = r(2, 9),
        reverse = r(0, 1) === 0,
        groups = reverse ? other : special,
        each = reverse ? special : other;
      prompt = `There are ${groups} trays with ${each} counters on each tray. How many counters are there altogether?`;
      answer = groups * each;
      label = "Counters altogether";
      hint =
        groups === 0
          ? `0 trays means no groups at all. How many counters can 0 trays hold?`
          : each === 0
            ? `Each of the ${groups} trays is empty. Add 0 once for each tray.`
            : groups === 1
              ? `There is just one tray of ${each}. How many counters are on that one tray?`
              : `Each of the ${groups} trays holds one counter. Count one for each tray.`;
      explanation = [
        `${groups} ${groups === 1 ? "tray" : "trays"} of ${each} is ${groups} × ${each}.`,
        groups === 0
          ? `With 0 trays there are no groups at all, so there is nothing to count.`
          : each === 0
            ? `Every tray is empty, so adding 0 again and again still gives 0.`
            : groups === 1
              ? `1 group of ${each} is just ${each}: when you multiply by 1, the other number stays the same.`
              : `Each tray has 1 counter, so there is 1 counter per tray: when you multiply by 1, the other number stays the same.`,
        `${groups} × ${each} = ${answer}, so there ${answer === 1 ? "is 1 counter" : `are ${answer} counters`} altogether.`,
      ];
      break;
    }
    case "comparison-amount":
    case "comparison-factor": {
      const castName = axes?.frame18;
      const cast =
        castName && castName !== "classic"
          ? comparisonCast[castName]
          : undefined;
      if (templateId === "comparison-amount" && axes?.unknown === "smaller") {
        const factor = r(2, 9);
        let small = r(2, 100);
        if (small === factor) small = small === 100 ? 2 : small + 1;
        const large = small * factor;
        if (!cast) {
          prompt = `Sam has ${shown(large)} tokens. Sam has ${shown(factor)} times as many tokens as Mia. How many tokens does Mia have?`;
          label = "Mia's tokens";
          hint = `${shown(large)} is ${shown(factor)} times Mia's tokens. Divide ${shown(large)} by ${shown(factor)}. Do not subtract ${shown(factor)}.`;
          explanation = [
            `"${shown(factor)} times as many" means ${shown(factor)} copies of Mia's amount make Sam's ${shown(large)}, not ${shown(factor)} more.`,
            `So ${shown(factor)} × Mia's tokens = ${shown(large)}.`,
            `Divide: ${shown(large)} ÷ ${shown(factor)} = ${shown(small)}, because ${shown(factor)} × ${shown(small)} = ${shown(large)}.`,
            `Mia has ${shown(small)} tokens. Taking away ${shown(factor)} from ${shown(large)} is the additive mistake.`,
          ];
        } else {
          prompt =
            large > 80
              ? comparisonSmallAsk(cast, shown(large), shown(factor))
              : `${cast.b} has ${shown(large)} ${cast.noun}. ${cast.b} has ${shown(factor)} times as many ${cast.noun} as ${cast.a}. How many ${cast.noun} does ${cast.a} have?`;
          label = `${cast.a}'s ${cast.noun}`;
          hint = `${shown(large)} is ${shown(factor)} times ${cast.a}'s ${cast.noun}. Divide ${shown(large)} by ${shown(factor)}. Do not subtract ${shown(factor)}.`;
          explanation = [
            `"${shown(factor)} times as many" means ${shown(factor)} copies of ${cast.a}'s amount make the ${shown(large)} ${cast.noun}, not ${shown(factor)} more.`,
            `So ${shown(factor)} × ${cast.a}'s ${cast.noun} = ${shown(large)}.`,
            `Divide: ${shown(large)} ÷ ${shown(factor)} = ${shown(small)}, because ${shown(factor)} × ${shown(small)} = ${shown(large)}.`,
            `${cast.a} has ${shown(small)} ${cast.noun}. Taking away ${shown(factor)} from ${shown(large)} is the additive mistake.`,
          ];
        }
        answer = small;
        break;
      }
      const small = r(2, 9),
        factor = r(2, 6),
        large = small * factor;
      if (templateId === "comparison-amount") {
        if (!cast) {
          prompt = `Mia has ${shown(small)} tokens. Sam has ${shown(factor)} times as many tokens as Mia. How many tokens does Sam have?`;
          label = "Sam's tokens";
          hint = `${shown(factor)} times as many as ${shown(small)} means ${shown(factor)} copies of ${shown(small)}, not ${shown(small)} + ${shown(factor)}.`;
        } else {
          prompt = comparisonAsk(cast, shown(small), shown(factor));
          label = `${cast.b}'s ${cast.noun}`;
          hint = `${shown(factor)} times as many as ${shown(small)} means ${shown(factor)} copies of ${shown(small)}, not ${shown(small)} + ${shown(factor)}.`;
        }
        answer = large;
      } else {
        prompt = `Mia has ${small} tokens. Sam has ${large} tokens. Sam has how many times as many tokens as Mia?`;
        answer = factor;
        label = "Times as many";
        hint = `How many groups of Mia's ${small} make Sam's ${large}? Think ${small} × □ = ${large}.`;
        figure = {
          kind: "bar-chart",
          categories: ["Mia", "Sam"],
          values: [small, large],
          valueLabel: "Tokens",
        };
      }
      explanation =
        templateId === "comparison-amount"
          ? cast
            ? [
                `"${shown(factor)} times as many" means ${shown(factor)} copies of ${cast.a}'s amount, not ${shown(factor)} more.`,
                `${cast.a} has ${shown(small)}, so ${cast.b} has ${shown(factor)} groups of ${shown(small)}: ${shown(factor)} × ${shown(small)}.`,
                `${shown(factor)} × ${shown(small)} = ${shown(large)}.`,
                `${cast.b} has ${shown(large)} ${cast.noun}.`,
              ]
            : [
                `"${shown(factor)} times as many" means ${shown(factor)} copies of Mia's amount, not ${shown(factor)} more.`,
                `Mia has ${shown(small)}, so Sam has ${shown(factor)} groups of ${shown(small)}: ${shown(factor)} × ${shown(small)}.`,
                `${shown(factor)} × ${shown(small)} = ${shown(large)}.`,
                `Sam has ${shown(large)} tokens.`,
              ]
          : [
              `"How many times as many" asks how many copies of Mia's amount make Sam's amount.`,
              `So find how many groups of ${small} make ${large}: ${small} × □ = ${large}.`,
              `Division finds it: ${large} ÷ ${small} = ${factor}, because ${factor} × ${small} = ${large}.`,
              `Sam has ${factor} times as many tokens as Mia.`,
            ];
      break;
    }
    case "delivery-then-use": {
      const boxes = r(2, 8),
        each = r(2, 9),
        total = boxes * each,
        used = r(1, total);
      prompt = `A class gets ${boxes} boxes with ${each} pencils in each. It uses ${used} pencils. How many pencils remain?`;
      answer = total - used;
      label = "Pencils remaining";
      hint = `First find all the pencils: ${boxes} boxes of ${each}. Then take away the ${used} used.`;
      explanation = [
        `First find how many pencils arrive, then take away the ones used.`,
        `${boxes} boxes of ${each} is ${boxes} × ${each} = ${total} pencils.`,
        `Using pencils makes fewer, so subtract: ${total} − ${used} = ${answer}.`,
        `${answer === 1 ? "1 pencil remains" : `${answer} pencils remain`}.`,
      ];
      break;
    }
    case "purchase-change": {
      const items = r(2, 8),
        price = r(2, 9),
        cost = items * price,
        payment = cost + r(0, 20);
      prompt = `Buy ${items} notebooks at ${price} dollars each. Pay ${payment} dollars. How many dollars of change should you receive?`;
      answer = payment - cost;
      label = "Dollars of change";
      hint = `First find the cost of ${items} notebooks at ${price} dollars each. Then subtract that cost from the ${payment} dollars paid.`;
      explanation = [
        `Change is the money you get back when you pay more than the cost.`,
        `First find the cost: ${items} notebooks at ${price} dollars each is ${items} × ${price} = ${cost} dollars.`,
        `Then take the cost from what you paid: ${payment} − ${cost} = ${answer}.`,
        `You should receive ${count(answer, "dollar")} of change.`,
      ];
      break;
    }
    case "factor-partner": {
      const factor = r(1, 10),
        partner = r(1, Math.floor(100 / factor)),
        total = factor * partner;
      prompt = `One factor of ${total} is ${factor}. What is its partner in a factor pair with product ${total}?`;
      answer = partner;
      label = "Partner factor";
      hint = `Solve ${factor} × □ = ${total}: divide ${total} by ${factor}, then check by multiplying.`;
      explanation = [
        `Factors are numbers you multiply. A factor pair is two factors whose product, the answer to the multiplication, is ${total}.`,
        `So find the missing factor in ${factor} × □ = ${total}.`,
        `Division undoes multiplication: ${total} ÷ ${factor} = ${partner}.`,
        `Check: ${factor} × ${partner} = ${total}. The partner of ${factor} is ${partner}.`,
      ];
      break;
    }
    case "tens-contribution": {
      const tens = r(1, 9),
        ones = r(1, 9),
        factor = r(2, 9),
        number = tens * 10 + ones;
      prompt = `To find ${number} × ${factor}, split ${number} into ${tens * 10} + ${ones}. What is the tens partial product?`;
      answer = tens * 10 * factor;
      label = "Tens partial product";
      figure = { kind: "scene", scene: partialProducts(number, factor) };
      hintCue = partialProductsHint(number, factor);
      hint = `The tens part is ${tens * 10}, not ${tens}. Multiply ${tens * 10} × ${factor}, which is ${tens} × ${factor} tens; leave the ${ones} for later.`;
      explanation = [
        `Splitting ${number} into ${tens * 10} + ${ones} breaks one hard multiplication into two easier ones. Each one is a partial product.`,
        `The ${tens} in ${number} is in the tens place, so it means ${tens * 10}, not ${tens}.`,
        `${tens * 10} is ${tens} tens, so ${tens * 10} × ${factor} is ${factor} groups of ${tens} tens: ${tens} × ${factor} = ${tens * factor}, so that is ${tens * factor} tens.`,
        `${tens * factor} tens is ${tens * factor} × 10 = ${answer}.`,
        `The tens partial product is ${answer}. The ones part, ${ones} × ${factor}, is added later.`,
      ];
      break;
    }
    case "neighbor-product-change": {
      const rows = r(2, 8),
        columns = r(2, 9);
      figure = {
        kind: "unit-array",
        rows: rows + 1,
        columns,
        splitAfterRow: rows,
      };
      prompt = `An array grows from ${rows} rows to ${rows + 1} rows, with ${columns} squares per row. How many squares were added?`;
      answer = columns;
      label = "Squares added";
      hint = `Going from ${rows} rows to ${rows + 1} rows adds one row. How many squares are in one row?`;
      explanation = [
        `Going from ${rows} rows to ${rows + 1} rows adds exactly one row.`,
        `Every row has ${columns} squares, so one new row adds ${columns} squares.`,
        `Check: ${rows + 1} × ${columns} = ${(rows + 1) * columns} and ${rows} × ${columns} = ${rows * columns}, and ${(rows + 1) * columns} − ${rows * columns} = ${columns}.`,
        `${columns} squares were added.`,
      ];
      break;
    }
    default:
      throw new Error(`Unimplemented template: ${templateId}`);
  }
  const variant = axes
    ? recordedSweepVariant(templateId, "comparison", axes)
    : pairingVariant;
  const pairingVersion =
    templateId === "pairing-leftover" &&
    !versionGatedAxes().some((axis) => axis.id === "family")
      ? 2
      : 1;
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([templateId, 1, seed]))
        .digest("hex"),
      templateId,
      templateVersion:
        templateId === "pairing-leftover" ? pairingVersion : 1,
      seed,
      prompt,
      skillId: template.skillId,
      response: { kind: "number", label },
      ...(figure ? { figure } : {}),
    },
    answer: String(answer),
    hint,
    ...(hintCue ? { hintCue } : {}),
    explanation,
    ...(variant ? { variant } : {}),
  };
}
