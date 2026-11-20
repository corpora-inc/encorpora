import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import {
  birthYearForGrade,
  SchoolRepository,
} from "../src/schools/repository.js";
import { registerCleverConnection } from "../src/schools/clever/connection.js";
import { syncCleverConnection } from "../src/schools/clever/sync.js";
import {
  birthYearFromDob,
  type Snapshot,
} from "../src/schools/clever/model.js";
import { can, loadActor } from "../src/schools/authz.js";
import { classLiveSql } from "../src/schools/pilot-access.js";
import { classIsPast } from "../src/schools/years.js";

/*
 * Clever's "Certification ISD - Events" sandbox changes its roster over three
 * days to exercise the edge cases in Clever's certification spreadsheet. This
 * suite rebuilds each case with synthetic IDs and walks Day 1 -> 2 -> 3,
 * numbered by the spreadsheet's scenario column.
 */
const hex = (kind: number, n: number) =>
  `${kind}${String(n).padStart(23, "0")}`;
const D = hex(1, 1);
const [A, B, C, C2] = [1, 2, 3, 4].map((n) => hex(2, n));
const [PAST, CURRENT, FUTURE] = [1, 2, 3].map((n) => hex(6, n));
const COURSE = hex(7, 1);
const user = {
  multiTeacher: hex(3, 1),
  portalStaff: hex(3, 2),
  districtAdmin: hex(3, 3),
  multiStudent: hex(3, 4),
  accented: hex(3, 5),
  longName: hex(3, 6),
  shortName: hex(3, 7),
  unenrolled: hex(3, 8),
  idleTeacher: hex(3, 9),
  sisTeacher: hex(3, 10),
  sisStudent: hex(3, 11),
  contact: hex(3, 12),
  contactDay2: hex(3, 13),
  removed: hex(3, 14),
  oldId: hex(3, 15),
  newId: hex(3, 16),
  ungraded: hex(3, 17),
  teacher2: hex(3, 18),
};
const section = {
  numeric: hex(4, 1),
  duplicate1: hex(4, 2),
  duplicate2: hex(4, 3),
  noTeacher: hex(4, 4),
  longSis: hex(4, 5),
  moves: hex(4, 6),
  removed: hex(4, 7),
  future: hex(4, 8),
  current: hex(4, 9),
  otherSchool: hex(4, 10),
  preK: hex(4, 11),
};
const LONG_SIS = "6" + "0".repeat(77);
const day = (n: 1 | 2 | 3): Snapshot => {
  const today = new Date();
  const iso = (days: number) =>
    new Date(today.getTime() + days * 86_400_000).toISOString().slice(0, 10);
  const students = (ids: string[]) =>
    ids.filter((id) => n !== 2 || id !== user.removed);
  const swapped = n === 2 ? user.newId : user.oldId;
  const s = (
    id: string,
    school: string,
    name: string,
    extra: Partial<Snapshot["sections"][number]> = {},
  ) => ({
    id,
    district: D,
    school,
    name,
    students: [],
    teachers: [user.multiTeacher],
    term_id: PAST,
    course: COURSE,
    ...extra,
  });
  const sections: Snapshot["sections"] = [
    // 4: numeric name; 37: a term that ended long ago.
    s(section.numeric, A, "581", {
      sis_id: "581",
      students: students([user.multiStudent, user.removed, swapped]),
    }),
    // 5: same name, course, period and term at one school, same teacher.
    s(section.duplicate1, A, "Math 7 - Hauck - 7", {
      sis_id: "642",
      period: "7",
      students: [user.accented],
    }),
    s(section.duplicate2, A, "Math 7 - Hauck - 7", {
      sis_id: "643",
      period: "7",
      students: [user.longName],
    }),
    // 6: shared without any teacher.
    s(section.noTeacher, B, "Unstaffed", {
      teachers: [],
      students: [user.shortName],
    }),
    // 19: a 78-digit SIS ID that a spreadsheet shows as 6E+77.
    s(section.longSis, A, "Long ID", {
      sis_id: LONG_SIS,
      students: [user.sisStudent],
      teachers: [user.sisTeacher],
    }),
    // 20: the same section moves from school A to school B.
    s(section.moves, n === 1 ? A : B, "Moves", {
      students: [user.multiStudent],
    }),
    s(section.future, A, "Future term", {
      term_id: FUTURE,
      students: [user.multiStudent],
    }),
    s(section.current, A, "Current term", {
      term_id: CURRENT,
      students: [user.multiStudent],
    }),
    // 13/14: the primary school is A, the section is at B.
    s(section.otherSchool, B, "At B", { students: [user.multiStudent] }),
    // 21/22/28: a PreK section grade for grade-9 students.
    s(section.preK, A, "Mislabelled", {
      grade: "PreKindergarten",
      students: [user.accented],
    }),
  ];
  // 16: present on Day 1, gone on Day 2, back on Day 3.
  if (n !== 2)
    sections.push(
      s(section.removed, A, "Comes back", { students: [user.multiStudent] }),
    );
  const student = (
    id: string,
    first: string | null,
    last: string | null,
    role: Record<string, unknown>,
    email: string | null = null,
  ) => ({
    id,
    district: D,
    name: { first, last },
    email,
    roles: { student: { school: A, schools: [A], grade: "9", ...role } },
  });
  const users = [
    // 1/14: teacher at two schools, primary A.
    {
      id: user.multiTeacher,
      district: D,
      name: { first: "Bertha", last: "Daniel" },
      roles: { teacher: { school: A, schools: [A, B], sis_id: "4" } },
    },
    // 3: Clever's default staff role at two schools.
    {
      id: user.portalStaff,
      district: D,
      name: { first: "Emily", last: "Smyth" },
      roles: {
        staff: { schools: [A, B], staff_id: "4", roles: ["PortalOnly"] },
      },
    },
    {
      id: user.districtAdmin,
      district: D,
      name: { first: "Amelie", last: "Zeng" },
      roles: { district_admin: { title: "" } },
    },
    // 2/13/38: one learner at A and B; school C is added on Day 2.
    student(user.multiStudent, "Nicole", "Beier", {
      schools: n === 1 ? [A, B] : [A, B, C],
      sis_id: "101565758",
      credentials: { district_username: "nbeier" },
    }),
    // 8/10: apostrophe, accent and a quote mark in the email.
    student(
      user.accented,
      "José",
      "O'Hara",
      { sis_id: "165006548" },
      `o"hara@example.org`,
    ),
    // 9/11: a 150-character first name and an email without @.
    student(
      user.longName,
      "Thomas".repeat(25),
      // Over the limit with an emoji on the cut.
      "a" + "\u{1F600}".repeat(120),
      { sis_id: "503355910" },
      "thomas_s.example.net",
    ),
    // 12/29: two letters, no family name, PreK where the district means K.
    student(user.shortName, "Li", null, {
      school: B,
      schools: [B],
      grade: "PreKindergarten",
      sis_id: "100095233",
    }),
    // 29: no placeable grade; the date of birth fills in.
    student(user.ungraded, "Una", "Graded", {
      grade: "Ungraded",
      dob: "10/12/2015",
    }),
    // 17: a student in no section.
    student(user.unenrolled, "Patricia", "Stoltenberg", {
      sis_id: "349441809",
    }),
    // 18/39: a teacher in no section who transfers A -> B on Day 3.
    {
      id: user.idleTeacher,
      district: D,
      name: { first: "Idle", last: "Teacher" },
      roles: {
        teacher: n === 3 ? { school: B, schools: [B] } : { school: A },
      },
    },
    // 33: a teacher and a student share an SIS ID.
    {
      id: user.sisTeacher,
      district: D,
      name: { first: "Haley", last: "Hahn" },
      email: n === 2 ? "hahn_haley.example.com" : "hahn_haley@example.com",
      roles: { teacher: { school: A, sis_id: "427165340" } },
    },
    student(user.sisStudent, "Nicole", "Same-ID", { sis_id: "427165340" }),
    // 15: removed on Day 2, back on Day 3.
    ...(n === 2
      ? []
      : [student(user.removed, "Walter", "Howe", { sis_id: "872478532" })]),
    // 30: a new SIS ID gives a new Clever ID on Day 2; the old one returns.
    student(swapped, "Martha", "Greenholt", {
      sis_id: n === 2 ? "9131139200" : "913113920",
    }),
    // 35/36: a contact whose Clever ID and type change day to day.
    {
      id: n === 2 ? user.contactDay2 : user.contact,
      district: D,
      name: { first: "Parent", last: "Contact" },
      roles: {
        contact: {
          type: n === 2 ? "guardian" : "parent",
          students: [user.multiStudent],
        },
      },
    },
  ];
  return {
    district: { id: D, name: "Certification fixture" },
    // 23: one campus split into several school sites.
    schools: [
      { id: A, district: D, name: "City High School" },
      { id: B, district: D, name: "Pineapple Elementary School" },
      { id: C, district: D, name: "Rockaway Beach Middle School" },
      { id: C2, district: D, name: "Rockaway Beach Middle School Campus 2" },
    ],
    users: users as Snapshot["users"],
    sections,
    courses: [{ id: COURSE, district: D, name: "Mathematics" }],
    terms: [
      {
        id: PAST,
        district: D,
        name: "Y1",
        start_date: "2012-08-01",
        end_date: "2013-06-01",
      },
      {
        id: CURRENT,
        district: D,
        name: "This year",
        start_date: iso(-60),
        // Day 3: the term ends while Clever still shares its section.
        end_date: n === 3 ? iso(-1) : iso(200),
      },
      {
        id: FUTURE,
        district: D,
        name: "Next year",
        start_date: iso(300),
        end_date: iso(600),
      },
    ],
  };
};

