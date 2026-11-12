/**
 * One shared demo school per demo time zone (docs/schools.md#demo-places).
 *
 * A zone's school for a day is a row of `amp_demo_schools`. The current one is
 * the newest fully written row whose school day has begun in the zone: the
 * pointer moves when the day's sitting ends (9:00, `switchAt`), on every pod
 * at once, and only to a school whose rows are all committed (`built_at`).
 * So nothing a visitor sees is later than now; before 9:00 they see
 * yesterday's school, where nobody has practiced today. An hour before the
 * switch the warmer writes the coming day's school as a new org from the
 * static term shipped in the image (`snapshot.ts`, `roster.ts`, `shift.ts`),
 * and after a grace period removes the old one through the tree removal. One
 * pod writes a zone's day: it claims the row. No pod ever simulates a term.
 *
 * A visitor joins the current school as its admin (a school) or as the hero
 * class's teacher (a class). On their next request after the switch, their
 * place moves to the new school (`followDemo`); a link into the old one sends
 * them to the new one (`movedDemoPath`). Visitors never see each other: every
 * list of people leaves out a visitor who isn't the viewer (`sql.ts`).
 */
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { Repository } from "../../server/repository.js";
import { SchoolError } from "../contracts.js";
import { generateHandle } from "../repository.js";
import {
  buildSharedSchool,
  ownerName,
  seedWorkbooks,
  type DemoKind,
} from "./build.js";
import { removeDemoOrg } from "./remove.js";
import { sharedDay, switchAt, type SharedDay } from "./roster.js";
import { shiftedTerms } from "./shift.js";
import { shippedTerms } from "./snapshot.js";

export const DEFAULT_DEMO_ZONE = "America/New_York";
/** How long an old school stays after the switch, for requests in flight
 * and a student practicing in it. */
export const GRACE_MS = 2 * 3_600_000;
/** A claimed day that has not been written by then is free to claim again. */
const CLAIM_SECONDS = 600;
/** How long a request waits for a school being written. */
const WAIT_MS = 175_000;
/** A zone with no visitor for this long is no longer written each night. */
const ZONE_IDLE_DAYS = 7;

export type SharedSchool = {
  timezone: string;
  day: string;
  orgId: string;
  heroClassId: string;
};
export type DemoPlace = { orgId: string; classId: string; created: boolean };

const delay = (ms: number) => new Promise((done) => setTimeout(done, ms));
const todayPath = (school: { orgId: string; heroClassId: string }) =>
  `school/${school.orgId}/classes/${school.heroClassId}/today`;

/** The zone's current school, or null if it has none yet. Never waits. */
export async function currentSchool(
  pool: Pick<Pool, "query">,
  timezone: string,
  now = Date.now(),
): Promise<SharedSchool | null> {
  const { day } = sharedDay(now, timezone);
  const row = (
    await pool.query(
      `SELECT day::text AS day,org_id,hero_class_id FROM amp_demo_schools
       WHERE timezone=$1 AND day<=$2::date AND built_at IS NOT NULL AND removed_at IS NULL
       ORDER BY day DESC LIMIT 1`,
      [timezone, day],
    )
  ).rows[0];
  return row
    ? {
        timezone,
        day: row.day,
        orgId: row.org_id,
        heroClassId: row.hero_class_id,
      }
    : null;
}

/** Writes in this process, so a pod starts each at most once. */
const writing = new Map<string, Promise<void>>();

/** The zone's school for `day` exists once this resolves: written here, by
 * another pod (waited for), or already there. */
export function ensureSchool(
  pool: Pool,
  day: SharedDay,
  learning?: Repository,
): Promise<void> {
  const key = `${day.timezone}\0${day.day}`;
  const known = writing.get(key);
  if (known) return known;
  const running = claimAndWrite(pool, day, learning).finally(() =>
    writing.delete(key),
  );
  writing.set(key, running);
  return running;
}

