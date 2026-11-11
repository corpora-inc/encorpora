/**
 * Seeds the local design preview with the people in
 * `src/web/features/dev/persona-list.ts`, through the real API where a person
 * would act (sign-up, "What brings you to AMP?", the demo places, inviting and
 * accepting a second parent) and through the demo history generator for their
 * practice (`src/schools/demo/history.ts`). `/dev/personas` then signs in as
 * any of them in one click. Every name is made up.
 *
 *     AMP_DATABASE_URL=postgres://amp:amp@127.0.0.1:55490/amp_design_pass \
 *     AMP_PREVIEW_ORIGIN=http://127.0.0.1:4700 npx tsx scripts/design-personas.ts
 *
 * The API must be running in accounts mode behind that origin
 * (`scripts/design-preview.sh`). Loopback only; it refuses anything else.
 * Run it on an empty database: a persona that already exists is skipped.
 * `AMP_PERSONAS=adult-3wk,family` seeds only those (a browser check's
 * fixture, scripts/verify-smooth-load-ui.ts).
 */
import pg from "pg";
import {
  seedClassHistory,
  type DemoStudent,
} from "../src/schools/demo/history";
import { persona, type Persona } from "../src/schools/demo/personas";
import { PostgresRepository } from "../src/server/repository";
import {
  PERSONA_PASSPHRASE,
  PREVIEW_PERSONAS,
  personaEmail,
} from "../src/web/features/dev/persona-list";
import { migrate } from "./migrate";

const databaseUrl = process.env.AMP_DATABASE_URL;
const origin = process.env.AMP_PREVIEW_ORIGIN ?? "http://127.0.0.1:4700";
if (!databaseUrl) throw new Error("AMP_DATABASE_URL is required");
for (const url of [databaseUrl, origin])
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname))
    throw new Error(`Design personas are loopback-only: ${url}`);
if (new URL(databaseUrl).pathname === "/amp")
  throw new Error("Seed a dedicated database, never the shared /amp preview");

await migrate(databaseUrl);
const pool = new pg.Pool({ connectionString: databaseUrl });
const repository = new PostgresRepository(databaseUrl, { development: false });
const DAY = 86_400_000;
const ZONE = "America/New_York";
const thisYear = new Date().getUTCFullYear();
const todayIso = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
const daysAgo = (n: number) =>
  new Date(Date.parse(`${todayIso}T12:00:00Z`) - n * DAY)
    .toISOString()
    .slice(0, 10);

type Session = { account: string; token: string; cookie: string };
const nameOf = (slug: string) =>
  PREVIEW_PERSONAS.find((p) => p.slug === slug)!.name;

async function call<T>(
  session: Session | null,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(session
        ? { Authorization: `Bearer ${session.token}`, Cookie: session.cookie }
        : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok)
    throw new Error(`${method} ${path} → ${response.status} ${text}`);
  return (text ? JSON.parse(text) : {}) as T;
}

/** A persona's account, made through the real sign-up, its address marked
 * confirmed as a real person's would be by now. Null when it exists already. */
