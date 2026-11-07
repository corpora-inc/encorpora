import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { resolveStudentToken } from "../src/schools/principal.js";
import { microsoftEmailVerified } from "../src/server/provider-email.js";
import type { OidcProvider } from "../src/schools/oidc.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { ssoLookupHash } from "../src/schools/sso-credentials.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

const YEAR_AHEAD = new Date(Date.now() + 365 * 86_400_000).toISOString();
const ORIGIN = "https://amp.test";
const CLIENT = "amp-client-id";

/** A provider that signs for real: its keys, its token endpoint, its JWKS. What
 * the next token says is up to the test, so every refusal is a real one. */
async function fakeProvider() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const forged = await generateKeyPair("RS256");
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
  let next: {
    claims?: Record<string, unknown>;
    key?: CryptoKey;
    nonce?: string | null;
  } = {};
  let lastNonce = "";
  let tokenRequest: URLSearchParams | null = null;
  const server: Server = createServer((request, response) => {
    if (request.url === "/jwks") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    if (request.url === "/token") {
      let body = "";
      request.on("data", (chunk) => (body += chunk));
      request.on("end", () => {
        tokenRequest = new URLSearchParams(body);
        void new SignJWT({
          email: "amara@alder.example",
          email_verified: true,
          nonce:
            next.nonce === undefined ? lastNonce : (next.nonce ?? undefined),
          ...next.claims,
        })
          .setProtectedHeader({ alg: "RS256", kid: "k1" })
          .setIssuer("https://fake.test")
          .setAudience((next.claims?.aud as string) ?? CLIENT)
          .setSubject("subject-1")
          .setIssuedAt()
          .setExpirationTime("5m")
          .sign(next.key ?? privateKey)
          .then((idToken) => {
            response.setHeader("content-type", "application/json");
            response.end(JSON.stringify({ id_token: idToken }));
          });
      });
      return;
    }
    response.statusCode = 404;
    response.end();
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const provider: OidcProvider = {
    clientId: CLIENT,
    clientSecret: "amp-client-secret",
    authorizationEndpoint: `${base}/authorize`,
    tokenEndpoint: `${base}/token`,
    jwksUri: `${base}/jwks`,
    issuer: ({ iss }) => iss === "https://fake.test",
    emailVerified: ({ email_verified: verified }) => verified === true,
  };
  return {
    provider,
    forgedKey: forged.privateKey,
    tokenRequest: () => tokenRequest,
    sayNext(value: typeof next) {
      next = value;
    },
    seeNonce(nonce: string) {
      lastNonce = nonce;
    },
    close: () => new Promise((done) => server.close(done)),
  };
}

test(
  "AMP for Schools provider sign-in: real signatures, scoped to a tenant, same student session",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_oidc_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href);
    const db = learning.pool;
    const schools = new SchoolRepository(db);
    const google = await fakeProvider();
    const microsoft = await fakeProvider();
    microsoft.provider.emailVerified = (claims) =>
      microsoftEmailVerified(claims as Record<string, unknown>);
    const authenticate = refuseStudentTokens(async (request) => {
      const header = request.headers.authorization;
      if (header?.startsWith("Bearer amp|")) return header.slice(7);
      throw new ApiError(401, "Sign in to continue");
    });
    const app = buildApp({ repository: learning, authenticate });
    await registerSchoolRoutes(app, {
      pool: db,
      authenticate,
      services: {
        secret: "test-secret",
        origin: ORIGIN,
        oidc: { google: google.provider, microsoft: microsoft.provider },
      },
    });
    await app.ready();
    const as = (token: string) => ({ authorization: `Bearer ${token}` });
    const adminAccount = "amp|head";
    async function school(name: string, account = adminAccount) {
      const org = await schools.createOrg(
        { kind: "school", name, timezone: "UTC" },
        { version: "fixture", signerName: "Fixture", signerTitle: "Head" },
      );
      await schools.issueLicense({
        orgId: org.id,
        seats: 50,
        endsAt: YEAR_AHEAD,
      });
      await schools.addStaff({
        orgId: org.id,
        role: "admin",
        givenName: "Head",
        accountId: account,
      });
      const klass = await schools.createClass(org.id, { name: "Grade 5" });
      return { id: org.id, klass };
    }
    const alder = await school("Alder Street School");
    const other = await school("Other School", "amp|elsewhere");
    const add = (
      home: { id: string; klass: { id: string } },
      givenName: string,
      email?: string,
    ) =>
      schools.provisionStudent(home.id, {
        givenName,
        classId: home.klass.id,
        ...(email ? { email } : {}),
      });
    const amara = await add(alder, "Amara", "Amara@Alder.example");
    await add(alder, "Twin One", "family@alder.example");
    await add(alder, "Twin Two", "family@alder.example");
    await add(alder, "No Email");
    const elsewhere = await add(other, "Far", "far@other.example");

    const turn = (
      home: { id: string },
      provider: string,
      enabled: boolean,
      account = adminAccount,
    ) =>
      app.inject({
        method: "POST",
        url: `/api/v1/school/orgs/${home.id}/integrations/sign-in`,
        headers: as(account),
        payload: { provider, enabled },
      });
    const lookup = async (code: string) =>
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/school/join/lookup",
          payload: { code },
        })
      ).json();

    /** The browser's half: start, then come back from the provider. */
    async function flow(
      code: string,
      provider = "google",
      returned: { code?: string; state?: string; error?: string } = {},
    ) {
      const start = await app.inject({
        method: "GET",
        url: `/api/v1/school/join/oidc/${provider}/start?code=${code}`,
      });
      assert.equal(start.statusCode, 302);
      const location = String(start.headers.location);
      if (!location.includes("/authorize")) return { start: location };
      const sent = new URL(location);
      const cookie = String(start.headers["set-cookie"]).split(";")[0]!;
      const fake = provider === "google" ? google : microsoft;
      fake.seeNonce(sent.searchParams.get("nonce")!);
      const query = new URLSearchParams({
        state: returned.state ?? sent.searchParams.get("state")!,
        ...(returned.error
          ? { error: returned.error }
          : { code: returned.code ?? "provider-code" }),
      });
      const back = await app.inject({
        method: "GET",
        url: `/api/v1/school/join/oidc/${provider}/callback?${query}`,
        headers: { cookie },
      });
      assert.equal(back.statusCode, 302);
      return { sent, cookie, location: String(back.headers.location) };
    }
    const grantFrom = (location: string) =>
      JSON.parse(
        Buffer.from(location.split("#")[1]!, "base64url").toString(),
      ) as { token: string; accountId: string; mode: string };

    try {
      await t.test(
        "off by default: no button, and the flow won't start",
        async () => {
          const roster = await lookup(alder.klass.joinCode);
          assert.deepEqual(roster.signIn, []);
          const { start } = await flow(alder.klass.joinCode);
          assert.equal(start, `/join/${alder.klass.joinCode}?sso=failed`);
        },
      );

      await t.test(
        "turning a provider on creates credentials only for a unique address",
        async () => {
          const result = await turn(alder, "google", true);
          assert.equal(result.statusCode, 200);
          const google = result
            .json()
            .providers.find((row: { id: string }) => row.id === "google");
          assert.equal(google.on, true);
          assert.equal(google.eligible, 1);
          assert.equal(google.noEmail, 1);
          assert.equal(google.sharedEmail, 2);
          const { rows } = await db.query(
            `SELECT p.given_name,k.lookup_hash FROM amp_person_credentials k JOIN amp_people p ON p.id=k.person_id
           WHERE k.kind='sso' AND k.revoked_at IS NULL`,
          );
          assert.deepEqual(
            rows.map((row) => row.given_name),
            ["Amara"],
          );
          // The hash the sign-in computes is the one the database wrote.
          assert.equal(
            rows[0].lookup_hash,
            ssoLookupHash("google", alder.id, "amara@alder.example"),
          );
          assert.deepEqual((await lookup(alder.klass.joinCode)).signIn, [
            "google",
          ]);
          assert.deepEqual((await lookup(other.klass.joinCode)).signIn, []);
        },
      );

      await t.test(
        "a verified address on the roster signs in as that student",
        async () => {
          google.sayNext({});
          const { sent, location } = await flow(alder.klass.joinCode);
          assert.equal(sent!.searchParams.get("client_id"), CLIENT);
          assert.equal(sent!.searchParams.get("code_challenge_method"), "S256");
          assert.equal(
            sent!.searchParams.get("redirect_uri"),
            `${ORIGIN}/api/v1/school/join/oidc/google/callback`,
          );
          assert.ok(location!.startsWith("/join/continue#"));
          const grant = grantFrom(location!);
          assert.equal(grant.accountId, `school:${amara.personId}`);
          assert.ok(grant.token.startsWith("st_"));
          assert.equal(
            await resolveStudentToken(db, grant.token),
            grant.accountId,
          );
          // PKCE: the verifier that hashes to the challenge reached the token endpoint.
          const verifier = google.tokenRequest()!.get("code_verifier")!;
          const { createHash } = await import("node:crypto");
          assert.equal(
            createHash("sha256").update(verifier).digest("base64url"),
            sent!.searchParams.get("code_challenge"),
          );
          // Students never enter the parent user table.
          const users = await db.query(
            "SELECT to_regclass('amp_auth_users') AS relation",
          );
          if (users.rows[0].relation)
            assert.equal(
              (await db.query("SELECT count(*)::int AS n FROM amp_auth_users"))
                .rows[0].n,
              0,
            );
        },
      );

      await t.test("a forged signature is refused", async () => {
        google.sayNext({ key: google.forgedKey });
        const { location } = await flow(alder.klass.joinCode);
        assert.equal(location, `/join/${alder.klass.joinCode}?sso=failed`);
      });
      await t.test("the wrong audience is refused", async () => {
        google.sayNext({ claims: { aud: "another-app" } });
        const { location } = await flow(alder.klass.joinCode);
        assert.equal(location, `/join/${alder.klass.joinCode}?sso=failed`);
      });
      await t.test("the wrong nonce is refused", async () => {
        google.sayNext({ nonce: "not-this-flow" });
        const { location } = await flow(alder.klass.joinCode);
        assert.equal(location, `/join/${alder.klass.joinCode}?sso=failed`);
      });
      await t.test("the wrong issuer is refused", async () => {
        const honest = google.provider.issuer;
        google.provider.issuer = () => false;
        google.sayNext({});
        const { location } = await flow(alder.klass.joinCode);
        google.provider.issuer = honest;
        assert.equal(location, `/join/${alder.klass.joinCode}?sso=failed`);
      });
      await t.test(
        "an address the provider doesn't vouch for is refused",
        async () => {
          google.sayNext({ claims: { email_verified: false } });
          const { location } = await flow(alder.klass.joinCode);
          assert.equal(
            location,
            `/join/${alder.klass.joinCode}?sso=email_unverified`,
          );
        },
      );
      await t.test(
        "Microsoft's address counts only with xms_edov",
        async () => {
          await turn(alder, "microsoft", true);
          microsoft.sayNext({ claims: { email_verified: undefined } });
          const refused = await flow(alder.klass.joinCode, "microsoft");
          assert.equal(
            refused.location,
            `/join/${alder.klass.joinCode}?sso=email_unverified`,
          );
          microsoft.sayNext({ claims: { xms_edov: true } });
          const allowed = await flow(alder.klass.joinCode, "microsoft");
          assert.ok(allowed.location!.startsWith("/join/continue#"));
          await turn(alder, "microsoft", false);
        },
      );
      await t.test(
        "no credential: a shared address, or nobody by that address",
        async () => {
          google.sayNext({ claims: { email: "family@alder.example" } });
          assert.equal(
            (await flow(alder.klass.joinCode)).location,
            `/join/${alder.klass.joinCode}?sso=not_on_roster`,
          );
          google.sayNext({ claims: { email: "stranger@alder.example" } });
          assert.equal(
            (await flow(alder.klass.joinCode)).location,
            `/join/${alder.klass.joinCode}?sso=not_on_roster`,
          );
        },
      );
      await t.test(
        "a student from another tenant can't use this class's flow",
        async () => {
          await turn(other, "google", true, "amp|elsewhere");
          const credentials = await db.query(
            "SELECT 1 FROM amp_person_credentials WHERE person_id=$1 AND kind='sso' AND revoked_at IS NULL",
            [elsewhere.personId],
          );
          assert.equal(credentials.rowCount, 1);
          google.sayNext({ claims: { email: "far@other.example" } });
          assert.equal(
            (await flow(alder.klass.joinCode)).location,
            `/join/${alder.klass.joinCode}?sso=not_on_roster`,
          );
          // At their own school it works.
          const own = await flow(other.klass.joinCode);
          assert.equal(
            grantFrom(own.location!).accountId,
            `school:${elsewhere.personId}`,
          );
        },
      );
      await t.test(
        "a tampered, missing or crossed cookie goes back to the class",
        async () => {
          const fine = await app.inject({
            method: "GET",
            url: `/api/v1/school/join/oidc/google/start?code=${alder.klass.joinCode}`,
          });
          const sent = new URL(String(fine.headers.location));
          const cookie = String(fine.headers["set-cookie"]).split(";")[0]!;
          const state = sent.searchParams.get("state")!;
          const callback = `/api/v1/school/join/oidc/google/callback?code=x&state=${state}`;
          const missing = await app.inject({ method: "GET", url: callback });
          assert.equal(missing.headers.location, "/join?sso=expired");
          const tampered = await app.inject({
            method: "GET",
            url: callback,
            headers: { cookie: `${cookie.slice(0, -2)}xx` },
          });
          assert.equal(tampered.headers.location, "/join?sso=expired");
          const wrongState = await app.inject({
            method: "GET",
            url: `/api/v1/school/join/oidc/google/callback?code=x&state=nope`,
            headers: { cookie },
          });
          assert.equal(
            wrongState.headers.location,
            `/join/${alder.klass.joinCode}?sso=expired`,
          );
        },
      );
      await t.test("declining at the provider says so", async () => {
        const { location } = await flow(alder.klass.joinCode, "google", {
          error: "access_denied",
        });
        assert.equal(location, `/join/${alder.klass.joinCode}?sso=declined`);
      });
      await t.test(
        "a removed student can't sign in, and nor can a provider turned off",
        async () => {
          google.sayNext({});
          const off = await turn(alder, "google", false);
          assert.equal(off.statusCode, 200);
          assert.equal(
            (await flow(alder.klass.joinCode)).start,
            `/join/${alder.klass.joinCode}?sso=failed`,
          );
          const revoked = await db.query(
            "SELECT 1 FROM amp_person_credentials WHERE person_id=$1 AND kind='sso' AND revoked_at IS NULL",
            [amara.personId],
          );
          assert.equal(revoked.rowCount, 0);
          await turn(alder, "google", true);
          const removed = await app.inject({
            method: "POST",
            url: `/api/v1/school/orgs/${alder.id}/students/${amara.personId}/remove`,
            headers: as(adminAccount),
            payload: { confirm: "remove" },
          });
          assert.equal(removed.statusCode, 200);
          assert.equal(
            (await flow(alder.klass.joinCode)).location,
            `/join/${alder.klass.joinCode}?sso=not_on_roster`,
          );
        },
      );
    } finally {
      await app.close();
      await learning.pool.end();
      await google.close();
      await microsoft.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
