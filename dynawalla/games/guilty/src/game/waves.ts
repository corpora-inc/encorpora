/**
 * The escalation curve.
 *
 * Tuned for a twenty-minute session, not a ninety-second demo: something new
 * arrives every couple of waves for the first fifteen, and after that the
 * numbers keep climbing towards a ceiling that a very good player can still
 * survive. Nothing here is announced in words — a wider formation, a swing, a
 * shell that hides the numeral until it is close. The player finds out by
 * meeting it.
 */

import { BASE_DESCENT, BOSS_EVERY, DESCENT_PER_WAVE, MAX_DESCENT } from "../core/config.ts";

export type WaveSpec = {
  boss: boolean;
  candidates: number;
  descent: number;
  swingAmp: number;
  swingFreq: number;
  /** Probability a given husk starts with its numeral hidden. */
  shroud: number;
  /** Hostiles created by a mistake start shooting back at this wave. */
  bolts: boolean;
};

/**
 * One wave is one problem, and a competent player answers in three or four
 * seconds — so "wave 40" is about three minutes in, not an hour. The ramps
 * below are stretched to match that: they keep introducing something new for
 * the whole of a five-to-ten minute sitting, rather than emptying the toybox in
 * ninety seconds and then just going faster.
 */
export function specFor(wave: number): WaveSpec {
  const boss = wave % BOSS_EVERY === 0;
  const candidates = Math.min(6, 3 + Math.floor((wave - 1) / 6));
  const descent = Math.min(MAX_DESCENT, BASE_DESCENT + (wave - 1) * DESCENT_PER_WAVE);
  const swingAmp = wave < 4 ? 0 : Math.min(32, (wave - 3) * 1.5);
  const swingFreq = 0.36 + Math.min(0.5, wave * 0.008);
  const shroud = wave < 12 ? 0 : Math.min(0.55, (wave - 11) * 0.045);
  return {
    boss,
    candidates: boss ? Math.min(5, candidates) : candidates,
    descent,
    swingAmp,
    swingFreq,
    shroud,
    bolts: wave >= 10,
  };
}

/**
 * The banner a wave earns, if any. Empty means no banner at all.
 *
 * Every invented name here is defined on the line under it. THE ARBITER and
 * SHUT SHELLS were explained only in the how-to-play sheet, which is the one
 * place a child in the middle of a wave is not looking — and "IT ONLY BREAKS TO
 * THE TRUTH" explained a name with a riddle rather than with a rule.
 */
export function bannerFor(wave: number): [string, string] {
  if (wave % BOSS_EVERY === 0) return ["THE ARBITER", "ONLY THE RIGHT ANSWER BREAKS ITS SHIELD"];
  if (wave === 12) return ["SHUT SHELLS", "THE NUMBERS SHOW ONCE THE SHELLS OPEN"];
  if (wave % 25 === 0) return [`WAVE ${wave}`, ""];
  return ["", ""];
}
