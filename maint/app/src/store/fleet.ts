import { create } from "zustand";
import { reportError } from "@appkit/toast.ts";
import { call } from "../engine/client.ts";
import type { Asset, AssetHistory, AssetInput, JobSummary, SyncStatus } from "../engine/types.ts";
import { packOf, usePack } from "./pack.ts";

/**
 * The units on this device, every job, and the outbox. One store: any change
 * (a new unit, an answer, a close, a sync) refreshes it, and every screen
 * reads from here.
 */
interface FleetState {
  loaded: boolean;
  assets: Asset[];
  jobs: JobSummary[];
  sync: SyncStatus | null;
  history: Record<string, AssetHistory>;
  refresh(): Promise<void>;
  refreshSync(): Promise<void>;
  loadHistory(assetId: string): Promise<void>;
  create(asset: AssetInput, packId: string): Promise<Asset>;
  /** After a job changes: its list entry, its unit's history and the outbox. */
  touched(assetId: string | null): Promise<void>;
}

export const useFleet = create<FleetState>()((set, get) => ({
  loaded: false,
  assets: [],
  jobs: [],
  sync: null,
  history: {},
  async refresh() {
    try {
      const [assets, jobs, sync] = await Promise.all([call("asset.list", {}), call("job.list", {}), call("sync.status", {})]);
      set({ loaded: true, assets, jobs, sync });
    } catch (e) {
      reportError("fleet.refresh", e, "The fleet list could not be read from the engine. Restart the app if this repeats.");
    }
  },
  async refreshSync() {
    try {
      set({ sync: await call("sync.status", {}) });
    } catch (e) {
      reportError("fleet.sync", e, "The sync status could not be read.");
    }
  },
  async loadHistory(assetId) {
    try {
      // A unit's history is read in the pack its variant belongs to.
      const equip = get().assets.find((a) => a.asset_id === assetId)?.equip_id;
      const h = await call("asset.history", { asset_id: assetId, pack_id: packOf(usePack.getState().packs, equip)?.info.pack_id ?? null });
      set({ history: { ...get().history, [assetId]: h } });
    } catch (e) {
      reportError("fleet.history", e, "This unit's history could not be read.");
    }
  },
  async create(asset, packId) {
    const a = await call("asset.create", { asset, pack_id: packId });
    await get().refresh();
    return a;
  },
  async touched(assetId) {
    await get().refresh();
    if (assetId && get().history[assetId]) await get().loadHistory(assetId);
  },
}));
