import { secureChromium } from "../browser-security.mjs";
/**
 * Every wait on the server looks alive. The API runs slow (`SLOW` per request)
 * against realistic data (see app-shell-fixture.ts) and each screen is sampled
 * until the requests finish: at no sample is the page blank and still, no
 * loading message sits without movement, `/practice` never flashes the overview
 * on its way to a problem, and the button that was pressed shows the moving
 * wave while the rest stay quiet.
 *
 *   AMP_TEST_DATABASE_URL=postgres://…/amp_shell_fixture \
 *     npx tsx scripts/verify-loading-ui.ts [--engine webkit] [--shots DIR]
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium, webkit, type Page } from "playwright";
import { shellScenarios, startShellFixture } from "./app-shell-fixture";

const argument = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
};
const engine = argument("engine") ?? "chromium";
const shots = argument("shots");
if (shots) await mkdir(shots, { recursive: true });
const SLOW = 700;
const viewport = { width: 390, height: 844 };
const fixture = await startShellFixture({
  webPort: Number(process.env.AMP_LOADING_WEB_PORT ?? 4960),
});
const browser = await (
  engine === "webkit" ? webkit : secureChromium(rawChromium)
).launch();
const failures: string[] = [];
const check = (ok: unknown, message: string) => {
  if (!ok) failures.push(message);
};

type Sample = {
  text: number;
  words: string;
  moving: string[];
  waiting: string[];
  overview: boolean;
};
const sample = (page: Page) =>
  page.evaluate((): Sample => {
    const text = (document.body.innerText || "").trim().replace(/\s+/g, " ");
    const running = document
      .getAnimations()
      .filter(
        (animation) =>
          animation.playState === "running" &&
          animation.effect?.getTiming().iterations === Infinity,
      ) as CSSAnimation[];
    return {
      text: text.length,
      words: text.slice(0, 60),
      moving: running.map((animation) => animation.animationName),
      waiting: [...document.querySelectorAll("p, h1, h2, strong, span, div")]
        .filter(
          (node) =>
            node.childElementCount === 0 &&
            /^(Loading|Gathering|Getting your|Finding your|Opening your)\b.*…$/.test(
              node.textContent?.trim() ?? "",
            ),
        )
        .map((node) => node.textContent!.trim()),
      overview: !!document.querySelector(".frontier-map"),
    };
  });

/** Slow every request, run `act`, and sample until the requests settle. */
async function watch(page: Page, act: () => unknown, limit = 15_000) {
  let open = 0;
  // Analytics travel in the background; nobody waits on them.
  const counts = (request: { url(): string }) =>
    request.url().includes("/api/") && !request.url().includes("/v1/events");
  const started = (request: { url(): string }) => {
    if (counts(request)) open += 1;
  };
  const ended = (request: { url(): string }) => {
    if (counts(request)) open -= 1;
  };
  page.on("request", started);
  page.on("requestfinished", ended);
  page.on("requestfailed", ended);
  const seen: (Sample & { open: number })[] = [];
  const start = Date.now();
  void Promise.resolve(act()).catch((error) => {
    failures.push(`action failed: ${String(error).slice(0, 160)}`);
  });
  let quiet = 0;
  while (Date.now() - start < limit) {
    const current = await sample(page).catch(() => null);
    if (current) seen.push({ ...current, open });
    if (open > 0) quiet = 0;
    else if (!quiet) quiet = Date.now();
    else if (Date.now() - quiet > 900) break;
    await page.waitForTimeout(50);
  }
  page.off("request", started);
  page.off("requestfinished", ended);
  page.off("requestfailed", ended);
  return seen;
}
const slow = (page: Page) =>
  page.route("**/api/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, SLOW));
    await route.fallback();
  });
