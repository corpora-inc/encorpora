import { secureChromium } from "../browser-security.mjs";
import { fixtureMe } from "./me-fixture";
import { choose } from "./ui-controls";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { chromium as rawChromium, webkit } from "playwright";
const chromium = secureChromium(rawChromium);
import { createServer } from "vite";
import { loadReimbursementPrograms } from "../src/billing/evidence/reimbursement-config.js";
import { paymentPdf } from "../src/billing/evidence/pdf.js";
import { syntheticPaymentRecord as record } from "../tests/payment-evidence-fixtures.js";
import { retentionNotice } from "../src/family/contracts.js";
import { assertPhoneLandscapeSmoke, isPhoneLandscape } from "./ui-viewports";
const programs = process.env.AMP_REIMBURSEMENT_REVIEW_CONFIG
  ? await loadReimbursementPrograms(process.env.AMP_REIMBURSEMENT_REVIEW_CONFIG)
  : [
      {
        id: "fixture-program",
        state: "AZ",
        programName: "Synthetic education program",
        officialUrl: "https://example.test/reimbursement",
        requiredFields: [
          "sellerName",
          "sellerAddress",
          "purchaseDate",
          "product",
          "licenseTerm",
          "amountPaid",
          "paymentMethod",
          "learnerName",
        ],
      },
    ];
const engine = process.env.AMP_BROWSER === "webkit" ? webkit : chromium;
const directory = new URL(
  `../artifacts/payment-review-${process.env.AMP_BROWSER ?? "chromium"}/`,
  import.meta.url,
);
await mkdir(directory, { recursive: true });
const stressRecord = structuredClone(record);
stressRecord.id = "45f7a892-5428-4320-9d61-b42e813cb573";
const long = (prefix: string, length: number) =>
  prefix +
  " extensive reviewed description".repeat(20).slice(0, length - prefix.length);
const profile = stressRecord.baseline!.profile;
profile.seller.legalName = long("Synthetic seller", 180);
profile.seller.address = Array.from({ length: 5 }, (_, index) =>
  long(`Address ${index + 1}`, 180),
);
profile.product.title = long("Synthetic annual product", 180);
profile.product.description = long("Description", 180);
profile.sku = "s".repeat(180);
profile.seller.supportUrl = "https://example.test/" + "s".repeat(270);
profile.seller.privacyUrl = "https://example.test/" + "p".repeat(270);
stressRecord.observations.at(-1)!.refunds = Array.from(
  { length: 100 },
  (_, index) => ({
    id: `re_stress_${index}`,
    chargeId: "ch_synthetic",
    amountMinor: 100,
    currency: "usd" as const,
    created: 1792141200 + index,
    status: index % 2 ? ("pending" as const) : ("succeeded" as const),
  }),
);
stressRecord.successfulRefundMinor = 5000;
stressRecord.netPaidMinor = 7000;
const stressPdf = await paymentPdf(stressRecord);
const pdf = await paymentPdf(record),
  adjustment = await paymentPdf(record, record.observations[2]!.id);
