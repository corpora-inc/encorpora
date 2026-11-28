import type { ReactNode } from "react";
import type { FaultTree, Lesson, Tree } from "../engine/types.ts";
import { Link } from "react-router";
import { pathOrder } from "../learn/order.ts";
import { learnTreePath } from "../routes.ts";
import { formatDate } from "../ui/format.ts";
import { List, Page, Row, Skeleton, StatusBadge } from "../ui/kit.tsx";

const KIND: Record<string, string> = { symptom: "Symptom", check: "Check", action: "Action", goto: "Continue", escalate: "Refer", end: "End" };

/**
 * Learn from the same manual: study each troubleshooting table whole, and
 * read the lessons technicians captured. Practice items come next, from the
 * shared practice engine, cited the same way.
 */
export interface TreeGroup {
  packId: string;
  title: string;
  trees: FaultTree[];
}

export function LearnHome({ groups, lessons, titles, practice = null }: { groups: TreeGroup[]; lessons: Lesson[] | null; titles: Record<string, string>; practice?: ReactNode }) {
  return (
    <Page title="Learn" wide>
      {practice}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          {groups.map((g) => (
            <List key={g.packId} label={groups.length > 1 ? g.title : "Troubleshooting tables"}>
              {g.trees.map((t) => (
                <Row key={t.tree_id} to={learnTreePath(g.packId, t.tree_id)} title={<span className="manual-text">{t.title}</span>} meta={t.system ?? undefined} />
              ))}
            </List>
          ))}
        </div>
        <section aria-labelledby="lessons">
          <h2 id="lessons" className="mb-2 text-h3">
            Lessons from the fleet
          </h2>
          {lessons === null ? (
            <Skeleton className="h-[200px]" />
          ) : lessons.length === 0 ? (
            <p className="text-body text-ink-3">No lessons on this device yet. Each closed job adds one.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {lessons.map((l) => (
                <li key={l.lesson_id} className="rounded-panel border border-line bg-surface p-4">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-meta font-semibold text-ink-3">
                      {(l.tree_id && titles[l.tree_id]) || "Job"}, {formatDate(l.created_at)}
                    </span>
                    <StatusBadge status={l.status} />
                  </div>
                  <p className="text-body">
                    <span className="font-bold">Cause:</span> {l.cause}
                  </p>
                  <p className="text-body">
                    <span className="font-bold">Action:</span> {l.action}
                  </p>
                  {l.note && <p className="mt-1 text-small text-ink-2">{l.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Page>
  );
}

/**
 * A whole table, in the manual's words, every branch visible: for study, not
 * for a job. Steps are numbered in path order from the entry (never storage
 * order); a branch moves to its step, and a step that continues in another
 * table opens that table. Nothing here looks like a control unless it acts.
 */
export function TreeStudy({ tree, packId, titles }: { tree: Tree; packId: string; titles: Record<string, string> }) {
  const facets = (id: string) => tree.facets.filter((f) => f.node_id === id);
  const order = pathOrder(tree);
  const index = new Map(order.map((n, i) => [n.node_id, i]));
  const go = (id: string) => {
    const el = document.getElementById(`n-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.focus({ preventScroll: true });
  };
  return (
    <Page title={<span className="manual-text">{tree.tree.title}</span>} kicker={tree.tree.system ?? undefined}>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {order.map((n, i) => {
          const out = tree.edges.filter((e) => e.from_node === n.node_id).sort((a, b) => a.ord - b.ord);
          const target = n.target?.kind === "tree" ? n.target : null;
          return (
            <li key={n.node_id} id={`n-${n.node_id}`} tabIndex={-1} data-node={n.node_id} className="sheet scroll-mt-24 p-4 focus:outline-3 focus:outline-offset-2 focus:outline-focus">
              <div className="mb-1 font-sans text-meta font-bold text-ink-3">
                {i + 1}. {KIND[n.kind] ?? n.kind}
              </div>
              <p className="text-body">{n.text}</p>
              {facets(n.node_id).length > 0 && (
                <ul className="m-0 mt-2 flex list-none flex-col gap-1 border-l-2 border-line pl-3 p-0">
                  {facets(n.node_id).map((f) => (
                    <li key={`${f.facet}-${f.ord}`} className="text-small text-ink-2">
                      {f.text}
                    </li>
                  ))}
                </ul>
              )}
              {out.length > 0 && (
                <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0 font-sans" aria-label="Branches">
                  {out.map((e) => {
                    const to = index.get(e.to_node);
                    return (
                      <li key={e.ord}>
                        {to === undefined ? (
                          <span className="inline-flex min-h-11 items-center px-1 text-small text-ink-2">{e.label}</span>
                        ) : (
                          <button type="button" onClick={() => go(e.to_node)} className="inline-flex min-h-11 items-center gap-2 rounded-control border-2 border-line-strong bg-surface px-3 text-small font-semibold text-ink">
                            {e.label}
                            <span className="text-ink-3">to step {to + 1}</span>
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {target && (
                <Link to={learnTreePath(packId, target.id)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-control border-2 border-line-strong bg-surface px-3 font-sans text-small font-semibold text-ink no-underline">
                  Continue in <span className="manual-text">{titles[target.id] ?? target.id}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </Page>
  );
}
