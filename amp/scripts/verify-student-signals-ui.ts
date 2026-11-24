/**
 * The student's side of two requests to the teacher (#2464), in a real browser
 * with a simulated class (scripts/live-class-sim.ts makes "Live sim 1"):
 *   - student A forgets the pictures: the request shows in the teacher's live
 *     snapshot; the teacher resets through the real route; A's screen moves on
 *     to choosing new pictures by itself;
 *   - student B raises a hand in practice: it shows in the snapshot; the
 *     teacher acknowledges; B's button clears and "Your teacher saw it." shows.
 * Nothing on either screen may move through any step (at 390 and 1280, light
 * and dark).
 *
 * Then the practice bar itself, Calm and Colorful, at 320, 390, 768 and
 * 1280, light and dark. A problem's bar holds only the problem's tools: no
 * name and no Sign out (both are the menu's, once each). The raised hand is
 * in one place at a time: the bar while a session runs, a row of the menu
 * when none does. A session stopping or starting moves nothing in the bar
 * (its height, the logo, the calculator's place, Colorful's points, the
 * problem), and nothing in a menu that is open. On a calculator problem
 * neither the calculator nor the hand stands a gap away from the bar's edge
 * once the next problem arrives: the hand has the bar's end while a session
 * runs, the calculator when none does. Screenshots go to $VERIFY_SHOTS
 * (default artifacts/student-signals).
 *
 * By itself (as CI runs it, `npm run test:student-signals-ui`) it starts its
 * own stack on a fresh schema of AMP_TEST_DATABASE_URL
 * (scripts/persona-stack.ts) and has the simulator make the class:
 *
 *     AMP_TEST_DATABASE_URL=postgres://…/amp_test \
 *     npx tsx scripts/verify-student-signals-ui.ts [--port 4890]
 *
 * Or against a running preview where the simulator has made the class once:
 *
 *     VERIFY_DATABASE_URL=postgres://amp:amp@127.0.0.1:55490/amp_scratch_l4b \
 *     VERIFY_API=http://127.0.0.1:4871 VERIFY_WEB=http://127.0.0.1:4870 \
 *     npx tsx scripts/verify-student-signals-ui.ts
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import pg from "pg";
import { chromium as rawChromium, type Page } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { schoolPictures } from "../src/schools/contracts";
import { PERSONA_PASSPHRASE } from "../src/web/features/dev/persona-list";
import { startPersonaStack } from "./persona-stack";

const shots = process.env.VERIFY_SHOTS ?? "artifacts/student-signals";
await mkdir(shots, { recursive: true });
// No preview named: the check's own stack, and the simulator's class in it.
const port = process.argv.indexOf("--port");
const stack = process.env.VERIFY_DATABASE_URL
  ? null
  : await startPersonaStack({
      webPort: port > 0 ? Number(process.argv[port + 1]) : 4890,
      personas: ["teacher-class"],
      name: "student_signals",
      out: shots,
    });
const databaseUrl = stack?.database ?? process.env.VERIFY_DATABASE_URL!;
const api = (
  stack?.api ??
  process.env.VERIFY_API ??
  "http://127.0.0.1:4871"
).replace(/\/$/, "");
const web = (
  stack?.origin ??
  process.env.VERIFY_WEB ??
  "http://127.0.0.1:4870"
).replace(/\/$/, "");
for (const url of [databaseUrl, api, web])
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname))
    throw new Error(`Loopback only: ${url}`);
if (stack) {
  // The class and its students, made the real way: they arrive, sign in,
  // and the simulator is done in seconds, with no session run.
  const made = spawn(
    "npx",
    [
      "tsx",
      "scripts/live-class-sim.ts",
      "--students",
      "14",
      "--minutes",
      "0.05",
      "--pace",
      "0.05",
      "--no-start",
    ],
    {
      env: {
        ...process.env,
        AMP_SIM_DATABASE_URL: databaseUrl,
        AMP_SIM_API: api,
        AMP_SIM_WEB: web,
      },
      stdio: ["ignore", "ignore", "inherit"],
    },
  );
  const code = await new Promise<number | null>((resolve) =>
    made.on("exit", resolve),
  );
  assert.equal(code, 0, "the simulator makes its class");
}
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
/** The class's session, running or stopped, by the teacher's own routes. */
async function setSession(running: boolean) {
  const now = await live();
  if (running && !now.session)
    await teacher("POST", `/api/v1/school/classes/${room!.id}/sessions`, {});
  if (!running && now.session)
    await teacher(
      "POST",
      `/api/v1/school/classes/${room!.id}/sessions/${now.session.id}/stop`,
      {},
    );
}
await setSession(true);

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
    if (!a && !b) continue;
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
const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.width - 1 &&
  b.x < a.x + a.width - 1 &&
  a.y < b.y + b.height - 1 &&
  b.y < a.y + a.height - 1;
