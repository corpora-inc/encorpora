import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { StepFrame } from "../setup/StepFrame";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
afterEach(() => {
  cleanup();
});

test("a step offers neither Cancel nor Back: the stepper and the menu are the way", () => {
  render(
    <StepFrame
      steps={[
        { id: "", label: "Your kids" },
        { id: "ready", label: "First practice" },
      ]}
      index={1}
      title="Step"
      href={(id) => (id ? `/start/parent/${id}` : "/start/parent")}
    >
      body
    </StepFrame>,
  );
  expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  expect(screen.queryByText("Back")).toBeNull();
  // The done step links back to itself.
  expect(
    screen.getByRole("link", { name: "Your kids" }).getAttribute("href"),
  ).toBe("/start/parent");
});
