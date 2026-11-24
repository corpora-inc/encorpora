import type { LinkedMessage } from "../src/email/email.js";
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { schoolAdmin } from "../scripts/school-admin.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

/* The invitation screen's one Continue opens creating an account or signing
   in, so the invitation's lookup says which the invited address needs
   (`hasAccount`). That answer is the holder's alone: an open invitation's
   token, about the address it was sent to, and nothing else. Every name and
   address here is made up. */
test(
  "an invitation says whether its own address has an account, only while it is open, only to its token",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_invite_answer_${randomUUID().replaceAll("-", "")}`;
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
    const mailed: { to: string; url: string }[] = [];
    const services = {
      secret: randomBytes(32).toString("hex"),
      origin: "https://amp.example.test",
      mail: async (to: string, { url: link }: LinkedMessage) => {
        mailed.push({ to, url: link });
      },
    };
    const app = buildApp({ repository: learning, authenticate });
    await registerFamilyRoutes(app, {
      pool: db,
      authenticate,
      approvals: services,
    });
    await registerSchoolRoutes(app, { pool: db, authenticate, services });
    await app.ready();
    t.after(async () => {
      await app.close();
      await learning.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });

    const post = (path: string, account: string | null, payload: object = {}) =>
      app.inject({
        method: "POST",
        url: path,
        ...(account ? { headers: { authorization: `Bearer ${account}` } } : {}),
        payload,
      });
    const LOOKUP = "/api/v1/school/invites/lookup";
    /** The invitation as its link's holder reads it, signed out. */
    const read = async (token: string) => {
      const response = await post(LOOKUP, null, { token });
      assert.equal(response.statusCode, 200, response.body);
      return response.json().invite as Record<string, unknown>;
    };
    const address = (who: string) =>
      `${who}-${randomUUID().slice(0, 8)}@example.test`;
    const user = async (email: string) => {
      const id = randomUUID();
      await db.query(
        `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
         VALUES($1,'',$2,true,now(),now())`,
        [id, email],
      );
      return `amp|${id}`;
    };
    const parts = (link: string) => {
      const [token, proof] = new URL(link).hash.slice(1).split(".");
      return { token: token!, proof: proof! };
    };
    const linkTo = (email: string) => {
      const sent = mailed.filter((message) => message.to === email).at(-1);
      assert.ok(sent, `an invitation mailed to ${email}`);
      return parts(sent.url);
    };

    // A family whose holder invites a second parent.
    const holder = await user(address("fern"));
    await db.query(
      `INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference)
       VALUES($1,'policy','verified','fixture-proof')`,
      [holder],
    );
    assert.equal(
      (
        await post("/api/v1/learners", holder, {
          name: "Maya",
          birthYear: 2016,
        })
      ).statusCode,
      201,
    );
    const invite = async (email: string) => {
      const sent = await post("/api/v1/family/second-parent", holder, {
        email,
      });
      assert.equal(sent.statusCode, 201, sent.body);
      return linkTo(email.toLowerCase());
    };

    const rowanEmail = address("rowan");
    // Invited as typed, in capitals: the same address.
    const first = await invite(rowanEmail.toUpperCase());

    await t.test(
      "an open invitation to an address with no account says so",
      async () => {
        const view = await read(first.token);
        assert.equal(view.status, "open");
        assert.equal(view.email, rowanEmail);
        assert.equal(view.hasAccount, false);
      },
    );

    await t.test(
      "it is about the invited address only: other accounts change nothing, and no address can be asked about",
      async () => {
        const other = address("sky");
        await user(other);
        assert.equal((await read(first.token)).hasAccount, false);
        // The lookup takes the token and nothing else.
        for (const extra of [{ email: other }, { email: holder }]) {
          const asked = await post(LOOKUP, null, {
            token: first.token,
            ...extra,
          });
          assert.equal(asked.statusCode, 400, asked.body);
          assert.doesNotMatch(asked.body, /hasAccount/);
        }
      },
    );

    await t.test(
      "once the invited address has an account, it says that",
      async () => {
        await user(rowanEmail);
        const view = await read(first.token);
        assert.equal(view.status, "open");
        assert.equal(view.hasAccount, true);
      },
    );

    await t.test(
      "without a valid invitation token there is no answer",
      async () => {
        const refusals: [object, number][] = [
          // A token no invitation has.
          [{ token: "x".repeat(43) }, 404],
          // The mailbox's proof is not the token.
          [{ token: first.proof }, 404],
          // Not a token at all, an address in its place, or nothing.
          [{ token: rowanEmail }, 400],
          [{ token: first.token.slice(0, 42) }, 400],
          [{ email: rowanEmail }, 400],
          [{}, 400],
        ];
        for (const [payload, status] of refusals) {
          const response = await post(LOOKUP, null, payload);
          assert.equal(
            response.statusCode,
            status,
            `${JSON.stringify(payload)}: ${response.body}`,
          );
          assert.doesNotMatch(response.body, /hasAccount|true|false/);
        }
        // Being signed in is no token either.
        const signedIn = await post(LOOKUP, holder, { token: "y".repeat(43) });
        assert.equal(signedIn.statusCode, 404);
        assert.doesNotMatch(signedIn.body, /hasAccount/);
      },
    );

    await t.test("an expired invitation gives no answer", async () => {
      const { rowCount } = await db.query(
        `UPDATE amp_person_credentials SET expires_at=now()-interval '1 minute'
         WHERE kind='invite' AND revoked_at IS NULL`,
      );
      assert.equal(rowCount, 1);
      const view = await read(first.token);
      assert.equal(view.status, "expired");
      assert.ok(!("hasAccount" in view), JSON.stringify(view));
      await db.query(
        `UPDATE amp_person_credentials SET expires_at=now()+interval '1 day'
         WHERE kind='invite' AND revoked_at IS NULL`,
      );
      assert.equal((await read(first.token)).hasAccount, true);
    });

    await t.test("an ended invitation gives no answer", async () => {
      const removed = await post("/api/v1/family/second-parent/remove", holder);
      assert.equal(removed.statusCode, 200, removed.body);
      const view = await read(first.token);
      assert.equal(view.status, "ended");
      assert.ok(!("hasAccount" in view), JSON.stringify(view));
    });

    await t.test("a used invitation gives no answer", async () => {
      const quinnEmail = address("quinn");
      const quinn = await user(quinnEmail);
      const second = await invite(quinnEmail);
      assert.equal((await read(second.token)).hasAccount, true);
      const accepted = await post("/api/v1/school/invites/accept", quinn, {
        ...second,
        name: "Quinn Fixture",
      });
      assert.equal(accepted.statusCode, 200, accepted.body);
      const view = await read(second.token);
      assert.equal(view.status, "used");
      assert.ok(!("hasAccount" in view), JSON.stringify(view));
    });

    await t.test("a school's invitation answers the same way", async () => {
      const headEmail = address("head");
      const issued = (await schoolAdmin(
        new SchoolRepository(db),
        "create-school",
        {
          name: "Linden Park School",
          adminEmail: headEmail,
          seats: 30,
          startsOn: new Date(Date.now() - 86_400_000)
            .toISOString()
            .slice(0, 10),
          endsOn: new Date(Date.now() + 365 * 86_400_000)
            .toISOString()
            .slice(0, 10),
          reference: "Pilot",
        },
        services,
      )) as { setupUrl: string };
      const { token } = parts(issued.setupUrl);
      const before = await read(token);
      assert.equal(before.setup, true);
      assert.equal(before.hasAccount, false);
      await user(headEmail);
      assert.equal((await read(token)).hasAccount, true);
    });
  },
);