/** "Your teacher saw it." is on screen, whole, and lies over nothing a
 * student reads or uses: not the problem, not an answer control, not the
 * bar's own controls, not Colorful's points. */
async function noteClear(page: Page, label: string) {
  const found = await boxes(page, {
    note: "[data-hand-note]",
    problem: ".problem-stage",
    answer: ".answer-dock",
    keypad: ".math-keypad",
    logo: "header[data-app-bar] [data-navigation-trigger]",
    hand: "header[data-app-bar] button[aria-label='Raise hand']",
    calculator: "header[data-app-bar] .calculator-toggle",
    chip: "[class*='_chip_'][data-shown]",
  });
  const note = found.note;
  assert.ok(note && note.width > 0 && note.height > 0, `${label}: no note`);
  const view = page.viewportSize()!;
  assert.ok(
    note.x >= 0 &&
      note.y >= 0 &&
      note.x + note.width <= view.width &&
      note.y + note.height <= view.height,
    `${label}: the note leaves the screen ${JSON.stringify(note)}`,
  );
  for (const [name, box] of Object.entries(found))
    if (name !== "note" && box)
      assert.ok(
        !overlap(note, box),
        `${label}: the note lies over the ${name}: ${JSON.stringify({ note, [name]: box })}`,
      );
}
const pictureButtons = (page: Page) => page.locator("button[aria-pressed]");
async function pick(page: Page) {
  for (const index of [0, 1, 2]) await pictureButtons(page).nth(index).click();
}