async function claimAndWrite(
  pool: Pool,
  day: SharedDay,
  learning?: Repository,
) {
  const deadline = Date.now() + WAIT_MS;
  for (;;) {
    const row = (
      await pool.query(
        "SELECT built_at FROM amp_demo_schools WHERE timezone=$1 AND day=$2::date AND removed_at IS NULL",
        [day.timezone, day.day],
      )
    ).rows[0];
    if (row?.built_at) return;
    const claimed = (
      await pool.query(
        `INSERT INTO amp_demo_schools(timezone,day,building_until) VALUES($1,$2::date,now()+make_interval(secs=>$3))
         ON CONFLICT(timezone,day) DO UPDATE SET building_until=EXCLUDED.building_until,built_at=NULL
           WHERE (amp_demo_schools.built_at IS NULL OR amp_demo_schools.removed_at IS NOT NULL)
             AND (amp_demo_schools.building_until IS NULL OR amp_demo_schools.building_until<now())
         RETURNING amp_demo_schools.org_id AS stale`,
        [day.timezone, day.day, CLAIM_SECONDS],
      )
    ).rows[0];
    if (claimed) return writeSchool(pool, day, claimed.stale, learning);
    if (Date.now() > deadline)
      throw new SchoolError(503, "school_service_unavailable", 30);
    await delay(1_000);
  }
}

/** Writes the claimed day's school. Its pointer row is marked built last, in
 * one statement, so the school is current only once it is whole. */
async function writeSchool(
  pool: Pool,
  day: SharedDay,
  stale: string | null,
  learning?: Repository,
) {
  try {
    // A pod that stopped mid-write left an org nobody points at.
    if (stale) await removeDemoOrg(pool, stale);
    const terms = shiftedTerms(
      await shippedTerms("school", day.weekday),
      day.shiftDays,
      day.timezone,
    );
    const started = performance.now();
    const place = await transaction(pool, async (client) => {
      const written = await buildSharedSchool(
        client,
        { timezone: day.timezone, day: day.day },
        terms,
      );
      await client.query(
        `UPDATE amp_demo_schools SET org_id=$3,hero_class_id=$4,class_ids=$5,removed_at=NULL
         WHERE timezone=$1 AND day=$2::date`,
        [
          day.timezone,
          day.day,
          written.orgId,
          written.heroClassId,
          written.classIds,
        ],
      );
      return written;
    });
    if (learning)
      await seedWorkbooks(
        pool,
        learning,
        { classId: place.heroClassId },
        day.timezone,
        day.day,
      ).catch((error) =>
        // The class stands without them; the stack is one tap to make.
        console.error(JSON.stringify({ demoWorkbooks: String(error) })),
      );
    await pool.query(
      `UPDATE amp_demo_schools SET built_at=now(),presence_at=now(),building_until=NULL
       WHERE timezone=$1 AND day=$2::date`,
      [day.timezone, day.day],
    );
    console.log(
      JSON.stringify({
        demoSchoolWritten: day.timezone,
        day: day.day,
        ms: Math.round(performance.now() - started),
      }),
    );
  } catch (error) {
    await pool
      .query(
        `UPDATE amp_demo_schools SET building_until=NULL
         WHERE timezone=$1 AND day=$2::date AND built_at IS NULL`,
        [day.timezone, day.day],
      )
      .catch(() => undefined);
    throw error;
  }
}

/** The school a visitor in `timezone` joins now: today's. While today's is
 * still being written, yesterday's (and today's is written meanwhile); with
 * none at all, the first request writes it and the others wait. */
export async function demoSchool(
  pool: Pool,
  timezone: string,
  now = Date.now(),
  learning?: Repository,
): Promise<SharedSchool> {
  const day = sharedDay(now, timezone);
  const current = await currentSchool(pool, timezone, now);
  if (current?.day === day.day) return current;
  const written = ensureSchool(pool, day, learning);
  if (current) {
    written.catch((error) =>
      console.error(JSON.stringify({ demoSchoolNotWritten: String(error) })),
    );
    return current;
  }
  await written;
  const made = await currentSchool(pool, timezone, now);
  if (!made) throw new SchoolError(503, "school_service_unavailable", 30);
  return made;
}

