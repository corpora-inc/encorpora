/**
 * Practicing as a student never leaves the school (Q-69, docs/design/ia.md
 * "Places and modes"), in a real browser, on the founder's path:
 *
 *   class map → a student's sheet → "Try problems as this student" → practice
 *   → its way back (the bar's button, or the drawer's) → Back, Back
 *
 * plus Back and Forward through the mode, a refresh inside it, and a bare
 * `/practice` (an old history entry) for an account with nothing of its own
 * to practice. After every step the viewer is in the school, or practicing
 * as the student with its way back in view; never family setup or another
 * place.
 *
 * People: the shared demo school's leader (school), a real school's own
 * teacher and admin (teacher-class), and the demo class's teacher (teacher),
 * from scripts/design-personas.ts. By default the check starts its own stack
 * (AMP_TEST_DATABASE_URL), or point it at a seeded preview:
 *
 *   npx tsx scripts/verify-place-mode-ui.ts --origin http://127.0.0.1:4930
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium, type Page } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import {
  PERSONA_PASSPHRASE,
  personaEmail,
} from "../src/web/features/dev/persona-list";
import { startPersonaStack } from "./persona-stack";

const chromium = secureChromium(rawChromium);
const argument = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const OUT = argument("out") ?? "artifacts/place-mode";
const PEOPLE = ["school", "teacher-class", "teacher"];
const stack = argument("origin")
  ? null
  : await startPersonaStack({
      webPort: Number(argument("port") ?? 4938),
      personas: PEOPLE,
      name: "place_mode_ui",
      out: OUT,
    });
const origin = argument("origin") ?? stack!.origin;

const here = (page: Page) => {
  const url = new URL(page.url());
  return url.pathname + url.search;
};
const ONBOARDING =
  /Let’s set up your family|Learning is paused|Get started|Continue setup|What brings you to AMP/;

let shot = 0;
async function snap(page: Page, name: string) {
  await page.screenshot({
    path: `${OUT}/${String(++shot).padStart(2, "0")}-${page.viewportSize()!.width}-${name}.png`,
  });
}

/** Settled, in the school (`prefix`) or practicing as the student with its
 * way back; never onboarding, never another place. */
async function inPlace(
  page: Page,
  prefix: string,
  what: string,
  expect: "school" | "practice" = "school",
) {
  await page.waitForLoadState("domcontentloaded");
  if (expect === "practice") await page.locator("[data-profile-back]").waitFor();
  else
    await page
      .waitForURL((url) => url.pathname.startsWith(prefix), { timeout: 15_000 })
      .catch(() => undefined);
  await page.waitForTimeout(400);
  const text = await page.locator("body").innerText();
  if (ONBOARDING.test(text) || !here(page).startsWith(expect === "practice" ? "/practice?" : prefix))
    await snap(page, `FAILED-${what.replace(/\W+/g, "-")}`);
  assert.doesNotMatch(text, ONBOARDING, `${what}: onboarding at ${here(page)}`);
  if (expect === "practice") {
    assert.match(here(page), /^\/practice\?/, `${what}: practicing`);
    const url = new URL(page.url());
    assert.ok(url.searchParams.get("profile"), `${what}: the mode is in the URL`);
    assert.ok(
      url.searchParams.get("from")?.startsWith(prefix),
      `${what}: it returns into ${prefix}`,
    );
  } else
    assert.ok(here(page).startsWith(prefix), `${what}: at ${here(page)}, not in ${prefix}`);
}

