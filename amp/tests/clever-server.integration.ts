import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import {
  cleverAuthOptions,
  cleverConfiguration,
} from "../src/server/clever.js";
import {
  accountsAuth,
  createAccounts,
  registerAccountRoutes,
} from "../src/server/accounts.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { withProviderSessions } from "../src/identity/provider-principals.js";
import { registerCleverAuthRoutes } from "../src/schools/clever-auth.js";
import { resolveCleverPerson } from "../src/schools/clever/identity.js";
import { registerCleverConnection } from "../src/schools/clever/connection.js";
import { syncCleverConnection } from "../src/schools/clever/sync.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { resolveStudentSession } from "../src/schools/principal.js";

test(
  "production Clever adapter uses real mailbox proofs, source bindings and isolated student sessions",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const admin = new Pool({
      connectionString: process.env.AMP_TEST_DATABASE_URL,
      max: 1,
    });
    const schema = `clever_server_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(process.env.AMP_TEST_DATABASE_URL!);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await migrate(scoped.href);
    const pool = new Pool({ connectionString: scoped.href });
    const app = Fastify();
    const info = console.info;
    console.info = () => {};
    t.after(async () => {
      console.info = info;
      await app.close();
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    const origin = "http://127.0.0.1:4979";
    const accountConfig = {
      baseURL: origin,
      secret: randomUUID() + randomUUID(),
      production: false,
      passwords: true,
      trustedOrigins: [],
      clever: true,
    };
    const config = cleverConfiguration(
      {
        AMP_CLEVER_CLIENT_ID: "fixture",
        AMP_CLEVER_CLIENT_SECRET: "fixture-secret",
        AMP_CLEVER_ENVIRONMENT: "sandbox",
      },
      accountConfig,
    )!;
    const accounts = await createAccounts(pool, accountConfig);
    const resolver = (claims: {
      environment: "sandbox" | "production";
      districtId: string;
      userId: string;
    }) => resolveCleverPerson(pool, claims);
    const authenticate = refuseStudentTokens(
      withProviderSessions(pool, accountsAuth(accounts), {
        resolvePerson: resolver,
      }),
    );
    const adapter = cleverAuthOptions(pool, accounts, config, authenticate);
    const district = "100000000000000000000001",
      school = "200000000000000000000001",
      student = "300000000000000000000001",
      teacher = "300000000000000000000002",
      linkedTeacher = "300000000000000000000003";
    let subject = linkedTeacher;
    const transport: typeof fetch = async (input) => {
      if (String(input).endsWith("/tokens"))
        return Response.json({ access_token: "fixture-access" });
      if (String(input).endsWith("/me"))
        return Response.json({ type: "user", data: { id: subject, district } });
      return Response.json({
        data: {
          id: subject,
          district,
          roles:
            subject === student
              ? { student: { school } }
              : { teacher: { schools: [school] } },
        },
      });
    };
    await registerAccountRoutes(app, accounts, authenticate);
    await registerCleverAuthRoutes(app, { ...adapter, fetch: transport });
    app.get("/proof", (request) => adapter.freshAccountSession!(request));
    app.get("/adult", async (request) => ({
      accountId: await authenticate(request),
    }));
    await app.ready();
    const cookieOf = (
      response: { headers: Record<string, unknown> },
      name: string,
    ) => {
      const raw = response.headers["set-cookie"];
      const values = Array.isArray(raw) ? raw : [raw];
      return String(
        values.find((value) => String(value).startsWith(`${name}=`)),
      ).split(";")[0];
    };
    const signUp = async (email: string) => {
      const result = await app.inject({
        method: "POST",
        url: "/api/auth/sign-up/email",
        headers: { origin },
        payload: {
          email,
          name: "Fixture Parent",
          password: "fixture password sufficiently long",
        },
      });
      assert.equal(result.statusCode, 200, result.body);
      const user = result.json().user;
      await pool.query(
        'UPDATE amp_auth_users SET "emailVerified"=true WHERE id=$1',
        [user.id],
      );
      const cookie = cookieOf(result, "amp.session_token");
      const proof = (
        await app.inject({ method: "GET", url: "/proof", headers: { cookie } })
      ).json();
      return { cookie, user, proof };
    };
    const start = async () => {
      const result = await app.inject({
        method: "GET",
        url: "/api/v1/school/sso/clever/start",
      });
      return {
        state: new URL(String(result.headers.location)).searchParams.get(
          "state",
        )!,
        cookie: cookieOf(result, "amp.clever-flow"),
      };
    };
    const finish = (
      flow: { state: string; cookie: string },
      cookies: string[] = [],
    ) =>
      app.inject({
        method: "GET",
        url: `/api/v1/school/sso/clever/callback?state=${flow.state}&code=${randomUUID()}`,
        headers: { cookie: [flow.cookie, ...cookies].join("; ") },
      });
    const parent = await signUp("linked-parent@example.test");
    assert.equal(parent.proof.accountId, `amp|${parent.user.id}`);
    await pool.query(
      "UPDATE amp_auth_sessions SET \"createdAt\"=now()-interval '11 minutes' WHERE id=$1",
      [parent.proof.sessionId],
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/school/sso/clever/link",
          headers: { origin, cookie: parent.cookie },
        })
      ).statusCode,
      403,
    );
    await pool.query(
      'UPDATE amp_auth_sessions SET "createdAt"=now() WHERE id=$1',
      [parent.proof.sessionId],
    );
    const link = await app.inject({
      method: "POST",
      url: "/api/v1/school/sso/clever/link",
      headers: { origin, cookie: parent.cookie },
    });
    assert.equal(link.statusCode, 200, link.body);
    const linked = await finish(
      {
        state: new URL(link.json().url).searchParams.get("state")!,
        cookie: cookieOf(link, "amp.clever-flow"),
      },
      [parent.cookie],
    );
    assert.match(
      String(linked.headers.location),
      /^\/school(?:\/connect)?#clever-session=/,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT account_id FROM amp_provider_identities WHERE subject=$1",
          [linkedTeacher],
        )
      ).rows[0].account_id,
      `amp|${parent.user.id}`,
    );
    assert.equal(
      (
        await pool.query("SELECT 1 FROM amp_auth_sessions WHERE id=$1", [
          parent.proof.sessionId,
        ])
      ).rowCount,
      1,
      "explicit link preserves the same adult login",
    );

    const previous = await signUp("previous-parent@example.test");
    subject = teacher;
    const staff = await finish(await start(), [previous.cookie]);
    assert.match(
      String(staff.headers.location),
      /^\/school(?:\/connect)?#clever-session=/,
    );
    assert.equal(
      (
        await pool.query("SELECT 1 FROM amp_auth_sessions WHERE id=$1", [
          previous.proof.sessionId,
        ])
      ).rowCount,
      0,
    );
    assert.equal(cookieOf(staff, "amp.session_token"), "amp.session_token=");
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/adult",
          headers: { cookie: previous.cookie },
        })
      ).statusCode,
      401,
    );
    const providerCookie = cookieOf(staff, "amp.provider-session");
    const provider = (
      await app.inject({
        method: "GET",
        url: "/api/v1/provider/session",
        headers: { cookie: providerCookie },
      })
    ).json();
    assert.notEqual(provider.accountId, `amp|${previous.user.id}`);

    const schools = new SchoolRepository(pool);
    const org = await schools.createOrg({
      kind: "district",
      name: "Fixture District",
      timezone: "UTC",
    });
    await schools.recordDataAgreement(org.id, {
      version: "fixture",
      signerName: "Fixture Admin",
      signerTitle: "District Administrator",
    });
    const connection = await registerCleverConnection(pool, {
      environment: "sandbox",
      districtId: district,
      tenantId: org.id,
    });
    await syncCleverConnection(
      pool,
      connection.id,
      {
        districtToken: async () => "fixture-token",
        latestEvent: async () => null,
        events: async () => [],
        snapshot: async () => ({
          district: { id: district, name: "Fixture District" },
          schools: [{ id: school, district, name: "Fixture School" }],
          users: [
            {
              id: student,
              district,
              name: { first: "Student" },
              roles: { student: { school } },
            },
            {
              id: teacher,
              district,
              name: { first: "Teacher" },
              roles: { teacher: { schools: [school] } },
            },
          ],
          sections: [
            {
              id: "400000000000000000000001",
              district,
              school,
              name: "Math",
              students: [student],
              teachers: [teacher],
            },
          ],
          courses: [],
          terms: [],
        }),
      },
      { mode: "full" },
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/adult",
          headers: { cookie: providerCookie },
        })
      ).json().accountId,
      provider.accountId,
    );
    assert.equal(
      (await resolver({
        environment: "sandbox",
        districtId: district,
        userId: teacher,
      }))!.accountId,
      provider.accountId,
    );
    const sharedParent = await signUp("shared-parent@example.test");
    subject = student;
    const studentLogin = await finish(await start(), [
      providerCookie,
      sharedParent.cookie,
    ]);
    assert.match(String(studentLogin.headers.location), /^\/join\/continue#/);
    const grant = JSON.parse(
      Buffer.from(
        String(studentLogin.headers.location).split("#")[1],
        "base64url",
      ).toString(),
    );
    const studentSession = await resolveStudentSession(pool, grant.token);
    assert.ok(studentSession);
    assert.equal(studentSession.accountId, grant.accountId);
    assert.equal(
      (
        await pool.query(
          "SELECT 1 FROM amp_provider_identities WHERE subject=$1",
          [student],
        )
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await pool.query("SELECT 1 FROM amp_auth_sessions WHERE id=$1", [
          sharedParent.proof.sessionId,
        ])
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/provider/session",
          headers: { cookie: providerCookie },
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/adult",
          headers: {
            cookie: parent.cookie,
            authorization: `Bearer ${grant.token}`,
          },
        })
      ).statusCode,
      401,
    );
    subject = teacher;
    const renewed = await finish(await start());
    const renewedCookie = cookieOf(renewed, "amp.provider-session");
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/adult",
          headers: { cookie: renewedCookie },
        })
      ).statusCode,
      200,
    );
    await pool.query(
      "UPDATE amp_clever_connections SET status='disconnected',disconnected_at=now() WHERE id=$1",
      [connection.id],
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/adult",
          headers: { cookie: renewedCookie },
        })
      ).statusCode,
      401,
    );
  },
);
