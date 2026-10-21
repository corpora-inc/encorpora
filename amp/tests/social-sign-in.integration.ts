import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, generateKeyPairSync } from "node:crypto";
import { Pool } from "pg";
import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { migrate } from "../scripts/migrate";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import { registerFamilyRoutes } from "../src/family/routes.js";
import {
  accountsAuth,
  createAccounts,
  registerAccountRoutes,
} from "../src/server/accounts";

/** Provider sign-in against real AMP routes and an isolated schema, with
 * every provider endpoint (token, keys, profile) answered by this test. */
test(
  "social sign-in: providers, verified-email linking and the guided first run",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `social_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    scoped.searchParams.set("application_name", schema);
    const repo = new PostgresRepository(scoped.href, { development: true });
    const origin = "http://127.0.0.1:4310";
    const info = console.info;
    const mail: string[] = [];
    console.info = (...args) => mail.push(args.join(" "));
    const realFetch = globalThis.fetch;
    await admin.query(`CREATE SCHEMA ${schema}`);
    let app: ReturnType<typeof buildApp> | undefined;
    try {
      await migrate(scoped.href);
      const appleKey = generateKeyPairSync("ec", { namedCurve: "P-256" })
        .privateKey.export({ type: "pkcs8", format: "pem" })
        .toString();
      const accounts = await createAccounts(repo.pool, {
        baseURL: origin,
        secret: "s".repeat(40),
        production: false,
        passwords: true,
        trustedOrigins: [],
        google: { clientId: "google-client", clientSecret: "google-secret" },
        github: { clientId: "github-client", clientSecret: "github-secret" },
        microsoft: {
          clientId: "microsoft-client",
          clientSecret: "microsoft-secret",
          tenantId: "common",
        },
        apple: {
          clientId: "inc.example.amp.web",
          teamId: "TEAMID1234",
          keyId: "KEYID12345",
          privateKey: appleKey,
        },
      });
      app = buildApp({
        repository: repo,
        authenticate: accountsAuth(accounts),
        development: true,
      });
      await registerAccountRoutes(app, accounts);
      // A production-shaped family service: an unverified email gates first run.
      await registerFamilyRoutes(app, {
        pool: repo.pool,
        authenticate: accountsAuth(accounts),
      });

      const pair = await generateKeyPair("RS256");
      const jwk: JWK = {
        ...(await exportJWK(pair.publicKey)),
        kid: "test-key",
        alg: "RS256",
        use: "sig",
      };
      const sign = (
        claims: Record<string, unknown>,
        iss: string,
        aud: string,
      ) =>
        new SignJWT(claims)
          .setProtectedHeader({ alg: "RS256", kid: "test-key" })
          .setIssuer(iss)
          .setAudience(aud)
          .setIssuedAt()
          .setExpirationTime("5m")
          .sign(pair.privateKey);
      const microsoftTenant = "11111111-2222-3333-4444-555555555555";
      /** What the next provider round trip returns. */
      let identity: {
        sub: string;
        email: string;
        verified: boolean;
        extra?: Record<string, unknown>;
      } = { sub: "", email: "", verified: false };
      globalThis.fetch = async (input, init) => {
        const address = String(input instanceof Request ? input.url : input);
        const { sub, email, verified, extra } = identity;
        if (address === "https://oauth2.googleapis.com/token")
          return Response.json({
            access_token: "google-access",
            token_type: "Bearer",
            expires_in: 3600,
            id_token: await sign(
              { sub, email, email_verified: verified, name: "Google Parent" },
              "https://accounts.google.com",
              "google-client",
            ),
          });
        if (address === "https://appleid.apple.com/auth/token")
          return Response.json({
            access_token: "apple-access",
            token_type: "Bearer",
            expires_in: 3600,
            id_token: await sign(
              { sub, email, email_verified: String(verified), ...extra },
              "https://appleid.apple.com",
              "inc.example.amp.web",
            ),
          });
        if (
          address.startsWith(
            "https://login.microsoftonline.com/common/oauth2/v2.0/token",
          )
        )
          return Response.json({
            access_token: "microsoft-access",
            token_type: "Bearer",
            expires_in: 3600,
            id_token: await sign(
              {
                sub,
                oid: sub,
                tid: microsoftTenant,
                email,
                name: "Microsoft Parent",
                ...extra,
              },
              `https://login.microsoftonline.com/${microsoftTenant}/v2.0`,
              "microsoft-client",
            ),
          });
        if (address === "https://github.com/login/oauth/access_token")
          return Response.json({
            access_token: "github-access",
            token_type: "bearer",
            scope: "read:user,user:email",
          });
        if (address === "https://api.github.com/user")
          return Response.json({
            id: Number(sub),
            login: "parent",
            name: "GitHub Parent",
            email,
            avatar_url: "",
          });
        if (address === "https://api.github.com/user/emails")
          return Response.json([{ email, primary: true, verified }]);
        if (
          address === "https://www.googleapis.com/oauth2/v3/certs" ||
          address === "https://appleid.apple.com/auth/keys" ||
          address.endsWith("/discovery/v2.0/keys")
        )
          return Response.json({ keys: [jwk] });
        return realFetch(input, init);
      };

      const cookies = (response: { headers: Record<string, unknown> }) =>
        ([] as string[])
          .concat((response.headers["set-cookie"] as string[]) ?? [])
          .map((c) => c.split(";")[0])
          .join("; ");
      let ip = 1;
      const post = (path: string, payload: object, cookie = "") =>
        app!.inject({
          method: "POST",
          url: `/api/auth${path}`,
          payload,
          remoteAddress: `198.51.100.${ip++}`,
          headers: { origin, cookie },
        });
      /** Starts provider sign-in as the web screen does, then completes the
       * provider's redirect to AMP's callback. */
      async function providerSignIn(
        provider: "google" | "apple" | "microsoft" | "github",
        who: typeof identity,
        appleUser?: object,
      ) {
        identity = who;
        const start = await post("/sign-in/social", {
          provider,
          callbackURL: "/",
          newUserCallbackURL: "/start",
          errorCallbackURL: `/sign-up?provider=${provider}`,
        });
        assert.equal(start.statusCode, 200, start.body);
        const authorize = new URL(start.json().url);
        const state = authorize.searchParams.get("state")!;
        const pkce = authorize.searchParams.get("code_challenge_method");
        if (provider !== "apple" && provider !== "github")
          assert.equal(pkce, "S256", `${provider} uses PKCE`);
        assert.equal(
          authorize.searchParams.get("redirect_uri"),
          `${origin}/api/auth/callback/${provider}`,
        );
        let callback;
        if (provider === "apple") {
          // Apple posts the callback as a form (response_mode=form_post), and
          // sends the parent's name only the first time.
          const form = new URLSearchParams({ code: "apple-code", state });
          if (appleUser) form.set("user", JSON.stringify(appleUser));
          const posted = await app!.inject({
            method: "POST",
            url: "/api/auth/callback/apple",
            payload: form.toString(),
            headers: {
              "content-type": "application/x-www-form-urlencoded",
              origin: "https://appleid.apple.com",
            },
          });
          assert.equal(posted.statusCode, 302);
          const next = new URL(String(posted.headers.location));
          callback = await app!.inject({
            method: "GET",
            url: next.pathname + next.search,
            headers: { cookie: cookies(start) },
          });
        } else
          callback = await app!.inject({
            method: "GET",
            url: `/api/auth/callback/${provider}?code=test-code&state=${encodeURIComponent(state)}`,
            headers: { cookie: cookies(start) },
          });
        assert.equal(callback.statusCode, 302, callback.body);
        return {
          location: new URL(String(callback.headers.location), origin),
          cookie: cookies(callback),
        };
      }
      const me = async (cookie: string) =>
        (
          await app!.inject({
            method: "GET",
            url: "/api/v1/me",
            headers: { cookie },
          })
        ).json();
      const accountRows = (email: string) =>
        repo.pool.query(
          `SELECT a."providerId", a."accountId" FROM amp_auth_accounts a
            JOIN amp_auth_users u ON u.id = a."userId" WHERE u.email = $1
            ORDER BY a."providerId"`,
          [email],
        );

      await t.test(
        "the API reports exactly the configured providers",
        async () => {
          const config = (
            await app!.inject({ method: "GET", url: "/api/v1/auth-config" })
          ).json();
          assert.deepEqual(config, {
            mode: "accounts",
            passwords: true,
            passkeySignup: true,
            providers: ["google", "apple", "microsoft", "github"],
          });
        },
      );

      await t.test(
        "a new parent signs up with a verified provider email and enters the same first run",
        async () => {
          const result = await providerSignIn("google", {
            sub: "google-new",
            email: "new.parent@example.com",
            verified: true,
          });
          assert.equal(result.location.pathname, "/start");
          const state = await me(result.cookie);
          assert.equal(state.signedIn, true);
          assert.equal(state.account.emailVerified, true);
          // No step is skipped: no consent yet, so practice is not reachable.
          assert.equal(state.consent.status, "none");
          assert.equal(state.next, "try");
          assert.deepEqual(state.learners, []);
          // A password parent who has confirmed their email is in the same place.
          const signup = await post("/sign-up/email", {
            email: "password.parent@example.com",
            password: "A long test passphrase",
            name: "Password Parent",
          });
          assert.equal(signup.statusCode, 200);
          // Unconfirmed: the trial is open; consent and purchase wait.
          const unconfirmed = await me(cookies(signup));
          assert.equal(unconfirmed.next, "try");
          assert.ok(unconfirmed.signedIn);
          assert.equal(unconfirmed.account.confirmationRequired, true);
          await repo.pool.query(
            `UPDATE amp_auth_users SET "emailVerified"=true WHERE email=$1`,
            ["password.parent@example.com"],
          );
          const confirmed = await me(cookies(signup));
          assert.equal(confirmed.next, state.next);
          assert.ok(confirmed.signedIn);
          assert.equal(confirmed.account.confirmationRequired, false);
          assert.deepEqual(confirmed.consent, state.consent);
          // The same identity signs in again without a new account.
          const again = await providerSignIn("google", {
            sub: "google-new",
            email: "new.parent@example.com",
            verified: true,
          });
          assert.equal(again.location.pathname, "/");
          assert.equal(
            (await accountRows("new.parent@example.com")).rowCount,
            1,
          );
        },
      );

      await t.test(
        "an unverified provider email cannot create an account",
        async () => {
          const result = await providerSignIn("github", {
            sub: "4242",
            email: "unverified@example.com",
            verified: false,
          });
          assert.equal(result.location.pathname, "/sign-up");
          assert.equal(result.location.searchParams.get("provider"), "github");
          assert.equal(
            result.location.searchParams.get("error"),
            "provider_email_unverified",
          );
          assert.equal(result.cookie.includes("session_token"), false);
          assert.equal(
            (
              await repo.pool.query(
                "SELECT 1 FROM amp_auth_users WHERE email=$1",
                ["unverified@example.com"],
              )
            ).rowCount,
            0,
          );
        },
      );

      // An existing password parent with a confirmed address.
      const existing = "existing@example.com";
      const created = await post("/sign-up/email", {
        email: existing,
        password: "A long test passphrase",
        name: "Existing Parent",
      });
      assert.equal(created.statusCode, 200);
      const existingId = created.json().user.id as string;

      await t.test(
        "linking needs the parent's own address confirmed",
        async () => {
          const result = await providerSignIn("google", {
            sub: "google-existing",
            email: existing,
            verified: true,
          });
          assert.equal(
            result.location.searchParams.get("error"),
            "account_not_linked",
          );
          assert.equal((await accountRows(existing)).rowCount, 1);
        },
      );
      await repo.pool.query(
        'UPDATE amp_auth_users SET "emailVerified"=true WHERE id=$1',
        [existingId],
      );

      await t.test("an unverified provider email never links", async () => {
        const result = await providerSignIn("github", {
          sub: "5151",
          email: existing,
          verified: false,
        });
        assert.equal(
          result.location.searchParams.get("error"),
          "account_not_linked",
        );
        assert.deepEqual(
          (await accountRows(existing)).rows.map((r) => r.providerId),
          ["credential"],
        );
      });

      await t.test(
        "a verified matching provider email links to the parent",
        async () => {
          const result = await providerSignIn("google", {
            sub: "google-existing",
            email: existing,
            verified: true,
          });
          assert.equal(
            result.location.pathname,
            "/",
            "an existing parent, not a new one",
          );
          const state = await me(result.cookie);
          assert.equal(state.account.id, `amp|${existingId}`);
          assert.deepEqual(
            (await accountRows(existing)).rows.map((r) => r.providerId),
            ["credential", "google"],
          );
        },
      );

      await t.test(
        "a removed identity returns only through Security",
        async () => {
          const login = await post("/sign-in/email", {
            email: existing,
            password: "A long test passphrase",
          });
          const summary = (
            await app!.inject({
              method: "GET",
              url: "/api/auth/security/summary",
              headers: { cookie: cookies(login) },
            })
          ).json();
          const google = summary.accounts.find(
            (a: { provider: string }) => a.provider === "google",
          );
          assert.equal(
            (
              await post(
                "/security/unlink-account",
                { id: google.id },
                cookies(login),
              )
            ).statusCode,
            200,
          );
          const refused = await providerSignIn("google", {
            sub: "google-existing",
            email: existing,
            verified: true,
          });
          assert.equal(
            refused.location.searchParams.get("error"),
            "unable_to_link_account",
          );
          assert.deepEqual(
            (await accountRows(existing)).rows.map((r) => r.providerId),
            ["credential"],
          );
          // Linking it again from Security restores provider sign-in.
          identity = {
            sub: "google-existing",
            email: existing,
            verified: true,
          };
          const link = await post(
            "/link-social",
            { provider: "google", callbackURL: "/family/security" },
            cookies(login),
          );
          assert.equal(link.statusCode, 200, link.body);
          const linkState = new URL(link.json().url).searchParams.get("state")!;
          const linked = await app!.inject({
            method: "GET",
            url: `/api/auth/callback/google?code=test-code&state=${encodeURIComponent(linkState)}`,
            headers: { cookie: `${cookies(login)}; ${cookies(link)}` },
          });
          assert.equal(linked.statusCode, 302);
          assert.equal(
            new URL(String(linked.headers.location), origin).pathname,
            "/family/security",
          );
          assert.equal(
            (
              await repo.pool.query(
                'SELECT 1 FROM amp_auth_removed_identities WHERE "userId"=$1',
                [existingId],
              )
            ).rowCount,
            0,
          );
          const restored = await providerSignIn("google", {
            sub: "google-existing",
            email: existing,
            verified: true,
          });
          assert.equal(restored.location.pathname, "/");
          assert.equal(
            (await me(restored.cookie)).account.id,
            `amp|${existingId}`,
          );
        },
      );

      await t.test(
        "a parent with an authenticator links only from Security",
        async () => {
          await repo.pool.query(
            'UPDATE amp_auth_users SET "twoFactorEnabled"=true WHERE id=$1',
            [existingId],
          );
          const refused = await providerSignIn("microsoft", {
            sub: "ms-existing",
            email: existing,
            verified: true,
            extra: { xms_edov: true },
          });
          assert.equal(
            refused.location.searchParams.get("error"),
            "unable_to_link_account",
          );
          assert.equal(
            (await accountRows(existing)).rows.some(
              (r) => r.providerId === "microsoft",
            ),
            false,
          );
          await repo.pool.query(
            'UPDATE amp_auth_users SET "twoFactorEnabled"=false WHERE id=$1',
            [existingId],
          );
        },
      );

      await t.test(
        "Microsoft email counts as verified only with xms_edov",
        async () => {
          const refused = await providerSignIn("microsoft", {
            sub: "ms-new",
            email: "ms.parent@example.com",
            verified: true,
          });
          assert.equal(
            refused.location.searchParams.get("error"),
            "provider_email_unverified",
          );
          const accepted = await providerSignIn("microsoft", {
            sub: "ms-new",
            email: "ms.parent@example.com",
            verified: true,
            extra: { xms_edov: true },
          });
          assert.equal(accepted.location.pathname, "/start");
        },
      );

      await t.test(
        "Apple: private relay address, and a name sent only on the first sign-in",
        async () => {
          const relay = "q7x2k9@privaterelay.appleid.com";
          const first = await providerSignIn(
            "apple",
            {
              sub: "apple-relay",
              email: relay,
              verified: true,
              extra: { is_private_email: "true" },
            },
            { name: { firstName: "Robin", lastName: "Parent" }, email: relay },
          );
          assert.equal(first.location.pathname, "/start");
          const user = async () =>
            (
              await repo.pool.query(
                'SELECT name, "emailVerified" FROM amp_auth_users WHERE email=$1',
                [relay],
              )
            ).rows[0];
          assert.deepEqual(await user(), {
            name: "Robin Parent",
            emailVerified: true,
          });
          const second = await providerSignIn("apple", {
            sub: "apple-relay",
            email: relay,
            verified: true,
            extra: { is_private_email: "true" },
          });
          assert.equal(second.location.pathname, "/");
          assert.equal((await user()).name, "Robin Parent", "name kept");
          // Without a name at all (an earlier authorization), sign-up works.
          const nameless = await providerSignIn("apple", {
            sub: "apple-nameless",
            email: "nameless@privaterelay.appleid.com",
            verified: true,
          });
          assert.equal(nameless.location.pathname, "/start");
          assert.equal((await me(nameless.cookie)).signedIn, true);
        },
      );

      await t.test(
        "a cancelled provider screen returns to the screen it left",
        async () => {
          const start = await post("/sign-in/social", {
            provider: "google",
            callbackURL: "/",
            newUserCallbackURL: "/start",
            errorCallbackURL: "/sign-in?provider=google",
          });
          const state = new URL(start.json().url).searchParams.get("state")!;
          const back = await app!.inject({
            method: "GET",
            url: `/api/auth/callback/google?error=access_denied&state=${encodeURIComponent(state)}`,
            headers: { cookie: cookies(start) },
          });
          assert.equal(back.statusCode, 302);
          const location = new URL(String(back.headers.location), origin);
          assert.equal(location.pathname, "/sign-in");
          assert.equal(location.searchParams.get("provider"), "google");
          assert.equal(location.searchParams.get("error"), "access_denied");
        },
      );
    } finally {
      globalThis.fetch = realFetch;
      console.info = info;
      await app?.close();
      await repo.pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
