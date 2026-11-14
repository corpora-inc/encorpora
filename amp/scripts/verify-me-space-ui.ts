/**
 * The Me space in a real browser (SPEC §5, R5, R15; QA notes Q-201, Q-204),
 * against a seeded design preview (scripts/design-preview.sh):
 *
 *   1. A brand-new adult opens /me: the level is not measured yet (the whole
 *      K → Precalc scale, a "?" on the dot, no grade named), searching
 *      unless the reader asks for reduced motion. Start practicing opens
 *      practice; after the first answer /me reads the normal estimate, and
 *      nothing moves once it has painted.
 *   2. Practice at a level at K, 4 and Algebra: one tap from the switcher's
 *      place, a grade and a pace, then practice at that level, as the
 *      account's one level profile.
 *   3. A family's child with no answers: the same unmeasured level.
 *
 * Every screen at 320, 390, 768 and 1280 px, light and dark: no sideways
 * scroll, no layout shift after the screen settles, no "My …" and no family
 * or class words in the Me space, and no console errors. Shots go to
 * $AMP_SHOTS.
 *
 *   AMP_PREVIEW_ORIGIN=http://127.0.0.1:4970 AMP_SHOTS=<dir> \
 *     npx tsx scripts/verify-me-space-ui.ts [--widths 390,1280] [--only level]
 */
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  chromium,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "playwright";

const origin = process.env.AMP_PREVIEW_ORIGIN ?? "http://127.0.0.1:4970";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
  throw new Error(`Loopback previews only: ${origin}`);
const shots = process.env.AMP_SHOTS ?? "artifacts/me-space";
mkdirSync(shots, { recursive: true });
const widthArg = process.argv.indexOf("--widths");
const WIDTHS =
  widthArg > 0
    ? process.argv[widthArg + 1]!.split(",").map(Number)
    : [320, 390, 768, 1280];
const SCHEMES = ["light", "dark"] as const;
const PASSWORD = "design pass persona passphrase";
/** `--only day0,answer,level,family`: some parts of the journey. */
const onlyArg = process.argv.indexOf("--only");
const ONLY =
  onlyArg > 0 ? new Set(process.argv[onlyArg + 1]!.split(",")) : null;
const part = (name: string) => !ONLY || ONLY.has(name);
/** Words the Me space never shows in its chrome. */
const NEVER_ME =
  /\b(family|kids|children|students?|roster|class code)\b|\bMy [A-Z]/;

const failures: string[] = [];
const fail = (where: string, what: string) => {
  failures.push(`${where}: ${what}`);
  console.error(`FAIL ${where}: ${what}`);
};
const browser = await chromium.launch();

/** A context for the reader: signed in by cookie, measurement off, layout
 * shifts summed from the first paint. */
async function reader(
  width: number,
  scheme: (typeof SCHEMES)[number],
  reducedMotion: "reduce" | "no-preference" = "no-preference",
) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    colorScheme: scheme,
    reducedMotion,
  });
  await context.route("**/api/v1/events", (route) =>
    route.fulfill({ status: 202, json: {} }),
  );
  await context.addInitScript("window.__name = (f) => f;");
  await context.addInitScript(() => {
    (window as unknown as { __shift: number }).__shift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
      }[])
        if (!entry.hadRecentInput)
          (window as unknown as { __shift: number }).__shift += entry.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  return context;
}

async function signIn(context: BrowserContext, email: string) {
  const response = await context.request.post(
    `${origin}/api/auth/sign-in/email`,
    { headers: { Origin: origin }, data: { email, password: PASSWORD } },
  );
  if (!response.ok()) throw new Error(`${email} sign-in ${response.status()}`);
}

/** The bearer token the app itself uses, for setting up state by API. */
async function token(request: APIRequestContext) {
  const session = await (
    await request.get(`${origin}/api/auth/get-session`)
  ).json();
  return session.session.token as string;
}

async function api<T>(
  request: APIRequestContext,
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await request.fetch(`${origin}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await token(request)}`,
      Origin: origin,
    },
    ...(body === undefined ? {} : { data: body }),
  });
  if (!response.ok()) throw new Error(`${method} ${path} ${response.status()}`);
  return (await response.json()) as T;
}

/** A brand-new adult who chose "I'm learning for myself": no answers. */
async function newAdult() {
  const email = `me-${randomUUID().slice(0, 8)}@personas.amp.test`;
  const context = await browser.newContext();
  const signed = await context.request.post(
    `${origin}/api/auth/sign-up/email`,
    {
      headers: { Origin: origin },
      data: { email, password: PASSWORD, name: "Morgan Vale" },
    },
  );
  if (!signed.ok()) throw new Error(`sign-up ${signed.status()}`);
  const { learnerId } = await api<{ learnerId: string }>(
    context.request,
    "POST",
    "/start",
    { as: "myself", timezone: "America/New_York", birthYear: 1988 },
  );
  await context.close();
  return { email, learnerId };
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(700);
}

