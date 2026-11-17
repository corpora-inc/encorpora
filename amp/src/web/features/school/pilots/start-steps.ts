import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/* A teacher's class setup (`/school/start`), step by step: each step is its
   own URL, and the shared stepper (ui/FlowSteps) links back to the done
   ones. The class is made at the last step, with its students. */

export const START_STEPS = [
  { id: "", label: "Your class" },
  { id: "students", label: "Students" },
] as const;
export type StartStep = (typeof START_STEPS)[number]["id"];

/** A step's address: the path names the step, nothing rides along. */
export const startStepUrl = (id: string) =>
  id ? `/school/start/${id}` : "/school/start";

/** "A new school", among the schools a teacher already has. */
export const NEW_SCHOOL = "new";

export type StartDraft = {
  /** The account the draft is for: another account starts blank. */
  owner: string | null;
  /** One request per class, so a retry or a reload never makes two. */
  requestId: string | null;
  /** The school chosen; null takes the first, NEW_SCHOOL makes one. */
  school: string | null;
  schoolName: string;
  className: string;
  /** The course the teacher chose; null follows the class's name. */
  course: string | null;
  /** The signer, once the teacher changes it from the account's name. */
  signerName: string | null;
  authorized: boolean;
  /** Student names as typed, one a line. Kept in memory only. */
  names: string;
};
const blank: Omit<StartDraft, "owner"> = {
  requestId: null,
  school: null,
  schoolName: "",
  className: "",
  course: null,
  signerName: null,
  authorized: false,
  names: "",
};

// Session storage keeps the class's details across a refresh of a step, in
// this tab only. It can be unavailable (a private window, blocked site
// data); setup then works without remembering.
const storage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try {
      return sessionStorage.getItem(name);
    } catch (error) {
      console.warn("Class setup couldn’t read its draft", error);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      sessionStorage.setItem(name, value);
    } catch (error) {
      console.warn("Class setup couldn’t keep its draft", error);
    }
  },
  removeItem: (name: string) => {
    try {
      sessionStorage.removeItem(name);
    } catch (error) {
      console.warn("Class setup couldn’t clear its draft", error);
    }
  },
}));

/** What a teacher has typed so far, per account. */
export const useStartDraft = create<
  StartDraft & {
    edit: (owner: string, change: Partial<StartDraft>) => void;
    clear: () => void;
  }
>()(
  persist(
    (set) => ({
      owner: null,
      ...blank,
      edit: (owner, change) =>
        set((state) =>
          state.owner === owner
            ? change
            : { owner, ...blank, requestId: crypto.randomUUID(), ...change },
        ),
      clear: () => set({ owner: null, ...blank }),
    }),
    {
      name: "amp.school-start",
      storage,
      version: 1,
      // Children's names stay in memory: never written to the device.
      partialize: (state) => ({
        owner: state.owner,
        requestId: state.requestId,
        school: state.school,
        schoolName: state.schoolName,
        className: state.className,
        course: state.course,
        signerName: state.signerName,
        authorized: state.authorized,
      }),
    },
  ),
);

/** The draft as one account sees it: blank when it is another's. */
export function draftFor(draft: StartDraft, owner: string): StartDraft {
  return draft.owner === owner ? draft : { owner, ...blank };
}

/** Pasted or typed names, one per line; a spreadsheet's columns (tabs)
 * become spaces, and blank lines go. */
export function parseNames(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\t+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}
