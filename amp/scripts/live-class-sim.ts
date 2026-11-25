/**
 * A live class on your desk (#2465): a class of synthetic students practicing
 * through the real routes (picture sign-in, batches, attempts, the activity
 * heartbeat with help) while you watch the teacher's live view.
 *
 *   AMP_SIM_DATABASE_URL=postgres://amp:amp@127.0.0.1:55490/amp_scratch_l2 \
 *   AMP_SIM_API=http://127.0.0.1:4831 AMP_SIM_WEB=http://127.0.0.1:4830 \
 *     npx tsx scripts/live-class-sim.ts --students 14 --minutes 10
 *
 * It prints the cockpit's address and the teacher to sign in as, starts a
 * session (unless `--no-start`), and drives each student as a persona until
 * the time is up: flying, steady, struggling, slow, quiet after a few answers,
 * signed in and never answering, never signing in.
 *
 * Environment (every one loopback-only, and never the shared /amp database):
 *   AMP_SIM_DATABASE_URL  the API's database (setup, and reading each served
 *                         problem's answer to answer right or wrong). Required.
 *   AMP_SIM_API           the API's origin (default http://127.0.0.1:4831), or
 *                         the web origin, which proxies /api.
 *   AMP_SIM_WEB           the web origin, for the cockpit address and sign-in
 *                         (default: AMP_SIM_API).
 *   AMP_SIM_TEACHER_EMAIL the teacher (default the `teacher-class` persona,
 *                         teacher-class@personas.amp.test); signed up through
 *                         the real sign-up if missing.
 *   AMP_SIM_TEACHER_PASSWORD  default: the personas' passphrase.
 *
 * Flags:
 *   --students N      students per class (default 14)
 *   --classes K       classes, each its own session (default 1)
 *   --minutes M       how long to run (default 10)
 *   --pace X          time between actions, times X (default 1; 0.5 is twice as busy)
 *   --no-start        don't start a session (watch a resting class)
 *   --stop            stop the session(s) at the end
 *   --no-student-streams  students don't open their own live stream
 *   --watch           open the teacher's stream per class and count messages
 *   --raise-hand, --forgot-picture  personas for work package L4. HOOK: their
 *                     routes don't exist yet; the flags check for them and
 *                     say so, and never fake a signal (see `l4Hook`).
 *
 * It only ever creates and touches its own place: the org "Live Class
 * Simulator" and its classes "Live sim 1".."Live sim K", reused on the next
 * run, with the teacher added as their teacher. Every student name is made up.
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import { schoolPictures } from "../src/schools/contracts";
import { SchoolRepository } from "../src/schools/repository";
import { PERSONA_PASSPHRASE } from "../src/web/features/dev/persona-list";
import { schoolAdmin } from "./school-admin";
import { practiceResponse } from "./ui-practice-answer";

const ORG_NAME = "Live Class Simulator";
const TIMEZONE = "America/New_York";

// ---- configuration ---------------------------------------------------------
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string, fallback: number) => {
  const at = args.indexOf(`--${name}`);
  const value = at >= 0 ? Number(args[at + 1]) : fallback;
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`--${name} needs a positive number`);
  return value;
};
const STUDENTS = Math.round(option("students", 14));
const CLASSES = Math.round(option("classes", 1));
const MINUTES = option("minutes", 10);
const PACE = option("pace", 1);
const databaseUrl = process.env.AMP_SIM_DATABASE_URL;
const api = (process.env.AMP_SIM_API ?? "http://127.0.0.1:4831").replace(
  /\/$/,
  "",
);
const web = (process.env.AMP_SIM_WEB ?? api).replace(/\/$/, "");
const teacherEmail =
  process.env.AMP_SIM_TEACHER_EMAIL ?? "teacher-class@personas.amp.test";
const teacherPassword =
  process.env.AMP_SIM_TEACHER_PASSWORD ?? PERSONA_PASSPHRASE;
if (!databaseUrl) throw new Error("AMP_SIM_DATABASE_URL is required");
for (const url of [databaseUrl, api, web])
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname))
    throw new Error(`The simulator is loopback-only: ${url}`);
if (new URL(databaseUrl).pathname === "/amp")
  throw new Error("Never the shared /amp database");

// ---- personas --------------------------------------------------------------
type Persona = {
  kind: string;
  /** Chance of a right answer. */
  right: number;
  /** Seconds between answers: [min, max]. */
  every: [number, number];
  /** Chance of opening help before an answer, and which. */
  help: number;
  helpKinds: ("hint" | "lesson" | "example" | "video")[];
  /** Answers before going quiet (still signed in). */
  stopAfter?: number;
  signsIn: boolean;
  answers: boolean;
  /** Raises a hand after their 2nd and 7th answers (L4's route). */
  raisesHand?: boolean;
  /** Forgot their pictures: asks for a reset from the sign-in screen,
   * waits for the teacher's Reset, then chooses new ones (L4's routes). */
  forgetsPicture?: boolean;
};
const PERSONAS: Record<string, Persona> = {
  flying: {
    kind: "flying",
    right: 0.97,
    every: [6, 12],
    help: 0,
    helpKinds: [],
    signsIn: true,
    answers: true,
  },
  steady: {
    kind: "steady",
    right: 0.75,
    every: [12, 22],
    help: 0.15,
    helpKinds: ["hint"],
    signsIn: true,
    answers: true,
  },
  struggling: {
    kind: "struggling",
    right: 0.3,
    every: [18, 35],
    help: 0.6,
    helpKinds: ["hint", "lesson", "example", "video"],
    signsIn: true,
    answers: true,
  },
  slow: {
    kind: "slow",
    right: 0.7,
    every: [45, 90],
    help: 0.2,
    helpKinds: ["lesson"],
    signsIn: true,
    answers: true,
  },
  quiet: {
    kind: "quiet after 3",
    right: 0.6,
    every: [10, 20],
    help: 0,
    helpKinds: [],
    stopAfter: 3,
    signsIn: true,
    answers: true,
  },
  present: {
    kind: "signed in, no answers",
    right: 0,
    every: [30, 30],
    help: 0,
    helpKinds: [],
    signsIn: true,
    answers: false,
  },
  hand: {
    kind: "raises a hand",
    right: 0.6,
    every: [12, 22],
    help: 0.1,
    helpKinds: ["hint"],
    signsIn: true,
    answers: true,
    raisesHand: true,
  },
  forgot: {
    kind: "forgot their pictures",
    right: 0.7,
    every: [12, 22],
    help: 0,
    helpKinds: [],
    signsIn: true,
    answers: true,
    forgetsPicture: true,
  },
  absent: {
    kind: "never signs in",
    right: 0,
    every: [30, 30],
    help: 0,
    helpKinds: [],
    signsIn: false,
    answers: false,
  },
};
/** A class of 14 has two flying, four steady, two struggling, two slow, one
 * quiet, one present without answering and two who never sign in (the
 * first real class: 8 of 14 never answered). Larger classes repeat it. */
