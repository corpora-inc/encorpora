import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from "fastify";
import type { Pool, PoolClient, QueryResult } from "pg";
import type { LiveSession } from "./contracts.js";
import { classChanges, readClassEvents, type ClassEvent } from "./events.js";
import { readLiveRows, readOpenSignals, toLiveRow } from "./rows.js";
import { openSession, readLiveSnapshot } from "./sessions.js";
import {
  DEFAULT_STREAM_TIMING,
  openEventStream,
  type EventSink,
  type StreamTiming,
} from "./sse.js";
import {
  STREAM_EVENTS,
  type LiveRowsMessage,
  type StudentLive,
  type StudentSignal,
} from "./stream-contracts.js";
import { readStudentSignals } from "./signals.js";
import { toStudentSession } from "./student.js";

/* The live hub (#2465, work package L2): one per server process. Every
   stream in the process shares one tail of the `amp_class_events` outbox: a
   loop that runs only while someone is subscribed, about once a second, with
   one statement over every subscribed class, then for each class that changed
   one read of the changed students' rows (or the whole snapshot when a
   session started or stopped), fanned out to that class's streams.

   Connections: production pods have three. The hub's reads run one after
   another, so it uses at most one connection at a time, and none between
   ticks; a stream holds none. Ticks never overlap: a tick still running when
   the next is due skips it, and a run of skips is logged. No LISTEN/NOTIFY: a
   listener would pin a connection per pod.

   What a student's stream carries is only theirs: the sessions running in
   their own classes and their own requests (work package L4 writes those; the
   hub reads them whenever an outbox `signal` row names the student). */

/** Streams per process, staff and students together. A pod has 768 MiB and
 * three database connections; streams cost neither, but a cap keeps one pod
 * from taking a whole district while the others idle. Over it: 503. */
export const MAX_LIVE_SUBSCRIBERS = 200;
/** How often the hub reads the outbox. */
export const LIVE_TICK_MS = 1_000;

export type LiveHubOptions = {
  intervalMs?: number;
  maxSubscribers?: number;
  stream?: Partial<StreamTiming>;
  /** Log after this many ticks in a row were skipped because one was still
   * running. */
  overrunWarnAfter?: number;
  /** Log the hub's numbers this often while it runs. */
  statsEveryMs?: number;
};

export type LiveHubStats = {
  subscribers: number;
  classes: number;
  ticks: number;
  /** Ticks skipped because the last was still running. */
  overruns: number;
  queries: number;
  /** Connections the hub holds right now, and the most it ever held. */
  inUse: number;
  maxInUse: number;
  lastTickMs: number;
  maxTickMs: number;
  totalTickMs: number;
};

type StaffSubscriber = {
  kind: "staff";
  classId: string;
  manage: boolean;
  sink: EventSink;
  /** Waiting for its first snapshot. */
  fresh: boolean;
};
type StudentSubscriber = {
  kind: "student";
  personId: string;
  classIds: readonly string[];
  /** Which of them are a family's own (the adult there is a parent). */
  familyClassIds: readonly string[];
  sink: EventSink;
  fresh: boolean;
  /** Their requests as last read. */
  signals: StudentSignal[];
};
type Subscriber = StaffSubscriber | StudentSubscriber;
type ClassState = {
  staff: Set<StaffSubscriber>;
  students: Set<StudentSubscriber>;
  /** The running session as last read; undefined until read. */
  session: LiveSession | null | undefined;
};

const sameSession = (
  a: LiveSession | null | undefined,
  b: LiveSession | null | undefined,
) => (a?.id ?? null) === (b?.id ?? null) && a?.endsAt === b?.endsAt;

/** The code and message of a failure, never a row: a database error's detail
 * can quote one, and a row here holds a child's name. */
const failure = (error: unknown) => {
  const e = error as { code?: unknown; message?: unknown };
  return { code: e?.code, message: String(e?.message ?? error) };
};

