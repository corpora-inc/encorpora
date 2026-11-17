import { afterEach, expect, test, vi } from "vitest";
import { Suspense } from "react";
import { QueryClientProvider, skipToken } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { meOptions, queryClient, sessionOptions } from "../query";
import { qk } from "../keys";
import { LEAVE_MS, forSession, useSession, useSessionOrNull } from "../session";
import type { AuthSession } from "../../auth";

const parent: AuthSession = { accountId: "a-1", token: "t-1" };
afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.useRealTimers();
});

function Signed() {
  return <p>{useSession().accountId}</p>;
}
function Public() {
  return <p>{useSessionOrNull()?.accountId ?? "signed out"}</p>;
}
const shown = (node: React.ReactNode) =>
  render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>leaving</p>}>{node}</Suspense>
    </QueryClientProvider>,
  );

test("both hooks read the session from the canonical cache", () => {
  queryClient.setQueryData(sessionOptions.queryKey, parent);
  shown(
    <>
      <Signed />
      <Public />
    </>,
  );
  expect(screen.getAllByText("a-1")).toHaveLength(2);
});

test("a public screen reads null while signed out", () => {
  queryClient.setQueryData(sessionOptions.queryKey, null);
  shown(<Public />);
  expect(screen.getByText("signed out")).toBeTruthy();
});

test("a signed-in screen holds still while the page leaves for sign-in", async () => {
  queryClient.setQueryData(sessionOptions.queryKey, parent);
  shown(<Signed />);
  act(() => queryClient.setQueryData(sessionOptions.queryKey, null));
  expect(await screen.findByText("leaving")).toBeTruthy();
  // React keeps the screen, hidden, behind its pending fallback.
  expect(screen.getByText("a-1").style.display).toBe("none");
  expect(LEAVE_MS).toBeGreaterThan(0);
});

test("forSession asks nothing while signed out, without a stand-in session", () => {
  const out = forSession(null, meOptions);
  expect(out.queryFn).toBe(skipToken);
  const signedIn = forSession(parent, meOptions);
  expect(signedIn.queryKey).toEqual(qk.me("a-1"));
  expect(signedIn.queryFn).not.toBe(skipToken);
});
