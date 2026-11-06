import { Worker } from "node:worker_threads";
import {
  computeWorkbook,
  type ComposeInput,
  type HtmlInput,
  type WorkbookTask,
} from "./compute.js";

/**
 * Composing a workbook and building its printable page take about a second of
 * pure CPU on a pod, which on the main thread froze every other request on it.
 * One worker per process does that work instead, one task at a time, so more
 * capacity means more pods. The inputs and the code are the same, so the result
 * is too. If the worker fails for any reason the task runs inline and logs it:
 * slower for everyone on the pod, but never a failed workbook.
 */
const TASK_TIMEOUT_MS = 30_000;
const READY_TIMEOUT_MS = 20_000;

type Log = { warn: (details: object, message: string) => void };
type Pending = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

// Compiled, this file is inside src/server/main.mjs and the worker sits beside
// it in the source tree; run from source, it is a sibling. See `build:server`.
const defaultWorkerUrl = new URL(
  import.meta.url.endsWith(".mjs")
    ? "../workbook/compute-worker.mjs"
    : "./compute-worker.ts",
  import.meta.url,
);

export function createWorkbookWorker(
  log: Log,
  workerUrl: URL = defaultWorkerUrl,
) {
  let worker: Worker | null = null;
  let ready: Promise<void> | null = null;
  let nextId = 0;
  const pending = new Map<number, Pending>();
  const stats = { ran: 0, fellBack: 0 };

  function settle(id: number) {
    const entry = pending.get(id);
    if (!entry) return null;
    clearTimeout(entry.timer);
    pending.delete(id);
    // Only work in flight keeps a process alive for this thread.
    if (pending.size === 0) worker?.unref();
    return entry;
  }
  function discard(current: Worker, reason: string) {
    if (worker !== current) return;
    worker = null;
    ready = null;
    void current.terminate();
    for (const id of [...pending.keys()]) settle(id)?.reject(new Error(reason));
  }
  function start() {
    const current = new Worker(workerUrl, {
      // A runaway task ends this thread, not the pod.
      resourceLimits: { maxOldGenerationSizeMb: 256 },
    });
    current.unref();
    worker = current;
    ready = new Promise<void>((resolve) => {
      current.on("message", (message: Record<string, unknown>) => {
        if (message.ready) return resolve();
        const entry = settle(message.id as number);
        if (message.failure) entry?.reject(new Error(String(message.failure)));
        else entry?.resolve(message.value);
      });
      const end = (reason: string) => {
        discard(current, reason);
        resolve();
      };
      current.on("error", (error) => end(error.name));
      current.on("exit", () => end("exit"));
    });
    return current;
  }
  function send(task: WorkbookTask, input: unknown) {
    return new Promise<unknown>((resolve, reject) => {
      const current = worker ?? start();
      const id = ++nextId;
      const timer = setTimeout(
        () => discard(current, "timeout"),
        TASK_TIMEOUT_MS,
      );
      pending.set(id, { resolve, reject, timer });
      current.ref();
      try {
        current.postMessage({ id, task, input });
      } catch (error) {
        settle(id);
        reject(error as Error);
      }
    });
  }
  async function run<T>(task: WorkbookTask, input: unknown): Promise<T> {
    try {
      const value = (await send(task, input)) as T;
      stats.ran += 1;
      return value;
    } catch (error) {
      stats.fellBack += 1;
      log.warn(
        { task, reason: error instanceof Error ? error.message : "unknown" },
        "workbook worker failed; ran inline",
      );
      return (computeWorkbook[task] as (value: unknown) => T)(input);
    }
  }
  return {
    compose: (input: ComposeInput) =>
      run<ReturnType<typeof computeWorkbook.compose>>("compose", input),
    html: (input: HtmlInput) => run<string>("html", input),
    /** Loads the worker before traffic, so the first workbook isn't delayed. A
     * worker that can't start only costs that: the next task retries it. */
    async warm() {
      if (!worker) start();
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        ready,
        new Promise((resolve) => {
          timer = setTimeout(resolve, READY_TIMEOUT_MS);
        }),
      ]);
      clearTimeout(timer);
    },
    stats,
    async close() {
      const current = worker;
      worker = null;
      ready = null;
      for (const id of [...pending.keys()])
        settle(id)?.reject(new Error("closed"));
      await current?.terminate();
    },
  };
}
export type WorkbookWorker = ReturnType<typeof createWorkbookWorker>;

let shared: WorkbookWorker | undefined;
/** The one worker this process uses for workbooks. */
export function workbookWorker(log: Log = consoleLog) {
  return (shared ??= createWorkbookWorker(log));
}
const consoleLog: Log = {
  warn: (details, message) => console.warn(message, JSON.stringify(details)),
};
