import { parentPort } from "node:worker_threads";
import { computeWorkbook, type WorkbookTask } from "./compute.js";

/** Runs one workbook task at a time on its own thread (see `off-thread.ts`). */
parentPort!.on(
  "message",
  ({ id, task, input }: { id: number; task: WorkbookTask; input: never }) => {
    try {
      parentPort!.postMessage({ id, value: computeWorkbook[task](input) });
    } catch (error) {
      // The caller redoes it inline, which reports the real error.
      parentPort!.postMessage({
        id,
        failure: error instanceof Error ? error.name : "unknown",
      });
    }
  },
);
parentPort!.postMessage({ ready: true });
