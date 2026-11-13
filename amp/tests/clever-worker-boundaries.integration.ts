import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
import { z } from "zod";
import { storedAdoptionSnapshot } from "../src/schools/clever/store.js";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import Fastify from "fastify";
import { migrate } from "../scripts/migrate.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerCleverConnection } from "../src/schools/clever/connection.js";
import { registerCleverOnboarding } from "../src/schools/clever-onboarding.js";
import { establishProviderPrincipal } from "../src/identity/provider-principals.js";
import { syncCleverConnection } from "../src/schools/clever/sync.js";
import { runDueCleverSync } from "../src/schools/clever/worker.js";
import { CleverSyncError, type Snapshot } from "../src/schools/clever/model.js";

const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };
const D = "1".repeat(24),
  U = "2".repeat(24);
async function fixture(
  run: (
    db: Pool,
    repo: SchoolRepository,
    id: string,
    orgId: string,
  ) => Promise<void>,
) {
  const url = new URL(process.env.AMP_TEST_DATABASE_URL!);
  const admin = new Pool({ connectionString: url.href });
  const schema = `worker_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  url.searchParams.set("options", `-c search_path=${schema}`);
  await migrate(url.href);
  const db = new Pool({ connectionString: url.href, max: 5 });
  try {
    const repo = new SchoolRepository(db);
    const org = await repo.createOrg(
      { kind: "district", name: "Fixture district", timezone: "UTC" },
      { version: "fixture", signerName: "Fixture", signerTitle: "Admin" },
    );
    const c = await registerCleverConnection(db, {
      environment: "sandbox",
      districtId: D,
      tenantId: org.id,
    });
    await run(db, repo, c.id, org.id);
  } finally {
    await db.end();
    await admin.end();
  }
}
const snapshot: Snapshot = {
  district: { id: D, name: "Fixture" },
  schools: [],
  users: [],
  sections: [],
  courses: [],
  terms: [],
};

test(
  "H3/M2: API sync only queues, requires an admin and throttles the connection",
  enabled,
  () =>
    fixture(async (db, repo, id, orgId) => {
      const login = await establishProviderPrincipal(
        db,
        {
          environment: "sandbox",
          districtId: D,
          userId: U,
          roles: ["teacher"],
          schools: [],
        },
        null,
      );
      let downloads = 0;
      const client = {
        districtToken: async () => "fixture",
        get: async () => {
          throw new Error("unexpected read");
        },
        snapshot: async () => {
          downloads++;
          return snapshot;
        },
        events: async () => [],
        latestEvent: async () => null,
      };
      const app = Fastify();
      await registerCleverOnboarding(app, {
        pool: db,
        authenticate: async () => login.accountId,
        config: {
          environment: "sandbox",
          clientId: "fixture",
          clientSecret: "fixture",
        },
        client,
        worker: false,
      });
      try {
        const post = () =>
          app.inject({
            method: "POST",
            url: "/api/v1/school/clever/sync",
            headers: { authorization: `Bearer ${login.token}` },
          });
        assert.equal((await post()).statusCode, 403);
        await repo.addStaff({
          orgId,
          role: "admin",
          givenName: "Fixture",
          accountId: login.accountId,
        });
        const results = await Promise.all([post(), post()]);
        assert.deepEqual(results.map((r) => r.statusCode).sort(), [202, 429]);
        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.equal(downloads, 0);
        assert.ok(
          (
            await db.query(
              "SELECT sync_requested_at FROM amp_clever_connections WHERE id=$1",
              [id],
            )
          ).rows[0].sync_requested_at,
        );
      } finally {
        await app.close();
      }
    }),
);

test(
  "H4: provider HTTP fetch does not hold the roster apply lock",
  enabled,
  () =>
    fixture(async (db, _repo, id) => {
      let release!: () => void, fetched!: () => void;
      const waiting = new Promise<void>((r) => {
          release = r;
        }),
        entered = new Promise<void>((r) => {
          fetched = r;
        });
      const sync = syncCleverConnection(db, id, {
        districtToken: async () => "fixture",
        snapshot: async () => {
          fetched();
          await waiting;
          return snapshot;
        },
        events: async () => [],
        latestEvent: async () => null,
      });
      await entered;
      const reader = await db.connect();
      try {
        await reader.query("BEGIN");
        const lock = await reader.query(
          "SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS ok",
          [`clever-sync:${id}`],
        );
        await reader.query("COMMIT");
        release();
        await sync;
        assert.equal(lock.rows[0].ok, true);
      } finally {
        release();
        reader.release();
      }
    }),
);

test(
  "H2/M3: worker backs off repeated failures and retains only referenced old runs",
  enabled,
  () =>
    fixture(async (db, _repo, id) => {
      let calls = 0;
      const client = {
        districtToken: async () => "fixture",
        snapshot: async () => {
          calls++;
          throw new Error("fixture_failure");
        },
        events: async () => [],
        latestEvent: async () => null,
      };
      await assert.rejects(runDueCleverSync(db, id, client));
      await runDueCleverSync(db, id, client);
      assert.equal(calls, 1);
      await db.query(
        "UPDATE amp_clever_connections SET next_attempt_at=now()-interval '1 second' WHERE id=$1",
        [id],
      );
      await assert.rejects(runDueCleverSync(db, id, client));
      const failed = (
        await db.query(
          "SELECT failure_count,extract(epoch FROM next_attempt_at-now()) AS seconds FROM amp_clever_connections WHERE id=$1",
          [id],
        )
      ).rows[0];
      assert.equal(failed.failure_count, 2);
      assert.ok(Number(failed.seconds) > 110);
      await db.query(
        "INSERT INTO amp_clever_sync_runs(id,connection_id,mode,status,started_at,finished_at) VALUES($1,$2,'full','succeeded',now()-interval '40 days',now()-interval '40 days')",
        [randomUUID(), id],
      );
      await syncCleverConnection(db, id, {
        ...client,
        snapshot: async () => snapshot,
      });
      assert.equal(
        (
          await db.query(
            "SELECT 1 FROM amp_clever_sync_runs WHERE connection_id=$1 AND finished_at<now()-interval '30 days'",
            [id],
          )
        ).rowCount,
        0,
      );
      const indexes = (
        await db.query(
          "SELECT indexdef FROM pg_indexes WHERE schemaname=current_schema() AND tablename IN ('amp_clever_bindings','amp_clever_memberships','amp_classes')",
        )
      ).rows.map((r) => r.indexdef);
      for (const table of ["amp_clever_bindings", "amp_clever_memberships"])
        assert.ok(
          indexes.some(
            (s) => s.includes(table) && s.includes("(last_seen_run_id)"),
          ),
        );
      assert.ok(
        indexes.some(
          (s) => s.includes("amp_classes") && s.includes("(course_id)"),
        ),
      );
    }),
);

test(
  "M3: all roster run and course foreign keys have supporting indexes",
  enabled,
  () =>
    fixture(async (db) => {
      const definitions = (
        await db.query(
          "SELECT indexdef FROM pg_indexes WHERE schemaname=current_schema()",
        )
      ).rows.map((r) => r.indexdef);
      for (const [table, column] of [
        ["amp_clever_bindings", "last_seen_run_id"],
        ["amp_clever_memberships", "last_seen_run_id"],
        ["amp_classes", "course_id"],
      ])
        assert.ok(
          definitions.some(
            (s) => s.includes(table) && s.includes(`(${column})`),
          ),
          `${table}.${column}`,
        );
    }),
);
test(
  "L8: one empty district-token response cannot disconnect a district",
  enabled,
  () =>
    fixture(async (db, _repo, id) => {
      let reads = 0;
      await syncCleverConnection(db, id, {
        districtToken: async () => {
          if (++reads === 1)
            throw new CleverSyncError("district_not_authorized");
          return "fixture";
        },
        snapshot: async () => snapshot,
        events: async () => [],
        latestEvent: async () => null,
      });
      assert.equal(reads, 2);
      assert.equal(
        (
          await db.query(
            "SELECT status FROM amp_clever_connections WHERE id=$1",
            [id],
          )
        ).rows[0].status,
        "active",
      );
    }),
);

test(
  "H3: paused worker stages source data without provisioning and API previews are school scoped",
  enabled,
  () =>
    fixture(async (db, _repo, id) => {
      const school = "3".repeat(24),
        other = "4".repeat(24),
        student = "5".repeat(24),
        foreign = "6".repeat(24);
      const source: Snapshot = {
        ...snapshot,
        schools: [
          { id: school, district: D, name: "First" },
          { id: other, district: D, name: "Second" },
        ],
        users: [
          {
            id: student,
            district: D,
            name: { first: "Student" },
            roles: { student: { school } },
          },
          {
            id: foreign,
            district: D,
            name: { first: "Other" },
            roles: { student: { school: other } },
          },
        ],
      };
      await db.query(
        "UPDATE amp_clever_connections SET sync_paused=true,sync_requested_at=now() WHERE id=$1",
        [id],
      );
      let downloads = 0;
      await runDueCleverSync(db, id, {
        districtToken: async () => "fixture",
        snapshot: async () => {
          downloads++;
          return source;
        },
        events: async () => [],
        latestEvent: async () => null,
      });
      assert.equal(downloads, 1);
      assert.equal(
        (await db.query("SELECT count(*)::int n FROM amp_people")).rows[0].n,
        0,
      );
      assert.equal((await storedAdoptionSnapshot(db, id)).users.length, 0);
      assert.deepEqual(
        (await storedAdoptionSnapshot(db, id, school)).users.map((u) => u.id),
        [student],
      );
      await runDueCleverSync(db, id, {
        districtToken: async () => {
          throw new Error("not due");
        },
        snapshot: async () => source,
        events: async () => [],
        latestEvent: async () => null,
      });
    }),
);

test(
  "H3: connecting through an API handler never starts a district download",
  enabled,
  () =>
    fixture(async (db) => {
      const user = {
        id: U,
        district: D,
        name: { first: "Fixture" },
        roles: { district_admin: {} },
      };
      const login = await establishProviderPrincipal(
        db,
        {
          environment: "sandbox",
          districtId: D,
          userId: U,
          roles: ["district_admin"],
          schools: [],
        },
        null,
      );
      let downloads = 0;
      const client = {
        districtToken: async () => "fixture",
        get: async <T>(path: string, _token: string, schema: z.ZodType<T>) =>
          schema.parse(path.includes("/users/") ? user : snapshot.district),
        snapshot: async () => {
          downloads++;
          return { ...snapshot, users: [user] };
        },
        events: async () => [],
        latestEvent: async () => null,
      };
      const app = Fastify();
      await registerCleverOnboarding(app, {
        pool: db,
        authenticate: async () => login.accountId,
        config: {
          environment: "sandbox",
          clientId: "fixture",
          clientSecret: "fixture",
        },
        client,
        worker: false,
      });
      try {
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/school/clever/connect",
          headers: { authorization: `Bearer ${login.token}` },
          payload: {
            signerName: "Fixture",
            signerTitle: "Admin",
            agreementVersion: AGREEMENT_VERSION,
            authorized: true,
            timezone: "UTC",
          },
        });
        assert.equal(response.statusCode, 202, response.body);
        await new Promise((r) => setTimeout(r, 100));
        assert.equal(downloads, 0);
      } finally {
        await app.close();
      }
    }),
);
