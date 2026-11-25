/**
 * A family's live session on your desk (round 2026-11-20 L8): a seeded
 * family's children practice through the real routes while you watch the
 * family's Today as the parent (or the second parent).
 *
 *   AMP_SIM_DATABASE_URL=postgres://amp:amp@127.0.0.1:55490/<db> \
 *   AMP_SIM_API=http://127.0.0.1:4811 AMP_SIM_WEB=http://127.0.0.1:4810 \
 *     npx tsx scripts/live-family-sim.ts --minutes 5 [--persona family]
 *
 * The family is one of the design personas (default `family`: Pip, Wren
 * and Theo; `parent-day1` has one child). The parent signs in through the
 * real sign-in, starts the session, then, by child in name order:
 *   1st  "on the parent's device": the parent's real "practice here" grant,
 *        then answers (the parent's phone handed to the child);
 *   2nd  on a device of their own, signed in through the family's code and
 *        pictures, who raises a hand after their 2nd answer (--raise-hand);
 *   3rd  never starts (shows "Not started").
 * With one child, only the first. Loopback-only; never the shared /amp
 * database. Flags: --no-start, --stop, --raise-hand, --pace X, --minutes M.
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import { schoolPictures } from "../src/schools/contracts";
import {
  PERSONA_PASSPHRASE,
  personaEmail,
} from "../src/web/features/dev/persona-list";
import { practiceResponse } from "./ui-practice-answer";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string, fallback: number) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? Number(args[at + 1]) : fallback;
};
const text = (name: string, fallback: string) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? String(args[at + 1]) : fallback;
};
const MINUTES = option("minutes", 5);
const PACE = option("pace", 1);
const persona = text("persona", "family");
const databaseUrl = process.env.AMP_SIM_DATABASE_URL;
const api = (process.env.AMP_SIM_API ?? "http://127.0.0.1:4811").replace(
  /\/$/,
  "",
);
const web = (process.env.AMP_SIM_WEB ?? api).replace(/\/$/, "");
if (!databaseUrl) throw new Error("AMP_SIM_DATABASE_URL is required");
for (const url of [databaseUrl, api, web])
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname))
    throw new Error(`The simulator is loopback-only: ${url}`);
if (new URL(databaseUrl).pathname === "/amp")
  throw new Error("Never the shared /amp database");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function call<T>(
  method: string,
  path: string,
  options: { token?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      Origin: web,
      ...(options.body === undefined
        ? {}
        : { "content-type": "application/json" }),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const body = await response.text();
  if (!response.ok)
    throw new Error(
      `${method} ${path} → ${response.status} ${body.slice(0, 200)}`,
    );
  return (body ? JSON.parse(body) : null) as T;
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 3 });

async function parentToken(): Promise<string> {
  const email = personaEmail(persona);
  const signIn = await fetch(`${web}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { Origin: web, "content-type": "application/json" },
    body: JSON.stringify({ email, password: PERSONA_PASSPHRASE }),
  });
  if (!signIn.ok)
    throw new Error(`Sign-in refused: ${signIn.status} ${await signIn.text()}`);
  const cookie = signIn.headers
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .join("; ");
  const session = (await (
    await fetch(`${web}/api/auth/get-session`, { headers: { cookie } })
  ).json()) as { session: { token: string } };
  return session.session.token;
}

type Child = {
  id: string;
  name: string;
  personId: string;
  right: number;
  every: [number, number];
  help: number;
};
const counts = { answers: 0, right: 0, help: 0, hands: 0, errors: 0 };

async function runChild(
  child: Child,
  token: string,
  until: number,
  kind: string,
) {
  const learner = `/api/v1/learners/${child.id}`;
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
  };
  await beat();
  console.log(`  ${child.name} practicing (${kind})`);
  while (Date.now() < until) {
    try {
      const batch = await call<{
        problems: { id: string; templateId: string }[];
      }>("POST", `${learner}/batches`, { token, body: { count: 1 } });
      const problem = batch.problems[0];
      if (!problem) {
        await sleep(3_000);
        continue;
      }
      const [min, max] = child.every;
      await sleep((min + Math.random() * (max - min)) * 1000 * PACE);
      if (Math.random() < child.help) {
        await beat([
          {
            kind: "hint",
            source: "practice",
            ref: problem.templateId,
            problemId: problem.id,
            step: 1,
            ageMs: 0,
          },
        ]);
        counts.help++;
      }
      const stored = (
        await pool.query("SELECT content FROM amp_instances WHERE id=$1", [
          problem.id,
        ])
      ).rows[0].content;
      const right = Math.random() < child.right;
      await call("POST", `${learner}/attempts`, {
        token,
        body: {
          problemId: problem.id,
          requestId: randomUUID(),
          response: practiceResponse(stored, right),
        },
      });
      answered++;
      counts.answers++;
      if (right) counts.right++;
      if (flag("raise-hand") && kind === "own device" && answered === 2) {
        await call("POST", "/api/v1/school/student/signals", {
          token,
          body: { kind: "hand" },
        });
        counts.hands++;
        console.log(`  ${child.name} raised a hand`);
      }
      if (Date.now() - lastBeat > 30_000) await beat();
    } catch (error) {
      counts.errors++;
      console.warn(`  ${child.name}: ${(error as Error).message}`);
      await sleep(4_000);
    }
  }
}

const token = await parentToken();
const { families } = await call<{ families: { familyId: string }[] }>(
  "GET",
  "/api/v1/families",
  { token },
);
const familyId = families[0]!.familyId;
const family = await call<{
  children: {
    id: string;
    name: string;
    classes: { id: string; personId: string; orgId: string }[];
  }[];
}>("GET", `/api/v1/families/${familyId}`, { token });
const classId = family.children[0]!.classes[0]!.id;
const orgId = family.children[0]!.classes[0]!.orgId;
const code = (
  await pool.query("SELECT join_code FROM amp_classes WHERE id=$1", [classId])
).rows[0].join_code as string;
const kids: Child[] = family.children
  .slice()
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((kid, index) => ({
    id: kid.id,
    name: kid.name,
    personId: kid.classes.find((entry) => entry.id === classId)!.personId,
    right: [0.8, 0.6, 0.7][index % 3]!,
    every: [
      [8, 14],
      [10, 18],
      [12, 20],
    ][index % 3] as [number, number],
    help: [0.1, 0.35, 0.1][index % 3]!,
  }));
console.log(`\nFamily simulator: ${persona}, ${kids.length} children`);
console.log(`  Sign in as ${personaEmail(persona)}`);
console.log(`  ${web}/family/${familyId}`);
console.log(`  class ${classId} (code ${code})`);

if (!flag("no-start")) {
  const started = await call<{ session: { id: string } }>(
    "POST",
    `/api/v1/school/classes/${classId}/sessions`,
    { token, body: {} },
  );
  console.log(`  session ${started.session.id} started`);
}
const until = Date.now() + MINUTES * 60_000;
const runs: Promise<void>[] = [];
kids.forEach((kid, index) => {
  if (index === 0) {
    // The parent's phone, handed to the child.
    runs.push(
      call<{ token: string }>(
        "POST",
        `/api/v1/family/learners/${kid.id}/practice-here`,
        { token, body: {} },
      ).then((grant) => runChild(kid, grant.token, until, "parent's device")),
    );
  } else if (index === 1) {
    // Their own device, through the family's code and pictures.
    const pictures = [0, 5, 11].map(
      (offset) => schoolPictures[(index + offset) % schoolPictures.length]!,
    );
    runs.push(
      call<{ token: string }>("POST", "/api/v1/school/join/picture", {
        body: { code, personId: kid.personId, pictures, set: true },
      }).then((grant) => runChild(kid, grant.token, until, "own device")),
    );
  } else console.log(`  ${kid.name} has not started`);
});
await Promise.all(
  runs.map((run) =>
    run.catch((error) => {
      counts.errors++;
      console.warn(`  stopped: ${(error as Error).message}`);
    }),
  ),
);
if (flag("stop")) {
  const live = await call<{ session: { id: string } | null }>(
    "GET",
    `/api/v1/school/classes/${classId}/live`,
    { token },
  );
  if (live.session)
    await call(
      "POST",
      `/api/v1/school/classes/${classId}/sessions/${live.session.id}/stop`,
      { token, body: {} },
    );
}
console.log(
  `\nDone: ${counts.answers} answers (${counts.right} right), ${counts.help} help, ${counts.hands} hands, ${counts.errors} errors (org ${orgId})`,
);
await pool.end();