export class LiveHub {
  private readonly db: Pool;
  private readonly classes = new Map<string, ClassState>();
  private readonly subscribers = new Set<Subscriber>();
  /** Outbox ids already fanned out, among those in the re-read window. */
  private seen = new Set<string>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private statsTimer: ReturnType<typeof setInterval> | undefined;
  private running: Promise<void> | null = null;
  private again = false;
  private closed = false;
  private overrunRun = 0;
  private readonly numbers: Omit<LiveHubStats, "subscribers" | "classes"> = {
    ticks: 0,
    overruns: 0,
    queries: 0,
    inUse: 0,
    maxInUse: 0,
    lastTickMs: 0,
    maxTickMs: 0,
    totalTickMs: 0,
  };
  private window = { at: Date.now(), ticks: 0, queries: 0, tickMs: 0 };
  readonly timing: StreamTiming;
  private readonly intervalMs: number;
  private readonly maxSubscribers: number;
  private readonly overrunWarnAfter: number;
  private readonly statsEveryMs: number;

  constructor(
    pool: Pool,
    private readonly log: FastifyBaseLogger,
    options: LiveHubOptions = {},
  ) {
    this.db = countingPool(pool, this.numbers);
    this.timing = { ...DEFAULT_STREAM_TIMING, ...options.stream };
    this.intervalMs = options.intervalMs ?? LIVE_TICK_MS;
    this.maxSubscribers = options.maxSubscribers ?? MAX_LIVE_SUBSCRIBERS;
    this.overrunWarnAfter = options.overrunWarnAfter ?? 5;
    this.statsEveryMs = options.statsEveryMs ?? 60_000;
  }

  stats(): LiveHubStats {
    return {
      ...this.numbers,
      subscribers: this.subscribers.size,
      classes: this.classes.size,
    };
  }

  /** A staff stream for a class (the route has authorized the reader).
   * False when the process is full or stopping: answer 503. */
  attachStaff(
    request: FastifyRequest,
    reply: FastifyReply,
    input: { classId: string; manage: boolean },
  ): boolean {
    if (!this.hasRoom()) return false;
    const subscriber = {
      kind: "staff",
      classId: input.classId,
      manage: input.manage,
      fresh: true,
    } as StaffSubscriber;
    subscriber.sink = openEventStream(request, reply, this.timing, () =>
      this.remove(subscriber),
    );
    this.add(subscriber, [input.classId]);
    return true;
  }

  /** A student's own stream, over the classes they are in today. */
  attachStudent(
    request: FastifyRequest,
    reply: FastifyReply,
    input: {
      personId: string;
      classIds: readonly string[];
      familyClassIds?: readonly string[];
    },
  ): boolean {
    if (!this.hasRoom()) return false;
    const subscriber = {
      kind: "student",
      personId: input.personId,
      classIds: [...input.classIds],
      familyClassIds: [...(input.familyClassIds ?? [])],
      fresh: true,
      signals: [],
    } as unknown as StudentSubscriber;
    subscriber.sink = openEventStream(request, reply, this.timing, () =>
      this.remove(subscriber),
    );
    // In no class today: nothing will change for them, and they have no
    // requests (a request belongs to a class). Their state, once.
    if (!input.classIds.length)
      subscriber.sink.send(STREAM_EVENTS.snapshot, {
        serverNow: new Date().toISOString(),
        sessions: [],
        signals: [],
        familyClasses: [],
      } satisfies StudentLive);
    this.add(subscriber, input.classIds);
    return true;
  }

  private hasRoom() {
    if (this.closed) return false;
    if (this.subscribers.size < this.maxSubscribers) return true;
    this.log.warn(
      { subscribers: this.subscribers.size },
      "live hub full: a stream was refused (503)",
    );
    return false;
  }

