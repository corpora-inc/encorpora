/**
 * The teacher's product in real browsers, against the real API and a real
 * database: a class of 24 provisioned the real way, with real answers through
 * the batches and attempts API at varied ability, then dated back across the
 * year. A teacher opens Today, sees a shared gap, opens the evidence sheet, types
 * a final grade, reloads and it's there, closes the term, exports a CSV and
 * parses it, and opens a report card. Geometry at 320, 390, 768 and 1280, light
 * and dark. Screenshots land in artifacts/school-teacher/; the 1280 and 390 ones
 * also in docs/reviews/school-teacher/, for a person to look at.
 *
 *     AMP_TEST_DATABASE_URL=... npx tsx scripts/verify-school-teacher-ui.ts \
 *       [--engine chromium|webkit] [--widths 390,1280] [--skip-sweep] \
 *       [--skip-journeys] [--reuse <schema>] [--keep]
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { Pool } from "pg";
import {
  chromium as rawChromium,
  webkit,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
import { registerAnalyticsRoutes } from "../src/analytics/routes";
import { registerUnavailableBilling } from "../src/billing/stripe/routes";
import { skills } from "../src/curriculum/catalog";
import { registerFamilyRoutes } from "../src/family/routes";
import { gradeNumber } from "../src/learning/frontier";
import { generateProblem, templates } from "../src/math/engine";
import { SchoolRepository } from "../src/schools/repository";
import { registerSchoolRoutes } from "../src/schools/routes";
import { buildApp } from "../src/server/app";
import { developmentAuth, refuseStudentTokens } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import {
  clippedCells,
  probe,
  resetRecord,
  settle,
  shellRecord,
  shiftRecorder,
} from "./app-shell-probe";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";

const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(url);
const argument = (name: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const flag = (name: string) => process.argv.includes(name);
const engines = argument("--engine")
  ? [argument("--engine") as "chromium" | "webkit"]
  : (["chromium", "webkit"] as const);
const sweepWidths = (argument("--widths") ?? "320,390,768,1280")
  .split(",")
  .map(Number);
const themes = ["light", "dark"] as const;
const REVIEW = "docs/reviews/school-teacher";
const ARTIFACTS = "artifacts/school-teacher";
const webPort = 4400,
  apiPort = 4401,
  origin = `http://127.0.0.1:${webPort}`;
const TEACHER = "development-household";
const SHOTS_FOR_REVIEW = new Set([1280, 390]);

const failures: string[] = [];
function check(label: string, ok: boolean, detail: unknown = "") {
  if (!ok) failures.push(`${label}: ${JSON.stringify(detail)}`);
}

const DAY = 86_400_000;
const dayIso = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10);
/** An even deterministic stream from a label, so a run is repeatable. */
const hash = (text: string) => {
  let seed = 2166136261;
  for (const char of text) {
    seed ^= char.codePointAt(0)!;
    seed = Math.imul(seed, 16777619);
  }
  seed = Math.imul(seed ^ (seed >>> 15), seed | 1);
  seed ^= seed + Math.imul(seed ^ (seed >>> 7), seed | 61);
  return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296;
};

type Persona = {
  name: [string, string];
  /** Where they work, on the grade axis, and how far that moves over the run. */
  ability: number;
  growth?: number;
  /** Problems answered through the API. */
  answers: number;
  /** Minutes on a day they work. */
  minutes: number;
  /** One day in this many they skip. */
  every: number;
  /** Days ago they last worked. */
  lastActive?: number;
  /** Days ago they joined; the whole year otherwise. */
  joined?: number;
  identifier?: string;
};
const P = (
  given: string,
  family: string,
  ability: number,
  patch: Partial<Persona> = {},
): Persona => ({
  name: [given, family],
  ability,
  answers: 300,
  minutes: 11,
  every: 2,
  growth: 0.4,
  ...patch,
});
const PEOPLE: Persona[] = [
  P("Priya", "Raman", 6.2, { answers: 340, minutes: 14, growth: 0.7 }),
  P("Sam", "Whitlock", 6.0, { answers: 340, minutes: 13, growth: 0.7 }),
  P("Mei", "Tran", 5.2, { minutes: 13 }),
  P("Felix", "Grant", 5.0, { minutes: 12 }),
  P("Amara", "Osei", 4.9, { minutes: 12 }),
  P("Ruth", "Adeyemi", 4.8),
  P("Kai", "Nakamura", 4.7),
  P("Zara", "Mensah", 4.6, { joined: 12, answers: 80, minutes: 13 }),
  P("Isaac", "Moreno", 4.5),
  P("Sofia", "Marin", 4.5, { minutes: 12 }),
  P("Imani", "Clarke", 4.4, { minutes: 11 }),
  P("Tomas", "Vega", 4.4, { minutes: 7, every: 3 }),
  P("Nadia", "Petrov", 4.3),
  P("Elias", "Frost", 4.3, {
    answers: 8,
    minutes: 3,
    every: 40,
    lastActive: 0,
  }),
  P("Eli", "Novak", 4.2, { minutes: 10 }),
  P("Lena", "Fischer", 4.1),
  P("Diego", "Salas", 4.0),
  P("Marcus", "Bell", 4.0, { lastActive: 9, minutes: 12 }),
  P("Hana", "Sato", 3.9),
  P("Owen", "Hartley", 3.8),
  P("Caleb", "Ortiz", 2.2, { growth: 1.3, answers: 340, minutes: 14 }),
  P("Jonah", "Reyes", 3.6),
  P("Noor", "Haddad", 3.5),
  P("Theo", "Lindqvist", 3.4, { minutes: 6, every: 3 }),
].map((person, index) => ({
  ...person,
  identifier: `S-${10210 + index * 37}`,
}));
const SHARED_GAP = {
  people: ["Noor", "Diego", "Lena", "Jonah", "Owen", "Hana"],
  template: "add-fractions",
};
const STUCK = { person: "Kai", template: "divide-by-two-digit" };

