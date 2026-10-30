import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { retainAdClick } from "../src/advertising/click-evidence.js";
import { FamilyRepository } from "../src/family/repository.js";
import { accountSummary } from "../src/account/repository.js";
import { changeAdvertisingPermission } from "../src/advertising/permission.js";
import {
  completeSignup,
  createSignupIntent,
  markSignupVerified,
} from "../src/parent-followup/repository.js";
import { signupNotice } from "../src/parent-followup/contracts.js";
import {
  collectProviderSignups,
  deliverProviderSignup,
  purgeSignupMeasurement,
  type ProviderSignupConfig,
} from "../src/advertising/provider-signups.js";

test(
  "verified parent signup exports are attributable, retry-safe and removable",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!,
      schema = `signup_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    scoped.searchParams.set("application_name", schema);
    const pool = new Pool({ connectionString: scoped.href, max: 6 });
    const meta: ProviderSignupConfig = {
      provider: "meta",
      enabled: true,
      destinationId: "1234567890",
    };
    const openai: ProviderSignupConfig = {
      provider: "openai",
      enabled: true,
      destinationId: "synthetic-pixel",
    };
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      async function parent(
        id: string,
        provider: "meta" | "openai",
        options: {
          verified?: boolean;
          ua?: boolean;
          oldAccount?: boolean;
          optout?: boolean;
        } = {},
      ) {
        const c = await pool.connect();
        let click;
        try {
          await c.query("BEGIN");
          click = await retainAdClick(
            c,
            provider === "meta"
              ? {
                  provider: "meta",
                  identifiers: { fbclid: "synthetic-click" },
                }
              : {
                  provider: "openai",
                  identifiers: { oppref: "synthetic-reference" },
                },
            undefined,
            undefined,
            undefined,
            "https://amp.corpora.inc/sign-up",
          );
          await c.query("COMMIT");
        } catch (error) {
          await c.query("ROLLBACK");
          throw error;
        } finally {
          c.release();
        }
        const intent = await createSignupIntent(
          pool,
          { newsletter: false, notice: signupNotice },
          `__Host-amp-acquisition=${click!.token}`,
        );
        await pool.query(
          `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt") VALUES($1,'Synthetic Parent',$2,$3,now()-($4::int*interval '1 day'))`,
          [
            id,
            `${id}@example.test`,
            options.verified !== false,
            options.oldAccount ? 1 : 0,
          ],
        );
        await completeSignup(pool, `amp.parent-signup=${intent}`, id, {
          ...(options.ua !== false
            ? { "user-agent": "Mozilla/5.0 synthetic-browser" }
            : {}),
          ...(options.optout ? { "sec-gpc": "1" } : {}),
        });
        if (options.verified !== false) await markSignupVerified(pool, id);
      }
      await parent("meta-parent", "meta", { verified: false });
      assert.equal(
        await collectProviderSignups(pool, meta),
        0,
        "unverified signup has no conversion",
      );
      await pool.query(
        `UPDATE amp_auth_users SET "emailVerified"=true WHERE id='meta-parent'`,
      );
      await markSignupVerified(pool, "meta-parent");
      const collected = await Promise.all([
        collectProviderSignups(pool, meta),
        collectProviderSignups(pool, meta),
      ]);
      assert.equal(
        collected.reduce((n, v) => n + v, 0),
        1,
        "concurrent collectors enqueue once",
      );
      let bodies: any[] = [];
      const uncertain = {
        accessToken: async () => "synthetic-token",
        fetcher: async (_url: any, init: any) => {
          bodies.push(JSON.parse(init.body));
          throw new Error("connection closed");
        },
      };
      await deliverProviderSignup(pool, meta, uncertain);
      await pool.query(
        "UPDATE amp_provider_signup_exports SET available_at=now()",
      );
      const accepted = {
        accessToken: async () => "synthetic-token",
        fetcher: async (_url: any, init: any) => {
          bodies.push(JSON.parse(init.body));
          return Response.json({ events_received: 1, messages: [] });
        },
      };
      await Promise.all([
        deliverProviderSignup(pool, meta, accepted),
        deliverProviderSignup(pool, meta, accepted),
      ]);
      assert.equal(bodies.length, 2, "one retry despite concurrent workers");
      assert.deepEqual(
        bodies[0],
        bodies[1],
        "retry preserves event and exact content",
      );
      const event = bodies[0].data[0];
      assert.equal(event.event_name, "CompleteRegistration");
      assert.equal(
        event.user_data.client_user_agent,
        "Mozilla/5.0 synthetic-browser",
      );
      assert.match(event.user_data.fbc, /^fb\.1\.\d{13}\.synthetic-click$/);
      assert.doesNotMatch(
        JSON.stringify(bodies),
        /example\.test|meta-parent|learner|amount|currency|value/,
      );
      assert.equal(await collectProviderSignups(pool, meta), 0);
      assert.equal(await deliverProviderSignup(pool, meta, accepted), false);
      await parent("missing-agent", "meta", { ua: false });
      await parent("old-account", "meta", { oldAccount: true });
      await parent("optout", "meta", { optout: true });
      assert.equal(
        await collectProviderSignups(pool, meta),
        0,
        "no fabricated browser context or returning-login conversions",
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM amp_ad_click_evidence c JOIN amp_ad_click_journeys j ON j.id=c.journey_id WHERE j.account_id='amp|optout'",
          )
        ).rows[0].n,
        0,
      );

      await parent("openai-parent", "openai");
      assert.equal(await collectProviderSignups(pool, openai), 1);
      let openaiBody: any;
      await deliverProviderSignup(pool, openai, {
        accessToken: async () => "synthetic-token",
        fetcher: async (url, init) => {
          assert.match(
            String(url),
            /^https:\/\/bzr.openai.com\/v1\/events\?pid=synthetic-pixel$/,
          );
          openaiBody = JSON.parse(String(init?.body));
          return Response.json({ accepted_events: 1 });
        },
      });
      assert.equal(openaiBody.events[0].type, "registration_completed");
      assert.equal(openaiBody.events[0].oppref, "synthetic-reference");
      assert.deepEqual(openaiBody.events[0].data, { type: "customer_action" });
      assert.equal(openaiBody.events[0].opt_out, true);
      assert.doesNotMatch(
        JSON.stringify(openaiBody),
        /example\.test|user_agent|amount|currency|learner/,
      );

      await parent("changed-email", "openai");
      await collectProviderSignups(pool, openai);
      await pool.query(
        `UPDATE amp_auth_users SET email='changed@example.test' WHERE id='changed-email'`,
      );
      const never = {
        accessToken: async () => "synthetic-token",
        fetcher: async () => assert.fail("ineligible conversion sent"),
      };
      assert.equal(await deliverProviderSignup(pool, openai, never), true);
      assert.equal(
        (
          await pool.query(
            "SELECT state FROM amp_provider_signup_exports WHERE user_id='changed-email'",
          )
        ).rows[0].state,
        "stopped",
      );
      await parent("expired", "openai");
      await collectProviderSignups(pool, openai);
      await pool.query(
        "UPDATE amp_parent_followups SET verified_at=now()-interval '8 days' WHERE user_id='expired'",
      );
      await deliverProviderSignup(pool, openai, never);
      assert.equal(
        (
          await pool.query(
            "SELECT state FROM amp_provider_signup_exports WHERE user_id='expired'",
          )
        ).rows[0].state,
        "stopped",
      );

      await parent("revoked", "meta");
      await collectProviderSignups(pool, meta);
      await pool.query(
        "INSERT INTO amp_ad_collection_withdrawals(account_id,provider) VALUES('amp|revoked','meta')",
      );
      await deliverProviderSignup(pool, meta, never);
      assert.equal(
        (
          await pool.query(
            "SELECT state FROM amp_provider_signup_exports WHERE user_id='revoked'",
          )
        ).rows[0].state,
        "stopped",
      );
      await pool.query(
        "DELETE FROM amp_ad_click_evidence WHERE id IN(SELECT evidence_id FROM amp_signup_browser_contexts WHERE user_id='revoked')",
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM amp_provider_signup_exports WHERE user_id='revoked'",
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM amp_signup_browser_contexts WHERE user_id='revoked'",
          )
        ).rows[0].n,
        0,
      );
      await pool.query(
        "UPDATE amp_signup_browser_contexts SET expires_at=now()-interval '1 second'",
      );
      await purgeSignupMeasurement(pool);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM amp_signup_browser_contexts",
          )
        ).rows[0].n,
        0,
      );
      await pool.query("DELETE FROM amp_auth_users WHERE id='openai-parent'");
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM amp_provider_signup_exports WHERE user_id='openai-parent'",
          )
        ).rows[0].n,
        0,
      );
      await parent("slow-provider", "openai");
      await collectProviderSignups(pool, openai);
      let release!: () => void, started!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const sending = new Promise<void>((resolve) => {
        started = resolve;
      });
      const inFlight = deliverProviderSignup(pool, openai, {
        accessToken: async () => "synthetic-token",
        fetcher: async () => {
          started();
          await held;
          return Response.json({ accepted_events: 1 });
        },
      });
      await sending;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let withdrawal: Promise<unknown> | undefined;
      try {
        const summary = await Promise.race([
          accountSummary(pool, new FamilyRepository(pool), "amp|slow-provider"),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("ad I/O blocked account snapshot")),
              1000,
            );
          }),
        ]);
        assert.equal(summary.account.id, "amp|slow-provider");
        withdrawal = changeAdvertisingPermission(
          pool,
          "amp|slow-provider",
          { action: "withdraw" },
          false,
          "openai",
        );
        void withdrawal.catch(() => {});
        let waiting = false;
        for (let i = 0; i < 100 && !waiting; i++) {
          waiting = (
            await pool.query(
              "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event='advisory') AS waiting",
              [schema],
            )
          ).rows[0].waiting;
          if (!waiting) await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.equal(waiting, true, "withdrawal waits for the in-flight send");
      } finally {
        clearTimeout(timer);
        release();
        await inFlight;
        await withdrawal;
      }
      assert.equal(await collectProviderSignups(pool, openai), 0);
      assert.equal(await deliverProviderSignup(pool, openai, never), false);
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
