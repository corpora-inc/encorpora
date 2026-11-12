// @vitest-environment jsdom
/**
 * Base-ten blocks on the stage: a join that cannot be made is reported, a lit
 * pile lights every piece without growing any, a lit digit is marked, and
 * digits that wait are hidden until their word. All of it is a function of
 * time, so a frame is the same however it is sought. (Where the pieces and
 * the digits lie is measured in a real browser: blocks-frame.test.ts.)
 */
import { describe, expect, it } from "vitest";
import { Film } from "./stage";
import { scriptSchema, type BeatTime, type Timing } from "./schema";

/** A beat's words, one every half second from `t0`. */
const said = (say: string, t0: number): BeatTime => {
  const words = say.split(/\s+/).map((text, k) => ({ text, start: t0 + k * 0.5, end: t0 + k * 0.5 + 0.4 }));
  return { start: t0, end: words[words.length - 1]!.end, words };
};
type Beat = { say: string; do?: Record<string, unknown>[] };
function film(chart: Record<string, unknown>, beats: Beat[]) {
  const figure = { points: {}, parts: [{ id: "b", blocks: ["hundreds", "tens", "ones"], start: true, ...chart }] };
  const script = scriptSchema.parse({ id: "t", title: "t", shots: [{ figure, beats }] });
  const timing: Timing = { duration: beats.length * 6 + 2, shots: [beats.map((b, i) => said(b.say, 0.5 + i * 6))] };
  const root = document.createElement("div");
  document.body.appendChild(root);
  const f = new Film(root, script, timing, undefined, { checks: false });
  const wordAt = (beat: number, word: string) => timing.shots[0]![beat]!.words.find((w) => w.text.replace(/\W/g, "") === word)!.start;
  const piece = (id: string) => root.querySelector<SVGElement>(`[data-piece="${id}"]`)!;
  const ring = (id: string) => piece(id).parentElement!.querySelectorAll<SVGElement>(".film-block-ring")[[...root.querySelectorAll("[data-piece]")].indexOf(piece(id))]!;
  const digit = (place: string) => root.querySelector<HTMLElement>(`[data-digit="${place}"]`)!;
  const count = (place: string) => root.querySelector<HTMLElement>(`[data-count="${place}"]`)!;
  return { f, root, wordAt, piece, ring, digit, count };
}
const shown = (el: Element) => (el as HTMLElement).style.display !== "none" && Number((el as HTMLElement).style.opacity || 1) > 0.99;
const hidden = (el: Element) => (el as HTMLElement).style.display === "none";
const two13 = { rows: [{ id: "n", pieces: { hundreds: 2, tens: 13 } }] };

describe("a join in the screenplay", () => {
  const beats: Beat[] = [{ say: "Two flats and thirteen rods." }, { say: "Join ten rods into one flat.", do: [{ do: "join", target: "b.n.tens", at: "Join" }] }];
  it("is no issue with ten pieces to fuse, and takes 1.4 s from its word", () => {
    const { f, wordAt, piece, count } = film({ ...two13, counts: true }, beats);
    expect(f.issues).toEqual([]);
    const t0 = wordAt(1, "Join");
    f.seek(t0 - 0.05);
    expect(hidden(piece("b.n.hundreds.3"))).toBe(true);
    expect(shown(piece("b.n.tens.1"))).toBe(true);
    expect([count("hundreds").textContent, count("tens").textContent]).toEqual(["2", "13"]);
    // on its way: the ten rods are one flat, and the counts have not changed yet
    f.seek(t0 + 1.0);
    expect(shown(piece("b.n.hundreds.3"))).toBe(true);
    expect(hidden(piece("b.n.tens.1"))).toBe(true);
    expect([count("hundreds").textContent, count("tens").textContent]).toEqual(["2", "13"]);
    const flying = piece("b.n.hundreds.3").getAttribute("d");
    f.seek(t0 + 1.41);
    expect([count("hundreds").textContent, count("tens").textContent]).toEqual(["3", "3"]);
    const landed = piece("b.n.hundreds.3").getAttribute("d");
    expect(landed).not.toBe(flying);
    // sought backwards and forwards, the frame is the same
    f.seek(t0 - 0.05);
    expect(hidden(piece("b.n.hundreds.3"))).toBe(true);
    f.seek(t0 + 1.0);
    expect(piece("b.n.hundreds.3").getAttribute("d")).toBe(flying);
    f.seek(40);
    expect(piece("b.n.hundreds.3").getAttribute("d")).toBe(landed);
  });
  it("may be slowed to 2.5 s, and no further", () => {
    const slow = (dur: number) => {
      const { f, wordAt, count } = film({ ...two13, counts: true }, [beats[0]!, { say: beats[1]!.say, do: [{ do: "join", target: "b.n.tens", at: "Join", dur }] }]);
      const t0 = wordAt(1, "Join");
      f.seek(t0 + 2.45);
      const before = count("tens").textContent;
      f.seek(t0 + 2.51);
      return [before, count("tens").textContent];
    };
    expect(slow(2.5)).toEqual(["13", "3"]);
    expect(slow(6)).toEqual(["13", "3"]);
  });
  it("is an issue when the pile holds fewer than ten, and the chart still draws", () => {
    const { f, piece } = film({ rows: [{ id: "n", pieces: { hundreds: 2, tens: 7 } }] }, beats);
    expect(f.issues).toEqual([`Shot 1: join "b.n.tens": a join fuses ten pieces, and the tens pile holds 7 at that moment.`]);
    f.seek(20);
    expect(shown(piece("b.n.tens.7"))).toBe(true);
    const twice = film(two13, [beats[0]!, { say: beats[1]!.say, do: [{ do: "join", target: "b.n.tens", at: "Join", n: 2 }] }]);
    expect(twice.f.issues).toEqual([`Shot 1: join "b.n.tens": a join fuses ten pieces, and the tens pile holds 3 at that moment.`]);
    const top = film({ blocks: ["tens", "ones"], rows: [{ id: "n", pieces: { tens: 3 } }] }, [beats[0]!, { say: beats[1]!.say, do: [{ do: "join", target: "b.n.tens", at: "Join" }] }]);
    expect(top.f.issues).toEqual([`Shot 1: join "b.n.tens": to join the tens the chart needs the place to its left.`]);
  });
});

