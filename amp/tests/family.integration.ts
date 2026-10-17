import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import Fastify from "fastify";
import { purgeExpiredPrivacyRecords } from "../src/family/retention.js";
import { FamilyRepository } from "../src/family/repository.js";
import { registerStripeRoutes } from "../src/billing/stripe/routes.js";
import { config as stripeFixtureConfig } from "./stripe-fixtures.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { PostgresRepository } from "../src/server/repository.js";
import { generateProblem } from "../src/math/engine.js";

test(
  "parent lifecycle: ownership, full cursor export, consent races and retained billing tombstones",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const connectionString = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_family_test_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString, max: 1 });
    const pool = new Pool({
      connectionString,
      max: 8,
      options: `-c search_path=${schema}`,
    });
    const scoped = new URL(connectionString);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const learning = new PostgresRepository(scoped.href);
    const app = Fastify();
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      for (const file of [
        "0001.sql",
        "0002-commerce.sql",
        "0003-parent-consent.sql",
        "0004-parent-lifecycle.sql",
      ])
        await pool.query(
          await readFile(
            new URL(`../migrations/${file}`, import.meta.url),
            "utf8",
          ),
        );
      await pool.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('parent','policy','verified','private-proof'),('other','policy','verified','other-proof')",
      );
      const child = await learning.create("parent", "Ada fixture"),
        other = await learning.create("other", "Other private child");
      const family = new FamilyRepository(pool);
      await assert.rejects(
        family.rename("parent", other.id, "Stolen"),
        /learner_not_found/,
      );
      await assert.rejects(
        family.deleteLearning("parent", other.id),
        /learner_not_found/,
      );
      await family.rename("parent", child.id, "New display name");
      assert.equal(
        (await family.summary("parent")).learners[0]!.name,
        "New display name",
      );
      for (let i = 0; i < 205; i++)
        await pool.query(
          "INSERT INTO amp_instances(id,learner_id,content) VALUES($1,$2,$3)",
          [`fixture-${i}`, child.id, JSON.stringify({ privateAnswer: i })],
        );
      await pool.query(
        "INSERT INTO amp_instances(id,learner_id,content) VALUES('foreign',$1,'{\"secret\":\"foreign-answer\"}')",
        [other.id],
      );
      const exportLines = [];
      for await (const line of family.export("parent"))
        exportLines.push(JSON.parse(line));
      assert.equal(
        exportLines.filter((line) => line.type === "problem").length,
        205,
      );
      assert.equal(exportLines.at(-1).type, "complete");
      assert.equal(
        JSON.stringify(exportLines).includes("foreign-answer"),
        false,
      );
      assert.equal(
        JSON.stringify(exportLines).includes("private-proof"),
        false,
      );
      // Abort midway, then acquire the full pool to establish connection cleanup.
      const partial = family.export("parent");
      await partial.next();
      await partial.return(undefined);
      const ticket = await family.issueExportTicket("parent");
      assert.equal(await family.consumeExportTicket(ticket), "parent");
      await assert.rejects(
        family.consumeExportTicket(ticket),
        /export_ticket_expired/,
      );
      await assert.rejects(
        family.consumeExportTicket("bad"),
        /export_ticket_invalid/,
      );
      const expired = await family.issueExportTicket("parent");
      await pool.query(
        "UPDATE amp_export_tickets SET expires_at=now()-interval '1 second'",
      );
      await assert.rejects(
        family.consumeExportTicket(expired),
        /export_ticket_expired/,
      );
      let entered!: () => void, release!: () => void;
      const inside = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const proceed = new Promise<void>((resolve) => {
        release = resolve;
      });
      const writer = learning.transaction("parent", child.id, async (tx) => {
        entered();
        await proceed;
        await tx.saveProblem(generateProblem("count-objects", "race"));
      });
      await inside;
      let withdrawalDone = false;
      const withdrawing = family.withdraw("parent").then(() => {
        withdrawalDone = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 40));
      assert.equal(withdrawalDone, false);
      release();
      await writer;
      await withdrawing;
      await assert.rejects(
        learning.create("parent", "After withdrawal"),
        /consent/,
      );
      await assert.rejects(
        learning.transaction("parent", child.id, async () => {}),
        /consent/,
      );
      assert.equal(
        (await family.summary("parent")).consent.status,
        "withdrawn",
      );
      // Export and correction remain usable by the same authenticated parent.
      await family.rename("parent", child.id, "Corrected display");
      const afterWithdrawal = [];
      for await (const line of family.export("parent"))
        afterWithdrawal.push(line);
      assert.ok(afterWithdrawal.length > 205);
      // Simulate installed Stripe bindings without a remote payment or dependency on migration0005.
      await pool.query(
        "CREATE TABLE amp_stripe_checkouts(id text,account_id text,learner_id text,closed boolean,customer_id text,subscription_id text,session_id text,created_at timestamptz DEFAULT now())",
      );
      await pool.query(
        "INSERT INTO amp_stripe_checkouts(id,account_id,learner_id,closed) VALUES('fixture','parent',$1,false)",
        [child.id],
      );
      await pool.query(
        "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES('paid',$1,'stripe','invoice','active',now(),now()+interval '1 year')",
        [child.id],
      );
      const receipt = await family.deleteLearning("parent", child.id);
      assert.equal(receipt.retainedBillingReferences, 1);
      assert.equal(receipt.billingManagementRequired, true);
      const tombstone = (await family.summary("parent")).learners[0]!;
      assert.equal(tombstone.name, "Deleted learner");
      assert.ok(tombstone.deletedAt);
      assert.equal(tombstone.stripeLinked, true);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*) FROM amp_instances WHERE learner_id=$1",
            [child.id],
          )
        ).rows[0].count,
        "0",
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*) FROM amp_grants WHERE learner_id=$1",
            [child.id],
          )
        ).rows[0].count,
        "1",
      );
      const audit = JSON.stringify(
        (await pool.query("SELECT * FROM amp_privacy_events")).rows,
      );
      assert.equal(audit.includes("Ada fixture"), false);
      assert.equal(audit.includes("Corrected display"), false);
      await pool.query(
        "UPDATE amp_parent_consents SET withdrawn_at=NULL WHERE account_id='parent'",
      );
      await assert.rejects(
        learning.transaction("parent", child.id, async () => {}),
        /Learner not found/,
      );
      assert.equal((await learning.list("parent")).length, 0);
      const newChild = await learning.create("parent", "Temporary learner");
      await family.deleteLearning("parent");
      assert.equal(
        (
          await pool.query("SELECT count(*) FROM amp_learners WHERE id=$1", [
            newChild.id,
          ])
        ).rows[0].count,
        "0",
      );
      assert.equal(
        (await family.summary("parent")).consent.status,
        "withdrawn",
      );
      assert.equal(
        (await family.summary("other")).learners[0]!.name,
        "Other private child",
      );
      const api = await registerFamilyRoutes(app, {
        pool,
        development: true,
        authenticate: async (request) => {
          if (request.headers.authorization !== "Bearer fixture")
            throw Object.assign(new Error("Sign in"), { statusCode: 401 });
          return "parent";
        },
      });
      await registerStripeRoutes(app, {
        pool,
        config: stripeFixtureConfig,
        authenticate: async () => "parent",
      });
      assert.equal(
        (await app.inject({ url: "/api/v1/family" })).statusCode,
        401,
      );
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/family/delete-learning-data",
            headers: { authorization: "Bearer fixture" },
            payload: { confirmation: "yes" },
          })
        ).statusCode,
        400,
      );
      const issued = await app.inject({
        method: "POST",
        url: "/api/v1/family/export-ticket",
        headers: { authorization: "Bearer fixture" },
        payload: {},
      });
      assert.equal(issued.statusCode, 200);
      const cookie = String(issued.headers["set-cookie"]);
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /SameSite=Strict/);
      assert.match(cookie, /Max-Age=60/);
      const downloaded = await app.inject({
        url: "/api/v1/family/export",
        headers: { cookie: cookie.split(";")[0]! },
      });
      assert.equal(downloaded.statusCode, 200);
      assert.match(
        downloaded.headers["content-disposition"] as string,
        /attachment/,
      );
      assert.equal(
        JSON.parse(downloaded.body.trim().split("\n").at(-1)!).type,
        "complete",
      );
      assert.equal(
        (
          await app.inject({
            url: "/api/v1/family/export",
            headers: { cookie: cookie.split(";")[0]! },
          })
        ).statusCode,
        401,
      );
      const revokedTicket = await app.inject({
        method: "POST",
        url: "/api/v1/family/export-ticket",
        headers: { authorization: "Bearer fixture" },
        payload: {},
      });
      const revokeCookie = String(revokedTicket.headers["set-cookie"]).split(
        ";",
      )[0]!;
      const revoked = await app.inject({
        method: "POST",
        url: "/api/v1/family/export/revoke",
        headers: { cookie: revokeCookie },
      });
      assert.equal(revoked.statusCode, 200);
      assert.match(String(revoked.headers["set-cookie"]), /Max-Age=0/);
      assert.equal(
        (
          await app.inject({
            url: "/api/v1/family/export",
            headers: { cookie: revokeCookie },
          })
        ).statusCode,
        401,
      );
      assert.equal((await api.summary("parent")).consent.status, "withdrawn");
      await pool.query(
        "UPDATE amp_privacy_events SET expires_at=now()-interval '1 second' WHERE action='export.started'",
      );
      const retainedBefore = (
        await pool.query("SELECT count(*) FROM amp_grants")
      ).rows[0].count;
      const purged = await purgeExpiredPrivacyRecords(pool);
      assert.ok(purged.expiredExportTickets >= 1);
      assert.ok(purged.expiredPrivacyEvents >= 1);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*) FROM amp_privacy_events WHERE expires_at<=now()",
          )
        ).rows[0].count,
        "0",
      );
      assert.equal(
        (await pool.query("SELECT count(*) FROM amp_grants")).rows[0].count,
        retainedBefore,
      );
    } finally {
      await app.close();
      await learning.close();
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
