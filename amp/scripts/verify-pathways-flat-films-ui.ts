import { secureChromium } from "../browser-security.mjs";
import assert from "node:assert/strict";
import { mkdir, realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium as rawChromium, type Page } from "playwright";
import { problemLesson } from "../src/content/problem-lessons";
import { lessonFilms } from "../src/content/lesson-films";
import { skills } from "../src/curriculum/catalog";
import { templates } from "../src/math/engine";
import { retentionNotice } from "../src/family/contracts";
import { defaultPracticeSettings } from "../src/learning/practice-settings";
import { fixtureMe } from "./me-fixture";
const chromium = secureChromium(rawChromium);

/**
 * Pathways without WebGL (the flat pathway), the lesson layer's head (title,
 * then Try and the film in one row) and a skill's films at its top, at
 * 320/390/768/1280 in light and dark. Synthetic identity and progress; the
 * real catalog, film catalogue, routes and layout. Chromium runs with WebGL
 * switched off, as in the founder's automation browser.
 */
const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
const source = `export async function accessSession(){return {token:"parent-one",accountId:"parent-one"};}export function onSessionChanged(){return()=>{};}export async function signIn(){}export async function signOut(){}export function notifyAccountSessionChanged(){}export async function authConfig(){return {mode:'accounts',passwords:true,providers:[]};}`;
const vite = await createServer({
  cacheDir: process.env.AMP_VITE_CACHE_DIR ?? "artifacts/vite-pathways-flat",
  plugins: [
    {
      name: "pathways-flat-auth",
      enforce: "pre",
      load(id) {
        return id.split("?")[0] === authPath ? source : undefined;
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: Number(process.env.AMP_WEB_PORT ?? 0),
    strictPort: true,
    fs: { allow: [process.cwd(), await realpath("node_modules")] },
  },
});
await vite.listen();
const address = vite.httpServer!.address();
assert(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
const output = process.env.AMP_SHOTS ?? "artifacts/pathways-flat-films";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  args: ["--disable-gpu", "--disable-webgl", "--disable-webgl2"],
});

const LEARNER = "parent-one-a";
// One film of two problem types, every type filmed, and none.
const oneFilm = skills.find((s) => s.id === "count-to-20")!;
const manyFilms = skills.find((s) => s.id === "line-plots")!;
const noFilms = skills.find((s) => s.id === "volume-cubes")!;
const typesOf = (skill: string) => templates.filter((t) => t.skillId === skill);
const filmsOf = (skill: string) =>
  typesOf(skill).filter((t) => lessonFilms[t.id]);
/** A skill's distinct films: one film can teach several of its types. */
const distinctFilms = (skill: string) =>
  new Set(filmsOf(skill).map((t) => lessonFilms[t.id]!.id)).size;
assert.equal(filmsOf(oneFilm.id).length, 1);
assert(typesOf(oneFilm.id).length > 1);
assert(distinctFilms(manyFilms.id) >= 3);
assert.equal(filmsOf(noFilms.id).length, 0);
const filmed = filmsOf(oneFilm.id)[0]!.id;
// One film shared by several problem types.
const sharedFilm = skills.find((s) => s.id === "name-shapes")!;
assert(filmsOf(sharedFilm.id).length > distinctFilms(sharedFilm.id));
// Skills far down the pathway, a phone's several screens from its top.
const farSkill = skills.find((s) => s.id === "similarity-theorems")!;
const otherFar = skills.find((s) => s.id === "nonlinear-systems")!;
const unfilmed = typesOf(oneFilm.id).find((t) => !lessonFilms[t.id])!.id;

async function fixture(
  page: Page,
  { holdLessons = 0, holdFrontier = 0, holdCatalog = 0 } = {},
) {
  await page.addInitScript((learner) => {
    localStorage.setItem(
      "amp.learner",
      JSON.stringify({ state: { learnerId: learner }, version: 1 }),
    );
  }, LEARNER);
  await page.route("**/api/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/catalog")) {
      if (holdCatalog) await new Promise((r) => setTimeout(r, holdCatalog));
      return route.fulfill({
        json: {
          skills,
          templates,
          lessons: [],
          mode: "hosted",
          trial: { free: 100, placement: 20 },
        },
      });
    }
    if (pathname.endsWith("/auth-config"))
      return route.fulfill({
        json: { mode: "accounts", passwords: true, providers: [] },
      });
    if (pathname.endsWith("/events"))
      return route.fulfill({ status: 204, body: "" });
    if (pathname.endsWith("/me"))
      return route.fulfill({
        json: fixtureMe(
          {
            consent: {
              status: "active",
              policyVersion: "fixture",
              recordedAt: null,
              withdrawnAt: null,
            },
            learners: [
              {
                id: LEARNER,
                name: "Sample learner",
                birthYear: 2018,
                deletedAt: null,
                access: [],
                stripeLinked: false,
                canPractice: true,
              },
            ],
            retained: retentionNotice,
          },
          "parent-one",
        ),
      });
    if (pathname.endsWith("/practice-state"))
      return route.fulfill({ json: defaultPracticeSettings() });
    if (pathname.includes("/problem-lessons/")) {
      if (holdLessons) await new Promise((r) => setTimeout(r, holdLessons));
      return route.fulfill({
        json: {
          lesson: problemLesson(pathname.split("/").pop()!, "flat-proof"),
        },
      });
    }
    if (pathname.endsWith("/books"))
      return route.fulfill({ json: { books: [] } });
    if (pathname.endsWith("/progress"))
      return route.fulfill({
        json: {
          asOf: new Date().toISOString(),
          skills: [
            [oneFilm.id, 2, 1, "practicing"],
            [skills[3]!.id, 8, 6, "practicing"],
            [skills[8]!.id, 25, 20, "review-ready"],
          ].map(([skillId, attempts, independentCorrect, status]) => ({
            skillId,
            attempts,
            independentCorrect,
            independentOccasions: 0,
            status,
            reviewDueAt: null,
          })),
        },
      });
    if (/\/learners\/[^/]+\/skills\//.test(pathname)) {
      const skillId = pathname.split("/").at(-1)!;
      return route.fulfill({
        json: {
          skillId,
          evidence:
            skillId === oneFilm.id
              ? {
                  attempts: 2,
                  independentCorrect: 1,
                  status: "practicing",
                  lastPracticedAt: null,
                }
              : {
                  attempts: 0,
                  independentCorrect: 0,
                  status: "new",
                  lastPracticedAt: null,
                },
          work: [],
        },
      });
    }
    if (pathname.endsWith("/frontier")) {
      if (holdFrontier) await new Promise((r) => setTimeout(r, holdFrontier));
      return route.fulfill({
        json: {
          expected: 2,
          overall: { level: 1.4, sd: 0.4, answered: 30, independent: 24 },
          strands: {
            number: { level: 1.4, sd: 0.4, answered: 30, independent: 24 },
          },
        },
      });
    }
    return route.fulfill({
      status: 404,
      json: { error: "fixture_not_implemented" },
    });
  });
}

