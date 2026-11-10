import assert from "node:assert/strict";
import test from "node:test";
import {
  describeScene,
  layoutScene,
  sceneCapability,
  sceneSchema,
  type Drawn,
  type Scene,
} from "../src/math/scene/index.js";
import {
  SCATTER_GAP,
  framesOf,
  groupsOf,
  rowOf,
  scatterOf,
  thingArt,
  thingKinds,
  thingNames,
  thingOps,
} from "../src/math/scene/components/things-art.js";
import { thingsCases } from "../src/math/scene/gallery-things.js";
import {
  figureCapabilities,
  type FigureCapability,
} from "../src/math/contracts.js";
import { fillRoles, inkRoles } from "../src/math/scene/roles.js";

const one = (element: unknown, extra: object = {}) =>
  ({ v: 1, elements: [element], ...extra }) as Scene;
const things = (extra: object = {}) => ({
  type: "things",
  id: "t",
  sets: [{ kind: "apple", count: 5 }],
  ...extra,
});
const valid = (element: unknown) => sceneSchema.safeParse(one(element)).success;
/** The box a thing's paths cover, in pixels. */
function boxOf(items: Drawn[], id: string) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const d of items) {
    if (d.k !== "path" || !d.id.startsWith(`${id}.`)) continue;
    const v = d.d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    for (let i = 0; i + 1 < v.length; i += 2) {
      x0 = Math.min(x0, v[i]!);
      x1 = Math.max(x1, v[i]!);
      y0 = Math.min(y0, v[i + 1]!);
      y1 = Math.max(y1, v[i + 1]!);
    }
  }
  assert.ok(Number.isFinite(x0), `no paths for ${id}`);
  return { x0, y0, x1, y1 };
}

test("there are 24 kinds, each named and drawn inside its box with theme roles only", () => {
  assert.equal(thingKinds.length, 24);
  assert.equal(new Set(thingKinds).size, 24);
  for (const kind of thingKinds) {
    assert.equal(thingNames[kind].length, 2, kind);
    const layers = thingArt[kind];
    assert.ok(layers.length >= 1 && layers.length <= 8, `${kind}: layers`);
    let x0 = 100,
      y0 = 100,
      x1 = 0,
      y1 = 0;
    for (const layer of layers) {
      assert.ok(layer.fill || layer.stroke, `${kind}: a layer paints nothing`);
      if (layer.fill) assert.ok(fillRoles.includes(layer.fill), kind);
      if (layer.stroke) assert.ok(inkRoles.includes(layer.stroke), kind);
      for (const op of thingOps(layer.d))
        for (let i = 1; i + 1 < op.length; i += 2) {
          x0 = Math.min(x0, op[i] as number);
          x1 = Math.max(x1, op[i] as number);
          y0 = Math.min(y0, op[i + 1] as number);
          y1 = Math.max(y1, op[i + 1] as number);
        }
    }
    // Room for the outline inside the box, and big enough to read at 24 px.
    assert.ok(x0 >= 3 && y0 >= 3 && x1 <= 97 && y1 <= 97, `${kind}: leaves its box`);
    assert.ok(Math.max(x1 - x0, y1 - y0) >= 70, `${kind}: too small in its box`);
  }
});

test("things need scenes-v3, which no client is offered yet", () => {
  for (const c of thingsCases)
    assert.equal(sceneCapability(c.scene), "scenes-v3", c.name);
  // Until the wire contract lists it, generateProblemFor refuses to send one.
  assert.ok(!figureCapabilities.includes("scenes-v3" as FigureCapability));
});

test("every thing is drawn once, in counting order, between 24 and 72 px", () => {
  for (const c of thingsCases) {
    const l = layoutScene(c.scene);
    const element = c.scene.elements[0]!;
    assert.equal(element.type, "things");
    if (element.type !== "things") continue;
    const count = element.sets.reduce((s, set) => s + set.count, 0);
    assert.ok(l.scale <= 72 + 1e-6, `${c.name}: ${l.scale}px`);
    // The tightest row (ten things) on a 288 px phone stage.
    const phone = layoutScene({ ...c.scene, width: 296 });
    assert.ok(phone.scale >= 24 - 1e-6, `${c.name}: ${phone.scale}px on a phone`);
    const boxes = Array.from({ length: count }, (_, i) =>
      boxOf(l.items, `${element.id}.thing.${i}`),
    );
    assert.ok(
      !l.items.some((d) => d.id.startsWith(`${element.id}.thing.${count}.`)),
      c.name,
    );
    for (let i = 0; i < count; i++)
      for (let j = i + 1; j < count; j++) {
        const a = boxes[i]!,
          b = boxes[j]!;
        assert.ok(
          a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0,
          `${c.name}: things ${i} and ${j} overlap`,
        );
      }
  }
});

test("a row and a grid count left to right, then down", () => {
  const row = rowOf(5);
  assert.deepEqual(
    row.slots.map(([x]) => +x.toFixed(2)),
    [0.6, 1.8, 3, 4.2, 5.4],
  );
  assert.ok(row.slots.every(([, y]) => y === row.slots[0]![1]));
  const grid = rowOf(7, 5);
  assert.equal(+grid.w.toFixed(2), 6);
  assert.equal(+grid.h.toFixed(2), 2.4);
  assert.ok(grid.slots[5]![1] > grid.slots[4]![1]);
  assert.equal(grid.slots[5]![0], grid.slots[0]![0]);
});

