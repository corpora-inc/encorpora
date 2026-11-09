import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { schoolAdmin } from "../scripts/school-admin.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
import {
  CLASSROOM_SCOPES,
  classroomRedirectUri,
} from "../src/schools/google-classroom.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

/** Google stands in as a local server: a token endpoint and the two Classroom
 * lists, with a second page of students to prove paging. */
function fakeGoogle(grantedScope: () => string) {
  const seen: { path: string; auth?: string }[] = [];
  const students = [1, 2, 3].map((n) => ({
    userId: `g-${n}`,
    profile: {
      id: `g-${n}`,
      name: {
        givenName: ["Ana", "Noor", "Lena"][n - 1],
        familyName: "Fixture",
      },
      emailAddress: `student${n}@school.example`,
    },
  }));
  const server: Server = createServer((request, response) => {
    const url = new URL(request.url!, "http://x");
    seen.push({ path: url.pathname, auth: request.headers.authorization });
    response.setHeader("content-type", "application/json");
    if (url.pathname === "/token")
      return void response.end(
        JSON.stringify({ access_token: "fake-token", scope: grantedScope() }),
      );
    if (request.headers.authorization !== "Bearer fake-token") {
      response.statusCode = 401;
      return void response.end("{}");
    }
    if (url.pathname === "/v1/courses") {
      assert.equal(url.searchParams.get("teacherId"), "me");
      assert.equal(url.searchParams.get("courseStates"), "ACTIVE");
      return void response.end(
        JSON.stringify({ courses: [{ id: "c-1", name: "Period 2 Math" }] }),
      );
    }
    if (url.pathname === "/v1/courses/c-1/students") {
      const second = url.searchParams.get("pageToken") === "p2";
      return void response.end(
        JSON.stringify(
          second
            ? { students: students.slice(2) }
            : { students: students.slice(0, 2), nextPageToken: "p2" },
        ),
      );
    }
    response.statusCode = 404;
    response.end("{}");
  });
  return { server, seen };
}