const browser = await chromium.launch();
try {
  await mkdir(OUT, { recursive: true });
  for (const person of PEOPLE) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const response = await context.request.post(
      `${origin}/api/auth/sign-in/email`,
      {
        headers: { Origin: origin },
        data: { email: personaEmail(person), password: PERSONA_PASSPHRASE },
      },
    );
    assert.ok(response.ok(), `${person} signs in: ${response.status()}`);
    const page = await context.newPage();
    page.on("pageerror", (error) => console.error("page error:", error));
    await page.goto(`${origin}/`);
    await page.waitForURL(/\/school\/[^/]+/);
    const prefix = new URL(page.url()).pathname.match(/^\/school\/[^/]+/)![0];
    await inPlace(page, prefix, `${person} lands`);
    // Their first class's map.
    let classPath = new URL(page.url()).pathname.match(
      /^\/school\/[^/]+\/classes\/[^/]+/,
    )?.[0];
    if (!classPath) {
      const href = await page
        .locator(`a[href^="${prefix}/classes/"]`)
        .first()
        .getAttribute("href");
      classPath = href!.match(/^\/school\/[^/]+\/classes\/[^/]+/)![0];
    }
    const map = `${classPath}/map`;

    /** The map, a student's sheet, then practice as them. */
    const begin = async (record = false) => {
      await page.goto(origin + map);
      await page.locator("[data-map-student]").first().waitFor();
      await inPlace(page, prefix, "the class map");
      await page.locator("[data-map-student]").first().click();
      await page.locator("[data-try-as-student]").waitFor();
      const sheet = here(page);
      if (record) await snap(page, `${person}-sheet`);
      await page.locator("[data-try-as-student]").click();
      await inPlace(page, prefix, "practicing as the student", "practice");
      if (record) await snap(page, `${person}-practice-as`);
      return sheet;
    };

    // 1. The founder's path: the way back, then Back, Back.
    let sheet = await begin(true);
    const label = await page.locator("[data-profile-back]").getAttribute("aria-label");
    assert.match(label ?? "", /^Back to /, "the way back names the place");
    assert.doesNotMatch(label ?? "", /home|own practice/i);
    await page.locator("[data-profile-back]").click();
    await inPlace(page, prefix, "the way back");
    assert.equal(here(page), sheet, "the way back returns to the student");
    await snap(page, `${person}-back-to-sheet`);
    await page.goBack();
    await inPlace(page, prefix, "Back after the way back");
    assert.equal(new URL(page.url()).pathname, map, "then the map");
    await page.goBack();
    await inPlace(page, prefix, "Back again");

    // 2. The drawer's way back does the same.
    sheet = await begin();
    await page.locator("[data-navigation-trigger]").click();
    await page.locator("[data-profile-leave]").click();
    await inPlace(page, prefix, "the drawer's way back");
    assert.equal(here(page), sheet);

    // 3. Back and Forward step through the mode, never out of the place.
    sheet = await begin();
    const practice = here(page);
    await page.goBack();
    await inPlace(page, prefix, "Back from practice");
    assert.equal(here(page), sheet);
    await page.goBack();
    await inPlace(page, prefix, "Back to the map");
    assert.equal(new URL(page.url()).pathname, map);
    await page.goForward();
    await inPlace(page, prefix, "Forward to the sheet");
    await page.goForward();
    await inPlace(page, prefix, "Forward into practice", "practice");
    assert.equal(here(page), practice);

    // 4. A refresh inside the mode keeps it and its way back.
    await page.reload();
    await inPlace(page, prefix, "refreshed practice", "practice");
    assert.equal(
      await page.locator("[data-profile-back]").getAttribute("aria-label"),
      label,
    );
    await page.locator("[data-profile-back]").click();
    await inPlace(page, prefix, "the way back after a refresh");
    assert.equal(here(page), sheet);

    // 5. A bare /practice (an old entry, a typed address) says nobody: the
    //    account's own practice if it has one, else its place.
    await page.goto(`${origin}/practice`);
    await page.waitForTimeout(1500);
    assert.doesNotMatch(await page.locator("body").innerText(), ONBOARDING);
    assert.equal(
      await page.locator("[data-profile-back]").count(),
      0,
      "the mode is not left on",
    );
    await context.close();
    console.log(`${person}: practicing as a student stays in ${prefix}`);
  }
  console.log(`place-mode: ok (${shot} screenshots in ${OUT})`);
} finally {
  await browser.close();
  await stack?.stop();
}
