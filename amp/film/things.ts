/**
 * Real things to count in a lesson film: apples, ducks, cars, pencils. The
 * drawings and arrangements are the app's (`things` scene component); this
 * module plans what they do in a film.
 *
 * Things sit in groups. A group is a fixed set of places (a row, a grid, a
 * tidy scatter, or the cells of a five- or ten-frame), so nothing shifts when
 * a thing comes, goes or is lit. Each thing keeps its name (`a1`, `a2`, …)
 * wherever it goes. A film can make things arrive one by one, count along
 * (each thing lights exactly as its number is said), send things to another
 * group (joining, taking away, sharing) and make things leave.
 *
 * Everything here is pure: the plan is built once from the screenplay's
 * actions, and `stateAt` is a function of time alone, so any frame can be
 * drawn by itself. A light does not move a thing: the stage grows it about its
 * own centre, the way a highlight grows, and a counted thing may keep a tick.
 */
import {
  isThingKind,
  rowOf,
  scatterOf,
  thingKinds,
  thingName,
  type ThingKind,
} from "../src/math/scene/components/things-art";

export type P = [number, number];
/** A place a thing can sit: place `slot` (from 0) of a group. */
export type Seat = { group: string; slot: number };

const clamp = (u: number) => (u < 0 ? 0 : u > 1 ? 1 : u);
/** The stage's ease: quick to start, long settle. */
const ease = (u: number) => {
  u = clamp(u);
  return u * u * u * (u * (u * 6 - 15) + 10);
};

