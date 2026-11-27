import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { main as revokeCommand } from "../scripts/revoke-sessions.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import {
  providerHash,
  withProviderSessions,
} from "../src/identity/provider-principals.js";
import { SchoolRepository } from "../src/schools/repository.js";
import {
  accountsAuth,
  createAccounts,
  registerAccountRoutes,
} from "../src/server/accounts.js";
import { buildApp } from "../src/server/app.js";
import { PostgresRepository } from "../src/server/repository.js";
import {
  parseRevokeArguments,
  revokeSessions,
  RevokeScopeError,
} from "../src/server/session-revocation.js";
import {
  hashSessionToken,
  RESET_HASH_PREFIX,
} from "../src/server/session-tokens.js";

const YEAR_AHEAD = new Date(Date.now() + 365 * 86_400_000).toISOString();
const origin = "http://127.0.0.1:4310";

test("revoke-sessions arguments name exactly one scope", () => {
  assert.deepEqual(parseRevokeArguments(["--all"]), {
    scope: { kind: "all" },
    dryRun: false,
  });
  assert.deepEqual(parseRevokeArguments(["--dry-run", "--org", "o"]), {
    scope: { kind: "org", orgId: "o" },
    dryRun: true,
  });
  assert.deepEqual(parseRevokeArguments(["--account", "amp|u", "--dry-run"]), {
    scope: { kind: "account", accountId: "amp|u" },
    dryRun: true,
  });
  for (const argv of [
    [],
    ["--dry-run"],
    ["--all", "--org", "o"],
    ["--account"],
    ["--account", "--all"],
    ["--everyone"],
  ])
    assert.throws(() => parseRevokeArguments(argv), RevokeScopeError);
});

