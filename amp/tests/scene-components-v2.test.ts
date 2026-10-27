import assert from "node:assert/strict";
import test from "node:test";
import {
  describeScene,
  layoutScene,
  sceneCapabilitiesIn,
  sceneCapability,
  sceneSchema,
  type Drawn,
  type Scene,
} from "../src/math/scene/index.js";
import { galleryCases } from "../src/math/scene/gallery.js";
import { sceneV2Cases } from "../src/math/scene/gallery-v2.js";
import {
  coinDiameter,
  sectorAngles,
  tickLength,
} from "../src/math/scene/components/index.js";
import {
  chooseAxes,
  defineAxis,
  withClientFigures,
} from "../src/math/variation/axes.js";
import { figureCapabilities } from "../src/math/contracts.js";

const one = (element: unknown, extra: object = {}) =>
  ({ v: 1, elements: [element], ...extra }) as Scene;
const texts = (items: Drawn[]) =>
  items.flatMap((d) => (d.k === "text" ? [d] : []));
const item = (items: Drawn[], id: string) => {
  const d = items.find((i) => i.id === id);
  assert.ok(d, `missing ${id}`);
  return d;
};
const valid = (element: unknown) => sceneSchema.safeParse(one(element)).success;

const pie = (extra: object = {}) => ({
  type: "circleGraph",
  id: "g",
  sectors: [
    { label: "Walk", value: 35, text: "35%" },
    { label: "Bus", value: 30, text: "30%" },
    { label: "Car", value: 20, text: "20%" },
    { label: "Bike", value: 15, text: "15%" },
  ],
  ...extra,
});
const thermometer = (extra: object = {}) => ({
  type: "thermometer",
  id: "t",
  unit: "F",
  min: 30,
  max: 90,
  minor: 2,
  major: 10,
  reading: 64,
  ...extra,
});
const ruler = (extra: object = {}) => ({
  type: "ruler",
  id: "r",
  unit: "in",
  length: 4,
  parts: 8,
  object: { from: 0, to: 27 },
  ...extra,
});

test("scenes-v2 is the newest figure capability", () => {
  assert.equal(figureCapabilities.at(-1), "scenes-v2");
});

test("every earlier gallery scene stays scenes-v1; the new components need scenes-v2", () => {
  const v2 = new Set(sceneV2Cases.map((c) => c.name));
  for (const c of galleryCases)
    assert.equal(
      sceneCapability(c.scene),
      v2.has(c.name) ? "scenes-v2" : "scenes-v1",
      c.name,
    );
  // An unchanged form of an existing component stays scenes-v1.
  assert.equal(
    sceneCapability(
      one({
        type: "isoSolid",
        solid: { form: "cubes", length: 2, width: 2, height: 2 },
      }),
    ),
    "scenes-v1",
  );
  // Nested: a figure-choice option, a lesson walkthrough.
  assert.deepEqual(
    sceneCapabilitiesIn({
      response: { options: [{ figure: { kind: "scene", scene: one(pie()) } }] },
    }),
    ["scenes-v2"],
  );
  assert.deepEqual(
    sceneCapabilitiesIn({
      figure: { kind: "scene", scene: galleryCases[0]!.scene },
    }),
    [],
  );
});

