import { Fragment } from "react";
import { useNavigate } from "react-router";
import { BookMarked } from "lucide-react";
import type { Segment } from "../engine/types.ts";
import { engine } from "../engine/index.ts";
import { readerPath } from "../routes.ts";

/** A citation that opens the exact section in the reader. */
export function CitePlate({ sectionId }: { sectionId: string }) {
  const navigate = useNavigate();
  const s = engine().sections.get(sectionId);
  const label = s?.citation ?? sectionId;
  return (
    <button type="button" className="plate" onClick={() => navigate(readerPath(sectionId))} aria-label={`Open ${label}`}>
      <BookMarked aria-hidden size={17} />
      {label}
    </button>
  );
}

export function Quote({ sectionId, text, showCite = false }: { sectionId: string; text: string; showCite?: boolean }) {
  return (
    <figure className="m-0">
      <blockquote className="quote m-0 text-body text-ink">{text}</blockquote>
      {showCite && (
        <figcaption className="mt-2">
          <CitePlate sectionId={sectionId} />
        </figcaption>
      )}
    </figure>
  );
}

export function Diagram({ id }: { id: string }) {
  const d = engine().diagrams.get(id);
  if (!d) return null;
  return (
    <figure className="m-0 rounded-panel border border-line bg-surface p-4">
      {/* Pack SVG is static data from the signed pack, rendered as markup. */}
      <div className="diagram" role="img" aria-label={d.alt} dangerouslySetInnerHTML={{ __html: d.svg }} />
      <figcaption className="mt-3 text-small text-ink-2">{d.caption}</figcaption>
    </figure>
  );
}

/**
 * Render answer-segment JSON: text as paragraphs, quotes set apart as the
 * law, runs of citations as a row of plates.
 */
export function Segments({ body }: { body: readonly Segment[] }) {
  const blocks: ({ kind: "cites"; ids: string[] } | { kind: "seg"; seg: Segment })[] = [];
  for (const seg of body) {
    if (seg.t === "cite") {
      const last = blocks[blocks.length - 1];
      if (last?.kind === "cites") {
        if (!last.ids.includes(seg.section_id)) last.ids.push(seg.section_id);
      } else blocks.push({ kind: "cites", ids: [seg.section_id] });
    } else blocks.push({ kind: "seg", seg });
  }
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((b, i) => (
        <Fragment key={i}>
          {b.kind === "cites" ? (
            <div className="flex flex-wrap gap-2">
              {b.ids.map((id) => (
                <CitePlate key={id} sectionId={id} />
              ))}
            </div>
          ) : b.seg.t === "text" ? (
            <p className="m-0 text-body">{b.seg.text}</p>
          ) : b.seg.t === "quote" ? (
            <Quote sectionId={b.seg.section_id} text={b.seg.text} />
          ) : b.seg.t === "diagram" ? (
            <Diagram id={b.seg.diagram_id} />
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}

/** Plain text of an answer, for read-aloud. */
export function spokenText(body: readonly Segment[]): string {
  return body
    .flatMap((s) => {
      if (s.t === "text") return [s.text];
      if (s.t === "quote") return [s.text];
      if (s.t === "diagram") return [engine().diagrams.get(s.diagram_id)?.alt ?? ""];
      return [];
    })
    .join(" ");
}
