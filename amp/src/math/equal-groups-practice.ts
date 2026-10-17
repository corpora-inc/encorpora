import { createHash } from "node:crypto";
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
    figure: SemanticFigure | undefined;
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
        hint =
          "Everyone needs a seat. Check whether the full vans leave anyone waiting.";
        explanation = [
          `${complete} full vans seat ${size * complete} visitors.`,
          left
            ? `${left} visitors still need seats, so use one more van: ${answer} vans.`
            : `No visitors remain, so exactly ${answer} vans are enough.`,
        ];
      } else {
        prompt = `You have ${total} beads. Each full kit needs exactly ${size} beads. ${templateId === "full-kits" ? "How many full kits can you make?" : "After making as many full kits as possible, how many beads are left?"}`;
        answer = templateId === "full-kits" ? complete : left;
        label = templateId === "full-kits" ? "Full kits" : "Beads left";
        figure = grouped(total, size, "beads");
        hint =
          templateId === "full-kits"
            ? "Count only groups that contain the full required number of beads."
            : "Remove all complete groups. Count the beads that cannot fill another kit.";
        explanation = [
          `${complete} kits use ${complete} × ${size} = ${complete * size} beads.`,
          `${total} − ${complete * size} = ${left} beads remain; this is fewer than ${size}.`,
          templateId === "full-kits"
            ? `Make ${complete} full kits. A partial kit does not count.`
            : `The requested answer is the leftover amount: ${left} beads.`,
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
      hint = "The number of trays is known. Find the size of each equal share.";
      explanation = [
        `${trays} trays × ? counters per tray = ${total} counters.`,
        `${total} ÷ ${trays} = ${each}, so each tray receives ${each} counters.`,
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
      hint = "Count how many piece-lengths fit in the full ribbon.";
      explanation = [
        `Each piece uses ${size} cm.`,
        `${total} ÷ ${size} = ${pieces}, so there are ${pieces} pieces, with no ribbon left.`,
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
      hint = "Count one row, then count the equal rows.";
      explanation = [
        `There are ${rows} rows with ${columns} squares in each row.`,
        `${rows} × ${columns} = ${answer} unit squares.`,
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
      hint =
        "Each pair uses two counters. A counter without a partner is left over.";
      explanation = [
        `${Math.floor(total / 2)} pairs use ${2 * Math.floor(total / 2)} counters.`,
        `${total} − ${2 * Math.floor(total / 2)} = ${answer} counter(s) without a partner.`,
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
      hint =
        "Add the equal group sizes, or multiply the number of groups by their size.";
      explanation = [
        `${trays} equal groups each contain ${each} counters.`,
        `${trays} × ${each} = ${answer} counters altogether.`,
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
      hint = "Which number multiplied by the bag count gives the total?";
      explanation = [
        `${groups} × ? = ${total}.`,
        `${groups} × ${each} = ${total}, so each bag holds ${each} marbles.`,
      ];
      break;
    }
    case "unknown-dividend": {
      const divisor = r(2, 9),
        quotient = r(0, 9);
      prompt = `? ÷ ${divisor} = ${quotient}. What number belongs in the blank?`;
      answer = divisor * quotient;
      label = "Starting total";
      hint =
        "Rebuild the starting total from the number and size of equal shares.";
      explanation = [
        `Division and multiplication undo each other.`,
        `${quotient} × ${divisor} = ${answer}; check ${answer} ÷ ${divisor} = ${quotient}.`,
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
      hint =
        "Count only the rows in the named region; every row has the same length.";
      explanation = [
        `Region ${top ? "A" : "B"} has ${top ? split : rows - split} rows, each with ${columns} squares.`,
        `${top ? split : rows - split} × ${columns} = ${answer}. The other region is not part of this partial product.`,
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
      hint =
        "First find how many bags there are, then count the balls in those bags.";
      explanation = [
        `${crates} × ${bags} = ${crates * bags} bags.`,
        `${crates * bags} × ${each} = ${answer} balls. Grouping the multiplications another way gives the same total.`,
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
        "Zero groups or zero items in every group gives no items. One group keeps its group size.";
      explanation = [
        `${groups} × ${each} = ${answer}.`,
        special === 0
          ? "Either there are no trays, or every tray is empty; the total is zero."
          : "Multiplying by one preserves the other factor.",
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
        hint =
          "Times as many means equal copies of Mia's amount, not adding the factor.";
      } else {
        prompt = `Mia has ${small} tokens. Sam has ${large} tokens. Sam has how many times as many tokens as Mia?`;
        answer = factor;
        label = "Times as many";
        hint = "How many copies of Mia's amount fit into Sam's amount?";
        figure = {
          kind: "bar-chart",
          categories: ["Mia", "Sam"],
          values: [small, large],
          valueLabel: "Tokens",
        };
      }
      explanation = [
        `${factor} groups of ${small} tokens make ${large} tokens.`,
        templateId === "comparison-amount"
          ? `${small} × ${factor} = ${large} tokens for Sam.`
          : `${large} ÷ ${small} = ${factor}, so Sam has ${factor} times as many.`,
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
      hint = "Find the full delivery first. Then account for the pencils used.";
      explanation = [
        `${boxes} × ${each} = ${total} pencils arrive.`,
        `${total} − ${used} = ${answer} pencils remain.`,
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
      hint =
        "Work out the cost of all notebooks before comparing it with the payment.";
      explanation = [
        `${items} × ${price} = ${cost} dollars spent.`,
        `${payment} − ${cost} = ${answer} dollars of change.`,
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
      hint = "Divide the product by the known factor; check by multiplying.";
      explanation = [
        `${total} ÷ ${factor} = ${partner}.`,
        `${factor} × ${partner} = ${total}, so (${factor}, ${partner}) is a factor pair. This is one pair, not necessarily the only pair.`,
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
      hint =
        "Multiply only the tens amount by the factor; leave the ones part for later.";
      explanation = [
        `The tens amount is ${tens * 10}, not ${tens}.`,
        `${tens * 10} × ${factor} = ${answer}. The complete product also includes ${ones} × ${factor}.`,
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
      hint = "Only one new row is added. Count the squares in that row.";
      explanation = [
        `The array grows from ${rows * columns} to ${(rows + 1) * columns} squares.`,
        `${(rows + 1) * columns} − ${rows * columns} = ${columns}. Neighboring products differ by one group of ${columns}.`,
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
    explanation,
  };
}