const MIX = [
  "flying",
  "steady",
  "struggling",
  "steady",
  "absent",
  "slow",
  "quiet",
  "flying",
  "steady",
  "present",
  "struggling",
  "slow",
  "steady",
  "absent",
];
const NAMES = [
  "Arlo",
  "Bea",
  "Cass",
  "Dov",
  "Elin",
  "Fitz",
  "Gus",
  "Hana",
  "Ines",
  "Jory",
  "Kit",
  "Lark",
  "Milo",
  "Nell",
  "Odie",
  "Pim",
  "Quill",
  "Rhea",
  "Sol",
  "Tamsin",
  "Uma",
  "Vale",
  "Wynn",
  "Xan",
  "Yara",
  "Zev",
  "Ari",
  "Bram",
  "Cleo",
  "Dax",
];

/** HOOK for work package L4 (signals): `--raise-hand` makes the first
 * steady student of each class a "raises a hand" persona, `--forgot-picture`
 * the first who never signs in a "forgot their pictures" one. They act only
 * through L4's routes (`POST /api/v1/school/student/signals`,
 * `/api/v1/school/join/forgot-picture`); against an API without them, the
 * flags say so and change nothing. A signal is never written directly. */
async function l4Hook(): Promise<{ hand: boolean; forgot: boolean }> {
  if (!flag("raise-hand") && !flag("forgot-picture"))
    return { hand: false, forgot: false };
  const probe = await fetch(`${api}/api/v1/school/student/signals`, {
    method: "POST",
    headers: { "content-type": "application/json", Origin: web },
    body: JSON.stringify({ kind: "hand" }),
  });
  await probe.text();
  if (probe.status === 404) {
    console.log(
      "  --raise-hand / --forgot-picture: this API has no signal routes (L4); skipped",
    );
    return { hand: false, forgot: false };
  }
  return { hand: flag("raise-hand"), forgot: flag("forgot-picture") };
}