  private add(subscriber: Subscriber, classIds: readonly string[]) {
    // Already gone (the client left while the stream opened).
    if (!subscriber.sink.open) return;
    this.subscribers.add(subscriber);
    let unknown = false;
    for (const classId of classIds) {
      let state = this.classes.get(classId);
      if (!state) {
        state = { staff: new Set(), students: new Set(), session: undefined };
        this.classes.set(classId, state);
        unknown = true;
      }
      if (subscriber.kind === "staff") state.staff.add(subscriber);
      else state.students.add(subscriber);
    }
    this.start();
    // Its first snapshot comes from a tick, in order with every other read,
    // so it is never older than a `rows` message sent after it. A class the
    // hub already follows waits for the next one (under a second): a class's
    // streams reconnect every 85-95 s, and a tick for each would multiply the
    // reads. A class it doesn't follow yet is read now.
    if (unknown) this.run();
  }

  private remove(subscriber: Subscriber) {
    if (!this.subscribers.delete(subscriber)) return;
    const classIds =
      subscriber.kind === "staff" ? [subscriber.classId] : subscriber.classIds;
    for (const classId of classIds) {
      const state = this.classes.get(classId);
      if (!state) continue;
      if (subscriber.kind === "staff") state.staff.delete(subscriber);
      else state.students.delete(subscriber);
      if (!state.staff.size && !state.students.size)
        this.classes.delete(classId);
    }
    if (!this.subscribers.size) this.stop();
  }

  private start() {
    if (this.timer || this.closed) return;
    this.timer = setInterval(() => this.due(), this.intervalMs);
    this.timer.unref();
    // Counted from now: the totals run on across idle spells.
    this.window = {
      at: Date.now(),
      ticks: this.numbers.ticks,
      queries: this.numbers.queries,
      tickMs: this.numbers.totalTickMs,
    };
    this.statsTimer = setInterval(() => this.report(), this.statsEveryMs);
    this.statsTimer.unref();
  }

  private stop() {
    clearInterval(this.timer);
    clearInterval(this.statsTimer);
    this.timer = undefined;
    this.statsTimer = undefined;
    this.seen = new Set();
  }

  /** The interval fired. A tick still running skips this one. */
  private due() {
    if (!this.running) {
      this.overrunRun = 0;
      this.run();
      return;
    }
    this.numbers.overruns++;
    this.overrunRun++;
    if (
      this.overrunRun === this.overrunWarnAfter ||
      this.overrunRun % (this.overrunWarnAfter * 12) === 0
    )
      this.log.warn(
        {
          skipped: this.overrunRun,
          lastTickMs: Math.round(this.numbers.lastTickMs),
          classes: this.classes.size,
          subscribers: this.subscribers.size,
        },
        "live hub: ticks are overrunning, streams update late",
      );
  }

  /** Runs a tick now, or right after the one running. */
  private run() {
    if (this.closed) return;
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = this.tick().finally(() => {
      this.running = null;
      if (this.again && this.subscribers.size && !this.closed) {
        this.again = false;
        this.run();
      }
    });
  }

  private report() {
    const memory = process.memoryUsage();
    const seconds = Math.max(1, (Date.now() - this.window.at) / 1000);
    const ticks = this.numbers.ticks - this.window.ticks;
    this.log.info(
      {
        subscribers: this.subscribers.size,
        classes: this.classes.size,
        ticks,
        meanTickMs: ticks
          ? Math.round(
              ((this.numbers.totalTickMs - this.window.tickMs) / ticks) * 10,
            ) / 10
          : 0,
        maxTickMs: Math.round(this.numbers.maxTickMs),
        queriesPerSecond:
          Math.round(
            ((this.numbers.queries - this.window.queries) / seconds) * 10,
          ) / 10,
        overruns: this.numbers.overruns,
        rssMb: Math.round(memory.rss / 1048576),
        heapMb: Math.round(memory.heapUsed / 1048576),
      },
      "live hub",
    );
    this.window = {
      at: Date.now(),
      ticks: this.numbers.ticks,
      queries: this.numbers.queries,
      tickMs: this.numbers.totalTickMs,
    };
  }

  /** Ends every stream ("shutdown": the clients reconnect to another pod)
   * and waits for a running tick, before the pool closes. */
  async close(): Promise<void> {
    this.closed = true;
    this.stop();
    for (const subscriber of [...this.subscribers])
      subscriber.sink.end("shutdown");
    await this.running;
  }

