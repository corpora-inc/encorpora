// THE RIM IS ACTUALLY THERE, AND IT ACTUALLY DARKENS SOMETHING.
//
// `legibility.test.ts` proves the arithmetic: a counter-ink rim is the only way
// a digit clears 4.5:1 inside its own bloom. This file proves the arithmetic is
// about the sprite the canvas really paints.
//
// It exists because of POLARITY, which had a dark contrast rim on its numerals
// that never darkened a pixel — the sprite was drawn with `AdditiveBlending`, so
// the rim resolved to `vec3(0.0)` and added nothing. Its best achievable ink was
// 1.007:1 and its contrast module was, arithmetically, correct. The blend mode
// is where the claim died, so the blend mode is asserted here.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { drawGlyph, getGlyph } from "./bake.ts";
import { INK_RIM, RIM_WIDTH } from "./ink.ts";

type Op = { kind: string; style: string; width: number; blur: number; composite: string };

function install(): { ops: Op[]; restore(): void } {
  const ops: Op[] = [];
  const g = globalThis as Record<string, unknown>;
  const saved = g.document;
  const makeCtx = (): unknown => {
    const store: Record<string, unknown> = {
      font: "10px sans-serif",
      fillStyle: "#000",
      strokeStyle: "#000",
      lineWidth: 1,
      lineJoin: "miter",
      lineCap: "butt",
      shadowBlur: 0,
      shadowColor: "#000",
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
    };
    const record = (kind: string, style: string): void => {
      ops.push({
        kind,
        style,
        width: Number(store.lineWidth),
        blur: Number(store.shadowBlur),
        composite: String(store.globalCompositeOperation),
      });
    };
    const named: Record<string, unknown> = {
      measureText: (s: string) => ({ width: String(s).length * 50 }),
      fillText: (): void => record("fill", String(store.fillStyle)),
      strokeText: (): void => record("stroke", String(store.strokeStyle)),
      drawImage: (): void => record("blit", String(store.fillStyle)),
      createRadialGradient: () => ({ addColorStop: (): void => undefined }),
      createLinearGradient: () => ({ addColorStop: (): void => undefined }),
    };
    return new Proxy(store, {
      get: (t, p: string) => (p in named ? named[p] : p in t ? t[p] : () => undefined),
      set: (t, p: string, v) => {
        t[p] = v;
        return true;
      },
    });
  };
  g.document = {
    createElement: () => ({ width: 0, height: 0, getContext: makeCtx }),
  };
  return {
    ops,
    restore(): void {
      if (saved === undefined) Reflect.deleteProperty(g, "document");
      else g.document = saved;
    },
  };
}

test("a baked numeral carries an opaque rim, between the bloom and the core", () => {
  const rig = install();
  try {
    // A text unique to this test: `getGlyph` caches by key and other tests in
    // the same process would otherwise hand back a sprite baked elsewhere.
    getGlyph("rim-check-7", "#7CF3DC", 800);
    const kinds = rig.ops.map((o) => o.kind).join(",");
    assert.equal(
      kinds,
      "fill,fill,stroke,fill",
      `the bake laid down ${kinds}; the rim must be stroked after both bloom fills and before the core`,
    );
    const rim = rig.ops[2] as Op;
    assert.equal(
      rim.style.toLowerCase(),
      INK_RIM.toLowerCase(),
      `the rim was stroked in ${rim.style}, not the trench's own dark water`,
    );
    // Opaque. An `rgba(...)` rim would let the bloom through and the contrast
    // this pack now claims would be a claim about a colour nothing is painted in.
    assert.ok(
      !rim.style.includes("rgba"),
      `the rim is translucent (${rim.style}); the bloom shows through it`,
    );
    assert.equal(rim.blur, 0, "the rim is blurred, so it has no edge to read a letterform against");
    assert.equal(
      rim.width,
      92 * RIM_WIDTH,
      `the rim is ${rim.width} bake px wide, not the ${92 * RIM_WIDTH} RIM_WIDTH asks for`,
    );
  } finally {
    rig.restore();
  }
});

test("a glyph is blitted source-over even when the caller left `lighter` behind", () => {
  // The POLARITY assertion. `drawHusk` and `drawEquation` both set the composite
  // back by hand today, and a comment is not a mechanism: the next glow added
  // above a numeral would silently turn the rim into a no-op again.
  const rig = install();
  try {
    const glyph = getGlyph("blit-check-3", "#7CF3DC", 800);
    const ctx = (
      globalThis.document.createElement("canvas") as unknown as {
        getContext(): CanvasRenderingContext2D;
      }
    ).getContext();
    ctx.globalCompositeOperation = "lighter";
    rig.ops.length = 0;
    drawGlyph(ctx, glyph, 10, 10, 40);
    const blit = rig.ops.find((o) => o.kind === "blit");
    assert.ok(blit, "nothing was blitted");
    assert.equal(
      blit.composite,
      "source-over",
      `the numeral was blitted with \`${blit.composite}\`, under which an opaque dark rim darkens nothing`,
    );
    assert.equal(
      ctx.globalCompositeOperation,
      "lighter",
      "drawGlyph did not put the caller's composite back",
    );

    // And the one caller that genuinely wants the sprite added can still say so.
    rig.ops.length = 0;
    ctx.globalCompositeOperation = "source-over";
    drawGlyph(ctx, glyph, 10, 10, 40, 1, "lighter");
    assert.equal((rig.ops.find((o) => o.kind === "blit") as Op).composite, "lighter");
  } finally {
    rig.restore();
  }
});