// ---- helpers ---------------------------------------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const between = ([min, max]: [number, number]) =>
  (min + Math.random() * (max - min)) * 1000 * PACE;
const counts = {
  signIns: 0,
  answers: 0,
  right: 0,
  help: 0,
  heartbeats: 0,
  hands: 0,
  forgot: 0,
  errors: 0,
  studentMessages: 0,
  staffMessages: {} as Record<string, number>,
};
async function call<T>(
  method: string,
  path: string,
  options: { token?: string; cookie?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      Origin: web,
      ...(options.body === undefined
        ? {}
        : { "content-type": "application/json" }),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  if (!response.ok)
    throw new Error(
      `${method} ${path} → ${response.status} ${text.slice(0, 200)}`,
    );
  return (text ? JSON.parse(text) : null) as T;
}

/** Reads an event stream until `signal` aborts, counting frames by event. */
async function readStream(
  path: string,
  token: string,
  signal: AbortSignal,
  onEvent: (event: string) => void,
  cookie?: string,
) {
  while (!signal.aborted) {
    try {
      const response = await fetch(`${api}${path}`, {
        headers: {
          authorization: `Bearer ${token}`,
          accept: "text/event-stream",
          ...(cookie ? { cookie } : {}),
        },
        signal,
      });
      if (!response.ok || !response.body) {
        console.warn(`  stream ${path} refused: ${response.status}`);
        await response.text();
        await sleep(5_000);
        continue;
      }
      const decoder = new TextDecoder();
      let buffer = "";
      const reader = response.body.getReader();
      for (;;) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk as Uint8Array, { stream: true });
        let cut: number;
        while ((cut = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 2);
          const event = /^event: (.*)$/m.exec(block)?.[1];
          if (event) onEvent(event);
        }
      }
    } catch (error) {
      if (signal.aborted) return;
      counts.errors++;
      console.warn(`  stream ${path} broke`, (error as Error).message);
      await sleep(1_000);
    }
  }
}

// ---- setup -----------------------------------------------------------------
const pool = new pg.Pool({ connectionString: databaseUrl, max: 4 });
const schools = new SchoolRepository(pool);

/** The teacher's account: found, or made through the real sign-up. */
async function teacherSession() {
  const found = await pool.query(
    "SELECT id FROM amp_auth_users WHERE lower(email)=lower($1)",
    [teacherEmail],
  );
  if (!found.rowCount) {
    const response = await fetch(`${web}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { Origin: web, "content-type": "application/json" },
      body: JSON.stringify({
        email: teacherEmail,
        password: teacherPassword,
        name: "Sim Teacher",
      }),
    });
    if (!response.ok)
      throw new Error(
        `Teacher sign-up refused: ${response.status} ${await response.text()}`,
      );
    await pool.query(
      'UPDATE amp_auth_users SET "emailVerified"=true WHERE lower(email)=lower($1)',
      [teacherEmail],
    );
  }
  const signIn = await fetch(`${web}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { Origin: web, "content-type": "application/json" },
    body: JSON.stringify({ email: teacherEmail, password: teacherPassword }),
  });
  if (!signIn.ok)
    throw new Error(
      `Teacher sign-in refused: ${signIn.status} ${await signIn.text()}`,
    );
  const cookie = signIn.headers
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .join("; ");
  const session = (await (
    await fetch(`${web}/api/auth/get-session`, { headers: { cookie } })
  ).json()) as {
    user: { id: string; name: string };
    session: { token: string };
  };
  return {
    accountId: `amp|${session.user.id}`,
    name: session.user.name,
    token: session.session.token,
    cookie,
  };
}

