/**
 * BZ-01 and BZ-02 — the token discipline and the two standing lint rules.
 *
 * BZ-01  Three layers. No literal colour outside the MATERIALS block; every
 *        semantic role exists in both `:root` and `.bz-night`; `palette.ts`
 *        and `bazaar.css` never drift.
 * BZ-02  Zero `rgba(0,0,0,*)` and zero `box-shadow` blur over 2 px anywhere in
 *        `bazaar/`. Shadow is transmitted skylight; depth is haze and
 *        occlusion, never blur.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MATERIALS } from "./palette.ts";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..");
const css = readFileSync(join(here, "bazaar.css"), "utf8");

/** Comments describe the laws; they are not violations of them. */
function strip(body: string): string {
  return body
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

function section(name: string): string {
  const marks = ["LAYER 1 — MATERIALS", "LAYER 2 — SEMANTIC", "LAYER 3 — UTILITY"];
  const i = marks.indexOf(name);
  const start = css.indexOf(marks[i]!);
  const end = i + 1 < marks.length ? css.indexOf(marks[i + 1]!) : css.length;
  assert.ok(start >= 0, `section ${name} not found`);
  return css.slice(start, end);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === "dist" || e === "shots") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    // The lint tests quote the patterns they ban, so they exempt themselves.
    else if (/\.(ts|css)$/.test(e) && !e.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

test("BZ-01: every material in palette.ts appears in the CSS with the same value", () => {
  const materials = section("LAYER 1 — MATERIALS");
  for (const [name, hex] of Object.entries(MATERIALS)) {
    const decl = `--color-${name}: ${hex};`;
    assert.ok(materials.includes(decl), `bazaar.css is missing or differs on: ${decl}`);
  }
});

test("BZ-01: no literal colour appears outside the MATERIALS layer", () => {
  const rest = section("LAYER 2 — SEMANTIC") + section("LAYER 3 — UTILITY");
  const hex = rest.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
  assert.deepEqual(hex, [], `literal colours outside layer 1: ${hex.join(", ")}`);
  const fn = rest.match(/\b(rgb|rgba|hsl|hsla|oklch|color-mix)\(/g) ?? [];
  assert.deepEqual(fn, [], `colour functions outside layer 1: ${fn.join(", ")}`);
});

test("BZ-01: every semantic role is re-cut in the night theme", () => {
  const semantic = section("LAYER 2 — SEMANTIC");
  const root = semantic.slice(semantic.indexOf(":root {"), semantic.indexOf(".bz-night"));
  const nightEnd = semantic.indexOf("Non-material tokens");
  const night = semantic.slice(semantic.indexOf(".bz-night"), nightEnd);
  const names = [...root.matchAll(/(--bz-[a-z-]+):/g)].map((m) => m[1]!);
  assert.ok(names.length >= 18, "the semantic layer looks truncated");
  for (const n of names) {
    assert.ok(night.includes(`${n}:`), `${n} has no night value`);
  }
  // …and a non-material token must NOT be duplicated into the night block.
  assert.ok(!night.includes("--bz-cut-sm:"), "a colourless token was re-cut in night");
});

test("BZ-02: no rgba(0,0,0,*) anywhere in the bazaar", () => {
  for (const f of walk(src)) {
    const body = strip(readFileSync(f, "utf8"));
    const hits = body.match(/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*[,)]/g);
    assert.equal(hits, null, `${f} composites over black: ${hits?.join(", ")}`);
    // …and the same rule expressed in canvas terms.
    const canvas = body.match(/alpha\(\s*["']#000/g);
    assert.equal(canvas, null, `${f} uses black with an alpha`);
  }
});

test("BZ-02: no box-shadow blur over 2px, and no filter: blur()", () => {
  for (const f of walk(src)) {
    const body = strip(readFileSync(f, "utf8"));
    for (const m of body.matchAll(/box-shadow:\s*([^;]+);/g)) {
      const lengths = [...m[1]!.matchAll(/(-?[\d.]+)px/g)].map((x) => Number(x[1]));
      // offset-x, offset-y, blur, spread — the third is the one that is banned.
      if (lengths.length >= 3) {
        assert.ok(lengths[2]! <= 2, `${f}: box-shadow blur ${lengths[2]}px > 2px`);
      }
    }
    assert.equal(
      /filter:\s*[^;]*blur\(/.test(body),
      false,
      `${f}: depth is haze and occlusion, never blur`,
    );
  }
});

test("the bazaar imports nothing from the work surface or the engine", () => {
  for (const f of walk(src)) {
    const body = readFileSync(f, "utf8");
    for (const m of body.matchAll(/from\s+["']([^"']+)["']/g)) {
      const spec = m[1]!;
      assert.ok(
        !/(^|\/)(work|engine|curriculum|reactions)\//.test(spec),
        `${f} reaches into ${spec}; the bazaar never waits for the world`,
      );
    }
  }
});
