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
  if (!response.ok())
    throw new Error(`${persona} sign-in ${response.status()}`);
  // Product measurement is not under test: the harness never sends it, so
  // its rate limit can't fail a page (and nothing is measured).
  await context.route("**/api/v1/events", (route) =>
    route.fulfill({ status: 202, json: {} }),
  );
  // tsx names the helpers inside page functions (`__name`); the page has
  // none of its own.
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

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(600);
}

/** The page's checks once settled: overflow, shift since `mark`, targets,
 * words. */
/** The page's controls whose effective target is under 44 × 44 px: the
 * box itself, or a drawn-out ::after that really takes the pointer, at
 * least 44 px both ways, and hit testing 21 px each way from the centre
 * landing on the control itself. Self-contained: it runs in the page. */
function smallTargets(selector: string): string[] {
  // The effective target, measured by hit testing: 44 px across both
  // ways through the control's centre must land on the control itself (a
  // drawn-out ::after counts only if it really takes the pointer).
  const controls = [...document.querySelectorAll<HTMLElement>(selector)].filter(
    (element) => {
      const box = element.getBoundingClientRect();
      return (
        box.width > 0 &&
        box.height > 0 &&
        !element.closest("[aria-hidden=true]")
      );
    },
  );
  const small: string[] = [];
  for (const element of controls) {
    element.scrollIntoView({
      block: "center",
      inline: "center",
      behavior: "instant",
    });
    const box = element.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const owns = (px: number, py: number) => {
      const hit = document.elementFromPoint(px, py);
      return !!hit && (hit === element || element.contains(hit));
    };
    // Its size: the box itself, or a drawn-out ::after that really takes
    // the pointer, 44 px or more both ways.
    const after = getComputedStyle(element, "::after");
    const drawn =
      after.position === "absolute" &&
      after.content !== "none" &&
      after.pointerEvents !== "none";
    const wide = Math.max(box.width, drawn ? parseFloat(after.width) || 0 : 0);
    const tall = Math.max(
      box.height,
      drawn ? parseFloat(after.height) || 0 : 0,
    );
    // And it is the control's own: 21 px each way from its centre lands
    // on it (half of 44, less the half pixel hit testing rounds by).
    const reach = 21;
    if (
      wide < 43.5 ||
      tall < 43.5 ||
      !(
        owns(x, y - reach) &&
        owns(x, y + reach) &&
        owns(x - reach, y) &&
        owns(x + reach, y)
      )
    )
      small.push(
        (element.textContent ?? element.getAttribute("aria-label") ?? "")
          .trim()
          .slice(0, 40),
      );
  }
  window.scrollTo(0, 0);
  return small;
}
const CONTROLS =
  "main button, main a[href], header button, header a[href], [role=switch], [role=dialog] button, [role=dialog] a[href]";

