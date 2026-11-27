import type { Item, Skill } from "../src/index.ts";

export const T0 = Date.UTC(2026, 10, 27, 12, 0, 0);

/** Three topics, prerequisites inside two of them, several variants per fact. */
export const SKILLS: Skill[] = [
  { id: "lc.read", topicId: "loadcharts" },
  { id: "lc.deduct", topicId: "loadcharts", prereqs: ["lc.read"] },
  { id: "lc.radius", topicId: "loadcharts", prereqs: ["lc.read"] },
  { id: "lc.parts", topicId: "loadcharts", prereqs: ["lc.deduct"] },
  { id: "sig.hand", topicId: "signals" },
  { id: "sig.voice", topicId: "signals", prereqs: ["sig.hand"] },
  { id: "pl.clear", topicId: "powerlines", weight: 2 },
];

/** n facts per skill, v variants per fact, difficulties spread 0.2..0.8. */
export function makeItems(n = 4, v = 3): Item[] {
  const out: Item[] = [];
  for (const s of SKILLS) {
    for (let f = 0; f < n; f++) {
      const base = `${s.id}.f${f}`;
      for (let k = 0; k < v; k++) {
        out.push({
          id: k === 0 ? base : `${base}.v${k}`,
          skillId: s.id,
          variantOf: k === 0 ? null : base,
          kind: "mc",
          choiceCount: 4,
          answer: String((f + k) % 4),
          difficulty: n === 1 ? 0.5 : 0.2 + (0.6 * f) / (n - 1),
        });
      }
    }
  }
  return out;
}
