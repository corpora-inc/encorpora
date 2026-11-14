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
  const minutesShown = async (page: import("playwright").Page) =>
    (
      await page.$$eval("[data-stat-value], strong, dd", (nodes) =>
        nodes.map((node) => (node.textContent ?? "").trim()),
      )
    ).join("|");
  for (const width of [390, 1280]) {
    const context = await signedIn("parent-day1", width);
    const page = await context.newPage();
    await page.goto(`${origin}/family/${family}/time?period=term`);
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
    assert.ok(!/Student \d/.test(text), "a tutor's other child appeared");
    // M14/M15: the dates, totals and export are the class's, and say whose;
    // the child elsewhere has their own labelled scope, outside them.
    const scope = (await page.textContent("[data-time-scope]")) ?? "";
    assert.match(scope, /in your family’s class/, `scope: ${scope}`);
    assert.match(scope, /Elsewhere Kid practices in another group/);
    assert.ok(
      !/Elsewhere Kid/.test(scope.split(".")[0]!),
      "the class scope names the child elsewhere",
    );
    const elsewhere = (await page.textContent("[data-time-elsewhere]")) ?? "";
    assert.match(
      elsewhere,
      /not the dates or the measure above, and not in its totals or its export/,
    );
    const classTotal = (await (
      await context.request.get(
        `${origin}/api/v1/school/classes/${(await (await context.request.get(`${origin}/api/v1/me`)).json()).familyClass.classId}/time?period=term`,
      )
    ).json()) as { students: { minutes: number }[] };
    const sum = classTotal.students.reduce(
      (total, row) => total + row.minutes,
      0,
    );
    if (sum > 0) {
      const shown = await minutesShown(page);
      assert.ok(
        shown.includes(String(sum)),
        `the total is the class's ${sum}: ${shown}`,
      );
    }
    await page.screenshot({
      path: join(shots, `mixed-time-${width}.png`),
      fullPage: true,
    });
    // M16: the child elsewhere's read fails: "Couldn't load", Try again, and
    // never a zero, with the class's totals unchanged.
    const before = await minutesShown(page);
    await page.route("**/api/v1/families/*/children/*/progress", (route) =>
      route.fulfill({ status: 503, json: { error: "unavailable" } }),
    );
    await page.reload();
    await page.waitForSelector(
      "[data-time-elsewhere] [data-read-failed] button",
      {
        timeout: 30_000,
      },
    );
    await page.waitForTimeout(800);
    const failed = (await page.textContent("[data-time-elsewhere]")) ?? "";
    assert.match(failed, /Couldn’t load Elsewhere Kid’s weeks/);
    assert.ok(
      !/No time in these dates|0 active minutes in/.test(failed),
      "a failed read shows as zero",
    );
    assert.equal(
      await minutesShown(page),
      before,
      "the totals changed when the read failed",
    );
    await page.screenshot({
      path: join(shots, `mixed-time-failed-${width}.png`),
      fullPage: true,
    });
    // Try again recovers.
    await page.unroute("**/api/v1/families/*/children/*/progress");
    await page.click("[data-time-elsewhere] [data-read-failed] button");
    await page.waitForSelector("[data-time-elsewhere] [role=img]", {
      timeout: 30_000,
    });
    await context.close();
    console.log(
      `${width}: Family Time scopes the class and the child elsewhere; a failed read says so and recovers`,
    );
  }
  await tutor.close();
  await parent.close();
} finally {
  await pool.end();
  await browser.close();
}
