// What COUNTERPOISE asks the host for next.
//
// The game used to call `next()` with nothing in it, which meant the host chose
// from its whole ladder with no idea who was playing. A child opening the game
// for the first time was handed `19 + 70`, then `69 + 20`, then `57 + 40` —
// two-digit column addition on board one, on an apparatus whose entire first
// lesson is "the flat arm is the equals sign". The maths was in the way of the
// idea.
//
// So this file holds one number: where on the host's 0..1 ladder the next board
// should come from. It starts at the very bottom (the curriculum floor is
// `0 + 1`), climbs while boards are being solved first try, and steps back down
// when they are not.
//
// **There is no clock in here and there must never be one.** COUNTERPOISE is
// one of the untimed games and that is deliberate: a child can stand and think
// at a balance for as long as they like. Pacing here means *what is asked*,
// never *how fast*. `errors` is the only input, and an error in this game is
// not a buzzer — it is the beam swinging the way you made it swing.

/** The bottom of the ladder. `0 + 1`, and a child can start there twice. */
export const FLOOR = 0;

/** Nothing above this is asked for. The host clamps anyway; be explicit. */
export const CEILING = 1;

/**
 * How far above the request the host may still serve.
 *
 * `next({ maxDifficulty })` is a standing ceiling on the stream, and it is the
 * part that actually stops the opening board being `19 + 70`: a request alone
 * is answered from whatever is nearest in a pool of up to sixty-four questions,
 * and "nearest" on a cold pool can be a long way off.
 */
export const HEADROOM = 0.12;

/** Clean solves in a row before the ladder starts moving in bigger steps. */
const WARMED_UP = 2;

const STEP_FIRST = 0.02;
const STEP_WARMED = 0.05;
const STEP_DOWN = 0.035;

/** Clean solves in a row that justify never going below here again. */
export const FLOOR_AFTER = 4;

export type Pacing = {
  /** 0..1 on the host's whole ladder. */
  readonly level: number;
  /** Never falls. Raised by a run of clean solves. */
  readonly floor: number;
  /** Consecutive boards solved with no wrong weight at all. */
  readonly streak: number;
};

export function makePacing(level = FLOOR): Pacing {
  return { level: clamp(level), floor: FLOOR, streak: 0 };
}

const clamp = (v: number): number => (v < FLOOR ? FLOOR : v > CEILING ? CEILING : v);

/**
 * One board is over. `errors` is how many wrong weights the child hung on it
 * before the beam went level — zero means they read the board and knew.
 *
 * Down is gentler than up on a warmed-up child and steeper than the first
 * climb, which is the asymmetry that keeps a struggling child near the rung
 * they can do instead of oscillating across it.
 */
export function afterBoard(p: Pacing, errors: number): Pacing {
  if (errors > 0) {
    const drop = STEP_DOWN * Math.min(3, errors);
    return { level: Math.max(p.floor, clamp(p.level - drop)), floor: p.floor, streak: 0 };
  }
  const streak = p.streak + 1;
  const step = streak >= WARMED_UP ? STEP_WARMED : STEP_FIRST;
  const level = clamp(p.level + step);
  // A rung reached by four clean boards in a row is a rung this child owns. The
  // floor goes under it — one board below, so a wobble is still allowed — and
  // never comes back down.
  const floor =
    streak >= FLOOR_AFTER ? Math.max(p.floor, clamp(level - STEP_WARMED * 2)) : p.floor;
  return { level: Math.max(floor, level), floor, streak };
}

/**
 * How far the request drops after a board the pack could not get from the host.
 *
 * A twentieth of the ladder — a little over three of the sixty-six rungs that
 * ship. Enough to walk out of a neighbourhood of content this pack has no picture
 * for, not so far that one refusal throws a child back to counting on fingers.
 */
export const FALLBACK_STEP_DOWN = 0.05;

/**
 * The board was one the host never served and never judged — see `lastResortBoard`.
 *
 * It is a one-move `8 = 2 + □`, so `afterBoard` would read zero errors and climb,
 * and climbing is exactly backwards: the pack could not draw what the child was
 * standing on. Four fallbacks in a row would have pushed a permanent floor into
 * the region this pack has no picture for and pinned the child there, solving
 * `2 + 6` for the rest of the session. So the request steps down, the streak
 * breaks, and the floor is left exactly where it was — a floor is a promise to the
 * host about content the child has *earned*, and nobody earned anything here.
 */
export function afterUnshowableBoard(p: Pacing): Pacing {
  return { level: Math.max(0, p.level - FALLBACK_STEP_DOWN), floor: p.floor, streak: 0 };
}

/**
 * The largest number this game may put on the wire, and why it is not 1.
 *
 * `packs/shared/game-host` reads a difficulty through `toUnit`, which has to
 * serve two scales that are both already in production:
 *
 *     value < 1   →  a fraction of the ladder, used as is
 *     value >= 1  →  a ladder index, (value − 1) / 9
 *
 * so **`toUnit(1)` is 0** — the one ambiguous value, deliberately resolved
 * downward because five of the six ladder games send `1` on their opening
 * question. This game speaks the fraction scale, where 1 means the top, so
 * sending a literal 1 asks for the bottom.
 *
 * That is not a rounding error, it is a trap door. `maxDifficulty` is a
 * *standing* ceiling: a `maxDifficulty: 1` is stored as `ceiling = 0`, the
 * target is then clamped to it, the prefetch pool is flushed, and every
 * question from then on comes from the very bottom of the curriculum — for a
 * child who had just answered nineteen boards in a row correctly, with no way
 * back, because every later request carries the same 1.
 *
 * So nothing this file emits is ever exactly 1. The gap is far below one rung
 * of anything (the host's own ladder is ten wide), so the top of the ladder is
 * still reachable.
 */
export const MAX_ON_THE_WIRE = 0.999;

/** Any 0..1 ladder position, made safe to hand to the host. */
export function onTheWire(v: number): number {
  return Math.min(MAX_ON_THE_WIRE, clamp(v));
}

/** The request `next()` is called with. */
export function request(p: Pacing): { difficulty: number; maxDifficulty: number } {
  return { difficulty: onTheWire(p.level), maxDifficulty: onTheWire(p.level + HEADROOM) };
}
