import { afterEach, expect, test, vi } from "vitest";
import { act, render, cleanup } from "@testing-library/react";
import { Providers } from "../../app/providers";
import {
  queryClient,
  meKey,
  meOptions,
  refreshMe,
  sessionOptions,
} from "../query";
import type { AuthSession } from "../../auth";
const events = vi.hoisted(() => ({
  update: (_session: AuthSession | null) => {},
}));
vi.mock("../../auth", () => ({
  accessSession: vi.fn(),
  onSessionChanged: (update: typeof events.update) => {
    events.update = update;
    return () => {};
  },
}));
const parent = { token: "synthetic", accountId: "parent-a" };
const signedOut = { signedIn: false, next: "sign-in" };
afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
});
test("a mutation refresh cancels the old response before it can overwrite the canonical snapshot", async () => {
  let release!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(signedOut))),
  );
  const old = queryClient.fetchQuery(meOptions(parent)).catch(() => null);
  await refreshMe(parent);
  release(new Response(JSON.stringify({ invalid: "obsolete response" })));
  await old;
  expect(queryClient.getQueryData(meKey(parent.accountId))).toEqual(signedOut);
});
test("an account switch removes and cancels the previous account's cached/in-flight state", async () => {
  queryClient.setQueryData(sessionOptions.queryKey, parent);
  let release!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    ),
  );
  const old = queryClient.fetchQuery(meOptions(parent)).catch(() => null);
  render(
    <Providers>
      <p>Workspace</p>
    </Providers>,
  );
  act(() => events.update({ token: "new-synthetic", accountId: "parent-b" }));
  release(new Response(JSON.stringify(signedOut)));
  await old;
  expect(queryClient.getQueryData(meKey(parent.accountId))).toBeUndefined();
  expect(queryClient.getQueryData(sessionOptions.queryKey)?.accountId).toBe(
    "parent-b",
  );
});