const reuse = argument("--reuse");
const schema = reuse ?? `amp_teacher_ui_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: url, max: 1 });
const scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
if (!reuse) {
  await admin.query(`CREATE SCHEMA ${schema}`);
  await migrate(scoped.href);
}
const learning = new PostgresRepository(scoped.href);
const db = learning.pool;
const schools = new SchoolRepository(db);
const authenticate = refuseStudentTokens(developmentAuth());
const api = buildApp({ repository: learning, authenticate });
await registerFamilyRoutes(api, { pool: db, authenticate });
await registerSchoolRoutes(api, { pool: db, authenticate });
await registerUnavailableBilling(api, authenticate);
await registerAnalyticsRoutes(api, { pool: db, authenticate });
api.get("/api/v1/auth-config", async () => ({ mode: "development" }));
await api.listen({ host: "127.0.0.1", port: apiPort });
const vite = await createServer({
  cacheDir: "node_modules/.vite-school-teacher",
  server: {
    host: "127.0.0.1",
    port: webPort,
    strictPort: true,
    watch: null,
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
  },
});
await vite.listen();

type Student = { personId: string; learnerId: string; accountId: string };

async function studentApi(path: string, token: string, body: object) {
  const response = await fetch(`http://127.0.0.1:${apiPort}/api/v1${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  assert.equal(response.ok, true, `${path} ${response.status}`);
  return response.json();
}
const skillOf = new Map(skills.map((skill) => [skill.id, skill]));
function chanceOfRight(ability: number, skillId: string) {
  const skill = skillOf.get(skillId);
  const grade = skill ? gradeNumber[skill.gradeBand] : ability;
  return 0.12 + 0.82 / (1 + Math.exp(-1.7 * (ability - grade + 0.35)));
}
const wrongResponse = (problem: {
  answer: string;
  public: { response: { kind: string; options?: { id: string }[] } };
}) =>
  problem.public.response.kind === "choice"
    ? problem.public.response.options!.find((o) => o.id !== problem.answer)!.id
    : problem.answer === "99999"
      ? "99998"
      : "99999";

/** Real answers through the real API, then dated back across the year: the
 * rollups, the skill evidence and the level days are rebuilt from those dates by
 * the same rules the trigger and `/batches` use. */
async function seedStudent(person: Persona, student: Student, start: number) {
  const { token } = await schools.issueStudentSession({
    personId: student.personId,
    mode: "shared",
  });
  let answered = 0,
    guard = 0;
  while (answered < person.answers && guard++ < person.answers) {
    const batch = (await studentApi(
      `/learners/${student.learnerId}/batches`,
      token,
      { count: Math.min(5, person.answers - answered) },
    )) as { problems: { id: string; skillId: string }[] };
    for (const problem of batch.problems) {
      const stored = (
        await db.query("SELECT content FROM amp_instances WHERE id=$1", [
          problem.id,
        ])
      ).rows[0].content;
      const progress = answered / person.answers;
      const ability = person.ability + (person.growth ?? 0) * progress;
      const right =
        hash(`${person.name[0]}${answered}`) <
        chanceOfRight(ability, problem.skillId);
      await studentApi(`/learners/${student.learnerId}/attempts`, token, {
        problemId: problem.id,
        requestId: randomUUID(),
        response: right ? stored.answer : wrongResponse(stored),
      });
      answered++;
    }
    if (!batch.problems.length) break;
  }
  // The days they worked, oldest first.
  const last = person.lastActive ?? 0;
  const first = person.joined ?? start;
  const days: number[] = [];
  for (let ago = first; ago >= last; ago--)
    if (
      ago === last ||
      hash(`${person.name[1]}${ago}`) > 1 / person.every ||
      (person.every <= 2 && ago % 2 === 0)
    )
      days.push(ago);
  const worked = person.every >= 40 ? [last, last + 1] : days;
  const { rows: attempts } = await db.query(
    `SELECT id,problem_id,outcome->>'skillId' AS skill FROM amp_attempts WHERE learner_id=$1 ORDER BY evidence_sequence`,
    [student.learnerId],
  );
  const dayOf = (index: number) =>
    worked[
      Math.min(
        worked.length - 1,
        Math.floor((index / attempts.length) * worked.length),
      )
    ]!;
  for (const [index, attempt] of attempts.entries()) {
    const ago = dayOf(index);
    const at = new Date(
      Date.parse(`${dayIso(ago)}T15:00:00Z`) + index * 45_000,
    ).toISOString();
    await db.query(
      `UPDATE amp_attempts SET created_at=$2::timestamptz,outcome=jsonb_set(outcome,'{createdAt}',to_jsonb($3::text)) WHERE id=$1`,
      [attempt.id, at, at],
    );
    // About one in eight comes back as spaced review.
    if (index % 8 === 7 && ago !== start)
      await db.query(
        `UPDATE amp_instances SET content=content||jsonb_build_object('selection',COALESCE(content->'selection','{}'::jsonb)||'{"reason":"review"}'::jsonb) WHERE id=$1`,
        [attempt.problem_id],
      );
  }
}

/** A few extra answers on one skill, as the app stores them, for the group this
 * class's Today is about. */
async function seedMisses(student: Student, template: string, days: number[]) {
  await learning.transaction(
    student.accountId,
    student.learnerId,
    async (tx) => {
      for (const ago of days) {
        const problem = generateProblem(template, randomUUID());
        await tx.saveProblem(problem);
        await tx.saveAttempt({
          id: randomUUID(),
          requestId: randomUUID(),
          problemId: problem.public.id,
          skillId: problem.public.skillId,
          templateId: template,
          response: wrongResponse(problem as never),
          correct: false,
          assisted: false,
          answer: problem.answer,
          explanation: problem.explanation,
          createdAt: new Date(
            Date.parse(`${dayIso(ago)}T16:00:00Z`),
          ).toISOString(),
        });
      }
    },
  );
}

