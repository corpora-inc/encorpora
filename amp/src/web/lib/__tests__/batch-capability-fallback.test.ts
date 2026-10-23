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
