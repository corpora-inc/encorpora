import { create } from "zustand";
import { call } from "../engine/client.ts";
import type { EquipView, FaultTree, PackInfoView, TaskSummary } from "../engine/types.ts";

/** The loaded pack: read once at boot, before the first screen renders. */
interface PackState {
  info: PackInfoView | null;
  equipment: EquipView[];
  trees: FaultTree[];
  tasks: TaskSummary[];
  load(): Promise<void>;
}

export const usePack = create<PackState>()((set) => ({
  info: null,
  equipment: [],
  trees: [],
  tasks: [],
  async load() {
    const [info, equipment, trees, tasks] = await Promise.all([call("pack.info", {}), call("equip.list", {}), call("tree.list", {}), call("task.list", {})]);
    set({ info, equipment, trees, tasks });
  },
}));

/** The pack's name for a variant; the id when the pack does not know it. */
export const variantName = (equipment: EquipView[], equipId: string | null | undefined) => (equipId ? (equipment.find((e) => e.equip_id === equipId)?.name ?? equipId) : "Variant not set");

/** True when the pack has variants under this equipment: it names a model, not a variant. */
export const isGeneral = (equipment: EquipView[], equipId: string | null) => !!equipId && equipment.some((e) => e.parent_id === equipId);
