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

/* A parent's "Allow Colorful" for a child: off, the child is in Calm and
   nobody sets Colorful, by the child's own session (a device handed over
   with "Let Maya practice here") or the parent's; the child's choice is
   kept and applies again when it is on. Every name here is made up. */
test(
  "Allow Colorful for a child: off is Calm for the child, and their choice is kept",
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
      await post("/api/v1/learners", parent, { name: "Maya", birthYear: 2012 })
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

    await t.test(
      "the child chooses until a parent turns Colorful off",
      async () => {
        const child = await handedOver();
        assert.equal(
          (await send(child, { kind: "look", look: "bold" })).statusCode,
          200,
        );
        assert.equal((await state(child)).lookLockedBy, null);
        const off = await send(parent, {
          kind: "allowColorful",
          allowed: false,
        });
        assert.equal(off.statusCode, 200, off.body);
        // Calm, off by the grown-up, and the child's own choice is kept.
        assert.deepEqual(
          [
            off.json().effectiveLook,
            off.json().lookLocked,
            off.json().lookLockedBy,
            off.json().look,
            off.json().colorfulAllowed,
          ],
          ["calm", true, "adult", "bold", false],
        );
      },
    );

    await t.test(
      "off: nobody sets Colorful, by the child's session or the parent's, and only a grown-up has the switch",
      async () => {
        const child = await handedOver();
        const seen = await state(child);
        assert.deepEqual(
          [seen.effectiveLook, seen.lookLocked, seen.lookLockedBy],
          ["calm", true, "adult"],
        );
        const refused = await send(child, { kind: "look", look: "bold" });
        assert.equal(refused.statusCode, 409, refused.body);
        assert.match(refused.json().error, /parent/i);
        assert.equal(
          (await send(parent, { kind: "look", look: "bold" })).statusCode,
          409,
        );
        // The switch is a grown-up's: never the child's own session's.
        assert.equal(
          (await send(child, { kind: "allowColorful", allowed: true }))
            .statusCode,
          403,
        );
        // The lock that came before the switch is no change any more.
        assert.equal(
          (await send(parent, { kind: "lookLock", locked: false })).statusCode,
          400,
        );
        const still = await state(parent);
        assert.deepEqual(
          [still.effectiveLook, still.lookLocked, still.look],
          ["calm", true, "bold"],
        );
      },
    );

    await t.test(
      "on again: the choice the child had made applies at once",
      async () => {
        const on = await send(parent, { kind: "allowColorful", allowed: true });
        assert.equal(on.statusCode, 200, on.body);
        assert.deepEqual(
          [on.json().effectiveLook, on.json().lookLocked, on.json().look],
          ["bold", false, "bold"],
        );
        const child = await handedOver();
        assert.equal(
          (await send(child, { kind: "look", look: "calm" })).statusCode,
          200,
        );
        assert.equal(
          (await send(child, { kind: "look", look: "bold" })).statusCode,
          200,
        );
        assert.equal((await state(parent)).effectiveLook, "bold");
      },
    );

    await t.test(
      "stored before the switch: only a lock on Calm reads as off, and the switch replaces it",
      async () => {
        const stored = async (name: string, look: string, lock: boolean) => {
          const kid = (
            await post("/api/v1/learners", parent, { name, birthYear: 2012 })
          ).json().id as string;
          const p = `/api/v1/learners/${kid}/practice-state`;
          // Make the row, then write it as the earlier lock left it.
          const first = (await get(p, parent)).json();
          const made = await post(p, parent, {
            kind: "look",
            look,
            revision: first.revision,
            requestId: randomUUID(),
          });
          assert.equal(made.statusCode, 200, made.body);
          await db.query(
            `UPDATE amp_practice_settings
             SET state=(state - 'colorfulAllowed') || jsonb_build_object('lookAdultLock',$2::boolean)
             WHERE learner_id=$1`,
            [kid, lock],
          );
          return p;
        };
        const read = async (p: string) => {
          const seen = (await get(p, parent)).json();
          return [seen.effectiveLook, seen.lookLocked, seen.lookLockedBy];
        };
        assert.deepEqual(
          await read(await stored("Colorful held", "bold", true)),
          ["bold", false, null],
        );
        assert.deepEqual(await read(await stored("Calm free", "calm", false)), [
          "calm",
          false,
          null,
        ]);
        const held = await stored("Calm held", "calm", true);
        assert.deepEqual(await read(held), ["calm", true, "adult"]);
        // Turning it on writes the switch and spends the old lock.
        const before = (await get(held, parent)).json();
        const on = await post(held, parent, {
          kind: "allowColorful",
          allowed: true,
          revision: before.revision,
          requestId: randomUUID(),
        });
        assert.equal(on.statusCode, 200, on.body);
        assert.deepEqual(
          [
            on.json().lookLocked,
            on.json().colorfulAllowed,
            on.json().lookAdultLock,
          ],
          [false, true, false],
        );
      },
    );
  },
);
