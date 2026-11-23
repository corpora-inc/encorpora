/**
 * A child's skills by grade (Inventory, by grade), in a real browser, as a
 * family's parent at 390 and 1280:
 *
 * - one tap from the child's block on Today opens their Inventory on their
 *   own grade: every skill of that grade, under the five areas in teaching
 *   order, each row's standing the dashboard's own word for the child's
 *   record on it, the key on screen;
 * - another grade is one tap, and nothing above the list moves;
 * - a refresh keeps the grade;
 * - "Overall" on the child's page opens the same view;
 * - a row opens the skill, and Practice there starts THAT child's practice
 *   held to the skill (the hand-over), with Back returning to the list;
 * - no sideways overflow, no cut word, 44 px targets, no console error.
 *
 * By default it starts its own stack, as CI does (AMP_TEST_DATABASE_URL);
 * or point it at a running, seeded preview:
 *
 *   npx tsx scripts/verify-skill-index-ui.ts --origin http://127.0.0.1:4780
 *     [--widths 390,1280] [--out artifacts/skill-index] [--shots]
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium, type Page } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { stubAnalytics } from "./analytics-stub";
import { startPersonaStack } from "./persona-stack";
import {
  PERSONA_PASSPHRASE,
  personaEmail,
} from "../src/web/features/dev/persona-list";
import { areas } from "../src/curriculum/areas";
import {
  ownBand,
  shortBand,
  standingOf,
  teachingOrder,
} from "../src/web/features/inventory/grade-index";
import { STANDING } from "../src/web/features/learners/SkillKey";
import {
  areaSlot,
  bands,
  catalogSchema,
  frontierSchema,
  progressSchema,
} from "../src/web/features/pathways/model";

const chromium = secureChromium(rawChromium);
const argument = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const OUT = argument("out") ?? "artifacts/skill-index";
const WIDTHS = (argument("widths") ?? "390,1280").split(",").map(Number);
const SHOTS = process.argv.includes("--shots");
const CHILD = argument("child") ?? "Wren";
await mkdir(OUT, { recursive: true });
const stack = argument("origin")
  ? null
  : await startPersonaStack({
      webPort: Number(argument("port") ?? 4962),
      personas: ["family"],
      name: "skill_index",
      out: OUT,
    });
const origin = argument("origin") ?? stack!.origin;

const browser = await chromium.launch();
let failed: unknown;
try {
  // ---- who, and what the screen should say --------------------------------
  const signedIn = await browser.newContext();
  const response = await signedIn.request.post(
    `${origin}/api/auth/sign-in/email`,
    {
      headers: { Origin: origin },
      data: { email: personaEmail("family"), password: PERSONA_PASSPHRASE },
    },
  );
  assert.ok(response.ok(), `the parent signs in: ${response.status()}`);
  const session = await (
    await signedIn.request.get(`${origin}/api/auth/get-session`)
  ).json();
  const state = await signedIn.storageState();
  await signedIn.close();
  const token = session.session.token as string;
  const api = async (path: string) => {
    const answer = await fetch(`${origin}/api/v1${path}`, {
      headers: { Authorization: `Bearer ${token}`, Origin: origin },
    });
    assert.ok(answer.ok, `${path}: ${answer.status}`);
    return answer.json();
  };
  const family = (await api("/families")).families[0].familyId as string;
  const child = (
    (await api(`/families/${family}`)).children as {
      id: string;
      name: string;
    }[]
  ).find((entry) => entry.name === CHILD);
  assert.ok(child, `the family has ${CHILD}`);
  const catalog = catalogSchema.parse(await api("/catalog/map"));
  const frontier = frontierSchema.parse(
    await api(`/learners/${child.id}/frontier`),
  );
  const evidence = new Map(
    progressSchema
      .parse(await api(`/learners/${child.id}/progress`))
      .skills.map((entry) => [entry.skillId, entry]),
  );
  const own = ownBand(frontier);
  /** A grade as the screen lists it: its skills in teaching order. */
  const listed = (band: string) =>
    teachingOrder(
      catalog.skills.filter((skill) => skill.gradeBand === band),
      catalog.skills,
    );
  const expected = listed(own);
  assert.ok(expected.length >= 10, `${own} has its skills`);
  const inventory = `/family/${family}/kids/${child.id}/inventory`;
  console.log(
    `${CHILD}'s own grade: ${own} (${expected.length} skills), at ${origin}`,
  );

  for (const width of WIDTHS) {
    const context = await browser.newContext({
      storageState: state,
      viewport: { width, height: width < 600 ? 844 : 900 },
    });
    await stubAnalytics(context);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    const at = (what: string) => `${what} (${width})`;
    const fits = async (what: string) =>
      assert.equal(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
        0,
        at(`${what}: no sideways overflow`),
      );
    const pressed = () =>
      page
        .locator("[data-grade-row] [aria-pressed=true]")
        .getAttribute("data-grade");
    const rows = () =>
      page.locator("li[data-skill]").evaluateAll((items) =>
        items.map((item) => ({
          id: item.getAttribute("data-skill")!,
          standing: item.getAttribute("data-standing")!,
          word: item.querySelector("[data-standing-word]")?.textContent ?? "",
          height: Math.round(item.getBoundingClientRect().height),
        })),
      );
    /** The grade's whole list is on view, as the record says it. */
    const showsGrade = async (band: string, what: string) => {
      const skills = listed(band);
      await page
        .locator(`[data-grade-row] [data-grade="${band}"][aria-pressed=true]`)
        .waitFor();
      await page.locator(`li[data-skill="${skills[0]!.id}"]`).waitFor();
      const shown = await rows();
      assert.deepEqual(
        shown.map((row) => row.id),
        skills.map((skill) => skill.id),
        at(`${what}: every skill of the grade, in teaching order`),
      );
      for (const row of shown) {
        const standing = standingOf(evidence.get(row.id));
        assert.equal(row.standing, standing, at(`${what}: ${row.id}`));
        assert.equal(row.word, STANDING[standing].term, at(row.id));
      }
      assert.deepEqual(
        await page.locator("main h2").allTextContents(),
        areas
          .filter((_, slot) => skills.some((skill) => areaSlot(skill) === slot))
          .map((area) => area.title),
        at(`${what}: the areas, in order`),
      );
      return shown;
    };

    // ---- Today → the child's grade, one tap ------------------------------
    await page.goto(origin);
    const link = page.locator(`a[data-skills-by-grade="${child.id}"]`);
    await link.waitFor({ timeout: 30_000 });
    await fits("Today");
    const target = (await link.boundingBox())!;
    assert.ok(target.height >= 44, at("the link is a 44 px target"));
    await link.click();
    await page.waitForURL((url) => url.pathname === inventory);
    assert.equal(await pressed(), own, at("it opens on the child's own grade"));
    const shown = await showsGrade(own, "from Today");
    // The key, once, in the dashboard's words.
    assert.deepEqual(
      await page
        .locator("[data-skill-key] li")
        .evaluateAll((items) =>
          items.map((item) => item.children[1]?.textContent ?? ""),
        ),
      ["Strong", "Earned", "Tried", "Not asked yet"],
      at("the key"),
    );
    await fits("the grade");
    // Rows: one height on a wide screen; nowhere a cut word or a small target.
    if (width >= 1024)
      assert.equal(
        new Set(shown.map((row) => row.height)).size,
        1,
        at(
          `rows are one height: ${[...new Set(shown.map((row) => row.height))]}`,
        ),
      );
    assert.deepEqual(
      await page
        .locator("li[data-skill] a, [data-skill-key] li, [data-grade-row] button")
        .evaluateAll((items) =>
          items
            .filter((item) => item.scrollWidth > item.clientWidth + 1)
            .map((item) => item.textContent),
        ),
      [],
      at("no cut word"),
    );
    assert.deepEqual(
      await page.locator("[data-grade-row] button").evaluateAll((items) =>
        items
          .map((item) => item.getBoundingClientRect())
          .filter((box) => box.height < 44 || box.width < 44)
          .map((box) => `${box.width}x${box.height}`),
      ),
      [],
      at("every grade is a 44 px target"),
    );
    // The chosen grade is on view in its row, however narrow the screen.
    assert.ok(
      await page.evaluate(() => {
        const row = document.querySelector("[data-grade-row]")!;
        const chosen = row.querySelector("[aria-pressed=true]")!;
        const [outer, inner] = [row, chosen].map((element) =>
          element.getBoundingClientRect(),
        );
        return (
          inner!.left >= outer!.left - 1 && inner!.right <= outer!.right + 1
        );
      }),
      at("the chosen grade is on view"),
    );
    if (SHOTS)
      await page.screenshot({
        path: `${OUT}/grade-${width}-light.png`,
        fullPage: true,
      });

    // ---- another grade: one tap, and nothing above the list moves ----------
    const other = bands[bands.indexOf(own) > 0 ? bands.indexOf(own) - 1 : 1]!;
    const boxes = () =>
      page.evaluate(() =>
        ["[data-grade-row]", "[data-skill-key]", "main h2"].map((selector) => {
          const box = document.querySelector(selector)!.getBoundingClientRect();
          return [Math.round(box.x), Math.round(box.y), Math.round(box.height)];
        }),
      );
    const before = await boxes();
    await page.locator(`[data-grade-row] [data-grade="${other}"]`).click();
    await showsGrade(other, "another grade");
    assert.deepEqual(await boxes(), before, at("nothing above the list moved"));
    await fits("another grade");
    // A refresh keeps the grade.
    await page.reload();
    await showsGrade(other, "after a refresh");
    await page.locator(`[data-grade-row] [data-grade="${own}"]`).click();
    await showsGrade(own, "back to their own grade");

    // ---- the child's page: Overall opens the same view --------------------
    await page.goto(`${origin}/family/${family}/kids/${child.id}`);
    const overall = page.locator('a[data-entity="area"][href*="overall"]');
    await overall.first().waitFor({ timeout: 30_000 });
    await overall.first().click();
    const byGrade = page.locator(
      `[data-layer-panel] [data-skills-by-grade="${child.id}"] a`,
    );
    await byGrade.waitFor();
    assert.ok(
      (await byGrade.boundingBox())!.height >= 44,
      at("Overall's row is a 44 px target"),
    );
    await fits("Overall");
    if (SHOTS && width === WIDTHS.at(-1))
      await page.screenshot({ path: `${OUT}/overall-${width}-light.png` });
    await byGrade.click();
    await page.waitForURL((url) => url.pathname === inventory);
    await showsGrade(own, "from Overall");

    // ---- a row opens the skill; Practice there is this child's -------------
    const pick =
      expected.find(
        (skill) => standingOf(evidence.get(skill.id)) === "notAsked",
      ) ?? expected[0]!;
    await page.locator(`li[data-skill="${pick.id}"] a`).click();
    const layer = page.locator(`[data-skill-layer="${pick.id}"]`);
    await layer.waitFor();
    await fits("the skill");
    const practice = page.locator(
      "[data-layer-panel] [data-curriculum-practice] button",
    );
    await practice.waitFor();
    assert.match(
      (await practice.getAttribute("aria-label")) ?? "",
      new RegExp(`with ${CHILD}$`),
      at("Practice names the child"),
    );
    if (SHOTS)
      await page.screenshot({ path: `${OUT}/skill-${width}-light.png` });
    const handed = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname ===
          `/api/v1/family/learners/${child.id}/practice-here`,
    );
    await practice.click();
    await handed;
    await page.waitForURL(
      (url) => url.pathname === `/practice/${child.id}/skills/${pick.id}`,
      { timeout: 30_000 },
    );
    await page.locator(".problem-stage .question").waitFor({ timeout: 30_000 });
    // Back: the parent's list again, on the same grade.
    await page.goBack();
    await page.waitForURL((url) => url.pathname === inventory);
    await page
      .locator(`[data-grade-row] [data-grade="${own}"][aria-pressed=true]`)
      .waitFor({ timeout: 30_000 });
    await page.locator(`li[data-skill="${pick.id}"]`).waitFor();

    assert.deepEqual(errors, [], at("no console error"));
    await context.close();
    console.log(`  ok ${width}`);
  }

  // ---- dark, for the eye -----------------------------------------------------
  if (SHOTS) {
    const context = await browser.newContext({
      storageState: state,
      viewport: { width: 1280, height: 900 },
      colorScheme: "dark",
    });
    await stubAnalytics(context);
    const page = await context.newPage();
    await page.goto(origin);
    await page.locator(`a[data-skills-by-grade="${child.id}"]`).click();
    await page.locator(`li[data-skill="${expected[0]!.id}"]`).waitFor();
    await page.screenshot({
      path: `${OUT}/grade-1280-dark.png`,
      fullPage: true,
    });
    await context.close();
  }
  console.log(
    `Skills by grade: Today and Overall open ${CHILD}'s own grade (${shortBand(own)}), whole and in order; a row's skill starts ${CHILD}'s practice; passed at ${WIDTHS.join(", ")}.`,
  );
} catch (error) {
  failed = error;
} finally {
  await browser.close();
  await stack?.stop();
}
if (failed) throw failed;
