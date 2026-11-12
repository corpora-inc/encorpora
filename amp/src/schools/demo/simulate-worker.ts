import { parentPort } from "node:worker_threads";
import { runSimulation, type SimJob } from "./simulate.js";

/** Simulates one student's term at a time on its own thread
 * (`simulate-pool.ts`). Never part of the server bundle. */
parentPort!.on("message", (job: SimJob) => {
  try {
    parentPort!.postMessage({ ok: true as const, result: runSimulation(job) });
  } catch (error) {
    parentPort!.postMessage({
      ok: false as const,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
