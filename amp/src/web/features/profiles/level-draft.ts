import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ProfilePace } from "../../../learning/practice-profiles";
import { useSessionOrNull } from "../../lib/session";

/**
 * The grade and pace being chosen on "Practice at a level" (`/me/level`)
 * and "New profile" (`/me/profiles/new`): a flow draft, so client state in
 * a typed store keyed by account (amp/AGENTS.md, "Canonical global state"),
 * never the query string. Kept for the tab (sessionStorage): a reload keeps
 * the choice. "Save as a profile" hands the level's choice to a new
 * profile by writing its draft before it opens.
 */
export type LevelDraft = { grade?: number; pace?: ProfilePace };
export type LevelFlow = "level" | "new";

type Drafts = { drafts: Record<string, LevelDraft> };
const NONE: LevelDraft = {};
const keyOf = (account: string, flow: LevelFlow) => `${account}:${flow}`;

const storage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try {
      return sessionStorage.getItem(name);
    } catch (error) {
      console.warn("The level being chosen isn't restored", error);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      sessionStorage.setItem(name, value);
    } catch (error) {
      console.warn("The level being chosen isn't kept", error);
    }
  },
  removeItem: (name: string) => {
    try {
      sessionStorage.removeItem(name);
    } catch (error) {
      console.warn("The level being chosen isn't cleared", error);
    }
  },
}));

export const useLevelDrafts = create<Drafts>()(
  persist(() => ({ drafts: {} }), {
    name: "amp.level-drafts",
    storage,
    version: 1,
  }),
);

/** An account's draft for one flow: what is chosen so far. */
export function useLevelDraft(flow: LevelFlow): LevelDraft {
  const account = useSessionOrNull()?.accountId ?? "";
  return useLevelDrafts((state) => state.drafts[keyOf(account, flow)] ?? NONE);
}

/** Sets an account's draft for one flow (an event handler's call); an
 * empty draft starts the flow afresh. */
export function setLevelDraft(
  account: string,
  flow: LevelFlow,
  draft: LevelDraft,
) {
  if (!account) return;
  useLevelDrafts.setState((state) => ({
    drafts: { ...state.drafts, [keyOf(account, flow)]: draft },
  }));
}
