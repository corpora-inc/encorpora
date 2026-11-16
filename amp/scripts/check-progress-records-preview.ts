/** Isolated UAT: family record headers and actual workbook download names. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { purchasePreview } from "./purchase-preview-fixture";
import { localDate } from "../src/web/features/workbooks/model";
import { workbookFilename } from "../src/workbook/filename";
const fixture = await purchasePreview(5076);
const browser = await secureChromium(rawChromium).launch();
const output = "/tmp/rebuild-funded-purchase/progress-records";
await mkdir(output, { recursive: true });
try {
  const parent = fixture.personas.find((p) => p.key === "paid")!;
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const login = await context.request.post(
    fixture.origin + "/api/auth/sign-in/email",
    {
      headers: { origin: fixture.origin },
      data: { email: parent.email, password: fixture.password },
    },
  );
  assert.equal(login.status(), 200);
  const added = await context.request.post(
    fixture.origin + "/api/v1/learners",
    {
      headers: { origin: fixture.origin },
      data: { name: "Maya", birthYear: 2016 },
    },
  );
  assert.equal(added.status(), 201, await added.text());
  const second = await added.json();
  const places = await (
    await context.request.get(fixture.origin + "/api/v1/families")
  ).json();
  const family = places.families.find(
    (p: { role: string }) => p.role === "holder",
  ).familyId;
  const base = `/family/${family}`;
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(fixture.origin + base + "/time");
  for (const theme of ["light", "dark"])
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(
        (theme) => document.documentElement.setAttribute("data-theme", theme),
        theme,
      );
      let geometry: { x: number; y: number; width: number } | undefined;
      for (const [leaf, title] of [
        ["time", "Practice time"],
        ["reports", "Report cards"],
        ["workbooks", "Workbooks"],
      ]) {
        if (new URL(page.url()).pathname !== `${base}/${leaf}`)
          await page
            .locator(
              `nav[aria-label="Progress records"] a[href="${base}/${leaf}"]`,
            )
            .click();
        await page
          .getByRole("heading", { name: title!, exact: true, level: 1 })
          .waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.mouse.move(0, 0);
        assert.equal(await page.locator("main h1").count(), 1);
        assert.equal(
          await page
            .locator("[data-family-heading] nav[aria-label='Progress records']")
            .count(),
          1,
        );
        const box = await page.evaluate(() => {
          const main = document.querySelector("#family-content")!;
          const heading = main.querySelector("h1")!.getBoundingClientRect();
          return {
            x: heading.x,
            y: heading.y + scrollY,
            width: main.getBoundingClientRect().width,
          };
        });
        if (geometry)
          assert.deepEqual(
            box,
            geometry,
            "Record titles and content width align",
          );
        geometry = box;
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        assert(
          await page
            .locator("[data-family-heading] nav a")
            .evaluateAll((links) =>
              links.every(
                (link) => getComputedStyle(link).textDecorationLine === "none",
              ),
            ),
          "Record links use one underline style",
        );
        await page.screenshot({
          path: `${output}/${leaf}-${width}-${theme}.png`,
          fullPage: true,
        });
      }
    }
  const names: string[] = [];
  for (const child of [
    { id: parent.learnerId, name: "Avery" },
    { id: second.id, name: "Maya" },
  ]) {
    await page.goto(
      `${fixture.origin}/learners/${child.id}/workbooks/${localDate()}`,
    );
    const button = page.getByRole("button", {
      name: "Download workbook",
      exact: true,
    });
    const download = page.waitForEvent("download");
    await button.click();
    const file = await download;
    assert.equal(await file.failure(), null);
    const history = await (
      await context.request.get(
        `${fixture.origin}/api/v1/learners/${child.id}/workbooks`,
      )
    ).json();
    assert.equal(history.workbooks.length, 1);
    const expected = workbookFilename(history.workbooks[0], child.name, "html");
    assert.equal(file.suggestedFilename(), expected);
    names.push(expected);
    const again = page.waitForEvent("download");
    await button.click();
    assert.equal((await again).suggestedFilename(), expected);
    assert.equal(
      (
        await (
          await context.request.get(
            `${fixture.origin}/api/v1/learners/${child.id}/workbooks`,
          )
        ).json()
      ).workbooks.length,
      1,
      "Downloading again does not create another record",
    );
  }
  assert.notEqual(
    names[0],
    names[1],
    "Two children on the same day have distinct filenames",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS aligned record headers: 18 width/theme/page cases; two distinct child downloads and immutable reprints",
  );
  await context.close();
} finally {
  await browser.close();
  await fixture.close();
}
