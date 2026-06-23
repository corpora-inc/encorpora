/**
 * learning/mastery.ts — Mastery model + readout for Lingo Hero.
 *
 * STREAM: learning. Turns the per-word memory (WordStatsStore) into:
 *   1. a structured MasterySummary the rest of the app can read, and
 *   2. a MasteryReadout (label + 0..1 progress) for the HUD's slot (d).
 *
 * SURFACING TO THE HUD: the foundation added `Hud.setMastery(readout|null)` and
 * a `#mastery-readout` element (`.mastery-label` + optional `.mastery-bar` >
 * `.mastery-fill`) explicitly for "the ui/learning stream". The learning stream
 * does not hold a Hud reference (we must not edit Game.ts/Hud.ts), so we render
 * into that documented slot directly, matching the Hud's exact markup contract.
 * The render is fully guarded: if the element isn't present (e.g. headless),
 * it's a silent no-op. We also expose the structured summary on the progression
 * snapshot so any consumer holding the ProgressionApi can read it.
 *
 * The progress bar reflects OVERALL mastery of the words the learner has met:
 * the mean strength across seen words, which climbs as they nail words and dips
 * when fresh/weak words enter — a calm, honest "how well do I know this set".
 */

import { MASTERED_BOX, type WordStatsStore } from "./wordStats";

/** A structured snapshot of the learner's mastery for this (stack, lang) scope. */
export interface MasterySummary {
  /** Words the learner has encountered at least once. */
  seen: number;
  /** Words at/above the mastered Leitner box. */
  mastered: number;
  /** Seen-but-not-mastered words actively being learned. */
  learning: number;
  /** Words currently due to resurface (overdue or due now), among seen. */
  due: number;
  /** Mean strength across SEEN words, 0..1 (the readout bar fill). */
  meanStrength: number;
  /** A coarse mastery level (1+) derived from mastered count, for flavour. */
  level: number;
}

/** The HUD readout shape (mirror of Hud.MasteryReadout to avoid a UI import). */
export interface MasteryReadout {
  label: string;
  progress?: number;
}

/** Compute the structured mastery summary from the word store. */
export function computeMastery(store: WordStatsStore): MasterySummary {
  const words = store.all();
  const wave = store.wave;
  let mastered = 0;
  let due = 0;
  let strengthSum = 0;
  for (const w of words) {
    if (w.box >= MASTERED_BOX) mastered += 1;
    if (wave >= w.dueWave) due += 1;
    strengthSum += w.strength;
  }
  const seen = words.length;
  const meanStrength = seen > 0 ? strengthSum / seen : 0;
  return {
    seen,
    mastered,
    learning: Math.max(0, seen - mastered),
    due,
    meanStrength,
    // Gentle level curve: every 5 mastered words = +1 level, min 1.
    level: 1 + Math.floor(mastered / 5),
  };
}

/**
 * Format a MasterySummary into a HUD readout. Kept short + glanceable so it
 * never competes with the gameplay. Returns null (hide) before any word is met.
 */
export function formatReadout(m: MasterySummary): MasteryReadout | null {
  if (m.seen === 0) return null;
  const parts: string[] = [];
  if (m.mastered > 0) parts.push(`${m.mastered} mastered`);
  parts.push(`${m.learning} learning`);
  if (m.due > 0) parts.push(`${m.due} due`);
  return {
    label: parts.join(" · "),
    progress: m.meanStrength,
  };
}

/**
 * Render a readout into the foundation's `#mastery-readout` slot, mirroring the
 * Hud's exact markup (`.mastery-label` + optional `.mastery-bar`/`.mastery-fill`)
 * so existing CSS hooks apply. Null/empty hides the slot. Fully guarded for
 * headless/no-DOM hosts. Input is escaped (label is our own composed string,
 * but we stay defensive).
 */
export function renderMasterySlot(readout: MasteryReadout | null): void {
  let el: HTMLElement | null = null;
  try {
    el = document.getElementById("mastery-readout");
  } catch {
    el = null;
  }
  if (!el) return;

  if (!readout || !readout.label.trim()) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  const pct = Math.max(0, Math.min(1, readout.progress ?? 0)) * 100;
  const bar =
    typeof readout.progress === "number"
      ? `<span class="mastery-bar"><span class="mastery-fill" style="width:${pct}%"></span></span>`
      : "";
  el.innerHTML = `<span class="mastery-label">${escapeHtml(readout.label)}</span>${bar}`;
  el.hidden = false;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
