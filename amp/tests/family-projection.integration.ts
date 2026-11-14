import { config as billingConfig } from "./stripe-fixtures.js";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { PostgresRepository, ApiError } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { templates } from "../src/math/engine.js";
import { schoolDay } from "../tests/helpers/school-day.js";

test(
  "family identity, exact ownership projections, teaching compatibility and adult names",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_projection_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href);
    const db = learning.pool;
    let cookieAccount: string | null = null;
    const authenticate = refuseStudentTokens(async (request) => {
      const header = request.headers.authorization;
      if (header?.startsWith("Bearer amp|")) return header.slice(7);
      if (request.headers.cookie === "parent=fixture" && cookieAccount)
        return cookieAccount;
      throw new ApiError(401, "Sign in");
    });
    const keys = {
      secret: "fixture-secret-for-spaces-tests-only",
      origin: "https://amp.example.test",
    };
    const app = buildApp({ repository: learning, authenticate });
    await registerFamilyRoutes(app, {
      billingConfig,
      pool: db,
      authenticate,
      approvals: keys,
    });
    await registerSchoolRoutes(app, {
      pool: db,
      authenticate,
      services: { ...keys, learning },
    });
    await app.ready();
    t.after(async () => {
      await app.close();
      await learning.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    const get = (url: string, account: string) =>
      app.inject({
        method: "GET",
        url,
        headers: { authorization: `Bearer ${account}` },
      });
    const post = (url: string, account: string, payload: object = {}) =>
      app.inject({
        method: "POST",
        url,
        headers: { authorization: `Bearer ${account}` },
        payload,
      });
    const patch = (account: string, payload: object) =>
      app.inject({
        method: "PATCH",
        url: "/api/v1/me/profile",
        headers: { authorization: `Bearer ${account}` },
        payload,
      });
    const ok = async (pending: ReturnType<typeof get>, status = 200) => {
      const response = await pending;
      assert.equal(response.statusCode, status, response.body);
      return response.json();
    };
    const user = async (name: string) => {
      const id = randomUUID();
      const email = `${id}@example.test`;
      await db.query(
        `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,true,now(),now())`,
        [id, name, email],
      );
      return { account: `amp|${id}`, email };
    };
    const consent = (account: string) =>
      db.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','verified','fixture')",
        [account],
      );
    const a = await user("");
    const b = await user("Holder B");
    const external = await user("External Parent");
    const co = await user("");
    const outsider = await user("Outsider");
    for (const person of [a, b, external]) await consent(person.account);
    const ownedA = await ok(
      post("/api/v1/learners", a.account, { name: "A Child", birthYear: 2016 }),
      201,
    );
    const ownedB = await ok(
      post("/api/v1/learners", b.account, { name: "B Child", birthYear: 2018 }),
      201,
    );
    const familyOf = async (account: string) =>
      (
        await db.query(
          "SELECT org_id,class_id FROM amp_families WHERE account_id=$1",
          [account],
        )
      ).rows[0];
    const fa = await familyOf(a.account);
    const fb = await familyOf(b.account);
    const fragment = (url: string) => ({
      token: new URL(url).hash.slice(1).split(".")[0],
    });
    await ok(
      post("/api/v1/family/second-parent", b.account, { email: a.email }),
      201,
    );
    const sp = (await ok(get("/api/v1/family/second-parent", b.account)))
      .secondParent;
    await ok(
      post("/api/v1/school/invites/accept", a.account, fragment(sp.inviteUrl)),
    );
    const hosted = await ok(
      post("/api/v1/family/class/students", a.account, {
        nickname: "Pending",
        birthYear: 2017,
      }),
      201,
    );
    const approved = await ok(
      post("/api/v1/family/class/students", a.account, {
        nickname: "External",
        birthYear: 2016,
      }),
      201,
    );
    const approvalId = (
      await ok(
        post("/api/v1/family/approvals", a.account, {
          personId: approved.personId,
          parentEmail: external.email,
        }),
        201,
      )
    ).id;
    const approval = (
      await ok(get("/api/v1/family/approvals", a.account))
    ).approvals.find((row: { id: string }) => row.id === approvalId);
    await ok(
      post(
        "/api/v1/family/approvals/open",
        external.account,
        fragment(approval.inviteUrl),
      ),
    );
    await ok(
      post(`/api/v1/family/approvals/${approvalId}/approve`, external.account, {
        name: "External Child",
      }),
    );
    const pendingApproval = (
      await ok(
        post("/api/v1/family/approvals", a.account, {
          personId: hosted.personId,
          parentEmail: outsider.email,
        }),
        201,
      )
    ).id;
    const invited = await ok(
      post(`/api/v1/school/orgs/${fa.org_id}/staff/invites`, a.account, {
        email: co.email,
        role: "teacher",
        classIds: [fa.class_id],
      }),
      201,
    );
    // The invitation list provides the copy capability; the create response
    // intentionally need not carry it.
    const staff = await ok(
      get(`/api/v1/school/orgs/${fa.org_id}/staff`, a.account),
    );
    const staffRows = Array.isArray(staff) ? staff : staff.staff;
    const invitation = staffRows.find(
      (row: { email: string }) => row.email === co.email,
    );
    assert.ok(invited);
    assert.ok(invitation);
    await ok(
      post(
        "/api/v1/school/invites/accept",
        co.account,
        fragment(invitation.inviteUrl),
      ),
    );
    const seed = async (learner: string, minutes: number, problems: number) => {
      await db.query(
        "INSERT INTO amp_active_days(learner_id,day,surface,active_ms) VALUES($1,$2,'practice',$3)",
        [learner, schoolDay(), minutes * 60000],
      );
      await db.query(
        "INSERT INTO amp_skill_days(learner_id,day,skill_id,attempts,correct,independent) VALUES($1,$2,'fixture-skill',$3,$3,$3)",
        [learner, schoolDay(), problems],
      );
    };
    await seed(ownedA.id, 7, 11);
    await seed(ownedB.id, 5, 13);
    await seed(hosted.learnerId, 17, 31);
    await seed(approved.learnerId, 23, 47);
    const template = templates[0]!;
    for (const learner of [ownedA.id, hosted.learnerId, approved.learnerId]) {
      await db.query(
        "INSERT INTO amp_skill_evidence(learner_id,skill_id,state) VALUES($1,$2,$3)",
        [
          learner,
          template.skillId,
          JSON.stringify({
            version: 1,
            skillId: template.skillId,
            recentOutcomes: Array.from({ length: 5 }, () => ({
              id: randomUUID(),
              correct: false,
              assisted: false,
              createdAt: new Date().toISOString(),
              templateId: template.id,
            })),
          }),
        ],
      );
    }
    const family = (id: string, account: string) =>
      ok(get(`/api/v1/families/${id}`, account));
    const teaching = (account: string) =>
      ok(get(`/api/v1/families/${fa.org_id}/teaching`, account));

    await t.test(
      "holder of A and second parent of B have distinct IDs and exact capabilities",
      async () => {
        const places = (await ok(get("/api/v1/families", a.account))).families;
        assert.deepEqual(
          places
            .map((row: { familyId: string; role: string }) => [
              row.familyId,
              row.role,
            ])
            .sort(),
          [
            [fa.org_id, "holder"],
            [fb.org_id, "second-parent"],
          ].sort(),
        );
        const own = await family(fa.org_id, a.account);
        const second = await family(fb.org_id, a.account);
        assert.deepEqual(
          own.children.map((row: { id: string }) => row.id),
          [ownedA.id],
        );
        assert.deepEqual(
          second.children.map((row: { id: string }) => row.id),
          [ownedB.id],
        );
        assert.equal(own.today.week.minutes, 7);
        assert.equal(own.today.week.problems, 11);
        assert.equal(own.today.week.students, 1);
        assert.equal(second.today.week.minutes, 5);
        assert.equal(second.today.week.problems, 13);
        assert.equal(own.teachingPlace.classId, fa.class_id);
        assert.equal(second.teachingPlace, null);
        assert.equal(
          own.capabilities.inviteSecondParent,
          false,
          "mixed teaching cannot offer second parent",
        );
        const child = own.children[0];
        assert.equal(child.capabilities.practiceHere, true);
        assert.equal(child.capabilities.continuePurchase, true);
        assert.equal(child.capabilities.rename, true);
        assert.equal(child.classes[0].hostedByFamily, true);
        assert.equal(child.classes[0].canOpen, true);
        const other = second.children[0];
        assert.equal(other.capabilities.practiceHere, true);
        assert.equal(other.capabilities.continuePurchase, false);
        assert.equal(other.capabilities.purchase, false);
        assert.equal(other.capabilities.rename, false);
        assert.equal(other.capabilities.changeBirthYear, false);
        assert.equal(other.capabilities.manageConsent, false);
        assert.equal(other.capabilities.delete, false);
        assert.equal(other.capabilities.readWorkbooks, false);
        assert.equal(other.paths.continue, null);
        assert.equal(
          (
            await post(
              `/api/v1/family/learners/${ownedB.id}/practice-here`,
              a.account,
            )
          ).statusCode,
          201,
        );
        assert.ok(
          own.today.tasks.some(
            (task: { kind: string }) => task.kind === "stuck",
          ),
          "the owned child has an actionable task",
        );
        for (const task of own.today.tasks)
          for (const student of task.students)
            assert.equal(student.id, ownedA.id);
        assert.equal(
          (await get(`/api/v1/families/${fa.org_id}`, outsider.account))
            .statusCode,
          404,
        );
        assert.equal(
          (
            await get(
              `/api/v1/families/${fa.org_id}/children/${ownedB.id}/progress`,
              a.account,
            )
          ).statusCode,
          404,
        );
      },
    );
    let externalFamily = "";
    await t.test(
      "a hosted-only parent owns a stable family and individual paths without host-class access",
      async () => {
        const places = (await ok(get("/api/v1/families", external.account)))
          .families;
        assert.equal(places.length, 1);
        externalFamily = places[0].familyId;
        assert.notEqual(externalFamily, fa.org_id);
        assert.equal(places[0].role, "holder");
        assert.equal(await familyOf(external.account), undefined);
        const projection = await family(externalFamily, external.account);
        assert.deepEqual(
          projection.children.map((row: { id: string }) => row.id),
          [approved.learnerId],
        );
        assert.equal(projection.today.week.minutes, 23);
        assert.equal(projection.today.week.problems, 47);
        const child = projection.children[0];
        assert.equal(child.classes[0].hostedByFamily, false);
        assert.equal(child.classes[0].canOpen, false);
        assert.equal(child.capabilities.editGrades, false);
        assert.equal(child.capabilities.practiceHere, true);
        assert.equal(child.capabilities.continuePurchase, true);
        await ok(get(child.paths.progress, external.account));
        await ok(get(child.paths.workbooks, external.account));
        assert.equal(
          (await get(`/api/v1/families/${fa.org_id}`, external.account))
            .statusCode,
          404,
        );
        assert.equal(
          (
            await get(
              `/api/v1/school/classes/${fa.class_id}/today`,
              external.account,
            )
          ).statusCode,
          404,
        );
        assert.equal(
          (
            await get(
              `/api/v1/families/${externalFamily}/teaching`,
              external.account,
            )
          ).statusCode,
          404,
        );
      },
    );
    await t.test(
      "teaching holds the complete mixed class and collaborators, never a co-teacher's family",
      async () => {
        const places = (await ok(get("/api/v1/families", co.account))).families;
        assert.equal(places.length, 1);
        assert.equal(places[0].role, "co-teacher");
        assert.equal(places[0].capabilities.readFamily, false);
        assert.equal(
          (await get(`/api/v1/families/${fa.org_id}`, co.account)).statusCode,
          403,
        );
        const view = await teaching(co.account);
        assert.equal(view.scope, "whole-class");
        assert.equal(view.place, "teaching");
        assert.deepEqual(
          view.students
            .map((row: { learnerId: string }) => row.learnerId)
            .sort(),
          [ownedA.id, hosted.learnerId, approved.learnerId].sort(),
        );
        assert.equal(view.today.week.minutes, 47);
        assert.equal(view.today.week.problems, 89);
        assert.equal(view.today.week.students, 3);
        assert.equal(view.capabilities.manageApprovals, false);
        assert.equal(
          (await teaching(a.account)).capabilities.manageApprovals,
          true,
        );
        const holderView = await teaching(a.account);
        assert.deepEqual(view.approvals, []);
        assert.deepEqual(view.coTeachers, []);
        assert.equal(view.capabilities.readApprovals, false);
        assert.equal(view.capabilities.readStaff, false);
        assert.equal(
          holderView.approvals.find(
            (row: { id: string }) => row.id === approvalId,
          ).status,
          "approved",
        );
        assert.equal(
          holderView.approvals.find(
            (row: { id: string }) => row.id === pendingApproval,
          ).status,
          "waiting",
        );
        assert.equal(holderView.coTeachers.length, 2);
        assert.ok(
          holderView.coTeachers.every(
            (row: { name: unknown }) => row.name === null,
          ),
        );
      },
    );
    await t.test(
      "adult names are explicit, editable, shared with approvals, staff and invitations",
      async () => {
        const before = await ok(get("/api/v1/me", a.account));
        assert.equal(before.account.displayName, null);
        assert.equal(before.account.givenName, null);
        const profile = await ok(
          patch(a.account, { givenName: "Ada", familyName: "Fixture" }),
        );
        assert.deepEqual(profile, {
          givenName: "Ada",
          familyName: "Fixture",
          displayName: "Ada Fixture",
        });
        const me = await ok(get("/api/v1/me", a.account));
        assert.equal(me.account.givenName, "Ada");
        assert.equal(me.account.familyName, "Fixture");
        const lookup = await ok(
          post(
            "/api/v1/family/approvals/lookup",
            a.account,
            fragment(approval.inviteUrl),
          ),
        );
        assert.deepEqual(lookup.approval.teacherNames, ["Ada Fixture", null]);
        assert.deepEqual(lookup.approval.teachers, ["Ada Fixture"]);
        const list = await ok(
          get(`/api/v1/school/orgs/${fa.org_id}/staff`, a.account),
        );
        assert.ok(
          list.staff.some(
            (row: { adultName: string }) => row.adultName === "Ada Fixture",
          ),
        );
        const inviteLookup = await ok(
          post(
            "/api/v1/school/invites/lookup",
            a.account,
            fragment(invitation.inviteUrl),
          ),
        );
        assert.equal(inviteLookup.invite.inviterName, "Ada Fixture");
        assert.equal(
          (await patch(a.account, { givenName: " ", familyName: "No" }))
            .statusCode,
          400,
        );
        assert.equal(
          (
            await patch(a.account, {
              givenName: "Ada",
              familyName: "No",
              accountId: b.account,
            })
          ).statusCode,
          400,
        );
        await ok(patch(a.account, { givenName: null, familyName: null }));
        assert.equal(
          (await ok(get("/api/v1/me", a.account))).account.displayName,
          null,
        );
        const session = await ok(
          post(`/api/v1/family/learners/${ownedA.id}/practice-here`, a.account),
          201,
        );
        cookieAccount = a.account;
        const student = await app.inject({
          method: "GET",
          url: "/api/v1/families",
          headers: {
            authorization: `Bearer ${session.token}`,
            cookie: "parent=fixture",
          },
        });
        assert.equal(student.statusCode, 401);
      },
    );
    await t.test(
      "withdrawal pauses learning without leaking another household or discarding the owned child",
      async () => {
        await db.query("DELETE FROM amp_parent_consents WHERE account_id=$1", [
          external.account,
        ]);
        assert.equal(
          (await teaching(a.account)).approvals.find(
            (row: { id: string }) => row.id === approvalId,
          ).status,
          "paused",
        );
        await consent(external.account);
        await db.query(
          "UPDATE amp_parent_consents SET withdrawn_at=now() WHERE account_id=$1",
          [external.account],
        );
        const projection = await family(externalFamily, external.account);
        assert.deepEqual(
          projection.children.map((row: { id: string }) => row.id),
          [approved.learnerId],
        );
        assert.equal(projection.children[0].capabilities.practiceHere, false);
        assert.equal(projection.children[0].capabilities.createWorkbook, false);
        assert.equal(projection.children[0].capabilities.purchase, false);
        assert.equal(projection.children[0].capabilities.rename, true);
        assert.equal(
          (await teaching(a.account)).approvals.find(
            (row: { id: string }) => row.id === approvalId,
          ).status,
          "withdrawn",
        );
      },
    );
    await t.test(
      "ended enrollment and second-parent roles are rechecked on the next request",
      async () => {
        await ok(
          post(`/api/v1/family/approvals/${approvalId}/remove`, a.account),
        );
        assert.equal(
          (await teaching(a.account)).approvals.find(
            (row: { id: string }) => row.id === approvalId,
          ).status,
          "ended",
        );
        assert.ok(
          (
            await family(externalFamily, external.account)
          ).children[0].classes.every(
            (row: { orgId: string }) => row.orgId !== fa.org_id,
          ),
          "ending the host relationship may create their own class, never restore the host enrollment",
        );
        await ok(post("/api/v1/family/second-parent/remove", b.account));
        assert.equal(
          (await get(`/api/v1/families/${fb.org_id}`, a.account)).statusCode,
          404,
        );
        assert.deepEqual(
          (await ok(get("/api/v1/families", a.account))).families.map(
            (row: { familyId: string }) => row.familyId,
          ),
          [fa.org_id],
        );
        await db.query(
          "UPDATE amp_enrollments SET end_on=$1 WHERE person_id=$2 AND role='teacher'",
          [schoolDay(), invitation.id],
        );
        assert.equal(
          (await get(`/api/v1/families/${fa.org_id}/teaching`, co.account))
            .statusCode,
          404,
        );
      },
    );
    await t.test(
      "adding a local child preserves a hosted-only family's ID",
      async () => {
        await db.query(
          "UPDATE amp_parent_consents SET withdrawn_at=NULL WHERE account_id=$1",
          [external.account],
        );
        await ok(
          post("/api/v1/learners", external.account, {
            name: "Local Child",
            birthYear: 2017,
          }),
          201,
        );
        assert.equal((await familyOf(external.account)).org_id, externalFamily);
        const places = (await ok(get("/api/v1/families", external.account)))
          .families;
        assert.equal(places.length, 1);
        assert.equal(places[0].familyId, externalFamily);
      },
    );

    await t.test(
      "released hosted children keep an actionable practice path without a repairing read",
      async () => {
        const parent = await user("Released child's parent");
        await consent(parent.account);
        const hosted = await ok(
          post("/api/v1/family/class/students", a.account, {
            nickname: "Hosted",
            birthYear: 2017,
          }),
          201,
        );
        const approval = await ok(
          post("/api/v1/family/approvals", a.account, {
            personId: hosted.personId,
            parentEmail: parent.email,
          }),
          201,
        );
        const invitation = (
          await ok(get("/api/v1/family/approvals", a.account))
        ).approvals.find((entry: { id: string }) => entry.id === approval.id);
        await ok(
          post(
            "/api/v1/family/approvals/open",
            parent.account,
            fragment(invitation.inviteUrl),
          ),
        );
        await ok(
          post(
            `/api/v1/family/approvals/${approval.id}/approve`,
            parent.account,
            { name: "Child" },
          ),
        );
        const stable = (await ok(get("/api/v1/families", parent.account)))
          .families[0].familyId;
        await ok(
          post(`/api/v1/family/approvals/${approval.id}/remove`, a.account),
        );
        // No /me or other roster-repairing read between release and projection.
        const child = (await family(stable, parent.account)).children[0];
        assert.equal(child.id, hosted.learnerId);
        assert.equal(child.access.canPractice, true);
        const path = `/api/v1/family/learners/${hosted.learnerId}/practice-here`;
        assert.equal((await post(path, parent.account)).statusCode, 201);
        assert.equal(child.capabilities.practiceHere, true);
        assert.equal(child.paths.practiceHere, path);
        const repaired = (await family(stable, parent.account)).children[0];
        assert.ok(
          repaired.classes.every(
            (entry: { orgId: string }) => entry.orgId !== fa.org_id,
          ),
        );
      },
    );
    await t.test(
      "addChildren counts the adult and practice profiles, excluding deleted learners",
      async () => {
        const parent = await user("Capacity parent");
        await consent(parent.account);
        await ok(
          post("/api/v1/learners", parent.account, {
            name: "Child",
            birthYear: 2017,
          }),
          201,
        );
        await db.query(
          "INSERT INTO amp_learners(id,account_id,name,adult,simulation) SELECT gen_random_uuid()::text,$1,'Adult '||n,true,n>1 FROM generate_series(1,999) n",
          [parent.account],
        );
        const home = await familyOf(parent.account);
        const full = await family(home.org_id, parent.account);
        assert.equal(full.children.length, 1);
        assert.equal(
          (
            await post("/api/v1/learners", parent.account, {
              name: "Extra",
              birthYear: 2017,
            })
          ).statusCode,
          403,
        );
        assert.equal(full.capabilities.addChildren, false);
        await db.query(
          "UPDATE amp_learners SET deleted_at=now() WHERE id=(SELECT id FROM amp_learners WHERE account_id=$1 AND simulation LIMIT 1)",
          [parent.account],
        );
        assert.equal(
          (await family(home.org_id, parent.account)).capabilities.addChildren,
          true,
        );
        await ok(
          post("/api/v1/learners", parent.account, {
            name: "Extra",
            birthYear: 2017,
          }),
          201,
        );
        assert.equal(
          (await family(home.org_id, parent.account)).capabilities.addChildren,
          false,
        );
      },
    );

    await t.test(
      "REVIEW: last-name-only and cleared names do not invent a map teacher name",
      async () => {
        await db.query(
          "INSERT INTO amp_learners(id,account_id,name,adult,timezone) SELECT $1,$2,'Me',true,'UTC' WHERE NOT EXISTS (SELECT 1 FROM amp_learners WHERE account_id=$2 AND adult AND NOT simulation)",
          [randomUUID(), a.account],
        );
        await ok(
          patch(a.account, { givenName: null, familyName: "OnlySurname" }),
        );
        const mapped = await ok(
          get(`/api/v1/school/classes/${fa.class_id}/map`, a.account),
        );
        console.log(
          "REVIEW map teacher names",
          mapped.teachers.map((p: any) => p.name),
        );
        assert.equal(mapped.teachers[0].name, "OnlySurname");
      },
    );
    await t.test(
      "REVIEW: account export includes exact profile and family identity",
      async () => {
        const { FamilyRepository } =
          await import("../src/family/repository.js");
        const rows = [];
        for await (const line of new FamilyRepository(db).export(a.account))
          rows.push(JSON.parse(line));
        const profile = rows.find((r: any) => r.type === "account-profile");
        const identity = rows.find((r: any) => r.type === "family-identity");
        console.log("REVIEW exported profile and identity", profile, identity);
        assert.ok(profile);
        assert.ok(identity);
        assert.ok(JSON.stringify(profile).includes("OnlySurname"));
        assert.ok(JSON.stringify(identity).includes(fa.org_id));
      },
    );
    await t.test(
      "REVIEW: child projection query count is independent of child count",
      async () => {
        const measure = async () => {
          let count = 0;
          const original = db.query;
          (db as any).query = function (...args: any[]) {
            count++;
            return original.apply(this, args as any);
          };
          try {
            await family(fa.org_id, a.account);
          } finally {
            db.query = original;
          }
          return count;
        };
        const one = await measure();
        for (let i = 0; i < 3; i++)
          await ok(
            post("/api/v1/learners", a.account, {
              name: `Count ${i}`,
              birthYear: 2017,
            }),
            201,
          );
        const four = await measure();
        console.log("REVIEW direct pool queries", {
          oneChild: one,
          fourChildren: four,
        });
        assert.equal(four, one);
      },
    );
    await t.test(
      "REVIEW: hosted-only identity survives creation by an old API instance",
      async () => {
        const legacy = await user("Legacy Writer");
        await consent(legacy.account);
        await db.query(
          "INSERT INTO amp_learners(id,account_id,name) VALUES($1,$2,'Legacy child')",
          [randomUUID(), legacy.account],
        );
        const discovery = await ok(get("/api/v1/families", legacy.account));
        const stable = discovery.families[0].familyId;
        const { ensureFamilyClass: oldEnsure } =
          await import("./helpers/legacy-family-class.js");
        const client = await db.connect();
        try {
          await client.query("BEGIN");
          await oldEnsure(client, db, legacy.account, { converting: true });
          await client.query("COMMIT");
        } finally {
          client.release();
        }
        const oldClass = await familyOf(legacy.account);
        const view = await family(stable, legacy.account);
        const legacyRead = await get(
          `/api/v1/school/classes/${oldClass.class_id}/today`,
          legacy.account,
        );
        console.log("REVIEW old/new family identity", {
          same: stable === oldClass.org_id,
          newReadTeaching: view.capabilities.readTeaching,
          oldClassReadStatus: legacyRead.statusCode,
          childReadGrades: view.children[0].capabilities.readGrades,
        });
        assert.equal(view.familyId, stable);
        assert.equal(view.children[0].capabilities.readGrades, true);
        await ok(
          post(
            `/api/v1/school/orgs/${oldClass.org_id}/staff/invites`,
            legacy.account,
            { email: co.email, role: "teacher", classIds: [oldClass.class_id] },
          ),
          201,
        );
        const staff = await ok(
          get(`/api/v1/school/orgs/${oldClass.org_id}/staff`, legacy.account),
        );
        const invited = (Array.isArray(staff) ? staff : staff.staff).find(
          (p: any) => p.email === co.email,
        );
        await ok(
          post(
            "/api/v1/school/invites/accept",
            co.account,
            fragment(invited.inviteUrl),
          ),
        );
        const places = (await ok(get("/api/v1/families", co.account))).families;
        assert.equal(
          places.find((p: any) => p.familyId === stable)?.role,
          "co-teacher",
        );
        await ok(get(`/api/v1/families/${stable}/teaching`, co.account));
        assert.equal(
          (await get(`/api/v1/families/${stable}`, co.account)).statusCode,
          403,
        );
      },
    );

    await t.test(
      "REVIEW: purchase capability agrees with billing for an already licensed child",
      async () => {
        const { StripeRepository } =
          await import("../src/billing/stripe/repository.js");
        const { config } = await import("../tests/stripe-fixtures.js");
        await db.query(
          "UPDATE amp_parent_consents SET policy_version=$2 WHERE account_id=$1",
          [a.account, config.consentPolicyVersion],
        );
        await db.query(
          "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,$2,'pilot',$1,'active',now()-interval '1 day',now()+interval '30 days')",
          [randomUUID(), ownedA.id],
        );
        const projected = (await family(fa.org_id, a.account)).children.find(
          (r: any) => r.id === ownedA.id,
        );
        let refused = "";
        try {
          await new StripeRepository(db, config).reserve(
            a.account,
            ownedA.id,
            randomUUID(),
          );
        } catch (e: any) {
          refused = e.code;
        }
        console.log("REVIEW purchase mismatch", {
          purchase: projected.capabilities.purchase,
          hasAccess: projected.access.hasAccess,
          refused,
        });
        assert.equal(refused, "learner_already_licensed");
        assert.equal(projected.capabilities.purchase, false);
      },
    );
    await t.test(
      "REVIEW: rollback-era deletion removes the new adult profile",
      async () => {
        const who = await user("Delete Old API");
        await ok(
          patch(who.account, { givenName: "Delete", familyName: "Old API" }),
        );
        await db.query(
          "INSERT INTO amp_family_spaces(account_id,id) VALUES($1,$2)",
          [who.account, randomUUID()],
        );
        const { deleteAccount: oldDelete } =
          await import("./helpers/legacy-delete-account.js");
        const result = await oldDelete(db, {
          accountId: who.account,
          via: "self",
          commit: true,
        });
        const remaining = await db.query(
          "SELECT given_name,family_name FROM amp_account_profiles WHERE account_id=$1",
          [who.account],
        );
        const auth = await db.query(
          "SELECT id FROM amp_auth_users WHERE id=$1",
          [who.account.slice(4)],
        );
        console.log("REVIEW old API deletion", {
          committed: result.committed,
          authUsers: auth.rowCount,
          profiles: remaining.rowCount,
        });
        assert.equal(remaining.rowCount, 0);
        assert.equal(
          (
            await db.query(
              "SELECT 1 FROM amp_family_spaces WHERE account_id=$1",
              [who.account],
            )
          ).rowCount,
          0,
        );
      },
    );
    await t.test(
      "billing capability uses configured consent, unassigned plans and email confirmation",
      async () => {
        const { StripeRepository } =
          await import("../src/billing/stripe/repository.js");
        const buyer = await user("Checkout Parent");
        await consent(buyer.account);
        const child = await ok(
          post("/api/v1/learners", buyer.account, {
            name: "Checkout child",
            birthYear: 2017,
          }),
          201,
        );
        const home = await familyOf(buyer.account);
        const canBuy = async () =>
          (await family(home.org_id, buyer.account)).children.find(
            (c: any) => c.id === child.id,
          ).capabilities.purchase;
        assert.equal(await canBuy(), false, "outdated policy version");
        await db.query(
          "UPDATE amp_parent_consents SET policy_version=$2 WHERE account_id=$1",
          [buyer.account, billingConfig.consentPolicyVersion],
        );
        assert.equal(await canBuy(), true, "eligible unlicensed child");
        await db.query(
          'UPDATE amp_auth_users SET "emailVerified"=false WHERE id=$1',
          [buyer.account.slice(4)],
        );
        assert.equal(await canBuy(), false);
        await db.query(
          'UPDATE amp_auth_users SET "emailVerified"=true WHERE id=$1',
          [buyer.account.slice(4)],
        );
        const billing = new StripeRepository(db, billingConfig),
          checkout = randomUUID();
        await db.query(
          "INSERT INTO amp_stripe_checkouts(id,namespace,account_id,request_id) VALUES($1,$2,$3,$4)",
          [checkout, billing.namespace, buyer.account, randomUUID()],
        );
        await db.query(
          "INSERT INTO amp_account_entitlements(namespace,invoice_id,checkout_id,payment,status,ends_at) VALUES($1,$2,$3,'{}','active',now()+interval '1 day')",
          [billing.namespace, randomUUID(), checkout],
        );
        assert.equal(
          await canBuy(),
          false,
          "paid unassigned plan must be assigned",
        );
        await assert.rejects(
          billing.reserve(buyer.account, child.id, randomUUID()),
          (e: any) => e.code === "license_ready_for_assignment",
        );
      },
    );
    await t.test(
      "grant preview is bounded and cleared adult names ignore roster overrides",
      async () => {
        await db.query(
          `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
        SELECT gen_random_uuid()::text,$1,'pilot','history-'||n,'revoked',now()-n*interval '2 days',now()-n*interval '1 day'
        FROM generate_series(1,60) n`,
          [ownedA.id],
        );
        const child = (await family(fa.org_id, a.account)).children.find(
          (c: any) => c.id === ownedA.id,
        );
        assert.equal(child.access.grants.length, 20);
        await ok(patch(a.account, { givenName: null, familyName: null }));
        await db.query(
          "UPDATE amp_people SET display_name='Stale override' WHERE account_id=$1",
          [a.account],
        );
        const map = await ok(
          get(`/api/v1/school/classes/${fa.class_id}/map`, a.account),
        );
        assert.equal(map.teachers[0].adultName, null);
        assert.equal(map.teachers[0].name, "");
        const { SchoolRepository } =
          await import("../src/schools/repository.js");
        const classes = await new SchoolRepository(db).classes(
          fa.org_id,
          { classIds: null },
          { limit: 50, offset: 0 },
        );
        assert.ok(classes[0].teacherNames?.includes(null));
        assert.ok(!classes[0].teachers.includes("Staff"));
        assert.ok(!classes[0].teachers.includes("Stale override"));
        const { classTeachers } =
          await import("../src/schools/teacher-line.js");
        assert.equal(
          (await classTeachers(db, fa.class_id))[0].adultName,
          null,
          "board and map share the resolver",
        );
      },
    );
    await t.test(
      "approval permission work is batched and ended history needs no consent lookup",
      async () => {
        const person = (
          await db.query("SELECT id FROM amp_people WHERE learner_id=$1", [
            ownedA.id,
          ])
        ).rows[0].id;
        const measure = async () => {
          let count = 0;
          const original = db.query;
          (db as any).query = function (...args: any[]) {
            count++;
            return original.apply(this, args as any);
          };
          try {
            await ok(get(`/api/v1/families/${fa.org_id}/teaching`, a.account));
          } finally {
            db.query = original;
          }
          return count;
        };
        const before = await measure();
        await db.query(
          `INSERT INTO amp_family_approvals(id,family_account_id,class_id,lookup_hash,secret_hash,expires_at,account_id,approved_at,person_id,ended_at)
        SELECT gen_random_uuid(),$1,$2,gen_random_uuid()::text,'fixture',now()+interval '1 day',$1,now(),$3,
          CASE WHEN n%2=0 THEN now() ELSE NULL END FROM generate_series(1,30) n`,
          [a.account, fa.class_id, person],
        );
        assert.equal(await measure(), before);
        const { parentConsentStates, learningConsentActive } =
          await import("../src/server/account-access.js");
        for (const method of [
          "verified",
          "internal-email-plus-future",
          "internal-email-plus-v1",
          "monetary-transaction",
        ]) {
          const parent = await user("Consent fixture");
          await consent(parent.account);
          await db.query(
            "UPDATE amp_parent_consents SET verification_method=$2 WHERE account_id=$1",
            [parent.account, method],
          );
          const batch = await parentConsentStates(db, [parent.account]);
          assert.equal(
            batch.get(parent.account)?.active,
            await learningConsentActive(db, parent.account),
            method,
          );
        }
      },
    );
  },
);
