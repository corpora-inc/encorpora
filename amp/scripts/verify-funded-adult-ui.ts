import { secureChromium } from "../browser-security.mjs";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium as rawChromium, type Page } from "playwright";
import { createServer } from "vite";
import { settleArrival } from "./ui-settle";
const chromium = secureChromium(rawChromium);

/* An adult student paying for herself from her education-funds account:
   the invoice form's Yearly/Monthly choice, connecting the invoice to "Me",
   and a gift used for herself. Synthetic services; 390 and 1280 px, light
   and dark; no horizontal overflow, nothing moves when a choice changes. */

const port = Number(process.env.AMP_FUNDED_ADULT_UI_PORT ?? 4473),
  origin = `http://127.0.0.1:${port}`;
const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
const auth = `export async function accessSession(){return {token:'amp|adult',accountId:'amp|adult'};}export function onSessionChanged(){return()=>{};}export async function signIn(){}export async function signOut(){}export function notifyAccountSessionChanged(){}export async function authConfig(){return {mode:'accounts',passwords:true,providers:[]};}`;
const vite = await createServer({
  cacheDir: "node_modules/.vite-funded-adult",
  plugins: [
    {
      name: "funded-adult-fixture-auth",
      enforce: "pre",
      load(id) {
        return id.split("?")[0] === authPath ? auth : undefined;
      },
    },
  ],
  server: { host: "127.0.0.1", port, strictPort: true },
});
await vite.listen();
const shots = process.env.AMP_UI_ARTIFACTS ?? "artifacts/funded-adult";
await mkdir(shots, { recursive: true });

const offer = (id: string, termMonths: 1 | 12, totalMinor: number) => ({
  id,
  revision: "r1",
  programName: "Arizona Empowerment Scholarship Account",
  productTitle: `AMP Mathematics - ${termMonths === 1 ? "monthly" : "annual"} learner license`,
  totalMinor,
  currency: "USD",
  instructions: "Attach the invoice in ClassWallet.",
  termMonths,
  refundPolicy: "purchase-to-account",
  refundSummary:
    "Ask within 30 days of payment, for any reason, and we refund your purchase to your ESA.",
});
const me = (gift: boolean) => ({
  signedIn: true,
  account: {
    id: "amp|adult",
    email: "student@example.test",
    emailVerified: true,
  },
  consent: { status: "none", method: null },
  learners: [],
  family: {
    consent: {
      status: "not-recorded",
      policyVersion: null,
      recordedAt: null,
      withdrawnAt: null,
    },
    learners: [],
    retained: {
      identity: "",
      financial: "",
      backups: "",
      privacyAuditDays: 30,
    },
  },
  adultPractice: {
    eligible: false,
    learner: { id: "own", name: "Student", active: true },
  },
  ...(gift
    ? {
        availableAccessGrant: {
          id: "b24d441b-38d5-42ec-ae99-dbe186b1ffba",
          months: 1,
          claimBy: null,
        },
      }
    : {}),
  next: gift ? "accept-gift" : "practice",
});

async function fits(page: Page) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "no horizontal overflow",
  );
}

const browser = await chromium.launch({ args: ["--no-proxy-server"] });
try {
  for (const colorScheme of ["light", "dark"] as const)
    for (const width of [390, 1280]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme,
      });
      const page = await context.newPage();
      let gift = false;
      const claims: unknown[] = [];
      await page.route("**/api/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === "/api/v1/funding/invoice-offers")
          return route.fulfill({
            json: {
              offers: [offer("annual", 12, 59900), offer("monthly", 1, 5900)],
            },
          });
        if (path === "/api/v1/me") return route.fulfill({ json: me(gift) });
        if (path === "/api/v1/funding/offers")
          return route.fulfill({
            json: { offers: [{ programId: "az-esa", jurisdiction: "AZ" }] },
          });
        if (path === "/api/v1/funding/invoices")
          return route.fulfill({
            json: {
              invoices: [
                {
                  id: "8b0f7c43-8f87-4b8f-9e1c-6b0a2c3c0b11",
                  studentBillingName: "Sample Student",
                  state: "prepared",
                  expiresAt: "2099-01-01T00:00:00.000Z",
                  offer: { programId: "az-esa" },
                },
              ],
            },
          });
        if (path.endsWith("/claim")) {
          claims.push(route.request().postDataJSON());
          return route.fulfill({ status: 503, json: { error: "stop_here" } });
        }
        return route.fulfill({ json: {} });
      });

      // 1. The invoice: Yearly or Monthly, one email for parent or student.
      await page.goto(`${origin}/invoice/arizona-esa`);
      const month = page.getByRole("radio", { name: /Monthly/ });
      await month.waitFor();
      await page
        .getByLabel("Email for the AMP account (parent, or the student if 18+)")
        .fill("student@example.test");
      const submit = page.getByRole("button", { name: "Create invoice PDF" });
      const before = await submit.boundingBox();
      await month.click();
      assert.deepEqual(await submit.boundingBox(), before);
      await settleArrival(page);
      await fits(page);
      await page.screenshot({
        path: `${shots}/invoice-monthly-${width}-${colorScheme}.png`,
        fullPage: true,
      });

      // 2. Connecting it to herself: "Me", no consent step.
      await page.goto(`${origin}/purchase/arizona-esa`);
      await page
        .getByRole("heading", { name: "Connect your invoice" })
        .waitFor();
      assert.equal(
        await page
          .getByRole("radio", { name: "Me" })
          .getAttribute("aria-checked"),
        "true",
      );
      assert.equal(new URL(page.url()).pathname, "/purchase/arizona-esa");
      await settleArrival(page);
      await fits(page);
      await page.screenshot({
        path: `${shots}/claim-me-${width}-${colorScheme}.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "Use this invoice" }).click();
      await page.waitForFunction(() => true);
      await page.waitForTimeout(200);
      assert.deepEqual(claims[0], { learnerId: "own" });

      // 3. A gift used for herself.
      gift = true;
      await page.goto(`${origin}/access`);
      await page.getByRole("button", { name: "Use it for me" }).waitFor();
      await settleArrival(page);
      await fits(page);
      await page.screenshot({
        path: `${shots}/gift-me-${width}-${colorScheme}.png`,
        fullPage: true,
      });
      await context.close();
    }
  console.log(
    "PASS: funded adult at 390/1280 light/dark: Yearly/Monthly invoice choice without layout shift, invoice to Me without consent, gift for herself, no overflow",
  );
} finally {
  await browser.close();
  await vite.close();
}
