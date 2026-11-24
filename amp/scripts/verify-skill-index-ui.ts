/**
 * Inventory by grade (a child's skills as one grade's flat index), in a
 * real browser, as a family's parent at 390 and 1280:
 *
 * - one tap from the child's block on Today opens their Inventory by grade,
 *   on their own grade: every skill of that grade under the five areas in
 *   teaching order, each row's standing the dashboard's own word for the
 *   child's record on it, each skill's problem types under it (all listed
 *   from 768 px; behind the skill's own fold on a phone), the key on screen;
 * - another grade is one tap, and nothing above the index moves; a refresh
 *   keeps the grade;
 * - "By area" is Inventory as it was (its collection and filters), the
 *   switch holds its place, and "By grade" comes back to the same grade;
 * - on paper the grade is a checklist: no controls, every problem type;
 * - "All Grade N skills" in Overall on the child's page opens the same view
 *   on that grade;
 * - a problem type opens its lesson; a skill opens its layer, and Practice
 *   there starts THAT child's practice held to the skill (the hand-over),
 *   with Back returning to the index;
 * - at every width, every link and button of the index is a 44 px target
 *   (each one measured, wherever it is on the page), and the shared probe
 *   the app-shell check runs (scripts/app-shell-probe.ts) finds no small
 *   target, no overlapping controls and no word broken across lines;
 * - no sideways overflow, no cut word, no console error.
 *
 * By default it starts its own stack, as CI does (AMP_TEST_DATABASE_URL);
 * or point it at a running, seeded preview:
 *
 *   npx tsx scripts/verify-skill-index-ui.ts --origin http://127.0.0.1:4780
 *     [--widths 390,768,1024,1280] [--out artifacts/skill-index] [--shots]
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium, type Page } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { stubAnalytics } from "./analytics-stub";
import { probe } from "./app-shell-probe";
import { startPersonaStack } from "./persona-stack";
import {
  PERSONA_PASSPHRASE,
  personaEmail,
} from "../src/web/features/dev/persona-list";
import {
  gradeIndex,
  ownBand,
  shortBand,
  standingOf,
} from "../src/web/features/inventory/grade-index";
import {
  bandLabel,
  bands,
  catalogSchema,
  frontierSchema,
  progressSchema,
} from "../src/web/features/pathways/model";

/** The dashboard's words for a standing (features/learners/SkillKey). */
const WORDS = {
  strong: "Strong",
  earned: "Earned",
  tried: "Tried",
  notAsked: "Not asked yet",
} as const;
const chromium = secureChromium(rawChromium);
const argument = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const OUT = argument("out") ?? "artifacts/skill-index";
const WIDTHS = (argument("widths") ?? "390,768,1024,1280")
  .split(",")
  .map(Number);
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
  /** A grade as the screen lists it: areas, their skills, their types. */
  const listed = (band: string) => gradeIndex(catalog, band);
  const skillsOf = (band: string) =>
    listed(band).flatMap((section) => section.skills);
  const expected = skillsOf(own);
  assert.ok(expected.length >= 10, `${own} has its skills`);
  const inventory = `/family/${family}/kids/${child.id}/inventory`;
  console.log(
    `${CHILD}'s own grade: ${own} (${expected.length} skills, ${expected.reduce((sum, row) => sum + row.types.length, 0)} problem types), at ${origin}`,
  );

  for (const width of WIDTHS) {
    const context = await browser.newContext({
      storageState: state,
      viewport: { width, height: width < 600 ? 844 : 900 },
    });
    await stubAnalytics(context);
    const page = await context.newPage();
    // What went wrong, and when: on the index and its layers, or while the
    // device changes hands (the child's session starting, the parent's
    // coming back), which is the hand-over's own ground.
    let phase: "index" | "hand-over" = "index";
    const errors: string[] = [];
    const refused: string[] = [];
    page.on("console", (message) => {
      // A refused request is read from its response, with its address.
      if (
        message.type() === "error" &&
        !message.text().startsWith("Failed to load resource")
      )
        errors.push(`${message.text()} [${phase}]`);
    });
    page.on("pageerror", (error) => errors.push(`${error.message} [${phase}]`));
    page.on("response", (answer) => {
      if (answer.status() >= 400)
        refused.push(
          `${answer.status()} ${answer.request().method()} ${new URL(answer.url()).pathname} [${phase}]`,
        );
    });
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
    /** Every link and button of the index, measured where it lies (the
     * whole page, not only what is on view): none under 44 px either way.
     * Then the shared probe on the screen as it stands. */
    const targets = async (what: string) => {
      assert.deepEqual(
        await page
          .locator(
            "[data-grade-index] a, [data-grade-index] button, [role=radio]",
          )
          .evaluateAll((items) =>
            items
              .map((item) => ({
                item,
                box: item.getBoundingClientRect(),
              }))
              .filter(({ box }) => box.width > 0 && box.height > 0)
              .filter(({ box }) => box.height < 43.5 || box.width < 43.5)
              .map(
                ({ item, box }) =>
                  `"${(item.getAttribute("aria-label") ?? item.textContent ?? "").trim().slice(0, 40)}" ${Math.round(box.width)}×${Math.round(box.height)}`,
              ),
          ),
        [],
        at(`${what}: targets under 44 px`),
      );
      const found = await probe(page);
      assert.deepEqual(
        found.smallTargets,
        [],
        at(`${what}: targets under 44 px (the shared probe)`),
      );
      assert.deepEqual(found.overlaps, [], at(`${what}: overlapping controls`));
      assert.deepEqual(
        found.midWordWraps,
        [],
        at(`${what}: a word broken across lines`),
      );
    };
    const slice = (name: "By grade" | "By area") =>
      page.getByRole("radio", { name, exact: true });
    const rows = () =>
      page.locator("[data-grade-index] li[data-skill]").evaluateAll((items) =>
        items.map((item) => ({
          id: item.getAttribute("data-skill")!,
          standing: item.getAttribute("data-standing")!,
          word: item.querySelector("[data-standing-word]")?.textContent ?? "",
          swatch: !!item.querySelector("[data-standing-word]")
            ?.previousElementSibling,
          height: Math.round(
            item.firstElementChild!.getBoundingClientRect().height,
          ),
          types: [...item.querySelectorAll("a[data-type]")].map((type) =>
            type.getAttribute("data-type"),
          ),
          typesShown: [...item.querySelectorAll("a[data-type]")].filter(
            (type) => type.getBoundingClientRect().height > 0,
          ).length,
        })),
      );
    /** The grade's whole index is on view, as the record says it. */
    const showsGrade = async (band: string, what: string) => {
      const sections = listed(band);
      const skills = sections.flatMap((section) => section.skills);
      await page
        .locator(`[data-grade-index="${band}"] [data-grade="${band}"]`)
        .and(page.locator("[aria-pressed=true]"))
        .waitFor();
      await page.locator(`li[data-skill="${skills[0]!.skill.id}"]`).waitFor();
      const shown = await rows();
      assert.deepEqual(
        shown.map((row) => row.id),
        skills.map((row) => row.skill.id),
        at(`${what}: every skill of the grade, in teaching order`),
      );
      for (const [index, row] of shown.entries()) {
        const standing = standingOf(evidence.get(row.id));
        assert.equal(row.standing, standing, at(`${what}: ${row.id}`));
        assert.equal(row.word, WORDS[standing], at(row.id));
        assert.ok(row.swatch, at(`${row.id} has its swatch`));
        assert.deepEqual(
          row.types,
          skills[index]!.types.map((type) => type.id),
          at(`${what}: ${row.id}'s problem types`),
        );
      }
      assert.deepEqual(
        await page.locator("[data-grade-index] h2").allTextContents(),
        sections.map((section) => section.title),
        at(`${what}: the areas, in order`),
      );
      return shown;
    };

    // ---- Today → the child's grade, one tap ------------------------------
    await page.goto(origin);
    const link = page.locator(`a[data-skills-by-grade="${child.id}"]`);
    await link.waitFor({ timeout: 30_000 });
    await fits("Today");
    assert.ok(
      (await link.boundingBox())!.height >= 44,
      at("the link is a 44 px target"),
    );
    await link.click();
    await page.waitForURL((url) => url.pathname === inventory);
    const shown = await showsGrade(own, "from Today");
    assert.equal(
      await slice("By grade").getAttribute("aria-checked"),
      "true",
      at("it opens by grade"),
    );
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
    const wide = width >= 768;
    // From 768 px every problem type is listed; a phone folds them under
    // their skill, one tap away.
    for (const row of shown)
      assert.equal(
        row.typesShown,
        wide ? row.types.length : 0,
        at(`${row.id}: problem types ${wide ? "listed" : "folded"}`),
      );
    if (!wide) {
      const first = page.locator(`li[data-skill="${shown[0]!.id}"]`);
      const fold = first.getByRole("button", { name: /problem types?$/ });
      assert.equal(
        (await fold.innerText()).trim(),
        `${shown[0]!.types.length} problem type${shown[0]!.types.length === 1 ? "" : "s"}`,
        at("the fold counts its problem types"),
      );
      assert.ok((await fold.boundingBox())!.height >= 44, at("the fold"));
      await fold.click();
      assert.equal(
        (await rows())[0]!.typesShown,
        shown[0]!.types.length,
        at("the fold opens its problem types"),
      );
      assert.ok(
        (await first.locator("a[data-type]").first().boundingBox())!.height >=
          44,
        at("a problem type is a 44 px target"),
      );
      await targets("an open fold");
      if (SHOTS)
        await page.screenshot({ path: `${OUT}/grade-${width}-open.png` });
      await fold.click();
    }
    // Skill rows: one height on a wide screen; nowhere a cut word or a small
    // target.
    if (width >= 1024)
      assert.equal(
        new Set(shown.map((row) => row.height)).size,
        1,
        at(
          `skill rows are one height: ${[...new Set(shown.map((row) => row.height))]}`,
        ),
      );
    assert.deepEqual(
      await page
        .locator(
          "[data-grade-index] li[data-skill] a, [data-skill-key] li, [data-grade-row] button, [role=radio]",
        )
        .evaluateAll((items) =>
          items
            .filter((item) => item.scrollWidth > item.clientWidth + 1)
            .map((item) => item.textContent),
        ),
      [],
      at("no cut word"),
    );
    await targets("the grade");
    console.log(
      `  page height (${width}): ${await page.evaluate(() => document.documentElement.scrollHeight)} px`,
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

    // ---- on paper: a checklist ------------------------------------------
    await page.emulateMedia({ media: "print" });
    assert.deepEqual(
      await page
        .locator(
          "[data-app-bar], [data-grade-row], [role=radiogroup], [role=searchbox], [data-grade-index] button",
        )
        .evaluateAll((items) =>
          items
            .filter((item) => item.getBoundingClientRect().height > 0)
            .map((item) => item.getAttribute("aria-label") ?? item.tagName),
        ),
      [],
      at("no controls on paper"),
    );
    assert.deepEqual(
      (await rows()).map((row) => row.typesShown),
      shown.map((row) => row.types.length),
      at("every problem type on paper"),
    );
    assert.match(
      await page.locator("[data-grade-index] > p").first().innerText(),
      new RegExp(`^${CHILD} · ${bandLabel(own)} skills$`),
      at("the sheet says whose and which grade"),
    );
    if (SHOTS && width === WIDTHS.at(-1))
      await page.screenshot({
        path: `${OUT}/grade-print.png`,
        fullPage: true,
      });
    await page.emulateMedia({ media: "screen" });

    // ---- another grade: one tap, and nothing above the index moves --------
    const other = bands[bands.indexOf(own) > 0 ? bands.indexOf(own) - 1 : 1]!;
    const boxes = () =>
      page.evaluate(() =>
        [
          "[role=radiogroup]",
          "[data-grade-row]",
          "[data-skill-key]",
          "[data-grade-index] h2",
        ].map((selector) => {
          const box = document.querySelector(selector)!.getBoundingClientRect();
          return [Math.round(box.x), Math.round(box.y), Math.round(box.height)];
        }),
      );
    const before = await boxes();
    await page.locator(`[data-grade-row] [data-grade="${other}"]`).click();
    await showsGrade(other, "another grade");
    assert.deepEqual(
      await boxes(),
      before,
      at("nothing above the index moved"),
    );
    await fits("another grade");
    await targets("another grade");
    // A refresh keeps the grade.
    await page.reload();
    await showsGrade(other, "after a refresh");

    // ---- by area is Inventory as it was; by grade comes back --------------
    const switchBox = async () =>
      (await page.getByRole("radiogroup", { name: "View" }).boundingBox())!;
    const held = await switchBox();
    await slice("By area").click();
    await page.getByRole("group", { name: "Skills to show" }).waitFor();
    assert.equal(
      await page.locator("[data-grade-index]").count(),
      0,
      at("by area has no grade index"),
    );
    assert.ok(
      (await page.locator("li[data-strength]").count()) > 0,
      at("by area lists the collection"),
    );
    assert.deepEqual(await switchBox(), held, at("the switch holds its place"));
    await fits("by area");
    await slice("By grade").click();
    await showsGrade(other, "by grade again");
    assert.deepEqual(await switchBox(), held, at("the switch holds its place"));
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
    assert.equal(
      (await byGrade.innerText()).trim(),
      `All ${bandLabel(own)} skills`,
      at("Overall names the grade"),
    );
    assert.ok(
      (await byGrade.boundingBox())!.height >= 44,
      at("Overall's row is a 44 px target"),
    );
    await fits("Overall");
    if (SHOTS && width === WIDTHS.at(-1)) {
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${OUT}/overall-${width}-light.png` });
    }
    await byGrade.click();
    await page.waitForURL((url) => url.pathname === inventory);
    await showsGrade(own, "from Overall");

    // ---- a problem type opens its lesson ----------------------------------
    const typed = expected[0]!;
    const row = page.locator(`li[data-skill="${typed.skill.id}"]`);
    if (!wide)
      await row.getByRole("button", { name: /problem types?$/ }).click();
    await row.locator(`a[data-type="${typed.types[0]!.id}"]`).click();
    await page
      .locator(`[data-layer-frame][data-layers="lesson:${typed.types[0]!.id}"]`)
      .waitFor();
    await fits("a lesson");
    await page.keyboard.press("Escape");
    await page.locator("[data-layer-frame]").waitFor({ state: "detached" });

    // ---- a skill opens its layer; Practice there is this child's -----------
    const pick =
      expected.find(
        (entry) => standingOf(evidence.get(entry.skill.id)) === "notAsked",
      ) ?? expected[0]!;
    await page.locator(`li[data-skill="${pick.skill.id}"] > div a`).click();
    const layer = page.locator(`[data-skill-layer="${pick.skill.id}"]`);
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
    if (SHOTS) {
      // (The layer has slid in.)
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${OUT}/skill-${width}-light.png` });
    }
    phase = "hand-over";
    const handed = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname ===
          `/api/v1/family/learners/${child.id}/practice-here`,
    );
    await practice.click();
    await handed;
    await page.waitForURL(
      (url) => url.pathname === `/practice/${child.id}/skills/${pick.skill.id}`,
      { timeout: 30_000 },
    );
    await page.locator(".problem-stage .question").waitFor({ timeout: 30_000 });
    // Back: the parent's index again, on the same grade.
    await page.goBack();
    await page.waitForURL((url) => url.pathname === inventory);
    await page
      .locator(`[data-grade-index="${own}"] li[data-skill="${pick.skill.id}"]`)
      .waitFor({ timeout: 30_000 });

    assert.deepEqual(errors, [], at("no console error"));
    assert.deepEqual(
      refused.filter((entry) => entry.endsWith("[index]")),
      [],
      at("no request refused on the index"),
    );
    // Said, not failed here: the hand-over's own check is
    // scripts/verify-child-practice-ui.ts.
    for (const entry of refused) console.log(`  note (${width}): ${entry}`);
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
    await page.locator(`li[data-skill="${expected[0]!.skill.id}"]`).waitFor();
    await page.screenshot({
      path: `${OUT}/grade-1280-dark.png`,
      fullPage: true,
    });
    await context.close();
  }
  console.log(
    `Inventory by grade: Today and Overall open ${CHILD}'s own grade (${shortBand(own)}), whole and in order, with its problem types; a skill starts ${CHILD}'s practice; passed at ${WIDTHS.join(", ")}.`,
  );
} catch (error) {
  failed = error;
} finally {
  await browser.close();
  await stack?.stop();
}
if (failed) throw failed;
