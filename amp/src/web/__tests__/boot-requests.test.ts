import { afterEach, expect, test, vi } from "vitest";

const calls = vi.hoisted(() => ({ order: [] as string[] }));
vi.mock("../account-client", () => ({
  accountClient: {
    getSession: vi.fn(async () => {
      calls.order.push("get-session");
      return { data: null, error: null };
    }),
  },
}));
import { accessSession } from "../auth";

afterEach(() => {
  calls.order = [];
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// A first screen waits on both. The session check used to start only after
// the sign-in configuration answered: two round trips in a row on every
// cold load, about 0.3 to 1 s on a phone's network.
test("the session check starts without waiting for the sign-in configuration", async () => {
  let answer!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      calls.order.push(String(url));
      return new Promise<Response>((resolve) => (answer = resolve));
    }),
  );
  const session = accessSession();
  await vi.waitFor(() => expect(calls.order).toContain("get-session"));
  // Both are in flight before the configuration has answered.
  expect([...calls.order].sort()).toEqual([
    "/api/v1/auth-config",
    "get-session",
  ]);
  answer(Response.json({ mode: "accounts", passwords: true, providers: [] }));
  await expect(session).resolves.toBeNull();
});

// Production, 2026-11-17: a failed sign-in configuration failed the session
// check with it, so `/` showed a full-screen error instead of the pitch.
// Whether someone is signed in doesn't depend on the sign-in methods.
test("the session check doesn't need the sign-in configuration", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }),
  );
  // A production build (development builds fall back to development
  // sign-in), on a fresh page: the first test's configuration is not kept.
  vi.stubEnv("DEV", false);
  vi.resetModules();
  const fresh = await import("../auth");
  await expect(fresh.accessSession()).resolves.toBeNull();
  expect(calls.order).toContain("get-session");
});
