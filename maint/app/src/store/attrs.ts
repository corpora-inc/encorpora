import { create } from "zustand";
import { reportError } from "@appkit/toast.ts";
import { call, EngineError, plainError } from "../engine/client.ts";
import type { AssetAttrs, PlateInput, ValueSource } from "../engine/types.ts";

/**
 * Each unit's attributes, as the engine keeps them: what its pack declares
 * (label, type, where a value comes from) and the values the unit has, each
 * with its source. `rev` counts changes per unit, so a view filtered by
 * applicability re-reads itself when an answer lands.
 */
interface AttrsState {
  byAsset: Record<string, AssetAttrs>;
  rev: Record<string, number>;
  saving: Record<string, boolean>;
  /** A value the engine refused (it does not parse as the attribute's type), by unit then attribute. */
  refused: Record<string, Record<string, true>>;
  load(assetId: string, packId?: string | null): Promise<AssetAttrs | null>;
  /** Set (or with `null`, clear) values the technician typed. */
  set(assetId: string, values: Record<string, string | null>, packId?: string | null, source?: ValueSource): Promise<boolean>;
  /** Take the attributes the pack reads from a data plate. */
  fromPlate(assetId: string, plate: PlateInput, packId?: string | null): Promise<void>;
}

const say = plainError;

export const useAttrs = create<AttrsState>()((set, get) => {
  const put = (id: string, a: AssetAttrs) => set({ byAsset: { ...get().byAsset, [id]: a }, rev: { ...get().rev, [id]: (get().rev[id] ?? 0) + 1 } });
  return {
    byAsset: {},
    rev: {},
    saving: {},
    refused: {},
    async load(assetId, packId) {
      try {
        const a = await call("asset.attrs", { asset_id: assetId, pack_id: packId ?? null });
        set({ byAsset: { ...get().byAsset, [assetId]: a } });
        return a;
      } catch (e) {
        reportError("attrs.load", e, say(e, "The unit's attributes could not be read."));
        return null;
      }
    },
    async set(assetId, values, packId, source = "typed") {
      set({ saving: { ...get().saving, [assetId]: true } });
      const clear = Object.fromEntries(Object.entries(get().refused[assetId] ?? {}).filter(([k]) => !(k in values)));
      try {
        put(assetId, await call("asset.set_attrs", { asset_id: assetId, pack_id: packId ?? null, source, values }));
        set({ refused: { ...get().refused, [assetId]: clear } });
        return true;
      } catch (e) {
        // A value that does not read as its type is said next to its field, not in a toast
        // (a refused input, not a fault: noted in the console, never as an error).
        if (e instanceof EngineError && e.code === "invalid") {
          console.info(`attrs.set refused: ${e.message}`);
          set({ refused: { ...get().refused, [assetId]: { ...clear, ...Object.fromEntries(Object.keys(values).map((k) => [k, true as const])) } } });
        } else reportError("attrs.set", e, say(e, "The answer could not be saved."));
        return false;
      } finally {
        set({ saving: { ...get().saving, [assetId]: false } });
      }
    },
    async fromPlate(assetId, plate, packId) {
      try {
        put(assetId, await call("asset.set_attrs", { asset_id: assetId, pack_id: packId ?? null, source: "plate", plate }));
      } catch (e) {
        reportError("attrs.plate", e, say(e, "The plate's values could not be kept on the unit."));
      }
    },
  };
});

const NONE: Record<string, true> = {};
/** The attributes whose last typed value the engine refused, for one unit. */
export const useRefused = (assetId: string | null | undefined) => useAttrs((s) => (assetId ? (s.refused[assetId] ?? NONE) : NONE));

/** The change counter for one unit (0 before any answer). */
export const useAttrsRev = (assetId: string | null | undefined) => useAttrs((s) => (assetId ? (s.rev[assetId] ?? 0) : 0));
