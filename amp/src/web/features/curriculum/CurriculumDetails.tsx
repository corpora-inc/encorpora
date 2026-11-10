import { createContext, useContext, type ReactNode } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { isStudentDevice } from "../../lib/student-device";
import { useCurriculumScope } from "./useCurriculumScope";
import styles from "./CurriculumDetails.module.css";
import { CheckboxControl } from "../../ui/Checkbox";

type State = {
  shown: Record<string, boolean>;
  set: (scope: string, shown: boolean) => void;
};
export const useCurriculumPreferences = create<State>()(
  persist(
    (set) => ({
      shown: {},
      set: (scope, shown) =>
        set((state) => ({ shown: { ...state.shown, [scope]: shown } })),
    }),
    {
      name: "amp.curriculum-details",
      storage: createJSONStorage(() => ({
        getItem: (key) => {
          try {
            return localStorage.getItem(key);
          } catch {
            return null;
          }
        },
        setItem: (key, value) => {
          try {
            localStorage.setItem(key, value);
          } catch {
            /* Session-only when storage is unavailable. */
          }
        },
        removeItem: (key) => {
          try {
            localStorage.removeItem(key);
          } catch {
            /* Storage unavailable. */
          }
        },
      })),
      partialize: ({ shown }) => ({ shown }),
      merge: (saved, current) => {
        const shown = (saved as Partial<State> | null)?.shown;
        return {
          ...current,
          shown:
            shown && typeof shown === "object" && !Array.isArray(shown)
              ? Object.fromEntries(
                  Object.entries(shown).filter(
                    ([key, value]) => key.length < 300 && value === true,
                  ),
                )
              : {},
        };
      },
    },
  ),
);
const Details = createContext({
  shown: false,
  ready: false,
  scope: "guest",
  /** A school decided, so there is nothing for this learner to choose. */
  decided: false,
  setShown: (_shown: boolean) => {},
});
/** Display only: scoped to the active learner on this device, never a learning setting. */
export function CurriculumDetailsProvider({
  children,
}: {
  children: ReactNode;
}) {
  // A student's school decides whether levels show (`me.school.levels`). Until
  // `/me` answers on a student device, they stay hidden.
  const {
    scope,
    ready,
    levels = isStudentDevice() ? "hidden" : "choice",
  } = useCurriculumScope();
  const shown = useCurriculumPreferences(
    (s) => ready && s.shown[scope] === true,
  );
  return (
    <Details.Provider
      value={{
        shown: levels === "choice" ? shown : levels === "shown",
        ready,
        scope,
        decided: levels !== "choice",
        setShown: (value) => {
          if (ready) useCurriculumPreferences.getState().set(scope, value);
        },
      }}
    >
      {children}
    </Details.Provider>
  );
}
export const useCurriculumDetails = () => useContext(Details);
/** Grade numbers shown or hidden by the caller, with nothing stored: the
 * component gallery (`features/design`) shows both without touching a
 * learner's choice. */
export function CurriculumDetailsFixture({
  shown,
  children,
}: {
  shown: boolean;
  children: ReactNode;
}) {
  return (
    <Details.Provider
      value={{
        shown,
        ready: true,
        scope: "design",
        decided: false,
        setShown: () => {},
      }}
    >
      {children}
    </Details.Provider>
  );
}
/** `row` sets it as a settings row in the navigation drawer, on the inset
 * its neighbours use; elsewhere it is a quiet control in the page flow. */
export function CurriculumDetailsControl({
  variant,
}: { variant?: "row" } = {}) {
  const { shown, ready, decided, setShown } = useCurriculumDetails();
  if (decided) return null;
  return (
    <label
      className={
        variant === "row" ? `${styles.control} ${styles.row}` : styles.control
      }
    >
      <span className={styles.copy}>
        <span>Show grade numbers</span>
        <small>For this learner on this device.</small>
      </span>
      <CheckboxControl
        aria-label="Show grade numbers"
        aria-description="Remembered for this learner on this device. Practice stays the same."
        checked={shown}
        disabled={!ready}
        onChange={(e) => setShown(e.target.checked)}
      />
    </label>
  );
}