function alive(id: string, seen: (Sample & { open: number })[]) {
  const dead = seen.filter(
    (entry) => entry.open > 0 && entry.text < 40 && !entry.moving.length,
  );
  check(!dead.length, `${id}: blank and still while waiting (${dead.length})`);
  const silent = seen.filter(
    (entry) => entry.waiting.length && !entry.moving.length,
  );
  check(
    !silent.length,
    `${id}: "${silent[0]?.waiting[0]}" with nothing moving`,
  );
}
const shot = async (page: Page, name: string) => {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png` });
};

// Every signed-in screen, and both ways into a problem.
const routes = [
  ...shellScenarios(fixture)
    .filter((scenario) => scenario.state !== "guest")
    .map(({ id, path, state }) => ({ id, path, state })),
  { id: "paid-practice", path: "/practice", state: "paid" as const },
  { id: "starter-practice", path: "/practice", state: "starter" as const },
];
for (const route of routes) {
  const context = await fixture.context(browser, route.state, { viewport });
  const page = await context.newPage();
  await slow(page);
  const seen = await watch(page, () =>
    page.goto(`${fixture.origin}${route.path}`),
  );
  alive(route.id, seen);
  if (route.id === "paid-practice")
    check(
      !seen.some((entry) => entry.overview),
      "/practice flashed the overview on its way to a problem",
    );
  if (route.id.endsWith("-practice")) {
    const waited = seen.filter((entry) => entry.open > 0 && entry.text < 40);
    check(waited.length > 3, `${route.id}: the wait was measured`);
    const still = waited.filter(
      (entry) => !entry.moving.includes("amp-loading-wave"),
    );
    check(
      !still.length,
      `${route.id}: the wave moves until the problem arrives (${still.length} of ${waited.length} still: ${JSON.stringify(still[0])})`,
    );
    check(
      seen.at(-1)!.text > 40,
      `${route.id}: a problem arrived (${seen.at(-1)!.words})`,
    );
  }
  await context.close();
}

/** The pressed control shows the moving wave soon after the press. */
async function pressed(page: Page, name: RegExp, id: string) {
  const control = page.getByRole("button", { name }).first();
  await control.click();
  await page.waitForTimeout(320);
  const state = await control.evaluate((node) => ({
    busy: node.getAttribute("aria-busy"),
    wave: node
      .getAnimations({ subtree: true })
      .some(
        (animation) =>
          (animation as CSSAnimation).animationName === "amp-wave-flow" &&
          animation.playState === "running",
      ),
    label: getComputedStyle(node).webkitTextFillColor,
    others: [...document.querySelectorAll('button[aria-busy="true"]')].filter(
      (other) => other !== node,
    ).length,
  }));
  check(state.busy === "true", `${id}: pressed control is busy`);
  check(state.wave, `${id}: the wave moves on the pressed control`);
  check(state.others === 0, `${id}: only the pressed control shows the wave`);
  await shot(page, id);
}

// Sign in, enter practice from the overview, then Skip on a slow connection.
{
  const context = await browser.newContext({ viewport });
  await context.addInitScript("globalThis.__name ??= (f) => f;");
  const page = await context.newPage();
  await page.goto(`${fixture.origin}/sign-in`);
  await page.getByLabel("Email").fill(fixture.paid.email);
  await page
    .getByLabel("AMP password")
    .fill("synthetic long fixture passphrase");
  await slow(page);
  await pressed(page, /^Sign in$/, "sign-in-button");
  const signingIn = await watch(page, () => undefined);
  alive("sign-in", signingIn);
  await page.waitForURL(/\/school\/[^/]+\/classes\/[^/]+\/today$/);
  await page
    .getByRole("heading", {
      name: /^(Good (morning|afternoon|evening)|(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day, )/,
    })
    .waitFor();
  await page.goto(`${fixture.origin}/overview`);
  await page.locator('.frontier-map[aria-busy="false"]').waitFor();
  await page.locator(".go-button:not([disabled])").waitFor();
  await pressed(page, /^(Go|Continue)$/, "go-button");
  await page
    .getByRole("button", { name: /^Skip/ })
    .waitFor({ timeout: 30_000 });
  check(
    new URL(page.url()).pathname === "/practice",
    "Go opens the practice route",
  );
  await page.waitForTimeout(SLOW * 3);
  await pressed(page, /^Skip/, "skip-button");
  await context.close();
}

// While a problem loads, and over a frame: what a parent actually sees.
if (shots) {
  const context = await fixture.context(browser, "starter", { viewport });
  const page = await context.newPage();
  await slow(page);
  void page.goto(`${fixture.origin}/practice`).catch(() => undefined);
  await page.locator(".app-loading-overlay").waitFor({ timeout: 25_000 });
  await page.waitForTimeout(200);
  await shot(page, "first-problem");
  await context.close();
}

await browser.close();
await fixture.close();
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(
  `PASS ${engine}: ${routes.length} screens stay alive at ${SLOW} ms a request; /practice goes straight to its problem; the pressed button shows the wave`,
);
process.exit(0);
