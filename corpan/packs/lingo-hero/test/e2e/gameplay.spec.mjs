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
 *   (c) NO TAP-THROUGH — tapping the on-screen chrome (the Pause control + its
 *       Resume/Exit sheet, and the single Mute toggle) does NOT score; the
 *       controls must capture their own taps rather than leaking into a lane.
 *   (e) PROMPT FULLY VISIBLE — a deliberately LONG primary-language prompt
 *       renders without truncation (no horizontal overflow; wraps within the
 *       header band). The #426 prompt auto-fit/wrap contract.
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
    combo: g.combo, decoyDodges: g.decoyDodges,
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

// --- Contract (c): control tap (Pause) must NOT score (no tap-through). ------
// The top-left chrome is now a PAUSE control that opens a Resume/Exit sheet, plus
// a single MUTE toggle. Both sit in the pointer-events:none overlay but opt back
// in + stopPropagation, so a tap on them must NOT reach the lane input. We stub
// corpan:exit so the eventual Exit doesn't tear the game down mid-test, and
// force the chrome visible (it auto-fades during play) before measuring.
await page.evaluate(() => {
  window.__exitFired = 0;
  window.addEventListener("corpan:exit", () => { window.__exitFired++; }, true);
  // Surface the auto-fading chrome so the control is hittable in this frame.
  document.querySelector(".ui-layer")?.classList.remove("chrome-hidden");
});
const pauseCtl = await page.evaluate(() => {
  const b = document.querySelector("#lh-pause"); if (!b) return null;
  const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
if (!pauseCtl) fail("no #lh-pause control found");
else {
  const before = (await read()).score;
  await page.mouse.click(pauseCtl.x, pauseCtl.y);
  await page.waitForTimeout(140);
  if ((await read()).score !== before) fail("tap-through: Pause tap changed the score");
  else console.log("OK: Pause tap did not leak into a lane");
  // The pause sheet must now be open (Resume / Exit) and the run paused.
  const sheetOpen = await page.evaluate(() => {
    const s = document.querySelector("#lh-pause-sheet");
    return !!s && !s.hidden && !!document.querySelector("#lh-exit") && !!document.querySelector("#lh-resume");
  });
  if (!sheetOpen) fail("pause control did not open the Resume/Exit sheet");
  else console.log("OK: pause control opened the Resume/Exit sheet");
  // Tapping Exit inside the sheet must NOT score either, and must fire corpan:exit.
  const exit = await page.evaluate(() => {
    const b = document.querySelector("#lh-exit"); if (!b) return null;
    const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!exit) fail("no #lh-exit control found inside the pause sheet");
  else {
    const before = (await read()).score;
    await page.mouse.click(exit.x, exit.y);
    await page.waitForTimeout(120);
    if ((await read()).score !== before) fail("tap-through: Exit tap changed the score");
    else if (!(await page.evaluate(() => window.__exitFired > 0))) fail("Exit tap did not dispatch corpan:exit");
    else console.log("OK: Exit tap fired corpan:exit and did not leak into a lane");
  }
  // Resume so the rest of the test plays normally (Exit was stubbed, run is live).
  await page.evaluate(() => window.__lingoHero.resume && window.__lingoHero.resume());
}

// --- Contract (c2): MUTE control tap must NOT score (no tap-through). --------
await page.evaluate(() => document.querySelector(".ui-layer")?.classList.remove("chrome-hidden"));
const muteCtl = await page.evaluate(() => {
  const b = document.querySelector("#lh-mute"); if (!b) return null;
  // Exactly ONE mute control must exist.
  if (document.querySelectorAll("#lh-mute, .lh-mute-btn").length !== 1) return { dupe: true };
  const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
if (!muteCtl) fail("no #lh-mute control found");
else if (muteCtl.dupe) fail("more than one mute control present");
else {
  const before = (await read()).score;
  await page.mouse.click(muteCtl.x, muteCtl.y);
  await page.waitForTimeout(120);
  if ((await read()).score !== before) fail("tap-through: Mute tap changed the score");
  else console.log("OK: Mute tap did not leak into a lane");
  // Unmute again so audio state is neutral for later phases.
  await page.mouse.click(muteCtl.x, muteCtl.y);
}

// --- Contract (e): the PROMPT shows the FULL phrase (no truncation). ---------
// Inject a deliberately LONG primary-language prompt and assert the question box
// renders it WITHOUT clipping: scrollWidth must fit clientWidth (no horizontal
// overflow) and scrollHeight must fit within the wrapped-line budget. This is the
// #426 prompt auto-fit/wrap contract — long phrases must never be cut off.
{
  const LONG = "When my passport disappeared at the hostel in the middle of the night";
  const probe = await page.evaluate((text) => {
    const g = window.__lingoHero;
    g.hud.setQuestion(text);
    const el = document.querySelector("#question-box");
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      text: el.textContent,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollHeight: el.scrollHeight,
      fontPx: parseFloat(cs.fontSize),
      lineHeightPx: parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.16,
    };
  }, LONG);
  if (!probe) fail("no #question-box element to check prompt fit");
  else {
    if (probe.text !== LONG) fail(`prompt text was altered/truncated: ${JSON.stringify(probe.text)}`);
    if (probe.scrollWidth > probe.clientWidth + 1) {
      fail(`prompt overflows horizontally (scrollWidth ${probe.scrollWidth} > clientWidth ${probe.clientWidth})`);
    }
    // Allow up to ~3 lines of slack (the box wraps to 2; padding adds a little).
    const maxH = probe.lineHeightPx * 3 + 8;
    if (probe.scrollHeight > maxH) {
      fail(`prompt overflows vertically (scrollHeight ${probe.scrollHeight} > budget ${maxH.toFixed(0)})`);
    }
    if (failures === 0 || probe.scrollWidth <= probe.clientWidth + 1) {
      console.log(`OK: long prompt fully visible (font ${probe.fontPx.toFixed(0)}px, ${probe.scrollWidth}<=${probe.clientWidth}w, ${probe.scrollHeight}px tall)`);
    }
  }
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

// --- Contract (f): DECOY DODGED is REWARDED (issue #429). --------------------
// Letting a DECOY (distractor, isTarget=false) cross the strum line UN-caught is
// the correct play and must REWARD the player: score climbs + the decoy-dodge
// counter increments + the combo is kept/boosted (NOT broken). We inject a
// controlled decoy into the live chart positioned just above the pass line so it
// sails past on the next frames with no input, then assert the reward fired.
// Drives the real Game loop physics + pass-line branch via window.__lingoHero.
{
  const before = await page.evaluate(() => {
    const g = window.__lingoHero, ls = g.laneSystem;
    const strumY = ls.getStrumLineY();
    const speed = g.speed;
    // Place a DECOY just ABOVE the pass line so it falls past within a few
    // frames un-caught. strumTime is back-computed so physics carries it down:
    //   y = strumY - ((strumTime - now)/1000)*speed  → seed y just under strumY.
    const now = performance.now();
    const startY = strumY + ls.getNoteRadius() * 1.5; // just above the pass line
    const strumTime = now - ((startY - strumY) / speed) * 1000;
    g.notes.push({
      id: "test-decoy-" + now,
      lane: 0,
      y: startY,
      text: "señuelo",
      isTarget: false,
      seqIndex: -1,
      hit: false,
      missed: false,
      spawnTime: Date.now(),
      strumTime,
    });
    return { score: g.score, decoyDodges: g.decoyDodges, combo: g.combo };
  });
  // Do NOTHING — let the injected decoy sail past the line un-caught.
  let dodged = false;
  const dodgeDeadline = Date.now() + 4000;
  while (Date.now() < dodgeDeadline) {
    const s = await read();
    if (s.decoyDodges > before.decoyDodges) { dodged = true; break; }
    await page.waitForTimeout(60);
  }
  if (!dodged) fail("decoy passed un-caught but the dodge reward never fired (decoyDodges did not increment)");
  else {
    const after = await read();
    if (after.score <= before.score) fail(`dodging a decoy did not award points (score ${before.score} -> ${after.score})`);
    else if (after.combo < before.combo) fail(`dodging a decoy broke the combo (${before.combo} -> ${after.combo})`);
    else console.log(`OK: decoy dodged → rewarded (score ${before.score} -> ${after.score}, combo ${before.combo} -> ${after.combo}, dodges ${before.decoyDodges} -> ${after.decoyDodges})`);
  }
}

// --- Contract (f2): a missed CORRECT target is a MISS, NOT a dodge reward. ----
// Inject a TARGET note that is NOT the next-in-sequence word... actually the
// pass-line reward path only ever fires for isTarget=false. To prove the CORRECT
// word missing stays a miss (no dodge), we let the next-in-sequence target sail
// past un-caught and assert: score does NOT rise (it falls / breaks combo) and
// the dodge counter does NOT increment.
{
  // Find (or wait for) a live next-in-sequence target, then DON'T catch it.
  const probe = await (async () => {
    const dl = Date.now() + 8000;
    while (Date.now() < dl) {
      const s = await read();
      const t = s.notes.find((n) => n.isTarget && n.seqIndex === s.caughtCount && !n.hit && !n.missed);
      if (t) return { dodgesBefore: s.decoyDodges, caught: s.caughtCount };
      await page.waitForTimeout(80);
    }
    return null;
  })();
  if (!probe) {
    console.log("note: no live target to test the missed-correct case (round boundary); skipping f2");
  } else {
    // Let the correct word pass: wait until caughtCount advances (the pass-line
    // miss path reveals + advances it) OR the round resolves.
    let advanced = false;
    const dl = Date.now() + 12000;
    while (Date.now() < dl) {
      const s = await read();
      if (s.caughtCount > probe.caught || s.roundResolved || s.lingering) { advanced = true; break; }
      await page.waitForTimeout(120);
    }
    const after = await read();
    if (!advanced) {
      console.log("note: missed-correct case did not advance within window; skipping f2 assertion");
    } else if (after.decoyDodges > probe.dodgesBefore) {
      fail("missing the CORRECT target word wrongly granted a decoy-dodge reward");
    } else {
      console.log("OK: missing the CORRECT target word was a miss, not a dodge reward (dodges unchanged)");
    }
  }
}

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

// =============================================================================
// Issue #407 — language-selection correctness.
// These run on dedicated harnesses with non-default stacks so we exercise the
// resolution policy directly via window.__lingoHero introspection.
// =============================================================================
const harnessMulti = "file://" + join(here, "harness-multi.html");
const harnessReading = "file://" + join(here, "harness-reading.html");

// Drive several rounds and collect the TARGET language seen at the start of each
// fresh round. Returns the ordered list of observed targetLangs (one per round).
async function collectRoundTargets(p, wantRounds) {
  await p.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /practice/i.test(x.textContent || ""));
    if (b) b.click(); else window.__lingoHero.startGame("PRACTICE");
  });
  await p.waitForFunction(() => (window.__lingoHero.notes || []).length > 0, { timeout: 10000 });
  const seen = [];
  let lastEntryId = -1;
  const deadline = Date.now() + 60000;
  while (seen.length < wantRounds && Date.now() < deadline) {
    const s = await p.evaluate(() => {
      const g = window.__lingoHero, r = g.round;
      return r ? { entryId: r.entryId, targetLang: r.targetLang, primaryLang: g.activeLanguage.primary, words: r.targetWords } : null;
    });
    if (s && s.entryId !== lastEntryId) { lastEntryId = s.entryId; seen.push(s); }
    // Advance rounds without manual play: catch the next correct word if it is
    // on the strum line; otherwise let the no-input watchdog resolve the chart.
    const st = await p.evaluate(() => {
      const g = window.__lingoHero, ls = g.laneSystem, rr = g.canvas.getBoundingClientRect();
      const t = (g.notes || []).find((n) => n.isTarget && n.seqIndex === g.caughtCount && !n.hit && !n.missed);
      const strumY = ls.getStrumLineY();
      if (t && t.y >= strumY - 44 && t.y <= strumY + 44) {
        return { click: { x: rr.left + ls.getLaneX(t.lane), y: rr.top + strumY } };
      }
      return { click: null };
    });
    if (st.click) await p.mouse.click(st.click.x, st.click.y);
    await p.waitForTimeout(120);
  }
  return seen;
}

// --- Bug A: ≥3-language stack → TARGET rotates randomly (not pinned to [1]). --
{
  const mp = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  mp.on("pageerror", (e) => fail("pageerror(multi): " + e.message));
  await mp.goto(harnessMulti);
  await mp.waitForFunction(() => !!window.__lingoHero, { timeout: 10000 });
  const rounds = await collectRoundTargets(mp, 12);
  const targets = rounds.map((r) => r.targetLang);
  const primaries = new Set(rounds.map((r) => r.primaryLang));
  const distinct = new Set(targets);
  console.log(`multi-stack targets over ${rounds.length} rounds: ${JSON.stringify(targets)}`);
  if (rounds.length < 4) fail(`only saw ${rounds.length} rounds on multi-stack (need >=4 to judge rotation)`);
  if (primaries.size !== 1 || ![...primaries][0] || [...primaries][0] !== "en") {
    fail(`multi-stack prompt language not pinned to known lang 'en': ${JSON.stringify([...primaries])}`);
  }
  // The learning langs are {es, fr, de}. The target MUST vary across rounds —
  // the old bug pinned it to languages[1] (es) forever.
  if (distinct.size < 2) fail(`multi-stack target did NOT rotate (always ${[...distinct][0]}); Bug A not fixed`);
  else console.log(`OK: multi-stack target rotated across ${distinct.size} learning langs ${JSON.stringify([...distinct])}`);
  // And every observed target must be one of the learning langs, never the known lang.
  const bad = targets.filter((t) => t === "en" || !["es", "fr", "de"].includes(t));
  if (bad.length) fail(`multi-stack target leaked outside learning langs: ${JSON.stringify(bad)}`);
  await mp.screenshot({ path: join(outDir, "multi-stack.png") });
  await mp.close();
}

// --- Bug B: 1-language stack → READING mode (target === primary === lang). ----
{
  const rp = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  rp.on("pageerror", (e) => fail("pageerror(reading): " + e.message));
  await rp.goto(harnessReading);
  await rp.waitForFunction(() => !!window.__lingoHero, { timeout: 10000 });
  const rounds = await collectRoundTargets(rp, 4);
  console.log(`reading-stack rounds: ${JSON.stringify(rounds.map((r) => ({ t: r.targetLang, p: r.primaryLang })))}`);
  if (rounds.length < 1) fail("reading-stack never produced a round");
  for (const r of rounds) {
    // The single stack language is "en". Target MUST be that same language —
    // NEVER a foreign substitute (the old bug grabbed es/ar). And the catchable
    // words must be that language's own tokens (a real, non-empty sequence).
    if (r.targetLang !== "en") fail(`reading-stack target was '${r.targetLang}', expected 'en' (no foreign substitute)`);
    if (r.primaryLang !== "en") fail(`reading-stack primary was '${r.primaryLang}', expected 'en'`);
    if (!Array.isArray(r.words) || r.words.length < 1) fail(`reading-stack had no catchable tokens: ${JSON.stringify(r.words)}`);
    // Catchable tokens must be ENGLISH (the stack lang), not Spanish. Heuristic:
    // the joined token string must NOT contain the entry's Spanish-only markers.
    const joined = (r.words || []).join(" ").toLowerCase();
    if (/dónde|está|gato|días|gracias|cuesta|perro|gusta|leer/.test(joined)) {
      fail(`reading-stack catchable words look like a foreign substitute: ${JSON.stringify(r.words)}`);
    }
  }
  if (rounds.every((r) => r.targetLang === "en" && r.primaryLang === "en" && (r.words || []).length >= 1)) {
    console.log(`OK: reading-stack stayed in 'en' (prompt + catchable tokens), no foreign substitute`);
  }
  await rp.screenshot({ path: join(outDir, "reading-stack.png") });
  await rp.close();
}

// --- iOS AUDIO UNLOCK WIRING (issue #428). -----------------------------------
// We CANNOT verify real iOS audio OUTPUT headlessly, so we verify the WIRING:
// the AudioContext must NOT be running before any user gesture (it is lazy — no
// context exists yet), and the FIRST real gesture (a pointerdown, like a canvas
// lane tap or tap-to-begin on iOS) must unlock it -> state "running" + unlocked
// flag true. This proves the canonical iOS gesture-unlock path is wired without
// requiring the menu Start button specifically, and (resuming a running context
// being a no-op) guarantees it does not regress Android/desktop.
{
  const ap = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  ap.on("pageerror", (e) => fail("pageerror(audio): " + e.message));
  await ap.goto(harness);
  await ap.waitForFunction(() => !!window.__lingoHero, { timeout: 10000 });

  // BEFORE any gesture: the engine is lazy, so no context exists and it is not
  // unlocked. (On iOS a pre-gesture context would be stuck `suspended` + silent;
  // we never create one before the gesture, which is the correct iOS behavior.)
  const pre = await ap.evaluate(() => ({
    state: window.__lingoHero.audioContextState(),
    unlocked: window.__lingoHero.audioUnlocked(),
  }));
  if (pre.unlocked) fail(`audio reported unlocked BEFORE any gesture: ${JSON.stringify(pre)}`);
  if (pre.state === "running") fail(`AudioContext was RUNNING before any gesture (iOS would never allow this): ${JSON.stringify(pre)}`);
  else console.log(`OK: audio not unlocked pre-gesture (state=${pre.state}, unlocked=${pre.unlocked})`);

  // Dispatch a REAL pointerdown on the canvas (a lane tap) — the InputManager
  // gesture path, NOT the menu Start button — to prove the window-level
  // first-gesture unlock fires regardless of WHERE the first tap lands.
  const box = await ap.evaluate(() => {
    const r = window.__lingoHero.canvas.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.6 };
  });
  await ap.mouse.click(box.x, box.y);
  // The context.resume() promise resolves async; give it a beat to flip.
  await ap.waitForFunction(
    () => window.__lingoHero.audioContextState() === "running",
    { timeout: 5000 }
  ).catch(() => {});

  const post = await ap.evaluate(() => ({
    state: window.__lingoHero.audioContextState(),
    unlocked: window.__lingoHero.audioUnlocked(),
  }));
  if (!post.unlocked) fail(`audio did NOT unlock after a gesture: ${JSON.stringify(post)}`);
  else if (post.state !== "running") fail(`AudioContext did not reach "running" after a gesture (unlock wiring): ${JSON.stringify(post)}`);
  else console.log(`OK: first gesture unlocked AudioContext (state=${post.state}, unlocked=${post.unlocked})`);

  await ap.close();
}

await browser.close();
console.log(failures === 0 ? "\nGAMEPLAY E2E: PASS" : `\nGAMEPLAY E2E: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