test(
  "Google Classroom roster import: consent, course, dry run, apply, idempotent",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_gclass_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href);
    const db = learning.pool;
    const schools = new SchoolRepository(db);
    let granted = CLASSROOM_SCOPES.join(" ");
    const google = fakeGoogle(() => granted);
    await new Promise<void>((done) =>
      google.server.listen(0, "127.0.0.1", done),
    );
    const origin = `http://127.0.0.1:${(google.server.address() as AddressInfo).port}`;
    const authenticate = refuseStudentTokens(async (request) => {
      const header = request.headers.authorization;
      if (header?.startsWith("Bearer amp|")) return header.slice(7);
      throw new ApiError(401, "Sign in to continue");
    });
    const services = {
      secret: "fixture-secret-fixture-secret-fixture-secret",
      origin: "https://amp.example",
    };
    const app = buildApp({ repository: learning, authenticate });
    await registerFamilyRoutes(app, { pool: db, authenticate });
    await registerSchoolRoutes(app, {
      pool: db,
      authenticate,
      services: {
        ...services,
        classroom: {
          clientId: "client-id",
          clientSecret: "client-secret",
          authorizationEndpoint: `${origin}/authorize`,
          tokenEndpoint: `${origin}/token`,
          apiBase: `${origin}/v1`,
        },
      },
    });
    await app.ready();
    t.after(async () => {
      await app.close();
      await learning.close();
      google.server.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });

    const as = (account: string) => ({ authorization: `Bearer ${account}` });
    const get = (path: string, account: string, headers = {}) =>
      app.inject({
        method: "GET",
        url: path,
        headers: { ...as(account), ...headers },
      });
    const post = (path: string, account: string, payload: object = {}) =>
      app.inject({ method: "POST", url: path, headers: as(account), payload });
    const id = randomUUID();
    await db.query(
      `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
       VALUES($1,'','head@gclass.example',false,now(),now())`,
      [id],
    );
    const head = `amp|${id}`;
    const day = (offset: number) =>
      new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    const issued = (await schoolAdmin(
      schools,
      "create-school",
      {
        name: "Fixture Academy",
        adminEmail: "head@gclass.example",
        seats: 30,
        startsOn: day(-1),
        endsOn: day(365),
        reference: "Pilot",
      },
      services,
    )) as { orgId: string; setupUrl: string };
    const [token, proof] = issued.setupUrl.split("#")[1]!.split(".");
    assert.equal(
      (
        await post("/api/v1/school/invites/accept", head, {
          token,
          proof,
          name: "Grace Okafor",
        })
      ).statusCode,
      200,
    );
    const base = `/api/v1/school/orgs/${issued.orgId}`;
    for (const [path, body] of [
      [
        "calendar",
        { startsOn: "2026-08-15", endsOn: "2027-06-15", division: "semester" },
      ],
      ["setup/experience", { preset: "quiet" }],
      [
        "setup/agreement",
        {
          version: AGREEMENT_VERSION,
          signerName: "Grace Okafor",
          signerTitle: "Head",
        },
      ],
    ] as const)
      assert.equal((await post(`${base}/${path}`, head, body)).statusCode, 200);

    await t.test(
      "status, then consent with exactly the three scopes",
      async () => {
        assert.deepEqual((await get(`${base}/google-classroom`, head)).json(), {
          enabled: true,
          authorized: false,
        });
        assert.equal(
          (await get(`${base}/google-classroom/courses`, head)).statusCode,
          409,
        );
        const start = await post(`${base}/google-classroom/authorize`, head);
        assert.equal(start.statusCode, 200, start.body);
        const target = new URL(start.json().url);
        assert.equal(target.origin + target.pathname, `${origin}/authorize`);
        assert.deepEqual(target.searchParams.get("scope")!.split(" "), [
          "https://www.googleapis.com/auth/classroom.courses.readonly",
          "https://www.googleapis.com/auth/classroom.rosters.readonly",
          "https://www.googleapis.com/auth/classroom.profile.emails",
        ]);
        assert.equal(
          target.searchParams.get("redirect_uri"),
          classroomRedirectUri(services.origin),
        );
        assert.equal(target.searchParams.get("code_challenge_method"), "S256");
        const cookie = String(start.headers["set-cookie"]).split(";")[0]!;
        const callback = (state: string) =>
          get(
            `/api/v1/school/google-classroom/callback?code=abc&state=${state}`,
            head,
            { cookie },
          );
        // A forged state is refused; so is consent missing a scope.
        assert.match(
          String((await callback("wrong")).headers.location),
          /google=failed/,
        );
        granted = CLASSROOM_SCOPES.slice(0, 2).join(" ");
        assert.match(
          String(
            (await callback(target.searchParams.get("state")!)).headers
              .location,
          ),
          /google=scopes/,
        );
        assert.equal(
          (await get(`${base}/google-classroom`, head)).json().authorized,
          false,
        );
        granted = CLASSROOM_SCOPES.join(" ");
        const done = await callback(target.searchParams.get("state")!);
        assert.equal(done.statusCode, 302);
        assert.equal(
          done.headers.location,
          `/school/${issued.orgId}/import?google=ready`,
        );
        assert.equal(
          (await get(`${base}/google-classroom`, head)).json().authorized,
          true,
        );
        // Stored encrypted, never the token itself.
        const sealed = (
          await db.query("SELECT sealed_token FROM amp_google_classroom_grants")
        ).rows[0];
        assert.ok(!sealed.sealed_token.includes("fake-token"));
      },
    );

    let rows: unknown[] = [];
    let source = "";
    await t.test(
      "courses, then the students of the one picked, paged",
      async () => {
        const courses = await get(`${base}/google-classroom/courses`, head);
        assert.deepEqual(courses.json().courses, [
          { id: "c-1", name: "Period 2 Math" },
        ]);
        const found = await post(`${base}/google-classroom/students`, head, {
          courseId: "c-1",
        });
        assert.equal(found.statusCode, 200, found.body);
        rows = found.json().rows;
        source = found.json().source;
        assert.equal(source, "google-classroom:c-1");
        assert.equal(rows.length, 3);
        // The token is discarded as soon as the students are read.
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int AS n FROM amp_google_classroom_grants",
            )
          ).rows[0].n,
          0,
        );
        assert.equal(
          (await get(`${base}/google-classroom/courses`, head)).statusCode,
          409,
        );
      },
    );

    await t.test("the dry run and the apply are idempotent", async () => {
      const plan = async () =>
        (await post(`${base}/roster/plan`, head, { source, rows }))
          .json()
          .results.map((r: { status: string }) => r.status);
      assert.deepEqual(await plan(), ["new", "new", "new"]);
      for (const round of [1, 2]) {
        const applied = await post(`${base}/roster/apply`, head, {
          source,
          rows,
        });
        assert.equal(applied.statusCode, 200, applied.body);
        const statuses = applied
          .json()
          .results.map((r: { status: string }) => r.status);
        assert.ok(
          statuses.every((s: string) =>
            round === 1 ? s === "created" : s === "unchanged",
          ),
          JSON.stringify(statuses),
        );
      }
      assert.deepEqual(await plan(), ["unchanged", "unchanged", "unchanged"]);
      const people = await db.query(
        `SELECT p.email,r.source,r.sourced_id FROM amp_people p
         JOIN amp_external_refs r ON r.local_id=p.id AND r.kind='person'
         WHERE p.tenant_id=(SELECT path[1] FROM amp_orgs WHERE id=$1) ORDER BY r.sourced_id`,
        [issued.orgId],
      );
      assert.deepEqual(
        people.rows.map((r) => [r.email, r.source, r.sourced_id]),
        [1, 2, 3].map((n) => [`student${n}@school.example`, source, `g-${n}`]),
      );
      const classes = await db.query(
        "SELECT count(*)::int AS n FROM amp_external_refs WHERE kind='class' AND source=$1",
        [source],
      );
      assert.equal(classes.rows[0].n, 1);
    });

    await t.test(
      "a source that is not Classroom or a file is refused",
      async () => {
        const bad = await post(`${base}/roster/plan`, head, {
          source: "google-classroom:../x",
          rows: [],
        });
        assert.equal(bad.statusCode, 400);
      },
    );
  },
);