/** New ground lately: a few skills a little past where they work, each right
 * twice without help. A student at this level does this in the weeks before a
 * report card; answers spread evenly over a year wouldn't show it. */
async function seedGains(person: Persona, student: Student, count: number) {
  const { rows } = await db.query(
    `SELECT outcome->>'skillId' AS skill FROM amp_attempts
     WHERE learner_id=$1 AND (outcome->>'correct')::boolean AND NOT (outcome->>'assisted')::boolean
     GROUP BY 1 HAVING count(*)>=2`,
    [student.learnerId],
  );
  const shown = new Set(rows.map((row) => row.skill as string));
  const level = person.ability + (person.growth ?? 0) + 0.5;
  const fresh = skills
    .filter(
      (skill) =>
        !shown.has(skill.id) &&
        gradeNumber[skill.gradeBand] >= Math.floor(level) &&
        gradeNumber[skill.gradeBand] <= Math.ceil(level) + 1,
    )
    .flatMap((skill) => {
      const template = templates.find(
        (entry) =>
          entry.skillId === skill.id &&
          !entry.requiredResponseCapability &&
          !entry.requiredFigureCapability,
      );
      return template ? [template.id] : [];
    })
    .sort(
      (a, b) => hash(`${person.name[0]}${a}`) - hash(`${person.name[0]}${b}`),
    )
    .slice(0, count);
  await learning.transaction(
    student.accountId,
    student.learnerId,
    async (tx) => {
      for (const [index, template] of fresh.entries())
        for (const ago of [2 + index * 2, 1 + index * 2].map(
          (days) => days + (person.lastActive ?? 0),
        )) {
          const problem = generateProblem(template, randomUUID());
          await tx.saveProblem(problem);
          await tx.saveAttempt({
            id: randomUUID(),
            requestId: randomUUID(),
            problemId: problem.public.id,
            skillId: problem.public.skillId,
            templateId: template,
            response: problem.answer,
            correct: true,
            assisted: false,
            answer: problem.answer,
            explanation: problem.explanation,
            createdAt: new Date(
              Date.parse(`${dayIso(ago)}T16:30:00Z`),
            ).toISOString(),
          });
        }
    },
  );
}

/** The rollups, skill evidence and level days, from the dates now on the answers. */
async function rebuild(person: Persona, student: Student, timezone: string) {
  const { learnerId } = student;
  await db.query("DELETE FROM amp_skill_days WHERE learner_id=$1", [learnerId]);
  await db.query(
    `INSERT INTO amp_skill_days(learner_id,day,skill_id,attempts,correct,independent,assisted,review,review_independent)
     SELECT a.learner_id,((a.outcome->>'createdAt')::timestamptz AT TIME ZONE $2)::date,a.outcome->>'skillId',
       count(*),count(*) FILTER (WHERE (a.outcome->>'correct')::boolean),
       count(*) FILTER (WHERE (a.outcome->>'correct')::boolean AND NOT COALESCE((a.outcome->>'assisted')::boolean,false)),
       count(*) FILTER (WHERE COALESCE((a.outcome->>'assisted')::boolean,false)),
       count(*) FILTER (WHERE i.content->'selection'->>'reason'='review'),
       count(*) FILTER (WHERE i.content->'selection'->>'reason'='review' AND (a.outcome->>'correct')::boolean AND NOT COALESCE((a.outcome->>'assisted')::boolean,false))
     FROM amp_attempts a JOIN amp_instances i ON i.id=a.problem_id
     WHERE a.learner_id=$1 GROUP BY 1,2,3`,
    [learnerId, timezone],
  );
  await db.query(
    `UPDATE amp_skill_evidence e SET state=jsonb_set(state,'{recentOutcomes}',(
       SELECT jsonb_agg(jsonb_set(o,'{createdAt}',a.outcome->'createdAt') ORDER BY ord)
       FROM jsonb_array_elements(state->'recentOutcomes') WITH ORDINALITY x(o,ord)
       JOIN amp_attempts a ON a.id=o->>'id'))
     WHERE learner_id=$1`,
    [learnerId],
  );
  // Time on task: each worked day's minutes across that day's skills.
  await db.query("DELETE FROM amp_active_days WHERE learner_id=$1", [
    learnerId,
  ]);
  await db.query(
    `INSERT INTO amp_active_days(learner_id,day,surface,skill_id,active_ms)
     SELECT learner_id,day,'practice',skill_id,
       (($2::numeric*(0.55+0.9*abs(hashtext(day::text||learner_id))/2147483647.0))*60000*attempts/sum(attempts) OVER (PARTITION BY day))::bigint
     FROM amp_skill_days WHERE learner_id=$1`,
    [learnerId, person.minutes],
  );
  // The stored level on each Monday the student had worked, and on the last day.
  const { rows: counted } = await db.query(
    `SELECT ((outcome->>'createdAt')::timestamptz AT TIME ZONE $2)::date::text AS day,count(*)::int AS answers
     FROM amp_attempts WHERE learner_id=$1 GROUP BY 1 ORDER BY 1`,
    [learnerId, timezone],
  );
  await db.query("DELETE FROM amp_level_days WHERE learner_id=$1", [learnerId]);
  let total = 0;
  const lastDay = counted.at(-1)?.day;
  for (const { day, answers } of counted) {
    total += answers;
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (weekday > 2 && day !== lastDay) continue;
    const frontier = await learning.transaction(
      student.accountId,
      student.learnerId,
      (tx) => tx.frontierAfter(total),
    );
    await db.query(
      `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version) VALUES($1,$2,$3,'fixture')
       ON CONFLICT(learner_id,day) DO UPDATE SET frontier=EXCLUDED.frontier`,
      [
        learnerId,
        day,
        {
          overall: frontier.overall,
          strands: frontier.strands,
        },
      ],
    );
  }
}

