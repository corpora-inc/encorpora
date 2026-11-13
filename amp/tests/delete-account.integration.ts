import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { schoolAdmin } from "../scripts/school-admin.js";
import { deleteAccountByEmail } from "../scripts/delete-account.js";
import { ACCOUNT_TABLES } from "../src/account/delete-account.js";
import { registerDeleteAccountRoutes } from "../src/account/delete-account-routes.js";
import { deletionPreviewSchema } from "../src/account/deletion-contracts.js";
import { meSchema } from "../src/account/contracts.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { buildApp } from "../src/server/app.js";
import {
  accountsAuth,
  createAccounts,
  registerAccountRoutes,
} from "../src/server/accounts.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { PostgresRepository } from "../src/server/repository.js";

const YEAR_AHEAD = new Date(Date.now() + 365 * 86_400_000).toISOString();
const agreement = {
  version: "fixture-1",
  signerName: "Fixture Signer",
  signerTitle: "Head of School",
};

/* "Delete my account" (src/account/delete-account.ts). A fully populated
   account goes, nothing anywhere references it afterwards, places shared with
   another admin survive, a second parent keeps her own account, and the same
   address signs up again as somebody new. Every name here is made up. */
test(
  "delete my account: everything the account owns goes, shared places stay, the address signs up fresh",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_delete_account_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const repository = new PostgresRepository(scoped.href, {
      development: true,
    });
    const db = repository.pool;
    const schools = new SchoolRepository(db);
    // Verification links go to the log without mail; keep the test quiet.
    const info = console.info;
    console.info = () => {};
    const accounts = await createAccounts(db, {
      baseURL: "http://127.0.0.1:4971",
      secret: "s".repeat(40),
      production: false,
      passwords: true,
      trustedOrigins: [],
    });
    const authenticate = refuseStudentTokens(accountsAuth(accounts));
    const app = buildApp({ repository, authenticate, development: true });
    await registerAccountRoutes(app, accounts);
    await registerFamilyRoutes(app, {
      pool: db,
      authenticate,
      development: true,
    });
    await registerDeleteAccountRoutes(app, {
      pool: db,
      authenticate,
      accounts,
    });
    await app.ready();
    t.after(async () => {
      console.info = info;
      await app.close();
      await repository.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });

    const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
    const api = (
      method: "GET" | "POST",
      path: string,
      token: string,
      payload?: object,
    ) =>
      app.inject({
        method,
        url: `/api/v1${path}`,
        headers: bearer(token),
        ...(payload ? { payload } : {}),
      });
    const ok = async (
      response: Promise<{ statusCode: number; body: string; json(): any }>,
      status = 200,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<any> => {
      const result = await response;
      assert.equal(result.statusCode, status, result.body);
      return result.json();
    };
    /** Signs up with a password, as the sign-up screen does. */
    const signUp = async (email: string, name: string) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/sign-up/email",
        payload: { email, password: "correct horse battery", name },
        headers: { origin: "http://127.0.0.1:4971" },
      });
      assert.equal(response.statusCode, 200, response.body);
      const token = response.headers["set-auth-token"] as string;
      const me = meSchema.parse(await ok(api("GET", "/me", token))) as {
        signedIn: true;
        account: { id: string };
        next: string;
      };
      // The address is confirmed, as its link would.
      await db.query(
        `UPDATE amp_auth_users SET "emailVerified"=true WHERE id=$1`,
        [me.account.id.slice(4)],
      );
      const setCookie = response.headers["set-cookie"];
      const cookie = (Array.isArray(setCookie) ? setCookie : [setCookie])
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.split(";")[0])
        .join("; ");
      return { token, cookie, account: me.account.id, me };
    };
    const practice = async (learnerId: string) => {
      const id = randomUUID();
      await db.query(
        "INSERT INTO amp_instances(id,learner_id,content) VALUES($1,$2,$3)",
        [id, learnerId, { public: { id, skillId: "add" }, selection: {} }],
      );
      await db.query(
        "INSERT INTO amp_attempts(id,learner_id,problem_id,request_id,outcome) VALUES($1,$2,$3,$3,$4)",
        [
          randomUUID(),
          learnerId,
          id,
          {
            id,
            problemId: id,
            requestId: id,
            skillId: "add",
            templateId: "fixture-template",
            correct: true,
            assisted: false,
            createdAt: new Date().toISOString(),
          },
        ],
      );
      await db.query(
        `INSERT INTO amp_help_events(learner_id,"at",day,kind,source,skill_id,ref,problem_id)
         VALUES($1,now(),current_date,'hint','practice','add','fixture',$2)`,
        [learnerId, id],
      );
    };
    const org = async (name: string) => {
      const created = (await schoolAdmin(schools, "create-org", {
        kind: "school",
        name,
        timezone: "UTC",
        agreement,
      })) as { id: string };
      await schoolAdmin(schools, "issue-license", {
        orgId: created.id,
        seats: 10,
        endsAt: YEAR_AHEAD,
        reference: "Pilot",
      });
      return created.id;
    };
    const staff = async (
      orgId: string,
      accountId: string,
      role: "admin" | "teacher",
      classId?: string,
    ) =>
      (
        await schools.addStaff({
          orgId,
          role,
          givenName: "Fixture",
          accountId,
          ...(classId ? { classId } : {}),
        })
      ).personId as string;
    /** Every table and row whose stored values mention any of `needles`,
     * found from the catalogue, not from a list. */
    const references = async (needles: string[]) => {
      const tables = (
        await db.query<{ table_name: string }>(
          `SELECT table_name FROM information_schema.tables
           WHERE table_schema=current_schema() AND table_type='BASE TABLE' ORDER BY 1`,
        )
      ).rows.map((row) => row.table_name);
      const found: Record<string, number> = {};
      for (const table of tables) {
        const n = Number(
          (
            await db.query(
              `SELECT count(*) AS n FROM ${table} x
               WHERE EXISTS (SELECT 1 FROM unnest($1::text[]) needle
                 WHERE position(lower(needle) IN lower(to_jsonb(x)::text))>0)`,
              [needles],
            )
          ).rows[0].n,
        );
        if (n) found[table] = n;
      }
      return found;
    };
    const count = async (sql: string, params: unknown[] = []) =>
      Number((await db.query(sql, params)).rows[0].n);

    await t.test(
      "every table in the schema has a stated handling",
      async () => {
        const tables = (
          await db.query<{ table_name: string }>(
            `SELECT table_name FROM information_schema.tables
             WHERE table_schema=current_schema() AND table_type='BASE TABLE'`,
          )
        ).rows.map((row) => row.table_name);
        assert.deepEqual(
          tables.filter((table) => !(table in ACCOUNT_TABLES)).sort(),
          [],
          "a new table needs an entry in ACCOUNT_TABLES",
        );
        assert.deepEqual(
          Object.keys(ACCOUNT_TABLES)
            .filter((table) => !tables.includes(table))
            .sort(),
          [],
          "ACCOUNT_TABLES names a table that no longer exists",
        );
        // Every column that can hold a person, a learner or an account
        // belongs to a table with a decision other than "none".
        const keyed = (
          await db.query<{ table_name: string; column_name: string }>(
            `SELECT table_name,column_name FROM information_schema.columns
             WHERE table_schema=current_schema() AND column_name ~* $1`,
            [
              "(account|learner|person|user|parent|owner|actor|signer|created_by|started_by|adopted_by|used_by|second_parent|final_by|email|local_id)",
            ],
          )
        ).rows.filter(
          (row) =>
            ACCOUNT_TABLES[row.table_name] === "none" &&
            // Settings and counts that only name the column kind.
            !/^(parent_id|user_agent|client_user_agent)$/.test(row.column_name),
        );
        assert.deepEqual(keyed, [], "a person-keyed table marked 'none'");
      },
    );

    // The account holder: a family of two children who practice, their own
    // practice, a second parent, a school only they run with one class, and a
    // school they help run with another admin.
    const email = `fern-${randomUUID().slice(0, 8)}@example.test`;
    const holder = await signUp(email, "Fern Fixture");
    assert.equal(holder.me.next, "start");
    await ok(
      api("POST", "/start", holder.token, {
        as: "parent",
        children: [
          { name: "Maya", birthYear: 2016 },
          { name: "Theo", birthYear: 2018 },
        ],
      }),
    );
    const children = (
      await db.query<{ id: string }>(
        "SELECT id FROM amp_learners WHERE account_id=$1 ORDER BY created_at",
        [holder.account],
      )
    ).rows.map((row) => row.id);
    assert.equal(children.length, 2);
    for (const child of children) await practice(child);
    const own = randomUUID();
    await db.query(
      "INSERT INTO amp_learners(id,account_id,name,adult,timezone) VALUES($1,$2,'Own practice',true,'UTC')",
      [own, holder.account],
    );
    await practice(own);
    const family = (
      await db.query<{ org_id: string; class_id: string }>(
        "SELECT org_id,class_id FROM amp_families WHERE account_id=$1",
        [holder.account],
      )
    ).rows[0]!;

    // The second parent: her own account and practice, teaching the family.
    const second = await signUp(
      `rowan-${randomUUID().slice(0, 8)}@example.test`,
      "Rowan Fixture",
    );
    const secondPerson = await staff(family.org_id, second.account, "teacher");
    await db.query(
      "UPDATE amp_families SET second_parent=$2 WHERE account_id=$1",
      [holder.account, secondPerson],
    );
    const secondLearner = randomUUID();
    await db.query(
      "INSERT INTO amp_learners(id,account_id,name,adult,timezone) VALUES($1,$2,'Her practice',true,'UTC')",
      [secondLearner, second.account],
    );
    await practice(secondLearner);

    // A school only the holder runs, with a class and a student.
    const ownSchool = await org("Fixture Owned Academy");
    const ownClass = await schools.createClass(ownSchool, {
      name: "Fixture Owned Class",
    });
    const ownPerson = await staff(ownSchool, holder.account, "admin");
    const pupil = await schools.provisionStudent(ownSchool, {
      givenName: "Pupil",
      gradeLevel: 4,
      classId: ownClass.id,
    });
    await practice(pupil.learnerId!);

    // A school with another admin, where the holder is an admin and teaches.
    const sharedSchool = await org("Fixture Shared School");
    const sharedClass = await schools.createClass(sharedSchool, {
      name: "Fixture Shared Class",
    });
    const colleague = `amp|colleague-${randomUUID()}`;
    const colleaguePerson = await staff(sharedSchool, colleague, "admin");
    const sharedPerson = await staff(sharedSchool, holder.account, "admin");
    const sharedPupil = await schools.provisionStudent(sharedSchool, {
      givenName: "Pupil",
      gradeLevel: 5,
      classId: sharedClass.id,
    });
    await practice(sharedPupil.learnerId!);

    await t.test("the confirm screen's preview says what goes", async () => {
      const preview = deletionPreviewSchema.parse(
        await ok(api("GET", "/account/deletion", holder.token)),
      );
      assert.deepEqual(preview.learners, {
        children: 2,
        own: true,
        profiles: 0,
      });
      assert.equal(preview.answers, 3);
      assert.deepEqual(
        preview.removed.map((place) => place.id).sort(),
        [family.org_id, ownSchool].sort(),
      );
      assert.deepEqual(
        preview.left.map((place) => place.id),
        [sharedSchool],
      );
      assert.equal(preview.secondParent, true);
      assert.equal(preview.billingRecords, false);
      assert.deepEqual(preview.blockers, []);
    });

    await t.test("a dry run counts what goes and changes nothing", async () => {
      const before = await count("SELECT count(*) n FROM amp_learners");
      const dry = await deleteAccountByEmail(db, email.toUpperCase(), false);
      assert.equal(dry.committed, false);
      assert.ok(dry.counts.amp_learners!.deleted >= 3);
      assert.ok(dry.counts.amp_attempts!.deleted >= 3);
      assert.ok(dry.counts.amp_orgs!.deleted >= 2);
      assert.equal(dry.counts.amp_auth_users!.deleted, 1);
      assert.equal(await count("SELECT count(*) n FROM amp_learners"), before);
      assert.equal(
        await count("SELECT count(*) n FROM amp_account_deletions"),
        0,
      );
    });

    await t.test("the deletion needs its deliberate confirmation", async () => {
      const refused = await api("POST", "/account/delete", holder.token, {
        confirmation: "yes",
      });
      assert.equal(refused.statusCode, 400);
    });

    await t.test(
      "a stale sign-in cannot read the preview or delete any row; signing in again restores deletion",
      async () => {
        const aged = await db.query(
          `UPDATE amp_auth_sessions SET "createdAt"=now()-interval '10 minutes 1 second', "updatedAt"=now() WHERE "userId"=$1`,
          [holder.account.slice(4)],
        );
        assert.equal(aged.rowCount, 1);
        const snapshot = async () => {
          const tables = (
            await db.query<{ table_name: string }>(
              `SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_type='BASE TABLE' ORDER BY 1`,
            )
          ).rows;
          const result: Record<string, unknown> = {};
          for (const { table_name } of tables) {
            result[table_name] = (
              await db.query(
                `SELECT to_jsonb(x) AS row FROM "${table_name}" x ORDER BY to_jsonb(x)::text`,
              )
            ).rows;
          }
          return result;
        };
        const before = await snapshot();
        for (const [method, path] of [
          ["GET", "/account/deletion"],
          ["POST", "/account/delete"],
        ] as const) {
          const refused = await api(
            method,
            path,
            holder.token,
            method === "POST"
              ? { confirmation: "delete-my-account" }
              : undefined,
          );
          assert.equal(refused.statusCode, 403, refused.body);
          assert.deepEqual(refused.json(), { error: "reauth_required" });
          assert.deepEqual(
            await snapshot(),
            before,
            "every stored row is unchanged",
          );
        }
        assert.ok(holder.cookie, "the browser received a session cookie");
        for (const method of ["GET", "POST"] as const) {
          const refused = await app.inject({
            method,
            url:
              method === "GET"
                ? "/api/v1/account/deletion"
                : "/api/v1/account/delete",
            headers: { cookie: holder.cookie },
            ...(method === "POST"
              ? { payload: { confirmation: "delete-my-account" } }
              : {}),
          });
          assert.equal(refused.statusCode, 403, refused.body);
          assert.deepEqual(refused.json(), { error: "reauth_required" });
          assert.deepEqual(await snapshot(), before);
        }
        const signedIn = await app.inject({
          method: "POST",
          url: "/api/auth/sign-in/email",
          headers: { origin: "http://127.0.0.1:4971" },
          payload: { email, password: "correct horse battery" },
        });
        assert.equal(signedIn.statusCode, 200, signedIn.body);
        const oldToken = holder.token;
        holder.token = signedIn.headers["set-auth-token"] as string;
        assert.ok(holder.token);
        assert.notEqual(holder.token, oldToken);
        await ok(api("GET", "/account/deletion", holder.token));
        assert.equal(
          (
            await api("POST", "/account/delete", oldToken, {
              confirmation: "delete-my-account",
            })
          ).statusCode,
          403,
          "a new sign-in does not freshen another session",
        );
      },
    );

    const ids = {
      account: holder.account,
      user: holder.account.slice(4),
      email,
      children,
      own,
      familyOrg: family.org_id,
      familyClass: family.class_id,
      ownSchool,
      ownClass: ownClass.id,
      ownPerson,
      pupil: pupil.learnerId!,
    };

    await t.test("deleting removes everything the account owns", async () => {
      await ok(
        api("POST", "/account/delete", holder.token, {
          confirmation: "delete-my-account",
        }),
      );
      // The session went with the account.
      assert.equal(
        (await api("GET", "/learners", holder.token)).statusCode,
        401,
      );
      // Nothing anywhere mentions the account, its sign-in, its address, its
      // learners or the places it alone ran, except the journal's one row.
      const found = await references([
        ids.account,
        ids.user,
        ids.email,
        ...ids.children,
        ids.own,
        ids.familyOrg,
        ids.familyClass,
        ids.ownSchool,
        ids.ownClass,
        ids.ownPerson,
        ids.pupil,
      ]);
      assert.deepEqual(found, { amp_account_deletions: 1 });
      // The journal: who (opaque), when and counts; no name or address.
      const journal = (await db.query("SELECT * FROM amp_account_deletions"))
        .rows[0];
      assert.equal(journal.account_id, ids.account);
      assert.equal(journal.via, "self");
      assert.ok(journal.counts.amp_attempts.deleted >= 4);
      assert.doesNotMatch(JSON.stringify(journal), /Fixture|Maya|Theo|@/);
    });

    await t.test("a school with another admin stays", async () => {
      assert.equal(
        await count("SELECT count(*) n FROM amp_orgs WHERE id=$1", [
          sharedSchool,
        ]),
        1,
      );
      assert.equal(
        await count("SELECT count(*) n FROM amp_classes WHERE id=$1", [
          sharedClass.id,
        ]),
        1,
      );
      // The colleague still runs it, and the pupil's work is intact.
      assert.equal(
        await count(
          `SELECT count(*) n FROM amp_org_roles WHERE person_id=$1 AND role='admin' AND end_on IS NULL`,
          [colleaguePerson],
        ),
        1,
      );
      assert.equal(
        await count("SELECT count(*) n FROM amp_attempts WHERE learner_id=$1", [
          sharedPupil.learnerId,
        ]),
        1,
      );
      // The holder's place there is a nameless tombstone with ended roles.
      const row = (
        await db.query(
          "SELECT given_name,family_name,email,account_id,deleted_at FROM amp_people WHERE id=$1",
          [sharedPerson],
        )
      ).rows[0];
      assert.equal(row.given_name, "Removed");
      assert.equal(row.account_id, null);
      assert.equal(row.email, null);
      assert.ok(row.deleted_at);
      assert.equal(
        await count(
          `SELECT count(*) n FROM amp_org_roles WHERE person_id=$1
           AND (end_on IS NULL OR end_on>current_date)`,
          [sharedPerson],
        ),
        0,
      );
    });

    await t.test(
      "the second parent keeps her own account and practice, without the family",
      async () => {
        const me = await ok(api("GET", "/me", second.token));
        assert.equal(me.signedIn, true);
        assert.equal(
          await count(
            "SELECT count(*) n FROM amp_attempts WHERE learner_id=$1",
            [secondLearner],
          ),
          1,
        );
        assert.equal(
          await count("SELECT count(*) n FROM amp_people WHERE account_id=$1", [
            second.account,
          ]),
          0,
        );
      },
    );

    await t.test(
      "the same address signs up again as somebody new",
      async () => {
        const again = await signUp(email, "Fern Again");
        assert.notEqual(again.account, holder.account);
        assert.equal(again.me.next, "start");
        const me = await ok(api("GET", "/me", again.token));
        assert.deepEqual(me.learners, []);
        assert.equal(me.familyClass, undefined);
        // Nothing from before comes back with the address.
        assert.deepEqual(
          await references([
            ...ids.children,
            ids.own,
            ids.familyOrg,
            ids.ownSchool,
          ]),
          {},
        );
      },
    );

    await t.test(
      "a second parent who deletes her account leaves the family as it was",
      async () => {
        const holderTwo = await signUp(
          `june-${randomUUID().slice(0, 8)}@example.test`,
          "June Fixture",
        );
        await ok(
          api("POST", "/start", holderTwo.token, {
            as: "parent",
            children: [{ name: "Ada", birthYear: 2017 }],
          }),
        );
        const child = (
          await db.query<{ id: string }>(
            "SELECT id FROM amp_learners WHERE account_id=$1",
            [holderTwo.account],
          )
        ).rows[0]!.id;
        await practice(child);
        const familyTwo = (
          await db.query<{ org_id: string }>(
            "SELECT org_id FROM amp_families WHERE account_id=$1",
            [holderTwo.account],
          )
        ).rows[0]!;
        const parentEmail = `olive-${randomUUID().slice(0, 8)}@example.test`;
        const parent = await signUp(parentEmail, "Olive Fixture");
        const parentPerson = await staff(
          familyTwo.org_id,
          parent.account,
          "teacher",
        );
        await db.query(
          "UPDATE amp_families SET second_parent=$2 WHERE account_id=$1",
          [holderTwo.account, parentPerson],
        );
        const preview = deletionPreviewSchema.parse(
          await ok(api("GET", "/account/deletion", parent.token)),
        );
        // Her family's place isn't hers to remove: she only leaves it.
        assert.deepEqual(preview.removed, []);
        assert.deepEqual(
          preview.left.map((place) => place.id),
          [familyTwo.org_id],
        );
        await ok(
          api("POST", "/account/delete", parent.token, {
            confirmation: "delete-my-account",
          }),
        );
        // The children, their practice and the family are the holder's.
        assert.equal(
          await count(
            "SELECT count(*) n FROM amp_attempts WHERE learner_id=$1",
            [child],
          ),
          1,
        );
        assert.equal(
          (
            await db.query(
              "SELECT second_parent FROM amp_families WHERE account_id=$1",
              [holderTwo.account],
            )
          ).rows[0].second_parent,
          null,
          "the family can invite another second parent",
        );
        assert.deepEqual(await references([parent.account, parentEmail]), {
          amp_account_deletions: 1,
        });
      },
    );

    await t.test(
      "a renewing plan is cancelled first; payment records stay without a name",
      async () => {
        const payer = await signUp(
          `ivy-${randomUUID().slice(0, 8)}@example.test`,
          "Ivy Fixture",
        );
        const learner = randomUUID();
        await db.query(
          "INSERT INTO amp_learners(id,account_id,name,adult,timezone) VALUES($1,$2,'Own practice',true,'UTC')",
          [learner, payer.account],
        );
        await practice(learner);
        const checkout = randomUUID();
        await db.query(
          `INSERT INTO amp_stripe_checkouts(id,namespace,account_id,learner_id,request_id,customer_id,session_id,subscription_id)
           VALUES($1,'test:fixture',$2,$3,$4,'cus_fixture','cs_fixture','sub_fixture')`,
          [checkout, payer.account, learner, randomUUID()],
        );
        await db.query(
          `INSERT INTO amp_stripe_customers(namespace,account_id,reservation_id,customer_id) VALUES('test:fixture',$1,$2,'cus_fixture')`,
          [payer.account, randomUUID()],
        );
        await db.query(
          `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
           VALUES($1,$2,'stripe',$1,'active',now()-interval '1 day',now()+interval '300 days')`,
          [`fixture:${learner}`, learner],
        );
        const preview = deletionPreviewSchema.parse(
          await ok(api("GET", "/account/deletion", payer.token)),
        );
        assert.deepEqual(preview.blockers, [{ code: "plan_renews" }]);
        assert.equal(preview.billingRecords, true);
        const refused = await api("POST", "/account/delete", payer.token, {
          confirmation: "delete-my-account",
        });
        assert.equal(refused.statusCode, 409, refused.body);
        assert.deepEqual(refused.json(), {
          error: "deletion_blocked",
          blockers: [{ code: "plan_renews" }],
        });
        assert.equal(
          await count("SELECT count(*) n FROM amp_learners WHERE id=$1", [
            learner,
          ]),
          1,
          "a refusal deletes nothing",
        );

        // Cancelled in billing: it ends with the period and never renews.
        await db.query(
          `INSERT INTO amp_stripe_subscription_events(namespace,event_id,checkout_id,subscription_id,status,cancel_at_period_end,period_start,period_end)
           VALUES('test:fixture','evt_fixture',$1,'sub_fixture','active',true,now()-interval '1 day',now()+interval '300 days')`,
          [checkout],
        );
        await ok(
          api("POST", "/account/delete", payer.token, {
            confirmation: "delete-my-account",
          }),
        );
        // What stays is the payment ledger, under the account's opaque id,
        // and a nameless "Deleted learner" it refers to.
        const found = await references([payer.account, learner]);
        for (const table of Object.keys(found))
          assert.ok(
            ["financial", "journal"].includes(ACCOUNT_TABLES[table]!) ||
              table === "amp_learners" ||
              table === "amp_grants",
            `${table} still refers to the deleted account`,
          );
        const tombstone = (
          await db.query(
            "SELECT name,birth_year,deleted_at FROM amp_learners WHERE id=$1",
            [learner],
          )
        ).rows[0];
        assert.equal(tombstone.name, "Deleted learner");
        assert.equal(tombstone.birth_year, null);
        assert.ok(tombstone.deleted_at);
        assert.equal(
          await count(
            "SELECT count(*) n FROM amp_attempts WHERE learner_id=$1",
            [learner],
          ),
          0,
        );
        // The plan it paid for stays on record too.
        assert.equal(
          await count("SELECT count(*) n FROM amp_grants WHERE learner_id=$1", [
            learner,
          ]),
          1,
        );
        assert.equal(
          await count(`SELECT count(*) n FROM amp_auth_users WHERE id=$1`, [
            payer.account.slice(4),
          ]),
          0,
        );
      },
    );
  },
);
