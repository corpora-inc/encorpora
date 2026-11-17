import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { InAppFrame } from "../app-frame";
import { FrameBrand } from "../PageFrame";

vi.mock("../../features/navigation/NavigationDrawer", () => ({
  NavigationDrawer: () => (
    <button type="button" aria-label="Open AMP menu">
      Menu
    </button>
  ),
}));
vi.mock("../../nav/root", () => ({
  RootLink: (props: Record<string, unknown>) => <a href="/" {...props} />,
}));
vi.mock("../../features/support/SupportHelp", () => ({
  SupportHelp: () => null,
}));
afterEach(cleanup);

test("a card's brand carries the logo and the menu where there is no app frame", () => {
  render(<FrameBrand expanded />);
  expect(screen.getAllByRole("button", { name: "Open AMP menu" })).toHaveLength(
    1,
  );
  expect(
    screen.getByRole("link", { name: "AMP Adaptive Math Pathways, home" }),
  ).toBeTruthy();
});

test("in the app's frame, the bar is the one logo and menu: the card adds none", () => {
  render(
    <InAppFrame.Provider value>
      <FrameBrand expanded />
    </InAppFrame.Provider>,
  );
  expect(screen.queryByRole("button", { name: "Open AMP menu" })).toBeNull();
  expect(screen.queryByRole("link")).toBeNull();
});