async function check(page: Page, where: string, space: "me" | "other") {
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    text: [
      document.querySelector("header")?.textContent ?? "",
      document.querySelector("main")?.textContent ?? "",
    ].join(" "),
  }));
  if (result.overflow > 0)
    fail(where, `scrolls sideways by ${result.overflow}px`);
  if (/\bMy [A-Za-z]/.test(result.text))
    fail(where, `says "${/\bMy [A-Za-z]+/.exec(result.text)![0]}"`);
  if (space === "me" && NEVER_ME.test(result.text))
    fail(where, `says "${NEVER_ME.exec(result.text)![0]}"`);
}

/** Layout shift since `mark`, once the screen has settled. */
async function shift(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __shift: number }).__shift,
  );
}

/** The level not measured yet, as the hero or a record draws it. */
async function unmeasured(
  page: Page,
  where: string,
  scope: string,
  moving: "moving" | "still",
) {
  const state = await page.evaluate(
    ([scope]) => {
      const root = document.querySelector(scope!);
      const bar = root?.querySelector<HTMLElement>("[data-unmeasured]");
      const range = bar?.querySelector<HTMLElement>("[class*=range]");
      const track = bar?.querySelector<HTMLElement>("[class*=track]");
      const labels = [
        ...(root?.querySelectorAll("[data-level-axis-label]") ?? []),
      ].map((label) => label.textContent);
      // The words outside the axis: none names a grade.
      const words = [...(root?.querySelectorAll("p, h1, h2") ?? [])]
        .map((node) => node.textContent ?? "")
        .join(" ");
      return {
        bar: !!bar,
        mark: bar?.querySelector("[data-level-mark]")?.textContent ?? null,
        left: range?.style.left,
        width: range?.style.width,
        first: labels[0],
        last: labels.at(-1),
        animation: track ? getComputedStyle(track).animationName : null,
        words,
      };
    },
    [scope],
  );
  if (!state.bar) return fail(where, "no unmeasured level");
  if (state.mark !== "?") fail(where, `the dot carries ${state.mark}`);
  if (
    parseFloat(state.left ?? "1") !== 0 ||
    parseFloat(state.width ?? "0") < 99.9
  )
    fail(where, `the range spans ${state.left} + ${state.width}`);
  if (state.first !== "K" || state.last !== "Precalc")
    fail(where, `the axis runs ${state.first} to ${state.last}`);
  if (/\b(grade \d|gr \d|algebra|geometry|precalc)/i.test(state.words))
    fail(where, `names a grade: ${state.words.slice(0, 120)}`);
  const searching =
    state.animation === "level-search" || /search/.test(state.animation ?? "");
  if (moving === "moving" && !searching)
    fail(where, `the dot doesn't search (${state.animation})`);
  if (moving === "still" && state.animation !== "none")
    fail(where, `moves under reduced motion (${state.animation})`);
}

// 1. A brand-new adult: /me before and after the first answer.
const adult = await newAdult();
if (part("day0"))
  for (const width of WIDTHS)
    for (const scheme of SCHEMES) {
      const where = `/me day 0 ${width} ${scheme}`;
      const context = await reader(width, scheme);
      await signIn(context, adult.email);
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      await page.goto(`${origin}/me`, { waitUntil: "load" });
      await page.locator("[data-level-start]").waitFor();
      await settle(page);
      const mark = await shift(page);
      await unmeasured(page, where, "[data-level-start]", "moving");
      await check(page, where, "me");
      await page.waitForTimeout(1500);
      const moved = (await shift(page)) - mark;
      // The searching dot is transform-only: it never shifts the layout.
      if (moved > 0.001) fail(where, `layout shift ${moved.toFixed(3)}`);
      await page.screenshot({
        path: join(shots, `me-day0-${width}-${scheme}.png`),
        fullPage: true,
      });
      if (errors.length) fail(where, `console: ${errors[0]}`);
      await context.close();
    }

// Reduced motion: the full range and the "?" stand still.
if (part("day0")) {
  const context = await reader(390, "light", "reduce");
  await signIn(context, adult.email);
  const page = await context.newPage();
  await page.goto(`${origin}/me`, { waitUntil: "load" });
  await page.locator("[data-level-start]").waitFor();
  await settle(page);
  await unmeasured(page, "/me reduced motion", "[data-level-start]", "still");
  await page.screenshot({
    path: join(shots, "me-day0-390-reduced-motion.png"),
    fullPage: true,
  });
  await context.close();
}