async function transaction<T>(
  pool: Pool,
  run: (client: PoolClient) => Promise<T>,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='60s'");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Puts the visitor in `school`: as they are, with the admin role added if
 * they now ask for the school, or as a new member when they have no place in
 * it yet (their old place, in an older school, ends). Under the visitor's own
 * lock, so a double-click makes one membership. */
async function placeVisitor(
  pool: Pool,
  input: { accountId: string; timezone: string; admin: boolean },
  school: SharedSchool,
  /** Only move a visitor who is already one (`followDemo`). */
  existingOnly = false,
): Promise<DemoPlace | null> {
  return transaction(pool, async (client) => {
    await client.query("SET LOCAL lock_timeout='180s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `school-demo:${input.accountId}`,
    ]);
    await client.query("SET LOCAL lock_timeout='5s'");
    const visitor = (
      await client.query(
        `SELECT v.org_id,v.person_id,v.admin,v.timezone,
           EXISTS(SELECT 1 FROM amp_people p WHERE p.id=v.person_id AND p.deleted_at IS NULL) AS present
         FROM amp_demo_visitors v WHERE v.account_id=$1`,
        [input.accountId],
      )
    ).rows[0] as
      | {
          org_id: string;
          person_id: string;
          admin: boolean;
          timezone: string;
          present: boolean;
        }
      | undefined;
    if (existingOnly && !visitor) return null;
    const admin = input.admin || visitor?.admin === true;
    const year = (
      await client.query(
        `SELECT starts_on::text AS start FROM amp_academic_sessions
         WHERE org_id=$1 AND kind='year' ORDER BY starts_on DESC LIMIT 1`,
        [school.orgId],
      )
    ).rows[0]?.start as string;
    if (visitor?.present && visitor.org_id === school.orgId) {
      if (admin && !visitor.admin)
        await client.query(
          `INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on) VALUES($1,$2,$3,'admin',$4)`,
          [randomUUID(), visitor.person_id, school.orgId, year],
        );
      await client.query(
        "UPDATE amp_demo_visitors SET admin=$2,seen_at=now() WHERE account_id=$1",
        [input.accountId, admin],
      );
      return {
        orgId: school.orgId,
        classId: school.heroClassId,
        created: false,
      };
    }
    // Their place in an older school (or another zone's) ends now; it goes
    // with that school.
    if (visitor)
      await client.query(
        "UPDATE amp_people SET deleted_at=now() WHERE id=$1 AND demo_visitor AND deleted_at IS NULL",
        [visitor.person_id],
      );
    const person = randomUUID();
    await client.query(
      `INSERT INTO amp_people(id,tenant_id,given_name,handle,account_id,timezone,demo_visitor)
       VALUES($1,$2,$3,$4,$5,$6,true)`,
      [
        person,
        school.orgId,
        (await ownerName(client, input.accountId)) ?? "Teacher",
        generateHandle(),
        input.accountId,
        school.timezone,
      ],
    );
    await client.query(
      `INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on)
       SELECT gen_random_uuid(),$1,$2,r,$3::date FROM unnest($4::text[]) AS t(r)`,
      [person, school.orgId, year, admin ? ["admin", "teacher"] : ["teacher"]],
    );
    await client.query(
      `INSERT INTO amp_enrollments(id,class_id,person_id,role,begin_on) VALUES($1,$2,$3,'teacher',$4::date)`,
      [randomUUID(), school.heroClassId, person, year],
    );
    await client.query(
      `INSERT INTO amp_demo_visitors(account_id,timezone,admin,org_id,person_id)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(account_id) DO UPDATE SET timezone=EXCLUDED.timezone,admin=EXCLUDED.admin,
         org_id=EXCLUDED.org_id,person_id=EXCLUDED.person_id,seen_at=now()`,
      [input.accountId, school.timezone, admin, school.orgId, person],
    );
    return { orgId: school.orgId, classId: school.heroClassId, created: true };
  });
}

/** `POST /school/demo`: the caller joins their zone's shared school, as its
 * admin for a school or the hero class's teacher for a class. */
export async function joinDemo(
  pool: Pool,
  input: { accountId: string; kind: DemoKind; timezone?: string },
  learning?: Repository,
  now = Date.now(),
): Promise<DemoPlace> {
  const timezone = input.timezone ?? DEFAULT_DEMO_ZONE;
  const school = await demoSchool(pool, timezone, now, learning);
  const place = await placeVisitor(
    pool,
    { accountId: input.accountId, timezone, admin: input.kind === "school" },
    school,
  );
  void refreshPresence(pool, school.orgId).catch((error) =>
    console.error(JSON.stringify({ demoPresence: String(error) })),
  );
  return place!;
}

/** On a visitor's request: after the nightly switch, their place moves to
 * the zone's new school. Anyone else: one primary-key read. */
export async function followDemo(
  pool: Pool,
  accountId: string,
  now = Date.now(),
) {
  const visitor = (
    await pool.query(
      "SELECT timezone,admin,org_id,seen_at<now()-interval '1 hour' AS stale FROM amp_demo_visitors WHERE account_id=$1",
      [accountId],
    )
  ).rows[0];
  if (!visitor) return;
  const school = await currentSchool(pool, visitor.timezone, now);
  if (school && school.orgId !== visitor.org_id)
    await placeVisitor(
      pool,
      { accountId, timezone: visitor.timezone, admin: visitor.admin },
      school,
      true,
    );
  else if (visitor.stale)
    await pool.query(
      "UPDATE amp_demo_visitors SET seen_at=now() WHERE account_id=$1",
      [accountId],
    );
}

