import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { PostgresRepository } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";
import {
  accountsAuth,
  createAccounts,
  registerAccountRoutes,
} from "../src/server/accounts.js";
import {
  completeSignup,
  createSignupIntent,
  unsubscribe,
} from "../src/parent-followup/repository.js";
import {
  accountNotice,
  signupNotice,
} from "../src/parent-followup/contracts.js";

const options = { skip: !process.env.AMP_TEST_DATABASE_URL };
const hex64 = /^[a-f0-9]{64}$/;

async function scopedDatabase(prefix: string) {
  const url = process.env.AMP_TEST_DATABASE_URL!;
  const schema = `${prefix}_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  await admin.query(`CREATE SCHEMA ${schema}`);
  await migrate(scoped.href);
  return {
    href: scoped.href,
    async drop() {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    },
  };
}

const row = async (pool: Pool, userId: string) =>
  (
    await pool.query(
      `SELECT p.email,p.program,p.campaign,p.newsletter,p.notice_version,p.unsubscribe_token,
        p.new_account,p.entry_label,p.signup_method,p.verified_at IS NOT NULL AS verified,
        p.unsubscribed_at IS NOT NULL AS unsubscribed,
        c.time_zone,c.time_zone_basis,
        (SELECT count(*)::int FROM amp_parent_followup_outbox o WHERE o.user_id=p.user_id AND o.stopped_at IS NULL) AS open_outbox,
        (SELECT count(*)::int FROM amp_parent_followups f WHERE f.user_id=p.user_id) AS rows
      FROM amp_parent_followups p LEFT JOIN amp_acquisition_contacts c USING(user_id) WHERE p.user_id=$1`,
      [userId],
    )
  ).rows[0];

test(
  "an account made without a parent intent (the teacher's sign-up) gets exactly one follow-up row and its acquisition contact",
  options,
  async () => {
    const db = await scopedDatabase("account_followup");
    const repository = new PostgresRepository(db.href, { development: true });
    const info = console.info;
    console.info = () => {};
    try {
      const origin = "http://127.0.0.1:4310";
      const accounts = await createAccounts(repository.pool, {
        baseURL: origin,
        secret: "f".repeat(40),
        production: false,
        passwords: true,
        trustedOrigins: [],
        parentFollowup: true,
      });
      const app = buildApp({
        repository,
        authenticate: accountsAuth(accounts),
        development: true,
      });
      await registerAccountRoutes(app, accounts);
      const post = (path: string, payload: object) =>
        app.inject({
          method: "POST",
          url: `/api/auth${path}`,
          payload,
          headers: { origin },
        });
      const email = "teacher@school.example";
      const password = "correct horse battery";
      // The /schools sign-up records no intent: no amp.parent-signup cookie.
      const signUp = await post("/sign-up/email", {
        email,
        password,
        name: "Teacher",
      });
      assert.equal(signUp.statusCode, 200, signUp.body);
      const userId = (
        await repository.pool.query(
          "SELECT id FROM amp_auth_users WHERE email=$1",
          [email],
        )
      ).rows[0].id as string;
      const first = await row(repository.pool, userId);
      assert.ok(first, "the account has its follow-up row");
      assert.match(first.unsubscribe_token, hex64);
      assert.deepEqual(
        { ...first, unsubscribe_token: undefined },
        {
          email,
          program: null,
          campaign: null,
          newsletter: true,
          notice_version: accountNotice,
          unsubscribe_token: undefined,
          new_account: true,
          entry_label: null,
          signup_method: "password",
          // Development sign-up leaves the address unconfirmed.
          verified: false,
          unsubscribed: false,
          time_zone: "America/New_York",
          time_zone_basis: "default",
          open_outbox: 0,
          rows: 1,
        },
      );
      // Signing in again never adds a row or changes the token.
      const signIn = await post("/sign-in/email", { email, password });
      assert.equal(signIn.statusCode, 200, signIn.body);
      const again = await row(repository.pool, userId);
      assert.equal(again.rows, 1);
      assert.equal(again.unsubscribe_token, first.unsubscribe_token);
      // The token works: one unsubscribe stops the owned email.
      await unsubscribe(repository.pool, first.unsubscribe_token);
      assert.equal((await row(repository.pool, userId)).newsletter, false);
    } finally {
      console.info = info;
      await repository.close();
      await db.drop();
    }
  },
);

test(
  "a spent or missing intent still leaves a row; the first intent fills it in once, never past an unsubscribe, and only a just-made account counts as a signup",
  options,
  async () => {
    const db = await scopedDatabase("account_followup_late");
    const pool = new Pool({ connectionString: db.href, max: 3 });
    try {
      const user = (id: string, age = "1 minute") =>
        pool.query(
          `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt") VALUES ($1,'A',$2,true,now()-$3::interval)`,
          [id, `${id}@example.com`, age],
        );
      // An intent another account already used: the cookie is spent.
      await user("first");
      const spent = await createSignupIntent(pool, {
        newsletter: true,
        notice: signupNotice,
      });
      await completeSignup(pool, `amp.parent-signup=${spent}`, "first");
      await user("second");
      await completeSignup(pool, `amp.parent-signup=${spent}`, "second");
      const second = await row(pool, "second");
      assert.equal(second.notice_version, accountNotice);
      assert.equal(second.newsletter, true);
      assert.notEqual(
        second.unsubscribe_token,
        (await row(pool, "first")).unsubscribe_token,
      );

      // Sign-up first (no cookie), its intent after (`late`).
      await user("late");
      await completeSignup(pool, null, "late");
      const before = await row(pool, "late");
      const late = await createSignupIntent(pool, {
        program: "ar-efa",
        newsletter: true,
        notice: signupNotice,
        entry: "pitch-try",
        late: true,
      });
      await completeSignup(pool, `amp.parent-signup=${late}`, "late");
      const filled = await row(pool, "late");
      assert.deepEqual(
        {
          program: filled.program,
          entry: filled.entry_label,
          notice: filled.notice_version,
          token: filled.unsubscribe_token,
          newAccount: filled.new_account,
          zone: filled.time_zone,
          basis: filled.time_zone_basis,
          rows: filled.rows,
        },
        {
          program: "ar-efa",
          entry: "pitch-try",
          notice: signupNotice,
          token: before.unsubscribe_token,
          newAccount: true,
          zone: "America/Chicago",
          basis: "campaign",
          rows: 1,
        },
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_parent_followup_outbox WHERE user_id='late'",
          )
        ).rows[0].n,
        2,
        "the intent path queues its sequence as before (suppressed for a founder-managed contact)",
      );

      // A teacher who signed up days ago and now signs in through a campaign:
      // the campaign is recorded (funding requests read it), once, but the
      // sign-in is never exported as a signup.
      await user("old", "2 days");
      await completeSignup(pool, null, "old");
      const oldToken = (await row(pool, "old")).unsubscribe_token;
      const oldIntent = await createSignupIntent(pool, {
        program: "az-esa",
        newsletter: true,
        notice: signupNotice,
        analytics: { clientId: "1234.5678", sessionId: 1700000000 },
      });
      await completeSignup(pool, `amp.parent-signup=${oldIntent}`, "old");
      const old = await row(pool, "old");
      assert.equal(old.program, "az-esa");
      assert.equal(old.notice_version, signupNotice);
      assert.equal(old.unsubscribe_token, oldToken);
      assert.equal(old.rows, 1);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_ga_signup_exports WHERE user_id='old'",
          )
        ).rows[0].n,
        0,
        "an old account's sign-in is not a signup conversion",
      );
      const laterIntent = await createSignupIntent(pool, {
        program: "nh-efa",
        newsletter: true,
        notice: signupNotice,
      });
      await completeSignup(pool, `amp.parent-signup=${laterIntent}`, "old");
      assert.equal(
        (await row(pool, "old")).program,
        "az-esa",
        "only the first intent fills the row in",
      );

      // An unsubscribe before the late intent lands stays an unsubscribe.
      await user("stopped");
      await completeSignup(pool, null, "stopped");
      await unsubscribe(pool, (await row(pool, "stopped")).unsubscribe_token);
      const stoppedIntent = await createSignupIntent(pool, {
        newsletter: true,
        notice: signupNotice,
        late: true,
      });
      await completeSignup(
        pool,
        `amp.parent-signup=${stoppedIntent}`,
        "stopped",
      );
      const stopped = await row(pool, "stopped");
      assert.equal(stopped.newsletter, false);
      assert.equal(stopped.unsubscribed, true);
    } finally {
      await pool.end();
      await db.drop();
    }
  },
);

