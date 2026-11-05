import { secureChromium } from "../browser-security.mjs";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  chromium as rawChromium,
  webkit,
  type Browser,
  type Page,
} from "playwright";
import { createServer } from "vite";
import { signupNotice } from "../src/parent-followup/contracts";
import { retentionNotice } from "../src/family/contracts";
import { noticeDigest } from "../src/parent-consent/crypto";
import { consentFixture } from "../tests/parent-consent.fixture";

/**
 * The signed-out parent pitch at `/` against a synthetic API, in Chromium and
 * WebKit at 320/390/768/1280 px, light and dark, with and without a funded
 * program: no horizontal overflow, 44 px targets, nothing moves while the
 * video loads and plays, and every action reaches a screen that can succeed.
 * Sign-up records the parent follow-up intent for every pitch path.
 *
 *     npx tsx scripts/verify-pitch-ui.ts [--engine chromium|webkit|all]
 *       [--widths 320,390,768,1280] [--shots DIR]
 */
const argument = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
};
const engines =
  (argument("engine") ?? "all") === "all"
    ? (["chromium", "webkit"] as const)
    : ([argument("engine")] as ["chromium" | "webkit"]);
const widths = (argument("widths") ?? "320,390,768,1280")
  .split(",")
  .map(Number);
// `--no-media`: the page as production shows it before media is supplied.
const noMedia = process.argv.includes("--no-media");
if (noMedia) process.env.VITE_AMP_PITCH_FIXTURE = "off";
const shots =
  argument("shots") ??
  (noMedia ? "artifacts/pitch-no-media" : "artifacts/pitch");
await mkdir(shots, { recursive: true });

const port = noMedia ? 4419 : 4418;
const origin = `http://127.0.0.1:${port}`;
const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
// The session comes from this script (`/api/__pitch/session`), so a sign-up
// answered below really signs the tab in.
const auth = `const listeners=new Set();
export async function accessSession(){const r=await fetch('/api/__pitch/session');return (await r.json()).session;}
export function onSessionChanged(update){listeners.add(update);return()=>listeners.delete(update);}
export function notifyAccountSessionChanged(s){if(s!==undefined)for(const l of listeners)l(s);}
export async function signIn(){}export async function signOut(){}
export async function authConfig(){return {mode:'accounts',passwords:true,parentFollowup:true,providers:[]};}`;
const vite = await createServer({
  cacheDir: noMedia
    ? "node_modules/.vite-pitch-text"
    : "node_modules/.vite-pitch",
  logLevel: "error",
  plugins: [
    {
      name: "pitch-auth",
      enforce: "pre",
      load(id) {
        return id.split("?")[0] === authPath ? auth : undefined;
      },
    },
  ],
  server: { host: "127.0.0.1", port, strictPort: true },
});
await vite.listen();

