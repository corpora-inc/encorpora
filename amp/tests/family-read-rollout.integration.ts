import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { backfillFamilyIdentities } from "../scripts/backfill-family-identities.js";
import { listFamilies, familyProjection } from "../src/family/projection.js";
import { readOwnPractice } from "../src/account/adult.js";
import { FamilyRepository } from "../src/family/repository.js";
import { ensureFamilyClass } from "../src/family/family-class.js";

const receipt = "data:family-identities-v1";
test(
  "Family rollout reads and automatic migration",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const admin = new Pool({
      connectionString: process.env.AMP_TEST_DATABASE_URL,
    });
    const schema = `amp_rollout_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(process.env.AMP_TEST_DATABASE_URL!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    await migrate(url.href);
    const db = new Pool({ connectionString: url.href });
    const readUrl = new URL(url);
    readUrl.searchParams.set(
      "options",
      `-c search_path=${schema} -c default_transaction_read_only=on`,
    );
    const readDb = new Pool({ connectionString: readUrl.href });
    t.after(async () => {
      await readDb.end();
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    const child = async (account: string) => {
      const id = randomUUID();
      await db.query(
        "INSERT INTO amp_learners(id,account_id,name,birth_year) VALUES($1,$2,'Child',2017)",
        [id, account],
      );
      return id;
    };
    await t.test(
      "hosted-only ownership discovers and opens a stable family before any backfill",
      async () => {
        const host = "amp|host";
        await child(host);
        const families = new FamilyRepository(db, true);
        const home = await families.transaction(host, (c) =>
          ensureFamilyClass(c, db, host, { converting: false }),
        );
        const parent = "amp|hosted-parent";
        const id = await child(parent);
        await db.query(
          "INSERT INTO amp_people(id,tenant_id,given_name,handle,learner_id,timezone) VALUES($1,$2,'Child','hosted-child',$3,'America/New_York')",
          [randomUUID(), home!.orgId, id],
        );
        await db.query(
          "INSERT INTO amp_enrollments(id,person_id,class_id,role,begin_on) SELECT $1,id,$2,'student',current_date FROM amp_people WHERE learner_id=$3",
          [randomUUID(), home!.classId, id],
        );
        await db.query(
          "INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on) SELECT $1,id,$2,'student',current_date FROM amp_people WHERE learner_id=$3",
          [randomUUID(), home!.orgId, id],
        );
        const before = await listFamilies(readDb, parent);
        assert.equal(before.families.length, 1);
        const place = before.families[0]!;
        assert.equal(place.classId, null);
        assert.equal(place.orgId, null);
        assert.equal(
          (await familyProjection(readDb, parent, place.familyId, true))
            .children[0]!.id,
          id,
        );
        assert.equal(
          (
            await db.query(
              "SELECT 1 FROM amp_family_spaces WHERE account_id=$1",
              [parent],
            )
          ).rowCount,
          0,
        );
        await assert.rejects(
          familyProjection(readDb, host, place.familyId, true),
          { statusCode: 404 },
        );
        await backfillFamilyIdentities(db, 2);
        assert.deepEqual(await listFamilies(readDb, parent), before);
        assert.equal(
          (
            await db.query("SELECT 1 FROM amp_families WHERE account_id=$1", [
              parent,
            ])
          ).rowCount,
          0,
        );
      },
    );
    await t.test(
      "a legacy writer preserves a fallback URL without running backfill first",
      async () => {
        const account = "amp|old-class-writer";
        await child(account);
        const first = (await listFamilies(readDb, account)).families[0]!;
        const { ensureFamilyClass: legacyEnsure } =
          await import("./helpers/legacy-family-class.js");
        await new FamilyRepository(db).transaction(account, (c) =>
          legacyEnsure(c, db, account, { converting: true }),
        );
        const stored = (await listFamilies(readDb, account)).families[0]!;
        assert.equal(stored.familyId, first.familyId);
        assert.notEqual(stored.orgId, first.familyId);
        assert.equal(
          (await familyProjection(readDb, account, first.familyId, true))
            .children.length,
          1,
        );
        // The older identity writer supplies a random UUID. The DB normalizes
        // its first insert, and never changes an identity that already exists.
        const hostedAccount = "amp|old-identity-writer";
        await child(hostedAccount);
        const key = (await listFamilies(readDb, hostedAccount)).families[0]!
          .familyId;
        await db.query(
          "INSERT INTO amp_family_spaces(account_id,id) VALUES($1,$2)",
          [hostedAccount, randomUUID()],
        );
        assert.equal(
          (await listFamilies(readDb, hostedAccount)).families[0]!.familyId,
          key,
        );
      },
    );
    await t.test(
      "legacy paid-consent previews use read-only policy checks",
      async () => {
        const account = "amp|policy-preview";
        await child(account);
        await db.query(
          "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','monetary-transaction','missing-evidence')",
          [account],
        );
        assert.equal(
          (await new FamilyRepository(readDb).summary(account)).consent.status,
          "not-recorded",
        );
      },
    );
    await t.test(
      "discovery plan does not scan 20k unrelated identities",
      async () => {
        await db.query(
          "INSERT INTO amp_family_spaces(account_id,id) SELECT 'amp|unrelated-'||n,md5(n::text)::uuid FROM generate_series(1,20000) n",
        );
        await db.query("ANALYZE amp_family_spaces");
        let sql = "";
        let params: unknown[] = [];
        const query = readDb.query.bind(readDb);
        const capture = {
          query: (...args: any[]) => {
            if (!sql) {
              sql = args[0];
              params = args[1];
            }
            return (query as any)(...args);
          },
        } as Pool;
        await listFamilies(capture, "amp|hosted-parent");
        const plan = (
          await readDb.query(
            `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`,
            params,
          )
        ).rows[0]["QUERY PLAN"][0];
        const scans: any[] = [];
        const visit = (node: any) => {
          if (node["Relation Name"] === "amp_family_spaces") scans.push(node);
          for (const nested of node.Plans ?? []) visit(nested);
        };
        visit(plan.Plan);
        console.log("Family discovery scale plan", JSON.stringify(plan));
        assert.ok(scans.length);
        for (const scan of scans)
          assert.ok(
            ((scan["Actual Rows"] ?? 0) +
              (scan["Rows Removed by Filter"] ?? 0)) *
              scan["Actual Loops"] <
              100,
            `identity work must depend on this account: ${JSON.stringify(scan)}`,
          );
      },
    );
    await t.test(
      "legacy summary reads unrostered children and current adult eligibility without writes or account locks",
      async () => {
        const account = "amp|legacy";
        const id = await child(account);
        const adult = randomUUID();
        await db.query(
          "INSERT INTO amp_learners(id,account_id,name,adult,free_online_used) VALUES($1,$2,'Adult',true,100)",
          [adult, account],
        );
        await db.query(
          "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES('paid',$1,'stripe','paid','active',now()-interval '1 day',now()+interval '1 day')",
          [id],
        );
        const locker = await db.connect();
        try {
          await locker.query("BEGIN");
          await locker.query(
            "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
            [account],
          );
          const summary = await new FamilyRepository(readDb, true).summary(
            account,
          );
          assert.equal(
            summary.learners.find((l) => l.id === adult)!.hasAccess,
            true,
          );
          assert.equal(
            summary.learners.find((l) => l.id === adult)!.access.length,
            1,
          );
          assert.equal(
            (
              await db.query("SELECT 1 FROM amp_families WHERE account_id=$1", [
                account,
              ])
            ).rowCount,
            0,
          );
          assert.equal(
            (
              await db.query("SELECT 1 FROM amp_grants WHERE learner_id=$1", [
                adult,
              ])
            ).rowCount,
            0,
          );
        } finally {
          await locker.query("ROLLBACK");
          locker.release();
        }
        const practice = await readOwnPractice(
          new FamilyRepository(readDb),
          account,
        );
        assert.equal(practice!.learner.active, true);
        assert.ok(practice!.learner.endsAt);
        // Refunds must defeat a stale derived grant without updating it on GET.
        await db.query(
          "UPDATE amp_grants SET status='revoked' WHERE id='paid'",
        );
        await db.query(
          "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,$2,'pilot',$1,'active',now()-interval '1 day',now()+interval '1 day')",
          [`adult:${adult}`, adult],
        );
        assert.equal(
          (await new FamilyRepository(readDb).summary(account)).learners.find(
            (l) => l.id === adult,
          )!.hasAccess,
          false,
        );
        assert.equal(
          (await readOwnPractice(new FamilyRepository(readDb), account))!
            .learner.active,
          false,
        );
        assert.equal(
          (
            await db.query(
              "SELECT ends_at>now() AS active FROM amp_grants WHERE id=$1",
              [`adult:${adult}`],
            )
          ).rows[0].active,
          true,
        );
        const action = await new FamilyRepository(db, true).practiceHere(
          account,
          id,
        );
        assert.ok(action.token);
        assert.equal(
          (
            await db.query("SELECT 1 FROM amp_families WHERE account_id=$1", [
              account,
            ])
          ).rowCount,
          1,
        );
      },
    );
    await t.test(
      "normal migration automatically backfills, receipts completion, and replays safely",
      async () => {
        await db.query("DELETE FROM amp_migrations WHERE name=$1", [receipt]);
        await child("amp|upgrade-parent");
        const blocker = await db.connect();
        try {
          await blocker.query("BEGIN");
          await blocker.query(
            "SELECT pg_advisory_xact_lock(hashtextextended('amp|upgrade-parent',0))",
          );
          await assert.rejects(migrate(url.href), { code: "55P03" });
          assert.equal(
            (
              await db.query("SELECT 1 FROM amp_migrations WHERE name=$1", [
                receipt,
              ])
            ).rowCount,
            0,
          );
        } finally {
          await blocker.query("ROLLBACK");
          blocker.release();
        }
        await migrate(url.href);
        const identity = (
          await db.query(
            "SELECT id FROM amp_family_spaces WHERE account_id='amp|upgrade-parent'",
          )
        ).rows[0];
        assert.ok(identity);
        assert.equal(
          (
            await db.query("SELECT 1 FROM amp_migrations WHERE name=$1", [
              receipt,
            ])
          ).rowCount,
          1,
        );
        await migrate(url.href);
        assert.deepEqual(
          (
            await db.query(
              "SELECT id FROM amp_family_spaces WHERE account_id='amp|upgrade-parent'",
            )
          ).rows[0],
          identity,
        );
      },
    );
  },
);
