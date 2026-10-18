import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
import { migrate } from "../scripts/migrate";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import {
  createAccounts,
  accountsAuth,
  registerAccountRoutes,
} from "../src/server/accounts";

test(
  "security: TOTP, password/session revocation, linking and concurrent last-method protection",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `security_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    scoped.searchParams.set("application_name", schema);
    const repo = new PostgresRepository(scoped.href, { development: true });
    const origin = "http://127.0.0.1:4310";
    const mail: string[] = [];
    const info = console.info;
    console.info = (...args) => mail.push(args.join(" "));
    await admin.query(`CREATE SCHEMA ${schema}`);
    let app: ReturnType<typeof buildApp> | undefined;
    try {
      await migrate(scoped.href);
      const accounts = await createAccounts(repo.pool, {
        baseURL: origin,
        secret: "s".repeat(40),
        production: false,
        passwords: true,
        trustedOrigins: [],
        google: { clientId: "test-client", clientSecret: "test-secret" },
      });
      app = buildApp({
        repository: repo,
        authenticate: accountsAuth(accounts),
        development: true,
      });
      await registerAccountRoutes(app, accounts);
      let requestId = 1;
      const post = (path: string, payload: object, cookie = "", extra = {}) =>
        app!.inject({
          method: "POST",
          url: `/api/auth${path}`,
          payload,
          remoteAddress: `203.0.113.${requestId++}`,
          headers: { origin, cookie, ...extra },
        });
      const get = (path: string, cookie = "", extra = {}) =>
        app!.inject({
          method: "GET",
          url: `/api/auth${path}`,
          headers: { cookie, ...extra },
        });
      const cookies = (response: { headers: Record<string, unknown> }) =>
        ([] as string[])
          .concat((response.headers["set-cookie"] as string[]) ?? [])
          .map((c) => c.split(";")[0])
          .join("; ");
      const password = "A long test passphrase";
      async function signup(email: string) {
        const result = await post("/sign-up/email", {
          email,
          password,
          name: "Test Parent",
        });
        assert.equal(result.statusCode, 200);
        return {
          cookie: cookies(result),
          user: result.json().user.id as string,
        };
      }
      let owner = await signup("parent@example.com");
      const other = await signup("other@example.com");
      await t.test(
        "TOTP requires password and proof; sign-in, replacement backup codes and disable",
        async () => {
          assert.equal(
            (
              await post(
                "/two-factor/enable",
                { password: "wrong" },
                owner.cookie,
              )
            ).statusCode,
            400,
          );
          const enrollment = await post(
            "/two-factor/enable",
            { password },
            owner.cookie,
          );
          assert.equal(enrollment.statusCode, 200);
          const data = enrollment.json();
          assert.equal(data.backupCodes.length, 10);
          assert.equal(
            (await get("/security/summary", owner.cookie)).json()
              .twoFactorEnabled,
            false,
          );
          const secret = new URL(data.totpURI).searchParams.get("secret")!;
          const rawSecret = new TextDecoder().decode(base32.decode(secret));
          assert.equal(
            (
              await post(
                "/two-factor/verify-totp",
                { code: "000000" },
                owner.cookie,
              )
            ).statusCode,
            401,
          );
          const verify = await post(
            "/two-factor/verify-totp",
            { code: await createOTP(rawSecret).totp() },
            owner.cookie,
          );
          assert.equal(verify.statusCode, 200);
          owner.cookie = cookies(verify) || owner.cookie;
          assert.equal(
            (await get("/security/summary", owner.cookie)).json()
              .twoFactorEnabled,
            true,
          );
          const storage = await repo.pool.query(
            'SELECT secret, "backupCodes" FROM amp_auth_two_factors WHERE "userId"=$1',
            [owner.user],
          );
          assert.ok(!storage.rows[0].secret.includes(rawSecret));
          assert.ok(!storage.rows[0].backupCodes.includes(data.backupCodes[0]));
          const login = await post("/sign-in/email", {
            email: "parent@example.com",
            password,
          });
          assert.equal(login.json().twoFactorRedirect, true);
          const challenge = cookies(login);
          assert.equal(
            (await get("/security/summary", challenge)).statusCode,
            401,
          );
          assert.equal(
            (
              await post(
                "/two-factor/verify-backup-code",
                { code: data.backupCodes[0] },
                challenge,
              )
            ).statusCode,
            200,
          );
          const replacement = await post(
            "/two-factor/generate-backup-codes",
            { password },
            owner.cookie,
          );
          assert.equal(replacement.statusCode, 200);
          const challenge2 = cookies(
            await post("/sign-in/email", {
              email: "parent@example.com",
              password,
            }),
          );
          assert.equal(
            (
              await post(
                "/two-factor/verify-backup-code",
                { code: data.backupCodes[1] },
                challenge2,
              )
            ).statusCode,
            401,
          );
          assert.equal(
            (
              await post(
                "/two-factor/verify-backup-code",
                { code: replacement.json().backupCodes[0] },
                challenge2,
              )
            ).statusCode,
            200,
          );
          assert.equal(
            (
              await post(
                "/two-factor/view-backup-codes",
                { userId: owner.user },
                owner.cookie,
              )
            ).statusCode,
            404,
          );
          const disabled = await post(
            "/two-factor/disable",
            { password },
            owner.cookie,
          );
          assert.equal(disabled.statusCode, 200);
          owner.cookie = cookies(disabled) || owner.cookie;
          assert.equal(
            (await get("/security/summary", owner.cookie)).json()
              .twoFactorEnabled,
            false,
          );
        },
      );
      await t.test(
        "password change forces session revocation even if caller sends false",
        async () => {
          const missing = await app!.inject({
            method: "POST",
            url: "/api/auth/change-password",
            headers: { origin, cookie: owner.cookie },
          });
          assert.equal(missing.statusCode, 400);
          const second = await post("/sign-in/email", {
            email: "parent@example.com",
            password,
          });
          const changed = await post(
            "/change-password",
            {
              currentPassword: password,
              newPassword: "An entirely new passphrase",
              revokeOtherSessions: false,
            },
            owner.cookie,
          );
          assert.equal(changed.statusCode, 200);
          assert.equal(
            (await get("/security/summary", cookies(second))).statusCode,
            401,
          );
          assert.equal(
            (await get("/security/summary", owner.cookie)).statusCode,
            401,
          );
          owner.cookie = cookies(changed);
          assert.equal(
            (await get("/security/summary", owner.cookie)).statusCode,
            200,
          );
        },
      );
      await t.test(
        "competing password rotations serialize and cannot reuse revoked authority",
        async () => {
          const parent = await signup("password-race@example.com");
          const second = cookies(
            await post("/sign-in/email", {
              email: "password-race@example.com",
              password,
            }),
          );
          const lock = await repo.pool.connect();
          await lock.query("BEGIN");
          await lock.query(
            "SELECT id FROM amp_auth_users WHERE id=$1 FOR UPDATE",
            [parent.user],
          );
          const changes = [parent.cookie, second].map((cookie, index) =>
            post(
              "/change-password",
              {
                currentPassword: password,
                newPassword: `A changed race password ${index}`,
              },
              cookie,
            ).then((response) => response),
          );
          try {
            let blocked = 0;
            for (let attempt = 0; attempt < 100; attempt++) {
              const result = await admin.query(
                `SELECT count(*)::int AS count FROM pg_stat_activity
              WHERE application_name=$1 AND wait_event_type='Lock'`,
                [schema],
              );
              blocked = result.rows[0].count;
              if (blocked >= 2) break;
              await delay(10);
            }
            assert.equal(blocked, 2, "both requests reached the parent lock");
          } finally {
            await lock.query("COMMIT");
            lock.release();
          }
          const results = await Promise.all(changes);
          assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 403]);
          const loser = results.find((r) => r.statusCode === 403)!;
          assert.equal(loser.json().code, "SESSION_NOT_FRESH");
          const winner = results.findIndex((r) => r.statusCode === 200);
          assert.equal(
            (
              await post("/sign-in/email", {
                email: "password-race@example.com",
                password: `A changed race password ${winner}`,
              })
            ).statusCode,
            200,
          );
          assert.equal(
            (
              await repo.pool.query(
                'SELECT count(*)::int AS count FROM amp_auth_sessions WHERE "userId"=$1',
                [parent.user],
              )
            ).rows[0].count,
            2,
          );
        },
      );
      async function addProvider(userId: string, provider: string) {
        const id = randomUUID();
        await repo.pool.query(
          'INSERT INTO amp_auth_accounts (id,"accountId","providerId","userId","createdAt","updatedAt") VALUES ($1,$1,$2,$3,now(),now())',
          [id, provider, userId],
        );
        return id;
      }
      async function addPasskey(userId: string) {
        const id = randomUUID();
        await repo.pool.query(
          'INSERT INTO amp_auth_passkeys (id,name,"publicKey","userId","credentialID",counter,"deviceType","backedUp","createdAt") VALUES ($1,\'Test key\',\'test-public-key\',$2,$1,0,\'singleDevice\',false,now())',
          [id, userId],
        );
        return id;
      }
      await t.test(
        "ownership, CSRF, direct-route bypass, disabled provider and cross-method race",
        async () => {
          const accountId = await addProvider(owner.user, "google"),
            keyId = await addPasskey(owner.user);
          assert.equal(
            (
              await post(
                "/security/unlink-account",
                { id: accountId },
                other.cookie,
              )
            ).statusCode,
            404,
          );
          assert.equal(
            (
              await post(
                "/security/delete-passkey",
                { id: keyId },
                other.cookie,
              )
            ).statusCode,
            404,
          );
          assert.equal(
            (
              await post(
                "/passkey/update-passkey",
                { id: keyId, name: "Stolen" },
                other.cookie,
              )
            ).statusCode,
            401,
          );
          assert.equal(
            (
              await post(
                "/security/delete-passkey",
                { id: keyId },
                owner.cookie,
                { origin: "https://evil.example" },
              )
            ).statusCode,
            403,
          );
          assert.equal(
            (await post("/unlink-account", { accountId }, owner.cookie))
              .statusCode,
            403,
          );
          assert.equal(
            (await post("/passkey/delete-passkey", { id: keyId }, owner.cookie))
              .statusCode,
            403,
          );
          assert.notEqual(
            (await post("/delete-user", {}, owner.cookie)).statusCode,
            200,
          );
          const secondSession = await post("/sign-in/email", {
            email: "parent@example.com",
            password: "An entirely new passphrase",
          });
          const credential = await repo.pool.query(
            'SELECT id FROM amp_auth_accounts WHERE "userId"=$1 AND "providerId"=\'credential\'',
            [owner.user],
          );
          assert.equal(
            (
              await post(
                "/security/unlink-account",
                { id: credential.rows[0].id },
                owner.cookie,
              )
            ).statusCode,
            404,
          );
          const pendingLink = await post(
            "/link-social",
            { provider: "google", callbackURL: "/" },
            cookies(secondSession),
          );
          assert.equal(pendingLink.statusCode, 200);
          const pendingState = new URL(pendingLink.json().url).searchParams.get(
            "state",
          )!;
          const bearerToken = secondSession.headers["set-auth-token"] as string;
          assert.equal(
            (
              await get("/passkey/generate-register-options", "", {
                authorization: `Bearer ${bearerToken}`,
              })
            ).statusCode,
            200,
          );
          assert.equal(
            (
              await post(
                "/passkey/verify-registration",
                { response: {}, name: "x".repeat(81) },
                owner.cookie,
              )
            ).json().message,
            "Use a name of at most 80 characters.",
          );
          assert.equal(
            (
              await post(
                "/security/delete-passkey",
                { id: keyId },
                owner.cookie,
                { origin: "https://evil.example" },
              )
            ).json().code,
            "INVALID_ORIGIN",
          );
          await repo.pool.query(
            'DELETE FROM amp_auth_accounts WHERE "userId"=$1 AND "providerId"=\'credential\'',
            [owner.user],
          );
          await addProvider(owner.user, "github");
          // Hold both deletion tables: with the parent lock one request waits
          // behind the other; without it both count before either can delete.
          await admin.query("BEGIN");
          await admin.query(
            `LOCK TABLE ${schema}.amp_auth_accounts, ${schema}.amp_auth_passkeys IN SHARE MODE`,
          );
          const pending = Promise.all([
            post("/security/unlink-account", { id: accountId }, owner.cookie),
            post("/security/delete-passkey", { id: keyId }, owner.cookie),
          ]);
          try {
            let waiting = 0;
            for (let attempt = 0; attempt < 100 && waiting < 2; attempt++) {
              await admin.query("SELECT pg_stat_clear_snapshot()");
              waiting = Number(
                (
                  await admin.query(
                    "SELECT count(*) FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'",
                    [schema],
                  )
                ).rows[0].count,
              );
              if (waiting < 2) await delay(20);
            }
            assert.equal(
              waiting,
              2,
              "both removal requests must reach the database barrier",
            );
          } finally {
            await admin.query("COMMIT");
          }
          const race = await pending;
          assert.equal(
            (await get("/security/summary", cookies(secondSession))).statusCode,
            401,
            "removal revokes other sessions",
          );
          assert.equal(
            (await get("/security/summary", owner.cookie)).statusCode,
            200,
            "current session survives removal",
          );
          assert.deepEqual(race.map((r) => r.statusCode).sort(), [200, 400]);
          const realFetch = globalThis.fetch,
            errorLog = console.error;
          let externalRequests = 0;
          globalThis.fetch = async () => {
            externalRequests++;
            throw new Error("Unexpected external request");
          };
          console.error = () => {};
          try {
            const callback = await app!.inject({
              method: "GET",
              url: `/api/auth/callback/google?code=test-code&state=${encodeURIComponent(pendingState)}`,
              headers: {
                cookie: `${cookies(secondSession)}; ${cookies(pendingLink)}`,
              },
            });
            assert.equal(callback.statusCode, 302);
            assert.equal(
              new URL(
                String(callback.headers.location),
                origin,
              ).searchParams.get("error"),
              "state_mismatch",
            );
            assert.equal(
              externalRequests,
              0,
              "revoked link fails before provider token exchange",
            );
          } finally {
            globalThis.fetch = realFetch;
            console.error = errorLog;
          }
          const last =
            race[0].statusCode === 200
              ? { path: "/security/delete-passkey", id: keyId }
              : { path: "/security/unlink-account", id: accountId };
          assert.equal(
            (await post(last.path, { id: last.id }, owner.cookie)).json().code,
            "LAST_SIGN_IN_METHOD",
          );
          const summary = (await get("/security/summary", owner.cookie)).json();
          assert.equal(
            summary.accounts.find(
              (a: { provider: string }) => a.provider === "github",
            ).available,
            false,
          );
          assert.ok(!JSON.stringify(summary).includes("test-public-key"));
        },
      );
      await t.test(
        "freshness enforced on every security mutation and linking",
        async () => {
          await repo.pool.query(
            'UPDATE amp_auth_sessions SET "createdAt"=now()-interval \'6 minutes\' WHERE "userId"=$1',
            [owner.user],
          );
          for (const [path, payload] of [
            ["/security/delete-passkey", { id: "absent" }],
            ["/security/unlink-account", { id: "absent" }],
            ["/passkey/update-passkey", { id: "absent", name: "new" }],
            ["/two-factor/enable", { password }],
            ["/two-factor/disable", { password }],
            ["/two-factor/generate-backup-codes", { password }],
            ["/two-factor/get-totp-uri", { password }],
            ["/passkey/verify-registration", { response: {} }],
            [
              "/change-password",
              { currentPassword: password, newPassword: password },
            ],
            ["/link-social", { provider: "google", callbackURL: "/" }],
          ] as const) {
            const result = await post(path, payload, owner.cookie);
            assert.equal(result.statusCode, 403, path);
            assert.equal(result.json().code, "SESSION_NOT_FRESH", path);
          }
          assert.equal(
            (await get("/passkey/generate-register-options", owner.cookie))
              .statusCode,
            403,
          );
          assert.equal(
            (await get("/security/summary", owner.cookie)).statusCode,
            200,
          );
        },
      );
      await t.test(
        "social-only password setup uses an emailed single-use link",
        async () => {
          await addProvider(other.user, "google");
          await repo.pool.query(
            'DELETE FROM amp_auth_accounts WHERE "userId"=$1 AND "providerId"=\'credential\'',
            [other.user],
          );
          assert.equal(
            (
              await post(
                "/request-password-reset",
                { email: "other@example.com", redirectTo: "/?reset-password" },
                other.cookie,
              )
            ).statusCode,
            200,
          );
          const link = mail
            .join("\n")
            .match(
              /http:\/\/127\.0\.0\.1:4310\/api\/auth\/reset-password\/\S+/,
            )?.[0];
          assert.ok(link);
          const next = await app!.inject({
            method: "GET",
            url: new URL(link).pathname + new URL(link).search,
          });
          const token = new URL(
            next.headers.location as string,
            origin,
          ).searchParams.get("token");
          assert.equal(
            (await post("/reset-password", { token, newPassword: password }))
              .statusCode,
            200,
          );
          assert.notEqual(
            (await post("/reset-password", { token, newPassword: password }))
              .statusCode,
            200,
          );
          assert.equal(
            (
              await post("/sign-in/email", {
                email: "other@example.com",
                password,
              })
            ).statusCode,
            200,
          );
        },
      );
      await t.test(
        "configured provider linking issues OAuth authorization; unconfigured provider fails",
        async () => {
          const login = await post("/sign-in/email", {
            email: "other@example.com",
            password,
          });
          const result = await post(
            "/link-social",
            { provider: "google", callbackURL: "/" },
            cookies(login),
          );
          assert.equal(result.statusCode, 200);
          assert.equal(
            new URL(result.json().url).hostname,
            "accounts.google.com",
          );
          const state = new URL(result.json().url).searchParams.get("state");
          assert.ok(state);
          const pair = await generateKeyPair("RS256");
          const jwk = {
            ...(await exportJWK(pair.publicKey)),
            kid: "test-signing-key",
            alg: "RS256",
            use: "sig",
          };
          const idToken = await new SignJWT({
            email: "linked@example.com",
            email_verified: true,
            name: "Linked Parent",
          })
            .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
            .setIssuer("https://accounts.google.com")
            .setAudience("test-client")
            .setSubject("test-linked-identity")
            .setIssuedAt()
            .setExpirationTime("5m")
            .sign(pair.privateKey);
          const realFetch = globalThis.fetch;
          globalThis.fetch = async (input, init) => {
            const address = String(
              input instanceof Request ? input.url : input,
            );
            if (address === "https://oauth2.googleapis.com/token")
              return Response.json({
                access_token: "synthetic-test-token",
                token_type: "Bearer",
                expires_in: 3600,
                id_token: idToken,
              });
            if (address === "https://www.googleapis.com/oauth2/v3/certs")
              return Response.json({ keys: [jwk] });
            return realFetch(input, init);
          };
          try {
            const callback = await app!.inject({
              method: "GET",
              url: `/api/auth/callback/google?code=test-authorization-code&state=${encodeURIComponent(state!)}`,
              headers: { cookie: `${cookies(login)}; ${cookies(result)}` },
            });
            assert.equal(callback.statusCode, 302);
            assert.ok(
              !String(callback.headers.location).includes("error="),
              "provider callback completes",
            );
            const linked = (
              await get("/security/summary", cookies(login))
            ).json().accounts;
            const row = await repo.pool.query(
              'SELECT id, "ampLinkSessionId" FROM amp_auth_accounts WHERE "userId"=$1 AND "accountId"=$2',
              [other.user, "test-linked-identity"],
            );
            assert.equal(row.rowCount, 1);
            assert.ok(
              row.rows[0].ampLinkSessionId === null,
              "transient authority cleared before storage",
            );
            assert.ok(!JSON.stringify(linked).includes("ampLinkSessionId"));
            assert.ok(
              linked.some((a: { id: string }) => a.id === row.rows[0].id),
            );
            assert.equal(
              (
                await post(
                  "/security/unlink-account",
                  { id: row.rows[0].id },
                  cookies(login),
                )
              ).statusCode,
              200,
            );
            // A callback may consume its state before a token exchange pauses.
            // Revocation must also guard the later account INSERT.
            const initiating = cookies(
              await post("/sign-in/email", {
                email: "other@example.com",
                password,
              }),
            );
            const pending = await post(
              "/link-social",
              {
                provider: "google",
                callbackURL: "/",
                additionalData: {
                  ampLinkSessionId: "client-cannot-bind-authority",
                },
              },
              initiating,
            );
            const pendingState = new URL(pending.json().url).searchParams.get(
              "state",
            )!;
            let releaseExchange!: () => void;
            let exchangeEntered!: () => void;
            const exchange = new Promise<void>((resolve) => {
              exchangeEntered = resolve;
            });
            const release = new Promise<void>((resolve) => {
              releaseExchange = resolve;
            });
            const normalFetch = globalThis.fetch;
            globalThis.fetch = async (input, init) => {
              const address = String(
                input instanceof Request ? input.url : input,
              );
              if (address === "https://oauth2.googleapis.com/token") {
                exchangeEntered();
                await release;
              }
              return normalFetch(input, init);
            };
            const logError = console.error;
            console.error = () => {}; // Expected rejection must not print OAuth state.
            const paused = app!
              .inject({
                method: "GET",
                url: `/api/auth/callback/google?code=test-code&state=${encodeURIComponent(pendingState)}`,
                headers: { cookie: `${initiating}; ${cookies(pending)}` },
              })
              .then((response) => response);
            try {
              await Promise.race([
                exchange,
                delay(3000).then(() => {
                  throw new Error("token barrier not reached");
                }),
              ]);
              const unconsumed = await repo.pool.query(
                `SELECT id FROM amp_auth_verifications WHERE identifier=$1`,
                [`auth-state:${pendingState}`],
              );
              assert.equal(
                unconsumed.rowCount,
                0,
                "state consumed before exchange",
              );
              const caregiver = cookies(
                await post("/sign-in/email", {
                  email: "other@example.com",
                  password,
                }),
              );
              const removable = await repo.pool.query(
                `SELECT id FROM amp_auth_accounts WHERE "userId"=$1 AND "providerId"='google'`,
                [other.user],
              );
              assert.ok(removable.rowCount);
              assert.equal(
                (
                  await post(
                    "/security/unlink-account",
                    { id: removable.rows[0].id },
                    caregiver,
                  )
                ).statusCode,
                200,
              );
              releaseExchange();
              const rejected = await paused;
              assert.ok(
                rejected.statusCode >= 400 ||
                  String(rejected.headers.location).includes("error="),
              );
              assert.equal(
                (
                  await repo.pool.query(
                    'SELECT id FROM amp_auth_accounts WHERE "userId"=$1 AND "accountId"=$2',
                    [other.user, "test-linked-identity"],
                  )
                ).rowCount,
                0,
                "revoked callback cannot link a method",
              );
            } finally {
              releaseExchange();
              await paused;
              console.error = logError;
            }
          } finally {
            globalThis.fetch = realFetch;
          }
          assert.notEqual(
            (
              await post(
                "/link-social",
                { provider: "apple", callbackURL: "/" },
                cookies(login),
              )
            ).statusCode,
            200,
          );
        },
      );
      await t.test(
        "production requires a verified email before a password counts as a fallback",
        async () => {
          const fixture = await signup("unverified@example.com");
          const key = await addPasskey(fixture.user);
          const production = await createAccounts(repo.pool, {
            baseURL: origin,
            secret: "s".repeat(40),
            production: true,
            passwords: true,
            trustedOrigins: [],
          });
          const remove = () =>
            production.auth.handler(
              new Request(origin + "/api/auth/security/delete-passkey", {
                method: "POST",
                headers: {
                  origin,
                  cookie: fixture.cookie,
                  "content-type": "application/json",
                },
                body: JSON.stringify({ id: key }),
              }),
            );
          assert.equal((await remove()).status, 400);
          await repo.pool.query(
            'UPDATE amp_auth_users SET "emailVerified"=true WHERE id=$1',
            [fixture.user],
          );
          assert.equal((await remove()).status, 200);
        },
      );
    } finally {
      console.info = info;
      await app?.close();
      await repo.close();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
