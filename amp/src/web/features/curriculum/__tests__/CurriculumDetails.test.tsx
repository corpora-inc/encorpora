import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import {
  CurriculumDetailsProvider,
  CurriculumDetailsControl,
  useCurriculumDetails,
  useCurriculumPreferences,
} from "../CurriculumDetails";
import type { ReactNode } from "react";
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
const fixture = vi.hoisted(() => ({
  learner: "first",
  account: "parent",
  trial: false,
}));
vi.mock("../useCurriculumScope", () => ({
  useCurriculumScope: () => ({
    ready: true,
    scope: fixture.trial
      ? "trial:trial-learner"
      : `account:${fixture.account}:${fixture.learner}`,
  }),
}));
/** A grade readout that shows only while grade numbers are on. */
function Readout() {
  const { shown } = useCurriculumDetails();
  return shown ? <p data-testid="level-readout">Grade 5</p> : null;
}
function View() {
  return (
    <CurriculumDetailsProvider>
      <CurriculumDetailsControl />
      <Readout />
    </CurriculumDetailsProvider>
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useCurriculumPreferences.setState({ shown: {} });
  localStorage.clear();
  fixture.learner = "first";
  fixture.account = "parent";
  fixture.trial = false;
});
test("details start hidden and persist for only the selected account and learner", () => {
  const { rerender } = render(<View />);
  expect(screen.queryByTestId("level-readout")).toBeNull();
  fireEvent.click(screen.getByRole("checkbox", { name: "Show grade numbers" }));
  expect(screen.getByTestId("level-readout").textContent).toContain("Grade 5");
  expect(
    JSON.parse(localStorage.getItem("amp.curriculum-details")!).state.shown,
  ).toEqual({ "account:parent:first": true });
  fixture.learner = "second";
  rerender(<View />);
  expect(screen.queryByTestId("level-readout")).toBeNull();
  fixture.learner = "first";
  fixture.account = "another";
  rerender(<View />);
  expect(screen.queryByTestId("level-readout")).toBeNull();
  fixture.account = "parent";
  rerender(<View />);
  expect(screen.getByTestId("level-readout")).toBeTruthy();
  fixture.trial = true;
  rerender(<View />);
  expect(screen.queryByTestId("level-readout")).toBeNull();
});
test("an explicit hide is remembered and cannot alter assessment inputs", () => {
  render(<View />);
  const toggle = screen.getByRole("checkbox");
  fireEvent.click(toggle);
  fireEvent.click(toggle);
  expect(screen.queryByTestId("level-readout")).toBeNull();
  expect(
    useCurriculumPreferences.getState().shown["account:parent:first"],
  ).toBe(false);
});

