import { chromium } from "playwright";
import { createServer } from "vite";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import { developmentAuth } from "../src/server/auth";
import { migrate } from "./migrate";
import { templates } from "../src/math/engine";
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url)
  throw new Error("AMP_TEST_DATABASE_URL is required for browser verification");
await migrate(url);
const repository = new PostgresRepository(url);
const account = "development-household";
const learner = await repository.create(account, "Browser verification");
const app = buildApp({
  repository,
  authenticate: developmentAuth(),
  development: true,
});
await app.listen({ host: "127.0.0.1", port: 4311 });
const vite = await createServer({
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: { host: "127.0.0.1", port: 4310, strictPort: true },
});
await vite.listen();
const browser = await chromium.launch({ headless: true });
await mkdir(new URL("../artifacts/screenshots/", import.meta.url), {
  recursive: true,
});
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4310");
  await page
    .getByRole("combobox", { name: "Learner", exact: true })
    .selectOption(learner.id);
  for (const viewport of [
    { width: 1280, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page
      .getByRole("button", { name: "Your practice", exact: true })
      .click();
    if (await page.getByRole("button", { name: "Let’s begin" }).isVisible()) {
      await page
        .getByLabel("Choose your practice")
        .selectOption("fraction-model");
      await page.getByRole("button", { name: "Let’s begin" }).click();
    }
    await page.locator("#answer").waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Viewport must not overflow",
    );
    await page.screenshot({
      path: new URL(
        `../artifacts/screenshots/practice-${viewport.width}.png`,
        import.meta.url,
      ).pathname,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "A little help" }).click();
  await page.locator(".hint").waitFor();
  await page.locator("#answer").fill("0");
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.getByRole("status").waitFor();
  assert.ok(
    await page
      .getByRole("status")
      .innerText()
      .then((t) => t.includes("Practiced with a hint")),
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.locator("#answer").waitFor();
  for (const template of templates) {
    await page
      .getByRole("button", { name: "Change topic", exact: true })
      .click();
    await page.getByLabel("Choose your practice").selectOption(template.id);
    await page.getByRole("button", { name: "Let’s begin" }).click();
    await page.locator("#answer").waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Overflow in ${template.id}`,
    );
    if (
      template.id.startsWith("graphed-") ||
      template.id.startsWith("clock-") ||
      template.id.startsWith("bar-chart-")
    )
      await page.screenshot({
        path: new URL(
          `../artifacts/screenshots/${template.id}.png`,
          import.meta.url,
        ).pathname,
        fullPage: true,
      });
  }
  await page.getByRole("button", { name: "Lesson library" }).click();
  await page
    .getByRole("button", { name: "Read lesson", exact: true })
    .first()
    .click();
  await page.locator(".lesson-reader").waitFor();
  if (process.env.AMP_VERIFY_DOWNLOADS === "true") {
    const downloading = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download lesson PDF", exact: true })
      .click();
    const download = await downloading;
    assert.match(download.suggestedFilename(), /\.pdf$/);
    assert.equal(await download.failure(), null);
  }
  await page
    .getByRole("button", { name: "Your progress", exact: true })
    .click();
  await page.locator(".progress-card").first().waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Browser learning, hint, attempt, lesson and progress flows passed at desktop and phone widths.",
  );
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.pool.query("DELETE FROM amp_learners WHERE id=$1", [
    learner.id,
  ]);
  await repository.close();
}
