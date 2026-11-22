import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

/* A parent's lock on a child's look: it holds against the child's own
   session (a device handed over with "Let Maya practice here"), never
   against the parent's. Every name here is made up. */
test(
  "look lock: a parent holds a child's look; the child can't change it",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_look_lock_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href);
    const db = learning.pool;
    const authenticate = refuseStudentTokens(async (request) => {
      const header = request.headers.authorization;
      if (header?.startsWith("Bearer amp|")) return header.slice(7);
      throw new ApiError(401, "Sign in to continue");
    });
    const app = buildApp({ repository: learning, authenticate });
    await registerFamilyRoutes(app, { pool: db, authenticate });
    await registerSchoolRoutes(app, { pool: db, authenticate });
    await app.ready();
    t.after(async () => {
      await app.close();
      await learning.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    const as = (credential: string) => ({
      authorization: `Bearer ${credential}`,
    });
    const get = (path: string, credential: string) =>
      app.inject({ method: "GET", url: path, headers: as(credential) });
    const post = (path: string, credential: string, payload: object = {}) =>
      app.inject({
        method: "POST",
        url: path,
        headers: as(credential),
        payload,
      });

    const id = randomUUID();
    await db.query(
      `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
       VALUES($1,'Marisol Fixture',$2,true,now(),now())`,
      [id, `${id}@family.example`],
    );
    const parent = `amp|${id}`;
    await db.query(
      "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'policy','verified','fixture-proof')",
      [parent],
    );
    const maya = (
      await post("/api/v1/learners", parent, { name: "Maya", birthYear: 2016 })
    ).json().id as string;
    await db.query(
      `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
       VALUES($1,$2,'stripe',$1,'active',now()-interval '1 day',now()+interval '300 days')`,
      [`fixture:${maya}`, maya],
    );
    const path = `/api/v1/learners/${maya}/practice-state`;
    const state = async (credential: string) =>
      (await get(path, credential)).json() as {
        revision: number;
        look: string | null;
        effectiveLook: string;
        lookLocked: boolean;
        lookLockedBy: string | null;
      };
    const send = async (credential: string, body: object) =>
      post(path, credential, {
        ...body,
        revision: (await state(credential)).revision,
        requestId: randomUUID(),
      });
    /** "Let Maya practice here": the child's own session on the device. */
    const handedOver = async () => {
      const here = await post(
        `/api/v1/family/learners/${maya}/practice-here`,
        parent,
      );
      assert.equal(here.statusCode, 201, here.body);
      return here.json().token as string;
    };

    await t.test("the child chooses until a parent locks", async () => {
      const child = await handedOver();
      assert.equal(
        (await send(child, { kind: "look", look: "bold" })).statusCode,
        200,
      );
      assert.equal((await state(child)).lookLockedBy, null);
      const locked = await send(parent, { kind: "lookLock", locked: true });
      assert.equal(locked.statusCode, 200, locked.body);
      assert.deepEqual(
        [
          locked.json().effectiveLook,
          locked.json().lookLocked,
          locked.json().lookLockedBy,
        ],
        ["bold", true, "adult"],
      );
    });

    await t.test(
      "locked: the handed-over child is refused, the parent is not",
      async () => {
        const child = await handedOver();
        const seen = await state(child);
        assert.deepEqual(
          [seen.effectiveLook, seen.lookLocked, seen.lookLockedBy],
          ["bold", true, "adult"],
        );
        const refused = await send(child, { kind: "look", look: "calm" });
        assert.equal(refused.statusCode, 409, refused.body);
        assert.match(refused.json().error, /parent/);
        assert.equal(
          (await send(child, { kind: "look", look: null })).statusCode,
          409,
        );
        // Only a grown-up holds or frees it.
        assert.equal(
          (await send(child, { kind: "lookLock", locked: false })).statusCode,
          403,
        );
        assert.equal((await state(parent)).lookLocked, true);
        // The parent, outside child mode, changes it and it stays held.
        const changed = await send(parent, { kind: "look", look: "calm" });
        assert.equal(changed.statusCode, 200, changed.body);
        assert.deepEqual(
          [changed.json().effectiveLook, changed.json().lookLockedBy],
          ["calm", "adult"],
        );
        assert.equal((await state(child)).effectiveLook, "calm");
      },
    );

    await t.test(
      "locking with no look chosen holds what the child sees",
      async () => {
        const sam = (
          await post("/api/v1/learners", parent, {
            name: "Sam",
            birthYear: 2015,
          })
        ).json().id as string;
        const p = `/api/v1/learners/${sam}/practice-state`;
        const before = (await get(p, parent)).json();
        assert.equal(before.look, null);
        const locked = await post(p, parent, {
          kind: "lookLock",
          locked: true,
          revision: before.revision,
          requestId: randomUUID(),
        });
        assert.equal(locked.statusCode, 200, locked.body);
        assert.deepEqual(
          [locked.json().look, locked.json().lookLockedBy],
          ["calm", "adult"],
        );
      },
    );

    await t.test("unlocked, the child has full control again", async () => {
      const unlocked = await send(parent, { kind: "lookLock", locked: false });
      assert.equal(unlocked.statusCode, 200, unlocked.body);
      assert.equal(unlocked.json().lookLocked, false);
      const child = await handedOver();
      assert.equal(
        (await send(child, { kind: "look", look: "bold" })).statusCode,
        200,
      );
      assert.equal((await state(parent)).effectiveLook, "bold");
    });
  },
);
