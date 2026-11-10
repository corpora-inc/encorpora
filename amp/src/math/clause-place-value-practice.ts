import { count, count as agreeCount, isAre, nounFor } from "./agreement";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { numberWords } from "./staar-gap-practice";
import { array, numberLine, scene } from "./scene/author";
import type { Element } from "./scene/spec";
import {
  blockFigure,
  choice,
  dec,
  numericField,
  numericSlot,
  parts,
  pick,
  problem,
  shuffle,
  symbol,
  work,
  type Context,
  type Teaching,
} from "./clause-support";

export const placeClauseFamilies: Record<string, readonly string[]> = {
  "continue-count-to-120": ["count-full-range"],
  "tens-ones-model": ["teen-as-ten-and-ones", "whole-tens-as-tens"],
  "two-digit-symbol": ["symbol-and-place-value-reason"],
  "ten-more-or-less": ["ten-more-less-with-reason"],
  "subtract-whole-tens": ["tens-model-to-equation"],
  "place-value-digit": ["round-hundred-as-hundreds"],
  "expanded-form-missing": ["expanded-form-full"],
  "three-digit-symbol": ["symbol-and-place-value-reason-3d"],
  "mental-ten-hundred": ["mental-boundaries"],
  "conversion-chain-story": ["mass-volume-story"],
  "measurement-line-fraction-story": ["plot-measure-total"],
  "decimal-grid-read": ["length-as-decimal-meters"],
  "compare-decimals-symbol-blanks": [
    "compare-with-grid-justification",
    "same-whole-validity",
  ],
  "multiply-power-of-ten": ["power-of-ten-pattern-reason"],
  "compare-decimals-thousandths": ["thousandths-symbol-blank"],
  "decimal-multiplication": ["decimal-division-hundredths"],
  "multidigit-decimal-product": ["algorithm-steps"],
  "multidigit-decimal-quotient": ["algorithm-steps"],
  "multidigit-decimal-sum": ["algorithm-steps"],
  "teen-frame-compose": ["teen-equation-record", "teen-decompose-picture"],
};

export const numberNamesTemplate: TemplateMetadata = {
  id: "three-digit-number-names",
  version: 1,
  title: "Read and write three-digit number names",
  skillId: "hundreds-place-value",
  gradeBand: "K–2",
  requiredResponseCapability: "single-choice-v1",
  requiredResponseCapabilities: ["single-choice-v1"],
  hasNumericVariants: true,
  description:
    "Match a three-digit numeral to its number name, or write a numeral from words, including zeros and teens.",
};

function teaching(
  prompt: string,
  hint: string,
  explanation: string[],
  figure?: Teaching["figure"],
): Teaching {
  return { prompt, hint, explanation, ...(figure ? { figure } : {}) };
}
const digits = (n: number) => [
  Math.floor(n / 100),
  Math.floor(n / 10) % 10,
  n % 10,
];
const tex = (s: string | number) => `$${s}$`;

function hundredGrids(a: number, b: number) {
  const elements: Element[] = [];
  [a, b].forEach((value, index) => {
    const x = index * 13,
      columns = Math.floor(value / 10),
      extra = value % 10;
    if (columns)
      elements.push({
        type: "rect",
        at: [x, 0],
        size: [columns, 10],
        fill: "accent-fill",
      });
    if (extra)
      elements.push({
        type: "rect",
        at: [x + columns, 10 - extra],
        size: [1, extra],
        fill: "accent-fill",
      });
    for (let k = 0; k <= 10; k++)
      elements.push(
        { type: "segment", from: [x + k, 0], to: [x + k, 10], stroke: "ink" },
        { type: "segment", from: [x, k], to: [x + 10, k], stroke: "ink" },
      );
    elements.push({ type: "text", at: [x + 5, -1], text: dec(value) });
  });
  return scene(...elements).build({ width: 360 });
}

export function numberNames(c: Context): GeneratedProblem {
  const mode = c.r(0, 9),
    h = c.r(1, 9);
  const n =
    h * 100 +
    (mode < 2
      ? c.r(0, 9)
      : mode < 4
        ? c.r(0, 9) * 10
        : mode < 6
          ? c.r(11, 19)
          : c.r(0, 99));
  const name = numberWords(n),
    [hundreds, tens, ones] = digits(n),
    askName = c.r(0, 1) === 1;
  const t = teaching(
    askName ? `Which number name means ${n}?` : `Write ${name} as a numeral.`,
    askName
      ? `${n} has ${agreeCount(hundreds, "hundred")}, ${agreeCount(tens, "ten")} and ${agreeCount(ones, "one")}. Match those groups to the number name.`
      : `The number name is ${name}. Keep a place for the hundreds, the tens and the ones, including a zero when a place is empty.`,
    [
      `${n} has ${count(hundreds, "hundred")}, ${count(tens, "ten")} and ${count(ones, "one")}.`,
      `${tex(`${n}=${hundreds * 100}+${n % 100}`)}. Its number name is ${name}.`,
      "A zero keeps a place when there are no tens or no extra ones.",
    ],
  );
  if (t.prompt.startsWith("Write")) return problem(c, t, n);
  const alternatives = [
    hundreds * 100 + ones * 10 + tens,
    hundreds * 100 + tens * 10,
    hundreds * 100 + ones * 10,
    hundreds * 10 + ones,
    ((hundreds % 9) + 1) * 100 + (n % 100),
    (((hundreds + 1) % 9) + 1) * 100 + (n % 100),
  ];
  return choice(
    c,
    t,
    name,
    [
      ...new Set(alternatives.filter((x) => x !== n && x > 0).map(numberWords)),
    ].slice(0, 3),
  );
}