test("the schemas reject out-of-range components", () => {
  assert.ok(valid(pie()));
  assert.ok(!valid(pie({ sectors: [{ label: "All", value: 1 }] })));
  assert.ok(
    !valid(
      pie({
        sectors: [
          { label: "A", value: 1 },
          { label: "A", value: 2 },
        ],
      }),
    ),
    "duplicate sector labels",
  );
  assert.ok(
    !valid(
      pie({
        sectors: [
          { label: "A", value: 0 },
          { label: "B", value: 2 },
        ],
      }),
    ),
    "empty sector",
  );
  assert.ok(
    !valid(
      pie({
        sectors: [
          { label: "A", value: 1, derived: true },
          { label: "B", value: 2 },
        ],
      }),
    ),
    "a derived sector needs text",
  );
  assert.ok(valid(thermometer()));
  assert.ok(!valid(thermometer({ reading: 65 })), "reading between ticks");
  assert.ok(!valid(thermometer({ reading: 30 })), "reading at the bottom");
  assert.ok(!valid(thermometer({ min: 35 })), "scale starts off a label");
  assert.ok(!valid(thermometer({ minor: 5, major: 5 })), "major = minor");
  assert.ok(!valid(thermometer({ min: -100, minor: 1 })), "too many ticks");
  assert.ok(valid(ruler()));
  assert.ok(!valid(ruler({ parts: 10 })), "inches in tenths");
  assert.ok(!valid(ruler({ unit: "cm", parts: 8 })), "centimeters in eighths");
  assert.ok(!valid(ruler({ object: { from: 0, to: 33 } })), "off the ruler");
  assert.ok(!valid(ruler({ object: { from: 9, to: 9 } })), "empty object");
  assert.ok(valid({ type: "coins", coins: [{ coin: "dime" }] }));
  assert.ok(!valid({ type: "coins", coins: [{ coin: "half-dollar" }] }));
  assert.ok(
    !valid({
      type: "coins",
      coins: [
        { coin: "dime", label: "A" },
        { coin: "penny", label: "A" },
      ],
    }),
  );
  const steps = (columns: number[]) => ({
    type: "isoSolid",
    solid: { form: "steps", width: 2, columns },
  });
  assert.ok(valid(steps([3, 2, 1])));
  assert.ok(!valid(steps([2, 3])), "a taller column in front hides cubes");
  assert.ok(!valid(steps([2, 2])), "no step is a plain prism");
});

test("circle graph sectors are their exact shares, clockwise from 12 o'clock", () => {
  const c = pie();
  const angles = sectorAngles(c as never);
  assert.equal(angles[0]!.to, 90);
  assert.ok(Math.abs(angles.at(-1)!.from - -270) < 1e-9);
  angles.forEach((a, i) =>
    assert.ok(Math.abs(a.sweep - (c.sectors[i]!.value / 100) * 360) < 1e-9),
  );
  // Drawn sectors carry no share or value in their attributes.
  const l = layoutScene(one(c));
  for (const i of c.sectors.keys())
    assert.deepEqual(item(l.items, `g.sector.${i}`).data, { sector: i });
});

test("circle graph labels sit inside their own sector, or the key carries them", () => {
  const inside = layoutScene(one(pie()));
  const center = item(inside.items, "g.edge.0") as Extract<
    Drawn,
    { k: "line" }
  >;
  const [cx, cy] = [center.x1, center.y1];
  const angles = sectorAngles(pie() as never);
  for (const [i, a] of angles.entries()) {
    const t = item(inside.items, `g.name.${i}`) as Extract<
      Drawn,
      { k: "text" }
    >;
    const x = (t.box.x0 + t.box.x1) / 2 - cx,
      y = cy - t.box.y1;
    const deg =
      ((((Math.atan2(y, x) * 180) / Math.PI - a.from) % 360) + 360) % 360;
    assert.ok(deg <= a.sweep, `name ${i} lies in its sector`);
  }
  const thin = pie({
    sectors: [
      { label: "Soccer", value: 45, text: "45%" },
      { label: "Tennis", value: 5, text: "5%" },
      { label: "Swimming", value: 50, text: "50%" },
    ],
  });
  const keyed = layoutScene(one(thin, { maxHeight: 420 }));
  const ids = texts(keyed.items).map((t) => t.id);
  for (const i of [0, 1, 2]) {
    assert.ok(ids.includes(`g.key.${i}`));
    assert.ok(ids.includes(`g.legend.${i}.name`));
    assert.ok(ids.includes(`g.legend.${i}.value`));
  }
  assert.ok(!ids.some((id) => id.startsWith("g.name.")));
  // Forced inside labels for the same data are still allowed.
  assert.ok(valid({ ...thin, labels: "inside" }));
});

