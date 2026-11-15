import { afterEach, expect, test, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

const auth = vi.hoisted(() => ({
  accessSession: vi.fn(),
  authConfig: vi.fn(),
}));
vi.mock("../../auth", () => ({
  ...auth,
  onSessionChanged: () => () => {},
}));
vi.mock("../analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../analytics")>()),
  setAnalyticsSession: vi.fn(),
}));
import { authConfigOptions, sessionOptions } from "../query";

afterEach(() => vi.clearAllMocks());
const client = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

// Production, 2026-11-15: a phone that lost the one boot request for the
// sign-in configuration got the error screen at `/` instead of the pitch.
// The two checks every first screen waits on ask once more before failing.
test("the boot session check asks once more after a lost request", async () => {
  auth.accessSession
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce(null);
  await expect(client().ensureQueryData(sessionOptions)).resolves.toBeNull();
  expect(auth.accessSession).toHaveBeenCalledTimes(2);
});

test("the sign-in configuration asks once more after a lost request", async () => {
  const config = { mode: "accounts", passwords: true, providers: [] };
  auth.authConfig
    .mockRejectedValueOnce(new Error("auth-config 503"))
    .mockResolvedValueOnce(config);
  await expect(client().ensureQueryData(authConfigOptions)).resolves.toEqual(
    config,
  );
  expect(auth.authConfig).toHaveBeenCalledTimes(2);
});

test("a second failure still reaches the screen's error state", async () => {
  auth.accessSession.mockRejectedValue(new TypeError("Failed to fetch"));
  await expect(client().ensureQueryData(sessionOptions)).rejects.toThrow(
    "Failed to fetch",
  );
  expect(auth.accessSession).toHaveBeenCalledTimes(2);
});
