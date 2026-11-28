import { useState, type ReactNode } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Link, useNavigate } from "react-router";
import type { Applicability, RowHit, RowView, TableSummary, TableView } from "../engine/types.ts";
import { manualPackPath, referenceLookupPath, referencePath, referenceRowPath, referenceTablePath } from "../routes.ts";
import { Undetermined, Applies } from "../ui/applicability.tsx";
import { Button, cx, inputClass, Page, Skeleton } from "../ui/kit.tsx";
import { groupTables, isCodeKey, kindLabel, RowCard, RowCells, RowCitation, rowKey } from "../ui/reference.tsx";

type Answer = (a: Applicability) => ReactNode;

function Trail({ packId, table }: { packId: string; table?: { table_id: string; title: string } }) {
  return (
    <nav aria-label="Where this sits" className="flex flex-wrap items-center gap-x-1">
      <Link to={manualPackPath(packId)} className="inline-flex min-h-11 items-center text-ink-2">
        Manual
      </Link>
      <ChevronRight aria-hidden size={16} />
      <Link to={referencePath(packId)} className="inline-flex min-h-11 items-center text-ink-2">
        Reference
      </Link>
      {table && (
        <>
          <ChevronRight aria-hidden size={16} />
          <Link to={referenceTablePath(packId, table.table_id)} className="inline-flex min-h-11 items-center text-ink-2">
            {table.title}
          </Link>
        </>
      )}
    </nav>
  );
}

function LookupBox({ packId, initial = "" }: { packId: string; initial?: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState(initial);
  return (
    <form
      role="search"
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) navigate(referenceLookupPath(packId, q.trim()));
      }}
    >
      <div className="relative min-w-0 flex-1">
        <Search aria-hidden size={22} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3" />
        <input type="text" enterKeyHint="search" aria-label="Look up a code, item or term" placeholder="Code, item or term" autoComplete="off" spellCheck={false} value={q} onChange={(e) => setQ(e.target.value)} className={cx(inputClass, "pl-12")} />
      </div>
      <Button type="submit" variant="primary" disabled={!q.trim()}>
        Look up
      </Button>
    </form>
  );
}

export interface ReferenceHomeProps {
  packId: string;
  /** The manual's title. */
  manual: string;
  tables: TableSummary[];
  /** The lookup, when one ran: its words and its rows (null while it runs). */
  lookup: { query: string; hits: RowHit[] | null } | null;
  /** The unit the rows are read for, if any. */
  unitName: string | null;
  renderAnswer?: Answer;
}

