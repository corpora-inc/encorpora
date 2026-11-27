/** Procedure runs, recorded offline. Photos are referenced by id (IndexedDB). */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jsonStorage } from "../lib/storage.ts";
import type { Role } from "../engine/types.ts";

export type StepResult = "pass" | "fail" | null;

export interface StepRecord {
  result: StepResult;
  value: string;
  note: string;
  photoIds: string[];
  at: string | null;
}

export interface Run {
  id: string;
  procId: string;
  title: string;
  role: Role;
  equipment: string | null;
  startedAt: string;
  finishedAt: string | null;
  steps: StepRecord[];
}

export const emptyStep = (): StepRecord => ({ result: null, value: "", note: "", photoIds: [], at: null });

interface RunsState {
  runs: Record<string, Run>;
  start(input: { procId: string; title: string; role: Role; equipment: string | null; steps: number }): Run;
  record(runId: string, step: number, patch: Partial<StepRecord>): void;
  finish(runId: string): void;
  remove(runId: string): void;
  clear(): void;
}

const newId = () => `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useRuns = create<RunsState>()(
  persist(
    (set, get) => ({
      runs: {},
      start({ procId, title, role, equipment, steps }) {
        const run: Run = {
          id: newId(),
          procId,
          title,
          role,
          equipment,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          steps: Array.from({ length: steps }, emptyStep),
        };
        set({ runs: { ...get().runs, [run.id]: run } });
        return run;
      },
      record(runId, step, patch) {
        const run = get().runs[runId];
        if (!run || !run.steps[step]) return;
        const steps = run.steps.slice();
        steps[step] = { ...steps[step]!, ...patch, at: new Date().toISOString() };
        set({ runs: { ...get().runs, [runId]: { ...run, steps } } });
      },
      finish(runId) {
        const run = get().runs[runId];
        if (run) set({ runs: { ...get().runs, [runId]: { ...run, finishedAt: run.finishedAt ?? new Date().toISOString() } } });
      },
      remove(runId) {
        const runs = { ...get().runs };
        delete runs[runId];
        set({ runs });
      },
      clear: () => set({ runs: {} }),
    }),
    { name: "crane.runs", storage: jsonStorage, version: 1 },
  ),
);

export function runSummary(run: Run) {
  const done = run.steps.filter((s) => s.result !== null || s.value || s.note || s.photoIds.length).length;
  const findings = run.steps.filter((s) => s.result === "fail").length;
  return { done, total: run.steps.length, findings };
}