describe("a split may be slowed the same way", () => {
  it("takes 0.9 s unless the screenplay asks for longer, up to 2.5 s", () => {
    const run = (dur?: number) => {
      const { f, wordAt, count } = film({ rows: [{ id: "n", pieces: { hundreds: 1 } }], counts: true }, [{ say: "One flat." }, { say: "Cut it into ten rods.", do: [{ do: "split", target: "b.n.hundreds", at: "Cut", ...(dur ? { dur } : {}) }] }]);
      const t0 = wordAt(1, "Cut");
      // a split counts from its midpoint
      const at = (dt: number) => { f.seek(t0 + dt); return count("tens").style.display === "none" ? "" : count("tens").textContent; };
      return { issues: f.issues, at };
    };
    const plain = run();
    expect(plain.issues).toEqual([]);
    expect([plain.at(0.4), plain.at(0.5)]).toEqual(["", "10"]);
    const slow = run(2);
    expect([slow.at(0.9), slow.at(1.05)]).toEqual(["", "10"]);
    const capped = run(8);
    expect([capped.at(1.2), capped.at(1.3)]).toEqual(["", "10"]);
  });
});

describe("a lit pile", () => {
  const beats: Beat[] = [
    { say: "Three hundreds here.", do: [{ do: "highlight", target: "b.n.hundreds", at: "hundreds" }] },
    { say: "One flat alone.", do: [{ do: "highlight", target: "b.n.hundreds.2", at: "flat" }] },
  ];
  const chart = { rows: [{ id: "n", pieces: { hundreds: 3, tens: 4 } }] };
  it("lights every piece of the pile, and grows none of them", () => {
    const { f, wordAt, piece, ring } = film(chart, beats);
    expect(f.issues).toEqual([]);
    f.seek(wordAt(0, "hundreds") - 0.1);
    const rest = [1, 2, 3].map((k) => piece(`b.n.hundreds.${k}`).getAttribute("d"));
    for (const k of [1, 2, 3]) expect(hidden(ring(`b.n.hundreds.${k}`))).toBe(true);
    f.seek(wordAt(0, "hundreds") + 0.4);
    for (const k of [1, 2, 3]) {
      const id = `b.n.hundreds.${k}`;
      expect(piece(id).dataset.lit).toBe("1.000");
      expect(hidden(ring(id))).toBe(false);
      // the same outline as at rest, with no scale on it
      expect(piece(id).getAttribute("d")).toBe(rest[k - 1]);
      expect(piece(id).getAttribute("transform")).toBeNull();
      expect(piece(id).dataset.grow).toBeUndefined();
      expect(piece(id).style.stroke).toContain("--color-figure-gold");
    }
    // the pile beside it is not lit
    expect(piece("b.n.tens.1").dataset.lit).toBeUndefined();
    expect(hidden(ring("b.n.tens.1"))).toBe(true);
  });
  it("one lit piece lights alone", () => {
    const { f, wordAt, piece, ring } = film(chart, beats);
    f.seek(wordAt(1, "flat") + 0.4);
    expect(piece("b.n.hundreds.2").dataset.lit).toBe("1.000");
    expect(piece("b.n.hundreds.2").getAttribute("transform")).toBeNull();
    for (const id of ["b.n.hundreds.1", "b.n.hundreds.3", "b.n.tens.1"]) {
      expect(piece(id).dataset.lit).toBeUndefined();
      expect(hidden(ring(id))).toBe(true);
    }
  });
});

