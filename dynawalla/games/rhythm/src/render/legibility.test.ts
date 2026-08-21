/**
 * IS THE QUESTION READABLE, MEASURED FROM THE COMPOSITE?
 *
 * The founder, on the failure screen: *"the problem on 'restart the heart'
 * doesn't have enough contrast."*
 *
 * Nobody had chosen a bad colour. `drawHud` painted the question white inside an
 * `rgba(4,6,18,0.82)` panel — the most legible surface in the pack — and then the
 * breakdown overlay painted `rgba(3,4,12,0.72)` over the WHOLE canvas, question
 * included. The tests below reproduce that composite, prove it measured 2.30:1,
 * and prove the shipped surfaces clear the bars without it.
 *
 * This is why the numbers are computed and not eyeballed: the defect was not in
 * any colour, it was in the order of two draw calls thirty lines apart.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { LANE_COLOR, SECTOR_THEME } from "../theme.ts";
import {
  contrast,
  DEAD_BREAKDOWN_SCRIM,
  DEAD_BREAKDOWN_SCRIM_ALPHA,
  GLYPH,
  MIN_LETTERFORM,
  MIN_OBJECT,
  over,
  PROMPT_PANEL,
  PROMPT_PANEL_ALPHA,
  PROMPT_STROKE_ALPHA,
  promptPanels,
  skies,
  TILE_PANEL,
  TILE_PANEL_ALPHA,
  tilePanels,
  underScrim,
  worstLetterform,
  worstPanelEdge,
  sectors,
  type RGB,
} from "./ink.ts";

type ThemeMap = Record<string, { skyTop: RGB; skyBottom: RGB; horizon: RGB; bloom: RGB }>;
const SKY = skies(SECTOR_THEME as unknown as ThemeMap);
const SECTORS = sectors(SECTOR_THEME as unknown as ThemeMap);

test("the sky catalogue is the real one, not a snapshot that can go stale", () => {
  // Three surfaces per sector; if a sector is added or a sky is warmed up, this
  // moves, and so does every number below it.
  assert.equal(SKY.length, Object.keys(SECTOR_THEME).length * 3);
  assert.ok(SKY.length >= 18, `only ${SKY.length} sky surfaces were catalogued`);
});

test("the question clears the letterform bar on every sky the game has", () => {
  const panels = promptPanels(SKY);
  const worst = worstLetterform(GLYPH, panels);
  assert.ok(
    worst >= MIN_LETTERFORM,
    `the question measures ${worst.toFixed(2)}:1 against its panel at worst; the bar is ${MIN_LETTERFORM}:1`,
  );
  // …and it is not scraping past. State the real number so a regression is
  // visible as a change rather than as a pass.
  assert.ok(worst > 15, `the question measures only ${worst.toFixed(2)}:1; it used to measure 19.78:1`);
});

test("the SHIPPED 0.55 stroke did not clear the object bar — this is a fix, not a formality", () => {
  const was = worstPanelEdge(SECTORS, PROMPT_PANEL, PROMPT_PANEL_ALPHA, 0.55);
  assert.ok(
    was.ratio < MIN_OBJECT,
    `the stroke that shipped measured ${was.ratio.toFixed(2)}:1, which clears the bar — then raising ` +
      `it to ${PROMPT_STROKE_ALPHA} was unnecessary and this file is overstating its case`,
  );
  assert.equal(was.sector, "violet", `the worst sector moved to ${was.sector}`);
});

test("the question's panel is FOUND against every sky — by its stroke, because its fill cannot", () => {
  const worst = worstPanelEdge(SECTORS, PROMPT_PANEL, PROMPT_PANEL_ALPHA, PROMPT_STROKE_ALPHA);
  assert.ok(
    worst.ratio >= MIN_OBJECT,
    `the question panel measures ${worst.ratio.toFixed(2)}:1 at its best edge in the ` +
      `${worst.sector} sector; the bar is ${MIN_OBJECT}:1`,
  );

  // …and the fill alone provably cannot do it, at ANY opacity. This is the
  // reason the stroke is load-bearing rather than decorative, and it is stated
  // as a measurement so nobody deletes the border to tidy the design up.
  let bestFillOnly = 0;
  for (let a = 0; a <= 100; a++) {
    let w = Infinity;
    for (const s of SKY) w = Math.min(w, contrast(over(PROMPT_PANEL, s, a / 100), s));
    bestFillOnly = Math.max(bestFillOnly, w);
  }
  assert.ok(
    bestFillOnly < MIN_OBJECT,
    `an unstroked panel reaches ${bestFillOnly.toFixed(2)}:1 at its best opacity, which clears the ` +
      `${MIN_OBJECT}:1 bar — the claim that the stroke is necessary is wrong`,
  );
});

test("an answer tile's label clears the letterform bar, glow included", () => {
  const panels = tilePanels(SKY, LANE_COLOR as readonly RGB[]);
  const worst = worstLetterform(GLYPH, panels);
  assert.ok(
    worst >= MIN_LETTERFORM,
    `an answer tile's label measures ${worst.toFixed(2)}:1 at worst against its panel`,
  );
});

/* --------------------------------------------------------- the deleted scrim */

