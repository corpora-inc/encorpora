import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Fastify, { type FastifyRequest } from "fastify";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import {
  establishProviderPrincipal,
  providerEligibilityKeys,
  providerHash,
  rememberProviderPilotAliases,
  resolveProviderSession,
  verifiedCleverOnboarding,
  withProviderSessions,
  type CleverClaims,
} from "../src/identity/provider-principals.js";
import { registerCleverAuthRoutes } from "../src/schools/clever-auth.js";
import { resolveCleverPerson } from "../src/schools/clever/identity.js";
import { registerCleverConnection } from "../src/schools/clever/connection.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { startSchoolClass, activateClassPilot } from "../src/schools/pilots.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";

const districtId = "100000000000000000000001";
const subject = "300000000000000000000001";
const claims: CleverClaims = {
  environment: "sandbox",
  districtId,
  userId: subject,
  roles: ["district_admin"],
  schools: [],
};
const request = (token: string) =>
  ({ headers: { authorization: `Bearer ${token}` } }) as FastifyRequest;

async function fixture(run: (pool: Pool) => Promise<void>) {
  const url = process.env.AMP_TEST_DATABASE_URL!;
  const schema = `clever_reconnect_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  const pool = new Pool({ connectionString: scoped.href });
  try {
    await migrate(scoped.href);
    await run(pool);
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
}

test(
  "fresh Clever OAuth can reconnect a revoked source without restoring old school authority",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () =>
    fixture(async (pool) => {
      const repo = new SchoolRepository(pool);
      const resolver = (
        c: Pick<CleverClaims, "environment" | "districtId" | "userId">,
      ) => resolveCleverPerson(pool, c);
      const normal = await establishProviderPrincipal(pool, claims, null);
      assert.equal(normal.onboarding, false);
      assert.ok(
        await resolveProviderSession(pool, request(normal.token), resolver),
      );
      const org = await repo.createOrg(
        { kind: "district", name: "Fixture district", timezone: "UTC" },
        { version: "fixture", signerName: "Fixture", signerTitle: "Admin" },
      );
      const connection = await registerCleverConnection(pool, {
        environment: "sandbox",
        districtId,
        tenantId: org.id,
      });
      await pool.query(
        "UPDATE amp_clever_connections SET status='disconnected',disconnected_at=now() WHERE id=$1",
        [connection.id],
      );
      assert.equal(
        await resolveProviderSession(pool, request(normal.token), resolver),
        null,
      );
      const app = Fastify();
      const origin = "http://localhost:4977";
      let fallbackCalls = 0;
      const authenticate = withProviderSessions(
        pool,
        async () => {
          fallbackCalls++;
          return "amp|unrelated-parent";
        },
        { resolvePerson: resolver },
      );
      await registerCleverAuthRoutes(app, {
        pool,
        config: {
          origin,
          clientId: "fixture",
          clientSecret: "fixture",
          environment: "sandbox",
        },
        authenticate,
        resolvePerson: resolver,
        signInPerson: async () => null,
        clearAccountSession: async () => {},
        fetch: async (input) =>
          String(input).endsWith("/tokens")
            ? Response.json({ access_token: "fixture" })
            : String(input).endsWith("/me")
              ? Response.json({ data: { id: subject, district: districtId } })
              : Response.json({
                  data: {
                    id: subject,
                    district: districtId,
                    roles: { district_admin: {} },
                  },
                }),
      });
      app.get("/private", async (req) => ({
        account: await authenticate(req),
      }));
      try {
        const started = await app.inject({
          method: "GET",
          url: "/api/v1/school/sso/clever/start",
        });
        const cookies = started.headers["set-cookie"];
        const cookie = String(
          Array.isArray(cookies) ? cookies[0] : cookies,
        ).split(";")[0];
        const state = new URL(
          String(started.headers.location),
        ).searchParams.get("state");
        const callback = await app.inject({
          method: "GET",
          url: `/api/v1/school/sso/clever/callback?code=fixture-code&state=${state}`,
          headers: { cookie },
        });
        assert.match(
          String(callback.headers.location),
          /^\/school\/connect#clever-onboarding=po_/,
        );
        const token = new URLSearchParams(
          String(callback.headers.location).split("#")[1],
        ).get("clever-onboarding")!;
        const proof = await verifiedCleverOnboarding(pool, request(token));
        assert.equal(proof?.accountId, normal.accountId);
        assert.deepEqual(proof?.roles, ["district_admin"]);
        assert.ok(
          proof!.expiresAt.getTime() - proof!.createdAt.getTime() <= 600000,
        );
        const read = await app.inject({
          method: "GET",
          url: "/api/v1/provider/onboarding-session",
          headers: { authorization: `Bearer ${token}` },
        });
        assert.equal(read.statusCode, 200, read.body);
        assert.equal(read.json().token, token);
        assert.equal(
          (
            await app.inject({
              method: "GET",
              url: "/api/v1/provider/session",
              headers: { authorization: `Bearer ${token}` },
            })
          ).statusCode,
          401,
        );
        assert.equal(
          (
            await app.inject({
              method: "GET",
              url: "/private",
              headers: {
                authorization: `Bearer ${token}`,
                cookie: "amp.provider-session=old-cookie",
              },
            })
          ).statusCode,
          401,
        );
        assert.equal(
          fallbackCalls,
          0,
          "onboarding proof must never restore a parent cookie",
        );
        assert.equal(
          await verifiedCleverOnboarding(pool, request(normal.token)),
          null,
        );
        assert.equal(
          await verifiedCleverOnboarding(pool, {
            headers: { cookie: `amp.provider-session=${token}` },
          } as FastifyRequest),
          null,
        );
        assert.equal(
          (
            await app.inject({
              method: "GET",
              url: "/api/v1/provider/onboarding-session",
              headers: {
                authorization: `Bearer ${token}`,
                origin: "https://sibling.example",
              },
            })
          ).statusCode,
          403,
        );
        // Reauthorization does not revive the login that was revoked.
        await registerCleverConnection(pool, {
          environment: "sandbox",
          districtId,
          tenantId: org.id,
        });
        assert.equal(
          await resolveProviderSession(pool, request(normal.token), resolver),
          null,
        );
        const refreshed = await establishProviderPrincipal(pool, claims, null);
        assert.equal(refreshed.onboarding, false);
        assert.ok(
          await resolveProviderSession(
            pool,
            request(refreshed.token),
            resolver,
          ),
        );
        await pool.query(
          "UPDATE amp_provider_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",
          [providerHash(token)],
        );
        assert.equal(
          await verifiedCleverOnboarding(pool, request(token)),
          null,
        );
        // An archived user has the same setup-only recovery even if the district is active.
        const run = randomUUID(),
          person = randomUUID();
        await pool.query(
          "INSERT INTO amp_people(id,tenant_id,given_name,handle,timezone) VALUES($1,$2,'Fixture','FixtureAdmin','UTC')",
          [person, org.id],
        );
        await pool.query(
          "INSERT INTO amp_clever_sync_runs(id,connection_id,mode,status) VALUES($1,$2,'full','succeeded')",
          [run, connection.id],
        );
        await pool.query(
          "INSERT INTO amp_clever_bindings(connection_id,kind,clever_id,local_id,record,last_seen_run_id,archived_at) VALUES($1,'user',$2,$3,'{}',$4,now())",
          [connection.id, subject, person, run],
        );
        const archived = await establishProviderPrincipal(pool, claims, null);
        assert.equal(archived.onboarding, true);
        assert.equal(
          await resolveProviderSession(pool, request(archived.token), resolver),
          null,
        );
      } finally {
        await app.close();
      }
    }),
);

test(
  "every linked Clever alias retains the original pilot after account erasure, including aliases linked after activation",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () =>
    fixture(async (pool) => {
      const user = randomUUID(),
        accountId = `amp|${user}`,
        pilot = randomUUID();
      await pool.query(
        `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,'Fixture','fixture@example.test',true,now(),now())`,
        [user],
      );
      await establishProviderPrincipal(
        pool,
        { ...claims, roles: ["teacher"] },
        null,
        accountId,
      );
      await pool.query(
        "INSERT INTO amp_teacher_pilots(id,account_id,started_at,ends_at,grace_ends_at) VALUES($1,$2,now()-interval '38 days',now()-interval '8 days',now()-interval '1 day')",
        [pilot, accountId],
      );
      const secondClaims = {
        ...claims,
        userId: "300000000000000000000002",
        roles: ["teacher"],
      };
      await establishProviderPrincipal(pool, secondClaims, null, accountId);
      const keys = await providerEligibilityKeys(pool, accountId);
      assert.equal(keys.length, 2);
      for (const key of keys) {
        assert.match(key, /^[a-f0-9]{64}$/);
        assert.equal(
          (
            await pool.query(
              "SELECT pilot_id FROM amp_pilot_eligibility WHERE identity_digest=$1",
              [key],
            )
          ).rows[0].pilot_id,
          pilot,
        );
      }
      const db = await pool.connect();
      try {
        await db.query("BEGIN");
        await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
          accountId,
        ]);
        await rememberProviderPilotAliases(db, accountId);
        await db.query(
          "UPDATE amp_teacher_pilots SET account_id='deleted-pilot:'||id WHERE account_id=$1",
          [accountId],
        );
        await db.query(
          "DELETE FROM amp_provider_principals WHERE account_id=$1",
          [accountId],
        );
        await db.query("DELETE FROM amp_auth_users WHERE id=$1", [user]);
        await db.query("COMMIT");
      } finally {
        db.release();
      }
      const recreated = await establishProviderPrincipal(
        pool,
        secondClaims,
        null,
      );
      assert.notEqual(recreated.accountId, accountId);
      const repo = new SchoolRepository(pool);
      const classroom = await startSchoolClass(repo, recreated.accountId, {
        requestId: randomUUID(),
        schoolName: "Fixture school",
        className: "Math",
        timezone: "UTC",
        signerName: "Fixture teacher",
        signerTitle: "Teacher",
        agreementVersion: AGREEMENT_VERSION,
        authorized: true,
        names: ["Fixture Student"],
      });
      const state = await activateClassPilot(
        repo,
        recreated.accountId,
        classroom.classId,
      );
      assert.equal(state.status, "expired");
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS count FROM amp_teacher_pilots",
          )
        ).rows[0].count,
        1,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT pilot_id FROM amp_class_pilots WHERE class_id=$1",
            [classroom.classId],
          )
        ).rows[0].pilot_id,
        pilot,
      );
    }),
);
