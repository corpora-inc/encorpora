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

/**
 * Email sign-up in production (confirmation required): the new account's
 * address is proven by a 6-digit code typed on the sign-up screen, in the
 * same browser (no link to open in the right one), and only then is there a
 * session. A code never signs in an address that is already confirmed, so it
 * is never a way around a password or a second factor, and the plugin's
 * other ways in (a code instead of a password, a code reset) are off.
 */
test(
  "sign-up code: one code email, a wrong code does nothing, the right one confirms and signs in; never for a confirmed address",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `signup_code_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const repository = new PostgresRepository(scoped.href, {
      development: false,
    });
    const origin = "https://amp.example.test";
    const sent: { to: string; subject: string; text: string }[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const address = String(input instanceof Request ? input.url : input);
      if (address.startsWith("https://api.resend.com/")) {
        const body = JSON.parse(String(init?.body));
        sent.push({
          to: [body.to].flat()[0],
          subject: body.subject,
          text: body.text,
        });
        return Response.json({ id: randomUUID() });
      }
      return realFetch(input, init);
    };
    await admin.query(`CREATE SCHEMA ${schema}`);
    let app: ReturnType<typeof buildApp> | undefined;
    try {
      await migrate(scoped.href);
      const accounts = await createAccounts(repository.pool, {
        baseURL: origin,
        secret: "e".repeat(40),
        production: true,
        passwords: true,
        mail: { apiKey: "re_test", from: "AMP <amp@example.test>" },
        trustedOrigins: [],
      });
      app = buildApp({
        repository,
        authenticate: accountsAuth(accounts),
        development: false,
      });
      await registerAccountRoutes(app, accounts);
      let address = 1;
      const post = (path: string, payload: object, from?: string) =>
        app!.inject({
          method: "POST",
          url: `/api/auth${path}`,
          payload,
          remoteAddress: from ?? `198.51.100.${address++}`,
          headers: { origin },
        });
      const codeIn = (text: string) => /\b(\d{6})\b/.exec(text)?.[1];
      const session = (response: { headers: Record<string, unknown> }) =>
        [response.headers["set-cookie"]]
          .flat()
          .some((cookie) => String(cookie).includes("session_token="));
      const password = "a new password here";
      const codes = () =>
        sent.filter((mail) => /^\d{6} is your AMP code$/.test(mail.subject));

      await t.test("sign-up mails one code and no session yet", async () => {
        const response = await post("/sign-up/email", {
          email: "new@example.com",
          password,
          name: "",
        });
        assert.equal(response.statusCode, 200, response.body);
        assert.equal(response.json().token, null);
        assert.equal(session(response), false);
        assert.equal(sent.length, 1);
        assert.equal(sent[0]!.to, "new@example.com");
        assert.match(sent[0]!.subject, /^\d{6} is your AMP code$/);
        assert.match(sent[0]!.text, /expires in 10 minutes/);
        assert.doesNotMatch(sent[0]!.text, /https?:\/\//, "no link");
      });
      const code = codeIn(sent[0]!.subject)!;

      await t.test(
        "a wrong code confirms nothing and signs no one in; a shared address isn't locked out",
        async () => {
          const wrong = code === "000000" ? "111111" : "000000";
          // Four tries from one address (a school, a carrier): each is a
          // plain refusal, never "too many requests".
          for (let i = 0; i < 4; i++) {
            const response = await post(
              "/email-otp/verify-email",
              { email: "new@example.com", otp: wrong },
              "203.0.113.7",
            );
            assert.equal(response.statusCode, 400, response.body);
            assert.equal(session(response), false);
          }
          const user = await repository.pool.query(
            `SELECT "emailVerified" FROM amp_auth_users WHERE email='new@example.com'`,
          );
          assert.equal(user.rows[0].emailVerified, false);
        },
      );

      await t.test(
        "the right code confirms the address and signs in",
        async () => {
          const response = await post("/email-otp/verify-email", {
            email: "new@example.com",
            otp: code,
          });
          assert.equal(response.statusCode, 200, response.body);
          assert.ok(response.json().token);
          assert.equal(session(response), true);
          const user = await repository.pool.query(
            `SELECT "emailVerified" FROM amp_auth_users WHERE email='new@example.com'`,
          );
          assert.equal(user.rows[0].emailVerified, true);
        },
      );

      await t.test("a code never signs in a confirmed address", async () => {
        // Even a valid code made for it directly is refused: a code is never
        // a way around a password or a second factor.
        const planted = await accounts.auth.api.createVerificationOTP({
          body: { email: "new@example.com", type: "email-verification" },
        });
        const response = await post("/email-otp/verify-email", {
          email: "new@example.com",
          otp: planted,
        });
        assert.notEqual(response.statusCode, 200, response.body);
        assert.equal(session(response), false);
      });

      await t.test(
        "a repeat sign-up of an unconfirmed address gets no code: the first registrant's account is never handed over",
        async () => {
          // Someone registers another person's address with their password.
          sent.length = 0;
          await post("/sign-up/email", {
            email: "victim@example.com",
            password: "the first registrant",
            name: "",
          });
          assert.equal(codes().length, 1, "the creator's own code");
          // The owner later signs up with the same address.
          sent.length = 0;
          const again = await post("/sign-up/email", {
            email: "victim@example.com",
            password,
            name: "",
          });
          assert.equal(again.statusCode, 200, again.body);
          assert.equal(session(again), false);
          assert.deepEqual(codes(), [], "no code on a repeat sign-up");
          // A code can't be asked for by address alone.
          const asked = await post("/email-otp/send-verification-otp", {
            email: "victim@example.com",
            type: "email-verification",
          });
          assert.equal(asked.statusCode, 404, asked.body);
          assert.deepEqual(codes(), []);
        },
      );

      await t.test(
        "an unconfirmed account signing in with its password gets a fresh code, no link; a wrong password gets nothing",
        async () => {
          await post("/sign-up/email", {
            email: "later@example.com",
            password,
            name: "",
          });
          sent.length = 0;
          const wrong = await post("/sign-in/email", {
            email: "later@example.com",
            password: "not the password at all",
          });
          assert.equal(wrong.statusCode, 401, wrong.body);
          assert.equal(sent.length, 0);
          const signIn = await post("/sign-in/email", {
            email: "later@example.com",
            password,
          });
          assert.equal(signIn.statusCode, 403, signIn.body);
          assert.equal(signIn.json().code, "EMAIL_NOT_VERIFIED");
          assert.equal(session(signIn), false);
          assert.equal(sent.length, 1);
          assert.match(sent[0]!.subject, /^\d{6} is your AMP code$/);
          assert.doesNotMatch(sent[0]!.text, /https?:\/\//, "no link");
          const fresh = await post("/email-otp/verify-email", {
            email: "later@example.com",
            otp: codeIn(sent[0]!.subject)!,
          });
          assert.equal(fresh.statusCode, 200, fresh.body);
          assert.equal(session(fresh), true);
        },
      );

      await t.test("the code plugin's other ways in are off", async () => {
        for (const path of [
          "/sign-in/email-otp",
          "/email-otp/send-verification-otp",
          "/email-otp/request-password-reset",
          "/forget-password/email-otp",
          "/email-otp/reset-password",
          "/email-otp/check-verification-otp",
        ]) {
          const response = await post(path, {
            email: "new@example.com",
            otp: code,
            password,
            type: "sign-in",
          });
          assert.equal(response.statusCode, 404, `${path}: ${response.body}`);
        }
      });
    } finally {
      globalThis.fetch = realFetch;
      await app?.close();
      await repository.close();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
