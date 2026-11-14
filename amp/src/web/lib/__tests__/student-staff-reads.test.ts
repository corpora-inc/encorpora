import { afterEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { request } from "../api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("a handed device's student session never asks a staff route", async () => {
  // "Let Wren practice here": Today, still mounted for a moment, reads again
  // with the child's token. Those reads would be refused and logged as a
  // session that ended; they wait for the screen to go instead.
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const said = vi.spyOn(console, "error").mockImplementation(() => {});
  const leaving = new AbortController();
  const read = request("/school/orgs/org-1", z.unknown(), {
    token: "st_child",
    signal: leaving.signal,
  });
  leaving.abort();
  await expect(read).rejects.toBeDefined();
  expect(fetch).not.toHaveBeenCalled();
  expect(said).not.toHaveBeenCalled();
});

test("a student's own routes are asked as usual", async () => {
  const fetch = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ boards: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
  vi.stubGlobal("fetch", fetch);
  await request("/school/student/standings", z.unknown(), {
    token: "st_child",
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});
