import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { decimal, fixed } from "./decimal-models";

// id | title | skill | grade band | description
const rows = `
decimal-grid-read|Name a shaded decimal|decimal-fractions|3–5|Name the shaded part of a tenths strip or hundredths grid as a decimal.
tenths-as-hundredths|Tenths as hundredths|decimal-fractions|3–5|Rename tenths as hundredths, alone or added to hundredths, as a numerator or a decimal.
decimal-line-point|Read a decimal on a number line|decimal-fractions|3–5|Read a point on a line cut into tenths of a whole or hundredths of a tenth.
compare-decimals-hundredths|Compare decimals to hundredths|compare-decimals|3–5|Choose the greater or lesser of two decimals with one or two places, including shorter-but-greater pairs.
decimal-digit-value|Value of a decimal digit|decimal-place-value|3–5|Name the value of one digit of a decimal with up to three places.
expanded-decimal|Decimal from expanded form|decimal-place-value|3–5|Write a decimal from ones, tenths, hundredths and thousandths, including empty places.
compare-decimals-thousandths|Compare decimals to thousandths|decimal-place-value|3–5|Choose the greater or lesser of two decimals with up to three places, including shorter-but-greater pairs.
round-decimal|Round a decimal|decimal-place-value|3–5|Round a decimal with up to three places to the nearest whole number, tenth or hundredth.
multidigit-decimal-sum|Add and subtract multidigit decimals|decimal-algorithms|6–8|Add or subtract decimals with different numbers of places up to thousandths.
multidigit-decimal-product|Multiply multidigit decimals|decimal-algorithms|6–8|Multiply two decimals with one or two places each.
multidigit-decimal-quotient|Divide by a decimal|decimal-algorithms|6–8|Divide a decimal by a decimal with one or two places when the quotient terminates.
`;
const definitions = rows
  .trim()
  .split("\n")
  .map((row) => {
    const [id, title, skillId, gradeBand, description] = row.split("|") as [
      string,
      string,
      string,
      "3–5" | "6–8",
      string,
    ];
    return { id, title, skillId, gradeBand, description };
  });
export const decimalTemplates: readonly TemplateMetadata[] = definitions.map(
  ({ id, title, skillId, gradeBand, description }) => ({
    id,
    version: 1,
    title,
    skillId,
    gradeBand,
    description,
  }),
);

