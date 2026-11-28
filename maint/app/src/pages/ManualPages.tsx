import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { reportError } from "@appkit/toast.ts";
import { call } from "../engine/client.ts";
import type { ManualHit, SectionRef, SectionView } from "../engine/types.ts";
import { ManualHome, ManualResults, SectionReader } from "../screens/Manual.tsx";
import { NotFound } from "../screens/NotFound.tsx";
import { useFleet } from "../store/fleet.ts";
import { packOf, packTitle, usePack } from "../store/pack.ts";
import { useSettings } from "../store/settings.ts";
import { ManualPack, pageFor, useAssetSrc } from "../ui/manual.tsx";

/** The active unit's variant, when it belongs to this pack: the engine marks what applies to it. */
function useEquip(packId: string) {
  const active = useSettings((s) => s.activeUnit);
  const equip = useFleet((s) => s.assets.find((a) => a.asset_id === active)?.equip_id ?? null);
  const packs = usePack((s) => s.packs);
  return packOf(packs, equip)?.info.pack_id === packId ? equip : null;
}

/** Every manual on the device, the active unit's first; or one, at /manual/<pack>. */
export function ManualHomePage() {
  const { packId } = useParams();
  const { packs, ids } = usePack();
  const active = useSettings((s) => s.activeUnit);
  const activeEquip = useFleet((s) => s.assets.find((a) => a.asset_id === active)?.equip_id ?? null);
  const first = packOf(packs, activeEquip)?.info.pack_id;
  const shown = packId ? [packId] : [...ids].sort((a, b) => (a === first ? -1 : b === first ? 1 : 0));
  const [contents, setContents] = useState<Record<string, SectionRef[]>>({});
  useEffect(() => {
    for (const id of shown)
      call("manual.children", { pack_id: id })
        .then((c) => setContents((cur) => ({ ...cur, [id]: c })))
        .catch((e: unknown) => reportError("manual.children", e, "A manual's contents could not be read."));
  }, [shown.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  if (packId && !packs[packId]) return <NotFound />;
  return (
    <ManualHome
      manuals={shown.map((id) => {
        const p = packs[id]!;
        return { packId: id, title: packTitle(p), edition: p.info.sources[0]?.edition ?? p.info.version, contents: contents[id] ?? null };
      })}
    />
  );
}

export function ManualSearchPage() {
  const { packId = "", q = "" } = useParams();
  const equip = useEquip(packId);
  const [hits, setHits] = useState<ManualHit[] | null>(null);
  useEffect(() => {
    setHits(null);
    call("manual.search", { pack_id: packId, query: q, equip_id: equip, k: 20 })
      .then((r) => setHits(r.hits))
      .catch((e: unknown) => reportError("manual.search", e, "The search did not run."));
  }, [packId, q, equip]);
  return <ManualResults key={q} packId={packId} query={q} hits={hits} />;
}

export function SectionPage() {
  const { packId = "", sectionId = "", assetId } = useParams();
  const equip = useEquip(packId);
  const src = useAssetSrc();
  const [view, setView] = useState<SectionView | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    call("manual.section", { pack_id: packId, section_id: sectionId, equip_id: equip })
      .then((v) => {
        setView(v);
        setMissing(false);
      })
      .catch((e: unknown) => {
        setMissing(true);
        reportError("manual.section", e, "This section could not be read.");
      });
  }, [packId, sectionId, equip]);
  if (!view || view.section.section_id !== sectionId) return missing ? <NotFound /> : null;
  // The section's own page image, else the page its citation points at.
  const page = pageFor(view.assets, view.citation);
  return (
    <ManualPack.Provider value={packId}>
      <SectionReader packId={packId} view={view} page={page} pageOpen={!!assetId && page?.asset_id === assetId} src={(a) => src(packId, a)} />
    </ManualPack.Provider>
  );
}
