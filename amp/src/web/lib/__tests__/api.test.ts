import { afterEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { failureAreas, failureMessage, request } from "../api";
import { AppError } from "../AppError";
afterEach(() => vi.restoreAllMocks());
test("validates a successful response rather than trusting JSON", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 7 }))),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  await expect(
    request("/me", z.object({ id: z.string() })),
  ).rejects.toMatchObject({ kind: "contract", retry: true });
});
test("logs a specific safe error with request id, never response bodies", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "consent_required",
          token: "private-fixture",
        }),
        { status: 403, headers: { "x-request-id": "fixture-request" } },
      ),
    ),
  );
  await expect(
    request("/learners", z.unknown(), {
      body: { name: "Private child" },
      token: "private-bearer",
    }),
  ).rejects.toBeInstanceOf(AppError);
  expect(log).toHaveBeenCalledWith("AMP action failed", {
    kind: "permission",
    message: "Continue setup to review parent consent.",
    requestId: "fixture-request",
    code: "consent_required",
  });
  expect(JSON.stringify(log.mock.calls)).not.toContain("private");
});

test("a failure without a known code names what failed", () => {
  expect(failureMessage("/billing/prices", "GET", 400)).toBe(
    "Couldn’t load the plans. Try again.",
  );
  expect(failureMessage("/family/learners/x/rename", "POST", 422)).toBe(
    "Couldn’t save the family change. Check what you entered, then try again.",
  );
  expect(failureMessage("/learners/x/workbooks", "GET", 503)).toBe(
    "Couldn’t load the workbooks. Try again in a moment.",
  );
  expect(failureMessage("/learners/x/workbooks/y/results", "POST", 500)).toBe(
    "Couldn’t save the results. Try again in a moment.",
  );
  expect(failureMessage("/somewhere", "GET", 503)).toBe(
    "Couldn’t load this page. Try again in a moment.",
  );
  for (const status of [400, 404, 409, 500])
    expect(failureMessage("/anything", "POST", status)).not.toMatch(
      /could not be completed/,
    );
});

/** A path each area's pattern matches: its literal source, with one
 * segment for each id and the first of each alternation. */
const sampleOf = (path: RegExp) =>
  path.source
    .replace(/^\^/, "")
    .replace(/\(\/\|\$\)$/, "/")
    .replace(/\[\^\/\]\+/g, "x")
    .replace(/\(([^|)]+)[^)]*\)/g, "$1")
    .replace(/\\\//g, "/");
/** Every area's sentences: reads and changes, client and server failures. */
const sentences = failureAreas.flatMap((area) =>
  ["GET", "POST", "PATCH", "DELETE"].flatMap((method) =>
    [400, 403, 404, 409, 422, 500, 502, 503].map((status) => ({
      area,
      method,
      text: failureMessage(sampleOf(area.path), method, status),
    })),
  ),
);

test("each area's own path finds its own sentence", () => {
  for (const area of failureAreas) {
    const sample = sampleOf(area.path);
    expect(failureAreas.find(({ path }) => path.test(sample))).toBe(area);
  }
  for (const { area, method, text } of sentences)
    expect(text).toContain(method === "GET" ? area.load : area.change);
});

test("every failure sentence is plain, specific grammar", () => {
  for (const { load, change } of failureAreas) {
    // Written to follow "Couldn’t load" and "Couldn’t": lower case, no
    // verb of their own to agree with, no closing punctuation.
    for (const part of [load, change]) {
      expect(part).toMatch(/^[a-z]/);
      expect(part).not.toMatch(/[.!?]$/);
      expect(part).not.toMatch(/\b(is|are|isn’t|aren’t|was|were)\b/);
    }
    expect(change).toMatch(
      /^(choose|check|open|save|send|start|finish|make|activate)\b/,
    );
  }
  for (const { text } of sentences) {
    expect(text).toMatch(/^Couldn’t (load )?[a-z]/);
    expect(text).toMatch(
      /\.( Try again( in a moment)?\.| Check what you entered, then try again\.)$/,
    );
    expect(text).not.toMatch(/isn['’]t available|didn['’]t load|  |\.\./);
  }
});
