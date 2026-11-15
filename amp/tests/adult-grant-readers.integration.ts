import { claimEnrollment } from "../src/billing/stripe/enrollment.js";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { refreshAdultAccess } from "../src/account/adult-access.js";
import { StripeRepository } from "../src/billing/stripe/repository.js";
import { StripeGateway } from "../src/billing/stripe/gateway.js";
import { StripeBilling } from "../src/billing/stripe/service.js";
import { purchaseStatus } from "../src/billing/stripe/purchase.js";
import {
  AccessGiftRepository,
  activateGiftInTransaction,
} from "../src/access-grants/repository.js";
import { fundedTermStart } from "../src/funding-purchase/provision.js";
import { FamilyRepository } from "../src/family/repository.js";
import { config } from "./stripe-fixtures.js";

const DAY = 86400000;
test(
  "adult grant consumers resolve live sources without an account GET",
  {
    skip: !process.env.AMP_TEST_DATABASE_URL,
  },
  async (t) => {
    const schema = `amp_adult_readers_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({
      connectionString: process.env.AMP_TEST_DATABASE_URL,
    });
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(process.env.AMP_TEST_DATABASE_URL!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    const pool = new Pool({ connectionString: url.href });
    const readUrl = new URL(url);
    readUrl.searchParams.set(
      "options",
      `-c search_path=${schema} -c default_transaction_read_only=on`,
    );
    const readPool = new Pool({ connectionString: readUrl.href });
    t.after(async () => {
      await readPool.end();
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    await migrate(url.href);
    const repository = new StripeRepository(pool, config);
    const gateway = new StripeGateway(config);
    let providerCalls = 0;
    gateway.verifyCatalog = async () => {};
    gateway.verifyMerchant = async () => {};
    gateway.createCustomer = async (id) => `cus_fixture_${id}`;
    gateway.createCheckout = async (id) => {
      providerCalls++;
      return {
        id: `cs_fixture_${id}`,
        url: "https://checkout.example.test/synthetic",
      };
    };
    gateway.checkoutStatus = async () => ({
      status: "open",
      url: "https://checkout.example.test/synthetic",
    });
    const billing = new StripeBilling(repository, gateway);
    const readBilling = new StripeBilling(
      new StripeRepository(readPool, config),
      gateway,
    );
    const gifts = new AccessGiftRepository(pool);
    const setup = async (state: string) => {
      const id = randomUUID(),
        account = `amp|${id}`,
        adult = randomUUID(),
        child = randomUUID();
      await pool.query(
        `INSERT INTO amp_auth_users(id,name,email,"emailVerified") VALUES($1,'Adult',$2,true)`,
        [id, `${id}@example.test`],
      );
      await pool.query(
        "INSERT INTO amp_learners(id,account_id,name,adult) VALUES($1,$3,'Adult',true),($2,$3,'Child',false)",
        [adult, child, account],
      );
      const until = new Date(Date.now() + 30 * DAY);
      await pool.query(
        "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,$2,'stripe',$1,'active',now()-interval '1 day',$3)",
        [child, child, until],
      );
      if (state !== "missing") {
        await repository.transaction(account, (db) =>
          refreshAdultAccess(db, account, adult),
        );
        if (state === "expired")
          await pool.query(
            "UPDATE amp_grants SET starts_at=now()-interval '2 days',ends_at=now()-interval '1 day' WHERE learner_id=$1",
            [adult],
          );
        if (state === "extended" || state === "shortened") {
          until.setTime(
            until.getTime() + (state === "extended" ? 20 : -20) * DAY,
          );
          await pool.query("UPDATE amp_grants SET ends_at=$2 WHERE id=$1", [
            child,
            until,
          ]);
        }
        if (state === "revoked")
          await pool.query(
            "UPDATE amp_grants SET status='revoked' WHERE id=$1",
            [child],
          );
      }
      return {
        account,
        adult,
        child,
        until,
        email: `${id}@example.test`,
        eligible: state !== "revoked",
      };
    };
    for (const state of [
      "missing",
      "expired",
      "extended",
      "shortened",
      "revoked",
    ]) {
      await t.test(
        `${state}: billing, gifts and funded scheduling equal a fresh projection`,
        async () => {
          const f = await setup(state);
          const gift = await gifts.issue({
            email: f.email,
            months: 1,
            source: "fixture",
            reference: randomUUID(),
            covers: "learner",
          });
          const before = (
            await pool.query("SELECT * FROM amp_grants WHERE learner_id=$1", [
              f.adult,
            ])
          ).rows;
          // Read-only pool proves billing does not hide repair writes.
          const status = await purchaseStatus(readBilling, f.account, f.adult);
          assert.equal(status.phase, f.eligible ? "licensed" : "ready");
          if (f.eligible) assert.equal(status.endsAt, f.until.toISOString());
          assert.deepEqual(
            (
              await pool.query("SELECT * FROM amp_grants WHERE learner_id=$1", [
                f.adult,
              ])
            ).rows,
            before,
          );
          const activation = new Date(Date.now() + 60000).toISOString();
          const check = async (fresh: boolean) =>
            repository.transaction(f.account, async (db) => {
              await db.query("SAVEPOINT comparison");
              if (fresh) await refreshAdultAccess(db, f.account, f.adult);
              const blocker = (
                await repository.checkoutBlockers(db, f.account, [f.adult])
              ).get(f.adult);
              const start = await fundedTermStart(db, f.adult, activation);
              let giftResult: string;
              try {
                const result = await activateGiftInTransaction(
                  db,
                  f.account,
                  f.adult,
                  { giftId: gift.id },
                );
                assert.equal(result?.learnerId, f.adult);
                giftResult = "activated";
              } catch (error) {
                assert.match(String(error), /learner_already_licensed/);
                giftResult = "learner_already_licensed";
              }
              await db.query("ROLLBACK TO SAVEPOINT comparison");
              return { blocker, start, giftResult };
            });
          const answer = await check(false);
          assert.deepEqual(answer, await check(true));
          assert.deepEqual(answer, {
            blocker: f.eligible ? "learner_already_licensed" : null,
            start: f.eligible ? f.until.toISOString() : activation,
            giftResult: f.eligible ? "learner_already_licensed" : "activated",
          });
          const calls = providerCalls;
          if (f.eligible)
            await assert.rejects(
              billing.checkout(f.account, f.adult, randomUUID()),
              /learner_already_licensed/,
            );
          else
            assert.ok(
              (await billing.checkout(f.account, f.adult, randomUUID())).url,
            );
          assert.equal(providerCalls, calls + (f.eligible ? 0 : 1));
          // Current exports must not present a revoked source as adult access.
          const lines: string[] = [];
          for await (const line of new FamilyRepository(pool).export(f.account))
            lines.push(line);
          const licenses = lines
            .flatMap((line) =>
              line
                .trim()
                .split("\n")
                .map((x) => JSON.parse(x)),
            )
            .filter(
              (row) =>
                row.type === "license" && row.data.learner_id === f.adult,
            );
          assert.equal(
            licenses.some(
              (row) =>
                row.data.status === "active" &&
                Date.parse(row.data.ends_at) > Date.now(),
            ),
            f.eligible,
          );
        },
      );
    }
    await t.test(
      "final checkout rechecks access acquired after reservation",
      async () => {
        const f = await setup("revoked");
        const calls = providerCalls;
        gateway.verifyCatalog = async () => {
          await pool.query(
            "UPDATE amp_grants SET status='active' WHERE id=$1",
            [f.child],
          );
        };
        try {
          await assert.rejects(
            billing.checkout(f.account, f.adult, randomUUID()),
            /learner_already_licensed/,
          );
          assert.equal(providerCalls, calls);
        } finally {
          gateway.verifyCatalog = async () => {};
        }
      },
    );
    await t.test(
      "paid enrollment cannot be assigned over live adult access",
      async () => {
        const f = await setup("missing"),
          checkoutId = randomUUID();
        await pool.query(
          "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','fixture','fixture')",
          [f.account],
        );
        await pool.query(
          "INSERT INTO amp_stripe_checkouts(id,namespace,account_id,learner_id,request_id,customer_id) VALUES($1,$2,$3,NULL,$4,'cus_fixture')",
          [checkoutId, repository.namespace, f.account, randomUUID()],
        );
        await pool.query(
          "INSERT INTO amp_account_entitlements(namespace,invoice_id,checkout_id,payment,status,ends_at) VALUES($1,$2,$3,'{}','active',now()+interval '1 year')",
          [repository.namespace, randomUUID(), checkoutId],
        );
        await assert.rejects(
          claimEnrollment(billing, f.account, checkoutId, f.adult),
          /learner_already_licensed/,
        );
        await repository.transaction(f.account, (db) =>
          refreshAdultAccess(db, f.account, f.adult),
        );
        await assert.rejects(
          claimEnrollment(billing, f.account, checkoutId, f.adult),
          /learner_already_licensed/,
        );
      },
    );
    await t.test(
      "a deleted adult keeps projected history without live access",
      async () => {
        const f = await setup("extended");
        await pool.query(
          "UPDATE amp_learners SET deleted_at=now() WHERE id=$1",
          [f.adult],
        );
        const summary = await new FamilyRepository(readPool).summary(f.account);
        const deleted = summary.learners.find((l) => l.id === f.adult)!;
        assert.equal(deleted.hasAccess, false);
        assert.equal(deleted.access.length, 1);
        const records: {
          type: string;
          data?: { learner_id?: string; status?: string };
        }[] = [];
        for await (const line of new FamilyRepository(pool).export(f.account))
          records.push(JSON.parse(line));
        const history = records.filter(
          (r) => r.type === "license" && r.data?.learner_id === f.adult,
        );
        assert.equal(history.length, 1);
        assert.equal(history[0]!.data!.status, "revoked");
      },
    );
    await t.test(
      "funding follows scheduled direct terms after live adult coverage",
      async () => {
        const f = await setup("missing");
        const nextEnd = new Date(f.until.getTime() + 30 * DAY);
        await pool.query(
          "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,$2,'esa',$1,'active',$3,$4)",
          [randomUUID(), f.adult, f.until, nextEnd],
        );
        const activated = new Date(Date.now() + 60000).toISOString();
        assert.equal(
          await repository.transaction(f.account, (db) =>
            fundedTermStart(db, f.adult, activated),
          ),
          nextEnd.toISOString(),
        );
      },
    );
  },
);
