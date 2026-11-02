import { createContext, useContext, type ReactNode } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useCurriculumScope } from "./useCurriculumScope";
import styles from "./CurriculumDetails.module.css";

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
  setShown: (_shown: boolean) => {},
});
/** Display only: scoped to the active learner on this device, never a learning setting. */
export function CurriculumDetailsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { scope, ready } = useCurriculumScope();
  const shown = useCurriculumPreferences(
    (s) => ready && s.shown[scope] === true,
  );
  return (
    <Details.Provider
      value={{
        shown,
        ready,
        scope,
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
export function CurriculumDetailsControl() {
  const { shown, ready, setShown } = useCurriculumDetails();
  return (
    <label className={styles.control}>
      <span className={styles.copy}>
        <span>Show grades and estimates</span>
        <small>For this learner on this device.</small>
      </span>
      <span className={styles.check}>
        <input
          type="checkbox"
          aria-label="Show grades and estimates"
          aria-description="Remembered for this learner on this device. Practice stays the same."
          checked={shown}
          disabled={!ready}
          onChange={(e) => setShown(e.target.checked)}
        />
        <span className={styles.indicator} aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none">
            <path d="m3 8 3 3 7-7" />
          </svg>
        </span>
      </span>
    </label>
  );
}
