import { createContext, useContext, type ReactNode } from "react";
import { Link } from "react-router";
import { FileText, OctagonAlert, TriangleAlert, Users } from "lucide-react";
import { assetUrl } from "../engine/client.ts";
import type { Citation, FieldNote, Guard, PackAsset, Requirement } from "../engine/types.ts";
import { manualPath } from "../routes.ts";
import { formatDate } from "./format.ts";
import { cx } from "./kit.tsx";

/** "Table 3-1, Question 1" plus its heading when the section has one. */
export const sectionTitle = (c: Citation) => [c.citation, c.heading].filter(Boolean).join(" ");

/** The full citation in reading order: manual, edition, section, figure. The page sits on the folio. */
export function citationText(c: Citation): string {
  return [c.source_title, c.edition, sectionTitle(c), c.figure_label].filter(Boolean).join(", ");
}

/** Short form for lists: the section and its page. */
export const citationShort = (c: Citation) => `${sectionTitle(c)}${c.page_label ? `, page ${c.page_label}` : ""}`;

/**
 * Where a pack image is served. The engine serves it; the design gallery
 * swaps in captured copies so it renders with no engine running.
 */
export const AssetSource = createContext<(packId: string, asset: PackAsset) => string>((packId, a) => assetUrl(packId, a.asset_id));
export const useAssetSrc = () => useContext(AssetSource);

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
  const label = citation.page_label ? `Page ${citation.page_label}` : citation.citation;
  const body = (
    <>
      <FileText aria-hidden size={18} />
      <span>{label}</span>
    </>
  );
  const cls = "flex min-h-11 shrink-0 items-center gap-1.5 self-end bg-sheet-line px-3 font-sans text-small font-bold whitespace-nowrap text-sheet no-underline tabular";
  return (
    <Link to={to ?? manualPath(citation.section_id)} className={cls} aria-label={to ? `${label}: open the original page` : `${label}: open in the manual`}>
      {body}
    </Link>
  );
}

const GUARD_KINDS = ["warning", "caution", "note"] as const;
type GuardKind = (typeof GUARD_KINDS)[number];
/** The engine names the kind; anything it adds later is shown as a note, never dropped. */
export const guardKind = (k: string): GuardKind => ((GUARD_KINDS as readonly string[]).includes(k) ? (k as GuardKind) : "note");

/** One WARNING, CAUTION or NOTE, as the manual sets it. Never collapsible. */
export function GuardBlock({ guard, id }: { guard: Guard; id?: string }) {
  const kind = guardKind(guard.kind);
  const Icon = kind === "warning" ? OctagonAlert : kind === "caution" ? TriangleAlert : null;
  const label = (guard.heading ?? guard.kind).toUpperCase();
  return (
    <section id={id} className={cx("guard scroll-mt-28", `guard-${kind}`)} aria-label={label}>
      <div className="guard-band">
        {Icon && <Icon aria-hidden size={20} strokeWidth={2.5} />}
        <span>{label}</span>
      </div>
      <p className={cx("px-4 py-3 sm:px-5", kind === "note" ? "text-body" : "text-lead font-semibold")}>{guard.text}</p>
      <p className="px-4 pb-2.5 font-sans text-meta text-ink-3 sm:px-5">
        {guard.citation.citation}
        {guard.citation.page_label && `, page ${guard.citation.page_label}`}
      </p>
    </section>
  );
}

export function Guards({ guards, firstWarningId }: { guards: Guard[]; firstWarningId?: string }) {
  if (guards.length === 0) return null;
  const first = guards.findIndex((g) => guardKind(g.kind) === "warning");
  return (
    <div className="flex flex-col gap-3">
      {guards.map((g, i) => (
        <GuardBlock key={`${g.section_id}-${i}`} guard={g} id={i === first ? firstWarningId : undefined} />
      ))}
    </div>
  );
}

const counts = (n: FieldNote) => {
  const c = n.counts;
  if (c.resolved != null && c.attempts != null) return `Fixed it ${c.resolved} of ${c.attempts} ${c.attempts === 1 ? "time" : "times"}.`;
  if (c.units != null) return `Seen on ${c.units} ${c.units === 1 ? "unit" : "units"}.`;
  return "";
};

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
              {counts(n)} Approved {formatDate(n.approved_at)} by {n.approver}.
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const REQ_ORDER = ["condition", "tool", "part", "consumable", "personnel", "reference"];
const REQ_LABEL: Record<string, string> = {
  condition: "Equipment condition",
  tool: "Tools",
  part: "Parts",
  consumable: "Consumables",
  personnel: "Personnel",
  reference: "References",
};

/**
 * Setup, tools and parts, grouped by kind. A line the engine marks verbatim is
 * set in the manual's type; any other line is not presented as the manual's words.
 */
export function Requirements({ items, columns = false }: { items: Requirement[]; columns?: boolean }) {
  if (items.length === 0) return null;
  const kinds = [...new Set(items.map((r) => r.kind))].sort((a, b) => rank(a) - rank(b));
  return (
    <div className={cx("grid gap-4", columns && "sm:grid-cols-2")}>
      {kinds.map((k) => (
        <div key={k}>
          <h3 className="mb-1.5 text-meta font-bold text-ink-2">{REQ_LABEL[k] ?? k}</h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {items
              .filter((r) => r.kind === k)
              .map((r) => (
                <li key={`${r.ref_kind}-${r.ref_id}-${r.ord}`} className="flex gap-3 text-small">
                  <span className={cx("min-w-0 flex-1", r.verbatim && "manual-text")}>{r.text}</span>
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
const rank = (k: string) => {
  const i = REQ_ORDER.indexOf(k);
  return i < 0 ? REQ_ORDER.length : i;
};
