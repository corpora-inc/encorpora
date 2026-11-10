import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import {
  approvalProvesAddress,
  purgeFamilyApprovals,
} from "../src/family/approvals.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

/* A child from another family joins a family class once their own parent
   approves (docs/families.md, step 5): consent, ownership, the teacher's
   limits, withdrawal, deletion, removal and the link's single use. Every name
   here is made up. */
test(
  "family approval links: consent, family and privacy",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_family_approval_${randomUUID().replaceAll("-", "")}`;
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
    const origin = "https://amp.example";
    const secret = randomBytes(32).toString("hex");
    const mailed: { to: string; subject: string; text: string; url: string }[] =
      [];
    const app = buildApp({ repository: learning, authenticate });
    await registerFamilyRoutes(app, {
      pool: db,
      authenticate,
      approvals: {
        secret,
        origin,
        mail: async (to, subject, text, link) => {
          mailed.push({ to, subject, text, url: link });
        },
      },
    });
    await registerSchoolRoutes(app, {
      pool: db,
      authenticate,
      services: { secret, origin },
    });
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
    const ok = async (
      response: Promise<{ statusCode: number; body: string; json(): any }>,
      status = 200,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<any> => {
      const result = await response;
      assert.equal(result.statusCode, status, result.body);
      return result.json();
    };
    const me = (credential: string) => ok(get("/api/v1/me", credential));
    const user = async (
      name: string,
      email = `${randomUUID()}@family.example`,
    ) => {
      const id = randomUUID();
      await db.query(
        `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
         VALUES($1,$2,$3,true,now(),now())`,
        [id, name, email],
      );
      return `amp|${id}`;
    };
    const consent = (account: string) =>
      db.query(
        `INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'policy','verified','fixture-proof')
         ON CONFLICT(account_id) DO UPDATE SET withdrawn_at=NULL`,
        [account],
      );
    const paid = (learnerId: string) =>
      db.query(
        `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
         VALUES($1,$2,'stripe',$1,'active',now()-interval '1 day',now()+interval '300 days')`,
        [`fixture:${learnerId}`, learnerId],
      );
    const fragment = (link: string) => {
      const [token, proof] = new URL(link).hash.slice(1).split(".");
      return { token: token!, proof: proof! };
    };
    const names = async (code: string) =>
      (await ok(open("/api/v1/school/join/lookup", { code }))).students.map(
        (s: { name: string }) => s.name,
      ) as string[];
    const joinByPictures = async (code: string, name: string) => {
      const roster = await ok(open("/api/v1/school/join/lookup", { code }));
      const student = roster.students.find(
        (s: { name: string }) => s.name === name,
      );
      assert.ok(student, `${name} is on the class's sign-in list`);
      return ok(
        open("/api/v1/school/join/picture", {
          code,
          personId: student.id,
          pictures: ["fox", "moon", "owl"],
          set: true,
        }),
      );
    };
    const list = async (teacher: string) =>
      (await ok(get("/api/v1/family/approvals", teacher))).approvals as {
        id: string;
        name: string;
        status: string;
        inviteUrl: string | null;
        parentEmail: string | null;
        accessEndsAt: string | null;
      }[];

    // The teacher: a homeschool parent with a child of their own, so a class.
    const teacher = await user("Marisol Fixture");
    await consent(teacher);
    const maya = (
      await ok(
        post("/api/v1/learners", teacher, { name: "Maya", birthYear: 2016 }),
        201,
      )
    ).id as string;
    const family = (
      await db.query(
        "SELECT f.org_id,f.class_id,c.join_code FROM amp_families f JOIN amp_classes c ON c.id=f.class_id WHERE f.account_id=$1",
        [teacher],
      )
    ).rows[0];
    const parentEmail = `jonas-${randomUUID().slice(0, 8)}@neighbor.example`;
    const parent = await user("Jonas Fixture", parentEmail);

    let approvalId = "";
    let link = "";
    let ana = "";
    let anaToken = "";

    await t.test(
      "the teacher sends a link; until approval the child doesn't exist",
      async () => {
        const sent = await ok(
          post("/api/v1/family/approvals", teacher, {
            parentEmail: parentEmail.toUpperCase(),
          }),
          201,
        );
        assert.equal(sent.mailed, true);
        approvalId = sent.id;
        assert.equal(mailed.length, 1);
        assert.equal(mailed[0]!.to, parentEmail);
        assert.ok(
          !mailed[0]!.text.includes("Ana"),
          "mail never names the child",
        );
        link = mailed[0]!.url;
        assert.match(
          link,
          /^https:\/\/amp\.example\/family\/approve#[\w-]{43}\.[\w-]{43}$/,
        );
        const rows = await list(teacher);
        assert.equal(rows.length, 1);
        assert.equal(rows[0]!.status, "waiting");
        assert.equal(rows[0]!.name, "Child");
        // "Copy link" is the same link without the mailbox's proof.
        assert.equal(rows[0]!.inviteUrl, link.slice(0, link.lastIndexOf(".")));
        // Asking again is another child of that parent: a link of its own,
        // which the teacher can withdraw.
        const again = await ok(
          post("/api/v1/family/approvals", teacher, {
            parentEmail,
          }),
          201,
        );
        assert.notEqual(again.id, approvalId);
        assert.equal((await list(teacher)).length, 2);
        await ok(post(`/api/v1/family/approvals/${again.id}/remove`, teacher));
        assert.deepEqual(
          (await list(teacher)).map((row) => row.id),
          [approvalId],
        );
        // Nobody to sign in as, nothing collected for the other family.
        assert.deepEqual(await names(family.join_code), ["Maya"]);
        assert.equal(
          (
            await db.query("SELECT 1 FROM amp_learners WHERE account_id=$1", [
              parent,
            ])
          ).rowCount,
          0,
        );
        // Only a family's own parent sends links.
        const stranger = await user("Odile Fixture");
        assert.equal(
          (
            await post("/api/v1/family/approvals", stranger, {
              parentEmail: "zed@neighbor.example",
            })
          ).statusCode,
          409,
        );
        assert.equal(
          (
            await post(
              `/api/v1/family/approvals/${approvalId}/remove`,
              stranger,
            )
          ).statusCode,
          404,
        );
      },
    );

    await t.test(
      "the teacher can't consent for the child; the parent can, once",
      async () => {
        const { token, proof } = fragment(link);
        const preview = await ok(
          open("/api/v1/family/approvals/lookup", { token }),
        );
        assert.equal(preview.approval.status, "open");
        assert.equal(preview.approval.childName, null);
        assert.equal(preview.approval.className, "Marisol’s class");
        assert.deepEqual(preview.approval.teachers, ["Marisol Fixture"]);
        assert.equal(
          (await post("/api/v1/family/approvals/open", teacher, { token }))
            .statusCode,
          403,
        );
        // The parent opens it with an address still unconfirmed: the mailed
        // proof confirms it.
        await db.query(
          'UPDATE amp_auth_users SET "emailVerified"=false WHERE id=$1',
          [parent.slice(4)],
        );
        const opened = await ok(
          post("/api/v1/family/approvals/open", parent, { token, proof }),
        );
        assert.equal(opened.id, approvalId);
        assert.equal(
          (
            await db.query(
              'SELECT "emailVerified" FROM amp_auth_users WHERE id=$1',
              [parent.slice(4)],
            )
          ).rows[0].emailVerified,
          true,
        );
        // Single use: another account is refused, the same one returns.
        const other = await user("Pilar Fixture");
        const reused = await post("/api/v1/family/approvals/open", other, {
          token,
        });
        assert.equal(reused.statusCode, 410, reused.body);
        assert.equal(reused.json().error, "approval_used");
        assert.equal(
          (await ok(open("/api/v1/family/approvals/lookup", { token })))
            .approval.childName,
          null,
        );
        assert.equal(
          (await get(`/api/v1/family/approvals/${approvalId}`, other))
            .statusCode,
          404,
        );
        assert.equal(
          (await ok(post("/api/v1/family/approvals/open", parent, { token })))
            .id,
          approvalId,
        );
        // After consent, approving is the next step.
        assert.deepEqual((await me(parent)).familyApproval, { id: approvalId });
        // No consent yet: nothing is created.
        const early = await post(
          `/api/v1/family/approvals/${approvalId}/approve`,
          parent,
          { name: "Ana" },
        );
        assert.equal(early.statusCode, 409, early.body);
        assert.equal(early.json().error, "consent_required");
        assert.equal(
          (
            await db.query("SELECT 1 FROM amp_learners WHERE account_id=$1", [
              parent,
            ])
          ).rowCount,
          0,
        );
        const before = await ok(
          get(`/api/v1/family/approvals/${approvalId}`, parent),
        );
        assert.equal(before.approval.status, "open");
        assert.equal(before.approval.consentActive, false);
        // A child new to the class: approving asks their birth year too.
        assert.equal(before.approval.asksBirthYear, true);
      },
    );

    await t.test(
      "approval with the parent's consent enrolls their own learner",
      async () => {
        await consent(parent);
        const approved = await ok(
          post(`/api/v1/family/approvals/${approvalId}/approve`, parent, {
            name: "Ana",
            birthYear: new Date().getUTCFullYear() - 9,
          }),
        );
        ana = approved.learnerId;
        const row = (
          await db.query(
            `SELECT l.account_id,l.name,l.birth_year,p.tenant_id,p.given_name,
               EXISTS(SELECT 1 FROM amp_enrollments e WHERE e.person_id=p.id AND e.class_id=$2 AND e.role='student' AND e.end_on IS NULL) AS enrolled,
               a.child_name,a.parent_email
             FROM amp_learners l JOIN amp_people p ON p.learner_id=l.id
             JOIN amp_family_approvals a ON a.person_id=p.id WHERE l.id=$1`,
            [ana, family.class_id],
          )
        ).rows[0];
        assert.equal(row.account_id, parent, "the approving parent owns her");
        assert.equal(
          row.birth_year,
          new Date().getUTCFullYear() - 9,
          "her birth year sets where she starts",
        );
        assert.equal(row.tenant_id, family.org_id);
        assert.equal(row.enrolled, true);
        assert.equal(row.child_name, null, "the typed name is erased");
        assert.equal(row.parent_email, null);
        // Approving again changes nothing.
        assert.equal(
          (
            await ok(
              post(`/api/v1/family/approvals/${approvalId}/approve`, parent, {
                name: "Ana",
              }),
            )
          ).learnerId,
          ana,
        );
        const theirs = await me(parent);
        assert.deepEqual(
          theirs.learners.map((l: { id: string }) => l.id),
          [ana],
        );
        assert.equal(
          theirs.familyClass,
          undefined,
          "no empty class of their own",
        );
        assert.equal(theirs.familyApproval, undefined);
        const page = await ok(
          get(`/api/v1/family/approvals/${approvalId}`, parent),
        );
        assert.equal(page.approval.status, "approved");
        assert.equal(page.approval.learnerId, ana);
        assert.equal(page.approval.access.active, false);
        assert.equal((await list(teacher))[0]!.status, "needs-access");
        assert.deepEqual(await names(family.join_code), ["Ana", "Maya"]);
      },
    );

    await t.test(
      "the child signs in by pictures to her own learner, and the teacher sees her work",
      async () => {
        await paid(ana);
        const rows = await list(teacher);
        assert.equal(rows[0]!.status, "active");
        assert.ok(rows[0]!.accessEndsAt);
        const grant = await joinByPictures(family.join_code, "Ana");
        anaToken = grant.token;
        const own = await me(anaToken);
        assert.equal(own.account.kind, "student");
        assert.deepEqual(
          own.learners.map((l: { id: string }) => l.id),
          [ana],
        );
        const served = await ok(
          post(`/api/v1/learners/${ana}/batches`, anaToken, { count: 1 }),
        );
        await ok(
          post(`/api/v1/learners/${ana}/attempts`, anaToken, {
            problemId: served.problems[0].id,
            requestId: randomUUID(),
            response: "1",
          }),
        );
        // Bound to one learner: the teacher's child is out of reach.
        for (const path of [
          `/api/v1/learners/${maya}/progress`,
          `/api/v1/learners/${maya}/workbooks`,
        ])
          assert.equal((await get(path, anaToken)).statusCode, 404, path);
        assert.equal(
          (
            await post(`/api/v1/learners/${maya}/batches`, anaToken, {
              count: 1,
            })
          ).statusCode,
          404,
        );
        // The parent sees her progress on their own account.
        await ok(get(`/api/v1/learners/${ana}/progress`, parent));
        // The parent of a child with paid access practices free (step 2).
        assert.equal((await me(parent)).adultPractice?.eligible, true);
        // The teacher reads her record in the class.
        const person = (
          await db.query("SELECT id FROM amp_people WHERE learner_id=$1", [ana])
        ).rows[0].id;
        await ok(get(`/api/v1/school/students/${person}/record`, teacher));
      },
    );

    await t.test(
      "the teacher reaches nothing of the other family's but the class",
      async () => {
        const lio = (
          await ok(
            post("/api/v1/learners", parent, { name: "Lio", birthYear: 2019 }),
            201,
          )
        ).id as string;
        // Lio makes the parent a family of their own; Ana stays in the class
        // her parent approved.
        const own = (
          await db.query(
            "SELECT org_id FROM amp_families WHERE account_id=$1",
            [parent],
          )
        ).rows[0].org_id;
        assert.ok(own && own !== family.org_id);
        assert.equal(
          (
            await db.query(
              "SELECT tenant_id FROM amp_people WHERE learner_id=$1",
              [ana],
            )
          ).rows[0].tenant_id,
          family.org_id,
        );
        const mine = await ok(get("/api/v1/family", teacher));
        assert.deepEqual(
          mine.learners.map((l: { id: string }) => l.id),
          [maya],
        );
        for (const learner of [ana, lio]) {
          for (const path of [
            `/api/v1/learners/${learner}/progress`,
            `/api/v1/billing/status/${learner}`,
          ])
            assert.notEqual((await get(path, teacher)).statusCode, 200, path);
          for (const path of [
            `/api/v1/family/learners/${learner}/practice-here`,
            `/api/v1/family/learners/${learner}/rename`,
            `/api/v1/family/learners/${learner}/delete-learning-data`,
          ])
            assert.notEqual(
              (
                await post(path, teacher, {
                  name: "X",
                  confirmation: "delete-learning-data",
                })
              ).statusCode,
              200,
              path,
            );
        }
        const person = (
          await db.query("SELECT id FROM amp_people WHERE learner_id=$1", [ana])
        ).rows[0].id;
        // A family's teacher can't edit or remove a student the school way.
        const remove = await post(
          `/api/v1/school/orgs/${family.org_id}/students/${person}/remove`,
          teacher,
          { confirmation: "remove" },
        );
        assert.ok([403, 404].includes(remove.statusCode), remove.body);
        // Lio is nowhere in the class, and nothing of Ana changed.
        assert.deepEqual(await names(family.join_code), ["Ana", "Maya"]);
        assert.equal(
          (await db.query("SELECT name FROM amp_learners WHERE id=$1", [ana]))
            .rows[0].name,
          "Ana",
        );
        // On the parent's own device, "Let Ana practice here" works too.
        await ok(
          post(`/api/v1/family/learners/${ana}/practice-here`, parent),
          201,
        );
      },
    );

    await t.test("withdrawal pauses her in the class", async () => {
      await ok(post("/api/v1/family/consent/withdraw", parent));
      assert.equal((await list(teacher))[0]!.status, "paused");
      const blocked = await post(`/api/v1/learners/${ana}/batches`, anaToken, {
        count: 1,
      });
      assert.equal(blocked.statusCode, 403, blocked.body);
      await consent(parent);
      assert.equal((await list(teacher))[0]!.status, "active");
    });

    await t.test(
      "the teacher removing her only ends her place in the class",
      async () => {
        const evidence = async () =>
          (
            await db.query(
              "SELECT (SELECT count(*) FROM amp_attempts WHERE learner_id=$1)::int AS attempts,(SELECT count(*) FROM amp_grants WHERE learner_id=$1 AND status='active')::int AS grants,(SELECT deleted_at FROM amp_learners WHERE id=$1) AS deleted",
              [ana],
            )
          ).rows[0];
        const before = await evidence();
        await ok(
          post(`/api/v1/family/approvals/${approvalId}/remove`, teacher),
        );
        assert.deepEqual(await evidence(), before);
        assert.equal(before.deleted, null);
        assert.deepEqual(await names(family.join_code), ["Maya"]);
        assert.equal((await list(teacher)).length, 0);
        assert.equal((await get("/api/v1/me", anaToken)).statusCode, 401);
        const page = await ok(
          get(`/api/v1/family/approvals/${approvalId}`, parent),
        );
        assert.equal(page.approval.status, "ended");
        // Still her parent's child, with her access.
        assert.ok(
          (await me(parent)).learners.some((l: { id: string }) => l.id === ana),
        );
      },
    );

    await t.test(
      "deletion by the parent takes her out of the class",
      async () => {
        const sent = await ok(
          post("/api/v1/family/approvals", teacher, {
            parentEmail,
          }),
          201,
        );
        const { token } = fragment(mailed.at(-1)!.url);
        await ok(post("/api/v1/family/approvals/open", parent, { token }));
        const bea = (
          await ok(
            post(`/api/v1/family/approvals/${sent.id}/approve`, parent, {
              name: "Bea",
            }),
          )
        ).learnerId;
        assert.deepEqual(await names(family.join_code), ["Bea", "Maya"]);
        await ok(
          post(`/api/v1/family/learners/${bea}/delete-learning-data`, parent, {
            confirmation: "delete-learning-data",
          }),
        );
        assert.deepEqual(await names(family.join_code), ["Maya"]);
        assert.equal((await list(teacher)).length, 0);
        const scrubbed = (
          await db.query(
            "SELECT p.given_name,p.deleted_at FROM amp_family_approvals a JOIN amp_people p ON p.id=a.person_id WHERE a.id=$1",
            [sent.id],
          )
        ).rows[0];
        assert.equal(scrubbed.given_name, "Removed");
        assert.ok(scrubbed.deleted_at);
      },
    );

    await t.test(
      "an expired link is refused, and retention removes it",
      async () => {
        const sent = await ok(
          post("/api/v1/family/approvals", teacher, {
            parentEmail: "cyrus-parent@neighbor.example",
          }),
          201,
        );
        const { token, proof } = fragment(mailed.at(-1)!.url);
        // A sign-up from the mailed link proves that address, and no other.
        const claim = `${token}.${proof}`;
        assert.equal(
          await approvalProvesAddress(
            db,
            "Cyrus-Parent@neighbor.example",
            claim,
          ),
          true,
        );
        assert.equal(
          await approvalProvesAddress(db, "someone@neighbor.example", claim),
          false,
        );
        assert.equal(
          await approvalProvesAddress(
            db,
            "cyrus-parent@neighbor.example",
            token,
          ),
          false,
        );
        await db.query(
          "UPDATE amp_family_approvals SET expires_at=now()-interval '1 minute' WHERE id=$1",
          [sent.id],
        );
        assert.equal(
          (await ok(open("/api/v1/family/approvals/lookup", { token })))
            .approval.status,
          "expired",
        );
        const late = await user("Dara Fixture");
        const refused = await post("/api/v1/family/approvals/open", late, {
          token,
        });
        assert.equal(refused.statusCode, 410, refused.body);
        assert.equal(refused.json().error, "approval_expired");
        assert.equal((await list(teacher))[0]!.status, "expired");
        // Send again: the same link, good again.
        await ok(post(`/api/v1/family/approvals/${sent.id}/resend`, teacher));
        assert.equal((await list(teacher))[0]!.status, "waiting");
        await db.query(
          "UPDATE amp_family_approvals SET expires_at=now()-interval '31 days' WHERE id=$1",
          [sent.id],
        );
        assert.equal(await purgeFamilyApprovals(db), 1);
        assert.equal(
          (await open("/api/v1/family/approvals/lookup", { token })).statusCode,
          404,
        );
      },
    );

    await t.test("a co-teacher sees the class but sends no links", async () => {
      const coTeacher = await user("Rafael Fixture");
      await new SchoolRepository(db).addStaff({
        orgId: family.org_id,
        role: "teacher",
        givenName: "Rafael",
        accountId: coTeacher,
        classId: family.class_id,
      });
      const org = await ok(
        get(`/api/v1/school/orgs/${family.org_id}`, coTeacher),
      );
      assert.equal(org.org.id, family.org_id);
      assert.equal((await me(coTeacher)).familyClass, undefined);
      const send = await post("/api/v1/family/approvals", coTeacher, {
        parentEmail: "zed@neighbor.example",
      });
      assert.equal(send.statusCode, 409);
      const remove = await post(
        `/api/v1/family/approvals/${approvalId}/remove`,
        coTeacher,
      );
      assert.equal(remove.statusCode, 404);
      assert.deepEqual(await list(coTeacher), []);
    });
  },
);
