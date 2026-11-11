import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { actionSchema, partSchema, scriptSchema } from "./schema";
import { countRun, groupLayout, groupOf, LIGHT_R, numberWord, numbersIn, thingsProblems, ThingsModel, type Word } from "./things";
import { THING_PITCH, thingKinds } from "../src/math/scene/components/things-art";

/** A beat's words, one second apart, as the voice's timing gives them. */
const said = (text: string, t0 = 10): Word[] => text.split(/\s+/).map((w, i) => ({ text: w, start: t0 + i }));
const group = (id: string, n: number, extra: Partial<{ slots: number; start: boolean; kind: "apple" | "duck" }> = {}) =>
  ({ id, kinds: Array.from({ length: n }, () => extra.kind ?? ("apple" as const)), slots: extra.slots ?? Math.max(1, n), start: extra.start ?? false });

describe("counting words", () => {
  it("names the numbers a child counts with", () => {
    expect([1, 7, 13, 20, 21, 40, 99, 100].map(numberWord)).toEqual(["one", "seven", "thirteen", "twenty", "twenty-one", "forty", "ninety-nine", "one hundred"]);
  });
  it("finds every number in a beat, however it is written", () => {
    expect(numbersIn(said("One, two, THREE. Twenty-one, twenty two, thirty.")).map((x) => x.value)).toEqual([1, 2, 3, 21, 22, 30]);
    expect(numbersIn(said("Ten and seven more is seventeen.")).map((x) => x.value)).toEqual([10, 7, 17]);
    // "to", "for" and "ate" are not numbers
    expect(numbersIn(said("Go to the pond for the ducks."))).toEqual([]);
  });
  it("times a count from its first number, in order", () => {
    expect(countRun(said("One, two, three, four, five.")).times).toEqual([10, 11, 12, 13, 14]);
    // words between the numbers do not break the count
    expect(countRun(said("One duck, two ducks, three ducks.")).times).toEqual([10, 12, 14]);
  });
  it("starts at the last one before two", () => {
    expect(countRun(said("Count one by one: one, two, three.")).times).toEqual([14, 15, 16]);
  });
  it("counts on from another number", () => {
    expect(countRun(said("A full frame is ten. Eleven, twelve, thirteen."), 11).times).toEqual([15, 16, 17]);
    expect(countRun(said("Five. Count on: six, seven."), 6, "six").times).toEqual([13, 14]);
  });
  it("says what is wrong with at", () => {
    expect(() => countRun(said("Count the ducks: one, two."), 1, "ducks")).toThrow(/must be the first number counted, "one", not "ducks"/);
    expect(() => countRun(said("One, two."), 1, "three")).toThrow(/"three" is not in/);
    expect(() => countRun(said("Look at the ducks."))).toThrow(/never says "one"/);
  });
});

describe("a group's places", () => {
  it("are a row by default, one thing-and-air apart", () => {
    const g = groupLayout({ id: "a", slots: 5, size: 2 });
    expect(g.thing).toBe(2);
    expect(g.w).toBeCloseTo(5 * THING_PITCH * 2);
    expect(g.slots.map(([x]) => +x.toFixed(2))).toEqual([1.2, 3.6, 6, 8.4, 10.8]);
  });
  it("wrap in a grid, and scatter the same way for the same seed", () => {
    expect(groupLayout({ id: "a", arrange: "grid", slots: 7, perRow: 5 }).h).toBeCloseTo(2 * THING_PITCH * 2);
    const a = groupLayout({ id: "pond", arrange: "scatter", slots: 6 }), b = groupLayout({ id: "pond", arrange: "scatter", slots: 6 });
    expect(a).toEqual(b);
    expect(groupLayout({ id: "pool", arrange: "scatter", slots: 6 }).slots).not.toEqual(a.slots);
    // a light's ring stays inside the thing's own place
    expect(2 * LIGHT_R).toBeLessThan(THING_PITCH);
  });
});

