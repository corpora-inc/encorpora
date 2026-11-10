/**
 * A synthetic school world for demos, the launch journey and the capture rig,
 * built through the real code paths: a school issued by `school-admin`
 * create-school, its admin's invitation accepted, guided setup and the data
 * agreement through the API, a CSV roster through the real source and reconciler in
 * chunks, invitations accepted, seats from a license, and a hero class whose
 * students answer real problems through the real practice API. Older weeks for
 * everyone else are backfilled into the rollups by SQL, as the org fixture does.
 * Every name is made up.
 *
 * The server is the real API and Vite on loopback, on a throwaway schema in the
 * test database, with a loopback-only sign-in picker at `/demo` that chooses
 * who the browser is: the head, the district admin, the teacher or a student.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { Pool } from "pg";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import { registerAnalyticsRoutes } from "../src/analytics/routes";
import { registerUnavailableBilling } from "../src/billing/stripe/routes";
import { registerFamilyRoutes } from "../src/family/routes";
import { AGREEMENT_VERSION } from "../src/schools/agreement";
import { SchoolRepository } from "../src/schools/repository";
import { schoolAdmin } from "./school-admin";
import { registerSchoolRoutes } from "../src/schools/routes";
import { csvRows, guessMapping, readTable } from "../src/schools/sources/csv";
import { courseBandsFor } from "../src/schools/sources/rows";
import { ROSTER_CHUNK } from "../src/schools/setup-contracts";
import { buildApp, GLOBAL_RATE_LIMIT } from "../src/server/app";
import { developmentAuth, refuseStudentTokens } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import type { Authenticator } from "../src/server/auth";
import { localRenderer, type WorkbookRenderer } from "../src/workbook/pdf";
import { migrate } from "./migrate";
import {
  GRADE_5_CLASS,
  persona,
  seedClass,
  type ClassWorld,
  type Persona,
  type Student,
} from "./school-class-fixture";
import { mondayOf, seedTermEvidence, iso } from "./school-org-fixture";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { FAMILY_NAMES, GIVEN_NAMES } from "../src/schools/demo/names";

export const demoSizes = [30, 1000, 10000] as const;
export type DemoSize = (typeof demoSizes)[number];

/** Who the browser is. The cookie names a synthetic account; nothing else. */
export const DEMO_COOKIE = "amp_demo_as";
export const ACCOUNTS = {
  head: "demo-head",
  district: "demo-district",
  teacher: "demo-teacher",
} as const;
const LOOPBACK = ["127.0.0.1", "::1", "::ffff:127.0.0.1"];
type SchoolAdminServices = NonNullable<Parameters<typeof schoolAdmin>[3]>;
const DAY = 86_400_000;

/** Development authentication, loopback-only like `developmentAuth`, with the
 * account chosen by the picker's cookie. Forbidden in production. */
export function demoAuth(): Authenticator {
  const development = developmentAuth();
  return async (request) => {
    await development(request);
    const chosen = request.headers.cookie?.match(
      new RegExp(`(?:^|;\\s*)${DEMO_COOKIE}=(demo-[a-z0-9-]{1,40})(?:;|$)`),
    )?.[1];
    return chosen ?? ACCOUNTS.head;
  };
}

