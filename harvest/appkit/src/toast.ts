import { create } from "zustand";
import { logError } from "./log.ts";

export interface Toast {
  id: number;
  kind: "error" | "info";
  text: string;
}

interface ToastState {
  toast: Toast | null;
  show(kind: Toast["kind"], text: string): void;
  clear(id: number): void;
}

let seq = 0;
/** One toast at a time. Each app draws it in its own look (a fixed overlay that never moves content). */
export const useToast = create<ToastState>()((set, get) => ({
  toast: null,
  show(kind, text) {
    const id = ++seq;
    set({ toast: { id, kind, text } });
    setTimeout(() => get().clear(id), kind === "error" ? 6000 : 3000);
  },
  clear(id) {
    if (get().toast?.id === id) set({ toast: null });
  },
}));

/** One error pattern: log it, then say what happened and what to do, in a toast that overlays. */
export function reportError(where: string, error: unknown, message: string): void {
  logError(where, error);
  useToast.getState().show("error", message);
}
