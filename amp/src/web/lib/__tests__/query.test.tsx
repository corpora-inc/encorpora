import { afterEach, expect, test, vi } from "vitest";
import { act, render, cleanup, screen, waitFor } from "@testing-library/react";
import { Providers } from "../../app/providers";
import {
  queryClient,
  meKey,
  meOptions,
  refreshMe,
  sessionOptions,
} from "../query";
import type { AuthSession } from "../../auth";
const runtime = vi.hoisted(() => ({ nativeRuntime: false }));
vi.mock("../../native-runtime", () => runtime);
vi.mock("../../NativeGate", () => ({
  NativeGate: ({ children }: { children: import("react").ReactNode }) =>
    children,
}));
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
vi.mock("../analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../analytics")>()),
  setAnalyticsSession: vi.fn(),
}));
const parent = { token: "synthetic", accountId: "parent-a" };
const signedOut = { signedIn: false, next: "sign-in" };
afterEach(() => {
  cleanup();
  runtime.nativeRuntime = false;
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

const signedIn = {
  signedIn: true,
  account: { id: parent.accountId, email: null, emailVerified: true },
  consent: { status: "active", method: null },
  learners: [],
  family: {
    consent: {
      status: "active",
      policyVersion: null,
      recordedAt: null,
      withdrawnAt: null,
    },
    learners: [],
    retained: { identity: "", financial: "", backups: "", privacyAuditDays: 0 },
  },
  next: "add-learner",
};

test("a passive Family projection cannot replace the active canonical fetch with null", async () => {
  const { useFamilyCache } = await import("../family-cache");
  const { useQuery } = await import("@tanstack/react-query");
  const fetcher = vi
    .fn()
    .mockImplementation(async () => new Response(JSON.stringify(signedIn)));
  vi.stubGlobal("fetch", fetcher);
  queryClient.setQueryData(meKey(parent.accountId), signedIn);
  function ActiveAccount() {
    useQuery({ ...meOptions(parent), staleTime: Infinity });
    return <FamilyProjection />;
  }
  function FamilyProjection() {
    return (
      <p>
        {useFamilyCache(parent.accountId)
          ? "Family retained"
          : "Family missing"}
      </p>
    );
  }
  render(
    <Providers>
      <ActiveAccount />
    </Providers>,
  );
  await act(async () =>
    queryClient.invalidateQueries({ queryKey: ["account", parent.accountId] }),
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(queryClient.getQueryData(meKey(parent.accountId))).toEqual(signedIn);
  expect(screen.getByText("Family retained")).toBeTruthy();
});

test("session rotation refreshes the canonical account with the checked bearer before observers rerender", async () => {
  const { useFamilyCache } = await import("../family-cache");
  const { useQuery } = await import("@tanstack/react-query");
  const rotated = { ...parent, token: "rotated-synthetic" };
  const fetcher = vi.fn().mockImplementation(async (_url, init) => {
    const authorization = new Headers(init?.headers).get("Authorization");
    return new Response(
      JSON.stringify(
        authorization === `Bearer ${rotated.token}` ? signedIn : signedOut,
      ),
    );
  });
  vi.stubGlobal("fetch", fetcher);
  queryClient.setQueryData(sessionOptions.queryKey, parent);
  queryClient.setQueryData(meKey(parent.accountId), signedIn);
  function Workspace() {
    const session = useQuery(sessionOptions);
    useQuery({ ...meOptions(session.data!), staleTime: Infinity });
    return (
      <p>
        {useFamilyCache(parent.accountId)
          ? "Family retained"
          : "Family missing"}
      </p>
    );
  }
  render(
    <Providers>
      <Workspace />
    </Providers>,
  );
  await act(async () => events.update(rotated));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  expect(
    new Headers(fetcher.mock.calls[0][1].headers).get("Authorization"),
  ).toBe("Bearer rotated-synthetic");
  expect(queryClient.getQueryData(meKey(parent.accountId))).toEqual(signedIn);
  expect(screen.getByText("Family retained")).toBeTruthy();
});

test.each([null, { token: "other-synthetic", accountId: "parent-b" }])(
  "obsolete account refresh cannot restore data or display an error after identity becomes %j",
  async (next) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    let rejectOld!: (failure: Error) => void;
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              rejectOld = reject;
            }),
        )
        .mockImplementation(
          async () => new Response(JSON.stringify(signedOut)),
        ),
    );
    queryClient.setQueryData(sessionOptions.queryKey, parent);
    render(
      <Providers>
        <p>Workspace</p>
      </Providers>,
    );
    await act(async () =>
      events.update({ ...parent, token: "rotated-synthetic" }),
    );
    expect(rejectOld).toBeTypeOf("function");
    await act(async () => events.update(next));
    await act(async () => rejectOld(new Error("obsolete private failure")));
    expect(queryClient.getQueryData(meKey(parent.accountId))).toBeUndefined();
    expect(queryClient.getQueryData(sessionOptions.queryKey)).toEqual(next);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(log).not.toHaveBeenCalled();
  },
);

test("native session notifications retain native Family observation and do not fetch web /me", async () => {
  const { useFamilyCache, setNativeFamilySnapshot } =
    await import("../family-cache");
  runtime.nativeRuntime = true;
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const invalidation = vi.spyOn(queryClient, "invalidateQueries");
  queryClient.setQueryData(sessionOptions.queryKey, parent);
  function NativeFamily() {
    return (
      <p>
        {useFamilyCache(parent.accountId)
          ? "Native family"
          : "No native family"}
      </p>
    );
  }
  render(
    <Providers>
      <NativeFamily />
    </Providers>,
  );
  await act(async () =>
    setNativeFamilySnapshot(
      parent.accountId,
      signedIn.family as import("../../../family/contracts").FamilySummary,
    ),
  );
  expect(await screen.findByText("Native family")).toBeTruthy();
  await act(async () => events.update({ ...parent, token: "rotated-native" }));
  expect(invalidation).toHaveBeenCalledWith({
    queryKey: ["account", parent.accountId],
  });
  expect(fetcher).not.toHaveBeenCalled();
  expect(await screen.findByText("Native family")).toBeTruthy();
  expect(
    queryClient
      .getQueryCache()
      .find({ queryKey: ["native-family", parent.accountId] })
      ?.getObserversCount(),
  ).toBe(1);
});

test("Family cache notifications do not update another component during a render", async () => {
  const { useFamilyCache } = await import("../family-cache");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  queryClient.setQueryData(meKey(parent.accountId), signedIn);
  function Projection() {
    return (
      <p>
        {useFamilyCache(parent.accountId)
          ? "Family retained"
          : "Family missing"}
      </p>
    );
  }
  function AccountTransition({ changed }: { changed: boolean }) {
    if (changed) queryClient.setQueryData(meKey(parent.accountId), signedOut);
    return null;
  }
  const view = render(
    <Providers>
      <Projection />
      <AccountTransition changed={false} />
    </Providers>,
  );
  view.rerender(
    <Providers>
      <Projection />
      <AccountTransition changed />
    </Providers>,
  );
  expect(await screen.findByText("Family missing")).toBeTruthy();
  expect(log).not.toHaveBeenCalled();
});
