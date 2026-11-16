/** One payment choice across existing card and invoice routes, using synthetic accounts. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium as rawChromium, type Page } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { purchasePreview } from "./purchase-preview-fixture";
const fixture = await purchasePreview(
  Number(process.env.AMP_PAYMENT_METHOD_PORT ?? 5086),
);
const browser = await secureChromium(rawChromium).launch();
const output =
  process.env.AMP_PAYMENT_METHOD_OUTPUT ?? "/tmp/amp-payment-method-ui";
await mkdir(output, { recursive: true });
const evidence: string[] = [];
async function selected(page: Page, name: string) {
  const choice = page
    .getByRole("radiogroup", { name: "Plan", exact: true })
    .getByRole("radio", { name: new RegExp(`^${name}`) });
  await choice.waitFor();
  assert.equal(await choice.getAttribute("aria-checked"), "true");
}
async function program(page: Page) {
  await page
    .getByRole("button", { name: "Funding program", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("option", {
      name: "Arizona Empowerment Scholarship Account",
      exact: true,
    })
    .click();
}
async function method(page: Page, name: "Card" | "Education funds (ESA)") {
  const group = page.getByRole("radiogroup", { name: "Payment method" });
  await group.waitFor();
  assert.equal(await group.count(), 1, "one method chooser");
  await group.getByRole("radio", { name, exact: true }).click();
}
try {
  for (const key of ["returning", "paid"]) {
    const parent = fixture.personas.find((entry) => entry.key === key)!;
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
    let learner = parent.learnerId;
    if (key === "paid") {
      const add = await context.request.post(
        fixture.origin + "/api/v1/learners",
        {
          headers: { origin: fixture.origin },
          data: { name: "Maya", birthYear: 2016 },
        },
      );
      assert.equal(add.status(), 201, await add.text());
      learner = (await add.json()).id;
      assert.ok(learner);
    }
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${fixture.origin}/continue/${learner}`);
    await page.getByRole("radiogroup", { name: "Payment method" }).waitFor();
    assert.equal(await page.locator("[data-app-bar='family']").count(), 1);
    await page.getByRole("radio", { name: /^Monthly/ }).click();
    await selected(page, "Monthly");
    await method(page, "Education funds (ESA)");
    await page.waitForURL(/\/purchase\/funded/);
    assert.equal(new URL(page.url()).searchParams.get("learner"), learner);
    assert.equal(new URL(page.url()).searchParams.get("interval"), "month");
    await program(page);
    await selected(page, "Monthly");
    assert.equal(
      await page.getByLabel("Student name on invoice").inputValue(),
      key === "paid" ? "Maya" : "Jordan",
    );
    await page.reload();
    await selected(page, "Monthly");
    await page.getByRole("radio", { name: /^Annual/ }).click();
    await page.reload();
    await selected(page, "Annual");
    await page.getByRole("radio", { name: /^Monthly/ }).click();
    await page.reload();
    await selected(page, "Monthly");
    await method(page, "Card");
    await page.waitForURL(new RegExp(`/continue/${learner}`));
    await selected(page, "Monthly");
    assert.equal(await page.locator("[data-app-bar='family']").count(), 1);
    await page.goBack();
    await selected(page, "Monthly");
    await page.goBack();
    await selected(page, "Monthly");
    assert.match(
      new URL(page.url()).pathname,
      new RegExp(`/continue/${learner}`),
    );
    evidence.push(
      `${key}: chosen learner and monthly plan survive both methods, reload, and Back`,
    );
    if (key === "returning") {
      for (const theme of ["light", "dark"])
        for (const width of [320, 390, 768, 1280]) {
          await page.setViewportSize({ width, height: 900 });
          await page.evaluate(
            (theme) =>
              document.documentElement.setAttribute("data-theme", theme),
            theme,
          );
          await page.evaluate(() => document.fonts.ready);
          assert(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
          );
          await page.screenshot({
            path: `${output}/card-${width}-${theme}.png`,
            fullPage: true,
          });
          await method(page, "Education funds (ESA)");
          await page
            .getByRole("button", { name: "Funding program", exact: true })
            .waitFor();
          assert(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
          );
          await page.screenshot({
            path: `${output}/funds-${width}-${theme}.png`,
            fullPage: true,
          });
          await method(page, "Card");
          await selected(page, "Monthly");
        }
      // In-flight enrollment must not race a new invoice choice.
      let release!: () => void;
      const blocked = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route(
        /\/api\/v1\/billing\/(?:enrollment\/)?checkout$/,
        async (route) => {
          await blocked;
          await route.fulfill({
            status: 503,
            json: { error: "synthetic_unavailable" },
          });
        },
      );
      const started = page.waitForRequest((request) =>
        /\/billing\/(?:enrollment\/)?checkout$/.test(
          new URL(request.url()).pathname,
        ),
      );
      await page
        .getByRole("button", { name: "Continue to Stripe", exact: true })
        .click();
      await started;
      await page.waitForFunction(() =>
        [
          ...document.querySelectorAll<HTMLButtonElement>(
            'button[role="radio"]',
          ),
        ].some(
          (button) =>
            button.textContent?.includes("Education funds") && button.disabled,
        ),
      );
      assert.equal(
        await page
          .getByRole("radio", { name: "Education funds (ESA)" })
          .isDisabled(),
        true,
      );
      release();
    } else {
      // Pending money stays in the existing recovery flow rather than inviting a second purchase.
      await page.route(`**/api/v1/billing/status/${learner}`, (route) =>
        route.fulfill({
          json: {
            learnerId: learner,
            phase: "payment-processing",
            interval: "month",
            tier: "extra",
          },
        }),
      );
      await page.reload();
      await page.getByRole("button", { name: "Check again" }).waitFor();
      assert.equal(
        await page.getByRole("radiogroup", { name: "Payment method" }).count(),
        0,
      );
      evidence.push(
        "processing card payment suppresses a competing invoice purchase",
      );
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  const guest = await browser.newContext();
  const page = await guest.newPage();
  await page.goto(`${fixture.origin}/purchase/funded?interval=month`);
  await method(page, "Card");
  await page.waitForURL(/\/sign-in/);
  assert.equal(
    new URL(page.url()).searchParams.get("next"),
    "/purchase/annual?interval=month",
  );
  evidence.push("guest card sign-in retains selected monthly term");
  await guest.close();
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ passed: evidence, screenshots: output }));
} finally {
  await browser.close();
  await fixture.close();
}
