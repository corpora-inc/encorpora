// @vitest-environment jsdom
/**
 * A counting beat with its own pause holds the counted row through that pause:
 * every counted thing keeps its tick and the last keeps its light, then all of
 * it lets go as the next beat (or the shot's end) comes. Without a pause the
 * count lets go just after its speech, as before.
 */
import { expect, it } from "vitest";
import { Film } from "./stage";
import { scriptSchema, type BeatTime, type Timing } from "./schema";

/** A beat's words, one every half second from `t0`, each 0.3 s long. */
const said = (say: string, t0: number): BeatTime => {
  const words = say.split(/\s+/).map((text, k) => ({ text, start: t0 + k * 0.5, end: t0 + k * 0.5 + 0.3 }));
  return { start: t0, end: words[words.length - 1]!.end, words };
};
const ducks = ["d1", "d2", "d3"];
const figure = { view: [0, 0, 12, 4], points: { L: [0, 4] }, parts: [{ id: "d", things: "duck", n: 3, at: "L", start: true }] };
const counting = (pause?: number) => ({ say: "One, two, three.", do: [{ do: "count", target: "d" }], ...(pause === undefined ? {} : { pause }) });

/** "One, two, three." at 1 s (its speech ends at 2.3 s); "Three ducks." at `next`. A second shot, when given, starts its words at `nextShot`. */
function film(pause: number | undefined, next = 4, nextShot?: number) {
  const shots: object[] = [{ figure, beats: nextShot === undefined ? [counting(pause), { say: "Three ducks." }] : [counting(pause)] }];
  const times: BeatTime[][] = [nextShot === undefined ? [said("One, two, three.", 1), said("Three ducks.", next)] : [said("One, two, three.", 1)]];
  if (nextShot !== undefined) { shots.push({ beats: [{ say: "Next." }] }); times.push([said("Next.", nextShot)]); }
  const script = scriptSchema.parse({ id: "hold", title: "Hold", shots });
  const timing: Timing = { duration: (nextShot ?? next) + 3, shots: times };
  const root = document.createElement("div");
  document.body.appendChild(root);
  const model = new Film(root, script, timing, undefined, { checks: false }).shots[0]!.geo!.thingsModel!;
  root.remove();
  return {
    marks: (t: number) => ducks.map((n) => model.stateAt(n, t).mark),
    lit: (t: number) => model.stateAt("d3", t).lit,
  };
}
const END = 2.3;

it("holds the counted row through the counting beat's own pause", () => {
  const f = film(0.9);
  // inside the pause: every duck ticked, the last one still lit
  for (const t of [END + 0.5, END + 0.9, END + 1.2]) {
    for (const m of f.marks(t)) expect(m, `tick at ${t}`).toBeGreaterThan(0.99);
    expect(f.lit(t), `last light at ${t}`).toBeGreaterThan(0.99);
  }
  // it lets go after the pause, before the next beat's first word
  expect(f.marks(3.95)).toEqual([0, 0, 0]);
  expect(f.lit(3.95)).toBe(0);
});

it("lets go just after the speech when the counting beat has no pause, as before", () => {
  const f = film(undefined);
  expect(f.lit(END + 0.2)).toBe(1);
  expect(f.marks(END + 0.2).slice(0, 2)).toEqual([1, 1]);
  expect(f.marks(END + 0.9)).toEqual([0, 0, 0]);
  expect(f.lit(END + 0.9)).toBe(0);
});

it("never holds into the next beat or past its shot", () => {
  // a pause longer than the room the timing left (a pause the voice could not insert): let go as the next beat begins
  const short = film(3, 3.4);
  expect(short.marks(3.35)).toEqual([1, 1, 1]);
  expect(short.marks(3.4 + 0.36)).toEqual([0, 0, 0]);
  // the last beat of a shot lets go as its shot begins to fade (half a second before the next shot's first word)
  const last = film(3, 4, 4.5);
  expect(last.marks(3.95)).toEqual([1, 1, 1]);
  expect(last.marks(4 + 0.36)).toEqual([0, 0, 0]);
});