async function check(page: Page, where: string, words = true) {
  const result = await page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    const text = [
      document.querySelector("header")?.textContent ?? "",
      document.querySelector("main")?.textContent ?? "",
    ].join(" ");
    return { overflow, text };
  });
  if (result.overflow > 0)
    fail(where, `scrolls sideways by ${result.overflow}px`);
  const small = await page.evaluate(smallTargets, CONTROLS);
  if (small.length)
    fail(where, `targets under 44px: ${small.slice(0, 5).join(" | ")}`);
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
  return body.families.find((family) => family.role !== "co-teacher")!.familyId;
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
      {
        headers: { Origin: origin },
        data: { nickname: "JR", birthYear: 2015 },
      },
    );
    if (!added.ok()) throw new Error(`tutored child ${added.status()}`);
  }
  const me = (await (
    await context.request.get(`${origin}/api/v1/me`)
  ).json()) as {
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
// The checker itself: a 44 × 44 button passes; a 2 × 44 one and a 44 × 20
// one whose 44 px ::after takes no pointer both fail.
{
  const page = await browser.newPage();
  await page.addInitScript("window.__name = (f) => f;");
  await page.setContent(`<main>
    <style>button{display:block;margin:40px;padding:0;border:0}
    .wide::after{content:"";position:absolute;inset:-12px 0;pointer-events:none}
    .wide{position:relative}</style>
    <button id="ok" style="width:44px;height:44px">ok</button>
    <button id="thin" style="width:2px;height:44px">thin</button>
    <button id="wide" class="wide" style="width:44px;height:20px">wide</button>
  </main>`);
  await page.evaluate("window.__name = (f) => f;");
  const flagged = await page.evaluate(smallTargets, "main button");
  if (flagged.join(",") !== "thin,wide")
    fail("target-checker", `flagged ${JSON.stringify(flagged)}`);
  await page.close();
}
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
            action: action
              ? Math.round(action.getBoundingClientRect().width)
              : null,
            left: action
              ? Math.round(action.getBoundingClientRect().left)
              : null,
          };
        }),
      );
      const widths = new Set(rows.map((row) => row.action));
      const lefts = new Set(rows.map((row) => row.left));
      if (widths.size > 1 || lefts.size > 1)
        fail(
          `family-today-${tag}`,
          `row actions differ: ${JSON.stringify(rows)}`,
        );
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
      const sheet = (await today.textContent("[role=dialog]")) ?? "";
      if (NEVER.test(sheet))
        fail(`family-devices-${tag}`, `says "${NEVER.exec(sheet)![0]}"`);
      if (!/devices=1/.test(today.url()))
        fail(`family-devices-${tag}`, "the sheet has no address");
      await today.close();
      // An old family-class address: a family's own class opens the
      // family's screen (with its workbook identity); a class that also
      // holds other families' children stays its tutoring group.
      const pure = await signedIn("parent-new", width, scheme);
      const pureId = await familyId(pure);
      const pureMe = (await (
        await pure.request.get(`${origin}/api/v1/me`)
      ).json()) as { familyClass?: { orgId: string; classId: string } };
      const old = await pure.newPage();
      const at = `/school/${pureMe.familyClass!.orgId}/classes/${pureMe.familyClass!.classId}`;
      await old.goto(`${origin}${at}/map`);
      await settle(old);
      if (!old.url().endsWith(`/family/${pureId}/map`))
        fail(`family-old-address-${tag}`, `landed on ${old.url()}`);
      await old.goto(`${origin}${at}/workbooks/2026-11-12?set=2`);
      await settle(old);
      if (
        !new URL(old.url()).pathname.endsWith(
          `/family/${pureId}/workbooks/2026-11-12`,
        ) ||
        new URL(old.url()).searchParams.get("set") !== "2"
      )
        fail(`family-old-workbook-${tag}`, `landed on ${old.url()}`);
      await old.close();
      await pure.close();
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
      // The tutoring group is its class's whole classroom, a teaching place.
      if (
        !/\/school\/[0-9a-f-]{36}\/classes\/[0-9a-f-]{36}\/today$/.test(
          tour.url(),
        )
      )
        fail(`power-group-${tag}`, `landed on ${tour.url()}`);
      const bar = (await tour.textContent("[data-place-name]")) ?? "";
      if (bar !== "Tutoring group")
        fail(`power-group-${tag}`, `bar says ${bar}`);
      await check(tour, `power-group-${tag}`, false);
      await shoot(tour, `power-group-${tag}`);
      await tour.goto(tour.url().replace(/\/today$/, "/roster"));
      await settle(tour);
      const group = (await tour.textContent("main")) ?? "";
      if (!/JR/.test(group))
        fail(`power-group-${tag}`, "the tutored child is missing");
      await shoot(tour, `power-group-roster-${tag}`);
      // A hosted child's record never opens over a family screen.
      const teaching = (await (
        await power.request.get(`${origin}/api/v1/families/${id}/teaching`)
      ).json()) as { students: { id: string; name: string }[] };
      const hosted = teaching.students.find((student) => student.name === "JR");
      // One of the family's own children named by their roster person: their
      // own page, never the school's record layer.
      const ownPerson = teaching.students.find(
        (student) => student.name === "Pip",
      );
      if (ownPerson) {
        await tour.goto(`${origin}/family/${id}?open=student:${ownPerson.id}`);
        await tour.waitForURL(/\/kids\//, { timeout: 30_000 }).catch(() => {});
        if (!/\/family\/[0-9a-f-]+\/kids\//.test(tour.url()))
          fail(`power-own-layer-${tag}`, `landed on ${tour.url()}`);
        const text = (await tour.textContent("body")) ?? "";
        if (/this student|on the roster/.test(text))
          fail(`power-own-layer-${tag}`, "school words on a child's record");
      }
      if (hosted) {
        await tour.goto(`${origin}/family/${id}?open=student:${hosted.id}`);
        await settle(tour);
        if (await tour.$("[role=dialog]"))
          fail(
            `power-hosted-layer-${tag}`,
            "a hosted child's record opened in Family",
          );
      }
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
} else
  console.log("Family space: every screen whole at every width and theme.");
