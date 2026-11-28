import { useLayoutEffect, useMemo } from "react";
import { Link, useParams } from "react-router";
import { engine } from "../engine/index.ts";
import type { Section } from "../engine/types.ts";
import { readerPath } from "../routes.ts";
import { useSettings } from "../store/settings.ts";
import { Page, Panel } from "../ui/kit.tsx";
import { CitePlate } from "../ui/law.tsx";
import { useT } from "../ui/useT.ts";

/** The paragraph label: "(a)(2)" -> "(2)". */
const label = (s: Section) => (s.depth === 0 ? "" : (/\([^()]+\)$/.exec(s.section_id)?.[0] ?? ""));

function Node({ s, target, path }: { s: Section; target: string; path: Set<string> }) {
  const kids = engine().children(s.section_id);
  const isTarget = s.section_id === target;
  // Headings already lead the paragraph text ("Each shift. …"); show them only when the text is empty.
  const heading = s.heading && s.depth > 0 && !s.text.startsWith(s.heading) ? s.heading : null;
  return (
    <div id={`s-${s.section_id}`} className={s.depth > 0 ? "pl-3 sm:pl-5" : ""}>
      {(s.text || heading) && (
        <div id={isTarget ? "reader-target" : undefined} className={`reader-target -mx-2 rounded-control px-2 py-2 ${isTarget ? "target-flash" : ""}`} aria-current={isTarget ? "true" : undefined}>
          <p className="m-0 text-body">
            {label(s) && (
              <Link to={readerPath(s.section_id)} className="mr-2 font-display font-semibold text-ink no-underline tabular">
                {label(s)}
              </Link>
            )}
            {heading && <em className="mr-1">{heading}.</em>}
            {s.text}
          </p>
        </div>
      )}
      {kids.map((k) => (
        <Node key={k.section_id} s={k} target={target} path={path} />
      ))}
    </div>
  );
}

export function Reader() {
  const { id = "" } = useParams();
  const t = useT();
  const role = useSettings((s) => s.role) ?? "operator";
  const lang = useSettings((s) => s.lang);
  const e = engine();
  const section = e.sections.get(id);
  const ancestors = useMemo(() => (section ? e.ancestors(id) : []), [e, id, section]);
  const root = ancestors[0];
  useLayoutEffect(() => {
    if (!section || section.depth === 0) {
      window.scrollTo(0, 0);
      return;
    }
    // The paragraph itself, not its subtree: a long list of sub-paragraphs must not push its top off screen.
    // Its top lands a header's height below the top (scroll-margin in .reader-target).
    (document.getElementById("reader-target") ?? document.getElementById(`s-${id}`))?.scrollIntoView({ block: "start" });
  }, [id, section]);

  if (!section || !root)
    return (
      <Page title={t("notFound.title")} up="back">
        <p className="m-0">{t("notFound.section", { id })}</p>
      </Page>
    );
  const source = e.info.sources.find((s) => s.source_id === root.source_id);
  const plain = e.explanation(id, role, lang) ?? (id !== root.section_id ? null : e.explanation(root.section_id, role, lang));
  const out = e.xrefsFrom(id);
  const into = e.xrefsTo(id);
  return (
    <Page title={root.heading ?? root.citation} up="back">
      <nav aria-label={t("reader.path")} className="-mt-3 flex flex-wrap items-center gap-x-1 gap-y-1 text-small text-ink-2">
        {source && <span>{source.title}</span>}
        {ancestors.map((a) => (
          <span key={a.section_id} className="flex items-center gap-1">
            <span aria-hidden>›</span>
            {a.section_id === id ? (
              <span className="font-semibold text-ink tabular">{a === root ? a.citation : label(a)}</span>
            ) : (
              <Link to={readerPath(a.section_id)} className="tabular text-ink-2">
                {a === root ? a.citation : label(a)}
              </Link>
            )}
          </span>
        ))}
      </nav>
      {plain && (
        <Panel>
          <h2 className="mb-2 text-h3">{t("reader.plain")}</h2>
          <p className="m-0">{plain}</p>
        </Panel>
      )}
      <article className="flex flex-col">
        <Node s={root} target={id} path={new Set(ancestors.map((a) => a.section_id))} />
      </article>
      {(out.length > 0 || into.length > 0) && (
        <Panel>
          {out.length > 0 && (
            <>
              <h2 className="mb-3 text-h3">{t("reader.refersTo")}</h2>
              <div className="mb-4 flex flex-wrap gap-2">
                {out.map((x) => (
                  <CitePlate key={x} sectionId={x} />
                ))}
              </div>
            </>
          )}
          {into.length > 0 && (
            <>
              <h2 className="mb-3 text-h3">{t("reader.referredBy")}</h2>
              <div className="flex flex-wrap gap-2">
                {into.map((x) => (
                  <CitePlate key={x} sectionId={x} />
                ))}
              </div>
            </>
          )}
        </Panel>
      )}
      {source && (
        <p className="m-0 text-meta text-ink-3">
          {t("reader.source", { title: source.title, edition: source.edition })}
        </p>
      )}
    </Page>
  );
}