const offers = [
  {
    id: "a".repeat(64),
    mode: "test",
    currency: "USD",
    amountMinor: 49900,
    formattedAmount: "$499.00",
    interval: "year",
    learnerCount: 1,
  },
  {
    id: "b".repeat(64),
    mode: "test",
    currency: "USD",
    amountMinor: 4900,
    formattedAmount: "$49.00",
    interval: "month",
    learnerCount: 1,
  },
];
const fundedOffer = {
  id: "ar-efa-annual",
  revision: "fixture-1",
  programName: "Arkansas EFA",
  productTitle: "AMP Mathematics, 12 months",
  totalMinor: 49900,
  currency: "USD",
  instructions: "Attach the invoice to your request.",
  termMonths: 12,
  // Synthetic: the verifier proves a configured label is shown, not its text.
  statusLabel: "Fixture status label",
};
const policy = {
  ...consentFixture,
  review: { ...consentFixture.review, paymentNotificationsReviewed: true },
};
type Api = {
  signedIn: boolean;
  intents: Record<string, unknown>[];
  events: { event: string; props?: Record<string, unknown> }[];
  pricesFail: boolean;
};
async function serve(page: Page, api: Api) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/__pitch/session")
      return route.fulfill({
        json: {
          session: api.signedIn
            ? { token: "synthetic", accountId: "amp|pitch-parent" }
            : null,
        },
      });
    if (path === "/api/v1/billing/prices")
      return api.pricesFail
        ? route.fulfill({ status: 503, json: { error: "unavailable" } })
        : route.fulfill({ json: { available: true, offers } });
    if (path === "/api/v1/funding/invoice-offers")
      return route.fulfill({
        json: {
          offers:
            new URL(request.url()).searchParams.get("program") === "ar-efa"
              ? [fundedOffer]
              : [],
        },
      });
    if (path === "/api/v1/parent-followup/intent") {
      api.intents.push(request.postDataJSON());
      return route.fulfill({ json: { ready: true } });
    }
    if (path === "/api/auth/sign-up/email") {
      api.signedIn = true;
      return route.fulfill({
        json: {
          token: "synthetic",
          user: { id: "pitch-parent", email: "parent@example.test" },
        },
      });
    }
    if (path === "/api/v1/events") {
      for (const event of request.postDataJSON().events) api.events.push(event);
      return route.fulfill({ status: 202, json: { accepted: 1 } });
    }
    if (path === "/api/v1/me")
      return route.fulfill({
        json: {
          signedIn: true,
          account: {
            id: "amp|pitch-parent",
            email: "parent@example.test",
            emailVerified: true,
            confirmationRequired: false,
          },
          consent: { status: "none", method: null },
          family: {
            consent: {
              status: "not-recorded",
              policyVersion: null,
              recordedAt: null,
              withdrawnAt: null,
            },
            learners: [],
            retained: retentionNotice,
          },
          learners: [],
          next: "try",
        },
      });
    if (path === "/api/v1/billing/enrollment")
      return route.fulfill({
        json: {
          available: true,
          notice: policy.notice,
          noticeDigest: noticeDigest(policy),
          purchase: null,
        },
      });
    if (path === "/api/v1/billing/offer")
      return route.fulfill({
        json: { available: true, offer: offers[0], offers },
      });
    if (path === "/api/v1/trials/current")
      return route.fulfill({ json: { trial: null } });
    if (path === "/api/v1/events/context")
      return route.fulfill({ json: { generation: "initial" } });
    return route.fulfill({ json: {} });
  });
}

async function noOverflow(page: Page, tag: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  assert.ok(overflow <= 1, `${tag}: no horizontal overflow (${overflow}px)`);
}
/** Positions of everything a parent reads or presses, in page coordinates. */
async function layout(page: Page) {
  return page.evaluate(() =>
    [
      "h1",
      "[data-pitch] figure",
      "[data-buy] a, [data-buy] button",
      "[data-pitch] main section:nth-of-type(2)",
      "footer",
    ].map((selector) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box
        ? [
            selector,
            Math.round(box.x),
            Math.round(box.y + scrollY),
            Math.round(box.width),
            Math.round(box.height),
          ].join(" ")
        : `${selector} missing`;
    }),
  );
}

