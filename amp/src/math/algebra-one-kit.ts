import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  ProblemResponse,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import type { Scene } from "./scene/spec";
import type { Step } from "./scene/timeline";

/** Shared machinery for the Algebra 1 families: seeded draws, exact
 * rationals, typographic signs and the choice/number problem assembly. */
export type Random = (low: number, high: number) => number;
export type Choice = { label: string; correct?: true; feedback?: string };
export type Case = {
  prompt: string;
  /** Exact answer for number/fraction items; choice items give `choices`. */
  answer?: Rational;
  choices?: Choice[];
  explanation: string[];
  scene?: Scene;
  tags: string[];
  /** One teaching step written from this problem's own givens. */
  hint: string;
  /** The hint's cue over this problem's scene (private). */
  hintCue?: Step[];
  /** A worked model for this instance's lesson (private; may show the answer). */
  walkthrough?: Scene;
};

export function seeded(id: string, seed: string): Random {
  let counter = 0;
  return (low, high) => {
    const span = high - low + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    while (value >= limit);
    return low + (value % span);
  };
}
export const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;
/** A nonzero integer in [low, high]. */
export const nonzero = (r: Random, low: number, high: number) => {
  for (;;) {
    const v = r(low, high);
    if (v !== 0) return v;
  }
};
export function shuffle<T>(r: Random, items: readonly T[]) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = r(0, i);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
/** An exact rational n/d in lowest terms with d > 0. */
export type Rational = { n: number; d: number };
export function rat(n: number, d = 1): Rational {
  if (d === 0) throw new Error("Zero denominator");
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}
export const ratEq = (a: Rational, b: Rational) => a.n === b.n && a.d === b.d;
/** Answer text: ASCII minus, "a/b" or an integer. */
export const ascii = (v: Rational) => (v.d === 1 ? `${v.n}` : `${v.n}/${v.d}`);
/** Display text: typographic minus. */
export const n = (v: number) => (v < 0 ? `−${-v}` : String(v));
export const qt = (v: Rational) => (v.d === 1 ? n(v.n) : `${n(v.n)}/${v.d}`);
/** A signed value inside arithmetic, parenthesized when negative. */
export const p = (v: number) => (v < 0 ? `(−${-v})` : String(v));
export const pq = (v: Rational) => (v.n < 0 ? `(${qt(v)})` : qt(v));

/** "3x", "−x", "x" for a coefficient and a variable; "" for 0. */
export function termText(c: number, v: string, first = true) {
  if (c === 0) return "";
  const mag = Math.abs(c) === 1 ? v : `${Math.abs(c)}${v}`;
  if (first) return c < 0 ? `−${mag}` : mag;
  return c < 0 ? ` − ${mag}` : ` + ${mag}`;
}
/** A constant appended to an expression: " + 4", " − 4", "" for 0. */
export const constText = (c: number) =>
  c === 0 ? "" : c < 0 ? ` − ${-c}` : ` + ${c}`;
/** ax + b written plainly: "2x − 3", "−x", "5". */
export function linearText(a: number, b: number, v = "x") {
  const t = termText(a, v);
  if (!t) return n(b);
  return t + constText(b);
}
/** ax + by written plainly: "3x − 2y". */
export const twoTerm = (a: number, b: number) =>
  a === 0 ? termText(b, "y") : termText(a, "x") + termText(b, "y", false);

export function assemble(
  meta: TemplateMetadata,
  seed: string,
  c: Case,
  r: Random,
  label: string,
  kind: "number" | "fraction" = "number",
): { problem: GeneratedProblem; tags: string[]; caseKey: string } {
  let response: ProblemResponse, answer: string;
  let choiceFeedback: Record<string, string> | undefined;
  if (c.choices) {
    if (
      c.choices.length !== 4 ||
      c.choices.filter((x) => x.correct).length !== 1
    )
      throw new Error(`${meta.id}: four options, one correct`);
    if (new Set(c.choices.map((x) => x.label)).size !== 4)
      throw new Error(`${meta.id}: duplicate options`);
    // Deterministic shuffle: the correct option's position carries no signal.
    const order = shuffle(
      r,
      c.choices.map((_, i) => i),
    );
    const options = order.map((source, i) => ({
      id: `option-${"abcd"[i]}`,
      label: c.choices![source]!.label,
    }));
    response = { kind: "choice", label, options };
    answer = options[order.findIndex((s) => c.choices![s]!.correct)]!.id;
    choiceFeedback = Object.fromEntries(
      order
        .map((s, i) => [options[i]!.id, c.choices![s]!.feedback] as const)
        .filter((entry): entry is [string, string] => Boolean(entry[1])),
    );
  } else {
    if (!c.answer) throw new Error(`${meta.id}: no answer`);
    if (kind === "number" && c.answer.d !== 1)
      throw new Error(`${meta.id}: a number item needs an integer answer`);
    response = { kind, label };
    answer = ascii(c.answer);
  }
  const figure: SemanticFigure | undefined = c.scene
    ? { kind: "scene", scene: c.scene }
    : undefined;
  const problem: GeneratedProblem = {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([meta.id, 1, seed]))
        .digest("hex"),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      skillId: meta.skillId,
      prompt: c.prompt,
      response,
      ...(figure ? { figure } : {}),
    },
    answer,
    explanation: c.explanation,
    hint: c.hint,
    ...(c.hintCue ? { hintCue: c.hintCue } : {}),
    ...(c.walkthrough ? { walkthrough: c.walkthrough } : {}),
    ...(choiceFeedback ? { choiceFeedback } : {}),
  };
  return {
    problem,
    tags: c.tags,
    caseKey: JSON.stringify([
      c.prompt,
      c.scene ?? null,
      c.choices?.map((x) => x.label).sort() ?? null,
    ]),
  };
}
/** "−15/4", "6/2 = 3" or "−8/(−2) = 4": a quotient, then its lowest terms
 * when they differ from what is written. */
export function quotient(num: number, den: number) {
  if (den === 1) return n(num);
  const written = `${n(num)}/${den < 0 ? `(${n(den)})` : den}`;
  const v = rat(num, den);
  return v.n === num && v.d === den ? written : `${written} = ${qt(v)}`;
}
/** A value substituted into an expression, always in parentheses. */
export const sub = (v: number) => `(${n(v)})`;
/** "a" or "an" before a number as it is read aloud: an 8-, an 11-, an 18-. */
export const article = (v: number) =>
  /^8/.test(String(v)) || v === 11 || v === 18 ? "An" : "A";
/** c times a substituted value: "3(4)", "−2(−5)", "−4", "+ 7", " − (−3)". */
export function scaled(c: number, v: number, first = true) {
  const mag = Math.abs(c) === 1 ? p(v) : `${Math.abs(c)}(${n(v)})`;
  if (first) return c < 0 ? `−${mag}` : mag;
  return c < 0 ? ` − ${mag}` : ` + ${mag}`;
}
/** ax² + bx + c at a value: "−3 × 6² − 6 + 9", "(−2)² + 4 × (−2) + 1". */
export function quadAt(a: number, b: number, c: number, x: number) {
  const sq = x < 0 ? `(${n(x)})²` : `${x}²`;
  const first = a === 1 ? sq : a === -1 ? `−${sq}` : `${n(a)} × ${sq}`;
  const mid =
    b === 0
      ? ""
      : `${b < 0 ? " − " : " + "}${Math.abs(b) === 1 ? p(x) : `${Math.abs(b)} × ${p(x)}`}`;
  return first + mid + constText(c);
}
