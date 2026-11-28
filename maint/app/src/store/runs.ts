import { create } from "zustand";
import { persist } from "zustand/middleware";
import { reportError } from "@appkit/toast.ts";
import { jsonStorage } from "@appkit/storage.ts";
import { call, EngineError } from "../engine/client.ts";
import type { Guidance, Outcome, Run, RunReport } from "../engine/types.ts";
import { useFleet } from "./fleet.ts";

/** Task runs started from the Tasks screen: one open run per task on this device, keyed by runKey(pack, task). */
export const runKey = (packId: string, procId: string) => `${packId}/${procId}`;
interface RunsState {
  open: Record<string, Run>;
  guidance: Record<string, Guidance | null>;
  reports: Record<string, RunReport>;
  busy: boolean;
  start(packId: string, procId: string, asset: string | null, equipId: string | null, role: string): Promise<void>;
  record(key: string, ord: number, outcome: Outcome, value?: string): Promise<void>;
  end(key: string, how: "finish" | "abandon"): Promise<void>;
}

const say = (e: unknown, fallback: string) => (e instanceof EngineError ? e.message : fallback);

export const useRuns = create<RunsState>()(
  persist(
    (set, get) => ({
      open: {},
      guidance: {},
      reports: {},
      busy: false,
      async start(packId, procId, asset, equipId, role) {
        set({ busy: true });
        try {
          const run = await call("run.start", { pack_id: packId, proc_id: procId, asset, equip_id: equipId, role });
          const key = runKey(packId, procId);
          const { [key]: _, ...reports } = get().reports;
          set({ open: { ...get().open, [key]: run }, reports, guidance: { ...get().guidance, [key]: null } });
        } catch (e) {
          reportError("runs.start", e, say(e, "The task could not be started."));
        } finally {
          set({ busy: false });
        }
      },
      async record(key, ord, outcome, value) {
        const run = get().open[key];
        if (!run) return;
        set({ busy: true });
        try {
          const text = value ?? null;
          const r = await call("run.record", { run_id: run.run_id, ord, outcome, ...(outcome === "note" ? { note: text } : { value: text }) });
          const steps = [...run.steps.filter((s) => s.ord !== ord), r.record].sort((a, b) => a.ord - b.ord);
          set({ open: { ...get().open, [key]: { ...run, steps } }, guidance: { ...get().guidance, [key]: r.guidance } });
        } catch (e) {
          reportError("runs.record", e, say(e, "The step was not recorded. Try again."));
        } finally {
          set({ busy: false });
        }
      },
      async end(key, how) {
        const run = get().open[key];
        if (!run) return;
        set({ busy: true });
        try {
          await call(how === "finish" ? "run.finish" : "run.abandon", { run_id: run.run_id });
          const report = await call("run.report", { run_id: run.run_id });
          const { [key]: _, ...open } = get().open;
          set({ open, reports: { ...get().reports, [key]: report } });
          void useFleet.getState().refreshSync();
        } catch (e) {
          reportError("runs.end", e, say(e, "The run could not be closed."));
        } finally {
          set({ busy: false });
        }
      },
    }),
    { name: "maint.runs", storage: jsonStorage, version: 2, migrate: () => ({}) as RunsState, partialize: (s) => ({ open: s.open, reports: s.reports }) as unknown as RunsState },
  ),
);
