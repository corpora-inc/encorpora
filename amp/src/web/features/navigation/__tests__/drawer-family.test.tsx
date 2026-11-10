import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import DrawerContents from "../DrawerContents";

const { learningView } = vi.hoisted(() => ({ learningView: vi.fn() }));
vi.mock("../../../lib/learning-view", () => ({
  useLearningView: learningView,
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/overview" }),
  useNavigate: () => vi.fn(),
  Link: ({
    children,
    params,
  }: {
    children: ReactNode;
    params: { _splat: string };
  }) => <a href={`/${params._splat}`}>{children}</a>,
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

test("review regression: a family class offers Family directly at /family", () => {
  const learner = { id: "jordan", name: "Jordan" };
  learningView.mockReturnValue({
    account: {
      account: { kind: "parent" },
      familyClass: { orgId: "family-org", classId: "family-class" },
    },
    learner,
    learners: [learner],
    ownPractice: false,
    session: { data: {} },
    canPractice: true,
    practiceHref: "/practice",
  });
  render(
    <DrawerContents
      close={() => {}}
      frame={{
        kind: "class",
        org: "family-org",
        classId: "family-class",
        active: "today",
        board: false,
      }}
    />,
  );
  expect(
    screen.getByRole("link", { name: "Family" }).getAttribute("href"),
  ).toBe("/family");
  expect(
    screen.getByRole("link", { name: "Account" }).getAttribute("href"),
  ).toBe("/family/security");
});
