import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { reportError } from "@appkit/toast.ts";
import { call, EngineError } from "../engine/client.ts";
import type { EquipResolveParams, Resolved } from "../engine/types.ts";
import { unitPath, type IdentifyMode } from "../routes.ts";
import { Home } from "../screens/Home.tsx";
import { Identify, type IdentifyPhase } from "../screens/Identify.tsx";
import { NotFound } from "../screens/NotFound.tsx";
import { UnitPage } from "../screens/UnitPage.tsx";
import { useDescribe } from "../store/describe.ts";
import { useFleet } from "../store/fleet.ts";
import { isGeneral, usePack, variantName } from "../store/pack.ts";
import { useActiveUnit } from "./Frame.tsx";

export function HomePage() {
  const { loaded, assets, jobs, sync } = useFleet();
  const equipment = usePack((s) => s.equipment);
  const variants = Object.fromEntries(equipment.map((e) => [e.equip_id, e.name]));
  return <Home loading={!loaded} units={assets} variants={variants} openJobs={jobs.filter((j) => j.status === "open")} pending={sync?.pending ?? 0} lastSync={sync?.last_synced_at ?? null} />;
}

export function IdentifyPage() {
  const { mode = "type" } = useParams();
  const navigate = useNavigate();
  const equipment = usePack((s) => s.equipment);
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
          setResult(await call("equip.resolve", observed));
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
          const a = await useFleet.getState().create({ name: name.trim(), serial: observed.serial ?? null, equip_id: equipId, hours: hours.trim() && Number.isFinite(h) ? h : null });
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
  const equipment = usePack((s) => s.equipment);
  const unit = assets.find((a) => a.asset_id === unitId);
  const codes = useDescribe((s) => s.entries[unitId]?.codes);
  const match = useDescribe((s) => s.matches[unitId]);
  useActiveUnit(unit?.asset_id);
  useEffect(() => {
    if (unit) void useFleet.getState().loadHistory(unit.asset_id);
  }, [unit?.asset_id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (unit && codes?.length) void useDescribe.getState().matchCodes(unit.asset_id);
  }, [unit?.asset_id, codes]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!unit) return loaded ? <NotFound /> : null;
  const openJob = jobs.find((j) => j.asset_id === unit.asset_id && j.status === "open") ?? null;
  const titled = (codes ?? []).map((c) => ({ value: c.value, title: match?.hits.find((h) => h.observed.value === c.value)?.rule.title ?? null }));
  return <UnitPage unit={unit} variant={variantName(equipment, unit.equip_id)} history={history[unit.asset_id] ?? null} openJob={openJob} codes={titled} />;
}

