import { create } from "zustand";
import { persist } from "zustand/middleware";
import { reportError } from "@appkit/toast.ts";
import { jsonStorage } from "@appkit/storage.ts";
import { call } from "../engine/client.ts";
import type { Lesson, Outcome, Run } from "../engine/types.ts";
import type { CloseOutPhase, LessonDraft } from "../screens/CloseOut.tsx";

/**
 * Close-out per job: where the technician is (action, check, lesson), the
 * task run for the corrective action, the lesson draft, and the saved
 * lesson. Kept on the device so a reload or a dead battery loses nothing.
 */
interface CloseOutState {
  phase: Record<string, CloseOutPhase>;
  runs: Record<string, Run>;
  drafts: Record<string, LessonDraft>;
  saved: Record<string, Lesson>;
  busy: boolean;
  setPhase(jobId: string, p: CloseOutPhase): void;
  setDraft(jobId: string, d: LessonDraft): void;
  startRun(jobId: string, packId: string, procId: string, asset: string | null, equipId: string | null, role: string): Promise<void>;
  record(jobId: string, ord: number, outcome: Outcome, value?: string): Promise<void>;
  finishRun(jobId: string): Promise<void>;
  setSaved(jobId: string, l: Lesson): void;
  refreshLesson(jobId: string): Promise<void>;
}

export const useCloseOut = create<CloseOutState>()(
  persist(
    (set, get) => ({
      phase: {},
      runs: {},
      drafts: {},
      saved: {},
      busy: false,
      setPhase: (jobId, p) => set({ phase: { ...get().phase, [jobId]: p } }),
      setDraft: (jobId, d) => set({ drafts: { ...get().drafts, [jobId]: d } }),
      async startRun(jobId, packId, procId, asset, equipId, role) {
        if (get().runs[jobId]?.proc_id === procId) return;
        try {
          const run = await call("run.start", { pack_id: packId, proc_id: procId, asset, equip_id: equipId, role });
          set({ runs: { ...get().runs, [jobId]: run } });
        } catch (e) {
          reportError("closeout.run", e, "The task could not be opened for recording.");
        }
      },
      async record(jobId, ord, outcome, value) {
        const run = get().runs[jobId];
        if (!run) return;
        set({ busy: true });
        try {
          // A note step carries its text as the note; a measured step as its value.
          const text = value ?? null;
          const r = await call("run.record", { run_id: run.run_id, ord, outcome, ...(outcome === "note" ? { note: text } : { value: text }) });
          const steps = [...run.steps.filter((s) => s.ord !== ord), r.record].sort((a, b) => a.ord - b.ord);
          set({ runs: { ...get().runs, [jobId]: { ...run, steps } } });
        } catch (e) {
          reportError("closeout.record", e, "The step was not recorded. Try again.");
        } finally {
          set({ busy: false });
        }
      },
      async finishRun(jobId) {
        const run = get().runs[jobId];
        if (!run || run.status !== "open") return;
        try {
          const done = await call("run.finish", { run_id: run.run_id });
          set({ runs: { ...get().runs, [jobId]: done } });
        } catch (e) {
          reportError("closeout.finish", e, "The task run could not be finished.");
        }
      },
      setSaved: (jobId, l) => set({ saved: { ...get().saved, [jobId]: l } }),
      async refreshLesson(jobId) {
        try {
          const list = await call("lesson.list", { job_id: jobId });
          const l = list[list.length - 1];
          if (l) set({ saved: { ...get().saved, [jobId]: l } });
        } catch (e) {
          reportError("closeout.lesson", e, "The lesson's status could not be read.");
        }
      },
    }),
    { name: "maint.closeout", storage: jsonStorage, version: 1, partialize: (s) => ({ phase: s.phase, runs: s.runs, drafts: s.drafts, saved: s.saved }) as unknown as CloseOutState },
  ),
);
