/** Real app/API, approved CDN media, route history, playback and responsive proof. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium, type Page } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { startShellFixture } from "./app-shell-fixture";
import { lessonFilms } from "../src/content/lesson-films";

const argument = (key: string) => {
  const i = process.argv.indexOf(`--${key}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const shots = argument("shots") ?? "artifacts/lesson-films";
await mkdir(shots, { recursive: true });
const fixture = await startShellFixture({
  webPort: 4991,
  production: process.argv.includes("--production"),
});
const browser = await secureChromium(rawChromium).launch();
const film = lessonFilms["count-objects"]!;
assert.ok(film);
const geometry = (page: Page) => page.locator(".live-bar").boundingBox();
async function ready(page: Page) {
  await page.waitForFunction(() => {
    const button = document.querySelector<HTMLButtonElement>(".live-toggle");
    return button && !button.disabled;
  });
}
async function playAndSeek(page: Page) {
  await ready(page);
  const before = await geometry(page);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(
    () => (document.querySelector("audio")?.currentTime ?? 0) > 0.3,
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("audio")?.paused === true,
  );
  const target = Math.round(film.duration * 0.32);
  await page
    .getByRole("slider", { name: "Film position" })
    .fill(String(target));
  await page.waitForFunction(
    (target) =>
      Math.abs((document.querySelector("audio")?.currentTime ?? 0) - target) <
      0.3,
    target,
  );
  assert.ok(await page.locator("#film .film-shot").count());
  await page.waitForFunction(() => document.querySelector(".live-toggle")?.getAttribute("aria-label") === "Play");
  assert.equal(await page.locator(".live").evaluate((node) => node.classList.contains("playing")), false, "Paused narration must show the play control");
  assert.deepEqual(
    await geometry(page),
    before,
    "Playback and seeking must not move controls",
  );
}
try {
  for (const theme of ["light", "dark"] as const)
    for (const viewport of [
      { width: 320, height: 640 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 },
    ].filter((viewport) => !argument("widths") || argument("widths")!.split(",").includes(String(viewport.width)))) {
      const context = await fixture.context(browser, "paid", {
        viewport,
        colorScheme: theme,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(60000);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      let mediaRequests = 0;
      page.on("request", (request) => {
        if (request.url().includes("/amp/films/")) mediaRequests++;
      });
      await page.goto(`${fixture.origin}/lessons?topic=count-objects`);
      const watch = page.getByRole("link", { name: /Watch lesson/ });
      await watch.waitFor();
      assert.equal(
        mediaRequests,
        0,
        "Opening a written lesson must not fetch media",
      );
      // Hold data briefly to measure the same reserved controls during loading.
      let release!: () => void;
      const hold = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route(film.dataUrl, async (route) => {
        await hold;
        await route.continue();
      });
      await watch.click();
      await page.waitForURL(/\/lessons\/count-objects\/watch/);
      await page.locator(".live-bar").waitFor();
      const loadingBar = await geometry(page);
      release();
      await ready(page);
      assert.deepEqual(
        await geometry(page),
        loadingBar,
        "Loading must not move controls",
      );
      await playAndSeek(page);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      const badTargets = await page
        .locator(".live-bar button,.live-bar a")
        .evaluateAll((nodes) =>
          nodes
            .filter((node) => {
              const box = node.getBoundingClientRect();
              return box.width > 0 && (box.width < 44 || box.height < 44);
            })
            .map((node) => node.textContent),
        );
      assert.deepEqual(badTargets, []);
      await page.screenshot({
        path: `${shots}/film-${viewport.width}-${theme}.png`,
      });
      await page
        .getByRole("link", { name: "Back to lesson", exact: true })
        .click();
      await watch.waitFor();
      assert.equal(
        await page.locator("audio").count(),
        0,
        "Returning must dispose narration",
      );
      if ([390, 1280].includes(viewport.width)) {
        await page.goBack();
        await ready(page);
        await page.goForward();
        await watch.waitFor();
        await watch.click();
        await ready(page);
        await page.reload();
        await ready(page);
        await page
          .getByRole("link", { name: "Back to lesson", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Practice this", exact: true })
          .click();
        await page.waitForURL(/\/practice/);
        const problem = page.locator("[data-problem-id]");
        await problem.waitFor();
        const problemId = await problem.getAttribute("data-problem-id");
        await page.getByRole("button", { name: "Lesson", exact: true }).click();
        await page
          .getByRole("dialog")
          .getByRole("link", { name: /Watch lesson/ })
          .click();
        await playAndSeek(page);
        assert.equal(
          await page.locator("dialog:modal").count(),
          0,
          "A lesson sheet cannot trap focus behind the film",
        );
        await page.getByRole("link", { name: "Back to problem" }).click();
        await problem.waitFor();
        assert.equal(
          await problem.getAttribute("data-problem-id"),
          problemId,
          "Return to the exact active problem",
        );
        // A real media failure stays inline, keeps controls in place, and can retry.
        await page.goto(`${fixture.origin}/lessons/count-objects/watch`);
        await ready(page);
        await page.route(film.audioUrl, (route) => route.abort());
        await page.reload();
        await page
          .getByRole("button", { name: "Retry", exact: true })
          .waitFor();
        const failedBar = await geometry(page);
        await page.unroute(film.audioUrl);
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        await ready(page);
        assert.deepEqual(
          await geometry(page),
          failedBar,
          "Retry must not move controls",
        );
        // The current server's manifest is authoritative for an older open app.
        await page.route(
          "**/api/v1/problem-lessons/browser-film-only?film=lesson-film-v1",
          (route) => route.fulfill({ json: { lesson: { film } } }),
        );
        await page.goto(`${fixture.origin}/lessons/browser-film-only/watch`);
        await ready(page);
        await playAndSeek(page);
      }
      assert.deepEqual(
        errors,
        [],
        `Browser errors: ${viewport.width} ${theme}`,
      );
      await context.close();
      console.log(
        `PASS ${viewport.width}px ${theme}: playback, seeking, return, stable geometry`,
      );
    }
} finally {
  await browser.close();
  await fixture.close();
}
