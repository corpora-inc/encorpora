import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { StepFrame } from "../setup/StepFrame";

const state = vi.hoisted(() => ({
  search: {} as Record<string, unknown>,
  closed: [] as string[],
}));
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({}),
  useLocation: ({ select }: { select: (l: unknown) => unknown }) =>
    select({ search: state.search }),
  Link: ({ children }: { children: ReactNode }) => (
    <a href="/back">{children}</a>
  ),
}));
vi.mock("../../../lib/return-to", async (actual) => ({
  ...(await actual<typeof import("../../../lib/return-to")>()),
  closeTo: (_router: unknown, to: string) => state.closed.push(to),
}));
afterEach(() => {
  cleanup();
  state.closed = [];
});
const step = () =>
  render(
    <StepFrame
      steps={[{ id: "", label: "One" }]}
      index={0}
      title="Step"
      back="/start"
    >
      body
    </StepFrame>,
  );

test("CP-2 M4: a step of Add a place can Cancel back to where it came from", () => {
  state.search = { from: "/school/o/classes/c/today" };
  step();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(state.closed).toEqual(["/school/o/classes/c/today"]);
});

test("a first run, and a return that isn't a place, offer no Cancel", () => {
  for (const search of [
    {},
    { from: "/school/invite" },
    { from: "//x.example" },
  ]) {
    state.search = search;
    step();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    cleanup();
  }
});
