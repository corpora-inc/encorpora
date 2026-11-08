import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { schoolAdmin } from "../scripts/school-admin.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { PostgresRepository } from "../src/server/repository.js";

const YEAR_AHEAD = new Date(Date.now() + 365 * 86_400_000).toISOString();
const agreement = {
  version: "fixture-1",
  signerName: "Fixture Signer",
  signerTitle: "Head of School",
};

test(
  "school-admin delete-org removes a whole org tree and nothing else",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_delete_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href);
    const db = learning.pool;
    const schools = new SchoolRepository(db);
    const count = async (sql: string, params: unknown[] = []) =>
      Number((await db.query(sql, params)).rows[0].n);
    const run = (input: object) => schoolAdmin(schools, "delete-org", input);
    const refused = (input: object, code: string) =>
      assert.rejects(
        run(input),
        (error: { code?: string }) => error.code === code,
      );

    async function org(
      name: string,
      reference: string,
      parentId?: string,
      kind = "school",
    ) {
      const created = (await schoolAdmin(schools, "create-org", {
        kind,
        name,
        timezone: "UTC",
        ...(parentId ? { parentId } : {}),
        agreement,
      })) as { id: string };
      await schoolAdmin(schools, "issue-license", {
        orgId: created.id,
        seats: 10,
        endsAt: YEAR_AHEAD,
        reference,
      });
      return created.id;
    }
    async function practice(learnerId: string) {
      const id = randomUUID();
      await db.query(
        "INSERT INTO amp_instances(id,learner_id,content) VALUES($1,$2,$3)",
        [id, learnerId, { public: { id, skillId: "add" }, selection: {} }],
      );
      await db.query(
        "INSERT INTO amp_attempts(id,learner_id,problem_id,request_id,outcome) VALUES($1,$2,$3,$3,$4)",
        [
          randomUUID(),
          learnerId,
          id,
          {
            id,
            problemId: id,
            requestId: id,
            skillId: "add",
            templateId: "fixture-template",
            correct: true,
            assisted: false,
            createdAt: new Date().toISOString(),
          },
        ],
      );
    }
    /** A school with staff, two classes, practicing students, a seat and events. */
    async function populate(orgId: string, label: string) {
      const classA = await schools.createClass(orgId, { name: `${label} A` });
      const classB = await schools.createClass(orgId, { name: `${label} B` });
      await schools.addStaff({
        orgId,
        role: "teacher",
        givenName: "Fixture",
        accountId: `amp|teacher-${randomUUID()}`,
        classId: classA.id,
      });
      const students = [];
      for (const classId of [classA.id, classB.id, classA.id]) {
        const student = await schools.provisionStudent(orgId, {
          givenName: "Pupil",
          gradeLevel: 4,
          classId,
        });
        await schools.issueStudentSession({
          personId: student.personId,
          mode: "shared",
        });
        await practice(student.learnerId!);
        students.push(student);
      }
      await db.query(
        "INSERT INTO amp_scope_settings(scope_kind,scope_id,\"values\") VALUES('org',$1,'{}'),('class',$2,'{}'),('person',$3,'{}')",
        [orgId, classA.id, students[0]!.personId],
      );
      return { classA, classB, students };
    }
    const treeRows = async (orgIds: string[]) => ({
      orgs: await count(
        "SELECT count(*) n FROM amp_orgs WHERE id=ANY($1::uuid[])",
        [orgIds],
      ),
      people: await count(
        "SELECT count(*) n FROM amp_people WHERE tenant_id=ANY($1::uuid[])",
        [orgIds],
      ),
      events: await count(
        "SELECT count(*) n FROM amp_school_events WHERE org_id=ANY($1::uuid[])",
        [orgIds],
      ),
      licenses: await count(
        "SELECT count(*) n FROM amp_school_licenses WHERE org_id=ANY($1::uuid[])",
        [orgIds],
      ),
      classes: await count(
        "SELECT count(*) n FROM amp_classes WHERE org_id=ANY($1::uuid[])",
        [orgIds],
      ),
      sessions: await count(
        "SELECT count(*) n FROM amp_academic_sessions WHERE org_id=ANY($1::uuid[])",
        [orgIds],
      ),
      roles: await count(
        "SELECT count(*) n FROM amp_org_roles WHERE org_id=ANY($1::uuid[])",
        [orgIds],
      ),
      seats: await count(
        "SELECT count(*) n FROM amp_seats s JOIN amp_school_licenses l ON l.id=s.license_id WHERE l.org_id=ANY($1::uuid[])",
        [orgIds],
      ),
      agreements: await count(
        "SELECT count(*) n FROM amp_data_agreements WHERE org_id=ANY($1::uuid[])",
        [orgIds],
      ),
      attempts: await count(
        `SELECT count(*) n FROM amp_attempts a JOIN amp_people p ON p.learner_id=a.learner_id WHERE p.tenant_id=ANY($1::uuid[])`,
        [orgIds],
      ),
    });
    const overall = async () => ({
      orgs: await count("SELECT count(*) n FROM amp_orgs"),
      people: await count("SELECT count(*) n FROM amp_people"),
      learners: await count("SELECT count(*) n FROM amp_learners"),
      attempts: await count("SELECT count(*) n FROM amp_attempts"),
      events: await count("SELECT count(*) n FROM amp_school_events"),
      seats: await count("SELECT count(*) n FROM amp_seats"),
      sessions: await count("SELECT count(*) n FROM amp_student_sessions"),
      credentials: await count("SELECT count(*) n FROM amp_person_credentials"),
      scopes: await count("SELECT count(*) n FROM amp_scope_settings"),
    });

    try {
      const pilot = await org("Pilot Fixture School", "Pilot");
      const other = await org("Bystander Fixture School", "PO-100");
      const mine = await populate(pilot, "Mine");
      await populate(other, "Theirs");

      // A family child owned by a parent and an adult learner, both members.
      const parent = `amp|parent-${randomUUID()}`;
      const child = randomUUID();
      const adult = randomUUID();
      await db.query(
        "INSERT INTO amp_learners(id,account_id,name,birth_year) VALUES($1,$2,'Family Child',2018)",
        [child, parent],
      );
      await db.query(
        "INSERT INTO amp_learners(id,account_id,name,adult,timezone) VALUES($1,$2,'Adult',true,'UTC')",
        [adult, `amp|adult-${randomUUID()}`],
      );
      await practice(child);
      await practice(adult);
      const member = mine.students[1]!;
      await db.query("UPDATE amp_people SET learner_id=NULL WHERE id=$1", [
        member.personId,
      ]);
      await db.query("DELETE FROM amp_learners WHERE id=$1", [
        member.learnerId,
      ]);
      await db.query("UPDATE amp_people SET learner_id=$2 WHERE id=$1", [
        member.personId,
        child,
      ]);
      const teacher = (
        await db.query(
          "SELECT p.id FROM amp_people p JOIN amp_org_roles r ON r.person_id=p.id WHERE p.tenant_id=$1 AND r.role='teacher'",
          [pilot],
        )
      ).rows[0].id;
      await db.query("UPDATE amp_people SET learner_id=$2 WHERE id=$1", [
        teacher,
        adult,
      ]);

      const orgBefore = await treeRows([pilot]);
      const everything = await overall();
      assert.ok(
        orgBefore.events > 0 && orgBefore.seats > 0 && orgBefore.attempts > 0,
      );

      await t.test("a dry run counts and changes nothing", async () => {
        const result = (await run({
          orgId: pilot,
          confirm: "Pilot Fixture School",
        })) as {
          commit: boolean;
          orgs: number;
          counts: Record<string, number>;
          remaining: object;
        };
        assert.equal(result.commit, false);
        assert.equal(result.orgs, 1);
        assert.equal(result.counts.people, 4);
        assert.equal(result.counts.learners, 2);
        assert.equal(result.counts.learnersDetached, 2);
        assert.equal(result.counts.events, orgBefore.events);
        assert.equal(result.counts.classes, 2);
        assert.deepEqual(result.remaining, { orgs: 0, people: 0 });
        assert.deepEqual(await overall(), everything);
        assert.deepEqual(await treeRows([pilot]), orgBefore);
      });

      await t.test("refusals", async () => {
        await refused(
          { orgId: pilot, confirm: "pilot fixture school", commit: true },
          "confirm_mismatch",
        );
        await refused(
          { orgId: other, confirm: "Bystander Fixture School", commit: true },
          "org_licensed",
        );
        await refused({ orgId: randomUUID(), confirm: "x" }, "org_not_found");
        assert.deepEqual(await overall(), everything);
      });

      await t.test("a licensed org goes only with allowLicensed", async () => {
        const dry = (await run({
          orgId: other,
          confirm: "Bystander Fixture School",
          allowLicensed: true,
        })) as { counts: Record<string, number> };
        assert.equal(dry.counts.people, 4);
        assert.deepEqual(await overall(), everything);
      });

      await t.test("a commit removes the tree, and only the tree", async () => {
        const otherBefore = await treeRows([other]);
        const result = (await run({
          orgId: pilot,
          confirm: "Pilot Fixture School",
          commit: true,
        })) as { commit: boolean; remaining: object };
        assert.equal(result.commit, true);
        assert.deepEqual(result.remaining, { orgs: 0, people: 0 });
        const gone = await treeRows([pilot]);
        for (const [name, value] of Object.entries(gone))
          assert.equal(value, 0, name);
        assert.equal(
          await count(
            "SELECT count(*) n FROM amp_scope_settings WHERE scope_id::text=ANY($1::text[])",
            [[pilot, mine.classA.id, mine.students[0]!.personId]],
          ),
          0,
        );
        assert.equal(
          await count("SELECT count(*) n FROM amp_learners WHERE id=$1", [
            mine.students[0]!.learnerId,
          ]),
          0,
        );
        // The other school is exactly as it was.
        assert.deepEqual(await treeRows([other]), otherBefore);
        const after = await overall();
        assert.equal(after.orgs, everything.orgs - 1);
        assert.equal(after.people, everything.people - 4);
        // A parent-owned child and an adult learner survive with their evidence, detached.
        for (const id of [child, adult]) {
          assert.equal(
            await count("SELECT count(*) n FROM amp_learners WHERE id=$1", [
              id,
            ]),
            1,
          );
          assert.equal(
            await count(
              "SELECT count(*) n FROM amp_attempts WHERE learner_id=$1",
              [id],
            ),
            1,
          );
        }
      });

      await t.test(
        "a district is deleted from its root, never from a child",
        async () => {
          const district = await org(
            "Root Fixture District",
            "Evaluation",
            undefined,
            "district",
          );
          const child1 = await org("Child Fixture School", "Pilot", district);
          await populate(child1, "Kid");
          await refused(
            { orgId: child1, confirm: "Child Fixture School", commit: true },
            "org_has_parent",
          );
          const dry = (await run({
            orgId: district,
            confirm: "Root Fixture District",
          })) as { orgs: number };
          assert.equal(dry.orgs, 2);
          assert.ok((await treeRows([child1])).classes > 0);
          const done = (await run({
            orgId: district,
            confirm: "Root Fixture District",
            commit: true,
          })) as {
            orgs: number;
            remaining: object;
          };
          assert.equal(done.orgs, 2);
          assert.deepEqual(await treeRows([district, child1]), {
            orgs: 0,
            people: 0,
            events: 0,
            licenses: 0,
            classes: 0,
            sessions: 0,
            roles: 0,
            seats: 0,
            agreements: 0,
            attempts: 0,
          });
          assert.equal((await treeRows([other])).people, 4);
        },
      );

      await t.test(
        "the event trigger refuses DELETE without the setting and UPDATE always",
        async () => {
          const event = (
            await db.query(
              "SELECT id FROM amp_school_events WHERE org_id=$1 LIMIT 1",
              [other],
            )
          ).rows[0].id;
          await assert.rejects(
            db.query("DELETE FROM amp_school_events WHERE id=$1", [event]),
            /append-only/,
          );
          const client = await db.connect();
          try {
            await client.query("BEGIN");
            await client.query("SET LOCAL amp.retention_purge='school-org'");
            await assert.rejects(
              client.query(
                "UPDATE amp_school_events SET action='x' WHERE id=$1",
                [event],
              ),
              /append-only/,
            );
            await client.query("ROLLBACK");
            await client.query("BEGIN");
            await client.query("SET LOCAL amp.retention_purge='financial'");
            await assert.rejects(
              client.query("DELETE FROM amp_school_events WHERE id=$1", [
                event,
              ]),
              /append-only/,
            );
            await client.query("ROLLBACK");
          } finally {
            client.release();
          }
          await assert.rejects(
            db.query("UPDATE amp_school_events SET action='x' WHERE id=$1", [
              event,
            ]),
            /append-only/,
          );
          assert.equal(
            await count(
              "SELECT count(*) n FROM amp_school_events WHERE id=$1",
              [event],
            ),
            1,
          );
        },
      );
    } finally {
      await learning.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
