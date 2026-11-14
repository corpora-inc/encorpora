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
import { analyticsSelfTest, stubAnalytics } from "./analytics-stub";

const origin = process.env.AMP_PREVIEW_ORIGIN ?? "http://127.0.0.1:4940";
const database = process.env.AMP_PREVIEW_DATABASE_URL ?? "";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
  throw new Error(`Loopback previews only: ${origin}`);
if (!/^postgres:\/\/[^@]+@127\.0\.0\.1:\d+\/amp_scratch_/.test(database))
  throw new Error("A loopback amp_scratch_ database only");
const shots = process.env.AMP_SHOTS ?? "artifacts/family-mixed-time";
mkdirSync(shots, { recursive: true });

/** Words a family's own pages never use (verify-family-space-ui.ts). */
const NEVER = /\b(students?|roster|seats?|standings|co-teacher|gradebook)\b/i;
const assertFamilyWords = (text: string, where: string) =>
  assert.ok(!NEVER.test(text), `${where} says "${NEVER.exec(text)?.[0]}"`);
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
  // Product measurement is not under test and never leaves the page, even
  // as a page closes (scripts/analytics-stub.ts).
  await stubAnalytics(context);
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
  {
    const sent = await analyticsSelfTest(
      parent,
      origin,
      [`/family/${family}`, `/family/${family}/time`],
      pool,
    );
    console.log(
      `analytics: ${sent} sends stubbed in the page; none reached the server`,
    );
  }
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
      assertFamilyWords(text, `${width} ${period} Time`);
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
    // With no time of the class's own, a failed read still says so: never
    // "No practice time" over time that didn't load (M16).
    if (own) await fixture(own.id, 0);
    await page.route(timeRoute, (route) =>
      route.fulfill({ status: 503, json: { error: "unavailable" } }),
    );
    await page.goto(`${origin}/family/${family}/time?period=week`);
    await page.waitForSelector("[data-time-missing] button", {
      timeout: 30_000,
    });
    await page.waitForLoadState("networkidle").catch(() => undefined);
    const zero = (await page.textContent("main")) ?? "";
    assert.ok(
      !/No practice time/.test(zero),
      "a failed read under zero local time claims no practice",
    );
    assert.match(zero, /Couldn’t load Elsewhere Kid’s time/);
    assert.equal(await totalShown(page), "0");
    await page.screenshot({
      path: join(shots, `mixed-time-zero-failed-${width}.png`),
      fullPage: true,
    });
    await page.unroute(timeRoute);
    await page.click("[data-time-missing] button");
    await page.waitForSelector(`a[data-student="${hosted.id}"]`, {
      timeout: 30_000,
    });
    const recovered = await expected("week");
    assert.equal(
      await totalShown(page),
      recovered.both.toLocaleString("en-US"),
      "Try again brings the child's time back",
    );
    if (own) await fixture(own.id, 12 * 60_000 + 21_000);
    // The family's practice defaults say whom they govern: the child in
    // another group has that group's settings (M17).
    await page.goto(`${origin}/family/${family}/settings`);
    const scope =
      (await (
        await page.waitForSelector("[data-practice-scope]", {
          timeout: 30_000,
        })
      ).textContent()) ?? "";
    assert.match(
      scope,
      /Elsewhere Kid practices in another group, which sets theirs/,
    );
    assert.ok(
      !/every child in the family/.test(scope),
      `the defaults claim every child: ${scope}`,
    );
    await context.close();
    console.log(
      `${width}: one report and one export; a failed read says so and recovers`,
    );
  }
  // The weeks before the child joined their group are hatched, as the
  // class's own roster starts are (the child read's `joined`).
  {
    const context = await signedIn("parent-day1", 1280);
    const page = await context.newPage();
    await page.goto(`${origin}/family/${family}/time?period=term`);
    await page.waitForSelector(`a[data-student="${hosted.id}"]`, {
      timeout: 30_000,
    });
    await page.waitForLoadState("networkidle").catch(() => undefined);
    const cells = await page.evaluate((id) => {
      let node: Element | null = document.querySelector(
        `a[data-student="${id}"]`,
      );
      while (node && !node.querySelector("[data-empty], [data-current]"))
        node = node.parentElement;
      const strip = node?.querySelectorAll(
        "[data-current], [data-empty], [data-future]",
      );
      return {
        empty: node?.querySelectorAll("[data-empty]").length ?? 0,
        all: strip?.length ?? 0,
      };
    }, hosted.id);
    assert.ok(
      cells.empty > 0,
      `the weeks before the child joined are hatched: ${JSON.stringify(cells)}`,
    );
    console.log(`hatched ${cells.empty} weeks before Elsewhere Kid joined`);

    // A term longer than Time reads at once: its latest stretch, said so;
    // no read ever asks for more than 400 days; the export still works.
    const session = (
      await pool.query(
        "SELECT c.session_id AS id, s.starts_on::text AS starts FROM amp_classes c JOIN amp_academic_sessions s ON s.id=c.session_id WHERE c.id=$1",
        [classId],
      )
    ).rows[0] as { id: string; starts: string };
    await pool.query(
      "UPDATE amp_academic_sessions SET starts_on=current_date - 520 WHERE id=$1",
      [session.id],
    );
    try {
      const asked: string[] = [];
      const refused: string[] = [];
      page.on("request", (request) => {
        const from = new URL(request.url()).searchParams.get("from");
        if (from) asked.push(from);
      });
      page.on("response", (response) => {
        if (response.status() === 400) refused.push(response.url());
      });
      await page.goto(`${origin}/family/${family}/time?period=term`);
      const limit = await page.waitForSelector("[data-time-limit]", {
        timeout: 30_000,
      });
      const line = (await limit.textContent()) ?? "";
      const days = Number(/latest (\d+) days/.exec(line)?.[1]);
      assert.ok(days > 390 && days <= 400, `the limit line: ${line}`);
      await page.waitForSelector(`a[data-student="${hosted.id}"]`, {
        timeout: 30_000,
      });
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const today = new Date();
      const earliest = new Date(today.getTime() - 401 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      assert.ok(asked.length > 0, "the reads named their start");
      assert.ok(
        asked.every((from) => from >= earliest),
        `a read asked for more than 400 days: ${asked.join(", ")}`,
      );
      assert.ok(
        refused.every((url) => !/[?&]from=/.test(url)),
        `a bounded read was refused: ${refused.join(", ")}`,
      );
      assert.ok(
        !/didn’t load|Couldn’t load/.test(
          (await page.textContent("main")) ?? "",
        ),
        "the long term read as a failure",
      );
      assertFamilyWords(
        (await page.textContent("main")) ?? "",
        "long-term Time",
      );
      assert.match(
        (await page.textContent("main")) ?? "",
        /Before they joined/,
        "the hatching is named in the family's words",
      );
      await page.screenshot({
        path: join(shots, "mixed-time-long-term-1280.png"),
        fullPage: true,
      });
      const [file] = await Promise.all([
        page.waitForEvent("download", { timeout: 30_000 }),
        page.getByRole("button", { name: "Export" }).click(),
      ]);
      assert.ok(file.suggestedFilename().endsWith(".csv"));
      console.log(`a long term shows its latest ${days} days and exports`);
    } finally {
      await pool.query(
        "UPDATE amp_academic_sessions SET starts_on=$2 WHERE id=$1",
        [session.id, session.starts],
      );
    }
    await context.close();
  }
  await tutor.close();
  await parent.close();
} finally {
  await pool.end();
  await browser.close();
}
