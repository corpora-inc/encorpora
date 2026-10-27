import {
  collectSignupConversions,
  deliverSignupConversion,
} from "../src/advertising/signup-measurement.js";
import { googleSignupRequest } from "../src/advertising/google-data-manager.js";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import {
  createSignupIntent,
  completeSignup,
  markSignupVerified,
  unsubscribe,
} from "../src/parent-followup/repository.js";
import { deliverParentFollowup } from "../src/parent-followup/worker.js";
import {
  explicitNewsletterNotice,
  signupNotice,
} from "../src/parent-followup/contracts.js";
import { retainAdClick } from "../src/advertising/click-evidence.js";
import { redactUrl } from "../src/server/app.js";
const config = {
  origin: "https://amp.example.com",
  sender: "hello@example.com",
  postalAddress: "Example Company, 123 Main St, Example, NY 10001",
  apiKey: "test",
};

test(
  "verified parent signup retains attribution; welcome and next-day reminder are retry-safe and optional",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `followup_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const pool = new Pool({ connectionString: scoped.href, max: 5 });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      async function parent(id: string, verified = true, newsletter = false) {
        await pool.query(
          "INSERT INTO amp_auth_users(id,name,email,\"emailVerified\") VALUES ($1,'Parent',$2,$3)",
          [id, `${id}@example.com`, verified],
        );
        const token = await createSignupIntent(pool, {
          program: "ar-efa",
          newsletter,
          notice: signupNotice,
        });
        await completeSignup(pool, `amp.parent-signup=${token}`, id);
        await markSignupVerified(pool, id);
        return (
          await pool.query(
            "SELECT * FROM amp_parent_followups WHERE user_id=$1",
            [id],
          )
        ).rows[0];
      }
      const first = await parent("parent", false);
      assert.equal(
        await deliverParentFollowup(pool, config, async () =>
          assert.fail("unverified recipient"),
        ),
        false,
      );
      await pool.query(
        "UPDATE amp_auth_users SET \"emailVerified\"=true WHERE id='parent'",
      );
      await markSignupVerified(pool, "parent");
      const calls: { text: string; id: string }[] = [];
      assert.equal(
        await deliverParentFollowup(pool, config, async (mail, id) => {
          calls.push({ text: mail.text, id });
          return null;
        }),
        true,
      );
      await pool.query(
        "UPDATE amp_parent_followup_outbox SET available_at=now() WHERE user_id='parent'",
      );
      await deliverParentFollowup(pool, config, async (mail, id) => {
        calls.push({ text: mail.text, id });
        return { accepted: "receipt" };
      });
      assert.deepEqual(
        calls[0],
        calls[1],
        "ambiguous delivery retries exact bytes and identity",
      );
      assert.match(calls[0]!.text, /Arkansas EFA/);
      assert.match(calls[0]!.text, /return=free-practice/);
      assert.equal(
        await deliverParentFollowup(pool, config, async () =>
          assert.fail("reminder too early"),
        ),
        false,
      );
      await pool.query(
        "UPDATE amp_parent_followup_outbox SET accepted_at=now()-interval '25 hours' WHERE user_id='parent' AND stage='welcome'",
      );
      await deliverParentFollowup(pool, config, async (mail) => {
        assert.match(mail.subject, /Arkansas EFA/);
        return { accepted: "reminder" };
      });
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_parent_followup_outbox WHERE accepted_at IS NOT NULL",
          )
        ).rows[0].n,
        2,
      );
      const intent = await createSignupIntent(pool, {
        program: "az-esa",
        newsletter: true,
        notice: explicitNewsletterNotice,
      });
      await completeSignup(pool, `amp.parent-signup=${intent}`, "parent");
      assert.equal(
        (
          await pool.query(
            "SELECT newsletter FROM amp_parent_followups WHERE user_id='parent'",
          )
        ).rows[0].newsletter,
        true,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_parent_followup_outbox",
          )
        ).rows[0].n,
        2,
        "sign in never duplicates sequence",
      );
      await unsubscribe(pool, first.unsubscribe_token);
      assert.equal(
        (
          await pool.query(
            "SELECT newsletter FROM amp_parent_followups WHERE user_id='parent'",
          )
        ).rows[0].newsletter,
        false,
      );
      // The default opt-in on a later sign-in never overrides an unsubscribe.
      const again = await createSignupIntent(pool, {
        newsletter: true,
        notice: signupNotice,
      });
      await completeSignup(pool, `amp.parent-signup=${again}`, "parent");
      assert.deepEqual(
        (
          await pool.query(
            "SELECT newsletter, unsubscribed_at IS NOT NULL AS unsubscribed FROM amp_parent_followups WHERE user_id='parent'",
          )
        ).rows[0],
        { newsletter: false, unsubscribed: true },
      );

      await parent("race");
      let finish!: () => void;
      let started!: () => void;
      const entered = new Promise<void>((r) => {
        started = r;
      });
      const firstSend = deliverParentFollowup(pool, config, async () => {
        started();
        await new Promise<void>((r) => {
          finish = r;
        });
        return null;
      });
      await entered;
      await pool.query(
        "UPDATE amp_parent_followup_outbox SET lease_until=now()-interval '1 second' WHERE user_id='race'",
      );
      await deliverParentFollowup(pool, config, async () => ({
        accepted: "race-receipt",
      }));
      finish();
      await firstSend;
      assert.equal(
        (
          await pool.query(
            "SELECT receipt FROM amp_parent_followup_outbox WHERE user_id='race' AND stage='welcome'",
          )
        ).rows[0].receipt,
        "race-receipt",
        "stale worker cannot erase success",
      );
      const blocked = await parent("unsubscribe");
      await unsubscribe(pool, blocked.unsubscribe_token);
      assert.equal(
        await deliverParentFollowup(pool, config, async () =>
          assert.fail("unsubscribed"),
        ),
        false,
      );
      await parent("paid");
      await pool.query(
        `INSERT INTO amp_access_gifts(id,recipient_email,months,source,reference,activated_at,ends_at,account_id)
      VALUES ($1,'paid@example.com',12,'scholarship','followup-test',now(),now()+interval '1 year','amp|paid')`,
        [randomUUID()],
      );
      await deliverParentFollowup(pool, config, async () =>
        assert.fail("paid/opted-out"),
      );
      await deliverParentFollowup(pool, config, async () =>
        assert.fail("paid/opted-out reminder"),
      );

      const client = await pool.connect();
      let click;
      try {
        await client.query("BEGIN");
        click = await retainAdClick(
          client,
          { provider: "google", identifiers: { gclid: "test-click" } },
          undefined,
          { campaign: "ar-efa-launch", source: "google", medium: "cpc" },
          undefined,
          "https://amp.corpora.inc/sign-up",
        );
        await client.query("COMMIT");
      } finally {
        client.release();
      }
      const captured = await createSignupIntent(
        pool,
        { program: "ar-efa", newsletter: false, notice: signupNotice },
        `__Host-amp-acquisition=${click.token}`,
      );
      await pool.query(
        "INSERT INTO amp_auth_users(id,name,email,\"emailVerified\") VALUES ('attributed','Parent','attributed@example.com',true)",
      );
      await completeSignup(pool, `amp.parent-signup=${captured}`, "attributed");
      const linked = (
        await pool.query(
          "SELECT j.account_id FROM amp_parent_followups p JOIN amp_ad_click_journeys j ON j.id=p.acquisition_journey_id WHERE p.user_id='attributed'",
        )
      ).rows[0];
      assert.equal(linked.account_id, "amp|attributed");
      await markSignupVerified(pool, "attributed");
      const measurement = {
        enabled: true,
        destination: {
          conversionCustomerId: "1234567890",
          conversionActionId: "1234",
        },
      };
      assert.equal(await collectSignupConversions(pool, measurement), 1);
      assert.equal(
        await collectSignupConversions(pool, measurement),
        0,
        "one signup per account/destination",
      );
      let transmitted: unknown;
      await deliverSignupConversion(pool, measurement, {
        signup: async (input) => {
          transmitted = googleSignupRequest(
            measurement.destination,
            input,
            "ingest",
          );
          return {
            kind: "accepted",
            requestId: "synthetic",
            destinationFingerprint: "synthetic",
            submittedRecords: 1,
            fieldWarningCount: 0,
          };
        },
      });
      const text = JSON.stringify(transmitted);
      assert.match(text, /test-click/);
      assert.doesNotMatch(
        text,
        /example.com|conversionValue|currency|learner|attributed/,
      );
      assert.equal(
        await deliverSignupConversion(pool, measurement, {
          signup: async () => assert.fail("duplicate signup"),
        }),
        false,
      );

      await pool.query(
        "DELETE FROM amp_ad_click_evidence WHERE journey_id IN (SELECT id FROM amp_ad_click_journeys WHERE account_id='amp|attributed')",
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_google_signup_exports",
          )
        ).rows[0].n,
        0,
        "expired or withdrawn evidence removes its copied export payload",
      );
      assert.equal(
        await collectSignupConversions(pool, measurement),
        0,
        "removed evidence cannot be collected again",
      );

      assert.equal(
        redactUrl(
          `/api/v1/parent-followup/unsubscribe/${first.unsubscribe_token}`,
        ),
        "/api/v1/parent-followup/unsubscribe/[redacted]",
      );
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
