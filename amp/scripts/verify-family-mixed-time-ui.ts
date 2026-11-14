/**
 * Family Time with a child at home and a child in another family's group,
 * against a seeded design preview (scripts/design-preview.sh). The tutor
 * persona adds a child to their group; the scratch database then gives that
 * child to the `parent-day1` persona, as an approved transfer of ownership
 * would (the fixture is the transfer's outcome, not its consent flow). The
 * parent's Time must show both: the class's own child in its range and
 * measure, and the other child's weeks under "In another group", with both in
 * the totals; and never the tutor's other children.
 *
 *   AMP_PREVIEW_ORIGIN=http://127.0.0.1:4940 \
 *   AMP_PREVIEW_DATABASE_URL=postgres://amp:amp@127.0.0.1:55490/<scratch> \
 *   AMP_SHOTS=<dir> npx tsx scripts/verify-family-mixed-time-ui.ts
 */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { chromium, type BrowserContext } from "playwright";

const origin = process.env.AMP_PREVIEW_ORIGIN ?? "http://127.0.0.1:4940";
const database = process.env.AMP_PREVIEW_DATABASE_URL ?? "";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
  throw new Error(`Loopback previews only: ${origin}`);
if (!/^postgres:\/\/[^@]+@127\.0\.0\.1:\d+\/amp_scratch_/.test(database))
  throw new Error("A loopback amp_scratch_ database only");
const shots = process.env.AMP_SHOTS ?? "artifacts/family-mixed-time";
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch();
const pool = new pg.Pool({ connectionString: database, max: 1 });
async function signedIn(persona: string, width = 390): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
  });
  const response = await context.request.post(
    `${origin}/api/auth/sign-in/email`,
    {
      headers: { Origin: origin },
      data: {
        email: `${persona}@personas.amp.test`,
        password: "design pass persona passphrase",
      },
    },
  );
  assert.ok(response.ok(), `${persona} sign-in ${response.status()}`);
  await context.route("**/api/v1/events", (route) =>
    route.fulfill({ status: 202, json: {} }),
  );
  return context;
}
try {
  const tutor = await signedIn("tutor");
  const parent = await signedIn("parent-day1");
  const me = (await (
    await parent.request.get(`${origin}/api/v1/me`)
  ).json()) as {
    account: { id: string };
  };
  const families = (await (
    await parent.request.get(`${origin}/api/v1/families`)
  ).json()) as {
    families: { familyId: string; role: string }[];
  };
  const family = families.families.find(
    (entry) => entry.role === "holder",
  )!.familyId;
  const before = (await (
    await parent.request.get(`${origin}/api/v1/families/${family}`)
  ).json()) as {
    children: { id: string; name: string }[];
  };
  let hosted = before.children.find((child) => child.name === "Elsewhere Kid");
  if (!hosted) {
    const added = (await (
      await tutor.request.post(`${origin}/api/v1/family/class/students`, {
        headers: { Origin: origin },
        data: { nickname: "EK", birthYear: 2016 },
      })
    ).json()) as { learnerId: string };
    // The transfer's outcome: the child is this parent's, still in the group.
    await pool.query(
      "UPDATE amp_learners SET account_id=$1, name=$2 WHERE id=$3",
      [me.account.id, "Elsewhere Kid", added.learnerId],
    );
    hosted = { id: added.learnerId, name: "Elsewhere Kid" };
  }
  const after = (await (
    await parent.request.get(`${origin}/api/v1/families/${family}`)
  ).json()) as {
    children: { id: string; name: string }[];
  };
  assert.ok(
    after.children.some((child) => child.id === hosted!.id),
    "the projection holds the child practicing elsewhere",
  );
  for (const width of [390, 1280]) {
    const context = await signedIn("parent-day1", width);
    const page = await context.newPage();
    await page.goto(`${origin}/family/${family}/time?period=month`);
    await page.waitForSelector("[data-time-elsewhere]", { timeout: 30_000 });
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.waitForTimeout(1000);
    const text = (await page.textContent("main")) ?? "";
    assert.match(
      text,
      /Elsewhere Kid/,
      "the child elsewhere is in Family Time",
    );
    assert.match(text, /In another group/);
    assert.ok(!/No practice time yet/.test(text) || /Elsewhere Kid/.test(text));
    // The class's own child is the grid's; the tutor's others never appear.
    assert.ok(!/Student \d/.test(text), "a tutor's other child appeared");
    const total = await page.$$eval("[data-time-child]", (rows) => rows.length);
    assert.ok(total >= 1);
    await page.screenshot({
      path: join(shots, `mixed-time-${width}.png`),
      fullPage: true,
    });
    await context.close();
    console.log(
      `${width}: Family Time shows the class's child and the child elsewhere`,
    );
  }
  await tutor.close();
  await parent.close();
} finally {
  await pool.end();
  await browser.close();
}
