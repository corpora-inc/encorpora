import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { generateKeyPair, exportPKCS8, exportSPKI } from "jose";
import { migrate } from "../scripts/migrate.js";
import { PostgresRepository } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";
import {
  packSigner,
  verifyPack,
  assertPackAuthorization,
} from "../src/offline/signing.js";
import { registerOfflineRoutes } from "../src/offline/routes.js";
import { OfflineRepository } from "../src/offline/repository.js";
import { FamilyRepository } from "../src/family/repository.js";
import { purgeOfflinePacks } from "../src/offline/retention.js";
const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };
async function fixture() {
  const url = process.env.AMP_TEST_DATABASE_URL!;
  const schema = `amp_offline_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  await migrate(scoped.href);
  const repo = new PostgresRepository(scoped.href);
  const keys = await generateKeyPair("EdDSA", { extractable: true });
  const signer = await packSigner(
    await exportPKCS8(keys.privateKey),
    await exportSPKI(keys.publicKey),
    "test-only",
    "https://offline.example.test/amp",
    new Uint8Array(32).fill(3),
  );
  const offline = new OfflineRepository(repo.pool, signer);
  const authenticate = async (req: { headers: Record<string, unknown> }) =>
    String(req.headers["x-parent"] ?? "parent-a");
  const app = buildApp({ repository: repo, authenticate });
  await registerOfflineRoutes(app, { pool: repo.pool, authenticate, signer });
  const family = new FamilyRepository(repo.pool);
  async function learner(account = "parent-a") {
    await repo.pool.query(
      "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'test','manual','synthetic') ON CONFLICT(account_id) DO NOTHING",
      [account],
    );
    const l = await repo.create(account, "Synthetic learner");
    await repo.pool.query(
      "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,$2,'pilot',$1,'active',now()-interval '1 day',now()+interval '1 year')",
      [randomUUID(), l.id],
    );
    return l.id;
  }
  return {
    repo,
    offline,
    app,
    family,
    keys,
    learner,
    async close() {
      await app.close();
      await repo.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    },
  };
}
test(
  "finite signed packs are owned, canonical, immutable and cannot launder online credit",
  enabled,
  async () => {
    const f = await fixture();
    try {
      const learner = await f.learner(),
        other = await f.learner("parent-b");
      const base = `/api/v1/learners/${learner}/offline-packs`;
      const issue = { requestId: randomUUID() };
      const issued = await f.app.inject({
        method: "POST",
        url: base,
        payload: issue,
      });
      assert.equal(issued.statusCode, 200, issued.body);
      const { packId, signedPack } = issued.json();
      const pack = await verifyPack(signedPack, f.keys.publicKey, "test-only");
      assert.ok(pack.items.length >= 3 && pack.items.length <= 15);
      assert.equal(pack.items.length % 3, 0);
      assert.equal(pack.evidence, "offline-provisional");
      const firstRound = pack.items.slice(0, pack.items.length / 3);
      assert.equal(
        new Set(firstRound.map((i) => i.problem.templateId)).size,
        firstRound.length,
      );
      assert.ok(new Set(firstRound.map((i) => i.strand)).size > 1);
      assert.ok(
        pack.items
          .slice(firstRound.length)
          .every((i) => i.reason === "variant"),
      );
      assert.equal(
        (
          await f.app.inject({ method: "POST", url: base, payload: issue })
        ).json().signedPack,
        signedPack,
      );
      assert.equal(
        (
          await f.app.inject({
            method: "POST",
            url: base,
            payload: { ...issue, responseCapabilities: ["single-choice-v1"] },
          })
        ).statusCode,
        409,
      );
      assert.equal(
        (
          await f.app.inject({
            method: "POST",
            url: base,
            payload: { requestId: randomUUID() },
            headers: { "x-parent": "parent-b" },
          })
        ).statusCode,
        404,
      );
      const item = pack.items[0];
      const attempt = {
        requestId: randomUUID(),
        problemId: item.problem.id,
        response: item.selfCheck.answer,
      };
      assert.equal(
        (
          await f.app.inject({
            method: "POST",
            url: `/api/v1/learners/${learner}/attempts`,
            payload: attempt,
          })
        ).statusCode,
        404,
      );
      const preflight = () =>
        f.app.inject({
          method: "POST",
          url: `${base}/${packId}/preflight`,
          payload: {},
        });
      const authorization = await preflight();
      assert.equal(authorization.statusCode, 200);
      assertPackAuthorization(pack, authorization.json());
      const upload = (attempts: unknown[]) =>
        f.app.inject({
          method: "POST",
          url: `${base}/${packId}/attempts`,
          payload: { attempts },
        });
      const simultaneous = await Promise.all([
        upload([attempt]),
        upload([attempt]),
      ]);
      assert.equal(simultaneous[0].statusCode, 200, simultaneous[0].body);
      assert.equal(
        simultaneous[0].json().results[0].attemptId,
        simultaneous[1].json().results[0].attemptId,
      );
      assert.deepEqual(
        simultaneous.map((r) => r.json().results[0].status).sort(),
        ["accepted", "replay"],
      );
      assert.equal(simultaneous[0].json().results[0].correct, true);
      assert.equal(
        (await upload([{ ...attempt, response: "999999" }])).json().results[0]
          .status,
        "conflict",
      );
      assert.equal(
        (await upload([{ ...attempt, requestId: randomUUID() }])).json()
          .results[0].status,
        "conflict",
      );
      assert.equal(
        (
          await upload([
            {
              ...attempt,
              correct: true,
              assisted: false,
              createdAt: "2026-01-01",
            },
          ])
        ).statusCode,
        400,
      );
      const second = pack.items[1];
      assert.equal(
        (
          await upload([
            {
              requestId: randomUUID(),
              problemId: second.problem.id,
              response: second.selfCheck.answer,
            },
            { ...attempt, response: "999999" },
            {
              requestId: randomUUID(),
              problemId: pack.items[2].problem.id,
              response: "1/0",
            },
          ])
        )
          .json()
          .results.map((r: { status: string }) => r.status)
          .join(","),
        "accepted,conflict,rejected",
      );
      assert.equal(
        (
          await f.repo.pool.query(
            "SELECT count(*)::int AS n FROM amp_offline_attempts",
          )
        ).rows[0].n,
        2,
        "one conflict does not prevent an independent valid queue item",
      );
      const next = (
        await f.app.inject({
          method: "POST",
          url: base,
          payload: { requestId: randomUUID() },
        })
      ).json();
      assert.equal(
        (
          await f.app.inject({
            method: "POST",
            url: `${base}/${next.packId}/attempts`,
            payload: { attempts: [attempt] },
          })
        ).json().results[0].code,
        "problem_not_found",
      );
      assert.equal(
        (
          await f.app.inject({
            method: "POST",
            url: `/api/v1/learners/${other}/offline-packs/${packId}/preflight`,
            headers: { "x-parent": "parent-b" },
            payload: {},
          })
        ).statusCode,
        404,
      );
      assert.equal(
        (
          await f.app.inject({
            method: "POST",
            url: base,
            payload: { requestId: randomUUID() },
          })
        ).statusCode,
        429,
      );
      for (const table of [
        "amp_attempts",
        "amp_instances",
        "amp_skill_evidence",
      ])
        assert.equal(
          (await f.repo.pool.query(`SELECT count(*)::int AS n FROM ${table}`))
            .rows[0].n,
          0,
        );
      await assert.rejects(
        f.repo.pool.query(
          "UPDATE amp_offline_instances SET content='{}' WHERE id=$1",
          [item.problem.id],
        ),
        /immutable/,
      );
      await assert.rejects(
        f.repo.pool.query("UPDATE amp_offline_attempts SET correct=false"),
        /immutable/,
      );
      const exported = [];
      for await (const chunk of f.family.export("parent-a"))
        exported.push(chunk);
      const exportText = exported.join("");
      assert.match(exportText, /offline-provisional-attempt/);
      assert.ok(exportText.includes(item.problem.id));
      assert.ok(!exportText.includes(other));
      await f.family.deleteLearning("parent-a", learner);
      assert.equal(
        (
          await f.repo.pool.query(
            "SELECT count(*)::int AS n FROM amp_offline_packs WHERE learner_id=$1",
            [learner],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await f.repo.pool.query(
            "SELECT count(*)::int AS n FROM amp_offline_attempts",
          )
        ).rows[0].n,
        0,
      );
    } finally {
      await f.close();
    }
  },
);
test(
  "withdrawal then same-policy re-enrollment, changed grants and expired packs cannot revive authority",
  enabled,
  async () => {
    const f = await fixture();
    try {
      const learner = await f.learner();
      const input = {
        requestId: randomUUID(),
        responseCapabilities: [] as [],
        figureCapabilities: [] as [],
      };
      const issued = await f.offline.issue("parent-a", learner, input);
      await f.offline.issue("parent-a", learner, {
        ...input,
        requestId: randomUUID(),
      });
      const before = (
        await f.repo.pool.query(
          "SELECT offline_revision FROM amp_parent_consents WHERE account_id='parent-a'",
        )
      ).rows[0].offline_revision;
      await f.family.withdraw("parent-a");
      await assert.rejects(
        f.offline.preflight("parent-a", learner, issued.packId),
        /consent_required/,
      );
      await f.repo.pool.query(
        "UPDATE amp_parent_consents SET withdrawn_at=NULL WHERE account_id='parent-a'",
      );
      const after = (
        await f.repo.pool.query(
          "SELECT offline_revision FROM amp_parent_consents WHERE account_id='parent-a'",
        )
      ).rows[0].offline_revision;
      assert.notEqual(before, after);
      await assert.rejects(
        f.offline.preflight("parent-a", learner, issued.packId),
        /no_longer_eligible/,
      );
      await assert.rejects(
        f.offline.issue("parent-a", learner, input),
        /no_longer_eligible/,
      );
      const renewed = await f.offline.issue("parent-a", learner, {
        ...input,
        requestId: randomUUID(),
      });
      await f.repo.pool.query(
        "UPDATE amp_grants SET ends_at=ends_at+interval '1 year' WHERE learner_id=$1",
        [learner],
      );
      await assert.rejects(
        f.offline.preflight("parent-a", learner, renewed.packId),
        /no_longer_eligible/,
      );
      // Synthetic historical pack; production immutability prevents changing a real issued expiry.
      const row = (
        await f.repo.pool.query("SELECT * FROM amp_offline_packs WHERE id=$1", [
          renewed.packId,
        ])
      ).rows[0];
      const expiredId = randomUUID();
      await f.repo.pool.query(
        `INSERT INTO amp_offline_packs(id,learner_id,request_id,request_digest,consent_revision,grant_id,grant_start,grant_end,issued_at,expires_at,signed_pack,binding,grant_revision) VALUES($1,$2,$3,'historical',$4,$5,$6,$7,now()-interval '33 days',now()-interval '32 days','synthetic-expired',$8,$9)`,
        [
          expiredId,
          learner,
          randomUUID(),
          row.consent_revision,
          row.grant_id,
          row.grant_start,
          row.grant_end,
          row.binding,
          row.grant_revision,
        ],
      );
      await assert.rejects(
        f.offline.preflight("parent-a", learner, expiredId),
        /no_longer_eligible/,
      );
      assert.equal(await purgeOfflinePacks(f.repo.pool), 1);
      assert.equal(
        (
          await f.repo.pool.query(
            "SELECT count(*)::int AS n FROM amp_offline_packs",
          )
        ).rows[0].n,
        3,
      );
    } finally {
      await f.close();
    }
  },
);
test(
  "a queued upload rechecks consent after the exclusive privacy transaction commits",
  enabled,
  async () => {
    const f = await fixture();
    const blocker = await f.repo.pool.connect();
    try {
      const learner = await f.learner();
      const issued = await f.offline.issue("parent-a", learner, {
        requestId: randomUUID(),
        responseCapabilities: [],
        figureCapabilities: [],
      });
      const pack = await verifyPack(
        issued.signedPack,
        f.keys.publicKey,
        "test-only",
      );
      await blocker.query("BEGIN");
      await blocker.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('parent-a',0))",
      );
      const pending = f.offline.reconcile("parent-a", learner, issued.packId, {
        attempts: [
          {
            requestId: randomUUID(),
            problemId: pack.items[0].problem.id,
            response: pack.items[0].selfCheck.answer,
          },
        ],
      });
      // Observe an actual waiter rather than trusting a sleep to create the race.
      let waiting = false;
      for (let i = 0; i < 100; i++) {
        waiting = !!(
          await blocker.query(
            "SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted",
          )
        ).rowCount;
        if (waiting) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.ok(waiting, "upload must be blocked on the account lock");
      await blocker.query(
        "UPDATE amp_parent_consents SET withdrawn_at=now() WHERE account_id='parent-a'",
      );
      await blocker.query("COMMIT");
      await assert.rejects(pending, /consent_required/);
      assert.equal(
        (
          await f.repo.pool.query(
            "SELECT count(*)::int AS n FROM amp_offline_attempts",
          )
        ).rows[0].n,
        0,
      );
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
      await f.close();
    }
  },
);

test(
  "a grant-lock wait crossing expiry cannot authorize preflight or collect a queued response",
  enabled,
  async () => {
    const f = await fixture();
    const blocker = await f.repo.pool.connect();
    try {
      const learner = await f.learner();
      await f.repo.pool.query(
        "UPDATE amp_grants SET ends_at=clock_timestamp()+interval '2 seconds' WHERE learner_id=$1",
        [learner],
      );
      const issued = await f.offline.issue("parent-a", learner, {
        requestId: randomUUID(),
        responseCapabilities: [],
        figureCapabilities: [],
      });
      const pack = await verifyPack(
        issued.signedPack,
        f.keys.publicKey,
        "test-only",
      );
      await blocker.query("BEGIN");
      await blocker.query(
        "SELECT id FROM amp_grants WHERE learner_id=$1 FOR UPDATE",
        [learner],
      );
      const pid = (await blocker.query("SELECT pg_backend_pid() AS pid"))
        .rows[0].pid;
      const pending = f.offline.reconcile("parent-a", learner, issued.packId, {
        attempts: [
          {
            requestId: randomUUID(),
            problemId: pack.items[0].problem.id,
            response: pack.items[0].selfCheck.answer,
          },
        ],
      });
      let waited = false;
      for (let i = 0; i < 100; i++) {
        waited = !!(
          await blocker.query(
            "SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))",
            [pid],
          )
        ).rowCount;
        if (waited) break;
        await new Promise((r) => setTimeout(r, 10));
      }
      assert.ok(waited);
      while (
        !(
          await blocker.query(
            "SELECT clock_timestamp()>$1::timestamptz AS expired",
            [pack.expiresAt],
          )
        ).rows[0].expired
      )
        await new Promise((r) => setTimeout(r, 25));
      await blocker.query("COMMIT");
      await assert.rejects(pending, /no_longer_eligible/);
      assert.equal(
        (
          await f.repo.pool.query(
            "SELECT count(*)::int AS n FROM amp_offline_attempts",
          )
        ).rows[0].n,
        0,
      );
      await assert.rejects(
        f.offline.preflight("parent-a", learner, issued.packId),
        /no_longer_eligible/,
      );
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
      await f.close();
    }
  },
);
test(
  "revocation and reinstatement cannot revive old packs; retained financial learner purges all offline learning",
  enabled,
  async () => {
    const f = await fixture();
    try {
      const learner = await f.learner();
      const input = {
        requestId: randomUUID(),
        responseCapabilities: [] as [],
        figureCapabilities: [] as [],
      };
      const p = await f.offline.issue("parent-a", learner, input);
      await f.repo.pool.query(
        "UPDATE amp_grants SET status='revoked' WHERE learner_id=$1",
        [learner],
      );
      await assert.rejects(
        f.offline.preflight("parent-a", learner, p.packId),
        /no_longer_eligible/,
      );
      await f.repo.pool.query(
        "UPDATE amp_grants SET status='active' WHERE learner_id=$1",
        [learner],
      );
      await assert.rejects(
        f.offline.preflight("parent-a", learner, p.packId),
        /no_longer_eligible/,
      );
      const next = await f.offline.issue("parent-a", learner, {
        ...input,
        requestId: randomUUID(),
      });
      assert.equal(
        (await f.offline.preflight("parent-a", learner, next.packId)).eligible,
        true,
      );
      await f.repo.pool.query(
        "UPDATE amp_grants SET channel='esa' WHERE learner_id=$1",
        [learner],
      );
      await f.family.deleteLearning("parent-a", learner);
      const tombstone = (
        await f.repo.pool.query(
          "SELECT name,deleted_at FROM amp_learners WHERE id=$1",
          [learner],
        )
      ).rows[0];
      assert.equal(tombstone.name, "Deleted learner");
      assert.ok(tombstone.deleted_at);
      assert.equal(
        (
          await f.repo.pool.query(
            "SELECT count(*)::int AS n FROM amp_offline_packs WHERE learner_id=$1",
            [learner],
          )
        ).rows[0].n,
        0,
      );
      await assert.rejects(
        f.offline.preflight("parent-a", learner, next.packId),
        /learner_not_found/,
      );
    } finally {
      await f.close();
    }
  },
);
test(
  "issuance has no development consent/license bypass and disabled service stays unavailable",
  enabled,
  async () => {
    const f = await fixture();
    try {
      const learner = await f.learner();
      await f.repo.pool.query("DELETE FROM amp_grants WHERE learner_id=$1", [
        learner,
      ]);
      await assert.rejects(
        f.offline.issue("parent-a", learner, {
          requestId: randomUUID(),
          responseCapabilities: [],
          figureCapabilities: [],
        }),
        /license_required/,
      );
      await f.family.withdraw("parent-a");
      await assert.rejects(
        f.offline.issue("parent-a", learner, {
          requestId: randomUUID(),
          responseCapabilities: [],
          figureCapabilities: [],
        }),
        /consent_required/,
      );
      const app = buildApp({
        repository: f.repo,
        authenticate: async () => "parent-a",
        development: true,
      });
      await registerOfflineRoutes(app, {
        pool: f.repo.pool,
        authenticate: async () => "parent-a",
        signer: null,
      });
      try {
        assert.equal(
          (
            await app.inject({
              method: "POST",
              url: `/api/v1/learners/${learner}/offline-packs`,
              payload: { requestId: randomUUID() },
            })
          ).statusCode,
          503,
        );
        const url = `/api/v1/learners/${learner}/offline-packs`;
        const malformed = await app.inject({
          method: "POST",
          url,
          headers: { "content-type": "application/json" },
          payload: "{",
        });
        assert.equal(malformed.statusCode, 400);
        assert.equal(malformed.json().error, "invalid_offline_request");
        const oversized = await app.inject({
          method: "POST",
          url,
          payload: { requestId: "x".repeat(40 * 1024) },
        });
        assert.equal(oversized.statusCode, 413);
        assert.equal(oversized.json().error, "request_too_large");
        let limited = false;
        for (let i = 0; i < 185; i++) {
          const response = await app.inject({
            method: "POST",
            url,
            payload: { requestId: randomUUID() },
          });
          if (response.statusCode === 429) {
            assert.equal(response.json().error, "rate_limited");
            limited = true;
            break;
          }
        }
        assert.ok(
          limited,
          "global rate limit must survive scoped error translation",
        );
      } finally {
        await app.close();
      }
    } finally {
      await f.close();
    }
  },
);

test(
  "receipt storage and issuance history remain bounded across invalidation",
  enabled,
  async () => {
    const f = await fixture();
    try {
      const learner = await f.learner();
      const issue = () =>
        f.offline.issue("parent-a", learner, {
          requestId: randomUUID(),
          responseCapabilities: [],
          figureCapabilities: [],
        });
      const first = await issue();
      const pack = await verifyPack(
        first.signedPack,
        f.keys.publicKey,
        "test-only",
      );
      const invalid = {
        requestId: randomUUID(),
        problemId: pack.items[0].problem.id,
        response: "1/0",
      };
      const rejected = await f.offline.reconcile(
        "parent-a",
        learner,
        first.packId,
        { attempts: [invalid] },
      );
      assert.equal(rejected.results[0].code, "invalid_response");
      assert.equal(
        (
          await f.offline.reconcile("parent-a", learner, first.packId, {
            attempts: [invalid],
          })
        ).results[0].replayed,
        true,
      );
      for (let n = 1; n < 60; n += 15)
        await f.offline.reconcile("parent-a", learner, first.packId, {
          attempts: Array.from({ length: Math.min(15, 60 - n) }, () => ({
            ...invalid,
            requestId: randomUUID(),
          })),
        });
      assert.equal(
        (
          await f.repo.pool.query(
            "SELECT count(*)::int AS n FROM amp_offline_receipts",
          )
        ).rows[0].n,
        60,
      );
      const exhausted = await f.offline.reconcile(
        "parent-a",
        learner,
        first.packId,
        {
          attempts: [
            {
              ...invalid,
              requestId: randomUUID(),
              response: pack.items[0].selfCheck.answer,
            },
          ],
        },
      );
      assert.equal(exhausted.results[0].code, "receipt_limit");
      assert.equal(
        (
          await f.repo.pool.query(
            "SELECT count(*)::int AS n FROM amp_offline_receipts",
          )
        ).rows[0].n,
        60,
      );
      for (let n = 1; n < 4; n++) {
        await f.repo.pool.query(
          "UPDATE amp_grants SET status='active' WHERE learner_id=$1",
          [learner],
        );
        await issue();
      }
      await f.repo.pool.query(
        "UPDATE amp_grants SET status='active' WHERE learner_id=$1",
        [learner],
      );
      await assert.rejects(issue(), /pack_limit/);
    } finally {
      await f.close();
    }
  },
);
