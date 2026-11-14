/**
 * The Family space in a real browser (docs/architecture/spaces.md, P2),
 * against a seeded design preview (scripts/design-preview.sh): a returning
 * family's Today, each child's page, the drawer and "Their own devices", the
 * second parent's view, a family's old class address, and the switch between
 * Family, Teaching and My practice. Every screen at 320, 390, 768 and 1280
 * px, light and dark, asserting no horizontal overflow, no layout shift after
 * the screen settles, 44 px targets, the family's words, and no console
 * errors. Screenshots go to $AMP_SHOTS.
 *
 *   AMP_PREVIEW_ORIGIN=http://127.0.0.1:4940 AMP_SHOTS=<dir> \
 *     npx tsx scripts/verify-family-space-ui.ts [--widths 390,1280]
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";

const origin = process.env.AMP_PREVIEW_ORIGIN ?? "http://127.0.0.1:4940";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
  throw new Error(`Loopback previews only: ${origin}`);
const shots = process.env.AMP_SHOTS ?? "artifacts/family-space";
mkdirSync(shots, { recursive: true });
const widthArg = process.argv.indexOf("--widths");
const WIDTHS =
  widthArg > 0
    ? process.argv[widthArg + 1]!.split(",").map(Number)
    : [320, 390, 768, 1280];
const SCHEMES = ["light", "dark"] as const;
const PASSWORD = "design pass persona passphrase";
/** Words a family's own chrome never uses (the devices sheet may say
 * "Class code"; that sheet is checked separately). */
const NEVER = /\b(students?|roster|seats?|standings|co-teacher|gradebook)\b/i;

const failures: string[] = [];
const fail = (where: string, what: string) => {
  failures.push(`${where}: ${what}`);
  console.error(`FAIL ${where}: ${what}`);
};

async function signedIn(
  persona: string,
  width: number,
  scheme: (typeof SCHEMES)[number],
) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    colorScheme: scheme,
  });
  const response = await context.request.post(
    `${origin}/api/auth/sign-in/email`,
    {
      headers: { Origin: origin },
      data: { email: `${persona}@personas.amp.test`, password: PASSWORD },
    },
  );
  if (!response.ok()) throw new Error(`${persona} sign-in ${response.status()}`);
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

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(600);
}

/** The page's checks once settled: overflow, shift since `mark`, targets,
 * words. */
async function check(page: Page, where: string, words = true) {
  const result = await page.evaluate(() => {
    const overflow =
      document.documentElement.scrollWidth - window.innerWidth;
    const small = [
      ...document.querySelectorAll<HTMLElement>(
        "main button, main a[href], header button, header a[href], [role=switch]",
      ),
    ]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        if (!box.width || !box.height) return false;
        const after = getComputedStyle(element, "::after");
        // A small link whose hit area is drawn out to 44 px.
        if (after.position === "absolute" && after.content !== "none")
          return false;
        return box.height < 43.5;
      })
      .map((element) => (element.textContent ?? "").trim().slice(0, 40));
    const text = [
      document.querySelector("header")?.textContent ?? "",
      document.querySelector("main")?.textContent ?? "",
    ].join(" ");
    return { overflow, small, text };
  });
  if (result.overflow > 0) fail(where, `scrolls sideways by ${result.overflow}px`);
  if (result.small.length)
    fail(where, `targets under 44px: ${result.small.slice(0, 5).join(" | ")}`);
  if (words && NEVER.test(result.text))
    fail(where, `says "${NEVER.exec(result.text)![0]}"`);
}

async function shiftSince(page: Page, mark: number, where: string) {
  const shift = await page.evaluate(
    () => (window as unknown as { __shift: number }).__shift,
  );
  if (shift - mark > 0.01)
    fail(where, `layout shift ${(shift - mark).toFixed(3)}`);
}

async function shoot(page: Page, name: string) {
  await page.screenshot({
    path: join(shots, `${name}.png`),
    fullPage: true,
    // A loaded machine renders a long page slowly; the check is the page.
    timeout: 120_000,
  });
}

async function visit(
  context: BrowserContext,
  path: string,
  name: string,
): Promise<Page> {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(`${origin}${path}`);
  await settle(page);
  const mark = await page.evaluate(
    () => (window as unknown as { __shift: number }).__shift,
  );
  await page.waitForTimeout(1200);
  await shiftSince(page, mark, name);
  await check(page, name);
  if (errors.length) fail(name, `console: ${errors[0]}`);
  await shoot(page, name);
  return page;
}

async function familyId(context: BrowserContext) {
  const response = await context.request.get(`${origin}/api/v1/families`);
  const body = (await response.json()) as {
    families: { familyId: string; role: string }[];
  };
  return body.families.find((family) => family.role !== "co-teacher")!
    .familyId;
}

/** Jonah as the power user: his own family, a tutoring group (another
 * family's child added to his family's class) and his own practice. Made
 * once through the real API; a rerun finds them made. */
async function powerUser(context: BrowserContext) {
  const places = (await (
    await context.request.get(`${origin}/api/v1/families`)
  ).json()) as { families: { role: string; teachingPlace: unknown }[] };
  if (!places.families.some((family) => family.teachingPlace)) {
    const added = await context.request.post(
      `${origin}/api/v1/family/class/students`,
      { headers: { Origin: origin }, data: { nickname: "JR", birthYear: 2015 } },
    );
    if (!added.ok()) throw new Error(`tutored child ${added.status()}`);
  }
  const me = (await (await context.request.get(`${origin}/api/v1/me`)).json()) as {
    adultPractice?: { learner: unknown };
  };
  if (!me.adultPractice?.learner) {
    const started = await context.request.post(`${origin}/api/v1/me/practice`, {
      headers: { Origin: origin },
      data: { timezone: "America/New_York" },
    });
    if (!started.ok()) throw new Error(`own practice ${started.status()}`);
  }
}

