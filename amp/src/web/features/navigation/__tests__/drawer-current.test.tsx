import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import DrawerContents from "../DrawerContents";

const { learningView, pathname } = vi.hoisted(() => ({
  learningView: vi.fn(),
  pathname: { value: "/me/profiles" },
}));
vi.mock("../../../lib/learning-view", () => ({
  useLearningView: learningView,
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: pathname.value, search: {} }),
  useNavigate: () => vi.fn(),
  Link: ({
    children,
    params,
    "aria-label": label,
    "aria-current": current,
  }: {
    children: ReactNode;
    params: { _splat: string };
    "aria-label"?: string;
    "aria-current"?: "page";
  }) => (
    <a href={`/${params._splat}`} aria-label={label} aria-current={current}>
      {children}
    </a>
  ),
}));
vi.mock("../../curriculum/CurriculumDetails", () => ({
  CurriculumDetailsControl: () => null,
}));
vi.mock("../../practice/FeedbackPreferences", () => ({
  FeedbackPreferences: () => null,
}));
vi.mock("../PlaceSwitcher", () => ({
  PlaceSwitcher: () => null,
  placeEntries: () => [],
  usePlaceEntries: () => ({ entries: [], loading: false }),
}));

afterEach(cleanup);

const adult = () => {
  const learner = { id: "me", name: "Me" };
  learningView.mockReturnValue({
    account: {
      account: { kind: "adult" },
      adultPractice: { learner: { id: "me" } },
    },
    learner,
    learners: [learner],
    ownPractice: true,
    session: { data: {} },
    canPractice: true,
    practiceHref: "/practice",
  });
};
const currentLinks = () =>
  [...document.querySelectorAll('a[aria-current="page"]')].map((link) =>
    link.getAttribute("aria-label"),
  );

test("founder note: on Practice as someone else, only that item is current, never Progress too", () => {
  adult();
  pathname.value = "/me/profiles";
  render(<DrawerContents close={() => {}} />);
  expect(
    screen.getByRole("link", { name: "Practice as someone else" }),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: "Progress" })).toBeTruthy();
  expect(currentLinks()).toEqual(["Practice as someone else"]);
});

test("on Progress, only Progress is current", () => {
  adult();
  pathname.value = "/me";
  render(<DrawerContents close={() => {}} />);
  expect(currentLinks()).toEqual(["Progress"]);
});

test("founder note: the adult's own workbooks sit under Practice, the one current item there", () => {
  adult();
  pathname.value = "/learners/me/workbooks/2026-11-10";
  render(<DrawerContents close={() => {}} />);
  const names = [
    ...document.querySelectorAll('nav[aria-label="AMP navigation"] a'),
  ].map((link) => link.getAttribute("aria-label"));
  expect(names.slice(0, 3)).toEqual(["Practice", "Workbooks", "Progress"]);
  expect(currentLinks()).toEqual(["Workbooks"]);
});
