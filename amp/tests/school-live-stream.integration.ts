import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { Pool } from "pg";
import type { FastifyInstance } from "fastify";
import { migrate } from "../scripts/migrate.js";
import { schoolAdmin } from "../scripts/school-admin.js";
import { practiceResponse } from "../scripts/ui-practice-answer.js";
import { liveSnapshotResponse } from "../src/schools/live/contracts.js";
import {
  DEFAULT_STREAM_TIMING,
  streamLifetimeMs,
} from "../src/schools/live/sse.js";
import {
  byeMessage,
  liveRowsMessage,
  liveSignalsMessage,
  studentLiveResponse,
} from "../src/schools/live/stream-contracts.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";
import { isEventStream } from "../src/server/slow-requests.js";

/* The live stream (src/schools/live/hub.ts, work package L2): two server
   processes on one database, one taking answers and the other streaming
   them; the hub's one connection; refusal on connect and after revocation;
   the cap; the stream's own end; shutdown; a student's own stream. Every
   name here is made up. */

type Frame = { event: string; data: any; at: number };
/** An SSE reader over a real socket: every frame with when it arrived. */
function stream(base: string, path: string, token?: string) {
  const frames: Frame[] = [];
  const comments: { text: string; at: number }[] = [];
  const waiters: {
    test: (frame: Frame) => boolean;
    done: (f: Frame) => void;
  }[] = [];
  const abort = new AbortController();
  let status = 0;
  let contentType = "";
  const ended = (async () => {
    const response = await fetch(`${base}${path}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      signal: abort.signal,
    });
    status = response.status;
    contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !response.body) {
      await response.text();
      return;
    }
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      const reader = response.body.getReader();
      for (;;) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk as Uint8Array, { stream: true });
        let cut: number;
        while ((cut = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 2);
          if (block.startsWith(":")) {
            comments.push({ text: block.slice(1).trim(), at: Date.now() });
            continue;
          }
          const event = /^event: (.*)$/m.exec(block)?.[1] ?? "message";
          const data = JSON.parse(/^data: (.*)$/m.exec(block)?.[1] ?? "null");
          const frame = { event, data, at: Date.now() };
          frames.push(frame);
          for (const waiter of [...waiters])
            if (waiter.test(frame)) {
              waiters.splice(waiters.indexOf(waiter), 1);
              waiter.done(frame);
            }
        }
      }
    } catch (error) {
      if (!abort.signal.aborted) throw error;
    }
  })();
  return {
    frames,
    comments,
    ended,
    get status() {
      return status;
    },
    get contentType() {
      return contentType;
    },
    /** The first frame from now on (or already seen, with `seen`) that
     * passes `test`. */
    next(test: (frame: Frame) => boolean, timeoutMs = 5_000, seen = false) {
      const found = seen ? frames.find(test) : undefined;
      if (found) return Promise.resolve(found);
      return new Promise<Frame>((resolve, reject) => {
        const timer = setTimeout(
          () =>
            reject(
              new Error(
                `${path}: no matching frame in ${timeoutMs} ms; saw ${JSON.stringify(frames.slice(-4))}`,
              ),
            ),
          timeoutMs,
        );
        waiters.push({
          test,
          done: (frame) => {
            clearTimeout(timer);
            resolve(frame);
          },
        });
      });
    },
    close: () => abort.abort(),
  };
}

test("a stream lives 85 to 95 seconds, jittered", () => {
  assert.equal(
    streamLifetimeMs(() => 0),
    85_000,
  );
  assert.equal(
    streamLifetimeMs(() => 0.999_999_9),
    95_000,
  );
  for (let i = 0; i < 1000; i++) {
    const ms = DEFAULT_STREAM_TIMING.lifetimeMs();
    assert.ok(ms >= 85_000 && ms <= 95_000, String(ms));
  }
  assert.equal(DEFAULT_STREAM_TIMING.pingMs, 15_000);
  // The slow-request log leaves an event stream alone.
  assert.equal(isEventStream("text/event-stream; charset=utf-8"), true);
  assert.equal(isEventStream("application/json"), false);
  assert.equal(isEventStream(undefined), false);
});

test(
  "the live stream: two processes, one connection, refusal, cap, end, shutdown, a student's own",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_stream_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const authenticate = refuseStudentTokens(async (request) => {
      const header = request.headers.authorization;
      if (header?.startsWith("Bearer amp|")) return header.slice(7);
      throw new ApiError(401, "Sign in to continue");
    });
    const closers: (() => Promise<unknown>)[] = [];
    t.after(async () => {
      for (const close of closers.reverse()) await close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    /** One server process: its own pools, its own hub, a real socket. A
     * pod's school pool has three connections. */
    const instance = async (
      live?: Parameters<typeof registerSchoolRoutes>[1]["live"],
    ) => {
      const learning = new PostgresRepository(scoped.href);
      const pool = new Pool({ connectionString: scoped.href, max: 3 });
      const app = buildApp({
        repository: learning,
        authenticate,
        logger: !!process.env.DEBUG_LIVE,
      });
      const { live: hub } = await registerSchoolRoutes(app, {
        pool,
        authenticate,
        ...(live ? { live } : {}),
      });
      await app.listen({ host: "127.0.0.1", port: 0 });
      const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
      let closed = false;
      const close = async () => {
        if (closed) return;
        closed = true;
        await app.close();
        await pool.end();
        await learning.close();
      };
      closers.push(close);
      return { app, pool, hub, base, learning, close };
    };
    // A answers; B streams. B's streams rotate every 4 s here so the
    // reconnect after a revocation is seen without waiting 90 s.
    const a = await instance();
    const b = await instance({
      stream: { lifetimeMs: () => 4_000, pingMs: 500 },
    });
    const db = a.pool;
    const schools = new SchoolRepository(db);
    const rows = async (sql: string, ...params: unknown[]) =>
      (await db.query(sql, params)).rows;
    const user = async (name: string) => {
      const id = randomUUID();
      await db.query(
        `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
         VALUES($1,$2,$3,true,now(),now())`,
        [id, name, `${id}@stream.example`],
      );
      return `amp|${id}`;
    };
    const as = (token: string) => ({ authorization: `Bearer ${token}` });
    const ok = async (
      app: FastifyInstance,
      method: "GET" | "POST",
      path: string,
      token: string,
      payload?: object,
      status = 200,
    ) => {
      const response = await app.inject({
        method,
        url: path,
        headers: as(token),
        ...(payload ? { payload } : {}),
      });
      assert.equal(response.statusCode, status, `${path}: ${response.body}`);
      return response.statusCode === 204 ? null : response.json();
    };

    const org = (await schoolAdmin(schools, "create-org", {
      kind: "school",
      name: "Linden Fixture School",
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
    const classId = (await schools.createClass(org.id, { name: "Period 4" }))
      .id as string;
    const student = (givenName: string) =>
      schools.provisionStudent(org.id, { givenName, gradeLevel: 2, classId });
    const ivy = await student("Ivy");
    const jon = await student("Jon");
    const teacher = await user("Rue Fixture");
    await schools.addStaff({
      orgId: org.id,
      role: "teacher",
      givenName: "Rue",
      accountId: teacher,
      classId,
    });
    const aide = await user("Bay Fixture");
    await schools.addStaff({
      orgId: org.id,
      role: "aide",
      givenName: "Bay",
      accountId: aide,
      classId,
    });
    const stranger = await user("Fen Fixture");
    const ivyToken = (
      await schools.issueStudentSession({
        personId: ivy.personId,
        mode: "shared",
      })
    ).token;
    const jonToken = (
      await schools.issueStudentSession({
        personId: jon.personId,
        mode: "shared",
      })
    ).token;
    const staffPath = `/api/v1/school/classes/${classId}/live/stream`;
    const studentPath = "/api/v1/school/student/live/stream";

    /** One answer by Ivy, through instance A. */
    const answer = async (right: boolean) => {
      const learnerPath = `/api/v1/learners/${ivy.learnerId}`;
      const served = await ok(
        a.app,
        "POST",
        `${learnerPath}/batches`,
        ivyToken,
        {
          templateId: "add-within-20",
          count: 1,
          figureCapabilities: ["scenes-v1"],
        },
      );
      const problem = served.problems[0] as { id: string };
      const stored = (
        await rows("SELECT content FROM amp_instances WHERE id=$1", problem.id)
      )[0].content;
      const sent = Date.now();
      await ok(a.app, "POST", `${learnerPath}/attempts`, ivyToken, {
        problemId: problem.id,
        requestId: randomUUID(),
        response: practiceResponse(stored, right),
      });
      return sent;
    };

    const session = (
      await ok(
        a.app,
        "POST",
        `/api/v1/school/classes/${classId}/sessions`,
        teacher,
        {},
        201,
      )
    ).session as { id: string };

    await t.test(
      "an answer on one process reaches a stream on the other in under 2 s",
      async (t) => {
        const watch = stream(b.base, staffPath, teacher);
        t.after(() => watch.close());
        const first = await watch.next(
          (f) => f.event === "snapshot",
          5_000,
          true,
        );
        assert.equal(watch.status, 200);
        assert.equal(isEventStream(watch.contentType), true);
        const snapshot = liveSnapshotResponse.parse(first.data);
        assert.equal(snapshot.session?.id, session.id);
        assert.deepEqual(snapshot.can, { manage: true });
        assert.deepEqual(snapshot.rows.map((row) => row.name).sort(), [
          "Ivy",
          "Jon",
        ]);
        for (const [index, right] of [true, false, true].entries()) {
          const sent = await answer(right);
          const frame = await watch.next(
            (f) =>
              f.event === "rows" &&
              f.data.rows.some(
                (row: { personId: string; problems: number }) =>
                  row.personId === ivy.personId && row.problems === index + 1,
              ),
            2_000,
          );
          const message = liveRowsMessage.parse(frame.data);
          assert.equal(message.sessionId, session.id);
          // Only the student who changed, whole.
          assert.deepEqual(
            message.rows.map((row) => row.personId),
            [ivy.personId],
          );
          assert.ok(frame.at - sent < 2_000, `${frame.at - sent} ms`);
        }
        const last = watch.frames.filter((f) => f.event === "rows").at(-1)!;
        assert.equal(last.data.rows[0].problems, 3);
        assert.equal(last.data.rows[0].correct, 2);
        assert.deepEqual(
          last.data.rows[0].recent.map((o: { correct: boolean }) => o.correct),
          [true, false, true],
        );
        // Pings keep bytes moving on a quiet class.
        assert.ok(watch.comments.some((c) => c.text === "ping"));
        watch.close();
        await watch.ended;
      },
    );

    await t.test(
      "the hub holds one connection at most, and none between ticks",
      async (t) => {
        const watchers = [
          stream(b.base, staffPath, teacher),
          stream(b.base, staffPath, aide),
        ];
        t.after(() => watchers.forEach((w) => w.close()));
        for (const w of watchers)
          await w.next((f) => f.event === "snapshot", 5_000, true);
        const before = b.hub.stats();
        // Sample B's pool every 5 ms for 3 s while A takes answers.
        let samples = 0,
          idle = 0,
          most = 0;
        const sampler = setInterval(() => {
          const out = b.pool.totalCount - b.pool.idleCount;
          samples++;
          if (out === 0) idle++;
          most = Math.max(most, out);
        }, 5);
        const until = Date.now() + 3_000;
        while (Date.now() < until) await answer(true);
        clearInterval(sampler);
        const after = b.hub.stats();
        assert.ok(after.ticks - before.ticks >= 2, "the hub ticked");
        assert.ok(after.queries > before.queries, "and read");
        assert.equal(after.maxInUse, 1, "never two connections at once");
        assert.equal(after.inUse, 0);
        assert.equal(most <= 1, true, `the pool lent ${most} at once`);
        assert.equal(b.pool.waitingCount, 0);
        assert.ok(
          idle / samples > 0.8,
          `idle in ${idle} of ${samples} samples`,
        );
        // Between ticks, nothing is held.
        await new Promise((resolve) => setTimeout(resolve, 300));
        assert.equal(b.hub.stats().inUse, 0);
        watchers.forEach((w) => w.close());
        await Promise.all(watchers.map((w) => w.ended));
      },
    );

    await t.test(
      "refused on connect; a revoked reader is refused at the next reconnect",
      async () => {
        const none = stream(b.base, staffPath);
        await none.ended;
        assert.equal(none.status, 401);
        const strangers = stream(b.base, staffPath, stranger);
        await strangers.ended;
        assert.equal(strangers.status, 404);
        // A student's token never opens the staff stream.
        const pupil = stream(b.base, staffPath, ivyToken);
        await pupil.ended;
        assert.equal(pupil.status, 401);
        // And a staff credential never opens a student's.
        const notStudent = stream(b.base, studentPath, teacher);
        await notStudent.ended;
        assert.equal(notStudent.status, 401);

        const watch = stream(b.base, staffPath, aide);
        const first = await watch.next(
          (f) => f.event === "snapshot",
          5_000,
          true,
        );
        assert.deepEqual(first.data.can, { manage: false });
        await db.query(
          "UPDATE amp_people SET deleted_at=now() WHERE account_id=$1",
          [aide],
        );
        // The open stream runs out its life, then says why.
        const bye = await watch.next((f) => f.event === "bye", 6_000, true);
        assert.deepEqual(byeMessage.parse(bye.data), { reason: "rotate" });
        await watch.ended;
        const again = stream(b.base, staffPath, aide);
        await again.ended;
        assert.equal(again.status, 404);
      },
    );

    await t.test("a stream ends by itself at its lifetime", async () => {
      const watch = stream(b.base, staffPath, teacher);
      const opened = Date.now();
      await watch.next((f) => f.event === "snapshot", 5_000, true);
      const bye = await watch.next((f) => f.event === "bye", 6_000, true);
      await watch.ended;
      const lived = bye.at - opened;
      assert.ok(lived >= 3_900 && lived < 5_000, `${lived} ms`);
      assert.deepEqual(bye.data, { reason: "rotate" });
    });

    await t.test("a student's stream carries only their own", async (t) => {
      // Its own process with streams that live their full 85-95 s: this
      // test outlasts process B's four.
      const d = await instance();
      const ivyWatch = stream(d.base, studentPath, ivyToken);
      const jonWatch = stream(d.base, studentPath, jonToken);
      const staff = stream(d.base, staffPath, teacher);
      t.after(() => [ivyWatch, jonWatch, staff].forEach((w) => w.close()));
      const first = studentLiveResponse.parse(
        (await ivyWatch.next((f) => f.event === "snapshot", 5_000, true)).data,
      );
      assert.deepEqual(
        first.sessions.map((s) => s.id),
        [session.id],
      );
      assert.deepEqual(first.signals, []);
      // Nothing about who started it.
      assert.deepEqual(Object.keys(first.sessions[0]!).sort(), [
        "classId",
        "endsAt",
        "id",
        "startedAt",
      ]);
      await jonWatch.next((f) => f.event === "snapshot", 5_000, true);
      await staff.next((f) => f.event === "snapshot", 5_000, true);
      // Ivy raises her hand, through L4's route on the other process.
      const hand = (
        await ok(a.app, "POST", "/api/v1/school/student/signals", ivyToken, {
          kind: "hand",
        })
      ).signals[0].id as string;
      const raised = studentLiveResponse.parse(
        (
          await ivyWatch.next(
            (f) => f.event === "snapshot" && f.data.signals.length === 1,
            2_000,
            true,
          )
        ).data,
      );
      assert.equal(raised.signals[0]!.id, hand);
      assert.equal(raised.signals[0]!.resolution, null);
      const strip = liveSignalsMessage.parse(
        (await staff.next((f) => f.event === "signals", 2_000, true)).data,
      );
      assert.deepEqual(
        strip.signals.map((s) => [s.personId, s.kind]),
        [[ivy.personId, "hand"]],
      );
      // The teacher sees it; Ivy's screen moves on by itself.
      await ok(
        a.app,
        "POST",
        `/api/v1/school/classes/${classId}/signals/${hand}/resolve`,
        teacher,
        {},
      );
      const seen = studentLiveResponse.parse(
        (
          await ivyWatch.next(
            (f) =>
              f.event === "snapshot" &&
              f.data.signals[0]?.resolution === "acknowledged",
            2_000,
            true,
          )
        ).data,
      );
      assert.ok(seen.signals[0]!.resolvedAt);
      // The poll a client falls back to says the same.
      const polled = studentLiveResponse.parse(
        await ok(d.app, "GET", "/api/v1/school/student/live", ivyToken),
      );
      assert.deepEqual(polled.signals, seen.signals);
      assert.deepEqual(polled.sessions, seen.sessions);
      // A school's class is nobody's family: the adult there is a teacher.
      assert.deepEqual(polled.familyClasses, []);
      assert.deepEqual(seen.familyClasses, []);
      // Stop: every stream hears it.
      await ok(
        a.app,
        "POST",
        `/api/v1/school/classes/${classId}/sessions/${session.id}/stop`,
        teacher,
      );
      const ended = await ivyWatch.next(
        (f) => f.event === "snapshot" && f.data.sessions.length === 0,
        2_000,
        true,
      );
      assert.ok(ended);
      const closed = await staff.next(
        (f) => f.event === "snapshot" && f.data.session === null,
        2_000,
        true,
      );
      assert.deepEqual(closed.data.rows, []);
      // Jon never heard of Ivy's hand.
      for (const frame of jonWatch.frames)
        if (frame.event === "snapshot")
          assert.deepEqual(frame.data.signals, []);
      assert.equal(
        JSON.stringify(jonWatch.frames).includes(ivy.personId),
        false,
      );
      [ivyWatch, jonWatch, staff].forEach((w) => w.close());
    });

    await t.test("over the cap: 503; shutdown ends every stream", async () => {
      const c = await instance({ maxSubscribers: 1 });
      const held = stream(c.base, staffPath, teacher);
      await held.next((f) => f.event === "snapshot", 5_000, true);
      const refused = stream(c.base, staffPath, teacher);
      await refused.ended;
      assert.equal(refused.status, 503);
      const refusedStudent = stream(c.base, studentPath, ivyToken);
      await refusedStudent.ended;
      assert.equal(refusedStudent.status, 503);
      const began = Date.now();
      await c.close();
      assert.ok(Date.now() - began < 3_000, "close didn't wait for the stream");
      const bye = await held.next((f) => f.event === "bye", 1_000, true);
      assert.deepEqual(bye.data, { reason: "shutdown" });
      await held.ended;
      assert.equal(c.hub.stats().subscribers, 0);
    });
  },
);
