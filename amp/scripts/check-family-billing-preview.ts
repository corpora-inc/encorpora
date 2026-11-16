/** Isolated family Today billing links: free, paid and invoice-backed access. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { purchasePreview } from "./purchase-preview-fixture";
const fixture = await purchasePreview(5074);
const browser = await secureChromium(rawChromium).launch();
const output = "/tmp/rebuild-funded-purchase/family-billing";
await mkdir(output, { recursive: true });
try {
  const invoiceParent = fixture.personas.find((p) => p.key === "invoice")!;
  const offers = await fixture.app.inject({
    method: "GET",
    url: "/api/v1/funding/invoice-offers",
  });
  const offer = offers
    .json()
    .offers.find((o: { termMonths: number }) => o.termMonths === 12);
  assert(offer);
  const invoice = await fixture.app.inject({
    method: "POST",
    url: "/api/v1/funding/invoices",
    headers: { origin: fixture.origin },
    payload: {
      offerId: offer.id,
      offerRevision: offer.revision,
      parentEmail: invoiceParent.email,
      studentBillingName: "Casey Example",
      idempotencyKey: randomUUID(),
    },
  });
  assert.equal(invoice.statusCode, 200, invoice.body);
  const claim = await fixture.app.inject({
    method: "POST",
    url: `/api/v1/funding/invoices/${invoice.json().invoiceId}/claim`,
    headers: {
      origin: fixture.origin,
      authorization: `Bearer ${invoiceParent.token}`,
    },
    payload: { learnerId: invoiceParent.learnerId },
  });
  assert.equal(claim.statusCode, 200, claim.body);
  for (const parent of fixture.personas) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const login = await context.request.post(
      `${fixture.origin}/api/auth/sign-in/email`,
      {
        headers: { origin: fixture.origin },
        data: { email: parent.email, password: fixture.password },
      },
    );
    assert.equal(login.status(), 200);
    const places = await (
      await context.request.get(`${fixture.origin}/api/v1/families`)
    ).json();
    const family = places.families.find(
      (f: { role: string }) => f.role === "holder",
    ).familyId;
    const today = `/family/${family}`;
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(fixture.origin + today);
    const billing = page.locator(`[data-child-billing="${parent.learnerId}"]`);
    const label =
      parent.key === "returning"
        ? "Get access"
        : parent.key === "invoice"
          ? "View invoice"
          : "Manage access";
    await billing.filter({ hasText: label }).waitFor();
    assert.equal(await billing.innerText(), label);
    const primary = page.locator(`[data-practice-here="${parent.learnerId}"]`);
    assert.equal(
      await primary.count(),
      1,
      "Practice remains available beside billing",
    );
    for (const theme of ["light", "dark"])
      for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(
          (theme) => document.documentElement.setAttribute("data-theme", theme),
          theme,
        );
        await page.evaluate(() => document.fonts.ready);
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `${parent.key} ${width} overflow`,
        );
        assert(
          (await billing.boundingBox())!.height >= 44,
          "Billing link remains a usable touch target",
        );
        await page.screenshot({
          path: `${output}/${parent.key}-${width}-${theme}.png`,
          fullPage: true,
        });
      }
    await page.setViewportSize({ width: 390, height: 900 });
    await billing.click();
    await page.waitForURL(
      `${fixture.origin}/account/billing${parent.key === "invoice" ? "#funded-invoices-title" : ""}`,
    );
    await page.getByRole("heading", { name: "Billing", exact: true }).waitFor();
    assert.equal(
      await page
        .locator("nav[data-tabs] [data-tab=today]")
        .getAttribute("href"),
      today,
    );
    assert.equal(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("amp.learner")!).state.learnerId,
      ),
      parent.learnerId,
    );
    if (parent.key === "invoice") {
      await page
        .getByRole("heading", { name: "Education-fund invoices", exact: true })
        .waitFor();
      await page
        .getByRole("heading", { name: "Casey Example", exact: true })
        .waitFor();
      assert(
        await page.locator("#funded-invoices-title").evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return rect.bottom > 0 && rect.top < innerHeight;
        }),
        "Invoice link brings its section into the phone viewport",
      );
    }
    await page.goBack();
    await billing.waitFor();
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `PASS ${parent.key}: responsive Today entry, billing destination, family tabs, selected child, Back`,
    );
  }
} finally {
  await browser.close();
  await fixture.close();
}
