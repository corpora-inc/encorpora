import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import {
  CurriculumDetailsProvider,
  useCurriculumDetails,
} from "../CurriculumDetails";

const fixture = vi.hoisted(() => ({
  levels: undefined as "hidden" | "choice" | "shown" | undefined,
  studentDevice: false,
}));
vi.mock("../useCurriculumScope", () => ({
  useCurriculumScope: () => ({
    ready: true,
    scope: "account:parent:first",
    levels: fixture.levels,
  }),
}));
vi.mock("../../../lib/student-device", () => ({
  isStudentDevice: () => fixture.studentDevice,
}));
/** A grade readout that shows only while grade numbers are on. */
function Readout() {
  const { shown } = useCurriculumDetails();
  return shown ? <p data-testid="level-readout">Grade 5</p> : null;
}
const view = () =>
  render(
    <CurriculumDetailsProvider>
      <Readout />
    </CurriculumDetailsProvider>,
  );
afterEach(() => {
  cleanup();
  localStorage.clear();
  fixture.levels = undefined;
  fixture.studentDevice = false;
});

test("a grown-up's views always show grades, whatever a device once chose", () => {
  // The old per-device choice is ignored: nothing carries over.
  localStorage.setItem(
    "amp.curriculum-details",
    JSON.stringify({ state: { shown: { "account:parent:first": false } } }),
  );
  view();
  expect(screen.getByTestId("level-readout")).toBeTruthy();
});

test("a child's own session follows their grown-up and school: hidden only when either says so", () => {
  fixture.studentDevice = true;
  fixture.levels = "hidden";
  const { rerender } = view();
  expect(screen.queryByTestId("level-readout")).toBeNull();
  fixture.levels = "shown";
  rerender(
    <CurriculumDetailsProvider>
      <Readout />
    </CurriculumDetailsProvider>,
  );
  expect(screen.getByTestId("level-readout")).toBeTruthy();
  // An older server's "their choice" has no device toggle behind it: shown.
  fixture.levels = "choice";
  rerender(
    <CurriculumDetailsProvider>
      <Readout />
    </CurriculumDetailsProvider>,
  );
  expect(screen.getByTestId("level-readout")).toBeTruthy();
});

test("a student device holds grades back until its /me says", () => {
  fixture.studentDevice = true;
  view();
  expect(screen.queryByTestId("level-readout")).toBeNull();
});
