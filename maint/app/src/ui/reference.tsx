import { createContext, useContext, type ReactNode } from "react";
import { Link } from "react-router";
import type { Applicability, Cell, Column, RowView, TableSummary } from "../engine/types.ts";
import { manualPagePath, manualPath, referenceRowPath } from "../routes.ts";
import { Applies, Undetermined } from "./applicability.tsx";
import { cx } from "./kit.tsx";
import { ManualPack } from "./manual.tsx";

/** How the app names a table kind; a kind the app does not know reads as the pack writes it. */
export const KIND_LABEL: Record<string, string> = {
  spec: "Specifications",
  indicator: "Indicator patterns",
  message: "Messages and codes",
  schedule: "Schedules",
  command: "Commands",
  parameter: "Parameters",
  abbreviation: "Abbreviations",
};
export const KIND_ORDER = ["spec", "indicator", "message", "schedule", "command", "parameter", "abbreviation"];
export const kindLabel = (k: string) => KIND_LABEL[k] ?? k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " ");

/** Tables grouped by kind, the known kinds in their order, then any others. */
export function groupTables(tables: TableSummary[]): { kind: string; label: string; tables: TableSummary[] }[] {
  const kinds = [...new Set(tables.map((t) => t.kind))].sort((a, b) => (KIND_ORDER.indexOf(a) + 1 || 99) - (KIND_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b));
  return kinds.map((kind) => ({ kind, label: kindLabel(kind), tables: tables.filter((t) => t.kind === kind) }));
}

/** Each pack's reference tables, so a row anywhere (a code, a search hit) gets its column labels. */
export const RefTables = createContext<Record<string, TableSummary[]>>({});
export function useTable(tableId: string): TableSummary | null {
  const pack = useContext(ManualPack);
  return useContext(RefTables)[pack]?.find((t) => t.table_id === tableId) ?? null;
}

/** Roles that name a row (its code, pattern or item): shown as its heading, not a cell. */
const KEY_ROLES = ["key", "code", "pattern", "item"];
export const keyColumn = (columns: Column[]) => columns.find((c) => KEY_ROLES.includes(c.role)) ?? null;

/** One cell exactly as printed: text, an ordered list, or a printed value with its unit. */
export function CellValue({ cell }: { cell: Cell }) {
  if (Array.isArray(cell))
    return (
      <ol className="m-0 flex list-decimal flex-col gap-1 pl-6">
        {cell.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ol>
    );
  if (typeof cell === "string") return <span>{cell}</span>;
  // The printed text carries the value, its unit and its limits; a unit it leaves out is added beside it.
  return (
    <span className="tabular">
      {cell.text}
      {cell.unit && !cell.text.includes(cell.unit) && <span className="ml-1 font-sans text-meta text-ink-2">{cell.unit}</span>}
    </span>
  );
}

const muted = (a: Applicability | null | undefined) => a?.status === "does_not_apply";

/**
 * A row's cells under their column labels, in the manual's type; the key
 * cell heads it. Each cell's applicability is marked; an undetermined one
 * asks for the unit's attribute in place.
 */
export function RowCells({ row, columns, renderAnswer, skipKey = true }: { row: RowView; columns: Column[]; renderAnswer?: (a: Applicability) => ReactNode; skipKey?: boolean }) {
  const key = keyColumn(columns);
  const shown = columns.filter((c) => !(skipKey && c.id === key?.id) && row.cells[c.id] !== undefined);
  return (
    <dl className="m-0 flex flex-col gap-3">
      {shown.map((c) => {
        const a = row.cell_applicability[c.id] ?? null;
        return (
          <div key={c.id} className={cx("flex flex-col gap-1", muted(a) && "opacity-60")} data-cell={c.id}>
            <dt className="font-sans text-meta font-semibold text-ink-2">{c.label}</dt>
            <dd className="m-0 manual-text text-body">
              <CellValue cell={row.cells[c.id]!} />
            </dd>
            {a?.status === "unknown" ? (renderAnswer ?? ((x: Applicability) => <Undetermined a={x} />))(a) : <Applies a={a} />}
          </div>
        );
      })}
    </dl>
  );
}

/** The row's heading: its key cell (a code, a pattern, an item) as printed. */
export function rowKey(row: RowView, columns: Column[]): string {
  const key = keyColumn(columns);
  const c = key ? row.cells[key.id] : undefined;
  return typeof c === "string" ? c : Array.isArray(c) ? c.join(", ") : c ? c.text : `${row.ord}`;
}

/** The row's citation, opening the page it is printed on (or its section). */
export function RowCitation({ packId, row }: { packId: string; row: RowView }) {
  const c = row.citation;
  const to = c.page_asset_id ? manualPagePath(packId, c.section_id, c.page_asset_id) : manualPath(packId, c.section_id);
  return (
    <Link to={to} className="inline-flex min-h-11 items-center font-sans text-meta text-ink-2">
      {c.citation}
      {c.page_label && `, page ${c.page_label}`}
    </Link>
  );
}

/** A code or pattern sits on a plate chip; an item (a specification's line) reads as manual text. */
export const isCodeKey = (columns: Column[]) => keyColumn(columns)?.role !== "item";

function RowHead({ packId, row, columns, title }: { packId: string; row: RowView; columns: Column[]; title: string }) {
  const to = referenceRowPath(packId, row.table_id, row.ord);
  return isCodeKey(columns) ? (
    <div className="flex flex-wrap items-center gap-2 font-sans">
      <span className="inline-flex min-h-10 max-w-full items-center rounded-plate border-2 border-ink px-2.5">
        <span className="code truncate text-small">{rowKey(row, columns)}</span>
      </span>
      <Link to={to} className="inline-flex min-h-11 items-center text-small font-semibold text-ink">
        {title}
      </Link>
    </div>
  ) : (
    <div className="flex flex-col font-sans">
      <Link to={to} className="inline-flex min-h-11 items-center text-meta font-semibold text-ink-2">
        {title}
      </Link>
      <span className="manual-text text-lead font-semibold">{rowKey(row, columns)}</span>
    </div>
  );
}

/** A compact row card (search hits, a code read off the unit): key, cells, citation, and a link to the row. */
export function RowCard({ packId, row, columns, title, renderAnswer, action }: { packId: string; row: RowView; columns: Column[]; title: string; renderAnswer?: (a: Applicability) => ReactNode; action?: ReactNode }) {
  const a = row.applicability;
  return (
    <section className={cx("sheet flex flex-col gap-3 p-4", muted(a) && "opacity-70")} aria-label={`${title} ${rowKey(row, columns)}`}>
      <RowHead packId={packId} row={row} columns={columns} title={title} />
      {a?.status === "unknown" ? (renderAnswer ?? ((x: Applicability) => <Undetermined a={x} />))(a) : <Applies a={a} />}
      <RowCells row={row} columns={columns} renderAnswer={renderAnswer} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RowCitation packId={packId} row={row} />
        {action}
      </div>
    </section>
  );
}