for (const [name, bytes] of [
  ["payment", pdf],
  ["adjustment", adjustment],
  ["many-refunds", stressPdf],
] as const) {
  const path = new URL(`${name}.pdf`, directory).pathname;
  await writeFile(path, bytes);
  const info = execFileSync("pdfinfo", [path], { encoding: "utf8" });
  const pageCount = Number(/Pages:\s+(\d+)/.exec(info)?.[1]);
  assert.ok(pageCount >= 1 && pageCount <= 30);
  if (name === "many-refunds") assert.ok(pageCount > 3);
  execFileSync("pdftotext", [
    "-layout",
    path,
    new URL(`${name}.txt`, directory).pathname,
  ]);
  const text = await readFile(new URL(`${name}.txt`, directory), "utf8");
  for (const expected of [
    "TEST PAYMENT",
    "NO MONEY MOVED",
    ...(name === "many-refunds"
      ? ["Synthetic seller", "re_stress_99", "$70.00"]
      : ["Synthetic Éducation Company"]),
    "$111.11",
    "$8.89",
    "$120.00",
    name === "many-refunds" ? stressRecord.id : record.id,
    "learner-synthetic-reference",
    "UTC",
    "Jan 1, 2026",
    "Jan 1, 2027",
  ])
    assert.ok(text.includes(expected), `Missing ${expected} in ${name}`);
  if (name === "adjustment") {
    assert.ok(text.includes("succeeded to failed"));
    assert.ok(text.includes("$30.00"));
  }
  const boxes = execFileSync("pdftotext", ["-bbox", path, "-"], {
    encoding: "utf8",
  });
  for (const match of boxes.matchAll(
    /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)"/g,
  )) {
    const [, x0, y0, x1, y1] = match.map(Number);
    assert.ok(
      x0! >= 47 && x1! <= 565 && y0! >= 20 && y1! <= 770,
      `${name} text bounds ${match[0]}`,
    );
  }
  execFileSync("pdftoppm", [
    "-scale-to",
    "1200",
    "-png",
    path,
    new URL(name, directory).pathname,
  ]);
}
// The receipts, in the real app: Billing's Receipts (features/account),
// against synthetic account and payment responses.
const port = Number(process.env.AMP_PAYMENT_UI_PORT ?? 4356);
const origin = `http://127.0.0.1:${port}`;
const vite = await createServer({
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  cacheDir: new URL("vite-cache/", directory).pathname,
  server: { host: "127.0.0.1", port, strictPort: true, hmr: false },
});
await vite.listen();
const browser = await engine.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 },
    acceptDownloads: true,
    // The sheet lands without its slide, so it is measured where it rests.
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  const summary = {
    id: record.id,
    status: record.status,
    productTitle: record.baseline!.profile.product.title,
    paidAt: record.baseline!.paidAt,
    paidMinor: 12000,
    netPaidMinor: 12000,
    observedAt: record.observedAt,
    testMode: true,
    adjustments: record.observations
      .slice(1)
      .map((item) => ({ id: item.id, observedAt: item.observedAt })),
  };
  let mode: "records" | "review" | "empty" | "error" = "records";
  const user = {
    id: "payment-fixture",
    name: "Sample parent",
    email: "parent@example.test",
    emailVerified: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  const me = fixtureMe(
    {
      consent: {
        status: "not-recorded",
        policyVersion: null,
        recordedAt: null,
        withdrawnAt: null,
      },
      learners: [],
      retained: retentionNotice,
    },
    "amp|payment-fixture",
  );
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/events" || path === "/api/v1/events/context")
      return route.fulfill({ status: 204, body: "" });
    if (path === "/api/v1/auth-config")
      return route.fulfill({
        json: { mode: "accounts", passwords: true, providers: [] },
      });
    if (path === "/api/auth/get-session")
      return route.fulfill({
        json: {
          user,
          session: {
            id: "session-fixture",
            token: "synthetic-token",
            userId: user.id,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            expiresAt: "2099-01-01T00:00:00.000Z",
          },
        },
      });
    if (path === "/api/v1/me") return route.fulfill({ json: me });
    if (path === "/api/v1/families")
      return route.fulfill({ json: { families: [], next: null } });
    if (path === "/api/v1/payments/reimbursement-programs")
      return route.fulfill({ json: { programs } });
    if (path.endsWith(".pdf")) {
      const details = request.method() === "POST" ? request.postDataJSON() : {};
      if (details.programId && !details.learnerName?.trim())
        return route.fulfill({
          status: 400,
          json: { error: "receipt_learner_name_required" },
        });
      return route.fulfill({
        contentType: "application/pdf",
        body: Buffer.from(
          await paymentPdf(record, undefined, details.learnerName),
        ),
      });
    }
    if (path === "/api/v1/payments")
      return route.fulfill(
        mode === "error"
          ? { status: 503, json: { error: "unavailable" } }
          : {
              json: {
                records:
                  mode === "empty"
                    ? []
                    : [
                        {
                          ...summary,
                          status: mode === "review" ? "review" : "verified",
                        },
                      ],
                nextCursor: null,
              },
            },
      );
    return route.fulfill({ json: {} });
  });
  const billing = `${origin}/account/billing`;
  /** Billing, with its receipts open. */
  async function receipts() {
    await page.goto(billing);
    // Billing's Receipts fold (ui/Disclosure); the account remembers it
    // open (features/account/panels.ts), so open it only when closed.
    const fold = page.locator("details").filter({
      has: page.locator(":scope > summary", { hasText: "Receipts" }),
    });
    await fold.waitFor();
    if (!(await fold.evaluate((node) => (node as HTMLDetailsElement).open)))
      await fold.locator(":scope > summary").click();
  }
  const item = () =>
    page.getByRole("button", {
      name: new RegExp(summary.productTitle.slice(0, 12)),
    });
  async function shot(name: string) {
    await page.screenshot({
      path: new URL(`${name}.png`, directory).pathname,
      fullPage: true,
    });
    if (isPhoneLandscape(page.viewportSize()!))
      return assertPhoneLandscapeSmoke(page, name);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `${name} scrolls sideways`,
    );
    for (const button of await page
      .getByRole("button", { name: /Download receipt|Download refund receipt/ })
      .all()) {
      const box = await button.boundingBox();
      assert.ok(box && box.height >= 44, `${name} download target`);
    }
  }
  for (const size of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 1024, height: 768 },
    { width: 844, height: 390 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(size);
    await receipts();
    await item().first().waitFor();
    await shot(`list-${size.width}`);
    await item().first().click();
    const download = page.getByRole("button", { name: "Download receipt" });
    await download.waitFor();
    await shot(`detail-${size.width}`);
    const saved = page.waitForEvent("download");
    await download.click();
    assert.match((await saved).suggestedFilename(), /^receipt-.*\.pdf$/);
    await page
      .getByRole("status")
      .filter({ hasText: "Your PDF is ready" })
      .waitFor();
  }
  // A program that needs the learner's name: asked for inline, then printed.
  for (const size of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(size);
    await receipts();
    await item().first().click();
    await page.getByText("Add details for reimbursement").click();
    await choose(
      page.getByRole("button", { name: "Reimbursement program (optional)" }),
      programs[0]!.id,
    );
    await page.getByRole("button", { name: "Download receipt" }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Enter the learner name required by your program." })
      .waitFor();
    await page
      .getByRole("textbox", { name: /Learner name/ })
      .fill("Élodie Muñoz");
    await page.getByRole("alert").waitFor({ state: "detached" });
    await shot(`receipt-details-${size.width}`);
    const saved = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download receipt" }).click();
    const named = await saved;
    const path = new URL(`named-receipt-${size.width}.pdf`, directory).pathname;
    await named.saveAs(path);
    assert.ok(
      execFileSync("pdftotext", [path, "-"], { encoding: "utf8" }).includes(
        "Élodie Muñoz",
      ),
    );
    await page.getByRole("textbox", { name: /Learner name/ }).fill("测试");
    await page.getByRole("button", { name: "Download receipt" }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "basic Latin letters" })
      .waitFor();
  }
  // A payment still being checked offers no download; none, and a failed
  // read, say so in place.
  await page.setViewportSize({ width: 390, height: 844 });
  mode = "review";
  await receipts();
  await item().first().click();
  await page
    .getByText("Your payment is being checked.", { exact: false })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Download receipt" }).count(),
    0,
  );
  await shot("review");
  mode = "empty";
  await receipts();
  await page
    .getByText("No receipts yet. Your card payments will appear here.")
    .waitFor();
  await shot("empty");
  mode = "error";
  await receipts();
  await page
    .getByRole("alert")
    .filter({ hasText: "Receipts couldn’t be loaded." })
    .waitFor();
  await shot("error");
  mode = "records";
  await page.getByRole("button", { name: "Try again" }).click();
  await item().first().waitFor();
  // Larger text keeps the receipt readable at 320 px.
  await page.setViewportSize({ width: 320, height: 568 });
  await receipts();
  await item().first().click();
  await page.getByRole("button", { name: "Download receipt" }).waitFor();
  await page.addStyleTag({ content: "html { font-size: 125%; }" });
  await shot("detail-125-percent");
  assert.deepEqual(failures, []);
  console.log(
    "Receipts: PDF text/raster proof, Billing's list and detail, reimbursement name, review, empty and error passed.",
  );
} finally {
  await browser.close();
  await vite.close();
}