const browser = await secureChromium(rawChromium).launch();
const issues: string[] = [];
let checks = 0;
let failed = false;
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
        .getByRole("button", { name: "Forgot your pictures?" })
        .waitFor();
      const watch = {
        slots: "ol",
        firstPicture: "button[aria-pressed]",
        title: "h1",
        forgot: "[class*='_forgot_'] button",
      };
      const picking = await boxes(page, watch);
      await page.screenshot({ path: `${shots}/forgot-1-picking-${tag}.png` });
      await page.getByRole("button", { name: "Forgot your pictures?" }).click();
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
      await page.getByRole("button", { name: "Forgot your pictures?" }).click();
      await page.getByRole("button", { name: "Pick your pictures" }).click();
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
      await noteClear(page, `${tag} hand acknowledged`);
      await page.screenshot({ path: `${shots}/hand-3-seen-${tag}.png` });
      await page
        .locator("[data-hand-note]")
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

  // ---- the practice bar, Calm and Colorful, at 320 and 390 -----------------
  /** The student's own look, set the way their settings would (their token). */
  const setLook = (personId: string, look: "calm" | "bold") =>
    savePractice(personId, { kind: "look", look });
  /** One change to the student's practice settings, with their own token. */
  async function savePractice(
    personId: string,
    change: Record<string, unknown>,
  ) {
    await setPictures(personId);
    const grant = (await (
      await fetch(`${api}/api/v1/school/join/picture`, {
        method: "POST",
        headers: { Origin: web, "content-type": "application/json" },
        body: JSON.stringify({
          code,
          personId,
          pictures: mine,
          set: false,
        }),
      })
    ).json()) as { token: string };
    const headers = {
      Origin: web,
      "content-type": "application/json",
      authorization: `Bearer ${grant.token}`,
    };
    const me = (await (
      await fetch(`${api}/api/v1/me`, { headers })
    ).json()) as {
      learners: { id: string }[];
    };
    const path = `${api}/api/v1/learners/${me.learners[0]!.id}/practice-state`;
    const state = (await (await fetch(path, { headers })).json()) as {
      revision: number;
    };
    const response = await fetch(path, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...change,
        requestId: crypto.randomUUID(),
        revision: state.revision,
      }),
    });
    assert.ok(
      response.ok,
      `saving ${JSON.stringify(change)}: ${response.status} ${await response.clone().text()}`,
    );
  }
  const BAR = "header[data-app-bar]";
  const HAND = `${BAR} button[aria-label='Raise hand']`;
  for (const look of ["calm", "bold"] as const)
    for (const width of [320, 390, 768, 1280])
      for (const theme of ["light", "dark"] as const) {
        const tag = `${look === "bold" ? "colorful" : "calm"}-${width}-${theme}`;
        await setLook(B.id, look);
        await setSession(true);
        const context = await browser.newContext({
          viewport: { width, height: width < 700 ? 740 : 800 },
          colorScheme: theme,
        });
        const page = await context.newPage();
        await page.goto(`${web}/join/${code}/${B.id}`);
        await pictureButtons(page).first().waitFor();
        await pick(page);
        const hand = page.locator(HAND);
        await hand.waitFor({ timeout: 30_000 });
        if (look === "bold")
          await page
            .locator("[class*='_chip_'][data-shown]")
            .waitFor({ timeout: 15_000 });
        // An earlier run's note is gone before the first measure.
        await page
          .locator("[data-hand-note]")
          .waitFor({ state: "detached", timeout: 10_000 })
          .catch(() => {});
        await page.waitForTimeout(1200);
        // What a session starting or stopping must never move.
        const parts = {
          bar: BAR,
          logo: `${BAR} [data-navigation-trigger]`,
          slot: `${BAR} [data-raise-hand-slot]`,
          calculator: `${BAR} .calculator-toggle, ${BAR} .no-calculator`,
          chip: "[class*='_chip_'][data-shown]",
          topic: ".practice-topic, .workspace-topic",
          stage: ".problem-stage",
        };
        /** A problem's bar holds only the problem's tools. */
        const onlyTools = async (label: string) => {
          const found = await page.evaluate(
            ({ bar, name }) => {
              const header = document.querySelector(bar)!;
              return {
                marks: header.querySelectorAll(
                  "[data-session-mark], [data-session-name], [data-session-sign-out], [data-student-sign-out], [data-handed-home]",
                ).length,
                named: (header.textContent ?? "").includes(name),
                signOut: /sign out/i.test(header.textContent ?? ""),
              };
            },
            { bar: BAR, name: B.name },
          );
          assert.equal(
            found.marks,
            0,
            `${tag} ${label}: the practice bar holds a session mark`,
          );
          assert.ok(!found.named, `${tag} ${label}: the bar names the student`);
          assert.ok(!found.signOut, `${tag} ${label}: the bar says Sign out`);
        };
        const settle = async (label: string, shot: string) => {
          await page.waitForTimeout(500);
          const now = await boxes(page, { ...parts, hand: HAND });
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - innerWidth,
          );
          assert.ok(overflow <= 0, `${tag} ${label}: overflow ${overflow}`);
          await onlyTools(label);
          if (now.hand) {
            assert.ok(
              now.hand.width >= 44 && now.hand.height >= 44,
              `${tag} ${label}: 44 px`,
            );
            for (const other of ["calculator", "chip", "logo"] as const)
              if (now[other])
                assert.ok(
                  !overlap(now.hand, now[other]!),
                  `${tag} ${label}: hand overlaps ${other}`,
                );
          }
          for (const other of ["calculator", "logo"] as const)
            if (now.chip && now[other])
              assert.ok(
                !overlap(now.chip, now[other]!),
                `${tag} ${label}: chip over ${other}`,
              );
          await page.screenshot({
            path: `${shots}/bar-${shot}-${tag}.png`,
            clip: { x: 0, y: 0, width, height: 190 },
          });
          return now;
        };
        const pressed = (selector: string, value: "true" | "false") =>
          page.waitForFunction(
            ([target, wanted]) =>
              document.querySelector(target!)?.getAttribute("aria-pressed") ===
              wanted,
            [selector, value],
          );
        const down = await settle("down", "1-down");
        assert.ok(down.hand, `${tag}: a session runs, the hand is in the bar`);
        await hand.click();
        await pressed(HAND, "true");
        const up = await settle("up", "2-up");
        same(`${tag} down -> up`, down, up);
        const raised = (await live()).signals.find(
          (x) => x.personId === B.id && x.kind === "hand",
        );
        assert.ok(raised, `${tag}: hand in the snapshot`);
        if (look === "bold")
          await page.evaluate(
            (hue) =>
              document.documentElement.style.setProperty("--look-hue", hue),
            width === 320 ? "30deg" : "210deg",
          );
        await teacher(
          "POST",
          `/api/v1/school/classes/${room.id}/signals/${raised.id}/resolve`,
          {},
        );
        await page
          .getByRole("status")
          .filter({ hasText: "Your teacher saw it." })
          .waitFor({ timeout: 12_000 });
        const seen = await settle("seen", "3-seen");
        same(`${tag} up -> seen`, up, seen);
        await noteClear(page, `${tag} seen`);
        await page.screenshot({ path: `${shots}/note-${tag}.png` });
        // The note and button take the world's color: role tokens.
        const colors = await page.evaluate((selector) => {
          const note = document.querySelector("[data-hand-note]");
          const button = document.querySelector(selector);
          return {
            note: note ? getComputedStyle(note).backgroundColor : "",
            button: button ? getComputedStyle(button).backgroundColor : "",
          };
        }, HAND);
        console.log(`  ${tag}: note ${colors.note}, button ${colors.button}`);
        await page
          .locator("[data-hand-note]")
          .waitFor({ state: "detached", timeout: 10_000 });

        // ---- the session stops: the hand leaves the bar, nothing moves ----
        await setSession(false);
        await page
          .locator(`${BAR} [data-raise-hand-slot='rest']`)
          .waitFor({ timeout: 15_000 });
        const rest = await settle("rest", "4-rest");
        assert.equal(rest.hand, null, `${tag}: no session, no hand in the bar`);
        same(
          `${tag} session stopped`,
          { ...seen, hand: null },
          { ...rest, hand: null },
        );
        assert.equal(
          await page.getByRole("button", { name: "Raise hand" }).count(),
          0,
          `${tag}: the menu is closed and the bar has no hand`,
        );

        // ---- the menu: who is signed in, the hand, Sign out, once each ----
        await page.locator(`${BAR} [data-navigation-trigger]`).click();
        const menu = page.getByRole("dialog");
        const row = menu.getByRole("button", { name: "Raise hand" });
        await row.waitFor();
        await page.waitForTimeout(500);
        assert.equal(
          await page.getByRole("button", { name: "Raise hand" }).count(),
          1,
          `${tag}: the hand is in one place`,
        );
        assert.equal(
          await menu.getByText("Signed in as", { exact: true }).count(),
          1,
          `${tag}: the menu says who is signed in, once`,
        );
        assert.equal(
          await menu.getByText(B.name, { exact: true }).count(),
          1,
          `${tag}: the menu names the student once`,
        );
        const out = menu.getByRole("button", { name: /^Sign out/ });
        assert.equal(await out.count(), 1, `${tag}: one Sign out, the menu's`);
        const menuParts = {
          row: "[data-raise-hand='menu']",
          name: "[data-navigation-sheet] [data-learner] strong",
          signOut: "[data-navigation-sheet] [data-signed-in] button",
          practice: "[data-navigation-sheet] nav a",
        };
        const menuDown = await boxes(page, menuParts);
        assert.ok(
          menuDown.row &&
            menuDown.row.height >= 44 &&
            menuDown.signOut &&
            menuDown.signOut.height >= 44,
          `${tag}: the menu's hand and Sign out are 44 px targets`,
        );
        assert.ok(
          (await page.evaluate(
            () => document.documentElement.scrollWidth - innerWidth,
          )) <= 0,
          `${tag}: the open menu overflows`,
        );
        await page.screenshot({ path: `${shots}/menu-1-rest-${tag}.png` });
        await row.click();
        await pressed("[data-raise-hand='menu']", "true");
        await page.waitForTimeout(400);
        same(
          `${tag} menu hand down -> up`,
          menuDown,
          await boxes(page, menuParts),
        );
        await page.screenshot({ path: `${shots}/menu-2-up-${tag}.png` });
        await page.waitForTimeout(1200);
        assert.ok(
          (await live()).signals.some(
            (x) => x.personId === B.id && x.kind === "hand",
          ),
          `${tag}: the hand raised from the menu reached the teacher`,
        );
        await row.click();
        await pressed("[data-raise-hand='menu']", "false");
        await page.waitForTimeout(1200);
        assert.ok(
          !(await live()).signals.some(
            (x) => x.personId === B.id && x.kind === "hand",
          ),
          `${tag}: lowered from the menu`,
        );

        // ---- a session starts under the open menu: its rows hold still ----
        await setSession(true);
        await page
          .locator("[data-raise-hand='menu'][data-away]")
          .waitFor({ state: "attached", timeout: 15_000 });
        await page.waitForTimeout(400);
        same(`${tag} session started, menu open`, menuDown, {
          ...(await boxes(page, menuParts)),
        });
        assert.equal(
          await menu.getByRole("button", { name: "Raise hand" }).count(),
          0,
          `${tag}: the menu's row gave way to the bar's hand`,
        );
        await page.keyboard.press("Escape");
        await menu.waitFor({ state: "detached" });
        await hand.waitFor();
        const again = await settle("live again", "5-live-again");
        same(`${tag} session started`, down, again);
        assert.equal(
          await page.getByRole("button", { name: "Raise hand" }).count(),
          1,
          `${tag}: the hand is in one place again`,
        );
        // Sign out from the menu ends the student's sign-in.
        await page.locator(`${BAR} [data-navigation-trigger]`).click();
        await menu.getByRole("button", { name: /^Sign out/ }).waitFor();
        assert.equal(
          await menu.getByRole("button", { name: "Raise hand" }).count(),
          0,
          `${tag}: a session runs, the menu has no hand`,
        );
        await menu.getByRole("button", { name: /^Sign out/ }).click();
        await page.waitForURL("**/join");
        assert.equal(
          await page.evaluate(() => sessionStorage.getItem("amp.student")),
          null,
          `${tag}: signed out from the menu`,
        );
        await context.close();
        checks++;
      }
  // ---- with a calculator: nothing stands a gap away from the bar's end ----
  for (const width of [390, 1280]) {
    const tag = `calculator-${width}`;
    await setLook(B.id, "calm");
    await setSession(true);
    const context = await browser.newContext({
      viewport: { width, height: width < 700 ? 844 : 800 },
    });
    const page = await context.newPage();
    await page.goto(`${web}/join/${code}/${B.id}`);
    await pictureButtons(page).first().waitFor();
    await pick(page);
    await page.locator(".problem-stage").waitFor({ timeout: 30_000 });
    // A problem type that allows the calculator at every grade.
    await page.goto(
      `${web}${new URL(page.url()).pathname}/types/purchase-change`,
    );
    const calculator = `${BAR} .calculator-toggle`;
    await page.locator(calculator).waitFor({ timeout: 30_000 });
    await page.locator(HAND).waitFor();
    /** The bar's end (inside its padding), and where the two tools are. */
    const ends = async () => {
      await page.waitForTimeout(500);
      return page.evaluate(
        ([bar, hand, tool]) => {
          const header = document.querySelector(bar!)!;
          const [handBox, toolBox] = [hand!, tool!].map((selector) => {
            const rect = document
              .querySelector(selector)
              ?.getBoundingClientRect();
            return rect ? { left: rect.left, right: rect.right } : null;
          });
          return {
            end:
              header.getBoundingClientRect().right -
              Number.parseFloat(getComputedStyle(header).paddingRight),
            hand: handBox ?? null,
            calculator: toolBox ?? null,
          };
        },
        [BAR, HAND, calculator],
      );
    };
    const near = (a: number, b: number) => Math.abs(a - b) <= 1;
    /** The next problem of the same type, by Skip and Next. */
    const nextProblem = async () => {
      const before = await page
        .locator(".problem-content")
        .getAttribute("data-problem-id");
      await page
        .getByRole("button", { name: "Skip this problem and see its answer" })
        .click();
      await page.locator(".next-action").click();
      await page.waitForFunction(
        (id) =>
          document
            .querySelector(".problem-content")
            ?.getAttribute("data-problem-id") !== id,
        before,
      );
      await page.locator(calculator).waitFor();
    };
    // A session runs: the calculator, then the hand at the bar's end.
    const live1 = await ends();
    assert.ok(
      live1.hand && live1.calculator && near(live1.hand.right, live1.end),
      `${tag}: in a session the hand is at the bar's end ${JSON.stringify(live1)}`,
    );
    assert.ok(
      live1.calculator.right <= live1.hand.left &&
        live1.hand.left - live1.calculator.right <= 12,
      `${tag}: the calculator sits beside the hand ${JSON.stringify(live1)}`,
    );
    await page.screenshot({
      path: `${shots}/calculator-1-live-${tag}.png`,
      clip: { x: 0, y: 0, width, height: 190 },
    });
    // It stops under this problem: the calculator stays where it is.
    await setSession(false);
    await page
      .locator(`${BAR} [data-raise-hand-slot='rest']`)
      .waitFor({ timeout: 15_000 });
    const stopped = await ends();
    assert.equal(stopped.hand, null, `${tag}: no session, no hand in the bar`);
    assert.deepEqual(
      stopped.calculator,
      live1.calculator,
      `${tag}: the calculator moved as the session stopped`,
    );
    // The next problem: the calculator has the bar's end.
    await nextProblem();
    const rest = await ends();
    assert.ok(
      rest.calculator && near(rest.calculator.right, rest.end),
      `${tag}: with no session the calculator is at the bar's end ${JSON.stringify(rest)}`,
    );
    await page.screenshot({
      path: `${shots}/calculator-2-rest-${tag}.png`,
      clip: { x: 0, y: 0, width, height: 190 },
    });
    // A session starts under this problem: the hand shows in its kept
    // place, and the calculator stays where it is.
    await setSession(true);
    await page.locator(HAND).waitFor({ timeout: 15_000 });
    const started = await ends();
    assert.deepEqual(
      started.calculator,
      rest.calculator,
      `${tag}: the calculator moved as the session started`,
    );
    assert.ok(
      started.hand &&
        started.hand.right <= started.calculator!.left &&
        started.calculator!.left - started.hand.right <= 12,
      `${tag}: the hand shows beside the calculator ${JSON.stringify(started)}`,
    );
    await page.screenshot({
      path: `${shots}/calculator-3-started-${tag}.png`,
      clip: { x: 0, y: 0, width, height: 190 },
    });
    // The next problem: the hand has the bar's end again.
    await nextProblem();
    const live2 = await ends();
    assert.deepEqual(
      live2,
      live1,
      `${tag}: a session's next problem has the hand at the bar's end`,
    );
    await context.close();
    // The student is left on mixed practice, as they were found.
    await savePractice(B.id, { kind: "focus", skillId: null });
    checks++;
  }
  if (issues.length) console.log(`console errors:\n${issues.join("\n")}`);
  console.log(`verify-student-signals-ui: ${checks} checks passed`);
} catch (error) {
  failed = true;
  console.error(error);
} finally {
  await browser.close();
  await pool.end();
  // The check's own stack: its servers stop and its schema goes.
  await stack?.stop();
}
process.exit(failed ? 1 : 0);
