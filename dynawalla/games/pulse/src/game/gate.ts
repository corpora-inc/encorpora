/**
 * The fraction gate — the reason this game exists.
 *
 * The visible playfield to the right of the strike line is exactly one bar. One bar
 * is one whole. So a value in `(0, 1]` has a position, and a position has a moment:
 * the candidate labelled `3/4` sits three quarters of the way across the bar and
 * crosses the strike line three quarters of the way through it.
 *
 * You answer `1/2 + 1/4` by hitting a thing at the right *time*. There is no answer
 * button, no keypad and no multiple-choice list — the number line is the timeline.
 *
 * If a future host emits an answer that is not a fraction in `(0,1]` the gate falls
 * back to even spacing and still plays; it just stops being a number line.
 */

import type { Question } from "../contract.ts";
import { type Rat, parseRat, inBar, cmp, sub, toFloat, eq, rat } from "../math/rational.ts";
import type { Rng } from "../rng.ts";

export type GateCandidate = {
  label: string;
  /** Position in the bar, 0..1 — rendering only. */
  pos: number;
  correct: boolean;
  /** Set when the label is a real fraction, for the pie glyph. */
  frac: { n: number; d: number } | null;
};

export type BuiltGate = {
  questionId: string;
  prompt: string;
  candidates: GateCandidate[];
  /** False when the host answered in something other than a bar fraction. */
  positional: boolean;
};

/**
 * How much of the bar must separate two candidates.
 *
 * This is a *display* constraint, not a mathematical one, so it is passed in rather
 * than fixed: a 1372 px landscape bar can hold four orbs a twelfth apart, and a 544 px
 * phone bar cannot — they overlap and become unreadable, which is the one thing a
 * "shoot the guilty one" game may never be. Crowded candidates are dropped, never
 * moved: a candidate's position is its value, and nudging it would be a lie.
 */
export type GateFit = { maxCandidates: number; minGapDenom: number };

export const DEFAULT_FIT: GateFit = { maxCandidates: 4, minGapDenom: 12 };

function farEnough(v: Rat, kept: Rat[], minGap: Rat): boolean {
  for (const k of kept) {
    const d = cmp(v, k) >= 0 ? sub(v, k) : sub(k, v);
    if (cmp(d, minGap) < 0) return false;
  }
  return true;
}

export function buildGate(q: Question, rng: Rng, fit: GateFit = DEFAULT_FIT): BuiltGate {
  const maxCandidates = Math.max(2, fit.maxCandidates);
  const minGap = rat(1n, BigInt(Math.max(2, Math.round(fit.minGapDenom))));
  const ans = parseRat(q.answer);
  const dis = q.distractors.map((s) => ({ s, r: parseRat(s) }));
  // Only the *answer* decides whether the bar can still be a number line. A host
  // that hands over one unusable distractor loses that distractor, not the mechanic.
  const positional = ans !== null && inBar(ans);

  /**
   * Keep the game playable, lose the number line.
   *
   * Distractors equal to the answer are dropped first. A host that sends one
   * (and they do — `3/4` against an answer of `3/4`, or `6/8` against it) would
   * otherwise put the same label on the bar twice, once scoring as right and
   * once as wrong. Equality is by VALUE where both parse, so `6/8` is caught
   * against `3/4`, and by label otherwise.
   */
  const flat = (): BuiltGate => {
    const seen: Rat[] = ans === null ? [] : [ans];
    const usable = q.distractors.filter((s) => {
      if (s === q.answer) return false;
      const r = parseRat(s);
      if (r === null) return true;
      if (seen.some((k) => eq(k, r))) return false;
      seen.push(r);
      return true;
    });
    const all = [{ s: q.answer, correct: true }, ...usable.map((s) => ({ s, correct: false }))];
    rng.shuffle(all);
    const used = all.slice(0, maxCandidates);
    if (!used.some((u) => u.correct)) {
      used[used.length - 1] = { s: q.answer, correct: true };
      rng.shuffle(used);
    }
    return {
      questionId: q.id,
      prompt: q.prompt,
      positional: false,
      candidates: used.map((u, i) => ({
        label: u.s,
        pos: (i + 1) / (used.length + 1),
        correct: u.correct,
        frac: null,
      })),
    };
  };

  if (!positional || ans === null) return flat();

  const kept: Rat[] = [ans];
  const out: GateCandidate[] = [
    { label: q.answer, pos: toFloat(ans), correct: true, frac: { n: Number(ans.n), d: Number(ans.d) } },
  ];
  for (const d of dis) {
    if (out.length >= maxCandidates) break;
    const r = d.r;
    if (r === null || !inBar(r)) continue;
    if (kept.some((k) => eq(k, r))) continue;
    if (!farEnough(r, kept, minGap)) continue;
    kept.push(r);
    out.push({
      label: d.s,
      pos: toFloat(r),
      correct: false,
      frac: { n: Number(r.n), d: Number(r.d) },
    });
  }
  // Losing ONE unusable distractor costs a distractor; losing them ALL costs the
  // game. If nothing but the answer survived the bar, the child is handed a
  // single target they cannot miss — not a question, a formality. Fall back to
  // the flat presentation, which uses every choice the host sent regardless of
  // whether it lands in (0,1].
  //
  // This is reachable in ordinary play, not a theoretical edge: the curriculum
  // ladder is `add`-only today, so PULSE is served column arithmetic, and on
  // `43 − 42` the answer is 1 (in the bar) while every distractor — 2, 11, 0 —
  // is outside it.
  if (out.length < 2) return flat();

  out.sort((a, b) => a.pos - b.pos);
  return { questionId: q.id, prompt: q.prompt, candidates: out, positional: true };
}