test(
  "0155 backfills every account without a row (NULL program and campaign, fresh token, newsletter on, contact, nothing queued) and leaves existing rows alone",
  options,
  async () => {
    const db = await scopedDatabase("account_followup_backfill");
    const pool = new Pool({ connectionString: db.href, max: 2 });
    try {
      const user = (id: string, verified = true) =>
        pool.query(
          `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt") VALUES ($1,'A',$2,$3,'2026-11-19T15:00:00Z')`,
          [id, `${id}@example.com`, verified],
        );
      const login = (userId: string, provider: string, at: string) =>
        pool.query(
          `INSERT INTO amp_auth_accounts(id,"accountId","providerId","userId","createdAt","updatedAt") VALUES ($1,$1,$2,$3,$4,$4)`,
          [randomUUID(), provider, userId, at],
        );
      // Accounts made before the fix, through paths that recorded no intent.
      await user("teacher");
      await login("teacher", "google", "2026-11-19T15:00:00Z");
      await user("staff");
      await login("staff", "apple", "2026-11-07T15:00:00Z");
      await login("staff", "credential", "2026-11-08T15:00:00Z");
      await user("keyed", false);
      await pool.query(
        `INSERT INTO amp_auth_passkeys(id,"publicKey","userId","credentialID",counter,"deviceType","backedUp","createdAt") VALUES ('pk','k','keyed','c',0,'singleDevice',false,'2026-11-01T00:00:00Z')`,
      );
      // A parent who came through the pitch keeps the row they have.
      await user("parent");
      const intent = await createSignupIntent(pool, {
        program: "az-esa",
        newsletter: false,
        notice: signupNotice,
      });
      await completeSignup(pool, `amp.parent-signup=${intent}`, "parent");
      const parentBefore = (
        await pool.query(
          "SELECT * FROM amp_parent_followups WHERE user_id='parent'",
        )
      ).rows[0];

      const sql = await readFile(
        new URL(
          "../migrations/0155-followup-row-every-account.sql",
          import.meta.url,
        ),
        "utf8",
      );
      await pool.query(sql);
      await pool.query(sql); // Runs again harmlessly.

      const rows = (
        await pool.query(
          `SELECT p.user_id,p.program,p.campaign,p.newsletter,p.notice_version,p.new_account,p.signup_method,
            p.created_at=u."createdAt" AS signup_time,p.verified_at IS NOT NULL AS verified,p.unsubscribe_token,
            c.user_id IS NOT NULL AS contact
          FROM amp_parent_followups p JOIN amp_auth_users u ON u.id=p.user_id
          LEFT JOIN amp_acquisition_contacts c USING(user_id)
          WHERE p.user_id<>'parent' ORDER BY p.user_id`,
        )
      ).rows;
      for (const r of rows) assert.match(r.unsubscribe_token, hex64);
      assert.equal(
        new Set(rows.map((r) => r.unsubscribe_token)).size,
        rows.length,
        "each token is its own",
      );
      assert.deepEqual(
        rows.map(({ unsubscribe_token: _, ...r }) => r),
        [
          ["keyed", "passkey", false],
          ["staff", "apple", true],
          ["teacher", "google", true],
        ].map(([user_id, signup_method, verified]) => ({
          user_id,
          program: null,
          campaign: null,
          newsletter: true,
          notice_version: accountNotice,
          new_account: true,
          signup_method,
          signup_time: true,
          verified,
          contact: true,
        })),
      );
      assert.deepEqual(
        (
          await pool.query(
            "SELECT * FROM amp_parent_followups WHERE user_id='parent'",
          )
        ).rows[0],
        parentBefore,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_parent_followup_outbox WHERE user_id<>'parent'",
          )
        ).rows[0].n,
        0,
        "the backfill queues no email",
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_auth_users u WHERE NOT EXISTS(SELECT 1 FROM amp_parent_followups p WHERE p.user_id=u.id)",
          )
        ).rows[0].n,
        0,
        "every account has its row",
      );
    } finally {
      await pool.end();
      await db.drop();
    }
  },
);