async function signUp(slug: string): Promise<Session | null> {
  const email = personaEmail(slug);
  const existing = await pool.query(
    "SELECT 1 FROM amp_auth_users WHERE lower(email)=$1",
    [email],
  );
  if (existing.rowCount) {
    console.log(`  ${slug}: exists, skipped`);
    return null;
  }
  const response = await fetch(`${origin}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: PERSONA_PASSPHRASE,
      name: nameOf(slug),
    }),
  });
  if (!response.ok)
    throw new Error(
      `sign-up ${slug} ${response.status} ${await response.text()}`,
    );
  const cookie = response.headers
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .join("; ");
  const session = (await (
    await fetch(`${origin}/api/auth/get-session`, {
      headers: { Cookie: cookie },
    })
  ).json()) as { user: { id: string }; session: { token: string } };
  await pool.query(
    'UPDATE amp_auth_users SET "emailVerified"=true WHERE id=$1',
    [session.user.id],
  );
  return {
    account: `amp|${session.user.id}`,
    token: session.session.token,
    cookie,
  };
}

/** A year of active access, as a purchase leaves it. */
async function grant(learnerId: string, startedDaysAgo = 30) {
  await pool.query(
    `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
     VALUES($1,$2,'pilot',$1,'active',now()-make_interval(days=>$3),now()+interval '330 days')`,
    [`preview-${learnerId}`, learnerId, startedDaysAgo],
  );
}

/** Weeks of believable practice from the demo generator. `weeks` 0 means a
 * first session yesterday and nothing since. */
async function history(
  learners: { learnerId: string; persona: Persona }[],
  {
    weeks,
    grade,
    recentDays,
  }: { weeks: number; grade: number; recentDays?: number },
) {
  const students: DemoStudent[] = learners.map((learner) => ({
    personId: learner.learnerId,
    ...learner,
  }));
  const span = Math.max(1, weeks * 7);
  const shape = weeks
    ? Array.from({ length: weeks + 1 }, (_, i) => 0.75 + 0.06 * i)
    : [1, 1];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL amp.rollup_weeks='deferred'");
    const written = await seedClassHistory(client, {
      students,
      timezone: ZONE,
      termStart: daysAgo(span),
      today: todayIso,
      gradeLevel: grade,
      weekShape: shape,
      now: Date.now(),
      workToday: true,
      recentDays: recentDays ?? span + 1,
      sharedGap: null,
      stuck: null,
    });
    // The weekly rollups, summed once, as a demo's bulk writer does.
    const ids = learners.map((l) => l.learnerId);
    await client.query(
      `INSERT INTO amp_learner_weeks(learner_id,week,active_ms)
       SELECT learner_id,date_trunc('week',day)::date,sum(active_ms) FROM amp_active_days
       WHERE learner_id=ANY($1) GROUP BY 1,2
       ON CONFLICT(learner_id,week) DO UPDATE SET active_ms=EXCLUDED.active_ms`,
      [ids],
    );
    await client.query("COMMIT");
    return written.answers;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function countAnswers(learnerId: string) {
  return (
    await pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM amp_attempts WHERE learner_id=$1",
      [learnerId],
    )
  ).rows[0]!.n;
}
/** Free problems spent, for a learner practicing on the allowance. */
async function spendFree(learnerId: string) {
  await pool.query(
    "UPDATE amp_learners SET free_online_used=LEAST(100,$2) WHERE id=$1",
    [learnerId, await countAnswers(learnerId)],
  );
}

const start = <T>(session: Session, body: unknown) =>
  call<T>(session, "POST", "/api/v1/start", body);
type Started = { home: string; learnerId?: string };

const seeds: Record<string, (session: Session) => Promise<void>> = {
  "signed-up": async () => {},
  "adult-new": async (session) => {
    await start(session, { as: "myself", timezone: ZONE, birthYear: 1990 });
  },
  "adult-day1": async (session) => {
    const { learnerId } = await start<Started>(session, {
      as: "myself",
      timezone: ZONE,
      birthYear: 1984,
    });
    await history(
      [
        {
          learnerId: learnerId!,
          persona: persona("Noel", "Brandt", 6.4, {
            answers: 18,
            minutes: 16,
            every: 40,
            lastActive: 1,
            joined: 1,
            growth: 0,
          }),
        },
      ],
      { weeks: 0, grade: 7 },
    );
    await spendFree(learnerId!);
  },
  "adult-3wk": async (session) => {
    const { learnerId } = await start<Started>(session, {
      as: "myself",
      timezone: ZONE,
      birthYear: 1979,
    });
    await grant(learnerId!, 22);
    await history(
      [
        {
          learnerId: learnerId!,
          persona: persona("Mara", "Quill", 7.2, {
            answers: 280,
            minutes: 18,
            every: 3,
            growth: 0.6,
          }),
        },
      ],
      { weeks: 3, grade: 8 },
    );
  },
  "adult-paused": async (session) => {
    const { learnerId } = await start<Started>(session, {
      as: "myself",
      timezone: ZONE,
      birthYear: 1993,
    });
    await history(
      [
        {
          learnerId: learnerId!,
          persona: persona("Iris", "Calder", 5.4, {
            answers: 100,
            minutes: 14,
            every: 1,
            growth: 0.5,
          }),
        },
      ],
      { weeks: 1, grade: 6 },
    );
    await pool.query(
      "UPDATE amp_learners SET free_online_used=100 WHERE id=$1",
      [learnerId],
    );
  },
  "parent-new": async (session) => {
    await start(session, {
      as: "parent",
      children: [{ birthYear: thisYear - 9 }, { birthYear: thisYear - 6 }],
    });
  },
  "parent-day1": async (session) => {
    const { learnerId } = await start<Started>(session, {
      as: "parent",
      children: [{ birthYear: thisYear - 10 }],
    });
    await history(
      [
        {
          learnerId: learnerId!,
          persona: persona("Child", "Ashby", 4.1, {
            answers: 14,
            minutes: 12,
            every: 40,
            lastActive: 1,
            joined: 1,
            growth: 0,
          }),
        },
      ],
      { weeks: 0, grade: 4 },
    );
    await spendFree(learnerId!);
  },
  family: async (session) => {
    // A parent who has given verified consent names their children.
    await pool.query(
      "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'preview','verified','synthetic')",
      [session.account],
    );
    const pip = await repository.create(session.account, "Pip", thisYear - 6);
    const wren = await repository.create(
      session.account,
      "Wren",
      thisYear - 10,
    );
    const theo = await repository.create(
      session.account,
      "Theo",
      thisYear - 16,
    );
    await start(session, {
      as: "parent",
      children: [pip, wren, theo].map(() => ({ birthYear: thisYear - 10 })),
    });
    for (const child of [pip, wren, theo]) await grant(child.id, 75);
    await history(
      [
        {
          learnerId: pip.id,
          persona: persona("Pip", "Pell", 0.5, {
            answers: 170,
            minutes: 9,
            growth: 0.5,
            joined: 34,
          }),
        },
      ],
      { weeks: 6, grade: 0, recentDays: 21 },
    );
    await history(
      [
        {
          learnerId: wren.id,
          persona: persona("Wren", "Pell", 4.6, {
            answers: 520,
            minutes: 16,
            growth: 0.7,
          }),
        },
      ],
      { weeks: 10, grade: 4, recentDays: 21 },
    );
    await history(
      [
        {
          learnerId: theo.id,
          persona: persona("Theo", "Pell", 9.5, {
            answers: 430,
            minutes: 22,
            growth: 0.5,
            every: 3,
            lastActive: 2,
          }),
        },
      ],
      { weeks: 10, grade: 10, recentDays: 21 },
    );
    // The second parent: invited by the holder, accepted with her own account.
    const ivy = personaEmail("second-parent");
    await call(session, "POST", "/api/v1/family/second-parent", { email: ivy });
    const { secondParent } = await call<{
      secondParent: { inviteUrl: string | null } | null;
    }>(session, "GET", "/api/v1/family/second-parent");
    const token = secondParent?.inviteUrl?.split("#")[1];
    if (!token) throw new Error("No second-parent invitation link");
    const second = await signUp("second-parent");
    if (second)
      await call(second, "POST", "/api/v1/school/invites/accept", {
        token,
        name: nameOf("second-parent"),
      });
  },
  // Made with the family above.
  "second-parent": async () => {},
  tutor: async (session) => {
    const years = [9, 10, 11, 12, 13, 8].map((age) => ({
      birthYear: thisYear - age,
    }));
    await start(session, { as: "tutor", students: years });
    const learners = (
      await pool.query<{ learner_id: string }>(
        `SELECT p.learner_id FROM amp_families f
         JOIN amp_enrollments e ON e.class_id=f.class_id AND e.role='student' AND e.end_on IS NULL
         JOIN amp_people p ON p.id=e.person_id AND p.learner_id IS NOT NULL
         WHERE f.account_id=$1 ORDER BY p.created_at,p.id`,
        [session.account],
      )
    ).rows.map((row) => row.learner_id);
    const levels = [3.6, 4.4, 5.1, 6.3, 7.0, 2.8];
    for (const [index, learnerId] of learners.entries()) {
      await history(
        [
          {
            learnerId,
            persona: persona(`Student${index}`, "Lund", levels[index] ?? 4, {
              answers: 160 + index * 25,
              minutes: 12,
              every: 2 + (index % 2),
              lastActive: index === 5 ? 6 : index % 3,
            }),
          },
        ],
        { weeks: 5, grade: Math.round(levels[index] ?? 4), recentDays: 14 },
      );
      // Four families have paid; two are still on the free problems.
      if (index < 4) await grant(learnerId, 36);
      else await spendFree(learnerId);
    }
  },
  teacher: async (session) => {
    await call(session, "POST", "/api/v1/school/demo", { kind: "class" });
  },
  // The teacher's demo class, made real: what a licensed teacher sees, with
  // the same twelve weeks, and no demo bar.
  "teacher-class": async (session) => {
    const { demo } = await call<{ demo: { orgId: string } }>(
      session,
      "POST",
      "/api/v1/school/demo",
      { kind: "class" },
    );
    await pool.query(
      "UPDATE amp_orgs SET demo=false,demo_kind=NULL,demo_seen_at=NULL,name='Alder Street School' WHERE id=$1",
      [demo.orgId],
    );
  },
  school: async (session) => {
    await call(session, "POST", "/api/v1/school/demo", { kind: "school" });
  },
};

const only = process.env.AMP_PERSONAS?.split(",").map((slug) => slug.trim());
for (const person of PREVIEW_PERSONAS) {
  const seed = seeds[person.slug];
  if (!seed || person.slug === "second-parent") continue;
  if (only && !only.includes(person.slug)) continue;
  const begun = Date.now();
  const session = await signUp(person.slug);
  if (!session) continue;
  await seed(session);
  console.log(`  ${person.slug}: ${((Date.now() - begun) / 1000).toFixed(1)}s`);
}
await pool.end();
await repository.close?.();
console.log(`Ready: ${origin}/dev/personas`);
