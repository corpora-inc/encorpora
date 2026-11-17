import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  WorkbookChoicesInput,
  WorkbookPaper,
} from "../../../workbook/contracts";
import type { WorkbookMinutes } from "./api";

/**
 * A day's workbook as it is being chosen (amp/AGENTS.md, "Canonical global
 * state": a flow draft is client state, in a typed store keyed by account).
 * The address names the screen (`…/workbooks/<date>`); which workbook it
 * shows and the choices for the next one live here, never in the query
 * string. Like the layers over a screen (nav/layer-store.ts), it is kept for
 * the tab (sessionStorage): a refresh shows the same workbook and the same
 * draft, and choosing is never a step that Back walks through.
 */
export type WorkbookDayDraft = {
  /** The unissued draft's request id: the same preview across a refresh
   * and every retry. Absent: the day's issued workbook is shown. */
  draft?: string;
  minutes?: WorkbookMinutes;
  paper?: WorkbookPaper;
  /** Which of the day's issued workbooks is open (else its latest). */
  number?: number;
  /** The choices the draft was made with (else mixed, at level). */
  choices?: WorkbookChoicesInput;
};

/** One day's draft, for one account's learner. */
export const workbookDayKey = (
  account: string,
  learner: string,
  date: string,
) => `${account}:${learner}:${date}`;

type Drafts = {
  days: Record<string, WorkbookDayDraft>;
  /** Changes a day's draft; `undefined` values clear their fields. */
  change: (day: string, change: WorkbookDayDraft) => void;
};

/** The days remembered at once: the oldest is forgotten first. */
const DAYS = 40;

const storage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try {
      return sessionStorage.getItem(name);
    } catch (error) {
      console.warn("Workbook choices not restored", error);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      sessionStorage.setItem(name, value);
    } catch (error) {
      console.warn("Workbook choices not saved", error);
    }
  },
  removeItem: (name: string) => {
    try {
      sessionStorage.removeItem(name);
    } catch (error) {
      console.warn("Workbook choices not cleared", error);
    }
  },
}));

export const useWorkbookDrafts = create<Drafts>()(
  persist(
    (set) => ({
      days: {},
      change: (day, change) =>
        set((state) => {
          const next: WorkbookDayDraft = { ...state.days[day], ...change };
          for (const field of Object.keys(next) as (keyof WorkbookDayDraft)[])
            if (next[field] === undefined) delete next[field];
          const kept = Object.entries(state.days)
            .filter(([key]) => key !== day)
            .slice(-(DAYS - 1));
          return { days: Object.fromEntries([...kept, [day, next]]) };
        }),
    }),
    {
      name: "amp.workbook-days",
      storage,
      version: 1,
      partialize: (state) => ({ days: state.days }),
    },
  ),
);

const NONE: WorkbookDayDraft = {};

/** A day's draft, read where it is shown. */
export const useWorkbookDay = (day: string) =>
  useWorkbookDrafts((state) => state.days[day] ?? NONE);

/** Changes a day's draft: an event handler's call. */
export const changeWorkbookDay = (day: string, change: WorkbookDayDraft) =>
  useWorkbookDrafts.getState().change(day, change);
