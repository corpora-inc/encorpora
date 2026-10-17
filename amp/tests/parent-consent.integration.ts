import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { Pool } from "pg";
import Fastify from "fastify";
import { migrate } from "../scripts/test-database.js";
import { ConsentRepository } from "../src/parent-consent/repository.js";
import { ConsentSecrets, noticeDigest } from "../src/parent-consent/crypto.js";
import { installConsentPolicy } from "../src/parent-consent/policy.js";
import { deliverConsentMail } from "../src/parent-consent/worker.js";
import { registerConsentRoutes } from "../src/parent-consent/routes.js";
import { FamilyRepository } from "../src/family/repository.js";
import { learningConsentActive } from "../src/server/account-access.js";
import { purgeConsentRecords } from "../src/parent-consent/lifecycle.js";
import type { ConsentMail } from "../src/parent-consent/contracts.js";
import { consentFixture as p } from "./parent-consent.fixture.js";
const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };
async function fixture(
  run: (
    pool: Pool,
    r: ConsentRepository,
    mails: ConsentMail[],
  ) => Promise<void>,
) {
  const url = process.env.AMP_TEST_DATABASE_URL!,
    schema = `amp_consent_${randomUUID().replaceAll("-", "")}`,
    admin = new Pool({ connectionString: url, max: 1 });
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  const pool = new Pool({ connectionString: scoped.href, max: 8 });
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    await installConsentPolicy(pool, p);
    await run(
      pool,
      new ConsentRepository(pool, p, new ConsentSecrets(randomBytes(32)), true),
      [],
    );
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
}
const begin = () => ({
  email: "parent@example.com",
  requestId: randomUUID(),
  noticeDigest: noticeDigest(p),
  parentAttestation: true,
});
const binding = {
  provider: "synthetic",
  sender: "notice@example.com",
  credentialFingerprint: "fixture-credential",
};
const transport = (mails: ConsentMail[]) => ({
  binding,
  async send(m: ConsentMail) {
    mails.push(m);
    return { kind: "accepted" as const, receipt: `fixture-${mails.length}` };
  },
});
function ack(mail: ConsentMail) {
  const u = new URL(mail.text.match(/Review and respond: (\S+)/)![1]!);
  const q = new URLSearchParams(u.hash.slice(1));
  return {
    requestId: q.get("consent")!,
    stage: q.get("stage")!,
    token: q.get("token")!,
    noticeDigest: q.get("notice")!,
    parentAttestation: true,
  };
}
async function advance(pool: Pool) {
  await pool.query(
    "UPDATE amp_consent_requests SET confirmation_after=now()-interval '1 minute' WHERE phase='awaiting-confirmation'",
  );
  await pool.query(
    "UPDATE amp_consent_outbox SET available_at=now()-interval '1 minute' WHERE stage='confirmation'",
  );
}
async function active(pool: Pool, account = "parent") {
  const client = await pool.connect();
  try {
    return await learningConsentActive(client, account);
  } finally {
    client.release();
  }
}
test(
  "two explicit responses, exact replay and account binding; clock and delivery never grant access",
  enabled,
  async () =>
    fixture(async (pool, r, mails) => {
      const input = begin();
      await Promise.all([r.begin("parent", input), r.begin("parent", input)]);
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM amp_consent_requests"))
          .rows[0].n,
        1,
      );
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM amp_learners")).rows[0]
          .n,
        0,
      );
      await assert.rejects(
        r.begin("parent", { ...input, email: "other@example.com" }),
        /replay_mismatch/,
      );
      await deliverConsentMail(r, transport(mails));
      assert.equal(mails.length, 1);
      assert.equal(await active(pool), false);
      await assert.rejects(r.acknowledge("foreign", ack(mails[0]!)), /invalid/);
      await r.acknowledge("parent", ack(mails[0]!));
      await r.acknowledge("parent", ack(mails[0]!));
      assert.equal(await deliverConsentMail(r, transport(mails)), false);
      await advance(pool);
      await deliverConsentMail(r, transport(mails));
      assert.equal(await active(pool), false);
      await Promise.all([
        r.acknowledge("parent", ack(mails[1]!)),
        r.acknowledge("parent", ack(mails[1]!)),
      ]);
      assert.equal(await active(pool), true);
      for (const offline of [
        new ConsentRepository(pool, p, r.secrets, false),
        new ConsentRepository(pool, p, null, false),
      ]) {
        const status = await offline.view("parent");
        assert.equal(status.available, false);
        assert.equal(status.consentActive, true);
        assert.equal(status.request?.phase, "active");
      }

      assert.equal(
        (
          await pool.query(
            "SELECT recipient_ciphertext FROM amp_consent_requests",
          )
        ).rows[0].recipient_ciphertext,
        null,
      );
      const family = new FamilyRepository(pool);
      await family.withdraw("parent");
      assert.equal(await active(pool), false);
      await assert.rejects(r.acknowledge("parent", ack(mails[1]!)), /invalid/);
      const output = [];
      for await (const line of family.export("parent")) output.push(line);
      const exported = output.join("");
      assert(exported.includes("consent-enrollment"));
      assert(!exported.includes("email_hash"));
      assert(!exported.includes("recipient_ciphertext"));
      assert(!exported.includes(ack(mails[1]!).token));
    }),
);
test(
  "withdrawal while transport is in flight invalidates late mail, replacement and stale retries",
  enabled,
  async () =>
    fixture(async (pool, r, mails) => {
      await r.begin("parent", begin());
      let release!: () => void;
      let started!: () => void;
      const start = new Promise<void>((resolve) => (started = resolve)),
        hold = new Promise<void>((resolve) => (release = resolve));
      const sending = deliverConsentMail(r, {
        binding,
        async send(m) {
          mails.push(m);
          started();
          await hold;
          return { kind: "accepted", receipt: "late" };
        },
      });
      await start;
      await new FamilyRepository(pool).withdraw("parent");
      release();
      await sending;
      await assert.rejects(r.acknowledge("parent", ack(mails[0]!)), /invalid/);
      assert.equal(
        (await pool.query("SELECT accepted_at FROM amp_consent_outbox")).rows[0]
          .accepted_at,
        null,
      );
      await r.begin("parent", begin());
      await deliverConsentMail(r, transport(mails));
      await r.acknowledge("parent", ack(mails[1]!));
      await new FamilyRepository(pool).deleteLearning("parent");
      await advance(pool);
      assert.equal(await deliverConsentMail(r, transport(mails)), false);
      assert.equal(await active(pool), false);
    }),
);
test(
  "policy changes invalidate active email consent while manually verified consent stays effective",
  enabled,
  async () =>
    fixture(async (pool, r, mails) => {
      await r.begin("parent", begin());
      await deliverConsentMail(r, transport(mails));
      await r.acknowledge("parent", ack(mails[0]!));
      await advance(pool);
      await deliverConsentMail(r, transport(mails));
      await r.acknowledge("parent", ack(mails[1]!));
      await pool.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('manual','v1','verified-video','fixture')",
      );
      await installConsentPolicy(pool, { ...p, enabled: false });
      assert.equal(await active(pool), false);
      assert.equal(await active(pool, "manual"), true);
      assert.equal((await r.view("parent")).request?.phase, "policy-changed");
      assert.equal(
        (await new FamilyRepository(pool).summary("parent")).consent.status,
        "not-recorded",
      );
      await purgeConsentRecords(pool);
      assert.equal((await r.view("parent")).request?.phase, "expired");
      assert(
        (await pool.query("SELECT purge_after FROM amp_consent_requests"))
          .rows[0].purge_after,
      );
      await pool.query(
        "UPDATE amp_consent_requests SET purge_after=now()-interval '1 second'",
      );
      assert.equal(await purgeConsentRecords(pool), 1);
      const marker = (
        await pool.query(
          "SELECT * FROM amp_parent_consents WHERE account_id='parent'",
        )
      ).rows[0];
      assert.equal(marker.verification_method, "parent-withdrawal");
      assert.equal(marker.evidence_reference, "preference-only");
      assert(marker.withdrawn_at);
      assert.equal(await active(pool), false);
      assert.equal(await active(pool, "manual"), true);

      await assert.rejects(r.begin("new-parent", begin()), /unavailable/);
      await assert.rejects(
        r.acknowledge("parent", ack(mails[1]!)),
        /unavailable/,
      );
      assert.equal(
        (await new FamilyRepository(pool).summary("parent")).consent.status,
        "withdrawn",
      );
    }),
);
test(
  "ambiguous delivery retries same logical mail; expiry and withdrawal evidence retention are bounded",
  enabled,
  async () =>
    fixture(async (pool, r, mails) => {
      await r.begin("parent", begin());
      await deliverConsentMail(r, {
        binding,
        async send(m) {
          mails.push(m);
          return { kind: "unknown" };
        },
      });
      await assert.rejects(
        r.acknowledge("parent", ack(mails[0]!)),
        /not_ready/,
      );
      await pool.query("UPDATE amp_consent_outbox SET attempts=8");
      assert.equal(
        (await r.view("parent")).request?.delivery,
        "stopped-unknown",
      );
      assert.equal(await deliverConsentMail(r, transport(mails)), false);
      await pool.query("UPDATE amp_consent_outbox SET attempts=1");
      await pool.query(
        "UPDATE amp_consent_outbox SET available_at=now()-interval '1 minute'",
      );
      await deliverConsentMail(r, transport(mails));
      assert.equal(mails[0]!.idempotencyKey, mails[1]!.idempotencyKey);
      assert.equal(mails[0]!.text, mails[1]!.text);
      await pool.query(
        "UPDATE amp_consent_requests SET expires_at=now()-interval '1 second'",
      );
      await assert.rejects(r.acknowledge("parent", ack(mails[1]!)), /expired/);
      assert.equal(await purgeConsentRecords(pool), 1);
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM amp_consent_outbox"))
          .rows[0].n,
        0,
      );
    }),
);
test(
  "HTTP GET cannot acknowledge, strict POST rejects child fields and disabled enrollment collects nothing",
  enabled,
  async () =>
    fixture(async (pool, r, mails) => {
      const app = Fastify();
      await registerConsentRoutes(app, {
        repository: r,
        authenticate: async (req) =>
          req.headers.authorization === "Bearer fixture"
            ? "parent"
            : Promise.reject(
                Object.assign(new Error("auth"), { statusCode: 401 }),
              ),
      });
      try {
        const headers = { authorization: "Bearer fixture" };
        assert.equal(
          (await app.inject({ url: "/api/v1/consent" })).statusCode,
          401,
        );
        assert.equal(
          (await app.inject({ url: "/api/v1/consent/acknowledge", headers }))
            .statusCode,
          404,
        );
        assert.equal(
          (
            await app.inject({
              method: "POST",
              url: "/api/v1/consent/requests",
              headers,
              payload: { ...begin(), childName: "Forbidden" },
            })
          ).statusCode,
          400,
        );
        assert.equal(
          (
            await app.inject({
              method: "POST",
              url: "/api/v1/consent/requests",
              headers,
              payload: begin(),
            })
          ).statusCode,
          200,
        );
        await deliverConsentMail(r, transport(mails));
        const response = await app.inject({ url: "/api/v1/consent", headers });
        assert(!response.body.includes(ack(mails[0]!).token));
        assert(!response.body.includes("parent@example.com"));
        assert.equal(response.headers["cache-control"], "no-store");
        const disabled = new ConsentRepository(pool, p, r.secrets, false);
        await assert.rejects(disabled.begin("other", begin()), /unavailable/);
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::int n FROM amp_consent_requests WHERE account_id='other'",
            )
          ).rows[0].n,
          0,
        );
      } finally {
        await app.close();
      }
    }),
);

