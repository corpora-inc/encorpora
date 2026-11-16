/** Synthetic invoice recovery and child handoff; no mail or payment leaves loopback. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { purchasePreview } from "./purchase-preview-fixture";
const fixture = await purchasePreview(5094);
const browser = await secureChromium(rawChromium).launch();
const output = "/tmp/rebuild-funded-purchase/active-invoice";
await mkdir(output, { recursive: true });
try {
  const parent = fixture.personas.find((person) => person.key === "invoice")!;
  const context = await browser.newContext({
    viewport: { width: 390, height: 900 },
  });
  const login = await context.request.post(
    `${fixture.origin}/api/auth/sign-in/email`,
    {
      headers: { origin: fixture.origin },
      data: { email: parent.email, password: fixture.password },
    },
  );
  assert.equal(login.status(), 200);
  const offers = (
    await fixture.app.inject("/api/v1/funding/invoice-offers")
  ).json().offers;
  const annual = offers.find(
    (offer: { termMonths: number }) => offer.termMonths === 12,
  );
  const sibling = await fixture.app.inject({
    method: "POST",
    url: "/api/v1/funding/invoices",
    headers: { origin: fixture.origin },
    payload: {
      offerId: annual.id,
      offerRevision: annual.revision,
      parentEmail: parent.email,
      studentBillingName: "Riley Example",
      idempotencyKey: randomUUID(),
    },
  });
  assert.equal(sibling.statusCode, 200);
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    `${fixture.origin}/purchase/funded?program=az-esa&learner=${parent.learnerId}`,
  );
  await page.getByRole("heading", { name: "New invoice for Casey" }).waitFor();
  assert.equal(
    await page.getByText("Riley Example", { exact: true }).count(),
    0,
  );
  await page.getByRole("radio", { name: /Monthly/ }).click();
  await page.getByLabel("Student name on invoice").fill("Casey Example");
  await page
    .getByRole("button", { name: "Get invoice & start learning" })
    .click();
  await page.waitForURL((url) => !!url.searchParams.get("invoice"));
  await page
    .getByRole("heading", { name: "Invoice for Casey Example", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Start learning", exact: true })
    .waitFor();
  const activeUrl = page.url();
  const id = new URL(activeUrl).searchParams.get("invoice")!;
  assert.equal(
    new URL(activeUrl).searchParams.get("learner"),
    parent.learnerId,
  );
  assert.equal(new URL(activeUrl).searchParams.get("program"), "az-esa");
  assert.equal(
    await page.getByText("Riley Example", { exact: true }).count(),
    0,
  );
  await page.getByText(/Sending a copy to/).waitFor();
  await fixture.db.query(
    "UPDATE amp_funding_invoice_outbox SET accepted_at=now(),receipt='synthetic' WHERE invoice_id=$1",
    [id],
  );
  await page.getByText(/Invoice emailed to/).waitFor();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download invoice PDF" }).click();
  const pdf = await download;
  await pdf.saveAs(`${output}/active-invoice.pdf`);
  assert.equal(await pdf.failure(), null);
  await page.getByRole("button", { name: "I’ve submitted it" }).click();
  await page
    .getByRole("heading", { name: "Submitted · awaiting payment" })
    .waitFor();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: `${output}/submitted-${width}.png`,
      fullPage: true,
    });
  }
  const batches: string[] = [];
  page.on("response", (response) => {
    const path = new URL(response.url()).pathname;
    if (response.ok() && /\/learners\/[^/]+\/batches$/.test(path))
      batches.push(path.split("/").at(-2)!);
  });
  await page
    .getByRole("button", { name: "Start learning", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Skip this problem and see its answer" })
    .waitFor();
  assert.equal(
    await page.evaluate(() => history.state.ampFamilyPractice?.learnerId),
    parent.learnerId,
  );
  assert(
    batches.length > 0 && batches.every((child) => child === parent.learnerId),
  );
  await page.goBack();
  await page.waitForURL(activeUrl);
  await page
    .getByRole("heading", { name: "Invoice for Casey Example", exact: true })
    .waitFor();
  await page
    .getByRole("heading", { name: "Submitted · awaiting payment" })
    .waitFor();
  assert.equal(
    await page.getByRole("heading", { name: /New invoice/ }).count(),
    0,
  );
  assert.equal(
    await page.evaluate(() => !!sessionStorage.getItem("amp.student")),
    false,
  );
  await page.goForward();
  await page
    .getByRole("button", { name: "Skip this problem and see its answer" })
    .waitFor();
  assert.equal(
    await page.evaluate(() => history.state.ampFamilyPractice?.learnerId),
    parent.learnerId,
  );
  await page.goBack();
  await page
    .getByRole("heading", { name: "Submitted · awaiting payment" })
    .waitFor();
  await fixture.db.query(
    "UPDATE amp_funding_invoice_outbox SET accepted_at=NULL,stopped_at=now(),stopped_reason='provider-rejected' WHERE invoice_id=$1",
    [id],
  );
  await page.reload();
  await page.getByText(/The email couldn’t be sent/).waitFor();
  await page.goto(`${activeUrl}&learner=not-this-child`);
  await page
    .getByRole("heading", { name: "Invoice for Casey Example", exact: true })
    .waitFor();
  const other = await browser.newContext();
  const otherParent = fixture.personas.find(
    (person) => person.key === "returning",
  )!;
  assert.equal(
    (
      await other.request.post(`${fixture.origin}/api/auth/sign-in/email`, {
        headers: { origin: fixture.origin },
        data: { email: otherParent.email, password: fixture.password },
      })
    ).status(),
    200,
  );
  const otherPage = await other.newPage();
  await otherPage.goto(activeUrl);
  await otherPage
    .getByRole("alert")
    .filter({ hasText: /isn’t available to this account/ })
    .waitFor();
  assert.equal(
    await otherPage
      .getByRole("heading", { name: /New invoice|Invoice for Casey/ })
      .count(),
    0,
  );
  await other.close();
  await page.getByRole("button", { name: "Create another invoice" }).click();
  await page.getByRole("heading", { name: "New invoice for Casey" }).waitFor();
  assert.equal(new URL(page.url()).searchParams.has("invoice"), false);
  const prepared = await fixture.app.inject({
    method: "POST",
    url: "/api/v1/funding/invoices",
    headers: { origin: fixture.origin },
    payload: {
      offerId: annual.id,
      offerRevision: annual.revision,
      parentEmail: parent.email,
      studentBillingName: "Casey Example",
      idempotencyKey: randomUUID(),
    },
  });
  assert.equal(prepared.statusCode, 200);
  const preparedId = prepared.json().invoiceId;
  await page.goto(
    `${fixture.origin}/purchase/funded?invoice=${preparedId}&learner=${parent.learnerId}`,
  );
  await page
    .getByRole("button", { name: "Start learning", exact: true })
    .waitFor();
  const claimed = await context.request.get(
    `${fixture.origin}/api/v1/funding/requests/${preparedId}`,
  );
  assert.equal(claimed.status(), 200);
  assert.equal((await claimed.json()).learnerId, parent.learnerId);
  await page.goto(`${fixture.origin}/purchase/funded?invoice=invalid-id`);
  await page
    .getByRole("alert")
    .filter({ hasText: /invoice link is invalid/ })
    .waitFor();
  assert.equal(
    await page.getByRole("heading", { name: /New invoice/ }).count(),
    0,
  );
  await page.getByRole("link", { name: /Billing/ }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: active-child invoice, email statuses, PDF, submission, reload, exact-child browser Back/Forward, account isolation, no sibling history, 3 widths.",
  );
} finally {
  await browser.close();
  await fixture.close();
}