// ------------------------------------------------------------------ number words
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
/** 7 is "seven", 21 is "twenty-one", up to one hundred. */
export function numberWord(v: number): string {
  if (!Number.isInteger(v) || v < 0 || v > 100) throw new Error(`No counting word for ${v}`);
  if (v < 20) return ONES[v]!;
  if (v === 100) return "one hundred";
  return TENS[Math.floor(v / 10)]! + (v % 10 ? `-${ONES[v % 10]}` : "");
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const VALUE = new Map<string, number>();
for (let v = 0; v < 100; v++) VALUE.set(norm(numberWord(v)), v);
VALUE.set("hundred", 100);
VALUE.set("onehundred", 100);

export type Word = { text: string; start: number };
/** Every counting word in a beat, in order: its number, when it starts and which word it is. "twenty one" as two words is one number. */
export function numbersIn(words: Word[]): { value: number; start: number; index: number }[] {
  const out: { value: number; start: number; index: number }[] = [];
  for (let i = 0; i < words.length; i++) {
    const a = norm(words[i]!.text), b = i + 1 < words.length ? norm(words[i + 1]!.text) : "";
    const two = b ? VALUE.get(a + b) : undefined;
    // "twenty" then "one": one number, said as two words ("one hundred" too)
    if (two !== undefined && two > 20 && two % 10 !== 0 && VALUE.has(a) && (VALUE.get(a)! % 10 === 0)) { out.push({ value: two, start: words[i]!.start, index: i }); i++; continue; }
    if (a === "one" && b === "hundred") { out.push({ value: 100, start: words[i]!.start, index: i }); i++; continue; }
    const v = VALUE.get(a);
    if (v !== undefined) out.push({ value: v, start: words[i]!.start, index: i });
  }
  return out;
}

/** A count found in a beat's words: when each number is said, from `from` up for as long as the voice goes on. */
export type CountRun = { from: number; times: number[] };
/**
 * The count the voice makes in one beat, starting at the number `from`: each
 * following number in order, wherever it comes in the sentence. Without `at`,
 * the count starts at the last "one" before "two" ("Count one by one: one,
 * two, three" starts at the third "one").
 */
export function countRun(words: Word[], from = 1, at?: string, nth = 1): CountRun {
  const nums = numbersIn(words);
  const said = words.map((w) => w.text).join(" ");
  const runFrom = (k: number) => {
    const picked = [nums[k]!];
    for (let j = k + 1; j < nums.length; j++) if (nums[j]!.value === picked[picked.length - 1]!.value + 1) picked.push(nums[j]!);
    return picked;
  };
  let start = -1;
  if (at !== undefined) {
    const hits = words.map((w, i) => ({ w, i })).filter(({ w }) => norm(w.text) === norm(at));
    const hit = hits[nth - 1];
    if (!hit) throw new Error(`count: the word "${at}"${nth > 1 ? ` (occurrence ${nth})` : ""} is not in: ${said}`);
    start = nums.findIndex((x) => x.index === hit.i);
    if (start < 0 || nums[start]!.value !== from)
      throw new Error(`count: "at" must be the first number counted, "${numberWord(from)}", not "${at}". (Counting on from another number? Give "from".)`);
  } else {
    let best = 0;
    nums.forEach((x, k) => {
      if (x.value !== from) return;
      const len = runFrom(k).length;
      if (len >= best) { best = len; start = k; }
    });
    if (start < 0) throw new Error(`count: the voice never says "${numberWord(from)}" in: ${said}`);
  }
  return { from, times: runFrom(start).map((x) => x.start) };
}

// ------------------------------------------------------------------ groups
export type Arrange = "row" | "grid" | "scatter";
export type GroupSpec = {
  id: string;
  /** The things it starts with, in order. Empty: a place waiting for things. */
  kinds: ThingKind[];
  /** How many places it has. */
  slots: number;
  /** Its things are on screen when the shot starts. */
  start: boolean;
};
/** Where a free group's places are: centres from its top-left corner, x right and y DOWN, in the figure's units. */
export type GroupLayout = { slots: P[]; w: number; h: number; thing: number };
export const DEFAULT_SIZE = 2;
/** `size` is one thing's width in the figure's units. */
export function groupLayout(spec: { id: string; arrange?: Arrange; slots: number; perRow?: number; seed?: string; size?: number }): GroupLayout {
  const size = spec.size ?? DEFAULT_SIZE;
  const a =
    spec.arrange === "scatter" ? scatterOf(spec.slots, spec.seed ?? spec.id, spec.perRow)
    : rowOf(spec.slots, spec.arrange === "grid" ? (spec.perRow ?? 5) : (spec.perRow ?? spec.slots));
  return { slots: a.slots.map(([x, y]): P => [x * size, y * size]), w: a.w * size, h: a.h * size, thing: size };
}
/** A thing in a grid cell is this much of the cell's shorter side: it and its light sit inside the box. */
export const IN_CELL = 0.8;
/** A light's ring, as a fraction of the thing's width: inside the thing's own place, so a light never changes the picture's size. */
export const LIGHT_R = 0.54;

// ------------------------------------------------------------------ the plan
const DUR = { show: 0.4, hide: 0.35, arrive: 0.5, leave: 0.45, send: 0.9 };
/** Seconds between things when several arrive, leave or are sent by one action. */
const STEP = { arrive: 0.26, leave: 0.26, send: 0.34 };
/** The highlight's short ease, in and out (stage.ts EMPH_IN / EMPH_OUT). */
const LIGHT_UP = 0.2, LIGHT_DOWN = 0.22, HOLD = 0.35, RELEASE = 0.35;
/** The last thing counted where it sits takes its tick this long after its number starts: a short moment after its light has landed. */
const LAST_TICK = 0.45;
/**
 * When a count's lights and ticks let go (the `beatEnd` its plan is given): the
 * end of the beat's speech, or, when the beat has its own `pause`, the end of
 * that pause, so the counted row stays up through the silence with the last
 * thing still lit. It never holds into what comes next: the release starts by
 * `next`, the next beat's first word or the end of the shot.
 */
export function countHold(end: number, pause: number | undefined, next = Infinity): number {
  if (!pause) return end;
  return Math.max(end, Math.min(end + pause, next - HOLD));
}

/** A leaving thing that drifts: the direction it goes (x right, y up, unit length). */
type Vis = { t0: number; dur: number; on: boolean; moved: boolean; drift?: [number, number] };
type Hop = { t0: number; dur: number; seat: Seat };
/** Lit from t0 to t1. `tick`: when a thing counted where it sits takes its small muted tick, which it keeps until the beat is over (`end`); null for none. */
type Light = { t0: number; t1: number; end: number; tick: number | null };
type Thing = { name: string; kind: ThingKind; home: Seat; start: boolean; vis: Vis[]; hops: Hop[]; lights: Light[] };

export type ThingState = {
  /** It is between these two seats, `u` of the way (eased). At rest they are the same seat. */
  from: Seat; to: Seat; u: number;
  /** In flight: drawn above the others. */
  flying: boolean; flightStart: number;
  /** Opacity. */
  o: number;
  /** How far a leaving thing has drifted from its place, in its own widths (x right, y up); [0, 0] for any other. */
  drift: [number, number];
  /** 1 as an arrival begins or a leaving ends, 0 in place: the stage shrinks and lifts it a little, inside its own place. */
  pose: number;
  /** How much it counts toward its group: 1 once it starts to arrive, 0 once it starts to leave, its opacity through a plain fade. */
  present: number;
  /** How lit it is (one thing at a time in a count), and the small muted tick once it has been counted. The stage draws the light as a highlight. */
  lit: number; mark: number;
};

type On = { target: string | string[]; dur?: number };
export type ThingAction =
  | ({ do: "show" } & On) | ({ do: "hide" } & On) | ({ do: "highlight" } & On) | ({ do: "arrive" } & On) | ({ do: "leave"; toward?: Toward } & On)
  | ({ do: "count"; from?: number; to?: number; into?: string } & On)
  | ({ do: "send"; to: string | string[] } & On);
export type Toward = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const TOWARD: Record<Toward, [number, number]> = {
  n: [0, 1], s: [0, -1], e: [1, 0], w: [-1, 0],
  ne: [Math.SQRT1_2, Math.SQRT1_2], nw: [-Math.SQRT1_2, Math.SQRT1_2], se: [Math.SQRT1_2, -Math.SQRT1_2], sw: [-Math.SQRT1_2, -Math.SQRT1_2],
};
/** How far a thing that leaves "toward" a direction drifts, in its own widths, and how long that takes. */
export const DRIFT = { widths: 1.6, dur: 1 };
export type ActionTiming = { t0: number; beatEnd: number; run?: CountRun };

const list = (x: string | string[]) => (Array.isArray(x) ? x : [x]);
const names = (xs: string[]) => (xs.length <= 6 ? xs.join(", ") : `${xs.slice(0, 3).join(", ")}, …, ${xs[xs.length - 1]}`);

export class ThingsModel {
  groups = new Map<string, GroupSpec>();
  things = new Map<string, Thing>();
  /** While planning: who sits where, and who is on screen. */
  private seat = new Map<string, Seat | null>();
  private shown = new Map<string, boolean>();
  private busyUntil = new Map<string, number>();

  constructor(groups: GroupSpec[]) {
    for (const g of groups) {
      if (this.groups.has(g.id)) throw new Error(`things ${g.id}: two groups have this name.`);
      if (g.kinds.length > g.slots) throw new Error(`things ${g.id}: ${g.kinds.length} things do not fit ${g.slots} places. Give "slots" at least ${g.kinds.length}.`);
      this.groups.set(g.id, g);
    }
    for (const g of groups) {
      g.kinds.forEach((kind, k) => {
        const name = `${g.id}${k + 1}`;
        if (this.things.has(name) || this.groups.has(name)) throw new Error(`things ${g.id}: the name ${name} is used twice. Rename one group so no thing's name is another's (a1 and a11 are fine; "a" and "a1" as two groups are not).`);
        const home = { group: g.id, slot: k };
        this.things.set(name, { name, kind, home, start: g.start, vis: [], hops: [], lights: [] });
        this.seat.set(name, home);
        this.shown.set(name, g.start);
      });
    }
  }
  /** A group, a thing, or a place of a group ("line.5": whatever sits in the fifth place of line at that moment). */
  has(name: string) { return this.things.has(name) || this.groups.has(name) || this.groups.has(name.replace(/\.\d+$/, "")); }
  isThing(name: string) { return this.things.has(name); }

  /** The things sitting in a group now (while planning), in the order of their places. */
  members(group: string): string[] {
    return [...this.seat.entries()].filter(([, s]) => s?.group === group).sort((a, b) => a[1]!.slot - b[1]!.slot).map(([n]) => n);
  }
  /** Names a group (the things in it now) or things. */
  resolve(target: string | string[], what: string): string[] {
    return list(target).flatMap((n) => {
      if (this.groups.has(n)) return this.members(n);
      if (this.things.has(n)) return [n];
      const place = n.match(/^(.+)\.(\d+)$/);
      if (place && this.groups.has(place[1]!)) {
        const hit = [...this.seat.entries()].find(([, s]) => s?.group === place[1] && s.slot === Number(place[2]) - 1);
        if (!hit) throw new Error(`${what}: place ${place[2]} of ${place[1]} is empty. ${place[1]} holds ${names(this.members(place[1]!)) || "nothing"} at that moment.`);
        return [hit[0]];
      }
      const g = [...this.groups.keys()].filter((id) => n.startsWith(id)).sort((a, b) => b.length - a.length)[0];
      const own = g ? [...this.things.keys()].filter((x) => this.things.get(x)!.home.group === g) : [];
      throw new Error(`${what}: there is no thing or group named "${n}".${g ? ` Group ${g} has ${own.length ? names(own) : "no things of its own"}.` : ` Groups: ${[...this.groups.keys()].join(", ") || "none"}.`}`);
    });
  }
  private freeSlot(group: string, what: string) {
    const g = this.groups.get(group);
    if (!g) throw new Error(`${what}: "${group}" is not a group of things. Groups: ${[...this.groups.keys()].join(", ")}.`);
    const taken = new Set(this.members(group).map((n) => this.seat.get(n)!.slot));
    for (let k = 0; k < g.slots; k++) if (!taken.has(k)) return k;
    throw new Error(`${what}: group ${group} is full (${g.slots} places). Give it more "slots".`);
  }
  private vis(name: string, t0: number, dur: number, on: boolean, moved: boolean, drift?: [number, number]) {
    this.things.get(name)!.vis.push({ t0, dur, on, moved, drift });
    this.shown.set(name, on);
  }
  private hop(name: string, to: string, t0: number, dur: number, what: string) {
    if (this.seat.get(name)?.group === to) throw new Error(`${what}: ${name} is already in ${to}.`);
    const seat = { group: to, slot: this.freeSlot(to, what) };
    // one move at a time: a thing still in flight sets off again when it lands
    const start = Math.max(t0, this.busyUntil.get(name) ?? -Infinity);
    this.things.get(name)!.hops.push({ t0: start, dur, seat });
    this.seat.set(name, seat);
    this.busyUntil.set(name, start + dur);
  }

  /** Plan one action. Actions must be applied in the order they start. Returns how long the action lasts in all. */
  apply(a: ThingAction, tm: ActionTiming): number {
    const { t0, beatEnd } = tm;
    if (a.do === "show" || a.do === "hide") {
      const dur = a.dur ?? DUR[a.do];
      for (const n of this.resolve(a.target, a.do)) this.vis(n, t0, dur, a.do === "show", false);
      return dur;
    }
    if (a.do === "highlight") {
      for (const n of this.resolve(a.target, a.do)) this.things.get(n)!.lights.push({ t0, t1: beatEnd + HOLD, end: beatEnd, tick: null });
      return a.dur ?? LIGHT_UP;
    }
    if (a.do === "arrive" || a.do === "leave") {
      const toward = a.do === "leave" ? a.toward : undefined;
      const dur = a.dur ?? (toward ? DRIFT.dur : DUR[a.do]), who = this.resolve(a.target, a.do);
      const todo = who.filter((n) => this.shown.get(n) !== (a.do === "arrive"));
      if (!todo.length) throw new Error(`${a.do}: ${names(who) || "the group"} ${who.length ? (a.do === "arrive" ? "is already on screen" : "is not on screen") : "has no things"}. ${a.do === "arrive" ? 'Things arrive when their group does not have "start": true and they have not been shown.' : ""}`.trim());
      todo.forEach((n, k) => {
        this.vis(n, t0 + k * STEP[a.do], dur, a.do === "arrive", true, toward ? TOWARD[toward] : undefined);
        if (a.do === "leave") this.seat.set(n, null);
      });
      return dur + (todo.length - 1) * STEP[a.do];
    }
    if (a.do === "send") {
      const dur = a.dur ?? DUR.send, who = this.resolve(a.target, "send"), to = list(a.to);
      if (!who.length) throw new Error(`send: ${list(a.target).join(", ")} has no things to send.`);
      who.forEach((n, k) => this.hop(n, to[k % to.length]!, t0 + k * STEP.send, dur, "send"));
      return dur + (who.length - 1) * STEP.send;
    }
    // count: each thing lights as its number is said; a thing not yet on screen arrives on its number; with "into" it is sent there on its number
    const from = a.from ?? 1, run = tm.run;
    if (!run) throw new Error("count: no timing for the counted words.");
    const all = list(a.target).length === 1 && this.groups.has(list(a.target)[0]!) ? this.members(list(a.target)[0]!) : null;
    let who: string[];
    if (all && from - 1 < all.length) {
      // a group: the count picks up at its thing number `from` (a count carried on from an earlier beat)
      who = all.slice(from - 1, a.to === undefined ? undefined : a.to);
    } else if (all) {
      // a smaller group: its things take the numbers from `from` on (three more cookies are "eight, nine, ten")
      who = a.to === undefined ? all : all.slice(0, Math.max(0, a.to - from + 1));
    } else who = this.resolve(a.target, "count");
    if (!who.length) throw new Error(`count: nothing to count in ${list(a.target).join(", ")}.`);
    const last = from + who.length - 1;
    if (a.to !== undefined && a.to !== last) throw new Error(`count: "to" is ${a.to}, but ${who.length} things counted from ${from} end on ${last}.`);
    const heard = run.times.length, saidTo = from + heard - 1;
    if (heard < who.length)
      throw new Error(`count: the voice counts to ${numberWord(saidTo)}, but ${who.length} things are counted (${names(who)}), to ${numberWord(last)}. Say every number in this beat, or count fewer things: give "to": ${saidTo}${all ? "" : " or list fewer things"}.`);
    if (heard > who.length && a.to === undefined)
      throw new Error(`count: the voice goes on to ${numberWord(last + 1)}, but only ${who.length} things are counted (${names(who)}). Count that thing too, or, if "${numberWord(last + 1)}" is not part of the count, give "to": ${last}.`);
    const dur = a.dur ?? (a.into ? DUR.send : DUR.arrive);
    who.forEach((n, k) => {
      const t = run.times[k]!, next = k + 1 < who.length ? run.times[k + 1]! : beatEnd + HOLD;
      // arriving, or sliding into another group, is itself the mark that a thing has been counted; one counted where it sits takes a tick
      const stays = !!this.shown.get(n) && !a.into;
      if (!this.shown.get(n)) this.vis(n, t, DUR.arrive, true, true);
      if (a.into) this.hop(n, a.into, t, dur, "count");
      // the tick comes as the light moves on to the next thing. The last thing counted keeps the light to the
      // end of the beat (the last number tells how many) and takes its tick a short moment after the light lands,
      // early enough to be fully drawn before the ticks release.
      const tick = !stays ? null : k + 1 < who.length ? next : Math.min(t + LAST_TICK, beatEnd + HOLD - LIGHT_DOWN);
      this.things.get(n)!.lights.push({ t0: t, t1: next, end: beatEnd, tick });
    });
    return run.times[who.length - 1]! - t0 + dur;
  }

  /** A thing at time t. */
  stateAt(name: string, t: number): ThingState {
    const th = this.things.get(name);
    if (!th) throw new Error(`No thing named ${name}`);
    let from = th.home, to = th.home, u = 1, flying = false, flightStart = -Infinity;
    for (const h of th.hops) {
      if (t < h.t0) break;
      from = to; to = h.seat; u = ease((t - h.t0) / h.dur);
      flying = t < h.t0 + h.dur; flightStart = h.t0;
    }
    let o = th.start ? 1 : 0, pose = 0, present = o, drift: [number, number] = [0, 0];
    for (const v of th.vis) {
      if (t < v.t0) break;
      const k = ease((t - v.t0) / v.dur);
      o = o + ((v.on ? 1 : 0) - o) * k;
      pose = v.moved ? (v.on ? 1 - k : k) : 0;
      // a thing that leaves toward a direction keeps going that way while it fades, and stays gone
      drift = v.drift && !v.on ? [v.drift[0] * k, v.drift[1] * k] : [0, 0];
      // it counts from the moment it starts to arrive, and stops counting the moment it starts to leave
      present = v.moved ? (v.on ? 1 : 0) : o;
    }
    let lit = 0, mark = 0;
    // the highlight's short ease; snap the ends so a light is fully on or off, not 0.999
    const ramp = (t0: number, dur: number) => ((t - t0) / dur >= 1 - 1e-6 ? 1 : ease(clamp((t - t0) / dur)));
    for (const l of th.lights) {
      if (t < l.t0) continue;
      const up = ramp(l.t0, LIGHT_UP);
      // in a count the light leaves one thing exactly as fast as it lands on the next: never two lit at once
      const downDur = l.t1 < l.end + HOLD - 1e-6 ? LIGHT_UP : LIGHT_DOWN;
      const down = ramp(l.t1, downDur);
      lit = Math.max(lit, Math.min(up, 1 - down));
      // the tick comes in on the light's short ease and releases with the others when the beat is over
      if (l.tick !== null) mark = Math.max(mark, Math.min(clamp((t - l.tick) / LIGHT_DOWN), 1 - clamp((t - l.end - HOLD) / RELEASE)));
    }
    return { from, to, u, flying, flightStart, o, drift, pose, present, lit, mark };
  }
  /**
   * Where every thing belongs at time t, and how much it counts (0 to 1). A
   * thing belongs to the group it is going to from the moment it sets off, so
   * a live count ticks as the voice says the number, not when the thing lands.
   */
  seatedAt(t: number): { name: string; seat: Seat; o: number }[] {
    return [...this.things.keys()].map((name) => {
      const s = this.stateAt(name, t);
      return { name, seat: s.to, o: s.present };
    });
  }
  /** How many things a group holds at time t. */
  countAt(group: string, t: number) {
    return this.seatedAt(t).filter((s) => s.seat.group === group && s.o >= 0.5).length;
  }
  /** True while a thing is arriving, leaving or in flight. A light is not motion. */
  movingAt(t: number) {
    const hit = (t0: number, dur: number) => t >= t0 - 0.03 && t <= t0 + dur + 0.03;
    for (const th of this.things.values()) {
      if (th.vis.some((v) => v.moved && hit(v.t0, v.dur))) return true;
      if (th.hops.some((h) => hit(h.t0, h.dur))) return true;
    }
    return false;
  }
  /** Moments the shot's frame must include: an arrival, a flight, a leaving, and a light fully on. */
  sampleTimes(): number[] {
    const out: number[] = [];
    for (const th of this.things.values()) {
      for (const v of th.vis) if (v.moved) out.push(v.t0 + Math.min(0.12, v.dur * 0.35), v.t0 + v.dur);
      for (const h of th.hops) out.push(h.t0 + h.dur * 0.5, h.t0 + h.dur);
      for (const l of th.lights) out.push(l.t0 + LIGHT_UP);
    }
    return out;
  }
  /** When things change, so a render draws every frame of it. */
  ranges(): [number, number][] {
    const out: [number, number][] = [];
    for (const th of this.things.values()) {
      for (const v of th.vis) out.push([v.t0 - 0.02, v.t0 + v.dur + 0.02]);
      for (const h of th.hops) out.push([h.t0 - 0.02, h.t0 + h.dur + 0.02]);
      for (const l of th.lights) {
        out.push([l.t0 - 0.02, l.t0 + LIGHT_UP + 0.02], [l.t1 - 0.02, l.t1 + LIGHT_DOWN + 0.02], [l.end + HOLD - 0.02, l.end + HOLD + RELEASE + 0.02]);
        // the last counted thing's tick comes while its light holds
        if (l.tick !== null && l.tick !== l.t1) out.push([l.tick - 0.02, l.tick + LIGHT_DOWN + 0.02]);
      }
    }
    return out;
  }
}

// ------------------------------------------------------------------ the --dry check
const THING_ACTIONS = new Set(["arrive", "count", "send", "leave"]);
/** A things part of a screenplay as a group, or what is wrong with it. `grids` maps each grid's id to its number of cells. */
export function groupOf(p: Record<string, unknown>, grids: Map<string, number>): GroupSpec | string {
  const id = String(p.id);
  const raw = p.things;
  const given = Array.isArray(raw) ? raw : [raw];
  for (const k of given)
    if (!isThingKind(k)) return `things ${id}: "${String(k)}" is not a kind of thing. Kinds: ${thingKinds.join(", ")}.`;
  let kinds: ThingKind[];
  if (Array.isArray(raw)) {
    if (p.n !== undefined && p.n !== raw.length) return `things ${id}: "things" lists ${raw.length} kinds but "n" is ${String(p.n)}. Leave "n" out when you list each thing's kind.`;
    kinds = raw as ThingKind[];
  } else {
    if (typeof p.n !== "number" || !Number.isInteger(p.n) || p.n < 0 || p.n > 20) return `things ${id}: give "n", how many ${thingName(raw as ThingKind, 2)} (0 to 20). An empty group that things are sent to has "n": 0.`;
    kinds = Array.from({ length: p.n }, () => raw as ThingKind);
  }
  const hasAt = typeof p.at === "string", hasIn = typeof p.in === "string";
  if (hasAt === hasIn) return `things ${id}: give "at" (the top-left corner of a row, grid or scatter) or "in" (a grid's id: a five- or ten-frame), not ${hasAt ? "both" : "neither"}.`;
  let slots = typeof p.slots === "number" ? p.slots : Math.max(1, kinds.length);
  if (hasIn) {
    const cells = grids.get(p.in as string);
    if (cells === undefined) return `things ${id}: there is no grid named "${String(p.in)}". "in" names a grid part: a ten-frame is { "grid": [5, 2] }.`;
    const first = typeof p.from === "number" ? p.from : 1;
    if (typeof p.slots !== "number") slots = cells - first + 1;
    if (first + slots - 1 > cells) return `things ${id}: places ${first} to ${first + slots - 1} do not fit grid ${String(p.in)}, which has ${cells} cells.`;
    for (const key of ["arrange", "perRow", "seed", "size"]) if (p[key] !== undefined) return `things ${id}: "${key}" is for a group placed with "at". In a grid, the cells are the places.`;
  } else {
    if (p.from !== undefined) return `things ${id}: "from" is the first cell of a group "in" a grid.`;
    if (!kinds.length && typeof p.slots !== "number") return `things ${id}: an empty group needs "slots", how many things it has room for.`;
  }
  if (kinds.length > slots) return `things ${id}: ${kinds.length} things do not fit ${slots} places. Give "slots" at least ${kinds.length}.`;
  return { id, kinds, slots, start: p.start === true };
}

/**
 * Misuse of things in a screenplay, found without a browser or a voice: an
 * unknown kind, a count whose words do not match the things counted, a thing
 * that does not exist, a group with no room. Works on the raw JSON, so it can
 * say what is wrong before the schema does.
 */
export function thingsProblems(script: unknown): string[] {
  const out: string[] = [];
  const shots = (script as { shots?: unknown })?.shots;
  if (!Array.isArray(shots)) return out;
  shots.forEach((shot: any, si: number) => {
    const where = `Shot ${si + 1}`;
    const parts: any[] = Array.isArray(shot?.figure?.parts) ? shot.figure.parts : [];
    const beats: any[] = Array.isArray(shot?.beats) ? shot.beats : [];
    const grids = new Map<string, number>();
    for (const p of parts) if (Array.isArray(p?.grid)) grids.set(String(p.id), Number(p.grid[0]) * Number(p.grid[1]));
    const specs: GroupSpec[] = [];
    let bad = false;
    for (const p of parts) {
      if (!p || typeof p !== "object" || !("things" in p)) continue;
      const g = groupOf(p, grids);
      if (typeof g === "string") { out.push(`${where}: ${g}`); bad = true; } else specs.push(g);
    }
    const uses = beats.some((b) => (b?.do ?? []).some((a: any) => THING_ACTIONS.has(a?.do)));
    if (!specs.length && !bad) {
      if (uses) out.push(`${where}: "arrive", "count", "send" and "leave" act on things, but this shot's figure has no things part.`);
      return;
    }
    if (bad) return;
    let model: ThingsModel;
    try { model = new ThingsModel(specs); } catch (e) { out.push(`${where}: ${(e as Error).message}`); return; }
    const other = new Set([...Object.keys(shot.figure?.points ?? {}), ...parts.filter((p) => !("things" in p)).map((p) => String(p.id))]);
    for (const n of [...model.groups.keys(), ...model.things.keys()])
      if (other.has(n)) out.push(`${where}: "${n}" names both a thing and a point or another part. Rename one.`);
    let clock = 0;
    beats.forEach((b, bi) => {
      // the stage's order: each action at its word; time here is the word's place in the sentence
      const words: Word[] = String(b?.say ?? "").split(/\s+/).filter(Boolean).map((text, i) => ({ text, start: clock + i }));
      const end = clock + Math.max(1, words.length);
      const planned: { a: any; t0: number; run?: CountRun }[] = [];
      let stagger = 0;
      for (const a of Array.isArray(b?.do) ? b.do : []) {
        if (!a || typeof a !== "object") continue;
        const targets = list(a.target ?? []).filter((n: unknown): n is string => typeof n === "string");
        const onThings = THING_ACTIONS.has(a.do) || (["show", "hide", "highlight", "draw"].includes(a.do) && targets.some((n) => model.has(n)));
        if (!onThings) {
          if (["move", "turn", "flip", "slide"].includes(a.do)) {
            const hit = [...Object.keys(a.points ?? {}), ...targets].find((n) => model.has(n));
            if (hit) out.push(`${where}, beat ${bi + 1}: "${a.do}" cannot move ${hit}, which is a thing. Use { "do": "send", "target": "${hit}", "to": "<group>" }.`);
          }
          continue;
        }
        try {
          let t0 = clock + stagger, run: CountRun | undefined;
          if (a.do === "count") { run = countRun(words, a.from ?? 1, a.at, a.nth); t0 = run.times[0]!; }
          else if (typeof a.at === "string") {
            const hit = words.filter((w) => norm(w.text) === norm(a.at))[(a.nth ?? 1) - 1];
            if (hit) t0 = hit.start;
          } else stagger += 0.1;
          planned.push({ a, t0, run });
        } catch (e) { out.push(`${where}, beat ${bi + 1}: ${(e as Error).message}`); }
      }
      for (const { a, t0, run } of planned.sort((x, y) => x.t0 - y.t0)) {
        try {
          const targets = list(a.target ?? []);
          if (!THING_ACTIONS.has(a.do)) {
            // show, hide, highlight: only the names that are things
            const mine = targets.filter((n) => model.has(n));
            model.apply({ do: a.do === "draw" ? "show" : a.do, target: mine }, { t0, beatEnd: end });
          } else model.apply(a, { t0, beatEnd: end, run });
        } catch (e) { out.push(`${where}, beat ${bi + 1}: ${(e as Error).message}`); }
      }
      clock = end + 1000;
    });
  });
  return out;
}
