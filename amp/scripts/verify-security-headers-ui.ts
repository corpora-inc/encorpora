import { secureChromium } from "../browser-security.mjs";
/**
 * The production build under the Content Security Policy that nginx sends
 * (docker/security-headers.conf): no violation on any signed-in screen, in the
 * pitch with its film playing, or with Google Analytics loaded. Analytics hits
 * are answered locally, so nothing reaches Google.
 *
 *   npm run build
 *   AMP_TEST_DATABASE_URL=postgres://…/amp_shell_fixture \
 *     npx tsx scripts/verify-security-headers-ui.ts [--engine webkit]
 */
import { readFileSync } from "node:fs";
import {
  chromium as rawChromium,
  webkit,
  type BrowserContext,
  type Page,
} from "playwright";
import { shellScenarios, startShellFixture } from "./app-shell-fixture";

const engineName = process.argv.includes("webkit") ? "webkit" : "chromium";
const policy = /Content-Security-Policy "([^"]+)"/.exec(
  readFileSync("docker/security-headers.conf", "utf8"),
)?.[1];
if (!policy) throw new Error("No Content-Security-Policy in the header file");
// The dev and preview servers answer on plain HTTP, which this directive would
// break locally. Everything else is exactly what production sends.
const local = policy.replace("; upgrade-insecure-requests", "");
const fixture = await startShellFixture({
  production: true,
  webPort: Number(process.env.AMP_HEADERS_WEB_PORT ?? 4970),
});
const browser = await (
  engineName === "webkit" ? webkit : secureChromium(rawChromium)
).launch();
const failures: string[] = [];

async function guard(context: BrowserContext) {
  await context.addInitScript(
    `globalThis.__violations=[];document.addEventListener("securitypolicyviolation",(e)=>globalThis.__violations.push(e.effectiveDirective+" "+e.blockedURI));`,
  );
  await context.route(
    (url) =>
      url.protocol === "http:" &&
      url.origin === fixture.origin &&
      !/^\/(assets|api)\//.test(url.pathname),
    async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: { ...response.headers(), "content-security-policy": local },
      });
    },
  );
}
const violations = (page: Page) =>
  page.evaluate(
    () => (globalThis as unknown as { __violations: string[] }).__violations,
  );

for (const scenario of shellScenarios(fixture)) {
  const context = await fixture.context(browser, scenario.state, {
    viewport: { width: 390, height: 844 },
  });
  await guard(context);
  const page = await context.newPage();
  await page.goto(`${fixture.origin}${scenario.path}`);
  await page.waitForLoadState("load");
  await page.waitForTimeout(1500);
  const found: string[] = await violations(page);
  if (found.length) failures.push(`${scenario.id}: ${found.join(", ")}`);
  await context.close();
}

// The signed-out pitch as a real visitor sees it: analytics on, film playing.
{
  const context = await fixture.context(browser, "guest", {
    viewport: { width: 390, height: 844 },
  });
  await context.addInitScript(
    `Object.defineProperty(navigator,"webdriver",{get:()=>false});`,
  );
  await guard(context);
  await context.route(/google-analytics\.com|analytics\.google\.com/, (route) =>
    route.fulfill({ status: 204, body: "" }),
  );
  const page = await context.newPage();
  await page.goto(`${fixture.origin}/`);
  await page.getByRole("button", { name: /^Play video/ }).click();
  await page.waitForFunction(
    () => (document.querySelector("video")?.currentTime ?? 0) > 0.3,
    undefined,
    { timeout: 30_000 },
  );
  const found: string[] = await violations(page);
  if (found.length) failures.push(`pitch: ${found.join(", ")}`);
  await context.close();
}

await browser.close();
await fixture.close();
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(
  `PASS ${engineName}: no Content Security Policy violation on any screen, the pitch's film, or its analytics`,
);
process.exit(0);
