/**
 * The student's side of two requests to the teacher (#2464), in a real browser
 * against a running preview with a simulated class (scripts/live-class-sim.ts
 * has made "Live sim 1" once):
 *   - student A forgets the pictures: the request shows in the teacher's live
 *     snapshot; the teacher resets through the real route; A's screen moves on
 *     to choosing new pictures by itself;
 *   - student B raises a hand in practice: it shows in the snapshot; the
 *     teacher acknowledges; B's button clears and "Your teacher saw it." shows.
 * Nothing on either screen may move through any step (at 390 and 1280, light
 * and dark), and the practice bar at 320 holds. Screenshots go to
 * $VERIFY_SHOTS.
 *
 *     VERIFY_DATABASE_URL=postgres://amp:amp@127.0.0.1:55490/amp_scratch_l4b \
 *     VERIFY_API=http://127.0.0.1:4871 VERIFY_WEB=http://127.0.0.1:4870 \
 *     npx tsx scripts/verify-student-signals-ui.ts
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import pg from "pg";
import { chromium as rawChromium, type Page } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { schoolPictures } from "../src/schools/contracts";
import { PERSONA_PASSPHRASE } from "../src/web/features/dev/persona-list";

const databaseUrl = process.env.VERIFY_DATABASE_URL;
const api = (process.env.VERIFY_API ?? "http://127.0.0.1:4871").replace(
  /\/$/,
  "",
);
const web = (process.env.VERIFY_WEB ?? "http://127.0.0.1:4870").replace(
  /\/$/,
  "",
);
const shots =
  process.env.VERIFY_SHOTS ??
  "/Users/skyl/corpora-media/AMP-media/2026-11-20-round/l4b";
if (!databaseUrl) throw new Error("VERIFY_DATABASE_URL is required");
for (const url of [databaseUrl, api, web])
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname))
    throw new Error(`Loopback only: ${url}`);
await mkdir(shots, { recursive: true });
const pool = new pg.Pool({ connectionString: databaseUrl });

// ---- the teacher, by the real routes --------------------------------------
const signIn = await fetch(`${web}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { Origin: web, "content-type": "application/json" },
  body: JSON.stringify({
    email: "teacher-class@personas.amp.test",
    password: PERSONA_PASSPHRASE,
  }),
});
assert.ok(signIn.ok, `teacher sign-in ${signIn.status}`);
const cookie = signIn.headers
  .getSetCookie()
  .map((line) => line.split(";")[0])
  .join("; ");
const session = (await (
  await fetch(`${web}/api/auth/get-session`, { headers: { cookie } })
).json()) as { session: { token: string } };
async function teacher<T>(method: string, path: string, body?: unknown) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      Origin: web,
      cookie,
      authorization: `Bearer ${session.session.token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  assert.ok(response.ok, `${method} ${path} ${response.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}
type Snapshot = {
  session: { id: string } | null;
  signals: { id: string; personId: string; kind: string }[];
};

const room = (
  await pool.query(
    `SELECT c.id, c.join_code FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
     WHERE o.name='Live Class Simulator' ORDER BY c.created_at LIMIT 1`,
  )
).rows[0] as { id: string; join_code: string } | undefined;
assert.ok(room, "run scripts/live-class-sim.ts once first");
const code = room.join_code;
const live = () =>
  teacher<Snapshot>("GET", `/api/v1/school/classes/${room.id}/live`);
async function lookup() {
  const response = await fetch(`${api}/api/v1/school/join/lookup`, {
    method: "POST",
    headers: { Origin: web, "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  return (await response.json()) as {
    students: { id: string; name: string }[];
  };
}
const students = (await lookup()).students;
assert.ok(students.length >= 2, "the class needs two students");
const [A, B] = students as [
  { id: string; name: string },
  { id: string; name: string },
];
const mine = schoolPictures.slice(0, 3);

/** The student has these three pictures set, as after any earlier day. */
async function setPictures(personId: string) {
  await teacher(
    "POST",
    `/api/v1/school/classes/${room!.id}/students/${personId}/reset-pictures`,
    {},
  );
  const response = await fetch(`${api}/api/v1/school/join/picture`, {
    method: "POST",
    headers: { Origin: web, "content-type": "application/json" },
    body: JSON.stringify({ code, personId, pictures: mine, set: true }),
  });
  assert.ok(response.ok, `setting pictures ${response.status}`);
}
if (!(await live()).session)
  await teacher("POST", `/api/v1/school/classes/${room.id}/sessions`, {});

