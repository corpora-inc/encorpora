import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { reportError } from "@appkit/toast.ts";
import { call, EngineError } from "../engine/client.ts";
import type { EquipResolveParams, Resolved } from "../engine/types.ts";
import { referencePath, unitPath, type IdentifyMode } from "../routes.ts";
import { Home } from "../screens/Home.tsx";
import { Identify, type IdentifyPhase } from "../screens/Identify.tsx";
import { NotFound } from "../screens/NotFound.tsx";
import { UnitPage } from "../screens/UnitPage.tsx";
import { useAttrs } from "../store/attrs.ts";
import { useDescribe } from "../store/describe.ts";
import { useFleet } from "../store/fleet.ts";
import { allEquipment, isGeneral, packOf, usePack, variantName } from "../store/pack.ts";
import { useActiveUnit } from "./Frame.tsx";

export function HomePage() {
  const { loaded, assets, jobs, sync } = useFleet();
  const equipment = allEquipment(usePack((s) => s.packs));
  const variants = Object.fromEntries(equipment.map((e) => [e.equip_id, e.name]));
  return <Home loading={!loaded} units={assets} variants={variants} openJobs={jobs.filter((j) => j.status === "open")} pending={sync?.pending ?? 0} lastSync={sync?.last_synced_at ?? null} />;
}

export function IdentifyPage() {
  const { mode = "type" } = useParams();
  const navigate = useNavigate();
  const packs = usePack((s) => s.packs);
  const equipment = allEquipment(packs);
  const [observed, setObserved] = useState<EquipResolveParams>({});
  const [phase, setPhase] = useState<IdentifyPhase>("entry");
  const [result, setResult] = useState<Resolved | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [hours, setHours] = useState("");
  const [saving, setSaving] = useState(false);
  const equipId = result?.ambiguous ? picked : (result?.equip_id ?? null);
  return (
    <Identify
      mode={(["type", "scan", "connect"].includes(mode) ? mode : "type") as IdentifyMode}
      phase={phase}
      observed={observed}
      result={result}
      general={!result?.ambiguous && isGeneral(equipment, equipId)}
      picked={picked}
      name={name}
      hours={hours}
      saving={saving}
      canConnect={false}
      onObserved={(o) => {
        setObserved(o);
        if (phase === "done") setPhase("entry");
      }}
      onResolve={async () => {
        setPhase("resolving");
        try {
          // Each pack resolves within its own equipment family; the plate matches in one, several or none.
          const all = await Promise.all(Object.keys(packs).map((pack_id) => call("equip.resolve", { ...observed, pack_id })));
          const hits = all.filter((r) => r.equip_id);
          setResult(
            hits.length === 0
              ? (all[0] ?? null)
              : hits.length === 1
                ? hits[0]!
                : { ambiguous: true, attrs: {}, candidates: hits.flatMap((r) => r.candidates), equip_id: null, name: null, rejected: hits.flatMap((r) => r.rejected) },
          );
          setPicked(null);
          setPhase("done");
        } catch (e) {
          setPhase("entry");
          reportError("identify.resolve", e, e instanceof EngineError ? e.message : "The plate could not be checked against the manual.");
        }
      }}
      onPick={setPicked}
      onName={setName}
      onHours={setHours}
      onSave={async () => {
        if (!equipId) return;
        setSaving(true);
        try {
          const h = Number(hours);
          const pack = packOf(packs, equipId);
          if (!pack) throw new Error(`No pack holds ${equipId}`);
          const a = await useFleet.getState().create({ name: name.trim(), serial: observed.serial ?? null, equip_id: equipId, hours: hours.trim() && Number.isFinite(h) ? h : null }, pack.info.pack_id);
          // What the plate says (serial, model, firmware) is kept on the unit, marked as from the data plate.
          const { pack_id: _, ...plate } = observed;
          await useAttrs.getState().fromPlate(a.asset_id, plate, pack.info.pack_id);
          navigate(unitPath(a.asset_id), { replace: true });
        } catch (e) {
          reportError("identify.save", e, e instanceof EngineError ? e.message : "The unit could not be saved.");
        } finally {
          setSaving(false);
        }
      }}
      onConnect={() => {}}
    />
  );
}

export function UnitRoute() {
  const { unitId = "" } = useParams();
  const { loaded, assets, jobs, history } = useFleet();
  const packs = usePack((s) => s.packs);
  const equipment = allEquipment(packs);
  const unit = assets.find((a) => a.asset_id === unitId);
  const codes = useDescribe((s) => s.entries[unitId]?.codes);
  const attrs = useAttrs((s) => s.byAsset[unitId] ?? null);
  const attrsSaving = useAttrs((s) => !!s.saving[unitId]);
  const unitPack = packOf(packs, unit?.equip_id);
  const match = useDescribe((s) => s.matches[unitId]);
  useActiveUnit(unit?.asset_id);
  useEffect(() => {
    if (unit) void useFleet.getState().loadHistory(unit.asset_id);
  }, [unit?.asset_id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (unit) void useAttrs.getState().load(unit.asset_id, unitPack?.info.pack_id);
  }, [unit?.asset_id, unitPack?.info.pack_id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const pack = packOf(packs, unit?.equip_id);
    if (unit && pack && codes?.length) void useDescribe.getState().matchCodes(unit.asset_id, pack.info.pack_id);
  }, [unit?.asset_id, codes]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!unit) return loaded ? <NotFound /> : null;
  const openJob = jobs.find((j) => j.asset_id === unit.asset_id && j.status === "open") ?? null;
  const titled = (codes ?? []).map((c) => ({ value: c.value, title: match?.hits.find((h) => h.observed.value === c.value)?.rule.title ?? null }));
  return (
    <UnitPage
      unit={unit}
      variant={variantName(equipment, unit.equip_id)}
      history={history[unit.asset_id] ?? null}
      openJob={openJob}
      codes={titled}
      attrs={attrs}
      attrsSaving={attrsSaving}
      onAttr={(attr, value) => void useAttrs.getState().set(unit.asset_id, { [attr]: value }, unitPack?.info.pack_id)}
      referenceTo={unitPack && unitPack.tables.length > 0 ? referencePath(unitPack.info.pack_id) : null}
    />
  );
}

