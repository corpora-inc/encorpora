import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { runPipelineCommand } from "../src/acquisition/pipeline.js";
import { acquisitionPipelineReport } from "../src/acquisition/report.js";
import { visitorJourneyReport } from "../src/analytics/visitor-journey-report.js";
import { deliverParentFollowup } from "../src/parent-followup/worker.js";
import { FamilyRepository } from "../src/family/repository.js";
import { readFile, readdir } from "node:fs/promises";

test(
  "acquisition coverage, mail evidence and reviewed single-send claims survive retries",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `outreach_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const target = new URL(url);
    target.searchParams.set("options", `-c search_path=${schema}`);
    const pool = new Pool({ connectionString: target.href, max: 5 });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(target.href);
      const now = new Date().toISOString();
      const sender = "founder@example.com";
      const call = (email: string, action: object) =>
        runPipelineCommand(pool, { email, eventKey: randomUUID(), ...action });
      async function lead(
        id: string,
        verified = true,
        program: string | null = "ar-efa",
        acquisition = true,
      ) {
        const email = `${id}@example.com`;
        await pool.query(
          `INSERT INTO amp_auth_users(id,name,email,"emailVerified") VALUES($1,'Parent',$2,$3)`,
          [id, email, verified],
        );
        await pool.query(
          `INSERT INTO amp_parent_followups(user_id,email,program,new_account,notice_version,unsubscribe_token,verified_at)
        VALUES($1,$2,$3,$4,'test',$1,CASE WHEN $5 THEN now() ELSE NULL END)`,
          [id, email, program, acquisition, verified],
        );
        return email;
      }
      async function check(email: string, mailbox = sender) {
        return call(email, {
          action: "record-event",
          kind: "mailbox_checked",
          occurredAt: new Date().toISOString(),
          mailbox,
          complete: true,
        });
      }
      async function draft(
        email: string,
        purpose = "welcome",
        intentKey = "welcome",
      ) {
        return (
          await call(email, {
            action: "save-draft",
            purpose,
            intentKey,
            sender,
            recipient: email,
            subject: "Welcome",
            body: "What do you think so far?",
            draftId: `draft-${intentKey}`,
          })
        ).result as { id: string; content_hash: string };
      }
      async function approve(
        email: string,
        m: { id: string; content_hash: string },
      ) {
        return call(email, {
          action: "approve",
          id: m.id,
          contentHash: m.content_hash,
          reference: "Owner approved the exact reviewed draft",
        });
      }
      const first = await lead("first");
      const unverified = await lead("unverified", false);
      await lead("staff", true, null, false);
      let report = await acquisitionPipelineReport(pool);
      assert.equal(report.accounts, 3);
      assert.equal(report.acquisition_signups, 2);
      assert.equal(report.missing_contacts, 0);
      assert.equal(report.unclassifiedAccounts.length, 1);
      assert.equal(report.unclassifiedAccounts[0].email, "staff@example.com");
      assert.equal(report.contacts[0].next_action, "wait_until_due");
      assert.equal(report.contacts[1].next_action, "await_verification");
      const localDue = await pool.query(
        "SELECT extract(hour from next_contact_at AT TIME ZONE time_zone)::int AS local_hour, time_zone_basis FROM amp_acquisition_contacts WHERE user_id='first'",
      );
      assert.equal(localDue.rows[0].local_hour, 12);
      assert.equal(localDue.rows[0].time_zone_basis, "campaign");
      await pool.query(
        "INSERT INTO amp_parent_followup_outbox(id,user_id,stage) VALUES($1,'first','welcome')",
        [randomUUID()],
      );
      assert.equal(
        (
          await pool.query(
            "SELECT stopped_reason FROM amp_parent_followup_outbox",
          )
        ).rows[0].stopped_reason,
        "founder-managed",
      );
      // Even clearing the stopped flag cannot make the generic worker send.
      await pool.query(
        "UPDATE amp_parent_followup_outbox SET stopped_at=NULL,stopped_reason=NULL",
      );
      await deliverParentFollowup(
        pool,
        {
          origin: "https://example.com",
          sender,
          postalAddress: "Example address",
          apiKey: "test",
        },
        async () => assert.fail("Generic duplicate sent"),
      );

      const message = await draft(first);
      const claim = {
        action: "claim",
        id: message.id,
        contentHash: message.content_hash,
      };
      await assert.rejects(call(first, claim), /approved/);
      await approve(first, message);
      await assert.rejects(call(first, claim), /mailbox/);
      await check(first, "another@example.com");
      await assert.rejects(call(first, claim), /mailbox/);
      await check(first);
      await assert.rejects(call(first, claim), /not due/);
      await call(first, {
        action: "record-event",
        kind: "release",
        occurredAt: now,
        reason: "Test due time",
        nextContactAt: "2020-01-01T12:00:00Z",
      });
      const refreshed = await draft(first);
      await assert.rejects(call(first, claim), /approved/);
      await approve(first, refreshed);
      const [a, b] = await Promise.allSettled([
        call(first, claim),
        call(first, claim),
      ]);
      assert.equal(
        [a, b].filter((x) => x.status === "fulfilled").length,
        1,
        "Exactly one concurrent claim",
      );
      const accepted = [a, b].find(
        (x) => x.status === "fulfilled",
      ) as PromiseFulfilledResult<
        Awaited<ReturnType<typeof runPipelineCommand>>
      >;
      const claimed = accepted.value.result as { claimId: string };
      await assert.rejects(draft(first), /cannot be replaced/);
      await assert.rejects(
        call(first, {
          action: "cancel",
          id: message.id,
          reason: "Lost response",
        }),
        /reconciliation/,
      );
      report = await acquisitionPipelineReport(pool);
      assert.equal(report.contacts[0].next_action, "reconcile_send");
      const sent = {
        action: "confirm-sent",
        id: message.id,
        claimId: claimed.claimId,
        sender,
        recipient: first,
        subject: "Welcome",
        sentAt: now,
        messageId: "provider-first",
        threadId: "thread-first",
        eventKey: "confirmed-first",
      };
      await call(first, sent);
      assert.equal((await call(first, sent)).replay, true);
      await assert.rejects(
        call(first, { ...sent, subject: "Different" }),
        /different command/,
      );
      report = await acquisitionPipelineReport(pool);
      assert.equal(report.contacts[0].next_action, "await_reply");
      assert.equal(report.contacts[0].sent_count, 1);
      assert.equal(
        (await visitorJourneyReport(pool, { email: first })).timeline.filter(
          (x) => x.event === "founder_email_sent",
        ).length,
        1,
      );

      const receipt = {
        action: "import-sent",
        sender,
        recipient: first,
        subject: "Welcome",
        sentAt: now,
        messageId: "provider-first",
        threadId: "thread-first",
        purpose: "welcome",
        intentKey: "welcome",
      };
      await call(first, receipt);
      await assert.rejects(
        call(first, { ...receipt, messageId: "duplicate" }),
        /different correspondence/,
      );
      await call(first, {
        action: "record-event",
        kind: "reply",
        occurredAt: new Date(Date.now() + 1000).toISOString(),
        mailbox: sender,
        messageId: "inbound",
        threadId: "thread-first",
      });
      report = await acquisitionPipelineReport(pool);
      assert.equal(report.contacts[0].next_action, "review_reply");
      const follow = await draft(first, "followup", "followup-one");
      await approve(first, follow);
      await assert.rejects(
        call(first, {
          action: "claim",
          id: follow.id,
          contentHash: follow.content_hash,
        }),
        /has replied/,
      );
      await call(first, {
        action: "record-event",
        kind: "optout",
        occurredAt: now,
        mailbox: sender,
        messageId: "optout",
        threadId: "thread-first",
      });
      await call(first, {
        action: "record-event",
        kind: "release",
        occurredAt: now,
        reason: "Manual hold release does not remove opt-out",
      });
      const reply = await draft(first, "reply", "reply-one");
      await approve(first, reply);
      await assert.rejects(
        call(first, {
          action: "claim",
          id: reply.id,
          contentHash: reply.content_hash,
        }),
        /suppressed/,
      );
      assert.ok(
        (
          await pool.query(
            "SELECT unsubscribed_at FROM amp_parent_followups WHERE user_id='first'",
          )
        ).rows[0].unsubscribed_at,
      );
      const exports = [];
      for await (const line of new FamilyRepository(pool).export("amp|first"))
        exports.push(line);
      assert.match(exports.join(""), /acquisition-message/);
      assert.match(exports.join(""), /What do you think so far/);

      const u = await draft(unverified);
      await approve(unverified, u);
      await check(unverified);
      await assert.rejects(
        call(unverified, {
          action: "claim",
          id: u.id,
          contentHash: u.content_hash,
        }),
        /unverified/,
      );
      await pool.query(
        `UPDATE amp_auth_users SET "emailVerified"=true,email='changed@example.com' WHERE id='unverified'`,
      );
      await assert.rejects(
        call(unverified, {
          action: "claim",
          id: u.id,
          contentHash: u.content_hash,
        }),
        /changed/,
      );
      await pool.query("DELETE FROM amp_auth_users WHERE id='first'");
      for (const table of [
        "amp_acquisition_contacts",
        "amp_acquisition_messages",
        "amp_acquisition_contact_events",
      ])
        assert.equal(
          (
            await pool.query(
              `SELECT count(*)::int n FROM ${table} WHERE user_id='first'`,
            )
          ).rows[0].n,
          0,
        );
      await migrate(target.href); // Re-running migration preserves surviving state.
      assert.equal((await acquisitionPipelineReport(pool)).contacts.length, 1);
      const recovery = await lead("recovery");
      await call(recovery, {
        action: "record-event",
        kind: "release",
        occurredAt: new Date().toISOString(),
        reason: "Test explicit review",
        nextContactAt: "2020-01-01T12:00:00Z",
      });
      const rm = await draft(recovery);
      await approve(recovery, rm);
      await check(recovery);
      const lostClaim = {
        action: "claim",
        id: rm.id,
        contentHash: rm.content_hash,
        eventKey: "lost-claim",
      };
      await call(recovery, lostClaim);
      const replay = await call(recovery, lostClaim);
      assert.equal(replay.replay, true);
      assert.deepEqual(replay.result, {
        id: rm.id,
        status: "reconcile_before_any_send",
      });
      await check(recovery);
      await call(recovery, {
        action: "reconcile-unsent",
        id: rm.id,
        contentHash: rm.content_hash,
        reference:
          "Provider rejected request; draft exists unchanged; no send in flight",
      });
      await assert.rejects(
        call(recovery, {
          action: "claim",
          id: rm.id,
          contentHash: rm.content_hash,
        }),
        /approved/,
      );
      await approve(recovery, rm);
      await check(recovery);
      await call(recovery, {
        action: "claim",
        id: rm.id,
        contentHash: rm.content_hash,
      });
      await check(recovery);
      await call(recovery, {
        action: "reconcile-sent",
        id: rm.id,
        reference: "Complete provider lookup found sent message",
        sender,
        recipient: recovery,
        subject: "Welcome",
        sentAt: new Date().toISOString(),
        messageId: "recovered-send",
        threadId: "recovered-thread",
      });
      const later = await draft(recovery, "followup", "later");
      await approve(recovery, later);
      assert.equal(
        (await acquisitionPipelineReport(pool)).contacts.find(
          (c) => c.email === recovery,
        ).next_action,
        "approved_check_mailbox",
      );

      const paid = await lead("esa-paid");
      await call(paid, {
        action: "record-event",
        kind: "release",
        occurredAt: new Date().toISOString(),
        reason: "Test explicit review",
        nextContactAt: "2020-01-01T12:00:00Z",
      });
      const pm = await draft(paid);
      await approve(paid, pm);
      await check(paid);
      await pool.query(
        "INSERT INTO amp_learners(id,account_id,name) VALUES('paid-child','amp|esa-paid','Learner')",
      );
      const order = {
        id: "paid-order",
        account: { id: "amp|esa-paid" },
        license: { accountId: "amp|esa-paid", learnerId: "paid-child" },
        channel: "esa",
        channelReference: "test",
        externalOrderId: "order-reference",
        settlement: "settled",
      };
      await pool.query(
        "INSERT INTO amp_commerce_orders(id,account_id,learner_id,channel,channel_reference,external_order_id,order_state) VALUES('paid-order','amp|esa-paid','paid-child','esa','test','order-reference',$1)",
        [order],
      );
      await assert.rejects(
        call(paid, {
          action: "claim",
          id: pm.id,
          contentHash: pm.content_hash,
        }),
        /already has access/,
      );
      assert.equal(
        (await acquisitionPipelineReport(pool)).contacts.find(
          (c) => c.email === paid,
        ).next_action,
        "customer",
      );

      const invoice = await lead("invoice-paid");
      await call(invoice, {
        action: "record-event",
        kind: "release",
        occurredAt: new Date().toISOString(),
        reason: "Test explicit review",
        nextContactAt: "2020-01-01T12:00:00Z",
      });
      const im = await draft(invoice);
      await approve(invoice, im);
      await check(invoice);
      await pool.query(
        "INSERT INTO amp_funding_invoice_intents(id,idempotency_key,parent_email,student_billing_name,offer_snapshot,created_at,expires_at,received_payment_at) VALUES('paid-invoice',$1,$2,'Learner','{}',now(),now()+interval '1 day',now())",
        [randomUUID(), invoice],
      );
      await assert.rejects(
        call(invoice, {
          action: "claim",
          id: im.id,
          contentHash: im.content_hash,
        }),
        /already has access/,
      );
      assert.equal(
        (await acquisitionPipelineReport(pool)).contacts.find(
          (c) => c.email === invoice,
        ).has_verified_payment,
        true,
      );
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);

test(
  "migration enrolls existing prospects without rewriting accepted mail, and delayed verification moves the review date",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `outreach_backfill_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const target = new URL(url);
    target.searchParams.set("options", `-c search_path=${schema}`);
    const pool = new Pool({ connectionString: target.href, max: 1 });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      const directory = new URL("../migrations/", import.meta.url);
      for (const name of (await readdir(directory))
        .filter((n) => n.endsWith(".sql") && n < "0072")
        .sort())
        await pool.query(await readFile(new URL(name, directory), "utf8"));
      await pool.query(
        `INSERT INTO amp_auth_users(id,name,email,"emailVerified") VALUES('old','Parent','old@example.com',true)`,
      );
      await pool.query(
        "INSERT INTO amp_parent_followups(user_id,email,program,new_account,notice_version,unsubscribe_token,created_at) VALUES('old','old@example.com','ar-efa',true,'test','test','2026-01-01T20:00:00Z')",
      );
      await pool.query(
        "INSERT INTO amp_parent_followup_outbox(id,user_id,stage,accepted_at,receipt) VALUES($1,'old','welcome','2026-01-01T20:01:00Z','provider-receipt')",
        [randomUUID()],
      );
      await pool.query(
        "INSERT INTO amp_parent_followup_outbox(id,user_id,stage) VALUES($1,'old','reminder')",
        [randomUUID()],
      );
      await pool.query(
        await readFile(
          new URL("0072-acquisition-outreach.sql", directory),
          "utf8",
        ),
      );
      assert.equal(
        (
          await pool.query(
            "SELECT next_contact_at FROM amp_acquisition_contacts",
          )
        ).rows[0].next_contact_at.toISOString(),
        "2026-01-02T18:00:00.000Z",
      );
      await pool.query(
        "UPDATE amp_parent_followups SET verified_at='2026-01-05T20:00:00Z' WHERE user_id='old'",
      );
      assert.equal(
        (
          await pool.query(
            "SELECT next_contact_at FROM amp_acquisition_contacts",
          )
        ).rows[0].next_contact_at.toISOString(),
        "2026-01-06T18:00:00.000Z",
      );
      const outbox = (
        await pool.query(
          "SELECT * FROM amp_parent_followup_outbox ORDER BY stage",
        )
      ).rows;
      assert.equal(
        outbox.find((r) => r.stage === "welcome").receipt,
        "provider-receipt",
      );
      assert.equal(outbox.find((r) => r.stage === "welcome").stopped_at, null);
      assert.equal(
        outbox.find((r) => r.stage === "reminder").stopped_reason,
        "founder-managed",
      );
      await runPipelineCommand(pool, {
        action: "import-sent",
        email: "old@example.com",
        eventKey: "historical",
        purpose: "welcome",
        intentKey: "welcome",
        sender: "founder@example.com",
        recipient: "old@example.com",
        subject: "Hello",
        messageId: "sent-old",
        threadId: "old-thread",
        sentAt: "2026-01-05T22:00:00Z",
      });
      await pool.query(
        "UPDATE amp_acquisition_contacts SET next_contact_at=now()+interval '1 day'",
      );
      assert.equal(
        (await acquisitionPipelineReport(pool)).contacts[0].next_action,
        "await_reply",
      );
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
