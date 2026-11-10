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
import type { ReactNode } from "react";
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
import { LevelReadout } from "../../../ui/LevelReadout";
import { FrontierMap } from "../../../Home";
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

test("area charts retain estimates and uncertainty when grade numbers are hidden, without inventing an age reference", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const frontier = {
    expected: 0,
    overall: { level: 2, sd: 0.5, answered: 12, independent: 10 },
    strands: {
      operations: { level: 2, sd: 0.5, answered: 12, independent: 10 },
      fractions: { level: 2, sd: 1, answered: 0, independent: 0 },
    },
  };
  const view = (
    birthYear: number | null,
    map: typeof frontier | null = frontier,
  ) => (
    <CurriculumDetailsProvider>
      <CurriculumDetailsControl />
      <FrontierMap
        name="Sample learner"
        birthYear={birthYear}
        frontier={map}
        strands={["operations", "fractions"]}
      />
    </CurriculumDetailsProvider>
  );
  const { container, rerender } = render(view(2020));
  const track = container.querySelector(".frontier-track")!;
  expect(
    container
      .querySelector('[data-strand="operations"] .frontier-track')!
      .classList.contains("estimated"),
  ).toBe(false);
  expect(
    container
      .querySelector('[data-strand="fractions"] .frontier-track')!
      .classList.contains("estimated"),
  ).toBe(true);
  const marker = container.querySelector<HTMLElement>(".frontier-center")!;
  const range = container.querySelector(".frontier-range")!;
  const dot = container.querySelector(".frontier-dot")!;
  expect(marker.style.left).toBe("0%");
  const before = [range.getAttribute("style"), dot.getAttribute("style")];
  expect(container.querySelector(".frontier-axis")!.textContent).toBe("");
  const row = screen.getByRole("button", { name: /^Operations/ });
  fireEvent.click(row);
  expect(container.querySelector(".frontier-detail")!.textContent).toContain(
    "12 answered, 10 correct without help",
  );
  expect(container.textContent).not.toMatch(/Grade \d|Level \d/);
  fireEvent.click(screen.getByRole("checkbox"));
  expect(container.querySelector(".frontier-track")).toBe(track);
  expect([range.getAttribute("style"), dot.getAttribute("style")]).toEqual(
    before,
  );
  expect(container.querySelector(".frontier-detail")!.textContent).toContain(
    "Level 2.00",
  );
  fireEvent.click(screen.getByRole("checkbox"));
  rerender(view(null));
  expect(container.querySelector(".frontier-center")).toBeNull();
  expect(
    container.querySelector(".frontier-heading")!.textContent,
  ).not.toContain("age reference");
  expect(row.getAttribute("aria-label")).toContain(
    "No age reference is available",
  );
  expect(container.querySelector(".frontier-track")).toBe(track);
  rerender(view(2020, null));
  expect(
    container.querySelector(".frontier-map")!.getAttribute("aria-busy"),
  ).toBe("true");
  expect(container.querySelectorAll(".frontier-track")).toHaveLength(2);
  expect(
    container.querySelectorAll(
      ".frontier-dot,.frontier-range,.frontier-center",
    ),
  ).toHaveLength(0);
  expect(
    (screen.getByRole("button", { name: /^Operations/ }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});
