import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { cleverSyncCommand } from "../scripts/clever-sync.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerCleverConnection } from "../src/schools/clever/connection.js";
import { syncCleverConnection } from "../src/schools/clever/sync.js";
import { runDueCleverSync } from "../src/schools/clever/worker.js";
import {
  CleverHttpError,
  type CleverEvent,
} from "../src/schools/clever/client.js";
import type { Snapshot, User } from "../src/schools/clever/model.js";

const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };
const D = "a".repeat(24),
  S = "b".repeat(24),
  U1 = "c".repeat(23) + "1",
  U2 = "c".repeat(23) + "2",
  E1 = "e".repeat(23) + "1",
  E2 = "e".repeat(23) + "2";
const student = (id: string, first: string): User => ({
  id,
  district: D,
  name: { first, last: "Fixture" },
  email: null,
  roles: { student: { school: S, schools: [S], grade: "4" } },
});
const roster = (...users: User[]): Snapshot => ({
  district: { id: D, name: "Fixture District" },
  schools: [{ id: S, district: D, name: "Fixture School" }],
  users,
  sections: [],
  courses: [],
  terms: [],
});
const created = (id: string, user: User): CleverEvent => ({
  id,
  type: "users.created",
  created: "2026-11-20T00:00:00Z",
  data: { object: user },
});

