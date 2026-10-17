import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";

test(
  "API entrypoint registers unavailable purchases and consent without implicit configuration",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const admin = new Pool({
      connectionString: process.env.AMP_TEST_DATABASE_URL,
      max: 1,
    });
    const schema = `amp_purchase_startup_${randomUUID().replaceAll("-", "")}`;
    const scoped = new URL(process.env.AMP_TEST_DATABASE_URL!);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    let child: ReturnType<typeof spawn> | undefined;
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      child = spawn(
        process.execPath,
        ["--import", "tsx", "src/server/main.ts"],
        {
          env: {
            ...process.env,
            AMP_DATABASE_URL: scoped.href,
            AMP_AUTH_MODE: "development",
            AMP_HOST: "127.0.0.1",
            AMP_PORT: "4391",
            AMP_STRIPE_ENABLED: "false",
            AMP_FUNDING_OFFERS_FILE: "",
            AMP_CONSENT_POLICY_FILE: "",
            AMP_CONSENT_SECRET_BASE64: undefined,
          },
          stdio: "ignore",
        },
      );
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if (child.exitCode !== null)
          throw new Error("API entrypoint exited before readiness");
        try {
          if ((await fetch("http://127.0.0.1:4391/api/v1/catalog")).ok) {
            ready = true;
            break;
          }
        } catch {}
        await delay(100);
      }
      assert.ok(ready, "API became ready within ten seconds");
      for (const [path, expected] of [
        ["billing/offer", { available: false }],
        ["funding/offers", { offers: [] }],
        ["funding/requests", { requests: [] }],
        [
          "consent",
          {
            consentActive: false,
            available: false,
            notice: null,
            noticeDigest: null,
            confirmationDelayHours: null,
            request: null,
          },
        ],
      ] as const) {
        const response = await fetch(`http://127.0.0.1:4391/api/v1/${path}`, {
          headers: { authorization: "Bearer amp-local-development" },
        });
        assert.equal(response.status, 200, path);
        assert.deepEqual(await response.json(), expected, path);
        assert.match(response.headers.get("cache-control") ?? "", /no-store/);
      }
      const unauthorized = await fetch(
        "http://127.0.0.1:4391/api/v1/funding/requests",
      );
      assert.equal(unauthorized.status, 401);
      assert.equal(
        (await fetch("http://127.0.0.1:4391/api/v1/consent")).status,
        401,
      );
      assert.equal(
        (
          await admin.query(
            `SELECT count(*)::int AS count FROM ${schema}.amp_consent_policy`,
          )
        ).rows[0].count,
        0,
        "startup does not install policy",
      );
    } finally {
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
