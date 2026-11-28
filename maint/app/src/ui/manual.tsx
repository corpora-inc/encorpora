import type { ReactNode } from "react";
import { Link } from "react-router";
import { FileText, TriangleAlert, OctagonAlert, Users } from "lucide-react";
import type { Citation, FieldNote, Guard, Requirement } from "../engine/types.ts";
import { manualPath } from "../routes.ts";
import { cx } from "./kit.tsx";

/** "4.3.2 Suction strainer" from the section path's last entry. */
export const sectionTitle = (c: Citation) => c.section_path[c.section_path.length - 1] ?? c.section_id;

/** The full citation, in reading order: manual, edition, section, figure. The page sits on the folio. */
export function citationText(c: Citation): string {
  return [c.manual, c.edition, sectionTitle(c), c.figure].filter(Boolean).join(", ");
}

/**
 * A cut of the printed page: the manual's exact words, its citation, and the
 * page number in the corner. The folio opens the original page.
 */
export function ManualSheet({ citation, onPage, children, className, size = "lead" }: { citation: Citation; onPage?: string; children: ReactNode; className?: string; size?: "lead" | "body" }) {
  return (
    <figure className={cx("sheet m-0", className)}>
      <blockquote className={cx("m-0 px-4 pt-4 pb-4 sm:px-5", size === "lead" ? "text-lead" : "text-body")}>{children}</blockquote>
      <figcaption className="flex items-stretch border-t border-line">
        <span className="min-w-0 flex-1 px-4 py-2.5 font-sans text-meta text-ink-3 sm:px-5">{citationText(citation)}</span>
        <Folio citation={citation} to={onPage} />
      </figcaption>
    </figure>
  );
}

function Folio({ citation, to }: { citation: Citation; to?: string }) {
  const label = citation.page ? `Page ${citation.page}` : citation.section_id;
  const body = (
    <>
      <FileText aria-hidden size={18} />
      <span>{label}</span>
    </>
  );
  const cls = "flex min-h-11 shrink-0 items-center gap-1.5 self-end bg-sheet-line px-3 font-sans text-small font-bold whitespace-nowrap text-sheet no-underline tabular";
  return to ? (
    <Link to={to} className={cls} aria-label={`${label}: open the original page`}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}

const GUARD_LABEL = { warning: "WARNING", caution: "CAUTION", note: "NOTE" } as const;

/** One WARNING, CAUTION or NOTE, as the manual sets it. Never collapsible. */
export function GuardBlock({ guard }: { guard: Guard }) {
  const Icon = guard.kind === "warning" ? OctagonAlert : guard.kind === "caution" ? TriangleAlert : null;
  return (
    <section className={cx("guard", `guard-${guard.kind}`)} aria-label={GUARD_LABEL[guard.kind]}>
      <div className="guard-band">
        {Icon && <Icon aria-hidden size={20} strokeWidth={2.5} />}
        <span>{GUARD_LABEL[guard.kind]}</span>
      </div>
      <p className={cx("px-4 py-3 sm:px-5", guard.kind === "note" ? "text-body" : "text-lead font-semibold")}>{guard.text}</p>
      <p className="px-4 pb-2.5 font-sans text-meta text-ink-3 sm:px-5">
        {sectionTitle(guard.citation)}
        {guard.citation.page && `, page ${guard.citation.page}`}
      </p>
    </section>
  );
}

export function Guards({ guards }: { guards: Guard[] }) {
  if (guards.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {guards.map((g, i) => (
        <GuardBlock key={i} guard={g} />
      ))}
    </div>
  );
}

/** Approved field knowledge, in its own panel. Never set in the manual's type. */
export function FieldNotes({ notes, compact = false }: { notes: FieldNote[]; compact?: boolean }) {
  if (notes.length === 0) return null;
  return (
    <section className="field p-4" aria-labelledby="field-notes">
      <div className="mb-3 flex items-start gap-2.5">
        <Users aria-hidden size={22} className="mt-0.5 shrink-0" />
        <div>
          <h2 id="field-notes" className="text-small font-bold">
            Field notes
          </h2>
          <p className="text-meta">From technicians, reviewed. Not part of the manual.</p>
        </div>
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {notes.map((n) => (
          <li key={n.note_id} className="rounded-control bg-surface/60 p-3">
            <p className={compact ? "text-small" : "text-body"}>{n.text}</p>
            <p className="mt-1.5 text-meta opacity-90">
              {n.cause && <>Cause found: {n.cause}. </>}
              Seen {n.times_seen} {n.times_seen === 1 ? "time" : "times"}. Approved {n.approved_at} by {n.reviewer}.
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const REQ_LABEL: Record<Requirement["kind"], string> = {
  tool: "Tools",
  part: "Parts",
  consumable: "Consumables",
  personnel: "Personnel",
  condition: "Equipment condition",
  reference: "References",
};

/** Tools, parts and setup, grouped by kind, in the manual's words. */
export function Requirements({ items, columns = false }: { items: Requirement[]; columns?: boolean }) {
  if (items.length === 0) return null;
  const kinds = [...new Set(items.map((r) => r.kind))];
  return (
    <div className={cx("grid gap-4", columns && "sm:grid-cols-2")}>
      {kinds.map((k) => (
        <div key={k}>
          <h3 className="mb-1.5 text-meta font-bold text-ink-2">{REQ_LABEL[k]}</h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {items
              .filter((r) => r.kind === k)
              .map((r, i) => (
                <li key={i} className="flex gap-3 text-small">
                  <span className="manual-text min-w-0 flex-1">{r.text}</span>
                  {(r.ident || r.qty) && (
                    <span className="shrink-0 text-right text-meta text-ink-3">
                      {r.ident && <span className="code">{r.ident}</span>}
                      {r.ident && r.qty && " "}
                      {r.qty && <span className="tabular">x{r.qty}</span>}
                    </span>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** A link into the manual for any citation. */
export function CiteLink({ citation, className }: { citation: Citation; className?: string }) {
  return (
    <Link to={manualPath(citation.section_id)} className={cx("text-meta font-semibold text-ink-2 underline decoration-line-strong underline-offset-4", className)}>
      {sectionTitle(citation)}
      {citation.page && `, page ${citation.page}`}
    </Link>
  );
}
