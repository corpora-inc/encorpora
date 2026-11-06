import assert from "node:assert/strict";
import test from "node:test";
import { estimateFrontier, initialLevel } from "../src/learning/frontier.js";
import { computeWorkbook, type ComposeInput } from "../src/workbook/compute.js";
import { createWorkbookWorker } from "../src/workbook/off-thread.js";

const now = Date.UTC(2026, 9, 31, 12);
const input: ComposeInput = {
  frontier: estimateFrontier({
    start: initialLevel({ birthYear: 2016, now }),
    observations: [],
    gradeOf: () => undefined,
    strandOf: (id) => id,
    guessOf: () => 0,
    now,
  }),
  evidence: [],
  date: "2026-10-31",
  learnerKey: "off-thread-test",
  now,
};
const silent = { warn: () => undefined };

test("a workbook made on the worker matches one made inline, byte for byte", async () => {
  const worker = createWorkbookWorker(silent);
  try {
    const spec = await worker.compose(input);
    assert.deepEqual(spec, computeWorkbook.compose(input));
    const options = { spec, learnerName: "Nora", paper: "a4" as const };
    assert.equal(await worker.html(options), computeWorkbook.html(options));
    assert.deepEqual(worker.stats, { ran: 2, fellBack: 0 });
  } finally {
    await worker.close();
  }
});

test("if the worker can't run, the workbook is made inline and it is logged", async () => {
  const warnings: unknown[][] = [];
  const worker = createWorkbookWorker(
    { warn: (...args: unknown[]) => void warnings.push(args) },
    new URL("./no-such-worker.mjs", import.meta.url),
  );
  try {
    const spec = await worker.compose(input);
    assert.deepEqual(spec, computeWorkbook.compose(input));
    assert.deepEqual(worker.stats, { ran: 0, fellBack: 1 });
    assert.equal(warnings[0]![1], "workbook worker failed; ran inline");
    assert.deepEqual(Object.keys(warnings[0]![0] as object).sort(), [
      "reason",
      "task",
    ]);
  } finally {
    await worker.close();
  }
});

test("a task that throws on the worker reports the same error as inline", async () => {
  const worker = createWorkbookWorker(silent);
  try {
    const invalid = { ...input, minutes: 7 } as unknown as ComposeInput;
    assert.throws(() => computeWorkbook.compose(invalid));
    await assert.rejects(worker.compose(invalid));
    assert.equal(worker.stats.fellBack, 1);
    // The worker survives a bad task.
    await worker.compose(input);
    assert.equal(worker.stats.ran, 1);
  } finally {
    await worker.close();
  }
});

test("an idle worker doesn't keep a job's process alive", async () => {
  const worker = createWorkbookWorker(silent);
  await worker.warm();
  await worker.compose(input);
  // No close: node --test would hang here if the thread held the process.
});