/** Our org, made once: its own license and agreement, nobody else's. */
async function ownOrg(): Promise<string> {
  const found = await pool.query(
    "SELECT id FROM amp_orgs WHERE name=$1 AND kind='school' AND parent_id IS NULL ORDER BY created_at LIMIT 1",
    [ORG_NAME],
  );
  if (found.rowCount) return found.rows[0].id;
  const org = (await schoolAdmin(schools, "create-org", {
    kind: "school",
    name: ORG_NAME,
    timezone: TIMEZONE,
    agreement: {
      version: "simulator-1",
      signerName: "Sim Signer",
      signerTitle: "Head of school",
    },
  })) as { id: string };
  await schoolAdmin(schools, "issue-license", {
    orgId: org.id,
    seats: 500,
    endsAt: new Date(Date.now() + 365 * 86_400_000).toISOString(),
  });
  return org.id;
}

type SimStudent = {
  name: string;
  personId: string;
  learnerId: string;
  persona: Persona;
};
/** Class `index` of our org, its students and the teacher on it. */
async function ownClass(
  orgId: string,
  index: number,
  teacher: { accountId: string },
) {
  const name = `Live sim ${index + 1}`;
  const existing = await pool.query(
    "SELECT id FROM amp_classes WHERE org_id=$1 AND name=$2 AND archived_at IS NULL",
    [orgId, name],
  );
  const classId: string =
    existing.rows[0]?.id ?? (await schools.createClass(orgId, { name })).id;
  const teaching = await pool.query(
    `SELECT 1 FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
     WHERE e.class_id=$1 AND e.role='teacher' AND p.account_id=$2 AND p.deleted_at IS NULL`,
    [classId, teacher.accountId],
  );
  if (!teaching.rowCount)
    await schools.addStaff({
      orgId,
      role: "teacher",
      givenName: "Sim",
      accountId: teacher.accountId,
      classId,
    });
  const roster = await pool.query(
    `SELECT p.id,p.learner_id,p.given_name FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
     WHERE e.class_id=$1 AND e.role='student' AND p.deleted_at IS NULL`,
    [classId],
  );
  const byName = new Map(
    roster.rows.map((row) => [row.given_name as string, row]),
  );
  const students: SimStudent[] = [];
  for (let i = 0; i < STUDENTS; i++) {
    const given = `${NAMES[i % NAMES.length]}${i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : ""}`;
    let row = byName.get(given);
    if (!row) {
      const made = await schools.provisionStudent(orgId, {
        givenName: given,
        gradeLevel: 3 + (i % 3),
        classId,
      });
      row = { id: made.personId, learner_id: made.learnerId };
    }
    students.push({
      name: given,
      personId: row.id,
      learnerId: row.learner_id,
      persona: PERSONAS[MIX[i % MIX.length]!]!,
    });
  }
  // L4's personas, when its routes are there (l4Hook).
  const hand = students.find((s) => s.persona === PERSONAS.steady);
  if (signals.hand && hand) hand.persona = PERSONAS.hand!;
  const forgot = students.find((s) => s.persona === PERSONAS.absent);
  if (signals.forgot && forgot) forgot.persona = PERSONAS.forgot!;
  const code = (
    await pool.query("SELECT join_code FROM amp_classes WHERE id=$1", [classId])
  ).rows[0].join_code as string;
  return { classId, name, students, code };
}

// ---- a student -------------------------------------------------------------
async function signIn(
  code: string,
  student: SimStudent,
  /** Another set: the pictures chosen after a reset. */
  shift = 0,
): Promise<string> {
  const index = NAMES.indexOf(student.name.split(" ")[0]!) + shift;
  const pictures = [0, 5, 11].map(
    (offset) => schoolPictures[(index + offset) % schoolPictures.length]!,
  );
  const grant = await call<{ token: string }>(
    "POST",
    "/api/v1/school/join/picture",
    {
      body: { code, personId: student.personId, pictures, set: true },
    },
  );
  counts.signIns++;
  return grant.token;
}

