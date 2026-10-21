import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { buildApp } from "../src/server/app.js";
import { PostgresRepository } from "../src/server/repository.js";
import {
  accountsAuth,
  createAccounts,
  registerAccountRoutes,
} from "../src/server/accounts.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { meSchema } from "../src/account/contracts.js";
import { parentAddressConfirmed } from "../src/server/account-access.js";
import { softwareAuthenticator } from "./webauthn-fixture.js";

test(
  "passkey sign-up: atomic account + credential + session, no account without a credential, no takeover, confirmation unlocks consent",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `passkey_signup_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const repository = new PostgresRepository(scoped.href, {
      development: false,
    });
    const origin = "http://localhost:4310";
    const mail: string[] = [];
    const info = console.info;
    console.info = (...args: unknown[]) => mail.push(args.join(" "));
    await admin.query(`CREATE SCHEMA ${schema}`);
    let app: ReturnType<typeof buildApp> | undefined;
    try {
      await migrate(scoped.href);
      const accounts = await createAccounts(repository.pool, {
        baseURL: origin,
        secret: "p".repeat(40),
        production: false,
        passwords: true,
        trustedOrigins: [],
      });
      const authenticate = accountsAuth(accounts);
      app = buildApp({ repository, authenticate, development: false });
      await registerAccountRoutes(app, accounts);
      await registerFamilyRoutes(app, {
        pool: repository.pool,
        authenticate,
        development: false,
      });
      let address = 1;
      const post = (path: string, payload: object, cookie = "", extra = {}) =>
        app!.inject({
          method: "POST",
          url: `/api/auth${path}`,
          payload,
          remoteAddress: `198.51.100.${address++}`,
          headers: { origin, cookie, ...extra },
        });
      const cookies = (response: { headers: Record<string, unknown> }) =>
        ([] as string[])
          .concat((response.headers["set-cookie"] as string[]) ?? [])
          .map((c) => c.split(";")[0])
          .filter((c) => !c.endsWith("="))
          .join("; ");
      const users = async (email: string) =>
        (
          await repository.pool.query(
            'SELECT id,"emailVerified" FROM amp_auth_users WHERE email=$1',
            [email],
          )
        ).rows as { id: string; emailVerified: boolean }[];
      const count = async (table: string) =>
        (await repository.pool.query(`SELECT count(*)::int AS n FROM ${table}`))
          .rows[0].n as number;
      const me = async (cookie: string) =>
        meSchema.parse(
          (
            await app!.inject({
              method: "GET",
              url: "/api/v1/me",
              headers: { cookie },
            })
          ).json(),
        );
      async function begin(email: string) {
        const options = await post("/passkey-signup/options", { email });
        return { options, cookie: cookies(options) };
      }

      await t.test(
        "creates the parent, passkey and session together, unconfirmed, and sends the confirmation link",
        async () => {
          const device = softwareAuthenticator("localhost", origin);
          const { options, cookie } = await begin("New.Parent@Example.com");
          assert.equal(options.statusCode, 200, options.body);
          const body = options.json();
          assert.equal(body.rp.id, "localhost");
          assert.equal(body.user.name, "new.parent@example.com");
          assert.equal(body.authenticatorSelection.residentKey, "required");
          assert.deepEqual(
            await users("new.parent@example.com"),
            [],
            "nothing exists before the passkey is verified",
          );
          const verified = await post(
            "/passkey-signup/verify",
            { response: device.register(body) },
            cookie,
          );
          assert.equal(verified.statusCode, 200, verified.body);
          assert.ok(
            verified.headers["set-auth-token"],
            "bearer clients get the session token",
          );
          const [parent] = await users("new.parent@example.com");
          assert.equal(parent!.emailVerified, false);
          const passkeys = await repository.pool.query(
            'SELECT "credentialID" FROM amp_auth_passkeys WHERE "userId"=$1',
            [parent!.id],
          );
          assert.deepEqual(
            passkeys.rows.map((r) => r.credentialID),
            [device.id],
          );
          const session = cookies(verified);
          const state = await me(session);
          assert.ok(state.signedIn);
          assert.equal(state.account.confirmationRequired, true);
          assert.equal(state.next, "try", "the trial does not wait for email");
          // The confirmation link was sent immediately.
          const link = mail
            .join("\n")
            .match(
              /http:\/\/localhost:4310\/api\/auth\/verify-email\?\S+/,
            )?.[0];
          assert.ok(link, "a confirmation link was sent");
          // Consent and purchase stay closed until the address is confirmed.
          const client = await repository.pool.connect();
          try {
            assert.equal(
              await parentAddressConfirmed(client, `amp|${parent!.id}`),
              false,
            );
          } finally {
            client.release();
          }
          // Replaying the finished ceremony creates nothing.
          const replay = await post(
            "/passkey-signup/verify",
            { response: device.register(body) },
            cookie,
          );
          assert.equal(replay.statusCode, 400);
          assert.equal(replay.json().code, "PASSKEY_SIGNUP_EXPIRED");
          // Opening the link confirms the address; consent can begin.
          const confirm = await app!.inject({
            method: "GET",
            url: new URL(link!).pathname + new URL(link!).search,
          });
          assert.ok(confirm.statusCode < 400, confirm.body);
          const confirmed = await me(session);
          assert.ok(confirmed.signedIn);
          assert.equal(confirmed.account.emailVerified, true);
          assert.equal(confirmed.account.confirmationRequired, false);
          // Sign out, then sign in with the same passkey and no email.
          await post("/sign-out", {}, session);
          const challenge = await app!.inject({
            method: "GET",
            url: "/api/auth/passkey/generate-authenticate-options",
          });
          const signIn = await post(
            "/passkey/verify-authentication",
            { response: device.assert(challenge.json()) },
            cookies(challenge),
          );
          assert.equal(signIn.statusCode, 200, signIn.body);
          const back = await me(cookies(signIn));
          assert.ok(back.signedIn);
          assert.equal(back.account.id, `amp|${parent!.id}`);
        },
      );

      await t.test(
        "an abandoned, failed or foreign ceremony leaves no account",
        async () => {
          const before = await count("amp_auth_users");
          // Abandoned: options only.
          assert.equal(
            (await begin("abandoned@example.com")).options.statusCode,
            200,
          );
          // Wrong challenge.
          const device = softwareAuthenticator("localhost", origin);
          const wrong = await begin("wrong@example.com");
          const bad = await post(
            "/passkey-signup/verify",
            {
              response: device.register(wrong.options.json(), {
                challenge: "bm90LXRoZS1jaGFsbGVuZ2U",
              }),
            },
            wrong.cookie,
          );
          assert.equal(bad.statusCode, 400);
          assert.equal(bad.json().code, "PASSKEY_NOT_VERIFIED");
          // A credential made for another site.
          const phished = await begin("phished@example.com");
          const foreign = await post(
            "/passkey-signup/verify",
            {
              response: device.register(phished.options.json(), {
                origin: "https://evil.example",
              }),
            },
            phished.cookie,
          );
          assert.equal(foreign.statusCode, 400);
          // No challenge cookie: nothing to complete.
          const none = await post("/passkey-signup/verify", {
            response: device.register(phished.options.json()),
          });
          assert.equal(none.statusCode, 400);
          // A cross-site request is refused before any work.
          const csrf = await begin("csrf@example.com");
          const crossSite = await post(
            "/passkey-signup/verify",
            { response: device.register(csrf.options.json()) },
            csrf.cookie,
            { origin: "https://evil.example" },
          );
          assert.equal(crossSite.statusCode, 403);
          assert.equal(await count("amp_auth_users"), before);
          assert.equal(
            (
              await repository.pool.query(
                `SELECT count(*)::int n FROM amp_auth_users u WHERE NOT EXISTS (SELECT 1 FROM amp_auth_passkeys p WHERE p."userId"=u.id) AND NOT EXISTS (SELECT 1 FROM amp_auth_accounts a WHERE a."userId"=u.id)`,
              )
            ).rows[0].n,
            0,
            "every parent has a sign-in method",
          );
        },
      );

      await t.test(
        "an existing email is never taken over, before or during the ceremony",
        async () => {
          const owner = await post("/sign-up/email", {
            email: "owner@example.com",
            password: "the owner's passphrase",
            name: "",
          });
          assert.equal(owner.statusCode, 200);
          const [existing] = await users("owner@example.com");
          const refused = await begin("OWNER@example.com");
          assert.equal(refused.options.statusCode, 409);
          assert.equal(refused.options.json().code, "ACCOUNT_EXISTS");
          assert.equal(refused.cookie, "", "no ceremony starts");
          // The email is taken while the ceremony is open.
          const device = softwareAuthenticator("localhost", origin);
          const racing = await begin("late@example.com");
          assert.equal(racing.options.statusCode, 200);
          await post("/sign-up/email", {
            email: "late@example.com",
            password: "the first passphrase",
            name: "",
          });
          const late = await post(
            "/passkey-signup/verify",
            { response: device.register(racing.options.json()) },
            racing.cookie,
          );
          assert.equal(late.statusCode, 409);
          assert.equal(late.json().code, "ACCOUNT_EXISTS");
          assert.equal(cookies(late).includes("session_token"), false);
          const [lateParent] = await users("late@example.com");
          for (const id of [existing!.id, lateParent!.id])
            assert.equal(
              (
                await repository.pool.query(
                  'SELECT count(*)::int n FROM amp_auth_passkeys WHERE "userId"=$1',
                  [id],
                )
              ).rows[0].n,
              0,
              "the attacker's passkey was not attached",
            );
          // Two ceremonies for one new email: exactly one account.
          const a = softwareAuthenticator("localhost", origin),
            b = softwareAuthenticator("localhost", origin);
          const [first, second] = await Promise.all([
            begin("twice@example.com"),
            begin("twice@example.com"),
          ]);
          const results = await Promise.all([
            post(
              "/passkey-signup/verify",
              { response: a.register(first.options.json()) },
              first.cookie,
            ),
            post(
              "/passkey-signup/verify",
              { response: b.register(second.options.json()) },
              second.cookie,
            ),
          ]);
          assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
          assert.equal((await users("twice@example.com")).length, 1);
        },
      );

      await t.test(
        "recovering an unconfirmed address by password reset removes earlier passkeys and sessions",
        async () => {
          // Someone else created an account under the victim's address.
          const device = softwareAuthenticator("localhost", origin);
          const squat = await begin("victim@example.com");
          const created = await post(
            "/passkey-signup/verify",
            { response: device.register(squat.options.json()) },
            squat.cookie,
          );
          assert.equal(created.statusCode, 200);
          const [victim] = await users("victim@example.com");
          await post("/request-password-reset", {
            email: "victim@example.com",
            redirectTo: "/?reset-password",
          });
          const token = mail
            .join("\n")
            .match(/reset-password\/([^?\s]+)/g)
            ?.at(-1)
            ?.split("/")
            .at(-1);
          assert.ok(token, "a reset link was sent");
          const reset = await post("/reset-password", {
            token,
            newPassword: "the real owner's passphrase",
          });
          assert.equal(reset.statusCode, 200, reset.body);
          const after = await repository.pool.query(
            `SELECT (SELECT count(*)::int FROM amp_auth_passkeys WHERE "userId"=$1) AS passkeys,
              (SELECT count(*)::int FROM amp_auth_sessions WHERE "userId"=$1) AS sessions,
              (SELECT "emailVerified" FROM amp_auth_users WHERE id=$1) AS confirmed`,
            [victim!.id],
          );
          assert.deepEqual(after.rows[0], {
            passkeys: 0,
            sessions: 0,
            confirmed: true,
          });
          assert.equal(
            (
              await app!.inject({
                method: "GET",
                url: "/api/v1/me",
                headers: { cookie: cookies(created) },
              })
            ).json().signedIn,
            false,
            "the squatter's session ended",
          );
          // The squatter's passkey no longer signs in.
          const challenge = await app!.inject({
            method: "GET",
            url: "/api/auth/passkey/generate-authenticate-options",
          });
          const signIn = await post(
            "/passkey/verify-authentication",
            { response: device.assert(challenge.json()) },
            cookies(challenge),
          );
          assert.notEqual(signIn.statusCode, 200);
        },
      );
    } finally {
      console.info = info;
      await app?.close();
      await repository.pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