  private async tick(): Promise<void> {
    const started = performance.now();
    try {
      const classIds = [...this.classes.keys()];
      if (!classIds.length) return;
      let events: ClassEvent[];
      try {
        events = await readClassEvents(this.db, classIds);
      } catch (error) {
        this.log.error(failure(error), "live hub: the outbox read failed");
        return;
      }
      const fresh = events.filter((event) => !this.seen.has(event.id));
      const changes = new Map(
        classChanges(fresh, this.seen).map((change) => [
          change.classId,
          change,
        ]),
      );
      // Ids older than the window never come back: forget them.
      this.seen = new Set(events.map((event) => event.id));
      /** Per class, the students whose own request changed. */
      const signalled = new Map<string, Set<string>>();
      /** Classes whose events name a session the hub doesn't hold. */
      const otherSession = new Set<string>();
      /** Per class, whose settings changed: everyone's, or these students'. */
      const settings = new Map<string, Set<string> | "all">();
      for (const event of fresh) {
        const state = this.classes.get(event.classId);
        if (event.kind === "settings") {
          const whose = settings.get(event.classId);
          if (!event.personId) settings.set(event.classId, "all");
          else if (whose !== "all")
            settings.set(
              event.classId,
              (whose ?? new Set<string>()).add(event.personId),
            );
        } else if (event.kind === "signal") {
          if (!event.personId) continue;
          const people = signalled.get(event.classId) ?? new Set<string>();
          signalled.set(event.classId, people.add(event.personId));
        } else if (
          state?.session !== undefined &&
          event.sessionId !== (state.session?.id ?? null)
        )
          otherSession.add(event.classId);
      }
      const now = Date.now();
      const students = new Set<StudentSubscriber>();
      const signalReads = new Set<StudentSubscriber>();
      for (const [classId, state] of this.classes) {
        const before = state.session;
        try {
          await this.updateClass(classId, state, {
            change: changes.get(classId),
            sessionChanged:
              state.session === undefined ||
              !!changes.get(classId)?.session ||
              otherSession.has(classId) ||
              (!!state.session && Date.parse(state.session.endsAt) <= now),
          });
        } catch (error) {
          // Read it whole next tick: a missed change is never left behind.
          state.session = undefined;
          for (const subscriber of state.staff) subscriber.fresh = true;
          this.log.error(
            { ...failure(error), classId },
            "live hub: a class's read failed; it is read again next tick",
          );
        }
        const moved = !sameSession(before, state.session);
        const people = signalled.get(classId);
        const changed = settings.get(classId);
        for (const subscriber of state.students) {
          if (subscriber.fresh || people?.has(subscriber.personId))
            signalReads.add(subscriber);
          // Their settings changed: the whole state again, which is what a
          // student's screen reads its settings on (useStudentLive.ts).
          if (
            subscriber.fresh ||
            moved ||
            changed === "all" ||
            changed?.has(subscriber.personId)
          )
            students.add(subscriber);
        }
      }
      // One read per student (two tabs share it), as L4's own route reads.
      const read = new Map<string, Promise<StudentSignal[]>>();
      for (const subscriber of signalReads) {
        try {
          const signals =
            read.get(subscriber.personId) ??
            readStudentSignals(this.db, subscriber.personId);
          read.set(subscriber.personId, signals);
          subscriber.signals = await signals;
          students.add(subscriber);
        } catch (error) {
          students.delete(subscriber);
          this.log.error(
            failure(error),
            "live hub: a student's requests weren't read; read again on their next change",
          );
        }
      }
      const serverNow = new Date().toISOString();
      for (const subscriber of students) {
        // Not sent until its classes' sessions are known.
        if (
          subscriber.classIds.some(
            (id) => this.classes.get(id)?.session === undefined,
          )
        )
          continue;
        subscriber.fresh = false;
        subscriber.sink.send(STREAM_EVENTS.snapshot, {
          serverNow,
          sessions: subscriber.classIds.flatMap((id) => {
            const session = this.classes.get(id)?.session;
            return session ? [toStudentSession(session)] : [];
          }),
          signals: subscriber.signals,
          familyClasses: [...subscriber.familyClassIds],
        } satisfies StudentLive);
      }
    } finally {
      const ms = performance.now() - started;
      this.numbers.ticks++;
      this.numbers.lastTickMs = ms;
      this.numbers.totalTickMs += ms;
      this.numbers.maxTickMs = Math.max(this.numbers.maxTickMs, ms);
    }
  }