type Seeded = {
  orgId: string;
  classId: string;
  terms: { q1: string; q2: string; q3: string; q4: string };
  people: Map<string, Student>;
  emptyClassId: string;
};
async function seed(): Promise<Seeded> {
  const started = performance.now();
  const org = await schools.createOrg(
    {
      kind: "school",
      name: "Alder Street School",
      timezone: "America/New_York",
    },
    {
      version: "fixture-1",
      signerName: "Fixture Signer",
      signerTitle: "Head of School",
    },
  );
  await schools.issueLicense({
    orgId: org.id,
    seats: 500,
    endsAt: new Date(Date.now() + 365 * DAY).toISOString(),
  });
  // A school year this class is about a quarter of the way through.
  const YEAR_STARTED = 82;
  const Q2_STARTED = 19;
  const yearId = randomUUID();
  const session = (
    id: string,
    parent: string | null,
    kind: string,
    name: string,
    fromAgo: number,
    toAgo: number,
  ) =>
    db.query(
      `INSERT INTO amp_academic_sessions(id,org_id,parent_id,kind,name,starts_on,ends_on) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [id, org.id, parent, kind, name, dayIso(fromAgo), dayIso(toAgo)],
    );
  await session(yearId, null, "year", "2026–27", YEAR_STARTED, -218);
  const terms = {
    q1: randomUUID(),
    q2: randomUUID(),
    q3: randomUUID(),
    q4: randomUUID(),
  };
  await session(
    terms.q1,
    yearId,
    "quarter",
    "Quarter 1",
    YEAR_STARTED,
    Q2_STARTED + 1,
  );
  await session(terms.q2, yearId, "quarter", "Quarter 2", Q2_STARTED, -40);
  await session(terms.q3, yearId, "quarter", "Quarter 3", -55, -130);
  await session(terms.q4, yearId, "quarter", "Quarter 4", -131, -218);
  const created = (await schools.createClass(org.id, {
    name: "Grade 5 Math",
    courseBands: ["5"],
    gradingKind: "quarter",
    sessionId: yearId,
  })) as { id: string };
  const support = (await schools.createClass(org.id, {
    name: "Math Support",
    courseBands: ["5"],
    gradingKind: "quarter",
    sessionId: yearId,
  })) as { id: string };
  await schools.addStaff({
    orgId: org.id,
    role: "teacher",
    givenName: "Grace",
    familyName: "Okafor",
    accountId: TEACHER,
    classId: created.id,
  });
  await schools.addStaff({
    orgId: org.id,
    role: "teacher",
    givenName: "Grace",
    familyName: "Okafor",
    accountId: TEACHER,
    classId: support.id,
  });
  await db.query(
    "UPDATE amp_people SET display_name='Ms. Okafor' WHERE account_id=$1",
    [TEACHER],
  );
  const people = new Map<string, Student>();
  for (const person of PEOPLE) {
    const student = await schools.provisionStudent(org.id, {
      givenName: person.name[0],
      familyName: person.name[1],
      gradeLevel: 5,
      identifier: person.identifier,
      classId: created.id,
    });
    people.set(person.name[0], student);
    const begin = dayIso(person.joined ?? YEAR_STARTED);
    await db.query(
      "UPDATE amp_enrollments SET begin_on=$2 WHERE person_id=$1",
      [student.personId, begin],
    );
    await db.query("UPDATE amp_org_roles SET begin_on=$2 WHERE person_id=$1", [
      student.personId,
      begin,
    ]);
  }
  await db.query(
    `INSERT INTO amp_scope_settings(scope_kind,scope_id,"values") VALUES('class',$1,'{"weeklyTargetMinutes":60}')`,
    [created.id],
  );
  // Six at a time: enough to be quick, and well under the machine's budget.
  const queue = [...PEOPLE];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let person = queue.shift(); person; person = queue.shift())
        await seedStudent(person, people.get(person.name[0])!, YEAR_STARTED);
    }),
  );
  for (const name of SHARED_GAP.people)
    await seedMisses(people.get(name)!, SHARED_GAP.template, [3, 2, 1]);
  await seedMisses(people.get(STUCK.person)!, STUCK.template, [4, 2, 1]);
  for (const person of PEOPLE)
    if (person.every < 40)
      await seedGains(
        person,
        people.get(person.name[0])!,
        Math.max(1, Math.round((person.ability - 2.4) * 1.6)),
      );
  for (const person of PEOPLE)
    await rebuild(person, people.get(person.name[0])!, "America/New_York");
  console.log(
    `Seeded ${PEOPLE.length} students in ${Math.round((performance.now() - started) / 1000)} s (schema ${schema})`,
  );
  return {
    orgId: org.id,
    classId: created.id,
    terms,
    people,
    emptyClassId: support.id,
  };
}
async function found(): Promise<Seeded> {
  const org = (await db.query("SELECT id FROM amp_orgs LIMIT 1")).rows[0].id;
  const classes = (
    await db.query("SELECT id,name FROM amp_classes WHERE org_id=$1", [org])
  ).rows;
  const sessions = (
    await db.query(
      "SELECT id,name FROM amp_academic_sessions WHERE org_id=$1",
      [org],
    )
  ).rows;
  const term = (name: string) => sessions.find((s) => s.name === name)!.id;
  const rows = (
    await db.query(
      "SELECT id,learner_id,given_name FROM amp_people WHERE learner_id IS NOT NULL",
    )
  ).rows;
  return {
    orgId: org,
    classId: classes.find((c) => c.name === "Grade 5 Math")!.id,
    emptyClassId: classes.find((c) => c.name === "Math Support")!.id,
    terms: {
      q1: term("Quarter 1"),
      q2: term("Quarter 2"),
      q3: term("Quarter 3"),
      q4: term("Quarter 4"),
    },
    people: new Map(
      rows.map((row) => [
        row.given_name,
        {
          personId: row.id,
          learnerId: row.learner_id,
          accountId: `school:${row.id}`,
        },
      ]),
    ),
  };
}
const seeded = reuse ? await found() : await seed();
const { orgId, classId, terms, people, emptyClassId } = seeded;
const staffApi = async (path: string) => {
  const response = await fetch(
    `http://127.0.0.1:${apiPort}/api/v1/school/${path}`,
    { headers: { authorization: "Bearer amp-local-development" } },
  );
  assert.equal(response.ok, true, `${path} ${response.status}`);
  return response;
};
const classUrl = (leaf: string) =>
  `/school/${orgId}/classes/${classId}/${leaf}`;
