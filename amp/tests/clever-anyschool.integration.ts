import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { z } from "zod";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
import { SchoolRepository } from "../src/schools/repository.js";
import {
  acceptSchoolAdoption,
  issueSchoolAdoption,
  schoolAdoptionOptions,
} from "../src/schools/adoption.js";
import {
  anySchoolState,
  requestAnySchool,
  type CleverOperator,
} from "../src/schools/clever/anyschool.js";
import { CleverSyncError, type Snapshot } from "../src/schools/clever/model.js";
import { storedAdoptionSnapshot } from "../src/schools/clever/store.js";
import { runDueCleverSync } from "../src/schools/clever/worker.js";
import { schoolOperations } from "../src/schools/operations.js";
import { loadActor, can } from "../src/schools/authz.js";

// Clever IDs are Clever's; the CSV's own IDs (User_id, Section_id,
// School_number) arrive as sis_id, section sis_id and school_number.
const D = "a00000000000000000000001", // the AnySchool district
  OTHER = "a00000000000000000000002", // a Secure Sync district, shared too
  S = "b00000000000000000000001",
  TEACHER = "c00000000000000000000001",
  IDLE_TEACHER = "c00000000000000000000002",
  PRINCIPAL = "c00000000000000000000003",
  PILOT_STUDENT = "d00000000000000000000001",
  KINDER = "d00000000000000000000002",
  UNGRADED = "d00000000000000000000003",
  BARE = "d00000000000000000000004",
  MATH = "e00000000000000000000001",
  HOMEROOM = "e00000000000000000000002";

/** What an AnySchool CSV upload (users.csv + sections.csv) looks like through
 * the API: no terms or courses, no student/teacher numbers, no NCES or MDR,
 * no low/high grade, often no email, one teacher per section, a school number
 * the school typed. https://support.clever.com/hc/s/articles/000001762 */
const anySchoolRoster = (): Snapshot =>
  ({
    district: {
      id: D,
      name: "Fixture Academy",
      connection_type: "anyschool",
      sis_type: "sftp",
      launch_date: "2026-11-20",
    },
    schools: [
      {
        id: S,
        district: D,
        name: "Fixture Academy",
        sis_id: "Fixture Academy",
        school_number: "1",
      },
    ],
    users: [
      {
        id: TEACHER,
        district: D,
        name: { first: "Pilot", last: "Teacher" },
        email: "teacher@academy.example",
        roles: { teacher: { school: S, schools: [S], sis_id: "2001" } },
      },
      {
        id: IDLE_TEACHER,
        district: D,
        name: { first: "Art", last: "Teacher" },
        roles: { teacher: { school: S, schools: [S], sis_id: "2002" } },
      },
      {
        id: PRINCIPAL,
        district: D,
        name: { first: "Head", last: "Of School" },
        email: "head@academy.example",
        roles: { staff: { schools: [S], staff_id: "3001", roles: [] } },
      },
      {
        id: PILOT_STUDENT,
        district: D,
        name: { first: "Pilot", last: "Learner" },
        roles: {
          student: {
            school: S,
            schools: [S],
            sis_id: "1001",
            grade: "4",
            dob: "03/14/2016",
          },
        },
      },
      {
        id: KINDER,
        district: D,
        name: { first: "Kinder", last: "Learner" },
        email: "kinder@students.academy.example",
        roles: {
          student: {
            school: S,
            schools: [S],
            sis_id: "1002",
            grade: "Kindergarten",
          },
        },
      },
      {
        id: UNGRADED,
        district: D,
        name: { first: "Mixed", last: "Age" },
        roles: {
          student: {
            school: S,
            schools: [S],
            sis_id: "1003",
            grade: "Ungraded",
            dob: "10/02/2015",
          },
        },
      },
      {
        id: BARE,
        district: D,
        name: { first: "Only", last: "Names" },
        roles: { student: { school: S, schools: [S], sis_id: "1004" } },
      },
    ],
    sections: [
      {
        id: MATH,
        district: D,
        school: S,
        name: "Grade 4 Math",
        sis_id: "SEC-001",
        subject: "math",
        period: "2",
        students: [PILOT_STUDENT, UNGRADED],
        teacher: TEACHER,
        teachers: [TEACHER],
      },
      {
        id: HOMEROOM,
        district: D,
        school: S,
        name: "Homeroom",
        sis_id: "SEC-002",
        subject: "homeroom/advisory",
        students: [KINDER, BARE],
        teacher: TEACHER,
        teachers: [TEACHER],
      },
    ],
    courses: [],
    terms: [],
    // Raw API records: `dob` is read once, then only its cohort year is kept.
  }) as Snapshot;

