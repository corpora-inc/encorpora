import { afterEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { request } from "../api";
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
