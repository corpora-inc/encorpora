/**
 * Simulating a term is seconds of pure CPU a student, so a class or a school
 * runs on worker threads, never on the thread that answers requests. A few
 * students run inline.
 */
import { availableParallelism } from "node:os";
import { Worker } from "node:worker_threads";
import { runSimulation, type SimJob, type Simulation } from "./simulate.js";

// Compiled, this file is inside src/server/main.mjs and the worker is bundled
// beside the source (`build:server`); run from source, it is a sibling.
const compiled = import.meta.url.endsWith(".mjs");
const workerUrl = new URL(
  compiled
    ? "../schools/demo/simulate-worker.mjs"
    : "./simulate-worker.ts",
  import.meta.url,
);

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
  if (jobs.length < 8) return jobs.map((job) => runSimulation(job));
  // From source, the worker needs the loader the process runs under, not the
  // test runner. Compiled, it inherits the process's flags.
  const options = compiled
    ? {}
    : {
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
