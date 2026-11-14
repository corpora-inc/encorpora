import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
import { activateClassPilot, startSchoolClass } from "../src/schools/pilots.js";
import {
  assertSignInOpen,
  classPractice,
  classRecheckQuery,
} from "../src/schools/pilot-access.js";
import { SchoolSignIn } from "../src/schools/sign-in.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

/*
 * CP-3 r4 H1: a class's `recheckAt` is the EARLIEST moment anything that
 * decides its practice, or the reader's access to it, can change: a
 * pilot's end, its grace, an extension; a license; a seat's grant; any of
 * its students' enrollments (here or in a class whose pilot covers them)
 * or student roles, at midnight in their school's own time zone; and the
 * reader's own role. Each boundary is set alone as the earliest, and the
 * server's answer must name it exactly.
 */
test(
  "a class's recheck moment is the earliest boundary that can change it",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `recheck_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href);
    const db = learning.pool;
    const schools = new SchoolRepository(db);
    const authenticate = refuseStudentTokens(async (request) => {
      const header = request.headers.authorization;
      if (header?.startsWith("Bearer ")) return header.slice(7);
      throw new ApiError(401, "Sign in to continue");
    });
    const app = buildApp({ repository: learning, authenticate });
    await registerSchoolRoutes(app, { pool: db, authenticate });
    await app.ready();
    t.after(async () => {
      await app.close();
      await learning.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    const teacher = "fixture-recheck-teacher";
    const start = (className: string, names: string[], orgId?: string) =>
      startSchoolClass(schools, teacher, {
        requestId: randomUUID(),
        schoolName: "Birchwood Elementary",
        ...(orgId ? { orgId } : {}),
        className,
        timezone: "UTC",
        signerName: "Rosa Lindqvist",
        signerTitle: "Teacher",
        agreementVersion: AGREEMENT_VERSION,
        authorized: true,
        names,
      });
    const { orgId, classId } = await start("Grade 4 Math", [
      "Ana Brook",
      "Ben Cole",
    ]);
    await activateClassPilot(schools, teacher, classId);
    const year = async (account = teacher, klass = classId) => {
      const read = await app.inject({
        method: "GET",
        url: `/api/v1/school/classes/${klass}/year`,
        headers: { authorization: `Bearer ${account}` },
      });
      assert.equal(read.statusCode, 200, read.body);
      return read.json() as {
        practice: string;
        recheckAt: string | null;
        serverNow: string;
      };
    };
    const day = 864e5;
    const at = (ms: number) => new Date(ms).toISOString();
    const now = Date.now();
    // The pilot runs on: its grace ends in 20 days, the only boundary.
    const graceEnd = new Date(Math.floor((now + 20 * day) / 1000) * 1000);
    await db.query(
      "UPDATE amp_teacher_pilots SET started_at=now()-interval '10 days',ends_at=now()-interval '1 day',grace_ends_at=$1",
      [graceEnd],
    );
    // Enrollments and roles began in the past, with no end.
    await db.query(
      "UPDATE amp_enrollments SET begin_on=current_date-30 WHERE class_id=$1",
      [classId],
    );
    await db.query(
      "UPDATE amp_org_roles SET begin_on=current_date-30 WHERE org_id=$1",
      [orgId],
    );
    let read = await year();
    assert.equal(read.practice, "open");
    assert.equal(read.recheckAt, at(graceEnd.getTime()), "the grace end");
    assert.ok(Date.parse(read.serverNow) <= Date.now() + 1000);

    // An extension's own end is a boundary too, here the earliest.
    const pilotId = (
      await db.query("SELECT id FROM amp_teacher_pilots LIMIT 1")
    ).rows[0].id as string;
    const extension = new Date(Math.floor((now + 10 * day) / 1000) * 1000);
    await db.query(
      "INSERT INTO amp_pilot_extensions(id,pilot_id,until_at,reason,operator_reference) VALUES(gen_random_uuid(),$1,$2,'fixture','fixture')",
      [pilotId, extension],
    );
    read = await year();
    assert.equal(read.recheckAt, at(extension.getTime()), "the extension");

    const ana = (
      await db.query(
        "SELECT id FROM amp_people WHERE given_name='Ana' AND family_name='Brook'",
      )
    ).rows[0].id as string;
    // Ana's enrollment ends sooner, at midnight in the school's time zone.
    for (const zone of ["UTC", "America/New_York", "Pacific/Kiritimati"]) {
      await db.query("UPDATE amp_orgs SET timezone=$2 WHERE id=$1", [
        orgId,
        zone,
      ]);
      await db.query(
        "UPDATE amp_enrollments SET end_on=((now() AT TIME ZONE $3)::date+5) WHERE class_id=$1 AND person_id=$2",
        [classId, ana, zone],
      );
      const expected = (
        await db.query(
          "SELECT (((now() AT TIME ZONE $1)::date+5)::timestamp AT TIME ZONE $1) AS t",
          [zone],
        )
      ).rows[0].t as Date;
      read = await year();
      assert.equal(
        read.recheckAt,
        at(expected.getTime()),
        `Ana's enrollment end, at midnight in ${zone}`,
      );
    }
    await db.query("UPDATE amp_orgs SET timezone='UTC' WHERE id=$1", [orgId]);
    // Her student role ends sooner still.
    await db.query(
      "UPDATE amp_org_roles SET end_on=current_date+3 WHERE person_id=$1 AND role='student'",
      [ana],
    );
    read = await year();
    assert.equal(
      read.recheckAt,
      at(
        (
          await db.query(
            "SELECT ((now() AT TIME ZONE 'UTC')::date+3)::timestamp AT TIME ZONE 'UTC' AS t",
          )
        ).rows[0].t.getTime(),
      ),
      "Ana's student role end",
    );
    // A license that ends sooner than all of that.
    const licenseEnd = new Date(Math.floor((now + 2 * day) / 1000) * 1000);
    await schools.issueLicense({
      orgId,
      seats: 5,
      endsAt: licenseEnd.toISOString(),
    });
    read = await year();
    assert.equal(read.recheckAt, at(licenseEnd.getTime()), "the license end");
    // A seat's grant for Ben ending in a day.
    const ben = (
      await db.query(
        "SELECT learner_id FROM amp_people WHERE given_name='Ben' AND family_name='Cole'",
      )
    ).rows[0].learner_id as string;
    const grantEnd = new Date(Math.floor((now + day) / 1000) * 1000);
    await db.query(
      `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,starts_at,ends_at,status)
       VALUES($1,$2,'stripe','fixture',now()-interval '1 day',$3,'active')`,
      [`fixture-grant-${randomUUID()}`, ben, grantEnd],
    );
    read = await year();
    assert.equal(read.recheckAt, at(grantEnd.getTime()), "Ben's grant end");
    // Ana is also in another class (its pilot can cover her), and that
    // enrollment ends at the next midnight.
    const other = await start("Math support", [], orgId);
    await db.query(
      `INSERT INTO amp_enrollments(id,class_id,person_id,role,begin_on,end_on)
       VALUES(gen_random_uuid(),$1,$2,'student',current_date-1,current_date+1)`,
      [other.classId, ana],
    );
    read = await year();
    assert.equal(
      read.recheckAt,
      at(
        (
          await db.query(
            "SELECT ((now() AT TIME ZONE 'UTC')::date+1)::timestamp AT TIME ZONE 'UTC' AS t",
          )
        ).rows[0].t.getTime(),
      ),
      "her other class's enrollment end",
    );
    // A viewer whose own role ends at the next midnight: earlier for them
    // alone, once nothing of the class's ends that soon.
    const viewer = "fixture-recheck-viewer";
    await schools.addStaff({
      orgId,
      role: "viewer",
      givenName: "Theo",
      accountId: viewer,
    });
    await db.query(
      `UPDATE amp_org_roles SET begin_on=current_date-1,end_on=current_date+1
       WHERE role='viewer' AND person_id=(SELECT id FROM amp_people WHERE account_id=$1)`,
      [viewer],
    );
    await db.query(
      `UPDATE amp_enrollments SET end_on=current_date+2 WHERE class_id=$1 AND person_id=$2`,
      [other.classId, ana],
    );
    const viewerRead = await year(viewer);
    const teacherRead = await year();
    assert.ok(
      Date.parse(viewerRead.recheckAt!) < Date.parse(teacherRead.recheckAt!),
      "the reader's own role end is theirs alone",
    );
  },
);