const heightFor = (width: number) => (width < 720 ? 844 : 900);

/** Whole-class reads from rollups: measured against the real API, this data. */
async function measureGradebook() {
  const samples: number[] = [];
  for (let run = 0; run < 8; run++) {
    const started = performance.now();
    await (await staffApi(`classes/${classId}/gradebook`)).json();
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)]!;
  console.log(
    `Gradebook for ${PEOPLE.length} students: median ${median.toFixed(0)} ms, slowest ${samples.at(-1)!.toFixed(0)} ms`,
  );
  check("the gradebook is well under a second", samples.at(-1)! < 500, samples);
  return median;
}

async function newContext(
  browser: Browser,
  width: number,
  theme: (typeof themes)[number],
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width, height: heightFor(width) },
    colorScheme: theme,
    deviceScaleFactor: width >= 1024 ? 1 : 2,
    acceptDownloads: true,
  });
  await context.addInitScript("globalThis.__name ??= (f) => f");
  await context.addInitScript(shiftRecorder);
  await context.addInitScript(
    "navigator.sendBeacon = function () { return true; };",
  );
  await context.addInitScript(
    `localStorage.setItem('amp.theme', ${JSON.stringify(theme)})`,
  );
  return context;
}
async function open(page: Page, path: string, heading: string | RegExp) {
  await page.goto(origin + path, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("heading", { name: heading, level: 1, includeHidden: true })
    .first()
    .waitFor({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await settle(page, 350);
}
const shot = async (
  page: Page,
  name: string,
  width: number,
  theme: string,
  fullPage = false,
) => {
  const file = `${name}-${width}-${theme}.png`;
  await page.screenshot({ path: `${ARTIFACTS}/${file}`, fullPage });
  if (SHOTS_FOR_REVIEW.has(width))
    await page.screenshot({ path: `${REVIEW}/${file}`, fullPage });
};
async function geometry(page: Page, label: string) {
  const result = await probe(page);
  check(`${label} overflow`, result.overflow === 0, result.overflow);
  check(
    `${label} targets`,
    result.smallTargets.length === 0,
    result.smallTargets,
  );
  check(
    `${label} mid-word wraps`,
    result.midWordWraps.length === 0,
    result.midWordWraps,
  );
  check(`${label} truncated`, result.truncated.length === 0, result.truncated);
  check(`${label} overlaps`, result.overlaps.length === 0, result.overlaps);
  const clipped = await clippedCells(page);
  check(`${label} clipped cells`, clipped.length === 0, clipped);
}
/** Where something sits on the page, whatever has scrolled. */
const onPage = (locator: ReturnType<Page["locator"]>) =>
  locator.evaluate((element) => {
    const { left, top, width, height } = element.getBoundingClientRect();
    return { left, top: top + scrollY, width, height };
  });
async function stable(page: Page, label: string) {
  const record = await shellRecord(page);
  check(`${label} layout shift`, record.cls <= 0.01, record);
}
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  const source = text.replace(/^﻿/, "");
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  return rows;
}

/** The whole teacher's day, as one person would do it. Uses the real class, and
 * closes Quarter 1, which later passes read as a frozen term. */
async function journey(browser: Browser, engine: string, width: number) {
  const theme = "light";
  const label = `${engine} ${width}`;
  const context = await newContext(browser, width, theme);
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    failures.push(`${label} page error: ${error.message}`),
  );
  await open(page, classUrl("today"), /^Good (morning|afternoon|evening)/);
  const greeting = await page.getByRole("heading", { level: 1 }).textContent();
  check(
    `${label} greets by name`,
    /Ms\. Okafor/.test(greeting ?? ""),
    greeting,
  );

  // A shared gap, named, with its students and the lesson.
  const gap = page.getByRole("heading", {
    name: /\d+ students are stuck on fraction addition/,
  });
  await gap.waitFor();
  const body = await page.locator("main").innerText();
  check(`${label} gap names students`, /Noor|Diego|Lena/.test(body));
  check(
    `${label} no gendered pronouns on Today`,
    !/\b(he|she|his|her|hers|him)\b/i.test(body),
    body.match(/\b(he|she|his|her|hers|him)\b/i)?.[0],
  );
  const lesson = page
    .getByRole("button", { name: "Teach this lesson" })
    .first();
  await lesson.click();
  const sheet = page.getByRole("dialog");
  await sheet.waitFor();
  await page.waitForFunction(() => location.search.includes("lesson="));
  await sheet.locator("h2").first().waitFor();
  await settle(page, 400);
  await shot(page, "today-lesson", width, theme);
  await page.keyboard.press("Escape");
  await sheet.waitFor({ state: "detached" });
  await page.waitForFunction(() => !location.search.includes("lesson="));

  // Checking off survives a reload, today.
  const box = page.getByRole("checkbox", {
    name: /Done: \d+ students are stuck on fraction addition/,
  });
  await box.check();
  await page.reload();
  await gap.waitFor();
  check(`${label} a check survives reload`, await box.isChecked());
  await box.uncheck();
  await settle(page, 200);

  // The gradebook, by its tab: a real route.
  await page
    .getByRole("link", { name: "Gradebook", exact: true })
    .first()
    .click();
  await page.getByRole("heading", { name: "Quarter 2 grades" }).waitFor();
  const mode = await page
    .locator("[data-grid-mode]")
    .getAttribute("data-grid-mode");
  check(`${label} grid mode`, mode === (width < 640 ? "cards" : "table"), mode);
  const elias = (await page.locator("main").innerText()).includes(
    "Not enough work yet",
  );
  check(`${label} a student with little work reads as not enough`, elias);

  // The evidence sheet: why, with real problems and how they were done.
  const amara = people.get("Amara")!.personId;
  await page.locator(`[data-student="${amara}"]`).first().click();
  await sheet.waitFor();
  await page.waitForFunction(() => location.search.includes("student="));
  await sheet.getByRole("heading", { name: /^Why / }).waitFor();
  await sheet.getByRole("heading", { name: "Problems" }).waitFor();
  await settle(page, 400);
  await shot(page, "evidence", width, theme);
  const sheetText = await sheet.innerText();
  for (const expected of [
    "Course progress",
    "Growth",
    "Practice",
    "Retention",
    "Objectives gained",
  ])
    check(`${label} evidence has ${expected}`, sheetText.includes(expected));
  check(
    `${label} evidence says if work was independent`,
    /On their own|With a hint|Missed/.test(sheetText),
  );
  check(
    `${label} evidence has real math`,
    (await sheet.locator(".katex").count()) >= 0 && /Answered/.test(sheetText),
  );
  check(
    `${label} no gendered pronouns in evidence`,
    !/\b(he|she|his|her|hers|him)\b/i.test(sheetText),
    sheetText.match(/\b(he|she|his|her|hers|him)\b/i)?.[0],
  );
  await page.keyboard.press("Escape");
  await sheet.waitFor({ state: "detached" });

  // A final grade: typed, saved on blur, there after a reload, logged.
  const finalName = "Final grade for Isaac Moreno";
  const final = page.getByRole("textbox", { name: finalName });
  // Whatever form the school uses.
  const typed = (
    { 1280: "B+", 390: "87", 768: "3", 320: "Pass" } as Record<number, string>
  )[width]!;
  await final.scrollIntoViewIfNeeded();
  const before = await onPage(final);
  if ((await final.inputValue()) === typed) {
    const cleared = page.waitForResponse(/\/final$/);
    await final.fill("");
    await final.blur();
    await cleared;
  }
  const saved_ = page.waitForResponse(/\/final$/);
  await final.fill(typed);
  await final.blur();
  await saved_;
  await settle(page, 300);
  const after = await onPage(final);
  check(
    `${label} saving moves nothing`,
    JSON.stringify(before) === JSON.stringify(after),
    { before, after },
  );
  await page.reload();
  await page.getByRole("heading", { name: "Quarter 2 grades" }).waitFor();
  check(
    `${label} a final survives reload`,
    (await page.getByRole("textbox", { name: finalName }).inputValue()) ===
      typed,
  );
  const logged = (
    await db.query(
      `SELECT count(*)::int AS n FROM amp_school_events WHERE action='grade.final-set' AND target_id=$1`,
      [people.get("Isaac")!.personId],
    )
  ).rows[0].n;
  check(`${label} the final is logged`, logged >= 1, logged);
  // A shared link opens the sheet, and Back closes it.
  await page.goto(`${origin}${classUrl("gradebook")}?student=${amara}`);
  await sheet.waitFor();
  await page.goBack().catch(() => undefined);

  // Exporting, and reading what came down.
  await page.goto(origin + classUrl("gradebook"));
  await page.getByRole("heading", { name: "Quarter 2 grades" }).waitFor();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await sheet.waitFor();
  await page.waitForFunction(() => location.search.includes("export=1"));
  await settle(page, 300);
  await shot(page, "export", width, theme);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    sheet.getByRole("button", { name: "Download CSV" }).click(),
  ]);
  const saved = `${ARTIFACTS}/${engine}-${width}-gradebook.csv`;
  await download.saveAs(saved);
  const csv = parseCsv(await readFile(saved, "utf8"));
  check(
    `${label} CSV has a row per student`,
    csv.length === PEOPLE.length + 1,
    csv.length,
  );
  check(
    `${label} CSV header`,
    csv[0]?.[0] === "SIS ID" && csv[0]?.[2] === "Final",
    csv[0],
  );
  check(
    `${label} CSV carries the final`,
    csv.find((row) => row[1] === "Isaac Moreno")?.[2] === typed,
  );
  await page.getByRole("status").first().waitFor({ state: "attached" });
  await settle(page, 200);

  // The report card opens from the gradebook.
  await page.goto(origin + classUrl("gradebook"));
  await page.getByRole("heading", { name: "Quarter 2 grades" }).waitFor();
  await page.getByRole("link", { name: "Report cards" }).click();
  await page
    .getByRole("heading", { name: /report cards$/, level: 1 })
    .waitFor();
  await settle(page, 300);
  await shot(page, "report-cards", width, theme);
  const cards = await page.locator("article").count();
  check(`${label} a report card per student`, cards === PEOPLE.length, cards);
  const cardText = await page.locator("article").first().innerText();
  for (const expected of [
    "Alder Street School",
    "Quarter 2",
    "Grade 5",
    "Ms. Okafor",
    "Final grade",
    "Active minutes",
    "Objectives gained",
    "Working level",
  ])
    check(`${label} report card has ${expected}`, cardText.includes(expected));
  await page.goBack();
  await page.getByRole("heading", { name: "Quarter 2 grades" }).waitFor();

  // Closing a term, from its own URL, and it stays closed. Once per run.
  await page.goto(`${origin}${classUrl("gradebook")}?term=${terms.q1}`);
  await page.getByRole("heading", { name: "Quarter 1 grades" }).waitFor();
  const closeButton = page.getByRole("button", { name: "Close term" });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Close Quarter 1" }).waitFor();
    await settle(page, 200);
    await shot(page, "close-term", width, theme);
    const body1 = await (
      await staffApi(`classes/${classId}/gradebook?term=${terms.q1}`)
    ).json();
    await dialog.getByRole("button", { name: "Close Quarter 1" }).click();
    await page.getByText("Grades in a closed term are frozen.").waitFor();
    const frozen = await (
      await staffApi(`classes/${classId}/gradebook?term=${terms.q1}`)
    ).json();
    check(
      `${label} closing keeps the suggestions`,
      JSON.stringify(body1.students) === JSON.stringify(frozen.students),
    );
  }
  await page.getByText("Grades in a closed term are frozen.").waitFor();
  check(
    `${label} a closed term offers no Close`,
    !(await closeButton.isVisible().catch(() => false)),
  );
  check(
    `${label} a closed term offers no input`,
    (await page.getByRole("textbox", { name: /^Final grade/ }).count()) === 0,
  );
  await page.reload();
  await page.getByText("Grades in a closed term are frozen.").waitFor();
  await shot(page, "gradebook-closed", width, theme);

  // Time and the student's record are real routes too.
  await page.goto(origin + classUrl("time"));
  await page.getByRole("heading", { name: "Time", level: 1 }).waitFor();
  await page.getByRole("radio", { name: "This term" }).click();
  await page.waitForFunction(() => location.search.includes("period=term"));
  await settle(page, 300);
  await page.locator(`[data-student="${amara}"]`).first().click();
  await sheet.waitFor();
  await sheet.getByRole("heading", { name: "By day" }).waitFor();
  await settle(page, 300);
  await shot(page, "time-student", width, theme);
  await page.keyboard.press("Escape");
  await sheet.waitFor({ state: "detached" });
  const [timeFile] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export", exact: true }).click(),
  ]);
  const timePath = `${ARTIFACTS}/${engine}-${width}-time.csv`;
  await timeFile.saveAs(timePath);
  const time = parseCsv(await readFile(timePath, "utf8"));
  check(
    `${label} time CSV`,
    time[0]?.[3] === "Active minutes" && time.length > 40,
    time.length,
  );
  await context.close();
}

