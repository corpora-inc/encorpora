/**
 * One browser pass for the founder review page: a note typed while the film
 * plays keeps the time of the first keystroke, the score starts unset at 5,
 * and both are still there after a reload.
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
  <button class="live-grade-btn is-approve" aria-label="Approve">Approve</button>
  <div class="live-sheet">Grade sheet</div>
  <input class="live-scrub" type="range" min="0" max="120" step="0.01" value="0" aria-label="Position">
  <span class="live-time">0:00</span>
</div>
<script>
  const scrub = document.querySelector(".live-scrub");
  let playing = true;
  window.__playing = () => playing;
  let base = 0, origin = performance.now();
  const now = () => base + (playing ? (performance.now() - origin) / 1000 : 0);
  const tick = () => { if (playing) scrub.value = String(now()); requestAnimationFrame(tick); };
  tick();
  scrub.addEventListener("input", () => { base = Number(scrub.value); origin = performance.now(); });
</script></body></html>`;

const lab = `<!doctype html><html><body><script>
const films=[{"id":"alpha-film","title":"Alpha film","added":"2026-11-10T00:00:00.000Z"},{"id":"beta-film","title":"Beta film","added":"2026-11-10T00:00:00.000Z"}];
</script></body></html>`;

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

async function scrubTime(page: Page) {
  return page.evaluate(() => {
    const frame = document.querySelector("iframe");
    const scrub = frame?.contentDocument?.querySelector(".live-scrub") as HTMLInputElement | null;
    return scrub ? Number(scrub.value) : -1;
  });
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

async function behavior() {
  const reviews: Record<string, { score: number | null; notes: { t: number; text: string }[] }> = {};
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
            if (url === "/fresh.html") return send(res, 200, lab, "text/html; charset=utf-8");
            if (url === "/review" && req.method === "GET") return send(res, 200, JSON.stringify(reviews), "application/json");
            if (url === "/review" && req.method === "POST") {
              const body = JSON.parse(await readBody(req)) as { id: string; score: number | null; notes: { t: number; text: string }[] };
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
    await page.waitForFunction(() => !(document.querySelector("#note-draft") as HTMLTextAreaElement).disabled);
    assert.equal(await page.locator(".panel-title").innerText(), "Alpha film");
    assert.equal(await page.locator(".score").getAttribute("data-set"), "false");
    assert.equal(await page.locator(".score-num").innerText(), "5");
    assert.equal(await page.locator(".score-caption").innerText(), "Not scored");

    const gradeHidden = await page.evaluate(() => {
      const button = document.querySelector("iframe")?.contentDocument?.querySelector(".live-grade-btn") as HTMLElement | null;
      const sheet = document.querySelector("iframe")?.contentDocument?.querySelector(".live-sheet") as HTMLElement | null;
      return !!button && getComputedStyle(button).display === "none" && !!sheet && getComputedStyle(sheet).display === "none";
    });
    assert.equal(gradeHidden, true);

    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: width >= 768 ? 800 : 700 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      assert.equal(overflow, false, `horizontal overflow at ${width}`);
      const player = await page.locator(".player-slot").boundingBox();
      const panel = await page.locator(".panel").boundingBox();
      assert.ok(player && panel);
      if (width >= 768) assert.ok(panel.x >= player.x + player.width - 2, `side by side at ${width}`);
      else assert.ok(panel.y >= player.y + player.height - 2, `stacked at ${width}`);
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

    await page.setViewportSize({ width: 390, height: 420 });
    await page.locator("#note-draft").click();
    const pinned = await page.locator(".player-slot").boundingBox();
    assert.ok(pinned && pinned.y >= -1 && pinned.y + pinned.height <= 424 && pinned.height >= 120);

    await page.setViewportSize({ width: 390, height: 844 });
    const before = await scrubTime(page);
    assert.ok(before >= 0);
    const box = page.locator("#note-draft");
    await box.press("O");
    await box.pressSequentially("pening is clear", { delay: 40 });
    const during = await scrubTime(page);
    await box.press("Enter");
    const savedT = Number(await page.locator(".note-time").getAttribute("data-t"));
    assert.ok(Math.abs(savedT - before) < 0.45, `note time ${savedT} should be the first keystroke near ${before}`);
    assert.ok(during > savedT + 0.35, `typing continued (${during}) after the stamp (${savedT})`);
    assert.equal(await page.locator(".note-text").innerText(), "Opening is clear");
    assert.equal(
      await page.evaluate(() => (document.querySelector("iframe")?.contentWindow as { __playing?: () => boolean } | null)?.__playing?.()),
      true,
    );

    const track = await page.locator(".score-track").boundingBox();
    assert.ok(track);
    await page.mouse.click(track.x + (track.width * 7) / 9, track.y + track.height / 2);
    await page.waitForFunction(() => document.querySelector(".score-num")?.textContent === "8");
    assert.equal(await page.locator(".score").getAttribute("data-set"), "true");
    await page.waitForFunction(() => document.querySelector(".save-text")?.textContent === "Saved");

    await page.reload();
    await page.waitForFunction(() => !(document.querySelector("#note-draft") as HTMLTextAreaElement).disabled);
    assert.equal(await page.locator(".note-text").innerText(), "Opening is clear");
    assert.equal(await page.locator(".score-num").innerText(), "8");
    assert.equal(await page.locator(".score").getAttribute("data-set"), "true");
    const again = Number(await page.locator(".note-time").getAttribute("data-t"));
    assert.equal(again, savedT);

    await page.locator(".note-time").click();
    await page.waitForFunction(
      (t) => {
        const scrub = document.querySelector("iframe")?.contentDocument?.querySelector(".live-scrub") as HTMLInputElement | null;
        return !!scrub && Math.abs(Number(scrub.value) - t) < 0.05;
      },
      savedT,
    );

    await page.locator(".btn-next").click();
    await page.waitForURL(/id=beta-film/);
    await page.waitForFunction(() => !(document.querySelector("#note-draft") as HTMLTextAreaElement).disabled);
    assert.equal(await page.locator(".panel-title").innerText(), "Beta film");
    assert.equal(await page.locator(".score").getAttribute("data-set"), "false");
    assert.equal(errors.length, 0, errors.join("\n"));
    await page.goto(`http://127.0.0.1:${port}/review.html?id=alpha-film&list=fresh`);
    await page.locator('a[href="fresh.html"]').waitFor();
    assert.equal(await page.locator('a[href="fresh.html"]').innerText(), 'Fresh films');
    await page.locator('.btn-next').click();
    await page.waitForURL(/id=beta-film&list=fresh/);
    await page.locator('a[href="fresh.html"]').waitFor();
    assert.equal(await page.locator('.btn-next').isDisabled(), true, 'The other film is already scored');
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
