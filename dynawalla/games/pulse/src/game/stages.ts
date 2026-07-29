/**
 * Escalation.
 *
 * A stage is a subdivision. The glyph is the honest fraction of a *bar* that one
 * note occupies: a quarter note is 1/4 of the bar, an eighth is 1/8, a triplet
 * eighth is 1/12, and three-against-four means one lane in thirds over another in
 * quarters. Nobody has to be told this. You feel 1/12 in your hands and then you see
 * it written down, which is the entire pedagogical trick of the game.
 */

export type Poly = { lane: number; perBar: number };

export type StageSpec = {
  id: number;
  title: string;
  /** The fraction of one bar that this stage's fastest note occupies. */
  glyph: string;
  bpm: number;
  bars: number;
  lanes: 1 | 2 | 3;
  /** Subdivisions of a beat in play. 1 = quarters, 2 = eighths, 3 = triplets, 4 = 16ths. */
  divs: number[];
  density: number;
  poly?: Poly;
  gateEvery: number;
  gateFloor: number;
  /** Which subdivision the bar ruler is ticked at. */
  tickDiv: number;
};

export const STAGES: readonly StageSpec[] = [
  {
    id: 0,
    title: "QUARTERS",
    glyph: "1/4",
    bpm: 84,
    bars: 16,
    lanes: 1,
    divs: [1],
    density: 0.9,
    gateEvery: 8,
    gateFloor: 0.05,
    tickDiv: 1,
  },
  {
    id: 1,
    title: "EIGHTHS",
    glyph: "1/8",
    bpm: 92,
    bars: 16,
    lanes: 2,
    divs: [1, 2],
    density: 0.6,
    gateEvery: 8,
    gateFloor: 0.14,
    tickDiv: 2,
  },
  {
    id: 2,
    title: "TRIPLETS",
    glyph: "1/12",
    bpm: 96,
    bars: 16,
    lanes: 2,
    divs: [1, 3],
    density: 0.55,
    gateEvery: 6,
    gateFloor: 0.24,
    tickDiv: 3,
  },
  {
    id: 3,
    title: "MIXED",
    glyph: "1/8 · 1/12",
    bpm: 100,
    bars: 20,
    lanes: 3,
    divs: [1, 2, 3],
    density: 0.5,
    gateEvery: 6,
    gateFloor: 0.34,
    tickDiv: 2,
  },
  {
    id: 4,
    title: "SIXTEENTHS",
    glyph: "1/16",
    bpm: 104,
    bars: 20,
    lanes: 3,
    divs: [1, 2, 4],
    density: 0.42,
    gateEvery: 6,
    gateFloor: 0.44,
    tickDiv: 4,
  },
  {
    id: 5,
    title: "THREE OVER FOUR",
    glyph: "1/3 : 1/4",
    bpm: 108,
    bars: 20,
    lanes: 3,
    divs: [1, 2],
    density: 0.4,
    poly: { lane: 0, perBar: 3 },
    gateEvery: 6,
    gateFloor: 0.54,
    tickDiv: 4,
  },
  {
    id: 6,
    title: "FIVE OVER FOUR",
    glyph: "1/5 : 1/4",
    bpm: 112,
    bars: 20,
    lanes: 3,
    divs: [1, 2, 4],
    density: 0.38,
    poly: { lane: 0, perBar: 5 },
    gateEvery: 5,
    gateFloor: 0.64,
    tickDiv: 4,
  },
  {
    id: 7,
    title: "EVERYTHING",
    glyph: "1/16 · 1/12 · 1/5",
    bpm: 118,
    bars: 24,
    lanes: 3,
    divs: [1, 2, 3, 4],
    density: 0.42,
    poly: { lane: 2, perBar: 5 },
    gateEvery: 5,
    gateFloor: 0.72,
    tickDiv: 4,
  },
];

/**
 * Right answers that pass a stage.
 *
 * A stage used to end when its bars ran out, which meant the escalation was a
 * wall clock wearing a bar counter: a child who missed every fraction gate for
 * four minutes was still handed sixteenths and five-over-four, and — because
 * `gateFloor` rises with the stage and the host reads it — harder arithmetic
 * too. Surviving twenty bars is not evidence of anything; striking the right
 * fraction is.
 *
 * Half the gates a stage offers, rounded up, and never fewer than one. That is
 * demanding enough to mean something and forgiving enough that one fumbled
 * fraction does not cost a stage — the bars simply come round again, with more
 * gates on them, until the child has shown they can do it.
 */
export function gatesToClear(spec: StageSpec): number {
  const gatesInStage = Math.max(1, Math.floor(spec.bars / spec.gateEvery));
  return Math.max(1, Math.ceil(gatesInStage / 2));
}

/**
 * After the last written stage the game keeps going forever: the hardest shapes
 * come back a little faster each loop, capped so it stays humanly playable.
 */
export function stageAt(index: number): StageSpec {
  if (index < STAGES.length) return STAGES[index]!;
  const loop = Math.floor((index - STAGES.length) / 3) + 1;
  const base = STAGES[5 + ((index - STAGES.length) % 3)]!;
  return {
    ...base,
    id: index,
    title: base.title,
    bpm: Math.min(168, base.bpm + loop * 5),
    bars: 20,
    density: Math.min(0.62, base.density + loop * 0.035),
    gateEvery: 5,
    gateFloor: Math.min(0.95, base.gateFloor + loop * 0.06),
  };
}
