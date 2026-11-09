import { afterEach, expect, test, vi } from "vitest";
import { createElement, type PropsWithChildren } from "react";
import { cleanup, renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  answer,
  skip,
  progressOptions,
  trialSessionOptions,
  type TrialProgress,
} from "../../features/trial/api";
import { queryClient, sessionOptions } from "../query";
import { useLearningView } from "../learning-view";

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/try/practice" }),
  useSearch: () => ({}),
}));

const session = { token: "synthetic-trial", learnerId: "trial-learner" };
const progress = (answered: number): TrialProgress => ({
  phase: "placement",
  free: 100,
  placement: 10,
  remaining: 100 - answered,
  totals: { answered, correct: answered, assisted: 0 },
  mastered: [],
  trend: [],
  frontier: {
    placement: null,
    current: {
      expected: 4,
      overall: { level: 4, sd: 1, answered, independent: answered },
      strands: {},
    },
  },
});
const outcome = {
  id: "attempt",
  problemId: "problem",
  requestId: "request",
  skillId: "skill",
  templateId: "template",
  correct: true,
  assisted: false,
  answer: "1",
  response: "1",
  explanation: [],
  createdAt: "2026-01-01T00:00:00.000Z",
};

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
});

test.each(["answer", "skip"])(
  "%s prevents a delayed pre-answer progress read from restoring zero answers",
  async (kind) => {
    const options = progressOptions(session);
    queryClient.setQueryData(options.queryKey, progress(0));
    const otherKey = ["trial", "other-learner", "progress"];
    queryClient.setQueryData(otherKey, progress(7));
    let release!: (response: Response) => void;
    const held = new Promise<Response>((resolve) => (release = resolve));
    let reads = 0;
    let oldSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init: RequestInit) => {
        if (url.endsWith("/trial-progress")) {
          reads++;
          if (reads === 1) {
            oldSignal = init.signal ?? undefined;
            return held;
          }
          return Promise.resolve(new Response(JSON.stringify(progress(1))));
        }
        return Promise.resolve(new Response(JSON.stringify(outcome)));
      }),
    );
    // The stale response is already in flight when the answer is recorded.
    const previous = queryClient.fetchQuery(options).catch(() => undefined);
    await vi.waitFor(() => expect(reads).toBe(1));
    if (kind === "answer")
      await answer(session, {
        problemId: "problem",
        requestId: "request",
        response: "1",
      });
    else await skip(session, "problem");
    release(new Response(JSON.stringify(progress(0))));
    await previous;
    expect(oldSignal?.aborted).toBe(true);
    expect(queryClient.getQueryState(options.queryKey)?.isInvalidated).toBe(
      true,
    );
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false);
    const current = await queryClient.fetchQuery({
      ...options,
      staleTime: 2_000,
    });
    expect(current.totals.answered).toBe(1);
    expect(reads).toBe(2);
  },
);

test.each(["answer", "skip"])(
  "%s refreshes progress after a lost response that may have committed",
  async (kind) => {
    const options = progressOptions(session);
    queryClient.setQueryData(options.queryKey, progress(0));
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url.endsWith("/trial-progress")
          ? Promise.resolve(new Response(JSON.stringify(progress(1))))
          : Promise.reject(new TypeError("Network response lost")),
      ),
    );
    const mutation =
      kind === "answer"
        ? answer(session, {
            problemId: "problem",
            requestId: "request",
            response: "1",
          })
        : skip(session, "problem");
    await expect(mutation).rejects.toThrow();
    const current = await queryClient.fetchQuery({
      ...options,
      staleTime: 2_000,
    });
    expect(current.totals.answered).toBe(1);
  },
);

test.each([true, false])(
  "opening the drawer does not read trial progress (cached=%s)",
  async (cached) => {
    queryClient.setQueryData(sessionOptions.queryKey, null);
    queryClient.setQueryData(trialSessionOptions.queryKey, session);
    const options = progressOptions(session);
    if (cached) {
      queryClient.setQueryData(options.queryKey, progress(0));
      await queryClient.invalidateQueries({ queryKey: options.queryKey });
    }
    const fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(progress(1)))),
    );
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useLearningView({ records: false }), {
      wrapper: ({ children }: PropsWithChildren) =>
        createElement(QueryClientProvider, { client: queryClient }, children),
    });
    expect(result.current.trialMode).toBe(true);
    expect(result.current.trialProgress?.totals.answered).toBe(
      cached ? 0 : undefined,
    );
    expect(fetch).not.toHaveBeenCalled();
  },
);