describe("digits", () => {
  const say: Beat[] = [
    { say: "Two flats and thirteen rods." },
    { say: "Write three, three, zero.", do: [{ do: "show", target: "b.digit.hundreds", at: "three" }, { do: "show", target: "b.digit.tens", at: "three", nth: 2 }, { do: "show", target: "b.digit.ones", at: "zero" }] },
    { say: "The first digit is hundreds.", do: [{ do: "highlight", target: "b.digit.hundreds", at: "first" }] },
  ];
  it("are on from the start when the chart says `true`, as before", () => {
    const { f, digit } = film({ ...two13, digits: true }, say);
    f.seek(1);
    expect(["hundreds", "tens", "ones"].map((p) => shown(digit(p)))).toEqual([true, true, true]);
    expect(["hundreds", "tens", "ones"].map((p) => digit(p).textContent)).toEqual(["3", "3", "0"]);
  });
  it("wait for their own `show` when the chart says `later`, a zero in an empty place too", () => {
    const { f, wordAt, digit } = film({ ...two13, digits: "later" }, say);
    expect(f.issues).toEqual([]);
    f.seek(1);
    expect(["hundreds", "tens", "ones"].map((p) => hidden(digit(p)))).toEqual([true, true, true]);
    f.seek(wordAt(1, "three") + 0.5);
    expect(["hundreds", "tens", "ones"].map((p) => hidden(digit(p)))).toEqual([false, true, true]);
    f.seek(wordAt(1, "zero") + 0.5);
    expect(["hundreds", "tens", "ones"].map((p) => shown(digit(p)))).toEqual([true, true, true]);
    f.seek(1);
    expect(["hundreds", "tens", "ones"].map((p) => hidden(digit(p)))).toEqual([true, true, true]);
  });
  it("come in together on the numeral's `show`", () => {
    const { f, wordAt, digit } = film({ ...two13, digits: "later" }, [say[0]!, { say: "Now the numeral.", do: [{ do: "show", target: "b.digits", at: "numeral" }] }]);
    f.seek(wordAt(1, "numeral") - 0.1);
    expect(["hundreds", "tens", "ones"].map((p) => hidden(digit(p)))).toEqual([true, true, true]);
    f.seek(wordAt(1, "numeral") + 0.5);
    expect(["hundreds", "tens", "ones"].map((p) => shown(digit(p)))).toEqual([true, true, true]);
  });
  it("a lit digit turns gold and thickens; the digits beside it do not", () => {
    const { f, wordAt, digit } = film({ ...two13, digits: "later" }, say);
    f.seek(wordAt(2, "first") + 0.4);
    expect(digit("hundreds").style.color).toContain("--color-figure-gold");
    expect(digit("hundreds").style.getPropertyValue("-webkit-text-stroke")).not.toBe("");
    expect(digit("hundreds").dataset.lit).toBe("1.000");
    // the glyph grows inside its label; the label itself is placed as at rest
    const glyph = (p: string) => digit(p).querySelector<HTMLElement>(".base")!;
    expect(glyph("hundreds").style.transform).toBe("scale(1.1500)");
    expect(digit("hundreds").style.transform).toMatch(/scale\(1\.0000\)$/);
    for (const p of ["tens", "ones"]) {
      expect(digit(p).style.color).toBe("");
      expect(digit(p).style.getPropertyValue("-webkit-text-stroke")).toBe("");
      expect(digit(p).dataset.lit).toBeUndefined();
      expect(glyph(p).style.transform).toBe("");
    }
    // and lets go after the beat
    f.seek(30);
    expect(digit("hundreds").style.color).toBe("");
    expect(digit("hundreds").style.getPropertyValue("-webkit-text-stroke")).toBe("");
    expect(glyph("hundreds").style.transform).toBe("");
  });
});