async function viewports(browser: Browser, engine: string) {
  for (const program of [null, "ar-efa"] as const)
    for (const colorScheme of ["light", "dark"] as const)
      for (const width of widths) {
        const tag = `${engine}-${program ?? "card"}-${width}-${colorScheme}`;
        const context = await browser.newContext({
          viewport: { width, height: width >= 768 ? 900 : 800 },
          colorScheme,
        });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const api: Api = {
          signedIn: false,
          intents: [],
          events: [],
          pricesFail: false,
        };
        await serve(page, api);
        const query = program
          ? `?program=${program}&utm_campaign=ar-efa-launch&utm_source=google&utm_medium=cpc`
          : "";
        if (engine === "chromium")
          await page.addInitScript(() => {
            (window as unknown as { shifts: number }).shifts = 0;
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries() as (PerformanceEntry & {
                value: number;
                hadRecentInput: boolean;
              })[])
                if (!entry.hadRecentInput)
                  (window as unknown as { shifts: number }).shifts +=
                    entry.value;
            }).observe({ type: "layout-shift", buffered: true });
          });
        await page.goto(`${origin}/${query}`);
        await page
          .getByRole("heading", { name: "Math that adapts to every answer." })
          .waitFor();
        await page.evaluate(() => document.fonts.ready);
        const buy = program
          ? page.getByRole("link", { name: "Buy with Arkansas EFA funds" })
          : page.getByRole("button", { name: "Buy AMP" });
        await buy.waitFor();
        if (program)
          assert.equal(
            await page.locator("[data-funding-status]").innerText(),
            "✓ Fixture status label",
            `${tag}: the configured status label`,
          );
        assert.deepEqual(
          await page.evaluate(
            () =>
              [...document.querySelectorAll("[data-pitch] *")]
                .filter(
                  (node) =>
                    node.childElementCount === 0 &&
                    /\$\d+\.00/.test(node.textContent ?? ""),
                )
                .map((node) => node.outerHTML)
                .join(" ") || null,
          ),
          null,
          `${tag}: whole dollars`,
        );
        await noOverflow(page, tag);
        // Every control is a 44 px target; inline text links are exempt.
        const small = await page.evaluate(() =>
          [...document.querySelectorAll("[data-pitch] a, [data-pitch] button")]
            .filter(
              (node) =>
                !(node as HTMLElement).closest("p") &&
                getComputedStyle(node).display !== "none",
            )
            .map((node) => [node.textContent, node.getBoundingClientRect()])
            .filter(
              ([, box]) =>
                (box as DOMRect).height < 44 || (box as DOMRect).width < 44,
            )
            .map(([text]) => text),
        );
        assert.deepEqual(small, [], `${tag}: 44px targets`);
        // Labels never break mid-word: each line ends between words.
        const before = await layout(page);
        await page.screenshot({ path: `${shots}/${tag}.png`, fullPage: true });
        if (noMedia) {
          // No media: no player, and no empty hero column at any width.
          const hero = await page.evaluate(() => {
            const node = document.querySelector("[data-hero]")!;
            return {
              mode: node.getAttribute("data-hero"),
              tracks:
                getComputedStyle(node).gridTemplateColumns.split(" ").length,
              figures: node.querySelectorAll("figure, video").length,
              width: node.getBoundingClientRect().width,
              widest: Math.max(
                ...[...node.children].map(
                  (child) => child.getBoundingClientRect().width,
                ),
              ),
            };
          });
          assert.equal(hero.mode, "text", `${tag}: text hero`);
          assert.equal(hero.figures, 0, `${tag}: no player`);
          assert.equal(hero.tracks, 1, `${tag}: one hero column`);
          assert.ok(
            hero.widest >= hero.width - 1,
            `${tag}: no empty hero track (${JSON.stringify(hero)})`,
          );
          await page.waitForTimeout(500);
          assert.deepEqual(await layout(page), before, `${tag}: no shift`);
          assert.deepEqual(errors, [], `${tag}: no page errors`);
          await context.close();
          continue;
        }
        // Tap to play: the movie loads into the reserved box.
        await page.getByRole("button", { name: /^Play .*with sound$/ }).click();
        await page.waitForFunction(
          () => {
            const video = document.querySelector("video");
            return !!video && video.currentTime > 0.4 && !video.paused;
          },
          undefined,
          { timeout: 15_000 },
        );
        assert.deepEqual(
          await layout(page),
          before,
          `${tag}: nothing moves while the video loads and plays`,
        );
        assert.equal(
          await page.evaluate(() => document.querySelector("video")!.muted),
          false,
          `${tag}: plays with sound`,
        );
        assert.equal(
          await page.evaluate(
            () => document.querySelector("video")!.textTracks[0]?.mode,
          ),
          "showing",
          `${tag}: captions on`,
        );
        if (engine === "chromium")
          assert.equal(
            await page.evaluate(
              () => (window as unknown as { shifts: number }).shifts,
            ),
            0,
            `${tag}: cumulative layout shift`,
          );
        await noOverflow(page, `${tag} playing`);
        if (width === 390 || width === 1280)
          await page.screenshot({ path: `${shots}/${tag}-playing.png` });
        await page.evaluate(() => {
          const video = document.querySelector("video")!;
          video.currentTime = video.duration - 0.2;
        });
        await page.waitForFunction(
          () => document.querySelector("video")!.ended,
          undefined,
          {
            timeout: 10_000,
          },
        );
        // The first-party queue sends within two seconds.
        await page.waitForTimeout(2500);
        const names = api.events.map((event) => event.event);
        for (const name of ["landing_view", "pitch_view", "video_play"])
          assert.ok(names.includes(name), `${tag}: ${name} recorded`);
        const quartiles = api.events
          .filter((event) => event.event === "video_progress")
          .map((event) => event.props?.percent);
        assert.deepEqual(
          [...new Set(quartiles)].sort(),
          [100, 25, 50, 75],
          `${tag}: every quartile`,
        );
        assert.equal(quartiles.length, 4, `${tag}: quartiles deduplicated`);
        const view = api.events.find((event) => event.event === "pitch_view");
        assert.deepEqual(view?.props, program ? { program } : {});
        const screen = api.events.find(
          (event) => event.event === "page_engagement",
        );
        assert.equal(screen?.props?.screen, "pitch", `${tag}: pitch screen`);
        assert.deepEqual(errors, [], `${tag}: no page errors`);
        await context.close();
      }
}