// Start → practice → the first answer → the normal estimate.
if (part("answer")) {
  const context = await reader(390, "light");
  await signIn(context, adult.email);
  const page = await context.newPage();
  await page.goto(`${origin}/me`, { waitUntil: "load" });
  await page.locator("[data-level-start]").waitFor();
  await page.getByRole("link", { name: "Start practicing" }).click();
  await page.waitForURL(/\/practice/);
  await page
    .getByText(/Answer|Choose/)
    .first()
    .waitFor({ timeout: 30000 });
  await page.screenshot({ path: join(shots, "me-start-practice-390.png") });
  // The first answer, as practice sends it.
  const batch = await api<{ problems: { id: string }[] }>(
    context.request,
    "POST",
    `/learners/${adult.learnerId}/batches`,
    { count: 1 },
  );
  await api(context.request, "POST", `/learners/${adult.learnerId}/attempts`, {
    problemId: batch.problems[0]!.id,
    requestId: randomUUID(),
    response: "1",
  });
  await context.close();
  for (const width of WIDTHS)
    for (const scheme of SCHEMES) {
      const where = `/me after one answer ${width} ${scheme}`;
      const next = await reader(width, scheme);
      await signIn(next, adult.email);
      const after = await next.newPage();
      await after.goto(`${origin}/me`, { waitUntil: "load" });
      await after.locator("[data-testid=level-readout]").waitFor();
      await settle(after);
      const mark = await shift(after);
      if (await after.locator("[data-level-start]").count())
        fail(where, "still the day-0 hero");
      await check(after, where, "me");
      await after.waitForTimeout(1200);
      const moved = (await shift(after)) - mark;
      if (moved > 0.01) fail(where, `layout shift ${moved.toFixed(3)}`);
      await after.screenshot({
        path: join(shots, `me-one-answer-${width}-${scheme}.png`),
        fullPage: true,
      });
      await next.close();
    }
}

// 2. Practice at a level: K, 4 and Algebra, as one reused level profile.
if (part("level")) {
  const ids = new Set<string>();
  for (const [grade, name, title] of [
    [0, "K", "Kindergarten"],
    [4, "4", "4th grade"],
    [9, "9", "9th grade"],
  ] as const)
    for (const width of WIDTHS)
      for (const scheme of SCHEMES) {
        const where = `/me/level ${name} ${width} ${scheme}`;
        const context = await reader(width, scheme);
        await signIn(context, adult.email);
        const page = await context.newPage();
        await page.goto(`${origin}/me/level`, { waitUntil: "load" });
        await page
          .getByRole("heading", { name: "Practice at a level" })
          .waitFor();
        await settle(page);
        await page.getByRole("radio", { name: title }).first().click();
        await page.waitForTimeout(300);
        await check(page, where, "me");
        await page.screenshot({
          path: join(shots, `level-${name}-${width}-${scheme}.png`),
          fullPage: true,
        });
        // Practice once per grade (at one width): the level it starts at.
        if (width === WIDTHS.at(-1) && scheme === "light") {
          await page.getByRole("button", { name: "Start practicing" }).click();
          await page.waitForURL(/\/practice\?profile=/);
          const profile = new URL(page.url()).searchParams.get("profile")!;
          ids.add(profile);
          // The area that grade is about starts there: Numbers below high
          // school, Algebra from it (an area with no work at a grade starts
          // at its own first).
          const frontier = await api<{
            strands: Record<string, { level: number }>;
          }>(context.request, "GET", `/learners/${profile}/frontier`);
          const area = grade >= 9 ? "algebra" : "number";
          const at = frontier.strands[area]?.level ?? -1;
          // The estimator's floor sits above K = 0: a K start reads up to
          // about grade 1.5 before any answer (its problems are K's).
          if (Math.abs(at - grade) > (grade === 0 ? 1.5 : 0.75))
            fail(where, `${area} starts at ${at}, not ${grade}`);
          await page.waitForTimeout(2500);
          await check(page, `${where} practice`, "me");
          await page.screenshot({
            path: join(shots, `level-${name}-practice-${width}.png`),
          });
        }
        await context.close();
      }
  if (ids.size !== 1)
    fail("practice at a level", `${ids.size} profiles, not one reused`);
}

// 3. A family's child with no answers: the same unmeasured level.
if (part("family"))
  for (const width of WIDTHS)
    for (const scheme of SCHEMES) {
      const where = `family child day 0 ${width} ${scheme}`;
      const context = await reader(width, scheme);
      await signIn(context, "parent-new@personas.amp.test");
      const page = await context.newPage();
      await page.goto(`${origin}/family`, { waitUntil: "load" });
      await page
        .getByRole("link", { name: /^Child 1/ })
        .first()
        .click();
      await page.locator("[data-levels-not-yet]").waitFor();
      await settle(page);
      const mark = await shift(page);
      await unmeasured(page, where, "[data-levels-not-yet]", "moving");
      await check(page, where, "other");
      await page.waitForTimeout(1200);
      const moved = (await shift(page)) - mark;
      if (moved > 0.001) fail(where, `layout shift ${moved.toFixed(3)}`);
      await page.screenshot({
        path: join(shots, `family-child-day0-${width}-${scheme}.png`),
        fullPage: true,
      });
      await context.close();
    }

await browser.close();
if (failures.length) {
  console.error(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log("Me space: every check passed.");