export function generatePlaceClause(c: Context): GeneratedProblem {
  const { r, family, meta } = c;
  if (meta.id === "three-digit-number-names") return numberNames(c);
  if (family === "count-full-range") {
    const draw = r(0, 9);
    const start =
      draw < 4
        ? pick(r, [7, 17, 27, 37, 47, 57, 67, 77, 87, 97, 107, 117])
        : draw < 7
          ? r(97, 117)
          : r(0, 117);
    return problem(
      c,
      teaching(
        `Count on: ${start}, ${start + 1}, ${start + 2}, □. What comes next?`,
        `Start at ${start + 2} and add one. When the ones reach ten, make a new ten.`,
        [
          `The numbers go up by one each time.`,
          `${start + 2} plus one is ${start + 3}.`,
          "Ten ones make a ten, and ten tens make a hundred.",
        ],
      ),
      start + 3,
    );
  }
  if (
    family === "teen-as-ten-and-ones" ||
    family === "whole-tens-as-tens" ||
    family === "round-hundred-as-hundreds"
  ) {
    const teen = family === "teen-as-ten-and-ones",
      hundred = family === "round-hundred-as-hundreds";
    const d = r(1, 9),
      n = teen ? 10 + d : d * (hundred ? 100 : 10),
      mode = r(0, teen ? 1 : 2);
    const [h, tens, ones] = digits(n),
      groups = hundred ? h : tens;
    const t = teaching(
      mode === 1 && !teen
        ? `What number is ${count(d, hundred ? "hundred" : "ten")}, ${hundred ? "0 tens and " : ""}0 ones?`
        : mode === 1 || (mode === 0 && !teen)
          ? `${n} has which digits in its ${hundred ? "hundreds, tens and ones" : "tens and ones"} places?`
          : `Read the model. Fill the ${hundred ? "hundreds, tens and ones" : "tens and ones"} digits${(mode === 0 && teen) || mode === 2 ? " and the number" : ""}.`,
      `A ${hundred ? "hundred" : "ten"} is a group of ${hundred ? "ten tens" : "ten ones"}. Count the ${agreeCount(d, hundred ? "hundred" : "ten")} in this problem, then count any extra ones separately.`,
      [
        `${n} means ${hundred ? `${count(h, "hundred")}, ` : ""}${count(tens, "ten")} and ${count(ones, "one")}.`,
        `${tex(`${n}=${h * 100}+${tens * 10}+${ones}`)}. A digit counts groups of its place value.`,
      ],
    );
    if (mode === 2 || (mode === 0 && teen)) t.figure = blockFigure(n);
    if (mode === 1 && !teen) return problem(c, t, n);
    const slots = [
      ...(hundred
        ? [numericSlot("hundreds", "Hundreds digit", h, [n, h * 10])]
        : []),
      numericSlot("tens", "Tens digit", tens, [teen ? d : 0, groups * 10, n]),
      numericSlot("ones", "Ones digit", ones, [teen ? n : d, 10, teen ? 1 : n]),
      ...((mode === 0 && teen) || mode === 2
        ? [numericSlot("number", "Number", n, [d, d * 100, Number(`10${d}`)])]
        : []),
    ];
    return parts(c, t, slots);
  }
  if (family.startsWith("symbol-and-place-value-reason")) {
    const three = meta.id === "three-digit-symbol",
      mode = r(0, 19),
      equal = mode < (three ? 4 : 5);
    const place = three
      ? mode < 11
        ? 2
        : mode < 17
          ? 1
          : 0
      : mode < 13
        ? 1
        : 0;
    const prefix =
      three && place < 2
        ? r(1, 9) * 100 + (place === 0 ? r(0, 9) * 10 : 0)
        : !three && place === 0
          ? r(1, 9) * 10
          : 0;
    const scale = 10 ** place,
      low = r(place === (three ? 2 : 1) ? 1 : 0, 7),
      high = r(low + 1, 9);
    let a = prefix + low * scale + (place ? scale - 1 : 0),
      b = prefix + high * scale;
    if (equal) a = b = r(three ? 100 : 10, three ? 999 : 99);
    else if (r(0, 1)) [a, b] = [b, a];
    const s = symbol(a, b),
      name = ["ones", "tens", "hundreds"][place]!;
    const da = Math.floor(a / scale) % 10,
      db = Math.floor(b / scale) % 10;
    const bText = equal
      ? three
        ? `${count(Math.floor(b / 100), "hundred")}, ${count(Math.floor(b / 10) % 10, "ten")} and ${count(b % 10, "one")}`
        : `${count(Math.floor(b / 10), "ten")} and ${count(b % 10, "one")}`
      : String(b);
    const reason = equal
      ? "All corresponding place digits match, so the numbers are equal."
      : `The first different place is ${name}: ${da} ${s} ${db}.`;
    const opposite = s === ">" ? "<" : ">";
    const wrong = equal
      ? [
          "Different ways of writing a number must have different values.",
          "The number written with more words must be greater.",
          "A number written in digits must be greater.",
        ]
      : [
          place
            ? `Compare the ones first: ${a % 10} ${opposite} ${b % 10}.`
            : "Stop before comparing the ones; the numbers are equal.",
          `Both have ${three ? "three" : "two"} digits, so they are equal.`,
          `Read the order backward: ${a} ${opposite} ${b}.`,
        ];
    return parts(
      c,
      teaching(
        `${a} □ ${bText}. Choose the symbol and the place-value reason.`,
        `Compare ${a} with ${b}. Start at the largest place.`,
        [
          `Compare hundreds before tens, and tens before ones.`,
          reason,
          `${tex(`${a}${s}${b}`)}.`,
        ],
      ),
      [
        {
          id: "symbol",
          label: "Comparison",
          correct: tex(s),
          fixed: [tex("<"), tex("="), tex(">")],
        },
        { id: "reason", label: "Reason", correct: reason, wrong },
      ],
    );
  }
  if (family === "ten-more-less-with-reason") {
    const more = !!r(0, 1),
      boundary = r(0, 9) < 3;
    const n = boundary
      ? r(more ? 1 : 2, more ? 8 : 9) * 10 + pick(r, [0, 9])
      : r(more ? 10 : 20, more ? 89 : 99);
    const sign = more ? 1 : -1,
      ans = n + sign * 10,
      tens = Math.floor(n / 10);
    const reason = `${more ? "Add" : "Remove"} one ten; ${count(tens, "ten")} becomes ${tens + sign}. Keep ${count(n % 10, "one")}.`;
    const t = teaching(
      `What is 10 ${more ? "more" : "less"} than ${n}? Choose the answer and why.`,
      `Picture ${n} as rods of ten and separate ones. Change one rod.`,
      [
        `${n} has ${count(tens, "ten")} and ${count(n % 10, "one")}.`,
        reason,
        `${tex(`${n}${more ? "+" : "-"}10=${ans}`)}.`,
      ],
    );
    t.figure = blockFigure(n);
    return parts(c, t, [
      numericSlot("value", "Number", ans, [n + sign, n + sign * 11, n]),
      {
        id: "reason",
        label: "Reason",
        correct: reason,
        wrong: [
          "Change the ones by one; keep the tens.",
          "Change both digits by one.",
          "Keep the number unchanged.",
        ],
      },
    ]);
  }
  if (family === "tens-model-to-equation") {
    const a = r(1, 9),
      b = r(0, 19) === 0 ? 0 : r(1, a),
      left = a - b;
    const relation = r(0, 2) === 0;
    const equation = tex(`${a * 10}-${b * 10}=${left * 10}`),
      reason = `Each rod is ten. Remove ${count(b, "ten")}; ${count(left, "ten")} ${left === 1 ? "is" : "are"} left.`;
    const t = teaching(
      relation
        ? `${tex(`${b * 10}+\\square=${a * 10}`)}. Choose the matching take-away equation and its reason.`
        : `The model shows ${count(a, "rod")} of ten. Take away ${count(b, "rod")}. Choose the equation and its reason.`,
      `${count(a, "rod")} ${a === 1 ? "is" : "are"} ${a * 10} ones. Each rod taken away is another ten.`,
      [
        `Count the rods: ${tex(`${a}-${b}=${left}`)} tens.`,
        `${equation}, because each ten contains ten ones.`,
      ],
    );
    const rods: Element[] = [];
    for (let i = 0; i < a; i++) {
      rods.push(array(10, 1, { at: [i * 2, 0] }).element());
      if (i >= a - b)
        rods.push(
          {
            type: "segment",
            from: [i * 2 - 0.2, -0.2],
            to: [i * 2 + 1.2, 10.2],
            stroke: "warm",
            width: 2,
          },
          {
            type: "segment",
            from: [i * 2 - 0.2, 10.2],
            to: [i * 2 + 1.2, -0.2],
            stroke: "warm",
            width: 2,
          },
        );
    }
    t.figure = { kind: "scene", scene: scene(...rods).build() };
    const wrongEq = [
      tex(`${a * 10}-${b}=${a * 10 - b}`),
      tex(`${a}-${b}=${left}`),
      tex(`${a * 10}+${b * 10}=${(a + b) * 10}`),
    ].filter((x) =>
      b !== 0 && left !== 0 ? true : x !== equation && !x.endsWith("=0$"),
    );
    // Ask for the equation of rods measured in ones: a small-count equation is
    // explicitly labeled with its incorrect unit so its arithmetic alone is not a second key.
    return parts(c, t, [
      {
        id: "equation",
        label: "Take away the rods, counted in ones",
        correct: equation,
        wrong:
          b === 0
            ? [
                tex(`${a * 10}-10=${a * 10 - 10}`),
                tex(`${a * 10}+10=${a * 10 + 10}`),
              ]
            : [
                wrongEq[0]!,
                ...(left ? [`${tex(`${a}-${b}=${left}`)} ones`] : []),
                tex(`${a * 10}+${b * 10}=${(a + b) * 10}`),
              ].filter(Boolean),
      },
      {
        id: "reason",
        label: "Reason",
        correct: reason,
        wrong: [
          "Each rod counts as one single one.",
          "Taking rods away means add their values.",
          "A rod contains one hundred ones.",
        ],
      },
    ]);
  }
  if (family === "expanded-form-full") {
    const h = r(1, 9),
      zero = r(0, 9) < 3,
      tens = zero ? 0 : r(1, 9),
      ones = r(0, 9),
      n = h * 100 + tens * 10 + ones;
    const reverse = r(0, 1) === 1,
      values = [h * 100, tens * 10, ones],
      shown = r(0, 1) ? shuffle(r, [...values]) : values;
    const t = teaching(
      reverse
        ? `${tex(`${shown.join("+")}=\\square`)}. Write the numeral.`
        : `Write ${n} in expanded form. Choose the hundreds value, tens value and ones value.`,
      reverse
        ? `Start with the hundreds value ${h * 100} in the sum. Add the tens value and the ones value, and write one numeral.`
        : `In ${n}, multiply each digit by the value of its place.`,
      [
        `The hundreds contribute ${values[0]}, the tens ${values[1]}, and the ones ${values[2]}.`,
        `${tex(`${n}=${values.join("+")}`)}.`,
      ],
    );
    if (reverse) return problem(c, t, n);
    return parts(c, t, [
      numericSlot("hundreds", "Hundreds value", values[0]!, [
        h,
        h * 10,
        h * 1000,
      ]),
      numericSlot("tens", "Tens value", values[1]!, [
        tens ? tens : 10,
        tens ? tens * 100 : 100,
      ]),
      numericSlot("ones", "Ones value", ones, [
        ones ? ones * 10 : 10,
        ones ? ones * 100 : 100,
      ]),
    ]);
  }
  if (family === "mental-boundaries") {
    const op = r(0, 3),
      amount = op < 2 ? 10 : 100,
      add = op % 2 === 0;
    let n = r(100, 900);
    if (amount === 10 && r(0, 9) < 5)
      n = r(1, 8) * 100 + (add ? r(90, 99) : r(0, 9));
    if (amount === 100 && r(0, 9) < 3) n = add ? r(801, 900) : r(100, 199);
    const ans = n + (add ? amount : -amount);
    return problem(
      c,
      teaching(
        `${n} ${add ? "+" : "−"} ${amount} = □.`,
        `Change the ${amount === 10 ? "tens" : "hundreds"} in ${n}; keep the smaller places.`,
        [
          `${amount} is one ${amount === 10 ? "ten" : "hundred"}.`,
          `${tex(`${n}${add ? "+" : "-"}${amount}=${ans}`)}. Regroup if a place crosses ten.`,
        ],
      ),
      ans,
    );
  }
  if (family === "mass-volume-story") {
    const [large, small, factor, object] = pick(r, [
      ["kg", "g", 1000, "bag"],
      ["L", "mL", 1000, "jug"],
      ["lb", "oz", 16, "box"],
      ["gal", "qt", 4, "container"],
      ["qt", "cups", 4, "container"],
    ] as const);
    const op = r(0, 3),
      first = r(1, 5) * factor + r(0, factor - 1),
      second = r(1, first - 1),
      groups = r(2, 6);
    const unitAmount = (n: number, unit: string) =>
      unit === "cups" ? count(n, "cup") : `${n} ${unit}`;
    const mixed = (n: number) =>
      `${unitAmount(Math.floor(n / factor), large)} ${unitAmount(n % factor, small)}`;
    let prompt: string, answer: number, equation: string;
    if (op < 2) {
      answer = op === 0 ? first + second : first - second;
      prompt =
        op === 0
          ? `One ${object} contains ${mixed(first)} and another contains ${mixed(second)}. What is their total in ${small}?`
          : `A ${object} contains ${mixed(first)}. ${unitAmount(second, small)} is removed. How much is left in ${small}?`;
      equation = `${first}${op === 0 ? "+" : "-"}${second}=${answer}`;
    } else if (op === 2) {
      const each = Math.min(first, Math.floor(20000 / groups));
      answer = each * groups;
      prompt = `Each of ${groups} ${object}s contains ${mixed(each)}. What is the total in ${small}?`;
      equation = `${each}\\times${groups}=${answer}`;
    } else {
      const total = Math.ceil(first / groups) * groups;
      answer = total / groups;
      prompt = `${mixed(total)} is shared equally among ${groups} ${object}s. How much goes in each, in ${small}?`;
      equation = `${total}\\div${groups}=${answer}`;
    }
    return problem(
      c,
      teaching(
        `${prompt} Use 1 ${large} = ${factor} ${small}.`,
        `Multiply the larger-unit amount by ${factor}, then add the remaining smaller units.`,
        [
          `Use 1 ${large} = ${factor} ${small} to express every measurement in the same unit.`,
          `${tex(equation)}. The answer is ${unitAmount(answer, small)}.`,
        ],
      ),
      answer,
    );
  }
  if (family === "length-as-decimal-meters") {
    const group = r(0, 9),
      cm = group < 3 ? r(1, 9) : group < 6 ? 10 * r(1, 29) : r(1, 299),
      reverse = r(0, 3) === 0;
    return problem(
      c,
      teaching(
        reverse
          ? `A board is ${dec(cm)} meters long. How many centimeters is that? Use 1 meter = 100 centimeters.`
          : `A ribbon is ${count(cm, "centimeter")} long. Write its length in meters. Use 1 meter = 100 centimeters.`,
        reverse
          ? `The board is ${dec(cm)} ${nounFor(dec(cm), "meter")}. One centimeter is one hundredth of a meter, so multiply ${dec(cm)} by the 100 in the conversion.`
          : `The ribbon is ${agreeCount(cm, "centimeter")}. One centimeter is one hundredth of a meter, so divide ${cm} by the 100 in the conversion.`,
        [
          `${count(cm, "centimeter")} is ${tex(`\\frac{${cm}}{100}`)} meters.`,
          `${tex(`${cm}\\div100=${dec(cm)}`)}. In the other direction, multiply meters by 100.`,
        ],
      ),
      reverse ? cm : dec(cm),
    );
  }
  if (family === "plot-measure-total") {
    const d = pick(r, [2, 4, 8, 10, 12]),
      op = r(0, 2),
      a = r(1, d),
      b = r(1, d),
      unit = pick(r, ["miles", "liters", "hours", "kg"]);
    const n =
      op === 0
        ? a + b
        : op === 1
          ? Math.max(a, b) - Math.min(a, b)
          : r(2, Math.min(6, 3 * d));
    const expression =
      op === 0
        ? `${a}/${d}+${b}/${d}`
        : op === 1
          ? `${Math.max(a, b)}/${d}-${Math.min(a, b)}/${d}`
          : `${n}\\times1/${d}`;
    const singular =
      unit === "miles"
        ? "mile"
        : unit === "liters"
          ? "liter"
          : unit === "hours"
            ? "hour"
            : "kg";
    const context =
      unit === "miles"
        ? "Ava walks"
        : unit === "liters"
          ? "A jug contains"
          : unit === "hours"
            ? "A lesson lasts"
            : "A bag contains";
    const story =
      op === 0
        ? `${context} ${a}/${d} ${singular}${unit === "miles" ? " to the library, then walks" : unit === "hours" ? ", followed by another lesson lasting" : ", and another amount is added:"} ${b}/${d} ${singular}. Find the total.`
        : op === 1
          ? `${context} ${Math.max(a, b)}/${d} ${singular}. ${Math.min(a, b)}/${d} ${singular} ${unit === "miles" ? "is retraced" : unit === "hours" ? "has passed" : "is removed"}. Find the remaining ${unit === "miles" ? "distance from the start" : "amount"}.`
          : `${n} equal ${unit === "miles" ? "walks" : unit === "hours" ? "lessons" : "amounts"} each measure 1/${d} ${singular}. Find their total.`;
    const t = teaching(
      `${story} The calculation is ${tex(expression)} ${unit}. Choose the number line that marks the result. Each whole is one ${singular}.`,
      `Each small step is ${tex(`1/${d}`)} of the unit. Count those equal parts.`,
      [
        `Use parts of size ${tex(`1/${d}`)} throughout the calculation.`,
        `${tex(`${expression}=${n}/${d}`)} ${nounFor(n, singular, unit)}. Mark ${count(n, "step")} from zero.`,
      ],
    );
    const values = shuffle(r, [
      ...new Set([
        n / d,
        n / (2 * d),
        n / d < 3 ? (n + 1) / d : (n - 2) / d,
        n ? Math.max(0, n - 1) / d : 2 / d,
      ]),
    ]);
    const p = problem(c, t, "");
    p.public.response = {
      kind: "figure-choice",
      label: "Choose the marked number line",
      noun: "Number line",
      options: values.map((v, i) => ({
        id: `option-${"abcd"[i]}`,
        label: `A point at ${v} ${unit} on the measurement scale.`,
        scene: numberLine({
          min: 0,
          max: 3,
          denominator: d,
          labels: [0, 1, 2, 3],
        })
          .mark(v, { label: "P" })
          .scene({ width: 280, maxHeight: 180 }),
      })),
    };
    p.answer = `option-${"abcd"[values.indexOf(n / d)]}`;
    p.choiceFeedback = Object.fromEntries(
      values.flatMap((v, i) =>
        v === n / d
          ? []
          : [
              [
                `option-${"abcd"[i]}`,
                v === n / (2 * d) && n > 0
                  ? `Keep the denominator ${d}; adding parts does not double the denominator.`
                  : t.explanation.join(" "),
              ],
            ],
      ),
    );
    return p;
  }
  if (family === "same-whole-validity") {
    const same = !!r(0, 1),
      a = r(2, 9) * 10,
      b = r(1, a - 1);
    return choice(
      c,
      teaching(
        same
          ? `Maya drank ${dec(a)} L and Leo drank ${dec(b)} L. Can we tell who drank more water?`
          : `Maya drank ${dec(a)} of her bottle. Leo drank ${dec(b)} of his jug. The container sizes are unknown. Can we tell who drank more water?`,
        `Check what one whole means before comparing ${dec(a)} and ${dec(b)}.`,
        [
          same
            ? `Both amounts use liters. ${tex(`${dec(a)}>${dec(b)}`)}, so Maya drank more.`
            : "A fraction of a bottle and a fraction of a jug do not name the same whole.",
          same
            ? "The common unit makes the comparison valid."
            : "Without both container sizes, either person could have drunk more.",
        ],
      ),
      same
        ? "Yes. Both use liters, and Maya drank more."
        : "No. The sizes of the bottle and jug are unknown.",
      same
        ? [
            "No. Decimals cannot be compared.",
            "Yes. Leo drank more because his decimal has more digits.",
            "Yes. Both drank the same amount.",
          ]
        : [
            `Yes. Maya drank more because ${dec(a)} > ${dec(b)}.`,
            "Yes. Leo drank more because a jug must hold more water.",
            "Yes. Both drank the same amount.",
          ],
    );
  }
  if (
    family === "compare-with-grid-justification" ||
    family === "thousandths-symbol-blank"
  ) {
    const thousand = family === "thousandths-symbol-blank",
      equal = r(0, 4) === 0;
    let a: number, b: number, aText: string, bText: string, deciding: string;
    if (thousand) {
      const place = r(0, 2),
        step = [100, 10, 1][place]!,
        prefix =
          r(0, 8) * 1000 +
          (place > 0 ? r(0, 8) * 100 : 0) +
          (place > 1 ? r(0, 8) * 10 : 0);
      a = prefix + r(1, 7) * step;
      b = equal ? a : a + step;
      if (r(0, 1)) [a, b] = [b, a];
      aText = dec(a, 3);
      bText = equal ? (b / 1000).toFixed(3) : dec(b, 3);
      deciding = ["tenths", "hundredths", "thousandths"][place]!;
    } else {
      a = r(1, 9) * 10;
      b = equal
        ? a
        : pick(r, [Math.max(1, a - r(1, 9)), Math.min(99, a + r(1, 9))]);
      if (r(0, 1)) [a, b] = [b, a];
      aText = dec(a);
      bText = equal ? (b / 100).toFixed(2) : dec(b);
      deciding = "hundredths";
    }
    const s = symbol(a, b),
      opposite = s === "<" ? ">" : "<";
    const reason = equal
      ? `The same value: ${a} ${thousand ? "thousandths" : "squares"} equals ${b}.`
      : thousand
        ? `Compare the first different place, ${deciding}: ${aText} ${s} ${bText}.`
        : `${aText} shades ${a} squares; ${bText} shades ${b}. ${a} ${s} ${b}.`;
    const t = teaching(
      `${aText} □ ${bText}. Choose the symbol and the reason. Both refer to the same whole.`,
      `Rename ${aText} and ${bText} in equal-sized parts before comparing.`,
      [
        thousand
          ? "Zeros at the end do not change a decimal's value."
          : "Each full column is ten hundredths. Count all shaded squares.",
        reason,
      ],
    );
    if (!thousand) t.figure = { kind: "scene", scene: hundredGrids(a, b) };
    else
      t.figure = {
        kind: "place-value-chart",
        places: 3,
        rows: [aText, bText].map((s) => ({
          ones: Number(s.split(".")[0]),
          decimals: s.split(".")[1] ?? "0",
        })),
      };
    return parts(c, t, [
      {
        id: "symbol",
        label: "Comparison",
        correct: tex(s),
        fixed: [tex("<"), tex("="), tex(">")],
      },
      {
        id: "reason",
        label: "Reason",
        correct: reason,
        wrong: equal
          ? [
              "More written digits always make a decimal greater.",
              "A zero at the end makes a decimal ten times smaller.",
            ]
          : [
              `Read the decimal parts as whole numbers: ${aText} ${opposite} ${bText}.`,
              "Both start with the same whole-number part, so they are equal.",
              `Reverse the place values: ${aText} ${opposite} ${bText}.`,
            ],
      },
    ]);
  }
  if (family === "power-of-ten-pattern-reason") {
    const whole = r(0, 9) < 3,
      multiply = whole || !!r(0, 1),
      exponent = r(1, 3),
      cents = whole ? r(1, 999) * 100 : r(101, 99999) * 1;
    const base = dec(cents),
      answer = dec(
        cents * (multiply ? 10 ** exponent : 1),
        multiply ? 2 : 2 + exponent,
      );
    const reason = whole
      ? `Move digits ${count(exponent, "place")} left; fill empty places with ${count(exponent, "zero")}.`
      : `Each digit becomes ${10 ** exponent} times ${multiply ? "as much; move left" : "smaller; move right"}.`;
    const t = teaching(
      `${tex(`${base}${multiply ? "\\times" : "\\div"}10^{${exponent}}=\\square`)}. Choose the value and its place-value reason.`,
      `One factor of 10 changes every digit's value tenfold. There ${isAre(exponent)} ${count(exponent, "such factor")}.`,
      [
        `${tex(`10^{${exponent}}=${10 ** exponent}`)}.`,
        reason,
        `${tex(`${base}${multiply ? "\\times" : "\\div"}${10 ** exponent}=${answer}`)}.`,
      ],
    );
    const candidates = [
      `${base}${base.includes(".") ? "000" : ".000"}`,
      dec(cents, multiply ? 2 + exponent : 2 - Math.min(exponent, 1)),
      dec(cents * exponent),
      dec(
        cents * (multiply ? 10 ** (exponent - 1) : 10),
        multiply ? 2 : 2 + exponent,
      ),
    ];
    const seen = new Set([Number(answer)]);
    const wrongValues = candidates.filter((s) => {
      const n = Number(s);
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    });
    return parts(c, t, [
      { id: "value", label: "Value", correct: answer, wrong: wrongValues },
      {
        id: "reason",
        label: "Reason",
        correct: reason,
        wrong: [
          ...(!whole
            ? [
                "Append zeros to the decimal without changing any digit's place.",
              ]
            : []),
          `Multiply the number by the exponent ${exponent}.`,
          `Move every digit ${count(exponent, "place")} ${multiply ? "right" : "left"}.`,
        ],
      },
    ]);
  }
  if (family === "decimal-division-hundredths") {
    const wholeDivisor = !!r(0, 1),
      divisorTenths = wholeDivisor ? r(2, 12) * 10 : r(1, 99),
      quotientCents = wholeDivisor
        ? r(1, Math.floor(99990 / divisorTenths))
        : r(1, Math.floor(9999 / divisorTenths)) * 10;
    const dividendCents = (divisorTenths * quotientCents) / 10;
    const a = dec(dividendCents),
      b = dec(divisorTenths, 1),
      q = dec(quotientCents);
    return problem(
      c,
      teaching(
        r(0, 9) < 3
          ? `Fabric costs ${b} dollars per meter. How many meters cost ${a} dollars?`
          : `What is ${tex(`${a}\\div${b}`)}?`,
        `Multiply both ${a} and ${b} by the same power of ten until the divisor is whole.`,
        [
          `Changing both numbers by the same factor preserves the quotient.`,
          `${tex(`${a}\\div${b}=${q}`)}. Check: ${tex(`${b}\\times${q}=${a}`)}.`,
        ],
      ),
      q,
    );
  }
  if (family === "algorithm-steps") return algorithm(c);
  if (family === "model-to-written-method") return modelMethod(c);
  if (
    family === "teen-equation-record" ||
    family === "teen-decompose-picture"
  ) {
    const k = r(1, 9),
      n = 10 + k;
    const t = teaching(
      family === "teen-equation-record"
        ? "Which number sentence tells about the counters?"
        : `${n} is 10 and how many more ones?`,
      `${n} is one ten and some extra ones. The full frame holds 10. Count only the ones past that frame.`,
      [
        `The full frame is ten ones. There ${isAre(k)} ${count(k, "more one")}.`,
        `${tex(`10+${k}=${n}`)}. The number ${n} is one ten and ${count(k, "extra one")}.`,
      ],
    );
    if (family === "teen-decompose-picture") return problem(c, t, k);
    t.figure = { kind: "ten-frame", first: 10, second: k, capacity: 20 };
    if (r(0, 1))
      return parts(
        c,
        {
          ...t,
          prompt: `Complete ${tex(`${n}=\\square+\\square`)} using a ten and extra ones.`,
        },
        [
          numericSlot("ten", "Ten", 10, [1, k, n]),
          numericSlot("ones", "Extra ones", k, [10, n, k === 1 ? 2 : 1]),
        ],
      );
    return choice(c, t, tex(`10+${k}=${n}`), [
      tex(`1+${k}=${k + 1}`),
      tex(`10+${k}=10${k}`),
      k === 1 ? tex("10+10=20") : tex(`${k}+${k}=${2 * k}`),
    ]);
  }
  throw new Error(`Unknown place-value clause ${family}`);
}