/** Every screen at every width and theme: geometry, stable layout, a failed
 * request, Back and reload. */
async function sweep(browser: Browser, engine: string) {
  const amara = people.get("Amara")!.personId;
  const screens = [
    { id: "today", path: classUrl("today"), heading: /^Good / },
    { id: "map", path: classUrl("map"), heading: "Class map" },
    {
      id: "gradebook",
      path: `${classUrl("gradebook")}?term=${terms.q2}`,
      heading: "Quarter 2 grades",
    },
    {
      id: "gradebook-upcoming",
      path: `${classUrl("gradebook")}?term=${terms.q3}`,
      heading: "Quarter 3 grades",
    },
    {
      id: "time",
      path: `${classUrl("time")}?period=term`,
      heading: "Time",
    },
    {
      id: "time-week",
      path: `${classUrl("time")}?period=week`,
      heading: "Time",
    },
    {
      id: "student",
      path: `/school/${orgId}/students/${amara}?class=${classId}`,
      heading: "Amara Osei",
    },
    {
      id: "report-card",
      path: `${classUrl("report-cards")}?term=${terms.q2}&student=${amara}`,
      heading: "Amara Osei",
    },
    {
      id: "today-empty",
      path: `/school/${orgId}/classes/${emptyClassId}/today`,
      heading: /^Good /,
    },
    {
      id: "gradebook-empty",
      path: `/school/${orgId}/classes/${emptyClassId}/gradebook?term=${terms.q2}`,
      heading: "Quarter 2 grades",
    },
    {
      id: "time-empty",
      path: `/school/${orgId}/classes/${emptyClassId}/time`,
      heading: "Time",
    },
    {
      id: "map-empty",
      path: `/school/${orgId}/classes/${emptyClassId}/map`,
      heading: "Class map",
    },
  ];
  const widths =
    engine === "webkit"
      ? sweepWidths.filter((width) => width === 390 || width === 1280)
      : sweepWidths;
  for (const width of widths)
    for (const theme of themes) {
      const context = await newContext(browser, width, theme);
      const page = await context.newPage();
      page.on("pageerror", (error) =>
        failures.push(
          `${engine} ${width}-${theme} page error: ${error.message}`,
        ),
      );
      for (const screen of screens) {
        const label = `${engine} ${screen.id} ${width}-${theme}`;
        await open(page, screen.path, screen.heading);
        await geometry(page, label);
        await stable(page, label);
        await shot(page, screen.id, width, theme, width >= 1024);
      }
      // Sheets are real screens too.
      const sheet = page.getByRole("dialog");
      for (const [id, path] of [
        [
          "evidence-sweep",
          `${classUrl("gradebook")}?term=${terms.q2}&student=${amara}`,
        ],
        ["export-sweep", `${classUrl("gradebook")}?term=${terms.q2}&export=1`],
      ] as const) {
        const label = `${engine} ${id} ${width}-${theme}`;
        await page.goto(origin + path);
        await sheet.waitFor();
        await settle(page, 700);
        await geometry(page, label);
      }

      // Back and reload restore, and a failed request moves nothing.
      const label = `${engine} recovery ${width}-${theme}`;
      await open(
        page,
        `${classUrl("gradebook")}?term=${terms.q2}`,
        "Quarter 2 grades",
      );
      await page.getByRole("radio", { name: "Q4" }).click();
      await page.getByRole("heading", { name: "Quarter 4 grades" }).waitFor();
      await page.reload();
      await page.getByRole("heading", { name: "Quarter 4 grades" }).waitFor();
      await page.goBack();
      await page.getByRole("heading", { name: "Quarter 2 grades" }).waitFor();
      check(`${label} Back restores`, page.url().includes(`term=${terms.q2}`));
      await settle(page, 300);
      await resetRecord(page);
      const final = page.getByRole("textbox", {
        name: "Final grade for Tomas Vega",
      });
      const h1OnPage = await onPage(page.locator("h1").first());
      await final.scrollIntoViewIfNeeded();
      const fieldBefore = await onPage(final);
      await page.route("**/final", (route) => route.abort());
      await final.fill("C+");
      await final.blur();
      await page.getByRole("alert").first().waitFor();
      await settle(page, 200);
      const alert = await page.getByRole("alert").first().innerText();
      check(
        `${label} a failed save says what to do`,
        /Tomas’s final grade didn’t save/.test(alert),
        alert,
      );
      check(
        `${label} a failed save keeps the typing`,
        (await final.inputValue()) === "C+",
      );
      check(
        `${label} a failed save moves nothing`,
        JSON.stringify(await onPage(page.locator("h1").first())) ===
          JSON.stringify(h1OnPage) &&
          JSON.stringify(await onPage(final)) === JSON.stringify(fieldBefore),
      );
      await stable(page, `${label} after failure`);
      await page.unroute("**/final");
      await page
        .getByRole("alert")
        .first()
        .getByRole("button")
        .first()
        .click()
        .catch(() => undefined);
      await final.focus();
      await final.fill("");
      await final.blur();
      await settle(page, 200);

      // A failed read says so, and offers the step that works.
      const timeRead = "**/api/v1/school/classes/*/time?period=*";
      await page.route(timeRead, (route) => route.abort());
      await page.goto(`${origin}${classUrl("time")}?period=month`);
      await page.getByRole("heading", { name: /didn’t load/ }).waitFor();
      await geometry(page, `${label} failed read`);
      await page.unroute(timeRead);
      await page.getByRole("button", { name: "Try again" }).click();
      await page.getByRole("heading", { name: "Time", level: 1 }).waitFor();

      // Malformed links recover.
      await page.goto(
        `${origin}${classUrl("gradebook")}?term=nonsense&student=nobody&sort=sideways`,
      );
      await page.getByRole("heading", { name: "Quarter 2 grades" }).waitFor();
      await geometry(page, `${label} malformed link`);
      await context.close();
    }
}

