import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { reportError } from "@appkit/toast.ts";
import { call } from "../engine/client.ts";
import type { ManualHit, SectionRef, SectionView } from "../engine/types.ts";
import { ManualHome, ManualResults, SectionReader } from "../screens/Manual.tsx";
import { NotFound } from "../screens/NotFound.tsx";
import { useFleet } from "../store/fleet.ts";
import { usePack } from "../store/pack.ts";
import { useSettings } from "../store/settings.ts";
import { useAssetSrc } from "../ui/manual.tsx";

/** The active unit's variant: the engine marks what applies to it. */
function useEquip() {
  const active = useSettings((s) => s.activeUnit);
  return useFleet((s) => s.assets.find((a) => a.asset_id === active)?.equip_id ?? null);
}

export function ManualHomePage() {
  const info = usePack((s) => s.info);
  const equip = useEquip();
  const [contents, setContents] = useState<SectionRef[] | null>(null);
  useEffect(() => {
    call("manual.children", { equip_id: equip })
      .then(setContents)
      .catch((e: unknown) => reportError("manual.children", e, "The manual's contents could not be read."));
  }, [equip]);
  return <ManualHome title={info?.sources.map((s) => `${s.title}, ${s.edition}`).join("; ") ?? ""} contents={contents} />;
}

export function ManualSearchPage() {
  const { q = "" } = useParams();
  const equip = useEquip();
  const [hits, setHits] = useState<ManualHit[] | null>(null);
  useEffect(() => {
    setHits(null);
    call("manual.search", { query: q, equip_id: equip, k: 20 })
      .then((r) => setHits(r.hits))
      .catch((e: unknown) => reportError("manual.search", e, "The search did not run."));
  }, [q, equip]);
  return <ManualResults key={q} query={q} hits={hits} />;
}

export function SectionPage() {
  const { sectionId = "", assetId } = useParams();
  const equip = useEquip();
  const src = useAssetSrc();
  const packId = usePack((s) => s.info?.pack_id ?? "");
  const [view, setView] = useState<SectionView | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    call("manual.section", { section_id: sectionId, equip_id: equip })
      .then((v) => {
        setView(v);
        setMissing(false);
      })
      .catch((e: unknown) => {
        setMissing(true);
        reportError("manual.section", e, "This section could not be read.");
      });
  }, [sectionId, equip]);
  if (!view || view.section.section_id !== sectionId) return missing ? <NotFound /> : null;
  // The section's own page image, else the page its citation points at.
  const page = view.assets.find((a) => a.role === "page") ?? null;
  return <SectionReader view={view} page={page} pageOpen={!!assetId && page?.asset_id === assetId} src={(a) => src(packId, a)} />;
}
