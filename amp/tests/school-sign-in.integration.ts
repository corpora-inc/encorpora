import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate";
import {
  accountsAuth,
  createAccounts,
  registerAccountRoutes,
} from "../src/server/accounts";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";

test(
  "a class signs in from one address, while guessing one password is stopped",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `school_sign_in_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const repository = new PostgresRepository(scoped.href, {
      development: true,
    });
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
      const signIn = (email: string) =>
        app.inject({
          method: "POST",
          url: "/api/auth/sign-in/email",
          remoteAddress: "203.0.113.50",
          headers: { origin: "http://127.0.0.1:4310" },
          payload: { email, password: "not-the-password" },
        });
      // Far past the 3 per 10 s that would otherwise apply to the whole address.
      for (let student = 0; student < 40; student++) {
        const response = await signIn(`student-${student}@school.test`);
        assert.notEqual(response.statusCode, 429, `student ${student}`);
      }
      for (let guess = 0; guess < 9; guess++)
        assert.notEqual(
          (await signIn("student-0@school.test")).statusCode,
          429,
          `guess ${guess}`,
        );
      const stopped = await signIn("student-0@school.test");
      assert.equal(stopped.statusCode, 429);
      assert.match(stopped.json().error, /Try again in 5 minutes/);
      assert.notEqual((await signIn("student-1@school.test")).statusCode, 429);
      await app.close();
    } finally {
      await repository.pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
