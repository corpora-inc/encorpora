import type { ProblemLessonView } from "../../content/problem-lessons";
import type { SemanticFigure } from "../../math/contracts";

type Fraction = Extract<SemanticFigure, { kind: "fraction" }>;
type ArrayFigure = Extract<SemanticFigure, { kind: "unit-array" }>;
type Exchange = Extract<SemanticFigure, { kind: "base-ten" }>;
export type AnimationModel =
  | { kind: "root-zoom"; radicand: number; index: 2 | 3 }
  | {
      kind: "decimal-shift";
      digits: string;
      exponent: number;
      toStandard: boolean;
    }
  | { kind: "fraction"; figure: Fraction }
  | { kind: "array"; figure: ArrayFigure & { splitAfterRow: number } }
  | { kind: "exchange"; figure: Exchange; unit: 1 | 10 };
const integer = (n: number, min: number, max: number) =>
  Number.isInteger(n) && n >= min && n <= max;

/** Only compatible semantic figures opt in. No prompt parsing or answer access. */
export function animationModel(
  lesson: ProblemLessonView,
): AnimationModel | null {
  const g = lesson.example.givens;
  if (
    (lesson.templateId === "root-between-integers" ||
      lesson.templateId === "root-nearest-tenth") &&
    g?.kind === "root" &&
    (g.index === 2 || g.index === 3) &&
    integer(g.radicand, 2, g.index === 2 ? 400 : 1000) &&
    rootFloor(g.radicand, g.index) ** g.index !== g.radicand
  )
    return { kind: "root-zoom", radicand: g.radicand, index: g.index };
  if (
    (lesson.templateId === "scientific-to-standard" ||
      lesson.templateId === "standard-to-scientific") &&
    g?.kind === "power-of-ten" &&
    /^[1-9](\d{0,2}[1-9])?$/.test(g.digits) &&
    integer(g.exponent, -9, 12) &&
    g.exponent !== 0 &&
    g.toStandard === (lesson.templateId === "scientific-to-standard")
  )
    return {
      kind: "decimal-shift",
      digits: g.digits,
      exponent: g.exponent,
      toStandard: g.toStandard,
    };
  const f = lesson.example.figure;
  if (
    lesson.templateId === "fraction-model" &&
    f?.kind === "fraction" &&
    integer(f.parts, 2, 12) &&
    integer(f.selected, 0, f.parts)
  )
    return { kind: "fraction", figure: f };
  if (
    lesson.templateId === "split-array-part" &&
    f?.kind === "unit-array" &&
    integer(f.rows, 2, 12) &&
    integer(f.columns, 1, 12) &&
    f.splitAfterRow !== undefined &&
    integer(f.splitAfterRow, 1, f.rows - 1)
  )
    return { kind: "array", figure: { ...f, splitAfterRow: f.splitAfterRow } };
  if (
    lesson.templateId === "exchange-base-ten" &&
    f?.kind === "base-ten" &&
    integer(f.hundreds, 0, 9) &&
    integer(f.tens, 0, 19) &&
    integer(f.ones, 0, 19)
  ) {
    if (f.ones >= 10 && f.tens < 10)
      return { kind: "exchange", figure: f, unit: 1 };
    if (f.tens >= 10 && f.ones < 10)
      return { kind: "exchange", figure: f, unit: 10 };
  }
  return null;
}
/** Greatest whole number whose square (or cube) is at most n. */
export function rootFloor(n: number, index: 2 | 3) {
  let k = Math.floor(Math.round(n ** (1 / index) * 1e6) / 1e6);
  while ((k + 1) ** index <= n) k++;
  while (k ** index > n) k--;
  return k;
}
/** An integer m scaled by 10^-places, as exact decimal text. */
export function scaled(m: number, places: number) {
  const digits = String(m).padStart(places + 1, "0");
  return places
    ? `${digits.slice(0, -places)}.${digits.slice(-places)}`
    : digits;
}
/** The tenth just below the root, and the nearest tenth, both in tenths. */
export function rootZoom(n: number, index: 2 | 3) {
  const k = rootFloor(n, index),
    t = rootFloor(n * 10 ** index, index);
  // Halfway point (2t + 1)/20 = (10t + 5)/100; compare its power with n exactly.
  const half = (10 * t + 5) ** index,
    up = n * 100 ** index > half;
  return { k, t, up, nearest: up ? t + 1 : t, half };
}
const tenthText = (t: number) => scaled(t, 1);
/** Standard form of digits × 10^(exponent − digits + 1), e.g. 307, −4 → 0.000307. */
export function standardForm(digits: string, exponent: number) {
  const point = exponent + 1;
  if (point >= digits.length) return digits + "0".repeat(point - digits.length);
  if (point > 0) return `${digits.slice(0, point)}.${digits.slice(point)}`;
  return `0.${"0".repeat(-point)}${digits}`;
}
export const coefficientText = (digits: string) =>
  digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
