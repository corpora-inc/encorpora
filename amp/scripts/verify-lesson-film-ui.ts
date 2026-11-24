/** Real app/API, approved CDN media, route history, playback and responsive proof. */
import assert from "node:assert/strict";
import { waitForLayers } from "./layer-probe";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium, type Page } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { startShellFixture } from "./app-shell-fixture";
import { FILM_CAPABILITY, lessonFilms } from "../src/content/lesson-films";
import { assertLookOnScreen, lookThemes, wearLook } from "./lib/fixture-look";
import type { Look } from "../src/learning/look";

const argument = (key: string) => {
  const i = process.argv.indexOf(`--${key}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const shots = argument("shots") ?? "artifacts/lesson-films";
await mkdir(shots, { recursive: true });
const fixture = await startShellFixture({
  webPort: Number(argument("port") ?? 4991),
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
/** The look the family's children wear, said by the check
 * (lib/fixture-look.ts). Left unsaid it follows each child's grade, Colorful
 * through grade 5, so the film a handed-over child opens was measured in
 * whichever look their birth year gave that month. */
async function wear(look: Look) {
  for (const learner of [fixture.paid.jordan, fixture.paid.avery])
    await wearLook(fixture.repository, fixture.paid.account, learner.id, look);
}
/** `look`: the one on screen for this opening. A parent's own screens are
 * Calm; a child's practice, handed over, wears the child's. */
async function playAndSeek(page: Page, look: Look) {
  await ready(page);
  await assertLookOnScreen(page, look, "lesson film");
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
  const contrast = await page.evaluate(() => {
    // A computed color is whatever notation its token was written in:
    // rgb() in Calm, oklch() in Colorful. Reading the first three numbers
    // of the string as red, green and blue made every Colorful color
    // nearly black, and any two of them a contrast of 1.0001. Each color
    // is painted and read back as sRGB instead.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const pen = canvas.getContext("2d", { willReadFrequently: true })!;
    const luminance = (color: string) => {
      pen.clearRect(0, 0, 1, 1);
      // A color the canvas can't read leaves the pen as it was: told apart.
      pen.fillStyle = "#010203";
      pen.fillStyle = color;
      if (pen.fillStyle === "#010203")
        throw new Error(`Not a color the canvas reads: ${color}`);
      pen.fillRect(0, 0, 1, 1);
      const [red, green, blue, alpha] = pen.getImageData(0, 0, 1, 1).data;
      if (alpha !== 255) throw new Error(`Not an opaque color: ${color}`);
      const rgb = [red!, green!, blue!]
        .map((n) => n / 255)
        .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
      return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
    };
    const ratio = (a: string, b: string) => {
      const x = luminance(a),
        y = luminance(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    // Every colored ink of the equation on screen (film/stage.ts
    // `mathInks`); the least readable one is the equation's contrast.
    const ground = getComputedStyle(
      document.querySelector(".live")!,
    ).backgroundColor;
    const inks = [
      ...document.querySelectorAll('.katex [style*="--color-"]'),
    ].map((ink) => ratio(getComputedStyle(ink).color, ground));
    const toggle = document.querySelector(".live-toggle")!;
    return {
      accent: !!document.querySelector(
        '.katex [style*="--color-figure-accent"]',
      ),
      equation: Math.min(...inks),
      control: ratio(
        getComputedStyle(toggle, "::before").backgroundColor,
        getComputedStyle(toggle).backgroundColor,
      ),
    };
  });
  assert.ok(contrast.accent, "The equation on screen has colored ink");
  assert.ok(
    contrast.equation >= 4.5,
    `Colored equation contrast: ${contrast.equation}`,
  );
  assert.ok(
    contrast.control >= 3,
    `Playback control contrast: ${contrast.control}`,
  );
  await page.waitForFunction(
    () =>
      document.querySelector(".live-toggle")?.getAttribute("aria-label") ===
      "Play",
  );
  assert.equal(
    await page
      .locator(".live")
      .evaluate((node) => node.classList.contains("playing")),
    false,
    "Paused narration must show the play control",
  );
  assert.deepEqual(
    await geometry(page),
    before,
    "Playback and seeking must not move controls",
  );
}
try {
  // Colorful once (one scheme under a device's light and dark), at the two
  // widths that walk the whole journey; then Calm in light and in dark at
  // every width, as this check always ran.
  for (const { look, theme, name } of lookThemes()) {
    await wear(look);
    for (const viewport of [
      { width: 320, height: 640 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 },
    ].filter(
      (viewport) =>
        (look === "calm" || [390, 1280].includes(viewport.width)) &&
        (!argument("widths") ||
          argument("widths")!.split(",").includes(String(viewport.width))),
    )) {
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
      // An old short-lesson link: it opens the lesson in Pathways.
      await page.goto(`${fixture.origin}/lessons?topic=count-objects`);
      // The parent's map is their child's own (canonicalLearnerAddress).
      await page.waitForURL((url) => url.pathname.endsWith("/pathways"));
      await waitForLayers(page, ["lesson:count-objects"]);
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
      // The parent's own screen: Calm, whatever their children wear.
      await playAndSeek(page, "calm");
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
      // The film closes (no in-page Back) to the lesson it opened from.
      await page.getByRole("link", { name: "Close film", exact: true }).click();
      await watch.waitFor();
      assert.equal(
        await page.locator("audio").count(),
        0,
        "Returning must dispose narration",
      );
      if ([390, 1280].includes(viewport.width)) {
        // Closing the film goes back where it was opened (one close path,
        // return-to.ts): the film is the forward entry, and Back from it is
        // the lesson again.
        await page.goForward();
        await ready(page);
        await page.goBack();
        await watch.waitFor();
        await watch.click();
        await ready(page);
        await page.reload();
        await ready(page);
        await page
          .getByRole("link", { name: "Close film", exact: true })
          .click();
        // A parent reads a child's map: the child's practice is their own
        // session (PathwaysScreen readOnly), so the lesson offers no Try.
        // Practice the same problem type at the address Try opens.
        await watch.waitFor();
        assert.equal(
          await page.getByRole("link", { name: /^Practice/ }).count(),
          0,
          "A child's map offers the adult no practice of its own",
        );
        await page.goto(
          `${fixture.origin}/practice?skill=count-to-20&template=count-objects`,
        );
        await page.waitForURL(/\/practice/);
        const problem = page.locator("[data-problem-id]");
        await problem.waitFor();
        const problemId = await problem.getAttribute("data-problem-id");
        await page.getByRole("button", { name: "Lesson", exact: true }).click();
        await page
          .getByRole("dialog")
          .getByRole("link", { name: /Watch lesson/ })
          .click();
        await playAndSeek(page, look);
        assert.equal(
          await page.locator("dialog:modal").count(),
          0,
          "A lesson sheet cannot trap focus behind the film",
        );
        // The child's film, in the child's look.
        await page.screenshot({
          path: `${shots}/film-child-${viewport.width}-${name}.png`,
        });
        // Closing the film returns to the problem it opened over.
        await page
          .getByRole("link", { name: "Close film", exact: true })
          .click();
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
          `**/api/v1/problem-lessons/browser-film-only?film=${FILM_CAPABILITY}`,
          (route) => route.fulfill({ json: { lesson: { film } } }),
        );
        await page.goto(`${fixture.origin}/lessons/browser-film-only/watch`);
        await ready(page);
        await playAndSeek(page, look);
      }
      assert.deepEqual(errors, [], `Browser errors: ${viewport.width} ${name}`);
      await context.close();
      console.log(
        `PASS ${viewport.width}px ${name}: playback, seeking, return, stable geometry`,
      );
    }
  }
} finally {
  // Teardown is bounded. On the CI runner one of these closes never settled
  // after every case had passed, and the lane ran to its 75-minute limit
  // with the later checks unrun.
  const closed = (async () => {
    await browser.close();
    await fixture.close();
    return true;
  })();
  const waited = new Promise<false>((resolve) =>
    setTimeout(() => resolve(false), 30_000).unref(),
  );
  if (!(await Promise.race([closed, waited])))
    console.warn("Lesson film check: teardown did not finish in 30 s; exiting");
}
// Every case passed (a failure above has already thrown): leave now, whatever
// handle a close left open.
process.exit(0);
