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
import { PASSKEY_SIGNUP_SECONDS } from "../src/server/passkey-signup.js";

/** Production settings (confirmation required), with the mail provider's
 * endpoint answered in this process. A person who already has an account and
 * types its email into "Create account" or "Forgot password?" is told, by
 * email, how that account actually signs in; the sign-in screen can ask the
 * same question at the passkey sign-up check's rate. */
test(
  "existing accounts: duplicate sign-up mails the owner its real sign-in methods, reset mail is honest without a password, the method lookup is rate-limited",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `existing_signin_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const repository = new PostgresRepository(scoped.href, {
      development: false,
    });
    const origin = "https://amp.example.test";
    const sent: { to: string; subject: string; text: string }[] = [];
    let mailFails = false;
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const address = String(input instanceof Request ? input.url : input);
      if (address.startsWith("https://api.resend.com/")) {
        if (mailFails)
          return Response.json(
            { name: "application_error", message: "provider down" },
            { status: 500 },
          );
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
    const logged: string[] = [];
    const error = console.error;
    console.error = (...args: unknown[]) => logged.push(args.join(" "));
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
        google: { clientId: "google-client", clientSecret: "google-secret" },
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
      const parent = async (
        email: string,
        methods: ("google" | "password" | "passkey")[],
      ) => {
        const id = randomUUID();
        await repository.pool.query(
          `INSERT INTO amp_auth_users (id,name,email,"emailVerified") VALUES ($1,'',$2,true)`,
          [id, email],
        );
        for (const method of methods)
          if (method === "passkey")
            await repository.pool.query(
              `INSERT INTO amp_auth_passkeys (id,"publicKey","userId","credentialID",counter,"deviceType","backedUp")
               VALUES ($1,'key',$2,$1,0,'singleDevice',false)`,
              [randomUUID(), id],
            );
          else
            await repository.pool.query(
              `INSERT INTO amp_auth_accounts (id,"accountId","providerId","userId",password,"updatedAt")
               VALUES ($1,$2,$3,$4,$5,now())`,
              [
                randomUUID(),
                method === "google" ? `google-${id}` : id,
                method === "google" ? "google" : "credential",
                id,
                method === "password" ? "salt:hash" : null,
              ],
            );
        return id;
      };
      await parent("google-only@example.com", ["google"]);
      await parent("password@example.com", ["password"]);
      await parent("both@example.com", ["passkey", "google"]);
      const signUp = (email: string, callbackURL = "/start") =>
        post("/sign-up/email", {
          email,
          password: "a new password here",
          name: "",
          callbackURL,
        });

      await t.test(
        "Create account with a Google-only email mails the owner: it signs in with Google, with a sign-in link that keeps /access",
        async () => {
          sent.length = 0;
          const response = await signUp("google-only@example.com", "/access");
          assert.equal(response.statusCode, 200, response.body);
          assert.equal(response.json().token, null, "no session is issued");
          assert.equal(sent.length, 1, "exactly one email reaches the owner");
          const [mail] = sent;
          assert.equal(mail.to, "google-only@example.com");
          assert.equal(mail.subject, "You already have an AMP account");
          assert.match(
            mail.text,
            /^You already have an AMP account\. It signs in with Google\./,
          );
          assert.ok(
            mail.text.includes(`${origin}/sign-in?return=access`),
            mail.text,
          );
          assert.doesNotMatch(mail.text, /password/i);
        },
      );
      await t.test(
        "a password account's owner also gets the forgot-password path; several methods are all named",
        async () => {
          sent.length = 0;
          await signUp("password@example.com");
          assert.equal(sent.length, 1);
          assert.match(sent[0].text, /It signs in with a password\./);
          assert.ok(
            sent[0].text.includes(`Forgot your password?`) &&
              sent[0].text.includes(`${origin}/sign-in/forgot`),
            sent[0].text,
          );
          assert.ok(sent[0].text.includes(`${origin}/sign-in\n`));
          sent.length = 0;
          await signUp("both@example.com");
          assert.match(sent[0].text, /It signs in with Google or a passkey\./);
          assert.doesNotMatch(sent[0].text, /Forgot your password/);
        },
      );
      await t.test(
        "a new address still gets its confirmation link, not the existing-account email",
        async () => {
          sent.length = 0;
          const response = await signUp("brand-new@example.com");
          assert.equal(response.statusCode, 200, response.body);
          assert.equal(sent.length, 1);
          assert.match(sent[0].subject, /^Confirm your email/);
        },
      );
      await t.test(
        "a failed send is logged loudly and the response is the same as for a new address",
        async () => {
          sent.length = 0;
          logged.length = 0;
          mailFails = true;
          try {
            const response = await signUp("google-only@example.com");
            assert.equal(response.statusCode, 200, response.body);
            assert.equal(response.json().token, null);
          } finally {
            mailFails = false;
          }
          assert.ok(
            logged.some((line) =>
              line.includes("[accounts] existing-account email not sent"),
            ),
            logged.join("\n"),
          );
        },
      );
      await t.test(
        "Forgot password for an account without a password says how it signs in and offers the link only to add one",
        async () => {
          sent.length = 0;
          const response = await post("/request-password-reset", {
            email: "google-only@example.com",
            redirectTo: "/reset-password?return=access",
          });
          assert.equal(response.statusCode, 200, response.body);
          assert.equal(sent.length, 1);
          const [mail] = sent;
          assert.equal(mail.subject, "Sign in to AMP");
          assert.match(mail.text, /^Your account signs in with Google\./);
          assert.ok(
            mail.text.includes(`${origin}/sign-in?return=access`),
            mail.text,
          );
          assert.match(mail.text, /or add a password/i);
          assert.ok(mail.text.includes("/api/auth/reset-password/"));
          sent.length = 0;
          await post("/request-password-reset", {
            email: "password@example.com",
            redirectTo: "/reset-password",
          });
          assert.equal(sent[0].subject, "Reset your AMP password");
        },
      );
      await t.test(
        "the method lookup names each account's methods, nothing for an unknown address, at the passkey sign-up rate",
        async () => {
          const methods = async (email: string, from?: string) =>
            post("/sign-in-methods", { email }, from);
          const google = await methods(" Google-Only@Example.com ");
          assert.equal(google.statusCode, 200, google.body);
          assert.deepEqual(google.json(), { methods: ["google"] });
          assert.deepEqual((await methods("both@example.com")).json(), {
            methods: ["google", "passkey"],
          });
          assert.deepEqual((await methods("password@example.com")).json(), {
            methods: ["password"],
          });
          assert.deepEqual((await methods("nobody@example.com")).json(), {
            methods: [],
          });
          // The same limit as the passkey sign-up check: 10 per window.
          const statuses: number[] = [];
          for (let i = 0; i < 11; i++)
            statuses.push(
              (await methods("nobody@example.com", "203.0.113.9")).statusCode,
            );
          assert.deepEqual(statuses.slice(0, 10), Array(10).fill(200));
          assert.equal(statuses[10], 429);
          assert.equal(PASSKEY_SIGNUP_SECONDS, 300);
        },
      );
    } finally {
      globalThis.fetch = realFetch;
      console.error = error;
      await app?.close();
      await repository.close();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
