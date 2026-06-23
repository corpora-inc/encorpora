/**
 * Headless gameplay test for Lingo Hero — the kind of test that catches
 * interaction/UI bugs the build/typecheck/adversarial gates cannot "see"
 * because nothing else actually PLAYS the game. It drives the built bundle in a
 * real (headless) browser, in an app-like offset container, and asserts the core
 * interaction contracts that humans kept having to catch by hand:
 *
 *   1. Tapping the correct lane at a card's visual position SCORES.        (input coords)
 *   2. Tapping an on-screen control (mute) does NOT leak into a lane.      (tap-through)
 *
 * It also captures menu + gameplay screenshots (visual proof) into test/e2e/out/.
 *
 * Run:  npm run build  (produces ../../dist)
 *       node test/e2e/gameplay.spec.mjs   (needs `playwright` + chromium available)
 * Exits non-zero on any failed assertion so it can gate in CI.
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const harness = "file://" + join(here, "harness.html");
const outDir = join(here, "out");
mkdirSync(outDir, { recursive: true });

const fail = (m) => { console.error("FAIL:", m); failures++; };
let failures = 0;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => fail("pageerror: " + e.message));
await page.goto(harness);
await page.waitForFunction(() => !!window.__lingoHero, { timeout: 10000 });
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, "menu.png") });

const read = () => page.evaluate(() => {
  const g = window.__lingoHero, ls = g.laneSystem, r = g.canvas.getBoundingClientRect();
  return {
    score: g.score, strumY: ls.getStrumLineY(),
    laneX: [ls.getLaneX(0), ls.getLaneX(1), ls.getLaneX(2)],
    canvas: { left: r.left, top: r.top },
    notes: (g.notes || []).map((n) => ({ lane: n.lane, y: n.y, isTarget: n.isTarget, hit: n.hit, missed: n.missed })),
  };
});

await page.evaluate(() => {
  const p = [...document.querySelectorAll("button")].find((b) => /practice/i.test(b.textContent || ""));
  if (p) p.click(); else window.__lingoHero.startGame("PRACTICE");
});

// Contract 2: control tap must NOT score.
const mute = await page.evaluate(() => {
  const b = document.querySelector(".na-mute-toggle"); if (!b) return null;
  const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
if (!mute) fail("no .na-mute-toggle control found");
else {
  const before = (await read()).score;
  await page.mouse.click(mute.x, mute.y);
  await page.waitForTimeout(120);
  if ((await read()).score !== before) fail("tap-through: mute tap changed the score");
  else console.log("OK: mute tap did not leak into a lane");
}

// Contract 1: correct lane tap at the card's visual position must score.
let scored = false;
const deadline = Date.now() + 15000;
while (Date.now() < deadline && !scored) {
  const s = await read();
  const t = s.notes.find((n) => n.isTarget && !n.hit && !n.missed);
  if (t && t.y >= s.strumY - 40 && t.y <= s.strumY + 40) {
    const before = s.score;
    await page.screenshot({ path: join(outDir, "gameplay.png") });
    await page.mouse.click(s.canvas.left + s.laneX[t.lane], s.canvas.top + s.strumY);
    await page.waitForTimeout(120);
    if ((await read()).score > before) { scored = true; console.log("OK: correct lane tap scored"); }
    else fail("correct lane tap at visual position did not score");
    break;
  }
  await page.waitForTimeout(60);
}
if (!scored && failures === 0) fail("no target note reached the strum line in time");

await browser.close();
console.log(failures === 0 ? "\nGAMEPLAY E2E: PASS" : `\nGAMEPLAY E2E: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