/** The same digit columns used by the algorithm, with no worked answers. */
function verticalSetup(
  top: string,
  bottom: string,
  operation: string,
  blanks: string[],
): Teaching["figure"] {
  const elements: Element[] = [];
  const width = Math.max(top.length, bottom.length, 5);
  [top, bottom, ...blanks].forEach((line, row) => {
    [...line.padStart(width)].forEach((text, col) => {
      if (text !== " ")
        elements.push({
          type: "text",
          at: [col, -row * 2],
          text,
          font: "math",
        });
    });
  });
  elements.push(
    { type: "text", at: [-1, -2], text: operation },
    { type: "segment", from: [-1.5, -3], to: [width, -3], stroke: "ink" },
  );
  return {
    kind: "scene",
    scene: scene(...elements).build({ width: 230, maxHeight: 180 }),
  };
}

function algorithm(c: Context): GeneratedProblem {
  const { r, meta } = c;
  if (meta.id === "multidigit-decimal-product") {
    const a = r(101, 899),
      b = r(11, 99),
      places = pick(r, [1, 2]),
      low = b % 10,
      high = Math.floor(b / 10),
      product = a * b;
    const x = (a / 100).toFixed(2),
      y = (b / 10 ** places).toFixed(places);
    return work(
      c,
      teaching(
        `Use the standard multiplication algorithm for ${tex(`${x}\\times${y}`)}. First multiply the digit strings ${a} and ${b}.`,
        `For ${a} times ${b}, the second partial product counts tens, so shift it one place.`,
        [
          `${tex(`${a}\\times${low}=${a * low}`)} and ${tex(`${a}\\times${high * 10}=${a * high * 10}`)}.`,
          `${tex(`${a * low}+${a * high * 10}=${product}`)}.`,
          `There are ${2 + places} decimal places in the two factors together, so the product is ${dec(product, 2 + places)}.`,
        ],
        verticalSetup(String(a), String(b), "×", ["□", "□", "□"]),
      ),
      [
        {
          label: "First partial product",
          fields: [numericField(`${a} times ${low}`, a * low)],
        },
        {
          label: "Shifted second partial product",
          fields: [numericField(`${a} times ${high * 10}`, a * high * 10)],
        },
        {
          label: "Add partial products",
          fields: [numericField("Whole-number product", product)],
        },
        {
          label: "Decimal placement",
          fields: [numericField("Decimal places in both factors", 2 + places)],
        },
        {
          label: "Final product",
          fields: [numericField("Product", dec(product, 2 + places))],
        },
      ],
    );
  }
  if (meta.id === "multidigit-decimal-quotient") {
    const places = pick(r, [1, 2]),
      divisor = r(1, 9) * 10 + r(1, 9),
      quotient = r(11, 99),
      dividend = divisor * quotient,
      scale = 10 ** places;
    const a = (dividend / scale).toFixed(places),
      b = (divisor / scale).toFixed(places);
    const quotientFigure: Teaching["figure"] = {
      kind: "scene",
      scene: scene(
        { type: "text", at: [-2, -2], text: b, font: "math" },
        { type: "text", at: [3, -2], text: a, font: "math" },
        { type: "text", at: [3, 1], text: "□ □", font: "math" },
        { type: "segment", from: [0, -3], to: [0, 0], stroke: "ink" },
        { type: "segment", from: [0, 0], to: [6, 0], stroke: "ink" },
      ).build({ width: 250, maxHeight: 140 }),
    };
    return work(
      c,
      teaching(
        `Use the standard division algorithm for ${tex(`${a}\\div${b}`)}. Use the smallest power of ten that makes the divisor whole, then divide.`,
        `Multiply both ${a} and ${b} by the same power of ten.`,
        [
          `Multiply both numbers by ${scale}: ${tex(`${dividend}\\div${divisor}`)}.`,
          `${divisor} goes into ${dividend} exactly ${quotient} times.`,
          `Check ${tex(`${b}\\times${quotient}=${a}`)}.`,
        ],
        quotientFigure,
      ),
      [
        {
          label: "Make the divisor whole",
          fields: [numericField("Multiply both by", scale)],
        },
        {
          label: "Rewritten division",
          fields: [
            numericField("Dividend", dividend),
            numericField("Divisor", divisor),
          ],
        },
        {
          label: "Quotient digits",
          fields: [
            numericField("Tens digit", Math.floor(quotient / 10)),
            numericField("Ones digit", quotient % 10),
          ],
        },
        {
          label: "Check the remainder",
          fields: [numericField("Remainder", 0)],
        },
        {
          label: "Final quotient",
          fields: [numericField("Quotient", quotient)],
        },
      ],
    );
  }
  const a = r(101, 899),
    b = r(101, 899),
    add = !!r(0, 1),
    hi = Math.max(a, b),
    lo = Math.min(a, b),
    answer = add ? hi + lo : hi - lo;
  const ones = add ? (hi % 10) + (lo % 10) : (hi % 10) - (lo % 10),
    carry = add ? Math.floor(ones / 10) : Number(ones < 0);
  return work(
    c,
    teaching(
      `Use aligned columns to find ${tex(`${dec(hi)}${add ? "+" : "-"}${dec(lo)}`)}.`,
      `Line up the decimal points in ${dec(hi)} and ${dec(lo)}. Start with hundredths.`,
      [
        `Hundredths ${add ? "add" : "subtract"} with hundredths. ${carry ? (add ? "Carry one tenth." : "Exchange one tenth for ten hundredths.") : "No regrouping is needed in the hundredths column."}`,
        `The result is ${dec(answer)}.`,
      ],
      verticalSetup(
        (hi / 100).toFixed(2),
        (lo / 100).toFixed(2),
        add ? "+" : "−",
        [answer >= 1000 ? "□□.□□" : "□.□□"],
      ),
    ),
    [
      {
        label: "Hundredths column",
        fields: [
          numericField("Result digit", (ones + 10) % 10),
          numericField(add ? "Tenths carried" : "Tenths exchanged", carry),
        ],
      },
      {
        label: "Write the result",
        fields: [numericField("Answer", dec(answer))],
      },
    ],
  );
}