test(
  "reinstalling an older policy never revives its queued or completed requests; changed and expired reads are restartable",
  enabled,
  async () =>
    fixture(async (pool, r, mails) => {
      await r.begin("parent", begin());
      await deliverConsentMail(r, transport(mails));
      const first = ack(mails[0]!);
      await installConsentPolicy(pool, { ...p, enabled: false });
      assert.equal((await r.view("parent")).request?.phase, "policy-changed");
      assert.equal(await deliverConsentMail(r, transport(mails)), false);
      await installConsentPolicy(pool, p);
      assert.equal((await r.view("parent")).request?.phase, "policy-changed");
      await assert.rejects(r.acknowledge("parent", first), /invalid/);
      assert.equal(await deliverConsentMail(r, transport(mails)), false);
      await r.begin("parent", begin());
      assert.equal((await r.view("parent")).request?.phase, "awaiting-initial");
      await pool.query(
        "UPDATE amp_consent_requests SET expires_at=now()-interval '1 second' WHERE phase='awaiting-initial'",
      );
      assert.equal((await r.view("parent")).request?.phase, "expired");
      await installConsentPolicy(pool, {
        ...p,
        review: { ...p.review, expiresAt: "2020-01-01T00:00:00.000Z" },
      });
      assert.equal((await r.view("parent")).available, false);
    }),
);