test(
  "Clever Certification ISD edge cases across Day 1, 2 and 3",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `clever_cert_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    let db: Pool | undefined;
    try {
      await migrate(scoped.href);
      db = new Pool({ connectionString: scoped.href, max: 3 });
      const repo = new SchoolRepository(db);
      const district = await repo.createOrg({
        kind: "district",
        name: "Certification fixture",
        timezone: "America/Chicago",
      });
      await repo.recordDataAgreement(district.id, {
        version: "fixture",
        signerName: "Fixture Admin",
        signerTitle: "District Administrator",
      });
      const connection = await registerCleverConnection(db, {
        environment: "sandbox",
        districtId: D,
        tenantId: district.id,
      });
      let source = day(1);
      const sync = () =>
        syncCleverConnection(
          db!,
          connection.id,
          {
            districtToken: async () => "fixture",
            snapshot: async () => source,
            latestEvent: async () => null,
            events: async () => [],
          },
          { mode: "full" },
        );
      const binding = async (kind: string, id: string) =>
        (
          await db!.query(
            "SELECT local_id,archived_at,record FROM amp_clever_bindings WHERE connection_id=$1 AND kind=$2 AND clever_id=$3",
            [connection.id, kind, id],
          )
        ).rows[0];
      const person = async (id: string) =>
        (
          await db!.query(
            `SELECT p.*,l.name AS learner_name,l.birth_year,b.archived_at AS binding_archived
            FROM amp_clever_bindings b JOIN amp_people p ON p.id=b.local_id
            LEFT JOIN amp_learners l ON l.id=p.learner_id
            WHERE b.connection_id=$1 AND b.kind='user' AND b.clever_id=$2`,
            [connection.id, id],
          )
        ).rows[0];
      const schoolOf = async (id: string) =>
        (await binding("school", id)).local_id;
      const klass = async (id: string) =>
        (
          await db!.query(
            `SELECT c.*,${classLiveSql("c", "o")} AS live FROM amp_classes c
            JOIN amp_orgs o ON o.id=c.org_id WHERE c.id=$1`,
            [(await binding("section", id)).local_id],
          )
        ).rows[0];
      /** Active org roles as [Clever school, role], and active enrollments by
       * Clever section. */
      const roles = async (id: string) =>
        (
          await db!.query(
            `SELECT s.clever_id AS school,r.role FROM amp_org_roles r
            JOIN amp_clever_bindings u ON u.local_id=r.person_id AND u.kind='user'
            LEFT JOIN amp_clever_bindings s ON s.local_id=r.org_id AND s.kind='school' AND s.connection_id=u.connection_id
            WHERE u.connection_id=$1 AND u.clever_id=$2 AND r.end_on IS NULL ORDER BY 1,2`,
            [connection.id, id],
          )
        ).rows.map((r) => `${r.school ?? "district"}:${r.role}`);
      const enrollments = async (id: string) =>
        (
          await db!.query(
            `SELECT k.clever_id FROM amp_enrollments e
            JOIN amp_clever_bindings u ON u.local_id=e.person_id AND u.kind='user'
            JOIN amp_clever_bindings k ON k.local_id=e.class_id AND k.kind='section' AND k.connection_id=u.connection_id
            WHERE u.connection_id=$1 AND u.clever_id=$2 AND e.end_on IS NULL ORDER BY 1`,
            [connection.id, id],
          )
        ).rows.map((r) => r.clever_id);
      const actor = async (id: string) => {
        const accountId = `amp|cert-${id}`;
        await db!.query(
          "UPDATE amp_people SET account_id=$2 WHERE id=$1 AND account_id IS NULL",
          [(await person(id)).id, accountId],
        );
        return loadActor(db!, accountId);
      };
      const classTarget = async (id: string) => {
        const c = await klass(id);
        return {
          kind: "class" as const,
          classId: c.id,
          orgId: c.org_id,
          path: [district.id, c.org_id],
        };
      };
      const day1: Record<string, string> = {};

      await t.test("Day 1 imports every edge case", async () => {
        await sync();
        for (const [name, id] of Object.entries(user))
          day1[name] = (await binding("user", id))?.local_id;

        // 1/14: a teacher at two schools teaches at both.
        assert.deepEqual(await roles(user.multiTeacher), [
          `${A}:teacher`,
          `${B}:teacher`,
        ]);
        assert.ok(
          (await enrollments(user.multiTeacher)).includes(section.otherSchool),
        );

        // 2/13: one person, one learner, memberships follow sections.
        const nicole = await person(user.multiStudent);
        assert.ok(nicole.learner_id);
        assert.deepEqual(await roles(user.multiStudent), [
          `${A}:student`,
          `${B}:student`,
        ]);
        assert.deepEqual(
          await enrollments(user.multiStudent),
          [
            section.numeric,
            section.moves,
            section.future,
            section.current,
            section.otherSchool,
            section.removed,
          ].sort(),
        );

        // 3/6: Clever's default (PortalOnly) staff administer both schools
        // and can open a class no teacher is in; the class's absent teacher
        // role means a teacher elsewhere cannot.
        assert.deepEqual(await roles(user.portalStaff), [
          `${A}:admin`,
          `${B}:admin`,
        ]);
        const staff = await actor(user.portalStaff);
        assert.equal(
          can(staff, "classes.read", await classTarget(section.noTeacher)),
          true,
        );
        assert.equal(
          can(staff, "students.read", {
            kind: "org",
            orgId: await schoolOf(A),
            path: [district.id, await schoolOf(A)],
          }),
          true,
        );
        assert.equal(
          can(
            await actor(user.districtAdmin),
            "classes.read",
            await classTarget(section.noTeacher),
          ),
          true,
        );
        assert.equal(
          can(
            await actor(user.multiTeacher),
            "classes.read",
            await classTarget(section.noTeacher),
          ),
          false,
        );
        assert.equal((await klass(section.noTeacher)).archived_at, null);

        // 4/5: numeric names stay; duplicate names at one school are told apart.
        assert.equal((await klass(section.numeric)).name, "581");
        const [one, two] = [
          (await klass(section.duplicate1)).name,
          (await klass(section.duplicate2)).name,
        ];
        assert.notEqual(one, two);
        assert.equal(one, "Math 7 - Hauck - 7 (642)");
        assert.equal(two, "Math 7 - Hauck - 7 (643)");

        // 8/9/10/11/12: names and emails store exactly or bounded, never fail.
        const jose = await person(user.accented);
        assert.equal(jose.learner_name, "José O'Hara");
        assert.equal(jose.email, `o"hara@example.org`);
        const thomas = await person(user.longName);
        assert.equal(thomas.given_name, "Thomas".repeat(25).slice(0, 100));
        assert.equal(thomas.family_name, "a" + "\u{1F600}".repeat(99));
        assert.equal(thomas.email, "thomas_s.example.net");
        const li = await person(user.shortName);
        assert.equal(li.given_name, "Li");
        assert.equal(li.family_name, null);
        assert.equal(li.learner_name, "Li");

        // 17/18: no section still means a learner/teacher at their school.
        assert.ok((await person(user.unenrolled)).learner_id);
        assert.deepEqual(await roles(user.unenrolled), [`${A}:student`]);
        assert.deepEqual(await enrollments(user.unenrolled), []);
        assert.deepEqual(await roles(user.idleTeacher), [`${A}:teacher`]);
        assert.deepEqual(await enrollments(user.idleTeacher), []);

        // 19: a long, numeric-looking SIS ID is kept as the exact string.
        assert.equal(
          (await binding("section", section.longSis)).record.sis_id,
          LONG_SIS,
        );

        // 21/22/28/29: grades place by the student, never the section label.
        assert.equal((await person(user.accented)).grade_level, 9);
        assert.equal(li.grade_level, null);
        assert.equal(li.birth_year, birthYearForGrade(-1));
        assert.equal(
          (await person(user.ungraded)).birth_year,
          birthYearFromDob("10/12/2015"),
        );

        // 23: split campuses are separate schools under the district.
        assert.notEqual(await schoolOf(C), await schoolOf(C2));

        // 33: the same SIS ID on a teacher and a student is two people.
        const [teacher, student] = [
          await person(user.sisTeacher),
          await person(user.sisStudent),
        ];
        assert.notEqual(teacher.id, student.id);
        assert.equal(teacher.learner_id, null);
        assert.ok(student.learner_id);

        // 35: contacts are never provisioned.
        assert.equal(await binding("user", user.contact), undefined);

        // 7/26/31: usernames and credentials are never stored.
        assert.equal(
          JSON.stringify(
            (await binding("user", user.multiStudent)).record,
          ).includes("nbeier"),
          false,
        );

        // 37: a section Clever shares is live whatever its term dates say.
        for (const id of [section.numeric, section.current, section.future]) {
          const c = await klass(id);
          assert.equal(c.live, true, `section ${id} takes sign-ins`);
          assert.equal(await classIsPast(db!, c.id), false);
        }
        const current = await klass(section.current);
        assert.equal(
          (
            await db!.query(
              "SELECT name FROM amp_academic_sessions WHERE id=$1",
              [current.session_id],
            )
          ).rows[0].name,
          "This year",
        );
      });

      const removedLearner = async () =>
        (await person(user.removed)).learner_id;
      let walterLearner: string;
      await t.test("Day 2 removes, swaps, moves and adds", async () => {
        walterLearner = await removedLearner();
        source = day(2);
        await sync();
        // 15: the removed student is archived, not deleted.
        const walter = await person(user.removed);
        assert.ok(walter.binding_archived);
        assert.equal(walter.learner_id, walterLearner);
        assert.deepEqual(await enrollments(user.removed), []);
        // 16: the removed section's class is archived.
        assert.ok((await klass(section.removed)).archived_at);
        // 30: the new Clever ID is a new person; the old one is archived.
        const [old, fresh] = [
          await person(user.oldId),
          await person(user.newId),
        ];
        assert.ok(old.binding_archived);
        assert.notEqual(fresh.id, old.id);
        assert.notEqual(fresh.learner_id, old.learner_id);
        assert.deepEqual(await enrollments(user.newId), [section.numeric]);
        // 20: the section keeps its class and moves school with its people.
        const moved = await klass(section.moves);
        assert.equal(moved.org_id, await schoolOf(B));
        // 38: a school is added to a student.
        assert.deepEqual(await roles(user.multiStudent), [
          `${A}:student`,
          `${B}:student`,
          `${C}:student`,
        ]);
        // 9: an email without @ on a teacher still updates the roster.
        assert.equal(
          (await person(user.sisTeacher)).email,
          "hahn_haley.example.com",
        );
        // 35/36: a contact with a new ID and type is still not provisioned.
        assert.equal(await binding("user", user.contactDay2), undefined);
      });

      await t.test(
        "Day 3 restores returning IDs with their history",
        async () => {
          // The current-term class began a month ago.
          await db!.query(
            "UPDATE amp_classes SET created_at=now()-interval '30 days' WHERE id=$1",
            [(await klass(section.current)).id],
          );
          source = day(3);
          await sync();
          // 15: the same person and learner return to their class.
          const walter = await person(user.removed);
          assert.equal(walter.id, day1.removed);
          assert.equal(walter.learner_id, walterLearner);
          assert.equal(walter.binding_archived, null);
          assert.deepEqual(await enrollments(user.removed), [section.numeric]);
          // 16: the same class returns with its students.
          const back = await klass(section.removed);
          assert.equal(back.archived_at, null);
          assert.equal(back.live, true);
          assert.deepEqual(
            await enrollments(user.multiStudent).then((e) =>
              e.includes(section.removed),
            ),
            true,
          );
          // 30: the old Clever ID returns to the original person; the new one
          // is archived.
          const old = await person(user.oldId);
          assert.equal(old.id, day1.oldId);
          assert.equal(old.binding_archived, null);
          assert.ok((await person(user.newId)).binding_archived);
          assert.deepEqual(await enrollments(user.oldId), [section.numeric]);
          // 37: a term that ends after its class began ends that class, as
          // any AMP session does; the stale 2013 term still does not.
          const ended = await klass(section.current);
          assert.equal(ended.live, false);
          assert.equal(
            (
              await db!.query(
                "SELECT name FROM amp_academic_sessions WHERE id=$1",
                [ended.session_id],
              )
            ).rows[0].name,
            "This year",
          );
          assert.equal((await klass(section.numeric)).live, true);
          // 39: a teacher's transfer ends the old school role.
          assert.deepEqual(await roles(user.idleTeacher), [`${B}:teacher`]);
          // Every run succeeded.
          assert.deepEqual(
            (
              await db!.query(
                "SELECT DISTINCT status FROM amp_clever_sync_runs WHERE connection_id=$1",
                [connection.id],
              )
            ).rows,
            [{ status: "succeeded" }],
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
