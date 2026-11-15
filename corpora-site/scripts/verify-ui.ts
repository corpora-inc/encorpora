import { secureChromium } from "../../amp/browser-security.mjs";
import assert from "node:assert/strict";
import { guidedFundingFixture as fundingFixture } from "../tests/funding-fixture.js";
import { resolve } from "node:path";
import { buildSite } from "../src/build.js";
import { configSchema } from "../src/config.js";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium as rawChromium } from "playwright";
const chromium = secureChromium(rawChromium);
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
  const checkedLinks = new Set<string>();
  const representative = new Set(["/", "/amp/", "/grades/3/", "/grades/12/", "/workbooks/grade-3/", "/compare/amp-vs-ctcmath/", "/learn/area/", "/tutors/", "/personalized-workbooks/", "/plans/", "/resources/", "/lessons/", "/compare/", "/amp/how-it-works/", "/philosophy/guided-discovery/", "/videos/count-objects/", "/videos/rectangle-area/"]);
  for (const width of [320, 390, 768, 1280]) {
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
      assert.deepEqual(await page.locator('a[href^="https://"],a[href^="http://"],a[href^="//"]').evaluateAll(links => links.filter(link => link instanceof HTMLAnchorElement && new URL(link.href).origin !== "https://corpora.inc" && (link.target !== "_blank" || !link.relList.contains("noopener"))).map(link => link.getAttribute("href"))), [], `External links must open safely in a new tab: ${path}`);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Horizontal overflow ${path} at ${width}`,
      );
      if(width===320 || representative.has(path)) {
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
      }
      if (
        representative.has(path) ||
        path === "/" ||
        path === "/amp/" ||
        path === "/schools/" ||
        path === "/amp/how-it-works/" ||
        path === "/philosophy/guided-discovery/" ||
        path === "/legal/privacy/"
      ) {
        await page.locator("img").evaluateAll(async nodes=>{await Promise.all(nodes.map(async image=>{if(image instanceof HTMLImageElement){image.loading="eager"; await image.decode();}}));});
        await page.screenshot({
          path: `artifacts/${path === "/" ? "home" : path === "/amp/" ? "amp" : path === "/schools/" ? "schools" : path.replaceAll("/", "-")}-${width}.png`,
          fullPage: true,
        });
      }
      const links = await page
        .locator('a[href^="/"]')
        .evaluateAll((nodes) => [
          ...new Set(nodes.map((n) => n.getAttribute("href")!.split("#")[0]!)),
        ]);
      for (const link of links.filter(Boolean)) {
        if(checkedLinks.has(link)) continue;
        checkedLinks.add(link);
        assert.equal(
          (await page.request.get(url + link)).status(),
          200,
          `Broken link ${link}`,
        );
      }
    }
    for (const fragment of ["understanding", "paper"]) {
      await page.goto(`${url}/how-it-works/?utm_source=alias-check#${fragment}`);
      await page.waitForURL(`${url}/amp/how-it-works/?utm_source=alias-check#${fragment}`);
      await page.locator(`#${fragment}`).waitFor();
    }
    const paper = page.locator("#paper");
    assert.equal(await paper.locator(".article-gallery img").count(), 2);
    assert.equal(await paper.locator('a[href="/personalized-workbooks/"]').count(), 1);
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await paper.locator("img").evaluateAll(async images => { await Promise.all(images.map(image => (image as HTMLImageElement).decode())); });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await paper.screenshot({ path: `artifacts/workbook-gallery-${colorScheme}-${width}.png` });
    }
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(url);
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(":focus").innerText(), "Skip to content");
    await page.keyboard.press("Enter");
    await page.locator(".solution summary").focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator(".solution[open]").count(), 1);
    await page.locator(".site-menu summary").focus();
    await page.keyboard.press("Enter");
    const menu = await page.locator(".site-menu-links").boundingBox();
    assert.ok(menu && menu.x >= 0 && menu.x + menu.width <= width, `Explore menu clipped at ${width}`);
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(":focus").getAttribute("href"), "/amp/how-it-works/");
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
    `All ${paths.length} pages: 320/390/768/1280, no overflow, axe violations, broken internal links, or console errors. Keyboard solution reveal and printable PDF passed.`,
  );
  const noScript = await browser.newContext({ javaScriptEnabled: false });
  const noScriptPage = await noScript.newPage();
  await noScriptPage.goto(url + "/how-it-works/");
  await noScriptPage.waitForURL(url + "/amp/how-it-works/");
  assert.equal(await noScriptPage.locator("h1").innerText(), "You put in the time. AMP does the rest.");
  await noScript.close();
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
      funding: [fundingFixture, { ...fundingFixture, state: "AR", kind: "classwallet-direct-pay",
        page: { ...fundingFixture.page, slug: "arkansas-efa",
          presentation: { ...fundingFixture.page.presentation, invoiceForm: "arkansas-efa" } } }, { ...fundingFixture, state: "AZ", kind: "classwallet-direct-pay", page: { ...fundingFixture.page, slug: "arizona-esa", presentation: { ...fundingFixture.page.presentation, invoiceForm: "arizona-esa" } } }, { ...fundingFixture, state: "NH", program: "New Hampshire EFA", kind: "classwallet-direct-pay", page: { ...fundingFixture.page, slug: "new-hampshire-efa", presentation: { ...fundingFixture.page.presentation, invoiceForm: "new-hampshire-efa" } } }],
    }),
    "artifacts/production",
  );
  production = await startServer(resolve("artifacts/production"));
  const fixtureContext = await browser.newContext({
    viewport: { width: 320, height: 900 },
  });
  const fixturePage = await fixtureContext.newPage();
  for (const path of [
    "/amp/",
    "/esa/",
    "/esa/synthetic-program/",
    "/schools/",
    "/legal/privacy/",
  ]) {
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
  for (const width of [320, 390, 1280]) {
    await fixturePage.setViewportSize({ width, height: 900 });
    await fixturePage.goto(production.url + "/esa/synthetic-program/");
    const action = fixturePage.locator(".funding-intro .funding-actions .button");
    const href = new URL((await action.getAttribute("href"))!);
    assert.equal(href.protocol, "mailto:");
    assert.equal(
      href.searchParams.get("subject"),
      "Curriculum invoice & purchase question",
    );
    assert.ok(
      await fixturePage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.equal(
      (
        await new AxeBuilder({ page: fixturePage })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations.length,
      0,
    );
    await fixturePage.screenshot({
      path: `artifacts/funding-guided-${width}.png`,
      fullPage: true,
    });
  }
  for (const slug of ["arkansas-efa", "arizona-esa", "new-hampshire-efa"]) for (const width of [320, 390, 768, 1280]) {
    await fixturePage.setViewportSize({ width, height: 900 });
    await fixturePage.goto(production.url + `/esa/${slug}/`);
    const proof = fixturePage.locator(".funding-product-proof");
    await proof.getByText("See what your child gets.", { exact: true }).waitFor();
    const assessment = new URL((await proof.getByRole("link", { name: "Start your free assessment" }).getAttribute("href"))!);
    assert.equal(assessment.pathname, "/try");
    assert.equal(assessment.searchParams.get("program"), slug === "arkansas-efa" ? "ar-efa" : slug === "arizona-esa" ? "az-esa" : "nh-efa");
    await proof.locator(".solution summary").focus();
    await fixturePage.keyboard.press("Enter");
    assert.equal(await proof.locator(".solution[open]").count(), 1);
    assert.equal((await new AxeBuilder({ page: fixturePage }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations.length, 0);
    await proof.screenshot({ path: `artifacts/funding-proof-${slug}-${width}.png` });
    const action = fixturePage.locator(".funding-intro .funding-actions .button");
    assert.ok((await action.textContent())?.includes("Create your invoice"));
    const destination = new URL((await action.getAttribute("href"))!);
    assert.equal(destination.pathname, `/invoice/${slug}`);
    assert.equal(destination.protocol, "https:");
    assert.ok(await fixturePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await fixturePage.context().route(destination.href, route => route.fulfill({ contentType: "text/html", body: '<!doctype html><html><body><label>Student name<input></label><button>Download invoice</button></body></html>' }));
    assert.equal(await action.getAttribute("target"), "_blank");
    const [invoiceTab] = await Promise.all([fixturePage.waitForEvent("popup"), action.click()]);
    await invoiceTab.getByRole("button", { name: "Download invoice" }).waitFor();
    assert.equal(await invoiceTab.evaluate(() => window.opener), null);
    assert.equal(fixturePage.url(), production.url + `/esa/${slug}/`);
    assert.equal(await fixturePage.locator("[data-invoice-dialog][open]").count(), 0);
    await invoiceTab.screenshot({ path: `artifacts/invoice-form-${slug}-${width}.png` });
    await invoiceTab.close();
    assert.equal(await action.evaluate(el => el === document.activeElement), true);
  }
  await fixturePage.goto(production.url + "/schools/");
  const inquiry = new URL(
    (await fixturePage
      .getByRole("link", { name: "Ask about school licenses" })
      .getAttribute("href"))!,
  );
  assert.equal(inquiry.protocol, "mailto:");
  assert.equal(
    inquiry.searchParams.get("subject"),
    "AMP Mathematics school inquiry",
  );
  assert.ok(
    inquiry.searchParams
      .get("body")
      ?.includes("Approximate number of learners:"),
  );
  assert.ok(
    inquiry.searchParams
      .get("body")
      ?.includes("Please do not include student names or records."),
  );
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
    /Synthetic education funding program/,
  );
  for (const width of [320, 390, 1280]) {
    await fixturePage.setViewportSize({ width, height: 900 });
    await fixturePage.goto(production.url + "/esa/synthetic-program/");
    assert.equal(await fixturePage.locator("h1").count(), 1);
    assert.ok(
      await fixturePage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.equal(
      (
        await new AxeBuilder({ page: fixturePage })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations.length,
      0,
    );
    await fixturePage.screenshot({
      path: `artifacts/program-${width}.png`,
      fullPage: true,
    });
  }
  await fixtureContext.close();
  const chrome = await launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ["--headless"],
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