test(
  "expired delivery lease retries preserve challenge and late worker cannot overwrite the replacement receipt",
  enabled,
  async () =>
    fixture(async (pool, r, mails) => {
      await r.begin("parent", begin());
      let release!: () => void, entered!: () => void;
      const held = new Promise<void>((resolve) => (entered = resolve)),
        resume = new Promise<void>((resolve) => (release = resolve));
      const first = deliverConsentMail(r, {
        binding,
        async send(mail) {
          mails.push(mail);
          entered();
          await resume;
          return { kind: "accepted", receipt: "stale-receipt" };
        },
      });
      await held;
      assert.equal(await deliverConsentMail(r, transport(mails)), false);
      await pool.query(
        "UPDATE amp_consent_outbox SET lease_until=now()-interval '1 second'",
      );
      await deliverConsentMail(r, transport(mails));
      release();
      await first;
      assert.equal(mails.length, 2);
      assert.equal(mails[0]!.idempotencyKey, mails[1]!.idempotencyKey);
      assert.equal(mails[0]!.text, mails[1]!.text);
      assert.equal(
        (await pool.query("SELECT receipt FROM amp_consent_outbox")).rows[0]
          .receipt,
        "fixture-2",
      );
      const old = ack(mails[0]!);
      await r.begin("parent", { ...begin(), email: "replacement@example.com" });
      await assert.rejects(r.acknowledge("parent", old), /invalid/);
      await deliverConsentMail(r, transport(mails));
      assert.equal(mails[2]!.recipient, "replacement@example.com");
      assert.equal(await active(pool), false);
    }),
);