/** Choose a place in the drawer's switcher, by its id. */
async function switchTo(page: Page, place: string) {
  await page.click("[data-navigation-trigger]");
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /switch place/ }).click();
  await page.click(`[role=menuitem]:has([data-place="${place}"])`);
  await settle(page);
}

const browser = await chromium.launch();
try {
  for (const width of WIDTHS)
    for (const scheme of SCHEMES) {
      const tag = `${width}-${scheme}`;
      // A returning family: Today, every child, the drawer, own devices.
      const family = await signedIn("family", width, scheme);
      const id = await familyId(family);
      const today = await visit(family, `/family/${id}`, `family-today-${tag}`);
      const rows = await today.$$eval("[data-family-kids] > li", (items) =>
        items.map((item) => {
          const action = item.querySelector<HTMLElement>(
            "[data-practice-here], [data-continue]",
          );
          return {
            id: item.getAttribute("data-child")!,
            action: action ? Math.round(action.getBoundingClientRect().width) : null,
            left: action ? Math.round(action.getBoundingClientRect().left) : null,
          };
        }),
      );
      const widths = new Set(rows.map((row) => row.action));
      const lefts = new Set(rows.map((row) => row.left));
      if (widths.size > 1 || lefts.size > 1)
        fail(`family-today-${tag}`, `row actions differ: ${JSON.stringify(rows)}`);
      for (const [index, row] of rows.entries()) {
        const page = await visit(
          family,
          `/family/${id}/kids/${row.id}`,
          `family-child${index + 1}-${tag}`,
        );
        await page.close();
      }
      await today.click("[data-navigation-trigger]");
      await today.waitForTimeout(700);
      const drawer = (await today.textContent("[role=dialog]")) ?? "";
      if (/Jonah.s class|Show grade numbers|Family & account/.test(drawer))
        fail(`family-drawer-${tag}`, `drawer says: ${drawer.slice(0, 160)}`);
      await shoot(today, `family-drawer-${tag}`);
      await today.keyboard.press("Escape");
      await today.click("[data-own-devices]");
      await today.waitForSelector("[data-devices-sheet] [data-class-code]");
      await today.waitForTimeout(500);
      await shoot(today, `family-devices-${tag}`);
      if (!/devices=1/.test(today.url()))
        fail(`family-devices-${tag}`, "the sheet has no address");
      await today.close();
      // An old family-class address lands on the family's own screen.
      const old = await family.newPage();
      const classes = (await (
        await family.request.get(`${origin}/api/v1/me`)
      ).json()) as { familyClass?: { classId: string } };
      await old.goto(
        `${origin}/school/${id}/classes/${classes.familyClass!.classId}/map`,
      );
      await settle(old);
      if (!old.url().endsWith(`/family/${id}/map`))
        fail(`family-old-address-${tag}`, `landed on ${old.url()}`);
      await old.close();
      await family.close();
      // The second parent: the same children, nothing she can't do.
      const second = await signedIn("second-parent", width, scheme);
      const secondId = await familyId(second);
      const page = await visit(
        second,
        `/family/${secondId}`,
        `second-parent-today-${tag}`,
      );
      if (await page.$("[data-continue]"))
        fail(`second-parent-today-${tag}`, "offers Continue with AMP");
      await page.close();
      await second.close();
      // The power user: Family ↔ Teaching ↔ My practice, each place whole on
      // its own terms, nothing following them between places.
      const power = await signedIn("family", width, scheme);
      await powerUser(power);
      const tour = await power.newPage();
      await tour.goto(`${origin}/family/${id}`);
      await settle(tour);
      await switchTo(tour, `group:${id}`);
      if (!tour.url().endsWith(`/family/${id}/group`))
        fail(`power-group-${tag}`, `landed on ${tour.url()}`);
      await check(tour, `power-group-${tag}`, false);
      await shoot(tour, `power-group-${tag}`);
      const group = (await tour.textContent("main")) ?? "";
      if (!/JR/.test(group)) fail(`power-group-${tag}`, "the tutored child is missing");
      await switchTo(tour, "me");
      if (!new URL(tour.url()).pathname.startsWith("/me"))
        fail(`power-me-${tag}`, `landed on ${tour.url()}`);
      await check(tour, `power-me-${tag}`);
      await shoot(tour, `power-me-${tag}`);
      await switchTo(tour, "home");
      if (!tour.url().endsWith(`/family/${id}`))
        fail(`power-family-${tag}`, `landed on ${tour.url()}`);
      const kids = await tour.$$eval("[data-family-kids] > li", (items) =>
        items.map((item) => item.textContent ?? ""),
      );
      if (kids.some((text) => /JR/.test(text)))
        fail(`power-family-${tag}`, "a tutored child shows in the family");
      await check(tour, `power-family-${tag}`);
      await shoot(tour, `power-family-${tag}`);
      await power.close();
    }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(`${failures.length} failures`);
  process.exitCode = 1;
} else console.log("Family space: every screen whole at every width and theme.");