async function runStudent(
  code: string,
  student: SimStudent,
  until: number,
  stop: AbortSignal,
) {
  const { persona } = student;
  if (!persona.signsIn) return;
  // The class doesn't all arrive at the bell.
  await sleep(Math.random() * 20_000 * PACE);
  let token = persona.forgetsPicture ? "" : await signIn(code, student);
  if (persona.forgetsPicture) {
    // Their pictures were set before Start (`forgetful`); today they don't
    // remember them. They ask from the sign-in screen and wait for Reset.
    const who = { code, personId: student.personId };
    await call("POST", "/api/v1/school/join/forgot-picture", { body: who });
    counts.forgot++;
    console.log(
      `  ${student.name} forgot their pictures: Reset them in the live view`,
    );
    for (;;) {
      if (Date.now() >= until || stop.aborted) return;
      await sleep(5_000);
      const state = await call<{ state: string }>(
        "GET",
        `/api/v1/school/join/forgot-picture?code=${encodeURIComponent(code)}&personId=${student.personId}`,
      );
      if (state.state !== "waiting") break;
    }
    token = await signIn(code, student, 1);
  }
  if (!flag("no-student-streams"))
    void readStream("/api/v1/school/student/live/stream", token, stop, () => {
      counts.studentMessages++;
    });
  const learner = `/api/v1/learners/${student.learnerId}`;
  let answered = 0;
  let lastBeat = Date.now();
  const beat = async (events: object[] = []) => {
    const now = Date.now();
    await call("POST", "/api/v1/school/student/activity", {
      token,
      body: {
        deltas: [
          { surface: "practice", activeMs: Math.min(90_000, now - lastBeat) },
        ],
        ...(events.length ? { events } : {}),
      },
    });
    lastBeat = now;
    counts.heartbeats++;
  };
  await beat();
  while (Date.now() < until && !stop.aborted) {
    if (
      !persona.answers ||
      (persona.stopAfter && answered >= persona.stopAfter)
    ) {
      await sleep(Math.min(30_000, until - Date.now()));
      continue;
    }
    try {
      const batch = await call<{
        problems: { id: string; templateId: string }[];
      }>("POST", `${learner}/batches`, { token, body: { count: 1 } });
      const problem = batch.problems[0];
      if (!problem) {
        await sleep(5_000);
        continue;
      }
      await sleep(
        Math.min(between(persona.every), Math.max(0, until - Date.now())),
      );
      if (Date.now() >= until || stop.aborted) break;
      const help =
        Math.random() < persona.help && persona.helpKinds.length
          ? persona.helpKinds[
              Math.floor(Math.random() * persona.helpKinds.length)
            ]!
          : null;
      if (help) {
        // Opened now: the heartbeat carries it within 1.5 s, as the app does.
        await beat([
          {
            kind: help,
            source: "practice",
            ref: problem.templateId,
            problemId: problem.id,
            ...(help === "hint" ? { step: 1 } : {}),
            ageMs: 0,
          },
        ]);
        counts.help++;
        await sleep(between([4, 10]));
      }
      const stored = (
        await pool.query("SELECT content FROM amp_instances WHERE id=$1", [
          problem.id,
        ])
      ).rows[0].content;
      const right = Math.random() < persona.right;
      await call("POST", `${learner}/attempts`, {
        token,
        body: {
          problemId: problem.id,
          requestId: randomUUID(),
          response: practiceResponse(stored, right),
          ...(help ? { help: [help] } : {}),
        },
      });
      answered++;
      counts.answers++;
      if (right) counts.right++;
      if (persona.raisesHand && (answered === 2 || answered === 7)) {
        await call("POST", "/api/v1/school/student/signals", {
          token,
          body: { kind: "hand" },
        });
        counts.hands++;
        console.log(`  ${student.name} raised a hand`);
      }
      if (Date.now() - lastBeat > 30_000) await beat();
    } catch (error) {
      counts.errors++;
      console.warn(`  ${student.name}: ${(error as Error).message}`);
      await sleep(5_000);
    }
  }
}

