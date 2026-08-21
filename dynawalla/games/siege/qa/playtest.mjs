/**
 * Plays SIEGE for real and reports what it measured.
 *
 *   npm run dev            # in another shell
 *   node qa/playtest.mjs   # needs playwright + chromium available locally
 *
 * Phase 1 drives the actual DOM: clicks the palette, clicks pads, clicks answer
 * slugs. Phase 2 hands over to the in-game auto-player to reach the late waves
 * where the frame budget is actually under pressure. Screenshots land in
 * qa/shots/.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, "shots");
const URL = process.env.SIEGE_URL ?? "http://localhost:4187/";
mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const shot = async (page, name) => {
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
  console.log(`  shot: ${name}.png`);
};

const dbg = (page) => page.evaluate(() => window.__siege.debug());

/** click the answer the child would give: correct, unless we asked for a slip */
async function answer(page, slip = false) {
  const idx = await page.evaluate((s) => {
    const g = window.__siege;
    if (!g || g.coldUntil > 0 || g.answering || g.focus) return -1;
    const c = g.order.indexOf(0);
    return s ? (c + 1) % 4 : c;
  }, slip);
  if (idx < 0) return false;
  await page.locator(".sg-slugs .sg-slug").nth(idx).click({ force: true, timeout: 2000 });
  return true;
}

