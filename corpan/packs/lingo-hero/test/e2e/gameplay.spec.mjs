/**
 * Headless gameplay test for Lingo Hero — "CATCH THE TRANSLATION" (batch CHART).
 *
 * It drives the BUILT bundle in a real (headless) browser, in an app-like
 * OFFSET container, and asserts the core interaction contracts that humans kept
 * having to catch by hand — the ones the build / typecheck / adversarial gates
 * cannot "see" because nothing else actually PLAYS the game:
 *
 *   (a) MOTION IS REAL — a falling card's y INCREASES across sampled frames.
 *       (Catches the prior "frozen notes" no-ship bug head-on; the chart now
 *       times notes off their strum beat, so this guards that math too.)
 *   (b) CATCH SCORES — tapping the lane of the correct NEXT target word (the
 *       one with seqIndex === caughtCount), at its visual position on the strum
 *       line, INCREASES the score. (input coords + catch-in-sequence)
 *   (c) NO TAP-THROUGH — tapping the on-screen Exit control does NOT score
 *       (the in-game mute button was removed; Exit is the only top chrome and
 *       must capture its own taps rather than leaking into a lane).
 *   (d) NO BRICK — a round left with NO INPUT eventually RESOLVES (the chart
 *       exhausts and the phrase resolves into the result linger / next round)
 *       rather than leaving the player stuck with empty lanes + half strip.
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
    score: g.score, strumY: ls.getStrumLineY(), caughtCount: g.caughtCount,
    laneX: [ls.getLaneX(0), ls.getLaneX(1), ls.getLaneX(2)],
    canvas: { left: r.left, top: r.top },
    // Anti-brick introspection.
    lingering: g.lingering, roundResolved: g.roundResolved, hasRound: !!g.round,
    notes: (g.notes || []).map((n) => ({
      id: n.id, lane: n.lane, y: n.y, isTarget: n.isTarget,
      seqIndex: n.seqIndex, hit: n.hit, missed: n.missed,
    })),
  };
});

// Start a Practice run (click the menu button like a real player would).
await page.evaluate(() => {
  const p = [...document.querySelectorAll("button")].find((b) => /practice/i.test(b.textContent || ""));
  if (p) p.click(); else window.__lingoHero.startGame("PRACTICE");
});
await page.waitForFunction(() => (window.__lingoHero.notes || []).length > 0, { timeout: 10000 });

// --- Contract (a): cards actually FALL (y increases across frames). ----------
{
  // Track ONE specific live target card by id and sample its y over ~5 frames.
  const first = (await read()).notes.find((n) => !n.hit && !n.missed);
  if (!first) fail("no live note on screen to sample motion");
  else {
    const ys = [];
    for (let i = 0; i < 6; i++) {
      const s = await read();
      const n = s.notes.find((m) => m.id === first.id);
      if (n) ys.push(n.y);
      await page.waitForTimeout(80);
    }
    const moved = ys.length >= 2 && ys[ys.length - 1] > ys[0] + 1;
    if (!moved) fail(`falling note did not move: y samples = ${JSON.stringify(ys)}`);
    else console.log(`OK: card falls (y ${ys[0].toFixed(0)} -> ${ys[ys.length - 1].toFixed(0)})`);
  }
}

// --- Contract (c): control tap (Exit) must NOT score (no tap-through). -------
// The Exit button is the only top chrome now. It sits in the pointer-events:none
// overlay but opts back in, so a tap on it must NOT reach the lane input. We
// stub corpan:exit so the click doesn't actually tear the game down mid-test.
await page.evaluate(() => {
  window.__exitFired = 0;
  window.addEventListener("corpan:exit", () => { window.__exitFired++; }, true);
});
const exit = await page.evaluate(() => {
  const b = document.querySelector("#lh-exit"); if (!b) return null;
  const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
if (!exit) fail("no #lh-exit control found");
else {
  const before = (await read()).score;
  await page.mouse.click(exit.x, exit.y);
  await page.waitForTimeout(140);
  if ((await read()).score !== before) fail("tap-through: Exit tap changed the score");
  else console.log("OK: Exit tap did not leak into a lane");
}

// --- Contract (b): catching the correct NEXT target word scores. -------------
// The whole translation is laid out as a time-spaced chart; the catchable word
// is the target note whose seqIndex === caughtCount. Click ITS lane at the
// strum-line position when it arrives. Do this for a couple of words so we
// exercise the catch-in-sequence advance, asserting the score climbs.
let catches = 0;
const deadline = Date.now() + 25000;
while (Date.now() < deadline && catches < 2) {
  const s = await read();
  const t = s.notes.find(
    (n) => n.isTarget && n.seqIndex === s.caughtCount && !n.hit && !n.missed
  );
  if (t && t.y >= s.strumY - 44 && t.y <= s.strumY + 44) {
    const before = s.score;
    if (catches === 0) await page.screenshot({ path: join(outDir, "gameplay.png") });
    await page.mouse.click(s.canvas.left + s.laneX[t.lane], s.canvas.top + s.strumY);
    await page.waitForTimeout(140);
    if ((await read()).score > before) { catches++; console.log(`OK: caught correct word #${catches} (score up)`); }
    else { fail("catching the correct word at its visual position did not score"); break; }
  }
  await page.waitForTimeout(50);
}
if (catches === 0 && failures === 0) fail("no target word reached the strum line in time");

// --- Contract (d): NO-BRICK — a round with NO INPUT eventually resolves. -----
// Wait for a fresh, unresolved round to be in flight, then do NOTHING and
// assert it resolves (the chart exhausts → result linger / next round) within a
// generous window. This guards the foreground brick: empty lanes + half strip +
// no resolution must never persist.
{
  // Wait until a round is active and not yet resolved (a fresh chart in flight).
  let fresh = false;
  const freshDeadline = Date.now() + 12000;
  while (Date.now() < freshDeadline) {
    const s = await read();
    if (s.hasRound && !s.roundResolved && !s.lingering) { fresh = true; break; }
    await page.waitForTimeout(120);
  }
  if (!fresh) {
    fail("never observed a fresh unresolved round to test no-brick");
  } else {
    // Do nothing; the chart should exhaust and the round must resolve.
    let resolved = false;
    const resolveDeadline = Date.now() + 30000;
    while (Date.now() < resolveDeadline) {
      const s = await read();
      if (s.lingering || s.roundResolved) { resolved = true; break; }
      await page.waitForTimeout(200);
    }
    if (!resolved) fail("BRICK: a round with no input never resolved (stuck)");
    else console.log("OK: no-input round resolved (no brick)");
  }
}

await page.screenshot({ path: join(outDir, "gameplay-final.png") });
await browser.close();
console.log(failures === 0 ? "\nGAMEPLAY E2E: PASS" : `\nGAMEPLAY E2E: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
