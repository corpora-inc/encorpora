/**
 * Family Time with a child at home and a child in another family's group,
 * against a seeded design preview (scripts/design-preview.sh). The tutor
 * persona adds a child to their group; the scratch database then gives that
 * child to the `parent-day1` persona, as an approved transfer of ownership
 * would (the fixture is the transfer's outcome, not its consent flow). The
 * parent's Time counts both in one report: the class's dates and measure,
 * the other child's days read for exactly those dates, the page's total the
 * class's plus theirs to the minute, and one export with a Group column; and
 * never the tutor's other children. A failed read says so in place and
 * leaves the totals the class's alone, saying that too.
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
  // Practice time for both children: today, in the family's class and in
  // the tutor's group. Fractions of a minute, so the sum is checked exactly.
  const own = after.children.find((child) => child.id !== hosted!.id);
  const fixture = async (learner: string, ms: number) =>
    pool.query(
      `INSERT INTO amp_active_days(learner_id,day,surface,skill_id,active_ms)
       VALUES($1,current_date,'practice','',$2)
       ON CONFLICT (learner_id,day,surface,skill_id) DO UPDATE SET active_ms=EXCLUDED.active_ms`,
      [learner, ms],
    );
  await fixture(hosted.id, 7 * 60_000 + 17_000);
  if (own) await fixture(own.id, 12 * 60_000 + 21_000);
  const classId = (
    (await (await parent.request.get(`${origin}/api/v1/me`)).json()) as {
      familyClass: { classId: string };
    }
  ).familyClass.classId;
  type Days = { days: { minutes: number }[] };
  const dayMinutes = (rows: Days[]) =>
    rows.reduce(
      (sum, row) => sum + row.days.reduce((days, day) => days + day.minutes, 0),
      0,
    );
  /** What the page must show: the class's time and the child's, read for the
   * class's own first day, summed, then rounded once. */
  const expected = async (period: string) => {
    const classTime = (await (
      await parent.request.get(
        `${origin}/api/v1/school/classes/${classId}/time?period=${period}`,
      )
    ).json()) as { range: { from: string }; students: Days[] };
    const from = classTime.range.from;
    const child = (await (
      await parent.request.get(
        `${origin}/api/v1/families/${family}/children/${hosted!.id}/time?period=${period}&from=${from}`,
      )
    ).json()) as Days & { range: { from: string }; group: string };
    assert.equal(
      child.range.from,
      from,
      "the child's time starts on the class's day",
    );
    const classMinutes = dayMinutes(classTime.students);
    const childMinutes = dayMinutes([child]);
    assert.ok(childMinutes > 0, "the fixture gave the child elsewhere time");
    return {
      both: Math.round(classMinutes + childMinutes),
      classOnly: Math.round(classMinutes),
      group: child.group,
    };
  };
  const totalShown = async (page: import("playwright").Page) =>
    (
      await page
        .locator("dl > div", {
          has: page.locator("dt", { hasText: /^active minutes$/ }),
        })
        .locator("dd")
        .first()
        .textContent()
    )?.trim() ?? "";
  const timeRoute = /\/families\/[^/]+\/children\/[^/]+\/time\?/;
  for (const width of [390, 1280]) {
    const context = await signedIn("parent-day1", width);
    const page = await context.newPage();
    for (const period of width === 1280 ? ["term", "week"] : ["term"]) {
      const want = await expected(period);
      await page.goto(`${origin}/family/${family}/time?period=${period}`);
      await page.waitForSelector(`a[data-student="${hosted.id}"]`, {
        timeout: 30_000,
      });
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const text = (await page.textContent("main")) ?? "";
      assert.ok(!/Student \d/.test(text), "a tutor's other child appeared");
      assert.equal(
        await page.locator("[data-time-scope], [data-time-elsewhere]").count(),
        0,
        "one report: no separate scope or second section",
      );
      const name =
        (await page.textContent(`a[data-student="${hosted.id}"]`)) ?? "";
      assert.match(name, /Elsewhere Kid/);
      assert.ok(name.includes(want.group), `the row names its group: ${name}`);
      assert.equal(
        await totalShown(page),
        want.both.toLocaleString("en-US"),
        `${period}: the total is the class's plus the child's`,
      );
      assert.notEqual(want.both, want.classOnly);
      console.log(
        `${width} ${period}: total ${want.both} = class ${want.classOnly} + Elsewhere Kid`,
      );
    }
    await page.goto(`${origin}/family/${family}/time?period=term`);
    await page.waitForSelector(`a[data-student="${hosted.id}"]`, {
      timeout: 30_000,
    });
    await page.screenshot({
      path: join(shots, `mixed-time-${width}.png`),
      fullPage: true,
    });
    // One export: the class's lines and the child's, each with its group.
    const want = await expected("term");
    const [file] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      page.getByRole("button", { name: "Export" }).click(),
    ]);
    const csv = await (await file.createReadStream()).toArray();
    const text = Buffer.concat(csv as Buffer[]).toString("utf8");
    const lines = text
      .replace(/^\uFEFF/, "")
      .trim()
      .split(/\r\n/);
    assert.equal(lines[0], "SIS ID,Student,Date,Active minutes,Problems,Group");
    const elsewhere = lines.filter((line) => line.includes("Elsewhere Kid"));
    assert.ok(elsewhere.length > 0, "the export holds the child elsewhere");
    assert.ok(
      elsewhere.every(
        (line) =>
          line.endsWith(`,${want.group}`) || line.endsWith(`,"${want.group}"`),
      ),
      `the child's lines name their group: ${elsewhere.join(" | ")}`,
    );
    assert.ok(
      lines.slice(1).every((line) => line.split(",").length >= 6),
      "every line has a group",
    );
    // A part of the export failing saves nothing and says so.
    await page.route(/\/children\/[^/]+\/time\.csv/, (route) =>
      route.fulfill({ status: 503, json: { error: "unavailable" } }),
    );
    let saved = false;
    page.on("download", () => (saved = true));
    await page.getByRole("button", { name: "Export" }).click();
    await page.getByText(/didn’t download/).waitFor({ timeout: 15_000 });
    await page.waitForTimeout(500);
    assert.ok(!saved, "a partial export was saved");
    await page.unroute(/\/children\/[^/]+\/time\.csv/);
    // The child elsewhere's read fails: "Couldn't load", Try again, and the
    // totals the class's alone, saying so; never a zero for them.
    await page.route(timeRoute, (route) =>
      route.fulfill({ status: 503, json: { error: "unavailable" } }),
    );
    await page.reload();
    await page.waitForSelector("[data-time-missing] button", {
      timeout: 30_000,
    });
    const missing = (await page.textContent("[data-time-missing]")) ?? "";
    assert.match(missing, /Couldn’t load Elsewhere Kid’s time/);
    assert.match(missing, /these totals leave it out/);
    assert.equal(
      await totalShown(page),
      want.classOnly.toLocaleString("en-US"),
      "a failed read leaves the class's total",
    );
    assert.equal(
      await page.locator(`a[data-student="${hosted.id}"]`).count(),
      0,
      "a failed read shows the child as a zero",
    );
    await page.screenshot({
      path: join(shots, `mixed-time-failed-${width}.png`),
      fullPage: true,
    });
    // Try again recovers.
    await page.unroute(timeRoute);
    await page.click("[data-time-missing] button");
    await page.waitForSelector(`a[data-student="${hosted.id}"]`, {
      timeout: 30_000,
    });
    assert.equal(await totalShown(page), want.both.toLocaleString("en-US"));
    assert.equal(await page.locator("[data-time-missing]").count(), 0);
    await context.close();
    console.log(
      `${width}: one report and one export; a failed read says so and recovers`,
    );
  }
  await tutor.close();
  await parent.close();
} finally {
  await pool.end();
  await browser.close();
}
