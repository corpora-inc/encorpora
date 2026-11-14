import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, expect, test, vi } from "vitest";
import type { WorkbookSummary } from "../../../../workbook/contracts";
import type { AuthSession } from "../../../auth";
import { AppError } from "../../../lib/AppError";
import {
  awaitingResults,
  HISTORY_PATIENCE_MS,
  historyRetry,
  historyTooSlow,
} from "../api";
import { WorkbookHistory } from "../WorkbookHistoryScreen";
import type { WorkbookLearner } from "../WorkbookFrame";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const session = { accountId: "account-1", token: "token-1" } as AuthSession;
const learner: WorkbookLearner = {
  id: "learner-1",
  name: "Rowan",
  canPractice: true,
  pauseViewer: "adult",
};
const workbook = (entered?: number): WorkbookSummary => ({
  id: `wb-${entered ?? "x"}`,
  date: "2026-11-13",
  number: 1,
  minutes: 30,
  paper: "letter",
  code: "ABCD-EFGH",
  createdAt: "2026-11-13T12:00:00.000Z",
  estimatedMinutes: 28,
  choices: { areas: [], lean: "level", lesson: true },
  problems: 20,
  ...(entered === undefined ? {} : { entered }),
  sections: [],
});

/** The screen over a history the test answers (or holds). */
function renderHistory(answer: () => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(answer));
  const client = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0 } },
  });
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => <WorkbookHistory session={session} learner={learner} />,
    }),
    history: createMemoryHistory({
      initialEntries: ["/learners/learner-1/workbooks"],
    }),
  });
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));
const codeButton = () =>
  screen.queryByRole("button", { name: "Enter results with a code" });

test("no workbooks yet: a designed empty state with its one way to make one, never an error", async () => {
  renderHistory(() => json({ workbooks: [], pdf: false }));
  expect(
    await screen.findByRole("heading", { name: "No workbooks yet" }),
  ).toBeTruthy();
  const make = screen.getAllByRole("link", { name: /workbook/ });
  expect(make.map((link) => link.textContent)).toEqual(["Make a workbook"]);
  expect(codeButton()).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByText("Past workbooks")).toBeNull();
});

test("results by code are offered while a workbook waits for them", async () => {
  renderHistory(() =>
    json({ workbooks: [workbook(20), workbook(3)], pdf: false }),
  );
  expect(await screen.findByRole("list", { name: "Workbooks" })).toBeTruthy();
  expect(codeButton()).toBeTruthy();
  expect(screen.getByRole("link", { name: "Today’s workbook" })).toBeTruthy();
});

test("every workbook entered: no code entry, and each row reads its results", async () => {
  renderHistory(() => json({ workbooks: [workbook(20)], pdf: false }));
  expect(
    await screen.findByRole("link", { name: /^See results for workbook/ }),
  ).toBeTruthy();
  expect(codeButton()).toBeNull();
});

test("a server that doesn't count entries keeps every workbook waiting", () => {
  expect(awaitingResults([workbook()])).toBe(true);
  expect(awaitingResults([workbook(20)])).toBe(false);
  expect(awaitingResults([])).toBe(false);
});

test("a failing first read is asked again quietly, then said plainly", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  let calls = 0;
  renderHistory(() => {
    calls++;
    return json({ error: "Internal Server Error" }, 503);
  });
  const alert = await screen.findByRole("alert", undefined, { timeout: 3000 });
  expect(calls).toBe(3);
  expect(alert.textContent).toContain(
    "Couldn’t load the workbooks. Try again in a moment.",
  );
  expect(alert.textContent).not.toMatch(/isn['’]t available/);
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
});

test("a slow read waits as the skeleton, then says so calmly", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  // AbortSignal.timeout runs on the real clock: stand in for it.
  const timeouts: AbortController[] = [];
  vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
    const controller = new AbortController();
    timeouts.push(controller);
    return controller.signal;
  });
  const { container } = renderHistory(
    () =>
      new Promise((_, reject) => {
        const signal = (vi.mocked(fetch).mock.lastCall?.[1] as RequestInit)
          .signal!;
        signal.addEventListener("abort", () => reject(signal.reason));
      }),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10);
  });
  expect(container.querySelector(".amp-skeleton")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
  await act(async () => {
    timeouts.at(-1)!.abort(new DOMException("timed out", "TimeoutError"));
    await vi.advanceTimersByTimeAsync(10);
  });
  expect(screen.getByRole("alert").textContent).toContain(
    "Your workbooks are taking longer than usual. Try again in a moment.",
  );
  expect(HISTORY_PATIENCE_MS).toBeGreaterThanOrEqual(10_000);
});

test("only failures that may recover are asked again, and never a timeout", () => {
  const unavailable = new AppError("unavailable", "x", true);
  expect(historyRetry(0, unavailable)).toBe(true);
  expect(historyRetry(2, unavailable)).toBe(false);
  expect(historyRetry(0, new AppError("validation", "x", false))).toBe(false);
  expect(historyRetry(0, historyTooSlow())).toBe(false);
});
