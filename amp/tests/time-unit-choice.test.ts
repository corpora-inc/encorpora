import { test } from "node:test";
import assert from "node:assert/strict";
import { sweep, variantsOf } from "./fixtures/algebra-kit-checks";

type Problem = ReturnType<typeof sweep>[number];
const options = (p: Problem) => {
  const r = p.public.response;
  if (r.kind !== "choice") throw new Error("choice expected");
  return r.options;
};
const label = (p: Problem) => options(p).find((o) => o.id === p.answer)!.label;

const clockMinutes = (hour: number, minute: number, pm: boolean) =>
  ((hour % 12) + (pm ? 12 : 0)) * 60 + minute;
const parseTimes = (text: string) =>
  [...text.matchAll(/(\d+):(\d\d) ([ap])\.m\./g)].map((m) =>
    clockMinutes(Number(m[1]), Number(m[2]), m[3] === "p"),
  );
const show = (minutes: number) => {
  const h24 = Math.floor(minutes / 60) % 24;
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(minutes % 60).padStart(2, "0")} ${h24 < 12 ? "a" : "p"}.m.`;
};
const duration = (text: string) => {
  const m = text.match(/(\d+) hours?(?: (\d+) minutes?)?/)!;
  return Number(m[1]) * 60 + Number(m[2] ?? 0);
};
const words = (minutes: number) => {
  const h = Math.floor(minutes / 60),
    m = minutes % 60;
  return `${h} ${h === 1 ? "hour" : "hours"}${m ? ` ${m} ${m === 1 ? "minute" : "minutes"}` : ""}`;
};

test("elapsed-time-hm: the keyed time or duration follows from the clock or text", () => {
  for (const p of sweep("elapsed-time-hm")) {
    const m = p.variant!.id.match(
      /^(end-time|start-time|elapsed)-(analog-clock|written)$/,
    )!;
    const ask = m[1]!;
    const shown = m[2] === "analog-clock" ? "clock" : "written";
    const text = p.public.prompt;
    const written = parseTimes(text);
    let known: number | undefined;
    if (shown === "clock") {
      const fig = p.public.figure as {
        kind: string;
        hour: number;
        minute: number;
      };
      assert.equal(fig.kind, "clock");
      known = clockMinutes(fig.hour, fig.minute, /in the afternoon/.test(text));
    }
    if (ask === "end-time") {
      const start = known ?? written[0]!;
      assert.equal(label(p), show(start + duration(text)), p.public.seed);
    } else if (ask === "start-time") {
      const end = known ?? written[0]!;
      assert.equal(label(p), show(end - duration(text)), p.public.seed);
    } else {
      const start = known ?? written[0]!;
      const end = shown === "clock" ? written[0]! : written[1]!;
      assert.equal(label(p), words(end - start), p.public.seed);
    }
  }
});

test("elapsed-time-hm: all three questions with a clock and with written times occur", () => {
  const seen = variantsOf(sweep("elapsed-time-hm"));
  for (const a of ["end-time", "start-time", "elapsed"])
    for (const s of ["analog-clock", "written"])
      assert.ok(seen.has(`${a}-${s}`), `${a}-${s}`);
});

// Independent table of masses (grams or ounces) and capacities (milliliters or
// fluid ounces) used to judge which object is closest.
const base: Record<string, number> = {
  "a paper clip": 1,
  "a pencil": 10,
  "an apple": 150,
  "a bag of sugar": 1000,
  "a bowling ball:metric": 7000,
  "a ten-year-old child": 35000,
  "a small car:metric": 1000000,
  "a teaspoon:metric": 5,
  "a juice box": 200,
  "a water bottle": 1000,
  "a bucket": 10000,
  "a bathtub:metric": 150000,
  "a slice of bread": 1,
  "a loaf of bread": 16,
  "a bowling ball:customary": 224,
  "a bicycle": 480,
  "a small car:customary": 64000,
  "a teaspoon:customary": 1,
  "a coffee mug": 8,
  "a milk carton": 32,
  "a milk jug": 128,
  "a bathtub:customary": 5120,
};
const unitValue: Record<string, number> = {
  gram: 1,
  grams: 1,
  kilogram: 1000,
  kilograms: 1000,
  milliliter: 1,
  milliliters: 1,
  liter: 1000,
  liters: 1000,
  ounce: 1,
  ounces: 1,
  pound: 16,
  pounds: 16,
  ton: 32000,
  tons: 32000,
  teaspoon: 1,
  teaspoons: 1,
  cup: 8,
  cups: 8,
  quart: 32,
  quarts: 32,
  gallon: 128,
  gallons: 128,
};
test("object-for-measure: the keyed object is the closest to the stated measure", () => {
  for (const p of sweep("object-for-measure")) {
    const system = p.variant!.id.endsWith("customary") ? "customary" : "metric";
    const m = p.public.prompt.match(/closest to (\d+) (\w+)\?/)!;
    const target = Number(m[1]) * unitValue[m[2]!]!;
    const value = (name: string) => {
      const key = name.toLowerCase();
      return base[`${key}:${system}`] ?? base[key]!;
    };
    const ranked = options(p)
      .map((o) => ({
        id: o.id,
        d: Math.abs(Math.log(value(o.label) / target)),
      }))
      .sort((a, b) => a.d - b.d);
    assert.equal(ranked[0]!.id, p.answer, p.public.seed);
    assert.ok(ranked[1]!.d - ranked[0]!.d > Math.log(3), "a clear winner");
  }
});

test("object-for-measure: mass and capacity, metric and customary all occur", () => {
  const seen = variantsOf(sweep("object-for-measure"));
  for (const q of ["mass", "capacity"])
    for (const s of ["metric", "customary"]) assert.ok(seen.has(`${q}-${s}`));
});

test("approximate-unit-factor: the keyed estimate is the exact conversion rounded to a tenth", () => {
  for (const p of sweep("approximate-unit-factor")) {
    const m = p.public.prompt.match(
      /measures (\d+) (\w+)\. One (\w+) is about ([\d.]+) (\w+)\./,
    )!;
    const [, amount, given, big, rate, small] = m;
    const [a, r] = [Number(amount), Number(rate)];
    // Work in integer hundredths of the rate.
    const rate100 = Math.round(r * 100);
    const toBig = given === small;
    // Exact value in hundredths (never rounded twice), then to the nearest tenth (half up).
    const hundredths = toBig ? (a * 10000) / rate100 : a * rate100;
    const expected = (Math.round(hundredths / 10) / 10).toFixed(1);
    const want = label(p).match(/^([\d.]+) /)![1];
    assert.equal(want, expected, p.public.seed);
    const values = options(p).map((o) =>
      Number(o.label.match(/^([\d.]+) /)![1]),
    );
    const exact = toBig ? a / r : a * r;
    const closest = values.reduce((b, v) =>
      Math.abs(v - exact) < Math.abs(b - exact) ? v : b,
    );
    assert.equal(closest, Number(expected));
  }
});

test("approximate-unit-factor: both directions occur", () => {
  const seen = variantsOf(sweep("approximate-unit-factor"));
  assert.ok(seen.has("to-bigger-unit") && seen.has("to-smaller-unit"));
});
