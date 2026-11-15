import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { schoolAdmin } from "../scripts/school-admin.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { applyRoster, planRoster } from "../src/schools/reconcile.js";
import { registerSchoolRoutes, schoolRoutes } from "../src/schools/routes.js";
import {
  csvRows,
  namedStudentId,
  guessMapping,
  readTable,
} from "../src/schools/sources/csv.js";
import { invitationProvesAddress } from "../src/schools/staff-account.js";
import {
  rosterRowSchema,
  nameKey,
  type RosterRow,
} from "../src/schools/sources/rows.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

const FIRST = ["Ana", "Noor", "Lena", "Diego", "Mei", "Theo", "Hana", "Owen"];
const LAST = ["Ruiz", "Haddad", "Fischer", "Salas", "Tran", "Lind", "Sato"];

/** A realistic roster: `count` students in classes of about 25, in grades 3 to
 * 8, with a teacher per class. */
function fixtureRoster(count: number, prefix = "s"): RosterRow[] {
  const rows: RosterRow[] = [];
  const classes = Math.ceil(count / 25);
  for (let index = 0; index < count; index++) {
    const klass = index % classes;
    rows.push(
      rosterRowSchema.parse({
        line: index + 2,
        role: "student",
        sourcedId: `${prefix.toUpperCase()}-${index}`,
        identifier: `${prefix.toUpperCase()}-${index}`,
        givenName: FIRST[index % FIRST.length],
        familyName: `${LAST[index % LAST.length]}${index}`,
        gradeLevel: 3 + (klass % 6),
        classes: [
          {
            sourcedId: `name:${nameKey(`Section ${klass}`)}`,
            name: `Section ${klass}`,
            courseBands: [String(3 + (klass % 6))],
          },
        ],
      }),
    );
  }
  return rows;
}

