import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { convertFamilies } from "../scripts/convert-families.js";
import { migrate } from "../scripts/migrate.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

/* Families are classes (docs/families.md, steps 3 and 4). A family's child is
   a student of the family's class, signs in with the class code and pictures,
   and keeps the learner the parent's account owns. Every name here is made up. */
test(
  "families as classes: new families, student sessions, conversion and privacy",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_family_class_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href);
    const db = learning.pool;
    const authenticate = refuseStudentTokens(async (request) => {
      const header = request.headers.authorization;
      if (header?.startsWith("Bearer amp|")) return header.slice(7);
      throw new ApiError(401, "Sign in to continue");
    });
    const app = buildApp({ repository: learning, authenticate });
    await registerFamilyRoutes(app, { pool: db, authenticate });
    await registerSchoolRoutes(app, { pool: db, authenticate });
    await app.ready();
    t.after(async () => {
      await app.close();
      await learning.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });

    const as = (credential: string) => ({
      authorization: `Bearer ${credential}`,
    });
    const get = (path: string, credential: string) =>
      app.inject({ method: "GET", url: path, headers: as(credential) });
    const post = (path: string, credential: string, payload: object = {}) =>
      app.inject({
        method: "POST",
        url: path,
        headers: as(credential),
        payload,
      });
    const open = (path: string, payload: object) =>
      app.inject({ method: "POST", url: path, payload });
    const me = async (credential: string) => {
      const response = await get("/api/v1/me", credential);
      assert.equal(response.statusCode, 200, response.body);
      return response.json();
    };
    const user = async (name: string) => {
      const id = randomUUID();
      await db.query(
        `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
         VALUES($1,$2,$3,true,now(),now())`,
        [id, name, `${id}@family.example`],
      );
      return `amp|${id}`;
    };
    const consent = (account: string) =>
      db.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'policy','verified','fixture-proof')",
        [account],
      );
    const paid = (learnerId: string) =>
      db.query(
        `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
         VALUES($1,$2,'stripe',$1,'active',now()-interval '1 day',now()+interval '300 days')`,
        [`fixture:${learnerId}`, learnerId],
      );
    const count = async (table: string) =>
      (await db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;
    /** One child's whole learning record, as stored. */
    const record = async (account: string) =>
      (
        await db.query(
          `SELECT json_build_object(
             'learners',(SELECT json_agg(to_jsonb(l) ORDER BY l.id) FROM amp_learners l WHERE l.account_id=$1),
             'grants',(SELECT json_agg(to_jsonb(g) ORDER BY g.id) FROM amp_grants g JOIN amp_learners l ON l.id=g.learner_id WHERE l.account_id=$1),
             'consent',(SELECT json_agg(to_jsonb(c)) FROM amp_parent_consents c WHERE c.account_id=$1),
             'instances',(SELECT json_agg(to_jsonb(i) ORDER BY i.id) FROM amp_instances i JOIN amp_learners l ON l.id=i.learner_id WHERE l.account_id=$1),
             'attempts',(SELECT json_agg(to_jsonb(a) ORDER BY a.id) FROM amp_attempts a JOIN amp_learners l ON l.id=a.learner_id WHERE l.account_id=$1)
           )::text AS record`,
          [account],
        )
      ).rows[0].record as string;
    /** Signs a child in by the class code and three pictures they choose. */
    const joinByPictures = async (code: string, name: string) => {
      const roster = await open("/api/v1/school/join/lookup", { code });
      assert.equal(roster.statusCode, 200, roster.body);
      const student = roster
        .json()
        .students.find((s: { name: string }) => s.name === name);
      assert.ok(student, `${name} is on the class's sign-in list`);
      const grant = await open("/api/v1/school/join/picture", {
        code,
        personId: student.id,
        pictures: ["fox", "moon", "owl"],
        set: true,
      });
      assert.equal(grant.statusCode, 200, grant.body);
      return grant.json() as { token: string; accountId: string };
    };

    await t.test(
      "a new family: the first child makes the class, and siblings join it",
      async () => {
        const parent = await user("Marisol Fixture");
        await consent(parent);
        const before = await me(parent);
        assert.equal(before.familyClass, undefined);
        const maya = await post("/api/v1/learners", parent, {
          name: "Maya",
          birthYear: 2016,
        });
        assert.equal(maya.statusCode, 201, maya.body);
        const mayaId = maya.json().id;
        // Same transaction: the family is there before any `/me` asks.
        const family = (
          await db.query(
            `SELECT f.org_id,f.class_id,f.converted_at,o.kind,o.solo,o.name AS org,c.name AS class,c.course_bands
             FROM amp_families f JOIN amp_orgs o ON o.id=f.org_id JOIN amp_classes c ON c.id=f.class_id
             WHERE f.account_id=$1`,
            [parent],
          )
        ).rows[0];
        assert.equal(family.kind, "family");
        assert.equal(family.solo, true);
        assert.equal(family.class, "Marisol’s class");
        assert.deepEqual(family.course_bands, []);
        assert.equal(family.converted_at, null);
        // The parent is admin and teacher; Maya is a student of the class.
        const roles = (
          await db.query(
            `SELECT p.account_id,p.learner_id,r.role FROM amp_people p JOIN amp_org_roles r ON r.person_id=p.id
             WHERE p.tenant_id=$1 ORDER BY r.role`,
            [family.org_id],
          )
        ).rows;
        assert.deepEqual(
          roles.map((r) => [r.account_id ?? r.learner_id, r.role]),
          [
            [parent, "admin"],
            [mayaId, "student"],
            [parent, "teacher"],
          ],
        );
        const ana = await post("/api/v1/learners", parent, {
          name: "Ana",
          birthYear: 2018,
        });
        assert.equal(ana.statusCode, 201, ana.body);
        assert.equal(await count("amp_families"), 1);
        const enrolled = await db.query(
          "SELECT count(*)::int AS n FROM amp_enrollments WHERE class_id=$1 AND role='student'",
          [family.class_id],
        );
        assert.equal(enrolled.rows[0].n, 2);
        // A brand-new family has nothing to be told about.
        const after = await me(parent);
        assert.deepEqual(after.familyClass, {
          orgId: family.org_id,
          classId: family.class_id,
          className: "Marisol’s class",
          notice: false,
        });
        assert.equal(after.staffOf, undefined, "a family isn't a school");
        // The parent teaches it through the school screens, which hold only
        // what a family uses: no license, seats, import or school privacy.
        const org = await get(`/api/v1/school/orgs/${family.org_id}`, parent);
        assert.equal(org.statusCode, 200, org.body);
        assert.equal(org.json().org.kind, "family");
        const can: string[] = org.json().org.can;
        for (const action of ["classes.read", "signin.manage", "grades.read"])
          assert.ok(can.includes(action), action);
        for (const action of [
          "license.read",
          "students.add",
          "students.remove",
          "privacy.read",
          "roster.import",
          "overview.read",
        ])
          assert.ok(!can.includes(action), action);
        const license = await get(
          `/api/v1/school/orgs/${family.org_id}/license`,
          parent,
        );
        assert.equal(license.statusCode, 404);
        const schools = await get("/api/v1/school/orgs", parent);
        assert.deepEqual(schools.json().orgs, []);
        // A second parent teaches it too: the family is a place of theirs.
        const coTeacher = await user("Rafael Fixture");
        await new SchoolRepository(db).addStaff({
          orgId: family.org_id,
          role: "teacher",
          givenName: "Rafael",
          accountId: coTeacher,
          classId: family.class_id,
        });
        const theirs = await me(coTeacher);
        assert.deepEqual(
          theirs.staffOf?.map((place: { orgId: string }) => place.orgId),
          [family.org_id],
        );
        assert.equal(theirs.familyClass, undefined);
        const taught = await get(
          `/api/v1/school/orgs/${family.org_id}`,
          coTeacher,
        );
        assert.equal(taught.statusCode, 200, taught.body);
        assert.ok(!taught.json().org.can.includes("license.read"));
      },
    );

    await t.test(
      "a child signs in as a student and reaches only their own learner",
      async () => {
        const parent = await user("Teodora Fixture");
        await consent(parent);
        const maya = (
          await post("/api/v1/learners", parent, {
            name: "Maya",
            birthYear: 2016,
          })
        ).json().id as string;
        const ana = (
          await post("/api/v1/learners", parent, {
            name: "Ana",
            birthYear: 2018,
          })
        ).json().id as string;
        await paid(maya);
        await paid(ana);
        const code = (
          await db.query(
            "SELECT c.join_code FROM amp_families f JOIN amp_classes c ON c.id=f.class_id WHERE f.account_id=$1",
            [parent],
          )
        ).rows[0].join_code as string;
        // A second device: the class code, her name and three pictures.
        const grant = await joinByPictures(code, "Maya");
        assert.match(grant.accountId, /^school:/);
        const token = grant.token;
        const own = await me(token);
        assert.equal(own.account.kind, "student");
        assert.notEqual(own.account.id, parent, "never the parent's identity");
        assert.deepEqual(
          own.learners.map((l: { id: string }) => l.id),
          [maya],
        );
        assert.equal(own.learners[0].entitlement.active, true);
        // She practices: problems, an answer, and her day's level is kept.
        const served = await post(`/api/v1/learners/${maya}/batches`, token, {
          count: 1,
        });
        assert.equal(served.statusCode, 200, served.body);
        const problem = served.json().problems[0];
        const answered = await post(
          `/api/v1/learners/${maya}/attempts`,
          token,
          { problemId: problem.id, requestId: randomUUID(), response: "1" },
        );
        assert.equal(answered.statusCode, 200, answered.body);
        const level = await db.query(
          "SELECT 1 FROM amp_level_days WHERE learner_id=$1",
          [maya],
        );
        assert.equal(level.rowCount, 1);
        // Her sister's learner shares the owner, and is still out of reach.
        for (const path of [
          `/api/v1/learners/${ana}/progress`,
          `/api/v1/learners/${ana}/frontier`,
          `/api/v1/learners/${ana}/workbooks`,
        ])
          assert.equal((await get(path, token)).statusCode, 404, path);
        assert.equal(
          (await post(`/api/v1/learners/${ana}/batches`, token, { count: 1 }))
            .statusCode,
          404,
        );
        const listed = await get("/api/v1/learners", token);
        assert.deepEqual(
          listed.json().learners.map((l: { id: string }) => l.id),
          [maya],
        );
        // What her parent decides stays the parent's.
        assert.equal(
          (
            await post(`/api/v1/learners/${maya}/starting-point`, token, {
              band: "3–5",
            })
          ).statusCode,
          403,
        );
        assert.equal(
          (await post("/api/v1/learners", token, { name: "Extra" })).statusCode,
          403,
        );
        for (const path of [
          "/api/v1/family",
          "/api/v1/family/export",
          "/api/v1/me/practice",
        ])
          assert.equal((await get(path, token)).statusCode, 401, path);
        for (const path of [
          "/api/v1/family/consent/withdraw",
          `/api/v1/family/learners/${ana}/practice-here`,
          `/api/v1/family/learners/${maya}/delete-learning-data`,
        ])
          assert.equal((await post(path, token)).statusCode, 401, path);
        const staff = await get("/api/v1/school/orgs", token);
        assert.notEqual(staff.statusCode, 200);

        // On the parent's own device: "Let Ana practice here".
        const here = await post(
          `/api/v1/family/learners/${ana}/practice-here`,
          parent,
        );
        assert.equal(here.statusCode, 201, here.body);
        assert.equal(here.json().mode, "shared");
        const anaMe = await me(here.json().token);
        assert.deepEqual(
          anaMe.learners.map((l: { id: string }) => l.id),
          [ana],
        );
        // Only a child who can practice now is offered, and given, a session.
        const leo = (
          await post("/api/v1/learners", parent, {
            name: "Leo",
            birthYear: 2019,
          })
        ).json().id as string;
        const unpaid = await post(
          `/api/v1/family/learners/${leo}/practice-here`,
          parent,
        );
        assert.equal(unpaid.statusCode, 409, unpaid.body);
        assert.equal(
          (
            await post(
              `/api/v1/family/learners/${randomUUID()}/practice-here`,
              parent,
            )
          ).statusCode,
          404,
        );
      },
    );

    // Two families from before: answers, grants and consent already there.
    const existing = async (name: string, children: string[]) => {
      const parent = await user(name);
      await consent(parent);
      const ids: string[] = [];
      for (const child of children) {
        const id = randomUUID();
        await db.query(
          "INSERT INTO amp_learners(id,account_id,name,birth_year) VALUES($1,$2,$3,2015)",
          [id, parent, child],
        );
        await paid(id);
        ids.push(id);
      }
      return { parent, ids };
    };

    await t.test(
      "an existing family converts on its next visit, once, leaving every record as it was",
      async () => {
        const { parent, ids } = await existing("Ilse Fixture", ["Pia", "Noor"]);
        // Practice before conversion, through the parent as it always was.
        const served = await post(
          `/api/v1/learners/${ids[0]}/batches`,
          parent,
          {
            count: 2,
          },
        );
        assert.equal(served.statusCode, 200, served.body);
        const answered = await post(
          `/api/v1/learners/${ids[0]}/attempts`,
          parent,
          {
            problemId: served.json().problems[0].id,
            requestId: randomUUID(),
            response: "1",
          },
        );
        assert.equal(answered.statusCode, 200, answered.body);
        const before = await record(parent);
        const visit = await me(parent);
        assert.equal(visit.familyClass.notice, true);
        assert.equal(await record(parent), before, "evidence, grants, consent");
        const roster = await db.query(
          "SELECT count(*)::int AS n FROM amp_people WHERE learner_id=ANY($1)",
          [ids],
        );
        assert.equal(roster.rows[0].n, 2);
        // Idempotent: more visits and the operator's command add nothing.
        const rows = async () =>
          Promise.all(
            [
              "amp_orgs",
              "amp_people",
              "amp_org_roles",
              "amp_enrollments",
              "amp_classes",
              "amp_families",
            ].map(count),
          );
        const counted = await rows();
        await me(parent);
        await me(parent);
        const sweep = await convertFamilies(db);
        assert.equal(sweep.familiesCreated, 0);
        assert.deepEqual(await rows(), counted);
        assert.equal(await record(parent), before);
        // The line about the new sign-in goes once dismissed.
        const dismissed = await post(
          "/api/v1/family/class-notice/dismiss",
          parent,
        );
        assert.equal(dismissed.statusCode, 200, dismissed.body);
        assert.equal((await me(parent)).familyClass.notice, false);
      },
    );

    await t.test(
      "the operator's command converts the rest, and never an adult on their own",
      async () => {
        const waiting = await existing("Odile Fixture", ["Rafa"]);
        const adultOnly = await user("Sol Fixture");
        await db.query(
          "INSERT INTO amp_learners(id,account_id,name,adult,timezone) VALUES($1,$2,'Sol',true,'America/Chicago')",
          [randomUUID(), adultOnly],
        );
        const dry = await convertFamilies(db, { dryRun: true });
        assert.equal(dry.accounts, 1);
        assert.equal(dry.familiesCreated, 0);
        const before = await record(waiting.parent);
        const run = await convertFamilies(db, { batch: 1 });
        assert.deepEqual(run, {
          accounts: 1,
          familiesCreated: 1,
          childrenEnrolled: 1,
          failed: 0,
          dryRun: false,
        });
        assert.equal(await record(waiting.parent), before);
        const again = await convertFamilies(db);
        assert.equal(again.accounts, 0);
        assert.equal((await me(adultOnly)).familyClass, undefined);
        const none = await db.query(
          "SELECT 1 FROM amp_families WHERE account_id=$1",
          [adultOnly],
        );
        assert.equal(none.rowCount, 0);
      },
    );

    await t.test(
      "export, deleting a child and withdrawing consent all still work",
      async () => {
        const { parent, ids } = await existing("Vera Fixture", ["Kai", "Lumi"]);
        const [kai, lumi] = ids as [string, string];
        const code = (await me(parent)).familyClass
          ? (
              await db.query(
                "SELECT c.join_code FROM amp_families f JOIN amp_classes c ON c.id=f.class_id WHERE f.account_id=$1",
                [parent],
              )
            ).rows[0].join_code
          : null;
        assert.ok(code);
        const kaiToken = (await joinByPictures(code, "Kai")).token;
        const lumiToken = (await joinByPictures(code, "Lumi")).token;
        const exported = await get("/api/v1/family/export", parent);
        assert.equal(exported.statusCode, 200, exported.body);
        assert.match(exported.body, new RegExp(kai));
        assert.match(exported.body, new RegExp(lumi));
        // Deleting Kai deletes his learning; his sign-in stops with it.
        const deleted = await post(
          `/api/v1/family/learners/${kai}/delete-learning-data`,
          parent,
          { confirmation: "delete-learning-data" },
        );
        assert.equal(deleted.statusCode, 200, deleted.body);
        assert.equal((await get("/api/v1/me", kaiToken)).statusCode, 401);
        const tomb = await db.query(
          "SELECT given_name,deleted_at IS NOT NULL AS gone FROM amp_people WHERE tenant_id=(SELECT org_id FROM amp_families WHERE account_id=$1) AND account_id IS NULL ORDER BY given_name",
          [parent],
        );
        assert.deepEqual(
          tomb.rows.map((r) => [r.given_name, r.gone]),
          [
            ["Lumi", false],
            ["Removed", true],
          ],
        );
        // The family still reads, and re-visiting doesn't bring him back.
        await me(parent);
        const lookup = await open("/api/v1/school/join/lookup", { code });
        assert.deepEqual(
          lookup.json().students.map((s: { name: string }) => s.name),
          ["Lumi"],
        );
        // Withdrawing consent stops Lumi's practice at once.
        const batch = () =>
          post(`/api/v1/learners/${lumi}/batches`, lumiToken, { count: 1 });
        assert.equal((await batch()).statusCode, 200);
        const withdrawn = await post("/api/v1/family/consent/withdraw", parent);
        assert.equal(withdrawn.statusCode, 200, withdrawn.body);
        assert.equal((await batch()).statusCode, 403);
        const lumiMe = await me(lumiToken);
        assert.equal(lumiMe.learners[0].entitlement.active, false);
      },
    );

    await t.test(
      "renaming a child renames them on the teacher's roster",
      async () => {
        const { parent, ids } = await existing("Nell Fixture", ["Oro"]);
        await me(parent);
        const code = (
          await db.query(
            "SELECT c.join_code FROM amp_families f JOIN amp_classes c ON c.id=f.class_id WHERE f.account_id=$1",
            [parent],
          )
        ).rows[0].join_code;
        const renamed = await post(
          `/api/v1/family/learners/${ids[0]}/rename`,
          parent,
          { name: "Orla" },
        );
        assert.equal(renamed.statusCode, 200, renamed.body);
        const row = await db.query(
          "SELECT given_name FROM amp_people WHERE learner_id=$1",
          [ids[0]],
        );
        assert.deepEqual(
          row.rows.map((r) => r.given_name),
          ["Orla"],
        );
        const lookup = await open("/api/v1/school/join/lookup", { code });
        assert.deepEqual(
          lookup.json().students.map((s: { name: string }) => s.name),
          ["Orla"],
        );
      },
    );
  },
);
