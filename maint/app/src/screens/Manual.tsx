import { useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Link, useNavigate } from "react-router";
import type { ManualHit, PackAsset, SectionRef, SectionView } from "../engine/types.ts";
import { manualPagePath, manualPath, manualSearchPath } from "../routes.ts";
import { Button, cx, inputClass, Page, Skeleton } from "../ui/kit.tsx";
import { Guards, ManualSheet, sectionTitle } from "../ui/manual.tsx";
import { PageViewer } from "../ui/PageViewer.tsx";

function SearchBox({ initial = "" }: { initial?: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState(initial);
  return (
    <form
      role="search"
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) navigate(manualSearchPath(q.trim()));
      }}
    >
      <div className="relative min-w-0 flex-1">
        <Search aria-hidden size={22} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3" />
        <input type="text" enterKeyHint="search" aria-label="Search the manual" placeholder="Search the manual" value={q} onChange={(e) => setQ(e.target.value)} className={cx(inputClass, "pl-12")} />
      </div>
      <Button type="submit" variant="primary" disabled={!q.trim()}>
        Search
      </Button>
    </form>
  );
}

function SectionList({ items }: { items: SectionRef[] }) {
  return (
    <ul className="m-0 list-none overflow-hidden rounded-panel border border-line bg-surface p-0">
      {items.map((c) => (
        <li key={c.section_id} className="border-b border-line last:border-b-0">
          <Link to={manualPath(c.section_id)} className="flex min-h-tap items-center gap-3 px-4 py-2.5 text-ink no-underline">
            <span className="manual-text min-w-0 flex-1 text-body">
              <span className="font-semibold">{c.citation}</span>
              {c.heading && ` ${c.heading}`}
            </span>
            <ChevronRight aria-hidden size={20} className="shrink-0 text-ink-3" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The manual's contents and its search. */
export function ManualHome({ title, contents }: { title: string; contents: SectionRef[] | null }) {
  return (
    <Page title="Manual" kicker={title}>
      <SearchBox />
      {contents === null ? <Skeleton className="h-[200px]" /> : <SectionList items={contents} />}
    </Page>
  );
}

export function ManualResults({ query, hits }: { query: string; hits: ManualHit[] | null }) {
  return (
    <Page title="Manual">
      <SearchBox initial={query} />
      {hits === null ? (
        <Skeleton className="h-[240px]" />
      ) : hits.length === 0 ? (
        <p className="text-body text-ink-2">Nothing in the manual matches. Try other words.</p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {hits.map((h) => (
            <li key={h.chunk_id}>
              <Link to={h.section_id ? manualPath(h.section_id) : "#"} className="sheet block p-4 text-ink no-underline">
                <span className="block font-sans text-meta font-semibold text-ink-2">{[h.citation, h.heading].filter(Boolean).join(" ")}</span>
                <span className="mt-1 line-clamp-3 block text-body">{h.text}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Page>
  );
}

/**
 * One section, as the manual sets it: where it sits, its warnings, its words
 * with the page in the corner, what is under it, and the original page with
 * the passage marked.
 */
export function SectionReader({ view, page, pageOpen, src }: { view: SectionView; page: PackAsset | null; pageOpen: boolean; src: (a: PackAsset) => string }) {
  const c = view.citation;
  const id = view.section.section_id;
  const trail = c.path.slice(0, -1);
  return (
    <Page
      title={<span className="manual-text">{sectionTitle(c)}</span>}
      kicker={
        trail.length > 0 && (
          <nav aria-label="Where this sits" className="flex flex-wrap items-center gap-x-1">
            <Link to="/manual" className="inline-flex min-h-11 items-center text-ink-2">
              Manual
            </Link>
            {trail.map((t) => (
              <span key={t.section_id} className="inline-flex items-center gap-1">
                <ChevronRight aria-hidden size={16} />
                <Link to={manualPath(t.section_id)} className="inline-flex min-h-11 items-center text-ink-2">
                  {[t.citation, t.heading].filter(Boolean).join(" ")}
                </Link>
              </span>
            ))}
          </nav>
        )
      }
      wide={pageOpen}
    >
      <div className={cx("grid items-start gap-6", pageOpen && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]")}>
        <div className="flex min-w-0 flex-col gap-4">
          {view.applies_to.length > 0 && <p className="text-small text-ink-2">Applies to: {view.applies_to.join(", ")}</p>}
          <Guards guards={view.guards} />
          {view.section.text && (
            <ManualSheet citation={c} onPage={page ? manualPagePath(id, page.asset_id) : undefined} size="body">
              {view.section.text}
            </ManualSheet>
          )}
          {view.children.length > 0 && <SectionList items={view.children} />}
        </div>
        {pageOpen && page && (
          <>
            <PageViewer asset={page} src={src(page)} citation={c} closeTo={manualPath(id)} docked />
            <div className="fixed inset-0 z-40 bg-page lg:hidden">
              <PageViewer asset={page} src={src(page)} citation={c} closeTo={manualPath(id)} />
            </div>
          </>
        )}
      </div>
    </Page>
  );
}