test(
  "AMP for Schools: setup, roster import, seats, invites, staff",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_roster_${randomUUID().replaceAll("-", "")}`;
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
      if (header?.startsWith("Bearer amp|")) return header.slice(7);
      throw new ApiError(401, "Sign in to continue");
    });
    const mail: { to: string; subject: string; text: string; url: string }[] =
      [];
    const services = {
      secret: "fixture-secret-fixture-secret-fixture-secret",
      origin: "https://amp.example",
      mail: async (to: string, subject: string, text: string, link: string) => {
        mail.push({ to, subject, text, url: link });
      },
    };
    const app = buildApp({ repository: learning, authenticate });
    await registerFamilyRoutes(app, { pool: db, authenticate });
    await registerSchoolRoutes(app, {
      pool: db,
      authenticate,
      services: {
        ...services,
        signIn: { google: "google-client", microsoft: "ms-client" },
      },
    });
    await app.ready();
    t.after(async () => {
      await app.close();
      await learning.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });

    const as = (account: string) => ({ authorization: `Bearer ${account}` });
    const get = (path: string, account: string) =>
      app.inject({ method: "GET", url: path, headers: as(account) });
    const post = (path: string, account: string, payload: object = {}) =>
      app.inject({ method: "POST", url: path, headers: as(account), payload });
    const user = async (email: string, verified = false) => {
      const id = randomUUID();
      await db.query(
        `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
         VALUES($1,'',$2,$3,now(),now())`,
        [id, email, verified],
      );
      return `amp|${id}`;
    };
    const SEATS = 30;
    const day = (offset: number) =>
      new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    type Issued = {
      orgId: string;
      licenseId: string;
      adminPersonId: string;
      created: boolean;
      mailed: boolean;
      setupUrl: string;
    };
    /** What an operator runs after a contract and invoice, or for a pilot. */
    const issue = async (name: string, adminEmail: string, seats = SEATS) =>
      (await schoolAdmin(
        schools,
        "create-school",
        {
          name,
          adminEmail,
          seats,
          startsOn: day(-1),
          endsOn: day(365),
          reference: "Pilot",
        },
        services,
      )) as Issued;
    const linkParts = (url: string) => {
      const [token, proof] = url.split("#")[1]!.split(".");
      return { token: token!, proof: proof! };
    };
    /** The school issued to this account's address, its invitation accepted,
     * then setup's routes, as the first-run screens call them. */
    async function setUp(
      account: string,
      name: string,
      shape = "school",
      seats = SEATS,
    ) {
      const email = (
        await db.query("SELECT email FROM amp_auth_users WHERE id=$1", [
          account.slice(4),
        ])
      ).rows[0].email as string;
      const issued = await issue(name, email, seats);
      const accepted = await post("/api/v1/school/invites/accept", account, {
        ...linkParts(issued.setupUrl),
        name: "Grace Okafor",
      });
      assert.equal(accepted.statusCode, 200, accepted.body);
      assert.deepEqual(accepted.json(), {
        accepted: true,
        orgId: issued.orgId,
        setup: true,
      });
      const orgId = issued.orgId;
      const base = `/api/v1/school/orgs/${orgId}`;
      if (shape === "class")
        assert.equal(
          (
            await post(`${base}/setup/school`, account, {
              name,
              shape,
              timezone: "America/New_York",
            })
          ).statusCode,
          200,
        );
      assert.equal(
        (
          await post(`${base}/calendar`, account, {
            startsOn: "2026-08-15",
            endsOn: "2027-06-15",
            division: "semester",
          })
        ).statusCode,
        200,
      );
      assert.equal(
        (await post(`${base}/setup/experience`, account, { preset: "quiet" }))
          .statusCode,
        200,
      );
      assert.equal(
        (
          await post(`${base}/setup/agreement`, account, {
            version: AGREEMENT_VERSION,
            signerName: "Grace Okafor",
            signerTitle: "Head of School",
          })
        ).statusCode,
        200,
      );
      return { orgId, base };
    }
    const planAll = async (
      base: string,
      account: string,
      rows: RosterRow[],
      source = "csv",
    ) => {
      const results: {
        line: number;
        status: string;
        reason?: string;
        existing?: string;
      }[] = [];
      for (let start = 0; start < rows.length; start += 500) {
        const response = await post(`${base}/roster/plan`, account, {
          source,
          rows: rows.slice(start, start + 500),
        });
        assert.equal(response.statusCode, 200, response.body);
        results.push(...response.json().results);
      }
      return results;
    };
    const applyAll = async (
      base: string,
      account: string,
      rows: RosterRow[],
      extra: object = {},
    ) => {
      const results: { line: number; status: string; seated?: boolean }[] = [];
      for (let start = 0; start < rows.length; start += 500) {
        const response = await post(`${base}/roster/apply`, account, {
          source: "csv",
          rows: rows.slice(start, start + 500),
          ...extra,
        });
        assert.equal(response.statusCode, 200, response.body);
        results.push(...response.json().results);
      }
      return results;
    };
    const tally = (results: { status: string }[]) =>
      results.reduce<Record<string, number>>((counts, { status }) => {
        counts[status] = (counts[status] ?? 0) + 1;
        return counts;
      }, {});

    await t.test("setup writes the school and resumes", async () => {
      const head = await user("head@alder.example");
      const { orgId, base } = await setUp(head, "Alder Street School");
      const state = (await get(`${base}/setup`, head)).json();
      assert.equal(state.org.name, "Alder Street School");
      assert.equal(state.org.setupPending, true);
      assert.equal(state.calendar.division, "semester");
      assert.equal(state.experience, "quiet");
      assert.equal(state.agreement.version, AGREEMENT_VERSION);
      assert.deepEqual(state.license, {
        seats: SEATS,
        startsOn: day(-1),
        endsOn: day(365),
      });
      // The school step came answered; the admin can still change it.
      const renamed = await post(`${base}/setup/school`, head, {
        name: "Alder Street Academy",
        shape: "school",
        timezone: "America/New_York",
      });
      assert.equal(renamed.json().org.name, "Alder Street Academy");
      const sessions = (await get(`${base}/calendar`, head)).json().sessions;
      assert.deepEqual(sessions.map((s: { kind: string }) => s.kind).sort(), [
        "semester",
        "semester",
        "year",
      ]);
      // Changing your mind during setup replaces what it wrote.
      await post(`${base}/calendar`, head, {
        startsOn: "2026-09-01",
        endsOn: "2027-06-20",
        division: "quarter",
      });
      const changed = (await get(`${base}/calendar`, head)).json().sessions;
      assert.equal(
        changed.filter((s: { kind: string }) => s.kind === "quarter").length,
        4,
      );
      assert.equal(
        changed.filter((s: { kind: string }) => s.kind === "semester").length,
        0,
      );
      // The agreement version has to be the one that was shown.
      assert.equal(
        (
          await post(`${base}/setup/agreement`, head, {
            version: "old",
            signerName: "Grace Okafor",
            signerTitle: "Head",
          })
        ).statusCode,
        409,
      );
      // The license we issued, through the last day in the school's zone.
      const license = (await get(`${base}/license`, head)).json();
      assert.equal(license.seats, SEATS);
      assert.equal(license.license.reference, "Pilot");
      assert.equal(license.license.evaluation, false);
      assert.equal(
        new Date(license.license.endsAt).toLocaleDateString("en-CA", {
          timeZone: "America/New_York",
        }),
        day(366),
      );
      const finished = await post(`${base}/setup/finish`, head, {
        className: "Grade 5 Math",
        names: ["Ana Ruiz", "Cher"],
        gradeLevel: 5,
      });
      assert.equal(finished.statusCode, 200, finished.body);
      const classId = finished.json().classId as string;
      assert.ok(classId);
      const roster = (await get(`${base}/students`, head)).json();
      assert.equal(roster.total, 2);
      assert.equal(roster.students[0].gradeLevel, 5);
      assert.deepEqual(roster.students[0].classIds, [classId]);
      assert.equal(
        (await get(`${base}/setup`, head)).json().org.setupPending,
        false,
      );
      const me = (await get("/api/v1/me", head)).json();
      assert.deepEqual(me.staffOf, [
        { orgId, orgName: "Alder Street Academy", role: "admin" },
      ]);
    });

    await t.test(
      "a school exists once we issue it, with its admin's link",
      async () => {
        // Nobody can make one for themselves.
        const visitor = await user("curious@linden.example");
        assert.equal(
          (
            await post("/api/v1/school/setup", visitor, {
              name: "Mine",
              shape: "school",
              timezone: "America/New_York",
            })
          ).statusCode,
          404,
        );
        assert.deepEqual((await get("/api/v1/school/orgs", visitor)).json(), {
          orgs: [],
        });
        const sent = mail.length;
        const issued = await issue(
          "Linden Park School",
          "Head@Linden.Example",
          120,
        );
        assert.equal(issued.created, true);
        assert.equal(issued.mailed, true);
        assert.match(
          issued.setupUrl,
          /^https:\/\/amp\.example\/school\/invite#[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/,
        );
        const message = mail.at(-1)!;
        assert.equal(mail.length, sent + 1);
        assert.equal(message.to, "head@linden.example");
        assert.equal(
          message.subject,
          "Linden Park School is ready on AMP for Schools",
        );
        assert.equal(message.url, issued.setupUrl);
        assert.doesNotMatch(message.text + message.subject, /parent|\$/i);
        const org = (
          await db.query(
            "SELECT kind,setup_pending,solo,parent_id,timezone FROM amp_orgs WHERE id=$1",
            [issued.orgId],
          )
        ).rows[0];
        assert.deepEqual(org, {
          kind: "school",
          setup_pending: true,
          solo: false,
          parent_id: null,
          timezone: "America/New_York",
        });
        const license = (
          await db.query(
            "SELECT seats,reference,starts_at,ends_at FROM amp_school_licenses WHERE org_id=$1",
            [issued.orgId],
          )
        ).rows;
        assert.equal(license.length, 1);
        assert.equal(license[0].seats, 120);
        assert.equal(license[0].reference, "Pilot");
        const local = (at: Date) =>
          at.toLocaleString("en-CA", {
            timeZone: "America/New_York",
            hourCycle: "h23",
          });
        assert.equal(local(license[0].starts_at), `${day(-1)}, 00:00:00`);
        assert.equal(local(license[0].ends_at), `${day(366)}, 00:00:00`);
        // The link says what it's for before anyone signs in.
        const { token, proof } = linkParts(issued.setupUrl);
        const preview = await app.inject({
          method: "POST",
          url: "/api/v1/school/invites/lookup",
          payload: { token },
        });
        assert.deepEqual(preview.json().invite, {
          status: "open",
          orgName: "Linden Park School",
          inviterName: null,
          role: "admin",
          email: "head@linden.example",
          setup: true,
        });
        // Running it again while setup waits is the same invitation, and nothing new.
        const again = await issue(
          "linden park school",
          "head@linden.example",
          120,
        );
        assert.equal(again.created, false);
        assert.equal(again.orgId, issued.orgId);
        assert.equal(again.licenseId, issued.licenseId);
        assert.equal(again.setupUrl, issued.setupUrl);
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int AS n FROM amp_orgs WHERE lower(name)='linden park school'",
            )
          ).rows[0].n,
          1,
        );
        // The admin accepts, with the account they sign up with, and lands in setup.
        const head = await user("head@linden.example");
        const accepted = await post("/api/v1/school/invites/accept", head, {
          token,
          proof,
          name: "Ruth Adeyemi",
        });
        assert.deepEqual(accepted.json(), {
          accepted: true,
          orgId: issued.orgId,
          setup: true,
        });
        assert.equal(
          (
            await db.query(
              `SELECT "emailVerified" FROM amp_auth_users WHERE id=$1`,
              [head.slice(4)],
            )
          ).rows[0].emailVerified,
          true,
        );
        const state = (
          await get(`/api/v1/school/orgs/${issued.orgId}/setup`, head)
        ).json();
        assert.equal(state.org.name, "Linden Park School");
        assert.equal(state.org.setupPending, true);
        assert.equal(state.calendar, null);
        assert.deepEqual((await get("/api/v1/me", head)).json().staffOf, [
          {
            orgId: issued.orgId,
            orgName: "Linden Park School",
            role: "admin",
            setupPending: true,
          },
        ]);
        // Accepted, a new run makes a new school: the operator meant another.
        assert.equal(
          (await issue("Linden Park School", "head@linden.example")).created,
          true,
        );
        // A license that has already ended starts nothing.
        await assert.rejects(
          schoolAdmin(
            schools,
            "create-school",
            {
              name: "Late School",
              adminEmail: "late@linden.example",
              seats: 10,
              startsOn: day(-30),
              endsOn: day(-2),
              reference: "PO 1",
            },
            services,
          ),
          (error: { code?: string }) => error.code === "license_ended",
        );
        await assert.rejects(
          schoolAdmin(
            schools,
            "create-school",
            {
              name: "Backwards School",
              adminEmail: "back@linden.example",
              seats: 10,
              startsOn: day(30),
              endsOn: day(2),
              reference: "PO 2",
            },
            services,
          ),
        );
        await assert.rejects(
          schoolAdmin(schools, "create-school", {
            name: "No Mail School",
            adminEmail: "none@linden.example",
            seats: 10,
            startsOn: day(0),
            endsOn: day(30),
            reference: "PO 3",
          }),
          (error: { code?: string }) => error.code === "accounts_unconfigured",
        );
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int AS n FROM amp_orgs WHERE name IN ('Late School','Backwards School','No Mail School')",
            )
          ).rows[0].n,
          0,
        );
      },
    );

    await t.test("just my class ends with a class to land on", async () => {
      const teacher = await user("solo@birch.example");
      const { base } = await setUp(teacher, "Ms. Vega's class", "class");
      const finished = await post(`${base}/setup/finish`, teacher, {});
      assert.ok(finished.json().classId);
      assert.equal(finished.json().solo, true);
      const org = (await get(base, teacher)).json().org;
      assert.equal(org.solo, true);
      assert.deepEqual(org.teaches, [finished.json().classId]);
      assert.ok(org.can.includes("roster.import"));
    });

    await t.test("a 1,000-student plan and apply are idempotent", async () => {
      const head = await user("head@cedar.example");
      const { base, orgId } = await setUp(head, "Cedar Lane School");
      await schoolAdmin(schools, "issue-license", {
        orgId,
        seats: 2000,
        endsAt: new Date(Date.now() + 86_400_000).toISOString(),
      });
      const rows = fixtureRoster(1000);
      const before = (
        await db.query("SELECT count(*)::int AS n FROM amp_people")
      ).rows[0].n;
      const plan = await planAll(base, head, rows);
      assert.deepEqual(tally(plan), { new: 1000 });
      assert.equal(
        (await db.query("SELECT count(*)::int AS n FROM amp_people")).rows[0].n,
        before,
        "nothing is written until Apply",
      );
      const applied = await applyAll(base, head, rows);
      assert.deepEqual(tally(applied), { created: 1000 });
      assert.ok(applied.every((row) => row.seated));
      const again = await planAll(base, head, rows);
      assert.deepEqual(tally(again), { unchanged: 1000 });
      // A retry after a dropped response repeats nothing.
      const retried = await applyAll(base, head, rows.slice(0, 500));
      assert.deepEqual(tally(retried), { unchanged: 500 });
      assert.equal(
        (await get(`${base}/students?limit=1`, head)).json().total,
        1000,
      );
      const classes = (await get(`${base}/classes?limit=500`, head)).json()
        .classes;
      assert.equal(classes.length, 40);
      assert.deepEqual(classes[0].courseBands, ["3"]);
      // A grade change shows as a change and lands once.
      const moved = rows.slice(0, 1).map((row) => ({ ...row, gradeLevel: 9 }));
      assert.equal((await planAll(base, head, moved))[0]!.status, "changed");
      assert.deepEqual(tally(await applyAll(base, head, moved)), {
        updated: 1,
      });
      assert.equal((await planAll(base, head, moved))[0]!.status, "unchanged");
    });

    await t.test(
      "a 10,000-row apply goes through in chunks",
      { skip: !process.env.AMP_SCHOOL_LOAD_TEST },
      async () => {
        const head = await user("head@district.example");
        const { base, orgId } = await setUp(head, "Large School");
        await schoolAdmin(schools, "issue-license", {
          orgId,
          seats: 20_000,
          endsAt: new Date(Date.now() + 86_400_000).toISOString(),
        });
        const rows = fixtureRoster(10_000, "big");
        const started = Date.now();
        const applied = await applyAll(base, head, rows);
        assert.deepEqual(tally(applied), { created: 10_000 });
        console.info(`10,000 rows in ${(Date.now() - started) / 1000}s`);
        assert.equal(
          (await get(`${base}/students?limit=1`, head)).json().total,
          10_000,
        );
        assert.deepEqual(tally(await planAll(base, head, rows)), {
          unchanged: 10_000,
        });
      },
    );

    await t.test("a reused ID with another name is held", async () => {
      const head = await user("head@dogwood.example");
      const { base } = await setUp(head, "Dogwood School");
      const first = fixtureRoster(3, "d");
      await applyAll(base, head, first);
      const person = (await get(`${base}/students`, head))
        .json()
        .students.find((s: { identifier: string }) => s.identifier === "D-0");
      // The student's record, before the file tries to give it to someone else.
      const reused = {
        ...first[0]!,
        givenName: "Different",
        familyName: "Child",
      };
      const plan = await planAll(base, head, [reused]);
      assert.equal(plan[0]!.status, "held");
      assert.equal(plan[0]!.reason, "name_changed");
      assert.equal(
        plan[0]!.existing,
        `${first[0]!.givenName} ${first[0]!.familyName}`,
      );
      const held = await applyAll(base, head, [reused]);
      assert.equal(held[0]!.status, "held");
      const after = (await get(`${base}/students`, head)).json().students;
      assert.equal(after.length, 3, "nobody was added");
      assert.equal(
        after.find((s: { id: string }) => s.id === person.id).givenName,
        first[0]!.givenName,
        "nobody was overwritten",
      );
      // The admin says it's a different child: a new student, a new record.
      const asNew = await applyAll(base, head, [reused], {
        resolutions: { [reused.line]: "new" },
      });
      assert.equal(asNew[0]!.status, "created");
      const both = (await get(`${base}/students`, head)).json().students;
      assert.equal(both.length, 4);
      assert.equal(
        both.find((s: { id: string }) => s.id === person.id).givenName,
        first[0]!.givenName,
      );
      // Or the same child with a new name: updated in place, display name kept.
      await post(`${base}/students/${person.id}`, head, {
        displayName: "Annie",
      });
      const renamed = { ...first[1]!, givenName: "Renamed" };
      const same = await applyAll(base, head, [renamed], {
        resolutions: { [renamed.line]: "same" },
      });
      assert.equal(same[0]!.status, "updated");
      const row = (await get(`${base}/students`, head))
        .json()
        .students.find((s: { identifier: string }) => s.identifier === "D-1");
      assert.equal(row.givenName, "Renamed");
      assert.equal(
        (await get(`${base}/students`, head))
          .json()
          .students.find((s: { id: string }) => s.id === person.id).displayName,
        "Annie",
      );
      // A hand-typed student isn't copied by an import of the same name.
      await post(`${base}/students`, head, {
        givenName: "Typed",
        familyName: "Student",
      });
      const typed = rosterRowSchema.parse({
        line: 50,
        role: "student",
        sourcedId: namedStudentId("Typed", "Student"),
        givenName: "Typed",
        familyName: "Student",
        classes: [],
      });
      const match = await planAll(base, head, [typed]);
      assert.equal(match[0]!.reason, "possible_match");
      assert.equal(
        (
          await applyAll(base, head, [typed], {
            resolutions: { "50": "same" },
          })
        )[0]!.status,
        "updated",
      );
      assert.equal(
        (await planAll(base, head, [typed]))[0]!.status,
        "unchanged",
      );
    });

    await t.test("seats run out; the rest wait, and get seated", async () => {
      const head = await user("head@elm.example");
      const { base } = await setUp(head, "Elm School");
      const rows = fixtureRoster(SEATS + 2, "e");
      const applied = await applyAll(base, head, rows);
      assert.equal(applied.filter((row) => row.seated).length, SEATS);
      assert.equal(applied.filter((row) => !row.seated).length, 2);
      const license = (await get(`${base}/license`, head)).json();
      assert.deepEqual(
        [license.seats, license.used, license.available, license.waiting],
        [SEATS, SEATS, 0, 2],
      );
      const students = (await get(`${base}/students`, head)).json().students;
      assert.equal(
        students.filter((s: { seated: boolean }) => !s.seated).length,
        2,
      );
      // Removing a student frees the seat, and says what it did to the data.
      const leaving = students.find((s: { seated: boolean }) => s.seated);
      const learner = (
        await db.query("SELECT learner_id FROM amp_people WHERE id=$1", [
          leaving.id,
        ])
      ).rows[0].learner_id;
      assert.equal(
        (await post(`${base}/students/${leaving.id}/remove`, head, {}))
          .statusCode,
        400,
        "removal has to be confirmed",
      );
      assert.equal(
        (
          await post(`${base}/students/${leaving.id}/remove`, head, {
            confirm: "remove",
          })
        ).statusCode,
        200,
      );
      assert.equal(
        (await db.query("SELECT 1 FROM amp_learners WHERE id=$1", [learner]))
          .rowCount,
        0,
        "learning data is gone",
      );
      const tombstone = (
        await db.query(
          "SELECT given_name,family_name,identifier,deleted_at FROM amp_people WHERE id=$1",
          [leaving.id],
        )
      ).rows[0];
      assert.equal(tombstone.given_name, "Removed");
      assert.equal(tombstone.family_name, null);
      assert.ok(tombstone.identifier, "the SIS mapping stays");
      const freed = (await get(`${base}/license`, head)).json();
      assert.equal(freed.used, SEATS);
      assert.equal(freed.available, 0);
      assert.equal(
        freed.waiting,
        1,
        "removal immediately seats a waiting learner",
      );
      const waitingIds = students
        .filter((s: { seated: boolean }) => !s.seated)
        .map((s: { id: string }) => s.id);
      const afterRemoval = (await get(`${base}/students`, head)).json()
        .students;
      assert.equal(
        afterRemoval.filter(
          (s: { id: string; seated: boolean }) =>
            waitingIds.includes(s.id) && s.seated,
        ).length,
        1,
      );
      // Importing someone removed brings them back as new, not as nothing.
      const removedRow = rows.find(
        (row) => row.identifier === leaving.identifier,
      )!;
      assert.equal((await planAll(base, head, [removedRow]))[0]!.status, "new");
      assert.equal(
        (await applyAll(base, head, [removedRow]))[0]!.status,
        "created",
      );
      assert.equal(
        (
          await post(`${base}/license/request`, head, {
            seats: 60,
            note: "Fall",
          })
        ).statusCode,
        200,
      );
      const asked = mail.at(-1)!;
      assert.equal(asked.to, "support@corpora.inc");
      assert.match(asked.text, /60 seats/);
      assert.doesNotMatch(asked.text + asked.subject, /\$/);
      // Asking again and again doesn't flood the mailbox.
      for (let index = 0; index < 4; index++)
        await post(`${base}/license/request`, head, { seats: 60 });
      assert.equal(
        (await post(`${base}/license/request`, head, { seats: 60 })).statusCode,
        429,
      );
    });

    await t.test("an admin takes a class and teaches it", async () => {
      const head = await user("head@hazel.example");
      const { base } = await setUp(head, "Hazel School");
      const klass = (
        await post(`${base}/classes`, head, { name: "Hazel 4" })
      ).json().class.id;
      const before = (await get(base, head)).json().org;
      assert.deepEqual(before.teaches, []);
      const me = (await get(`${base}/staff`, head))
        .json()
        .staff.find((s: { email: string }) => s.email === "head@hazel.example");
      assert.ok(me.roles.includes("admin"));
      assert.ok(!me.roles.includes("teacher"));
      const taken = await post(`${base}/staff/${me.id}/classes`, head, {
        classIds: [klass],
      });
      assert.equal(taken.statusCode, 200);
      assert.deepEqual(taken.json().classIds, [klass]);
      const after = (await get(base, head)).json().org;
      assert.deepEqual(after.teaches, [klass]);
      const row = (await get(`${base}/staff`, head))
        .json()
        .staff.find((s: { email: string }) => s.email === "head@hazel.example");
      assert.ok(row.roles.includes("teacher"));
      assert.deepEqual(row.classIds, [klass]);
    });

    await t.test("students are edited and moved between classes", async () => {
      const head = await user("head@fir.example");
      const { base } = await setUp(head, "Fir School");
      const a = (
        await post(`${base}/classes`, head, { name: "A", gradingKind: "year" })
      ).json().class.id;
      const b = (await post(`${base}/classes`, head, { name: "B" })).json()
        .class.id;
      const id = (
        await post(`${base}/students`, head, {
          givenName: "Moved",
          familyName: "Student",
          classId: a,
          gradeLevel: 4,
        })
      ).json().student.personId;
      assert.equal(
        (
          await post(`${base}/students/${id}`, head, {
            displayName: "Mo",
            gradeLevel: 5,
          })
        ).statusCode,
        200,
      );
      assert.equal(
        (await post(`${base}/students/${id}/classes`, head, { classIds: [b] }))
          .statusCode,
        200,
      );
      const student = (await get(`${base}/students`, head)).json().students[0];
      assert.equal(student.displayName, "Mo");
      assert.equal(student.gradeLevel, 5);
      assert.deepEqual(student.classIds, [b]);
      const learner = (
        await db.query(
          "SELECT l.name FROM amp_people p JOIN amp_learners l ON l.id=p.learner_id WHERE p.id=$1",
          [id],
        )
      ).rows[0];
      assert.equal(learner.name, "Mo");
      // A class can pick a grading period the calendar doesn't have yet.
      assert.equal(
        (await post(`${base}/classes/${a}`, head, { gradingKind: "trimester" }))
          .statusCode,
        200,
      );
      const sessions = (await get(`${base}/calendar`, head)).json().sessions;
      assert.equal(
        sessions.filter((s: { kind: string }) => s.kind === "trimester").length,
        3,
      );
      assert.equal(
        (await post(`${base}/classes`, head, { name: "Search" })).statusCode,
        201,
      );
      const found = await get(`${base}/students?q=mo`, head);
      assert.equal(found.json().total, 1);
      assert.equal(
        (
          await get(`${base}/students?q=${encodeURIComponent("100%")}`, head)
        ).json().total,
        0,
        "search terms are text, never patterns",
      );
    });

    await t.test("an invite is single use and binds the acceptor", async () => {
      const head = await user("head@gum.example");
      const { base, orgId } = await setUp(head, "Gum Tree School");
      const klass = (await post(`${base}/classes`, head, { name: "G5" })).json()
        .class.id;
      const sent = await post(`${base}/staff/invites`, head, {
        email: "Teacher@Gum.Example",
        role: "teacher",
        classIds: [klass],
      });
      assert.equal(sent.statusCode, 201, sent.body);
      assert.equal(sent.json().mailed, true);
      const message = mail.at(-1)!;
      assert.equal(message.to, "teacher@gum.example");
      assert.match(message.subject, /Gum Tree School invited you/);
      assert.doesNotMatch(message.text, /parent/i);
      assert.match(message.url, /^https:\/\/amp\.example\/school\/invite#/);
      const [token, proof] = message.url.split("#")[1]!.split(".");
      const staff = (await get(`${base}/staff`, head)).json().staff;
      const pending = staff.find(
        (s: { email: string }) => s.email === "teacher@gum.example",
      );
      assert.equal(pending.status, "invited");
      // The copied link is the same token without the proof of the mailbox.
      assert.equal(
        pending.inviteUrl,
        `https://amp.example/school/invite#${token}`,
      );
      // A second invite to the address is the same invitation.
      await post(`${base}/staff/invites`, head, {
        email: "teacher@gum.example",
        role: "teacher",
      });
      assert.equal(
        (await get(`${base}/staff`, head))
          .json()
          .staff.filter(
            (s: { email: string }) => s.email === "teacher@gum.example",
          ).length,
        1,
      );
      assert.equal(mail.at(-1)!.url, message.url);
      const preview = await app.inject({
        method: "POST",
        url: "/api/v1/school/invites/lookup",
        payload: { token },
      });
      assert.deepEqual(preview.json().invite, {
        status: "open",
        orgName: "Gum Tree School",
        inviterName: "Grace Okafor",
        role: "teacher",
        email: "teacher@gum.example",
        setup: false,
      });
      // The mailed link proves the address at sign-up, so no second mail.
      const cookie = `amp.school-signup=${token}.${proof}`;
      assert.equal(
        await invitationProvesAddress(db, "teacher@gum.example", cookie),
        true,
      );
      assert.equal(
        await invitationProvesAddress(db, "other@gum.example", cookie),
        false,
      );
      assert.equal(
        await invitationProvesAddress(
          db,
          "teacher@gum.example",
          `amp.school-signup=${token}.${token}`,
        ),
        false,
        "a copied link proves nothing about the mailbox",
      );
      // Accepting binds to whoever accepts, and confirms the address it proved.
      const teacher = await user("teacher@gum.example");
      assert.equal(
        (
          await post("/api/v1/school/invites/accept", teacher, {
            token,
            proof,
            name: "Dana Hale",
          })
        ).statusCode,
        200,
      );
      assert.equal(
        (
          await db.query(
            `SELECT "emailVerified" FROM amp_auth_users WHERE id=$1`,
            [teacher.slice(4)],
          )
        ).rows[0].emailVerified,
        true,
      );
      const me = (await get("/api/v1/me", teacher)).json();
      assert.deepEqual(me.staffOf, [
        { orgId, orgName: "Gum Tree School", role: "teacher" },
      ]);
      const visible = (await get(`${base}/classes`, teacher)).json().classes;
      assert.deepEqual(
        visible.map((c: { id: string }) => c.id),
        [klass],
      );
      const row = (await get(`${base}/staff`, head))
        .json()
        .staff.find(
          (s: { email: string }) => s.email === "teacher@gum.example",
        );
      assert.equal(row.status, "active");
      assert.equal(row.name, "Dana Hale");
      // Single use: the same account just carries on, anyone else is refused.
      assert.equal(
        (await post("/api/v1/school/invites/accept", teacher, { token }))
          .statusCode,
        200,
      );
      const late = await post(
        "/api/v1/school/invites/accept",
        await user("late@gum.example"),
        { token },
      );
      assert.equal(late.statusCode, 410);
      assert.equal(late.json().error, "invite_used");
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/school/invites/lookup",
            payload: { token },
          })
        ).json().invite.status,
        "used",
      );
      // A copied link binds a different address and confirms nothing.
      await post(`${base}/staff/invites`, head, {
        email: "aide@gum.example",
        role: "aide",
      });
      const aideToken = mail.at(-1)!.url.split("#")[1]!.split(".")[0];
      const aide = await user("personal@elsewhere.example");
      assert.equal(
        (
          await post("/api/v1/school/invites/accept", aide, {
            token: aideToken,
          })
        ).statusCode,
        200,
      );
      assert.equal(
        (
          await db.query(
            `SELECT "emailVerified" FROM amp_auth_users WHERE id=$1`,
            [aide.slice(4)],
          )
        ).rows[0].emailVerified,
        false,
      );
      // Ending access stops it on the next request, and the last admin stays.
      const aidePerson = (await get(`${base}/staff`, head))
        .json()
        .staff.find((s: { email: string }) => s.email === "aide@gum.example");
      assert.equal(
        (await post(`${base}/staff/${aidePerson.id}/end`, head)).statusCode,
        200,
      );
      assert.equal((await get(base, aide)).statusCode, 404);
      const headPerson = (await get(`${base}/staff`, head))
        .json()
        .staff.find((s: { self: boolean }) => s.self);
      const last = await post(`${base}/staff/${headPerson.id}/end`, head);
      assert.equal(last.statusCode, 409);
      assert.equal(last.json().error, "last_admin");
      // A teacher sees what they can do, and nothing that would fail.
      const teacherOrg = (await get(base, teacher)).json().org;
      assert.deepEqual(teacherOrg.teaches, [klass]);
      assert.equal(teacherOrg.can.includes("staff.manage"), false);
      assert.equal(teacherOrg.can.includes("roster.import"), false);
    });

    await t.test("staff aren't new parents", async () => {
      const head = await user("suppress@hazel.example");
      const account = head.slice(4);
      // Marketing started before they set up a school.
      await db.query(
        `INSERT INTO amp_parent_followups(user_id,email,notice_version,unsubscribe_token,new_account)
         VALUES($1,'suppress@hazel.example','fixture',$2,true)`,
        [
          account,
          randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", ""),
        ],
      );
      await db.query(
        "INSERT INTO amp_parent_followup_outbox(id,user_id,stage) VALUES($1,$2,'welcome')",
        [randomUUID(), account],
      );
      await setUp(head, "Hazel School");
      assert.deepEqual(
        (
          await db.query(
            "SELECT category FROM amp_account_classifications WHERE user_id=$1",
            [account],
          )
        ).rows,
        [{ category: "school_staff" }],
      );
      assert.deepEqual(
        (
          await db.query(
            "SELECT provider FROM amp_ad_collection_withdrawals WHERE account_id=$1 ORDER BY provider",
            [head],
          )
        ).rows.map((row) => row.provider),
        ["google", "meta", "openai"],
      );
      const stopped = (
        await db.query(
          "SELECT stopped_at,stopped_reason FROM amp_parent_followup_outbox WHERE user_id=$1",
          [account],
        )
      ).rows[0];
      assert.ok(stopped.stopped_at);
      // A teacher who is already a parent keeps what they have.
      const parent = await user("parent@hazel.example");
      await db.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','verified','synthetic')",
        [parent],
      );
      await learning.create(parent, "Jordan", 2015);
      const { base } = await setUp(parent, "Parent's Class", "class");
      assert.equal(
        (
          await db.query(
            "SELECT 1 FROM amp_account_classifications WHERE user_id=$1",
            [parent.slice(4)],
          )
        ).rowCount,
        0,
      );
      assert.equal(
        (
          await db.query(
            "SELECT 1 FROM amp_ad_collection_withdrawals WHERE account_id=$1",
            [parent],
          )
        ).rowCount,
        0,
      );
      const me = (await get("/api/v1/me", parent)).json();
      assert.equal(me.learners.length, 1);
      assert.equal(me.staffOf.length, 1);
      assert.ok(base);
      // An operator's classification stands.
      const internal = await user("internal@hazel.example");
      await db.query(
        "INSERT INTO amp_account_classifications(user_id,category,note) VALUES($1,'internal','Fixture')",
        [internal.slice(4)],
      );
      await setUp(internal, "Internal School");
      assert.equal(
        (
          await db.query(
            "SELECT category FROM amp_account_classifications WHERE user_id=$1",
            [internal.slice(4)],
          )
        ).rows[0].category,
        "internal",
      );
    });

    await t.test("every new route answers 404 across tenants", async () => {
      const home = await user("home@juniper.example");
      const { base, orgId } = await setUp(home, "Juniper School");
      const klass = (await post(`${base}/classes`, home, { name: "J5" })).json()
        .class.id;
      const student = (
        await post(`${base}/students`, home, {
          givenName: "Far",
          familyName: "Student",
          classId: klass,
        })
      ).json().student.personId;
      const session = (await get(`${base}/calendar`, home)).json().sessions[0]
        .id;
      const invited = (
        await post(`${base}/staff/invites`, home, {
          email: "pending@juniper.example",
          role: "teacher",
        })
      ).json().personId;
      const fill = (url: string) =>
        url
          .replace(":org", orgId)
          .replace(":class", klass)
          .replace(":student", student)
          .replace(":session", session)
          .replace(":person", invited);
      const strangerAdmin = await user("admin@elsewhere.example");
      await setUp(strangerAdmin, "Elsewhere School");
      const parent = await user("parent@elsewhere.example");
      assert.ok(schoolRoutes.length >= 30);
      for (const route of schoolRoutes) {
        const self =
          route.target({ params: { org: orgId }, body: {} }).kind === "self";
        const url = fill(route.url);
        for (const account of [strangerAdmin, parent]) {
          const response = await app.inject({
            method: route.method,
            url,
            headers: as(account),
            ...(route.method === "POST" ? { payload: {} } : {}),
          });
          if (self) {
            assert.notEqual(response.statusCode, 404, route.url);
            assert.equal(response.body.includes(orgId), false, route.url);
          } else {
            assert.equal(response.statusCode, 404, `${route.url} ${account}`);
            assert.deepEqual(
              response.json(),
              { error: "not_found" },
              route.url,
            );
          }
        }
        const signedOut = await app.inject({
          method: route.method,
          url,
          ...(route.method === "POST" ? { payload: {} } : {}),
        });
        assert.equal(signedOut.statusCode, 401, route.url);
      }
      // A student or staff member of another school can't be named through
      // your own org, even by an admin there.
      const away = `/api/v1/school/orgs/${
        (await get("/api/v1/school/orgs", strangerAdmin)).json().orgs[0].id
      }`;
      for (const [url, payload] of [
        [`${away}/students/${student}`, { gradeLevel: 3 }],
        [`${away}/students/${student}/classes`, { classIds: [] }],
        [`${away}/students/${student}/remove`, { confirm: "remove" }],
        [`${away}/staff/${invited}/end`, {}],
        [`${away}/staff/${invited}/invite`, {}],
        [`${away}/staff/${invited}/classes`, { classIds: [] }],
        [`${away}/classes/${klass}`, { name: "Taken" }],
        [
          `${away}/calendar/sessions/${session}`,
          { startsOn: "2026-08-15", endsOn: "2027-06-15" },
        ],
      ] as const) {
        const response = await post(url, strangerAdmin, payload);
        assert.equal(response.statusCode, 404, url);
      }
      // A teacher can edit their own class's students, not others'.
      const teacher = await user("teacher@juniper.example");
      await post(`${base}/staff/invites`, home, {
        email: "teacher@juniper.example",
        role: "teacher",
      });
      const token = mail.at(-1)!.url.split("#")[1]!.split(".")[0];
      await post("/api/v1/school/invites/accept", teacher, { token });
      assert.equal(
        (await post(`${base}/students/${student}`, teacher, { gradeLevel: 3 }))
          .statusCode,
        404,
      );
      const person = (await get(`${base}/staff`, home))
        .json()
        .staff.find(
          (s: { email: string }) => s.email === "teacher@juniper.example",
        );
      await post(`${base}/staff/${person.id}/classes`, home, {
        classIds: [klass],
      });
      assert.equal(
        (await post(`${base}/students/${student}`, teacher, { gradeLevel: 3 }))
          .statusCode,
        200,
      );
      assert.equal(
        (
          await post(`${base}/students/${student}/remove`, teacher, {
            confirm: "remove",
          })
        ).statusCode,
        404,
        "removal stays with admins",
      );
      assert.equal(
        (
          await post(`${base}/roster/plan`, teacher, {
            source: "csv",
            rows: [],
          })
        ).statusCode,
        404,
      );
      const help = (await get(`${base}/sign-in-help`, teacher)).json();
      assert.equal(help.google, "google-client");
      assert.match(help.microsoft.adminConsentUrl, /client_id=ms-client/);
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/school/invites/lookup",
            payload: { token: "x".repeat(43) },
          })
        ).statusCode,
        404,
      );
    });
  },
);

