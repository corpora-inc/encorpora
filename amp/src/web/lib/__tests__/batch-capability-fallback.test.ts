import { expect, test, vi } from "vitest";
import {
  batchWithCapabilityFallback,
  validationPaths,
} from "../batch-capability-fallback";

const full = {
  count: 1,
  templateId: "some-template",
  figureCapabilities: ["linear-graph-v1"],
  responseCapabilities: ["single-choice-v1", "multi-select-v1"],
};
const oldApiError = {
  status: 400,
  code: "Invalid request",
  validationPaths: [["responseCapabilities", 1], ["responseCapabilities"]],
};

test("accepts only validation issue paths, without retaining messages or values", () => {
  expect(
    validationPaths([
      { path: ["responseCapabilities", 1], message: "private fixture" },
    ]),
  ).toEqual([["responseCapabilities", 1]]);
  expect(validationPaths([{ path: "responseCapabilities" }])).toBeNull();
  expect(validationPaths([])).toBeNull();
});

test("a current API receives one full-capability request", async () => {
  const send = vi.fn().mockResolvedValue("batch");
  await expect(batchWithCapabilityFallback(full, send)).resolves.toBe("batch");
  expect(send).toHaveBeenCalledExactlyOnceWith(full);
});

test("an old API gets one narrow retry with the other request fields intact", async () => {
  const send = vi
    .fn()
    .mockRejectedValueOnce(oldApiError)
    .mockResolvedValueOnce("batch");
  await expect(batchWithCapabilityFallback(full, send)).resolves.toBe("batch");
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[0][0]).toEqual(full);
  expect(send.mock.calls[1][0]).toEqual({
    ...full,
    responseCapabilities: ["single-choice-v1"],
  });
  expect(full.responseCapabilities).toEqual([
    "single-choice-v1",
    "multi-select-v1",
  ]);
});

test.each([
  { ...oldApiError, status: 401 },
  { ...oldApiError, status: 402 },
  { ...oldApiError, status: 500 },
  { ...oldApiError, code: "Other error" },
  { ...oldApiError, validationPaths: null },
  new DOMException("Request aborted", "AbortError"),
  { ...oldApiError, validationPaths: [["figureCapabilities", 0]] },
  {
    ...oldApiError,
    validationPaths: [["responseCapabilities"], ["count"]],
  },
])("does not retry an unrelated error: %j", async (error) => {
  const send = vi.fn().mockRejectedValue(error);
  await expect(batchWithCapabilityFallback(full, send)).rejects.toBe(error);
  expect(send).toHaveBeenCalledTimes(1);
});

test("does not retry after a session change or a second failure", async () => {
  const send = vi.fn().mockRejectedValue(oldApiError);
  await expect(
    batchWithCapabilityFallback(full, send, () => false),
  ).rejects.toBe(oldApiError);
  expect(send).toHaveBeenCalledTimes(1);
  await expect(batchWithCapabilityFallback(full, send)).rejects.toBe(
    oldApiError,
  );
  expect(send).toHaveBeenCalledTimes(3);
});

test("does not retry a single-choice-only request", async () => {
  const send = vi.fn().mockRejectedValue(oldApiError);
  await expect(
    batchWithCapabilityFallback(
      { ...full, responseCapabilities: ["single-choice-v1"] },
      send,
    ),
  ).rejects.toBe(oldApiError);
  expect(send).toHaveBeenCalledTimes(1);
});

test("a client steps down from structured work, figure and multi-part choices to an API that knows point plots", async () => {
  const current = {
    ...full,
    responseCapabilities: [
      "single-choice-v1",
      "multi-select-v1",
      "point-plot-v1",
      "multi-part-choice-v1",
      "figure-choice-v1",
      "structured-work-v1",
    ],
  };
  const unknownFormats = (indexes: number[]) => ({
    ...oldApiError,
    validationPaths: [
      ...indexes.map((i) => ["responseCapabilities", i]),
      ["responseCapabilities"],
    ],
  });
  const send = vi
    .fn()
    .mockRejectedValueOnce(unknownFormats([3, 4, 5]))
    .mockRejectedValueOnce(unknownFormats([3, 4]))
    .mockRejectedValueOnce(unknownFormats([3]))
    .mockResolvedValueOnce("batch");
  await expect(batchWithCapabilityFallback(current, send)).resolves.toBe(
    "batch",
  );
  expect(send.mock.calls.map((call) => call[0].responseCapabilities)).toEqual([
    current.responseCapabilities,
    [
      "single-choice-v1",
      "multi-select-v1",
      "point-plot-v1",
      "multi-part-choice-v1",
      "figure-choice-v1",
    ],
    [
      "single-choice-v1",
      "multi-select-v1",
      "point-plot-v1",
      "multi-part-choice-v1",
    ],
    ["single-choice-v1", "multi-select-v1", "point-plot-v1"],
  ]);
});

test("a current client steps down one format at a time for each older API", async () => {
  const current = {
    ...full,
    responseCapabilities: [
      "single-choice-v1",
      "multi-select-v1",
      "point-plot-v1",
    ],
  };
  // An API that knows multiple selections but not plotted points.
  const send = vi
    .fn()
    .mockRejectedValueOnce({
      ...oldApiError,
      validationPaths: [["responseCapabilities", 2], ["responseCapabilities"]],
    })
    .mockResolvedValueOnce("batch");
  await expect(batchWithCapabilityFallback(current, send)).resolves.toBe(
    "batch",
  );
  expect(send.mock.calls.map((call) => call[0].responseCapabilities)).toEqual([
    ["single-choice-v1", "multi-select-v1", "point-plot-v1"],
    ["single-choice-v1", "multi-select-v1"],
  ]);
  // The oldest API accepts single choice only.
  const oldest = vi
    .fn()
    .mockRejectedValueOnce(oldApiError)
    .mockRejectedValueOnce(oldApiError)
    .mockResolvedValueOnce("batch");
  await expect(batchWithCapabilityFallback(current, oldest)).resolves.toBe(
    "batch",
  );
  expect(oldest.mock.calls.map((call) => call[0].responseCapabilities)).toEqual(
    [
      ["single-choice-v1", "multi-select-v1", "point-plot-v1"],
      ["single-choice-v1", "multi-select-v1"],
      ["single-choice-v1"],
    ],
  );
  // A single-choice request that still fails is final, never sent empty.
  const failing = vi.fn().mockRejectedValue(oldApiError);
  await expect(batchWithCapabilityFallback(current, failing)).rejects.toBe(
    oldApiError,
  );
  expect(failing).toHaveBeenCalledTimes(3);
});