test("the deleted breakdown scrim measured 2.30:1 — this is the founder's report, as a number", () => {
  // The exact composite the shipped code produced: panel over sky, glyph over
  // panel, and then the full-canvas scrim over BOTH.
  let worst = Infinity;
  let best = 0;
  for (const s of SKY) {
    const panel = promptPanels([s])[0]!;
    const under = underScrim(panel, GLYPH, DEAD_BREAKDOWN_SCRIM, DEAD_BREAKDOWN_SCRIM_ALPHA);
    const c = contrast(under.glyph, under.panel);
    worst = Math.min(worst, c);
    best = Math.max(best, c);
  }
  assert.ok(
    best < MIN_LETTERFORM,
    `the scrimmed question measured ${best.toFixed(2)}:1 at its BEST, which would clear the ` +
      `${MIN_LETTERFORM}:1 bar — the reproduction of the defect is wrong`,
  );
  assert.ok(
    best < MIN_OBJECT,
    `the scrimmed question measured ${best.toFixed(2)}:1 at best, above even the ${MIN_OBJECT}:1 ` +
      `non-text bar`,
  );
  // Pin the number the report was about.
  assert.ok(
    Math.abs(worst - 2.3) < 0.05,
    `the scrimmed question measured ${worst.toFixed(2)}:1; the reported figure is 2.30:1`,
  );
});

test("removing the scrim is what fixed it — the same panel, unscrimmed, is 8x better", () => {
  const s = SKY[0]!;
  const panel = promptPanels([s])[0]!;
  const clean = contrast(GLYPH, panel);
  const scrimmed = underScrim(panel, GLYPH, DEAD_BREAKDOWN_SCRIM, DEAD_BREAKDOWN_SCRIM_ALPHA);
  const dirty = contrast(scrimmed.glyph, scrimmed.panel);
  assert.ok(
    clean / dirty > 8,
    `the scrim only cost ${(clean / dirty).toFixed(1)}x (${clean.toFixed(2)}:1 -> ${dirty.toFixed(2)}:1)`,
  );
});

test("NO full-canvas scrim is drawn over the question any more", async () => {
  // The mechanism, asserted directly rather than through its consequences: a
  // `fillRect` covering the whole canvas, painted after the question, is the
  // defect. There is exactly one such call left in the renderer — the white
  // flash — and it is rate-limited, amplitude-capped, and drawn BEFORE the HUD.
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(new URL("./renderer.ts", import.meta.url), "utf8");
  const hud = src.slice(src.indexOf("private drawHud("));
  assert.ok(hud.length > 500, "drawHud was not found; this test is measuring nothing");
  assert.equal(
    hud.includes("fillRect(0, 0, this.W, this.H)"),
    false,
    "a full-canvas fillRect is back inside drawHud, where the question is drawn",
  );
  assert.equal(
    src.includes("RESTART THE HEART"),
    true,
    "the phrase the founder likes was dropped along with the modal",
  );
});

/* ------------------------------------------------------------ the guard rail */

test("a hypothetical scrim of ANY strength over the question is caught by the maths", () => {
  // The bars are not decoration: they reject the defect at every alpha that
  // would actually have been used. 0.2 is a light dim and 0.72 is what shipped.
  const s = SKY[0]!;
  const panel = promptPanels([s])[0]!;
  const failing: number[] = [];
  const passing: number[] = [];
  for (const alpha of [0.2, 0.3, 0.4, 0.5, 0.6, 0.72, 0.85]) {
    const u = underScrim(panel, GLYPH, DEAD_BREAKDOWN_SCRIM, alpha);
    (contrast(u.glyph, u.panel) < MIN_LETTERFORM ? failing : passing).push(alpha);
  }
  // The cliff is between 0.5 and 0.6, and it is worth stating where it is
  // rather than only that it exists: a first draft of this test asserted 0.5
  // was unacceptable, ran, and found out otherwise. A 50% dim over the
  // question measures 5.19:1 and is genuinely fine. What shipped was 0.72.
  assert.deepEqual(failing, [0.6, 0.72, 0.85], `the cliff moved: failing at ${failing.join(", ")}`);
  assert.deepEqual(passing, [0.2, 0.3, 0.4, 0.5], `the cliff moved: passing at ${passing.join(", ")}`);
});

test("the panel alphas the renderer paints with are the ones measured here", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(new URL("./renderer.ts", import.meta.url), "utf8");
  const prompt = `rgba(${PROMPT_PANEL.join(",")},${PROMPT_PANEL_ALPHA})`;
  const tile = `rgba(${TILE_PANEL.join(",")},${TILE_PANEL_ALPHA})`;
  assert.ok(src.includes(prompt), `the renderer no longer paints the question panel as ${prompt}`);
  assert.ok(src.includes(tile), `the renderer no longer paints an answer tile as ${tile}`);
  // The stroke alpha is IMPORTED by the renderer rather than re-typed, which is
  // the only way the measured number and the painted number cannot drift.
  assert.ok(
    src.includes("rgba(th.horizon, PROMPT_STROKE_ALPHA)"),
    "the renderer went back to a literal stroke alpha, so this file's 4.57:1 is now a claim about nothing",
  );
  assert.equal(
    src.includes("rgba(th.horizon, 0.55)"),
    false,
    "the 0.55 stroke that measured 2.68:1 in the violet sector is back",
  );
});
