import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import Fastify from "fastify";
import { migrate } from "../scripts/migrate.js";
import {
  AccessGiftRepository,
  availableGift,
} from "../src/access-grants/repository.js";
import { registerAccessGiftRoutes } from "../src/access-grants/routes.js";
import { PostgresRepository } from "../src/server/repository.js";
import { FamilyRepository } from "../src/family/repository.js";
import { registerFamilyRoutes } from "../src/family/routes.js";

test(
  "email gifts: verified discovery, consent, single assignment, privacy and paid access",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_gifts_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const learning = new PostgresRepository(scoped.href);
    const db = learning.pool;
    const gifts = new AccessGiftRepository(db);
    const families = new FamilyRepository(db);
    const app = Fastify();
    const authenticate = async (request: {
      headers: { authorization?: string };
    }) => {
      if (!request.headers.authorization?.startsWith("Bearer amp|"))
        throw Object.assign(new Error("unauthorized"), { statusCode: 401 });
      return request.headers.authorization.slice(7);
    };
    const account = async (name: string, consent = true, verified = true) => {
      await db.query(
        'INSERT INTO amp_auth_users(id,email,"emailVerified",name) VALUES($1,$2,$3,$1)',
        [name, `${name}@example.test`, verified],
      );
      const id = `amp|${name}`;
      if (consent)
        await db.query(
          "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','reviewed-fixture','synthetic-evidence')",
          [id],
        );
      return id;
    };
    const learner = async (owner: string) => {
      const id = randomUUID();
      await db.query(
        "INSERT INTO amp_learners(id,account_id,name,birth_year) VALUES($1,$2,'Fixture learner',2012)",
        [id, owner],
      );
      return id;
    };
    const issue = (email: string, months: 1 | 12 = 12, extra = {}) =>
      gifts.issue({ email, months, reference: randomUUID(), ...extra });
    const snapshot = async (id: string) =>
      (
        await app.inject({
          url: "/api/v1/me",
          headers: { authorization: `Bearer ${id}` },
        })
      ).json();
    const exported = async (id: string) => {
      const rows: string[] = [];
      for await (const row of families.export(id)) rows.push(row);
      return rows.join("");
    };
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      await registerAccessGiftRoutes(app, { pool: db, authenticate });
      await registerFamilyRoutes(app, { pool: db, authenticate });
      await t.test(
        "reserved before signup, hidden until verified; no fake consent; safe issuer retries",
        async () => {
          const reference = randomUUID();
          const gift = await issue("Invited@example.test", 12, { reference });
          assert.equal(
            (await issue("invited@example.test", 12, { reference })).id,
            gift.id,
          );
          await assert.rejects(
            issue("other@example.test", 12, { reference }),
            /gift_reference_conflict/,
          );
          const owner = await account("invited", false, false);
          assert.equal((await snapshot(owner)).availableAccessGrant, undefined);
          const child = await learner(owner);
          await assert.rejects(
            gifts.activate(owner, gift.id, child),
            /email_unconfirmed/,
          );
          await db.query(
            'UPDATE amp_auth_users SET "emailVerified"=true WHERE id=$1',
            ["invited"],
          );
          const me = await snapshot(owner);
          assert.equal(me.availableAccessGrant.id, gift.id);
          assert.equal(me.next, "accept-gift");
          assert.equal(me.consent.status, "none");
          assert.match(await exported(owner), new RegExp(gift.id));
          await assert.rejects(
            gifts.activate(owner, gift.id, child),
            /consent_required/,
          );
          await assert.rejects(learning.create(owner, "No consent"), /consent/);
          assert.equal(
            (await db.query("SELECT count(*) FROM amp_grants")).rows[0].count,
            "0",
          );
        },
      );
      await t.test(
        "first learner gets the gift atomically; repeats cannot add time or license siblings",
        async () => {
          const owner = await account("automatic");
          const gift = await issue("automatic@example.test");
          const first = await learning.create(owner, "First", 2012);
          const firstGrant = await gifts.activate(owner, gift.id, first.id);
          assert.ok(firstGrant);
          const second = await learning.create(owner, "Second", 2015);
          await assert.rejects(
            gifts.activate(owner, gift.id, second.id),
            /gift_already_assigned/,
          );
          assert.deepEqual(
            await gifts.activate(owner, gift.id, first.id),
            firstGrant,
          );
          assert.equal(
            (
              await db.query(
                "SELECT count(*) FROM amp_grants WHERE learner_id=$1",
                [second.id],
              )
            ).rows[0].count,
            "0",
          );
          const me = await snapshot(owner);
          assert.equal(me.next, "practice");
          assert.equal(me.availableAccessGrant, undefined);
          assert.equal(
            me.learners.find((l: { id: string }) => l.id === first.id)
              .entitlement.active,
            true,
          );
          assert.equal(
            (await db.query("SELECT count(*) FROM amp_account_entitlements"))
              .rows[0].count,
            "0",
            "a gift is not a purchase",
          );
          const stranger = await account("stranger");
          assert.doesNotMatch(await exported(stranger), new RegExp(gift.id));
          await assert.rejects(
            gifts.activate(stranger, gift.id, await learner(stranger)),
            /gift_unavailable/,
          );
          // A later address change keeps the activated license bound to its account.
          await db.query(
            "UPDATE amp_auth_users SET email='changed@example.test' WHERE id='automatic'",
          );
          assert.deepEqual(
            await gifts.activate(owner, gift.id, first.id),
            firstGrant,
          );
        },
      );
      await t.test(
        "two racing learners can activate only one gift; same-learner retries agree",
        async () => {
          const owner = await account("race");
          const gift = await issue("race@example.test", 1);
          const ids = await Promise.all([learner(owner), learner(owner)]);
          const race = await Promise.allSettled(
            ids.map((id) => gifts.activate(owner, gift.id, id)),
          );
          assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
          const won = race.find(
            (r) => r.status === "fulfilled",
          )! as PromiseFulfilledResult<
            NonNullable<Awaited<ReturnType<typeof gifts.activate>>>
          >;
          const retry = await Promise.all(
            Array.from({ length: 6 }, () =>
              gifts.activate(owner, gift.id, won.value.learnerId),
            ),
          );
          for (const result of retry) assert.deepEqual(result, won.value);
          assert.equal(
            (
              await db.query(
                "SELECT count(*) FROM amp_grants WHERE external_order_id=$1",
                [`email-gift:${gift.id}`],
              )
            ).rows[0].count,
            "1",
          );
        },
      );
      await t.test(
        "expired/revoked gifts and withdrawn consent do not grant access",
        async () => {
          const owner = await account("revoked");
          const id = await learner(owner);
          const expired = await issue("revoked@example.test", 1, {
            claimBy: "2000-01-01T00:00:00Z",
          });
          assert.equal(await availableGift(db, owner), undefined);
          await assert.rejects(
            gifts.activate(owner, expired.id, id),
            /gift_unavailable/,
          );
          const pending = await issue("revoked@example.test");
          await gifts.revoke(pending.id);
          await assert.rejects(
            gifts.activate(owner, pending.id, id),
            /gift_unavailable/,
          );
          const active = await issue("revoked@example.test");
          await gifts.activate(owner, active.id, id);
          await gifts.revoke(active.id);
          await gifts.revoke(active.id);
          assert.equal(
            (await snapshot(owner)).learners[0].entitlement.active,
            false,
          );
          const next = await issue("revoked@example.test");
          await families.withdraw(owner);
          await assert.rejects(
            gifts.activate(owner, next.id, id),
            /consent_required/,
          );
        },
      );
      await t.test(
        "paid access and open checkouts are never replaced, even between renewal terms",
        async () => {
          const owner = await account("paid");
          const id = await learner(owner);
          const gift = await issue("paid@example.test");
          await db.query(
            "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,$2,'stripe',$1,'active',now(),now()+interval '1 month')",
            [randomUUID(), id],
          );
          await assert.rejects(
            gifts.activate(owner, gift.id, id),
            /learner_already_licensed/,
          );
          await db.query(
            "UPDATE amp_grants SET starts_at=now()-interval '2 months',ends_at=now()-interval '1 month' WHERE learner_id=$1",
            [id],
          );
          const checkoutId = randomUUID();
          await db.query(
            "INSERT INTO amp_stripe_checkouts(id,namespace,account_id,learner_id,request_id) VALUES($1,'fixture',$2,$3,$4)",
            [checkoutId, owner, id, randomUUID()],
          );
          await assert.rejects(
            gifts.activate(owner, gift.id, id),
            /learner_already_licensed/,
          );
          assert.equal((await availableGift(db, owner))?.id, gift.id);
          await db.query(
            "UPDATE amp_stripe_checkouts SET closed=true WHERE id=$1",
            [checkoutId],
          );
          assert.ok(await gifts.activate(owner, gift.id, id));
        },
      );
      await t.test(
        "paid unassigned enrollments keep their assignment flow and leave the gift reserved",
        async () => {
          const owner = await account("purchase");
          const gift = await issue("purchase@example.test");
          const checkout = randomUUID();
          await db.query(
            "INSERT INTO amp_stripe_checkouts(id,namespace,account_id,request_id,learner_id,billing_interval) VALUES($1,'fixture',$2,$3,NULL,'year')",
            [checkout, owner, randomUUID()],
          );
          await db.query(
            "INSERT INTO amp_account_entitlements(namespace,invoice_id,checkout_id,payment,status,ends_at) VALUES('fixture','fixture-invoice',$1,'{}','active',now()+interval '1 year')",
            [checkout],
          );
          const child = await learning.create(owner, "Purchased", 2014);
          assert.equal(
            (
              await db.query(
                "SELECT count(*) FROM amp_grants WHERE learner_id=$1",
                [child.id],
              )
            ).rows[0].count,
            "0",
          );
          assert.equal((await availableGift(db, owner))?.id, gift.id);
        },
      );
      await t.test(
        "adoption preserves trial identity and progress; deletion cannot recreate the award",
        async () => {
          const owner = await account("adoption");
          const trial = await learning.createTrial(2012);
          await db.query(
            "UPDATE amp_learners SET starting_band='6–8',starting_policy=1,starting_excluded_strands=ARRAY[]::text[] WHERE id=$1",
            [trial.learnerId],
          );
          const gift = await issue("adoption@example.test");
          const adopted = await learning.adoptTrial(
            owner,
            trial.token,
            "Learner",
          );
          assert.equal(adopted.id, trial.learnerId);
          assert.equal(adopted.birthYear, 2012);
          assert.equal(
            (
              await db.query(
                "SELECT starting_band FROM amp_learners WHERE id=$1",
                [adopted.id],
              )
            ).rows[0].starting_band,
            "6–8",
          );
          assert.deepEqual(
            await learning.adoptTrial(owner, trial.token, "Ignored retry"),
            adopted,
          );
          assert.ok((await snapshot(owner)).learners[0].entitlement.active);
          await families.deleteLearning(owner, adopted.id);
          const row = (
            await db.query("SELECT * FROM amp_access_gifts WHERE id=$1", [
              gift.id,
            ])
          ).rows[0];
          assert.ok(row.activated_at);
          assert.equal(row.learner_id, null);
          assert.equal(row.grant_id, null);
          assert.equal(await availableGift(db, owner), undefined);
          await assert.rejects(
            gifts.activate(owner, gift.id, await learner(owner)),
            /gift_already_assigned/,
          );
          assert.match(await exported(owner), new RegExp(gift.id));
        },
      );
      await t.test(
        "API rejects signed-out, forged recipients and foreign learners; activation is uncached",
        async () => {
          const owner = await account("api");
          const gift = await issue("api@example.test");
          const id = await learner(owner);
          const path = `/api/v1/access-grants/${gift.id}/activate`;
          assert.equal(
            (
              await app.inject({
                method: "POST",
                url: path,
                payload: { learnerId: id },
              })
            ).statusCode,
            401,
          );
          assert.equal(
            (
              await app.inject({
                method: "POST",
                url: path,
                headers: { authorization: `Bearer ${owner}` },
                payload: { learnerId: id, email: "api@example.test" },
              })
            ).statusCode,
            400,
          );
          const foreign = await learner("amp|stranger");
          assert.equal(
            (
              await app.inject({
                method: "POST",
                url: path,
                headers: { authorization: `Bearer ${owner}` },
                payload: { learnerId: foreign },
              })
            ).statusCode,
            404,
          );
          const response = await app.inject({
            method: "POST",
            url: path,
            headers: { authorization: `Bearer ${owner}` },
            payload: { learnerId: id },
          });
          assert.equal(response.statusCode, 200, response.body);
          assert.equal(response.headers["cache-control"], "no-store");
        },
      );
    } finally {
      await app.close();
      await learning.close();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
