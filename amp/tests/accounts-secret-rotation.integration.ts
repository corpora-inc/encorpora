import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
import { symmetricEncrypt } from "better-auth/crypto";
import { migrate } from "../scripts/migrate.js";
import { buildApp } from "../src/server/app.js";
import { PostgresRepository } from "../src/server/repository.js";
import {
  accountsAuth,
  createAccounts,
  registerAccountRoutes,
  type AccountsConfig,
} from "../src/server/accounts.js";

const origin = "http://127.0.0.1:4310";
const password = "A long test passphrase";

test(
  "AMP_ACCOUNTS_SECRET rotates: a new version signs, an enrolled authenticator still works",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_rotation_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const info = console.info;
    console.info = () => {};
    const repository = new PostgresRepository(scoped.href, {
      development: true,
    });
    const db = repository.pool;
    const apps: ReturnType<typeof buildApp>[] = [];
    try {
      await migrate(scoped.href);
      const first = randomBytes(32).toString("hex");
      const second = randomBytes(32).toString("hex");
      /** An API process with this configuration of secrets. */
      async function server(
        secrets: Pick<
          AccountsConfig,
          "secret" | "secretVersion" | "previousSecrets"
        >,
      ) {
        const accounts = await createAccounts(db, {
          baseURL: origin,
          production: false,
          passwords: true,
          trustedOrigins: [],
          ...secrets,
        });
        const app = buildApp({
          repository,
          authenticate: accountsAuth(accounts),
          development: true,
        });
        await registerAccountRoutes(app, accounts);
        apps.push(app);
        let address = 1;
        const post = (path: string, payload: object, cookie = "") =>
          app.inject({
            method: "POST",
            url: `/api/auth${path}`,
            payload,
            remoteAddress: `203.0.113.${address++}`,
            headers: { origin, cookie },
          });
        const session = async (cookie: string) =>
          (
            await app.inject({
              method: "GET",
              url: "/api/auth/get-session",
              headers: { cookie },
            })
          ).json();
        return { post, session };
      }
      const cookies = (response: { headers: Record<string, unknown> }) =>
        ([] as string[])
          .concat((response.headers["set-cookie"] as string[]) ?? [])
          .map((c) => c.split(";")[0])
          .join("; ");
      type Server = Awaited<ReturnType<typeof server>>;
      /** Sign up and turn on an authenticator; returns its raw secret. */
      async function enroll(api: Server, email: string) {
        const signUp = await api.post("/sign-up/email", {
          email,
          password,
          name: "Fixture Parent",
        });
        assert.equal(signUp.statusCode, 200, signUp.body);
        let cookie = cookies(signUp);
        const enabled = await api.post(
          "/two-factor/enable",
          { password },
          cookie,
        );
        assert.equal(enabled.statusCode, 200, enabled.body);
        const raw = new TextDecoder().decode(
          base32.decode(
            new URL(enabled.json().totpURI).searchParams.get("secret")!,
          ),
        );
        const verified = await api.post(
          "/two-factor/verify-totp",
          { code: await createOTP(raw).totp() },
          cookie,
        );
        assert.equal(verified.statusCode, 200, verified.body);
        cookie = cookies(verified) || cookie;
        return { raw, cookie, user: signUp.json().user.id as string };
      }
      /** Password, then the authenticator's code: 200 when it decrypts. */
      async function signInWithCode(api: Server, email: string, raw: string) {
        const signIn = await api.post("/sign-in/email", { email, password });
        assert.equal(signIn.json().twoFactorRedirect, true, signIn.body);
        const code = await api.post(
          "/two-factor/verify-totp",
          { code: await createOTP(raw).totp() },
          cookies(signIn),
        );
        return { status: code.statusCode, cookie: cookies(code) };
      }
      const stored = async (user: string) =>
        (
          await db.query(
            'SELECT secret, "backupCodes" FROM amp_auth_two_factors WHERE "userId"=$1',
            [user],
          )
        ).rows[0] as { secret: string; backupCodes: string };

      // Today's deployment: one secret, version 1 by default.
      const before = await server({ secret: first });
      const enrolled = await enroll(before, "enrolled@example.com");
      assert.match((await stored(enrolled.user)).secret, /^\$ba\$1\$/);
      // An authenticator enrolled before versioning: the same secret, stored
      // without a version tag, as AMP wrote it until this release.
      const legacy = await enroll(before, "legacy@example.com");
      await db.query(
        'UPDATE amp_auth_two_factors SET secret=$1 WHERE "userId"=$2',
        [await symmetricEncrypt({ key: first, data: legacy.raw }), legacy.user],
      );
      assert.doesNotMatch((await stored(legacy.user)).secret, /^\$ba\$/);
      assert.equal(
        (await signInWithCode(before, "legacy@example.com", legacy.raw)).status,
        200,
      );

      // The rotation: version 2 is current; version 1 only decrypts.
      const after = await server({
        secret: second,
        secretVersion: 2,
        previousSecrets: [{ version: 1, value: first }],
      });

      await t.test(
        "cookies signed with the old secret sign in no one",
        async () => {
          assert.ok((await before.session(enrolled.cookie))?.session);
          assert.equal(await after.session(enrolled.cookie), null);
        },
      );

      await t.test(
        "authenticators enrolled under version 1, tagged or not, still work",
        async () => {
          for (const [email, raw] of [
            ["enrolled@example.com", enrolled.raw],
            ["legacy@example.com", legacy.raw],
          ] as const) {
            const signedIn = await signInWithCode(after, email, raw);
            assert.equal(signedIn.status, 200, email);
            assert.ok((await after.session(signedIn.cookie))?.session, email);
          }
        },
      );

      await t.test(
        "new authenticators are encrypted with version 2",
        async () => {
          const fresh = await enroll(after, "fresh@example.com");
          const row = await stored(fresh.user);
          assert.match(row.secret, /^\$ba\$2\$/);
          assert.match(row.backupCodes, /^\$ba\$2\$/);
        },
      );

      await t.test(
        "without the previous version listed, they cannot be read",
        async () => {
          const forgotten = await server({ secret: second, secretVersion: 2 });
          assert.notEqual(
            (
              await signInWithCode(
                forgotten,
                "enrolled@example.com",
                enrolled.raw,
              )
            ).status,
            200,
          );
        },
      );
    } finally {
      console.info = info;
      for (const app of apps) await app.close();
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