/** The manual's reference tables by kind, and one lookup box across them. */
export function ReferenceHome({ packId, manual, tables, lookup, unitName, renderAnswer }: ReferenceHomeProps) {
  const groups = groupTables(tables);
  return (
    <Page title="Reference" kicker={<Trail packId={packId} />} wide>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <LookupBox key={lookup?.query ?? ""} packId={packId} initial={lookup?.query ?? ""} />
          {unitName && <p className="text-small text-ink-2">Read for {unitName}.</p>}
          {lookup === null ? null : lookup.hits === null ? (
            <Skeleton className="h-[240px]" />
          ) : lookup.hits.length === 0 ? (
            <p className="text-body text-ink-2">No row in the reference tables matches. Try the code as shown, or search the manual.</p>
          ) : (
            <ol className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Rows found">
              {lookup.hits.map((h) => (
                <li key={h.row.row_id}>
                  <RowCard packId={packId} row={h.row} columns={tables.find((t) => t.table_id === h.table_id)?.columns ?? []} title={h.title} renderAnswer={renderAnswer} />
                </li>
              ))}
            </ol>
          )}
        </div>
        <aside className="flex min-w-0 flex-col gap-4" aria-label={`${manual} tables`}>
          {groups.length === 0 ? (
            <p className="text-body text-ink-2">This manual has no reference tables.</p>
          ) : (
            groups.map((g) => (
              <section key={g.kind} className="overflow-hidden rounded-panel border border-line bg-surface">
                <h2 className="px-4 pt-3 text-meta font-bold text-ink-3">{g.label}</h2>
                <ul className="m-0 list-none p-0">
                  {g.tables.map((t) => (
                    <li key={t.table_id} className="border-b border-line last:border-b-0">
                      <Link to={referenceTablePath(packId, t.table_id)} className="flex min-h-tap items-center gap-3 px-4 py-2.5 text-ink no-underline">
                        <span className="manual-text min-w-0 flex-1 text-body">{t.title}</span>
                        <span className="shrink-0 text-meta text-ink-3 tabular">{t.rows}</span>
                        <ChevronRight aria-hidden size={20} className="shrink-0 text-ink-3" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </aside>
      </div>
    </Page>
  );
}

const rowAnswer = (row: RowView, renderAnswer?: Answer) =>
  row.applicability?.status === "unknown" ? (renderAnswer ?? ((a: Applicability) => <Undetermined a={a} />))(row.applicability) : <Applies a={row.applicability} />;

export interface ReferenceTableProps {
  packId: string;
  table: TableView;
  unitName: string | null;
  renderAnswer?: Answer;
}

/** One table: every row, its cells under the manual's column labels, each opening on its own. */
export function ReferenceTable({ packId, table, unitName, renderAnswer }: ReferenceTableProps) {
  const code = isCodeKey(table.columns);
  return (
    <Page title={<span className="manual-text">{table.title}</span>} kicker={<Trail packId={packId} />} wide>
      <p className="text-small text-ink-2">
        {kindLabel(table.kind)}
        {unitName && `, read for ${unitName}`}
      </p>
      <ol className="m-0 grid list-none items-start gap-3 p-0 lg:grid-cols-2">
        {table.rows.map((r) => (
          <li key={r.row_id} className={cx("sheet flex min-w-0 flex-col gap-3 p-4", r.applicability?.status === "does_not_apply" && "opacity-70")} data-row={r.row_id}>
            <Link to={referenceRowPath(packId, table.table_id, r.ord)} className="flex min-h-11 items-center gap-2 text-ink no-underline">
              {code ? (
                <span className="inline-flex min-h-10 max-w-full items-center rounded-plate border-2 border-ink px-2.5 font-sans">
                  <span className="code truncate text-small">{rowKey(r, table.columns)}</span>
                </span>
              ) : (
                <span className="manual-text min-w-0 flex-1 text-lead font-semibold">{rowKey(r, table.columns)}</span>
              )}
              <ChevronRight aria-hidden size={20} className="ml-auto shrink-0 text-ink-3" />
            </Link>
            {rowAnswer(r, renderAnswer)}
            <RowCells row={r} columns={table.columns} renderAnswer={renderAnswer} />
          </li>
        ))}
      </ol>
      <p className="font-sans text-meta text-ink-3">
        {table.citation.citation}
        {table.citation.page_label && `, page ${table.citation.page_label}`}. {table.citation.source_title}, {table.citation.edition}.
      </p>
    </Page>
  );
}

export interface ReferenceRowProps {
  packId: string;
  table: Pick<TableView, "table_id" | "title" | "kind" | "columns">;
  row: RowView;
  unitName: string | null;
  /** A code whose rule names a troubleshooting tree: start it here. */
  start: { title: string; onStart(): void } | null;
  renderAnswer?: Answer;
}

/** One row as printed: every cell under its column label, its applicability, and its citation to the page. */
export function ReferenceRow({ packId, table, row, unitName, start, renderAnswer }: ReferenceRowProps) {
  const code = isCodeKey(table.columns);
  return (
    <Page title={code ? <span className="code">{rowKey(row, table.columns)}</span> : <span className="manual-text">{rowKey(row, table.columns)}</span>} kicker={<Trail packId={packId} table={table} />}>
      {unitName && <p className="text-small text-ink-2">Read for {unitName}.</p>}
      {rowAnswer(row, renderAnswer)}
      <section className="sheet flex flex-col gap-4 p-4 sm:p-5" aria-label={table.title}>
        <RowCells row={row} columns={table.columns} renderAnswer={renderAnswer} />
        <RowCitation packId={packId} row={row} />
      </section>
      {start && (
        <section className="flex flex-col gap-3 rounded-panel border border-line bg-surface p-4 sm:flex-row sm:items-center sm:p-5" aria-label="Troubleshoot">
          <p className="min-w-0 flex-1 text-body">
            The manual troubleshoots this in <span className="manual-text font-semibold">{start.title}</span>.
          </p>
          <Button variant="primary" onClick={start.onStart} className="shrink-0">
            Start here
          </Button>
        </section>
      )}
    </Page>
  );
}
