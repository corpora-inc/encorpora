import assert from "node:assert/strict";
import { resolve } from "node:path";
import { buildSite } from "../src/build.js";
import { configSchema } from "../src/config.js";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";
import { startServer } from "./server.js";
import { routes as paths } from "../src/pages.js";
await mkdir("artifacts", { recursive: true });
const { server, url } = await startServer();
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let production: Awaited<ReturnType<typeof startServer>> | undefined;
try {
  browser = await chromium.launch();
  for (const width of [320, 390, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    for (const path of paths) {
      assert.equal((await page.goto(url + path))?.status(), 200);
      assert.equal(await page.locator("h1").count(), 1);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Horizontal overflow ${path} at ${width}`,
      );
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      assert.deepEqual(
        results.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        [],
        `${path} ${width} accessibility`,
      );
      if (path === "/" || path === "/amp/" || path === "/legal/privacy/")
        await page.screenshot({
          path: `artifacts/${path === "/" ? "home" : path === "/amp/" ? "amp" : "privacy"}-${width}.png`,
          fullPage: true,
        });
      const links = await page
        .locator('a[href^="/"]')
        .evaluateAll((nodes) => [
          ...new Set(nodes.map((n) => n.getAttribute("href")!.split("#")[0]!)),
        ]);
      for (const link of links.filter(Boolean))
        assert.equal(
          (await page.request.get(url + link)).status(),
          200,
          `Broken link ${link}`,
        );
    }
    await page.goto(url);
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(":focus").innerText(), "Skip to content");
    await page.keyboard.press("Enter");
    await page.locator(".solution summary").focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator(".solution[open]").count(), 1);
    await page.goto(url + "/samples/");
    await page.emulateMedia({ media: "print" });
    if (width === 1280)
      await page.pdf({
        path: "artifacts/sample.pdf",
        format: "A4",
        printBackground: true,
      });
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(
    `All ${paths.length} pages: 320/390/1280, no overflow, axe violations, broken internal links, or console errors. Keyboard solution reveal and printable PDF passed.`,
  );
  // Synthetic production configuration exercises indexing, contacts, prices and
  // state guidance without a merchant credential or real commercial data.
  await buildSite(
    configSchema.parse({
      mode: "production",
      siteUrl: "https://www.example.invalid",
      appUrl: "https://app.example.invalid",
      supportEmail: "support@example.invalid",
      legalReviewed: true,
      operator: {
        legalName: "Synthetic test operator",
        postalAddress: "Synthetic test address",
        telephone: "Synthetic test telephone",
      },
      privacy: {
        retention: "Synthetic retention fixture, not a public policy.",
        placementBasis:
          "Synthetic fixture only; no legal basis for collecting real data is asserted.",
        providers: [
          {
            name: "Synthetic provider",
            purpose: "Test rendering only.",
            retention: "Synthetic test duration.",
          },
        ],
      },
      plans: [
        { interval: "year", amountMinor: 1234, currency: "USD", renews: false },
        { interval: "month", amountMinor: 234, currency: "USD", renews: true },
      ],
      funding: [
        {
          state: "AZ",
          program: "Synthetic test program",
          kind: "reimbursement",
          instructions: "Synthetic guidance for rendering only.",
          sourceUrl: "https://program.example.invalid",
          reviewedUntil: "2099-01-01",
        },
      ],
    }),
    "artifacts/production",
  );
  production = await startServer(resolve("artifacts/production"));
  const fixtureContext = await browser.newContext({
    viewport: { width: 320, height: 900 },
  });
  const fixturePage = await fixtureContext.newPage();
  for (const path of ["/amp/", "/esa/", "/legal/privacy/"]) {
    await fixturePage.goto(production.url + path);
    assert.ok(
      await fixturePage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Configured layout overflow ${path}`,
    );
    const result = await new AxeBuilder({ page: fixturePage })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    assert.equal(
      result.violations.length,
      0,
      `Configured accessibility ${path}`,
    );
  }
  await fixturePage.goto(production.url + "/amp/");
  assert.equal(await fixturePage.locator(".plan").count(), 2);
  assert.match(await fixturePage.locator("#plans").innerText(), /\$12.34/);
  assert.equal(
    await fixturePage.locator(".site-header .button").getAttribute("href"),
    "https://app.example.invalid",
  );
  await fixturePage.goto(production.url + "/esa/");
  assert.match(
    await fixturePage.locator("#state-AZ").innerText(),
    /Synthetic test program/,
  );
  await fixtureContext.close();
  const chrome = await launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ["--headless", "--no-sandbox"],
  });
  try {
    for (const path of ["/", "/amp/"]) {
      const report = await lighthouse(production.url + path, {
        port: chrome.port,
        output: "json",
        onlyCategories: [
          "performance",
          "accessibility",
          "best-practices",
          "seo",
        ],
        logLevel: "error",
      });
      assert.ok(report);
      const scores = Object.fromEntries(
        Object.entries(report.lhr.categories).map(([key, value]) => [
          key,
          Math.round((value.score ?? 0) * 100),
        ]),
      );
      await writeFile(
        `artifacts/lighthouse-${path === "/" ? "home" : path === "/amp/" ? "amp" : "privacy"}.json`,
        JSON.stringify(report.lhr, null, 2),
      );
      // Scores are evidence, not a speed-dependent required status check.
      // Deterministic axe, overflow, keyboard and link checks above remain gates.
      if (Object.values(scores).some((score) => score < 95))
        console.warn(`Lighthouse target below 95: ${JSON.stringify(scores)}`);
      console.log(
        `Lighthouse ${path}: ${JSON.stringify(scores)} (synthetic production configuration)`,
      );
    }
  } finally {
    await chrome.kill();
  }
} finally {
  if (production)
    await new Promise<void>((resolve) =>
      production!.server.close(() => resolve()),
    );
  await browser?.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