const group = (text: string) => {
  const [whole, part] = text.split(".");
  const grouped =
    whole!.length >= 5 ? whole!.replace(/\B(?=(\d{3})+$)/g, "{,}") : whole!;
  return part === undefined ? grouped : `${grouped}.${part}`;
};
const placeCount = (n: number) => `${n} ${n === 1 ? "place" : "places"}`;
export function animationFrames(model: AnimationModel) {
  if (model.kind === "root-zoom") {
    const { radicand: n, index: i } = model,
      { k, t, up, nearest, half } = rootZoom(n, i);
    const root = i === 2 ? `\\sqrt{${n}}` : `\\sqrt[3]{${n}}`,
      power = (x: number, places: number) => scaled(x ** i, places * i);
    return [
      {
        title: "Between whole numbers",
        text: `${n} is between ${k ** i} and ${(k + 1) ** i}, so its ${i === 2 ? "square" : "cube"} root is between ${k} and ${k + 1}.`,
        math: `$${k}^${i} = ${k ** i} < ${n} < ${(k + 1) ** i} = ${k + 1}^${i}$`,
      },
      {
        title: "Zoom in to tenths",
        text: `Between ${k} and ${k + 1}, ${n} falls between the ${i === 2 ? "squares" : "cubes"} of ${tenthText(t)} and ${tenthText(t + 1)}.`,
        math: `$${tenthText(t)}^${i} = ${power(t, 1)} < ${n} < ${power(t + 1, 1)} = ${tenthText(t + 1)}^${i}$`,
      },
      {
        title: "Compare with the halfway point",
        text: `${scaled(10 * t + 5, 2)}${i === 2 ? "²" : "³"} = ${scaled(half, 2 * i)}. ${n} is ${up ? "greater" : "less"}, so the root is closer to ${tenthText(nearest)}.`,
        math: `$${root} \\approx ${tenthText(nearest)}$`,
      },
    ];
  }
  if (model.kind === "decimal-shift") {
    const { digits, exponent: e, toStandard } = model,
      coefficient = coefficientText(digits),
      standard = group(standardForm(digits, e)),
      places = placeCount(Math.abs(e)),
      direction = e > 0 ? "right" : "left";
    const scientific = `${coefficient} \\times 10^{${e}}`;
    return toStandard
      ? [
          {
            title: "The digits stay fixed",
            text: `The digits ${digits.split("").join(", ")} keep their order. Only the decimal point moves.`,
            math: `$${scientific}$`,
          },
          {
            title: `Move the point ${places} ${direction}`,
            text: `Each factor of 10 moves the point one place. ${e > 0 ? "Multiplying" : "Dividing"} by 10 ${Math.abs(e) === 1 ? "once" : `${Math.abs(e)} times`} moves it ${places} ${direction}.`,
            math: `$\\times 10^{${e}}$`,
          },
          {
            title: "Fill the empty places with zeros",
            text: "Zeros hold the places between the digits and the decimal point.",
            math: `$${scientific} = ${standard}$`,
          },
        ]
      : [
          {
            title: "Start from standard form",
            text: `The digits ${digits.split("").join(", ")} keep their order. Only the decimal point moves.`,
            math: `$${standard}$`,
          },
          {
            title: "Move the point after the first nonzero digit",
            text: `The point moves ${places} to the ${e > 0 ? "left" : "right"}, leaving ${coefficient}.`,
            math: `$${coefficient}$`,
          },
          {
            title: "The count becomes the exponent",
            text:
              e > 0
                ? "The number is 10 or more, so the exponent is positive."
                : "The number is less than 1, so the exponent is negative.",
            math: `$${standard} = ${scientific}$`,
          },
        ];
  }
  if (model.kind === "fraction") {
    const { parts: d, selected: n } = model.figure;
    return [
      {
        title: "Name the whole",
        text: "The outline marks one whole. Keep its size fixed.",
        math: "$1$ whole",
      },
      {
        title: "Partition equally",
        text: `Divide the whole into ${d} equal parts.`,
        math: `Each part is $\\dfrac{1}{${d}}$ of the whole.`,
      },
      {
        title: "Count the shaded parts",
        text: `${n === 1 ? "The shaded part keeps its" : `The ${n} shaded parts keep their`} size when moved.`,
        math: `$${n} \\times \\dfrac{1}{${d}} = \\dfrac{${n}}{${d}}$`,
      },
    ];
  }
  if (model.kind === "array") {
    const { rows: r, columns: c, splitAfterRow: a } = model.figure;
    return [
      {
        title: "Count rows and columns",
        text: `${r} rows, with ${c} unit squares in each row.`,
        math: `$${r} \\times ${c} = ${r * c}$`,
      },
      {
        title: "Separate the regions",
        text: `A has ${a} rows. B has ${r - a} rows. Each row keeps ${c} squares.`,
        math: `$A = ${a * c},\\quad B = ${(r - a) * c}$`,
      },
      {
        title: "Rejoin the partial products",
        text: "The two regions fill the original array without gaps or overlaps.",
        math: `$${a * c} + ${(r - a) * c} = ${r * c}$`,
      },
    ];
  }
  const { hundreds: h, tens: t, ones: o } = model.figure;
  const u = model.unit,
    small = u === 1 ? "ones" : "tens",
    large = u === 1 ? "ten" : "hundred";
  const h2 = h + (u === 10 ? 1 : 0),
    t2 = t + (u === 1 ? 1 : -10),
    o2 = o - (u === 1 ? 10 : 0);
  const remaining = [
    [h, "hundred"],
    [u === 1 ? t : t - 10, "ten"],
    [u === 1 ? o - 10 : o, "one"],
  ]
    .map(([count, name]) => `${count} ${name}${count === 1 ? "" : "s"}`)
    .join(", ");
  return [
    {
      title: `Choose ten ${small}`,
      text: `Focus on ten of the model’s ${u === 1 ? o : t} ${small}. Other units stay unchanged.`,
      math: `$${h} \\times 100 + ${t} \\times 10 + ${o}$`,
    },
    {
      title: "Bring equal units together",
      text: `Move the ten ${small} together without changing their size.`,
      math: `$10 \\times ${u} = ${10 * u}$`,
    },
    {
      title: `Exchange for one ${large}`,
      text: `Unchanged: ${remaining}. Total value: ${h * 100 + t * 10 + o}.`,
      math: `$${h2} \\times 100 + ${t2} \\times 10 + ${o2}$`,
    },
  ];
}