// ---- helpers ---------------------------------------------------------------
type Box = { x: number; y: number; width: number; height: number };
async function boxes(page: Page, selectors: Record<string, string>) {
  return page.evaluate((entries) => {
    const out: Record<string, Box | null> = {};
    for (const [name, selector] of Object.entries(entries)) {
      const el = document.querySelector(selector);
      if (!el) {
        out[name] = null;
        continue;
      }
      const r = el.getBoundingClientRect();
      out[name] = { x: r.x, y: r.y, width: r.width, height: r.height };
    }
    return out;
  }, selectors);
}
function same(
  label: string,
  before: Record<string, Box | null>,
  after: Record<string, Box | null>,
) {
  for (const name of Object.keys(before)) {
    const a = before[name];
    const b = after[name];
    // A first time has no action: its row stays, and the rest proves it.
    if (name === "forgot" && a && !b) continue;
    assert.ok(a && b, `${label}: ${name} missing`);
    // A title is as wide as its words: only where it sits vertically counts.
    for (const key of (name === "title" || name === "forgot"
      ? ["y"]
      : ["x", "y", "width", "height"]) as ("x" | "y" | "width" | "height")[])
      assert.ok(
        Math.abs(a[key] - b[key]) <= 1,
        `${label}: ${name}.${key} moved ${a[key]} -> ${b[key]}`,
      );
  }
}
const pictureButtons = (page: Page) => page.locator("button[aria-pressed]");
async function pick(page: Page) {
  for (const index of [0, 1, 2]) await pictureButtons(page).nth(index).click();
}

