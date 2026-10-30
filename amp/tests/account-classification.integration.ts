import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { runPipelineCommand } from "../src/acquisition/pipeline.js";
import { acquisitionPipelineReport } from "../src/acquisition/report.js";
import { FamilyRepository } from "../src/family/repository.js";
import { deliverParentFollowup } from "../src/parent-followup/worker.js";

test(
  "account classification excludes non-prospects without changing access or enrolling marketing",
  {
    skip: !process.env.AMP_TEST_DATABASE_URL,
  },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `classification_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const target = new URL(url);
    target.searchParams.set("options", `-c search_path=${schema}`);
    const pool = new Pool({ connectionString: target.href, max: 5 });
    const sender = "founder@example.test";
    const call = (id: string, value: object) =>
      runPipelineCommand(pool, {
        email: `${id}@example.test`,
        eventKey: randomUUID(),
        ...value,
      });
    const classify = (
      id: string,
      category = "friends_family",
      eventKey = randomUUID(),
    ) =>
      call(id, {
        action: "classify-account",
        category,
        eventKey,
        note: "Owner-confirmed relationship",
      });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(target.href);
      for (const id of ["relative", "lead", "race", "legacy", "generic"]) {
        await pool.query(
          'INSERT INTO amp_auth_users(id,name,email,"emailVerified") VALUES($1,$1,$2,true)',
          [id, `${id}@example.test`],
        );
        if (id !== "relative")
          await pool.query(
            `INSERT INTO amp_parent_followups(user_id,email,new_account,notice_version,unsubscribe_token,verified_at)
        VALUES($1,$2,$3,'test',$1,now())`,
            [id, `${id}@example.test`, id !== "generic"],
          );
      }
      async function pilot(id: string) {
        await pool.query(
          "INSERT INTO amp_learners(id,account_id,name) VALUES($1,$2,'Learner')",
          [id, `amp|${id}`],
        );
        await pool.query(
          `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
        VALUES($1,$1,'pilot',$1,'active',now()-interval '1 day',now()+interval '1 year')`,
          [id],
        );
      }
      await pilot("relative");
      await pilot("legacy");
      const originalGrant = (
        await pool.query("SELECT * FROM amp_grants WHERE id='relative'")
      ).rows[0];
      const key = randomUUID();
      assert.equal(
        (await classify("relative", "friends_family", key)).replay,
        false,
      );
      assert.equal(
        (await classify("relative", "friends_family", key)).replay,
        true,
      );
      await assert.rejects(
        classify("relative", "internal", key),
        /different evidence/,
      );
      await classify("relative", "prospect");
      await classify("relative", "friends_family", key);
      assert.equal(
        (
          await pool.query(
            "SELECT category FROM amp_account_classifications WHERE user_id='relative'",
          )
        ).rows[0].category,
        "prospect",
        "Old replays cannot undo a newer decision",
      );
      await classify("relative");
      await assert.rejects(classify("missing"), /exactly one account/);
      assert.equal(
        (
          await pool.query(
            "SELECT 1 FROM amp_parent_followups WHERE user_id='relative'",
          )
        ).rowCount,
        0,
      );
      assert.deepEqual(
        (await pool.query("SELECT * FROM amp_grants WHERE id='relative'"))
          .rows[0],
        originalGrant,
      );
      let report = await acquisitionPipelineReport(pool);
      assert.equal(
        report.classifiedAccounts.find(
          (c) => c.email === "relative@example.test",
        ).has_granted_access,
        true,
      );
      assert.ok(
        !report.unclassifiedAccounts.some(
          (c) => c.email === "relative@example.test",
        ),
      );
      assert.equal(
        report.contacts.find((c) => c.email === "legacy@example.test")
          .next_action,
        "customer",
      );

      async function prepared(id: string, purpose = "welcome") {
        await call(id, {
          action: "record-event",
          kind: "release",
          occurredAt: new Date().toISOString(),
          reason: "Reviewed test contact",
          nextContactAt: "2020-01-01T12:00:00Z",
        });
        const m = (
          await call(id, {
            action: "save-draft",
            purpose,
            intentKey: purpose,
            sender,
            recipient: `${id}@example.test`,
            subject: "Hello",
            body: "Test message",
            draftId: `${id}-${purpose}`,
          })
        ).result as { id: string; content_hash: string };
        await call(id, {
          action: "approve",
          id: m.id,
          contentHash: m.content_hash,
          reference: "Reviewed synthetic draft",
        });
        await call(id, {
          action: "record-event",
          kind: "mailbox_checked",
          occurredAt: new Date().toISOString(),
          mailbox: sender,
          complete: true,
        });
        return { action: "claim", id: m.id, contentHash: m.content_hash };
      }
      const welcome = await prepared("lead");
      await classify("lead");
      report = await acquisitionPipelineReport(pool);
      assert.equal(report.acquisition_signups, 2);
      assert.equal(report.prospect_contacts, 2);
      assert.equal(report.missing_contacts, 0);
      assert.equal(
        report.contacts.find((c) => c.email === "lead@example.test")
          .next_action,
        "not_a_prospect",
      );
      await assert.rejects(
        call("lead", welcome),
        /not an acquisition prospect/,
      );
      const reply = await prepared("lead", "reply");
      await call("lead", reply); // Personal replies remain explicitly reviewed and claimed.
      await assert.rejects(classify("lead", "prospect"), /outstanding send/);
      await assert.rejects(
        call("legacy", await prepared("legacy")),
        /already has access/,
      );

      const raceClaim = await prepared("race");
      const raced = await Promise.allSettled([
        classify("race"),
        call("race", raceClaim),
      ]);
      assert.equal(
        raced.filter((r) => r.status === "fulfilled").length,
        1,
        "A classification and a conflicting send claim cannot both win",
      );

      await classify("generic", "internal");
      await pool.query(
        "INSERT INTO amp_parent_followup_outbox(id,user_id,stage) VALUES($1,'generic','welcome')",
        [randomUUID()],
      );
      await deliverParentFollowup(
        pool,
        {
          origin: "https://example.test",
          sender,
          postalAddress: "Example address",
          apiKey: "test",
        },
        async () => assert.fail("Non-prospect received generic outreach"),
      );
      assert.equal(
        (
          await pool.query(
            "SELECT stopped_reason FROM amp_parent_followup_outbox WHERE user_id='generic'",
          )
        ).rows[0].stopped_reason,
        "not-a-prospect",
      );
      const exported = [];
      for await (const line of new FamilyRepository(pool).export(
        "amp|relative",
      ))
        exported.push(line);
      assert.match(exported.join(""), /account-classification/);
      assert.match(exported.join(""), /Owner-confirmed relationship/);
      await pool.query("DELETE FROM amp_auth_users WHERE id='relative'");
      for (const table of [
        "amp_account_classifications",
        "amp_account_classification_events",
      ])
        assert.equal(
          (await pool.query(`SELECT 1 FROM ${table} WHERE user_id='relative'`))
            .rowCount,
          0,
        );
      await migrate(target.href);
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