test(
  "dispatch binding commits before external send; retries are exact and credential rotation stops ambiguity",
  enabled,
  async () =>
    fixture(async (pool, r, mails) => {
      await r.begin("parent", begin());
      let release!: () => void, started!: () => void;
      const entered = new Promise<void>((resolve) => (started = resolve)),
        hold = new Promise<void>((resolve) => (release = resolve));
      const sending = deliverConsentMail(r, {
        binding,
        async send(m) {
          mails.push(m);
          started();
          await hold;
          return { kind: "unknown" };
        },
      });
      await entered;
      const row = (
        await pool.query(
          "SELECT first_dispatch_at,delivery_binding,attempts FROM amp_consent_outbox",
        )
      ).rows[0];
      assert.ok(row.first_dispatch_at instanceof Date);
      assert.equal(row.attempts, 1);
      assert.equal(row.delivery_binding.sender, binding.sender);
      assert.equal(
        row.delivery_binding.credentialFingerprint,
        binding.credentialFingerprint,
      );
      assert.equal(
        JSON.stringify(row.delivery_binding).includes("parent@example.com"),
        false,
      );
      assert.equal(await deliverConsentMail(r, transport(mails)), false);
      await assert.rejects(
        pool.query("UPDATE amp_consent_outbox SET first_dispatch_at=now()"),
        /immutable/,
      );
      release();
      await sending;
      await pool.query(
        "UPDATE amp_consent_outbox SET available_at=now()-interval '1 second'",
      );
      await deliverConsentMail(r, {
        binding,
        async send(m) {
          assert.deepEqual(m, mails[0]);
          mails.push(m);
          return { kind: "unknown" };
        },
      });
      const again = (
        await pool.query(
          "SELECT first_dispatch_at,delivery_binding FROM amp_consent_outbox",
        )
      ).rows[0];
      assert.deepEqual(again, {
        first_dispatch_at: row.first_dispatch_at,
        delivery_binding: row.delivery_binding,
      });
      await pool.query(
        "UPDATE amp_consent_outbox SET available_at=now()-interval '1 second'",
      );
      assert.equal(
        await deliverConsentMail(r, {
          binding: { ...binding, credentialFingerprint: "rotated" },
          async send() {
            assert.fail("Changed credentials must not retry an uncertain send");
          },
        }),
        true,
      );
      assert.equal(
        (await r.view("parent")).request?.delivery,
        "stopped-unknown",
      );
      assert.equal(
        (await pool.query("SELECT stopped_reason FROM amp_consent_outbox"))
          .rows[0].stopped_reason,
        "binding-changed",
      );
      assert.equal(await active(pool), false);
    }),
);