// ---- run -------------------------------------------------------------------
const teacher = await teacherSession();
const orgId = await ownOrg();
const signals = await l4Hook();
const classes = [];
for (let i = 0; i < CLASSES; i++)
  classes.push(await ownClass(orgId, i, teacher));

console.log(
  `\nLive class simulator: ${CLASSES} class(es) × ${STUDENTS} students, ${MINUTES} min`,
);
console.log(
  `  Sign in as ${teacherEmail} (${teacher.name}); the personas' passphrase if it is one.`,
);
for (const room of classes) {
  console.log(
    `  ${room.name}: ${web}/school/${orgId}/classes/${room.classId}/today`,
  );
  console.log(
    `    code ${room.code}; stream: curl -N -H "Authorization: Bearer <teacher token>" ${api}/api/v1/school/classes/${room.classId}/live/stream`,
  );
}
const mix = new Map<string, number>();
for (const s of classes[0]!.students)
  mix.set(s.persona.kind, (mix.get(s.persona.kind) ?? 0) + 1);
console.log(`  personas: ${[...mix].map(([k, n]) => `${n} ${k}`).join(", ")}`);
console.log(`  teacher token for curl: ${teacher.token}\n`);

// Forgetful students chose their pictures on an earlier day: the teacher
// clears any from a last run (the real Reset), they choose them again before
// Start, and the teacher signs them out (the real "sign out everywhere"), as
// an earlier day's sign-in would be. So they show no presence: a sign-in
// seen in the ten minutes before now would read as here.
for (const room of classes)
  for (const student of room.students)
    if (student.persona.forgetsPicture) {
      await call(
        "POST",
        `/api/v1/school/classes/${room.classId}/students/${student.personId}/reset-pictures`,
        { token: teacher.token, body: {} },
      );
      await signIn(room.code, student);
      await call(
        "POST",
        `/api/v1/school/classes/${room.classId}/students/${student.personId}/revoke-sessions`,
        { token: teacher.token, body: {} },
      );
    }

const sessions: { classId: string; id: string }[] = [];
if (!flag("no-start"))
  for (const room of classes) {
    const started = await call<{ session: { id: string } }>(
      "POST",
      `/api/v1/school/classes/${room.classId}/sessions`,
      { token: teacher.token, body: {} },
    );
    sessions.push({ classId: room.classId, id: started.session.id });
  }

const stop = new AbortController();
const until = Date.now() + MINUTES * 60_000;
if (flag("watch"))
  for (const room of classes)
    void readStream(
      `/api/v1/school/classes/${room.classId}/live/stream`,
      teacher.token,
      stop.signal,
      (event) => {
        counts.staffMessages[event] = (counts.staffMessages[event] ?? 0) + 1;
      },
      teacher.cookie,
    );
const progress = setInterval(() => {
  const left = Math.max(0, Math.round((until - Date.now()) / 1000));
  console.log(
    `  ${left}s left: ${counts.signIns} signed in, ${counts.answers} answers (${counts.right} right), ${counts.help} help, ${counts.heartbeats} heartbeats, ${counts.studentMessages} student msgs, staff ${JSON.stringify(counts.staffMessages)}, ${counts.errors} errors`,
  );
}, 30_000);
process.once("SIGINT", () => stop.abort());
await Promise.all(
  classes.flatMap((room) =>
    room.students.map((student) =>
      runStudent(room.code, student, until, stop.signal).catch((error) => {
        counts.errors++;
        console.warn(`  ${student.name} stopped: ${(error as Error).message}`);
      }),
    ),
  ),
);
stop.abort();
clearInterval(progress);
if (flag("stop"))
  for (const session of sessions)
    await call(
      "POST",
      `/api/v1/school/classes/${session.classId}/sessions/${session.id}/stop`,
      {
        token: teacher.token,
        body: {},
      },
    );
console.log(
  `\nDone: ${counts.signIns} signed in, ${counts.answers} answers (${counts.right} right), ${counts.help} help, ${counts.heartbeats} heartbeats, ${counts.studentMessages} student msgs, staff ${JSON.stringify(counts.staffMessages)}, ${counts.errors} errors`,
);
await pool.end();
