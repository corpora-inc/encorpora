/**
 * One browser pass for the founder review page: feedback typed into the
 * single box autosaves, the score starts unset at 5 and saves when it
 * changes, and both are still there after a reload. Timestamped notes
 * already stored are not shown and are not dropped by a save.
 *
 *   npx tsx scripts/verify-film-review.ts
 *   npx tsx scripts/verify-film-review.ts --shots <url> <directory>
 */
import { secureChromium } from "../browser-security.mjs";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { chromium as rawChromium, type Page } from "playwright";
import { createServer } from "vite";

const chromium = secureChromium(rawChromium);

const stub = `<!doctype html><html lang="en" data-theme="light"><body>
<div class="live ready playing">
  <div class="live-frame" style="height:600px;background:#9cd">stage</div>
  <button class="live-grade-btn is-approve" aria-label="Approve">Approve</button>
  <div class="live-sheet">Grade sheet</div>
  <input class="live-scrub" type="range" min="0" max="120" step="0.01" value="0" aria-label="Position">
  <span class="live-time">0:00</span>
</div>
<script>
  const scrub = document.querySelector(".live-scrub");
  let playing = true;
  window.__playing = () => playing;
  window.__toggle = () => document.querySelector(".live").classList.toggle("playing");
  let base = 0, origin = performance.now();
  const now = () => base + (playing ? (performance.now() - origin) / 1000 : 0);
  const tick = () => { if (playing) scrub.value = String(now()); requestAnimationFrame(tick); };
  tick();
  scrub.addEventListener("input", () => { base = Number(scrub.value); origin = performance.now(); });
</script></body></html>`;

const lab = `<!doctype html><html><body><script>
const films=[{"id":"alpha-film","title":"Alpha film","added":"2026-11-10T00:00:00.000Z"},{"id":"beta-film","title":"Beta film","added":"2026-11-10T00:00:00.000Z"}];
</script></body></html>`;

type Stored = { score: number | null; summary: string; notes: { t: number; text: string }[]; added?: string };

