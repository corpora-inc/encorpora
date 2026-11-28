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

/**
 * The three model-assisted calls are made only when the host configuration names a model and
 * nobody on this device has turned it off: the switch starts On wherever a model is set up.
 */
export const isOn = (choice: boolean | null, configured: boolean) => configured && (choice ?? true);
export function modelOn(): boolean {
  return isOn(useSettings.getState().model, !!useModel.getState().status?.configured);
}
export const useModelOn = () => {
  const choice = useSettings((s) => s.model);
  const configured = useModel((s) => !!s.status?.configured);
  return isOn(choice, configured);
};