test(
  "expired idempotency window and historical attempts stop without external dispatch",
  enabled,
  async () =>
    fixture(async (pool, r) => {
      const input = begin();
      await r.begin("parent", input);
      await pool.query("UPDATE amp_consent_outbox SET attempts=1");
      let calls = 0;
      const mock = {
        binding,
        async send() {
          calls++;
          return { kind: "unknown" as const };
        },
      };
      await deliverConsentMail(r, mock);
      assert.equal(calls, 0);
      assert.equal(
        (await pool.query("SELECT stopped_reason FROM amp_consent_outbox"))
          .rows[0].stopped_reason,
        "historical-unknown",
      );
      await new FamilyRepository(pool).withdraw("parent");
      await r.begin("parent", begin());
      // An aged first boundary is installed before dispatch; no recorded boundary is mutated.
      const record = (
        await pool.query(
          "SELECT r.*,o.id AS outbox_id FROM amp_consent_requests r JOIN amp_consent_outbox o ON o.request_id=r.id WHERE r.phase='awaiting-initial'",
        )
      ).rows[0];
      const { consentMail } = await import("../src/parent-consent/mail.js");
      const { digest } = await import("../src/parent-consent/crypto.js");
      const mail = consentMail(p, {
        id: record.id,
        recipient: r.secrets!.decrypt(record.recipient_ciphertext, record.id),
        token: r.secrets!.token(r.binding(record), "initial"),
        stage: "initial",
        idempotencyKey: `amp-consent:${record.outbox_id}`,
        noticeHash: record.notice_digest,
      });
      await pool.query(
        "UPDATE amp_consent_outbox SET first_dispatch_at=now()-interval '23 hours',delivery_binding=$2,attempts=1 WHERE id=$1",
        [record.outbox_id, { ...binding, payloadDigest: digest(mail) }],
      );
      await deliverConsentMail(r, mock);
      assert.equal(calls, 0);
      assert.equal(
        (
          await pool.query(
            "SELECT stopped_reason FROM amp_consent_outbox WHERE id=$1",
            [record.outbox_id],
          )
        ).rows[0].stopped_reason,
        "retry-window-ended",
      );
    }),
);

test(
  "delivery migration preserves historical ambiguous records and closes their retry boundary",
  enabled,
  async () =>
    fixture(async (pool, r) => {
      await r.begin("parent", begin());
      await pool.query(
        "DROP TRIGGER amp_consent_dispatch_immutable ON amp_consent_outbox; DROP FUNCTION amp_preserve_consent_dispatch(); ALTER TABLE amp_consent_outbox DROP COLUMN first_dispatch_at,DROP COLUMN delivery_binding,DROP COLUMN stopped_at,DROP COLUMN stopped_reason; DELETE FROM amp_migrations WHERE name='0012-consent-delivery.sql'; UPDATE amp_consent_outbox SET attempts=1",
      );
      const before = (
        await pool.query("SELECT id,request_id,stage FROM amp_consent_outbox")
      ).rows;
      await migrate(pool.options.connectionString!);
      const after = (
        await pool.query("SELECT id,request_id,stage FROM amp_consent_outbox")
      ).rows;
      assert.deepEqual(after, before);
      const row = (
        await pool.query(
          "SELECT first_dispatch_at,delivery_binding,stopped_reason FROM amp_consent_outbox",
        )
      ).rows[0];
      assert.deepEqual(row, {
        first_dispatch_at: null,
        delivery_binding: null,
        stopped_reason: "historical-unknown",
      });
      assert.equal(
        (await r.view("parent")).request?.delivery,
        "stopped-unknown",
      );
    }),
);

test(
  "a stalled transport is aborted and cannot hold the worker beyond its deadline",
  enabled,
  async () =>
    fixture(async (pool, r) => {
      await r.begin("parent", begin());
      let aborted = false;
      const started = performance.now();
      await deliverConsentMail(r, {
        binding,
        async send(_mail, { signal }) {
          signal.addEventListener("abort", () => {
            aborted = true;
          });
          return new Promise(() => {});
        },
      });
      assert.equal(aborted, true);
      assert.ok(performance.now() - started < 12000);
      assert.equal(
        (
          await pool.query(
            "SELECT accepted_at,attempts,lease_id FROM amp_consent_outbox",
          )
        ).rows[0].accepted_at,
        null,
      );
      assert.equal(await active(pool), false);
    }),
);

test(
  "definitive first rejection stops; provider conflict stays explicitly uncertain",
  enabled,
  async () =>
    fixture(async (pool, r) => {
      for (const kind of ["rejected", "conflict"] as const) {
        const account = `parent-${kind}`;
        await r.begin(account, begin());
        await deliverConsentMail(r, {
          binding,
          async send() {
            return { kind };
          },
        });
        assert.equal(
          (await r.view(account)).request?.delivery,
          kind === "rejected" ? "rejected" : "stopped-unknown",
        );
        assert.equal(await active(pool, account), false);
      }
      assert.equal(
        await deliverConsentMail(r, {
          binding,
          async send() {
            assert.fail("Terminal deliveries cannot retry");
          },
        }),
        false,
      );
    }),
);
