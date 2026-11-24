import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { schoolAdmin } from "../scripts/school-admin.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { purgeClassEvents } from "../src/privacy/retention.js";
import {
  liveSnapshotResponse,
  studentSignalsResponse,
  resolveSignalResponse,
  forgotPictureResponse,
} from "../src/schools/live/contracts.js";
import { studentLiveResponse } from "../src/schools/live/stream-contracts.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

test(
  "student signals: hands, picture recovery, authorization and lifecycle",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_signals_${randomUUID().replaceAll("-", "")}`;
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
    t.after(async () => {
      await app.close();
      await learning.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });

    const as = (token: string) => ({ authorization: `Bearer ${token}` });
    const get = (path: string, token: string) =>
      app.inject({ method: "GET", url: path, headers: as(token) });
    const post = (path: string, token: string, payload: object = {}) =>
      app.inject({ method: "POST", url: path, headers: as(token), payload });
    const ok = async (
      response: Promise<{ statusCode: number; body: string; json(): any }>,
      status = 200,
    ) => {
      const done = await response;
      assert.equal(done.statusCode, status, done.body);
      return status === 204 ? null : done.json();
    };
    const rows = async (sql: string, ...params: unknown[]) =>
      (await db.query(sql, params)).rows;
    const count = async (sql: string, ...params: unknown[]) =>
      Number((await rows(sql, ...params))[0].n);
    const user = async (name: string) => {
      const id = randomUUID();
      await db.query(
        `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
         VALUES($1,$2,$3,true,now(),now())`,
        [id, name, `${id}@live.example`],
      );
      return `amp|${id}`;
    };

    const org = (await schoolAdmin(schools, "create-org", {
      kind: "school",
      name: "Juniper Fixture School",
      timezone: "America/New_York",
      agreement: {
        version: "fixture-1",
        signerName: "Fixture Signer",
        signerTitle: "Head of School",
      },
    })) as { id: string };
    await schoolAdmin(schools, "issue-license", {
      orgId: org.id,
      seats: 10,
      endsAt: new Date(Date.now() + 200 * 86_400_000).toISOString(),
    });
    const classA = (await schools.createClass(org.id, { name: "Period 2" }))
      .id as string;
    const classB = (await schools.createClass(org.id, { name: "Period 3" }))
      .id as string;
    const student = (givenName: string) =>
      schools.provisionStudent(org.id, {
        givenName,
        gradeLevel: 2,
        classId: classA,
      });
    const ana = await student("Ana");
    const ben = await student("Ben");
    const cal = await student("Cal");
    // Ana is in both periods.
    await schools.transaction(async (client) =>
      schools.enroll(
        client,
        classB,
        ana.personId,
        "student",
        (
          await client.query(
            "SELECT to_char(now() AT TIME ZONE 'America/New_York','YYYY-MM-DD') AS d",
          )
        ).rows[0].d,
      ),
    );
    const teacher = await user("Wren Fixture");
    await schools.addStaff({
      orgId: org.id,
      role: "teacher",
      givenName: "Wren",
      accountId: teacher,
      classId: classA,
    });
    await schools.addStaff({
      orgId: org.id,
      role: "teacher",
      givenName: "Wren",
      accountId: teacher,
      classId: classB,
    });
    const aide = await user("Ash Fixture");
    await schools.addStaff({
      orgId: org.id,
      role: "aide",
      givenName: "Ash",
      accountId: aide,
      classId: classA,
    });
    const otherTeacher = await user("Oak Fixture");
    await schools.addStaff({
      orgId: org.id,
      role: "teacher",
      givenName: "Oak",
      accountId: otherTeacher,
      classId: classB,
    });
    const stranger = await user("Elm Fixture");

    const classPath = (id: string) => `/api/v1/school/classes/${id}`;
    const studentPath = "/api/v1/school/student/signals";
    const forgotPath = "/api/v1/school/join/forgot-picture";
    const live = async (id: string) =>
      liveSnapshotResponse.parse(
        await ok(get(`${classPath(id)}/live`, teacher)),
      );
    const raise = async (token: string) =>
      studentSignalsResponse.parse(
        await ok(post(studentPath, token, { kind: "hand" })),
      );
    const withdraw = async (token: string) =>
      studentSignalsResponse.parse(
        await ok(post(`${studentPath}/withdraw`, token, { kind: "hand" })),
      );
    const mine = async (token: string) =>
      studentSignalsResponse.parse(await ok(get(studentPath, token)));
    const resolve = (classId: string, signalId: string, token = teacher) =>
      post(`${classPath(classId)}/signals/${signalId}/resolve`, token);
    const join = (body: object) =>
      app.inject({ method: "POST", url: forgotPath, payload: body });
    const state = (body: { code: string; personId: string }) =>
      app.inject({
        method: "GET",
        url: `${forgotPath}?${new URLSearchParams(body)}`,
      });
    const code = async (id: string) =>
      (await rows("SELECT join_code FROM amp_classes WHERE id=$1", id))[0]
        .join_code as string;
    const reset = (classId: string, personId: string, token = teacher) =>
      post(`${classPath(classId)}/students/${personId}/reset-pictures`, token);
    const stored = async (id: string) =>
      (await rows("SELECT * FROM amp_class_signals WHERE id=$1", id))[0];
    const open = async (personId: string, kind = "forgot_picture") =>
      rows(
        "SELECT * FROM amp_class_signals WHERE person_id=$1 AND kind=$2 AND resolved_at IS NULL ORDER BY class_id",
        personId,
        kind,
      );
    const token = async (personId: string) =>
      (await schools.issueStudentSession({ personId, mode: "personal" })).token;
    const benToken = await token(ben.personId);
    const anaToken = await token(ana.personId);
    const signalEvents = () =>
      rows(
        "SELECT class_id,person_id,session_id FROM amp_class_events WHERE kind='signal' ORDER BY id",
      );
    // Check the actual outbox after each mutation, including the session it names.
    const writes = async <T>(
      run: () => Promise<T>,
      expected: {
        class_id: string;
        person_id: string;
        session_id: string | null;
      }[],
    ) => {
      const before = (await signalEvents()).length;
      const answer = await run();
      const order = (items: typeof expected) =>
        [...items].sort((a, b) =>
          JSON.stringify(a).localeCompare(JSON.stringify(b)),
        );
      assert.deepEqual(
        order((await signalEvents()).slice(before)),
        order(expected),
      );
      return answer;
    };
    const event = (
      classId: string,
      personId: string,
      sessionId: string | null = null,
    ) => ({ class_id: classId, person_id: personId, session_id: sessionId });

    await t.test(
      "idempotent hand, own reads, snapshot, withdrawal and session targeting",
      async () => {
        const session = (
          await ok(post(`${classPath(classA)}/sessions`, teacher), 201)
        ).session.id;
        const first = await writes(
          () => raise(benToken),
          [event(classA, ben.personId, session)],
        );
        assert.equal(first.signals.length, 1);
        const [again, concurrent] = await writes(
          () => Promise.all([raise(benToken), raise(benToken)]),
          [
            event(classA, ben.personId, session),
            event(classA, ben.personId, session),
          ],
        );
        assert.deepEqual(again, first);
        assert.deepEqual(concurrent, first);
        assert.equal((await live(classA)).signals[0]?.id, first.signals[0]!.id);
        assert.equal((await open(ben.personId, "hand")).length, 1);
        assert.deepEqual(await mine(anaToken), { signals: [] });
        assert.deepEqual(await mine(benToken), first);

        const onlyRunning = await writes(
          () => raise(anaToken),
          [event(classA, ana.personId, session)],
        );
        assert.deepEqual(
          onlyRunning.signals.map((s) => s.classId),
          [classA],
        );
        await ok(
          post(`${classPath(classA)}/sessions/${session}/stop`, teacher),
        );
        assert.equal(
          (await live(classA)).signals.length,
          2,
          "stopping keeps hands open",
        );
        const gone = await writes(
          () => withdraw(benToken),
          [event(classA, ben.personId)],
        );
        assert.equal(gone.signals[0]?.resolution, "withdrawn");
        assert.equal(
          (await live(classA)).signals.some((s) => s.personId === ben.personId),
          false,
        );
        assert.deepEqual((await mine(benToken)).signals, gone.signals);
        await writes(() => withdraw(anaToken), [event(classA, ana.personId)]);
        const both = await writes(
          () => raise(anaToken),
          [event(classA, ana.personId), event(classB, ana.personId)],
        );
        assert.deepEqual(
          both.signals.map((s) => s.classId).sort(),
          [classA, classB].sort(),
        );
        await writes(
          () => withdraw(anaToken),
          [event(classA, ana.personId), event(classB, ana.personId)],
        );
        await writes(() => withdraw(anaToken), []);
        await db.query(
          "UPDATE amp_class_signals SET resolved_at=now()-interval '61 seconds' WHERE person_id=$1",
          [ben.personId],
        );
        assert.deepEqual(await mine(benToken), { signals: [] });
      },
    );

    await t.test(
      "teachers and aides acknowledge, unrelated adults and students cannot",
      async () => {
        for (const adult of [teacher, aide]) {
          const hand = (
            await writes(() => raise(benToken), [event(classA, ben.personId)])
          ).signals[0]!;
          for (const outsider of [otherTeacher, stranger]) {
            const refused = await resolve(classA, hand.id, outsider);
            assert.equal(refused.statusCode, 404);
            assert.deepEqual(refused.json(), { error: "not_found" });
          }
          const studentRefused = await resolve(classA, hand.id, benToken);
          assert.equal(studentRefused.statusCode, 401);
          for (const id of [hand.id, randomUUID(), "bad-id"]) {
            const elsewhere = await resolve(classB, id);
            assert.equal(elsewhere.statusCode, 404);
            assert.deepEqual(elsewhere.json(), { error: "not_found" });
          }
          const resolved = resolveSignalResponse.parse(
            await writes(
              () => ok(resolve(classA, hand.id, adult)),
              [event(classA, ben.personId)],
            ),
          );
          assert.equal(resolved.signal.resolution, "acknowledged");
          assert.ok(resolved.signal.resolvedAt);
          assert.deepEqual(
            await writes(() => ok(resolve(classA, hand.id, adult)), []),
            resolved,
          );
          assert.equal(
            (await mine(benToken)).signals.find((s) => s.id === hand.id)
              ?.resolution,
            "acknowledged",
          );
          const actor = (
            await rows(
              "SELECT id FROM amp_people WHERE account_id=$1 AND tenant_id=$2",
              adult,
              org.id,
            )
          )[0];
          assert.equal((await stored(hand.id)).resolved_by, actor.id);
        }
        const noManage = await post(`${classPath(classA)}/sessions`, aide);
        assert.equal(
          noManage.statusCode,
          404,
          "acknowledging does not grant session.manage",
        );
        for (const path of [studentPath, `${studentPath}/withdraw`]) {
          for (const credential of [teacher, "invalid"])
            assert.equal(
              (await post(path, credential, { kind: "hand" })).statusCode,
              401,
            );
          assert.equal(
            (await post(path, benToken, { kind: "forgot_picture" })).statusCode,
            400,
          );
          assert.equal(
            (
              await post(path, benToken, {
                kind: "hand",
                personId: ana.personId,
              })
            ).statusCode,
            400,
          );
        }
        assert.equal((await get(studentPath, teacher)).statusCode, 401);
      },
    );

    await t.test(
      "forgotten pictures reuse the sign-in refusal and expose only state",
      async () => {
        const teacherPerson = (
          await rows(
            "SELECT id FROM amp_people WHERE account_id=$1 AND tenant_id=$2",
            teacher,
            org.id,
          )
        )[0].id;
        for (const input of [
          { code: "WRONG-CODE", personId: ben.personId },
          { code: await code(classA), personId: teacherPerson },
          { code: await code(classB), personId: ben.personId },
        ]) {
          const picture = await app.inject({
            method: "POST",
            url: "/api/v1/school/join/picture",
            payload: { ...input, pictures: ["fox", "boat", "kite"] },
          });
          for (const refused of [await join(input), await state(input)]) {
            assert.equal(refused.statusCode, picture.statusCode);
            assert.deepEqual(refused.json(), picture.json());
          }
        }
        const input = { code: await code(classA), personId: ben.personId };
        assert.deepEqual(await ok(state(input)), { state: "none" });
        assert.deepEqual(
          await writes(() => ok(join(input)), [event(classA, ben.personId)]),
          { state: "waiting" },
        );
        const repeats = await writes(
          () => Promise.all([ok(join(input)), ok(join(input))]),
          [event(classA, ben.personId), event(classA, ben.personId)],
        );
        assert.deepEqual(repeats, [{ state: "waiting" }, { state: "waiting" }]);
        assert.equal((await open(ben.personId)).length, 1);
        assert.deepEqual(forgotPictureResponse.parse(await ok(state(input))), {
          state: "waiting",
        });
        const forgotten = (await open(ben.personId))[0];
        assert.equal(
          (await live(classA)).signals.some((s) => s.id === forgotten.id),
          true,
        );
        const wrongResolve = await resolve(classA, forgotten.id);
        assert.equal(wrongResolve.statusCode, 409);
        assert.deepEqual(wrongResolve.json(), {
          error: "picture_reset_required",
        });
        assert.equal((await stored(forgotten.id)).resolved_at, null);
      },
    );

    await t.test(
      "a student's own withdrawal clears a forgotten-picture request",
      async () => {
        const input = { code: await code(classA), personId: ben.personId };
        const withdrawPath = `${forgotPath}/withdraw`;
        const take = (body: object) =>
          app.inject({ method: "POST", url: withdrawPath, payload: body });
        // Refused exactly like the neighbours.
        for (const bad of [
          { code: "WRONG-CODE", personId: ben.personId },
          { code: await code(classB), personId: ben.personId },
        ]) {
          const refused = await take(bad);
          const neighbour = await join(bad);
          assert.equal(refused.statusCode, neighbour.statusCode);
          assert.deepEqual(refused.json(), neighbour.json());
        }
        await ok(join(input));
        const forgotten = (await open(ben.personId))[0];
        assert.equal(
          (await live(classA)).signals.some((s) => s.id === forgotten.id),
          true,
        );
        assert.deepEqual(
          await writes(() => ok(take(input)), [event(classA, ben.personId)]),
          { state: "none" },
        );
        assert.equal((await stored(forgotten.id)).resolution, "withdrawn");
        assert.equal(
          (await live(classA)).signals.some((s) => s.id === forgotten.id),
          false,
        );
        assert.deepEqual(await ok(state(input)), { state: "none" });
        // Again: nothing to take back, nothing written.
        assert.deepEqual(await writes(() => ok(take(input)), []), {
          state: "none",
        });
        // A later ask works again.
        await writes(() => ok(join(input)), [event(classA, ben.personId)]);
        assert.deepEqual(await ok(state(input)), { state: "waiting" });
        assert.equal((await open(ben.personId)).length, 1);
        await ok(take(input));
      },
    );

    // Failure at the outbox write must roll back both the reset and resolution.
    await db.query(
      "CREATE TABLE signal_test_failures(person_id uuid PRIMARY KEY)",
    );
    await db.query(`CREATE FUNCTION fail_signal_event() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.kind='signal' AND EXISTS(SELECT 1 FROM signal_test_failures WHERE person_id=NEW.person_id) THEN
          RAISE EXCEPTION 'fixture signal event failure';
        END IF;
        RETURN NEW;
      END $$`);
    await db.query(
      "CREATE TRIGGER signal_test_failure BEFORE INSERT ON amp_class_events FOR EACH ROW EXECUTE FUNCTION fail_signal_event()",
    );
    const pictures = ["fox", "boat", "kite"];
    const picture = (input: { code: string; personId: string }, set = true) =>
      app.inject({
        method: "POST",
        url: "/api/v1/school/join/picture",
        payload: { ...input, pictures, set },
      });
    const checkReset = async (
      classId: string,
      personId: string,
      adult: string,
    ) => {
      const input = { code: await code(classId), personId };
      // Set a working credential; sign-in withdraws any pending request.
      const pending = await open(personId);
      await writes(
        () => ok(picture(input)),
        pending.map((s) => event(s.class_id, personId)),
      );
      await writes(() => ok(join(input)), [event(classId, personId)]);
      const request = (await open(personId))[0];
      const before = await rows(
        "SELECT id,revoked_at FROM amp_person_credentials WHERE person_id=$1 AND kind='picture'",
        personId,
      );
      await db.query("INSERT INTO signal_test_failures VALUES($1)", [personId]);
      try {
        await writes(() => ok(reset(classId, personId, adult), 503), []);
        assert.equal((await stored(request.id)).resolved_at, null);
        assert.deepEqual(
          await rows(
            "SELECT id,revoked_at FROM amp_person_credentials WHERE person_id=$1 AND kind='picture'",
            personId,
          ),
          before,
        );
        assert.deepEqual(await ok(state(input)), { state: "waiting" });
      } finally {
        await db.query("DELETE FROM signal_test_failures WHERE person_id=$1", [
          personId,
        ]);
      }
      assert.deepEqual(
        await writes(
          () => ok(reset(classId, personId, adult)),
          [event(classId, personId)],
        ),
        { reset: true },
      );
      assert.equal((await stored(request.id)).resolution, "reset");
      assert.deepEqual(await ok(state(input)), { state: "reset" });
      assert.deepEqual(
        await writes(() => ok(reset(classId, personId, adult)), []),
        { reset: false },
      );
      assert.deepEqual(await ok(state(input)), { state: "reset" });
    };

    await t.test(
      "school reset and sign-in resolve atomically; failed reset leaves request open",
      async () => {
        await checkReset(classA, ben.personId, teacher);
        const input = { code: await code(classA), personId: ben.personId };
        await writes(() => ok(join(input)), [event(classA, ben.personId)]);
        const forgotten = (await open(ben.personId))[0];
        await writes(() => ok(picture(input)), [event(classA, ben.personId)]);
        assert.equal((await stored(forgotten.id)).resolution, "withdrawn");
        assert.deepEqual(await ok(state(input)), { state: "none" });
        // A card sign-in also uses the session-issue hook, not only pictures.
        const cards = await ok(
          post(`${classPath(classA)}/cards`, teacher, {
            personIds: [ben.personId],
          }),
        );
        await writes(() => ok(join(input)), [event(classA, ben.personId)]);
        const cardRequest = (await open(ben.personId))[0];
        await writes(
          () =>
            ok(
              app.inject({
                method: "POST",
                url: "/api/v1/school/join/card",
                payload: { token: cards.cards[0].token },
              }),
            ),
          [event(classA, ben.personId)],
        );
        assert.equal((await stored(cardRequest.id)).resolution, "withdrawn");
      },
    );

    await t.test(
      "sign-in and reset clear the person's requests across classes",
      async () => {
        const a = { code: await code(classA), personId: ana.personId };
        const b = { code: await code(classB), personId: ana.personId };
        await writes(() => ok(picture(a)), []);
        for (const input of [a, b])
          await writes(
            () => ok(join(input)),
            [event(input === a ? classA : classB, ana.personId)],
          );
        const pending = await open(ana.personId);
        assert.equal(pending.length, 2);
        await writes(
          () =>
            ok(
              app.inject({
                method: "POST",
                url: "/api/v1/school/join/picture",
                payload: { ...a, pictures: ["owl", "frog", "sun"] },
              }),
              422,
            ),
          [],
        );
        assert.equal(
          (await open(ana.personId)).length,
          2,
          "failed sign-in leaves requests open",
        );
        await writes(
          () => ok(picture(a, false)),
          [event(classA, ana.personId), event(classB, ana.personId)],
        );
        for (const request of pending)
          assert.equal((await stored(request.id)).resolution, "withdrawn");
        for (const input of [a, b])
          await writes(
            () => ok(join(input)),
            [event(input === a ? classA : classB, ana.personId)],
          );
        await writes(
          () => ok(reset(classA, ana.personId)),
          [event(classA, ana.personId), event(classB, ana.personId)],
        );
        assert.deepEqual(await ok(state(a)), { state: "reset" });
        assert.deepEqual(await ok(state(b)), { state: "reset" });
      },
    );

    await t.test(
      "family Devices reset uses the family class route, including rollback",
      async () => {
        const parent = await user("Marisol Fixture");
        await db.query(
          "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'policy','verified','fixture-proof')",
          [parent],
        );
        const child = await ok(
          post("/api/v1/learners", parent, { name: "Maya", birthYear: 2016 }),
          201,
        );
        const family = (
          await rows(
            "SELECT org_id,class_id FROM amp_families WHERE account_id=$1",
            parent,
          )
        )[0];
        const personId = (
          await rows("SELECT id FROM amp_people WHERE learner_id=$1", child.id)
        )[0].id as string;
        await checkReset(family.class_id, personId, parent);
        const hand = (
          await writes(
            () => token(personId).then(raise),
            [event(family.class_id, personId)],
          )
        ).signals[0]!;
        assert.equal(
          (
            await writes(
              () => ok(resolve(family.class_id, hand.id, parent)),
              [event(family.class_id, personId)],
            )
          ).signal.resolution,
          "acknowledged",
        );
        // The child's screen learns whose class it is: a family's own, so
        // the adult who saw the hand is a parent ("Your parent saw it.").
        const childLive = studentLiveResponse.parse(
          await ok(get("/api/v1/school/student/live", await token(personId))),
        );
        assert.deepEqual(childLive.familyClasses, [family.class_id]);
        assert.equal(childLive.signals[0]?.classId, family.class_id);
        // A school's student: none of their classes is a family's.
        const benLive = studentLiveResponse.parse(
          await ok(get("/api/v1/school/student/live", benToken)),
        );
        assert.deepEqual(benLive.familyClasses, []);
      },
    );

    await t.test(
      "stale requests expire before re-raise and in retention; writes use the running session",
      async () => {
        const session = (
          await ok(post(`${classPath(classA)}/sessions`, teacher), 201)
        ).session.id;
        const hand = (
          await writes(
            () => raise(benToken),
            [event(classA, ben.personId, session)],
          )
        ).signals[0]!;
        await db.query(
          "UPDATE amp_class_signals SET created_at=now()-interval '31 minutes' WHERE id=$1",
          [hand.id],
        );
        assert.equal(
          (await mine(benToken)).signals.some((s) => s.id === hand.id),
          false,
        );
        const fresh = await writes(
          () => raise(benToken),
          [
            event(classA, ben.personId, session),
            event(classA, ben.personId, session),
          ],
        );
        assert.notEqual(fresh.signals[0]?.id, hand.id);
        assert.equal((await stored(hand.id)).resolution, "expired");
        await writes(
          () => withdraw(benToken),
          [event(classA, ben.personId, session)],
        );

        const input = { code: await code(classA), personId: ben.personId };
        await writes(
          () => ok(join(input)),
          [event(classA, ben.personId, session)],
        );
        const forgotten = (await open(ben.personId))[0];
        await db.query(
          "UPDATE amp_class_signals SET created_at=now()-interval '31 minutes' WHERE id=$1",
          [forgotten.id],
        );
        assert.deepEqual(await ok(state(input)), { state: "none" });
        await writes(
          () => ok(join(input)),
          [
            event(classA, ben.personId, session),
            event(classA, ben.personId, session),
          ],
        );
        assert.equal((await stored(forgotten.id)).resolution, "expired");
        await writes(
          () => ok(reset(classA, ben.personId)),
          [event(classA, ben.personId, session)],
        );
        assert.deepEqual(await ok(state(input)), { state: "reset" });

        const stale = (
          await writes(
            () => raise(benToken),
            [event(classA, ben.personId, session)],
          )
        ).signals[0]!;
        await db.query(
          "UPDATE amp_class_signals SET created_at=now()-interval '31 minutes' WHERE id=$1",
          [stale.id],
        );
        await writes(
          () => purgeClassEvents(db),
          [event(classA, ben.personId, session)],
        );
        assert.equal((await stored(stale.id)).resolution, "expired");
        await writes(() => purgeClassEvents(db), []);
        await writes(
          () => raise(benToken),
          [event(classA, ben.personId, session)],
        );
        await writes(
          () => withdraw(benToken),
          [event(classA, ben.personId, session)],
        );
        const acknowledgement = (
          await writes(
            () => raise(benToken),
            [event(classA, ben.personId, session)],
          )
        ).signals[0]!;
        await writes(
          () => ok(resolve(classA, acknowledgement.id, aide)),
          [event(classA, ben.personId, session)],
        );
      },
    );
  },
);
