import { choose } from "./ui-controls";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { chromium, webkit } from "playwright";
import { createServer } from "vite";
import { loadReimbursementPrograms } from "../src/billing/evidence/reimbursement-config.js";
import { paymentPdf } from "../src/billing/evidence/pdf.js";
import { syntheticPaymentRecord as record } from "../tests/payment-evidence-fixtures.js";
import { retentionNotice } from "../src/family/contracts.js";
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
await writeFile(
  new URL("index.html", directory),
  '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment proof</title><div id="root"></div><script type="module" src="./entry.tsx"></script></html>',
);
await writeFile(
  new URL("entry.tsx", directory),
  `import React,{useEffect} from 'react';import{MemoryRouter,useNavigate,useLocation}from'react-router-dom';import{useLearnerStore}from'../../src/web/learner-store';import{createRoot}from'react-dom/client';import{FamilyCenter}from'../../src/web/FamilyCenter';import{ChooseHowToPay}from'../../src/web/ChooseHowToPay';import'../../src/web/theme.css';import{PaymentHistoryCenter}from'../../src/web/PaymentHistoryCenter';import'../../src/web/style.css';const root=createRoot(document.getElementById('root'));function FamilyFixture(){const navigate=useNavigate(),location=useLocation();useEffect(()=>{useLearnerStore.getState().setIdentity('parent');fetch('/api/v1/family').then(r=>r.json()).then(s=>useLearnerStore.getState().acceptFamily(s))},[]);return <FamilyCenter token="parent" identity="parent" initialSection="access" onSectionChange={s=>navigate('/family/'+s)} onChanged={s=>useLearnerStore.getState().acceptFamily(s)} onLearningInvalidated={()=>{}} onClose={()=>{}}/>}const harness={pay(){root.render(<div className="shell purchase-shell"><ChooseHowToPay token="parent" learnerName={null} onCard={()=>harness.render()} onFunds={()=>{}} onClose={()=>{}}/></div>);},render(identity='parent',token=identity){root.render(<React.StrictMode><PaymentHistoryCenter token={token} identity={identity} onClose={()=>root.render(<h1>Family screen</h1>)}/></React.StrictMode>);},family(){root.render(<MemoryRouter initialEntries={["/family/access"]}><FamilyFixture/></MemoryRouter>);},unmount(){root.render(<h1>Other screen</h1>)}};(window as any).paymentHarness=harness;harness.render();`,
);
const vite = await createServer({
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: { host: "127.0.0.1", port: 4356, strictPort: true },
});
await vite.listen();
const browser = await engine.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 320, height: 568 },
    acceptDownloads: true,
  });
  page.setDefaultTimeout(10000);
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  const summary = {
    id: record.id,
    learnerReference: record.learnerReference,
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
  let mode = "records",
    hold = false,
    entered!: () => void,
    release!: () => void;
  let held = Promise.resolve();
  await page.route("**/api/v1/payments*", async (route) => {
    if (hold) {
      entered();
      await held;
    }
    const other = route.request().headers().authorization === "Bearer other";
    await route.fulfill({
      status: mode === "error" ? 503 : 200,
      json:
        mode === "error"
          ? { error: "unavailable" }
          : {
              records:
                other || mode === "empty"
                  ? []
                  : [
                      {
                        ...summary,
                        status: mode === "review" ? "review" : "verified",
                      },
                    ],
              nextCursor: null,
            },
    });
  });
  await page.route("**/api/v1/payments/reimbursement-programs", (route) =>
    route.fulfill({ json: { programs } }),
  );
  await page.route("**/api/v1/billing/offer", (route) =>
    route.fulfill({
      json: {
        available: true,
        offer: { formattedAmount: "Synthetic price", amountMinor: 12000 },
      },
    }),
  );
  await page.route("**/api/v1/funding/offers", (route) =>
    route.fulfill({ json: { offers: [] } }),
  );
  await page.route("**/api/v1/payments/**/*.pdf", async (route) => {
    const details =
      route.request().method() === "POST" ? route.request().postDataJSON() : {};
    if (details.programId && !details.learnerName?.trim())
      return route.fulfill({
        status: 400,
        json: { error: "receipt_learner_name_required" },
      });
    await route.fulfill({
      contentType: "application/pdf",
      body: Buffer.from(
        await paymentPdf(record, undefined, details.learnerName),
      ),
    });
  });
  let familyLearners = [
    {
      id: "child",
      name: "Synthetic learner",
      deletedAt: null as string | null,
      access: [],
      stripeLinked: false,
    },
  ];
  await page.route("**/api/v1/family", (route) =>
    route.fulfill({
      json: {
        consent: {
          status: "withdrawn",
          policyVersion: "fixture",
          recordedAt: null,
          withdrawnAt: "2026-01-01",
        },
        learners: familyLearners,
        retained: retentionNotice,
      },
    }),
  );
  const url = `http://127.0.0.1:4356/artifacts/payment-review-${process.env.AMP_BROWSER ?? "chromium"}/index.html`;
  async function shot(name: string) {
    await page.screenshot({ path: new URL(`${name}.png`, directory).pathname });
    assert.equal(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth > innerWidth ||
          document.documentElement.scrollHeight > innerHeight,
      ),
      false,
      `${name} document overflow`,
    );
    for (const button of await page
      .locator(".payment-history header button,.payment-history footer button")
      .all()) {
      const box = await button.boundingBox();
      assert.ok(
        box &&
          box.height >= 44 &&
          box.y >= 0 &&
          box.y + box.height <= page.viewportSize()!.height,
        `${name} primary action bounds`,
      );
    }
  }
  for (const size of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(size);
    await page.goto(url);
    await page.getByRole("button", { name: /AMP annual/ }).waitFor();
    await shot(`list-${size.width}`);
    await page.getByRole("button", { name: /AMP annual/ }).click();
    await page.getByRole("button", { name: "Download payment PDF" }).waitFor();
    await shot(`detail-${size.width}`);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download payment PDF" }).click();
    assert.match((await download).suggestedFilename(), /^payment-.*\.pdf$/);
  }
  for (const size of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(size);
    await page.goto(url);
    await page.evaluate(() => (window as any).paymentHarness.pay());
    await choose(
      page.getByRole("button", { name: "Reimbursement state" }),
      "AZ",
    );
    const link = page.getByRole("link", {
      name: /Official .* reimbursement instructions/,
    });
    assert.equal(await link.getAttribute("href"), programs[0]!.officialUrl);
    await link.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: new URL(`reimbursement-${size.width}.png`, directory).pathname,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page
      .getByRole("button", { name: "Continue to card payment" })
      .click();
    await page.getByRole("button", { name: /AMP annual/ }).click();
    await choose(
      page.getByRole("button", { name: "Reimbursement program (optional)" }),
      programs[0]!.id,
    );
    await page.getByRole("button", { name: "Download payment PDF" }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Enter the learner name" })
      .waitFor();
    await page
      .getByRole("textbox", { name: /Learner name/ })
      .fill("Élodie Muñoz");
    await page.getByRole("alert").waitFor({ state: "detached" });
    await page
      .getByRole("textbox", { name: /Learner name/ })
      .scrollIntoViewIfNeeded();
    await shot(`receipt-details-${size.width}`);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download payment PDF" }).click();
    const download = await downloadPromise;
    const path = new URL(`named-receipt-${size.width}.pdf`, directory).pathname;
    await download.saveAs(path);
    assert.ok(
      execFileSync("pdftotext", [path, "-"], { encoding: "utf8" }).includes(
        "Élodie Muñoz",
      ),
    );
    await page.getByRole("textbox", { name: /Learner name/ }).fill("测试");
    await page.getByRole("button", { name: "Download payment PDF" }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "basic Latin letters" })
      .waitFor();
  }
  mode = "review";
  await page.goto(url);
  await page.getByRole("button", { name: /AMP annual/ }).click();
  assert.equal(
    await page.getByRole("button", { name: "Download payment PDF" }).count(),
    0,
  );
  await shot("review");
  mode = "empty";
  await page.goto(url);
  await page
    .getByRole("heading", { name: "No supported payment records" })
    .waitFor();
  await shot("empty");
  mode = "error";
  await page.goto(url);
  await page.getByRole("alert").waitFor();
  await shot("error");
  mode = "records";
  await page.goto(url);
  await page.getByRole("button", { name: /AMP annual/ }).waitFor();
  await page.evaluate(() => {
    (window as any).paymentHarness.render("parent", "renewed-token");
  });
  await page.getByRole("button", { name: /AMP annual/ }).click();
  await page.getByRole("button", { name: "Download payment PDF" }).waitFor();
  await page.evaluate(() => {
    (window as any).paymentHarness.family();
  });
  await page
    .getByRole("button", { name: "Purchases & records", exact: true })
    .click();
  await page.locator("[data-payment-history]").click();
  await page
    .getByRole("heading", { name: "Payment records", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Back to family" }).click();
  assert.equal(
    await page
      .locator("[data-payment-history]")
      .evaluate((element) => element === document.activeElement),
    true,
  );
  for (const learners of [
    [],
    [
      {
        id: "deleted-child",
        name: "Deleted learner",
        deletedAt: "2026-01-01T00:00:00Z",
        access: [],
        stripeLinked: false,
      },
    ],
  ]) {
    familyLearners = learners;
    await page.evaluate(() => {
      (window as any).paymentHarness.unmount();
    });
    await page.getByRole("heading", { name: "Other screen" }).waitFor();
    await page.evaluate(() => {
      (window as any).paymentHarness.family();
    });
    await page
      .getByRole("button", { name: "Purchases & records", exact: true })
      .click();
    await page.locator("[data-payment-history]").click();
    await page.getByRole("button", { name: /AMP annual/ }).waitFor();
    await shot(learners.length ? "tombstone-history" : "empty-family-history");
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(url);
  await page.getByRole("button", { name: /AMP annual/ }).click();
  await page.evaluate(() => {
    const elements = [
      ...document.querySelectorAll<HTMLElement>(
        ".payment-history p,.payment-history h1,.payment-history h2,.payment-history button,.payment-history summary",
      ),
    ];
    const sizes = elements.map((element) =>
      parseFloat(getComputedStyle(element).fontSize),
    );
    elements.forEach(
      (element, index) =>
        (element.style.fontSize = `${sizes[index]! * 1.25}px`),
    );
  });
  await shot("detail-125-percent");
  let signal!: Promise<void>;
  signal = new Promise((resolve) => {
    entered = resolve;
  });
  held = new Promise((resolve) => {
    release = resolve;
  });
  hold = true;
  await page.evaluate(() => {
    (window as any).paymentHarness.render("old-parent");
  });
  await signal;
  await page.evaluate(() => {
    (window as any).paymentHarness.render("other");
  });
  hold = false;
  release();
  await page
    .getByRole("heading", { name: "No supported payment records" })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: /AMP annual/ }).count(),
    0,
  );
  assert.deepEqual(failures, []);
  console.log(
    "Payment records: PDF text/raster proof and compact UI, owned entry/return, renewal and held identity transition passed.",
  );
} finally {
  await browser.close();
  await vite.close();
}
