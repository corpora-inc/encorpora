import { create } from "zustand";
import { seededFinals } from "./fixture";

/** The preview's one store: what a teacher changes here shows on every screen
 * straight away. Memory only; later screens use the real server state. */
export const usePreview = create<{
  finals: Record<string, string>;
  setFinal: (student: string, value: string) => void;
  target: number;
  setTarget: (minutes: number) => void;
  done: Record<string, boolean>;
  setDone: (todo: string, done: boolean) => void;
}>((set) => ({
  finals: seededFinals,
  setFinal: (student, value) =>
    set((state) => ({ finals: { ...state.finals, [student]: value } })),
  target: 60,
  setTarget: (target) => set({ target }),
  done: {},
  setDone: (todo, done) =>
    set((state) => ({ done: { ...state.done, [todo]: done } })),
}));