async function main() {
  const browser = await chromium.launch({
    headless: false,
    args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"],
  });

  // ---------------------------------------------------------------- desktop
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(URL, { waitUntil: "load" });
  await sleep(900);
  await shot(page, "01-at-rest");

  // instrument frame times in the page itself
  await page.evaluate(() => {
    window.__frames = [];
    let last = performance.now();
    const tick = (t) => {
      window.__frames.push(t - last);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  // -- phase 1: play it like a person --------------------------------------
  console.log("phase 1 — hand-played");
  await page.locator(".sg-card").first().click(); // arm BOLT
  const box = await page.locator(".sg-board canvas").boundingBox();
  const padAt = (fx, fy) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });
  for (const [fx, fy] of [
    [0.28, 0.16],
    [0.5, 0.16],
    [0.72, 0.16],
    [0.28, 0.41],
  ]) {
    const p = padAt(fx, fy);
    await page.mouse.click(p.x, p.y);
    await sleep(120);
  }
  await sleep(400);
  await shot(page, "02-towers-placed");

  // answer-path latency: synchronous handler cost, measured in page
  const latency = await page.evaluate(() => {
    const g = window.__siege;
    const out = [];
    for (let i = 0; i < 24; i++) {
      const t0 = performance.now();
      g.answer(g.order.indexOf(0));
      out.push(performance.now() - t0);
      g.coldUntil = 0;
      g.answering = false;
      g.nextQuestion();
    }
    out.sort((a, b) => a - b);
    return { p50: out[12], p90: out[21], max: out[23] };
  });

  await page.locator(".sg-chip").first().click(); // call the wave early
  for (let i = 0; i < 26; i++) {
    await answer(page, i % 9 === 8);
    await sleep(420);
  }
  await shot(page, "03-mid-wave");

  // -- phase 2a: a child's cadence -----------------------------------------
  // roughly one answer every 2.3 s with a one-in-eight slip, which is what a
  // competent ten-year-old actually does on these facts.
  console.log("phase 2a — human cadence (2.3s/answer)");
  const samples = [];
  let overShot = false;
  let deathShot = false;
  let peakShot = false;
  let lastAnswer = 0;
  const humanUntil = Date.now() + 150000;
  while (Date.now() < humanUntil) {
    const now = Date.now();
    if (now - lastAnswer > 2300) {
      lastAnswer = now;
      await page.evaluate(() => window.__siege.autoAnswer(0.125));
    }
    await page.evaluate(() => window.__siege.autoSpend());
    await sleep(320);
    const d = await dbg(page);
    samples.push(d);
    if (!overShot && (await page.locator(".sg-oc").count()) > 0) {
      overShot = true;
      await shot(page, "04-overcharge");
    }
    if (d.phase === "defeat") break;
  }
  const human = samples[samples.length - 1] ?? {};
  console.log(`  human pace reached wave ${human.wave}, core ${human.coreHp}/20, embers ${human.embers}`);
  await shot(page, "03b-human-pace");

  // -- phase 2b: stress. fast-forward + perfect answers, until the forge falls
  console.log("phase 2b — stress to failure");
  await page.evaluate(() => window.__siege.setSpeedForTest(2));
  const t0 = Date.now();
  while (Date.now() - t0 < 190000) {
    await page.evaluate(() => window.__siege.autoTick(0.04));
    await sleep(110);
    const d = await dbg(page);
    samples.push(d);
    if (!peakShot && d.enemies > 22) {
      peakShot = true;
      await shot(page, "06-peak-escalation");
    }
    if (d.phase === "defeat") {
      if (!deathShot) {
        deathShot = true;
        await sleep(1100);
        await shot(page, "05-forge-cold");
      }
      break;
    }
  }
  const last = samples[samples.length - 1] ?? {};
  if (!peakShot) await shot(page, "06-peak-escalation");
  if (!deathShot) await shot(page, "05-late-game");

  const frames = await page.evaluate(() => {
    const f = window.__frames.slice(60).sort((a, b) => a - b);
    const q = (p) => f[Math.floor(f.length * p)];
    return {
      n: f.length,
      medianMs: +q(0.5).toFixed(2),
      p95Ms: +q(0.95).toFixed(2),
      p99Ms: +q(0.99).toFixed(2),
      worstMs: +f[f.length - 1].toFixed(2),
      fpsFromMedian: +(1000 / q(0.5)).toFixed(1),
    };
  });

  const peak = samples.reduce(
    (a, s) => ({
      wave: Math.max(a.wave, s.wave),
      enemies: Math.max(a.enemies, s.enemies),
      particles: Math.max(a.particles, s.particles),
      towers: Math.max(a.towers, s.towers),
      fpsMin: Math.min(a.fpsMin, s.fps || 999),
    }),
    { wave: 0, enemies: 0, particles: 0, towers: 0, fpsMin: 999 },
  );

  console.log("\n== DESKTOP 1440x900 @2x ==");
  console.log("frames  ", JSON.stringify(frames));
  console.log("peak    ", JSON.stringify(peak));
  console.log("last    ", JSON.stringify(last));
  console.log("latency ", JSON.stringify(latency), "ms (synchronous answer handler)");

  // -- phase 2c: the honest frame budget -----------------------------------
  // This machine is not a mid-range tablet. Throttle the CPU 4x, seed a fully
  // built board at a late wave, and measure that instead.
  for (const rate of [1, 4, 6]) {
    const pp = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    const cdp = await pp.context().newCDPSession(pp);
    await pp.goto(URL, { waitUntil: "load" });
    await sleep(700);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    await pp.evaluate(() => {
      window.__siege.seedHeavy(20, 2);
      window.__frames = [];
      let last = performance.now();
      const tick = (t) => {
        window.__frames.push(t - last);
        last = t;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const until = Date.now() + 26000;
    let worst = { enemies: 0, particles: 0 };
    while (Date.now() < until) {
      await pp.evaluate(() => window.__siege.autoAnswer(0.1));
      await sleep(500);
      const d = await pp.evaluate(() => window.__siege.debug());
      worst = {
        enemies: Math.max(worst.enemies, d.enemies),
        particles: Math.max(worst.particles, d.particles),
      };
      if (d.phase === "defeat") break;
    }
    const f = await pp.evaluate(() => {
      const a = window.__frames.slice(40).sort((x, y) => x - y);
      const q = (p) => a[Math.floor(a.length * p)];
      return {
        n: a.length,
        medianMs: +q(0.5).toFixed(2),
        p95Ms: +q(0.95).toFixed(2),
        p99Ms: +q(0.99).toFixed(2),
        fps: +(1000 / q(0.5)).toFixed(1),
        fpsAtP95: +(1000 / q(0.95)).toFixed(1),
      };
    });
    console.log(`cpu ${rate}x  ${JSON.stringify(f)}  peak ${JSON.stringify(worst)}`);
    if (rate === 4) await shot(pp, "10-throttled-4x");
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await pp.close();
  }

  // -- phase 3: touch layouts ----------------------------------------------
  for (const [name, viewport] of [
    ["07-tablet-portrait", { width: 820, height: 1180 }],
    ["08-phone-portrait", { width: 390, height: 844 }],
  ]) {
    const p2 = await browser.newPage({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await p2.goto(URL, { waitUntil: "load" });
    await sleep(700);
    await p2.evaluate(() => {
      const g = window.__siege;
      for (let i = 0; i < 22; i++) {
        g.state.embers += 60;
        g.autoTick(0);
      }
      g.state.intermissionT = 0;
    });
    await sleep(2600);
    await shot(p2, name);
    const overflow = await p2.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));
    console.log(`${name}: ${JSON.stringify(overflow)}`);
    await p2.close();
  }

  // reduced motion
  const p3 = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  await p3.goto(URL, { waitUntil: "load" });
  await sleep(600);
  await p3.evaluate(() => {
    const g = window.__siege;
    for (let i = 0; i < 18; i++) {
      g.state.embers += 60;
      g.autoTick(0);
    }
    g.state.intermissionT = 0;
  });
  await sleep(2600);
  await shot(p3, "09-reduced-motion");
  console.log(
    "reducedMotion honoured:",
    await p3.evaluate(() => window.__siege.cam.reducedMotion),
  );
  await p3.close();

  console.log("\nerrors:", errors.length ? errors.slice(0, 8) : "none");
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