function send(res: ServerResponse, status: number, body: string, type: string) {
  res.statusCode = status;
  res.setHeader("Content-Type", type);
  res.end(body);
}

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function shots(url: string, dir: string) {
  await mkdir(dir, { recursive: true });
  const browser = await chromium.launch({ args: ["--no-proxy-server"] });
  try {
    for (const [name, width, height, scheme] of [
      ["390", 390, 844, "light"],
      ["1280", 1280, 800, "light"],
      ["390-dark", 390, 844, "dark"],
      ["1280-dark", 1280, 800, "dark"],
      ["320", 320, 700, "light"],
      ["768", 768, 900, "light"],
    ] as const) {
      const page = await browser.newPage({ viewport: { width, height }, colorScheme: scheme });
      await page.goto(url, { waitUntil: "networkidle" });
      await page.frameLocator("iframe").locator(".live.ready").waitFor({ timeout: 30000 });
      await page.evaluate(() => {
        const scrub = document.querySelector("iframe")?.contentDocument?.querySelector(".live-scrub") as HTMLInputElement | null;
        if (!scrub) return;
        scrub.value = "12";
        scrub.dispatchEvent(new Event("input", { bubbles: true }));
        scrub.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${dir}/${name}.png` });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

async function boxOf(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, selector);
  return box;
}

/** The film stage's box in page coordinates: the iframe's box plus the stage's place inside it. */
async function stageBox(page: Page) {
  const frame = await boxOf(page, "iframe");
  const inner = await page.evaluate(() => {
    const r = document.querySelector("iframe")!.contentDocument!.querySelector(".live-frame")!.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  return { x: frame.x + inner.x, y: frame.y + inner.y, width: inner.width, height: inner.height };
}

const apart = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x + a.width <= b.x + 0.5 || b.x + b.width <= a.x + 0.5 || a.y + a.height <= b.y + 0.5 || b.y + b.height <= a.y + 0.5;

async function behavior() {
  const kept = { t: 12.5, text: "Kept from before" };
  const reviews: Record<string, Stored> = {
    "alpha-film": { score: null, summary: "", notes: [kept], added: "2026-11-10T00:00:00.000Z" },
  };
  let posts = 0;
  const port = 8766;
  const vite = await createServer({
    configFile: fileURLToPath(new URL("../film/vite.live.config.ts", import.meta.url)),
    server: { host: "127.0.0.1", port, strictPort: true },
    plugins: [
      {
        name: "review-fixture",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const url = (req.url ?? "").split("?")[0];
            if (url === "/index.html") return send(res, 200, stub, "text/html; charset=utf-8");
            if (url === "/lab.html") return send(res, 200, lab, "text/html; charset=utf-8");
            if (url === "/review" && req.method === "GET") return send(res, 200, JSON.stringify(reviews), "application/json");
            if (url === "/review" && req.method === "POST") {
              const body = JSON.parse(await readBody(req)) as Stored & { id: string };
              posts += 1;
              reviews[body.id] = body;
              return send(res, 200, JSON.stringify(body), "application/json");
            }
            next();
          });
        },
      },
    ],
  });
  await vite.listen();
  const browser = await chromium.launch({ args: ["--no-proxy-server"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: "light" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  try {
    await page.goto(`http://127.0.0.1:${port}/review.html?id=alpha-film&list=lab`);
    await page.waitForFunction(() => !(document.querySelector("#feedback") as HTMLTextAreaElement).disabled);
    assert.equal(await page.locator(".panel-title").innerText(), "Alpha film");
    assert.equal(await page.locator(".score").getAttribute("data-set"), "false");
    assert.equal(await page.locator(".score-num").innerText(), "5");
    assert.equal(await page.locator(".score-caption").innerText(), "Not scored");
    assert.equal(await page.locator("#note-draft, .notes, .note-time, #summary").count(), 0);
    assert.equal((await page.locator("body").innerText()).includes(kept.text), false);

    const gradeHidden = await page.evaluate(() => {
      const button = document.querySelector("iframe")?.contentDocument?.querySelector(".live-grade-btn") as HTMLElement | null;
      const sheet = document.querySelector("iframe")?.contentDocument?.querySelector(".live-sheet") as HTMLElement | null;
      return !!button && getComputedStyle(button).display === "none" && !!sheet && getComputedStyle(sheet).display === "none";
    });
    assert.equal(gradeHidden, true);

    const settle = () => page.evaluate("new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: width >= 768 ? 800 : 700 });
      await settle();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      assert.equal(overflow, false, `horizontal overflow at ${width}`);
      const player = await page.locator(".player-slot").boundingBox();
      const panel = await page.locator(".panel").boundingBox();
      assert.ok(player && panel);
      if (width >= 768) assert.ok(panel.x >= player.x + player.width - 2, `side by side at ${width}`);
      else assert.ok(panel.y >= player.y + player.height - 2, `stacked at ${width}`);
      assert.equal(await page.locator(".film-full").isVisible(), width < 768, `full screen button at ${width}`);
      if (width < 768) {
        const fit = await page.evaluate(() => {
          const slot = document.querySelector(".player-slot")!;
          const iframe = slot.querySelector("iframe")!;
          const sr = slot.getBoundingClientRect();
          const ir = iframe.getBoundingClientRect();
          const elements = [slot, iframe];
          const clipped = [false, false];
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i]!;
            const r = el.getBoundingClientRect();
            for (let node = el.parentElement; node; node = node.parentElement) {
              const oy = getComputedStyle(node).overflowY;
              if (oy !== "hidden" && oy !== "clip") continue;
              const nr = node.getBoundingClientRect();
              if (r.top < nr.top - 1 || r.left < nr.left - 1 || r.bottom > nr.bottom + 1 || r.right > nr.right + 1) clipped[i] = true;
            }
          }
          return {
            fullWidth: Math.abs(sr.width - document.documentElement.clientWidth) < 2,
            inside: ir.top >= sr.top - 1 && ir.left >= sr.left - 1 && ir.bottom <= sr.bottom + 1 && ir.right <= sr.right + 1,
            tall: sr.height + 1 >= sr.width * (1920 / 1080) + 120 + 52 && sr.height < sr.width * (1920 / 1080) + 220 + 52,
            slotClipped: clipped[0],
            frameClipped: clipped[1],
          };
        });
        const button = await boxOf(page, ".film-full");
        const stage = await stageBox(page);
        assert.ok(button.width >= 44 && button.height >= 44, `full screen button ${button.width}x${button.height} at ${width}`);
        assert.ok(apart(button, stage), `full screen button covers the film at ${width}`);
        assert.ok(apart(button, await boxOf(page, "iframe")), `full screen button overlaps the player at ${width}`);
        assert.ok(button.x >= 0 && button.x + button.width <= width, `full screen button off screen at ${width}`);
        await page.evaluate("window.scrollTo(0, 0)");
        const stageStill = await stageBox(page);
        await page.evaluate("document.querySelector('iframe').contentWindow.__toggle()");
        await settle();
        const stageMoved = await stageBox(page);
        const buttonMoved = await boxOf(page, ".film-full");
        await page.evaluate("document.querySelector('iframe').contentWindow.__toggle()");
        await settle();
        for (const key of ["x", "y", "width", "height"] as const) {
          assert.ok(Math.abs(stageMoved[key] - stageStill[key]) < 1, `stage ${key} moved when playback changed at ${width}`);
          assert.ok(Math.abs(buttonMoved[key] - button[key]) < 1, `button ${key} moved when playback changed at ${width}`);
        }
        assert.equal(fit.fullWidth, true, `film width at ${width}`);
        assert.equal(fit.inside, true, `iframe clipped by the slot at ${width}`);
        assert.equal(fit.tall, true, `film shorter than its picture at ${width}`);
        assert.equal(fit.slotClipped, false, `film clipped at ${width}`);
        assert.equal(fit.frameClipped, false, `iframe clipped at ${width}`);
      }
      if (width === 1280) {
        const field = await boxOf(page, "#feedback");
        assert.ok(field.height >= 280, `feedback height ${field.height}`);
      }
    }

    await page.emulateMedia({ colorScheme: "dark" });
    await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(18, 37, 34)");
    assert.equal(
      await page.evaluate(() => document.querySelector("iframe")?.contentDocument?.documentElement.dataset.theme),
      "dark",
    );
    await page.emulateMedia({ colorScheme: "light" });
    await page.waitForFunction(() => document.documentElement.dataset.theme === "light");

    await page.setViewportSize({ width: 390, height: 844 });
    await settle();
    const filmTall = await boxOf(page, ".player-slot");
    await page.locator("#feedback").click();
    await settle();
    const filmFocused = await boxOf(page, ".player-slot");
    assert.ok(Math.abs(filmFocused.height - filmTall.height) < 1, `focus resized the film (${filmTall.height} -> ${filmFocused.height})`);
    await page.setViewportSize({ width: 390, height: 420 });
    await settle();
    const filmShort = await boxOf(page, ".player-slot");
    assert.ok(Math.abs(filmShort.height - filmTall.height) < 1, `a shorter window resized the film (${filmTall.height} -> ${filmShort.height})`);
    assert.ok(filmShort.width > 380, "film narrower than the screen");

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(`new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    assert.equal(posts, 0, "opening the page must not save the unscored default");
    const before = await boxOf(page, "#feedback");
    const scoreBefore = await boxOf(page, ".score");
    const box = page.locator("#feedback");
    await box.click();
    await box.pressSequentially("Opening is clear", { delay: 20 });
    await page.waitForFunction(() => document.querySelector(".save-text")?.textContent === "Saved");
    const afterType = await boxOf(page, "#feedback");
    assert.ok(Math.abs(afterType.y - before.y) < 1, `feedback moved when the note saved (${before.y} -> ${afterType.y})`);
    assert.ok(Math.abs(afterType.height - before.height) < 1, `feedback resized when the note saved (${before.height} -> ${afterType.height})`);
    assert.equal(await page.locator("#feedback").inputValue(), "Opening is clear");
    assert.deepEqual(reviews["alpha-film"].notes, [kept]);
    assert.equal(reviews["alpha-film"].summary, "Opening is clear");
    assert.equal(reviews["alpha-film"].score, null);

    const track = await page.locator(".score-track").boundingBox();
    assert.ok(track);
    await page.mouse.click(track.x + (track.width * 7) / 9, track.y + track.height / 2);
    await page.waitForFunction(() => document.querySelector(".score-num")?.textContent === "8");
    assert.equal(await page.locator(".score").getAttribute("data-set"), "true");
    await page.waitForFunction(() => document.querySelector(".save-text")?.textContent === "Saved");
    const afterScore = await boxOf(page, "#feedback");
    const scoreAfter = await boxOf(page, ".score");
    assert.ok(Math.abs(afterScore.y - before.y) < 1, `feedback moved when the score saved (${before.y} -> ${afterScore.y})`);
    assert.ok(Math.abs(afterScore.height - before.height) < 1, `feedback resized when the score saved (${before.height} -> ${afterScore.height})`);
    assert.ok(Math.abs(scoreAfter.y - scoreBefore.y) < 1 && Math.abs(scoreAfter.height - scoreBefore.height) < 1, "score block shifted when it saved");
    assert.equal(reviews["alpha-film"].score, 8);
    assert.deepEqual(reviews["alpha-film"].notes, [kept]);

    await page.reload();
    await page.waitForFunction(() => !(document.querySelector("#feedback") as HTMLTextAreaElement).disabled);
    assert.equal(await page.locator("#feedback").inputValue(), "Opening is clear");
    assert.equal(await page.locator(".score-num").innerText(), "8");
    assert.equal(await page.locator(".score").getAttribute("data-set"), "true");
    assert.equal((await page.locator("body").innerText()).includes(kept.text), false);
    assert.deepEqual(reviews["alpha-film"].notes, [kept]);

    await page.setViewportSize({ width: 390, height: 844 });
    await settle();
    const beforeType = await boxOf(page, ".player-slot");
    const playing = () => page.evaluate("(() => { const frame = document.querySelector('iframe'); const fn = frame && frame.contentWindow && frame.contentWindow.__playing; return fn ? fn() : false; })()");
    assert.equal(await playing(), true);
    const note = page.locator("#feedback");
    await note.click();
    await note.pressSequentially(" still", { delay: 15 });
    await page.waitForTimeout(150);
    const filmAfterType = await boxOf(page, ".player-slot");
    assert.ok(Math.abs(filmAfterType.width - beforeType.width) < 1 && Math.abs(filmAfterType.height - beforeType.height) < 1, "typing resized the film");
    assert.equal(await playing(), true, "typing paused the film");

    // Page scroll may differ after full screen, so compare against the slot's own top edge.
    const inSlot = async () => {
      const slotBox = await boxOf(page, ".player-slot");
      const stage = await stageBox(page);
      const button = await boxOf(page, ".film-full");
      return {
        stage: { x: stage.x - slotBox.x, y: stage.y - slotBox.y, width: stage.width, height: stage.height },
        button: { x: button.x - slotBox.x, y: button.y - slotBox.y, width: button.width, height: button.height },
      };
    };
    const placedBefore = await inSlot();
    await page.locator(".film-full").click();
    await page.waitForFunction(() => !!document.fullscreenElement || !!document.querySelector(".player-slot.is-fill"));
    assert.equal(await page.locator("#feedback").inputValue(), "Opening is clear still");
    assert.equal(await page.locator(".score-num").innerText(), "8");
    await page.locator(".film-full").click();
    await page.waitForFunction(() => !document.fullscreenElement && !document.querySelector(".player-slot.is-fill"));
    assert.equal(await page.locator("#feedback").inputValue(), "Opening is clear still");
    assert.equal(await page.locator(".score").getAttribute("data-set"), "true");
    await settle();
    const placedAfter = await inSlot();
    const stageBefore = placedBefore.stage, stageAfter = placedAfter.stage;
    const buttonBefore = placedBefore.button, buttonAfter = placedAfter.button;
    for (const key of ["x", "y", "width", "height"] as const) {
      assert.ok(Math.abs(stageAfter[key] - stageBefore[key]) < 2, `stage ${key} moved after full screen`);
      assert.ok(Math.abs(buttonAfter[key] - buttonBefore[key]) < 2, `button ${key} moved after full screen`);
    }
    const restored = await boxOf(page, ".player-slot");
    assert.ok(Math.abs(restored.height - beforeType.height) < 2, "leaving full screen resized the film");

    await page.locator(".btn-next").click();
    await page.waitForURL(/id=beta-film/);
    await page.waitForFunction(() => !(document.querySelector("#feedback") as HTMLTextAreaElement).disabled);
    assert.equal(await page.locator(".panel-title").innerText(), "Beta film");
    assert.equal(await page.locator(".score").getAttribute("data-set"), "false");
    assert.equal(await page.locator("#feedback").inputValue(), "");
    assert.equal(errors.length, 0, errors.join("\n"));
  } finally {
    await browser.close();
    await vite.close();
  }
}

const mode = process.argv[2];
if (mode === "--shots") {
  const url = process.argv[3];
  const dir = process.argv[4];
  if (!url || !dir) throw new Error("usage: verify-film-review.ts --shots <url> <directory>");
  await shots(url, dir);
} else {
  await behavior();
}
console.log("film review page ok");