const browser = await secureChromium(rawChromium).launch();
const issues: string[] = [];
let checks = 0;
try {
  for (const theme of ["light", "dark"] as const)
    for (const width of [390, 1280]) {
      const tag = `${width}-${theme}`;
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 800 },
        colorScheme: theme,
      });
      const page = await context.newPage();
      page.on("console", (message) => {
        if (message.type() === "error")
          issues.push(`${tag} console: ${message.text()}`);
      });

      // ---- A forgets the pictures ----------------------------------------
      await setPictures(A.id);
      await page.goto(`${web}/join/${code}/${A.id}`);
      await page
        .getByRole("button", { name: "I forgot the pictures" })
        .waitFor();
      const watch = {
        slots: "ol",
        firstPicture: "button[aria-pressed]",
        title: "h1",
        forgot: "[class*='_forgot_'] button",
      };
      const picking = await boxes(page, watch);
      await page.screenshot({ path: `${shots}/forgot-1-picking-${tag}.png` });
      await page.getByRole("button", { name: "I forgot the pictures" }).click();
      await page.getByText("Your teacher has been asked.").waitFor();
      await page.waitForTimeout(400);
      const asked = await boxes(page, watch);
      same(`${tag} picking -> asked`, picking, asked);
      await page.screenshot({ path: `${shots}/forgot-2-asked-${tag}.png` });
      checks++;
      // The teacher's snapshot has the request.
      const seen = (await live()).signals.find(
        (s) => s.personId === A.id && s.kind === "forgot_picture",
      );
      assert.ok(seen, `${tag}: the request is in the live snapshot`);
      // A refresh comes back to waiting.
      await page.reload();
      await page.getByText("Your teacher has been asked.").waitFor();
      checks++;
      // The teacher resets: the screen moves on by itself.
      await teacher(
        "POST",
        `/api/v1/school/classes/${room.id}/students/${A.id}/reset-pictures`,
        {},
      );
      const started = Date.now();
      await page
        .getByText("Pick 3 pictures you’ll remember")
        .waitFor({ timeout: 15_000 });
      const took = Date.now() - started;
      assert.ok(took < 12_000, `${tag}: moved on in ${took} ms`);
      await page.waitForTimeout(400);
      const reset = await boxes(page, watch);
      same(`${tag} asked -> reset`, asked, reset);
      await page.screenshot({ path: `${shots}/forgot-3-reset-${tag}.png` });
      checks++;
      // Back out: ask again, then remember.
      await setPictures(A.id);
      await page.reload();
      await page.getByRole("button", { name: "I forgot the pictures" }).click();
      await page
        .getByRole("button", { name: "I remember the pictures" })
        .click();
      await page.getByText("Pick your 3 pictures").waitFor();
      same(`${tag} back out`, picking, await boxes(page, watch));
      checks++;

      // ---- B raises a hand ------------------------------------------------
      await setPictures(B.id);
      await page.goto(`${web}/join/${code}/${B.id}`);
      await pictureButtons(page).first().waitFor();
      await pick(page);
      const hand = page.getByRole("button", { name: "Raise hand" });
      await hand.waitFor({ timeout: 30_000 });
      await page.waitForTimeout(800);
      const practiceWatch = {
        hand: "button[aria-label='Raise hand']",
        stage: ".problem-stage",
        dock: ".answer-dock",
        bar: "header, [class*='bar']",
      };
      const down = await boxes(page, practiceWatch);
      assert.ok(
        down.hand && down.hand.width >= 44 && down.hand.height >= 44,
        `${tag}: 44 px target`,
      );
      await page.screenshot({ path: `${shots}/hand-1-down-${tag}.png` });
      await hand.click();
      await page.waitForFunction(
        () =>
          document
            .querySelector("button[aria-label='Raise hand']")
            ?.getAttribute("aria-pressed") === "true",
      );
      await page.waitForTimeout(400);
      same(`${tag} hand down -> up`, down, await boxes(page, practiceWatch));
      await page.screenshot({ path: `${shots}/hand-2-up-${tag}.png` });
      await page.waitForTimeout(1500);
      const raised = (await live()).signals.find(
        (s) => s.personId === B.id && s.kind === "hand",
      );
      assert.ok(raised, `${tag}: the hand is in the live snapshot`);
      // The teacher acknowledges: no tap on the student's side.
      await teacher(
        "POST",
        `/api/v1/school/classes/${room.id}/signals/${raised.id}/resolve`,
        {},
      );
      await page
        .getByRole("status")
        .filter({ hasText: "Your teacher saw it." })
        .waitFor({ timeout: 12_000 });
      assert.equal(
        await page
          .locator("button[aria-label='Raise hand']")
          .getAttribute("aria-pressed"),
        "false",
        `${tag}: the pressed state cleared`,
      );
      same(`${tag} hand acknowledged`, down, await boxes(page, practiceWatch));
      await page.screenshot({ path: `${shots}/hand-3-seen-${tag}.png` });
      await page
        .getByRole("status")
        .waitFor({ state: "detached", timeout: 10_000 });
      same(`${tag} note gone`, down, await boxes(page, practiceWatch));
      checks++;
      // Raise, then lower.
      await hand.click();
      await page.waitForFunction(
        () =>
          document
            .querySelector("button[aria-label='Raise hand']")
            ?.getAttribute("aria-pressed") === "true",
      );
      await hand.click();
      await page.waitForFunction(
        () =>
          document
            .querySelector("button[aria-label='Raise hand']")
            ?.getAttribute("aria-pressed") === "false",
      );
      await page.waitForTimeout(1500);
      assert.ok(
        !(await live()).signals.some(
          (s) => s.personId === B.id && s.kind === "hand",
        ),
        `${tag}: lowered`,
      );
      checks++;
      await context.close();
    }

  // ---- the bar at 320 ------------------------------------------------------
  for (const theme of ["light", "dark"] as const) {
    const context = await browser.newContext({
      viewport: { width: 320, height: 640 },
      colorScheme: theme,
    });
    const page = await context.newPage();
    await setPictures(B.id);
    await page.goto(`${web}/join/${code}/${B.id}`);
    await pictureButtons(page).first().waitFor();
    await pick(page);
    const hand = page.getByRole("button", { name: "Raise hand" });
    await hand.waitFor({ timeout: 30_000 });
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    );
    assert.ok(overflow <= 0, `320: horizontal overflow ${overflow}`);
    await page.screenshot({
      path: `${shots}/bar-320-${theme}.png`,
      clip: { x: 0, y: 0, width: 320, height: 120 },
    });
    await context.close();
    checks++;
  }
} finally {
  await browser.close();
  await pool.end();
}
if (issues.length) console.log(`console errors:\n${issues.join("\n")}`);
console.log(`verify-student-signals-ui: ${checks} checks passed`);
