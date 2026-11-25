import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import Fastify from "fastify";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
import { registerCleverOnboarding } from "../src/schools/clever-onboarding.js";
import {
  alertReRequest,
  deliverRequestAlerts,
  operatorEmail,
  requestAlertsDue,
  runRequestAlertPass,
} from "../src/schools/request-alerts.js";
import type { Email } from "../src/email/email.js";

test("the operator address is AMP_OPERATOR_EMAIL, or the founder", () => {
  assert.equal(operatorEmail({}), "skylar@corpora.inc");
  assert.equal(
    operatorEmail({ AMP_OPERATOR_EMAIL: " " }),
    "skylar@corpora.inc",
  );
  assert.equal(
    operatorEmail({ AMP_OPERATOR_EMAIL: "ops@corpora.example" }),
    "ops@corpora.example",
  );
  assert.throws(() => operatorEmail({ AMP_OPERATOR_EMAIL: "not an email" }));
});

test(
  "a school's Clever or AnySchool request alerts the operator once, then reminds at 24 and 72 hours",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `alerts_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    let db: Pool | undefined;
    try {
      await migrate(scoped.href);
      db = new Pool({ connectionString: scoped.href, max: 6 });
      const pool = db;
      const userId = randomUUID();
      await pool.query(
        `INSERT INTO amp_auth_users(id,name,email,"emailVerified") VALUES($1,'Ruth','ruth@cedar.example',true)`,
        [userId],
      );
      const sent: { to: string; email: Email }[] = [];
      const keys: string[] = [];
      let failing = false;
      const send = async (
        to: string,
        email: Email,
        options?: { idempotencyKey: string },
      ) => {
        if (failing) throw new Error("provider down");
        sent.push({ to, email });
        keys.push(options!.idempotencyKey);
      };
      let ids: string[] = [];
      const alertIds = () => ids;
      const pass = () =>
        deliverRequestAlerts(pool, send, {
          to: "operator@corpora.example",
          origin: "https://amp.example",
        });
      const request = async (input: {
        hoursAgo?: number;
        signed?: boolean;
        method?: "clever" | "anyschool";
        name?: string;
      }) => {
        const id = randomUUID();
        await pool.query(
          `INSERT INTO amp_school_connection_requests(id,account_id,institution_name,contact_email,method,signer_name,agreement_version,created_at)
           VALUES($1,$2,$3,$4,$5,$6,$7,now()-make_interval(hours => $8::int))`,
          [
            id,
            `amp|${userId}`,
            input.name ?? "Cedar Academy",
            `office-${id.slice(0, 8)}@cedar.example`,
            input.method ?? "anyschool",
            input.signed === false ? null : "Ruth Adeyemi",
            input.signed === false ? null : AGREEMENT_VERSION,
            input.hoursAgo ?? 0,
          ],
        );
        return id;
      };
      const age = (id: string, hours: number) =>
        pool.query(
          "UPDATE amp_school_connection_requests SET created_at=now()-make_interval(hours => $2::int) WHERE id=$1",
          [id, hours],
        );

      await t.test("nothing waiting is nothing due", async () => {
        assert.equal(await requestAlertsDue(pool), false);
        assert.deepEqual(await runRequestAlertPass(pool, {}), { due: false });
      });

      const cedar = await request({});
      await t.test(
        "a new request alerts the operator once, with what to do",
        async () => {
          assert.equal(await requestAlertsDue(pool), true);
          const result = await pass();
          assert.equal(result.sent, 1);
          ids = (
            await pool.query(
              "SELECT id FROM amp_school_request_alerts WHERE request_id=$1",
              [cedar],
            )
          ).rows.map((row) => row.id);
          const { to, email } = sent[0]!;
          assert.equal(to, "operator@corpora.example");
          assert.match(
            email.subject,
            /^Clever AnySchool request: invite Cedar Academy by \d{4}-\d\d-\d\d \d\d:\d\d UTC$/,
          );
          for (const expected of [
            "Institution: Cedar Academy",
            "Method: anyschool",
            `Setup contact: office-${cedar.slice(0, 8)}@cedar.example`,
            "Requester: ruth@cedar.example",
            `Agreement: signed by Ruth Adeyemi, version ${AGREEMENT_VERSION}`,
            `Request: ${cedar}`,
            "Home > Invite Districts > Add an AnySchool District",
            `anyschool-invite with {"id":"${cedar}"`,
            "invite within 24 hours",
            "Limit: 72 hours",
          ])
            assert.ok(email.text.includes(expected), expected);
          assert.equal(keys[0], `amp-school-request-alert:${alertIds()[0]}`);
          assert.ok(email.html.startsWith("<!doctype html>"));
          assert.ok(email.html.includes("Cedar Academy"));
          // Another pass, and two at once, send nothing more.
          await pass();
          await Promise.all([pass(), pass()]);
          assert.equal(sent.length, 1);
          assert.equal(await requestAlertsDue(pool), false);
        },
      );

      await t.test(
        "asking again alerts once more; repeats while it waits add nothing",
        async () => {
          assert.equal(await alertReRequest(pool, cedar), true);
          assert.equal(await alertReRequest(pool, cedar), false);
          await Promise.all([pass(), pass()]);
          assert.equal(sent.length, 2);
          assert.equal(
            sent[1]!.email.subject,
            "Cedar Academy asked again for Clever AnySchool",
          );
          // Asked again before the first alert went: that alert carries it.
          const fresh = await request({ name: "Fresh School" });
          assert.equal(await alertReRequest(pool, fresh), false);
          await pass();
          assert.equal(sent.length, 3);
          assert.match(sent[2]!.email.subject, /invite Fresh School by/);
          await pool.query(
            "UPDATE amp_school_connection_requests SET status='invited' WHERE id=$1",
            [fresh],
          );
          assert.equal(await alertReRequest(pool, fresh), false);
        },
      );

      await t.test(
        "one reminder at 24 hours, one overdue at 72, each once",
        async () => {
          const before = sent.length;
          await age(cedar, 25);
          await pass();
          await pass();
          assert.equal(sent.length, before + 1);
          assert.match(
            sent.at(-1)!.email.subject,
            /^Reminder: invite Cedar Academy to Clever AnySchool by /,
          );
          await age(cedar, 73);
          await pass();
          await pass();
          assert.equal(sent.length, before + 2);
          assert.equal(
            sent.at(-1)!.email.subject,
            "Overdue: invite Cedar Academy to Clever AnySchool now",
          );
          assert.ok(sent.at(-1)!.email.text.includes("It is overdue."));
          await age(cedar, 200);
          await pass();
          assert.equal(sent.length, before + 2);
          // A request first seen past 72 hours gets the overdue alert only.
          await request({ name: "Old School", hoursAgo: 80 });
          await pass();
          assert.equal(sent.length, before + 3);
          assert.equal(
            sent.at(-1)!.email.subject,
            "Overdue: invite Old School to Clever AnySchool now",
          );
        },
      );

      await t.test(
        "an invited request stops its waiting alerts and gets no reminders",
        async () => {
          const before = sent.length;
          const handled = await request({ name: "Handled School" });
          await pool.query(
            "UPDATE amp_school_connection_requests SET status='invited' WHERE id=$1",
            [handled],
          );
          await age(handled, 30);
          await pass();
          assert.equal(sent.length, before);
          const late = await request({ name: "Late School" });
          await pool.query(
            "INSERT INTO amp_school_request_alerts(request_id,kind) VALUES($1,'requested')",
            [late],
          );
          await pool.query(
            "UPDATE amp_school_connection_requests SET status='invited' WHERE id=$1",
            [late],
          );
          const result = await pass();
          assert.equal(result.stopped, 1);
          assert.equal(sent.length, before);
          const row = (
            await pool.query(
              "SELECT stopped_reason,sent_at FROM amp_school_request_alerts WHERE request_id=$1",
              [late],
            )
          ).rows[0];
          assert.equal(row.stopped_reason, "request-handled");
          assert.equal(row.sent_at, null);
        },
      );

      await t.test(
        "a failed send is logged, kept and retried, never sent twice",
        async () => {
          const before = sent.length;
          const errors: unknown[][] = [];
          const original = console.error;
          console.error = (...args: unknown[]) => void errors.push(args);
          let failed;
          try {
            failing = true;
            await request({ name: "Retry School" });
            failed = await pass();
          } finally {
            failing = false;
            console.error = original;
          }
          assert.equal(failed.failed, 1);
          assert.equal(sent.length, before);
          assert.match(String(errors[0]![0]), /operator alert not sent/);
          const row = (
            await pool.query(
              `SELECT a.id,a.attempts,a.last_error,a.lease_until FROM amp_school_request_alerts a
               JOIN amp_school_connection_requests r ON r.id=a.request_id WHERE r.institution_name='Retry School'`,
            )
          ).rows[0];
          assert.equal(row.attempts, 1);
          assert.equal(row.last_error, "provider down");
          assert.equal(row.lease_until, null);
          // Not before its backoff.
          await pass();
          assert.equal(sent.length, before);
          await pool.query(
            "UPDATE amp_school_request_alerts SET available_at=now() WHERE id=$1",
            [row.id],
          );
          await pass();
          await pass();
          assert.equal(sent.length, before + 1);
          assert.match(sent.at(-1)!.email.subject, /invite Retry School by/);
        },
      );

      await t.test(
        "the older contact form's request says it is unsigned and what to do",
        async () => {
          await request({
            name: "Form School https://evil.example/x",
            signed: false,
          });
          await request({
            name: "Clever District",
            signed: false,
            method: "clever",
          });
          await pass();
          const form = sent.find((s) =>
            s.email.subject.includes("Form School"),
          )!;
          assert.ok(
            form.email.text.includes(
              "Agreement: not signed (the older contact form)",
            ),
          );
          assert.ok(form.email.text.includes("anyschool-invite refuses it"));
          // What the school typed is text, never a link.
          assert.ok(form.email.text.includes("Form School evil.example/x"));
          assert.ok(!form.email.html.includes('evil.example/x"'));
          const clever = sent.find((s) =>
            s.email.subject.startsWith(
              "Clever request: invite Clever District",
            ),
          )!;
          assert.ok(
            clever.email.text.includes("https://amp.example/school/connect"),
          );
          assert.ok(clever.email.text.includes("Home > Invite Districts."));
        },
      );

      await t.test(
        "the worker pass needs mail settings and leaves alerts waiting without them",
        async () => {
          await request({ name: "Unsent School" });
          await assert.rejects(
            runRequestAlertPass(pool, {
              AMP_ACCOUNTS_URL: "https://amp.example",
            }),
            /AMP_MAIL_RESEND_API_KEY/,
          );
          await assert.rejects(
            runRequestAlertPass(pool, {}, send),
            /AMP_ACCOUNTS_URL/,
          );
          assert.equal(await requestAlertsDue(pool), true);
          const before = sent.length;
          const result = await runRequestAlertPass(
            pool,
            {
              AMP_ACCOUNTS_URL: "https://amp.example",
              AMP_OPERATOR_EMAIL: "ops@corpora.example",
            },
            send,
          );
          assert.equal(result.due, true);
          assert.equal(sent.length, before + 1);
          assert.equal(sent.at(-1)!.to, "ops@corpora.example");
        },
      );

      await t.test(
        "the contact form's repeat request alerts once more, its first does not",
        async () => {
          const accountId = `amp|${userId}`;
          const app = Fastify();
          await registerCleverOnboarding(app, {
            pool,
            authenticate: async () => accountId,
            config: null,
            maintenance: false,
            origin: "https://amp.example",
          });
          try {
            const ask = () =>
              app.inject({
                method: "POST",
                url: "/api/v1/school/connection-requests",
                headers: { authorization: "Bearer fixture" },
                payload: {
                  institutionName: "Form Again School",
                  contactEmail: "it@form-again.example",
                  method: "anyschool",
                },
              });
            const first = await ask();
            assert.equal(first.statusCode, 202, first.body);
            const alerts = () =>
              pool
                .query(
                  "SELECT kind FROM amp_school_request_alerts WHERE request_id=$1 ORDER BY created_at",
                  [first.json().id],
                )
                .then((r) => r.rows.map((row) => row.kind));
            assert.deepEqual(await alerts(), []);
            await pass();
            assert.deepEqual(await alerts(), ["requested"]);
            assert.equal((await ask()).json().id, first.json().id);
            assert.deepEqual(await alerts(), ["requested", "rerequested"]);
          } finally {
            await app.close();
          }
        },
      );
    } finally {
      await db?.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