test("a derived sector value is masked in the drawing and the description", () => {
  const c = pie({
    sectors: [
      { label: "Walk", value: 50, text: "50%" },
      { label: "Bus", value: 50, text: "50%", derived: true },
    ],
  });
  const masked = layoutScene(one(c));
  assert.equal(
    (item(masked.items, "g.value.1") as Extract<Drawn, { k: "text" }>).plain,
    "?",
  );
  assert.match(describeScene(one(c)), /Bus, value to find/);
  assert.doesNotMatch(describeScene(one(c)), /Bus 50%/);
  assert.match(describeScene(one(c), true), /Bus 50%/);
  assert.match(
    describeScene(
      one(
        pie({
          sectors: [
            { label: "A", value: 1 },
            { label: "B", value: 1, text: "1" },
          ],
        }),
      ),
    ),
    /A, value not shown/,
  );
});

test("the thermometer's liquid ends on its reading tick, and 0 is emphasized", () => {
  for (const t of [
    thermometer(),
    thermometer({
      unit: "C",
      min: -20,
      max: 20,
      minor: 1,
      major: 5,
      reading: -7,
    }),
  ]) {
    const l = layoutScene(one(t, { maxHeight: 420 }));
    const liquid = item(l.items, "t.liquid") as Extract<Drawn, { k: "rect" }>;
    const tick = item(l.items, `t.tick.${t.reading}`) as Extract<
      Drawn,
      { k: "line" }
    >;
    assert.ok(Math.abs(liquid.y - tick.y1) < 0.01, `top at ${t.reading}`);
    const labels = texts(l.items).filter((x) => x.id.startsWith("t.label."));
    assert.equal(labels.length, (t.max - t.min) / t.major + 1);
    // Minor ticks at least 6 px apart, labels at least 28 px apart.
    const next = item(l.items, `t.tick.${t.min + t.minor}`) as Extract<
      Drawn,
      { k: "line" }
    >;
    const first = item(l.items, `t.tick.${t.min}`) as Extract<
      Drawn,
      { k: "line" }
    >;
    assert.ok(first.y1 - next.y1 >= 6, "minor tick spacing");
    assert.ok(
      (first.y1 - next.y1) * (t.major / t.minor) >= 28,
      "label spacing",
    );
  }
  const below = layoutScene(
    one(
      thermometer({
        unit: "C",
        min: -20,
        max: 20,
        minor: 1,
        major: 5,
        reading: -7,
      }),
      { maxHeight: 420 },
    ),
  );
  const zero = item(below.items, "t.tick.0") as Extract<Drawn, { k: "line" }>;
  const five = item(below.items, "t.tick.5") as Extract<Drawn, { k: "line" }>;
  assert.ok(zero.w > five.w);
  assert.equal(
    (item(below.items, "t.label.-5") as Extract<Drawn, { k: "text" }>).plain,
    "−5",
  );
  const derived = one(thermometer({ derived: true }));
  assert.doesNotMatch(describeScene(derived), /64/);
  assert.match(describeScene(derived, true), /64 degrees Fahrenheit/);
});

test("ruler ticks shorten with the part, and the object ends on ticks", () => {
  assert.deepEqual(
    [8, 4, 2, 1, 3].map((k) => tickLength(k, 8, "in")),
    [18, 14, 11, 8, 8],
  );
  assert.deepEqual(
    [10, 5, 1].map((k) => tickLength(k, 10, "cm")),
    [18, 12, 7],
  );
  for (const r of [
    ruler(),
    ruler({
      unit: "cm",
      length: 6,
      parts: 10,
      object: { from: 20, to: 57, shape: "ribbon" },
    }),
  ]) {
    // At the phone width the ticks stay countable.
    const l = layoutScene({ ...one(r), width: 288 });
    const ticks = l.items.filter((d) => /^r\.tick\.\d+$/.test(d.id));
    assert.equal(ticks.length, r.length * r.parts + 1);
    const x = (k: number) =>
      (item(l.items, `r.tick.${k}`) as Extract<Drawn, { k: "line" }>).x1;
    // Never finer than a real ruler (a millimeter is 3.78 CSS px).
    assert.ok(x(1) - x(0) >= 3.8, `${r.unit} tick spacing ${x(1) - x(0)}`);
    for (const [key, k] of [
      ["start", r.object.from],
      ["end", r.object.to],
    ] as const) {
      const guide = item(l.items, `r.guide.${key}`) as Extract<
        Drawn,
        { k: "line" }
      >;
      assert.ok(Math.abs(guide.x1 - x(k)) < 0.01, `${key} on tick ${k}`);
    }
    const said = describeScene(one(r));
    // Never the measured length itself.
    const length = (r.object.to - r.object.from) / r.parts;
    assert.doesNotMatch(said, new RegExp(`\\b${length}\\b`));
  }
  assert.ok(
    (() => {
      const l = layoutScene({ ...one(ruler()), width: 288 });
      const x = (k: number) =>
        (item(l.items, `r.tick.${k}`) as Extract<Drawn, { k: "line" }>).x1;
      return x(1) - x(0) >= 7;
    })(),
    "eighths of a 4-inch ruler are at least 7 px apart on a phone",
  );
});

