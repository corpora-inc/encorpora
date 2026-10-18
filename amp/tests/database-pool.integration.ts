import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";

test(
  "hosted API shares a three-connection budget across accounts, learning and family services",
  { skip: !process.env.AMP_TEST_DATABASE_URL, timeout: 30000 },
  async () => {
    const schema = `amp_pool_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({
      connectionString: process.env.AMP_TEST_DATABASE_URL,
      max: 1,
    });
    const scoped = new URL(process.env.AMP_TEST_DATABASE_URL!);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    scoped.searchParams.set("application_name", schema);
    let child: ReturnType<typeof spawn> | undefined;
    let locked = false;
    let sampling = false;
    let sampler: Promise<void> | undefined;
    let peak = 0;
    const countConnections = async () => {
      // PostgreSQL caches activity snapshots for the observer transaction.
      await admin.query("SELECT pg_stat_clear_snapshot()");
      const result = await admin.query(
        "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND application_name=$1",
        [schema],
      );
      const count = result.rows[0].count as number;
      peak = Math.max(peak, count);
      return count;
    };
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      await admin.query(`SET search_path=${schema}`);
      const token = randomUUID();
      await admin.query(
        `INSERT INTO ${schema}.amp_auth_users (id,name,email,"emailVerified") VALUES ('parent','Fixture parent','parent@example.com',true)`,
      );
      await admin.query(
        `INSERT INTO ${schema}.amp_auth_sessions (id,token,"expiresAt","updatedAt","userId") VALUES ('fixture',$1,now()+interval '1 hour',now(),'parent')`,
        [token],
      );
      await admin.query(
        `INSERT INTO ${schema}.amp_parent_consents (account_id,policy_version,verification_method,evidence_reference) VALUES ('amp|parent','fixture-policy','verified','fixture-evidence')`,
      );
      child = spawn(
        process.execPath,
        ["--import", "tsx", "src/server/main.ts"],
        {
          env: {
            PATH: process.env.PATH,
            NODE_ENV: "production",
            AMP_DATABASE_URL: scoped.href,
            AMP_DATABASE_POOL_MAX: "3",
            AMP_AUTH_MODE: "accounts",
            AMP_HOSTED_PILOT_READY: "true",
            AMP_ACCOUNTS_URL: "https://amp.example.com",
            AMP_ACCOUNTS_SECRET: randomUUID() + randomUUID(),
            AMP_HOST: "127.0.0.1",
            AMP_PORT: "0",
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      // The OS assigns a free port; this test does not compete with browser suites.
      let origin = "";
      let output = "";
      child.stdout!.on("data", (chunk) => {
        output += chunk.toString();
        origin =
          output.match(
            /Server listening at (http:\/\/127\.0\.0\.1:\d+)/,
          )?.[1] ?? origin;
      });
      child.stderr!.resume();
      for (let i = 0; i < 200 && !origin; i++) {
        assert.equal(
          child.exitCode,
          null,
          "hosted API must not exit before readiness",
        );
        await delay(25);
      }
      assert.ok(origin, "hosted API listens on its assigned port");
      const get = async (path: string) => {
        const response = await fetch(`${origin}${path}`, {
          headers: { authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10000),
        });
        const body = await response.text();
        assert.equal(response.status, 200, `${path}: ${body}`);
        return body;
      };
      sampling = true;
      sampler = (async () => {
        while (sampling) {
          await countConnections();
          await delay(10);
        }
      })();
      // Block real API queries until all three connections are occupied. Nine
      // requests must queue, rather than causing a fourth database connection.
      await admin.query("BEGIN");
      locked = true;
      await admin.query(
        `LOCK TABLE ${schema}.amp_learners IN ACCESS EXCLUSIVE MODE`,
      );
      const pending = Promise.all(
        Array.from({ length: 9 }, () => get("/api/v1/learners")),
      );
      // Attach rejection handling immediately, including when an assertion fails.
      void pending.catch(() => {});
      for (let i = 0; i < 100 && peak < 3; i++) await delay(20);
      assert.equal(peak, 3, "the workload must saturate the configured budget");
      await delay(100);
      assert.equal(
        await countConnections(),
        3,
        "queued requests do not open extra connections",
      );
      await admin.query("COMMIT");
      locked = false;
      await pending;
      const paths = [
        "/api/auth/get-session",
        "/api/v1/learners",
        "/api/v1/family",
        "/api/v1/family/export",
        "/api/v1/payments",
        "/api/v1/consent",
        "/api/v1/funding/requests",
      ];
      const bodies = await Promise.all(paths.map(get));
      assert.match(
        bodies[3]!,
        /"type":"complete"/,
        "snapshot export completes within the shared budget",
      );
      await countConnections();
      assert.equal(
        peak,
        3,
        "all application pools together stay within the API budget",
      );
    } finally {
      sampling = false;
      await sampler;
      if (locked) await admin.query("ROLLBACK");
      if (child && child.exitCode === null) {
        const exited = once(child, "exit");
        child.kill("SIGTERM");
        const deadline = setTimeout(() => child?.kill("SIGKILL"), 5000);
        await exited;
        clearTimeout(deadline);
      }
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