test(
  "revoke-sessions: each scope ends exactly its sessions; a dry run writes nothing",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_revoke_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const info = console.info;
    console.info = () => {};
    const repository = new PostgresRepository(scoped.href, {
      development: true,
    });
    const db = repository.pool;
    try {
      await migrate(scoped.href);
      const accounts = await createAccounts(db, {
        baseURL: origin,
        secret: randomBytes(32).toString("hex"),
        production: false,
        passwords: true,
        trustedOrigins: [],
      });
      const authenticate = withProviderSessions(db, accountsAuth(accounts));
      const app = buildApp({ repository, authenticate, development: true });
      await registerAccountRoutes(app, accounts);
      await registerFamilyRoutes(app, {
        pool: db,
        authenticate,
        development: true,
      });
      await app.ready();
      const schools = new SchoolRepository(db);

      /** A request that needs a session: 200 with one, 401 without. */
      const status = async (token: string) =>
        (
          await app.inject({
            method: "GET",
            url: "/api/v1/learners",
            headers: { authorization: `Bearer ${token}` },
          })
        ).statusCode;
      const password = "A long test passphrase";
      /** A parent with two sign-ins (two devices) and an unused reset link. */
      async function parent(email: string) {
        const signUp = await app.inject({
          method: "POST",
          url: "/api/auth/sign-up/email",
          headers: { origin },
          payload: { email, password, name: "Fixture Parent" },
        });
        assert.equal(signUp.statusCode, 200, signUp.body);
        const signIn = await app.inject({
          method: "POST",
          url: "/api/auth/sign-in/email",
          headers: { origin },
          payload: { email, password },
        });
        assert.equal(signIn.statusCode, 200, signIn.body);
        const reset = await app.inject({
          method: "POST",
          url: "/api/auth/request-password-reset",
          headers: { origin },
          payload: { email, redirectTo: `${origin}/sign-in/reset` },
        });
        assert.equal(reset.statusCode, 200, reset.body);
        const user = signUp.json().user.id as string;
        return {
          user,
          account: `amp|${user}`,
          tokens: [
            signUp.headers["set-auth-token"] as string,
            signIn.headers["set-auth-token"] as string,
          ],
        };
      }
      /** A school sign-in (Clever) for this account. */
      async function providerSession(account: string, user: string) {
        await db.query(
          "INSERT INTO amp_provider_principals(account_id,auth_user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
          [account, user],
        );
        const identity = randomUUID();
        await db.query(
          `INSERT INTO amp_provider_identities(id,account_id,provider,environment,district_id,subject,claims)
           VALUES($1,$2,'clever','sandbox',$3,$4,$5)`,
          [
            identity,
            account,
            `district-${identity}`,
            `teacher-${identity}`,
            JSON.stringify({
              environment: "sandbox",
              districtId: `district-${identity}`,
              userId: `teacher-${identity}`,
              roles: ["teacher"],
              schools: [],
            }),
          ],
        );
        const token = `ps_${randomBytes(32).toString("base64url")}`;
        await db.query(
          `INSERT INTO amp_provider_sessions(token_hash,identity_id,purpose,expires_at)
           VALUES($1,$2,'session',now()+interval '2 hours')`,
          [providerHash(token), identity],
        );
        return token;
      }
      async function school(name: string, parentId?: string) {
        const org = await schools.createOrg(
          parentId
            ? { kind: "school", name, parentId }
            : { kind: "district", name, timezone: "America/New_York" },
          {
            version: "fixture-1",
            signerName: "Fixture Signer",
            signerTitle: "Head of School",
          },
        );
        return org.id;
      }
      async function classroom(orgId: string, teacher: string) {
        await schools.issueLicense({ orgId, seats: 30, endsAt: YEAR_AHEAD });
        const period = await schools.createClass(orgId, { name: "Period 1" });
        await schools.addStaff({
          orgId,
          role: "teacher",
          givenName: "Fixture",
          accountId: teacher,
          classId: period.id,
        });
        const student = await schools.provisionStudent(orgId, {
          givenName: "Student",
          classId: period.id,
        });
        const sessions = [];
        for (const mode of ["shared", "personal"] as const)
          sessions.push(
            (
              await schools.issueStudentSession({
                personId: student.personId,
                mode,
              })
            ).token,
          );
        return { personId: student.personId, sessions };
      }

      // A district with one school (Bea teaches there), a school elsewhere
      // (Cal teaches there), and a parent in no school (Ann).
      const ann = await parent("ann@example.com");
      const bea = await parent("bea@example.com");
      const cal = await parent("cal@example.com");
      const district = await school("Fixture District");
      const inDistrict = await school("Fixture School", district);
      const elsewhere = await school("Elsewhere District");
      const beaClass = await classroom(inDistrict, bea.account);
      const calClass = await classroom(elsewhere, cal.account);
      const beaProvider = await providerSession(bea.account, bea.user);
      const calProvider = await providerSession(cal.account, cal.user);

      const live = async () =>
        Object.fromEntries(
          await Promise.all(
            Object.entries({
              ann: ann.tokens,
              bea: [...bea.tokens, beaProvider],
              cal: [...cal.tokens, calProvider],
              beaStudent: beaClass.sessions,
              calStudent: calClass.sessions,
            }).map(async ([who, tokens]) => [
              who,
              await Promise.all(tokens.map(status)),
            ]),
          ),
        );
      const snapshot = async () =>
        (
          await db.query(`SELECT
            (SELECT count(*)::int FROM amp_auth_sessions) AS account,
            (SELECT count(*)::int FROM amp_student_sessions WHERE revoked_at IS NULL) AS student,
            (SELECT count(*)::int FROM amp_provider_sessions WHERE revoked_at IS NULL) AS provider,
            (SELECT count(*)::int FROM amp_auth_verifications) AS verifications,
            (SELECT count(*)::int FROM amp_operator_events) AS operator_events,
            (SELECT count(*)::int FROM amp_school_events) AS school_events`)
        ).rows[0];

      await t.test("every holder starts signed in", async () => {
        assert.deepEqual(await live(), {
          ann: [200, 200],
          bea: [200, 200, 200],
          cal: [200, 200, 200],
          beaStudent: [200, 200],
          calStudent: [200, 200],
        });
        // Reset links are stored hashed, never as the link's token.
        const resets = await db.query(
          "SELECT identifier FROM amp_auth_verifications WHERE value=$1",
          [ann.user],
        );
        assert.equal(resets.rowCount, 1);
        assert.ok(resets.rows[0].identifier.startsWith(RESET_HASH_PREFIX));
      });

      await t.test("a dry run counts and writes nothing", async () => {
        const before = await snapshot();
        assert.deepEqual(
          await revokeSessions(
            db,
            { kind: "org", orgId: district },
            { dryRun: true },
          ),
          {
            accountSessions: 2,
            studentSessions: 2,
            providerSessions: 1,
            resetLinks: 1,
          },
        );
        assert.deepEqual(
          await revokeSessions(
            db,
            { kind: "account", accountId: ann.account },
            { dryRun: true },
          ),
          {
            accountSessions: 2,
            studentSessions: 0,
            providerSessions: 0,
            resetLinks: 1,
          },
        );
        assert.deepEqual(
          await revokeSessions(db, { kind: "all" }, { dryRun: true }),
          {
            accountSessions: 6,
            studentSessions: 4,
            providerSessions: 2,
            resetLinks: 3,
          },
        );
        // The command prints the same counts, and only counts.
        const printed: string[] = [];
        const log = console.log;
        const env = process.env.AMP_DATABASE_URL;
        console.log = (line: string) => printed.push(line);
        process.env.AMP_DATABASE_URL = scoped.href;
        try {
          await revokeCommand(["--all", "--dry-run"]);
        } finally {
          console.log = log;
          if (env === undefined) delete process.env.AMP_DATABASE_URL;
          else process.env.AMP_DATABASE_URL = env;
        }
        assert.deepEqual(
          printed.map((line) => JSON.parse(line)),
          [
            {
              scope: "all",
              dryRun: true,
              accountSessions: 6,
              studentSessions: 4,
              providerSessions: 2,
              resetLinks: 3,
            },
          ],
        );
        assert.deepEqual(await snapshot(), before);
        assert.equal((await live()).ann.join(), "200,200");
      });

      await t.test("an unknown scope is refused before anything", async () => {
        const before = await snapshot();
        await assert.rejects(
          revokeSessions(
            db,
            { kind: "org", orgId: randomUUID() },
            { dryRun: false },
          ),
          RevokeScopeError,
        );
        await assert.rejects(
          revokeSessions(
            db,
            { kind: "account", accountId: "amp|nobody" },
            { dryRun: false },
          ),
          RevokeScopeError,
        );
        assert.deepEqual(await snapshot(), before);
      });

      await t.test(
        "an org: its people's sessions, across the schools under it",
        async () => {
          assert.deepEqual(
            await revokeSessions(
              db,
              { kind: "org", orgId: district },
              { dryRun: false },
            ),
            {
              accountSessions: 2,
              studentSessions: 2,
              providerSessions: 1,
              resetLinks: 1,
            },
          );
          assert.deepEqual(await live(), {
            ann: [200, 200],
            bea: [401, 401, 401],
            cal: [200, 200, 200],
            beaStudent: [401, 401],
            calStudent: [200, 200],
          });
          const recorded = await db.query(
            "SELECT action,scope,target_id,detail FROM amp_operator_events",
          );
          assert.deepEqual(recorded.rows, [
            {
              action: "sessions.revoked",
              scope: "org",
              target_id: district,
              detail: {
                accountSessions: 2,
                studentSessions: 2,
                providerSessions: 1,
                resetLinks: 1,
              },
            },
          ]);
          // The district's own history says so.
          const history = await db.query(
            "SELECT actor_person_id,target_kind FROM amp_school_events WHERE org_id=$1 AND action='signin.sessions-revoked'",
            [district],
          );
          assert.deepEqual(history.rows, [
            { actor_person_id: null, target_kind: "org" },
          ]);
          // Bea signs in again as usual.
          const again = await app.inject({
            method: "POST",
            url: "/api/auth/sign-in/email",
            headers: { origin },
            payload: { email: "bea@example.com", password },
          });
          assert.equal(again.statusCode, 200);
          bea.tokens.push(again.headers["set-auth-token"] as string);
          assert.equal(await status(bea.tokens.at(-1)!), 200);
        },
      );

      await t.test("an account: its sign-ins and reset link only", async () => {
        assert.deepEqual(
          await revokeSessions(
            db,
            { kind: "account", accountId: ann.account },
            { dryRun: false },
          ),
          {
            accountSessions: 2,
            studentSessions: 0,
            providerSessions: 0,
            resetLinks: 1,
          },
        );
        assert.deepEqual((await live()).ann, [401, 401]);
        assert.equal(await status(bea.tokens.at(-1)!), 200);
        assert.deepEqual((await live()).cal, [200, 200, 200]);
        // A student's account: that student's sessions only.
        assert.deepEqual(
          await revokeSessions(
            db,
            { kind: "account", accountId: `school:${calClass.personId}` },
            { dryRun: false },
          ),
          {
            accountSessions: 0,
            studentSessions: 2,
            providerSessions: 0,
            resetLinks: 0,
          },
        );
        assert.deepEqual((await live()).calStudent, [401, 401]);
        assert.deepEqual((await live()).cal, [200, 200, 200]);
      });

      await t.test("all: every session left", async () => {
        assert.deepEqual(
          await revokeSessions(db, { kind: "all" }, { dryRun: false }),
          {
            // Cal's two, Bea's new one.
            accountSessions: 3,
            studentSessions: 0,
            providerSessions: 1,
            resetLinks: 1,
          },
        );
        assert.deepEqual(await live(), {
          ann: [401, 401],
          // Her two first sign-ins, her school sign-in, the one after.
          bea: [401, 401, 401, 401],
          cal: [401, 401, 401],
          beaStudent: [401, 401],
          calStudent: [401, 401],
        });
        assert.deepEqual(
          (
            await db.query(
              'SELECT scope FROM amp_operator_events ORDER BY "at"',
            )
          ).rows.map((row) => row.scope),
          ["org", "account", "account", "all"],
        );
        await assert.rejects(
          db.query("DELETE FROM amp_operator_events"),
          /append-only/,
        );
      });

      await t.test(
        "session tokens: stored as their hash; the hash itself opens nothing",
        async () => {
          const signIn = await app.inject({
            method: "POST",
            url: "/api/auth/sign-in/email",
            headers: { origin },
            payload: { email: "cal@example.com", password },
          });
          const signed = signIn.headers["set-auth-token"] as string;
          const raw = signed.split(".")[0]!;
          const stored = async () =>
            (
              await db.query(
                'SELECT id,token FROM amp_auth_sessions WHERE "userId"=$1',
                [cal.user],
              )
            ).rows;
          assert.deepEqual(
            (await stored()).map((row) => row.token),
            [hashSessionToken(raw)],
            "only the hash is written",
          );
          assert.equal(await status(signed), 200);
          assert.equal(await status(raw), 200);
          // The web app reads its bearer from the session: still the token.
          const session = await app.inject({
            method: "GET",
            url: "/api/auth/get-session",
            headers: { authorization: `Bearer ${raw}` },
          });
          assert.equal(session.json().session.token, raw);
          // A row an older pod wrote as issued: found, then stored as its hash.
          const id = (await stored())[0]!.id;
          await db.query("UPDATE amp_auth_sessions SET token=$1 WHERE id=$2", [
            raw,
            id,
          ]);
          assert.equal(await status(signed), 200);
          assert.deepEqual(
            (await stored()).map((row) => row.token),
            [hashSessionToken(raw)],
          );
          // The migration hashes rows stored before this release in place,
          // and the browser holding the token stays signed in.
          await db.query("UPDATE amp_auth_sessions SET token=$1 WHERE id=$2", [
            raw,
            id,
          ]);
          await db.query(
            await readFile(
              new URL(
                "../migrations/0158-hash-session-tokens.sql",
                import.meta.url,
              ),
              "utf8",
            ),
          );
          assert.deepEqual(
            (await stored()).map((row) => row.token),
            [hashSessionToken(raw)],
          );
          assert.equal(await status(signed), 200);
          // A copy of the database holds only the hash, which opens nothing.
          assert.equal(await status(hashSessionToken(raw)), 401);
          // The endpoints that would hand out or act on stored tokens are off.
          for (const path of [
            "/list-sessions",
            "/revoke-session",
            "/revoke-other-sessions",
          ]) {
            const response = await app.inject({
              method: path === "/list-sessions" ? "GET" : "POST",
              url: `/api/auth${path}`,
              headers: { origin, authorization: `Bearer ${raw}` },
              ...(path === "/list-sessions" ? {} : { payload: {} }),
            });
            assert.equal(response.statusCode, 404, path);
          }
          // And the bulk command still ends it.
          assert.equal(
            (
              await revokeSessions(
                db,
                { kind: "account", accountId: cal.account },
                { dryRun: false },
              )
            ).accountSessions,
            1,
          );
          assert.equal(await status(signed), 401);
        },
      );
      await app.close();
    } finally {
      console.info = info;
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
