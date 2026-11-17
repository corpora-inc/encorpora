import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test } from "vitest";
import {
  currentLearner,
  selectLearner,
  useCurrentLearner,
  useLearnerStore,
} from "../../learner-store";
import { queryClient } from "../query-client";
import { qk } from "../keys";

const parent = { accountId: "amp|parent", token: "a" };
const other = { accountId: "amp|other", token: "b" };
const student = { accountId: "school:student", token: "st_c" };
const signIn = (session: typeof parent | null) =>
  queryClient.setQueryData(qk.session(), session);
const saved = () => JSON.parse(localStorage.getItem("amp.learner") ?? "null");

beforeEach(() => {
  localStorage.clear();
  useLearnerStore.setState({ learners: {} });
  signIn(null);
});
afterEach(() => {
  cleanup();
  queryClient.clear();
});

test("each account has its own current learner", () => {
  selectLearner("pip", parent.accountId);
  selectLearner("wren", other.accountId);
  expect(currentLearner(parent.accountId)).toBe("pip");
  expect(currentLearner(other.accountId)).toBe("wren");
  selectLearner(null, parent.accountId);
  expect(currentLearner(parent.accountId)).toBeNull();
  expect(currentLearner(other.accountId)).toBe("wren");
});

test("a choice is the signed-in account's, and another account never sees it", () => {
  signIn(parent);
  selectLearner("pip");
  expect(currentLearner()).toBe("pip");
  signIn(other);
  expect(currentLearner()).toBeNull();
  selectLearner("wren");
  signIn(parent);
  expect(currentLearner()).toBe("pip");
  // Signed out, nobody is current and nothing is written.
  signIn(null);
  selectLearner("stray");
  expect(currentLearner()).toBeNull();
  expect(useLearnerStore.getState().learners).toEqual({
    [parent.accountId]: "pip",
    [other.accountId]: "wren",
  });
});

test("useCurrentLearner follows the session to its own account's learner", async () => {
  signIn(parent);
  selectLearner("pip");
  const hook = renderHook(() => useCurrentLearner(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
  expect(hook.result.current).toBe("pip");
  // The Query cache tells its observers on the next tick.
  act(() => signIn(other));
  await waitFor(() => expect(hook.result.current).toBeNull());
  act(() => selectLearner("wren"));
  expect(hook.result.current).toBe("wren");
  act(() => signIn(parent));
  await waitFor(() => expect(hook.result.current).toBe("pip"));
});

test("an unkeyed choice from before (version 1) belongs to nobody", async () => {
  localStorage.setItem(
    "amp.learner",
    JSON.stringify({
      state: { learnerId: "another-account-learner" },
      version: 1,
    }),
  );
  await useLearnerStore.persist.rehydrate();
  signIn(parent);
  expect(currentLearner()).toBeNull();
  expect(useLearnerStore.getState().learners).toEqual({});
});

test("choices persist by account; a school student's stays in memory", async () => {
  selectLearner("pip", parent.accountId);
  selectLearner("ada", student.accountId);
  expect(currentLearner(student.accountId)).toBe("ada");
  expect(saved()).toEqual({
    state: { learners: { [parent.accountId]: "pip" } },
    version: 2,
  });
  // A new page: memory is empty, storage holds what was kept.
  const stored = localStorage.getItem("amp.learner")!;
  useLearnerStore.setState({ learners: {} });
  localStorage.setItem("amp.learner", stored);
  await useLearnerStore.persist.rehydrate();
  expect(currentLearner(parent.accountId)).toBe("pip");
  expect(currentLearner(student.accountId)).toBeNull();
});
