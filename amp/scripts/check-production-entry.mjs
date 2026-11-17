#!/usr/bin/env node
// After each web release, production's public entry in a real browser:
// `/` and `/sign-up` in Chromium (Android) and WebKit (iOS), as a standard
// browser and inside the Facebook, Instagram and TikTok apps. The API's own
// health check can pass while the web tier serves nothing (2026-11-17: nginx
// crash-looped on its route map and nothing noticed), so this loads the pages
// people land on. Read-only: page loads only, no account, no form. A driven
// browser reports itself (navigator.webdriver), so AMP counts it as automated
// and never loads the Google tag for it.
//
//   node amp/scripts/check-production-entry.mjs [https://amp.corpora.inc]
//
// Plain Node and Playwright only, so CI runs it without installing the app.
import { chromium, webkit } from "playwright";

const base = (process.argv[2] ?? "https://amp.corpora.inc").replace(/\/$/, "");
const ios = (tail, safari = false) =>
  `Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) ${safari ? "Version/18.1 " : ""}Mobile/15E148${tail}`;
const android = (tail, webview = true) =>
  `Mozilla/5.0 (Linux; Android 14; Pixel 8${webview ? " Build/AP2A.240905.003; wv" : ""}) AppleWebKit/537.36 (KHTML, like Gecko) ${webview ? "Version/4.0 " : ""}Chrome/130.0.6723.107 Mobile Safari/537.36${tail}`;
const agents = {
  chromium: {
    standard: android("", false),
    facebook: android(" [FB_IAB/FB4A;FBAV/489.0.0.40.109;]"),
    instagram: android(
      " Instagram 355.0.0.29.82 Android (34/14; 420dpi; 1080x2400; Google/google; Pixel 8; shiba; shiba; en_US; 652843921)",
    ),
  },
  webkit: {
    standard: ios(" Safari/604.1", true),
    facebook: ios(
      " [FBAN/FBIOS;FBAV/489.0.0.40.109;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.1;FBLC/en_US]",
    ),
    instagram: ios(
      " Instagram 355.0.0.29.82 (iPhone15,2; iOS 18_1; en_US; en; scale=3.00; 1179x2556; 652843921)",
    ),
    tiktok: ios(
      " musical_ly_37.5.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/US WKWebView/1 BytedanceWebview/d8a21c6",
    ),
  },
};
// Any of these on screen means a visitor is stuck.
const stuck =
  /This screen could not be loaded|This page didn’t finish loading|AMP didn’t finish loading|Something went wrong|This browser can’t run AMP/;
const pages = [
  {
    path: "/",
    ready: (page) =>
      page
        .getByRole("link", { name: /^Try it free/ })
        .or(page.getByRole("button", { name: /^Try it free/ }))
        .first(),
  },
  {
    path: "/sign-up",
    ready: (page) => page.getByRole("button", { name: "Continue with Google" }),
  },
];

const release = await fetch(`${base}/version.json`, { cache: "no-store" })
  .then((response) => (response.ok ? response.json() : {}))
  .catch((error) => {
    console.warn(`version.json didn't load: ${error}`);
    return {};
  });
console.log(`Checking ${base}, web release ${release.commit ?? "unknown"}`);

const failures = [];
for (const [engineName, engine] of [
  ["chromium", chromium],
  ["webkit", webkit],
]) {
  const browser = await engine.launch();
  try {
    for (const [app, userAgent] of Object.entries(agents[engineName]))
      for (const { path, ready } of pages) {
        const tag = `${engineName} ${app} ${path}`;
        const context = await browser.newContext({
          userAgent,
          viewport: { width: 390, height: 844 },
        });
        const problems = [];
        try {
          await context.addInitScript(() => {
            globalThis.__violations = [];
            document.addEventListener("securitypolicyviolation", (event) =>
              globalThis.__violations.push(
                `${event.effectiveDirective} ${event.blockedURI}`,
              ),
            );
          });
          const page = await context.newPage();
          page.on("response", (response) => {
            const url = new URL(response.url());
            if (
              url.origin === base &&
              response.status() >= 400 &&
              // The app's own probes may answer 401/404 by design; its files
              // and documents may not.
              !url.pathname.startsWith("/api/")
            )
              problems.push(`${url.pathname} answered ${response.status()}`);
          });
          page.on("pageerror", (error) => {
            const frame = (error.stack ?? "").match(/\/assets\/[\w.-]+\.js/);
            if (frame)
              problems.push(`page error in ${frame[0]}: ${error.message}`);
          });
          const response = await page.goto(`${base}${path}`, {
            timeout: 45_000,
          });
          if (response?.status() !== 200)
            problems.push(`document answered ${response?.status()}`);
          await ready(page).waitFor({ timeout: 45_000 });
          const text = await page.locator("body").innerText();
          const shown = text.match(stuck);
          if (shown) problems.push(`shows "${shown[0]}"`);
          const violations = await page.evaluate(() => globalThis.__violations);
          if (violations.length)
            problems.push(`content policy blocked ${violations.join(", ")}`);
        } catch (error) {
          problems.push(String(error).split("\n")[0]);
        } finally {
          await context.close();
        }
        if (problems.length) failures.push(`${tag}: ${problems.join("; ")}`);
        console.log(`${problems.length ? "FAIL" : "ok  "} ${tag}`);
      }
  } finally {
    await browser.close();
  }
}
if (failures.length) {
  console.error(
    `\nProduction's public entry is broken (${failures.length}):\n  ${failures.join("\n  ")}`,
  );
  process.exit(1);
}
console.log("Production's public entry works in every browser checked.");
