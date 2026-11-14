import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

/* A child's active time reaches the record whatever page origin the device
   sent: "Let … practice here" on a parent's phone, and the class code and
   pictures. The school routes once refused every heartbeat whose Origin
   wasn't AMP's configured one with 403, before the handler, so a family saw
   "0 min · 3 problems". Every name is made up. */
test(
  "student heartbeats: practice-here and class-code sessions record minutes",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_beat_${randomUUID().replaceAll("-", "")}`;
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
    const AMP = "https://amp.example.test";
    const app = buildApp({ repository: learning, authenticate });
    await registerFamilyRoutes(app, { pool: db, authenticate });
    await registerSchoolRoutes(app, {
      pool: db,
      authenticate,
      services: { secret: "f".repeat(64), origin: AMP },
    });
    await app.ready();
    t.after(async () => {
      await app.close();
      await learning.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    const post = (
      path: string,
      headers: Record<string, string>,
      payload: object = {},
    ) => app.inject({ method: "POST", url: path, headers, payload });
    const parent = `amp|${randomUUID()}`;
    await db.query(
      `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
       VALUES($1,'Marisol Fixture',$2,true,now(),now())`,
      [parent.slice(4), `${parent.slice(4)}@beat.example`],
    );
    await db.query(
      "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'policy','verified','fixture-proof')",
      [parent],
    );
    const made = await post(
      "/api/v1/learners",
      { authorization: `Bearer ${parent}` },
      { name: "Aug", birthYear: 2016 },
    );
    assert.equal(made.statusCode, 201, made.body);
    const aug = made.json().id as string;
    await db.query(
      `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
       VALUES($1,$2,'stripe',$1,'active',now()-interval '1 day',now()+interval '300 days')`,
      [`fixture:${aug}`, aug],
    );
    const minutes = async () =>
      Number(
        (
          await db.query(
            "SELECT COALESCE(sum(active_ms),0) AS ms FROM amp_active_days WHERE learner_id=$1",
            [aug],
          )
        ).rows[0].ms,
      );
    const beat = (token: string, origin: string) =>
      post(
        "/api/v1/school/student/activity",
        {
          authorization: `Bearer ${token}`,
          origin,
          // The parent's own sign-in cookie rides along on their phone.
          cookie: "better-auth.session_token=fixture",
        },
        { deltas: [{ surface: "practice", activeMs: 30_000 }] },
      );

    await t.test("a parent's “Let Aug practice here” session", async () => {
      const here = await post(`/api/v1/family/learners/${aug}/practice-here`, {
        authorization: `Bearer ${parent}`,
      });
      assert.equal(here.statusCode, 201, here.body);
      const before = await minutes();
      const sent = await beat(here.json().token, "https://phone.example.test");
      assert.equal(sent.statusCode, 204, sent.body);
      // The server credits no more than the time since the session last
      // reported, so a fresh sign-in counts a few seconds, never zero.
      assert.ok((await minutes()) > before, "the heartbeat recorded time");
    });

    await t.test("a class-code and pictures session", async () => {
      const code = (
        await db.query(
          "SELECT c.join_code FROM amp_families f JOIN amp_classes c ON c.id=f.class_id WHERE f.account_id=$1",
          [parent],
        )
      ).rows[0].join_code as string;
      const roster = await post("/api/v1/school/join/lookup", {}, { code });
      assert.equal(roster.statusCode, 200, roster.body);
      const person = roster.json().students[0].id as string;
      const grant = await post(
        "/api/v1/school/join/picture",
        {},
        { code, personId: person, pictures: ["fox", "moon", "owl"], set: true },
      );
      assert.equal(grant.statusCode, 200, grant.body);
      const before = await minutes();
      const sent = await beat(grant.json().token, "capacitor://localhost");
      assert.equal(sent.statusCode, 204, sent.body);
      // The server credits no more than the time since the session last
      // reported, so a fresh sign-in counts a few seconds, never zero.
      assert.ok((await minutes()) > before, "the heartbeat recorded time");
    });

    await t.test(
      "a cookie-only POST from another site is still refused",
      async () => {
        const forged = await post(
          "/api/v1/school/student/activity",
          {
            cookie: "better-auth.session_token=fixture",
            origin: "https://evil.example.test",
          },
          { deltas: [] },
        );
        assert.equal(forged.statusCode, 403);
        assert.equal(forged.json().error, "request_origin_invalid");
      },
    );
  },
);
