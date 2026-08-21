/**
 * Playtest harness for MONUMENT.
 *
 *   npx playwright install chromium      # once
 *   npm run dev                          # in another shell
 *   node tools/playtest.mjs --seconds 90 --quality 0.86 --tier ultra
 *
 * It drives the real game in a real GPU-backed browser with a bot that reads
 * the same state a player reads — the value on the stone and its offset from
 * true — and taps accordingly. `--quality` is how often it plays well, so 0.86
 * produces a run with real mistakes in it rather than a machine-perfect one.
 *
 * It reports measured fps and answer-path latency, and saves screenshots at the
 * moments worth looking at: at rest, mid-sweep, a big combo, a mistake, deep
 * escalation, and the collapse.
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, arr) => {
    if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1]?.startsWith("--") ? "1" : arr[i + 1]]);
    return a;
  }, []),
);

const URL = args.url ?? "http://127.0.0.1:4310/?perf=1&dev=1";
const SECONDS = Number(args.seconds ?? 60);
const QUALITY = Number(args.quality ?? 0.88);
const TIER = args.tier ?? "";
const W = Number(args.width ?? 430);
const H = Number(args.height ?? 932);
const OUT = resolve(args.out ?? "./shots");
const HEADLESS = args.headless === "1";

mkdirSync(OUT, { recursive: true });

const BOT = `
window.__bot = (function () {
  const m = window.__monument, sim = m.sim;
  let on = false, q = 1, raf = 0, taps = 0, sloppy = null, sloppyFor = null;
  const el = document.querySelector('canvas');
  const marks = [];
  const outcomes = { perfect: 0, good: 0, wrong: 0, miss: 0 };
  const lat = [];
  let worst = 0, lastT = performance.now();
  (function watch(){ const n = performance.now(); const d = n - lastT; lastT = n;
    if (d > worst && d < 500) worst = d; requestAnimationFrame(watch); })();
  const pd = () => el.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true,clientX:200,clientY:400,pointerId:1}));
  const tol = () => 0.062 + (0.03 - 0.062) * Math.min(1, sim.floor / 60);
  // Watch what the sim actually decided, so the report is not the bot's opinion.
  const origPlace = sim.place.bind(sim);
  sim.place = (t) => { const ev = origPlace(t); if (ev) { outcomes[ev.outcome]++; marks.push({t: performance.now(), o: ev.outcome, c: ev.combo, f: sim.floor}); lat.push(m.latency()); } return ev; };
  function loop() {
    if (!on) return;
    raf = requestAnimationFrame(loop);
    if (sim.phase !== 'sweep' || sim.holdLeft > 0) return;
    const a = sim.axis;
    const c = (a === 0 ? sim.cx : sim.cz) + (a === 0 ? sim.bendX(1) : sim.bendZ(1));
    const d = sim.sweep - c;
    const right = sim.value === sim.question.answer;
    // Below full quality the bot sometimes commits on the wrong value or wide
    // of true, which is what a child does and what the penalties exist for.
    // Decide ONCE per stone whether this one is going to be sloppy, otherwise
    // a per-frame coin flip fires on the first of sixty frames and the bot is
    // always terrible.
    if (sloppyFor !== sim.question.id) {
      sloppyFor = sim.question.id;
      sloppy = Math.random() > q ? (Math.random() < 0.6 ? 'wrong' : 'slop') : null;
    }
    if (sloppy === 'wrong') {
      // A child who mis-computed commits CONFIDENTLY on the wrong value.
      if (!right && Math.abs(d) <= tol() * 1.6) { pd(); taps++; }
      return;
    }
    if (sloppy === 'slop') {
      // …and a child who did the maths can still be wide of true.
      if (right && Math.abs(d) > 0.16 && Math.abs(d) < 0.34) { pd(); taps++; }
      return;
    }
    if (right && Math.abs(d) <= tol() * 1.05) { pd(); taps++; }
  }
  return {
    start(qq) { q = qq ?? 1; if (!on) { on = true; loop(); } },
    stop() { on = false; cancelAnimationFrame(raf); },
    marks() { const out = marks.slice(); marks.length = 0; return out; },
    stats() {
      const L = lat.filter(Number.isFinite).sort((a,b)=>a-b);
      return { floor: sim.floor, best: sim.best, taps, placed: sim.placed, outcomes,
        wx: +sim.wx.toFixed(3), wz: +sim.wz.toFixed(3), peril: +sim.peril.toFixed(2),
        bestCombo: sim.bestCombo, perfects: sim.perfects, phase: sim.phase,
        fps: +m.fps.fps.toFixed(1), p95ms: +m.fps.p95.toFixed(2), tier: m.tier, worst: +worst.toFixed(2),
        latMed: L.length ? +L[L.length>>1].toFixed(3) : null,
        latMax: L.length ? +L[L.length-1].toFixed(3) : null,
        sparks: undefined };
    },
  };
})();
'ok';
`;

const browser = await chromium.launch({
  headless: HEADLESS,
  args: [
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-background-timer-throttling",
    "--use-angle=metal",
    "--enable-gpu",
    "--hide-scrollbars",
  ],
});
const page = await browser.newPage({
  viewport: { width: W, height: H },
  deviceScaleFactor: 2,
  reducedMotion: args.reduced === "1" ? "reduce" : "no-preference",
});
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") console.log(`  [page ${m.type()}]`, m.text());
});
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

await page.goto(URL, { waitUntil: "load" });
await page.waitForFunction(() => !!window.__monument, null, { timeout: 15000 });
if (TIER) await page.evaluate((t) => window.__monument.setTier(t), TIER);
await page.waitForTimeout(700);

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  shot ${name}`);
};

// One real click so the AudioContext is allowed to resume; synthetic events do
// not carry user activation and the whole sound design would stay silent. It
// goes on the sound toggle, not the canvas — a real click on the canvas places
// a stone at whatever random offset the sweep happens to be at.
await page.click(".mn-audio");
await page.click(".mn-audio");
await page.waitForTimeout(250);
await shot("01-at-rest");
const heap0 = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0);
await page.evaluate(BOT);
await page.evaluate((q) => window.__bot.start(q), QUALITY);

const t0 = Date.now();
const got = new Set();
let lastFloor = 0;
let deaths = 0;
while ((Date.now() - t0) / 1000 < SECONDS) {
  await page.waitForTimeout(55);
  const marks = await page.evaluate(() => window.__bot.marks());
  const s = await page.evaluate(() => window.__bot.stats());
  lastFloor = s.floor;

  for (const mk of marks) {
    if (mk.o === "perfect" && mk.c >= 5 && !got.has("combo")) {
      got.add("combo");
      await shot("03-big-combo");
    }
    if ((mk.o === "wrong" || mk.o === "miss") && !got.has("miss")) {
      got.add("miss");
      await shot("04-mistake");
    }
  }
  // Catch the two big transient overlays by watching their computed opacity,
  // which is the only honest signal that they are actually on screen.
  const overlay = await page.evaluate(() => {
    const o = (sel) => {
      const el = document.querySelector(sel);
      return el ? Number(getComputedStyle(el).opacity) : 0;
    };
    return { t: o('.mn-true'), b: o('.mn-band') };
  });
  if (overlay.t > 0.35 && !got.has("true")) {
    got.add("true");
    await shot("03b-true-callout");
  }
  if (overlay.b > 0.35 && !got.has("band")) {
    got.add("band");
    await shot("03c-stratum-card");
  }
  if (s.floor >= 5 && !got.has("mid")) {
    got.add("mid");
    await shot("02-mid-sweep");
  }
  if (s.floor >= 26 && !got.has("deep")) {
    got.add("deep");
    await shot("05-deep");
  }
  if (s.floor >= 50 && !got.has("peak")) {
    got.add("peak");
    await shot("06-peak");
  }
  if (s.phase !== "sweep" && (!got.has("over") || args.soak === "1")) {
    const first = !got.has("over");
    got.add("over");
    deaths++;
    if (!first) {
      // Soak: alternate between shoring up and beginning again.
      await page.waitForTimeout(1500);
      if (deaths % 2 === 0) {
        await page.evaluate(() => document.querySelector(".mn-revive")?.click());
        await page.waitForTimeout(300);
        await page.evaluate(() => document.querySelector(".mn-choices button")?.click());
      } else {
        await page.evaluate(() => document.querySelector(".mn-again")?.click());
      }
      await page.waitForTimeout(600);
      await page.evaluate((q) => window.__bot.start(q), QUALITY);
      continue;
    }
    await page.waitForTimeout(700);
    await shot("07-collapse");
    await page.waitForTimeout(1200);
    await shot("08-over-panel");
    await page.evaluate(() => document.querySelector(".mn-revive")?.click());
    await page.waitForTimeout(450);
    await shot("09-shore-it-up");
    await page.evaluate(() => document.querySelector(".mn-choices button")?.click());
    await page.waitForTimeout(900);
    await page.evaluate((q) => window.__bot.start(q), QUALITY);
  }
}

await page.evaluate(() => window.__bot.stop());
const final = await page.evaluate(() => window.__bot.stats());
const heap1 = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0);
// Real per-frame cost with the GPU drained, at each tier, on this exact scene.
const bench = {};
for (const t of ["low", "mid", "ultra"]) {
  await page.evaluate((x) => window.__monument.setTier(x), t);
  await page.waitForTimeout(500);
  bench[t] = +(await page.evaluate(() => window.__monument.bench(240))).toFixed(3);
  bench[t + "_stress"] = +(await page.evaluate(() => window.__monument.bench(240, true))).toFixed(3);
}
await page.evaluate((x) => window.__monument.setTier(x), TIER || "ultra");
await shot("10-final");

console.log("\n── playtest ──────────────────────────────────────────");
console.log(`  url        ${URL}`);
console.log(`  viewport   ${W}x${H} @2x   headless=${HEADLESS}`);
console.log(`  played     ${SECONDS}s at quality ${QUALITY}`);
console.log(`  reached    floor ${lastFloor} (best ${final.best})   deaths ${deaths}`);
console.log(`  outcomes   ${JSON.stringify(final.outcomes)}`);
console.log(`  perfects   ${final.perfects}  best combo ${final.bestCombo}`);
console.log(`  width      wx ${final.wx} wz ${final.wz}  peril ${final.peril}`);
console.log(`  fps        ${final.fps}  p95 frame ${final.p95ms}ms  worst frame ${final.worst}ms   tier ${final.tier}`);
console.log(`  input→sim  median ${final.latMed}ms  max ${final.latMax}ms`);
console.log(`  frame cost (readPixels-synced, ${W * 2}x${H * 2} backbuffer)`);
for (const t of ["low", "mid", "ultra"]) {
  console.log(`    ${t.padEnd(6)} idle ${String(bench[t]).padStart(6)}ms   worst-case ${String(bench[t + "_stress"]).padStart(6)}ms`);
}
console.log(`  heap       ${(heap0 / 1048576).toFixed(1)}MB -> ${(heap1 / 1048576).toFixed(1)}MB  (+${((heap1 - heap0) / 1048576).toFixed(1)}MB)`);
console.log(`  reduced    ${args.reduced === "1"}`);
console.log(`  shots      ${OUT}`);
console.log("──────────────────────────────────────────────────────\n");

await browser.close();
