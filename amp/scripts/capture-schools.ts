/**
 * The AMP for Schools gallery: every school screen, both overviews, every class
 * tab, the student record, the evidence sheet, sign-in and Start class,
 * standings, the family page and the public pages, driven on the seeded demo
 * (`school-demo-world.ts`) in Chromium at device scale 2. Shot at 1280 and 390
 * in light and dark; measured at 320, 390, 768 and 1280 in both, where every
 * screen must have no overflow, no clipped cells, 44 px targets, nothing
 * truncated or overlapping, and CLS at or below 0.01.
 *
 * Writes `<out>/<screen>-<width>-<theme>.png` and an `index.html` contact sheet
 * grouped by screen, to `artifacts/schools-gallery/<date>/` or `--out`.
 * `--product-shots` also refreshes the `/schools` page's screens from the
 * same data, as WebP.
 *
 *     AMP_TEST_DATABASE_URL=... npm run school:capture -- \
 *       [--size 10000] [--port 4424] [--out <dir>] [--only today,gradebook]
 *       [--widths 1280,390,768,320] [--themes light,dark] [--product-shots] [--keep]
 */
import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  chromium as rawChromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { AGREEMENT_VERSION } from "../src/schools/agreement";
import {
  clippedCells,
  probe,
  resetRecord,
  settle,
  shellRecord,
  shiftRecorder,
} from "./app-shell-probe";
import {
  ACCOUNTS,
  buildDemo,
  DEMO_COOKIE,
  demoSizes,
  issueSchool,
  startDemoServer,
  type DemoServer,
  type DemoSize,
  type DemoWorld,
} from "./school-demo-world";