test(
  "Clever AnySchool: request, invitation, connection, reviewed adoption and import",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `anyschool_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    let db: Pool | undefined;
    try {
      await migrate(scoped.href);
      db = new Pool({ connectionString: scoped.href, max: 4 });
      const repo = new SchoolRepository(db);
      const roster = anySchoolRoster();
      const tokens = new Set([D, OTHER]);
      const district = (id: string) =>
        id === D
          ? roster.district
          : { id: OTHER, name: "Other District", connection_type: "sis" };
      const clever: CleverOperator = {
        environment: "sandbox",
        client: {
          sharedDistricts: async () => [...tokens],
          districtToken: async (id: string) => {
            if (!tokens.has(id))
              throw new CleverSyncError("district_not_authorized");
            return `token-${id}`;
          },
          get: (async (path: string, _token: string, schema: z.ZodType) =>
            schema.parse(district(path.split("/").at(-1)!))) as never,
        },
      };
      const worker = {
        districtToken: clever.client.districtToken,
        snapshot: async () => structuredClone(roster),
        latestEvent: async () => null,
        events: async () => [],
      };
      const ops = (command: string, input: unknown, withClever = true) =>
        schoolOperations(
          repo,
          command,
          input,
          withClever ? clever : null,
          "https://amp.example",
        ) as Promise<Record<string, any>>;

      // A teacher's own pilot: a solo school, one class, one learner.
      const teacherAccount = `amp|${randomUUID()}`,
        leaderAccount = `amp|${randomUUID()}`;
      const pilot = await repo.createOrg(
        {
          kind: "school",
          name: "Pilot Teacher's class",
          timezone: "America/Chicago",
        },
        { version: AGREEMENT_VERSION, signerName: "Pilot Teacher" },
      );
      await db.query("UPDATE amp_orgs SET solo=true WHERE id=$1", [pilot.id]);
      const pilotClass = await repo.createClass(pilot.id, {
        name: "Math 4",
      });
      const teacher = await repo.addStaff({
        orgId: pilot.id,
        role: "teacher",
        givenName: "Pilot",
        accountId: teacherAccount,
        classId: pilotClass.id,
      });
      await db.query(
        "INSERT INTO amp_school_starts(account_id,request_id,org_id,class_id,created_school) VALUES($1,$2,$3,$4,true)",
        [teacherAccount, randomUUID(), pilot.id, pilotClass.id],
      );
      const learner = await repo.provisionStudent(pilot.id, {
        givenName: "Pilot",
        classId: pilotClass.id,
        gradeLevel: 4,
      });
      // The head of school set the school up in AMP ("I run a school").
      const school = await repo.createOrg(
        {
          kind: "school",
          name: "Fixture Academy",
          timezone: "America/Chicago",
        },
        { version: AGREEMENT_VERSION, signerName: "Head Of School" },
      );
      await repo.addStaff({
        orgId: school.id,
        role: "admin",
        givenName: "Head",
        familyName: "Of School",
        accountId: leaderAccount,
      });
      const ask = {
        setupEmail: "Head@Academy.example",
        signerName: "Head Of School",
        agreementVersion: AGREEMENT_VERSION,
        authorized: true,
      };
      let requestId = "";

      await t.test(
        "the school asks with the setup email and the agreement",
        async () => {
          assert.equal(
            (await anySchoolState(db!, school.id))?.status,
            "none",
            "offered to a school not on Clever",
          );
          await assert.rejects(
            requestAnySchool(
              repo,
              { orgId: school.id, accountId: leaderAccount },
              { ...ask, authorized: false },
            ),
            "the agreement is accepted, not implied",
          );
          const first = await requestAnySchool(
            repo,
            { orgId: school.id, accountId: leaderAccount },
            { ...ask, setupEmail: "typo@academy.example" },
          );
          const again = await requestAnySchool(
            repo,
            { orgId: school.id, accountId: leaderAccount },
            ask,
          );
          assert.equal(again.id, first.id, "one open request per school");
          assert.equal(first.created, true);
          assert.equal(again.created, false);
          requestId = first.id;
          const state = await anySchoolState(db!, school.id);
          assert.equal(state?.status, "requested");
          assert.equal(
            state?.setupEmail,
            "head@academy.example",
            "asking again before the invitation corrects the email",
          );
          const queue = await ops("school-queue", {});
          const row = queue.connections.find(
            (r: { id: string }) => r.id === requestId,
          );
          assert.equal(row.contact_email, "head@academy.example");
          assert.equal(row.institution_name, "Fixture Academy");
          assert.equal(row.org_id, school.id);
        },
      );

      await t.test(
        "the queue shows shared districts and imports nothing from them",
        async () => {
          const queue = await ops("school-queue", {});
          assert.deepEqual(
            queue.clever.awaitingConnection.map(
              (d: { districtId: string }) => d.districtId,
            ),
            [D, OTHER],
          );
          assert.equal(
            queue.clever.awaitingConnection[0].connectionType,
            "anyschool",
          );
          assert.deepEqual(queue.clever.launchedSchools, {
            production: 0,
            sandbox: 0,
          });
          assert.equal(
            (await ops("school-queue", {}, false)).clever.awaitingConnection,
            null,
            "without credentials the queue still reads AMP's own counts",
          );
          const shared = clever.client.sharedDistricts;
          clever.client.sharedDistricts = async () => {
            throw new CleverSyncError("clever_http_503");
          };
          const down = await ops("school-queue", {});
          clever.client.sharedDistricts = shared;
          assert.equal(down.clever.awaitingConnection, null);
          assert.equal(
            down.clever.awaitingError,
            "clever_http_503",
            "Clever down: the queue still answers, and says why",
          );
          assert.equal(
            (
              await db!.query(
                "SELECT count(*)::int AS n FROM amp_clever_connections",
              )
            ).rows[0].n,
            0,
          );
        },
      );

      await t.test(
        "the operator records Clever's invitation and its district",
        async () => {
          const invited = await ops("anyschool-invite", {
            id: requestId,
            districtId: D,
            reference: "Clever dashboard invite 2026-11-20",
          });
          assert.equal(invited.status, "invited");
          assert.equal(invited.districtId, D);
          // After the invitation, the request stands as sent.
          await requestAnySchool(
            repo,
            { orgId: school.id, accountId: leaderAccount },
            { ...ask, setupEmail: "someone-else@academy.example" },
          );
          const state = await anySchoolState(db!, school.id);
          assert.equal(state?.status, "invited");
          assert.equal(state?.setupEmail, "head@academy.example");
          assert.ok(state?.invitedAt);
        },
      );

      let districtOrgId = "";
      let connectionId = "";
      await t.test(
        "connecting waits for the school's setup and refuses a non-AnySchool district",
        async () => {
          tokens.delete(D);
          await assert.rejects(
            ops("anyschool-connect", { id: requestId }),
            /district_not_authorized/,
            "no token yet: the school has not finished Clever's setup",
          );
          tokens.add(D);
          await assert.rejects(
            ops("anyschool-connect", { id: requestId, districtId: OTHER }),
            /anyschool_district_mismatch/,
          );
          await assert.rejects(
            ops("anyschool-connect", { id: requestId }, false),
            /clever_unconfigured/,
          );
          await assert.rejects(
            ops("anyschool-import", { id: requestId }),
            /anyschool_not_connected/,
          );
        },
      );

      await t.test(
        "connecting makes the district, its agreement and a staged import",
        async () => {
          const connected = await ops("anyschool-connect", { id: requestId });
          assert.equal(connected.status, "connected");
          districtOrgId = connected.districtOrgId;
          connectionId = connected.connectionId;
          assert.equal(
            connected.adoptUrl,
            `https://amp.example/school/adopt/${districtOrgId}`,
          );
          assert.deepEqual(
            await ops("anyschool-connect", { id: requestId }),
            { ...connected },
            "connecting again changes nothing",
          );
          const agreement = (
            await db!.query(
              "SELECT version,signer_name,signer_account_id FROM amp_data_agreements WHERE org_id=$1",
              [districtOrgId],
            )
          ).rows;
          assert.deepEqual(agreement, [
            {
              version: AGREEMENT_VERSION,
              signer_name: "Head Of School",
              signer_account_id: leaderAccount,
            },
          ]);
          const actor = await loadActor(db!, leaderAccount);
          assert.ok(
            can(actor, "integrations.manage", {
              kind: "org",
              orgId: districtOrgId,
              path: [districtOrgId],
            }),
            "the requester administers the AnySchool district",
          );
          const connection = (
            await db!.query(
              "SELECT district_id,sync_paused,sync_requested_at,last_sync_at FROM amp_clever_connections WHERE id=$1",
              [connectionId],
            )
          ).rows[0];
          assert.equal(connection.district_id, D);
          assert.equal(connection.sync_paused, true);
          assert.ok(connection.sync_requested_at);
          assert.equal(connection.last_sync_at, null);
          await assert.rejects(
            ops("anyschool-import", { id: requestId }),
            /anyschool_stage_pending/,
            "nothing to review until the worker stages the roster",
          );
          // The worker caches the roster for review, creating no one.
          await runDueCleverSync(db!, connectionId, worker);
          assert.equal(
            (
              await db!.query(
                "SELECT count(*)::int AS n FROM amp_people WHERE tenant_id=$1",
                [districtOrgId],
              )
            ).rows[0].n,
            1,
            "only the requester, as the district's administrator",
          );
          const queue = await ops("school-queue", {});
          assert.deepEqual(queue.clever.stagedSchools, {
            production: 0,
            sandbox: 1,
          });
          assert.deepEqual(queue.clever.launchedSchools, {
            production: 0,
            sandbox: 0,
          });
          assert.deepEqual(
            queue.clever.awaitingConnection.map(
              (d: { districtId: string }) => d.districtId,
            ),
            [OTHER],
          );
          await assert.rejects(
            ops("anyschool-import", { id: requestId }),
            /anyschool_schools_unmatched/,
            "an unmatched Clever school would duplicate the pilot's learners",
          );
          const again = await requestAnySchool(
            repo,
            { orgId: school.id, accountId: leaderAccount },
            ask,
          );
          assert.deepEqual(
            again,
            { id: requestId, status: "connected", created: false },
            "asking again once connected keeps the connected request",
          );
          assert.equal(
            (await anySchoolState(db!, school.id))?.districtOrgId,
            districtOrgId,
          );
        },
      );

      await t.test(
        "the teacher's pilot moves in through the reviewed adoption",
        async () => {
          // The district's administrator shares /school/adopt/<district>;
          // the pilot's teacher authorizes that exact district.
          const options = await schoolAdoptionOptions(
            db!,
            teacherAccount,
            districtOrgId,
          );
          assert.deepEqual(
            options.schools.map((s: { id: string }) => s.id),
            [pilot.id],
          );
          const grant = await issueSchoolAdoption(db!, teacherAccount, {
            schoolId: pilot.id,
            districtId: districtOrgId,
          });
          const staged = await storedAdoptionSnapshot(db!, connectionId, S);
          // No Clever district administrator exists: the requester's AMP
          // grant is the authority, with no Clever proof to refresh.
          await acceptSchoolAdoption(
            db!,
            leaderAccount,
            grant.token,
            {
              cleverSchool: { connectionId, schoolId: S },
              cleverPeople: [
                { personId: teacher.personId, userId: TEACHER },
                { personId: learner.personId, userId: PILOT_STUDENT },
              ],
              cleverSections: [{ classId: pilotClass.id, sectionId: MATH }],
            },
            { snapshot: staged },
          );
          assert.equal(
            (await anySchoolState(db!, school.id))?.status,
            "connected",
          );
        },
      );

      await t.test(
        "the import continues the pilot and takes the CSV's gaps in stride",
        async () => {
          const started = await ops("anyschool-import", { id: requestId });
          assert.deepEqual(
            {
              status: started.status,
              schools: started.schools,
              newSchools: started.newSchools,
            },
            { status: "importing", schools: 1, newSchools: 0 },
          );
          const result = await runDueCleverSync(db!, connectionId, worker);
          assert.equal(result?.mode, "full");
          assert.deepEqual(result?.counts, {
            schools: 1,
            users: 7,
            sections: 2,
            courses: 0,
            terms: 0,
          });
          // The pilot's school, class and learner continue under their IDs.
          const bound = (
            await db!.query(
              "SELECT kind,clever_id,local_id FROM amp_clever_bindings WHERE connection_id=$1 AND kind IN ('school','section','user')",
              [connectionId],
            )
          ).rows;
          const local = (id: string) =>
            bound.find((b) => b.clever_id === id)?.local_id;
          assert.equal(local(S), pilot.id);
          assert.equal(local(MATH), pilotClass.id);
          assert.equal(local(PILOT_STUDENT), learner.personId);
          assert.equal(local(TEACHER), teacher.personId);
          assert.equal(
            (
              await db!.query("SELECT learner_id FROM amp_people WHERE id=$1", [
                learner.personId,
              ])
            ).rows[0].learner_id,
            learner.learnerId,
          );
          assert.equal(
            (
              await db!.query(
                "SELECT count(*)::int AS n FROM amp_people WHERE tenant_id=$1 AND learner_id IS NOT NULL",
                [districtOrgId],
              )
            ).rows[0].n,
            4,
            "four students, the pilot's learner once",
          );
          const people = new Map(
            (
              await db!.query(
                `SELECT b.clever_id,p.email,p.grade_level,p.identifier,l.birth_year
                 FROM amp_clever_bindings b JOIN amp_people p ON p.id=b.local_id
                 LEFT JOIN amp_learners l ON l.id=p.learner_id
                 WHERE b.connection_id=$1 AND b.kind='user'`,
                [connectionId],
              )
            ).rows.map((r) => [r.clever_id, r]),
          );
          // CSV User_id arrives as sis_id and is the school's identifier.
          assert.equal(people.get(KINDER).identifier, "1002");
          assert.equal(people.get(KINDER).grade_level, 0);
          assert.equal(
            people.get(KINDER).email,
            "kinder@students.academy.example",
          );
          assert.equal(people.get(UNGRADED).grade_level, null);
          assert.equal(
            people.get(UNGRADED).birth_year,
            2015,
            "Ungraded: the cohort year of the CSV's DOB",
          );
          assert.equal(people.get(BARE).email, null);
          assert.equal(people.get(BARE).grade_level, null);
          assert.equal(people.get(PRINCIPAL).identifier, "3001");
          // No terms: classes sit in one stable school-year calendar.
          const classes = (
            await db!.query(
              `SELECT c.id,c.course_id,s.kind FROM amp_classes c JOIN amp_academic_sessions s ON s.id=c.session_id
               JOIN amp_clever_bindings b ON b.local_id=c.id AND b.kind='section' AND b.connection_id=$1`,
              [connectionId],
            )
          ).rows;
          assert.equal(classes.length, 2);
          assert.ok(classes.every((c) => c.kind === "year" && !c.course_id));
          // CSV "staff" are school administrators; an idle teacher has a role.
          const roles = (
            await db!.query(
              `SELECT b.clever_id,r.role FROM amp_org_roles r JOIN amp_clever_bindings b ON b.local_id=r.person_id
               AND b.kind='user' AND b.connection_id=$1 WHERE r.org_id=$2 AND r.end_on IS NULL`,
              [connectionId, pilot.id],
            )
          ).rows;
          assert.ok(
            roles.some((r) => r.clever_id === PRINCIPAL && r.role === "admin"),
          );
          assert.ok(
            roles.some(
              (r) => r.clever_id === IDLE_TEACHER && r.role === "teacher",
            ),
          );
          assert.deepEqual(
            await ops("anyschool-import", { id: requestId }),
            { id: requestId, status: "importing", connectionId },
            "starting again changes nothing",
          );
          const queue = await ops("school-queue", {});
          assert.deepEqual(queue.clever.launchedSchools, {
            production: 0,
            sandbox: 1,
          });
          assert.deepEqual(queue.clever.stagedSchools, {
            production: 0,
            sandbox: 0,
          });
          const row = queue.clever.connections.find(
            (c: { connectionId: string }) => c.connectionId === connectionId,
          );
          assert.equal(row.state, "launched");
          assert.equal(row.connectionType, "anyschool");
          assert.equal(
            queue.connections.some((r: { id: string }) => r.id === requestId),
            false,
            "an imported request leaves the queue",
          );
        },
      );

      await t.test(
        "a school's own request: a root school, signed, one district each",
        async () => {
          await assert.rejects(
            requestAnySchool(
              repo,
              { orgId: pilot.id, accountId: teacherAccount },
              ask,
            ),
            /anyschool_root_school_required/,
            "the adopted pilot is in its AnySchool district now",
          );
          const child = await repo.createOrg({
            kind: "school",
            name: "Campus",
            timezone: "America/Chicago",
            parentId: districtOrgId,
          });
          assert.equal(await anySchoolState(db!, child.id), null);
          const other = await repo.createOrg({
            kind: "school",
            name: "Other School",
            timezone: "America/Chicago",
          });
          const stale = await requestAnySchool(
            repo,
            { orgId: other.id, accountId: leaderAccount },
            ask,
          );
          await db!.query(
            "UPDATE amp_school_connection_requests SET agreement_version='2020-01-01' WHERE id=$1",
            [stale.id],
          );
          await assert.rejects(
            ops("anyschool-connect", { id: stale.id, districtId: OTHER }),
            /anyschool_agreement_required/,
          );
          await db!.query(
            "UPDATE amp_school_connection_requests SET agreement_version=$2 WHERE id=$1",
            [stale.id, AGREEMENT_VERSION],
          );
          await assert.rejects(
            ops("anyschool-connect", { id: stale.id, districtId: OTHER }),
            /anyschool_requester_authority_ended/,
            "the leader never administered this school",
          );
          await repo.addStaff({
            orgId: other.id,
            role: "admin",
            givenName: "Head",
            accountId: leaderAccount,
          });
          await assert.rejects(
            ops("anyschool-connect", { id: stale.id, districtId: OTHER }),
            /anyschool_connection_type_mismatch/,
            "a Secure Sync district connects through its own administrator",
          );
          await assert.rejects(
            ops("anyschool-invite", { id: stale.id, districtId: D }),
            /anyschool_district_already_requested/,
          );
          // One administrator, two schools, the same setup email.
          const third = await repo.createOrg({
            kind: "school",
            name: "Third School",
            timezone: "America/Chicago",
          });
          await repo.addStaff({
            orgId: third.id,
            role: "admin",
            givenName: "Head",
            accountId: leaderAccount,
          });
          const thirdAsk = await requestAnySchool(
            repo,
            { orgId: third.id, accountId: leaderAccount },
            ask,
          );
          assert.notEqual(thirdAsk.id, stale.id);
          // A district claimed by one request never connects another.
          const CLAIMED = "a00000000000000000000003";
          tokens.add(CLAIMED);
          await ops("anyschool-invite", {
            id: thirdAsk.id,
            districtId: CLAIMED,
          });
          await assert.rejects(
            ops("anyschool-connect", { id: stale.id, districtId: CLAIMED }),
            /anyschool_district_already_requested/,
          );
          // The unsigned legacy contact form is not the school's request.
          const legacy = randomUUID();
          await db!.query(
            `INSERT INTO amp_school_connection_requests(id,account_id,org_id,institution_name,contact_email,method)
             VALUES($1,$2,$3,'Fourth','teacher@personal.example','anyschool')`,
            [legacy, teacherAccount, other.id],
          );
          assert.equal(
            (await anySchoolState(db!, other.id))?.setupEmail,
            "head@academy.example",
          );
          await assert.rejects(
            ops("anyschool-invite", { id: legacy }),
            /anyschool_agreement_required/,
          );
          assert.equal(
            (await ops("school-queue", {})).connections.find(
              (r: { id: string }) => r.id === legacy,
            ).signed,
            false,
          );
        },
      );
    } finally {
      await db?.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
