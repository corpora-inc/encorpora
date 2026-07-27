// Question -> apparatus.
//
// The stub host attaches a fully-built `PuzzleSpec`. A foreign host will not,
// so this file can also *read a prompt* and build a board from it. The grammar
// is small and total: sums of numerals, fractions, unknowns and one blank, with
// or without an equals sign. `15 − 8` with answer `7` becomes a dish holding a
// 15 and a balloon marked −8, and an empty dish to fill. That is why the swap to
// the shared package later is mechanical: the game never needed anything the
// contract does not already carry.

import type { Question } from "./contract.ts";
import type { Frac } from "./frac.ts";
import { frac, parseFrac, toNumber, isPositive } from "./frac.ts";
import type { FixedItem, PuzzleSpec, Side } from "./puzzle.ts";
import { PAN_PEG } from "./puzzle.ts";

export type QuestionWithSpec = Question & { spec?: PuzzleSpec };

type Term =
  | { t: "value"; value: Frac }
  | { t: "crate"; count: number }
  | { t: "blank" };

const MINUS = /[−–—-]/;

function tokenizeSide(sideText: string): Term[] {
  const cleaned = sideText
    .replace(/([+×*−–—-])/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
  const out: Term[] = [];
  let sign = 1;
  let i = 0;
  const parts = cleaned.split(" ");
  while (i < parts.length) {
    const p = parts[i];
    if (p === "+") {
      sign = 1;
      i++;
      continue;
    }
    if (MINUS.test(p) && p.length === 1) {
      sign = -1;
      i++;
      continue;
    }
    // product form "6 × 2" collapses to a single 12
    if (i + 2 < parts.length && (parts[i + 1] === "×" || parts[i + 1] === "*")) {
      const a = parseFrac(p);
      const b = parseFrac(parts[i + 2]);
      if (a && b && a.d === 1 && b.d === 1) {
        out.push({ t: "value", value: frac(sign * a.n * b.n) });
        sign = 1;
        i += 3;
        continue;
      }
    }
    if (p === "□" || p === "?" || p === "_") {
      out.push({ t: "blank" });
      sign = 1;
      i++;
      continue;
    }
    const mx = /^(\d*)x$/i.exec(p);
    if (mx) {
      out.push({ t: "crate", count: mx[1] === "" ? 1 : Number(mx[1]) });
      sign = 1;
      i++;
      continue;
    }
    const f = parseFrac(p);
    if (f) {
      out.push({ t: "value", value: frac(sign * f.n, f.d) });
      sign = 1;
      i++;
      continue;
    }
    i++;
  }
  return out;
}

function rackFor(answer: Frac, distractors: readonly string[]): Frac[] {
  const negative = !isPositive(answer);
  if (answer.d !== 1) {
    return [
      frac(1, 4),
      frac(1, 3),
      frac(1, 2),
      frac(2, 3),
      frac(3, 4),
      frac(1),
      frac(5, 4),
      frac(3, 2),
    ];
  }
  const mag = Math.abs(answer.n);
  const set = new Set<number>([mag]);
  for (const d of distractors) {
    const f = parseFrac(d);
    if (f && f.d === 1 && Math.abs(f.n) > 0 && Math.abs(f.n) <= 30) set.add(Math.abs(f.n));
  }
  let v = 1;
  while (set.size < 9 && v <= 30) {
    set.add(v);
    v++;
  }
  const vals = [...set].sort((a, b) => a - b);
  return vals.map((n) => frac(negative ? -n : n));
}

/**
 * Build a board for a question that arrived without one. Total: it always
 * returns a solvable spec, because the answer is taken from the contract and
 * the missing side is simply "whatever is left".
 */
export function specFromQuestion(q: Question, index: number): PuzzleSpec {
  const withSpec = q as QuestionWithSpec;
  if (withSpec.spec) return withSpec.spec;

  const answer = parseFrac(q.answer) ?? frac(1);
  const eq = q.prompt.indexOf("=");
  const leftText = eq >= 0 ? q.prompt.slice(0, eq) : q.prompt;
  const rightText = eq >= 0 ? q.prompt.slice(eq + 1) : "□";

  const fixed: FixedItem[] = [];
  const place = (terms: Term[], side: Side): { fill: Side | null; crate: boolean } => {
    let fill: Side | null = null;
    let crate = false;
    for (const t of terms) {
      if (t.t === "value") fixed.push({ kind: "weight", side, peg: PAN_PEG, value: t.value });
      else if (t.t === "crate") {
        crate = true;
        for (let i = 0; i < t.count; i++) fixed.push({ kind: "crate", side, peg: PAN_PEG });
      } else fill = side;
    }
    return { fill, crate };
  };
  const l = place(tokenizeSide(leftText), -1);
  const r = place(tokenizeSide(rightText), 1);

  const kind: PuzzleSpec["kind"] = l.crate || r.crate ? "declare" : "fill";
  const fillSide: Side = l.fill ?? r.fill ?? 1;

  return {
    id: q.id,
    kind,
    mode: "pans",
    fixed,
    answer,
    rack: rackFor(answer, q.distractors),
    fillSide: kind === "fill" ? fillSide : null,
    hangSlot: null,
    prompt: q.prompt,
    domain: q.domain,
    difficulty: q.difficulty,
    movement: Math.floor(index / 5),
    movementName: "",
  };
}

/** Only used by the standalone shell's debug overlay. */
export function describeSpec(s: PuzzleSpec): string {
  return `${s.kind}/${s.mode} answer=${toNumber(s.answer)}`;
}
