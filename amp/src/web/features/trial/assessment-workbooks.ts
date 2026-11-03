import { useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { WorkbookPaper } from "../../../workbook/contracts";
import { AppError } from "../../lib/AppError";
import { defaultPaper, workbookMessage } from "../workbooks/model";
import {
  downloadAssessmentWorkbook,
  makeTrialWorkbook,
  type TrialSession,
} from "./api";

type PaperPreference = {
  paper: WorkbookPaper;
  setPaper: (paper: WorkbookPaper) => void;
};
/** The device's paper size for free workbooks: the region's default until
 * chosen. A trial has no account to keep it, so it stays on this device. */
export const useWorkbookPaper = create<PaperPreference>()(
  persist(
    (set) => ({
      paper: defaultPaper(),
      setPaper: (paper) => set({ paper }),
    }),
    {
      name: "amp.trial-workbook-paper",
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
            /* Memory only when storage is unavailable. */
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
      partialize: ({ paper }) => ({ paper }),
      merge: (saved, current) => {
        const value = (saved as Partial<PaperPreference> | null)?.paper;
        return {
          ...current,
          paper: value === "a4" || value === "letter" ? value : current.paper,
        };
      },
    },
  ),
);

type Item = { id: string; date: string; number: number };

/** Makes (when `workbook` is absent) and downloads a free workbook. One
 * action at a time; a failure is logged and worded for the fixed toast. */
export function useAssessmentWorkbook(session: TrialSession) {
  const paper = useWorkbookPaper((state) => state.paper);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  async function print(key: string, workbook?: Item): Promise<Item | null> {
    if (busy) return null;
    setBusy(key);
    setMessage("");
    try {
      const target = workbook ?? (await makeTrialWorkbook(session, paper));
      await downloadAssessmentWorkbook(session, target, paper);
      return target;
    } catch (error) {
      if (!(error instanceof AppError))
        console.error("Free workbook failed", error);
      setMessage(
        workbookMessage(error, "The workbook didn't download. Try again."),
      );
      return null;
    } finally {
      setBusy(null);
    }
  }
  return { busy, message, clear: () => setMessage(""), print };
}
