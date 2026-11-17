/** Local UAT: single-child progress, family sections and comparison links. */
import assert from "node:assert/strict";
import { waitForLayers } from "./layer-probe";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../browser-security.mjs";
const origin =
  process.env.AMP_PURCHASE_PREVIEW_ORIGIN ?? "http://127.0.0.1:4980";
const output = "/tmp/rebuild-funded-purchase/family-navigation";
await mkdir(output, { recursive: true });
const browser = await secureChromium(rawChromium).launch();
try {
  const context = await browser.newContext();
  assert.equal(
    (
      await context.request.post(origin + "/api/auth/sign-in/email", {
        headers: { origin },
        data: {
          email: "paid@purchase-preview.example",
          password: "synthetic purchase preview passphrase",
        },
      })
    ).status(),
    200,
  );
  const places = await (
    await context.request.get(origin + "/api/v1/families")
  ).json();
  const family = places.families.find(
    (x: { role: string }) => x.role === "holder",
  ).familyId;
  const base = `/family/${family}`;
  const info = await (
    await context.request.get(origin + "/api/v1/families/" + family)
  ).json();
  const child = info.children[0];
  const detail = `${base}/kids/${child.id}`;
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + base);
  for (const theme of ["light", "dark"])
    for (const width of [320, 390, 768, 1000, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      // Navigate within the app, as a parent does. Repeated full reloads
      // would turn a layout sweep into an account-session rate-limit test.
      const today = page.locator("nav[data-tabs] [data-tab=today]");
      await today.click();
      await page
        .getByRole("button", {
          name: `Practice with ${child.name}`,
          exact: true,
        })
        .waitFor();
      await page.evaluate(
        (theme) => document.documentElement.setAttribute("data-theme", theme),
        theme,
      );
      await page.evaluate(() => document.fonts.ready);
      const geometry = async () =>
        page.evaluate(() => {
          const main = document.querySelector("#family-content")!;
          const heading = main.querySelector("h1")!;
          const m = main.getBoundingClientRect(),
            h = heading.getBoundingClientRect();
          const bar = document
            .querySelector("[data-app-bar]")!
            .getBoundingClientRect();
          return { x: h.x, y: h.y, width: m.width, bar: bar.height };
        });
      const todayGeometry = await geometry();
      assert.equal(
        todayGeometry.bar,
        width >= 640 ? 56 : 104,
        "short tabs fit one row",
      );
      const tabs = page.locator("nav[data-tabs]");
      assert.deepEqual(
        await tabs.locator("[data-tab]:visible").allTextContents(),
        ["Today", "Progress", "Settings"],
      );
      assert.equal(
        await tabs.locator("[data-tab=progress]").getAttribute("href"),
        detail,
      );
      await tabs.getByRole("link", { name: "Progress", exact: true }).click();
      await page.waitForURL(origin + detail);
      await page
        .getByRole("heading", { name: "Current estimates", exact: true })
        .waitFor();
      assert.equal(
        await tabs.locator('[aria-current="page"]').innerText(),
        "Progress",
      );
      assert.equal(
        await page
          .getByRole("heading", { name: "Family map", exact: true })
          .count(),
        0,
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await page.evaluate(() => document.fonts.ready);
      assert.deepEqual(
        await geometry(),
        todayGeometry,
        "Progress heading and width match Today",
      );
      const workbook = page
        .locator("[data-child-page]")
        .getByRole("link", { name: "Workbooks", exact: true });
      assert.equal(await workbook.count(), 1);
      await workbook.click();
      await page.waitForURL(origin + `/learners/${child.id}/workbooks`);
      await page
        .getByRole("heading", { name: "Workbooks", exact: true })
        .waitFor();
      assert.equal(
        await tabs.locator('[aria-current="page"]').innerText(),
        "Progress",
      );
      await page.goBack();
      await page.waitForURL(origin + detail);
      await page
        .getByRole("heading", { name: "Current estimates", exact: true })
        .waitFor();
      await page.screenshot({
        animations: "disabled",
        path: `${output}/single-${width}-${theme}.png`,
      });
      await page
        .getByRole("navigation", { name: "Progress records" })
        .getByRole("link", { name: "Report cards" })
        .click();
      await page.waitForURL(origin + base + "/reports");
      await page
        .getByRole("heading", { name: "Report cards", exact: true })
        .first()
        .waitFor();
      assert.equal(
        await tabs.locator('[aria-current="page"]').innerText(),
        "Progress",
      );
      await page
        .getByRole("navigation", { name: "Progress records" })
        .getByRole("link", { name: "Practice time" })
        .click();
      await page.waitForURL(origin + base + "/time");
      assert.equal(
        await tabs.locator('[aria-current="page"]').innerText(),
        "Progress",
      );
      await page
        .getByRole("navigation", { name: "Progress records" })
        .getByRole("link", { name: "Progress", exact: true })
        .click();
      await page.waitForURL(origin + detail);
      await tabs.getByRole("link", { name: "Settings", exact: true }).click();
      await page
        .getByRole("heading", { name: "Settings", exact: true })
        .waitFor();
      assert.deepEqual(
        await geometry(),
        todayGeometry,
        "Settings heading and width match Today",
      );
      for (const [path, title] of [
        ["billing", "Billing"],
        ["privacy", "Privacy"],
        ["security", "Profile"],
      ]) {
        await page.locator(`a[href="/account/${path}"]`).click();
        await page.waitForURL(origin + `/account/${path}`);
        await page
          .getByRole("heading", { name: title, exact: true })
          .first()
          .waitFor();
        assert.deepEqual(
          await tabs.locator("[data-tab]:visible").allTextContents(),
          ["Today", "Progress", "Settings"],
        );
        assert.equal(
          await tabs.locator('[aria-current="page"]').innerText(),
          "Settings",
        );
        const headingBox = await page
          .getByRole("heading", { name: title, exact: true })
          .first()
          .boundingBox();
        assert.ok(
          headingBox && Math.abs(headingBox.x - todayGeometry.x) < 1,
          `${title} shares family left edge`,
        );
        await page.getByRole("link", { name: "Back", exact: true }).click();
        await page.waitForURL(origin + base + "/settings");
      }
      await page.goto(origin + "/purchase/funded");
      await page
        .getByRole("heading", { name: "Pay with education funds", exact: true })
        .waitFor();
      assert.deepEqual(
        await tabs.locator("[data-tab]:visible").allTextContents(),
        ["Today", "Progress", "Settings"],
      );
      assert.equal(
        await tabs.locator('[aria-current="page"]').innerText(),
        "Settings",
      );
      await page.getByRole("link", { name: "Back", exact: true }).click();
      await page.waitForURL(origin + "/account/billing");
      await page.getByRole("link", { name: "Back", exact: true }).click();
      await page.waitForURL(origin + base + "/settings");
      await page.getByRole("link", { name: /People & sharing/ }).click();
      await page.waitForURL(origin + base + "/people");
      await page
        .getByRole("heading", { name: "People & sharing", exact: true })
        .waitFor();
      assert.equal(
        await tabs.locator('[aria-current="page"]').innerText(),
        "Settings",
      );
      await page.getByRole("link", { name: "Back", exact: true }).click();
      await page.waitForURL(origin + base + "/settings");
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      console.log("PASS family sections", width, theme);
    }
  // Old map links preserve their curriculum layer and use the child's route.
  await page.goto(origin + base);
  await page.locator("[data-tab=progress]").waitFor();
  await page.evaluate(
    (href) => (window as Window & { location: Location }).location.assign(href),
    origin + base + "/map?open=area%3Aoperations",
  );
  // The layer goes into the child's page's layers; the address names the
  // page only.
  await page.waitForURL(origin + detail);
  await page.getByRole("dialog", { name: "Operations", exact: true }).waitFor();
  await waitForLayers(page, ["area:operations"]);
  await page.goBack();
  await page.waitForURL(origin + base);
  console.log("PASS map alias preserves layers and Back");

  // Display-only second-child fixture: no mutation of the local family.
  const secondId = "00000000-0000-4000-8000-000000000027";
  await context.route(origin + "/api/v1/families/" + family, (route) =>
    route.fulfill({
      json: {
        ...info,
        children: [
          ...info.children,
          { ...child, id: secondId, name: "Morgan" },
        ],
      },
    }),
  );
  await context.route(
    origin + "/api/v1/families/" + family + "/children/" + secondId + "/**",
    async (route) => {
      const response = await context.request.get(
        route.request().url().replace(secondId, child.id),
      );
      await route.fulfill({ response });
    },
  );
  // Match the published progress URL rather than assuming its route shape.
  const progressUrl = origin + child.paths.progress;
  const progress = await (await context.request.get(progressUrl)).json();
  await context.route(
    (url) => url.pathname.includes(secondId),
    (route) => route.fulfill({ json: progress }),
  );
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin + base + "/map");
    await page
      .getByRole("link", { name: `View ${child.name}’s progress`, exact: true })
      .waitFor();
    assert.equal(new URL(page.url()).pathname, base + "/map");
    const open = page.getByRole("link", {
      name: `View ${child.name}’s progress`,
      exact: true,
    });
    await open.hover();
    assert.equal(
      await open.evaluate(
        (el) =>
          getComputedStyle(el.closest("h2")!.parentElement!).backgroundColor,
      ),
      "rgba(0, 0, 0, 0)",
    );
    assert.equal(
      await page
        .getByRole("link", { name: "View Morgan’s progress", exact: true })
        .getAttribute("href"),
      base + "/kids/" + secondId,
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      animations: "disabled",
      path: `${output}/multiple-${width}.png`,
    });
    await open.click();
    await page.waitForURL(origin + detail);
    await page.getByRole("link", { name: "Back", exact: true }).click();
    await page.waitForURL(origin + base + "/map");
    console.log("PASS several children", width);
  }
  assert.deepEqual(errors, []);
  await context.close();
} finally {
  await browser.close();
}
