/**
 * Simulating a term is seconds of pure CPU a student, and each thread loads
 * the whole engine (hundreds of megabytes), so a class or a school runs on
 * worker threads; a few students run inline. Scripts, tests and the term
 * generator only (`scripts/demo-terms.ts`, `seed-history.ts`): the API
 * bundle never contains this file, and the server's terms are shipped
 * (`snapshot.ts`). `tests/demo-terms.test.ts` checks both.
 */
import { availableParallelism } from "node:os";
import { Worker } from "node:worker_threads";
import { runSimulation, type SimJob, type Simulation } from "./simulate.js";

const workerUrl = new URL("./simulate-worker.ts", import.meta.url);

/** Threads for one simulation: `AMP_DEMO_WORKERS`, else up to eight. */
function threads(jobs: number) {
  const configured = Number(process.env.AMP_DEMO_WORKERS);
  const limit =
    Number.isInteger(configured) && configured > 0
      ? configured
      : Math.min(8, availableParallelism());
  return Math.max(1, Math.min(jobs, limit));
}

export async function simulateJobs(
  jobs: readonly SimJob[],
): Promise<Simulation[]> {
  // Bundled into a compiled server by mistake: refuse rather than run.
  if (import.meta.url.endsWith(".mjs"))
    throw new Error("A demo term is never simulated in the server");
  if (jobs.length < 8) return jobs.map((job) => runSimulation(job));
  // The worker needs the loader the process runs under, not the test runner.
  const options = {
    execArgv: process.execArgv.filter(
      (arg) => arg !== "--test" && !arg.startsWith("--test-"),
    ),
  };
  const pool = Array.from(
    { length: threads(jobs.length) },
    () => new Worker(workerUrl, options),
  );
  const results: Simulation[] = new Array(jobs.length);
  let cursor = 0;
  try {
    await Promise.all(
      pool.map(async (worker) => {
        for (;;) {
          const index = cursor;
          cursor += 1;
          const job = jobs[index];
          if (!job) return;
          results[index] = await ask(worker, job);
        }
      }),
    );
  } finally {
    await Promise.all(pool.map((worker) => worker.terminate()));
  }
  return results;
}

async function ask(worker: Worker, job: SimJob): Promise<Simulation> {
  const response = await new Promise<
    { ok: true; result: Simulation } | { ok: false; error: string }
  >((resolve, reject) => {
    // A thread that dies without an answer fails the job; it never hangs it.
    const fail = (error: Error) => {
      worker.off("message", done);
      worker.off("error", fail);
      worker.off("exit", exited);
      reject(error);
    };
    const exited = (code: number) =>
      fail(new Error(`A demo simulation thread exited (${code})`));
    const done = (
      message: { ok: true; result: Simulation } | { ok: false; error: string },
    ) => {
      worker.off("error", fail);
      worker.off("exit", exited);
      resolve(message);
    };
    worker.once("error", fail);
    worker.once("exit", exited);
    worker.once("message", done);
    worker.postMessage(job);
  });
  if (!response.ok) throw new Error(response.error);
  return response.result;
}
