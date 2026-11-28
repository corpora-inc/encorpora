import { useContext, type ReactNode } from "react";
import type { Applicability, EntryPoint, SignalHit, SignalSection } from "../engine/types.ts";
import { Button } from "./kit.tsx";
import { ManualPack } from "./manual.tsx";
import { RowCard, useTable } from "./reference.tsx";

/** Columns whose cells say what to do: a row with one gives the manual's own corrective action. */
const ACTION_ROLES = ["remedy", "check"];

/**
 * A code the manual knows. When it resolves to a reference-table row, the
 * row as printed (meaning, causes, resolutions) and, if the rule names a
 * tree, the Start action; otherwise the entry's words and section.
 */
export function HitCard({ hit, onStart, renderAnswer }: { hit: SignalHit; onStart(e: EntryPoint): void; renderAnswer?: (a: Applicability) => ReactNode }) {
  const pack = useContext(ManualPack);
  const table = useTable(hit.row?.table_id ?? "");
  const start = hit.has_tree && hit.rule.tree_id ? () => onStart({ tree_id: hit.rule.tree_id!, node_id: hit.rule.node_id ?? "" }) : null;
  if (hit.row && table) {
    const acts = table.columns.some((c) => ACTION_ROLES.includes(c.role) && hit.row!.cells[c.id] !== undefined);
    return (
      <div className="flex flex-col gap-2" data-hit-row={hit.row.row_id}>
        <RowCard
          packId={pack}
          row={hit.row}
          columns={table.columns}
          title={table.title}
          renderAnswer={renderAnswer}
          action={
            start ? (
              <Button variant="primary" onClick={start} className="shrink-0 font-sans">
                Start here
              </Button>
            ) : undefined
          }
        />
        {!start && !acts && <p className="font-sans text-small text-ink-2">The manual gives no corrective action for this.</p>}
      </div>
    );
  }
  return <EntryCard code={hit.observed.value} title={hit.rule.title} quote={hit.rule.quote_verified ? hit.rule.quote : null} section={hit.has_tree ? null : hit.section} citation={hit.citation} start={start} />;
}

/**
 * One entry of the manual. With a tree it starts troubleshooting there; with
 * none it shows all the manual says and says plainly that it gives no
 * corrective action.
 */
export function EntryCard({ code, title, quote, section, citation, start }: { code?: string; title: string; quote: string | null; section: SignalSection | null; citation: string | null; start: (() => void) | null }) {
  return (
    <section className="sheet flex flex-col gap-3 p-4 sm:flex-row sm:items-center" aria-label={title}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 font-sans">
          {code && (
            <span className="inline-flex min-h-10 max-w-full items-center rounded-plate border-2 border-ink px-2.5">
              <span className="code truncate text-small">{code}</span>
            </span>
          )}
          <span className="text-small font-semibold">{title}</span>
        </div>
        {quote && <p className="mt-2 text-body">{quote}</p>}
        {section && <p className="mt-2 text-body">{section.text}</p>}
        {citation && <p className="mt-1 font-sans text-meta text-ink-3">{section?.citation ?? citation}</p>}
        {!start && <p className="mt-2 font-sans text-small text-ink-2">The manual gives no corrective action for this.</p>}
      </div>
      {start && (
        <Button variant="primary" onClick={start} className="shrink-0 font-sans">
          Start here
        </Button>
      )}
    </section>
  );
}
