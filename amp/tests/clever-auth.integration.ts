import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import {
  registerCleverAuthRoutes,
  type FreshAccountProof,
} from "../src/schools/clever-auth.js";
import {
  withProviderSessions,
  verifiedCleverIdentity,
  providerHash,
  providerEligibilityKey,
  type CleverPerson,
} from "../src/identity/provider-principals.js";
import { accountSummary } from "../src/account/repository.js";
import { FamilyRepository } from "../src/family/repository.js";
import { parentAddressConfirmed } from "../src/server/account-access.js";
import { registerDeleteAccountRoutes } from "../src/account/delete-account-routes.js";
import {
  createAccounts,
  registerAccountRoutes,
} from "../src/server/accounts.js";

test(
  "Clever SSO: single-use browser proof, mailbox-independent staff, explicit linking, student isolation and erasure",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const admin = new Pool({
      connectionString: process.env.AMP_TEST_DATABASE_URL,
      max: 1,
    });
    const schema = `amp_clever_auth_${randomUUID().replaceAll("-", "")}`;
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
    const origin = "http://127.0.0.1:4978";
    const accounts = await createAccounts(pool, {
      baseURL: origin,
      secret: randomUUID() + randomUUID(),
      production: false,
      passwords: true,
      trustedOrigins: [],
      clever: true,
    });
    await registerAccountRoutes(app, accounts);
    let exchanges = 0;
    let subject = "teacher-1";
    let roles: Record<string, object> = { teacher: { schools: ["school-1"] } };
    let linkedProof: FreshAccountProof | null = null;
    let boundPerson: CleverPerson | null = null;
    let cleared = 0;
    let studentSignIns = 0;
    const resolver = async () => boundPerson;
    const authenticate = withProviderSessions(
      pool,
      async () => linkedProof?.accountId ?? "amp|missing",
      { resolvePerson: resolver },
    );
    await registerCleverAuthRoutes(app, {
      pool,
      config: {
        origin,
        environment: "sandbox",
        clientId: "fixture",
        clientSecret: "fixture",
      },
      authenticate,
      resolvePerson: resolver,
      freshAccountSession: async () => linkedProof,
      clearAccountSession: async () => {
        cleared++;
      },
      signInPerson: async () => {
        studentSignIns++;
        return {
          token: `st_${"s".repeat(43)}`,
          accountId: "school:fixture",
          mode: "shared",
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        };
      },
      fetch: async (input) => {
        if (String(input).endsWith("/tokens")) {
          exchanges++;
          return Response.json({ access_token: "fixture-access" });
        }
        if (String(input).endsWith("/me"))
          return Response.json({
            type: "user",
            data: { id: subject, district: "district-1" },
          });
        return Response.json({
          data: {
            id: subject,
            district: "district-1",
            email: "existing@example.test",
            roles,
          },
        });
      },
    });
    await registerDeleteAccountRoutes(app, {
      pool,
      authenticate,
      resolveCleverPerson: resolver,
    });
    app.get("/claims", async (request) =>
      verifiedCleverIdentity(pool, request, resolver),
    );
    app.get("/account", async (request) => ({
      accountId: await authenticate(request),
    }));
    await app.ready();
    assert.equal(
      (await app.inject({ method: "GET", url: "/api/v1/auth-config" })).json()
        .clever,
      true,
    );
    const cookieOf = (
      response: { headers: Record<string, unknown> },
      name: string,
    ) => {
      const values = response.headers["set-cookie"];
      const cookies = Array.isArray(values) ? values : [values];
      return String(
        cookies.find((value) => String(value).startsWith(`${name}=`)),
      ).split(";")[0];
    };
    const start = async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/school/sso/clever/start",
      });
      assert.equal(response.statusCode, 302);
      return {
        state: new URL(String(response.headers.location)).searchParams.get(
          "state",
        )!,
        cookie: cookieOf(response, "amp.clever-flow"),
      };
    };
    const finish = (
      flow: { state: string; cookie: string },
      code: string = randomUUID(),
      extraCookie = "",
    ) =>
      app.inject({
        method: "GET",
        url: `/api/v1/school/sso/clever/callback?code=${code}&state=${flow.state}`,
        headers: {
          cookie: [flow.cookie, extraCookie].filter(Boolean).join("; "),
        },
      });

    // A Portal-provided code is discarded and never exchanged without AMP state.
    const portal = await app.inject({
      method: "GET",
      url: "/api/v1/school/sso/clever/callback?code=portal-code",
    });
    assert.match(
      String(portal.headers.location),
      /^https:\/\/clever.com\/oauth\/authorize/,
    );
    assert.equal(exchanges, 0);
    const flow = await start();
    const noCookie = await app.inject({
      method: "GET",
      url: `/api/v1/school/sso/clever/callback?code=stolen&state=${flow.state}`,
    });
    assert.match(String(noCookie.headers.location), /error=/);
    assert.equal(exchanges, 0);
    const [first, duplicate] = await Promise.all([
      finish(flow, "one-code"),
      finish(flow, "one-code"),
    ]);
    const signed = [first, duplicate].find((response) =>
      response.headers.location?.startsWith("/school/connect#clever-session="),
    )!;
    assert.ok(signed);
    assert.equal(exchanges, 1);
    const sessionCookie = cookieOf(signed, "amp.provider-session");
    const sessionResponse = await app.inject({
      method: "GET",
      url: "/api/v1/provider/session",
      headers: { cookie: sessionCookie },
    });
    assert.equal(sessionResponse.statusCode, 200, sessionResponse.body);
    const session = sessionResponse.json();
    assert.match(session.accountId, /^amp\|/);
    assert.equal(
      (await pool.query("SELECT 1 FROM amp_auth_users")).rowCount,
      0,
    );
    const me = await accountSummary(
      pool,
      new FamilyRepository(pool),
      session.accountId,
    );
    assert.equal(me.account.kind, "provider");
    assert.equal(me.account.email, null);
    assert.equal(me.account.emailVerified, false);
    assert.equal(me.account.confirmationRequired, false);
    const client = await pool.connect();
    try {
      assert.equal(
        await parentAddressConfirmed(client, session.accountId),
        false,
      );
    } finally {
      client.release();
    }
    const claims = (
      await app.inject({
        method: "GET",
        url: "/claims",
        headers: { authorization: `Bearer ${session.token}` },
      })
    ).json();
    assert.deepEqual(claims.roles, ["teacher"]);
    assert.equal(claims.districtId, "district-1");
    const eligibility = await providerEligibilityKey(pool, session.accountId);
    assert.match(eligibility!, /^[a-f0-9]{64}$/);
    assert.ok(!eligibility!.includes("teacher-1"));
    // Initial SSO can precede the first roster sync. That later imported
    // person attaches on the next authenticated request, without new login.
    const orgId = randomUUID(),
      personId = randomUUID();
    await pool.query(
      "INSERT INTO amp_orgs(id,kind,path,name,timezone) VALUES($1,'school',ARRAY[$1::uuid],'Fixture School','UTC')",
      [orgId],
    );
    await pool.query(
      "INSERT INTO amp_people(id,tenant_id,given_name,handle,timezone) VALUES($1,$2,'Teacher','teacher-fixture','UTC')",
      [personId, orgId],
    );
    boundPerson = {
      connectionId: randomUUID(),
      tenantId: orgId,
      personId,
      accountId: null,
      learnerId: null,
      roles: ["teacher"],
    };
    const afterRoster = await app.inject({
      method: "GET",
      url: "/claims",
      headers: { authorization: `Bearer ${session.token}` },
    });
    assert.equal(afterRoster.json().accountId, session.accountId);
    assert.equal(afterRoster.json().personId, personId);
    assert.equal(
      (
        await pool.query("SELECT account_id FROM amp_people WHERE id=$1", [
          personId,
        ])
      ).rows[0].account_id,
      session.accountId,
    );
    // An identity with no shared school scope can see setup, without any
    // institutional role. Ending a scope that did exist stops that login.
    await pool.query(
      "INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on,end_on) VALUES($1,$2,$3,'teacher','2026-01-01',current_date)",
      [randomUUID(), personId, orgId],
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/account",
          headers: { authorization: `Bearer ${session.token}` },
        })
      ).statusCode,
      401,
    );
    await pool.query(
      "UPDATE amp_org_roles SET end_on=NULL WHERE person_id=$1",
      [personId],
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/account",
          headers: { authorization: `Bearer ${session.token}` },
        })
      ).json().accountId,
      session.accountId,
    );
    boundPerson = null;
    const crossSite = await app.inject({
      method: "GET",
      url: "/api/v1/provider/session",
      headers: { cookie: sessionCookie, origin: "https://other.example" },
    });
    assert.equal(crossSite.statusCode, 403);
    const stolen = await app.inject({
      method: "GET",
      url: "/account",
      headers: {
        cookie: sessionCookie,
        authorization: `Bearer st_${"x".repeat(43)}`,
      },
    });
    assert.equal(stolen.statusCode, 401);
    const repeat = await finish(await start());
    const repeatSession = (
      await app.inject({
        method: "GET",
        url: "/api/v1/provider/session",
        headers: { cookie: cookieOf(repeat, "amp.provider-session") },
      })
    ).json();
    assert.equal(repeatSession.accountId, session.accountId);

    // An identical reported email never claims an existing parent's account.
    const parentId = randomUUID();
    await pool.query(
      'INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,\'Parent\',\'existing@example.test\',true,now(),now())',
      [parentId],
    );
    linkedProof = {
      accountId: `amp|${parentId}`,
      sessionId: "proved-session",
      createdAt: new Date(),
    };
    const link = await app.inject({
      method: "POST",
      url: "/api/v1/school/sso/clever/link",
      headers: { origin },
    });
    assert.equal(link.statusCode, 200, link.body);
    const linkFlow = {
      state: new URL(link.json().url).searchParams.get("state")!,
      cookie: cookieOf(link, "amp.clever-flow"),
    };
    assert.match(String((await finish(linkFlow)).headers.location), /error=/);
    assert.equal(
      (
        await pool.query(
          "SELECT account_id FROM amp_provider_identities WHERE subject='teacher-1'",
        )
      ).rows[0].account_id,
      session.accountId,
    );
    subject = "teacher-2";
    const newLink = await app.inject({
      method: "POST",
      url: "/api/v1/school/sso/clever/link",
      headers: { origin },
    });
    const linked = await finish({
      state: new URL(newLink.json().url).searchParams.get("state")!,
      cookie: cookieOf(newLink, "amp.clever-flow"),
    });
    assert.match(
      String(linked.headers.location),
      /^\/school(?:\/connect)?#clever-session=/,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT account_id FROM amp_provider_identities WHERE subject='teacher-2'",
        )
      ).rows[0].account_id,
      `amp|${parentId}`,
    );
    const revokedProofFlow = await app.inject({
      method: "POST",
      url: "/api/v1/school/sso/clever/link",
      headers: { origin },
    });
    linkedProof = { ...linkedProof, sessionId: "different-session" };
    const beforeProof = exchanges;
    await finish({
      state: new URL(revokedProofFlow.json().url).searchParams.get("state")!,
      cookie: cookieOf(revokedProofFlow, "amp.clever-flow"),
    });
    assert.equal(exchanges, beforeProof);
    linkedProof = null;

    // Contacts cannot enter staff onboarding and an unrostered student cannot
    // create an adult principal or a learner.
    subject = "student-1";
    roles = { student: {} };
    assert.match(
      String((await finish(await start())).headers.location),
      /error=/,
    );
    assert.equal(studentSignIns, 0);
    roles = { contact: {} };
    assert.match(
      String((await finish(await start())).headers.location),
      /error=/,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT 1 FROM amp_provider_identities WHERE subject='student-1'",
        )
      ).rowCount,
      0,
    );
    roles = { student: {} };
    boundPerson = {
      connectionId: randomUUID(),
      tenantId: randomUUID(),
      personId: randomUUID(),
      accountId: null,
      learnerId: randomUUID(),
      roles: ["student"],
    };
    const student = await finish(await start(), randomUUID(), sessionCookie);
    assert.match(String(student.headers.location), /^\/join\/continue#/);
    assert.equal(studentSignIns, 1);
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/provider/session",
          headers: { cookie: sessionCookie },
        })
      ).statusCode,
      401,
    );
    assert.ok(cleared >= 3);
    boundPerson = null;

    // Deletion requires this provider session's original login time. Refreshing
    // another login cannot make an old session fresh.
    const headers = { authorization: `Bearer ${repeatSession.token}` };
    const preview = await app.inject({
      method: "GET",
      url: "/api/v1/account/deletion",
      headers,
    });
    assert.equal(preview.statusCode, 200, preview.body);
    await pool.query(
      "UPDATE amp_provider_sessions SET created_at=now()-interval '11 minutes' WHERE token_hash=$1",
      [providerHash(repeatSession.token)],
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/account/deletion",
          headers,
        })
      ).statusCode,
      403,
    );
    await pool.query(
      "UPDATE amp_provider_sessions SET created_at=now() WHERE token_hash=$1",
      [providerHash(repeatSession.token)],
    );
    const deletion = await app.inject({
      method: "POST",
      url: "/api/v1/account/delete",
      headers,
      payload: { confirmation: "delete-my-account" },
    });
    assert.equal(deletion.statusCode, 200, deletion.body);
    assert.equal(
      (
        await pool.query(
          "SELECT 1 FROM amp_provider_principals WHERE account_id=$1",
          [session.accountId],
        )
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/provider/session",
          headers,
        })
      ).statusCode,
      401,
    );
    // Erasure removes raw provider identifiers; signing in again gets a new
    // account id and the same non-contact pilot eligibility reference.
    subject = "teacher-1";
    roles = { teacher: { schools: ["school-1"] } };
    const recreated = await finish(await start());
    const recreatedCookie = cookieOf(recreated, "amp.provider-session");
    const recreatedSession = (
      await app.inject({
        method: "GET",
        url: "/api/v1/provider/session",
        headers: { cookie: recreatedCookie },
      })
    ).json();
    assert.notEqual(recreatedSession.accountId, session.accountId);
    assert.equal(
      await providerEligibilityKey(pool, recreatedSession.accountId),
      eligibility,
    );
    // Explicit mailbox signup on the same browser replaces the provider
    // cookie and revokes its bearer, so either direction changes identity.
    const mailbox = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { origin, cookie: recreatedCookie },
      payload: {
        name: "Fixture Parent",
        email: "separate-parent@example.test",
        password: "a fixture password long enough",
      },
    });
    assert.equal(mailbox.statusCode, 200, mailbox.body);
    assert.match(
      cookieOf(mailbox, "amp.provider-session"),
      /^amp\.provider-session=$/,
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/provider/session",
          headers: { authorization: `Bearer ${recreatedSession.token}` },
        })
      ).statusCode,
      401,
    );
  },
);
