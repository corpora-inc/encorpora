import { create } from "zustand";
import { call, EngineError } from "../engine/client.ts";
import type { EquipView, FaultTree, PackInfoView, TaskSummary } from "../engine/types.ts";

/** One loaded pack: its manual, its equipment family, its tables and tasks. */
export interface PackData {
  info: PackInfoView;
  equipment: EquipView[];
  trees: FaultTree[];
  tasks: TaskSummary[];
}

/**
 * Every pack on this device, read once at boot. A device can hold several
 * (a pump manual and a boat's autopilot checks); a unit's variant decides
 * which pack answers for it.
 */
interface PackState {
  packs: Record<string, PackData>;
  /** Pack ids in the engine's order. */
  ids: string[];
  load(): Promise<void>;
}

/**
 * The loaded pack ids. pack.info answers for the only pack when one is
 * loaded; with several it refuses and names them. Interim, until the engine
 * has a pack.list: read the names from that refusal.
 */
async function packIds(): Promise<string[]> {
  try {
    return (await call("pack.info", {})).packs;
  } catch (e) {
    const m = e instanceof EngineError ? /\[(.*)\]/.exec(e.message) : null;
    if (!m) throw e;
    return JSON.parse(`[${m[1]}]`) as string[];
  }
}

export const usePack = create<PackState>()((set) => ({
  packs: {},
  ids: [],
  async load() {
    const ids = await packIds();
    const loaded = await Promise.all(
      ids.map(async (pack_id) => {
        const [info, equipment, trees, tasks] = await Promise.all([call("pack.info", { pack_id }), call("equip.list", { pack_id }), call("tree.list", { pack_id }), call("task.list", { pack_id })]);
        return [pack_id, { info, equipment, trees, tasks }] as const;
      }),
    );
    set({ ids, packs: Object.fromEntries(loaded) });
  },
}));

/** The pack whose equipment family holds this variant. */
export function packOf(packs: Record<string, PackData>, equipId: string | null | undefined): PackData | null {
  if (!equipId) return null;
  return Object.values(packs).find((p) => p.equipment.some((e) => e.equip_id === equipId)) ?? null;
}

/** The pack a unit, a job or a screen works in; the only pack when there is one. */
export function usePackFor(equipId: string | null | undefined): PackData | null {
  return usePack((s) => packOf(s.packs, equipId) ?? (s.ids.length === 1 ? (s.packs[s.ids[0]!] ?? null) : null));
}

/** Every variant across the packs, by id. */
export const allEquipment = (packs: Record<string, PackData>): EquipView[] => Object.values(packs).flatMap((p) => p.equipment);

/** Every tree title across the packs, by tree id. */
export const treeTitles = (packs: Record<string, PackData>): Record<string, string> => Object.fromEntries(Object.values(packs).flatMap((p) => p.trees.map((t) => [t.tree_id, t.title])));

/** The pack's name for a variant; the id when no pack knows it. */
export const variantName = (equipment: EquipView[], equipId: string | null | undefined) => (equipId ? (equipment.find((e) => e.equip_id === equipId)?.name ?? equipId) : "Variant not set");

/** True when the pack has variants under this equipment: it names a model, not a variant. */
export const isGeneral = (equipment: EquipView[], equipId: string | null) => !!equipId && equipment.some((e) => e.parent_id === equipId);

/** A short name for a pack: its first source's title, else its id. */
export const packTitle = (p: PackData) => p.info.sources[0]?.title ?? p.info.pack_id;
