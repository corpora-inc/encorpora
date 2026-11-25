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
 * - a skill's layer states where the child stands in its row's own word,
 *   by grade and by area alike (one row of each standing there is): never
 *   a second word for it;
 * - a problem type opens its lesson; a skill opens its layer, and Practice
 *   there starts THAT child's practice held to the skill (the hand-over),
 *   with Back returning to the index;
 * - beside Practice, "Workbook": one tap opens the workbook maker with a
 *   workbook already composed from that skill alone, for that child, the
 *   skill named on it; Download there saves it; every problem of the saved
 *   workbook is that skill's and its first page names the skill (read from
 *   the workbook itself); it is listed with the child's workbooks; and
 *   closing the maker comes back to the same skill, the list where it was;
 * - an adult's own skill offers their own workbook, exactly when their own
 *   workbooks would make one;
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
 *     [--widths 320,390,768,1024,1280] [--out artifacts/skill-index] [--shots]
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
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
const WIDTHS = (argument("widths") ?? "320,390,768,1024,1280")
  .split(",")
  .map(Number);
const SHOTS = process.argv.includes("--shots");
const CHILD = argument("child") ?? "Wren";
await mkdir(OUT, { recursive: true });
const stack = argument("origin")
  ? null
  : await startPersonaStack({
      webPort: Number(argument("port") ?? 4962),
      personas: ["family", "adult-3wk"],
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
  /** The device's calendar date, as the app names today's workbook. */
  const today = () => {
    const now = new Date();
    const two = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
  };
  /** Text out of the printed document's markup. */
  const plain = (markup: string) =>
    markup
      .replaceAll("&amp;", "&")
      .replaceAll("&#x27;", "'")
      .replaceAll("&#39;", "'")
      .replaceAll("&quot;", '"');
  type Made = {
    id: string;
    code: string;
    problems: number;
    skills?: { id: string; title: string }[];
  };
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
  /** The child's workbooks of today that are held to this one skill. */
  const heldToday = async (skill: string) =>
    (
      (await api(`/learners/${child.id}/workbooks?date=${today()}`))
        .workbooks as Made[]
    ).filter(
      (entry) => entry.skills?.length === 1 && entry.skills[0]!.id === skill,
    );
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
    // (By its address: an account with a second place opens elsewhere.)
    await page.goto(`${origin}/family/${family}`);
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

    /** Opens a skill from its row (by grade or by area). Its layer states
     * where the child stands in the row's own word (the key's four), and no
     * other status. */
    const openSkill = async (id: string, list = "[data-grade-index]") => {
      const item = page.locator(`${list} li[data-skill="${id}"]`);
      const said = {
        standing: await item.getAttribute("data-standing"),
        word: (await item.locator("[data-standing-word]").innerText()).trim(),
      };
      // (Its name is its first link; a by-grade row's problem types follow.)
      await item.locator("a").first().click();
      const panel = page.locator("[data-layer-panel]");
      await panel.locator(`[data-skill-layer="${id}"]`).waitFor();
      const status = panel.locator("[data-skill-standing]");
      await status.waitFor();
      assert.deepEqual(
        {
          standing: await status.getAttribute("data-skill-standing"),
          word: (
            await status.locator("[data-standing-word]").innerText()
          ).trim(),
        },
        said,
        at(`${id}: the layer's standing is its row's`),
      );
      assert.equal(
        await panel
          .getByText(/^(Building|Not practiced yet|Getting started|Not tried)$/)
          .count(),
        0,
        at(`${id}: the layer has no second word for it`),
      );
    };
    const closeLayer = async () => {
      await page.keyboard.press("Escape");
      await page.locator("[data-layer-frame]").waitFor({ state: "detached" });
    };
    // ---- by area is the collection; by grade comes back -------------------
    // (Where it is on the page, not on the screen: a shorter list may leave
    // the page scrolled less.)
    const switchBox = () =>
      page.getByRole("radiogroup", { name: "View" }).evaluate((group) => {
        const box = group.getBoundingClientRect();
        return [box.x, box.y + scrollY, box.width, box.height].map(Math.round);
      });
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
    // By area, a parent reads the same four words, and a row's layer says
    // the row's: one row of each standing the whole collection has.
    await page
      .getByRole("group", { name: "Skills to show" })
      .getByRole("button", { name: /^All/ })
      .click();
    const collection = "main:not([data-inventory-mode=grade])";
    await page.locator(`${collection} li[data-skill]`).first().waitFor();
    assert.deepEqual(
      await page
        .locator(`${collection} li[data-skill]`)
        .evaluateAll((items) => [
          ...new Set(
            items.map(
              (item) =>
                item.querySelector("[data-standing-word]")?.textContent ?? "",
            ),
          ),
        ])
        .then((words) =>
          words.filter((word) => !Object.values(WORDS).includes(word as never)),
        ),
      [],
      at("by area speaks only the key's four words"),
    );
    for (const standing of Object.keys(WORDS)) {
      const row = page
        .locator(`${collection} li[data-skill][data-standing="${standing}"]`)
        .first();
      if (!(await row.count())) continue;
      const id = (await row.getAttribute("data-skill"))!;
      assert.equal(
        await row.getAttribute("data-standing"),
        standingOf(evidence.get(id)),
        at(`by area, ${id}: the record's standing`),
      );
      await openSkill(id, collection);
      await closeLayer();
    }
    await page
      .getByRole("group", { name: "Skills to show" })
      .getByRole("button", { name: /^Tried/ })
      .click();
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

    // ---- a row and its layer say one thing -------------------------------
    // One row of each standing the grade has.
    for (const standing of ["strong", "earned", "tried", "notAsked"]) {
      const one = shown.find((entry) => entry.standing === standing);
      if (!one) continue;
      await openSkill(one.id);
      await closeLayer();
    }

    // ---- a skill opens its layer; Practice there is this child's -----------
    const pick =
      expected.find(
        (entry) => standingOf(evidence.get(entry.skill.id)) === "notAsked",
      ) ?? expected[0]!;
    await openSkill(pick.skill.id);
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
    // ---- a layer over a layer closes to the layer behind it ----------------
    // The frame's layers, oldest first ("" with none open).
    const layersOpen = async () =>
      (await page.locator("[data-layer-frame]").count())
        ? ((await page
            .locator("[data-layer-frame]")
            .getAttribute("data-layers")) ?? "")
        : "";
    const settled = async (layers: string, what: string) => {
      await page
        .locator(`[data-layer-frame][data-layers="${layers}"]`)
        .waitFor()
        .catch(async () =>
          assert.fail(
            at(
              `${what}: the layers are "${await layersOpen()}", not "${layers}"`,
            ),
          ),
        );
      // (A panel has slid in or out.)
      await page.waitForTimeout(500);
    };
    const alone = `skill:${pick.skill.id}`;
    {
      // One of the skill's problem types: its Lesson, over the skill.
      const lesson = page
        .locator('[data-layer-panel] a[data-entity="lesson"]')
        .first();
      await lesson.waitFor();
      const type = new URLSearchParams(
        (await lesson.getAttribute("href"))!.split("?")[1],
      )
        .get("open")!
        .split(",")
        .at(-1)!;
      const both = `${alone},${type}`;
      const cross = page.locator("[data-layer-panel] [data-layer-close]");
      // ✕: the lesson down, the skill behind it again, the list behind that.
      await lesson.click();
      await settled(both, "a skill's lesson opens over the skill");
      await fits("a lesson over a skill");
      await cross.click();
      await settled(alone, "✕ on the lesson comes back to the skill");
      await layer.waitFor();
      // Escape: the same one step.
      await lesson.click();
      await settled(both, "the lesson again");
      await page.keyboard.press("Escape");
      await settled(alone, "Escape on the lesson comes back to the skill");
      // The browser's Back is between screens, never through layers: it
      // leaves this screen for the one before, and coming back shows both
      // layers as they were (docs/design/ia.md, "Navigation").
      await lesson.click();
      await settled(both, "the lesson once more");
      await page.goBack();
      await page.waitForURL((url) => url.pathname !== inventory);
      await page.goForward();
      await page.waitForURL((url) => url.pathname === inventory);
      await settled(both, "Back and Forward keep the layers as they were");
      // The scrim is the page: a press there puts the whole overlay away.
      // (Where the sheet leaves some of it to press: a phone's covers it.)
      const scrim = page.locator("[data-layer-scrim]");
      const sheet = (await page.locator("[data-layer-frame]").boundingBox())!;
      if (sheet.x >= 48) {
        await scrim.click({ position: { x: 12, y: 12 } });
        await page.locator("[data-layer-frame]").waitFor({ state: "detached" });
        assert.equal(new URL(page.url()).pathname, inventory);
        await openSkill(pick.skill.id);
      } else {
        await cross.click();
        await settled(alone, "✕ on the lesson, after Back and Forward");
      }
      await layer.waitFor();
      await practice.waitFor();
    }

    // ---- Workbook, beside Practice: held to this skill, for this child ----
    const workbook = page.locator(
      `[data-layer-panel] a[data-skill-workbook="${pick.skill.id}"]`,
    );
    await workbook.waitFor({ timeout: 15_000 });
    assert.equal(
      await workbook.getAttribute("data-workbook-for"),
      child.id,
      at("the workbook is this child's"),
    );
    assert.equal((await workbook.innerText()).trim(), "Workbook");
    // (The layer has slid in.)
    await page.waitForTimeout(700);
    {
      const [beside, started] = [
        (await workbook.boundingBox())!,
        (await practice.boundingBox())!,
      ];
      assert.ok(
        beside.height >= 43.5 && beside.width >= 43.5,
        at(`Workbook is a 44 px target: ${beside.width}×${beside.height}`),
      );
      assert.ok(
        Math.abs(beside.y - started.y) < 2 && beside.x > started.x,
        at("Workbook sits beside Practice"),
      );
      assert.deepEqual(
        (await probe(page)).smallTargets,
        [],
        at("the skill: targets under 44 px"),
      );
    }
    if (SHOTS)
      await page.screenshot({ path: `${OUT}/skill-${width}-light.png` });
    // Where the list is, to come back to.
    const place = () =>
      page.evaluate(
        (id) => [
          Math.round(scrollY),
          Math.round(
            document
              .querySelector(`li[data-skill="${id}"]`)!
              .getBoundingClientRect().y,
          ),
        ],
        pick.skill.id,
      );
    const left = await place();
    await workbook.click();
    // The maker is a layer over the skill: the screen behind stays the list
    // the skill was opened on, at its own address, where it was.
    const making = `${alone},workbook:${child.id}.${today()}`;
    await settled(making, "the maker opens over the skill");
    const behind = async (what: string) => {
      assert.equal(
        new URL(page.url()).pathname,
        inventory,
        at(`${what}: the address is the list's`),
      );
      assert.equal(
        await page.locator(`main [data-grade-index="${own}"]`).count(),
        1,
        at(`${what}: the list is the screen behind`),
      );
      assert.equal(
        await page.locator("main [data-child-workbooks]").count(),
        0,
        at(`${what}: the child's page is not`),
      );
      assert.deepEqual(
        await place(),
        left,
        at(`${what}: the list is in place`),
      );
    };
    await behind("the maker open");
    if (SHOTS)
      await page.screenshot({ path: `${OUT}/maker-over-list-${width}.png` });
    // ✕ puts the maker down, to the skill it was opened from; Escape too.
    await page.locator("[data-layer-panel] [data-layer-close]").click();
    await settled(alone, "✕ on the maker comes back to the skill");
    await behind("the maker closed");
    // (Opened again, it is held to the skill again.)
    await workbook.click();
    await settled(making, "the maker again");
    // The maker, with the workbook already composed from this skill alone.
    const paper = page.locator("[data-workbook-contents]");
    await paper.getByRole("heading", { name: /^Workbook No\./ }).waitFor();
    assert.ok(
      (await paper.innerText()).includes(pick.skill.title),
      at("the maker's workbook names the skill"),
    );
    assert.ok(
      (await page.locator("[data-held-skills]").innerText()).includes(
        pick.skill.title,
      ),
      at("the maker's options name the skill"),
    );
    // Held, level and areas say nothing: they are not offered.
    assert.equal(
      await page
        .locator(
          '[role=radiogroup][aria-label="Level"], [role=group][aria-label="Areas"]',
        )
        .count(),
      0,
      at("no Level or Areas for a held workbook"),
    );
    assert.equal(
      await page.locator('[role=radiogroup][aria-label="Length"]').count(),
      1,
      at("the maker keeps its Length"),
    );
    await fits("the maker");
    assert.deepEqual(
      (await probe(page)).smallTargets,
      [],
      at("the maker: targets under 44 px"),
    );
    if (SHOTS)
      await page.screenshot({ path: `${OUT}/maker-${width}-light.png` });
    // Download saves it, as any workbook.
    const heldBefore = await heldToday(pick.skill.id);
    const downloading = page.waitForEvent("download", { timeout: 60_000 });
    await page.getByRole("button", { name: "Download workbook" }).click();
    const file = await downloading;
    const kind = file.suggestedFilename().endsWith(".pdf") ? "pdf" : "html";
    const saved = `${OUT}/skill-workbook-${width}.${kind}`;
    await file.saveAs(saved);
    const heldAfter = await heldToday(pick.skill.id);
    assert.equal(
      heldAfter.length,
      heldBefore.length + 1,
      at("one workbook was made"),
    );
    const made = heldAfter.find(
      (entry) => !heldBefore.some((old) => old.id === entry.id),
    )!;
    assert.deepEqual(
      made.skills,
      [{ id: pick.skill.id, title: pick.skill.title }],
      at("the workbook is held to the skill"),
    );
    // Its problems, read from the workbook itself: every one this skill's.
    const problems = (
      await api(`/learners/${child.id}/workbooks/${made.id}/results`)
    ).rows as { skillId: string }[];
    assert.equal(problems.length, made.problems);
    assert.ok(problems.length >= 3, at(`${problems.length} problems`));
    assert.deepEqual(
      [...new Set(problems.map((row) => row.skillId))],
      [pick.skill.id],
      at("every problem is the skill's"),
    );
    // Its first page names the skill: the printed document's masthead, and
    // the saved file's own first page where it is a PDF this machine reads.
    const firstPage = await (
      await fetch(
        `${origin}/api/v1/learners/${child.id}/workbooks/${made.id}/document`,
        { headers: { Authorization: `Bearer ${token}`, Origin: origin } },
      )
    ).text();
    assert.equal(
      plain(
        /<p class="wb-mast-skills"[^>]*>([^<]*)<\/p>/.exec(firstPage)?.[1] ??
          "",
      ),
      pick.skill.title,
      at("the first page names the skill"),
    );
    if (kind === "pdf") {
      assert.equal(
        (await readFile(saved)).subarray(0, 5).toString(),
        "%PDF-",
        at("the download is a PDF"),
      );
      const text = spawnSync("pdftotext", ["-l", "1", saved, "-"], {
        encoding: "utf8",
      });
      if (text.status === 0)
        assert.ok(
          text.stdout.replace(/\s+/g, " ").includes(pick.skill.title),
          at("the PDF's first page names the skill"),
        );
      else console.log(`  (${width}: no pdftotext here; the PDF was not read)`);
    }
    // The maker now shows the saved workbook, by its code.
    await paper.getByText(made.code, { exact: true }).waitFor();
    // Closing comes back to the skill, the list where it was.
    await page.keyboard.press("Escape");
    await settled(alone, "Escape on the maker comes back to the skill");
    await layer.waitFor();
    await workbook.waitFor();
    await behind("after the workbook is saved");
    // It is listed with the child's workbooks.
    await page.goto(`${origin}/family/${family}/kids/${child.id}`);
    const inList = page
      .locator("[data-child-workbooks] li")
      .filter({ hasText: made.code });
    await inList.waitFor({ timeout: 30_000 });
    assert.ok(
      (await inList.innerText()).includes(pick.skill.title),
      at("the list names the skill"),
    );
    await fits("the child's workbooks");
    await page.goBack();
    await page.waitForURL((url) => url.pathname === inventory);
    await layer.waitFor({ timeout: 30_000 });
    await practice.waitFor();
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

  // ---- an adult's own skill: their own workbook, when theirs would make one --
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    await stubAnalytics(context);
    const entered = await context.request.post(
      `${origin}/api/auth/sign-in/email`,
      {
        headers: { Origin: origin },
        data: {
          email: personaEmail("adult-3wk"),
          password: PERSONA_PASSPHRASE,
        },
      },
    );
    assert.ok(entered.ok(), `the adult signs in: ${entered.status()}`);
    const adult = (
      await (await context.request.get(`${origin}/api/auth/get-session`)).json()
    ).session.token as string;
    const me = await (
      await fetch(`${origin}/api/v1/me`, {
        headers: { Authorization: `Bearer ${adult}`, Origin: origin },
      })
    ).json();
    const self = me.adultPractice.learner.id as string;
    const mine = (
      me.family.learners as {
        id: string;
        learningAllowed?: boolean;
        canPractice?: boolean;
        hasAccess?: boolean;
        freeAllowance?: { workbooks: { available: number } };
      }[]
    ).find((entry) => entry.id === self)!;
    // The maker's own rule (features/workbooks/model.ts `canMakeWorkbook`).
    const makes =
      (mine.learningAllowed ?? !!mine.canPractice) &&
      ((mine.hasAccess ?? (!mine.freeAllowance && !!mine.canPractice)) ||
        (mine.freeAllowance?.workbooks.available ?? 0) > 0);
    // Their look set to Colorful, to see what these screens wear. A look is
    // a learner's practice's (and a student's own screens'): an adult's
    // Inventory, a skill's layer and the workbook maker stay Calm.
    const look = async (to: "bold" | null) => {
      const headers = {
        Authorization: `Bearer ${adult}`,
        Origin: origin,
        "Content-Type": "application/json",
      };
      const at = `${origin}/api/v1/learners/${self}/practice-state`;
      const now = await (await fetch(at, { headers })).json();
      const set = await fetch(at, {
        method: "POST",
        headers,
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          revision: now.revision,
          kind: "look",
          look: to,
        }),
      });
      assert.ok(set.ok, `the adult's look is set to ${to}: ${set.status}`);
      return (await set.json()).effectiveLook as string;
    };
    const worn = await look("bold");
    const calm = async (where: string) =>
      assert.equal(
        await page.evaluate(() =>
          document.documentElement.getAttribute("data-look"),
        ),
        null,
        `${where} wears no look (the adult's is ${worn})`,
      );
    const page = await context.newPage();
    await page.goto(`${origin}/inventory`);
    const row = page.locator("li[data-strength] a").first();
    await row.waitFor({ timeout: 30_000 });
    await row.click();
    const panel = page.locator("[data-layer-panel] [data-skill-layer]");
    await panel.waitFor();
    const skill = (await panel.getAttribute("data-skill-layer"))!;
    const theirs = page.locator("[data-layer-panel] a[data-skill-workbook]");
    await page.locator("[data-layer-panel] [data-skill-actions]").waitFor();
    await page.waitForTimeout(700);
    assert.equal(
      await theirs.count(),
      makes ? 1 : 0,
      `an adult's own Workbook is offered exactly when theirs would make one (${makes})`,
    );
    if (makes) {
      assert.equal(await theirs.getAttribute("data-workbook-for"), "self");
      await theirs.click();
      // Over their own skill, on their own Inventory.
      await page
        .locator(
          `[data-layer-frame][data-layers="skill:${skill},workbook:${self}.${today()}"]`,
        )
        .waitFor();
      assert.equal(new URL(page.url()).pathname, "/inventory");
      const title = catalog.skills.find((entry) => entry.id === skill)!.title;
      const paper = page.locator("[data-workbook-contents]");
      await paper.getByRole("heading", { name: /^Workbook No\./ }).waitFor();
      assert.ok(
        (await paper.innerText()).includes(title),
        "the adult's own maker names the skill",
      );
      await calm("the adult's own maker");
      if (SHOTS)
        await page.screenshot({ path: `${OUT}/maker-own-1280-light.png` });
      await page.keyboard.press("Escape");
      await page
        .locator(`[data-layer-frame][data-layers="skill:${skill}"]`)
        .waitFor();
      await panel.waitFor();
    }
    await calm("the adult's own skill layer");
    if (SHOTS)
      await page.screenshot({ path: `${OUT}/skill-own-1280-light.png` });
    // As it was.
    await look(null);
    await context.close();
    console.log(`  ok an adult's own (${makes ? "offered" : "not offered"})`);
  }

  // ---- dark, for the eye: the grade, a skill with its Workbook, the maker --
  if (SHOTS)
    for (const width of [390, 1280]) {
      const context = await browser.newContext({
        storageState: state,
        viewport: { width, height: width < 600 ? 844 : 900 },
        colorScheme: "dark",
      });
      await stubAnalytics(context);
      const page = await context.newPage();
      await page.goto(`${origin}/family/${family}`);
      await page.locator(`a[data-skills-by-grade="${child.id}"]`).click();
      const first = expected[0]!.skill.id;
      await page.locator(`li[data-skill="${first}"]`).waitFor();
      await page.screenshot({
        path: `${OUT}/grade-${width}-dark.png`,
        fullPage: true,
      });
      await page.locator(`li[data-skill="${first}"] a`).first().click();
      const made = page.locator(
        `[data-layer-panel] a[data-skill-workbook="${first}"]`,
      );
      await made.waitFor();
      await page.waitForTimeout(700);
      const found = await probe(page);
      assert.deepEqual(
        [...found.smallTargets, ...found.overlaps, ...found.midWordWraps],
        [],
        `the skill, dark (${width})`,
      );
      await page.screenshot({ path: `${OUT}/skill-${width}-dark.png` });
      await made.click();
      await page
        .locator("[data-workbook-contents]")
        .getByRole("heading", { name: /^Workbook No\./ })
        .waitFor();
      await page.waitForTimeout(700);
      const maker = await probe(page);
      assert.deepEqual(
        [...maker.smallTargets, ...maker.overlaps, ...maker.midWordWraps],
        [],
        `the maker, dark (${width})`,
      );
      assert.equal(maker.overflow, 0, `the maker, dark (${width}): overflow`);
      await page.screenshot({ path: `${OUT}/maker-${width}-dark.png` });
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