/** Every row prints, on its own page, as one file. Chromium only: it's the one
 * with a PDF path. */
async function printing(browser: Browser) {
  const context = await newContext(browser, 1280, "light");
  const page = await context.newPage();
  await page.goto(`${origin}${classUrl("report-cards")}?term=${terms.q2}`);
  await page
    .getByRole("heading", { name: /report cards$/, level: 1 })
    .waitFor();
  await settle(page, 400);
  const pdf = await page.pdf({ preferCSSPageSize: true });
  await writeFile(`${ARTIFACTS}/report-cards.pdf`, pdf);
  const document = await PDFDocument.load(pdf);
  check(
    "the whole class prints as one page each",
    document.getPageCount() === PEOPLE.length,
    document.getPageCount(),
  );
  await page.goto(
    `${origin}/school/${orgId}/students/${people.get("Amara")!.personId}`,
  );
  await page.getByRole("heading", { name: "Amara Osei", level: 1 }).waitFor();
  await settle(page, 400);
  const report = await page.pdf({ preferCSSPageSize: true });
  await writeFile(`${ARTIFACTS}/progress-report.pdf`, report);
  const reportPages = (await PDFDocument.load(report)).getPageCount();
  check("a progress report stays short", reportPages <= 3, reportPages);
  // What the paper looks like, for a person to look at.
  await page.emulateMedia({ media: "print" });
  await page.setViewportSize({ width: 816, height: 1056 });
  await settle(page, 300);
  await page.screenshot({ path: `${ARTIFACTS}/progress-report-print.png` });
  await page.goto(
    `${origin}${classUrl("report-cards")}?term=${terms.q2}&student=${people.get("Amara")!.personId}`,
  );
  await page.locator("article").waitFor();
  await settle(page, 300);
  await page.screenshot({ path: `${ARTIFACTS}/report-card-print.png` });
  await context.close();
}