describe("the plan", () => {
  it("brings things in one by one", () => {
    const m = new ThingsModel([group("a", 3)]);
    const total = m.apply({ do: "arrive", target: "a" }, { t0: 1, beatEnd: 4 });
    expect(total).toBeGreaterThan(0.9);
    expect(m.stateAt("a1", 0.9).o).toBe(0);
    expect(m.stateAt("a1", 1.6).o).toBe(1);
    // the second sets off after the first, the third after the second
    expect(m.stateAt("a2", 1.2).o).toBe(0);
    expect(m.stateAt("a3", 1.45).o).toBe(0);
    expect(m.stateAt("a3", 2.2).o).toBe(1);
    // arriving, a thing is a little out of place; then it rests
    expect(m.stateAt("a1", 1.05).pose).toBeGreaterThan(0.5);
    expect(m.stateAt("a1", 1.6).pose).toBe(0);
  });
  it("lights each thing exactly as its number is said", () => {
    const m = new ThingsModel([group("d", 3, { start: true })]);
    const run = countRun(said("One, two, three."));
    m.apply({ do: "count", target: "d" }, { t0: run.times[0]!, beatEnd: 12.5, run });
    // just before its word: dark. On its word: lit. When the next is said: the light moves on, a mark stays.
    expect(m.stateAt("d2", 10.99).lit).toBe(0);
    expect(m.stateAt("d1", 10.2).lit).toBe(1);
    expect(m.stateAt("d2", 11.2).lit).toBe(1);
    expect(m.stateAt("d1", 11.5).lit).toBe(0);
    expect(m.stateAt("d3", 11.5).lit).toBe(0);
    // one lit thing at a time: never two lights at once, at any moment of the count
    for (let t = 9.5; t < 14; t += 0.05) expect(["d1", "d2", "d3"].filter((n) => m.stateAt(n, t).lit > 0.5).length).toBeLessThanOrEqual(1);
    // a thing counted where it sits takes a tick as the light moves on, until the beat is over
    expect(m.stateAt("d1", 10.5).mark).toBe(0);
    expect(m.stateAt("d1", 11.5).mark).toBe(1);
    expect(m.stateAt("d1", 14).mark).toBe(0);
    // the last one counted keeps the light to the end of the beat instead: the last number tells how many
    expect(m.stateAt("d3", 12.6).lit).toBe(1);
    expect(m.stateAt("d3", 12.6).mark).toBe(0);
    expect(m.stateAt("d3", 14).lit).toBe(0);
  });
  it("is paint only: a light never moves a thing, and no other thing changes", () => {
    const m = new ThingsModel([group("d", 3, { start: true })]);
    const run = countRun(said("One, two, three."));
    m.apply({ do: "count", target: "d" }, { t0: run.times[0]!, beatEnd: 12.5, run });
    const where = (name: string, t: number) => { const { lit: _l, mark: _m, ...rest } = m.stateAt(name, t); return rest; };
    for (const name of ["d1", "d2", "d3"]) for (const t of [9, 10.1, 11.1, 12.1, 13, 20]) expect(where(name, t)).toEqual(where(name, 0));
  });
  it("counts out: a thing not yet on screen arrives on its number", () => {
    const m = new ThingsModel([group("a", 5)]);
    const run = countRun(said("One, two, three, four, five."));
    m.apply({ do: "count", target: "a" }, { t0: run.times[0]!, beatEnd: 15, run });
    expect([10.9, 11.9, 12.9, 13.9, 14.9].map((t) => m.countAt("a", t))).toEqual([1, 2, 3, 4, 5]);
    expect(m.stateAt("a4", 12.9).o).toBe(0);
    // the count ticks as the number is said, while the thing is still fading in
    expect(m.countAt("a", 9.99)).toBe(0);
    expect(m.countAt("a", 10.02)).toBe(1);
    expect(m.stateAt("a1", 10.02).o).toBeLessThan(0.1);
  });
  it("counts things into another group, each on its number, and stops", () => {
    const m = new ThingsModel([group("pile", 7, { start: true }), group("bowl", 0, { slots: 5 })]);
    const run = countRun(said("One, two, three, four."));
    m.apply({ do: "count", target: "pile", to: 4, into: "bowl" }, { t0: run.times[0]!, beatEnd: 14, run });
    expect(m.countAt("bowl", 20)).toBe(4);
    expect(m.countAt("pile", 20)).toBe(3);
    expect(m.members("bowl")).toEqual(["pile1", "pile2", "pile3", "pile4"]);
    // it flies over the others, and belongs to the bowl from the moment its number is said
    const mid = m.stateAt("pile2", 11.4);
    expect(mid.flying).toBe(true);
    expect(mid.from).toEqual({ group: "pile", slot: 1 });
    expect(mid.to).toEqual({ group: "bowl", slot: 1 });
    expect([10.99, 11.01, 11.4].map((t) => m.countAt("bowl", t))).toEqual([1, 2, 2]);
    expect(m.countAt("pile", 11.4) + m.countAt("bowl", 11.4)).toBe(7);
    // sliding into the bowl is the mark that it was counted: no tick as well
    expect(m.stateAt("pile1", 12.5).mark).toBe(0);
  });
  it("joins, takes away and shares", () => {
    const m = new ThingsModel([group("a", 3, { start: true, slots: 5 }), group("b", 2, { start: true }), group("p", 0, { slots: 3 }), group("q", 0, { slots: 3 })]);
    m.apply({ do: "send", target: "b", to: "a" }, { t0: 1, beatEnd: 3 });
    expect(m.members("a")).toEqual(["a1", "a2", "a3", "b1", "b2"]);
    expect(m.stateAt("b2", 5).to).toEqual({ group: "a", slot: 4 });
    m.apply({ do: "leave", target: ["a1", "a2"] }, { t0: 6, beatEnd: 8 });
    expect(m.countAt("a", 9)).toBe(3);
    // the places they left are free again; dealing goes to each group in turn
    m.apply({ do: "send", target: "a", to: ["p", "q"] }, { t0: 10, beatEnd: 14 });
    expect(m.members("p")).toEqual(["a3", "b2"]);
    expect(m.members("q")).toEqual(["b1"]);
    expect(m.stateAt("b1", 10.2).flying).toBe(false);
    expect(m.stateAt("b1", 10.6).flying).toBe(true);
  });
  it("a thing that leaves toward a direction drifts that way while it fades, and stays gone", () => {
    const m = new ThingsModel([group("a", 3, { start: true })]);
    m.apply({ do: "leave", target: "a1", toward: "n" }, { t0: 2, beatEnd: 4 });
    m.apply({ do: "leave", target: "a2" }, { t0: 2, beatEnd: 4 });
    expect(m.stateAt("a1", 1).drift).toEqual([0, 0]);
    const mid = m.stateAt("a1", 2.5).drift;
    expect(mid[0]).toBeCloseTo(0);
    expect(mid[1]).toBeGreaterThan(0);
    expect(m.stateAt("a1", 4).drift[1]).toBeCloseTo(1);
    expect(m.stateAt("a1", 4).o).toBe(0);
    // a plain leave fades where it sits
    expect(m.stateAt("a2", 2.2).drift).toEqual([0, 0]);
    expect(actionSchema.safeParse({ do: "leave", target: "a1", toward: "ne" }).success).toBe(true);
    expect(actionSchema.safeParse({ do: "leave", target: "a1", toward: "up" }).success).toBe(false);
  });
  it("draws any frame by itself: the state is a function of time alone", () => {
    const build = () => {
      const m = new ThingsModel([group("a", 4), group("b", 0, { slots: 4 })]);
      m.apply({ do: "arrive", target: "a" }, { t0: 1, beatEnd: 3 });
      m.apply({ do: "send", target: ["a1", "a2"], to: "b" }, { t0: 4, beatEnd: 6 });
      m.apply({ do: "highlight", target: "b" }, { t0: 7, beatEnd: 8 });
      m.apply({ do: "leave", target: "a3" }, { t0: 9, beatEnd: 10 });
      return m;
    };
    const times = [0, 1.1, 1.7, 4.3, 4.9, 7.2, 8.6, 9.2, 12];
    const forward = build(), backward = build();
    const a = times.map((t) => ["a1", "a2", "a3", "a4"].map((n) => forward.stateAt(n, t)));
    const b = [...times].reverse().map((t) => ["a1", "a2", "a3", "a4"].map((n) => backward.stateAt(n, t))).reverse();
    expect(a).toEqual(b);
    expect(forward.ranges().every(([x, y]) => y > x)).toBe(true);
  });
  it("says so when the words and the things do not match", () => {
    const five = () => new ThingsModel([group("c", 5, { start: true })]);
    const short = countRun(said("One, two, three, four."));
    expect(() => five().apply({ do: "count", target: "c" }, { t0: 10, beatEnd: 14, run: short })).toThrow(/counts to four, but 5 things are counted .* to five/);
    const long = countRun(said("One, two, three, four, five, six."));
    expect(() => five().apply({ do: "count", target: "c" }, { t0: 10, beatEnd: 16, run: long })).toThrow(/goes on to six, but only 5 things are counted/);
    // a child who touches one cookie twice: list each touch, and the words match again
    expect(() => five().apply({ do: "count", target: ["c1", "c2", "c3", "c3", "c4", "c5"] }, { t0: 10, beatEnd: 16, run: long })).not.toThrow();
    // a count that stops early on purpose
    expect(() => five().apply({ do: "count", target: "c", to: 4 }, { t0: 10, beatEnd: 14, run: short })).not.toThrow();
    expect(() => five().apply({ do: "count", target: "c", to: 7 }, { t0: 10, beatEnd: 16, run: long })).toThrow(/"to" is 7, but 5 things counted from 1 end on 5/);
    expect(() => five().apply({ do: "count", target: "c9" }, { t0: 10, beatEnd: 16, run: long })).toThrow(/no thing or group named "c9". Group c has c1, c2, c3, c4, c5/);
    // counting on: a count carried on in the same group picks up at that thing; a smaller group takes the numbers
    const on = new ThingsModel([group("c", 7, { start: true }), group("more", 3)]);
    const six = countRun(said("Six, seven."), 6), eight = countRun(said("Eight, nine, ten!", 20), 8);
    on.apply({ do: "count", target: "c", from: 6 }, { t0: 10, beatEnd: 12, run: six });
    expect(["c5", "c6", "c7"].map((n) => on.stateAt(n, 10.3).lit)).toEqual([0, 1, 0]);
    on.apply({ do: "count", target: "more", from: 8 }, { t0: 20, beatEnd: 23, run: eight });
    expect(["more1", "more2", "more3"].map((n) => on.stateAt(n, 21.3).lit)).toEqual([0, 1, 0]);
    expect(on.countAt("more", 22.1)).toBe(3);
    expect(() => new ThingsModel([group("a", 2, { start: true }), group("b", 1, { start: true })]).apply({ do: "send", target: "a", to: "b" }, { t0: 1, beatEnd: 2 })).toThrow(/group b is full \(1 places\)/);
  });
});

