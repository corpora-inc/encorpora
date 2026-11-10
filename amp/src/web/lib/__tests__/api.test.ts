import { afterEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { failureMessage, request } from "../api";
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
    "The plans didn’t load. Try again.",
  );
  expect(failureMessage("/family/learners/x/rename", "POST", 422)).toBe(
    "The family change didn’t go through. Check what you entered, then try again.",
  );
  expect(failureMessage("/somewhere", "GET", 503)).toBe(
    "This page isn’t available right now. Try again in a moment.",
  );
  for (const status of [400, 404, 409, 500])
    expect(failureMessage("/anything", "POST", status)).not.toMatch(
      /could not be completed/,
    );
});