export type DemoServer = ClassWorld & {
  origin: string;
  /** Invitation keys and mail, as `school-admin` create-school takes them. */
  services: SchoolAdminServices;
  webPort: number;
  apiPort: number;
  schema: string;
  /** Invitations and requests the school would have mailed. */
  mail: { to: string; subject: string; url: string }[];
  /** What the picker offers, once the world is built. */
  setPicker(picker: Picker): void;
  /** Staff API calls as an account, the way the browser makes them. */
  as(
    account: string,
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<any>;
  close(options?: { keep?: boolean }): Promise<void>;
};

/** The real API and Vite on loopback, on a new schema in the test database. */
export async function startDemoServer(options: {
  webPort: number;
  /** Vite's dependency cache, one per script so runs don't fight. */
  cacheDir: string;
  /** Real PDFs from the local renderer unless a stand-in is given. */
  renderer?: WorkbookRenderer;
  /** A browser opening the picker is the head unless it says otherwise. */
  picker?: boolean;
}): Promise<DemoServer> {
  if (process.env.NODE_ENV === "production")
    throw new Error("The school demo never runs in production");
  const url = process.env.AMP_TEST_DATABASE_URL;
  if (!url)
    throw new Error(
      "AMP_TEST_DATABASE_URL is required: a fixture database the demo can add a throwaway schema to",
    );
  assertTestDatabaseTarget(url);
  const schema = `amp_school_demo_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  await migrate(scoped.href);
  const learning = new PostgresRepository(scoped.href);
  const db = learning.pool;
  const schools = new SchoolRepository(db);
  const authenticate = refuseStudentTokens(demoAuth());
  const origin = `http://127.0.0.1:${options.webPort}`;
  const mail: DemoServer["mail"] = [];
  const renderer = options.renderer === undefined ? localRenderer() : null;
  const api = buildApp({ repository: learning, authenticate });
  await registerFamilyRoutes(api, { pool: db, authenticate });
  const services: SchoolAdminServices = {
    secret: `synthetic-school-demo-${randomUUID()}`,
    origin,
    mail: async (to, subject, _text, link) => {
      mail.push({ to, subject, url: link });
    },
  };
  await registerSchoolRoutes(api, {
    pool: db,
    authenticate,
    services: {
      ...services,
      signIn: {
        google: "000000000000-demo.apps.googleusercontent.com",
        microsoft: "00000000-0000-4000-8000-00000000d3e0",
      },
      learning,
      renderer: options.renderer ?? renderer,
    },
  });
  await registerUnavailableBilling(api, authenticate);
  await registerAnalyticsRoutes(api, { pool: db, authenticate });
  api.get("/api/v1/auth-config", async () => ({ mode: "development" }));
  await api.listen({ host: "127.0.0.1", port: 0 });
  const apiPort = (api.server.address() as AddressInfo).port;
  let picker: Picker | null = null;
  const vite: ViteDevServer = await createServer({
    cacheDir: options.cacheDir,
    // Found late, inside the stack's worker, it would reload the page mid-print.
    optimizeDeps: { include: ["pdf-lib"] },
    plugins: options.picker === false ? [] : [pickerPlugin(() => picker)],
    server: {
      host: "127.0.0.1",
      port: options.webPort,
      strictPort: true,
      proxy: { "/api": `http://127.0.0.1:${apiPort}` },
    },
  });
  await vite.listen();
  const base = `http://127.0.0.1:${apiPort}`;
  const calls: number[] = [];
  return {
    db,
    learning,
    schools,
    services,
    api: base,
    origin,
    webPort: options.webPort,
    apiPort,
    schema,
    mail,
    setPicker: (next) => {
      picker = next;
    },
    async as(account, method, path, body) {
      // One development credential for every account: stay under its limit
      // (GLOBAL_RATE_LIMIT a minute) rather than be refused.
      for (;;) {
        const now = Date.now();
        while (calls.length && calls[0]! <= now - 60_000) calls.shift();
        if (calls.length < GLOBAL_RATE_LIMIT - 60) break;
        await new Promise((done) => setTimeout(done, calls[0]! + 60_050 - now));
      }
      calls.push(Date.now());
      const response = await fetch(`${base}/api/v1/school/${path}`, {
        method,
        headers: {
          authorization: "Bearer amp-local-development",
          cookie: `${DEMO_COOKIE}=${account}`,
          origin,
          ...(method === "POST" ? { "content-type": "application/json" } : {}),
        },
        ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
      });
      const text = await response.text();
      assert.ok(
        response.ok,
        `${method} ${path} as ${account}: ${response.status} ${text.slice(0, 200)}`,
      );
      return text ? JSON.parse(text) : null;
    },
    async close({ keep = false } = {}) {
      await vite.close();
      await api.close();
      await renderer?.close();
      await learning.pool.end();
      if (!keep) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    },
  };
}

/* The roster: names, classes and teachers for a school of any size. */

const FIRST = GIVEN_NAMES;
const LAST = FAMILY_NAMES;
const TEACHER_FAMILY =
  "Okafor Lindgren Tanaka Rivera Dube Kowalski Shah Moreau Bianchi Nguyen Larsen Castillo Oyelaran Ferreira Brennan Achterberg Baptiste Chaudhry Delacroix Engel Fontaine Gallagher Halvorsen Ibarra Jaramillo Kessler Lachance Mwangi Nakashima Okonkwo Pellegrini Quintero Rasmussen Szabo Thibodeaux Underwood Valdez Whitfield Yamada Zielinski Abernathy Bergstrom Carrasco Donnelly Eriksen Fairweather Gutierrez Hollander Iwasaki Jovanovic Kirkland Lombardi Marchetti Nordstrom Ogunleye Petrakis Quigley Rourke Sorensen Takahashi Ulrich Vasquez Wainwright Xiong Yorke Zapata Amador Blackwood Cardenas Dimitriou Esposito Fitzgerald Gonzaga Haverford Ishikawa Kaminski Lindqvist Montoya Nightingale Oliveira Prescott Ravensworth Salazar Templeton Villanueva Westbrook Yablonski Zuniga Aldana Barros Cavendish Duarte Everly Falcone Granger Hollis Ingram Jessup Kingsley Lancaster Merriweather Northcott Osterhout Palmieri Quarles Redmond Sinclair Thorne Upton Vance Whitaker Yardley Zeller".split(
    " ",
  );
const TEACHER_GIVEN =
  "Grace Daniel Aiko Lucia Thabo Marta Anjali Julien Chiara Linh Ingrid Mateo Tunde Beatriz Siobhan Pieter Esther Imran Celine Hanna Margot Fiona Erik Paloma Rocio Greta Amelie Wanjiru Ren Chidi Giulia Lorena Mads Zsofia Josette Ruth Elena Naomi Kenji Agata Hollis Astrid Pilar Maeve Lars Rosalind Gabriel Miriam Haruto Milena".split(
    " ",
  );
const gradeName = (grade: number) =>
  grade === 0 ? "Kindergarten" : `Grade ${grade}`;
const HIGH_COURSES: Record<number, string> = {
  9: "Algebra 1",
  10: "Geometry",
  11: "Algebra 2",
  12: "Precalculus",
};
const courseName = (grade: number) =>
  HIGH_COURSES[grade] ?? `${gradeName(grade)} Math`;

/** The hero class: the Grade 5 class the teacher verification proves, and six
 * more, so it is 30. */
export const HERO_CLASS: Persona[] = [
  ...GRADE_5_CLASS,
  persona("Ada", "Beck", 5.6, { minutes: 13, growth: 0.6 }),
  persona("Kofi", "Mensah", 4.9, { minutes: 12 }),
  persona("Lila", "Park", 4.6),
  persona("Omar", "Haddad", 4.2, { minutes: 9, every: 3 }),
  persona("Quinn", "Tate", 3.9),
  persona("Wren", "Holm", 4.4, { minutes: 12 }),
].map((person, index) => ({
  ...person,
  identifier: `S-${10210 + index * 37}`,
}));

type RosterLine = {
  last: string;
  first: string;
  grade: number;
  className: string;
  teacher: string;
  teacherEmail: string;
  id: string;
};
type PlannedClass = {
  name: string;
  grade: number;
  teacher: { name: string; email: string } | null;
  size: number;
  hero?: boolean;
};
type PlannedSchool = {
  name: string;
  domain: string;
  classes: PlannedClass[];
  hero?: boolean;
};

/** Sections of about `size` for each grade, with one teacher per elementary
 * class and one per five sections above that, as schools staff them. */
function planSchool(
  name: string,
  grades: readonly number[],
  sections: number,
  students: number,
  counters: { teacher: number; student: number },
  options: { hero?: boolean; untaughtEvery?: number } = {},
): PlannedSchool {
  const domain = `${name.toLowerCase().replace(/[^a-z]+/g, "")}.example`;
  const classes: PlannedClass[] = [];
  const total = grades.length * sections;
  const per = Math.floor(students / total);
  let spare = students - per * total;
  let teacher: { name: string; email: string } | null = null;
  let taught = 0;
  for (const grade of grades)
    for (let section = 0; section < sections; section++) {
      const elementary = grade <= 5;
      if (elementary || taught % 5 === 0 || !teacher) {
        const index = counters.teacher++;
        // Okafor is the hero's own name, never anyone else's.
        const family =
          TEACHER_FAMILY[1 + (index % (TEACHER_FAMILY.length - 1))]!;
        const given = TEACHER_GIVEN[(index * 7) % TEACHER_GIVEN.length]!;
        teacher = {
          name: `${given} ${family}`,
          email: `${given}.${family}`.toLowerCase() + `@${domain}`,
        };
      }
      taught++;
      const base = courseName(grade);
      const label =
        sections > 1
          ? grade >= 6
            ? `${base} · Period ${section + 1}`
            : `${base} ${String.fromCharCode(65 + section)}`
          : base;
      const extra = spare > 0 ? 1 : 0;
      spare -= extra;
      classes.push({
        name: label,
        grade,
        teacher:
          options.untaughtEvery &&
          classes.length % options.untaughtEvery === options.untaughtEvery - 1
            ? null
            : teacher,
        size: per + extra,
      });
    }
  if (options.hero) {
    // The hero is Grade 5's second section, taught by Ms. Okafor, with 30.
    const at = Math.max(
      0,
      classes.findIndex((klass) => klass.grade === 5) + (sections > 1 ? 1 : 0),
    );
    const hero = classes[at]!;
    const others = classes.filter((klass) => klass !== hero);
    const moved = HERO_CLASS.length - hero.size;
    for (let i = 0; i < Math.abs(moved); i++)
      others[i % others.length]!.size -= Math.sign(moved);
    hero.size = HERO_CLASS.length;
    hero.hero = true;
    hero.teacher = { name: "Ms. Okafor", email: `grace.okafor@${domain}` };
    // First in the file, so the hero class holds seats before anyone waits.
    classes.splice(at, 1);
    classes.unshift(hero);
  }
  return { name, domain, classes, ...(options.hero ? { hero: true } : {}) };
}

function rosterFor(
  school: PlannedSchool,
  counters: { teacher: number; student: number },
): { csv: string; lines: RosterLine[] } {
  const lines: RosterLine[] = [];
  const heroNames = new Set(HERO_CLASS.map((p) => `${p.name[0]} ${p.name[1]}`));
  for (const klass of school.classes)
    for (let seat = 0; seat < klass.size; seat++) {
      let first: string, last: string, id: string;
      if (klass.hero) {
        const person = HERO_CLASS[seat]!;
        [first, last] = person.name;
        id = person.identifier!;
      } else {
        // Skip a hero's name, so a demo never shows two of them.
        do {
          const index = counters.student++;
          first = FIRST[index % FIRST.length]!;
          last =
            LAST[(Math.floor(index / FIRST.length) + index * 7) % LAST.length]!;
          id = `S-${20000 + index}`;
        } while (heroNames.has(`${first} ${last}`));
      }
      lines.push({
        last,
        first,
        grade: klass.grade,
        className: klass.name,
        teacher: klass.teacher?.name ?? "",
        teacherEmail: klass.teacher?.email ?? "",
        id,
      });
    }
  const quote = (value: string) =>
    /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  const csv = [
    "Student ID,Last Name,First Name,Grade,Class,Teacher,Teacher Email",
    ...lines.map((line) =>
      [
        line.id,
        line.last,
        line.first,
        line.grade === 0 ? "K" : String(line.grade),
        line.className,
        line.teacher,
        line.teacherEmail,
      ]
        .map(quote)
        .join(","),
    ),
  ].join("\r\n");
  return { csv, lines };
}

/** The import screen's path, without the screen: the real source reads the
 * file and guesses the columns, then the dry run and the apply in chunks. */
async function importRoster(
  server: DemoServer,
  account: string,
  orgId: string,
  csv: string,
) {
  const table = readTable(csv);
  const mapping = guessMapping(table);
  const { rows, issues } = csvRows(table, mapping);
  assert.equal(issues.length, 0, JSON.stringify(issues.slice(0, 3)));
  for (let start = 0; start < rows.length; start += ROSTER_CHUNK) {
    const chunk = rows.slice(start, start + ROSTER_CHUNK);
    const plan = await server.as(account, "POST", `orgs/${orgId}/roster/plan`, {
      source: "csv",
      rows: chunk,
    });
    const held = plan.results.filter(
      (result: { status: string }) => result.status === "held",
    );
    assert.equal(held.length, 0, JSON.stringify(held.slice(0, 3)));
    const applied = await server.as(
      account,
      "POST",
      `orgs/${orgId}/roster/apply`,
      { source: "csv", rows: chunk },
    );
    const failed = applied.results.filter(
      (result: { status: string }) => result.status === "failed",
    );
    assert.equal(failed.length, 0, JSON.stringify(failed.slice(0, 3)));
  }
  return rows.length;
}

/** Each invitation in the outbox, accepted by its own synthetic account. */
async function acceptInvites(server: DemoServer, heroEmails: Set<string>) {
  let index = 0;
  const accepted = new Set<string>();
  for (const message of server.mail) {
    if (accepted.has(message.to) || !message.url.includes("#")) continue;
    accepted.add(message.to);
    // The mailed link carries the token and the proof that the mailbox read it.
    const [token, proof] = decodeURIComponent(message.url.split("#")[1]!).split(
      ".",
    );
    const account = heroEmails.has(message.to)
      ? ACCOUNTS.teacher
      : `demo-teacher-${++index}`;
    await server.as(account, "POST", "invites/accept", { token, proof });
  }
  return accepted.size;
}

/** One calendar for the year: begun on a Monday twelve weeks ago, in semesters. */
function yearDates() {
  const start = mondayOf(Date.now()) - 12 * 7 * DAY;
  return {
    startsOn: iso(start),
    endsOn: iso(start + 300 * DAY),
    daysAgo: Math.round((Date.now() - start) / DAY),
  };
}

/** Rows for the SQL backfill: every class but the hero, with a grade, a
 * teacher and a temperament; and every student in them. */
async function backfillTerm(
  server: DemoServer,
  tenant: { id: string; timezone: string },
  yearStart: string,
  options: {
    heroClassId: string;
    quietClassIds: readonly string[];
    /** Students who never got a seat haven't started. */
    skillsPerDay?: number;
  },
) {
  const { db } = server;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT setseed(0.27)");
    const { rows: classes } = await client.query(
      `SELECT c.id,c.org_id,
         (SELECT mode() WITHIN GROUP (ORDER BY p.grade_level) FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
          WHERE e.class_id=c.id AND e.role='student') AS grade,
         (SELECT e.person_id FROM amp_enrollments e WHERE e.class_id=c.id AND e.role='teacher' ORDER BY e.begin_on LIMIT 1) AS teacher
       FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
       WHERE o.path[1]=$1 AND c.id<>$2 ORDER BY c.created_at,c.id`,
      [tenant.id, options.heroClassId],
    );
    const roll = (seed: number) =>
      ((seed * 2654435761) % 4294967296) / 4294967296;
    const orgLift = new Map<string, number>();
    await client.query(
      `CREATE TEMP TABLE seed_class(id uuid,org uuid,grade int,quiet boolean,teacher uuid,drive float8,pace float8,lift float8) ON COMMIT DROP`,
    );
    // Each school has its own level, drive and pace, so no two read alike.
    const orgDrive = new Map<string, number>();
    const orgPace = new Map<string, number>();
    for (const [index, row] of classes.entries()) {
      if (!orgLift.has(row.org_id)) {
        const at = orgLift.size;
        // Centered a little below grade level, as most schools are this early.
        orgLift.set(row.org_id, (roll(at + 3) - 0.55) * 0.9 - 0.4);
        orgDrive.set(row.org_id, 0.72 + roll(at + 40) * 0.5);
        orgPace.set(row.org_id, 0.55 + roll(at + 91) * 1.1);
      }
      await client.query(
        `INSERT INTO seed_class VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          row.id,
          row.org_id,
          row.grade ?? 5,
          options.quietClassIds.includes(row.id),
          row.teacher,
          orgDrive.get(row.org_id)! * (0.72 + roll(index + 11) * 0.52),
          (0.25 + roll(index + 77) * 1.3) * orgPace.get(row.org_id)!,
          orgLift.get(row.org_id)!,
        ],
      );
    }
    await client.query(
      `CREATE TEMP TABLE seed_student ON COMMIT DROP AS
       SELECT p.id AS person,p.learner_id AS learner,c.id AS class,c.org,c.grade,c.quiet,
         row_number() OVER (ORDER BY p.created_at,p.id) AS index,
         (random()+random()+random()+random()-2)*1.2+c.lift AS ability,
         CASE WHEN s.id IS NULL THEN 0
           WHEN c.quiet THEN random()*0.08
           WHEN random()<0.05+(1.1-c.drive)*0.22 THEN 0
           ELSE (0.45+random()*0.95)*c.drive END AS diligence,
         c.pace,random() AS seat_roll,random() AS signin_roll,random() AS email_roll
       FROM seed_class c JOIN amp_enrollments e ON e.class_id=c.id AND e.role='student'
       JOIN amp_people p ON p.id=e.person_id AND p.learner_id IS NOT NULL
       LEFT JOIN amp_seats s ON s.person_id=p.id AND s.released_at IS NULL`,
    );
    // Everyone who practiced signed in; a few who haven't, have too.
    await client.query(
      `INSERT INTO amp_student_sessions(id,token_hash,person_id,mode,expires_at,last_seen_at)
       SELECT gen_random_uuid(),md5(person::text||'demo'),person,'shared',now()+interval '12 hours',now()-interval '1 day'
       FROM seed_student WHERE diligence>0 OR signin_roll<0.4`,
    );
    await seedTermEvidence(client, {
      timezone: tenant.timezone,
      tenantId: tenant.id,
      yearStart,
      skillsPerDay: options.skillsPerDay ?? 2,
      // Last week was short: a long weekend. This week is back up.
      weekShape: [
        0.55, 0.68, 0.8, 0.86, 0.92, 0.82, 0.96, 1.02, 0.58, 0.94, 1.04, 0.74,
        1.08,
      ],
    });
    const counted = (
      await client.query(
        "SELECT count(*)::int AS students,(SELECT count(*)::int FROM seed_class) AS classes FROM seed_student",
      )
    ).rows[0];
    await client.query("COMMIT");
    for (const table of [
      "amp_learner_weeks",
      "amp_level_days",
      "amp_active_days",
      "amp_skill_days",
      "amp_people",
      "amp_org_roles",
      "amp_enrollments",
      "amp_seats",
      "amp_student_sessions",
    ])
      await client.query(`VACUUM ANALYZE ${table}`);
    return counted as { students: number; classes: number };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export type DemoWorld = {
  size: DemoSize;
  district: { id: string; name: string } | null;
  school: { id: string; name: string };
  hero: {
    classId: string;
    name: string;
    joinCode: string;
    teacher: string;
    students: Map<string, Student>;
  };
  /** A student signed in for the picker, with a session the app can hold. */
  student: { personId: string; name: string; token: string };
  parentLink: string;
  counts: { students: number; classes: number; teachers: number };
};

/** The hero class's term, through the API, then its settings as a teacher
 * would set them: a course, a weekly target, standings and visible levels. */
async function finishHero(
  server: DemoServer,
  orgId: string,
  classId: string,
  timezone: string,
  yearDaysAgo: number,
) {
  const { db } = server;
  const { rows } = await db.query(
    `SELECT p.id,p.learner_id,p.given_name FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
     WHERE e.class_id=$1 AND e.role='student' AND p.learner_id IS NOT NULL`,
    [classId],
  );
  const students = new Map<string, Student>(
    rows.map((row) => [
      row.given_name,
      {
        personId: row.id,
        learnerId: row.learner_id,
        accountId: `school:${row.id}`,
      },
    ]),
  );
  assert.equal(students.size, HERO_CLASS.length, "the hero class is whole");
  // Joined at the year's start, like the class; Zara twelve days ago.
  for (const person of HERO_CLASS) {
    const begin = iso(Date.now() - (person.joined ?? yearDaysAgo) * DAY);
    const student = students.get(person.name[0])!;
    await db.query(
      "UPDATE amp_enrollments SET begin_on=$2 WHERE person_id=$1 AND role='student'",
      [student.personId, begin],
    );
    await db.query(
      "UPDATE amp_org_roles SET begin_on=$2 WHERE person_id=$1 AND role='student'",
      [student.personId, begin],
    );
  }
  await db.query(
    "UPDATE amp_enrollments SET begin_on=$2 WHERE class_id=$1 AND role='teacher'",
    [classId, iso(Date.now() - yearDaysAgo * DAY)],
  );
  const started = performance.now();
  await seedClass(server, {
    personas: HERO_CLASS,
    students,
    start: yearDaysAgo,
    timezone,
    concurrency: 6,
  });
  console.log(
    `  hero class: ${HERO_CLASS.length} students answered through the API in ${Math.round((performance.now() - started) / 1000)} s`,
  );
  const teacher = ACCOUNTS.teacher;
  await server.as(teacher, "POST", `orgs/${orgId}/classes/${classId}`, {
    courseBands: ["5"],
  });
  await server.as(teacher, "POST", `classes/${classId}/target`, {
    minutes: 60,
  });
  await server.as(teacher, "POST", `classes/${classId}/experience`, {
    values: { standings: "class", levels: "shown" },
  });
  return students;
}

/** The sign-in a class has done by now: pictures chosen, cards printed, a few
 * here today for the board, and one family link. */
async function signIns(
  server: DemoServer,
  classId: string,
  joinCode: string,
  students: Map<string, Student>,
) {
  const teacher = ACCOUNTS.teacher;
  const people = [...students.values()];
  for (const student of people.filter((_, index) => index % 3 !== 2))
    await fetch(`${server.api}/api/v1/school/join/picture`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: joinCode,
        personId: student.personId,
        pictures: ["fox", "boat", "kite"],
        set: true,
      }),
    }).then((response) => assert.ok(response.ok, "pictures set"));
  await server.as(teacher, "POST", `classes/${classId}/cards`, {
    personIds: people.map((student) => student.personId),
  });
  // Here today: most of the class, a few still to arrive.
  await server.db.query(
    `UPDATE amp_student_sessions SET last_seen_at=CASE WHEN person_id=ANY($1::uuid[]) THEN now() ELSE now()-interval '1 day' END
     WHERE person_id=ANY($2::uuid[]) AND revoked_at IS NULL`,
    [
      people.slice(0, 22).map((student) => student.personId),
      people.map((student) => student.personId),
    ],
  );
  const amara = students.get("Amara")!;
  const share = await server.as(
    teacher,
    "POST",
    `students/${amara.personId}/share`,
    {},
  );
  return (share.link as { url: string }).url;
}

/** A school we issued, its admin's invitation accepted, then setup through the
 * API; the agreement, roster and invitations follow. */
export async function issueSchool(
  server: DemoServer,
  account: string,
  input: {
    name: string;
    seats: number;
    reference: string;
    timezone?: string;
    /** The admin's name, as they type it accepting. */
    signer: string;
  },
) {
  const issued = (await schoolAdmin(
    server.schools,
    "create-school",
    {
      name: input.name,
      adminEmail: `${account}@demo.example`,
      seats: input.seats,
      startsOn: iso(Date.now() - DAY),
      endsOn: iso(Date.now() + 300 * DAY),
      reference: input.reference,
      ...(input.timezone ? { timezone: input.timezone } : {}),
    },
    server.services,
  )) as { orgId: string; setupUrl: string };
  // The admin's own link, opened by the admin: not one for `acceptInvites`.
  const sent = server.mail.findIndex((entry) => entry.url === issued.setupUrl);
  if (sent >= 0) server.mail.splice(sent, 1);
  const [token, proof] = issued.setupUrl.split("#")[1]!.split(".");
  await server.as(account, "POST", "invites/accept", {
    token,
    proof,
    name: input.signer,
  });
  return issued.orgId;
}
async function setupSchool(
  server: DemoServer,
  name: string,
  shape: "class" | "school",
  account: string,
  timezone: string,
  signer: [string, string],
  license: { seats: number; reference: string },
) {
  const year = yearDates();
  const org = {
    id: await issueSchool(server, account, {
      name,
      timezone,
      signer: signer[0],
      ...license,
    }),
  };
  await server.as(account, "POST", `orgs/${org.id}/setup/school`, {
    name,
    shape,
    timezone,
  });
  await server.as(account, "POST", `orgs/${org.id}/calendar`, {
    startsOn: year.startsOn,
    endsOn: year.endsOn,
    division: "semester",
  });
  await server.as(account, "POST", `orgs/${org.id}/setup/experience`, {
    preset: shape === "class" ? "competition" : "quiet",
  });
  return { orgId: org.id as string, year, signer };
}
async function acceptAgreement(
  server: DemoServer,
  account: string,
  orgId: string,
  [signerName, signerTitle]: [string, string],
) {
  await server.as(account, "POST", `orgs/${orgId}/setup/agreement`, {
    version: AGREEMENT_VERSION,
    signerName,
    signerTitle,
  });
}
const yearAhead = () => new Date(Date.now() + 300 * DAY).toISOString();

/** Builds the world for a size. Logs what it made as it goes. */
export async function buildDemo(
  server: DemoServer,
  size: DemoSize,
): Promise<DemoWorld> {
  const started = performance.now();
  const counters = { teacher: 0, student: 0 };
  const timezone = "America/New_York";
  let district: DemoWorld["district"] = null;
  let schoolId: string, schoolName: string, heroClassId: string;
  let yearDaysAgo: number, yearStart: string;
  let quiet: string[] = [];
  let teachers = 0;

  if (size === 30) {
    schoolName = "Ms. Okafor’s Class";
    const setup = await setupSchool(
      server,
      schoolName,
      "class",
      ACCOUNTS.teacher,
      timezone,
      ["Grace Okafor", "Teacher"],
      { seats: 30, reference: "Pilot" },
    );
    schoolId = setup.orgId;
    yearDaysAgo = setup.year.daysAgo;
    yearStart = setup.year.startsOn;
    await acceptAgreement(server, ACCOUNTS.teacher, schoolId, setup.signer);
    // A lone teacher types their names, the guided way.
    const finished = await server.as(
      ACCOUNTS.teacher,
      "POST",
      `orgs/${schoolId}/setup/finish`,
      {
        className: "Grade 5 Math",
        names: HERO_CLASS.map((p) => `${p.name[0]} ${p.name[1]}`),
        gradeLevel: 5,
      },
    );
    heroClassId = finished.classId;
    for (const person of HERO_CLASS)
      await server.db.query(
        "UPDATE amp_people SET identifier=$3 WHERE tenant_id=$1 AND given_name=$2",
        [schoolId, person.name[0], person.identifier],
      );
    teachers = 1;
  } else if (size === 1000) {
    schoolName = "Alder Street School";
    const setup = await setupSchool(
      server,
      schoolName,
      "school",
      ACCOUNTS.head,
      timezone,
      ["Ruth Adeyemi", "Head of School"],
      // Licensing is a privileged agent's job: six short, so six wait.
      { seats: 994, reference: "Purchase order 2026-114" },
    );
    schoolId = setup.orgId;
    yearDaysAgo = setup.year.daysAgo;
    yearStart = setup.year.startsOn;
    await acceptAgreement(server, ACCOUNTS.head, schoolId, setup.signer);
    const plan = planSchool(
      schoolName,
      [0, 1, 2, 3, 4, 5, 6, 7, 8],
      5,
      1000,
      counters,
      { hero: true, untaughtEvery: 23 },
    );
    const { csv } = rosterFor(plan, counters);
    const rows = await importRoster(server, ACCOUNTS.head, schoolId, csv);
    teachers = await acceptInvites(
      server,
      new Set([plan.classes[0]!.teacher!.email]),
    );
    await server.as(ACCOUNTS.head, "POST", `orgs/${schoolId}/setup/finish`, {});
    console.log(`  ${schoolName}: ${rows} roster rows imported`);
    await server.db.query(
      "UPDATE amp_people SET display_name='Dr. Adeyemi' WHERE account_id=$1",
      [ACCOUNTS.head],
    );
    heroClassId = await classIdByName(server, schoolId, plan.classes[0]!.name);
    quiet = [await classIdByName(server, schoolId, "Grade 7 Math · Period 3")];
  } else {
    const year = yearDates();
    yearDaysAgo = year.daysAgo;
    yearStart = year.startsOn;
    const made = await server.schools.createOrg(
      { kind: "district", name: "Juniper Valley Schools", timezone },
      {
        version: AGREEMENT_VERSION,
        signerName: "Dana Ruiz",
        signerTitle: "Superintendent",
      },
    );
    district = { id: made.id, name: "Juniper Valley Schools" };
    const superintendent = await server.schools.addStaff({
      orgId: made.id,
      role: "admin",
      givenName: "Dana",
      familyName: "Ruiz",
      accountId: ACCOUNTS.district,
    });
    await server.db.query("UPDATE amp_people SET display_name=$2 WHERE id=$1", [
      superintendent.personId,
      "Dr. Ruiz",
    ]);
    // One pool for the district, eight short.
    await server.schools.issueLicense({
      orgId: made.id,
      seats: 9992,
      endsAt: yearAhead(),
      reference: "Board resolution 26-41",
    });
    await server.as(ACCOUNTS.district, "POST", `orgs/${made.id}/calendar`, {
      startsOn: year.startsOn,
      endsOn: year.endsOn,
      division: "semester",
    });
    const elementary = [
      "Cedar Grove",
      "Aspen Ridge",
      "Birch Hollow",
      "Dogwood Lane",
      "Elm Crossing",
      "Fern Hill",
      "Glenwood",
    ];
    const middle = ["Harbor View", "Ironwood", "Juniper Heights"];
    const high = ["Kestrel Valley", "Larkspur"];
    const plans: PlannedSchool[] = [];
    const sizes = { elementary: 740, middle: 850, high: 1135 };
    for (const name of elementary)
      plans.push(
        planSchool(
          `${name} Elementary`,
          [0, 1, 2, 3, 4, 5],
          5,
          sizes.elementary,
          counters,
          { hero: name === "Cedar Grove", untaughtEvery: 47 },
        ),
      );
    for (const name of middle)
      plans.push(
        planSchool(
          `${name} Middle School`,
          [6, 7, 8],
          12,
          sizes.middle,
          counters,
          {
            untaughtEvery: 47,
          },
        ),
      );
    for (const name of high)
      plans.push(
        planSchool(
          `${name} High School`,
          [9, 10, 11, 12],
          12,
          sizes.high,
          counters,
          {
            untaughtEvery: 47,
          },
        ),
      );
    const total = plans.reduce(
      (sum, plan) =>
        sum + plan.classes.reduce((all, klass) => all + klass.size, 0),
      0,
    );
    assert.equal(total, 10_000, `the district has ${total}`);
    let heroSchool: { id: string; plan: PlannedSchool } | null = null;
    for (const plan of plans) {
      const school = await server.schools.createOrg({
        kind: "school",
        name: plan.name,
        parentId: made.id,
      });
      if (plan.hero) {
        heroSchool = { id: school.id, plan };
        const head = await server.schools.addStaff({
          orgId: school.id,
          role: "admin",
          givenName: "Ruth",
          familyName: "Adeyemi",
          accountId: ACCOUNTS.head,
        });
        await server.db.query(
          "UPDATE amp_people SET display_name='Dr. Adeyemi' WHERE id=$1",
          [head.personId],
        );
      }
      const { csv } = rosterFor(plan, counters);
      const rows = await importRoster(
        server,
        ACCOUNTS.district,
        school.id,
        csv,
      );
      console.log(`  ${plan.name}: ${rows} roster rows imported`);
    }
    assert.ok(heroSchool);
    teachers = await acceptInvites(
      server,
      new Set([heroSchool.plan.classes[0]!.teacher!.email]),
    );
    schoolId = heroSchool.id;
    schoolName = heroSchool.plan.name;
    heroClassId = await classIdByName(
      server,
      schoolId,
      heroSchool.plan.classes[0]!.name,
    );
    const { rows: everyThirtyFirst } = await server.db.query(
      `SELECT c.id FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id WHERE o.path[1]=$1 AND c.id<>$2 ORDER BY c.created_at,c.id`,
      [made.id, heroClassId],
    );
    quiet = everyThirtyFirst
      .filter((_, index) => index % 31 === 7)
      .map((row) => row.id as string);
  }

  // Courses, as an admin sets them after an import: Grade 5 is Grade 5.
  const admin =
    size === 10000
      ? ACCOUNTS.district
      : size === 1000
        ? ACCOUNTS.head
        : ACCOUNTS.teacher;
  const { rows: allClasses } = await server.db.query(
    `SELECT c.id,c.org_id,c.name FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
     WHERE o.path[1]=$1 AND c.id<>$2`,
    [district?.id ?? schoolId, heroClassId],
  );
  for (const klass of allClasses) {
    const grade = /^Kindergarten/.test(klass.name)
      ? "K"
      : (/Grade (\d+)/.exec(klass.name)?.[1] ??
        String(
          Object.entries(HIGH_COURSES).find(([, name]) =>
            klass.name.startsWith(name),
          )?.[0] ?? "",
        ));
    if (!grade) continue;
    await server.as(admin, "POST", `orgs/${klass.org_id}/classes/${klass.id}`, {
      courseBands: courseBandsFor([grade], klass.name),
    });
  }

  const heroStudents = await finishHero(
    server,
    schoolId,
    heroClassId,
    timezone,
    yearDaysAgo,
  );
  const tenant = { id: district?.id ?? schoolId, timezone };
  const filled =
    size === 30
      ? { students: 0, classes: 0 }
      : await backfillTerm(server, tenant, yearStart, {
          heroClassId,
          quietClassIds: quiet,
        });
  const heroClass = (
    await server.db.query(
      "SELECT name,join_code FROM amp_classes WHERE id=$1",
      [heroClassId],
    )
  ).rows[0];
  const parentLink = await signIns(
    server,
    heroClassId,
    heroClass.join_code,
    heroStudents,
  );
  // The student the picker signs in: grown the most from behind, so the
  // board shows their own line among the leaders.
  const caleb = heroStudents.get("Caleb")!;
  const session = await server.schools.issueStudentSession({
    personId: caleb.personId,
    mode: "shared",
  });
  const counts = (
    await server.db.query(
      `SELECT (SELECT count(*)::int FROM amp_people p WHERE p.tenant_id=$1 AND p.learner_id IS NOT NULL) AS students,
         (SELECT count(*)::int FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id WHERE o.path[1]=$1) AS classes`,
      [tenant.id],
    )
  ).rows[0] as { students: number; classes: number };
  console.log(
    `Built ${counts.students.toLocaleString("en-US")} students in ${counts.classes} classes (${filled.students} backfilled) in ${Math.round((performance.now() - started) / 1000)} s`,
  );
  return {
    size,
    district,
    school: { id: schoolId, name: schoolName },
    hero: {
      classId: heroClassId,
      name: heroClass.name,
      joinCode: heroClass.join_code,
      teacher: "Ms. Okafor",
      students: heroStudents,
    },
    student: { personId: caleb.personId, name: "Caleb", token: session.token },
    parentLink,
    counts: { ...counts, teachers },
  };
}

async function classIdByName(server: DemoServer, orgId: string, name: string) {
  const found = (
    await server.db.query(
      "SELECT id FROM amp_classes WHERE org_id=$1 AND name=$2",
      [orgId, name],
    )
  ).rows[0];
  assert.ok(found, `No class named ${name}`);
  return found.id as string;
}

/* The picker: loopback only, like the development sign-in it stands on. */

export type Picker = {
  world: DemoWorld;
};
type PickerPersona = {
  key: string;
  who: string;
  role: string;
  opens: string;
  path: string;
  account?: string;
  student?: { token: string; accountId: string };
};
function personas(world: DemoWorld): PickerPersona[] {
  const school = `/school/${world.school.id}`;
  const today = `${school}/classes/${world.hero.classId}/today`;
  const list: PickerPersona[] = [];
  if (world.district)
    list.push({
      key: "district",
      who: "Dr. Dana Ruiz",
      role: `Superintendent, ${world.district.name}`,
      opens: "District overview",
      path: `/school/${world.district.id}`,
      account: ACCOUNTS.district,
    });
  if (world.size !== 30)
    list.push({
      key: "head",
      who: "Dr. Ruth Adeyemi",
      role: `Head of ${world.school.name}`,
      opens: "School overview",
      path: school,
      account: ACCOUNTS.head,
    });
  list.push({
    key: "teacher",
    who: "Ms. Grace Okafor",
    role: `Teacher, ${world.hero.name}`,
    opens: "Today",
    path: today,
    account: ACCOUNTS.teacher,
  });
  list.push({
    key: "student",
    who: world.student.name,
    role: `Student, ${world.hero.name}`,
    opens: "Practice",
    path: "/practice",
    student: {
      token: world.student.token,
      accountId: `school:${world.student.personId}`,
    },
  });
  return list;
}
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

function pickerPage(world: DemoWorld | null) {
  const list = world ? personas(world) : [];
  const links = world
    ? [
        [
          "Start class board",
          `/school/${world.school.id}/classes/${world.hero.classId}/start`,
          "teacher",
        ],
        ["Family link", world.parentLink.replace(/^https?:\/\/[^/]+/, ""), ""],
        ["For schools", "/schools", ""],
      ]
    : [];
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>AMP for Schools demo</title>
<style>
:root{color-scheme:light dark;--ink:#16202b;--soft:#5b6875;--line:#d9e0e7;--card:#ffffff;--page:#f3f6f8;--accent:#1f6feb;--focus:#1f6feb}
@media (prefers-color-scheme:dark){:root{--ink:#e8eef4;--soft:#9fb0c0;--line:#2c3a48;--card:#17212b;--page:#0f171f;--accent:#6aa6ff;--focus:#6aa6ff}}
*{box-sizing:border-box}
body{margin:0;background:var(--page);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:48px 20px 64px}
h1{font-size:28px;line-height:1.2;margin:0 0 8px;letter-spacing:-.01em}
p.lede{margin:0 0 32px;color:var(--soft)}
ul{list-style:none;margin:0;padding:0;display:grid;gap:12px}
a.persona{display:grid;grid-template-columns:1fr auto;gap:4px 16px;align-items:center;min-height:88px;padding:18px 20px;background:var(--card);border:1px solid var(--line);border-radius:14px;color:inherit;text-decoration:none}
a.persona:hover{border-color:var(--accent)}
a:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.who{font-weight:650;font-size:18px}
.role{color:var(--soft);grid-column:1}
.opens{grid-row:1/span 2;grid-column:2;color:var(--accent);font-weight:600;white-space:nowrap}
h2{font-size:16px;margin:40px 0 8px}
nav{display:flex;flex-wrap:wrap;gap:8px 20px}
nav a{display:inline-flex;align-items:center;min-height:44px;color:var(--accent)}
.empty{padding:24px;border:1px dashed var(--line);border-radius:14px;color:var(--soft)}
</style></head><body><main>
<h1>AMP for Schools demo</h1>
<p class="lede">${world ? `${escape(world.district?.name ?? world.school.name)}: ${world.counts.students.toLocaleString("en-US")} students in ${world.counts.classes} classes. Everyone here is made up.` : "The demo is still being built. This page refreshes on its own."}</p>
${
  list.length
    ? `<ul>${list
        .map(
          (persona) =>
            `<li><a class="persona" href="/demo/as/${persona.key}"><span class="who">${escape(persona.who)}</span><span class="role">${escape(persona.role)}</span><span class="opens">${escape(persona.opens)}</span></a></li>`,
        )
        .join("")}</ul>
<h2>Also</h2><nav>${links
        .map(
          ([label, path, as]) =>
            `<a href="${as ? `/demo/as/${as}?to=${encodeURIComponent(path!)}` : escape(path!)}">${escape(label!)}</a>`,
        )
        .join("")}</nav>`
    : `<p class="empty">Building…</p><script>setTimeout(()=>location.reload(),3000)</script>`
}
</main></body></html>`;
}

function switchPage(persona: PickerPersona, to: string) {
  const store = persona.student
    ? `sessionStorage.setItem("amp.student",${JSON.stringify(JSON.stringify(persona.student))});`
    : 'sessionStorage.removeItem("amp.student");localStorage.removeItem("amp.student");';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Signing in</title></head><body><script>
sessionStorage.removeItem("amp.learner");sessionStorage.removeItem("amp.trial");${store}
location.replace(${JSON.stringify(to)});
</script></body></html>`;
}

function pickerPlugin(current: () => Picker | null): Plugin {
  return {
    name: "amp-school-demo-picker",
    configureServer(server) {
      server.middlewares.use(
        (request: IncomingMessage, response: ServerResponse, next) => {
          const here = new URL(request.url ?? "/", "http://127.0.0.1");
          if (here.pathname !== "/demo" && !here.pathname.startsWith("/demo/"))
            return next();
          response.setHeader("cache-control", "no-store");
          response.setHeader("x-robots-tag", "noindex");
          if (!LOOPBACK.includes(request.socket.remoteAddress ?? "")) {
            response.statusCode = 403;
            return response.end("The demo picker answers on loopback only.");
          }
          const picker = current();
          const persona = here.pathname.startsWith("/demo/as/")
            ? picker &&
              personas(picker.world).find(
                (entry) => entry.key === here.pathname.slice(9),
              )
            : null;
          response.setHeader("content-type", "text/html; charset=utf-8");
          if (!persona) return response.end(pickerPage(picker?.world ?? null));
          const to = here.searchParams.get("to") ?? persona.path;
          response.setHeader(
            "set-cookie",
            persona.account
              ? `${DEMO_COOKIE}=${persona.account}; Path=/; SameSite=Strict; HttpOnly`
              : `${DEMO_COOKIE}=; Path=/; Max-Age=0; SameSite=Strict; HttpOnly`,
          );
          return response.end(
            switchPage(persona, to.startsWith("/") ? to : "/"),
          );
        },
      );
    },
  };
}