/** Where a visitor goes when what they asked for is in an older shared
 * school (still there or already removed): their current school's hero
 * class. Null for anything else, or for anyone who isn't a visitor. */
export async function movedDemoPath(
  pool: Pool,
  accountId: string,
  ref: { kind: string; orgId?: string; classId?: string; personId?: string },
): Promise<string | null> {
  const visitor = (
    await pool.query(
      `SELECT v.org_id,d.hero_class_id FROM amp_demo_visitors v
       JOIN amp_demo_schools d ON d.org_id=v.org_id AND d.removed_at IS NULL
       WHERE v.account_id=$1`,
      [accountId],
    )
  ).rows[0];
  if (!visitor) return null;
  const older = (
    await pool.query(
      `SELECT 1 FROM amp_demo_schools d WHERE d.org_id IS DISTINCT FROM $1 AND (
         d.org_id=$2::uuid OR $3::uuid=ANY(d.class_ids)
         OR d.org_id=(SELECT c.org_id FROM amp_classes c WHERE c.id=$3::uuid)
         OR d.org_id=(SELECT p.tenant_id FROM amp_people p WHERE p.id=$4::uuid))
       UNION ALL
       -- A student of a school already removed is gone without a trace.
       SELECT 1 WHERE $4::uuid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM amp_people p WHERE p.id=$4::uuid)
       LIMIT 1`,
      [
        visitor.org_id,
        uuidOrNull(ref.orgId),
        uuidOrNull(ref.classId),
        uuidOrNull(ref.personId),
      ],
    )
  ).rowCount;
  return older
    ? todayPath({ orgId: visitor.org_id, heroClassId: visitor.hero_class_id })
    : null;
}
const uuidOrNull = (value?: string) =>
  value &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;

/** `DELETE /school/demo`: the caller leaves the shared demo. */
export async function leaveDemo(pool: Pool, accountId: string) {
  return transaction(pool, async (client) => {
    const left = (
      await client.query(
        "DELETE FROM amp_demo_visitors WHERE account_id=$1 RETURNING person_id",
        [accountId],
      )
    ).rows[0];
    if (!left) return 0;
    await client.query(
      "UPDATE amp_people SET deleted_at=now() WHERE id=$1 AND demo_visitor AND deleted_at IS NULL",
      [left.person_id],
    );
    return 1;
  });
}

/** The hero class's "here today" moves with the clock on the school's own
 * day: the written sessions' last visits keep their distance from now. At
 * most every five minutes; sessions opened since (Practice as) are their
 * own. Yesterday's school, shown before 9:00, is left as it was: nobody is
 * here yet. */
export async function refreshPresence(pool: Pick<Pool, "query">, orgId: string) {
  await pool.query(
    `WITH old AS (
       SELECT built_at,presence_at FROM amp_demo_schools
       WHERE org_id=$1 AND presence_at<now()-interval '5 minutes'
         AND day=(now() AT TIME ZONE timezone)::date FOR UPDATE
     ), moved AS (
       UPDATE amp_demo_schools d SET presence_at=now() FROM old
       WHERE d.org_id=$1 RETURNING old.built_at,now()-old.presence_at AS gap
     )
     UPDATE amp_student_sessions s SET last_seen_at=s.last_seen_at+m.gap,expires_at=s.expires_at+m.gap
     FROM moved m,amp_people p
     WHERE p.tenant_id=$1 AND s.person_id=p.id AND s.created_at<m.built_at`,
    [orgId],
  );
}

/** New York, and the zones of visitors this week. */
export async function demoZones(pool: Pick<Pool, "query">) {
  const { rows } = await pool.query<{ timezone: string }>(
    `SELECT DISTINCT timezone FROM amp_demo_visitors
     WHERE seen_at>now()-make_interval(days=>$1) ORDER BY 1`,
    [ZONE_IDLE_DAYS],
  );
  return [...new Set([DEFAULT_DEMO_ZONE, ...rows.map((row) => row.timezone)])];
}

/** The zones' schools for now and for the day that begins within `ahead`,
 * each written from its weekday's shipped term. */
