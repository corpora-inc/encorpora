// @vitest-environment jsdom
import { QueryClient } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";

const auth = vi.hoisted(() => ({ accessSession: vi.fn() }));
vi.mock("../../auth", () => ({
  ...auth,
  authConfig: vi.fn(),
  onSessionChanged: () => () => {},
}));
import { sessionOptions } from "../query";
import { signedInHint } from "../session-hint";

afterEach(() => localStorage.clear());
const check = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } }).fetchQuery(
    { ...sessionOptions, retry: false },
  );

// `/` starts the app at once for a returning account (home-entry.tsx).
test("each session check leaves the hint `/` starts with", async () => {
  auth.accessSession.mockResolvedValueOnce({
    token: "synthetic",
    accountId: "amp|parent",
  });
  await check();
  expect(signedInHint()).toBe(true);
  auth.accessSession.mockResolvedValueOnce(null);
  await check();
  expect(signedInHint()).toBe(false);
});

test("refused storage leaves no hint and no error", () => {
  const refuse = vi
    .spyOn(Storage.prototype, "getItem")
    .mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
  expect(signedInHint()).toBe(false);
  refuse.mockRestore();
});
