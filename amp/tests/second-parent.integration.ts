import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { registerStripeRoutes } from "../src/billing/stripe/routes.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";
import { config as stripeFixtureConfig } from "./stripe-fixtures.js";

/* A family's second parent (docs/families.md): the account holder invites
   one, she accepts only with the invited address, sees the children and their
   progress, practices free while a child has access, and decides nothing that
   is the holder's. Removal ends all of that and nothing of hers. Every name
   and address here is made up. */
test(
  "second parent: invitation, matching address, authorization, free practice, cap and removal",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_second_parent_${randomUUID().replaceAll("-", "")}`;
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
    const origin = "https://amp.example.test";
    const secret = randomBytes(32).toString("hex");
    const mailed: { to: string; subject: string; text: string; url: string }[] =
      [];
    const mail = async (
      to: string,
      subject: string,
      text: string,
      link: string,
    ) => {
      mailed.push({ to, subject, text, url: link });
    };
    const app = buildApp({ repository: learning, authenticate });
    await registerFamilyRoutes(app, {
      pool: db,
      authenticate,
      approvals: { secret, origin, mail },
    });
    await registerSchoolRoutes(app, {
      pool: db,
      authenticate,
      services: { secret, origin, mail },
    });
    await registerStripeRoutes(app, {
      pool: db,
      config: stripeFixtureConfig,
      authenticate,
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
    const refused = async (
      response: Promise<{ statusCode: number; body: string }>,
      status: number,
      code?: string,
    ) => {
      const result = await response;
      assert.equal(result.statusCode, status, result.body);
      if (code) assert.equal(JSON.parse(result.body).error, code);
    };
    /** Refused as for any account that isn't the child's: by consent first
     * when the account has none, otherwise as not found. */
    const denied = async (
      response: Promise<{ statusCode: number; body: string }>,
    ) => {
      const result = await response;
      assert.ok([403, 404].includes(result.statusCode), result.body);
    };
    const me = (credential: string) => ok(get("/api/v1/me", credential));
    const user = async (name: string, email: string, verified = true) => {
      const id = randomUUID();
      await db.query(
        `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
         VALUES($1,$2,$3,$4,now(),now())`,
        [id, name, email, verified],
      );
      return `amp|${id}`;
    };
    const address = (who: string) =>
      `${who}-${randomUUID().slice(0, 8)}@example.test`;
    const fragment = (link: string) => {
      const [token, proof] = new URL(link).hash.slice(1).split(".");
      return { token: token!, proof: proof! };
    };
    const paid = (learnerId: string) =>
      db.query(
        `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
         VALUES($1,$2,'stripe',$1,'active',now()-interval '1 day',now()+interval '300 days')
         ON CONFLICT(id) DO UPDATE SET status='active',ends_at=now()+interval '300 days'`,
        [`fixture:${learnerId}`, learnerId],
      );
    const lapse = (learnerId: string) =>
      db.query("UPDATE amp_grants SET status='revoked' WHERE id=$1", [
        `fixture:${learnerId}`,
      ]);
    const secondParent = async (holder: string) =>
      (await ok(get("/api/v1/family/second-parent", holder))).secondParent;
    const adultHasAccess = async (account: string) =>
      (await me(account)).family.learners.find((l: { adult?: true }) => l.adult)
        ?.hasAccess as boolean | undefined;

    // The account holder: a parent with one child, so a family and a class.
    const holderEmail = address("fern");
    const holder = await user("Fern Fixture", holderEmail);
    await db.query(
      `INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference)
       VALUES($1,'policy','verified','fixture-proof')`,
      [holder],
    );
    const maya = (
      await ok(
        post("/api/v1/learners", holder, { name: "Maya", birthYear: 2016 }),
        201,
      )
    ).id as string;
    const family = (
      await db.query(
        "SELECT org_id,class_id FROM amp_families WHERE account_id=$1",
        [holder],
      )
    ).rows[0] as { org_id: string; class_id: string };
    // The invited parent signs up with a password: unconfirmed until a link
    // proves the address.
    const rowanEmail = address("rowan");
    const rowan = await user("Rowan Fixture", rowanEmail, false);
    const stranger = await user("Sky Fixture", address("sky"));
    let link = "";

    await t.test("the account holder invites one second parent", async () => {
      assert.equal(await secondParent(holder), null);
      const sent = await ok(
        post("/api/v1/family/second-parent", holder, {
          email: rowanEmail.toUpperCase(),
        }),
        201,
      );
      assert.equal(sent.mailed, true);
      assert.equal(mailed.length, 1);
      assert.equal(mailed[0]!.to, rowanEmail);
      assert.match(mailed[0]!.subject, /Fern invited you to Fern’s class/);
      link = mailed[0]!.url;
      assert.match(
        link,
        /^https:\/\/amp\.example\.test\/school\/invite#[\w-]{43}\.[\w-]{43}$/,
      );
      const view = await secondParent(holder);
      assert.equal(view.status, "invited");
      assert.equal(view.emailHint, "r…@…");
      assert.ok(!JSON.stringify(view).includes(rowanEmail));
      // "Copy link" is the same link without the mailbox's proof.
      assert.equal(view.inviteUrl, link.slice(0, link.lastIndexOf(".")));
      // The class's staff list shows her apart from co-teachers.
      const staff = await ok(
        get(`/api/v1/school/orgs/${family.org_id}/staff`, holder),
      );
      assert.equal(
        staff.staff.filter((s: { secondParent?: true }) => s.secondParent)
          .length,
        1,
      );
      // Send again mails the same link.
      assert.equal(
        (await ok(post("/api/v1/family/second-parent/resend", holder))).mailed,
        true,
      );
      assert.equal(mailed.at(-1)!.url, link);
    });

    await t.test("only one second parent, invited or active", async () => {
      await refused(
        post("/api/v1/family/second-parent", holder, {
          email: address("other"),
        }),
        409,
        "second_parent_exists",
      );
      await refused(
        post("/api/v1/family/second-parent", stranger, {
          email: address("other"),
        }),
        404,
        "family_not_found",
      );
    });

    await t.test(
      "the link names the class and the invited address",
      async () => {
        const { invite } = await ok(
          open("/api/v1/school/invites/lookup", {
            token: fragment(link).token,
          }),
        );
        assert.equal(invite.status, "open");
        assert.equal(invite.email, rowanEmail);
        assert.deepEqual(invite.secondParent, { className: "Fern’s class" });
      },
    );

    await t.test(
      "another account is refused, with nothing joined",
      async () => {
        const { token, proof } = fragment(link);
        await refused(
          post("/api/v1/school/invites/accept", stranger, { token, proof }),
          403,
          "invite_wrong_account",
        );
        await refused(
          post("/api/v1/school/invites/accept", holder, { token, proof }),
          403,
          "invite_wrong_account",
        );
        // An unconfirmed address with a copied link proves nothing yet.
        await refused(
          post("/api/v1/school/invites/accept", rowan, { token }),
          403,
          "invite_email_unconfirmed",
        );
        assert.equal((await me(stranger)).secondParentOf, undefined);
        assert.equal((await secondParent(holder)).status, "invited");
      },
    );

    await t.test("the matching address accepts", async () => {
      const { token, proof } = fragment(link);
      const joined = await ok(
        post("/api/v1/school/invites/accept", rowan, {
          token,
          proof,
          name: "Rowan Fixture",
        }),
      );
      assert.equal(joined.orgId, family.org_id);
      assert.equal(joined.familyClassId, family.class_id);
      // The mailed link's proof confirmed her address.
      assert.equal(
        (
          await db.query(
            'SELECT "emailVerified" FROM amp_auth_users WHERE id=$1',
            [rowan.slice(4)],
          )
        ).rows[0].emailVerified,
        true,
      );
      const view = await secondParent(holder);
      assert.equal(view.status, "active");
      assert.equal(view.name, "Rowan Fixture");
      assert.equal(view.inviteUrl, null);
      const mine = await me(rowan);
      assert.equal(mine.secondParentOf.length, 1);
      assert.equal(mine.secondParentOf[0].classId, family.class_id);
      assert.deepEqual(
        mine.secondParentOf[0].learners.map((l: { id: string }) => l.id),
        [maya],
      );
      assert.equal(mine.learners.length, 0, "the children stay the holder's");
      assert.ok(
        mine.staffOf.some((s: { orgId: string }) => s.orgId === family.org_id),
      );
      assert.equal(mine.next, "practice");
      // Once accepted, the invitation is gone from the holder's options.
      await refused(
        post("/api/v1/family/second-parent", holder, {
          email: address("other"),
        }),
        409,
        "second_parent_exists",
      );
      await refused(
        post("/api/v1/family/second-parent/resend", holder),
        409,
        "second_parent_active",
      );
    });

    await t.test(
      "she sees the class and the children's progress, and hands over a device",
      async () => {
        await ok(get(`/api/v1/school/classes/${family.class_id}/today`, rowan));
        await ok(get(`/api/v1/learners/${maya}/progress`, rowan));
        await ok(get(`/api/v1/learners/${maya}/frontier`, rowan));
        const session = await ok(
          post(`/api/v1/family/learners/${maya}/practice-here`, rowan),
          201,
        );
        assert.equal(session.mode, "shared");
        // A stranger reaches none of it.
        await denied(get(`/api/v1/learners/${maya}/progress`, stranger));
        await refused(
          post(`/api/v1/family/learners/${maya}/practice-here`, stranger),
          404,
        );
      },
    );

    await t.test(
      "buying, consent, names, deletion and invitations stay the holder's",
      async () => {
        const holderOnly = "family_holder_only";
        await refused(
          post(`/api/v1/family/learners/${maya}/rename`, rowan, {
            name: "Mia",
          }),
          403,
          holderOnly,
        );
        await refused(
          post(`/api/v1/family/learners/${maya}/delete-learning-data`, rowan, {
            confirmation: "delete-learning-data",
          }),
          403,
          holderOnly,
        );
        await refused(
          post("/api/v1/family/consent/withdraw", rowan),
          403,
          holderOnly,
        );
        await refused(
          post("/api/v1/billing/checkout", rowan, {
            learnerId: maya,
            requestId: randomUUID(),
          }),
          403,
          holderOnly,
        );
        await refused(
          get(`/api/v1/billing/status/${maya}`, rowan),
          403,
          holderOnly,
        );
        await refused(
          post("/api/v1/family/second-parent", rowan, {
            email: address("other"),
          }),
          403,
          holderOnly,
        );
        await refused(
          post("/api/v1/family/second-parent/remove", rowan),
          403,
          holderOnly,
        );
        await refused(get("/api/v1/family/second-parent", rowan), 403);
        await refused(
          post("/api/v1/family/approvals", rowan, {
            parentEmail: address("neighbor"),
          }),
          403,
          holderOnly,
        );
        // A co-teacher invitation is the family admin's: school routes
        // answer what an account may not do as not found.
        await refused(
          post(`/api/v1/school/orgs/${family.org_id}/staff/invites`, rowan, {
            email: address("aunt"),
            role: "teacher",
            classIds: [family.class_id],
          }),
          404,
        );
        // Decisions about the child, and practicing as the child from her
        // own account.
        await refused(
          post(`/api/v1/learners/${maya}/birth-year`, rowan, {
            birthYear: 2015,
          }),
          403,
        );
        await refused(
          post(`/api/v1/learners/${maya}/starting-point`, rowan, {
            band: "3–5",
          }),
          403,
        );
        await refused(post(`/api/v1/learners/${maya}/batches`, rowan, {}), 403);
        // Nothing of the holder's changed.
        const theirs = await me(holder);
        assert.equal(theirs.consent.status, "active");
        assert.equal(theirs.learners[0].name, "Maya");
      },
    );

    await t.test(
      "her own practice is free while a child has access, and ends when none does",
      async () => {
        await ok(
          post("/api/v1/me/practice", rowan, { timezone: "America/Chicago" }),
          201,
        );
        assert.equal(await adultHasAccess(rowan), false, "Maya isn't paid yet");
        await paid(maya);
        assert.equal(await adultHasAccess(rowan), true);
        const grant = (
          await db.query(
            `SELECT g.ends_at FROM amp_grants g JOIN amp_learners l ON l.id=g.learner_id
             WHERE l.account_id=$1 AND l.adult AND g.id='adult:'||l.id`,
            [rowan],
          )
        ).rows[0];
        const child = (
          await db.query("SELECT ends_at FROM amp_grants WHERE id=$1", [
            `fixture:${maya}`,
          ])
        ).rows[0];
        assert.equal(grant.ends_at.getTime(), child.ends_at.getTime());
        await lapse(maya);
        assert.equal(await adultHasAccess(rowan), false);
        await paid(maya);
        assert.equal(await adultHasAccess(rowan), true);
      },
    );

    await t.test(
      "removal ends her family access and free practice, never her account",
      async () => {
        const own = (await me(rowan)).adultPractice.learner.id as string;
        await ok(post("/api/v1/family/second-parent/remove", holder));
        assert.equal(await secondParent(holder), null);
        const after = await me(rowan);
        assert.equal(after.secondParentOf, undefined);
        assert.equal(after.staffOf, undefined);
        assert.equal(after.adultPractice.learner.id, own, "her learner stays");
        assert.equal(await adultHasAccess(rowan), false, "while Maya is paid");
        await denied(get(`/api/v1/learners/${maya}/progress`, rowan));
        await refused(
          post(`/api/v1/family/learners/${maya}/practice-here`, rowan),
          404,
        );
        await refused(
          get(`/api/v1/school/classes/${family.class_id}/today`, rowan),
          404,
        );
        // Her old link joins nobody.
        const { token, proof } = fragment(link);
        await refused(
          post("/api/v1/school/invites/accept", stranger, { token, proof }),
          410,
        );
        assert.equal(
          (
            await db.query("SELECT 1 FROM amp_auth_users WHERE id=$1", [
              rowan.slice(4),
            ])
          ).rowCount,
          1,
        );
      },
    );

    await t.test("two invitations at once leave exactly one", async () => {
      const results = await Promise.all(
        [address("kit"), address("lee"), address("max")].map((email) =>
          post("/api/v1/family/second-parent", holder, { email }),
        ),
      );
      assert.deepEqual(
        results.map((r) => r.statusCode).sort(),
        [201, 409, 409],
        results.map((r) => r.body).join(" "),
      );
      assert.equal(
        (
          await db.query(
            `SELECT count(*)::int AS n FROM amp_people p JOIN amp_org_roles r ON r.person_id=p.id
             WHERE p.tenant_id=$1 AND r.role='teacher' AND r.end_on IS NULL AND p.account_id IS NULL`,
            [family.org_id],
          )
        ).rows[0].n,
        1,
      );
      // A pending invitation can be removed and another sent.
      await ok(post("/api/v1/family/second-parent/remove", holder));
      await ok(
        post("/api/v1/family/second-parent", holder, {
          email: rowanEmail,
        }),
        201,
      );
      assert.equal((await secondParent(holder)).status, "invited");
    });
  },
);
