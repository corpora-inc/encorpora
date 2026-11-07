/**
 * A class answering at once: 30 students, then 300, in lockstep through the real
 * practice API, against a server process built like production's, with the
 * per-pod database pool production uses by default (`databasePoolMax` with
 * `NODE_ENV=production`). Each round, every student submits an answer at the
 * same moment; every fifth, each asks for the next batch. Reports p50 and p95
 * per answer and per batch, and any errors. Synthetic students only.
 *
 *     AMP_TEST_DATABASE_URL=... npm run school:load -- [--sizes 30,300] [--rounds 10] [--pool <n>]
 *
 * The server runs in its own process (this script with `--serve`), so the
 * clients' work never shares its event loop.
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { SchoolRepository } from "../src/schools/repository";
import { registerSchoolRoutes } from "../src/schools/routes";
import { buildApp } from "../src/server/app";
import { developmentAuth, refuseStudentTokens } from "../src/server/auth";
import { databasePoolMax, serverPoolOptions } from "../src/server/database";
import { PostgresRepository } from "../src/server/repository";
import { warmServer, watchRuntimeHealth } from "../src/server/runtime-health";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";

const argument = (name: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};

async function main() {
  const url = process.env.AMP_TEST_DATABASE_URL;
  if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
  assertTestDatabaseTarget(url);
  const sizes = (argument("--sizes") ?? "30,300").split(",").map(Number);
  const rounds = Number(argument("--rounds") ?? 10);
  // Production's per-pod pool, read from the code's own default.
  const poolMax = Number(
    argument("--pool") ?? databasePoolMax({ NODE_ENV: "production" }),
  );
  const port = 4428;
  const schema = `amp_school_load_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  await migrate(scoped.href);
  const db = new Pool({ connectionString: scoped.href, max: 4 });
  const schools = new SchoolRepository(db);
  let server: ChildProcess | null = null;
  try {
    const org = await schools.createOrg(
      { kind: "school", name: "Load School", timezone: "America/New_York" },
      {
        version: "fixture-1",
        signerName: "Fixture Signer",
        signerTitle: "Head of School",
      },
    );
    await schools.issueLicense({
      orgId: org.id,
      seats: sizes.reduce((sum, size) => sum + size, 0) + 10,
      endsAt: new Date(Date.now() + 300 * 86_400_000).toISOString(),
    });
    await mkdir("artifacts/school-load", { recursive: true });
    const log = createWriteStream("artifacts/school-load/server.log");
    server = spawn(
      process.execPath,
      [
        ...process.execArgv,
        fileURLToPath(import.meta.url),
        "--serve",
        "--database",
        scoped.href,
        "--port",
        String(port),
      ],
      {
        env: { ...process.env, AMP_DATABASE_POOL_MAX: String(poolMax) },
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      },
    );
    server.stdout!.pipe(log);
    server.stderr!.pipe(log);
    const ready = await new Promise<{ poolMax: number }>((done, fail) => {
      server!.once("message", (message) =>
        done(message as { poolMax: number }),
      );
      server!.once("exit", (code) => fail(new Error(`server exited ${code}`)));
    });
    console.log(
      `Server process up with a database pool of ${ready.poolMax} (production's default per pod).`,
    );
    const base = `http://127.0.0.1:${port}/api/v1`;
    const results: string[] = [];
    for (const size of sizes) {
      const klass = await schools.createClass(org.id, {
        name: `Load ${size}`,
        courseBands: ["5"],
      });
      const students: { learnerId: string; token: string }[] = [];
      for (let index = 0; index < size; index++) {
        const student = await schools.provisionStudent(org.id, {
          givenName: `Student${index}`,
          familyName: "Load",
          gradeLevel: 5,
          classId: klass.id,
        });
        const { token } = await schools.issueStudentSession({
          personId: student.personId,
          mode: "shared",
        });
        students.push({ learnerId: student.learnerId, token });
      }
      const report = await lockstep(base, db, students, rounds);
      const line = `${size} students: answers p50 ${report.answers.p50} ms, p95 ${report.answers.p95} ms, max ${report.answers.max} ms (${report.answers.count}); batches p50 ${report.batches.p50} ms, p95 ${report.batches.p95} ms (${report.batches.count}); slowest round ${report.slowestRound} ms; errors ${report.errors.length}${report.errors.length ? ` (${[...new Set(report.errors)].slice(0, 4).join("; ")})` : ""}`;
      console.log(line);
      results.push(line);
    }
    console.log(`\nPool ${poolMax}:\n${results.join("\n")}`);
  } finally {
    server?.kill("SIGTERM");
    await db.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
}

type Timed = { ms: number; ok: boolean; error?: string };
async function timed(
  call: () => Promise<Response>,
): Promise<Timed & { body?: any }> {
  const started = performance.now();
  try {
    const response = await call();
    const text = await response.text();
    const ms = performance.now() - started;
    return response.ok
      ? { ms, ok: true, body: JSON.parse(text) }
      : { ms, ok: false, error: `HTTP ${response.status}` };
  } catch (error) {
    return {
      ms: performance.now() - started,
      ok: false,
      error: (error as Error).message,
    };
  }
}
const stats = (samples: number[]) => {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (share: number) =>
    Math.round(sorted[Math.floor((sorted.length - 1) * share)] ?? 0);
  return { p50: at(0.5), p95: at(0.95), max: at(1), count: sorted.length };
};

/** Every student answers at the same moment, round after round. */
async function lockstep(
  base: string,
  db: Pool,
  students: { learnerId: string; token: string }[],
  rounds: number,
) {
  const post = (token: string, path: string, body: object) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  const queues = new Map<string, { id: string; answer: string }[]>();
  const answers: number[] = [];
  const batches: number[] = [];
  const errors: string[] = [];
  let slowestRound = 0;
  async function refill() {
    const results = await Promise.all(
      students.map((student) =>
        timed(() =>
          post(student.token, `/learners/${student.learnerId}/batches`, {
            count: 5,
          }),
        ),
      ),
    );
    const ids: string[] = [];
    for (const [index, result] of results.entries()) {
      batches.push(result.ms);
      if (!result.ok) {
        errors.push(`batch ${result.error}`);
        continue;
      }
      const problems = (result.body.problems ?? []) as { id: string }[];
      queues.set(
        students[index]!.learnerId,
        problems.map((problem) => ({ id: problem.id, answer: "" })),
      );
      ids.push(...problems.map((problem) => problem.id));
    }
    // The right answers, looked up between rounds, never while timing.
    const { rows } = await db.query(
      "SELECT id,content->>'answer' AS answer FROM amp_instances WHERE id=ANY($1)",
      [ids],
    );
    const answer = new Map(rows.map((row) => [row.id, row.answer as string]));
    for (const queue of queues.values())
      for (const item of queue) item.answer = answer.get(item.id) ?? "0";
  }
  await refill();
  for (let round = 0; round < rounds; round++) {
    if (round > 0 && round % 5 === 0) await refill();
    const started = performance.now();
    const results = await Promise.all(
      students.map((student, index) => {
        const next = queues.get(student.learnerId)?.shift();
        if (!next)
          return Promise.resolve<Timed>({
            ms: 0,
            ok: false,
            error: "no problem",
          });
        // About three in four right, the same on every run.
        const right = (index * 7 + round * 3) % 4 !== 0;
        return timed(() =>
          post(student.token, `/learners/${student.learnerId}/attempts`, {
            problemId: next.id,
            requestId: randomUUID(),
            response: right ? next.answer : "99999",
          }),
        );
      }),
    );
    slowestRound = Math.max(
      slowestRound,
      Math.round(performance.now() - started),
    );
    for (const result of results) {
      if (result.ok) answers.push(result.ms);
      else errors.push(`answer ${result.error}`);
    }
  }
  assert.ok(answers.length > 0, "Some answers went through");
  return {
    answers: stats(answers),
    batches: stats(batches),
    slowestRound,
    errors,
  };
}

/* The server: what main.ts builds for practice, on loopback. */
if (process.argv.includes("--serve")) {
  const url = argument("--database")!;
  const port = Number(argument("--port"));
  const repository = new PostgresRepository(url, { pool: serverPoolOptions });
  const authenticate = refuseStudentTokens(developmentAuth());
  const app = buildApp({ repository, authenticate, logger: true });
  await registerSchoolRoutes(app, { pool: repository.pool, authenticate });
  await warmServer(app, repository.pool);
  // As main.ts does: a stalled event loop is logged, every two seconds here.
  watchRuntimeHealth(app.log, 2000);
  await app.listen({ host: "127.0.0.1", port });
  process.send?.({ listening: port, poolMax: repository.pool.options.max });
  process.on("SIGTERM", () => void app.close().then(() => process.exit(0)));
} else await main();
