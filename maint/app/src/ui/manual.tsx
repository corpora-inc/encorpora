import { Undetermined } from "./applicability.tsx";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { FileText, Info, OctagonAlert, TriangleAlert, Users } from "lucide-react";
import { assetUrl } from "../engine/client.ts";
import type { Applicability, Citation, FieldNote, Guard, PackAsset, Requirement } from "../engine/types.ts";
import { manualPath } from "../routes.ts";
import { formatDate } from "./format.ts";
import { cx } from "./kit.tsx";

/** "Table 3-1, Question 1" plus its heading when the section has one. */
export const sectionTitle = (c: Citation) => (c.heading && !c.citation.includes(c.heading) ? `${c.citation} ${c.heading}` : c.citation);

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
 * The original page for a passage: the step's own page image, else the page
 * the citation points at (a signed pack asset the engine serves by id).
 */
export function pageFor(assets: PackAsset[], c: Citation): PackAsset | null {
  const own = assets.find((a) => a.role === "page");
  if (own) return own;
  return c.page_asset_id ? { asset_id: c.page_asset_id, bytes: 0, height: null, media_type: "image/png", path: "", role: "page", sha256: "", width: null } : null;
}

/** The pack whose manual a citation points into (set by the screen: the job's or the unit's pack). */
export const ManualPack = createContext<string>("");

/**
 * A cut of the printed page: the manual's exact words, its citation, and the
 * page number in the corner. The folio opens the original page.
 */
export function ManualSheet({ citation, onPage, children, className, size = "lead" }: { citation: Citation; onPage?: string; children: ReactNode; className?: string; size?: "lead" | "body" }) {
  return (
    <figure className={cx("sheet m-0", className)}>
      <blockquote className={cx("m-0 px-4 pt-4 pb-4 sm:px-5", size === "lead" ? "text-lead" : "text-body")}>{children}</blockquote>
      <figcaption className="flex flex-wrap items-stretch border-t border-line">
        <span className="min-w-0 grow basis-[14rem] px-4 py-2.5 font-sans text-meta text-ink-3 sm:px-5">{citationText(citation)}</span>
        <Folio citation={citation} to={onPage} />
      </figcaption>
    </figure>
  );
}

function Folio({ citation, to }: { citation: Citation; to?: string }) {
  const pack = useContext(ManualPack);
  // The page number when the source has pages; a web or digital source opens in the manual reader.
  const label = citation.page_label ? `Page ${citation.page_label}` : "In the manual";
  const body = (
    <>
      <FileText aria-hidden size={18} />
      <span>{label}</span>
    </>
  );
  const cls = "ml-auto flex min-h-11 shrink-0 items-center gap-1.5 self-end bg-sheet-line px-3 font-sans text-small font-bold whitespace-nowrap text-sheet no-underline tabular";
  return (
    <Link to={to ?? manualPath(pack, citation.section_id)} className={cls} aria-label={to ? `${label}: open the original page` : `${label}: open in the manual`}>
      {body}
    </Link>
  );
}

/**
 * A safety block is set by the tone the pack gives its class (from the
 * manual's own definition of the class), never by the class's name. The
 * band always prints the manual's own label. Rank orders classes only.
 */
/** Danger and warning tones keep a marker pinned when scrolled away. */
export const isGrave = (g: Guard) => g.tone === "danger" || g.tone === "warning";
/** The block the pinned marker names: the gravest by rank, the first of equals. */
export const gravest = (guards: Guard[]): Guard | null => guards.filter(isGrave).reduce<Guard | null>((best, g) => (!best || g.rank < best.rank ? g : best), null);

/** One safety block, as the manual sets it. A `must_show` block is never collapsible. */
export function GuardBlock({ guard, id, collapsible = false, applicability = null }: { guard: Guard; id?: string; collapsible?: boolean; applicability?: ReactNode }) {
  const tone = guard.tone;
  const [open, setOpen] = useState(false);
  const Icon = tone === "danger" || tone === "warning" ? OctagonAlert : tone === "caution" ? TriangleAlert : tone === "notice" ? Info : null;
  const folded = collapsible && !guard.must_show && !open;
  return (
    <section id={id} className={cx("guard scroll-mt-28", `guard-${tone}`)} aria-label={guard.label}>
      <div className="guard-band">
        {Icon && <Icon aria-hidden size={tone === "danger" ? 24 : 20} strokeWidth={2.5} />}
        <span>{guard.label}</span>
        {collapsible && !guard.must_show && (
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={!folded} className="ml-auto inline-flex min-h-11 items-center px-2 text-meta font-semibold tracking-normal underline underline-offset-4">
            {folded ? "Show" : "Hide"}
          </button>
        )}
      </div>
      {!folded && (
        <>
          {applicability}
          <p className={cx("px-4 py-3 sm:px-5", tone === "note" || tone === "notice" ? "text-body" : "text-lead font-semibold")}>{guard.text}</p>
          <p className="px-4 pb-2.5 font-sans text-meta text-ink-3 sm:px-5">
            {guard.citation.citation}
            {guard.citation.page_label && `, page ${guard.citation.page_label}`}
          </p>
        </>
      )}
    </section>
  );
}

/** With nobody to answer (print, no unit): the marker and the printed statement, never silence. */
export const markOnly = (a: Applicability) => <Undetermined a={a} />;

/**
 * Safety blocks in manual order. `collapsible`: the experienced levels may
 * fold blocks the pack does not mark `must_show`. `answer`: renders the
 * marker for a block whose applicability is not determined (never hidden).
 */
export function Guards({ guards, firstWarningId, collapsible = false, answer }: { guards: Guard[]; firstWarningId?: string; collapsible?: boolean; answer?: (a: NonNullable<Guard["applicability"]>) => ReactNode }) {
  if (guards.length === 0) return null;
  const first = guards.indexOf(gravest(guards) as Guard);
  return (
    <div className="flex flex-col gap-3">
      {guards.map((g, i) => (
        <GuardBlock
          key={`${g.section_id}-${i}`}
          guard={g}
          id={i === first ? firstWarningId : undefined}
          collapsible={collapsible}
          applicability={g.applicability && g.applicability.status === "unknown" ? <div className="px-4 pt-3 sm:px-5">{(answer ?? markOnly)(g.applicability)}</div> : null}
        />
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
