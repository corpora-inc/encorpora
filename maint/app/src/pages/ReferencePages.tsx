import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { reportError } from "@appkit/toast.ts";
import { call, EngineError, plainError } from "../engine/client.ts";
import type { PackInfoView, RowHit, TableView } from "../engine/types.ts";
import { jobPath } from "../routes.ts";
import { NotFound } from "../screens/NotFound.tsx";
import { ReferenceHome, ReferenceRow, ReferenceTable } from "../screens/Reference.tsx";
import { useAttrsRev } from "../store/attrs.ts";
import { useFleet } from "../store/fleet.ts";
import { useJobs } from "../store/jobs.ts";
import { packOf, packTitle, usePack } from "../store/pack.ts";
import { useSettings } from "../store/settings.ts";
import { unitName } from "../ui/format.ts";
import { ManualPack } from "../ui/manual.tsx";
import { keyColumn, rowKey } from "../ui/reference.tsx";
import { useAnswerer } from "./answer.tsx";

/** The active unit, when it belongs to this pack: rows are read for it (its variant and attributes). */
function useUnitIn(packId: string) {
  const active = useSettings((s) => s.activeUnit);
  const unit = useFleet((s) => s.assets.find((a) => a.asset_id === active) ?? null);
  const packs = usePack((s) => s.packs);
  return unit && packOf(packs, unit.equip_id)?.info.pack_id === packId ? unit : null;
}

const say = plainError;

export function ReferenceHomePage() {
  const { packId = "", q } = useParams();
  const pack = usePack((s) => s.packs[packId]);
  const unit = useUnitIn(packId);
  const rev = useAttrsRev(unit?.asset_id);
  const renderAnswer = useAnswerer(unit?.asset_id, packId);
  const [hits, setHits] = useState<RowHit[] | null>(null);
  useEffect(() => {
    if (!q) return;
    setHits(null);
    call("table.lookup", { pack_id: packId, query: q, asset_id: unit?.asset_id ?? null, equip_id: unit?.equip_id ?? null, k: 20 })
      .then(setHits)
      .catch((e: unknown) => {
        setHits([]);
        reportError("table.lookup", e, say(e, "The lookup did not run."));
      });
  }, [packId, q, unit?.asset_id, unit?.equip_id, rev]);
  if (!pack) return null;
  return (
    <ManualPack.Provider value={packId}>
      <ReferenceHome packId={packId} manual={packTitle(pack)} tables={pack.tables} lookup={q ? { query: q, hits } : null} unitName={unit ? unitName(unit) : null} renderAnswer={renderAnswer} />
    </ManualPack.Provider>
  );
}

function useTableView(packId: string, tableId: string) {
  const unit = useUnitIn(packId);
  const rev = useAttrsRev(unit?.asset_id);
  const [view, setView] = useState<TableView | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    call("table.get", { pack_id: packId, table_id: tableId, asset_id: unit?.asset_id ?? null, equip_id: unit?.equip_id ?? null })
      .then((v) => {
        setView(v);
        setMissing(false);
      })
      .catch((e: unknown) => {
        setMissing(true);
        reportError("table.get", e, say(e, "This table could not be read."));
      });
  }, [packId, tableId, unit?.asset_id, unit?.equip_id, rev]);
  return { view: view?.table_id === tableId ? view : null, missing, unit };
}

export function ReferenceTablePage() {
  const { packId = "", tableId = "" } = useParams();
  const { view, missing, unit } = useTableView(packId, tableId);
  const renderAnswer = useAnswerer(unit?.asset_id, packId);
  if (!view) return missing ? <NotFound /> : null;
  return (
    <ManualPack.Provider value={packId}>
      <ReferenceTable packId={packId} table={view} unitName={unit ? unitName(unit) : null} renderAnswer={renderAnswer} />
    </ManualPack.Provider>
  );
}

const pickLevel = (info: PackInfoView, level: string | null) => info.levels.find((l) => l.id === level)?.id ?? info.levels[0]?.id ?? "";

export function ReferenceRowPage() {
  const { packId = "", tableId = "", ord = "" } = useParams();
  const navigate = useNavigate();
  const info = usePack((s) => s.packs[packId]?.info);
  const level = useSettings((s) => s.level);
  const trees = usePack((s) => s.packs[packId]?.trees ?? []);
  const { view, missing, unit } = useTableView(packId, tableId);
  const renderAnswer = useAnswerer(unit?.asset_id, packId);
  const row = view?.rows.find((r) => String(r.ord) === ord) ?? null;
  // A code the manual troubleshoots: the signal rule for it names the tree to start.
  const [start, setStart] = useState<{ tree_id: string; node_id: string | null } | null>(null);
  const code = row && view && keyColumn(view.columns) ? rowKey(row, view.columns) : null;
  useEffect(() => {
    setStart(null);
    if (!unit || !code || !row) return;
    call("signal.match", { pack_id: packId, asset_id: unit.asset_id, observations: [{ signal_kind: null, value: code }] })
      .then((m) => {
        const h = m.hits.find((x) => x.row?.row_id === row.row_id && x.has_tree && x.rule.tree_id);
        setStart(h ? { tree_id: h.rule.tree_id!, node_id: h.rule.node_id } : null);
      })
      .catch((e: unknown) => reportError("reference.match", e, say(e, "The code could not be checked for troubleshooting.")));
  }, [packId, unit?.asset_id, code, row?.row_id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!view || !info) return missing ? <NotFound /> : null;
  if (!row) return <NotFound />;
  return (
    <ManualPack.Provider value={packId}>
      <ReferenceRow
        packId={packId}
        table={view}
        row={row}
        unitName={unit ? unitName(unit) : null}
        renderAnswer={renderAnswer}
        start={
          start && unit
            ? {
                title: trees.find((t) => t.tree_id === start.tree_id)?.title ?? start.tree_id,
                onStart: () =>
                  void useJobs
                    .getState()
                    .start({ pack_id: packId, asset_id: unit.asset_id, level: pickLevel(info, level), tree_id: start.tree_id, node_id: start.node_id, signals: [{ signal_kind: null, value: code! }] })
                    .then((id) => id && navigate(jobPath(id))),
              }
            : null
        }
      />
    </ManualPack.Provider>
  );
}
