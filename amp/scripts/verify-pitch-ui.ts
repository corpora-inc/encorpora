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
import {
  guaranteeProblems,
  orphanLines,
  GUARANTEE_LINE,
} from "./ui-copy-checks";
import { retentionNotice } from "../src/family/contracts";
import { noticeDigest } from "../src/parent-consent/crypto";
import { consentFixture } from "../tests/parent-consent.fixture";
import { fixtureMe } from "./me-fixture";

/**
 * The signed-out parent pitch at `/` against a synthetic API, in Chromium and
 * WebKit at 320/390/768/1280 px, light and dark, with and without a funded
 * program: no horizontal overflow, 44 px targets, nothing moves while the
 * video loads and plays, no blank pockets from 320 px to 2560 px, and every
 * action reaches a screen that can succeed.
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

const port = Number(process.env.AMP_PITCH_UI_PORT ?? (noMedia ? 4419 : 4418));
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
    amountMinor: 59900,
    formattedAmount: "$599.00",
    interval: "year",
    learnerCount: 1,
  },
  {
    id: "b".repeat(64),
    mode: "test",
    currency: "USD",
    amountMinor: 5900,
    formattedAmount: "$59.00",
    interval: "month",
    learnerCount: 1,
  },
];
// Each additional child's price, as the server sends it beside the plans.
const extraOffers = [
  {
    id: "c".repeat(64),
    mode: "test",
    currency: "USD",
    amountMinor: 39900,
    formattedAmount: "$399.00",
    interval: "year",
    learnerCount: 1,
    tier: "extra",
  },
  {
    id: "d".repeat(64),
    mode: "test",
    currency: "USD",
    amountMinor: 3900,
    formattedAmount: "$39.00",
    interval: "month",
    learnerCount: 1,
    tier: "extra",
  },
];
const fundedOffer = {
  id: "ar-efa-annual",
  revision: "fixture-1",
  programName: "Arkansas EFA",
  productTitle: "AMP Mathematics, 12 months",
  totalMinor: 59900,
  currency: "USD",
  instructions: "Attach the invoice to your request.",
  termMonths: 12,
  // Synthetic: the verifier proves a configured label is shown, not its text.
  // As long as the live labels, so the layout is tested at their length.
  statusLabel: "Fixture status label, as long as a real one",
  refundPolicy: "full-to-account",
  refundSummary: "Fixture refund terms.",
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
  /** The child the starter adds, once the parent answers it. */
  child?: string;
  /** The plan each checkout asked Stripe for. */
  checkouts?: string[];
};
const childId = "pitch-child";
/** The parent's `/me`, as the server answers it before and after the starter. */
const parentMe = (api: Api) => ({
  ...fixtureMe(
    {
      consent: {
        status: "not-recorded",
        policyVersion: null,
        recordedAt: null,
        withdrawnAt: null,
      },
      learners: api.child
        ? [
            {
              id: api.child,
              name: "Fox",
              birthYear: 2016,
              deletedAt: null,
              access: [],
              stripeLinked: false,
              // The free allowance; no plan yet.
              canPractice: true,
              hasAccess: false,
            },
          ]
        : [],
      retained: retentionNotice,
    },
    "amp|pitch-parent",
  ),
  consent: { status: "none", method: null },
});
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
        : route.fulfill({ json: { available: true, offers, extraOffers } });
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
    if (path === "/api/v1/me") return route.fulfill({ json: parentMe(api) });
    // "I'm a parent" of one child: the family and its child, in one call.
    if (path === "/api/v1/start") {
      api.child = childId;
      return route.fulfill({
        json: { home: "family/learners", learnerId: childId, added: 1 },
      });
    }
    if (path === "/api/v1/billing/enrollment/checkout") {
      (api.checkouts ??= []).push(request.postDataJSON().interval);
      return route.fulfill({
        json: { url: "https://checkout.stripe.com/c/pay/cs_pitch_fixture" },
      });
    }
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
        json: { available: true, offer: offers[0], offers, extraOffers },
      });
    if (path === "/api/v1/events/context")
      return route.fulfill({ json: { generation: "initial" } });
    return route.fulfill({ json: {} });
  });
  await page.route("https://checkout.stripe.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Stripe</title><h1>Stripe Checkout fixture</h1>",
    }),
  );
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
          .getByRole("heading", {
            name: "See how far your child can go in math.",
          })
          .waitFor();
        await page.evaluate(() => document.fonts.ready);
        const buy = program
          ? page
              .getByRole("link", { name: "Buy with Arkansas EFA funds" })
              .first()
          : page.getByRole("button", { name: "Buy AMP" }).first();
        await buy.waitFor();
        await page.getByRole("heading", { name: "Give it 30 days." }).waitFor();
        await page.getByText(/^\*Refunds go back the way you paid/).waitFor();
        assert.equal(
          await page.locator("[data-buy-terms]").first().innerText(),
          program
            ? `$599 for the year, paid from your EFA balance.\n${GUARANTEE_LINE}`
            : `$599 for the year.\n${GUARANTEE_LINE}`,
          `${tag}: the guarantee beside Buy`,
        );
        if (!program) {
          const additional = page.locator("[data-additional-child]").first();
          assert.equal(
            (await additional.innerText()).replaceAll("\u00a0", " "),
            "Each additional child: $399 a year",
            `${tag}: the additional-child price, from the server's offer`,
          );
          const box = await additional.boundingBox();
          assert.ok(
            box && box.x >= 0 && box.x + box.width <= width,
            `${tag}: the additional-child line fits`,
          );
        }
        // No guarantee word splits at a hyphen; every promise has its
        // asterisk and footnote; no body or fine-print line is one lone word.
        assert.deepEqual(
          await guaranteeProblems(page, "[data-pitch]"),
          [],
          `${tag}: guarantee copy`,
        );
        assert.deepEqual(
          await orphanLines(page, "[data-pitch] main"),
          [],
          `${tag}: no single-word last line`,
        );
        if (program)
          assert.equal(
            await page.locator("[data-funding-status]").innerText(),
            "✓ Fixture status label, as long as a real one",
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

/**
 * No blank pockets at any size. The buy actions span the hero; their controls
 * share a height and their fine print starts on one line; on wide screens every
 * edge sits on the film's edges and the words run the film's height; Buy is on
 * the first screen from tablet up; the two lower columns end together.
 */
async function fit(browser: Browser, engine: string) {
  const sizes = [
    [320, 568],
    [390, 844],
    [430, 932],
    [481, 800],
    [605, 685],
    [700, 900],
    [768, 1024],
    [909, 1041],
    [959, 900],
    [960, 800],
    [1004, 1019],
    [1024, 768],
    [1280, 800],
    [1366, 768],
    [1552, 1027],
    [1920, 1080],
    [2560, 1440],
  ] as const;
  for (const program of [null, "ar-efa"] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await serve(page, {
      signedIn: false,
      intents: [],
      events: [],
      pricesFail: false,
    });
    await page.goto(`${origin}/${program ? `?program=${program}` : ""}`);
    await page.locator("[data-buy]").waitFor();
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => document.fonts.ready);
      const tag = `${engine}-${program ?? "card"}-${width}x${height} fit`;
      await noOverflow(page, tag);
      const box = await page.evaluate(
        (selectors) =>
          Object.fromEntries(
            Object.entries(selectors).map(([name, selector]) => {
              const found = document.querySelector(selector);
              return [
                name,
                found ? found.getBoundingClientRect().toJSON() : null,
              ];
            }),
          ) as Record<keyof typeof selectors, DOMRect | null>,
        {
          hero: "[data-hero]",
          actions: "[data-actions]",
          copy: "[data-hero] > :first-child",
          film: "[data-pitch] figure",
          plan: "[data-actions] [role=radiogroup]",
          buy: "[data-actions] [data-buy] a, [data-actions] [data-buy] button:not([role=radio])",
          buyTerms: "[data-actions] [data-buy-terms]",
          tryFree: "[data-actions] button[class*=tryButton]",
          note: "[data-actions] p[class*=note]",
          status: "[data-actions] [data-funding-status]",
          guaranteeEnd: "[data-guarantee] > :last-child",
          purchaseEnd: "[data-guarantee] + * > :last-child",
        },
      );
      const near = (a: number, b: number, what: string, within = 1) =>
        assert.ok(Math.abs(a - b) <= within, `${tag}: ${what} (${a}, ${b})`);
      assert.ok(
        box.hero && box.actions && box.buy && box.tryFree && box.film,
        tag,
      );
      near(box.actions.width, box.hero.width, "actions span the hero");
      if (width >= 481) {
        if (program)
          assert.ok(
            box.status!.height <= 24,
            `${tag}: the funded status stays on one line (${box.status!.height})`,
          );
        near(box.buy.top, box.tryFree.top, "Buy and Try on one line");
        near(box.buy.height, box.tryFree.height, "Buy and Try one height");
        near(box.buyTerms!.top, box.note!.top, "fine print on one line");
      }
      if (width >= 960) {
        near(box.tryFree.right, box.film.right, "Try ends on the film's edge");
        near(box.copy!.top, box.film.top, "words start at the film's top", 8);
        near(box.copy!.bottom, box.film.bottom, "words end at its bottom", 8);
        near(
          box.actions.top,
          Math.max(box.copy!.bottom, box.film.bottom) + 24,
          "the band sits right under the film",
        );
        if (program) {
          near(box.buy.left, box.copy!.left, "Buy starts on the words' edge");
        } else {
          near(box.buy.left, box.film.left, "Buy starts on the film's edge");
          near(box.plan!.top, box.buy.top, "the band shares one top");
          near(box.plan!.height, box.buy.height, "the band shares one height");
          near(
            box.plan!.right,
            box.copy!.right,
            "plan ends on the words' edge",
          );
        }
      }
      // A tablet in portrait and every laptop: Buy without scrolling.
      if (width >= 960 || (width >= 700 && height > width))
        assert.ok(
          box.buy.bottom <= height,
          `${tag}: Buy on the first screen (${box.buy.bottom})`,
        );
      if (width >= 768)
        near(
          box.guaranteeEnd!.bottom,
          box.purchaseEnd!.bottom,
          "the lower columns end together",
          program ? 72 : 48,
        );
    }
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
    landing: (page: Page, api: Api) => Promise<void>;
  };
  // A new account answers "What brings you to AMP?" first.
  const starter = async (page: Page) => {
    await page.waitForURL((url) => url.pathname === "/start");
    await page
      .getByRole("heading", { name: "What brings you to AMP?" })
      .waitFor();
  };
  const cases: Case[] = [
    {
      name: "card",
      url: "/",
      act: async (page) => {
        await page.getByRole("radio", { name: /Monthly/ }).click();
        await page.getByRole("button", { name: "Buy AMP" }).first().click();
      },
      signUpHeading: "Create your account to buy",
      entry: "pitch-buy",
      // The plan waits for the learner it is for: the parent's one child,
      // then "Continue with AMP" with the pitch's plan chosen, then Stripe.
      landing: async (page, api) => {
        await starter(page);
        await page.getByRole("link", { name: /^I’m a parent/ }).click();
        await page
          .getByRole("button", { name: "Birth year, your child" })
          .click();
        await page.getByRole("option", { name: "2016", exact: true }).click();
        await page
          .getByRole("button", { name: "Continue", exact: true })
          .click();
        await page.waitForURL(
          (url) =>
            url.pathname === `/continue/${childId}` &&
            url.searchParams.get("interval") === "month",
        );
        await page
          .getByRole("heading", { name: "Continue with AMP" })
          .waitFor();
        assert.equal(
          await page
            .getByRole("radio", { name: /Monthly/ })
            .getAttribute("aria-checked"),
          "true",
          "the plan chosen on the pitch is selected",
        );
        await noOverflow(page, "continue with AMP");
        await page.screenshot({ path: `${shots}/journey-continue.png` });
        await page.getByRole("checkbox").click();
        await page
          .getByRole("button", { name: "Continue to secure checkout" })
          .click();
        await page
          .getByRole("heading", { name: "Stripe Checkout fixture" })
          .waitFor();
        assert.deepEqual(api.checkouts, ["month"], "one monthly checkout");
      },
    },
    {
      name: "card-instead",
      url: `/?program=ar-efa&${campaign}`,
      act: (page) =>
        page.getByRole("button", { name: "Pay by card instead" }).click(),
      signUpHeading: "Create your account to buy",
      entry: "pitch-buy",
      landing: starter,
    },
    {
      name: "try",
      url: `/?program=ar-efa&${campaign}`,
      act: (page) =>
        page.getByRole("button", { name: "Try it free" }).first().click(),
      signUpHeading: "Try AMP free",
      entry: "pitch-try",
      landing: starter,
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
    await item.landing(page, api);
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
      .first()
      .click();
    await page.waitForURL("**/invoice/arkansas-efa?**");
    await page.getByLabel("Parent or guardian email").waitFor();
    await page.getByRole("button", { name: "Create invoice PDF" }).waitFor();
    // The point of sale states the program's refund terms.
    await page.getByText("Fixture refund terms.").waitFor();
    assert.equal(
      new URL(page.url()).searchParams.get("utm_campaign"),
      "ar-efa-launch",
    );
    await page.screenshot({ path: `${shots}/${engine}-journey-funded.png` });
    // Back returns to the same pitch.
    await page.goBack();
    await page
      .getByRole("link", { name: "Buy with Arkansas EFA funds" })
      .first()
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
    await page.getByRole("button", { name: "Try it free" }).first().waitFor();
    api.pricesFail = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await page.getByRole("button", { name: "Buy AMP" }).first().waitFor();
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
      if (!noMedia) {
        await fit(browser, engine);
        await journeys(browser, engine);
      }
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