async function noOverflow(page: Page, where: string) {
  const wide = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 1,
  );
  assert.equal(wide, false, `${where}: horizontal overflow`);
}
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${output}/${name}.png` });

const widths = (process.env.AMP_WIDTHS ?? "320,390,768,1280")
  .split(",")
  .map(Number);
for (const width of widths)
  for (const colorScheme of ["light", "dark"] as const) {
    const tag = `${width}-${colorScheme}`;
    const context = await browser.newContext({
      viewport: { width, height: width >= 768 ? 900 : 844 },
      colorScheme,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    // Q-208: no WebGL: the flat pathway, no canvas, no camera controls.
    await fixture(page, { holdFrontier: 900 });
    await page.goto(`${origin}/pathways`);
    const plan = page.locator(".pathways-plan");
    await plan.waitFor();
    const probe = plan.locator(`[data-plan-skill="${skills[40]!.id}"]`);
    const before = await probe.evaluate((el) => (el as HTMLElement).offsetTop);
    await plan.getByText("Where you are", { exact: true }).waitFor();
    assert.equal(
      await probe.evaluate((el) => (el as HTMLElement).offsetTop),
      before,
      `${tag}: the level's arrival never moves a skill in the pathway`,
    );
    assert.equal(await page.locator("canvas").count(), 0, `${tag}: canvas`);
    assert.equal(await page.locator(".pathways-camera").count(), 0);
    assert.doesNotMatch(
      await page.evaluate(() =>
        [
          ...document.querySelectorAll(
            ".pathways-status, .pathways-plan, .pathways-footer",
          ),
        ]
          .map((el) => (el as HTMLElement).innerText)
          .join(" "),
      ),
      /\b3D\b|device/,
      `${tag}: no 3D or device words`,
    );
    assert(
      await plan.getByText("Where you are", { exact: true }).evaluate((el) => {
        const box = el.closest(".pathways-plan")!.getBoundingClientRect();
        const tagBox = el.getBoundingClientRect();
        return tagBox.top >= box.top && tagBox.bottom <= box.bottom;
      }),
      `${tag}: the pathway opens on the learner's level`,
    );
    const skillCount = await plan.locator("[data-plan-skill]").count();
    assert.equal(skillCount, skills.length, `${tag}: every skill is offered`);
    const short = await plan
      .locator("[data-plan-skill]")
      .evaluateAll(
        (els) =>
          els.filter((el) => el.getBoundingClientRect().height < 44).length,
      );
    assert.equal(short, 0, `${tag}: 44 px skill targets`);
    await noOverflow(page, `${tag} pathway`);
    await page.waitForTimeout(300);
    await shot(page, `q208-flat-pathway-${tag}`);
    await plan.locator(`[data-plan-skill="${oneFilm.id}"]`).click();
    await page
      .getByRole("heading", { name: oneFilm.title, exact: true })
      .waitFor();
    assert.match(page.url(), new RegExp(`open=skill%3A${oneFilm.id}`));

    // Q-211: the skill's films at its top: one card for its one film.
    const sheet = page.locator(`[data-skill-layer="${oneFilm.id}"]`);
    await sheet.locator("[data-skill-learner]").waitFor();
    const cards = sheet.locator("[data-film-card]");
    assert.equal(await cards.count(), 1, `${tag}: one film, one card`);
    const poster = await cards.first().locator("span").first().boundingBox();
    assert(
      poster && Math.abs(poster.width / poster.height - 16 / 9) < 0.05,
      `${tag}: the poster keeps 16:9`,
    );
    const order = await sheet.evaluate((el) =>
      [
        el.querySelector("p"),
        el.querySelector("a[href*='/practice']"),
        el.querySelector("[data-skill-films]"),
      ].map((node) => (node ? el.innerHTML.indexOf(node.outerHTML) : -1)),
    );
    assert(
      order.every((n, i) => n >= 0 && (i === 0 || n > order[i - 1]!)),
      `${tag}: description, Try, then Watch`,
    );
    assert.equal(
      await sheet.locator("[data-film-glyph]").count(),
      1,
      `${tag}: the filmed problem type's row carries the play glyph`,
    );
    const facts = await sheet.locator("dl").innerText();
    assert.doesNotMatch(facts, /\d\.\d/, `${tag}: no raw decimal`);
    assert.doesNotMatch(
      await sheet.innerText(),
      /frontier|estimated range/i,
      `${tag}: no frontier jargon`,
    );
    await noOverflow(page, `${tag} skill`);
    await page.waitForTimeout(300);
    await shot(page, `q211-one-film-${tag}`);
    // The card plays in the lesson player at its own address; Back returns.
    await cards.first().click();
    await page.waitForURL(new RegExp(`/lessons/${filmed}/watch`));
    await page.goBack();
    await page
      .getByRole("heading", { name: oneFilm.title, exact: true })
      .waitFor();

    // Several films: every one, a strip on a phone, a grid on a desktop.
    await page.goto(`${origin}/pathways?open=skill:${manyFilms.id}`);
    const many = page.locator(`[data-skill-layer="${manyFilms.id}"]`);
    await many.locator("[data-film-card]").first().waitFor();
    assert.equal(
      await many.locator("[data-film-card]").count(),
      distinctFilms(manyFilms.id),
    );
    const strip = await many.locator("[data-film-cards]").evaluate((el) => ({
      scrolls: el.scrollWidth > el.clientWidth + 1,
      overflowX: getComputedStyle(el).overflowX,
    }));
    if (width <= 640)
      assert(strip.scrolls, `${tag}: several films scroll sideways`);
    else assert(!strip.scrolls, `${tag}: several films fit`);
    await noOverflow(page, `${tag} many films`);
    await page.waitForTimeout(300);
    await shot(page, `q211-several-films-${tag}`);

    // No films: no row and no space.
    await page.goto(`${origin}/pathways?open=skill:${noFilms.id}`);
    const none = page.locator(`[data-skill-layer="${noFilms.id}"]`);
    await none.locator("[data-skill-learner]").waitFor();
    assert.equal(await none.locator("[data-skill-films]").count(), 0);
    assert.equal(await none.getByText("Watch", { exact: true }).count(), 0);
    await page.waitForTimeout(300);
    await shot(page, `q211-no-films-${tag}`);

    // Q-210: the lesson layer: the title, then one row, Try then Watch.
    const lessonPage = await context.newPage();
    await fixture(lessonPage, { holdLessons: 1200 });
    await lessonPage.goto(
      `${origin}/pathways?open=skill:${oneFilm.id},lesson:${filmed}`,
    );
    const dialog = lessonPage.getByRole("dialog", {
      name: "Explore a problem type",
    });
    const title = dialog.getByRole("heading", {
      name: templates.find((t) => t.id === filmed)!.title,
      exact: true,
    });
    await title.waitFor();
    const try_ = dialog.getByRole("link", {
      name: "Try this problem type",
      exact: true,
    });
    const watch = dialog.getByRole("link", {
      name: /^Watch lesson · \d+:\d\d$/,
    });
    await try_.waitFor();
    await watch.waitFor();
    const early = {
      title: await title.boundingBox(),
      try: await try_.boundingBox(),
      watch: await watch.boundingBox(),
    };
    await dialog.locator(".problem-lesson").waitFor();
    assert.deepEqual(
      {
        title: await title.boundingBox(),
        try: await try_.boundingBox(),
        watch: await watch.boundingBox(),
      },
      early,
      `${tag}: the head never moves when the lesson lands`,
    );
    assert.equal(
      await title.innerText(),
      templates.find((t) => t.id === filmed)!.title,
    );
    assert(early.title!.y < early.try!.y, `${tag}: title first`);
    if (width <= 640) {
      // Stacked, each the full width of the lesson's column.
      const column = (await dialog.locator(".problem-lesson").boundingBox())!;
      assert(early.try!.y + early.try!.height <= early.watch!.y);
      for (const button of [early.try!, early.watch!])
        assert(
          Math.abs(button.width - column.width) < 1 &&
            Math.abs(button.x - column.x) < 1,
          `${tag}: phone actions fill the column (${button.width} of ${column.width})`,
        );
    } else {
      assert(Math.abs(early.try!.y - early.watch!.y) < 1, `${tag}: one row`);
      assert(early.try!.x < early.watch!.x, `${tag}: Try, then Watch`);
    }
    const sheetBox = (await dialog.boundingBox())!;
    if (width >= 1280)
      assert(
        sheetBox.width >= 880 && sheetBox.width <= 960,
        `${tag}: lesson sheet ${sheetBox.width}px`,
      );
    assert.equal(
      await dialog.locator(".lesson-film-link").count(),
      0,
      `${tag}: no film card in the lesson`,
    );
    await noOverflow(lessonPage, `${tag} lesson`);
    await lessonPage.waitForTimeout(300);
    await shot(lessonPage, `q210-lesson-with-film-${tag}`);
    // No film: the same row holds Try alone.
    await lessonPage.goto(
      `${origin}/pathways?open=skill:${oneFilm.id},lesson:${unfilmed}`,
    );
    await dialog.locator(".problem-lesson").waitFor();
    await try_.waitFor();
    assert.equal(await dialog.getByRole("link", { name: /^Watch/ }).count(), 0);
    await lessonPage.waitForTimeout(300);
    await shot(lessonPage, `q210-lesson-no-film-${tag}`);
    await lessonPage.close();

    // A cold link to a lesson, its catalog slow: Watch holds its place while
    // Try's is kept for it.
    const cold = await context.newPage();
    await fixture(cold, { holdCatalog: 1500 });
    await cold.goto(`${origin}/pathways?open=lesson:${filmed}`);
    const coldDialog = cold.getByRole("dialog", {
      name: "Explore a problem type",
    });
    const coldWatch = coldDialog.getByRole("link", { name: /^Watch lesson/ });
    await coldWatch.waitFor();
    const held = (await coldWatch.boundingBox())!;
    await coldDialog
      .getByRole("link", { name: "Try this problem type", exact: true })
      .waitFor();
    assert.deepEqual(
      await coldWatch.boundingBox(),
      held,
      `${tag}: Watch never moves when the catalog arrives`,
    );
    await cold.close();

    // A film shared by several problem types: one card, a glyph on each row.
    const shared = await context.newPage();
    await fixture(shared);
    await shared.goto(`${origin}/pathways?open=skill:${sharedFilm.id}`);
    const sharedSheet = shared.locator(`[data-skill-layer="${sharedFilm.id}"]`);
    await sharedSheet.locator("[data-film-card]").first().waitFor();
    assert.equal(
      await sharedSheet.locator("[data-film-card]").count(),
      distinctFilms(sharedFilm.id),
    );
    assert.equal(
      await sharedSheet.locator("[data-film-glyph]").count(),
      filmsOf(sharedFilm.id).length,
      `${tag}: every filmed problem type says so`,
    );
    await shared.close();

    // A skill chosen far down the flat pathway is centred in view, by its
    // address and from the list, and still there once its sheet closes.
    const far = await context.newPage();
    await fixture(far);
    const inView = async (id: string) =>
      far.evaluate((skill) => {
        const plan = document.querySelector(".pathways-plan")!;
        const head = plan.firstElementChild as HTMLElement;
        const box = plan.getBoundingClientRect();
        const top =
          box.top +
          (getComputedStyle(head).display === "none" ? 0 : head.offsetHeight);
        const el = plan
          .querySelector(`[data-plan-skill="${skill}"]`)!
          .getBoundingClientRect();
        return el.top >= top - 1 && el.bottom <= box.bottom + 1;
      }, id);
    await far.goto(`${origin}/pathways?open=skill:${farSkill.id}`);
    await far
      .getByRole("heading", { name: farSkill.title, exact: true })
      .waitFor();
    assert(await inView(farSkill.id), `${tag}: an address's skill is in view`);
    await far.keyboard.press("Escape");
    await far
      .getByRole("heading", { name: farSkill.title, exact: true })
      .waitFor({ state: "detached" });
    assert(await inView(farSkill.id), `${tag}: still in view once closed`);
    await far.goto(`${origin}/pathways`);
    await far.locator(".pathways-plan").waitFor();
    await far.getByRole("button", { name: /^Browse/ }).click();
    await far
      .locator(`#pathways-browser a[href*="skill%3A${otherFar.id}"]`)
      .click();
    await far
      .getByRole("heading", { name: otherFar.title, exact: true })
      .waitFor();
    await far.waitForTimeout(900);
    assert(
      await inView(otherFar.id),
      `${tag}: a skill from the list is in view`,
    );
    await far.keyboard.press("Escape");
    await far.waitForTimeout(300);
    await shot(far, `q208-chosen-skill-in-view-${tag}`);
    await far.close();

    assert.deepEqual(errors, [], `${tag}: page errors`);
    await context.close();
    console.log(`${tag}: passed`);
  }
await browser.close();
await vite.close();
console.log(
  "Pathways flat pathway, lesson head and skill films: every width and theme passed.",
);
