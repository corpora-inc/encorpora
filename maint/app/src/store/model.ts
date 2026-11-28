import { create } from "zustand";
import { logError } from "@appkit/log.ts";
import { call } from "../engine/client.ts";
import type { LlmStatus } from "../engine/types.ts";
import { useSettings } from "./settings.ts";

/**
 * The engine's model state (`llm.status`): configured or not, which model,
 * whether it answered as of the last call, the prompt versions. Read at boot,
 * on Records, and after each call that may ask the model.
 */
export const useModel = create<{ status: LlmStatus | null; refresh(): Promise<void> }>()((set) => ({
  status: null,
  async refresh() {
    try {
      set({ status: await call("llm.status", {}) });
    } catch (e) {
      // An engine without the model interface: everything works without it.
      logError("llm.status", e);
      set({ status: null });
    }
  },
}));

/** The three model-assisted calls are made only when a model is configured and the switch is on. */
export function modelOn(): boolean {
  return useSettings.getState().model && !!useModel.getState().status?.configured;
}
export const useModelOn = () => {
  const on = useSettings((s) => s.model);
  const configured = useModel((s) => !!s.status?.configured);
  return on && configured;
};
