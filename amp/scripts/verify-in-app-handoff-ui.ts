import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium } from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
import { settleArrival } from "./ui-settle";
import { userAgents } from "../tests/fixtures/in-app-user-agents";

// One tap on Google in an in-app browser opens the same sign-in in the real
// browser (a separate, isolated context here), where Google starts at once.
// API replies are synthetic.
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? undefined : process.argv[i + 1];
};
const port = Number(arg("port") || 4876);
const origin = `http://localhost:${port}`;
const output = arg("shots") || "artifacts/in-app-auth";
await mkdir(output, { recursive: true });
const vite = await createServer({
  logLevel: "error",
  cacheDir:
    process.env.AMP_VITE_CACHE_DIR ?? "node_modules/.vite-in-app-handoff",
  plugins: [
    {
      name: "local-api-only",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (!req.url?.startsWith("/api/")) return next();
          res.statusCode = 204;
          res.end();
        });
      },
    },
  ],
  server: { host: "127.0.0.1", port, strictPort: true },
});
await vite.listen();
const browser = await secureChromium(rawChromium).launch();
const failures: string[] = [];
/** Records the one-tap jump (an `intent://` or `x-safari-` link) instead of
 * following it, as no other browser exists here. */
const captureHandoffs = `
  window.__handoffs = [];
  const follow = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (/^(intent|x-safari-https?):/.test(this.href))
      return void window.__handoffs.push(this.href);
    return follow.call(this);
  };
`;
/** The address a jump opens, from either platform's link. */
function opened(handoff: string) {
  const address =
    handoff.match(
      /^intent:\/\/(.*)#Intent;scheme=http;package=com\.android\.chrome;end$/,
    )?.[1] ?? handoff.match(/^x-safari-http:\/\/(.*)$/)?.[1];
  assert.ok(address, handoff);
  return `http://${address}`;
}
/** Why this tab signs up (lib/program-choice.ts `signUpIntent`). */
async function signUpIntent(page: import("playwright").Page) {
  return page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("amp.sign-up-entry") ?? "null"),
  );
}
async function handoffs(page: import("playwright").Page) {
  return page.evaluate(() => (window as any).__handoffs as string[]);
}
let socialStarts: { provider: string; callbackURL: string }[] = [];
async function context(inApp: false | string, method = "") {
  const c = await browser.newContext({
    viewport: { width: 390, height: 844 },
    ...(inApp
      ? { userAgent: userAgents.find((a) => a.name === inApp)!.ua }
      : {}),
  });
  await c.addInitScript({ content: captureHandoffs });
  await c.route("**/api/**", async (route) => {
    const request = route.request();
    assert.ok(
      !request.url().includes("r".repeat(43)) &&
        !request.url().includes("s".repeat(43)),
      "bearers stay out of HTTP URLs",
    );
    const p = new URL(request.url()).pathname;
    if (/analytics|events|diagnostic/.test(p)) {
      assert.ok(!request.postData()?.includes("r".repeat(43)));
      assert.ok(!request.postData()?.includes("s".repeat(43)));
    }
    if (p === "/api/auth/sign-in-methods")
      return route.fulfill({ json: { methods: method ? [method] : [] } });
    if (p === "/api/v1/auth-config")
      return route.fulfill({
        json: {
          mode: "accounts",
          passwords: true,
          passkeySignup: true,
          parentFollowup: false,
          providers: ["google"],
        },
      });
    if (p === "/api/auth/get-session") return route.fulfill({ json: null });
    if (p === "/api/auth/sign-in/social") {
      socialStarts.push(request.postDataJSON());
      return route.fulfill({
        json: { url: `${origin}/provider-stub`, redirect: true },
      });
    }
    if (p.endsWith("/invites/lookup"))
      return route.fulfill({
        json: {
          invite: {
            status: "open",
            orgName: "Review School",
            role: "teacher",
            email: "parent@example.test",
            setup: false,
            // The invited address has an account when it has a method.
            hasAccount: !!method,
          },
        },
      });
    if (p.endsWith("/family/approvals/lookup"))
      return route.fulfill({
        json: {
          approval: {
            status: "open",
            childName: null,
            className: "Review Class",
            teachers: ["Review Teacher"],
          },
        },
      });
    return route.fulfill({ status: 204 });
  });
  return c;
}
try {
  // Try/Buy: one tap from Instagram (iOS) and Facebook (Android). The
  // older links are deliberate legacy inputs; the tab keeps why it signs up,
  // its program and campaign. `/try` is one hop to plain `/sign-up`; an
  // older `/sign-up?entry=` keeps its arrival on the address in an app's
  // browser (what the app's own "open in browser" opens;
  // app/third-party-returns.ts `arrivalReturn`).
  const campaign =
    "program=ar-efa&utm_campaign=ar-efa-launch&utm_source=google&utm_medium=cpc";
  for (const { path, app, intent, heading } of [
    {
      path: `/try?entry=pitch-try&return=free-practice&${campaign}`,
      app: "instagram-0",
      intent: { entry: "pitch-try", free: true },
      heading: "Try AMP free",
    },
    {
      path: "/sign-up?entry=pitch-buy",
      app: "facebook-0",
      intent: { entry: "pitch-buy" },
      heading: "Create your account to buy",
    },
  ] as const) {
    const inApp = await context(app),
      p = await inApp.newPage();
    await p.goto(origin + path);
    await p.getByRole("heading", { name: heading, exact: true }).waitFor();
    assert.equal(new URL(p.url()).pathname, "/sign-up", "one hop to sign-up");
    assert.equal(
      new URL(p.url()).search,
      path.startsWith("/try") ? "" : "?entry=pitch-buy",
      "the in-app address",
    );
    assert.deepEqual(await signUpIntent(p), intent, "the tab keeps why");
    await p
      .getByLabel("Email", { exact: true })
      .fill("private-draft@example.test");
    await p
      .getByLabel("Password", { exact: true })
      .fill("private-draft-password");
    await p.locator('[data-provider="google"]').click();
    const [handoff] = await handoffs(p);
    assert.ok(!handoff.includes("private-draft"), "the draft stays here");
    assert.equal(socialStarts.length, 0, "Google never starts in the webview");
    // The handoff's address carries the tab's arrival as a query (the other
    // browser's storage starts empty) and still starts Google there.
    const target = new URL(opened(handoff));
    assert.equal(target.pathname, "/sign-up");
    assert.equal(target.hash, "#continue-with-google");
    const arrival = Object.fromEntries(target.searchParams);
    assert.deepEqual(
      arrival,
      intent.entry === "pitch-try"
        ? {
            entry: "pitch-try",
            program: "ar-efa",
            utm_campaign: "ar-efa-launch",
            utm_source: "google",
            utm_medium: "cpc",
          }
        : { entry: "pitch-buy" },
      "the handoff carries the arrival",
    );
    const ordinary = await context(false),
      q = await ordinary.newPage();
    await q.route(`${origin}/provider-stub`, (route) =>
      route.fulfill({ contentType: "text/html", body: "<p>Provider</p>" }),
    );
    // A fresh tab opened by the jump.
    await q.goto(target.href);
    await q.waitForURL(`${origin}/provider-stub`);
    assert.equal(socialStarts.length, 1, "Google starts once on arrival");
    assert.equal(socialStarts[0].provider, "google");
    assert.equal(
      new URL(q.url()).pathname,
      "/provider-stub",
      "the provider replaces the sign-in",
    );
    // Back from the provider shows the sign-in, on its clean address;
    // Google doesn't start again.
    await q.goBack();
    await q.locator('[data-provider="google"]').waitFor();
    await settleArrival(q);
    assert.equal(socialStarts.length, 1, "Back never re-enters Google");
    assert.equal(new URL(q.url()).pathname, "/sign-up");
    assert.equal(new URL(q.url()).search, "", "the far address is clean");
    await q.getByRole("heading", { name: heading, exact: true }).waitFor();
    assert.deepEqual(await signUpIntent(q), intent, "the far tab keeps why");
    assert.deepEqual(
      await q.evaluate(() => ({
        program: sessionStorage.getItem("amp.program-choice"),
        labels: JSON.parse(
          sessionStorage.getItem("amp.arrival-labels") ?? "null",
        ),
      })),
      intent.entry === "pitch-try"
        ? {
            program: "ar-efa",
            labels: {
              utm_campaign: "ar-efa-launch",
              utm_source: "google",
              utm_medium: "cpc",
            },
          }
        : { program: null, labels: null },
      "the far tab keeps the program and campaign",
    );
    assert.equal(
      await q.getByLabel("Email", { exact: true }).inputValue(),
      "",
      "the draft never crosses browsers",
    );
    // No browser opened from the webview: the app's own "open in browser"
    // opens its address, which takes the whole arrival along too
    // (features/auth/OpenInBrowser.tsx), and keeps it once settled.
    await p.locator("[data-browser-hint]").waitFor();
    await settleArrival(p);
    const menu = new URL(p.url());
    assert.equal(menu.pathname, "/sign-up", `${app}: the menu's address`);
    assert.deepEqual(
      Object.fromEntries(menu.searchParams),
      arrival,
      `${app}: the address the app's "open in browser" opens keeps the arrival`,
    );
    socialStarts = [];
    console.log(`PASS ${app} ${path} one-tap Google in the real browser`);
    await inApp.close();
    await ordinary.close();
  }
  // Follow real invitation/approval routes into auth, then cross storage boundaries.
  for (const kind of ["school-invite", "family-approval"])
    for (const method of ["", "google", "passkey"]) {
      const destination =
        kind === "school-invite" ? "/school/invite" : "/family/approve";
      // The school invitation has one way forward, "Continue", which opens
      // the screen its address needs: creating an account, or signing in
      // when it has one. The family approval still offers both.
      const forward = (haveOne: boolean) =>
        kind === "school-invite"
          ? "Continue"
          : haveOne
            ? "I already have one"
            : "Create an account";
      const fragment = "r".repeat(43) + "." + "s".repeat(43);
      // An invited address with an account opens the sign-in; its "Create
      // an account" (SignInScreen "New to AMP?") still leads to creating
      // one, which answers with the method that account uses.
      const createHere = async (page: import("playwright").Page) => {
        if (kind === "school-invite")
          await page
            .getByRole("button", { name: "Create an account", exact: true })
            .click();
      };
      const app = await context("instagram-0", method),
        p = await app.newPage();
      const ordinary = await context(false, method),
        q = await ordinary.newPage();
      try {
        await p.goto(origin + destination + "#" + fragment);
        await p
          .getByRole("link", { name: forward(false), exact: true })
          .click();
        await p.getByLabel("Password", { exact: true }).waitFor();
        if (method) await createHere(p);
        assert.equal(new URL(p.url()).searchParams.get("return"), kind);
        const before = await p.evaluate(async () => {
          // @ts-expect-error Vite serves this source module in the browser.
          const mod = await import("/src/web/lib/funded-entry.ts");
          return mod.continuationUrl(
            Object.fromEntries(new URL(location.href).searchParams),
          );
        });
        assert.equal(before, destination + "#" + fragment);
        if (method) {
          await p
            .getByLabel("Email", { exact: true })
            .fill("parent@example.test");
          await p
            .getByLabel("Password", { exact: true })
            .fill("synthetic-password");
          await p
            .getByRole("button", { name: "Create account", exact: true })
            .click();
          await p.locator("[data-method-hint]").waitFor();
        }
        // Google (offered directly, or as this account's method) jumps; a
        // passkey account continues in Safari. Either way the invitation
        // leaves as its own link: this browser's storage stays here.
        if (method === "passkey")
          await p
            .getByRole("button", { name: "Continue in Safari", exact: true })
            .click();
        else
          await p
            .locator(
              method
                ? '[data-method-hint] [data-provider="google"]'
                : '[data-provider="google"]',
            )
            .click();
        const copied = opened((await handoffs(p))[0]);
        assert.equal(
          copied,
          origin + destination + "#" + fragment,
          "handoff preserves canonical fragment link",
        );
        await q.goto(copied);
        await q
          .getByRole("link", { name: forward(false), exact: true })
          .waitFor();
        // Opening the link holds it in this page's memory only: nothing
        // another tab or a later page could read (capability-entry.ts).
        assert.equal(
          await q.evaluate((key) => localStorage.getItem(key), `amp.${kind}`),
          null,
        );
        await q
          .getByRole("link", {
            name: forward(!!method),
            exact: true,
          })
          .click();
        // Leaving to authenticate carries it, with its lifetime
        // (lib/link-carry.ts).
        assert.equal(
          await q.evaluate(
            (key) => JSON.parse(localStorage.getItem(key) ?? "null")?.value,
            `amp.${kind}`,
          ),
          fragment,
        );
        await q.locator('[data-provider="google"]').waitFor();
        await q
          .getByRole("button", {
            name: method
              ? "Sign in with a passkey"
              : "Create account with a passkey",
            exact: true,
          })
          .waitFor();
        const after = await q.evaluate(async () => {
          // @ts-expect-error Vite serves this source module in the browser.
          const mod = await import("/src/web/lib/funded-entry.ts");
          return mod.continuationUrl(
            Object.fromEntries(new URL(location.href).searchParams),
          );
        });
        assert.equal(after, destination + "#" + fragment);
        await q.goto(origin + after);
        await q
          .getByRole("link", { name: forward(false), exact: true })
          .waitFor();
        assert.equal(
          await q.getByRole("heading", { name: /isn’t valid/ }).count(),
          0,
        );
        await settleArrival(q);
        if (!method)
          await q.screenshot({
            path: output + "/" + kind + "-restored.png",
            fullPage: true,
          });
        console.log(
          `PASS ${kind}/${method || "new-account"} fresh-browser continuation`,
        );
      } catch (error) {
        failures.push(`${kind}/${method || "new-account"}`);
        console.error(
          String(error).replaceAll(fragment, "[synthetic fragment]"),
        );
      } finally {
        await app.close();
        await ordinary.close();
      }
    }
  assert.deepEqual(failures, [], "fresh-browser handoff regressions");
} finally {
  await browser.close();
  await vite.close();
}
