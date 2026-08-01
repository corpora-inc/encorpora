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

/**
 * The ladder, and why it is so much longer at two lanes than it used to be.
 *
 * The founder: *"pulse should stay a bit easier a bit longer. I think 2 lanes is
 * probably enough … idk maybe people can do three but that is very advanced IMO.
 * it can stay sparse for longer."*
 *
 * A third lane is a third hand. It arrived at stage 3, about two minutes in, on
 * nothing more than having survived the bars — and once it was there the density
 * had to carry three lanes, so the sparse opening was over before the child had
 * met triplets. **Two lanes now carry the entire written ladder**, through
 * triplets, sixteenths and both polyrhythms, which is every idea the game has to
 * teach. The third lane exists only past the end of it (see `stageAt`), and
 * `readyForMoreLanes` says nobody is handed one for turning up.
 *
 * The densities are the new kind — expected notes per bar over slots per bar,
 * see `packs/shared/game-soundscape/groove.ts` — so they are not comparable with
 * the old numbers and are deliberately far below them.
 */
export const STAGES: readonly StageSpec[] = [
  {
    id: 0,
    title: "QUARTERS",
    glyph: "1/4",
    bpm: 80,
    bars: 12,
    lanes: 1,
    divs: [1],
    // Four instants in the bar and one of them is the downbeat, so this reads
    // higher than every stage above it and is still the sparsest bar in the
    // game: about two and a half notes a bar at 80 BPM, a note every 1.2 s.
    density: 0.65,
    gateEvery: 6,
    gateFloor: 0.05,
    tickDiv: 1,
  },
  {
    id: 1,
    title: "OFFBEATS",
    glyph: "1/8",
    bpm: 84,
    bars: 14,
    lanes: 1,
    divs: [1, 2],
    density: 0.3,
    gateEvery: 6,
    gateFloor: 0.1,
    tickDiv: 2,
  },
  {
    id: 2,
    title: "TWO HANDS",
    glyph: "1/8",
    bpm: 88,
    bars: 16,
    lanes: 2,
    divs: [1, 2],
    density: 0.34,
    gateEvery: 6,
    gateFloor: 0.17,
    tickDiv: 2,
  },
  {
    id: 3,
    title: "TRIPLETS",
    glyph: "1/12",
    bpm: 92,
    bars: 16,
    lanes: 2,
    divs: [1, 3],
    density: 0.28,
    gateEvery: 6,
    gateFloor: 0.25,
    tickDiv: 3,
  },
  {
    id: 4,
    title: "MIXED",
    glyph: "1/8 · 1/12",
    bpm: 96,
    bars: 18,
    lanes: 2,
    divs: [1, 2, 3],
    density: 0.26,
    gateEvery: 6,
    gateFloor: 0.34,
    tickDiv: 2,
  },
  {
    id: 5,
    title: "SIXTEENTHS",
    glyph: "1/16",
    bpm: 100,
    bars: 18,
    lanes: 2,
    divs: [1, 2, 4],
    density: 0.26,
    gateEvery: 6,
    gateFloor: 0.44,
    tickDiv: 4,
  },
  {
    id: 6,
    title: "THREE OVER FOUR",
    glyph: "1/3 : 1/4",
    bpm: 104,
    bars: 20,
    lanes: 2,
    divs: [1, 2],
    // A polyrhythm owns a whole lane, so the OTHER hand is the only place a
    // grid note can go — this reads higher than its neighbours and still
    // produces a sparser bar than they do.
    density: 0.34,
    poly: { lane: 0, perBar: 3 },
    gateEvery: 6,
    gateFloor: 0.54,
    tickDiv: 4,
  },
  {
    id: 7,
    title: "FIVE OVER FOUR",
    glyph: "1/5 : 1/4",
    bpm: 108,
    bars: 20,
    lanes: 2,
    divs: [1, 2, 4],
    // Five against four is already 2.3 strikes a second in one thumb. What the
    // other hand is asked for on top of that stays close to nothing.
    density: 0.12,
    poly: { lane: 0, perBar: 5 },
    gateEvery: 5,
    gateFloor: 0.63,
    tickDiv: 4,
  },
  {
    id: 8,
    title: "EVERYTHING",
    glyph: "1/16 · 1/12 · 1/5",
    bpm: 112,
    bars: 24,
    lanes: 2,
    divs: [1, 2, 3, 4],
    density: 0.12,
    poly: { lane: 0, perBar: 5 },
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
 * The accuracy a run must be holding before it is handed another lane.
 *
 * A lane is a hand, not a difficulty setting, and *"three is very advanced"*.
 * Bars are how a stage is paced and right answers are how it is passed — but
 * neither of those says anything about whether the child can currently keep two
 * hands going, which is the exact skill a third lane assumes. So the third lane
 * is bought with hit accuracy, and a run that is not holding this simply keeps
 * playing the two-lane stage. Nothing ends, nothing scolds, and no clock is
 * involved anywhere in the decision.
 */
export const LANE_UP_ACCURACY = 0.88;

/**
 * May this run take a stage with more lanes than the one it is on?
 *
 * A pure function of what the child has actually done. Called only when the
 * next stage is wider than the current one; a stage that is no wider is passed
 * on gates alone, exactly as before.
 */
export function readyForMoreLanes(evidence: {
  accuracy: number;
  stageGatesCorrect: number;
  gatesToClear: number;
}): boolean {
  if (!(evidence.accuracy >= LANE_UP_ACCURACY)) return false;
  // One gate past what the stage asked for. "I can pass this" is the bar for
  // moving on; "I can pass this comfortably" is the bar for growing a hand.
  return evidence.stageGatesCorrect >= evidence.gatesToClear + 1;
}

/**
 * After the last written stage the game keeps going forever: the hardest shapes
 * come back a little faster each loop, capped so it stays humanly playable.
 *
 * This is also **the only place a third lane exists**. Reaching it means having
 * cleared all nine written stages on their gates, which is every subdivision and
 * both polyrhythms; and taking it also means passing `readyForMoreLanes`, so it
 * is reached by demonstrated competence and never by having been here a while.
 */
export function stageAt(index: number): StageSpec {
  if (index < STAGES.length) return STAGES[index]!;
  const loop = Math.floor((index - STAGES.length) / 3) + 1;
  const base = STAGES[STAGES.length - 3 + ((index - STAGES.length) % 3)]!;
  return {
    ...base,
    id: index,
    title: base.title,
    lanes: 3,
    bpm: Math.min(168, base.bpm + loop * 5),
    bars: 20,
    density: Math.min(0.46, base.density + loop * 0.03),
    gateEvery: 5,
    gateFloor: Math.min(0.95, base.gateFloor + loop * 0.06),
  };
}
