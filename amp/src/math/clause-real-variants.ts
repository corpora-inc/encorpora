import {
  choice,
  figures,
  fraction,
  fracTex,
  gcd,
  math,
  numeric,
  parts,
  pick,
  shuffled,
  type Item,
  type Rng,
} from "./clause-kit";
import { numberLine, scene } from "./scene/author";
import type { WorkRow, FieldRule } from "./structured-work";

function equation(r: Rng): Item {
  const cube = r(0, 9) < 7,
    index = cube ? 3 : 2,
    domain = r(0, 3);
  const n = r(1, cube ? 10 : 12),
    d = domain === 1 ? r(2, 9) : domain === 2 ? 10 : 1;
  const irrational = cube && domain === 3 && r(0, 3) === 0;
  const p = irrational ? pick(r, [2, 3, 5, 6, 7, 9, 10, 11]) : n ** index;
  const radicand = fracTex(p, d ** index),
    root = irrational
      ? `\\sqrt[3]{${p}}`
      : domain === 2
        ? String(n / d)
        : fracTex(n, d);
  const correct = cube ? `x=${root}` : `x=${root}\\text{ or }x=-${root}`;
  const wrong = cube
    ? [`x=${root}\\text{ or }x=-${root}`, `x=-${root}`, `x=0`]
    : [`x=${root}`, `x=-${root}`, `x=0`];
  return {
    prompt: `Find all real solutions of $x^{${index}}=${domain === 2 ? (p / d ** index).toFixed(index) : radicand}$.`,
    ...choice(r, math(correct), wrong.map(math)),
    hint: `A solution must give $${radicand}$ when ${cube ? "cubed" : "squared"}. Check whether changing its sign keeps that power positive.`,
    explanation: [
      cube
        ? `Cubing a negative number gives a negative result, so it cannot give the positive value $${radicand}$.`
        : `Squaring either sign gives the same positive value: $(${root})^2=(-${root})^2=${radicand}$.`,
      cube
        ? `There is exactly one real solution: $${correct}$.`
        : `Both solutions are needed: $${correct}$.`,
    ],
  };
}
function exactRoot(r: Rng): Item {
  const index = pick(r, [2, 3] as const),
    n = r(1, index === 2 ? 15 : 10),
    d = pick(r, [1, 1, 2, 4, 5, 10]),
    decimal = d === 10;
  const p = n ** index,
    q = d ** index,
    radicand = decimal ? String(p / q) : fracTex(p, q),
    root = index === 2 ? `\\sqrt{${radicand}}` : `\\sqrt[3]{${radicand}}`;
  return {
    prompt: `Evaluate $${root}$. Give an exact fraction or decimal.`,
    ...numeric(fraction(n, d)),
    hint: `Find a number whose ${index === 2 ? "square" : "cube"} is $${radicand}$. Root both the numerator and denominator of a fraction.`,
    explanation: [
      `$(${fracTex(n, d)})^{${index}}=${radicand}$, so $${root}=${fracTex(n, d)}$.`,
      `A root asks which value gives the radicand under the stated power. It does not divide the radicand by ${index}.`,
    ],
  };
}
function classify(r: Rng, variant: string): Item {
  if (variant === "decimal-remainder-reason")
    return decimalDivision(r, pick(r, [2, 3]));
  if (variant === "decimal-expansion") {
    const irrational = pick(r, ["\\sqrt{10}", "\\pi", "\\sqrt{2}"]),
      labels = [
        "terminates",
        "repeats forever",
        "goes on forever without repeating",
      ];
    return {
      prompt: "Classify the decimal expansion of each number.",
      ...parts(r, [
        { label: "$7/8$", correct: labels[0]!, wrong: labels.slice(1) },
        {
          label: "$5/11$",
          correct: labels[1]!,
          wrong: [labels[0]!, labels[2]!],
        },
        {
          label: math(irrational),
          correct: labels[2]!,
          wrong: labels.slice(0, 2),
        },
      ]),
      hint: "Divide 7 by 8 and 5 by 11. A fraction's decimal either ends or repeats; an irrational number's decimal does neither.",
      explanation: [
        `$7/8=0.875$ terminates; $5/11=0.\\overline{45}$ repeats forever.`,
        `$${irrational}$ is irrational, so its decimal continues forever without a repeating block. Every real number has a decimal expansion.`,
      ],
    };
  }
  const statement = r(0, 1) === 0;
  return {
    prompt: statement
      ? "Which statement about $\\sqrt{2}$ is true?"
      : "Which number is irrational?",
    ...(statement
      ? choice(
          r,
          "$\\sqrt{2}$ is irrational: its decimal never ends or repeats.",
          [
            "$\\sqrt{2}=1.414$, a terminating decimal.",
            "$\\sqrt{2}=7/5$, because $1.4^2$ is close to 2.",
            "$\\sqrt{2}$ is rational because 2 is a whole number.",
          ],
        )
      : choice(r, math("\\sqrt{2}"), [math("\\sqrt{4}"), "1.5", math("22/7")])),
    figure: {
      kind: "scene",
      scene: scene(
        {
          type: "polygon",
          points: [
            [0, 1],
            [1, 0],
            [2, 1],
            [1, 2],
          ],
          fill: "accent-fill",
          stroke: "accent",
        },
        { type: "text", at: [1, 1], text: "area 2" },
        { type: "segment", from: [0, 0], to: [2, 0] },
        { type: "segment", from: [0, 0], to: [0, 2] },
      ).build(),
    },
    hint: "A rational number is an exact ratio of integers. A rounded calculator value is not the exact square root of 2.",
    explanation: [
      `$\\sqrt{2}$ is the side length of a square with area 2. Its decimal $1.41421\\ldots$ never ends or repeats.`,
      `$1.4^2=1.96<2<2.25=1.5^2$. No tenth squares to 2; in fact, no fraction of integers does.`,
      `$7/5$ is only an approximation: $(7/5)^2=49/25\\ne2$. Also, $22/7$ is rational because it is a ratio of integers.`,
    ],
  };
}
function locate(r: Rng): Item {
  const index = r(0, 3) === 0 ? 3 : 2;
  let n: number;
  do n = r(2, 150);
  while (Number.isInteger(index === 2 ? Math.sqrt(n) : Math.cbrt(n)));
  const value = index === 2 ? Math.sqrt(n) : Math.cbrt(n),
    k = Math.floor(value),
    rounded = Math.round(value * 10) / 10;
  const candidates = [
    rounded,
    rounded + 1,
    rounded - 1,
    k + (rounded - k < 0.5 ? 0.8 : 0.2),
  ];
  const options = candidates.map((at) => ({
    label: `Number line from ${k - 1} to ${k + 2} with a point at ${at.toFixed(1)}.`,
    scene: numberLine({
      min: k - 1,
      max: k + 2,
      step: 0.1,
      labels: [k - 1, k, k + 1, k + 2],
      marks: [{ at, label: at.toFixed(1) }],
    }).scene({ width: 270, maxHeight: 180 }),
  }));
  const root = index === 2 ? `\\sqrt{${n}}` : `\\sqrt[3]{${n}}`;
  return {
    prompt: `Which number line places $${root}$ at the nearest tenth?`,
    ...figures(r, options[0]!, options.slice(1)),
    hint: `Compare ${n} with neighboring perfect ${index === 2 ? "squares" : "cubes"}, then test tenths between their roots.`,
    explanation: [
      `$${k}^{${index}}=${k ** index}<${n}<${(k + 1) ** index}=(${k + 1})^{${index}}$, so the root is between ${k} and ${k + 1}.`,
      `The root is approximately ${value.toFixed(5)}. Its nearest tenth is ${rounded.toFixed(1)}.`,
    ],
  };
}
function narrow(r: Rng): Item {
  const n = pick(
    r,
    [2, 3, 5, 6, 7, 10, 11, 13, 17, 19, 20, 29, 31, 47, 51, 73, 99],
  );
  const lower = (scale: number) => {
    let x = 0;
    while ((x + 1) ** 2 < n * scale ** 2) x++;
    return x / scale;
  };
  const one = lower(1),
    tenth = lower(10),
    hundredth = lower(100),
    method = r(0, 1) === 0;
  return {
    prompt: method
      ? `$\\sqrt{${n}}$ is between ${tenth.toFixed(1)} and ${(tenth + 0.1).toFixed(1)}. What should you do next to get a better approximation?`
      : `Choose the whole-number, tenth, and hundredth bounds for $\\sqrt{${n}}$.`,
    ...(method
      ? choice(
          r,
          "Square neighboring hundredths in this interval until their squares lie on opposite sides of the radicand.",
          [
            `Take the midpoint, ${(tenth + 0.05).toFixed(2)}; it is the exact root.`,
            `Write ${tenth.toFixed(2)} and ${(tenth + 0.1).toFixed(2)}; extra zero digits narrow the interval.`,
            "An irrational number cannot be approximated more closely than a tenth.",
          ],
        )
      : parts(
          r,
          [1, 10, 100].map((scale) => {
            const low = lower(scale);
            return {
              label:
                scale === 1
                  ? "Whole numbers"
                  : scale === 10
                    ? "Tenths"
                    : "Hundredths",
              correct: `${low.toFixed(scale === 1 ? 0 : scale === 10 ? 1 : 2)} and ${(low + 1 / scale).toFixed(scale === 1 ? 0 : scale === 10 ? 1 : 2)}`,
              wrong: [
                `${(low - 1 / scale).toFixed(2)} and ${low.toFixed(2)}`,
                `${(low + 1 / scale).toFixed(2)} and ${(low + 2 / scale).toFixed(2)}`,
              ],
            };
          }),
        )),
    hint: `Keep the interval containing the root of ${n}. Test the next decimal place by squaring its endpoints.`,
    explanation: [
      `Whole-number bounds: ${one} and ${one + 1}. Tenth bounds: ${tenth.toFixed(1)} and ${(tenth + 0.1).toFixed(1)}.`,
      `Hundredth bounds: ${hundredth.toFixed(2)} and ${(hundredth + 0.01).toFixed(2)}, because $${hundredth.toFixed(2)}^2=${(hundredth ** 2).toFixed(4)}<${n}<${((hundredth + 0.01) ** 2).toFixed(4)}=${(hundredth + 0.01).toFixed(2)}^2$.`,
      `Each step preserves the bounds already found and tests the next place. More digits give a better approximation only when the interval gets smaller.`,
    ],
  };
}
function closure(r: Rng, variant: string): Item {
  if (variant === "explain-closure") {
    const product = r(0, 1) === 0,
      general = r(0, 3) === 0,
      a = r(1, 7),
      b = r(a + 1, 12),
      c = r(1, 7),
      d = r(c + 1, 12),
      n = product ? a * c : a * d + c * b,
      den = product ? b * d : b * d;
    const result = fracTex(n, den),
      operation = product ? "\\cdot" : "+";
    return {
      prompt: general
        ? `For integers $a,b,c,d$ with $b,d\\ne0$, why is $a/b ${operation} c/d$ rational?`
        : `Why is $${fracTex(a, b)} ${operation} ${fracTex(c, d)}$ rational?`,
      ...choice(
        r,
        general
          ? `It equals $(${product ? "ac" : "ad+bc"})/(bd)$; numerator and denominator are integers and $bd\\ne0$.`
          : `It equals $${result}$, a ratio of two integers with a nonzero denominator.`,
        [
          "Because both original numbers must be less than 1.",
          "Because any decimal that continues forever is rational.",
          "It is not rational unless the result is a whole number.",
        ],
      ),
      hint: general
        ? "Write the result as a single fraction. Check that its denominator cannot be 0."
        : `Combine $${fracTex(a, b)}$ and $${fracTex(c, d)}$ into one fraction. Rational means a ratio of integers.`,
      explanation: [
        general
          ? `$a/b ${operation} c/d=(${product ? "ac" : "ad+bc"})/(bd)$. Integers are closed under addition and multiplication, and a product of nonzero integers is nonzero.`
          : `$${fracTex(a, b)} ${operation} ${fracTex(c, d)}=${result}$. This is a ratio of integers, whether or not its value is a whole number.`,
        `A rational number can be written as one integer divided by a nonzero integer.`,
      ],
    };
  }
  const zero = r(0, 4) === 0,
    k = pick(r, [2, 3, -2, -3]),
    den = pick(r, [1, 1, 2, 3]),
    irr = pick(r, [
      "\\sqrt{2}",
      "\\sqrt{3}",
      "\\sqrt{5}",
      "\\sqrt{6}",
      "\\sqrt{7}",
      "\\sqrt{10}",
      "\\pi",
    ]),
    sum = r(0, 3) === 0,
    coef = fracTex(k, den);
  if (zero)
    return {
      prompt:
        "Why must the rational factor be nonzero when proving that its product with an irrational number is irrational?",
      ...choice(
        r,
        "Multiplication by 0 gives 0, which is rational, and dividing by 0 cannot undo it.",
        [
          "Zero is irrational.",
          "Every product with a negative rational number is rational.",
          "Multiplying by 0 leaves the irrational number unchanged.",
        ],
      ),
      hint: "Try the excluded factor: what is $0\\times\\sqrt{2}$? Can division by 0 undo that multiplication?",
      explanation: [
        `$0\\times\\sqrt{2}=0$, a rational number. The undoing argument requires division by a nonzero rational factor.`,
      ],
    };
  const result = sum ? `${irr}+(${coef})` : `(${coef})${irr}`,
    undo = sum ? `\\frac{${den}a-(${k})b}{${den}b}` : `\\frac{${den}a}{${k}b}`;
  return {
    prompt: `Suppose $${result}=a/b$ for integers $a,b$ with $b\\ne0$. Which step shows this is impossible?`,
    ...choice(
      r,
      `Then $${irr}=${undo}$, a ratio of integers, contradicting its irrationality.`,
      [
        `Then $${coef}$ would be irrational.`,
        `A rational square guarantees the original number is rational.`,
        `Undo the ${sum ? "addition by multiplying" : "multiplication by subtracting"} $${coef}$ instead.`,
      ],
    ),
    hint: `Undo the ${sum ? "addition" : "multiplication"} by $${coef}$. What would that imply about $${irr}$?`,
    explanation: [
      `If the assumed value were rational, ${sum ? "subtracting" : "dividing by"} the rational number $${coef}$ would leave a rational number.`,
      `That gives $${irr}=${undo}$, impossible because $${irr}$ is irrational. ${sum ? "A rational shift" : "A nonzero rational factor"} cannot make it rational.`,
    ],
  };
}

