/** A child's picture lock is recovered from their parent's child settings.
 * All identities, credentials and attempts belong to a disposable fixture.
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { STUDENT_FAILURES } from "../src/schools/sign-in.js";
import { purchasePreview } from "./purchase-preview-fixture.js";

const fixture = await purchasePreview(
  Number(process.env.AMP_PICTURE_RESET_PREVIEW_PORT ?? 5052),
);
const browser = await secureChromium(rawChromium).launch();
const output =
  process.env.AMP_PICTURE_RESET_OUTPUT ?? "/tmp/amp-family-picture-reset";
await mkdir(output, { recursive: true });
try {
  const parent = await browser.newContext({
    viewport: { width: 1280, height: 950 },
  });
  const childDevice = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const persona = fixture.personas.find((entry) => entry.key === "invoice")!;
  assert.equal(
    (
      await parent.request.post(fixture.origin + "/api/auth/sign-in/email", {
        headers: { origin: fixture.origin },
        data: { email: persona.email, password: fixture.password },
      })
    ).status(),
    200,
  );
  const places = await (
    await parent.request.get(fixture.origin + "/api/v1/families")
  ).json();
  const family = places.families.find(
    (entry: { role: string }) => entry.role === "holder",
  ).familyId;
  const person = (
    await fixture.db.query<{ id: string; code: string }>(
      `SELECT p.id,c.join_code AS code FROM amp_people p
     JOIN amp_families f ON f.account_id=$1 JOIN amp_classes c ON c.id=f.class_id
     WHERE p.learner_id=$2`,
      [persona.accountId, persona.learnerId],
    )
  ).rows[0]!;
  // Establish the existing picture credential through the public sign-in API.
  // The recovery itself, including all wrong tries, uses the actual UI.
  assert.equal(
    (
      await childDevice.request.post(
        fixture.origin + "/api/v1/school/join/picture",
        {
          headers: { origin: fixture.origin },
          data: {
            code: person.code,
            personId: person.id,
            pictures: ["fox", "moon", "turtle"],
            set: true,
          },
        },
      )
    ).status(),
    200,
  );
  const child = await childDevice.newPage();
  child.setDefaultTimeout(15_000);
  const routes: string[] = [],
    batches: string[] = [];
  child.on("framenavigated", (frame) => {
    if (frame === child.mainFrame()) routes.push(new URL(frame.url()).pathname);
  });
  child.on("response", (response) => {
    const path = new URL(response.url()).pathname;
    if (response.ok() && /\/learners\/[^/]+\/batches$/.test(path))
      batches.push(path.split("/").at(-2)!);
  });
  await child.goto(fixture.origin + `/join/${person.code}/${person.id}`);
  await child
    .getByRole("heading", { name: "Pick your 3 pictures", exact: true })
    .waitFor();
  for (let attempt = 1; attempt <= STUDENT_FAILURES; attempt++) {
    const answer = child.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/school/join/picture"),
    );
    for (const name of ["Apple", "Owl", "Boat"])
      await child.getByRole("button", { name, exact: true }).click();
    assert.equal(
      (await answer).status(),
      attempt === STUDENT_FAILURES ? 423 : 422,
    );
    await child
      .getByRole("list", { name: "0 of 3 pictures picked", exact: true })
      .waitFor();
  }
  await child
    .getByRole("heading", {
      name: "Ask your parent or teacher to reset your sign-in pictures.",
      exact: true,
    })
    .waitFor();
  await child.screenshot({ path: `${output}/child-locked.png` });
  const lockedRoutes = [...routes];
  const account = await parent.newPage();
  account.setDefaultTimeout(15_000);
  await account.goto(
    fixture.origin + `/family/${family}/kids/${persona.learnerId}`,
  );
  // Picture recovery is in the child's folded Settings.
  await account.locator("summary", { hasText: "Settings" }).click();
  const recovery = account.locator("[data-picture-sign-in]");
  await recovery
    .getByRole("button", { name: "Reset pictures", exact: true })
    .waitFor();
  for (const width of [390, 1280])
    for (const theme of ["light", "dark"]) {
      await account.setViewportSize({ width, height: 950 });
      await account.evaluate(
        (value) => document.documentElement.setAttribute("data-theme", value),
        theme,
      );
      await recovery.scrollIntoViewIfNeeded();
      await account.waitForTimeout(120);
      const bounds = await recovery.boundingBox();
      assert.ok(
        bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1,
      );
      assert.equal(
        await account.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await account.screenshot({
        path: `${output}/settings-${width}-${theme}.png`,
      });
    }
  const reset = account.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith(
      `/students/${person.id}/reset-pictures`,
    ),
  );
  await recovery
    .getByRole("button", { name: "Reset pictures", exact: true })
    .click();
  assert.equal((await reset).status(), 200);
  await recovery
    .getByRole("status")
    .filter({ hasText: "Casey can choose three new pictures at sign-in." })
    .waitFor();
  await child.bringToFront();
  // No reload or navigation on the stopped device: its periodic roster read
  // notices the parent's reset and returns to choosing pictures.
  await child
    .getByRole("heading", {
      name: "Pick 3 pictures you’ll remember",
      exact: true,
    })
    .waitFor();
  assert.deepEqual(
    routes,
    lockedRoutes,
    "The locked screen recovers in place.",
  );
  await child.screenshot({ path: `${output}/child-recovered.png` });
  for (const name of ["Apple", "Owl", "Boat"])
    await child.getByRole("button", { name, exact: true }).click();
  const firstBatch = child.waitForResponse(
    (response) =>
      response.ok() &&
      new URL(response.url()).pathname.endsWith(
        `/learners/${persona.learnerId}/batches`,
      ),
  );
  await child
    .getByRole("button", { name: "These are mine", exact: true })
    .click();
  await firstBatch;
  await child.getByLabel("Problem workspace", { exact: true }).waitFor();
  assert.equal(new URL(child.url()).pathname, "/practice");
  assert.deepEqual([...new Set(batches)], [persona.learnerId]);
  const credentials = (
    await fixture.db.query<{ active: number; locked: number }>(
      `SELECT count(*) FILTER (WHERE revoked_at IS NULL)::int AS active,
      count(*) FILTER (WHERE revoked_at IS NULL AND locked_until>now())::int AS locked
     FROM amp_person_credentials WHERE person_id=$1 AND kind='picture'`,
      [person.id],
    )
  ).rows[0];
  assert.deepEqual(credentials, { active: 1, locked: 0 });
  await child.screenshot({ path: `${output}/child-practice.png` });
  await writeFile(
    `${output}/evidence.json`,
    JSON.stringify(
      {
        chosen: persona.learnerId,
        wrongTries: STUDENT_FAILURES,
        routes,
        batches,
        recoveredWithoutReload: true,
        credentials,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS family picture lock → parent reset → automatic recovery → same child's practice",
  );
} finally {
  await browser.close();
  await fixture.close();
}
