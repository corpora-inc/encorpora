import { createHash } from "node:crypto";
import { partialProducts, partialProductsHint } from "./scene/explanations.js";
import type { Step } from "./scene/timeline.js";
import { equalGroupsDefinitions } from "../content/equal-groups-definitions.js";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
export const equalGroupsTemplates: readonly TemplateMetadata[] =
  equalGroupsDefinitions.map(({ id, title, skillId, grade, description }) => ({
    id,
    title,
    skillId,
    description,
    version: 1,
    gradeBand: grade === "2" ? "K–2" : "3–5",
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
/** "1 van", "3 vans": a count with its noun in agreement. */
const count = (n: number, word: string) =>
  `${n} ${n === 1 ? word : `${word}s`}`;

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
  let prompt = "",
    answer = 0,
    label = "Number",
    hint = "",
    explanation: string[] = [],
    figure: SemanticFigure | undefined,
    hintCue: Step[] | undefined;
  const grouped = (
    total: number,
    groupSize: number,
    unit: string,
  ): SemanticFigure => ({ kind: "grouped-counters", total, groupSize, unit });
  switch (templateId) {
    case "full-kits":
    case "seats-needed":
    case "kit-leftovers": {
      const size = r(2, 8),
        complete = r(1, 6),
        left = r(0, size - 1),
        total = size * complete + left;
      if (templateId === "seats-needed") {
        prompt = `${total} visitors need rides. Each van seats ${size} visitors. What is the fewest vans needed?`;
        answer = complete + (left > 0 ? 1 : 0);
        label = "Vans needed";
        figure = grouped(total, size, "visitors");
        hint = `How many groups of ${size} fit in ${total}? If anyone is left over, they still need a van.`;
        explanation = [
          `Each van is one group of ${size} seats. Find how many groups of ${size} fit in ${total}.`,
          `${count(complete, "full van")} ${complete === 1 ? "seats" : "seat"} ${complete} × ${size} = ${size * complete} visitors.`,
          left
            ? `${count(left, "visitor")} still ${left === 1 ? "needs a seat" : "need seats"}. No one can be left behind, so one more van is needed, even though it is not full.`
            : `No visitors are left over, so no extra van is needed.`,
          `The fewest vans needed is ${answer}.`,
        ];
      } else {
        prompt = `You have ${total} beads. Each full kit needs exactly ${size} beads. ${templateId === "full-kits" ? "How many full kits can you make?" : "After making as many full kits as possible, how many beads are left?"}`;
        answer = templateId === "full-kits" ? complete : left;
        label = templateId === "full-kits" ? "Full kits" : "Beads left";
        figure = grouped(total, size, "beads");
        hint =
          templateId === "full-kits"
            ? `How many groups of exactly ${size} beads can you make from ${total}? A partly filled kit does not count.`
            : `Make as many groups of ${size} from the ${total} beads as you can. The beads that cannot fill another group are left.`;
        explanation = [
          `Each kit is one group of exactly ${size} beads. Find how many groups of ${size} fit in ${total}.`,
          `${count(complete, "kit")} ${complete === 1 ? "uses" : "use"} ${complete} × ${size} = ${complete * size} beads.`,
          `That leaves ${total} − ${complete * size} = ${left}. ${left === 0 ? "No beads are left." : `${left} is fewer than ${size}, so ${left === 1 ? "it cannot" : "they cannot"} fill another kit.`}`,
          templateId === "full-kits"
            ? `A kit that is only partly filled does not count. You can make ${count(complete, "full kit")}.`
            : `The beads that cannot fill a kit are left over: ${count(left, "bead")}.`,
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
      const total = r(1, 20);
      figure = grouped(total, 2, "counters");
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
      figure = grouped(trays * each, each, "counters");
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
              ? `1 group of ${each} is just ${each}: multiplying by 1 keeps the other number the same.`
              : `Each tray has 1 counter, so there is 1 counter per tray: multiplying by 1 keeps the other number the same.`,
        `${groups} × ${each} = ${answer}, so there ${answer === 1 ? "is 1 counter" : `are ${answer} counters`} altogether.`,
      ];
      break;
    }
    case "comparison-amount":
    case "comparison-factor": {
      const small = r(2, 9),
        factor = r(2, 6),
        large = small * factor;
      if (templateId === "comparison-amount") {
        prompt = `Mia has ${small} tokens. Sam has ${factor} times as many tokens as Mia. How many tokens does Sam have?`;
        answer = large;
        label = "Sam's tokens";
        hint = `${factor} times as many as ${small} means ${factor} copies of ${small}, not ${small} + ${factor}.`;
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
          ? [
              `"${factor} times as many" means ${factor} copies of Mia's amount, not ${factor} more.`,
              `Mia has ${small}, so Sam has ${factor} groups of ${small}: ${factor} × ${small}.`,
              `${factor} × ${small} = ${large}.`,
              `Sam has ${large} tokens.`,
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
        `${tens * 10} × ${factor} is ${tens} × ${factor} = ${tens * factor} tens, which is ${answer}.`,
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
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([templateId, 1, seed]))
        .digest("hex"),
      templateId,
      templateVersion: 1,
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
  };
}