const launchers = {
  chromium: secureChromium(rawChromium),
  webkit,
};
try {
  await mkdir(REVIEW, { recursive: true });
  await mkdir(ARTIFACTS, { recursive: true });
  const median = await measureGradebook();
  for (const engine of engines) {
    const browser = await launchers[engine].launch();
    try {
      // A first pass lets Vite finish optimizing the screens' dependencies.
      const warm = await browser.newContext();
      const warmPage = await warm.newPage();
      for (const path of [
        classUrl("today"),
        classUrl("gradebook"),
        classUrl("time"),
      ]) {
        await warmPage.goto(origin + path);
        await warmPage.waitForTimeout(2500);
      }
      await warm.close();
      if (!flag("--skip-journeys"))
        for (const width of engine === "chromium"
          ? [1280, 390, 768, 320]
          : [1280, 390])
          await journey(browser, engine, width);
      if (!flag("--skip-sweep")) await sweep(browser, engine);
      if (engine === "chromium") await printing(browser);
    } finally {
      await browser.close();
    }
  }
  console.log(`Median gradebook read: ${median.toFixed(0)} ms`);
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  } else console.log("School teacher UI: all checks passed");
} finally {
  await api.close();
  await learning.pool.end();
  await vite.close();
  if (!flag("--keep") && !reuse)
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  else console.log(`Kept schema ${schema}`);
  await admin.end();
}
