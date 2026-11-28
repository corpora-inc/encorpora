import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { reportError } from "@appkit/toast.ts";
import { call } from "../engine/client.ts";
import type { ManualHit, SectionRef, SectionView } from "../engine/types.ts";
import { ManualHome, ManualResults, SectionReader } from "../screens/Manual.tsx";
import { NotFound } from "../screens/NotFound.tsx";
import { useAttrsRev } from "../store/attrs.ts";
import { useFleet } from "../store/fleet.ts";
import { useAnswerer } from "./answer.tsx";
import { packOf, packTitle, usePack } from "../store/pack.ts";
import { useSettings } from "../store/settings.ts";
import { ManualPack, pageFor, useAssetSrc } from "../ui/manual.tsx";

/** The active unit's variant, when it belongs to this pack: the engine marks what applies to it. */
function useEquip(packId: string) {
  return useUnitIn(packId)?.equip_id ?? null;
}

/** The active unit, when it belongs to this pack: rows and statements are read for its attributes. */
function useUnitIn(packId: string) {
  const active = useSettings((s) => s.activeUnit);
  const unit = useFleet((s) => s.assets.find((a) => a.asset_id === active) ?? null);
  const packs = usePack((s) => s.packs);
  return unit && packOf(packs, unit.equip_id)?.info.pack_id === packId ? unit : null;
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
        return { packId: id, title: packTitle(p), edition: p.info.sources[0]?.edition ?? p.info.version, contents: contents[id] ?? null, tables: p.tables.length };
      })}
    />
  );
}

export function ManualSearchPage() {
  const { packId = "", q = "" } = useParams();
  const equip = useEquip(packId);
  const asset = useUnitIn(packId)?.asset_id ?? null;
  const rev = useAttrsRev(asset);
  const renderAnswer = useAnswerer(asset, packId);
  const [hits, setHits] = useState<ManualHit[] | null>(null);
  useEffect(() => {
    setHits(null);
    call("manual.search", { pack_id: packId, query: q, equip_id: equip, asset_id: asset, k: 20 })
      .then((r) => setHits(r.hits))
      .catch((e: unknown) => reportError("manual.search", e, "The search did not run."));
  }, [packId, q, equip, asset, rev]);
  return (
    <ManualPack.Provider value={packId}>
      <ManualResults key={q} packId={packId} query={q} hits={hits} renderAnswer={renderAnswer} />
    </ManualPack.Provider>
  );
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
