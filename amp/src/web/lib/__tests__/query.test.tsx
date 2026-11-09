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
import {
  clearInitialConsentChallenge,
  hasInitialConsentChallenge,
  rememberConsentChallenge,
} from "../../consent-entry";
import {
  clearOwnedPurchaseReturn,
  readOwnedPurchaseReturn,
  rememberOwnedPurchaseReturn,
  purchaseReturnSlot,
} from "../../purchase-return";
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
  clearInitialConsentChallenge();
  clearOwnedPurchaseReturn();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
test("session notifications preserve same-owner entry handoffs and erase them on signout or account switch", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(signedOut))),
  );
  const challenge = {
    requestId: "a0000000-0000-4000-8000-000000000001",
    stage: "initial" as const,
    token: "synthetic-proof",
    noticeDigest: "synthetic-notice",
  };
  const entry = {
    state: "processing" as const,
    purchaseId: challenge.requestId,
    expiresAt: Date.now() + 60_000,
  };
  queryClient.setQueryData(sessionOptions.queryKey, null);
  const onAccountExit = vi.fn(() =>
    queryClient.getQueryData(sessionOptions.queryKey),
  );
  render(
    <Providers onAccountExit={onAccountExit}>
      <p>Workspace</p>
    </Providers>,
  );
  rememberConsentChallenge(challenge, null);
  await act(async () => events.update(parent));
  expect(hasInitialConsentChallenge()).toBe(true);
  expect(onAccountExit).not.toHaveBeenCalled();
  for (const next of [null, { accountId: "parent-b", token: "other" }]) {
    queryClient.setQueryData(sessionOptions.queryKey, parent);
    rememberConsentChallenge(challenge, parent.accountId);
    rememberOwnedPurchaseReturn(parent.accountId, entry);
    sessionStorage.setItem(purchaseReturnSlot, JSON.stringify(entry));
    const exitsBefore = onAccountExit.mock.calls.length;
    await act(async () => events.update({ ...parent, token: "renewed" }));
    expect(onAccountExit).toHaveBeenCalledTimes(exitsBefore);
    expect(hasInitialConsentChallenge()).toBe(true);
    expect(readOwnedPurchaseReturn(parent.accountId)).toEqual(entry);
    expect(sessionStorage.getItem(purchaseReturnSlot)).not.toBeNull();
    await act(async () => events.update(next));
    expect(onAccountExit).toHaveBeenCalledTimes(exitsBefore + 1);
    expect(onAccountExit.mock.results.at(-1)?.value).toEqual(next);
    expect(hasInitialConsentChallenge()).toBe(false);
    expect(readOwnedPurchaseReturn(parent.accountId)).toBeNull();
    expect(sessionStorage.getItem(purchaseReturnSlot)).toBeNull();
    await act(async () => events.update(parent));
    expect(hasInitialConsentChallenge()).toBe(false);
    expect(readOwnedPurchaseReturn(parent.accountId)).toBeNull();
  }
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

test("signing out remounts an existing view even before a session notification", async () => {
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

test("late account consumers share the shell snapshot while focus and mutations refresh it", async () => {
  const { focusManager, QueryClientProvider, useQuery } =
    await import("@tanstack/react-query");
  const fetcher = vi.fn(async () => new Response(JSON.stringify(signedIn)));
  vi.stubGlobal("fetch", fetcher);
  await queryClient.fetchQuery(meOptions(parent));
  // A route chunk can finish long after the shell has loaded the account.
  const loadedAt = Date.now();
  vi.spyOn(Date, "now").mockImplementation(() => loadedAt + 10_000);
  function AccountConsumer({ enabled = true }: { enabled?: boolean }) {
    const me = useQuery({ ...meOptions(parent), enabled });
    return <p>{me.data?.signedIn ? "Account ready" : "Loading account"}</p>;
  }
  const view = render(
    <QueryClientProvider client={queryClient}>
      <AccountConsumer enabled={false} />
    </QueryClientProvider>,
  );
  view.rerender(
    <QueryClientProvider client={queryClient}>
      <AccountConsumer />
      <AccountConsumer />
    </QueryClientProvider>,
  );
  expect(screen.getAllByText("Account ready")).toHaveLength(2);
  await act(async () => {});
  expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () =>
    queryClient.invalidateQueries({ queryKey: meKey(parent.accountId) }),
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
  try {
    focusManager.setFocused(false);
    await act(async () => focusManager.setFocused(true));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  } finally {
    focusManager.setFocused(undefined);
  }
});

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