function modelMethod(c: Context): GeneratedProblem {
  const { r } = c,
    op = c.seed === "decimal-method-example" ? 0 : r(0, 3);
  let a: string,
    b: string,
    ans: string,
    wrong: string,
    reason: string,
    figure: Teaching["figure"];
  let wholeAnswer: string | undefined;
  if (op < 2) {
    const aTenths =
        c.seed === "decimal-method-example" ? 45 : r(1, 8) * 10 + r(1, 9),
      first = aTenths * 10;
    const bCents =
      c.seed === "decimal-method-example"
        ? 753
        : r(1, Math.floor((op === 1 ? first - 10 : 899) / 10)) * 10 + r(1, 9);
    a = dec(first);
    b = dec(bCents);
    ans = dec(first + (op === 0 ? bCents : -bCents));
    wrong = dec(first / 10 + (op === 0 ? bCents : -bCents));
    wholeAnswer = String(first + (op === 0 ? bCents : -bCents));
    reason =
      "Align decimal points so ones, tenths and hundredths each meet their own place.";
    const elements: Element[] = [];
    ["Ones", "Tenths", "Hundredths"].forEach((text, i) =>
      elements.push({ type: "text", at: [3 + 10 * i, 10], text, font: "sans" }),
    );
    [first, bCents].forEach((v, row) =>
      digits(v).forEach((d, col) =>
        elements.push({
          type: "text",
          at: [3 + 10 * col, 8 - 2 * row],
          text: String(d),
          font: "math",
        }),
      ),
    );
    const setups = shuffle(r, ["aligned", "last-digits", "whole"]);
    setups.forEach((mode, i) => {
      const x = i * 10;
      const top = mode === "whole" ? String(first) : a,
        bottom = mode === "whole" ? String(bCents) : b;
      const topOffset = mode === "last-digits" ? bottom.length - top.length : 0;
      const result =
        mode === "aligned"
          ? ans
          : mode === "last-digits"
            ? wrong
            : wholeAnswer!;
      elements.push({
        type: "text",
        at: [x + 2, 3],
        text: `Method ${"ABC"[i]}`,
        font: "sans",
      });
      [...top].forEach((text, j) =>
        elements.push({
          type: "text",
          at: [x + j + topOffset, 1],
          text,
          font: "math",
        }),
      );
      [...bottom].forEach((text, j) =>
        elements.push({ type: "text", at: [x + j, -1], text, font: "math" }),
      );
      elements.push(
        { type: "text", at: [x - 1, -1], text: op === 0 ? "+" : "−" },
        {
          type: "segment",
          from: [x - 1.5, -2],
          to: [x + 5, -2],
          stroke: "ink",
        },
        { type: "text", at: [x + 2, -3.5], text: result, font: "math" },
      );
    });
    figure = {
      kind: "scene",
      scene: scene(...elements).build({ width: 360, maxHeight: 320 }),
    };
  } else {
    const x = r(1, 9),
      y = r(1, 9);
    a = op === 2 ? dec(x, 1) : dec(x * y);
    b = dec(y, 1);
    ans = op === 2 ? dec(x * y) : dec(x, 1);
    wrong = dec(Math.round(Number(ans) * 1000));
    reason =
      op === 2
        ? "Tenths times tenths make hundredths; keep both decimal places."
        : "Divide both measurements in tenths to find the missing side.";
    figure = {
      kind: "scene",
      scene: scene({
        type: "areaModel",
        across: [x / 10],
        down: [y / 10],
        products: "derived",
        scale: "proportional",
        ...(op === 3 ? { acrossLabels: ["?"] } : {}),
      }).build(),
    };
  }
  const sign = ["+", "-", "\\times", "\\div"][op]!;
  const t = teaching(
    `Which written method matches the model for ${tex(`${a}${sign}${b}`)}? Choose its equation and reason.`,
    `Identify what one whole, one tenth and one hundredth mean in ${a} and ${b}.`,
    [reason, `${tex(`${a}${sign}${b}=${ans}`)}.`],
  );
  t.figure = figure;
  return parts(c, t, [
    {
      id: "method",
      label: "Written method",
      correct: tex(`${a}${sign}${b}=${ans}`),
      wrong: [
        tex(`${a}${sign}${b}=${wrong}`),
        tex(`${a}${sign}${b}=${wholeAnswer ?? Math.round(Number(ans) * 100)}`),
        ...(!wholeAnswer
          ? [tex(`${a}${sign}${b}=${dec(Math.round(Number(ans) * 100), 3)}`)]
          : []),
      ].filter((x) => x !== tex(`${a}${sign}${b}=${ans}`)),
    },
    {
      id: "reason",
      label: "Reason",
      correct: reason,
      wrong: [
        "Align the last written digits, regardless of their places.",
        "Ignore decimal points and use the whole-number answer.",
        "The operation never changes the first number.",
      ],
    },
  ]);
}
