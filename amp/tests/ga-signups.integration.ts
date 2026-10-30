import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import {
  createSignupIntent,
  completeSignup,
  markSignupVerified,
} from "../src/parent-followup/repository.js";
import { signupNotice } from "../src/parent-followup/contracts.js";
import {
  deliverGaSignup,
  purgeGaSignups,
  gaSignupPayload,
  type GaSignupConfig,
} from "../src/analytics/ga-signups.js";
import { eraseAccountAdClicks } from "../src/advertising/click-evidence.js";
import { GA_MEASUREMENT_ID } from "../src/analytics/google-analytics.js";
test(
  "GA verified signup exports: new accounts only, one dispatch, privacy, expiry and nonblocking I/O",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!,
      schema = "ga_" + randomUUID().replaceAll("-", ""),
      admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const pool = new Pool({ connectionString: scoped.href, max: 8 });
    const config: GaSignupConfig = {
      enabled: true,
      measurementId: GA_MEASUREMENT_ID,
      apiSecret: "synthetic-secret",
    };
    const bodies: any[] = [];
    const fetcher = (async (_url, init) => {
      bodies.push(JSON.parse(init!.body as string));
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    async function parent(
      id: string,
      opts: {
        old?: boolean;
        optout?: boolean;
        context?: boolean;
        verified?: boolean;
      } = {},
    ) {
      const token = await createSignupIntent(pool, {
        notice: signupNotice,
        newsletter: false,
        ...(opts.context === false
          ? {}
          : {
              analytics: {
                clientId: "1234.5678",
                sessionId: Math.floor(Date.now() / 1000),
              },
            }),
      });
      await pool.query(
        `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt") VALUES($1,'Test',$2,$3,now()-($4::int*interval '1 day'))`,
        [id, id + "@example.test", opts.verified ?? true, opts.old ? 1 : 0],
      );
      await completeSignup(
        pool,
        "amp.parent-signup=" + token,
        id,
        opts.optout ? { dnt: "1" } : {},
      );
      await markSignupVerified(pool, id);
      await completeSignup(pool, "amp.parent-signup=" + token, id);
      return token;
    }
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      await parent("unverified", { verified: false });
      await parent("old", { old: true });
      await parent("optout", { optout: true });
      await parent("blocked", { context: false });
      assert.equal(await deliverGaSignup(pool, config, fetcher), false);
      await pool.query(
        `UPDATE amp_auth_users SET "emailVerified"=true WHERE id='unverified'`,
      );
      await markSignupVerified(pool, "unverified");
      await Promise.all([
        deliverGaSignup(pool, config, fetcher),
        deliverGaSignup(pool, config, fetcher),
      ]);
      assert.equal(bodies.length, 1);
      assert.equal(bodies[0].events[0].name, "sign_up");
      assert(!JSON.stringify(bodies).includes("example.test"));
      assert.equal(await deliverGaSignup(pool, config, fetcher), false);
      assert.equal(
        (
          await pool.query(
            "SELECT client_id FROM amp_ga_signup_exports WHERE user_id='unverified'",
          )
        ).rows[0].client_id,
        null,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_parent_signup_intents WHERE context ? 'analytics'",
          )
        ).rows[0].n,
        0,
      );
      await parent("timeout");
      await deliverGaSignup(pool, config, (async () => {
        throw new Error("lost response");
      }) as typeof fetch);
      assert.equal(await deliverGaSignup(pool, config, fetcher), false);
      assert.equal(
        (
          await pool.query(
            "SELECT state FROM amp_ga_signup_exports WHERE user_id='timeout'",
          )
        ).rows[0].state,
        "uncertain",
      );
      await parent("withdraw");
      const c = await pool.connect();
      await c.query("BEGIN");
      await eraseAccountAdClicks(c, "amp|withdraw", "google");
      await c.query("COMMIT");
      c.release();
      assert.equal(await deliverGaSignup(pool, config, fetcher), false);
      await parent("expired");
      await pool.query(
        "UPDATE amp_ga_signup_exports SET captured_at=now()-interval '2 days' WHERE user_id='expired'",
      );
      await purgeGaSignups(pool);
      assert.equal(await deliverGaSignup(pool, config, fetcher), false);
      await parent("slow");
      let entered!: () => void, release!: () => void;
      const started = new Promise<void>((r) => (entered = r)),
        gate = new Promise<void>((r) => (release = r));
      const delivery = deliverGaSignup(pool, config, (async () => {
        entered();
        await gate;
        return new Response(null, { status: 204 });
      }) as typeof fetch);
      await started;
      const ordinary = await pool.connect();
      await ordinary.query("BEGIN");
      await ordinary.query("SET LOCAL lock_timeout='250ms'");
      await ordinary.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('amp|slow',0))",
      );
      await ordinary.query("COMMIT");
      ordinary.release();
      release();
      await delivery;
      await pool.query("DELETE FROM amp_auth_users WHERE id='slow'");
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_ga_signup_exports WHERE user_id='slow'",
          )
        ).rows[0].n,
        0,
      );
      assert.throws(() =>
        gaSignupPayload(
          { clientId: "email@example.test", sessionId: 1 },
          new Date(),
          null,
        ),
      );
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
