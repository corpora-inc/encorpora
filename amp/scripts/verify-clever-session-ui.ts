import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import type { AuthSession } from "../src/web/auth.js";

// Exercise the real browser session adapter, including storage and redirect
// completion; only the external API responses are replaced.
const port = Number(process.env.AMP_CLEVER_SESSION_UI_PORT ?? 4978);
const origin = `http://127.0.0.1:${port}`;
const vite = await createServer({
  ...(process.env.AMP_VITE_CACHE_DIR
    ? { cacheDir: process.env.AMP_VITE_CACHE_DIR }
    : {}),
  root: fileURLToPath(new URL("../", import.meta.url)),
  configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
  server: { host: "127.0.0.1", port, strictPort: true },
  plugins: [
    {
      name: "clever-session-fixture",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.url !== "/clever-session-fixture") return next();
          response.setHeader("content-type", "text/html");
          response.end(
            '<script type="module">import * as auth from "/src/web/auth.ts"; import * as device from "/src/web/lib/student-device.ts"; import * as onboarding from "/src/web/features/school/clever/onboarding-session.ts"; window.fixture={auth,device,onboarding};</script>',
          );
        });
      },
    },
  ],
});
await vite.listen();
const browser = await secureChromium(rawChromium).launch({ headless: true });
try {
  const page = await browser.newPage();
  type Fixture = {
    auth: {
      accessSession(): Promise<AuthSession | null>;
      signOut(): Promise<void>;
    };
    onboarding: {
      cleverOnboardingSession(): Promise<{
        token: string;
        accountId: string;
        expiresAt: string;
      } | null>;
    };
    device: {
      rememberStudentSession(session: AuthSession, mode: "shared"): void;
      clearStudentDevice(): void;
    };
  };
  const provider = {
    token: `ps_${"p".repeat(43)}`,
    accountId: "amp|provider-fixture",
  };
  const student = {
    token: `st_${"s".repeat(43)}`,
    accountId: "school:student-fixture",
  };
  const onboarding = {
    token: `po_${"o".repeat(43)}`,
    accountId: provider.accountId,
    expiresAt: new Date(Date.now() + 600000).toISOString(),
  };
  let onboardingActive = true;
  let providerState: "active" | "expired" | "none" = "active";
  let parentReads = 0,
    providerReads = 0,
    signOuts = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/events")
      return route.fulfill({ status: 202, json: { accepted: 1 } });
    if (path === "/api/v1/auth-config")
      return route.fulfill({
        json: {
          mode: "accounts",
          passwords: true,
          providers: [],
          clever: true,
        },
      });
    if (path === "/api/v1/provider/onboarding-session") {
      assert.equal(
        route.request().headers().authorization,
        `Bearer ${onboarding.token}`,
      );
      return onboardingActive
        ? route.fulfill({ json: onboarding })
        : route.fulfill({
            status: 401,
            json: { error: "clever_onboarding_expired" },
          });
    }
    if (path === "/api/v1/provider/session") {
      providerReads++;
      return providerState === "active"
        ? route.fulfill({ json: provider })
        : route.fulfill({
            status: 401,
            json: {
              error:
                providerState === "expired"
                  ? "provider_session_expired"
                  : "sign_in_required",
            },
          });
    }
    if (path === "/api/auth/get-session") {
      parentReads++;
      return route.fulfill({
        json: {
          session: { token: "parent-token" },
          user: { id: "parent-fixture", name: "Parent" },
        },
      });
    }
    if (path === "/api/v1/provider/sign-out" || path === "/api/auth/sign-out") {
      signOuts++;
      return route.fulfill({ json: { success: true } });
    }
    throw new Error(`Unexpected fixture API ${path}`);
  });
  await page.goto(`${origin}/clever-session-fixture`);
  await page.waitForFunction(() => "fixture" in window);
  // The server sets a readable hint with a school sign-in; the app asks for
  // the session only when it is there.
  const hint = (on: boolean) =>
    page.evaluate(
      (value) => {
        document.cookie = `amp.provider=${value}; path=/${value ? "" : "; max-age=0"}`;
      },
      on ? "1" : "",
    );
  await hint(true);
  const checked = () =>
    page.evaluate(() =>
      (window as unknown as { fixture: Fixture }).fixture.auth.accessSession(),
    );
  assert.deepEqual(await checked(), provider);
  assert.equal(parentReads, 0);
  await page.evaluate(
    (session) =>
      (
        window as unknown as { fixture: Fixture }
      ).fixture.device.rememberStudentSession(session, "shared"),
    student,
  );
  const before = providerReads;
  assert.deepEqual(await checked(), student);
  assert.equal(providerReads, before);
  // A guessed completion marker cannot expose the existing adult cookie.
  await page.evaluate(() => {
    location.hash = "clever-session=wrong";
  });
  assert.deepEqual(await checked(), student);
  await page.evaluate((token) => {
    location.hash = `clever-session=${token}`;
  }, provider.token);
  assert.deepEqual(await checked(), provider);
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("amp.student")),
    null,
  );
  assert.equal(await page.evaluate(() => location.hash), "");
  providerState = "expired";
  assert.equal(await checked(), null);
  assert.equal(parentReads, 0);
  // Reauthorization has its own short-lived storage and is never an account
  // credential. It clears an older student only after its proof is validated.
  await page.evaluate(
    ({ student, token }) => {
      (
        window as unknown as { fixture: Fixture }
      ).fixture.device.rememberStudentSession(student, "shared");
      location.hash = `clever-onboarding=${token}`;
    },
    { student, token: onboarding.token },
  );
  const setup = () =>
    page.evaluate(() =>
      (
        window as unknown as { fixture: Fixture }
      ).fixture.onboarding.cleverOnboardingSession(),
    );
  assert.deepEqual(await setup(), onboarding);
  assert.equal(await page.evaluate(() => location.hash), "");
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("amp.student")),
    null,
  );
  assert.equal(await checked(), null);
  assert.equal(parentReads, 0);
  onboardingActive = false;
  assert.equal(await setup(), null);
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("amp.clever.onboarding")),
    null,
  );
  providerState = "none";
  assert.equal((await checked())?.accountId, "amp|parent-fixture");
  assert.equal(parentReads, 1);
  // No school sign-in on this browser: no provider round trip at all.
  await hint(false);
  const reads = providerReads;
  assert.equal((await checked())?.accountId, "amp|parent-fixture");
  assert.equal(providerReads, reads);
  // Both session kinds are revoked before browser navigation on sign out.
  await page.route(`${origin}/`, (route) =>
    route.fulfill({ contentType: "text/html", body: "Signed out" }),
  );
  await page.evaluate(() =>
    (window as unknown as { fixture: Fixture }).fixture.auth.signOut(),
  );
  await page.waitForURL(`${origin}/`);
  assert.equal(signOuts, 2);
  console.log(
    "Clever browser session checks passed: shared-device precedence, verified completion, expiry and sign-out.",
  );
} finally {
  await browser.close();
  await vite.close();
}
