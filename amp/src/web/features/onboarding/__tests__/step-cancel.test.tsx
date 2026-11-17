import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { StepFrame } from "../setup/StepFrame";

const state = vi.hoisted(() => ({
  search: {} as Record<string, unknown>,
}));
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ history: { location: { state: {} }, back: () => {} } }),
  useLocation: ({ select }: { select: (l: unknown) => unknown }) =>
    select({ search: state.search }),
  Link: ({ children }: { children: ReactNode }) => (
    <a href="/back">{children}</a>
  ),
}));
afterEach(() => {
  cleanup();
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

test("a step never offers Cancel: Back is one step, the menu is the way out", () => {
  for (const search of [
    {},
    {
      from: "/school/11111111-1111-4111-8111-111111111111/classes/22222222-2222-4222-8222-222222222222/today",
    },
    { from: "/school/invite" },
  ]) {
    state.search = search;
    step();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(screen.getByText("Back").closest("a")).not.toBeNull();
    cleanup();
  }
});