test("coins are drawn to true relative size, ridged only on dimes and quarters, and never named", () => {
  const coins = ["penny", "nickel", "dime", "quarter"] as const;
  const s = one({
    type: "coins",
    id: "c",
    coins: coins.map((coin, i) => ({ coin, label: "ABCD"[i] })),
  });
  const l = layoutScene(s);
  const r = coins.map(
    (_, i) =>
      (item(l.items, `c.coin.${i}`) as Extract<Drawn, { k: "circle" }>).r,
  );
  coins.forEach((coin, i) =>
    assert.ok(
      Math.abs(r[i]! / r[0]! - coinDiameter[coin] / coinDiameter.penny) < 1e-9,
    ),
  );
  const ridged = (i: number) =>
    l.items.some((d) => d.id.startsWith(`c.coin.${i}.ridge.`));
  assert.deepEqual([0, 1, 2, 3].map(ridged), [false, false, true, true]);
  const said = describeScene(s).toLowerCase();
  for (const word of [...coins, "cent", "¢", "value"])
    assert.ok(!said.includes(word), `description names "${word}"`);
  for (const t of texts(l.items)) assert.match(t.plain, /^[A-D]$/);
  // No coin is named in the drawing's attributes either.
  assert.ok(
    l.items.every(
      (d) => !JSON.stringify(d.data ?? {}).match(/penny|nickel|dime|quarter/),
    ),
  );
  // Letters share one baseline.
  const ys = texts(l.items).map((t) => t.y);
  assert.ok(Math.max(...ys) - Math.min(...ys) < 0.01);
});

test("a stepped cube solid draws every column and describes its heights", () => {
  const s = one({
    type: "isoSolid",
    id: "s",
    solid: { form: "steps", width: 3, columns: [4, 4, 3, 2, 1] },
  });
  const l = layoutScene(s);
  // Runs of equal height are one ruled box: 4,4 | 3 | 2 | 1.
  for (const start of [0, 2, 3, 4]) item(l.items, `s.step.${start}.top`);
  assert.match(describeScene(s), /columns are 4, 4, 3, 2, 1 cubes high/);
  assert.equal(sceneCapability(s), "scenes-v2");
});

test("an axis value that needs a newer figure falls back to its legacy value for an older client", () => {
  const axis = defineAxis("display", ["table", "drawn"], {
    needs: { drawn: "scenes-v2" },
  });
  const other = defineAxis("order", ["a", "b", "c"]);
  const axes = { display: axis, order: other };
  let drawn = 0;
  for (let i = 0; i < 200; i++) {
    const seed = `s:${i}`;
    const all = chooseAxes("t", seed, axes);
    const old = withClientFigures(["scenes-v1"], () =>
      chooseAxes("t", seed, axes),
    );
    const current = withClientFigures([...figureCapabilities], () =>
      chooseAxes("t", seed, axes),
    );
    assert.deepEqual(current, all);
    assert.equal(old.display, "table");
    // The other axis draws from its own stream, unaffected.
    assert.equal(old.order, all.order);
    if (all.display === "drawn") drawn++;
  }
  assert.ok(drawn > 50 && drawn < 150);
  assert.throws(() =>
    defineAxis("display", ["table", "drawn"], {
      needs: { table: "scenes-v2" },
    }),
  );
});
