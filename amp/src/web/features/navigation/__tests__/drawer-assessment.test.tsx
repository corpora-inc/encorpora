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
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
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
}: {
  data: undefined | null | { learnerId: string; token: string };
  accountTrial?: boolean;
  stored?: boolean;
  error?: boolean;
  student?: boolean;
  trialMode?: boolean;
}) {
  if (stored) localStorage.setItem("amp.trial", "synthetic-trial");
  const learner = { id: "jordan", name: "Jordan" };
  learningView.mockReturnValue({
    account: {
      account: { kind: student ? "student" : "parent" },
      trial: accountTrial,
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
  return render(<DrawerContents close={() => {}} />);
}

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
