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
