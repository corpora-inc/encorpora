import { afterEach, expect, test, vi } from "vitest";
import { act, render, cleanup, screen } from "@testing-library/react";
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
  failure: (_message: string) => {},
}));
vi.mock("../../auth", () => ({
  accessSession: vi.fn(),
  onSessionChanged: (
    update: typeof events.update,
    failure: typeof events.failure,
  ) => {
    events.failure = failure;
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
  vi.restoreAllMocks();
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

test("session-check failures preserve the workspace and show a safe logged error", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  render(
    <Providers>
      <h1>Family workspace</h1>
    </Providers>,
  );
  act(() => events.failure("private transport details"));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Your sign-in could not be checked. Refresh to try again.",
  );
  expect(
    screen.getByRole("heading", { name: "Family workspace" }),
  ).toBeTruthy();
  expect(log).toHaveBeenCalledWith(
    "AMP action failed",
    expect.objectContaining({
      kind: "authentication",
      message: "Your sign-in could not be checked. Refresh to try again.",
    }),
  );
  expect(JSON.stringify(log.mock.calls)).not.toContain("private transport");
});

test("privacy invalidation clears mounted disabled Family observers despite a failed refresh", async () => {
  const { useFamilyCache } = await import("../family-cache");
  const { QueryClientProvider } = await import("@tanstack/react-query");
  function FamilyObserver() {
    const family = useFamilyCache(parent.accountId);
    return <p>{family ? "Cached learning access" : "No learning access"}</p>;
  }
  queryClient.setQueryData(meKey(parent.accountId), {
    signedIn: true,
    family: { consent: { status: "active" }, learners: [] },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <FamilyObserver />
    </QueryClientProvider>,
  );
  expect(screen.getByText("Cached learning access")).toBeTruthy();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("{}", { status: 503 })),
  );
  await act(async () => {
    await queryClient.resetQueries({
      queryKey: meKey(parent.accountId),
      exact: true,
    });
    await expect(refreshMe(parent)).rejects.toThrow();
  });
  expect(await screen.findByText("No learning access")).toBeTruthy();
  expect(queryClient.getQueryData(meKey(parent.accountId))).toBeUndefined();
});

test("switching accounts unmounts the old trial view and clears its observed data", async () => {
  const { useQuery } = await import("@tanstack/react-query");
  queryClient.setQueryData(sessionOptions.queryKey, parent);
  queryClient.setQueryData(["trial", "session"], { learnerId: "old-learner" });
  function TrialView() {
    const trial = useQuery({
      queryKey: ["trial", "session"],
      queryFn: async () => null,
      enabled: false,
    });
    return (
      <div>
        {(trial.data as { learnerId?: string } | null)?.learnerId ?? "No trial"}
      </div>
    );
  }
  render(
    <Providers>
      <TrialView />
    </Providers>,
  );
  expect(screen.getByText("old-learner")).toBeTruthy();
  await act(async () =>
    events.update({ token: "other", accountId: "parent-b" }),
  );
  expect(screen.queryByText("old-learner")).toBeNull();
  expect(screen.getByText("No trial")).toBeTruthy();
});

test("signing out remounts an existing trial view even before a session notification", async () => {
  const { useState } = await import("react");
  queryClient.setQueryData(sessionOptions.queryKey, parent);
  function TrialView() {
    const [owner] = useState(
      () => queryClient.getQueryData(sessionOptions.queryKey)?.accountId,
    );
    return <div>{owner ?? "Signed out"}</div>;
  }
  render(
    <Providers>
      <TrialView />
    </Providers>,
  );
  expect(screen.getByText("parent-a")).toBeTruthy();
  await act(async () => events.update(null));
  expect(screen.queryByText("parent-a")).toBeNull();
  expect(screen.getByText("Signed out")).toBeTruthy();
});