export function realClause(id: string, variant: string, r: Rng): Item {
  switch (id) {
    case "solve-square-cube-equation":
      return equation(r);
    case "root-between-integers":
      return exactRoot(r);
    case "classify-real-number":
      return classify(r, variant);
    case "root-approximation-select":
      return locate(r);
    case "root-nearest-tenth":
      return narrow(r);
    case "number-system-closure-classify":
      return closure(r, variant);
    default:
      throw new Error(`Unknown real clause ${id}`);
  }
}

export function decimalExpansion(n: number, d: number) {
  const whole = Math.floor(Math.abs(n) / d),
    digits: number[] = [],
    remainders: number[] = [],
    seen = new Map<number, number>();
  let remainder = Math.abs(n) % d;
  while (remainder !== 0 && !seen.has(remainder)) {
    seen.set(remainder, digits.length);
    digits.push(Math.floor((remainder * 10) / d));
    remainder = (remainder * 10) % d;
    remainders.push(remainder);
  }
  const start = remainder === 0 ? digits.length : seen.get(remainder)!;
  const prefix = digits.slice(0, start).join(""),
    repeat = digits.slice(start).join("");
  const text = `${n < 0 ? "-" : ""}${whole}.${prefix}${repeat ? `\\overline{${repeat}}` : ""}`;
  return {
    whole,
    digits,
    remainders,
    repeated: remainder,
    start,
    prefix,
    repeat,
    text,
  };
}
export function decimalDivision(r: Rng, forcedForm?: number): Item {
  const form = forcedForm ?? r(0, 3),
    terminates = r(0, 99) < 35;
  const d = pick(
    r,
    terminates
      ? [8, 16, 20, 25, 40]
      : form === 1
        ? [3, 6, 9, 11, 12, 15, 18, 22]
        : [3, 6, 7, 9, 11, 12, 15, 18, 22],
  );
  let n: number;
  do n = r(1, 40);
  while (gcd(n, d) !== 1);
  if (r(0, 9) < 4) n = -n;
  const e = decimalExpansion(n, d),
    fractionText = fracTex(n, d),
    correct = math(e.text),
    finite = `${n < 0 ? "-" : ""}${e.whole}.${e.digits.join("")}`;
  const wrong = e.repeat
    ? [
        math(finite),
        math(
          `${n < 0 ? "" : "-"}${e.whole}.${e.prefix}\\overline{${e.repeat}}`,
        ),
        math(`${n < 0 ? "-" : ""}${e.whole}.\\overline{${e.digits.join("")}0}`),
      ]
    : [
        math(`${n < 0 ? "" : "-"}${e.whole}.${e.digits.join("")}`),
        math(`${n < 0 ? "-" : ""}${e.whole}.\\overline{${e.digits.join("")}}`),
        math(`${n < 0 ? "-" : ""}${e.whole}.${e.digits.join("")}1`),
      ];
  const steps = e.digits.map((digit, i) => {
    const before = i === 0 ? Math.abs(n) % d : e.remainders[i - 1]!;
    return `Bring down 0: $${before * 10}=${d}\\times${digit}+${e.remainders[i]}$. Write digit ${digit}; the remainder is ${e.remainders[i]}.`;
  });
  const explanation = [
    `Separate the sign. Divide ${Math.abs(n)} by ${d}: the whole-number part is ${e.whole}, with remainder ${Math.abs(n) % d}.`,
    ...steps,
    e.repeat
      ? `Remainder ${e.repeated} returns. The same divisions now repeat the block ${e.repeat}, so $${fractionText}=${e.text}$.`
      : `The remainder reaches 0, so $${fractionText}=${e.text}$; all later decimal digits are 0.`,
    "There are only finitely many possible remainders. Division must reach 0 or revisit a remainder, after which the same digits repeat.",
  ];
  const hint = `Divide the sizes first: ${Math.abs(n)} by ${d}. After each digit, multiply the remainder by 10 for the next division.`;
  if (form === 1) {
    const options = shuffled(
        r,
        [correct, ...wrong].map((label, i) => ({ label, correct: i === 0 })),
      ).map((v, i) => ({ ...v, id: String.fromCharCode(97 + i) })),
      answerId = options.find((x) => x.correct)!.id;
    const rows: WorkRow[] = e.digits.map((_, i) => ({
      id: `r${i + 1}`,
      label: `Decimal place ${i + 1}`,
      fields: [
        { kind: "number", label: "Quotient digit", maxLength: 1 },
        { kind: "number", label: "Remainder", maxLength: 2 },
      ],
    }));
    const fields: FieldRule[][] = e.digits.map((digit, i) => [
      { kind: "number", value: String(digit) },
      { kind: "number", value: String(e.remainders[i]) },
    ]);
    const answers = e.digits.map((digit, i) => [
      String(digit),
      String(e.remainders[i]),
    ]);
    rows.push({
      id: `r${rows.length + 1}`,
      label: "Final decimal",
      fields: [{ kind: "choice", label: "Decimal", bank: "decimal" }],
    });
    fields.push([{ kind: "choice", accept: [answerId] }]);
    answers.push([answerId]);
    return {
      prompt: `Use long division to write $${fractionText}$ as a decimal. Divide the sizes; the whole-number part is ${e.whole}. Fill each digit and remainder until the remainder is 0 or repeats, then choose the signed decimal.`,
      response: {
        kind: "structured-work",
        layout: "steps",
        mode: "build",
        label: "Long division",
        banks: [
          {
            id: "decimal",
            label: "Decimal",
            options: options.map(({ id, label }) => ({ id, label })),
          },
        ],
        rows,
      },
      workGrading: { mode: "fields", fields },
      answer: JSON.stringify(answers),
      hint,
      explanation,
    };
  }
  if (form === 2 || (form === 3 && terminates))
    return {
      prompt: `Does the decimal for $${fractionText}$ terminate or repeat, and why?`,
      ...choice(
        r,
        e.repeat
          ? `It repeats: $${e.text}$; remainder ${e.repeated} returns.`
          : `It terminates: $${e.text}$; the remainder reaches 0.`,
        [
          e.repeat
            ? "It terminates because long division can be stopped after a few digits."
            : "It repeats forever with a nonzero repeating block because all fractions do.",
          "Neither: a noninteger fraction has a decimal that never repeats.",
          "Its behavior is determined only by whether the denominator is even.",
        ],
      ),
      hint,
      explanation,
    };
  if (form === 3 && !terminates)
    return {
      prompt: `Why must the decimal for $${fractionText}$ eventually repeat?`,
      ...choice(
        r,
        `This fraction does not terminate. Only remainders 1–${d - 1} can occur, so one returns and the digits repeat.`,
        [
          "Because every fraction is less than 1.",
          "Because the denominator is odd.",
          "It need not repeat; some rational decimals neither end nor repeat.",
        ],
      ),
      hint: `For division by ${d}, list the possible nonzero remainders. There are finitely many.`,
      explanation: [
        ...explanation,
        `Here the reduced denominator ${d} has a prime factor other than 2 or 5, so the division cannot terminate.`,
      ],
    };
  return {
    prompt: `Use long division to write $${fractionText}$ as a decimal. Which is exact?`,
    ...choice(r, correct, wrong),
    hint,
    explanation,
  };
}
