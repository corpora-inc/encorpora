import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import {
  CurriculumDetailsProvider,
  CurriculumDetailsControl,
  useCurriculumPreferences,
} from "../CurriculumDetails";
import { LevelCheck } from "../../trial/LevelCheck";
import type { ReactNode } from "react";
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
import { LevelReadout } from "../../../ui/LevelReadout";
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
function View() {
  return (
    <CurriculumDetailsProvider>
      <CurriculumDetailsControl />
      <LevelReadout estimate={{ level: 5, sd: 1 }} />
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
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Show grades and estimates" }),
  );
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

test("progress modal hides grade text and accessible estimates until explicitly revealed", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const estimate = { level: 5, sd: 1, answered: 25, independent: 18 };
  const proceed = vi.fn();
  render(
    <CurriculumDetailsProvider>
      <LevelCheck
        open
        onContinue={proceed}
        age={14}
        strands={["operations"]}
        progress={{
          phase: "practice",
          free: 100,
          placement: 20,
          remaining: 75,
          totals: { answered: 25, correct: 18, assisted: 0 },
          mastered: [],
          frontier: {
            placement: null,
            current: {
              expected: 8,
              overall: estimate,
              strands: { operations: estimate },
            },
          },
          trend: [
            { answered: 20, level: 4, sd: 1.2 },
            { answered: 25, level: 5, sd: 1 },
          ],
        }}
      />
    </CurriculumDetailsProvider>,
  );
  const dialog = screen.getByRole("dialog");
  expect(dialog.textContent).toContain(
    "25 problems answered. Your answers help choose what to practice next.",
  );
  expect(within(dialog).queryByTestId("level-readout")).toBeNull();
  expect(within(dialog).queryByRole("img")).toBeNull();
  const area = dialog.querySelector("li[data-strand]")!;
  expect(area.getAttribute("aria-label")).toBe(
    "Operations: 25 answered, 18 correct without help",
  );
  fireEvent.click(within(dialog).getByRole("checkbox"));
  expect(within(dialog).getByTestId("level-readout").textContent).toContain(
    "Grade 5",
  );
  expect(within(dialog).getByTestId("level-readout").textContent).toContain(
    "Estimated range",
  );
  expect(area.getAttribute("aria-label")).toContain("likely");
  expect(
    within(dialog).getByRole("img", { name: /The range shows uncertainty/ }),
  ).toBeTruthy();
  expect(dialog.textContent).not.toContain("You’re about 14");
  fireEvent.click(within(dialog).getByRole("checkbox"));
  expect(within(dialog).queryByTestId("level-readout")).toBeNull();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Continue", exact: true }),
  );
  expect(proceed).toHaveBeenCalledOnce();
});