describe("the screenplay schema", () => {
  it("takes a things part and its actions", () => {
    expect(partSchema.safeParse({ id: "a", things: "apple", n: 5, at: "A", arrange: "scatter", seed: "tree" }).success).toBe(true);
    expect(partSchema.safeParse({ id: "t", things: ["bear", "ball", "car"], in: "frame" }).success).toBe(true);
    expect(partSchema.safeParse({ id: "a", things: "dragon", n: 5, at: "A" }).success).toBe(false);
    for (const a of [
      { do: "arrive", target: "a", at: "Here" },
      { do: "count", target: "a" },
      { do: "count", target: ["a1", "a2"], from: 6, at: "six" },
      { do: "count", target: "pile", to: 4, into: "bowl" },
      { do: "send", target: ["a4", "a5"], to: "b" },
      { do: "send", target: "pile", to: ["p", "q"] },
      { do: "leave", target: "a5" },
    ]) expect(actionSchema.safeParse(a).success, JSON.stringify(a)).toBe(true);
    expect(actionSchema.safeParse({ do: "count", target: "a", from: 0 }).success).toBe(false);
  });
});

describe("the authoring guide", () => {
  const guide = readFileSync(fileURLToPath(new URL("./AUTHORING.md", import.meta.url)), "utf8");
  const section = guide.slice(guide.indexOf("### Things to count"), guide.indexOf("### Graphs"));
  it("lists exactly the kinds the kit draws", () => {
    const line = section.split("\n").find((l) => l.startsWith("The kinds, and no others:"))!;
    expect([...line.matchAll(/`([a-z]+)`/g)].map((m) => m[1])).toEqual([...thingKinds]);
  });
  it("gives two examples that pass the schema and the --dry check", () => {
    const shots = [...section.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1]!));
    expect(shots).toHaveLength(2);
    const script = { id: "guide", title: "Guide", shots };
    expect(thingsProblems(script)).toEqual([]);
    expect(scriptSchema.safeParse(script).error?.issues ?? []).toEqual([]);
  });
  it("gives a pairs example that passes the schema and the --dry check", () => {
    const pairs = guide.slice(guide.indexOf("### Pairs, and things that travel to a label"), guide.indexOf("## Make it show why"));
    const shots = [...pairs.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1]!));
    expect(shots).toHaveLength(1);
    const script = { id: "guide", title: "Guide", shots };
    expect(thingsProblems(script)).toEqual([]);
    expect(scriptSchema.safeParse(script).error?.issues ?? []).toEqual([]);
    // the travelling label's part, as the guide writes it
    const label = pairs.match(/^\{ "id": "mA".*\}$/m)?.[0];
    expect(partSchema.safeParse(JSON.parse(label ?? "null")).success).toBe(true);
  });
  it("shows every action row in a form the schema takes", () => {
    const rows = [...section.matchAll(/^\| `(\{"do":[^`]+\})` \|/gm)].map((m) => JSON.parse(m[1]!));
    expect(rows.map((r) => r.do)).toEqual(["arrive", "count", "count", "count", "send", "leave", "leave"]);
    for (const r of rows) expect(actionSchema.safeParse(r).success, JSON.stringify(r)).toBe(true);
  });
});

describe("the --dry check for things", () => {
  const shot = (parts: object[], ...beats: object[]) => ({ id: "t", title: "t", shots: [{ figure: { points: { A: [0, 0], B: [0, -6] }, parts }, beats }] });
  const apples = { id: "a", things: "apple", n: 5, at: "A", start: true };
  it("passes a count that matches, a counting-out and a deliberate double touch", () => {
    const script = shot(
      [apples, { id: "d", things: "duck", n: 3, at: "B" }, { id: "pond", things: "duck", n: 0, slots: 4, at: "B" }],
      { say: "Count the apples: one, two, three, four, five.", do: [{ do: "count", target: "a" }] },
      { say: "One, two, three.", do: [{ do: "count", target: "d" }] },
      { say: "One, two, three.", do: [{ do: "count", target: "d", into: "pond" }] },
      { say: "One, two, three, four, five, six.", do: [{ do: "count", target: ["a1", "a2", "a3", "a3", "a4", "a5"] }] },
      { say: "Five apples. One leaves.", do: [{ do: "highlight", target: "a", at: "Five" }, { do: "leave", target: "a5", at: "leaves" }] },
    );
    expect(thingsProblems(script)).toEqual([]);
    expect(scriptSchema.safeParse(script).success).toBe(true);
  });
  it("catches an unknown kind, in plain words", () => {
    const p = thingsProblems(shot([{ id: "a", things: "aple", n: 5, at: "A" }], { say: "One.", do: [] }));
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/^Shot 1: things a: "aple" is not a kind of thing\. Kinds: apple, banana, /);
  });
  it("catches a count that says fewer or more numbers than there are things", () => {
    const few = thingsProblems(shot([apples], { say: "One, two, three, four.", do: [{ do: "count", target: "a" }] }));
    expect(few).toEqual([expect.stringMatching(/^Shot 1, beat 1: count: the voice counts to four, but 5 things are counted \(a1, a2, a3, a4, a5\), to five\./)]);
    const many = thingsProblems(shot([apples], { say: "One, two, three, four, five, six.", do: [{ do: "count", target: "a" }] }));
    expect(many).toEqual([expect.stringMatching(/goes on to six, but only 5 things are counted .* give "to": 5/)]);
    // "to" says the count stops there on purpose
    expect(thingsProblems(shot([apples], { say: "One, two, three. Three and two more is five.", do: [{ do: "count", target: "a", to: 3 }] }))).toEqual([]);
  });
  it("follows things from group to group", () => {
    const parts = [{ id: "pile", things: "cookie", n: 6, at: "A", start: true }, { id: "plate", things: "cookie", n: 0, slots: 4, at: "B" }];
    // four go to the plate; the plate now holds four, the pile two
    expect(thingsProblems(shot(parts,
      { say: "One, two, three, four.", do: [{ do: "count", target: "pile", to: 4, into: "plate" }] },
      { say: "Check the plate: one, two, three, four.", do: [{ do: "count", target: "plate" }] },
      { say: "One, two.", do: [{ do: "count", target: "pile" }] },
    ))).toEqual([]);
    // a fifth has no room
    expect(thingsProblems(shot(parts, { say: "One, two, three, four, five.", do: [{ do: "count", target: "pile", to: 5, into: "plate" }] }))).toEqual([expect.stringMatching(/group plate is full \(4 places\)/)]);
  });
  it("catches the other ways to misuse things", () => {
    expect(thingsProblems(shot([apples], { say: "One.", do: [{ do: "leave", target: "a7" }] }))[0]).toMatch(/no thing or group named "a7"\. Group a has a1, a2, a3, a4, a5/);
    expect(thingsProblems(shot([apples], { say: "Go.", do: [{ do: "move", points: { a2: [1, 1] } }] }))[0]).toMatch(/"move" cannot move a2, which is a thing\. Use \{ "do": "send"/);
    expect(thingsProblems(shot([{ id: "g", grid: [5, 2], at: "A" }], { say: "One.", do: [{ do: "count", target: "g" }] }))[0]).toMatch(/act on things, but this shot's figure has no things part/);
    expect(thingsProblems(shot([{ id: "a", things: "apple", at: "A" }], { say: "One.", do: [] }))[0]).toMatch(/give "n", how many apples/);
    expect(thingsProblems(shot([{ id: "a", things: "apple", n: 3 }], { say: "One.", do: [] }))[0]).toMatch(/give "at" .* or "in" .*, not neither/);
    expect(thingsProblems(shot([{ id: "a", things: "apple", n: 12, in: "f" }, { id: "f", grid: [5, 2], at: "A" }], { say: "One.", do: [] }))[0]).toMatch(/12 things do not fit 10 places/);
    expect(thingsProblems(shot([apples, { id: "a1", things: "duck", n: 1, at: "B" }], { say: "One.", do: [] }))[0]).toMatch(/the name a1 is used twice/);
    expect(thingsProblems(shot([apples], { say: "Now.", do: [{ do: "arrive", target: "a" }] }))[0]).toMatch(/arrive: a1, a2, a3, a4, a5 is already on screen/);
  });
  it("reads a group in a frame as that frame's cells", () => {
    const frame = { id: "f", grid: [5, 2], at: "A" };
    expect(groupOf({ id: "s", things: "strawberry", n: 7, in: "f" }, new Map([["f", 10]]))).toEqual({ id: "s", kinds: Array(7).fill("strawberry"), slots: 10, start: false });
    expect(thingsProblems(shot([frame, { id: "s", things: "strawberry", n: 7, in: "f", start: true }],
      { say: "Five on top. Six, seven.", do: [{ do: "count", target: "s", from: 6 }] }))).toEqual([]);
  });
});
