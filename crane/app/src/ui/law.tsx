import { Fragment } from "react";
import { useNavigate } from "react-router";
import { BookMarked, CircleHelp } from "lucide-react";
import { useT } from "./useT.ts";
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

/**
 * A pack diagram, checked before it is drawn inline. Only drawing elements
 * and presentation attributes survive: no script, style, foreignObject,
 * event handler or link (CSP blocks those too; this keeps the markup clean).
 * Its own <style> sets colour for standalone viewing; here it takes the app's
 * ink and theme colours instead (.diagram in styles.css sets --crane-*).
 */
const SVG_TAGS = new Set(["svg", "g", "title", "desc", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan", "defs", "marker", "lineargradient", "radialgradient", "stop", "use", "symbol", "clippath", "mask", "pattern"]);
const cleanCache = new Map<string, string>();
export function cleanSvg(svg: string): string {
  const hit = cleanCache.get(svg);
  if (hit !== undefined) return hit;
  // <style> goes before parsing: even a parsed-only document applies it under the page's CSP.
  const doc = new DOMParser().parseFromString(svg.replace(/<style[\s\S]*?<\/style>/gi, ""), "image/svg+xml");
  const root = doc.documentElement;
  let out = "";
  if (root.nodeName.toLowerCase() === "svg" && !doc.querySelector("parsererror")) {
    // Comments, processing instructions and CDATA read differently once the markup is re-parsed as HTML:
    // comments and instructions go, CDATA becomes plain text.
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_PROCESSING_INSTRUCTION | NodeFilter.SHOW_CDATA_SECTION);
    const odd: Node[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) odd.push(n);
    for (const n of odd) {
      if (n.nodeType === Node.CDATA_SECTION_NODE) n.parentNode?.replaceChild(doc.createTextNode(n.nodeValue ?? ""), n);
      else n.parentNode?.removeChild(n);
    }
    for (const el of [root, ...root.querySelectorAll("*")]) {
      if (!SVG_TAGS.has(el.nodeName.toLowerCase())) {
        el.remove();
        continue;
      }
      for (const a of [...el.attributes]) {
        const name = a.name.toLowerCase();
        const local = name.includes(":") ? name.split(":")[1]! : name;
        // A link may only point inside the diagram (a marker or gradient by #id).
        if (name.startsWith("on") || name === "style" || ((local === "href") && !a.value.startsWith("#"))) el.removeAttribute(a.name);
      }
    }
    out = new XMLSerializer().serializeToString(root);
  }
  cleanCache.set(svg, out);
  return out;
}

export function Diagram({ id }: { id: string }) {
  const d = engine().diagrams.get(id);
  if (!d) return null;
  return (
    <figure className="m-0 rounded-panel border border-line bg-surface p-4">
      {/* The signed pack's SVG, reduced to drawing markup by cleanSvg before it is drawn. */}
      <div className="diagram" role="img" aria-label={d.alt} dangerouslySetInnerHTML={{ __html: cleanSvg(d.svg) }} />
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
            <p className="m-0 text-body">
              <Inline text={b.seg.text} />
            </p>
          ) : b.seg.t === "quote" ? (
            <Quote sectionId={b.seg.section_id} text={b.seg.text} />
          ) : b.seg.t === "diagram" ? (
            <Diagram id={b.seg.diagram_id} />
          ) : b.seg.t === "check" ? (
            <SelfCheck question={b.seg.question} answer={b.seg.answer} />
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}

/** Lesson text: "**term**" marks a term in bold; nothing else is markup. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return <>{parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : <Fragment key={i}>{p}</Fragment>))}</>;
}

/** A self-check: the learner answers in their head, then opens the answer. */
function SelfCheck({ question, answer }: { question: string; answer: string }) {
  const t = useT();
  return (
    <details className="self-check rounded-control border-2 border-line bg-surface">
      <summary className="flex min-h-tap cursor-pointer list-none items-start gap-3 px-4 py-3">
        <CircleHelp aria-hidden size={22} className="mt-0.5 shrink-0 text-ink-2" />
        <span className="flex-1">
          <span className="block text-meta font-semibold text-ink-2">{t("lesson.check")}</span>
          <span className="block text-body font-semibold">{question}</span>
        </span>
      </summary>
      <p className="m-0 border-t border-line px-4 py-3 text-body">
        <Inline text={answer} />
      </p>
    </details>
  );
}

/** Plain text of an answer, for read-aloud. */
export function spokenText(body: readonly Segment[]): string {
  return body
    .flatMap((s) => {
      if (s.t === "text") return [s.text];
      if (s.t === "quote") return [s.text];
      if (s.t === "diagram") return [engine().diagrams.get(s.diagram_id)?.alt ?? ""];
      if (s.t === "check") return [s.question];
      return [];
    })
    .join(" ");
}
