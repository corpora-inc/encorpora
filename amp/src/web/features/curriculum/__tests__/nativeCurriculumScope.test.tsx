import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, sessionOptions } from "../../../lib/query";
import { setNativeFamilySnapshot } from "../../../lib/family-cache";
import { useLearnerStore } from "../../../learner-store";
import { useCurriculumScope } from "../useCurriculumScope";
import type { FamilySummary } from "../../../../family/contracts";
import { accessSession } from "../../../auth";
vi.mock("../../../native-runtime", () => ({ nativeRuntime: true }));
vi.mock("../../../auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../auth")>()),
  accessSession: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/" }),
  useSearch: () => ({}),
}));
const family = (ids: string[]): FamilySummary => ({
  consent: {
    status: "active",
    policyVersion: "fixture",
    recordedAt: null,
    withdrawnAt: null,
  },
  learners: ids.map((id) => ({
    id,
    name: id,
    deletedAt: null,
    access: [],
    stripeLinked: false,
  })),
  retained: { identity: "", financial: "", backups: "", privacyAuditDays: 0 },
});
function Scope() {
  const scope = useCurriculumScope();
  return <output>{JSON.stringify(scope)}</output>;
}
function expectScope(scope: string, ready: boolean) {
  expect(screen.getByRole("status").textContent).toBe(
    JSON.stringify({ scope, ready }),
  );
}
afterEach(() => {
  cleanup();
  queryClient.clear();
  useLearnerStore.getState().select(null);
  vi.unstubAllGlobals();
  vi.mocked(accessSession).mockReset();
});
test("pending native session cannot use a cached family's curriculum scope", async () => {
  const fetch = vi.fn(() => {
    throw Error("Native must not fetch browser APIs");
  });
  vi.stubGlobal("fetch", fetch);
  let finish!: (value: null) => void;
  vi.mocked(accessSession).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  setNativeFamilySnapshot("parent-a", family(["old"]));
  useLearnerStore.getState().select("old");
  render(
    <QueryClientProvider client={queryClient}>
      <Scope />
    </QueryClientProvider>,
  );
  expectScope("pending", false);
  expect(accessSession).toHaveBeenCalledOnce();
  await act(async () => {
    finish(null);
  });
  expectScope("pending", false);
  expect(fetch).not.toHaveBeenCalled();
});
test("native curriculum identity uses bridge family snapshots without browser API requests", async () => {
  const fetch = vi.fn(() => {
    throw Error("Native must not fetch browser APIs");
  });
  vi.stubGlobal("fetch", fetch);
  const parentA = { accountId: "parent-a", token: "opaque-handle" };
  queryClient.setQueryData(sessionOptions.queryKey, parentA);
  useLearnerStore.getState().select("second");
  render(
    <QueryClientProvider client={queryClient}>
      <Scope />
    </QueryClientProvider>,
  );
  expectScope("pending", false);
  act(() => setNativeFamilySnapshot("parent-a", family(["first", "second"])));
  await waitFor(() => expectScope("account:parent-a:second", true));
  act(() => useLearnerStore.getState().select("foreign"));
  await waitFor(() => expectScope("account:parent-a:first", true));
  const parentB = { accountId: "parent-b", token: "other-handle" };
  act(() => queryClient.setQueryData(sessionOptions.queryKey, parentB));
  await waitFor(() => expectScope("pending", false));
  act(() => setNativeFamilySnapshot("parent-b", family(["other"])));
  await waitFor(() => expectScope("account:parent-b:other", true));
  await act(async () => {
    await queryClient
      .fetchQuery({
        ...sessionOptions,
        staleTime: 0,
        queryFn: async () => {
          throw Error("Native session check failed");
        },
      })
      .catch(() => {});
  });
  await waitFor(() => expectScope("pending", false));
  act(() => queryClient.setQueryData(sessionOptions.queryKey, null));
  await waitFor(() => expectScope("pending", false));
  expect(fetch).not.toHaveBeenCalled();
});
test("deleted native learners cannot reveal curriculum preferences", async () => {
  const fetch = vi.fn(() => {
    throw Error("Native must not fetch browser APIs");
  });
  vi.stubGlobal("fetch", fetch);
  const parent = { accountId: "parent", token: "opaque-handle" };
  queryClient.setQueryData(sessionOptions.queryKey, parent);
  const snapshot = family(["deleted"]);
  snapshot.learners[0]!.deletedAt = "2026-01-01T00:00:00Z";
  setNativeFamilySnapshot("parent", snapshot);
  render(
    <QueryClientProvider client={queryClient}>
      <Scope />
    </QueryClientProvider>,
  );
  expectScope("pending", false);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(fetch).not.toHaveBeenCalled();
});
