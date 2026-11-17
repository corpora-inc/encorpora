import { afterEach, expect, test, vi } from "vitest";
import { AppError } from "../AppError";
import {
  UNEXPECTED,
  ifNotFound,
  isAborted,
  isNotFound,
  jsonOrNull,
  messageFor,
  reportError,
  reported,
} from "../report-error";

const tracked = vi.hoisted(() => [] as unknown[]);
vi.mock("../analytics", () => ({
  screenOf: () => "other",
  trackClientError: (props: unknown) => tracked.push(props),
}));
afterEach(() => {
  tracked.length = 0;
  vi.restoreAllMocks();
});

const refused = (status: number) =>
  new AppError(
    "validation",
    "Couldn’t load the class.",
    false,
    "r-1",
    "x",
    status,
  );
const aborted = () => new DOMException("The user aborted", "AbortError");

test("a server failure is logged with what was being done and shows its own words", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const message = reportError(refused(409), {
    doing: "save the class",
    details: { classId: "c-1" },
  });
  expect(message).toBe("Couldn’t load the class.");
  expect(log).toHaveBeenCalledWith(
    "AMP couldn’t save the class",
    expect.objectContaining({ classId: "c-1", status: 409, requestId: "r-1" }),
  );
  // lib/api.ts already reports the server's and network's failures.
  expect(tracked).toEqual([]);
});

test("our own failure is logged, counted, and shown in plain words", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(reportError(new TypeError("x is undefined"), "open the roster")).toBe(
    UNEXPECTED,
  );
  expect(
    reportError(new TypeError("x"), { doing: "print", fallback: "Try again." }),
  ).toBe("Try again.");
  expect(tracked).toHaveLength(2);
  expect(tracked[0]).toMatchObject({ kind: "error", screen: "other" });
});

test("a cancelled request is no failure: nothing logged, nothing shown", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(isAborted(aborted())).toBe(true);
  expect(reportError(aborted(), "load the roster")).toBe("");
  expect(messageFor(aborted())).toBe("");
  expect(log).not.toHaveBeenCalled();
});

test("reported(…) logs, then resolves to its fallback", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await expect(
    Promise.reject(refused(503)).catch(reported("preload the roster", null)),
  ).resolves.toBeNull();
  expect(log).toHaveBeenCalledOnce();
});

test("ifNotFound(…) answers a 404 and rethrows every other failure", async () => {
  expect(isNotFound(refused(404))).toBe(true);
  expect(isNotFound(refused(403))).toBe(false);
  await expect(
    Promise.reject(refused(404)).catch(ifNotFound(null)),
  ).resolves.toBeNull();
  const failure = refused(503);
  await expect(Promise.reject(failure).catch(ifNotFound(null))).rejects.toBe(
    failure,
  );
});

test("jsonOrNull reads JSON, gives null for a body that isn't, and keeps a cancel", async () => {
  expect(await jsonOrNull(new Response('{"error":"x"}'))).toEqual({
    error: "x",
  });
  expect(await jsonOrNull(new Response("<html>"))).toBeNull();
  expect(await jsonOrNull(new Response(""))).toBeNull();
  const cancelled = new Response("{}");
  vi.spyOn(cancelled, "json").mockRejectedValue(aborted());
  await expect(jsonOrNull(cancelled)).rejects.toThrow("aborted");
});