test("a scatter never overlaps, stays in its box, and is the same for the same seed", () => {
  for (let count = 1; count <= 24; count++)
    for (const seed of ["a", "pond", "toy-box", "17"]) {
      const s = scatterOf(count, seed);
      assert.equal(s.slots.length, count);
      assert.deepEqual(scatterOf(count, seed), s);
      for (const [x, y] of s.slots)
        assert.ok(
          x >= 0.5 && y >= 0.5 && x <= s.w - 0.5 && y <= s.h - 0.5,
          `${count} ${seed}: outside`,
        );
      for (let i = 0; i < count; i++)
        for (let j = i + 1; j < count; j++) {
          const [ax, ay] = s.slots[i]!,
            [bx, by] = s.slots[j]!;
          // Each thing is one unit wide: boxes keep a gap on one axis.
          assert.ok(
            Math.max(Math.abs(ax - bx), Math.abs(ay - by)) >=
              1 + SCATTER_GAP - 1e-9,
            `${count} ${seed}: ${i} and ${j} too close`,
          );
        }
    }
  assert.notDeepEqual(scatterOf(7, "a").slots, scatterOf(7, "b").slots);
});

test("groups stand apart and frames are rows of five boxes", () => {
  const g = groupsOf([3, 2]);
  assert.deepEqual(g.starts, [0, 3]);
  const gap = g.slots[3]![0] - g.slots[2]![0],
    step = g.slots[1]![0] - g.slots[0]![0];
  assert.ok(gap > step * 1.5, "a visible gap between groups");
  const ten = framesOf(10);
  assert.equal(ten.slots.length, 10);
  assert.equal(ten.cells!.length, 10);
  assert.equal(ten.slots[5]![0], ten.slots[0]![0]);
  assert.ok(ten.slots[5]![1] > ten.slots[0]![1]);
  const two = framesOf(10, 2);
  assert.equal(two.slots.length, 20);
  // The second frame sits clear of the first.
  assert.ok(two.cells![10]![1] > ten.h);
  assert.equal(framesOf(5).slots.length, 5);
  assert.equal(framesOf(5).h, framesOf(5).cells![0]![3]);
});

test("frames draw their boxes and hold each thing inside its own box", () => {
  const l = layoutScene(
    one(things({ sets: [{ kind: "strawberry", count: 7 }], arrange: "frame" })),
  );
  const slots = l.items.filter((d) => /^t\.slot\.\d+$/.test(d.id));
  assert.equal(slots.length, 10);
  for (let i = 0; i < 7; i++) {
    const slot = slots[i]!,
      b = boxOf(l.items, `t.thing.${i}`);
    assert.equal(slot.k, "rect");
    if (slot.k !== "rect") continue;
    assert.ok(
      b.x0 >= slot.x && b.x1 <= slot.x + slot.w && b.y0 >= slot.y && b.y1 <= slot.y + slot.h,
      `thing ${i} leaves its box`,
    );
  }
  assert.equal(
    layoutScene(
      one(things({ sets: [{ kind: "star", count: 13 }], arrange: "frame" }), {
        maxHeight: 420,
      }),
    ).items.filter((d) => /^t\.slot\.\d+$/.test(d.id)).length,
    20,
  );
});

test("the description says how many of each, and how they sit", () => {
  assert.equal(
    describeScene(one(things())),
    "Things to count, in a row: 5 apples.",
  );
  assert.equal(
    describeScene(
      one(
        things({
          sets: [
            { kind: "duck", count: 3 },
            { kind: "leaf", count: 1 },
          ],
          arrange: "groups",
        }),
      ),
    ),
    "2 groups of things to count: 3 ducks and 1 leaf.",
  );
  assert.equal(
    describeScene(
      one(things({ sets: [{ kind: "strawberry", count: 7 }], arrange: "frame" })),
    ),
    "One ten-frame, each with 10 places, holding 7 strawberries. 3 places are empty.",
  );
  assert.match(
    describeScene(
      one(things({ sets: [{ kind: "fish", count: 4 }], arrange: "scatter" })),
    ),
    /scattered .*: 4 fish\.$/,
  );
});

test("the schema rejects unknown kinds and arrangements too wide to read", () => {
  assert.ok(valid(things()));
  assert.ok(valid(things({ arrange: "scatter", seed: "x" })));
  assert.ok(!valid(things({ sets: [{ kind: "dragon", count: 2 }] })));
  assert.ok(!valid(things({ sets: [{ kind: "apple", count: 0 }] })));
  assert.ok(!valid(things({ sets: [{ kind: "apple", count: 11 }] })));
  assert.ok(valid(things({ sets: [{ kind: "apple", count: 11 }], arrange: "grid" })));
  assert.ok(
    !valid(things({ sets: [{ kind: "apple", count: 12 }], arrange: "frame", frame: 5 })),
  );
  assert.ok(
    !valid(
      things({
        sets: [
          { kind: "apple", count: 20 },
          { kind: "duck", count: 5 },
        ],
        arrange: "grid",
      }),
    ),
  );
  assert.ok(!valid(things({ arrange: "grid", perRow: 11 })));
});
