import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { CLASS_FAILURES, STUDENT_FAILURES } from "../src/schools/sign-in.js";
import { JOIN_RATE_LIMIT } from "../src/schools/sign-in-routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

const YEAR_AHEAD = new Date(Date.now() + 365 * 86_400_000).toISOString();
const agreement = {
  version: "fixture-1",
  signerName: "Fixture Signer",
  signerTitle: "Head of School",
};
const MINE = ["fox", "boat", "kite"];
const NOT_MINE = ["owl", "frog", "sun"];

test(
  "AMP for Schools: students sign in by code, pictures and card",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_school_join_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href);
    const db = learning.pool;
    const schools = new SchoolRepository(db);
    const authenticate = refuseStudentTokens(async (request) => {
      const header = request.headers.authorization;
      if (header?.startsWith("Bearer amp|")) return header.slice(7);
      throw new ApiError(401, "Sign in to continue");
    });
    const app = buildApp({ repository: learning, authenticate });
    await registerFamilyRoutes(app, { pool: db, authenticate });
    await registerSchoolRoutes(app, { pool: db, authenticate });
    await app.ready();

    const join = (path: string, payload: object) =>
      app.inject({
        method: "POST",
        url: `/api/v1/school/join/${path}`,
        payload,
      });
    const staff = (
      method: "GET" | "POST",
      account: string,
      path: string,
      payload?: object,
    ) =>
      app.inject({
        method,
        url: `/api/v1/school/${path}`,
        headers: { authorization: `Bearer ${account}` },
        ...(method === "POST" ? { payload: payload ?? {} } : {}),
      });
    async function school(name: string) {
      const org = await schools.createOrg(
        { kind: "school", name, timezone: "America/New_York" },
        agreement,
      );
      await schools.issueLicense({
        orgId: org.id,
        seats: 60,
        endsAt: YEAR_AHEAD,
      });
      const period = await schools.createClass(org.id, { name: "Period 1" });
      const teacher = `amp|teacher-${randomUUID()}`;
      await schools.addStaff({
        orgId: org.id,
        role: "teacher",
        givenName: "Fixture",
        accountId: teacher,
        classId: period.id,
      });
      return { orgId: org.id, period, teacher };
    }
    const home = await school("Home School");
    const away = await school("Away School");
    const enroll = (
      orgId: string,
      classId: string,
      givenName: string,
      familyName?: string,
      extra: object = {},
    ) =>
      schools.provisionStudent(orgId, {
        givenName,
        ...(familyName ? { familyName } : {}),
        classId,
        ...extra,
      });
    const tries = (
      code: string,
      personId: string,
      pictures: string[],
      set = false,
    ) => join("picture", { code, personId, pictures, ...(set ? { set } : {}) });
    const practiceWith = (token: string) =>
      app.inject({
        method: "GET",
        url: "/api/v1/me",
        headers: { authorization: `Bearer ${token}` },
      });

    try {
      await t.test(
        "lookup: a minimal roster, whatever the case or hyphen",
        async () => {
          const amara = await enroll(
            home.orgId,
            home.period.id,
            "Amara",
            "Osei",
            {
              email: "fixture-amara@example.test",
              identifier: "SIS-1",
              gradeLevel: 3,
            },
          );
          await enroll(home.orgId, home.period.id, "Theo", undefined, {
            displayName: "Theo the Second",
          });
          const code = home.period.joinCode;
          const shown = `${code.slice(0, 3).toLowerCase()}-${code.slice(3)}`;
          const response = await join("lookup", { code: shown });
          assert.equal(response.statusCode, 200);
          const body = response.json();
          assert.deepEqual(body.class, { name: "Period 1" });
          assert.deepEqual(
            body.students.map((s: { name: string }) => s.name),
            ["Amara O.", "Theo the Second"],
          );
          for (const student of body.students)
            assert.deepEqual(Object.keys(student).sort(), [
              "id",
              "name",
              "picturesSet",
            ]);
          for (const secret of [
            "fixture-amara",
            "SIS-1",
            "Osei",
            amara.learnerId,
            home.orgId,
          ])
            assert.equal(response.body.includes(secret), false, secret);
          assert.equal(response.headers["cache-control"], "no-store");
          assert.equal(
            (await join("lookup", { code: "ZZZZZZ" })).statusCode,
            404,
          );
        },
      );

      await t.test(
        "lookup: only a live class and active students",
        async () => {
          const ended = await school("Ended School");
          const gone = await enroll(ended.orgId, ended.period.id, "Gone");
          await db.query(
            "UPDATE amp_org_roles SET begin_on=begin_on-2,end_on=begin_on-1 WHERE person_id=$1",
            [gone.personId],
          );
          const still = await join("lookup", { code: ended.period.joinCode });
          assert.deepEqual(still.json().students, []);
          await db.query(
            "UPDATE amp_classes SET archived_at=now() WHERE id=$1",
            [ended.period.id],
          );
          assert.equal(
            (await join("lookup", { code: ended.period.joinCode })).statusCode,
            404,
          );
          const finished = await school("Finished Term School");
          await db.query(
            `UPDATE amp_academic_sessions SET starts_on=now()-interval '40 days',ends_on=now()-interval '2 days'
           WHERE id=$1`,
            [finished.period.sessionId],
          );
          assert.equal(
            (await join("lookup", { code: finished.period.joinCode }))
              .statusCode,
            404,
          );
        },
      );

      await t.test(
        "pictures: chosen once, then the same ones in order",
        async () => {
          const code = home.period.joinCode;
          const student = await enroll(home.orgId, home.period.id, "First");
          const { personId } = student;
          const unset = await tries(code, personId, MINE);
          assert.equal(unset.statusCode, 409);
          assert.equal(unset.json().error, "pictures_not_set");

          const first = await tries(code, personId, MINE, true);
          assert.equal(first.statusCode, 200, first.body);
          const grant = first.json();
          assert.equal(grant.mode, "shared");
          assert.match(grant.token, /^st_/);
          assert.equal(grant.accountId, `school:${personId}`);
          const me = await practiceWith(grant.token);
          assert.equal(me.statusCode, 200);
          assert.equal(me.json().account.kind, "student");

          const stored = (
            await db.query(
              "SELECT secret_hash FROM amp_person_credentials WHERE person_id=$1 AND kind='picture'",
              [personId],
            )
          ).rows;
          assert.equal(stored.length, 1);
          for (const picture of MINE)
            assert.equal(stored[0].secret_hash.includes(picture), false);

          // Setting again can't replace them: it's only a guess.
          const replace = await tries(code, personId, NOT_MINE, true);
          assert.equal(replace.statusCode, 422);
          assert.equal(
            (await tries(code, personId, ["kite", "boat", "fox"])).statusCode,
            422,
            "order matters",
          );
          assert.equal((await tries(code, personId, MINE)).statusCode, 200);

          const other = await enroll(home.orgId, home.period.id, "Other");
          await tries(code, other.personId, MINE, true);
          const hashes = (
            await db.query(
              "SELECT secret_hash FROM amp_person_credentials WHERE kind='picture' AND person_id=ANY($1::uuid[])",
              [[personId, other.personId]],
            )
          ).rows.map((row) => row.secret_hash);
          assert.notEqual(hashes[0], hashes[1], "a salt per student");

          assert.equal(
            (await tries(code, personId, ["fox", "fox", "fox"])).statusCode,
            400,
          );
          assert.equal(
            (await tries(code, personId, ["fox", "boat", "dragon"])).statusCode,
            400,
          );
        },
      );

      await t.test(
        "pictures: a student of another class gets the same answer as a wrong guess",
        async () => {
          const outsider = await enroll(away.orgId, away.period.id, "Outsider");
          await tries(away.period.joinCode, outsider.personId, MINE, true);
          const wrong = await tries(
            home.period.joinCode,
            outsider.personId,
            MINE,
          );
          assert.equal(wrong.statusCode, 422);
          assert.deepEqual(wrong.json(), { error: "wrong_pictures" });
          const unknown = await tries(home.period.joinCode, randomUUID(), MINE);
          assert.deepEqual(unknown.json(), { error: "wrong_pictures" });
        },
      );

      await t.test(
        "lockout: five wrong tries pause one student, and only that one",
        async () => {
          const code = home.period.joinCode;
          const locked = await enroll(home.orgId, home.period.id, "Locked");
          const beside = await enroll(home.orgId, home.period.id, "Beside");
          await tries(code, locked.personId, MINE, true);
          await tries(code, beside.personId, MINE, true);
          // From one address, as a school is: the class's other students aren't
          // touched, so the count isn't by address.
          for (let wrong = 1; wrong < STUDENT_FAILURES; wrong++)
            assert.equal(
              (await tries(code, locked.personId, NOT_MINE)).statusCode,
              422,
              `try ${wrong}`,
            );
          const fifth = await tries(code, locked.personId, NOT_MINE);
          assert.equal(fifth.statusCode, 423);
          assert.equal(fifth.json().error, "student_locked");
          assert.equal(fifth.json().retryAfter, 60);
          assert.equal(fifth.headers["retry-after"], "60");
          const right = await tries(code, locked.personId, MINE);
          assert.equal(right.statusCode, 423, "even the right pictures wait");
          assert.equal(
            (await tries(code, beside.personId, MINE)).statusCode,
            200,
          );

          // When the minute's up, a fresh five.
          await db.query(
            "UPDATE amp_person_credentials SET locked_until=now()-interval '1 second' WHERE person_id=$1 AND kind='picture'",
            [locked.personId],
          );
          assert.equal(
            (await tries(code, locked.personId, NOT_MINE)).statusCode,
            422,
          );
          assert.equal(
            (await tries(code, locked.personId, MINE)).statusCode,
            200,
          );
          const clean = (
            await db.query(
              "SELECT failed_count,locked_until FROM amp_person_credentials WHERE person_id=$1 AND kind='picture' AND revoked_at IS NULL",
              [locked.personId],
            )
          ).rows[0];
          assert.deepEqual(clean, { failed_count: 0, locked_until: null });
        },
      );

      await t.test(
        "lockout: tries sent at once can't get past the limit",
        async () => {
          const code = home.period.joinCode;
          const rushed = await enroll(home.orgId, home.period.id, "Rushed");
          await tries(code, rushed.personId, MINE, true);
          const responses = await Promise.all(
            Array.from({ length: 24 }, () =>
              tries(code, rushed.personId, NOT_MINE),
            ),
          );
          const checked = responses.filter((r) => r.statusCode === 422).length;
          assert.ok(
            checked < STUDENT_FAILURES,
            `${checked} guesses were checked at once`,
          );
          assert.equal(
            (await tries(code, rushed.personId, MINE)).statusCode,
            423,
          );
        },
      );

      await t.test(
        "lockout: guessing across a class pauses the class, until a new code",
        async () => {
          const guessed = await school("Guessed School");
          const code = guessed.period.joinCode;
          const students = await Promise.all(
            Array.from({ length: 14 }, (_, index) =>
              enroll(guessed.orgId, guessed.period.id, `Student${index}`),
            ),
          );
          for (const student of students)
            await tries(code, student.personId, MINE, true);
          let guesses = 0;
          for (const student of students)
            for (let wrong = 1; wrong < STUDENT_FAILURES; wrong++)
              if (guesses < CLASS_FAILURES) {
                guesses++;
                await tries(code, student.personId, NOT_MINE);
              }
          assert.equal(guesses, CLASS_FAILURES);
          const paused = await join("lookup", { code });
          assert.equal(paused.statusCode, 423);
          assert.equal(paused.json().error, "class_locked");
          assert.ok(paused.json().retryAfter > 200);
          const student = students[13]!;
          assert.equal(
            (await tries(code, student.personId, MINE)).statusCode,
            423,
          );
          const events = await db.query(
            "SELECT 1 FROM amp_school_events WHERE action='class.join-locked' AND target_id=$1",
            [guessed.period.id],
          );
          assert.equal(events.rowCount, 1);

          const rotated = await staff(
            "POST",
            guessed.teacher,
            `classes/${guessed.period.id}/rotate-code`,
          );
          assert.equal(rotated.statusCode, 200);
          const fresh = rotated.json().joinCode;
          assert.notEqual(fresh, code);
          assert.equal((await join("lookup", { code })).statusCode, 404);
          assert.equal((await join("lookup", { code: fresh })).statusCode, 200);
          assert.equal(
            (await tries(fresh, student.personId, MINE)).statusCode,
            200,
          );
        },
      );

      await t.test(
        "cards: a link that signs in until it's reissued",
        async () => {
          const cls = `classes/${home.period.id}`;
          const student = await enroll(
            home.orgId,
            home.period.id,
            "Carded",
            "Kid",
          );
          const issued = await staff("POST", home.teacher, `${cls}/cards`, {
            personIds: [student.personId],
          });
          assert.equal(issued.statusCode, 200, issued.body);
          const { cards, class: info } = issued.json();
          assert.equal(info.name, "Period 1");
          assert.equal(cards.length, 1);
          assert.equal(cards[0].name, "Carded K.");
          const { token } = cards[0];
          assert.match(token, /^[A-Za-z0-9_-]{43}$/);
          const stored = (
            await db.query(
              "SELECT lookup_hash FROM amp_person_credentials WHERE person_id=$1 AND kind='card'",
              [student.personId],
            )
          ).rows;
          assert.equal(stored.length, 1);
          assert.notEqual(stored[0].lookup_hash, token);

          const signedIn = await join("card", { token });
          assert.equal(signedIn.statusCode, 200, signedIn.body);
          assert.equal(signedIn.json().accountId, `school:${student.personId}`);
          assert.equal(
            (await practiceWith(signedIn.json().token)).statusCode,
            200,
          );

          const roster = await staff("GET", home.teacher, `${cls}/roster`);
          const row = roster
            .json()
            .students.find((s: { id: string }) => s.id === student.personId);
          assert.ok(row.cardIssuedAt);
          assert.equal(row.activeSessions, 1);
          assert.ok(row.lastSeenAt);
          assert.equal(roster.json().canManage, true);
          assert.equal(roster.body.includes(token), false);

          const missing = await staff("POST", home.teacher, `${cls}/cards`, {
            missingOnly: true,
            personIds: [student.personId],
          });
          assert.deepEqual(missing.json().cards, [], "it still works");

          const again = await staff("POST", home.teacher, `${cls}/cards`, {
            personIds: [student.personId],
          });
          const revoked = await join("card", { token });
          assert.equal(revoked.statusCode, 410);
          assert.equal(revoked.json().error, "card_expired");
          assert.equal(
            (await join("card", { token: again.json().cards[0].token }))
              .statusCode,
            200,
          );

          const expires = await db.query(
            "UPDATE amp_person_credentials SET expires_at=now()-interval '1 second' WHERE person_id=$1 AND kind='card' AND revoked_at IS NULL",
            [student.personId],
          );
          assert.equal(expires.rowCount, 1);
          assert.equal(
            (await join("card", { token: again.json().cards[0].token }))
              .statusCode,
            410,
          );
          for (const made of ["nope", "x".repeat(43), ""])
            assert.equal(
              (await join("card", { token: made })).statusCode,
              410,
              made,
            );
        },
      );

      await t.test("card: a removed student's card stops working", async () => {
        const cls = `classes/${home.period.id}`;
        const student = await enroll(home.orgId, home.period.id, "Leaving");
        const { cards } = (
          await staff("POST", home.teacher, `${cls}/cards`, {
            personIds: [student.personId],
          })
        ).json();
        await db.query(
          "UPDATE amp_org_roles SET begin_on=begin_on-2,end_on=begin_on-1 WHERE person_id=$1",
          [student.personId],
        );
        assert.equal(
          (await join("card", { token: cards[0].token })).statusCode,
          410,
        );
      });

      await t.test("staff: reset, sign out everywhere, presence", async () => {
        const cls = `classes/${home.period.id}`;
        const code = home.period.joinCode;
        const student = await enroll(home.orgId, home.period.id, "Reset", "Me");
        const here = (
          await staff("GET", home.teacher, `${cls}/presence`)
        ).json();
        assert.equal(here.class.joinCode, code);
        const before = here.students.find(
          (s: { id: string }) => s.id === student.personId,
        );
        assert.deepEqual(before, {
          id: student.personId,
          name: "Reset M.",
          here: false,
        });

        const { token } = (
          await tries(code, student.personId, MINE, true)
        ).json();
        const lit = (
          await staff("GET", home.teacher, `${cls}/presence`)
        ).json();
        assert.equal(
          lit.students.find((s: { id: string }) => s.id === student.personId)
            .here,
          true,
        );

        for (let wrong = 0; wrong < STUDENT_FAILURES; wrong++)
          await tries(code, student.personId, NOT_MINE);
        const locked = (await staff("GET", home.teacher, `${cls}/roster`))
          .json()
          .students.find((s: { id: string }) => s.id === student.personId);
        assert.equal(locked.locked, true);
        assert.equal(locked.picturesSet, true);

        const reset = await staff(
          "POST",
          home.teacher,
          `${cls}/students/${student.personId}/reset-pictures`,
        );
        assert.deepEqual(reset.json(), { reset: true });
        assert.equal(
          (await tries(code, student.personId, MINE)).statusCode,
          409,
          "the student chooses again",
        );
        assert.equal(
          (await tries(code, student.personId, NOT_MINE, true)).statusCode,
          200,
        );
        assert.equal(
          (await practiceWith(token)).statusCode,
          200,
          "a reset leaves devices signed in",
        );

        const revoked = await staff(
          "POST",
          home.teacher,
          `${cls}/students/${student.personId}/revoke-sessions`,
        );
        assert.equal(revoked.json().revoked, 2);
        assert.equal((await practiceWith(token)).statusCode, 401);
        const gone = (
          await staff("GET", home.teacher, `${cls}/presence`)
        ).json();
        assert.equal(
          gone.students.find((s: { id: string }) => s.id === student.personId)
            .here,
          false,
        );

        const events = (
          await db.query(
            "SELECT action,detail,actor_person_id FROM amp_school_events WHERE target_id=$1 ORDER BY at",
            [student.personId],
          )
        ).rows;
        assert.deepEqual(
          events.map((event) => event.action),
          [
            "student.added",
            "student.pictures-set",
            "student.pictures-reset",
            "student.pictures-set",
            "student.sessions-revoked",
          ],
        );
        assert.equal(JSON.stringify(events).includes("Reset"), false);
        assert.ok(events.at(-1)!.actor_person_id);
      });

      await t.test(
        "staff: cross-tenant and out-of-class are 404s",
        async () => {
          const student = await enroll(home.orgId, home.period.id, "Mine");
          const stranger = await enroll(away.orgId, away.period.id, "Theirs");
          const here = `classes/${home.period.id}`;
          const routes: ["GET" | "POST", string][] = [
            ["GET", `${here}/presence`],
            ["GET", `${here}/roster`],
            ["POST", `${here}/rotate-code`],
            ["POST", `${here}/cards`],
            ["POST", `${here}/students/${student.personId}/reset-pictures`],
            ["POST", `${here}/students/${student.personId}/revoke-sessions`],
          ];
          for (const [method, path] of routes) {
            const response = await staff(method, away.teacher, path);
            assert.equal(response.statusCode, 404, path);
            assert.deepEqual(response.json(), { error: "not_found" });
          }
          // Their own class in the URL, another school's student in the path.
          for (const action of ["reset-pictures", "revoke-sessions"]) {
            const response = await staff(
              "POST",
              home.teacher,
              `${here}/students/${stranger.personId}/${action}`,
            );
            assert.equal(response.statusCode, 404, action);
            assert.equal(
              (
                await staff(
                  "POST",
                  home.teacher,
                  `${here}/students/not-a-person/${action}`,
                )
              ).statusCode,
              404,
            );
          }
          const issued = await staff("POST", home.teacher, `${here}/cards`, {
            personIds: [stranger.personId],
          });
          assert.equal(issued.statusCode, 404);
          const cards = await db.query(
            "SELECT 1 FROM amp_person_credentials WHERE person_id=$1 AND kind='card'",
            [stranger.personId],
          );
          assert.equal(cards.rowCount, 0);
        },
      );

      await t.test(
        "staff: an aide reads sign-in but can't change it",
        async () => {
          const aide = `amp|aide-${randomUUID()}`;
          await schools.addStaff({
            orgId: home.orgId,
            role: "aide",
            givenName: "Fixture",
            accountId: aide,
            classId: home.period.id,
          });
          const here = `classes/${home.period.id}`;
          assert.equal(
            (await staff("GET", aide, `${here}/presence`)).statusCode,
            200,
          );
          const roster = await staff("GET", aide, `${here}/roster`);
          assert.equal(roster.json().canManage, false);
          assert.equal(
            (await staff("POST", aide, `${here}/rotate-code`)).statusCode,
            404,
          );
          assert.equal(
            (await staff("POST", aide, `${here}/cards`)).statusCode,
            404,
          );
        },
      );

      await t.test(
        "device mode: the class's setting decides the session",
        async () => {
          const personal = await school("Personal School");
          await db.query(
            `INSERT INTO amp_scope_settings(scope_kind,scope_id,"values") VALUES('class',$1,$2)`,
            [personal.period.id, JSON.stringify({ deviceMode: "personal" })],
          );
          const student = await enroll(
            personal.orgId,
            personal.period.id,
            "Own",
            "Device",
          );
          const grant = (
            await tries(personal.period.joinCode, student.personId, MINE, true)
          ).json();
          assert.equal(grant.mode, "personal");
          const days =
            (new Date(grant.expiresAt).getTime() - Date.now()) / 86_400_000;
          assert.ok(days > 89 && days <= 90, `${days} days`);

          const { cards } = (
            await staff(
              "POST",
              personal.teacher,
              `classes/${personal.period.id}/cards`,
            )
          ).json();
          const card = (await join("card", { token: cards[0].token })).json();
          assert.equal(card.mode, "personal");

          const second = await schools.createClass(personal.orgId, {
            name: "Period 2",
          });
          await db.query(
            "INSERT INTO amp_enrollments(id,class_id,person_id,role,begin_on) VALUES($1,$2,$3,'student',now()-interval '2 days')",
            [randomUUID(), second.id, student.personId],
          );
          const stricter = (
            await join("card", { token: cards[0].token })
          ).json();
          assert.equal(
            stricter.mode,
            "shared",
            "either class can ask for shared",
          );
        },
      );

      await t.test(
        "rate limit: per route, generous, and not by credential",
        async () => {
          const hammer = (headers: Record<string, string> = {}) =>
            app.inject({
              method: "POST",
              url: "/api/v1/school/join/card",
              remoteAddress: "203.0.113.77",
              headers,
              payload: { token: "nope" },
            });
          for (let hit = 0; hit < JOIN_RATE_LIMIT; hit++)
            assert.notEqual((await hammer()).statusCode, 429, `hit ${hit}`);
          const stopped = await hammer({ authorization: "Bearer made-up" });
          assert.equal(stopped.statusCode, 429);
          assert.equal(stopped.json().error, "too_many_requests");
        },
      );
    } finally {
      await app.close();
      await learning.pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
