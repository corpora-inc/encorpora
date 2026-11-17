import { vi } from "vitest";
import type { ReactNode } from "react";

/** The drawer's collaborators, stood in for: the learning view, the router,
 * the places read and the screen's settings. */
export const harness = {
  learningView: vi.fn(),
  groups: { value: [] as unknown[] },
  pathname: { value: "/" },
  /** The account's settings hub (features/spaces/settings-hub.ts). */
  settings: { value: "/account" },
};
vi.mock("../../spaces/settings-hub", () => ({
  useSettingsHref: () => harness.settings.value,
}));
vi.mock("../../../lib/learning-view", () => ({
  useLearningView: harness.learningView,
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: harness.pathname.value, search: {} }),
  useNavigate: () => vi.fn(),
  useRouter: () => ({ preloadRoute: () => Promise.resolve() }),
  Link: ({
    children,
    params,
    search,
    "aria-label": label,
    "aria-current": current,
  }: {
    children: ReactNode;
    params: { _splat: string };
    search?: Record<string, string>;
    "aria-label"?: string;
    "aria-current"?: "page";
  }) => (
    <a
      href={`/${params._splat}${search && Object.keys(search).length ? `?${new URLSearchParams(search)}` : ""}`}
      aria-label={label}
      aria-current={current}
    >
      {children}
    </a>
  ),
}));
vi.mock("../../curriculum/CurriculumDetails", () => ({
  useCurriculumDetails: () => ({ shown: true, ready: true, scope: "test" }),
}));
vi.mock("../../practice/FeedbackPreferences", () => ({
  FeedbackPreferences: () => null,
}));
vi.mock("../../profiles/ProfileBar", () => ({
  ProfilePlace: () => <span data-testid="profile-place" />,
}));
// Who the drawer could choose between (features/spaces/learner-choice.ts):
// its own tests cover the rule; these drawers offer no choice.
vi.mock("../../spaces/learner-choice", () => ({
  useLearnerChoice: () => ({ learners: [], canChoose: false }),
}));
vi.mock("../../spaces/useSpace", () => ({
  useLocationMatch: () => ({ pathname: harness.pathname.value }),
  useSpace: () => null,
}));
vi.mock("../PlaceSwitcher", () => ({
  usePlaces: () => ({
    groups: harness.groups.value,
    more: false,
    loading: false,
  }),
  PlaceSwitcher: ({ current }: { current: string | null }) => (
    <button data-testid="switcher" data-current={current ?? ""}>
      switch
    </button>
  ),
}));
