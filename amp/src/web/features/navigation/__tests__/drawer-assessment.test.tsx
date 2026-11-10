import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import DrawerContents from "../DrawerContents";
import type { ShellFrame } from "../shell-frame";

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

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function show({
  data,
  accountTrial = false,
  stored = false,
  error = false,
  student = false,
  trialMode = false,
  frame,
}: {
  data: undefined | null | { learnerId: string; token: string };
  accountTrial?: boolean;
  stored?: boolean;
  error?: boolean;
  student?: boolean;
  trialMode?: boolean;
  frame?: ShellFrame;
}) {
  if (stored) localStorage.setItem("amp.trial", "synthetic-trial");
  const learner = { id: "jordan", name: "Jordan" };
  learningView.mockReturnValue({
    account: {
      account: { kind: student ? "student" : "parent" },
      trial: accountTrial,
      familyClass: { orgId: "family-org", classId: "family-class" },
    },
    learner: trialMode ? undefined : learner,
    learners: [learner],
    ownPractice: false,
    trialMode,
    trial: { data, isPending: data === undefined && !error, isError: error },
    session: { data: {} },
    canPractice: true,
    practiceHref: "/practice",
  });
  return render(<DrawerContents close={() => {}} frame={frame} />);
}

test("review regression: a family class offers Family directly at /family", () => {
  show({
    data: null,
    frame: {
      kind: "class",
      org: "family-org",
      classId: "family-class",
      active: "today",
      board: false,
    },
  });
  expect(
    screen.getByRole("link", { name: "Family" }).getAttribute("href"),
  ).toBe("/family");
  expect(
    screen.getByRole("link", { name: "Account" }).getAttribute("href"),
  ).toBe("/family/security");
});

test.each([false, true])(
  "no phantom assessment while an unknown lookup is pending or failed (error=%s)",
  (error) => {
    show({ data: undefined, error });
    expect(screen.queryByText("Free assessment")).toBeNull();
    expect(
      screen.queryByRole("option", { name: "Free assessment" }),
    ).toBeNull();
    expect(
      screen.queryByRole("listbox", { name: "Current learner" }),
    ).toBeNull();
    expect(screen.getByText("Jordan")).toBeTruthy();
  },
);

test.each([
  ["account", false],
  ["account", true],
  ["device", false],
  ["device", true],
] as const)(
  "a known %s assessment stays offered while lookup is pending or failed (error=%s)",
  (source, error) => {
    show({
      data: undefined,
      error,
      accountTrial: source === "account",
      stored: source === "device",
    });
    expect(
      screen.getByRole("option", { name: "Free assessment" }),
    ).toBeTruthy();
  },
);

test("an authoritative absence stays absent after a failed refetch despite stale hints", () => {
  show({ data: null, accountTrial: true, stored: true, error: true });
  expect(screen.queryByText("Free assessment")).toBeNull();
  expect(screen.queryByRole("option", { name: "Free assessment" })).toBeNull();
});

test("students are never offered a parent assessment choice or label", () => {
  show({
    data: { learnerId: "trial", token: "synthetic" },
    accountTrial: true,
    stored: true,
    student: true,
    trialMode: true,
  });
  expect(screen.queryByText("Free assessment")).toBeNull();
  expect(screen.queryByRole("option", { name: "Free assessment" })).toBeNull();
});