/** Each action lands on a screen that can succeed, and sign-up records the
 * same parent follow-up intent free practice always has. */
async function journeys(browser: Browser, engine: string) {
  const campaign =
    "utm_campaign=ar-efa-launch&utm_source=google&utm_medium=cpc";
  type Case = {
    name: string;
    url: string;
    act: (page: Page) => Promise<void>;
    signUpHeading: string;
    entry: string;
    landing: (page: Page) => Promise<void>;
  };
  const cases: Case[] = [
    {
      name: "card",
      url: "/",
      act: async (page) => {
        await page.getByRole("radio", { name: /Monthly/ }).click();
        await page.getByRole("button", { name: "Buy AMP" }).click();
      },
      signUpHeading: "Create your account to buy",
      entry: "pitch-buy",
      landing: async (page) => {
        await page.waitForURL("**/start/plan**");
        await page.getByRole("radiogroup", { name: "Plan" }).waitFor();
        assert.equal(
          await page
            .getByRole("radio", { name: /Monthly/ })
            .getAttribute("aria-checked"),
          "true",
          "the chosen plan is selected at checkout",
        );
      },
    },
    {
      name: "card-instead",
      url: `/?program=ar-efa&${campaign}`,
      act: (page) =>
        page.getByRole("button", { name: "Pay by card instead" }).click(),
      signUpHeading: "Create your account to buy",
      entry: "pitch-buy",
      landing: async (page) => {
        await page.waitForURL("**/start/plan**");
        await page.getByRole("radiogroup", { name: "Plan" }).waitFor();
      },
    },
    {
      name: "try",
      url: `/?program=ar-efa&${campaign}`,
      act: (page) =>
        page.getByRole("button", { name: "Try a problem" }).click(),
      signUpHeading: "Math that adapts as you answer.",
      entry: "pitch-try",
      landing: async (page) => {
        await page.waitForURL("**/try?**");
        await page
          .getByRole("heading", { name: "See how AMP adapts" })
          .waitFor();
      },
    },
    {
      name: "workbook",
      url: "/",
      act: (page) =>
        page.getByRole("button", { name: "Get a free workbook" }).click(),
      signUpHeading: "Get your free workbook",
      entry: "pitch-workbook",
      landing: async (page) => {
        await page.waitForURL("**/try?**");
        await page
          .getByRole("heading", { name: "Your free workbook" })
          .waitFor();
      },
    },
  ];
  for (const item of cases) {
    const tag = `${engine}-journey-${item.name}`;
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const api: Api = {
      signedIn: false,
      intents: [],
      events: [],
      pricesFail: false,
    };
    await serve(page, api);
    await page.goto(`${origin}${item.url}`);
    await item.act(page);
    await page.getByRole("heading", { name: item.signUpHeading }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/sign-up", tag);
    assert.equal(new URL(page.url()).searchParams.get("entry"), item.entry);
    if (item.url.includes("program"))
      assert.equal(
        new URL(page.url()).searchParams.get("utm_campaign"),
        "ar-efa-launch",
        `${tag}: campaign kept`,
      );
    await noOverflow(page, `${tag} sign-up`);
    await page.screenshot({ path: `${shots}/${tag}-sign-up.png` });
    await page.getByLabel("Email").fill("parent@example.test");
    await page.getByLabel("AMP password").fill("correct horse battery");
    await page.getByRole("button", { name: "Create account" }).click();
    await item.landing(page);
    assert.equal(api.intents.length, 1, `${tag}: one signup intent`);
    assert.equal(api.intents[0]!.entry, item.entry);
    assert.equal(api.intents[0]!.notice, signupNotice);
    assert.equal(api.intents[0]!.newsletter, true);
    if (item.url.includes("program"))
      assert.equal(api.intents[0]!.program, "ar-efa");
    await noOverflow(page, tag);
    await page.screenshot({ path: `${shots}/${tag}.png` });
    await context.close();
  }

  // Funded Buy: the no-account invoice for that program, campaign kept.
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const api: Api = {
      signedIn: false,
      intents: [],
      events: [],
      pricesFail: false,
    };
    await serve(page, api);
    await page.goto(`${origin}/?program=ar-efa&${campaign}`);
    await page
      .getByRole("link", { name: "Buy with Arkansas EFA funds" })
      .click();
    await page.waitForURL("**/invoice/arkansas-efa?**");
    await page.getByLabel("Parent or guardian email").waitFor();
    await page.getByRole("button", { name: "Create invoice PDF" }).waitFor();
    assert.equal(
      new URL(page.url()).searchParams.get("utm_campaign"),
      "ar-efa-launch",
    );
    await page.screenshot({ path: `${shots}/${engine}-journey-funded.png` });
    // Back returns to the same pitch.
    await page.goBack();
    await page
      .getByRole("link", { name: "Buy with Arkansas EFA funds" })
      .waitFor();
    await context.close();
  }

  // A failed price shows in place, with a retry, and never a dead Buy.
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const api: Api = {
      signedIn: false,
      intents: [],
      events: [],
      pricesFail: true,
    };
    await serve(page, api);
    await page.goto(`${origin}/`);
    await page
      .getByRole("alert")
      .filter({ hasText: "Prices didn’t load" })
      .waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Buy AMP" }).count(),
      0,
    );
    await page.getByRole("button", { name: "Try a problem" }).waitFor();
    api.pricesFail = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await page.getByRole("button", { name: "Buy AMP" }).waitFor();
    await noOverflow(page, `${engine} price retry`);
    await context.close();
  }
}

try {
  for (const engine of engines) {
    const browser = await (
      engine === "webkit" ? webkit : secureChromium(rawChromium)
    ).launch();
    try {
      await viewports(browser, engine);
      if (!noMedia) await journeys(browser, engine);
    } finally {
      await browser.close();
    }
    console.log(
      noMedia
        ? `PASS ${engine}: pitch without media at ${widths.join("/")} px, light and dark: one text column, no player, no empty track, no shift`
        : `PASS ${engine}: pitch at ${widths.join("/")} px, light and dark, card and funded; video plays in place; every action reaches a working screen`,
    );
  }
} finally {
  await vite.close();
}
