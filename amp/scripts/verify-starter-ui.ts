/**
 * "What brings you to AMP?" → "I'm learning for myself": the birth-year grid,
 * the note for a learner under 13 with the parent's way in one tap away, and
 * practice that starts where the year puts it. At 320, 390, 768 and 1280 px,
 * light and dark: no horizontal overflow, and nothing moves as a year is
 * chosen. Screenshots go to artifacts/starter-ui.
 *
 *   AMP_TEST_DATABASE_URL=postgres://…/amp_starter_ui \
 *     npx tsx scripts/verify-starter-ui.ts [--port 4600]
 */
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium, type Page } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { startShellFixture } from "./app-shell-fixture";
import { resetRecord, settle, shellRecord } from "./app-shell-probe";

const chromium = secureChromium(rawChromium);
const at = process.argv.indexOf("--port");
const port = at > 0 ? Number(process.argv[at + 1]) : 4600;
const shots = "artifacts/starter-ui";
await mkdir(shots, { recursive: true });
const failures: string[] = [];
const check = (label: string, ok: boolean, detail: unknown = "") => {
  if (!ok) failures.push(`${label}: ${JSON.stringify(detail)}`);
};
const thisYear = new Date().getFullYear();
const f = await startShellFixture({ webPort: port });
const browser = await chromium.launch();

async function myself(page: Page) {
  await page.goto(`${f.origin}/start`);
  await page
    .getByRole("heading", { name: "What brings you to AMP?" })
    .waitFor();
  await page.getByRole("link", { name: /^I’m learning for myself/ }).click();
  await page.waitForURL(/\/start\/myself$/);
  await page
    .getByRole("heading", { name: "What year were you born?" })
    .waitFor();
  await settle(page);
}
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

try {
  for (const width of [320, 390, 768, 1280])
    for (const theme of ["light", "dark"] as const) {
      const tag = `${width} ${theme}`;
      const shot = (name: string) =>
        page.screenshot({
          path: `${shots}/${name}-${width}-${theme}.png`,
          // A phone shows what's on its screen: the question in view.
          fullPage: width >= 768,
        });
      const context = await f.context(browser, "new", {
        viewport: { width, height: 900 },
        colorScheme: theme,
      });
      const page = await context.newPage();
      await myself(page);
      await shot("myself");
      check(
        `${tag} the action waits for a year`,
        !(await page
          .getByRole("button", { name: "Start practicing" })
          .isEnabled()),
      );
      await resetRecord(page);
      await page.getByRole("radio", { name: String(thisYear - 10) }).click();
      await page.getByRole("button", { name: "Set up as a parent" }).waitFor();
      await page.getByText(/^Under 13, a parent sets up AMP for you/).waitFor();
      await settle(page);
      await shot("myself-under-13");
      await page.getByRole("radio", { name: "Adult", exact: true }).click();
      await page.getByRole("button", { name: "Start practicing" }).waitFor();
      await settle(page);
      await shot("myself-adult");
      const record = await shellRecord(page);
      check(
        `${tag} nothing moves as a year is chosen`,
        record.shifts.length === 0 && record.cls === 0,
        record,
      );
      check(`${tag} no horizontal overflow`, (await overflow(page)) <= 0);
      await context.close();
    }

  // Under 13: the parent's way in is one tap.
  {
    const context = await f.context(browser, "new", {
      viewport: { width: 390, height: 900 },
    });
    const page = await context.newPage();
    await myself(page);
    await page.getByRole("radio", { name: String(thisYear - 9) }).click();
    await page.getByRole("button", { name: "Set up as a parent" }).click();
    await page.waitForURL(/\/start\/parent$/);
    await page.getByRole("heading", { name: "Your children" }).waitFor();
    await context.close();
  }

  // Last, since the account then has its own practice: an adult starts at
  // the top of the scale.
  for (const theme of ["light", "dark"] as const) {
    const context = await f.context(browser, "new", {
      viewport: { width: 390, height: 900 },
      colorScheme: theme,
    });
    const page = await context.newPage();
    await myself(page);
    await page.getByRole("radio", { name: "Adult", exact: true }).click();
    await page.getByRole("button", { name: "Start practicing" }).click();
    await page.waitForURL(/\/me$/);
    await page.getByText("Began at Precalculus", { exact: true }).waitFor();
    await settle(page);
    await page.screenshot({ path: `${shots}/me-390-${theme}.png` });
    // The first problem is at that level, not a first-grade fact.
    await page.goto(`${f.origin}/practice`);
    await page.locator("[data-problem-id]").first().waitFor();
    await settle(page);
    await page.screenshot({ path: `${shots}/first-problem-390-${theme}.png` });
    await context.close();
  }
} finally {
  await browser.close();
  await f.close();
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`starter UI: ok (${shots})`);
process.exit(0);