export async function warmDemoSchools(
  pool: Pool,
  options: {
    now?: number;
    timezones?: readonly string[];
    ahead?: number;
    learning?: Repository;
  } = {},
) {
  const now = options.now ?? Date.now();
  const timezones = options.timezones ?? (await demoZones(pool));
  const ahead = options.ahead ?? 3_600_000;
  const days = new Map<string, SharedDay>();
  for (const timezone of timezones)
    for (const at of [now, now + ahead]) {
      const day = sharedDay(at, timezone);
      days.set(`${timezone}\0${day.day}`, day);
    }
  // Terms are no longer kept in the database (`snapshot.ts`): what an older
  // release stored goes after a week, so a rollback within it still finds
  // its own.
  await pool.query(
    "DELETE FROM amp_demo_snapshots WHERE created_at<now()-interval '7 days'",
  );
  for (const day of days.values())
    await ensureSchool(pool, day, options.learning);
  for (const timezone of timezones) {
    const current = await currentSchool(pool, timezone, now);
    if (current) await refreshPresence(pool, current.orgId);
  }
  return retireSchools(pool, { now, timezones });
}

/** Removes the schools nobody is sent to any more, through the tree removal:
 * one older than its zone's current school, once the grace period after the
 * switch (9:00) has passed, and every school of a zone no longer written. */
export async function retireSchools(
  pool: Pool,
  options: { now?: number; timezones: readonly string[] },
) {
  const now = options.now ?? Date.now();
  const active = new Set(options.timezones);
  const { rows } = await pool.query<{
    timezone: string;
    day: string;
    org_id: string | null;
    built: boolean;
    claimed: boolean;
  }>(
    `SELECT timezone,day::text AS day,org_id,built_at IS NOT NULL AS built,
       COALESCE(building_until>now(),false) AS claimed
     FROM amp_demo_schools WHERE removed_at IS NULL AND org_id IS NOT NULL
     ORDER BY timezone,day`,
  );
  const currentDay = new Map<string, string>();
  for (const timezone of new Set(rows.map((row) => row.timezone))) {
    const current = await currentSchool(pool, timezone, now);
    if (current) currentDay.set(timezone, current.day);
  }
  let removed = 0;
  for (const row of rows) {
    const current = currentDay.get(row.timezone);
    const retired =
      // Left by a pod that stopped mid-write.
      (!row.built && !row.claimed) ||
      (row.built &&
        current !== undefined &&
        row.day < current &&
        now >= switchAt(current, row.timezone) + GRACE_MS) ||
      (row.built && !active.has(row.timezone) && row.day === current &&
        now >= switchAt(current, row.timezone) + 86_400_000);
    if (!retired) continue;
    try {
      await removeDemoOrg(pool, row.org_id!);
      // An unfinished write is written again from scratch if its day comes.
      await pool.query(
        row.built
          ? "UPDATE amp_demo_schools SET removed_at=now() WHERE timezone=$1 AND day=$2::date"
          : "UPDATE amp_demo_schools SET org_id=NULL WHERE timezone=$1 AND day=$2::date AND built_at IS NULL",
        [row.timezone, row.day],
      );
      removed++;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "55P03" && code !== "40P01") throw error;
      console.error(JSON.stringify({ demoSchoolRemovalSkipped: code }));
    }
  }
  // Old pointers only send stale links on; a month is plenty.
  await pool.query(
    "DELETE FROM amp_demo_schools WHERE removed_at<now()-interval '30 days'",
  );
  return { removed };
}

type Log = {
  info: (details: object, message: string) => void;
  warn: (details: object, message: string) => void;
};

/** The warmer's first run waits this long after the server listens, so a
 * school write never adds to the boot's own memory peak. */
const FIRST_WARM_MS = 60_000;

/** Keeps each zone's school written ahead of its day on this pod: a minute
 * after it starts, and every ten minutes. */
export function startDemoWarmer(pool: Pool, log: Log, learning?: Repository) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    const started = performance.now();
    try {
      const { removed } = await warmDemoSchools(pool, { learning });
      const ms = Math.round(performance.now() - started);
      if (ms > 1_000 || removed)
        log.info({ ms, removed }, "demo schools warmed");
    } catch (error) {
      log.warn(
        { reason: error instanceof Error ? error.message : "unknown" },
        "demo schools not warmed; a demo opened now waits for its school",
      );
    } finally {
      running = false;
    }
  };
  const first = setTimeout(() => void tick(), FIRST_WARM_MS);
  const timer = setInterval(() => void tick(), 10 * 60_000);
  first.unref();
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
