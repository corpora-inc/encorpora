import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium } from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
import { settleArrival } from "./ui-settle";
import { userAgents } from "../tests/fixtures/in-app-user-agents";

// Real clipboard and isolated storage; API replies are synthetic.
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
  cacheDir: "node_modules/.vite-in-app-handoff",
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
async function context(inApp: boolean, method = "") {
  const c = await browser.newContext({
    viewport: { width: 390, height: 844 },
    ...(inApp
      ? { userAgent: userAgents.find((a) => a.name === "instagram-0")!.ua }
      : {}),
    permissions: ["clipboard-read", "clipboard-write"],
  });
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
    if (p.endsWith("/invites/lookup"))
      return route.fulfill({
        json: {
          invite: {
            status: "open",
            orgName: "Review School",
            role: "teacher",
            email: null,
            setup: false,
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
  // Exercise the real Clipboard API and paste into an isolated standard browser.
  for (const path of [
    "/try?entry=pitch-try&return=free-practice",
    "/sign-up?entry=pitch-buy",
  ]) {
    const app = await context(true),
      p = await app.newPage();
    await p.goto(origin + path);
    await p
      .getByLabel("Email", { exact: true })
      .fill("private-draft@example.test");
    await p
      .getByLabel("Password", { exact: true })
      .fill("private-draft-password");
    await p
      .getByRole("button", { name: "Open in your browser", exact: true })
      .click();
    await p.getByText("Link copied.", { exact: false }).waitFor();
    const copied = await p.evaluate(() => navigator.clipboard.readText());
    assert.equal(copied, p.url());
    assert.ok(!copied.includes("private-draft"));
    const ordinary = await context(false),
      q = await ordinary.newPage();
    await q.goto(copied);
    await q.locator('[data-provider="google"]').waitFor();
    await q
      .getByRole("button", {
        name: "Create account with a passkey",
        exact: true,
      })
      .waitFor();
    assert.equal(
      new URL(q.url()).searchParams.get("entry"),
      new URL(p.url()).searchParams.get("entry"),
    );
    assert.equal(await q.getByLabel("Email", { exact: true }).inputValue(), "");
    console.log("PASS fresh-browser Try/Buy and absent clipboard");
    // Actual absent API, rather than a mocked rejected promise.
    await p.getByRole("button", { name: "Close", exact: true }).click();
    await p.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
      }),
    );
    await p
      .getByRole("button", { name: "Open in your browser", exact: true })
      .click();
    await p
      .getByText("Select and copy the page link", { exact: false })
      .waitFor();
    assert.equal(
      await p
        .getByLabel("Page link")
        .evaluate(
          (e: HTMLTextAreaElement) => e.selectionEnd - e.selectionStart,
        ),
      copied.length,
    );
    await app.close();
    await ordinary.close();
  }
  // Follow real invitation/approval routes into auth, then cross storage boundaries.
  for (const kind of ["school-invite", "family-approval"])
    for (const method of ["", "google", "passkey"]) {
      const destination =
        kind === "school-invite" ? "/school/invite" : "/family/approve";
      const fragment = "r".repeat(43) + "." + "s".repeat(43);
      const app = await context(true, method),
        p = await app.newPage();
      const ordinary = await context(false, method),
        q = await ordinary.newPage();
      try {
        await p.goto(origin + destination + "#" + fragment);
        await p
          .getByRole("link", { name: "Create an account", exact: true })
          .click();
        await p.getByLabel("Password", { exact: true }).waitFor();
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
        await p
          .getByRole("button", { name: "Open in your browser", exact: true })
          .click();
        await p.getByText("Link copied.", { exact: false }).waitFor();
        const copied = await p.evaluate(() => navigator.clipboard.readText());
        assert.equal(
          copied,
          origin + destination + "#" + fragment,
          "handoff preserves canonical fragment link",
        );
        await q.goto(copied);
        await q
          .getByRole("link", { name: "Create an account", exact: true })
          .waitFor();
        assert.equal(
          await q.evaluate((key) => localStorage.getItem(key), `amp.${kind}`),
          fragment,
        );
        await q
          .getByRole("link", {
            name: method ? "I already have one" : "Create an account",
            exact: true,
          })
          .click();
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
          .getByRole("link", { name: "Create an account", exact: true })
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