const argument = (name: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const size = Number(argument("--size") ?? 10000) as DemoSize;
if (!demoSizes.includes(size)) throw new Error("--size is 30, 1000 or 10000");
const port = Number(argument("--port") ?? 4424);
// Outside the repository's history either way: artifacts/ is ignored.
const out =
  argument("--out") ??
  join("artifacts/schools-gallery", new Date().toISOString().slice(0, 10));
const only = argument("--only")?.split(",");
const widths = (argument("--widths") ?? "1280,390,768,320")
  .split(",")
  .map(Number);
const themes = (argument("--themes") ?? "light,dark").split(",") as (
  "light" | "dark"
)[];
const SHOT_WIDTHS = new Set([1280, 390]);
const SCREENS_DIR = "src/web/features/schools/screens";

type Who = "head" | "district" | "teacher" | "student" | "guest" | "newcomer";
type Screen = {
  id: string;
  group: string;
  title: string;
  who: Who;
  path: string;
  /** The level-one heading that says the screen is here. */
  heading?: string | RegExp;
  /** After it's here: open a sheet, choose something. */
  then?: (page: Page) => Promise<void>;
  /** A sheet over the screen is shot as the window shows it, not the page. */
  sheet?: boolean;
  /** An action bar pinned over the list is measured where it comes to rest,
   * at the end of the page, as a person reaches it. */
  pinned?: boolean;
};

const failures: string[] = [];
const check = (label: string, ok: boolean, detail: unknown = "") => {
  if (!ok) failures.push(`${label}: ${JSON.stringify(detail).slice(0, 400)}`);
};

/* Every page load is real API traffic on one development credential; stay
   under its limit rather than measure it. */
const calls: number[] = [];
async function paced() {
  for (;;) {
    const recent = calls.filter((at) => at > Date.now() - 60_000).length;
    if (recent < 450) return;
    await new Promise((done) => setTimeout(done, 1500));
  }
}

function screens(world: DemoWorld, pendingOrg: string): Screen[] {
  const school = `/school/${world.school.id}`;
  const klass = `${school}/classes/${world.hero.classId}`;
  const amara = world.hero.students.get("Amara")!.personId;
  const elias = world.hero.students.get("Elias")!.personId;
  const district = world.district ? `/school/${world.district.id}` : null;
  const list: Screen[] = [
    {
      id: "schools",
      group: "Public",
      title: "/schools",
      who: "guest",
      path: "/schools",
    },
    {
      id: "scope",
      group: "Public",
      title: "Scope and sequence",
      who: "guest",
      path: "/schools/scope-and-sequence",
    },
    {
      id: "trust",
      group: "Public",
      title: "Trust",
      who: "guest",
      path: "/schools/trust",
    },
    ...(
      ["school", "calendar", "experience", "agreement", "students"] as const
    ).map((step, index): Screen => ({
      id: `setup-${index + 1}-${step}`,
      group: "Setup",
      title: `Setup: ${step}`,
      who: "newcomer",
      path: `/school/new?org=${pendingOrg}&step=${step}`,
    })),
    ...(district
      ? [
          {
            id: "district-overview",
            group: "District",
            title: "District overview",
            who: "district" as const,
            path: district,
            heading: /^Good /,
          },
          {
            id: "district-schools",
            group: "District",
            title: "Schools",
            who: "district" as const,
            path: `${district}/schools`,
            heading: "Schools",
          },
          {
            id: "district-experience",
            group: "District",
            title: "Student experience, district",
            who: "district" as const,
            path: `${district}/experience`,
          },
        ]
      : []),
    {
      id: "school-overview",
      group: "School",
      title: "School overview",
      who: "head",
      path: school,
      heading: /^Good /,
    },
    ...(
      [
        ["classes", "Classes"],
        ["students", "Students"],
        ["staff", "Staff"],
        ["sign-in-help", "Sign-in help for IT"],
        ["calendar", "Calendar"],
        ["year", "Start the new school year"],
        ["experience", "Student experience"],
        ["import", "Import a roster"],
        ["integrations", "Integrations"],
        ["license", "License"],
        ["privacy", "Privacy"],
        ["activity", "Activity"],
      ] as const
    ).map(([leaf, title]): Screen => ({
      id: `school-${leaf}`,
      group: "School",
      title,
      who: "head",
      path: `${school}/${leaf}`,
      heading: title,
    })),
    {
      id: "student-record",
      group: "School",
      title: "Student record",
      who: "head",
      path: `${school}/students/${amara}`,
    },
    {
      id: "class-today",
      group: "Class",
      title: "Today",
      who: "teacher",
      path: `${klass}/today`,
      heading: /^Good /,
    },
    {
      id: "class-today-lesson",
      sheet: true,
      group: "Class",
      title: "Today: teach this lesson",
      who: "teacher",
      path: `${klass}/today`,
      heading: /^Good /,
      then: async (page) => {
        await page
          .getByRole("button", { name: "Open the lesson" })
          .first()
          .click();
        await page.getByRole("dialog").locator("h2").first().waitFor();
      },
    },
    {
      id: "class-map",
      group: "Class",
      title: "Class map",
      who: "teacher",
      path: `${klass}/map`,
      heading: "Class map",
    },
    {
      id: "class-gradebook",
      group: "Class",
      title: "Gradebook",
      who: "teacher",
      path: `${klass}/gradebook`,
      heading: /grades$/,
    },
    {
      id: "class-evidence",
      sheet: true,
      group: "Class",
      title: "Evidence sheet",
      who: "teacher",
      path: `${klass}/gradebook?student=${amara}`,
      heading: /grades$/,
      then: async (page) => {
        await page
          .getByRole("dialog")
          .getByRole("heading", { name: "Problems" })
          .waitFor();
      },
    },
    {
      id: "class-evidence-little",
      sheet: true,
      group: "Class",
      title: "Evidence sheet: not enough work",
      who: "teacher",
      path: `${klass}/gradebook?student=${elias}`,
      heading: /grades$/,
      then: async (page) => {
        await page.getByRole("dialog").locator("h2").first().waitFor();
      },
    },
    {
      id: "class-export",
      sheet: true,
      group: "Class",
      title: "Gradebook export",
      who: "teacher",
      path: `${klass}/gradebook?export=1`,
      heading: /grades$/,
      then: async (page) => {
        await page.getByRole("dialog").waitFor();
      },
    },
    {
      id: "class-report-cards",
      group: "Class",
      title: "Report cards",
      who: "teacher",
      path: `${klass}/report-cards`,
      heading: /report cards$/,
    },
    {
      id: "class-time",
      group: "Class",
      title: "Time",
      who: "teacher",
      path: `${klass}/time`,
      heading: "Time",
    },
    {
      id: "class-time-student",
      sheet: true,
      group: "Class",
      title: "Time: one student",
      who: "teacher",
      path: `${klass}/time?student=${amara}`,
      heading: "Time",
      then: async (page) => {
        await page
          .getByRole("dialog")
          .getByRole("heading", { name: "By day" })
          .waitFor();
      },
    },
    {
      id: "class-workbooks",
      pinned: true,
      group: "Class",
      title: "Workbook stack",
      who: "teacher",
      path: `${klass}/workbooks`,
    },
    {
      id: "class-roster",
      group: "Class",
      title: "Roster",
      who: "teacher",
      path: `${klass}/roster`,
    },
    {
      id: "class-cards",
      group: "Class",
      title: "Printable cards",
      who: "teacher",
      path: `${klass}/cards`,
    },
    {
      id: "class-cards-ready",
      group: "Class",
      title: "Printable cards, made",
      who: "teacher",
      path: `${klass}/cards`,
      then: async (page) => {
        await page
          .getByRole("button", { name: /^Make / })
          .first()
          .click();
        await page
          .getByRole("heading", { name: /cards? ready$/, level: 1 })
          .waitFor();
      },
    },
    {
      id: "class-experience",
      group: "Class",
      title: "Student experience",
      who: "teacher",
      path: `${klass}/experience`,
    },
    {
      id: "class-settings",
      group: "Class",
      title: "Settings",
      who: "teacher",
      path: `${klass}/settings`,
    },
    {
      id: "class-start",
      group: "Sign-in",
      title: "Start class",
      who: "teacher",
      path: `${klass}/start`,
    },
    {
      id: "join",
      group: "Sign-in",
      title: "Class code",
      who: "guest",
      path: "/join",
      heading: "Type your class code",
    },
    {
      id: "join-names",
      group: "Sign-in",
      title: "Tap your name",
      who: "guest",
      path: `/join/${world.hero.joinCode}`,
      heading: "Tap your name",
    },
    {
      id: "join-pictures",
      group: "Sign-in",
      title: "Pick your pictures",
      who: "guest",
      path: `/join/${world.hero.joinCode}/${amara}`,
      heading: /pictures/,
    },
    {
      id: "practice",
      group: "Student",
      title: "Practice",
      who: "student",
      path: "/practice",
    },
    {
      id: "standings",
      group: "Student",
      title: "Standings",
      who: "student",
      path: "/standings",
    },
    {
      id: "parent",
      group: "Family",
      title: "Family link",
      who: "guest",
      path: world.parentLink.replace(/^https?:\/\/[^/]+/, ""),
    },
  ];
  return only ? list.filter((screen) => only.includes(screen.id)) : list;
}

const ready = async (page: Page, screen: Screen) => {
  // A sheet over the screen hides what's behind it from the accessibility
  // tree, so the screen's own heading is looked for there too.
  const heading = screen.heading
    ? page.getByRole("heading", {
        name: screen.heading,
        level: 1,
        includeHidden: true,
      })
    : screen.who === "student" && screen.path === "/practice"
      ? page.locator(".problem-stage .question")
      : page.getByRole("heading", { level: 1 });
  await heading.first().waitFor({ timeout: 45_000 });
  await page
    .locator(".amp-loading, .amp-skeleton, .app-loading")
    .first()
    .waitFor({ state: "detached", timeout: 30_000 })
    .catch(() => undefined);
  if (screen.then) await screen.then(page);
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
  await settle(page, 600);
};

async function contextFor(
  browser: Browser,
  server: DemoServer,
  world: DemoWorld,
  who: Who,
  width: number,
  theme: "light" | "dark",
): Promise<BrowserContext> {
  const shot = SHOT_WIDTHS.has(width);
  const context = await browser.newContext({
    viewport: { width, height: width < 720 ? 844 : 900 },
    colorScheme: theme,
    deviceScaleFactor: shot ? 2 : 1,
    reducedMotion: "reduce",
  });
  await context.addInitScript(shiftRecorder);
  await context.addInitScript(
    `localStorage.setItem('amp.theme', ${JSON.stringify(theme)})`,
  );
  const account = {
    head: ACCOUNTS.head,
    district: ACCOUNTS.district,
    teacher: ACCOUNTS.teacher,
    newcomer: "demo-newcomer",
  }[who as "head"];
  if (account)
    await context.addCookies([
      { name: DEMO_COOKIE, value: account, url: server.origin },
    ]);
  if (who === "guest")
    await context.addInitScript(
      "sessionStorage.setItem('amp.dev.signedOut', '1')",
    );
  if (who === "student")
    await context.addInitScript(
      `sessionStorage.setItem('amp.student', ${JSON.stringify(
        JSON.stringify({
          token: world.student.token,
          accountId: `school:${world.student.personId}`,
        }),
      )})`,
    );
  return context;
}

async function measure(page: Page, label: string) {
  const result = await probe(page);
  check(`${label} overflow`, result.overflow === 0, result.overflow);
  check(
    `${label} 44 px targets`,
    result.smallTargets.length === 0,
    result.smallTargets,
  );
  check(`${label} truncated`, result.truncated.length === 0, result.truncated);
  check(`${label} overlaps`, result.overlaps.length === 0, result.overlaps);
  check(
    `${label} mid-word wraps`,
    result.midWordWraps.length === 0,
    result.midWordWraps,
  );
  const clipped = await clippedCells(page);
  check(`${label} clipped cells`, clipped.length === 0, clipped);
  const { cls, blank } = await shellRecord(page);
  check(`${label} CLS`, cls <= 0.01, cls);
  check(`${label} no blank flash`, blank === 0, blank);
}

/** Someone partway through setup, for the setup screens. */
async function pendingSetup(server: DemoServer) {
  const account = "demo-newcomer";
  const org = {
    id: await issueSchool(server, account, {
      name: "Birch Road School",
      seats: 120,
      reference: "Pilot",
      signer: "Ines Vega",
    }),
  };
  await server.as(account, "POST", `orgs/${org.id}/calendar`, {
    startsOn: "2026-08-17",
    endsOn: "2027-06-11",
    division: "semester",
  });
  await server.as(account, "POST", `orgs/${org.id}/setup/experience`, {
    preset: "levels",
  });
  await server.as(account, "POST", `orgs/${org.id}/setup/agreement`, {
    version: AGREEMENT_VERSION,
    signerName: "Ines Vega",
    signerTitle: "Principal",
  });
  return org.id as string;
}

type Captured = { screen: Screen; files: string[] };
async function sweep(
  browser: Browser,
  server: DemoServer,
  world: DemoWorld,
  list: Screen[],
) {
  const captured = new Map<string, Captured>();
  for (const width of widths)
    for (const theme of themes) {
      const contexts = new Map<Who, BrowserContext>();
      try {
        for (const screen of list) {
          let context = contexts.get(screen.who);
          if (!context) {
            context = await contextFor(
              browser,
              server,
              world,
              screen.who,
              width,
              theme,
            );
            contexts.set(screen.who, context);
          }
          const page = await context.newPage();
          page.setDefaultTimeout(30_000);
          page.on("response", (response) => {
            if (response.url().includes("/api/")) calls.push(Date.now());
            if (response.status() >= 500)
              failures.push(
                `${screen.id} ${width} ${theme}: ${response.status()} ${new URL(response.url()).pathname}`,
              );
          });
          page.on("pageerror", (error) =>
            failures.push(`${screen.id} ${width} ${theme}: ${error.message}`),
          );
          const label = `${screen.id} ${width} ${theme}`;
          try {
            await paced();
            await page.goto(server.origin + screen.path);
            await ready(page, screen);
            if (screen.pinned) {
              await page.evaluate(() =>
                scrollTo(0, document.documentElement.scrollHeight),
              );
              await settle(page, 150);
            }
            await measure(page, label);
            if (SHOT_WIDTHS.has(width)) {
              const file = `${screen.id}-${width}-${theme}.png`;
              await page.screenshot({
                path: join(out, file),
                fullPage: !screen.sheet,
              });
              const entry = captured.get(screen.id) ?? { screen, files: [] };
              entry.files.push(file);
              captured.set(screen.id, entry);
            }
          } catch (error) {
            failures.push(
              `${label}: ${(error as Error).message.split("\n")[0]}`,
            );
            await page
              .screenshot({
                path: join(out, `failed-${screen.id}-${width}-${theme}.png`),
              })
              .catch(() => undefined);
          } finally {
            await resetRecord(page).catch(() => undefined);
            await page.close();
          }
        }
      } finally {
        for (const context of contexts.values()) await context.close();
      }
      console.log(`  ${width} ${theme}: ${list.length} screens`);
    }
  return captured;
}

async function contactSheet(captured: Map<string, Captured>, world: DemoWorld) {
  const groups = new Map<string, Captured[]>();
  for (const entry of captured.values())
    groups.set(entry.screen.group, [
      ...(groups.get(entry.screen.group) ?? []),
      entry,
    ]);
  const order = (file: string) =>
    ["1280-light", "1280-dark", "390-light", "390-dark"].findIndex((key) =>
      file.includes(key),
    );
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AMP for Schools gallery, ${new Date().toISOString().slice(0, 10)}</title>
<style>
:root{color-scheme:light dark;font:15px/1.45 system-ui,sans-serif}
body{margin:0;padding:32px 24px 64px;max-width:1600px;margin-inline:auto}
h1{font-size:24px;margin:0 0 4px}p{margin:0 0 24px;color:GrayText}
h2{font-size:18px;margin:40px 0 12px;padding-top:16px;border-top:1px solid #8884}
section{margin:0 0 28px}h3{font-size:15px;margin:0 0 8px}
.row{display:grid;grid-template-columns:2.2fr 2.2fr 1fr 1fr;gap:12px;align-items:start}
figure{margin:0}img{width:100%;height:auto;border:1px solid #8884;border-radius:6px;display:block}
figcaption{font-size:12px;color:GrayText;margin-top:4px}
nav a{margin-right:14px}
</style></head><body>
<h1>AMP for Schools gallery</h1>
<p>${world.counts.students.toLocaleString("en-US")} synthetic students in ${world.counts.classes} classes. 1280 and 390, light and dark, at device scale 2. Every name is made up.</p>
<nav>${[...groups.keys()].map((group) => `<a href="#${group}">${group}</a>`).join("")}</nav>
${[...groups.entries()]
  .map(
    ([group, entries]) =>
      `<h2 id="${group}">${group}</h2>${entries
        .map(
          (entry) =>
            `<section><h3>${entry.screen.title}</h3><div class="row">${[
              ...entry.files,
            ]
              .sort((a, b) => order(a) - order(b))
              .map(
                (file) =>
                  `<figure><a href="${file}"><img loading="lazy" src="${file}" alt="${entry.screen.title}, ${file
                    .replace(/\.png$/, "")
                    .split("-")
                    .slice(-2)
                    .join(" ")}"></a><figcaption>${file}</figcaption></figure>`,
              )
              .join("")}</div></section>`,
        )
        .join("")}`,
  )
  .join("")}
</body></html>`;
  await writeFile(join(out, "index.html"), html);
}

/* The `/schools` page's screens, from the same data. Wide ones at the screen's
   own CSS size; narrow ones at the phone's device scale, as before. */
type Product = {
  id: string;
  screen: string;
  wide:
    | { kind: "viewport" }
    | { kind: "top"; height: number }
    | { kind: "element"; selector: string; height?: number };
  narrow?:
    | { kind: "viewport" }
    | { kind: "element"; selector: string; height?: number };
};
const PRODUCTS: Product[] = [
  { id: "board", screen: "class-start", wide: { kind: "viewport" } },
  {
    id: "cards",
    screen: "class-cards-ready",
    wide: {
      kind: "element",
      selector: 'section[aria-label="Page 1"]',
      height: 500,
    },
  },
  { id: "today", screen: "class-today", wide: { kind: "top", height: 1500 } },
  { id: "gradebook", screen: "class-gradebook", wide: { kind: "viewport" } },
  {
    id: "evidence",
    screen: "class-evidence",
    wide: { kind: "element", selector: "[role=dialog]" },
  },
  { id: "stack", screen: "class-workbooks", wide: { kind: "viewport" } },
  {
    id: "standings",
    screen: "standings",
    wide: { kind: "element", selector: "main" },
  },
  {
    id: "school-overview",
    screen: "school-overview",
    wide: { kind: "viewport" },
  },
  {
    id: "district-overview",
    screen: "district-overview",
    wide: { kind: "viewport" },
  },
];
async function productShots(
  browser: Browser,
  server: DemoServer,
  world: DemoWorld,
  list: Screen[],
) {
  const sizes: Record<string, { wide: number[]; narrow: number[] }> = {};
  const scratch = "artifacts/schools-product";
  await rm(scratch, { recursive: true, force: true });
  await mkdir(scratch, { recursive: true });
  for (const product of PRODUCTS) {
    const screen = list.find((entry) => entry.id === product.screen);
    if (!screen) continue;
    for (const shape of ["wide", "narrow"] as const)
      for (const theme of ["light", "dark"] as const) {
        const width = shape === "wide" ? 1280 : 390;
        const context = await contextFor(
          browser,
          server,
          world,
          screen.who,
          width,
          theme,
        );
        const page = await context.newPage();
        try {
          await paced();
          await page.goto(server.origin + screen.path);
          await ready(page, screen);
          const rule =
            shape === "wide"
              ? product.wide
              : (product.narrow ?? { kind: "viewport" as const });
          const png = join(scratch, `${product.id}-${shape}-${theme}.png`);
          if (rule.kind === "element") {
            // Where the element sits on the page as it loads, unscrolled, so
            // nothing pinned at the top of the window lies over it.
            const box = (await page
              .locator(rule.selector)
              .first()
              .boundingBox())!;
            const scrolled = await page.evaluate(() => scrollY);
            await page.screenshot({
              path: png,
              fullPage: true,
              clip: {
                x: box.x,
                y: box.y + scrolled,
                width: box.width,
                height: Math.min(box.height, rule.height ?? box.height),
              },
            });
          } else if (rule.kind === "top")
            await page.screenshot({
              path: png,
              fullPage: true,
              clip: { x: 0, y: 0, width, height: rule.height },
            });
          else await page.screenshot({ path: png });
          const [w, h] = execFileSync("sips", [
            "-g",
            "pixelWidth",
            "-g",
            "pixelHeight",
            png,
          ])
            .toString()
            .match(/\d+/g)!
            .slice(-2)
            .map(Number) as [number, number];
          // Wide: back to CSS pixels. Narrow: the phone's own pixels.
          const scale = shape === "wide" ? 0.5 : 1;
          const size = [Math.round(w * scale), Math.round(h * scale)];
          execFileSync("cwebp", [
            "-quiet",
            "-q",
            "82",
            "-resize",
            String(size[0]),
            String(size[1]),
            png,
            "-o",
            join(SCREENS_DIR, `${product.id}-${shape}-${theme}.webp`),
          ]);
          sizes[product.id] = { ...sizes[product.id]!, [shape]: size };
        } finally {
          await context.close();
        }
      }
  }
  console.log("Product screens (width × height):");
  for (const [id, { wide, narrow }] of Object.entries(sizes))
    console.log(`  ${id}: wide ${wide.join("×")}, narrow ${narrow.join("×")}`);
}

await mkdir(out, { recursive: true });
const server = await startDemoServer({
  webPort: port,
  cacheDir: `node_modules/.vite-school-capture-${port}`,
});
let exit = 0;
try {
  const world = await buildDemo(server, size);
  server.setPicker({ world });
  const pending = await pendingSetup(server);
  const list = screens(world, pending);
  const browser = await secureChromium(rawChromium).launch();
  try {
    const captured = await sweep(browser, server, world, list);
    // A partial run (`--only`) refreshes its files and leaves the sheet.
    if (!only) await contactSheet(captured, world);
    console.log(
      `${captured.size} screens, ${[...captured.values()].reduce((sum, entry) => sum + entry.files.length, 0)} captures in ${out}`,
    );
    if (process.argv.includes("--product-shots"))
      await productShots(browser, server, world, list);
  } finally {
    await browser.close();
  }
} catch (error) {
  console.error(error);
  exit = 1;
} finally {
  // `--keep` leaves the schema for reading afterwards; drop it by hand.
  await server.close({ keep: process.argv.includes("--keep") });
  if (process.argv.includes("--keep")) console.log(`Kept ${server.schema}`);
}
// Whatever stopped the run, what was measured is kept and said.
await writeFile(join(out, "failures.txt"), failures.join("\n"));
if (failures.length) {
  console.error(`${failures.length} checks failed:`);
  for (const failure of failures.slice(0, 150)) console.error(`  ${failure}`);
  exit = 1;
} else if (!exit) console.log("Every screen measured clean.");
process.exit(exit);