type Random = (low: number, high: number) => number;
function random(id: string, seed: string): Random {
  let counter = 0;
  return (low, high) => {
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
const pick = <T>(r: Random, xs: readonly T[]): T => xs[r(0, xs.length - 1)]!;
const PLACE = ["ones", "tenths", "hundredths", "thousandths"] as const;
const UNIT = ["1", "1/10", "1/100", "1/1000"] as const;
const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;
/** Decimal places shown in a written decimal. */
const placesOf = (s: string) => (s.includes(".") ? s.split(".")[1]!.length : 0);

type Draft = {
  prompt: string;
  hint: string;
  explanation: string[];
  answer: string;
  label: string;
  figure?: SemanticFigure;
};

/** A pair of unequal decimals with up to `max` places, chosen so that the
 * number of digits does not decide the comparison. Values are in units of
 * 10^-max; each is written with its own number of places, last digit nonzero. */
function comparePair(r: Random, max: 2 | 3) {
  const scale = 10 ** max;
  for (;;) {
    const mode = r(0, 3);
    let wa = r(0, 3),
      wb = wa,
      pa: number,
      pb: number,
      a: number,
      b: number;
    if (mode === 0) {
      // Shorter but greater: 0.5 vs 0.45, 0.3 vs 0.299.
      pa = r(1, max - 1);
      pb = max;
      const unit = 10 ** (max - pa);
      a = r(1, 10 ** pa - 1) * unit;
      b = a - r(1, unit - 1) - unit * r(0, Math.min(2, a / unit - 1));
    } else if (mode === 1) {
      // Longer and greater with the same leading digits: 0.4 vs 0.45.
      pa = r(1, max - 1);
      pb = max;
      const unit = 10 ** (max - pa);
      a = r(1, 10 ** pa - 1) * unit;
      b = a + r(1, unit - 1);
    } else if (mode === 2) {
      // Same length, digits differ: 0.36 vs 0.63.
      pa = pb = r(1, max);
      const unit = 10 ** (max - pa);
      a = r(1, 10 ** pa - 1) * unit;
      b = r(1, 10 ** pa - 1) * unit;
    } else {
      // A larger whole beats more decimal digits: 1.2 vs 0.95.
      wa = wb + 1;
      pa = r(1, max - 1);
      pb = max;
      a = r(0, 10 ** pa - 1) * 10 ** (max - pa);
      b = r(10 ** (max - 1), scale - 1);
    }
    const last = (v: number, p: number) => Math.floor(v / 10 ** (max - p)) % 10;
    if (b <= 0 || b >= scale || a === b) continue;
    if (a <= 0 || last(b, pb) === 0 || last(a, pa) === 0) continue;
    return finishPair(r, wa * scale + a, pa, wb * scale + b, pb, max);
  }
}
function finishPair(
  r: Random,
  a: number,
  pa: number,
  b: number,
  pb: number,
  max: number,
) {
  const write = (v: number, p: number) => fixed(v / 10 ** (max - p), p);
  const pair = [
    { value: a, text: write(a, pa) },
    { value: b, text: write(b, pb) },
  ];
  return r(0, 1) ? pair : [pair[1]!, pair[0]!];
}

function compareDraft(r: Random, max: 2 | 3): Draft {
  const [x, y] = comparePair(r, max);
  const ask = r(0, 1) ? "greater" : "less";
  const [big, small] = x!.value > y!.value ? [x!, y!] : [y!, x!];
  const padded = (s: string) => fixed(Math.round(Number(s) * 10 ** max), max);
  const pb = padded(big.text),
    ps = padded(small.text);
  let i = 0;
  while (pb[i] === ps[i]) i++;
  const place = i < pb.indexOf(".") ? "ones" : PLACE[i - pb.indexOf(".")]!;
  const steps: string[] = [];
  const short = [x!, y!].filter((v) => placesOf(v.text) < max);
  if (short.length)
    steps.push(
      `Write both with ${PLACE[max]}; zeros added on the right change nothing: ${short.map((v) => `${v.text} = ${padded(v.text)}`).join(" and ")}.`,
    );
  steps.push(
    place === "ones"
      ? `Compare from the left. The ones differ: ${pb[i]} is greater than ${ps[i]}.`
      : `Compare from the left. The places before the ${place} match; in the ${place}, ${pb[i]} is greater than ${ps[i]}.`,
    `So ${big.text} > ${small.text}, and the ${ask === "greater" ? "greater" : "lesser"} decimal is ${ask === "greater" ? big.text : small.text}.`,
  );
  const split = (s: string) => {
    const [whole, decimals = ""] = s.split(".");
    return { ones: Number(whole), decimals };
  };
  return {
    prompt: `Which is ${ask}: ${x!.text} or ${y!.text}? Enter that decimal.`,
    hint: `Line up ${x!.text} and ${y!.text} by the decimal point${short.length ? ` and write ${short.map((v) => `${v.text} as ${padded(v.text)}`).join(" and ")}` : ""}. Then compare digits from the left: the first place that differs decides.`,
    explanation: steps,
    answer: ask === "greater" ? big.text : small.text,
    label: "Decimal",
    figure: {
      kind: "place-value-chart",
      places: max,
      rows: [split(x!.text), split(y!.text)],
    },
  };
}

function draft(templateId: string, r: Random): Draft {
  switch (templateId) {
    case "decimal-grid-read": {
      if (r(0, 2) === 0) {
        const k = r(1, 9);
        return {
          prompt:
            "The strip is one whole, cut into 10 equal parts. What decimal names the shaded part?",
          hint: "The strip has 10 equal parts, so each part is one tenth. Count the shaded parts: that count is the tenths digit.",
          explanation: [
            "The whole is cut into 10 equal parts, so each part is 1/10, written 0.1.",
            `${count(k, "part is", "parts are")} shaded: ${k}/10 = 0.${k}.`,
          ],
          answer: `0.${k}`,
          label: "Decimal",
          figure: { kind: "decimal-grid", unit: "tenths", shaded: k },
        };
      }
      const k = r(0, 4) === 0 ? 10 * r(1, 9) : r(1, 99);
      const t = Math.floor(k / 10),
        h = k % 10;
      return {
        prompt:
          "The large square is one whole, cut into 100 equal squares. What decimal names the shaded part?",
        hint: "The 100 squares make 10 columns, and each full column is one tenth. Count the full columns for the tenths digit, then the extra squares for the hundredths digit.",
        explanation: [
          "Each small square is 1/100 of the whole, written 0.01. Each full column of 10 squares is 1/10.",
          t && h
            ? `${count(k, "square is", "squares are")} shaded: ${count(t, "full column", "full columns")} (${count(t, "tenth", "tenths")}) and ${h} more (${count(h, "hundredth", "hundredths")}).`
            : t
              ? `${k} squares are shaded: ${count(t, "full column", "full columns")}, so ${count(t, "tenth", "tenths")}.`
              : `${count(k, "square is", "squares are")} shaded: ${count(h, "hundredth", "hundredths")} and no full column.`,
          `${k}/100 = ${fixed(k, 2)}${k % 10 ? "" : ` = ${decimal(k, 2)}`}.`,
        ],
        answer: fixed(k, 2),
        label: "Decimal",
        figure: { kind: "decimal-grid", unit: "hundredths", shaded: k },
      };
    }
    case "tenths-as-hundredths": {
      const a = r(1, 9),
        b = r(1, 9),
        form = r(0, 2);
      if (form === 0)
        return {
          prompt: `${a}/10 + ${b}/100 = □/100. What number belongs in the box?`,
          hint: `${a}/10 is ${count(a, "tenth", "tenths")}, and each tenth is ten hundredths. Rename ${a}/10 in hundredths, then add the ${b}/100.`,
          explanation: [
            `One tenth is 10 hundredths, so ${a}/10 = ${a * 10}/100.`,
            `${a * 10}/100 + ${b}/100 = ${a * 10 + b}/100.`,
          ],
          answer: `${a * 10 + b}`,
          label: "Number",
        };
      if (form === 1)
        return {
          prompt: `0.${a} = □/100. What number belongs in the box?`,
          hint: `0.${a} is ${a} ${a === 1 ? "tenth" : "tenths"}, and each tenth is ten hundredths. How many hundredths is that?`,
          explanation: [
            `0.${a} is ${count(a, "tenth", "tenths")}: ${a}/10.`,
            `Each tenth is 10 hundredths, so ${a}/10 = ${a * 10}/100. That is why 0.${a} = 0.${a}0.`,
          ],
          answer: `${a * 10}`,
          label: "Number",
        };
      return {
        prompt: `What is ${a}/10 + ${b}/100 written as a decimal?`,
        hint: `The first place after the decimal point counts tenths and the second counts hundredths. Which digit goes in each place for ${a}/10 + ${b}/100?`,
        explanation: [
          `${a}/10 + ${b}/100 = ${a * 10}/100 + ${b}/100 = ${a * 10 + b}/100.`,
          `${count(a, "tenth", "tenths")} and ${count(b, "hundredth", "hundredths")} is 0.${a}${b}.`,
        ],
        answer: `0.${a}${b}`,
        label: "Decimal",
      };
    }
    case "decimal-line-point": {
      const point = r(1, 9);
      if (r(0, 1)) {
        const w = r(0, 4);
        const answer = decimal(w * 10 + point, 1);
        return {
          prompt: "What decimal is at point P?",
          hint: `From ${w} to ${w + 1} is cut into 10 equal steps, so each step is one tenth. Count the steps from ${w} to P.`,
          explanation: [
            `The whole from ${w} to ${w + 1} is cut into 10 equal intervals, so each is 1/10 = 0.1.`,
            `P is ${count(point, "interval", "intervals")} past ${w}: ${w} + ${point} × 0.1 = ${answer}.`,
          ],
          answer,
          label: "Decimal",
          figure: {
            kind: "decimal-line",
            denominator: 10,
            start: w * 10,
            point,
          },
        };
      }
      const t = r(1, 49);
      const left = decimal(t, 1),
        right = decimal(t + 1, 1);
      const answer = fixed(t * 10 + point, 2);
      return {
        prompt: "What decimal is at point P?",
        hint: `From ${left} to ${right} is one tenth, cut into 10 equal steps, so each step is one hundredth. Count the steps from ${left} to P.`,
        explanation: [
          `From ${left} to ${right} is one tenth, cut into 10 equal intervals, so each is 1/100 = 0.01.`,
          `P is ${count(point, "interval", "intervals")} past ${left}: ${left} + ${point} × 0.01 = ${answer}.`,
        ],
        answer,
        label: "Decimal",
        figure: {
          kind: "decimal-line",
          denominator: 100,
          start: t * 10,
          point,
        },
      };
    }
    case "compare-decimals-hundredths":
      return compareDraft(r, 2);
    case "compare-decimals-thousandths":
      return compareDraft(r, 3);
    case "decimal-digit-value": {
      // Distinct nonzero digits make "the digit d" name one place.
      const digits: number[] = [];
      while (digits.length < 4) {
        const d = r(1, 9);
        if (!digits.includes(d)) digits.push(d);
      }
      const number = `${digits[0]}.${digits.slice(1).join("")}`;
      const place = r(1, 3),
        d = digits[place]!;
      const answer = decimal(d * 10 ** (3 - place), 3);
      return {
        prompt: `In ${number}, what is the value of the digit ${d}?`,
        hint: `Find the ${d} in ${number} and count how many places after the decimal point it sits: the first place is tenths. Its value is ${d} of that place.`,
        explanation: [
          `${d} is in the ${PLACE[place]} place, ${place === 1 ? "the first" : place === 2 ? "the second" : "the third"} place after the decimal point.`,
          `Its value is ${d} × ${UNIT[place]} = ${answer}.`,
        ],
        answer,
        label: "Value",
      };
    }
    case "expanded-decimal": {
      const ones = r(1, 9);
      let places = [r(0, 9), r(0, 9), r(1, 9)];
      // Most items keep an empty place inside: the zero must be written.
      if (r(0, 9) < 7) places[r(0, 1)] = 0;
      if (places.every((p) => p === 0)) places = [0, 0, r(1, 9)];
      const terms = [
        `${ones} × 1`,
        ...places.flatMap((p, i) => (p ? [`${p} × ${UNIT[i + 1]}`] : [])),
      ];
      const answer = `${ones}.${places.join("")}`;
      const empty = places.flatMap((p, i) => (p ? [] : [PLACE[i + 1]!]));
      return {
        prompt: `What decimal is ${terms.join(" + ")}?`,
        hint: `${terms.slice(1).join(" + ")} fill the places after the decimal point. Write ${ones} in the ones place, then one digit each for tenths, hundredths and thousandths, in order.${empty.length ? ` There are no ${empty.join(" and no ")}: write 0 there.` : ""}`,
        explanation: [
          `Ones: ${ones}. Tenths: ${places[0]}. Hundredths: ${places[1]}. Thousandths: ${places[2]}.`,
          empty.length
            ? `There are no ${empty.join(" and no ")}, so ${empty.length === 1 ? "that place holds" : "those places hold"} 0.`
            : "Every place has a digit.",
          `The decimal is ${answer}.`,
        ],
        answer,
        label: "Decimal",
      };
    }
    case "round-decimal": {
      const target = r(0, 2); // 0 whole, 1 tenth, 2 hundredth
      let n: number;
      do n = r(1, 9999);
      while (n % 10 ** (3 - target) === 0 || (target === 2 && n % 10 === 0));
      const text = decimal(n, 3);
      const unit = 10 ** (3 - target);
      const low = Math.floor(n / unit) * unit,
        high = low + unit,
        half = low + unit / 2;
      const up = n >= half;
      const answer = decimal(up ? high : low, 3);
      const name = ["whole number", "tenth", "hundredth"][target]!;
      return {
        prompt: `Round ${text} to the nearest ${name}.`,
        hint: `To round ${text} to the nearest ${name}, look at the ${PLACE[target + 1]} digit, just to its right: five or more rounds up, four or less rounds down.`,
        explanation: [
          `${text} lies between ${decimal(low, 3)} and ${decimal(high, 3)}.`,
          n === half
            ? `It is exactly halfway, at ${decimal(half, 3)}. By convention, halfway rounds up.`
            : `The halfway point is ${decimal(half, 3)}. ${text} is ${up ? "above" : "below"} it, so it is closer to ${answer}.`,
          `${text} rounded to the nearest ${name} is ${answer}.`,
        ],
        answer,
        label: "Rounded number",
      };
    }
    case "multidigit-decimal-sum": {
      const pa = r(1, 3),
        pb = r(1, 3);
      let a = r(10 ** pa, 999 * 10 ** pa),
        b = r(10 ** pb, 999 * 10 ** pb);
      if (a % 10 === 0) a += 1;
      if (b % 10 === 0) b += 1;
      const p = Math.max(pa, pb);
      const A = a * 10 ** (p - pa),
        B = b * 10 ** (p - pb);
      // Equal values would make a difference of 0; draw again.
      if (A === B) return draft(templateId, r);
      const subtract = r(0, 1) === 1;
      const [x, y, X, Y, px, py] =
        subtract && A < B ? [b, a, B, A, pb, pa] : [a, b, A, B, pa, pb];
      const op = subtract ? "−" : "+";
      const result = subtract ? X - Y : X + Y;
      const answer = decimal(result, p);
      const sx = fixed(x, px),
        sy = fixed(y, py);
      const pad = [
        px < p ? `${sx} = ${fixed(X, p)}` : "",
        py < p ? `${sy} = ${fixed(Y, p)}` : "",
      ].filter(Boolean);
      return {
        prompt: `What is ${sx} ${op} ${sy}?`,
        hint: `Line up ${sx} and ${sy} by the decimal point${pad.length ? ` and fill empty places with zeros: ${pad.join(" and ")}` : ""}. Then ${subtract ? "subtract" : "add"} place by place from the right.`,
        explanation: [
          pad.length
            ? `Line up the decimal points and fill empty places with zeros: ${pad.join(" and ")}.`
            : "Line up the decimal points; both numbers have the same places.",
          `${fixed(X, p)} ${op} ${fixed(Y, p)} = ${fixed(result, p)}${fixed(result, p) === answer ? "" : ` = ${answer}`}, regrouping between places as with whole numbers.`,
          subtract
            ? `Check by adding back: ${answer} + ${sy} = ${sx}.`
            : `Check by subtracting: ${answer} − ${sy} = ${sx}.`,
        ],
        answer,
        label: "Decimal",
      };
    }
    case "multidigit-decimal-product": {
      const pa = r(1, 2),
        pb = r(1, 2);
      let a = r(11, 999),
        b = r(11, pb === 1 ? 99 : 999);
      if (a % 10 === 0) a += 1;
      if (b % 10 === 0) b += 1;
      const sa = fixed(a, pa),
        sb = fixed(b, pb);
      const product = a * b,
        p = pa + pb;
      const answer = decimal(product, p);
      return {
        prompt: `What is ${sa} × ${sb}?`,
        hint: `Multiply ${a} × ${b} as whole numbers. ${sa} and ${sb} have ${pa + pb} decimal places between them, so the product needs that many.`,
        explanation: [
          `Multiply the whole numbers: ${a} × ${b} = ${product}.`,
          `${sa} has ${count(pa, "decimal place", "decimal places")} and ${sb} has ${pb}, so the product has ${p}: ${fixed(product, p)}${fixed(product, p) === answer ? "" : ` = ${answer}`}.`,
          `This works because ${sa} = ${a}/${10 ** pa} and ${sb} = ${b}/${10 ** pb}, so the product is ${product}/${10 ** p}.`,
        ],
        answer,
        label: "Decimal",
      };
    }
    case "multidigit-decimal-quotient": {
      const pd = r(1, 2);
      let d = r(2, pd === 1 ? 99 : 199);
      if (d % 10 === 0) d += 1;
      const pq = r(0, 2);
      let q = r(pq ? 11 : 2, pq ? 999 : 99);
      if (pq && q % 10 === 0) q += 1;
      const dividend = d * q,
        pn = pd + pq;
      const sd = fixed(d, pd),
        sn = decimal(dividend, pn);
      const answer = decimal(q, pq);
      const scale = 10 ** pd;
      // Dividend times the same power of ten, still exact.
      const scaled = decimal(dividend, pq);
      return {
        prompt: `What is ${sn} ÷ ${sd}?`,
        hint: `Make the divisor whole: multiply both ${sn} and ${sd} by ${scale}. The quotient stays the same; then divide by ${d}.`,
        explanation: [
          `Multiply both numbers by ${scale}: ${sn} ÷ ${sd} = ${scaled} ÷ ${d}. Scaling both by the same number keeps the quotient.`,
          `Divide: ${scaled} ÷ ${d} = ${answer}.`,
          `Check: ${answer} × ${sd} = ${sn}.`,
        ],
        answer,
        label: "Decimal",
      };
    }
  }
  throw new Error(`Unknown decimal template: ${templateId}`);
}

export function generateDecimalProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = decimalTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown decimal template: ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const d = draft(templateId, random(templateId, seed));
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([templateId, 1, seed]))
        .digest("hex"),
      templateId,
      templateVersion: 1,
      seed,
      prompt: d.prompt,
      skillId: meta.skillId,
      response: { kind: "number", label: d.label },
      ...(d.figure ? { figure: d.figure } : {}),
    },
    answer: d.answer,
    explanation: d.explanation,
    hint: d.hint,
  };
}