test(
  "A district imports a CSV at each school: the same class name and the same student name stay each school's own",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_roster_csv_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const db = new Pool({ connectionString: scoped.href, max: 4 });
    const schools = new SchoolRepository(db);
    try {
      const district = await schools.createOrg(
        { kind: "district", name: "Fixture District", timezone: "UTC" },
        {
          version: AGREEMENT_VERSION,
          signerName: "Fixture Signer",
          signerTitle: "Superintendent",
        },
      );
      await schools.issueLicense({
        orgId: district.id,
        seats: 10,
        endsAt: new Date(Date.now() + 86_400_000 * 30).toISOString(),
      });
      const north = await schools.createOrg({
        kind: "school",
        name: "North",
        parentId: district.id,
      });
      const south = await schools.createOrg({
        kind: "school",
        name: "South",
        parentId: district.id,
      });
      // The district's calendar, in semesters, which its schools inherit.
      const year = randomUUID();
      await db.query(
        `INSERT INTO amp_academic_sessions(id,org_id,parent_id,kind,name,starts_on,ends_on) VALUES
           ($1,$2,NULL,'year','2026–27','2026-08-17','2027-06-11'),
           ($3,$2,$1,'semester','Semester 1','2026-08-17','2027-01-08')`,
        [year, district.id, randomUUID()],
      );
      // No student IDs: a file only knows these by name and class.
      const csv =
        "Last Name,First Name,Grade,Class\r\nOsei,Amara,3,Grade 3 Math\r\nOrtiz,Caleb,3,Grade 3 Math\r\n";
      const rows = () => {
        const table = readTable(csv);
        return csvRows(table, guessMapping(table)).rows;
      };
      const keys = { secret: "fixture-secret-fixture-secret", origin: "" };
      for (const school of [north, south]) {
        const plan = await planRoster(schools, school.id, {
          source: "csv",
          rows: rows(),
        });
        assert.deepEqual(
          plan.map((result) => result.status),
          ["new", "new"],
          "the second school's file is new there, not the first school's",
        );
        const { results } = await applyRoster(
          schools,
          keys,
          school.id,
          { source: "csv", rows: rows() },
          null,
        );
        assert.deepEqual(
          results.map((result) => result.status),
          ["created", "created"],
        );
      }
      const { rows: classes } = await db.query(
        `SELECT c.org_id,count(e.id)::int AS students FROM amp_classes c
         JOIN amp_enrollments e ON e.class_id=c.id AND e.role='student'
         JOIN amp_org_roles r ON r.person_id=e.person_id AND r.role='student' AND r.org_id=c.org_id
         WHERE c.name='Grade 3 Math' GROUP BY 1 ORDER BY 1`,
      );
      assert.deepEqual(
        classes.map((row) => row.students),
        [2, 2],
        "each school has its own class with its own two students",
      );
      const kinds = await db.query(
        "SELECT DISTINCT grading_kind FROM amp_classes WHERE name='Grade 3 Math'",
      );
      assert.deepEqual(
        kinds.rows.map((row) => row.grading_kind),
        ["semester"],
        "a school grades by the district calendar it inherits",
      );
      // The same file again changes nothing at either school.
      for (const school of [north, south])
        assert.deepEqual(
          (
            await planRoster(schools, school.id, {
              source: "csv",
              rows: rows(),
            })
          ).map((result) => result.status),
          ["unchanged", "unchanged"],
        );
    } finally {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