/*
 * CP-3 r5: a date flips where the gate reads it, not where its row lives.
 * A student role held at a UTC district flips, for a class in its
 * Pacific/Kiritimati school, at Kiritimati's midnight (as the pilot gate
 * reads it), fourteen hours sooner; a day that begins twice (America/Havana
 * falls back at midnight) flips at its first midnight; and a Clever
 * administrator's bootstrap authority is the reader's own boundary. Each
 * expected instant comes from an independent minute-by-minute search.
 */
test(
  "boundaries flip where the gate reads them: ancestor roles, repeated midnights, Clever authority",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `recheck_zones_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href);
    const db = learning.pool;
    const schools = new SchoolRepository(db);
    const authenticate = refuseStudentTokens(async (request) => {
      const header = request.headers.authorization;
      if (header?.startsWith("Bearer ")) return header.slice(7);
      throw new ApiError(401, "Sign in to continue");
    });
    const app = buildApp({ repository: learning, authenticate });
    await registerSchoolRoutes(app, { pool: db, authenticate });
    await app.ready();
    t.after(async () => {
      await app.close();
      await learning.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    const agreement = {
      version: AGREEMENT_VERSION,
      signerName: "Marta Okafor",
      signerTitle: "Superintendent",
    };
    const recheck = async (account: string, classId: string) => {
      const read = await app.inject({
        method: "GET",
        url: `/api/v1/school/classes/${classId}/year`,
        headers: { authorization: `Bearer ${account}` },
      });
      assert.equal(read.statusCode, 200, read.body);
      return (read.json() as { recheckAt: string | null }).recheckAt;
    };
    /** The first minute whose local date in `tz` is `d`: the oracle. */
    const firstMinute = async (d: string, tz: string) =>
      (
        (
          await db.query(
            `SELECT min(t) AS t FROM generate_series(($1::date - 1)::timestamp AT TIME ZONE 'UTC' - interval '1 day',
               ($1::date + 1)::timestamp AT TIME ZONE 'UTC' + interval '1 day', interval '1 minute') t
             WHERE (t AT TIME ZONE $2)::date >= $1::date`,
            [d, tz],
          )
        ).rows[0].t as Date
      ).toISOString();

    // A UTC district, its Kiritimati school, a class there.
    const district = await schools.createOrg(
      { kind: "district", name: "Lake District", timezone: "UTC" },
      agreement,
    );
    const school = await schools.createOrg(
      {
        kind: "school",
        name: "Line Islands School",
        timezone: "Pacific/Kiritimati",
        parentId: district.id,
      },
      agreement,
    );
    const klass = await schools.createClass(school.id, { name: "Grade 4" });
    const reader = "fixture-zones-teacher";
    await schools.addStaff({
      orgId: school.id,
      role: "teacher",
      givenName: "Rosa",
      accountId: reader,
      classId: klass.id,
    });
    const pupil = await schools.provisionStudent(school.id, {
      givenName: "Ana",
      classId: klass.id,
    });
    const roleEnd = (await db.query("SELECT (current_date + 40)::text AS d"))
      .rows[0].d as string;
    // Her student role is the district's, ending in 40 days; the rest of
    // her dates are open and long begun.
    // Everyone's dates long begun (a "today" written in Kiritimati is
    // tomorrow in UTC, an honest boundary that would mask the one tested).
    await db.query("UPDATE amp_enrollments SET begin_on=current_date-30");
    await db.query(
      "UPDATE amp_org_roles SET org_id=$2,begin_on=current_date-30,end_on=$3 WHERE person_id=$1 AND role='student'",
      [pupil.personId, district.id, roleEnd],
    );
    await db.query(
      "UPDATE amp_org_roles SET begin_on=current_date-30 WHERE person_id<>$1",
      [pupil.personId],
    );
    const kiritimati = await firstMinute(roleEnd, "Pacific/Kiritimati");
    assert.ok(kiritimati < (await firstMinute(roleEnd, "UTC")));
    assert.equal(
      await recheck(reader, klass.id),
      kiritimati,
      "the district role flips at the class's school's midnight, the earlier",
    );

    // A day that begins twice: Havana falls back at midnight on
    // 2027-11-07. Her enrollment ends that day; nothing else sooner (the
    // class's session runs on past it).
    await db.query(
      "UPDATE amp_orgs SET timezone='America/Havana' WHERE id=$1",
      [school.id],
    );
    await db.query(
      "UPDATE amp_academic_sessions SET ends_on='2028-06-30' WHERE id=(SELECT session_id FROM amp_classes WHERE id=$1)",
      [klass.id],
    );
    await db.query("UPDATE amp_org_roles SET end_on=NULL WHERE person_id=$1", [
      pupil.personId,
    ]);
    await db.query(
      "UPDATE amp_enrollments SET end_on='2027-11-07' WHERE person_id=$1 AND class_id=$2",
      [pupil.personId, klass.id],
    );
    const havana = await firstMinute("2027-11-07", "America/Havana");
    const direct = (
      (
        await db.query(
          "SELECT ('2027-11-07'::timestamp AT TIME ZONE 'America/Havana') AS t",
        )
      ).rows[0].t as Date
    ).toISOString();
    assert.notEqual(havana, direct, "the fixture's midnight really repeats");
    assert.equal(
      await recheck(reader, klass.id),
      havana,
      "the first midnight, not the repeated one",
    );

    // A Clever administrator whose bootstrap authority ends in an hour:
    // their own boundary, sooner than anything of the class's.
    const cleverAdmin = "fixture-zones-clever-admin";
    await schools.addStaff({
      orgId: district.id,
      role: "admin",
      givenName: "Ines",
      accountId: cleverAdmin,
    });
    await db.query(
      "UPDATE amp_org_roles SET begin_on=current_date-30 WHERE person_id=(SELECT id FROM amp_people WHERE account_id=$1)",
      [cleverAdmin],
    );
    const connection = randomUUID();
    const run = randomUUID();
    await db.query(
      "INSERT INTO amp_clever_connections(id,environment,district_id,tenant_id) VALUES($1,'sandbox',$2,$3)",
      [connection, "a".repeat(24), district.id],
    );
    await db.query(
      "INSERT INTO amp_clever_sync_runs(id,connection_id,mode,status) VALUES($1,$2,'full','succeeded')",
      [run, connection],
    );
    // Their Clever account still says district administrator: the
    // bootstrap's end is what can end their authority.
    await db.query(
      `INSERT INTO amp_clever_bindings(connection_id,kind,clever_id,local_id,record,metadata,last_seen_run_id)
       SELECT $1,'user','fixture-zones-admin',p.id,'{}','{"roles":["district_admin"]}',$2
       FROM amp_people p WHERE p.account_id=$3`,
      [connection, run, cleverAdmin],
    );
    const bootstrapEnd = new Date(
      Math.floor((Date.now() + 3_600_000) / 1000) * 1000,
    );
    await db.query(
      `INSERT INTO amp_clever_memberships(connection_id,kind,source_key,local_id,owned,last_seen_run_id,bootstrap_valid_until)
       SELECT $1,'org_role','fixture',r.id,true,$2,$3 FROM amp_org_roles r
       JOIN amp_people p ON p.id=r.person_id WHERE p.account_id=$4 AND r.role='admin'`,
      [connection, run, bootstrapEnd, cleverAdmin],
    );
    assert.equal(
      await recheck(cleverAdmin, klass.id),
      bootstrapEnd.toISOString(),
      "the administrator's bootstrap authority",
    );
    // And it is theirs alone.
    assert.equal(await recheck(reader, klass.id), havana);
  },
);

test(
  "the gate, the recheck moment and the clock are read in one snapshot (CP-3 r5)",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `recheck_snapshot_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const db = new Pool({ connectionString: scoped.href, max: 2 });
    t.after(async () => {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    const schools = new SchoolRepository(db);
    const { classId } = await startSchoolClass(schools, "fixture-snapshot", {
      requestId: randomUUID(),
      schoolName: "Birchwood Elementary",
      className: "Grade 4 Math",
      timezone: "UTC",
      signerName: "Rosa Lindqvist",
      signerTitle: "Teacher",
      agreementVersion: AGREEMENT_VERSION,
      authorized: true,
      names: ["Ana Brook"],
    });
    await activateClassPilot(schools, "fixture-snapshot", classId);
    // Every statement on one connection, inside one repeatable-read
    // transaction: `now()` is the same instant for the gate, the moment
    // and the clock, so a boundary can't fall between them.
    const seen: string[] = [];
    const watched = {
      connect: async () => {
        const client = await db.connect();
        return new Proxy(client, {
          get(target, key) {
            if (key === "query")
              return (text: string, ...rest: unknown[]) => {
                seen.push(
                  String(text).trim().split(/\s+/).slice(0, 3).join(" "),
                );
                return (target.query as (...args: unknown[]) => unknown)(
                  text,
                  ...rest,
                );
              };
            const value = Reflect.get(target, key);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      },
    };
    const state = await classPractice(watched as never, classId, null);
    assert.equal(seen[0], "BEGIN ISOLATION LEVEL");
    assert.equal(seen.at(-1), "COMMIT");
    assert.ok(seen.length >= 5, "the gate, the moment and the clock inside");
    assert.equal(state.gate, null, "practice runs");
    const ends = (
      await db.query("SELECT grace_ends_at FROM amp_teacher_pilots")
    ).rows[0].grace_ends_at as Date;
    assert.ok(
      Date.parse(state.recheckAt!) <= ends.getTime(),
      "the moment is no later than the pilot's end",
    );
    assert.ok(Date.parse(state.serverNow) < Date.parse(state.recheckAt!));
  },
);

/** A schema whose `now()` (and `current_date`) is a clock the test sets:
 * a `now()` in the schema, ahead of pg_catalog on the search path, reading
 * one row. Column defaults keep the real clock (bound when migrated). A
 * repeatable-read snapshot sees the clock as it was at its first read. */
async function clockedSchema(prefix: string) {
  const url = process.env.AMP_TEST_DATABASE_URL!;
  assertTestDatabaseTarget(url);
  const schema = `${prefix}_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  const plain = new URL(url);
  plain.searchParams.set("options", `-c search_path=${schema}`);
  await admin.query(`CREATE SCHEMA ${schema}`);
  await migrate(plain.href);
  await admin.query(
    `CREATE TABLE ${schema}.test_clock(at timestamptz NOT NULL);
     INSERT INTO ${schema}.test_clock VALUES(now());
     CREATE FUNCTION ${schema}.now() RETURNS timestamptz LANGUAGE sql STABLE
       AS $$ SELECT at FROM ${schema}.test_clock $$;`,
  );
  const clocked = new URL(url);
  clocked.searchParams.set("options", `-c search_path=${schema},pg_catalog`);
  const learning = new PostgresRepository(clocked.href);
  const db = learning.pool;
  // `current_date` is a keyword, not a function: read it from the clock.
  const timed = (text: unknown) =>
    typeof text === "string"
      ? text.replace(
          /\bcurrent_date\b/gi,
          "(now() AT TIME ZONE current_setting('TimeZone'))::date",
        )
      : text;
  const listeners: ((text: string) => Promise<void>)[] = [];
  const watch = (target: { query: (...args: never[]) => unknown }) => {
    const raw = target.query.bind(target) as (...args: unknown[]) => unknown;
    return async (text: unknown, ...rest: unknown[]) => {
      const result = await raw(timed(text), ...rest);
      for (const listener of listeners) await listener(String(text));
      return result;
    };
  };
  (db as { query: unknown }).query = watch(db as never);
  const connect = db.connect.bind(db) as (callback?: unknown) => unknown;
  // pg's own pool.query connects with a callback: that path is left alone
  // (its statement was already rewritten above).
  (db as { connect: unknown }).connect = (callback?: unknown) => {
    if (callback) return connect(callback);
    return (connect() as Promise<object>).then((client) => {
      const query = watch(client as never);
      return new Proxy(client, {
        get(target, key) {
          if (key === "query") return query;
          const value = Reflect.get(target, key);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    });
  };
  return {
    learning,
    db,
    /** Set from outside every snapshot. */
    clock: (at: string) =>
      admin.query(`UPDATE ${schema}.test_clock SET at=$1`, [at]),
    /** Runs after each statement the app sends. */
    afterQuery: (listener: (text: string) => Promise<void>) =>
      listeners.push(listener),
    close: async () => {
      await learning.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    },
  };
}

async function clockedApp(fixture: Awaited<ReturnType<typeof clockedSchema>>) {
  const authenticate = refuseStudentTokens(async (request) => {
    const header = request.headers.authorization;
    if (header?.startsWith("Bearer ")) return header.slice(7);
    throw new ApiError(401, "Sign in to continue");
  });
  const app = buildApp({ repository: fixture.learning, authenticate });
  await registerSchoolRoutes(app, { pool: fixture.db, authenticate });
  await app.ready();
  return app;
}

/* CP-3 r6 H2: the class's academic session ending closes sign-in for its
 * students (`/join` refuses the code), and so the gate, the code, the cards
 * and the recheck moment all say so at that same instant. */
test(
  "a class whose session ends closes its code at the moment /join refuses it",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const fixture = await clockedSchema("recheck_session");
    const app = await clockedApp(fixture);
    t.after(async () => {
      await app.close();
      await fixture.close();
    });
    const { db } = fixture;
    const schools = new SchoolRepository(db);
    const teacher = "fixture-session-teacher";
    const { orgId, classId } = await startSchoolClass(schools, teacher, {
      requestId: randomUUID(),
      schoolName: "Birchwood Elementary",
      className: "Grade 4 Math",
      timezone: "UTC",
      signerName: "Rosa Lindqvist",
      signerTitle: "Teacher",
      agreementVersion: AGREEMENT_VERSION,
      authorized: true,
      names: ["Ana Brook", "Ben Cole"],
    });
    await activateClassPilot(schools, teacher, classId);
    // The pilot covers its students through April 15; the class's session
    // ends March 14.
    await fixture.clock("2027-03-14T12:00:00Z");
    await db.query(
      "UPDATE amp_teacher_pilots SET started_at='2027-01-01T00:00:00Z',ends_at='2027-02-01T00:00:00Z',grace_ends_at='2027-04-15T00:00:00Z'",
    );
    await db.query("UPDATE amp_enrollments SET begin_on='2026-01-01'");
    await db.query("UPDATE amp_org_roles SET begin_on='2026-01-01'");
    await db.query(
      "UPDATE amp_academic_sessions SET starts_on='2026-08-01',ends_on='2027-03-14' WHERE org_id=$1",
      [orgId],
    );
    const read = async (path: string) => {
      const reply = await app.inject({
        method: "GET",
        url: `/api/v1/school/classes/${classId}/${path}`,
        headers: { authorization: `Bearer ${teacher}` },
      });
      assert.equal(reply.statusCode, 200, reply.body);
      return reply.json();
    };
    const code = (
      await db.query("SELECT join_code FROM amp_classes WHERE id=$1", [classId])
    ).rows[0].join_code as string;
    const signIn = new SchoolSignIn(schools);

    await fixture.clock("2027-03-14T23:59:59Z");
    let year = await read("year");
    assert.equal(year.practice, "open");
    assert.equal(year.recheckAt, "2027-03-15T00:00:00.000Z", "the session end");
    let presence = (await read("presence")).class;
    assert.equal(presence.joinCode, code);
    assert.equal(presence.codeAvailable, true);
    await signIn.liveClass(code);
    await assertSignInOpen(db, classId);

    await fixture.clock("2027-03-15T00:00:00Z");
    await assert.rejects(signIn.liveClass(code), {
      statusCode: 404,
      code: "class_not_found",
    });
    year = await read("year");
    assert.equal(year.practice, "ended", "the gate closes with /join");
    presence = (await read("presence")).class;
    assert.equal(presence.joinCode, "");
    assert.equal(presence.codeAvailable, false);
    await assert.rejects(assertSignInOpen(db, classId), {
      statusCode: 409,
      code: "practice_closed",
    });
  },
);

/* CP-3 r6 H1: the reader's authority is read in the same snapshot as the
 * class's practice. A Clever administrator's bootstrap ends at 12:00:15;
 * the clock reaches it just after their roles are read. The answer is
 * either all before (their authority, with that moment to ask again) or
 * all after (refused): never their authority with a later moment. */
test(
  "the reader's authority, the gate and the recheck moment come from one snapshot",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const fixture = await clockedSchema("recheck_authority");
    const app = await clockedApp(fixture);
    t.after(async () => {
      await app.close();
      await fixture.close();
    });
    const { db } = fixture;
    const schools = new SchoolRepository(db);
    await fixture.clock("2027-03-14T12:00:00Z");
    const { orgId, classId } = await startSchoolClass(
      schools,
      "fixture-authority-teacher",
      {
        requestId: randomUUID(),
        schoolName: "Birchwood Elementary",
        className: "Grade 4 Math",
        timezone: "UTC",
        signerName: "Rosa Lindqvist",
        signerTitle: "Teacher",
        agreementVersion: AGREEMENT_VERSION,
        authorized: true,
        names: ["Ana Brook"],
      },
    );
    await activateClassPilot(schools, "fixture-authority-teacher", classId);
    await db.query(
      "UPDATE amp_teacher_pilots SET started_at='2027-01-01T00:00:00Z',ends_at='2027-02-01T00:00:00Z',grace_ends_at='2027-04-15T00:00:00Z'",
    );
    await db.query("UPDATE amp_enrollments SET begin_on='2026-01-01'");
    await db.query(
      "UPDATE amp_academic_sessions SET starts_on='2026-08-01',ends_on='2027-07-31' WHERE org_id=$1",
      [orgId],
    );
    const cleverAdmin = "fixture-authority-clever-admin";
    await schools.addStaff({
      orgId,
      role: "admin",
      givenName: "Ines",
      accountId: cleverAdmin,
    });
    await db.query("UPDATE amp_org_roles SET begin_on='2026-01-01'");
    const connection = randomUUID();
    const run = randomUUID();
    await db.query(
      "INSERT INTO amp_clever_connections(id,environment,district_id,tenant_id) VALUES($1,'sandbox',$2,$3)",
      [connection, "b".repeat(24), orgId],
    );
    await db.query(
      "INSERT INTO amp_clever_sync_runs(id,connection_id,mode,status) VALUES($1,$2,'full','succeeded')",
      [run, connection],
    );
    await db.query(
      `INSERT INTO amp_clever_bindings(connection_id,kind,clever_id,local_id,record,metadata,last_seen_run_id)
       SELECT $1,'user','fixture-admin',p.id,'{}','{"roles":["district_admin"]}',$2
       FROM amp_people p WHERE p.account_id=$3`,
      [connection, run, cleverAdmin],
    );
    await db.query(
      `INSERT INTO amp_clever_memberships(connection_id,kind,source_key,local_id,owned,last_seen_run_id,bootstrap_valid_until)
       SELECT $1,'org_role','fixture',r.id,true,$2,'2027-03-14T12:00:15Z' FROM amp_org_roles r
       JOIN amp_people p ON p.id=r.person_id WHERE p.account_id=$3 AND r.role='admin'`,
      [connection, run, cleverAdmin],
    );
    const year = () =>
      app.inject({
        method: "GET",
        url: `/api/v1/school/classes/${classId}/year`,
        headers: { authorization: `Bearer ${cleverAdmin}` },
      });
    await fixture.clock("2027-03-14T12:00:14Z");
    let reply = await year();
    assert.equal(reply.statusCode, 200, reply.body);
    assert.equal(reply.json().recheckAt, "2027-03-14T12:00:15.000Z");
    // The clock reaches the bootstrap's end right after the reader's roles
    // are read, before anything of the class's.
    let crossed = false;
    fixture.afterQuery(async (text) => {
      if (!crossed && text.includes("amp_school_role_current")) {
        crossed = true;
        await fixture.clock("2027-03-14T12:00:15Z");
      }
    });
    reply = await year();
    assert.ok(crossed);
    if (reply.statusCode === 200)
      assert.equal(
        reply.json().recheckAt,
        "2027-03-14T12:00:15.000Z",
        "authority read before the end asks again at the end",
      );
    else assert.equal(reply.statusCode, 404);
    // Read again after the end: refused.
    reply = await year();
    assert.equal(reply.statusCode, 404);
  },
);

/* CP-3 r6 M1: the recheck read's work is bounded by the class's roster and
 * the reader's own roles: rows of unrelated people, classes and Clever
 * memberships are never visited, however many there are. */
test(
  "the recheck read visits only the class's own people",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `recheck_plan_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const db = new Pool({ connectionString: scoped.href, max: 1 });
    t.after(async () => {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    const schools = new SchoolRepository(db);
    const teacher = "fixture-plan-teacher";
    const { orgId, classId } = await startSchoolClass(schools, teacher, {
      requestId: randomUUID(),
      schoolName: "Birchwood Elementary",
      className: "Grade 4 Math",
      timezone: "UTC",
      signerName: "Rosa Lindqvist",
      signerTitle: "Teacher",
      agreementVersion: AGREEMENT_VERSION,
      authorized: true,
      names: ["Ana Brook", "Ben Cole"],
    });
    await activateClassPilot(schools, teacher, classId);
    // A large district beside it: 20,000 unrelated people, each enrolled in
    // an unrelated class with a student role, a released seat and a grant,
    // and 20,000 unrelated Clever memberships.
    const N = 20_000;
    await db.query(
      `WITH other AS (
         INSERT INTO amp_orgs(id,kind,name,timezone,path)
         SELECT gen_random_uuid(),'school','Unrelated','UTC','{}' RETURNING id)
       UPDATE amp_orgs o SET path=ARRAY[o.id] FROM other WHERE o.id=other.id`,
    );
    const other = (
      await db.query("SELECT id FROM amp_orgs WHERE name='Unrelated'")
    ).rows[0].id as string;
    const otherClass = randomUUID();
    await db.query(
      `INSERT INTO amp_classes(id,org_id,name,join_code,session_id)
       SELECT $1,$2,'Unrelated class','UNRELATED-PLAN',session_id FROM amp_classes WHERE id=$3`,
      [otherClass, other, classId],
    );
    await db.query(
      `INSERT INTO amp_people(id,tenant_id,given_name,family_name,handle,timezone)
       SELECT gen_random_uuid(),$1,'Unrelated',g::text,'unrelated-'||g,'UTC'
       FROM generate_series(1,$2) g`,
      [other, N],
    );
    await db.query(
      `INSERT INTO amp_enrollments(id,person_id,class_id,role,begin_on)
       SELECT gen_random_uuid(),id,$1,'student',current_date-30 FROM amp_people WHERE given_name='Unrelated'`,
      [otherClass],
    );
    await db.query(
      `INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on)
       SELECT gen_random_uuid(),id,$1,'student',current_date-30 FROM amp_people WHERE given_name='Unrelated'`,
      [other],
    );
    const connection = randomUUID();
    const run = randomUUID();
    await db.query(
      "INSERT INTO amp_clever_connections(id,environment,district_id,tenant_id) VALUES($1,'sandbox',$2,$3)",
      [connection, "c".repeat(24), other],
    );
    await db.query(
      "INSERT INTO amp_clever_sync_runs(id,connection_id,mode,status) VALUES($1,$2,'full','succeeded')",
      [run, connection],
    );
    await db.query(
      `INSERT INTO amp_clever_memberships(connection_id,kind,source_key,local_id,owned,last_seen_run_id,bootstrap_valid_until)
       SELECT $1,'org_role',r.id::text,r.id,g%2=0,$2,now()+interval '1 day'
       FROM amp_org_roles r, generate_series(0,0) g WHERE r.org_id=$3`,
      [connection, run, other],
    );
    await db.query("ANALYZE");
    // An administrator of the school reads it (their own Clever
    // membership is the one that can matter).
    const viewer = "fixture-plan-admin";
    await schools.addStaff({
      orgId,
      role: "admin",
      givenName: "Vera",
      accountId: viewer,
    });
    const { text, values } = classRecheckQuery(classId, viewer);
    const plan = (
      await db.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${text}`, values)
    ).rows[0]["QUERY PLAN"][0].Plan;
    // Rows each relation was read for, filtered ones included.
    const visited = new Map<string, number>();
    const walk = (node: Record<string, unknown>) => {
      const relation = node["Relation Name"] as string | undefined;
      if (relation) {
        const rows =
          ((node["Actual Rows"] as number) +
            ((node["Rows Removed by Filter"] as number) ?? 0) +
            ((node["Rows Removed by Index Recheck"] as number) ?? 0)) *
          ((node["Actual Loops"] as number) ?? 1);
        visited.set(relation, (visited.get(relation) ?? 0) + rows);
      }
      for (const child of (node.Plans as Record<string, unknown>[]) ?? [])
        walk(child);
    };
    walk(plan);
    for (const [relation, rows] of visited)
      assert.ok(
        rows < 1_000,
        `${relation}: ${rows} rows read for a class of two (${JSON.stringify([...visited])})`,
      );
  },
);
