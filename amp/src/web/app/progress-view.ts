import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { initialProgressView, type ProgressView } from "../ProgressWorkspace";

/**
 * Progress's view. Its area and an open skill are views worth sharing, so
 * the address names them (`/progress/areas/<strand>`,
 * `/progress/skills/<skill>`, `progressPath`). Which skills (practiced,
 * review, explore) and the page are how it was left: client state with one
 * owner per account's learner, never the address (amp/AGENTS.md,
 * "Canonical global state"), so a refresh, Back to it and the Progress tab
 * reopen it as it was. Kept for the tab's session.
 */
type ProgressViews = {
  views: Record<string, ProgressView>;
  set: (key: string, view: ProgressView) => void;
};

const storage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try {
      return sessionStorage.getItem(name);
    } catch (error) {
      console.warn("Progress's view not read", error);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      sessionStorage.setItem(name, value);
    } catch (error) {
      console.warn("Progress's view not kept", error);
    }
  },
  removeItem: (name: string) => {
    try {
      sessionStorage.removeItem(name);
    } catch (error) {
      console.warn("Progress's view not cleared", error);
    }
  },
}));

export const useProgressViews = create<ProgressViews>()(
  persist(
    (set) => ({
      views: {},
      set: (key, view) =>
        set((state) => ({ views: { ...state.views, [key]: view } })),
    }),
    {
      name: "amp.progress-view",
      storage,
      version: 1,
      partialize: (state) => ({ views: state.views }),
    },
  ),
);

/** The key of one account's learner's view. */
export const progressKey = (accountId: string, learnerId: string) =>
  `${accountId}:${learnerId}`;

/** Progress's view for this account's learner (`key`), and its setter. */
export function useProgressView(
  key: string | null,
): [
  ProgressView,
  (update: ProgressView | ((view: ProgressView) => ProgressView)) => void,
] {
  const view = useProgressViews((state) =>
    key ? (state.views[key] ?? initialProgressView) : initialProgressView,
  );
  const update = (
    next: ProgressView | ((view: ProgressView) => ProgressView),
  ) => {
    if (!key) return;
    const current =
      useProgressViews.getState().views[key] ?? initialProgressView;
    useProgressViews
      .getState()
      .set(key, typeof next === "function" ? next(current) : next);
  };
  return [view, update];
}

const AT = /^\/progress\/(areas|skills)\/([^/]+)\/?$/;
/** The area or the skill a Progress address names. */
export function progressFocus(pathname: string): {
  strand?: string;
  skill?: string;
} {
  const [, kind, id] = AT.exec(pathname) ?? [];
  if (!kind || !id) return {};
  const value = decodeURIComponent(id);
  return kind === "areas" ? { strand: value } : { skill: value };
}
/** Progress's address for a view: its open skill, else its area. */
export const progressPath = (view: Pick<ProgressView, "strand" | "skillId">) =>
  view.skillId
    ? `/progress/skills/${encodeURIComponent(view.skillId)}`
    : view.strand
      ? `/progress/areas/${encodeURIComponent(view.strand)}`
      : "/progress";

/** Progress's view at `pathname`: the address's area or skill over how it
 * was left (`stored`). An open skill keeps the area it was opened from. */
export function shownProgress(
  pathname: string,
  stored: ProgressView,
): ProgressView {
  const at = progressFocus(pathname);
  return {
    ...stored,
    strand: at.strand ?? (at.skill ? stored.strand : ""),
    skillId: at.skill ?? null,
  };
}
