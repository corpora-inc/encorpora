import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { PostgresRepository } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";
import {
  accountsAuth,
  createAccounts,
  registerAccountRoutes,
} from "../src/server/accounts.js";

test(
  "parent accounts: sign up, use the API by bearer or cookie, sign out, reset a password",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_accounts_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const repository = new PostgresRepository(scoped.href, {
      development: true,
    });
    const emails: string[] = [];
    const info = console.info;
    console.info = (message: string) => emails.push(message);
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      const accounts = await createAccounts(repository.pool, {
        baseURL: "http://127.0.0.1:4310",
        secret: "s".repeat(40),
        production: false,
        passwords: true,
        trustedOrigins: [],
      });
      const app = buildApp({
        repository,
        authenticate: accountsAuth(accounts),
        development: true,
      });
      await registerAccountRoutes(app, accounts);
      const post = (path: string, payload: object, headers = {}) =>
        app.inject({
          method: "POST",
          url: `/api/auth${path}`,
          payload,
          headers: { origin: "http://127.0.0.1:4310", ...headers },
        });
      const learners = (headers: Record<string, string>) =>
        app.inject({ method: "GET", url: "/api/v1/learners", headers });

      const email = "parent@example.com";
      const password = "correct horse battery";
      const signUp = await post("/sign-up/email", {
        email,
        password,
        name: "Parent",
      });
      assert.equal(signUp.statusCode, 200, signUp.body);
      const token = signUp.headers["set-auth-token"] as string;
      assert.ok(token, "the session token is returned for bearer clients");
      const cookies = ([] as string[])
        .concat(signUp.headers["set-cookie"] ?? [])
        .map((c) => c.split(";")[0])
        .join("; ");
      assert.match(cookies, /amp\.session_token=/);

      // The same account through either credential; nothing without one.
      const bearer = await learners({ authorization: `Bearer ${token}` });
      assert.equal(bearer.statusCode, 200, bearer.body);
      assert.deepEqual(bearer.json().learners, []);
      assert.equal((await learners({ cookie: cookies })).statusCode, 200);
      assert.equal(
        (await learners({ authorization: "Bearer not-a-session" })).statusCode,
        401,
      );
      const created = await app.inject({
        method: "POST",
        url: "/api/v1/learners",
        headers: { authorization: `Bearer ${token}` },
        payload: { name: "Maya" },
      });
      assert.equal(created.statusCode, 201, created.body);

      // Duplicate accounts, short passwords and cross-site posts are refused.
      assert.notEqual(
        (await post("/sign-up/email", { email, password, name: "Again" }))
          .statusCode,
        200,
      );
      assert.notEqual(
        (
          await post("/sign-up/email", {
            email: "short@example.com",
            password: "short",
            name: "Short",
          })
        ).statusCode,
        200,
      );
      assert.equal(
        (
          await post(
            "/sign-in/email",
            { email, password },
            { origin: "https://evil.example" },
          )
        ).statusCode,
        403,
      );

      // Signing out ends the session; signing in again opens a new one.
      assert.equal(
        (
          await post(
            "/sign-out",
            {},
            {
              authorization: `Bearer ${token}`,
            },
          )
        ).statusCode,
        200,
      );
      assert.equal(
        (await learners({ authorization: `Bearer ${token}` })).statusCode,
        401,
      );
      const signIn = await post("/sign-in/email", { email, password });
      assert.equal(signIn.statusCode, 200, signIn.body);
      const again = signIn.headers["set-auth-token"] as string;
      const list = await learners({ authorization: `Bearer ${again}` });
      assert.deepEqual(
        list.json().learners.map((l: { name: string }) => l.name),
        ["Maya"],
      );

      // Password reset: the emailed link leads to a token for a new password.
      const reset = await post("/request-password-reset", {
        email,
        redirectTo: "/?reset-password",
      });
      assert.equal(reset.statusCode, 200, reset.body);
      const link = emails
        .join("\n")
        .match(
          /http:\/\/127\.0\.0\.1:4310\/api\/auth\/reset-password\/\S+/,
        )?.[0];
      assert.ok(link, "a reset link was sent");
      const followed = await app.inject({
        method: "GET",
        url: new URL(link!).pathname + new URL(link!).search,
      });
      assert.equal(followed.statusCode, 302);
      const resetToken = new URL(
        followed.headers.location as string,
        "http://127.0.0.1:4310",
      ).searchParams.get("token");
      assert.ok(resetToken);
      const newPassword = "another long passphrase";
      assert.equal(
        (
          await post("/reset-password", {
            newPassword,
            token: resetToken,
          })
        ).statusCode,
        200,
      );
      assert.equal(
        (await learners({ authorization: `Bearer ${again}` })).statusCode,
        401,
        "a reset ends existing sessions",
      );
      assert.notEqual(
        (await post("/sign-in/email", { email, password })).statusCode,
        200,
      );
      // Repeated sign-in attempts from one client are throttled (brute
      // force); another client is unaffected and the new password works.
      assert.equal(
        (await post("/sign-in/email", { email, password: newPassword }))
          .statusCode,
        429,
      );
      const elsewhere = await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        remoteAddress: "203.0.113.5",
        headers: { origin: "http://127.0.0.1:4310" },
        payload: { email, password: newPassword },
      });
      assert.equal(elsewhere.statusCode, 200, elsewhere.body);

      // Provider callbacks may arrive as forms (Apple): never refused as 415.
      const form = await app.inject({
        method: "POST",
        url: "/api/auth/callback/apple",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        payload: "state=x&code=y",
      });
      assert.notEqual(form.statusCode, 415);
      assert.ok(form.statusCode < 500, form.body);
      await app.close();
    } finally {
      console.info = info;
      await repository.close();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
