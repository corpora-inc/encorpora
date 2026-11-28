import { useEffect } from "react";
import { Outlet } from "react-router";
import { useDevice } from "../store/device.ts";
import { useFleet } from "../store/fleet.ts";
import { usePack, variantName } from "../store/pack.ts";
import { useSettings } from "../store/settings.ts";
import { unitName } from "../ui/format.ts";
import { linkState } from "../ui/link.ts";
import { Shell } from "../ui/Shell.tsx";

/** The shell for every app screen: the active unit, the link state and what waits to sync. */
export function Frame() {
  const active = useSettings((s) => s.activeUnit);
  const assets = useFleet((s) => s.assets);
  const sync = useFleet((s) => s.sync);
  const equipment = usePack((s) => s.equipment);
  const hub = useDevice((s) => s.hub);
  const asset = assets.find((a) => a.asset_id === active) ?? null;
  // Keep the outbox count current while the app is open.
  useEffect(() => {
    const t = setInterval(() => void useFleet.getState().refreshSync(), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <Shell unit={asset ? { asset_id: asset.asset_id, name: unitName(asset), variant: variantName(equipment, asset.equip_id) } : null} link={linkState(sync)} queued={sync?.pending ?? 0} hub={hub}>
      <Outlet />
    </Shell>
  );
}

/** Opening a unit, its troubleshooting or one of its jobs makes it the active unit. */
export function useActiveUnit(assetId: string | null | undefined) {
  const set = useSettings((s) => s.setActiveUnit);
  useEffect(() => {
    if (assetId) set(assetId);
  }, [assetId, set]);
}
