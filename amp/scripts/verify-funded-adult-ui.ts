import { secureChromium } from "../browser-security.mjs";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium as rawChromium, type Page } from "playwright";
import { createServer } from "vite";
import { settleArrival } from "./ui-settle";
import { consentFixture } from "../tests/parent-consent.fixture";
import { noticeDigest } from "../src/parent-consent/crypto";
const chromium = secureChromium(rawChromium);

/* An adult student paying for herself from her education-funds account:
   the invoice form's Yearly/Monthly choice, connecting the invoice to "Me",
   and a gift used for herself. Synthetic services; 320, 390, 768 and 1280 px, light
   and dark; no horizontal overflow, nothing moves when a choice changes. */

const port = Number(process.env.AMP_FUNDED_ADULT_UI_PORT ?? 4473),
  origin = `http://127.0.0.1:${port}`;
const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
const auth = `export async function accessSession(){return {token:'amp|adult',accountId:'amp|adult',name:'Sample Student'};}export function onSessionChanged(){return()=>{};}export async function signIn(){}export async function signOut(){}export function notifyAccountSessionChanged(){}export async function authConfig(){return {mode:'accounts',passwords:true,providers:[]};}`;
const vite = await createServer({
  cacheDir: "node_modules/.vite-funded-adult",
  plugins: [
    {
      name: "funded-adult-fixture-auth",
      enforce: "pre",
      load(id) {
        return id.split("?")[0] === authPath ? auth : undefined;
      },
      configureServer(server) {
        // Unload beacons can outlive Playwright's request interception.
        server.middlewares.use("/api/v1/events", (_request, response) => {
          response.statusCode = 204;
          response.end();
        });
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
    for (const width of [320, 390, 768, 1280]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme,
      });
      const page = await context.newPage();
      let gift = false;
      let entry:
        | "adult"
        | "parent-pending"
        | "parent-request"
        | "unknown"
        | "invoice-adult"
        | "invoice-ambiguous" = "adult";
      await page.addInitScript(() => {
        (window as unknown as { sawWhoChoice: boolean }).sawWhoChoice = false;
        new MutationObserver(() => {
          if (
            [...document.querySelectorAll("button")].some(
              (button) => button.textContent?.trim() === "For me",
            )
          )
            (window as unknown as { sawWhoChoice: boolean }).sawWhoChoice =
              true;
        }).observe(document, { subtree: true, childList: true });
      });
      const claims: unknown[] = [];
      await page.route("**/api/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === "/api/v1/funding/invoice-offers")
          return route.fulfill({
            json: {
              offers: [offer("annual", 12, 59900), offer("monthly", 1, 5900)],
            },
          });
        if (path === "/api/v1/me") {
          const account = me(gift);
          return route.fulfill({
            json:
              entry === "adult"
                ? account
                : {
                    ...account,
                    adultPractice: { eligible: true, learner: null },
                    consent: {
                      status: entry === "parent-pending" ? "pending" : "none",
                      method: null,
                    },
                    next: "start",
                  },
          });
        }
        if (path === "/api/v1/consent")
          return route.fulfill({
            json: {
              consentActive: false,
              available: true,
              notice: consentFixture.notice,
              noticeDigest: noticeDigest(consentFixture),
              confirmationDelayHours: 24,
              request:
                entry === "parent-request"
                  ? {
                      id: "request",
                      phase: "awaiting-initial",
                      createdAt: "2026-01-01T00:00:00.000Z",
                      expiresAt: "2099-01-01T00:00:00.000Z",
                      confirmationAfter: null,
                      delivery: "accepted",
                    }
                  : null,
            },
          });
        if (path === "/api/v1/funding/offers")
          return route.fulfill({
            json: { offers: [{ programId: "az-esa", jurisdiction: "AZ" }] },
          });
        if (path === "/api/v1/funding/invoices")
          return route.fulfill({
            json: {
              invoices: [
                "adult",
                "invoice-adult",
                "invoice-ambiguous",
              ].includes(entry)
                ? [
                    {
                      id: "8b0f7c43-8f87-4b8f-9e1c-6b0a2c3c0b11",
                      studentBillingName:
                        entry === "invoice-ambiguous"
                          ? "Another Student"
                          : "Sample Student",
                      parentEmail: "student@example.test",
                      state: "prepared",
                      expiresAt: "2099-01-01T00:00:00.000Z",
                      offer: { programId: "az-esa" },
                    },
                  ]
                : [],
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
      // 4. Known parents resume consent; new adults use a matching invoice.
      gift = false;
      for (const scenario of [
        "parent-pending",
        "parent-request",
        "invoice-adult",
        "unknown",
        "invoice-ambiguous",
      ] as const) {
        entry = scenario;
        await page.goto(`${origin}/purchase/arizona-esa`);
        const asks = scenario === "unknown" || scenario === "invoice-ambiguous";
        const heading = asks
          ? "Who’s learning?"
          : scenario === "invoice-adult"
            ? "Connect your invoice"
            : "Learning consent";
        await page
          .getByRole("heading", { name: heading, exact: true })
          .waitFor();
        await settleArrival(page);
        await fits(page);
        assert.equal(
          await page.evaluate(
            () => (window as unknown as { sawWhoChoice: boolean }).sawWhoChoice,
          ),
          asks,
          "no redundant question flashes before routing",
        );
        assert.equal(
          new URL(page.url()).pathname,
          scenario.startsWith("parent")
            ? "/start/consent"
            : "/purchase/arizona-esa",
        );
        await page.screenshot({
          path: `${shots}/${scenario}-${width}-${colorScheme}.png`,
          fullPage: true,
        });
        if (asks) {
          const child = page.getByRole("link", { name: "For my child" });
          const before = await child.boundingBox();
          await page.getByRole("button", { name: "For me" }).focus();
          assert.deepEqual(
            await child.boundingBox(),
            before,
            "question controls do not move",
          );
          await child.click();
          await page
            .getByRole("heading", { name: "Learning consent" })
            .waitFor();
          assert.equal(new URL(page.url()).pathname, "/start/consent");
        }
      }
      await context.close();
    }
  console.log(
    "PASS: funded entry at 320/390/768/1280 light/dark: known parents resume consent, unambiguous invoices skip the question, ambiguous accounts choose, no question flash; Yearly/Monthly invoice choice without layout shift, invoice to Me without consent, gift for herself, no overflow",
  );
} finally {
  await browser.close();
  await vite.close();
}
