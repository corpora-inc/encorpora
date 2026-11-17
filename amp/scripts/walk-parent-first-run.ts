/**
 * A brand-new parent's first run, walked in a real browser (founder QA
 * 2026-11-16): choose Parent, add three kids, Back to the question (Parent
 * still the answer, nothing hidden, no Cancel), Forward, remove a kid, Next,
 * Back, rename, the browser's Back and Forward, a refresh at every step, the
 * menu as the way out, and "Go to Today" ending the first run. Screenshots
 * go to artifacts/parent-first-run.
 *
 * Against a running local preview (scripts/design-preview.sh), loopback only:
 *
 *   AMP_PREVIEW_ORIGIN=http://127.0.0.1:4740 npx tsx scripts/walk-parent-first-run.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium, type Page } from "playwright";
import { secureChromium } from "../browser-security.mjs";

const origin = process.env.AMP_PREVIEW_ORIGIN ?? "http://127.0.0.1:4740";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname))
  throw new Error(`The walk is loopback-only: ${origin}`);
const shots = "artifacts/parent-first-run";
await mkdir(shots, { recursive: true });
const chromium = secureChromium(rawChromium);
const browser = await chromium.launch();
const thisYear = new Date().getFullYear();
const log = (line: string) => console.log(`  ✓ ${line}`);

const path = (page: Page) => new URL(page.url()).pathname;
async function heading(page: Page, name: string) {
  await page.getByRole("heading", { name, level: 1 }).waitFor();
}
async function noOverflow(page: Page, where: string) {
  const extra = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  assert.ok(extra <= 0, `${where}: ${extra}px of horizontal overflow`);
}
async function noCancel(page: Page, where: string) {
  assert.equal(
    (await page.getByRole("button", { name: "Cancel", exact: true }).count()) +
      (await page.getByRole("link", { name: "Cancel", exact: true }).count()),
    0,
    `${where}: a Cancel`,
  );
}
const nameField = (page: Page, row: string) =>
  page.getByRole("textbox", { name: new RegExp(`^Name, ${row} `) });
async function chooseYear(page: Page, who: string, year: number) {
  await page
    .getByRole("button", { name: new RegExp(`^Birth year, ${who}`) })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText(String(year), { exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
}
async function setup(page: Page) {
  return page.evaluate(async () => {
    const session = await (await fetch("/api/auth/get-session")).json();
    const me = await (
      await fetch("/api/v1/me", {
        headers: { authorization: `Bearer ${session.session.token}` },
      })
    ).json();
    return {
      setup: me.setup as { persona: string | null; done: boolean },
      kids: (me.learners as { name: string }[]).map((kid) => kid.name),
    };
  });
}
const nameFields = (page: Page) =>
  page.getByRole("textbox", { name: /^Name, / });
async function names(page: Page) {
  return nameFields(page).evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value),
  );
}

const context = await browser.newContext({
  viewport: { width: 390, height: 900 },
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));
const shot = (name: string) =>
  page.screenshot({ path: `${shots}/${name}-390.png`, fullPage: true });

try {
  // A fresh sign-up, as the sign-up page makes it.
  const email = `walk-${randomUUID().slice(0, 8)}@example.com`;
  const signed = await context.request.post(
    `${origin}/api/auth/sign-up/email`,
    {
      headers: { Origin: origin },
      data: {
        email,
        password: "walk parent first run 0123",
        name: "Walk Parent",
      },
    },
  );
  assert.ok(signed.ok(), `sign-up ${signed.status()}`);

  // 1. The question, then Parent.
  await page.goto(`${origin}/start`);
  await heading(page, "What brings you to AMP?");
  await page.getByRole("link", { name: /^I’m a parent/ }).click();
  await page.waitForURL(/\/start\/parent$/);
  await heading(page, "Add your kids");
  log("Parent opens /start/parent");

  // 2. Three kids: each is saved when its year is chosen.
  await nameField(page, "Child 1").fill("Ada");
  await chooseYear(page, "Ada", thisYear - 9);
  await page.getByRole("button", { name: "Add another child" }).click();
  await nameField(page, "Child 2").fill("Ben");
  await chooseYear(page, "Ben", thisYear - 7);
  await page.getByRole("button", { name: "Add another child" }).click();
  await nameField(page, "Child 3").fill("Cy");
  await chooseYear(page, "Cy", thisYear - 5);
  await rows(3);
  await expectKids(["Ada", "Ben", "Cy"]);
  assert.deepEqual((await setup(page)).setup, {
    persona: "parent",
    done: false,
  });
  await noOverflow(page, "kids");
  await noCancel(page, "kids");
  await shot("kids");
  log("three kids saved as their years were chosen; first run not done");

  // 3. In-page Back: the question again, Parent the current answer.
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await page.waitForURL(/\/start$/);
  await heading(page, "What brings you to AMP?");
  await page.locator('[data-choice="parent"][aria-current="true"]').waitFor();
  assert.equal(
    await page.getByRole("heading", { name: "Add a place" }).count(),
    0,
  );
  await noCancel(page, "start");
  await shot("start-after-kids");
  await page.reload();
  await page.locator('[data-choice="parent"][aria-current="true"]').waitFor();
  log("Back shows the question with Parent current, also after a refresh");

  // 4. Forward: the kids are all there.
  // In-page Back was the browser's Back, so Forward is the kids step.
  await page.goForward();
  await page.waitForURL(/\/start\/parent$/);
  await heading(page, "Add your kids");
  await rows(3);
  assert.deepEqual(await names(page), ["Ada", "Ben", "Cy"]);
  log("Forward returns to the kids, all three");

  // 5. Remove a saved kid.
  await page.getByRole("button", { name: "Remove Cy" }).click();
  await rows(2);
  await expectKids(["Ada", "Ben"]);
  log("a saved kid is removed");

  // 6. Next: who practices first; refresh keeps it.
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.waitForURL(/\/start\/parent\/ready$/);
  await heading(page, "Who’s practicing first?");
  await page.reload();
  await heading(page, "Who’s practicing first?");
  await page.getByRole("button", { name: /^Ada/ }).waitFor();
  await page.getByRole("button", { name: /^Ben/ }).waitFor();
  await noOverflow(page, "ready");
  await noCancel(page, "ready");
  await shot("ready");
  log("Next opens /start/parent/ready; refresh keeps it");

  // 7. In-page Back, rename, and the change shows forward.
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await page.waitForURL(/\/start\/parent$/);
  await heading(page, "Add your kids");
  assert.ok(
    await page.getByRole("button", { name: "Remove Ben" }).isVisible(),
    "saved kids stay removable after Next",
  );
  await nameField(page, "Child 2").fill("Benji");
  await nameField(page, "Child 2").blur();
  await expectKids(["Ada", "Benji"]);
  await page.reload();
  await rows(2);
  assert.deepEqual(await names(page), ["Ada", "Benji"]);
  log("Back from ready edits the kids; a rename saves and survives refresh");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.waitForURL(/\/start\/parent\/ready$/);
  await page.getByRole("button", { name: /^Benji/ }).waitFor();
  log("the rename shows on who practices first");

  // 8. The browser's own Back and Forward, one step each.
  await page.goBack();
  await page.waitForURL(/\/start\/parent$/);
  await heading(page, "Add your kids");
  await page.goForward();
  await page.waitForURL(/\/start\/parent\/ready$/);
  await heading(page, "Who’s practicing first?");
  log("browser Back and Forward move one step");

  // 9. The menu is the way out, to a screen that says where they are.
  // The brand opens the menu; its places are the way out.
  await page.getByRole("button", { name: "Open AMP menu" }).click();
  await page.getByRole("button", { name: /^Your places/ }).click();
  const places = page.getByRole("menuitem");
  await places.first().waitFor();
  console.log(
    `    places: ${(await places.allTextContents()).map((t) => t.trim()).join(" | ")}`,
  );
  await shot("menu");
  await places.filter({ hasNotText: "Add a place" }).first().click();
  await page.waitForURL((url) => !url.pathname.startsWith("/start"));
  await page
    .getByRole("navigation", { name: "Setup" })
    .waitFor({ state: "detached" });
  await page.locator("h1").first().waitFor();
  console.log(
    `    the menu leads to ${path(page)}: ${await page.locator("h1").first().textContent()}`,
  );
  await noOverflow(page, "exit");
  await shot("exit");
  assert.equal((await setup(page)).setup.done, false);
  await page.goto(`${origin}/start`);
  await heading(page, "What brings you to AMP?");
  await page.locator('[data-choice="parent"][aria-current="true"]').waitFor();
  log(
    "leaving by the menu keeps the first run open: /start is still the question",
  );

  // 10. Go to Today ends the first run; /start then adds a place.
  await page.goto(`${origin}/start/parent/ready`);
  await page.getByRole("button", { name: "Go to Today" }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/family"));
  assert.deepEqual((await setup(page)).setup, {
    persona: "parent",
    done: true,
  });
  await page.goto(`${origin}/start`);
  await heading(page, "Add a place");
  assert.equal(
    await page.locator('[data-choice="parent"]').count(),
    0,
    "a parent is never offered I'm a parent",
  );
  log("Go to Today ends the first run; /start then adds a place");

  // Every step at the other widths, light and dark.
  const state = await context.storageState();
  for (const width of [320, 768, 1280])
    for (const theme of ["light", "dark"] as const) {
      const other = await browser.newContext({
        storageState: state,
        viewport: { width, height: 900 },
        colorScheme: theme,
      });
      const view = await other.newPage();
      for (const [name, url, title] of [
        ["start", "/start", "Add a place"],
        ["kids", "/start/parent", "Add your kids"],
        ["ready", "/start/parent/ready", "Who’s practicing first?"],
      ] as const) {
        await view.goto(`${origin}${url}`);
        await heading(view, title);
        await view.waitForTimeout(300);
        await noOverflow(view, `${name} ${width} ${theme}`);
        await view.screenshot({
          path: `${shots}/${name}-${width}-${theme}.png`,
          fullPage: true,
        });
      }
      await other.close();
    }
  log("each step at 320, 768 and 1280 px, light and dark: no overflow");

  assert.deepEqual(errors, []);
  console.log("parent first run: all steps passed");
} catch (failure) {
  await page
    .screenshot({ path: `${shots}/failure-390.png`, fullPage: true })
    .catch(() => undefined);
  console.error(`failed at ${page.url()}; page errors: ${errors.join(" | ")}`);
  throw failure;
} finally {
  await browser.close();
}

async function rows(count: number) {
  for (let i = 0; i < 100 && (await nameFields(page).count()) !== count; i++)
    await page.waitForTimeout(150);
  assert.equal(await nameFields(page).count(), count, "kid rows");
}
async function expectKids(expected: string[]) {
  for (let i = 0; i < 40; i++) {
    if (JSON.stringify((await setup(page)).kids) === JSON.stringify(expected))
      return;
    await page.waitForTimeout(150);
  }
  assert.deepEqual((await setup(page)).kids, expected);
}