async function fixture(
  run: (ctx: {
    db: Pool;
    url: string;
    repo: SchoolRepository;
    district: () => Promise<string>;
  }) => Promise<void>,
) {
  const url = new URL(process.env.AMP_TEST_DATABASE_URL!);
  assertTestDatabaseTarget(url.href);
  const admin = new Pool({ connectionString: url.href, max: 1 });
  const schema = `events_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  url.searchParams.set("options", `-c search_path=${schema}`);
  await migrate(url.href);
  const db = new Pool({ connectionString: url.href, max: 5 });
  try {
    const repo = new SchoolRepository(db);
    const district = async () =>
      (
        await repo.createOrg(
          { kind: "district", name: "Fixture district", timezone: "UTC" },
          { version: "fixture", signerName: "Fixture", signerTitle: "Admin" },
        )
      ).id;
    await run({ db, url: url.href, repo, district });
  } finally {
    await db.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
}
const row = async (db: Pool, id: string) =>
  (await db.query("SELECT * FROM amp_clever_connections WHERE id=$1", [id]))
    .rows[0];

test(
  "a self-connected district has Events on; an operator opt-out survives reconnect",
  enabled,
  () =>
    fixture(async ({ db, url, district }) => {
      const tenant = await district();
      const connected = await registerCleverConnection(db, {
        environment: "sandbox",
        districtId: D,
        tenantId: tenant,
      });
      assert.equal((await row(db, connected.id)).events_enabled, true);

      const env = {
        AMP_DATABASE_URL: url,
        AMP_CLEVER_ENVIRONMENT: "sandbox",
      };
      const optedOutTenant = await district();
      const optedOutDistrict = "f".repeat(24);
      const optedOut = (await cleverSyncCommand(
        ["bind", optedOutDistrict, optedOutTenant, "no-events"],
        env,
      )) as { id: string };
      assert.equal((await row(db, optedOut.id)).events_enabled, false);

      // The district disconnects, then its administrator connects again.
      await db.query(
        "UPDATE amp_clever_connections SET status='disconnected',disconnected_at=now()",
      );
      await registerCleverConnection(db, {
        environment: "sandbox",
        districtId: optedOutDistrict,
        tenantId: optedOutTenant,
      });
      await registerCleverConnection(db, {
        environment: "sandbox",
        districtId: D,
        tenantId: tenant,
      });
      const reconnectedOptOut = await row(db, optedOut.id);
      assert.equal(reconnectedOptOut.status, "active");
      assert.equal(reconnectedOptOut.events_enabled, false);
      assert.equal((await row(db, connected.id)).events_enabled, true);

      // The operator can turn them back on.
      await cleverSyncCommand(
        ["bind", optedOutDistrict, optedOutTenant, "events"],
        env,
      );
      assert.equal((await row(db, optedOut.id)).events_enabled, true);
    }),
);

test(
  "Clever refusing /events falls back to the daily full snapshot, visibly, and recovers",
  enabled,
  (t) =>
    fixture(async ({ db, district }) => {
      const warn = t.mock.method(console, "warn", () => {});
      const { id } = await registerCleverConnection(db, {
        environment: "sandbox",
        districtId: D,
        tenantId: await district(),
      });
      let refuse: number | null = 403;
      let source = roster(student(U1, "Ada"));
      const events: CleverEvent[] = [];
      const client = {
        districtToken: async () => "fixture",
        snapshot: async () => source,
        latestEvent: async () => {
          if (refuse) throw new CleverHttpError(refuse);
          return E1;
        },
        events: async () => {
          if (refuse) throw new CleverHttpError(refuse);
          return events;
        },
      };
      const t0 = new Date("2026-11-20T12:00:00Z");
      const at = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);

      // Full sync: the watermark probe is refused; the roster still imports.
      const first = await syncCleverConnection(db, id, client, { now: t0 });
      assert.equal(first.mode, "full");
      assert.equal(first.events, "unavailable");
      assert.equal(first.counts.users, 1);
      let c = await row(db, id);
      assert.equal(c.events_enabled, true);
      assert.equal(c.events_unavailable_at.toISOString(), t0.toISOString());
      assert.equal(c.event_cursor, null);
      assert.equal(c.events_baseline_at, null);
      assert.equal(c.failure_code, null);
      const runs = (
        await db.query(
          "SELECT status,mode FROM amp_clever_sync_runs WHERE connection_id=$1",
          [id],
        )
      ).rows;
      assert.deepEqual(runs, [{ status: "succeeded", mode: "full" }]);
      assert.equal(warn.mock.callCount(), 1);
      assert.match(
        String(warn.mock.calls[0]!.arguments[0]),
        /Clever Events refused/,
      );
      assert.equal(
        (warn.mock.calls[0]!.arguments[1] as { status: number }).status,
        403,
      );

      // While refused, the worker keeps the daily schedule, not five minutes.
      await db.query(
        "UPDATE amp_clever_connections SET last_sync_at=now()-interval '10 minutes' WHERE id=$1",
        [id],
      );
      assert.equal(await runDueCleverSync(db, id, client), undefined);

      // A later day: Clever allows /events again. The probe establishes the
      // baseline and the five-minute schedule resumes.
      refuse = null;
      const recovered = await syncCleverConnection(db, id, client, {
        now: at(24 * 60),
      });
      assert.equal(recovered.events, "enabled");
      c = await row(db, id);
      assert.equal(c.events_unavailable_at, null);
      assert.equal(c.event_cursor, E1);
      assert.equal(
        c.events_baseline_at.toISOString(),
        at(24 * 60).toISOString(),
      );

      // An Events run that Clever refuses (401 or 403) runs the full snapshot
      // in the same run instead of failing the roster.
      refuse = 401;
      source = roster(student(U1, "Ada"), student(U2, "Grace"));
      const fallback = await syncCleverConnection(db, id, client, {
        now: at(24 * 60 + 5),
      });
      assert.equal(fallback.mode, "full");
      assert.equal(fallback.events, "unavailable");
      assert.equal(fallback.counts.users, 2);
      c = await row(db, id);
      assert.equal(
        c.events_unavailable_at.toISOString(),
        at(24 * 60 + 5).toISOString(),
      );
      assert.equal(c.event_cursor, null);
      assert.equal(c.events_baseline_at, null);
      assert.equal(c.failure_code, null);
      assert.equal(warn.mock.callCount(), 2);
    }),
);

test(
  "the first Events run continues from the watermark taken before the snapshot",
  enabled,
  () =>
    fixture(async ({ db, district }) => {
      const { id } = await registerCleverConnection(db, {
        environment: "sandbox",
        districtId: D,
        tenantId: await district(),
      });
      const calls: string[] = [];
      const client = {
        districtToken: async () => "fixture",
        latestEvent: async () => {
          calls.push("latestEvent");
          return E1;
        },
        // Grace is added in the SIS while the snapshot is being read: the
        // snapshot misses her, the feed has her after the watermark.
        snapshot: async () => {
          calls.push("snapshot");
          return roster(student(U1, "Ada"));
        },
        events: async (_token: string, after: string | null) => {
          calls.push(`events:${after}`);
          return after === E1 ? [created(E2, student(U2, "Grace"))] : [];
        },
      };
      const t0 = new Date("2026-11-20T12:00:00Z");
      const full = await syncCleverConnection(db, id, client, { now: t0 });
      assert.equal(full.mode, "full");
      assert.equal(full.cursor, E1);
      assert.deepEqual(calls, ["latestEvent", "snapshot"]);
      const next = await syncCleverConnection(db, id, client, {
        now: new Date(t0.getTime() + 5 * 60_000),
      });
      assert.equal(next.mode, "events");
      assert.equal(next.cursor, E2);
      assert.equal(next.counts.users, 2);
      assert.deepEqual(calls.slice(2), [`events:${E1}`]);
      const c = await row(db, id);
      assert.equal(c.event_cursor, E2);
      // The baseline stays the full snapshot the feed continues from.
      assert.equal(c.events_baseline_at.toISOString(), t0.toISOString());

      // A district that disconnects and reconnects starts from a full snapshot.
      await db.query(
        "UPDATE amp_clever_connections SET status='disconnected',disconnected_at=now() WHERE id=$1",
        [id],
      );
      await registerCleverConnection(db, {
        environment: "sandbox",
        districtId: D,
        tenantId: (await row(db, id)).tenant_id,
      });
      assert.equal((await row(db, id)).events_baseline_at, null);
      const reconnected = await syncCleverConnection(db, id, client, {
        now: new Date(t0.getTime() + 10 * 60_000),
      });
      assert.equal(reconnected.mode, "full");
    }),
);

test(
  "an empty Events feed is still a baseline: the next run reads the feed from its start",
  enabled,
  () =>
    fixture(async ({ db, district }) => {
      const { id } = await registerCleverConnection(db, {
        environment: "sandbox",
        districtId: D,
        tenantId: await district(),
      });
      const after: (string | null)[] = [];
      let feed: CleverEvent[] = [];
      const client = {
        districtToken: async () => "fixture",
        latestEvent: async () => null,
        snapshot: async () => roster(student(U1, "Ada")),
        events: async (_token: string, cursor: string | null) => {
          after.push(cursor);
          return feed;
        },
      };
      const t0 = new Date("2026-11-20T12:00:00Z");
      const at = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);
      const full = await syncCleverConnection(db, id, client, { now: t0 });
      assert.equal(full.mode, "full");
      assert.equal(full.cursor, null);
      // Without a baseline this district would re-read everything every 5 min.
      const quiet = await syncCleverConnection(db, id, client, { now: at(5) });
      assert.equal(quiet.mode, "events");
      feed = [created(E1, student(U2, "Grace"))];
      const changed = await syncCleverConnection(db, id, client, {
        now: at(10),
      });
      assert.equal(changed.mode, "events");
      assert.equal(changed.counts.users, 2);
      assert.deepEqual(after, [null, null]);
      assert.equal((await row(db, id)).event_cursor, E1);
    }),
);

test(
  "migration 0149 turns Events on for connections stored with the old default",
  enabled,
  () =>
    fixture(async ({ db, district }) => {
      const ids: string[] = [];
      for (const digit of ["1", "2", "3"])
        ids.push(
          (
            await registerCleverConnection(db, {
              environment: "sandbox",
              districtId: digit.repeat(24),
              tenantId: await district(),
            })
          ).id,
        );
      const [active, synced, disconnected] = ids as [string, string, string];
      // Rewind to the schema and data before 0149.
      await db.query(
        `ALTER TABLE amp_clever_connections ALTER COLUMN events_enabled SET DEFAULT false;
        ALTER TABLE amp_clever_connections DROP COLUMN events_baseline_at, DROP COLUMN events_unavailable_at;
        UPDATE amp_clever_connections SET events_enabled=false;`,
      );
      await db.query(
        "UPDATE amp_clever_connections SET events_enabled=true,event_cursor=$2,last_full_sync_at='2026-11-19T00:00:00Z' WHERE id=$1",
        [synced, E1],
      );
      await db.query(
        "UPDATE amp_clever_connections SET status='disconnected',disconnected_at=now() WHERE id=$1",
        [disconnected],
      );
      await db.query(
        await readFile(
          new URL(
            "../migrations/0149-clever-events-default.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      for (const id of ids)
        assert.equal((await row(db, id)).events_enabled, true);
      assert.equal((await row(db, active)).events_baseline_at, null);
      assert.equal(
        (await row(db, synced)).events_baseline_at.toISOString(),
        "2026-11-19T00:00:00.000Z",
      );
      assert.equal(
        (
          await db.query(
            `SELECT column_default FROM information_schema.columns
            WHERE table_schema=current_schema() AND table_name='amp_clever_connections'
              AND column_name='events_enabled'`,
          )
        ).rows[0].column_default,
        "true",
      );
    }),
);