  /** One class's reads and messages for this tick. */
  private async updateClass(
    classId: string,
    state: ClassState,
    input: {
      change: ReturnType<typeof classChanges>[number] | undefined;
      sessionChanged: boolean;
    },
  ) {
    const { change, sessionChanged } = input;
    const people = change?.personIds ?? [];
    const waiting = [...state.staff].some((subscriber) => subscriber.fresh);
    if (state.staff.size && (sessionChanged || waiting)) {
      // The whole class: a session began or ended, or a stream is new. The
      // snapshot also serves the streams already open.
      const snapshot = await readLiveSnapshot(this.db, classId, false);
      state.session = snapshot.session;
      const rows = snapshot.session
        ? snapshot.rows.filter((row) => people.includes(row.personId))
        : [];
      for (const subscriber of state.staff) {
        if (subscriber.fresh || sessionChanged) {
          subscriber.fresh = false;
          subscriber.sink.send(STREAM_EVENTS.snapshot, {
            ...snapshot,
            can: { manage: subscriber.manage },
          });
          continue;
        }
        if (rows.length)
          subscriber.sink.send(STREAM_EVENTS.rows, {
            serverNow: snapshot.serverNow,
            sessionId: snapshot.session!.id,
            rows,
          } satisfies LiveRowsMessage);
        if (change?.signals)
          subscriber.sink.send(STREAM_EVENTS.signals, {
            signals: snapshot.signals,
          });
      }
      return;
    }
    if (sessionChanged) state.session = await openSession(this.db, classId);
    if (!state.staff.size) return;
    const session = state.session;
    if (session && people.length) {
      const rows = (
        await readLiveRows(
          this.db,
          {
            classId,
            sessionId: session.id,
            from: session.startedAt,
            to: session.endsAt,
          },
          people,
        )
      ).map(toLiveRow);
      if (rows.length) {
        const message: LiveRowsMessage = {
          serverNow: new Date().toISOString(),
          sessionId: session.id,
          rows,
        };
        for (const subscriber of state.staff)
          subscriber.sink.send(STREAM_EVENTS.rows, message);
      }
    }
    if (change?.signals) {
      const signals = await readOpenSignals(this.db, classId);
      for (const subscriber of state.staff)
        subscriber.sink.send(STREAM_EVENTS.signals, { signals });
    }
  }
}

/** The pool as the hub uses it: every statement and checked-out client
 * counted, so its claim of one connection at a time is measured, not
 * assumed. */
function countingPool(
  pool: Pool,
  numbers: { queries: number; inUse: number; maxInUse: number },
): Pool {
  const take = () => {
    numbers.inUse++;
    numbers.maxInUse = Math.max(numbers.maxInUse, numbers.inUse);
  };
  return {
    query: async (...args: unknown[]): Promise<QueryResult> => {
      numbers.queries++;
      take();
      try {
        return await (pool.query as (...a: unknown[]) => Promise<QueryResult>)(
          ...args,
        );
      } finally {
        numbers.inUse--;
      }
    },
    connect: async (): Promise<PoolClient> => {
      take();
      let client: PoolClient;
      try {
        client = await pool.connect();
      } catch (error) {
        numbers.inUse--;
        throw error;
      }
      let released = false;
      return {
        query: (...args: unknown[]) => {
          numbers.queries++;
          return (client.query as (...a: unknown[]) => unknown)(...args);
        },
        release: (error?: Error | boolean) => {
          if (!released) {
            released = true;
            numbers.inUse--;
          }
          client.release(error);
        },
      } as unknown as PoolClient;
    },
  } as unknown as Pool;
}
