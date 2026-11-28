import type { FaultTree, Lesson, Tree } from "../engine/types.ts";
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

export function LearnHome({ groups, lessons, titles }: { groups: TreeGroup[]; lessons: Lesson[] | null; titles: Record<string, string> }) {
  return (
    <Page title="Learn" wide>
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

/** A whole table, in the manual's words, every branch visible: for study, not for a job. */
export function TreeStudy({ tree }: { tree: Tree }) {
  const facets = (id: string) => tree.facets.filter((f) => f.node_id === id);
  return (
    <Page title={<span className="manual-text">{tree.tree.title}</span>} kicker={tree.tree.system ?? undefined}>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {tree.nodes.map((n, i) => (
          <li key={n.node_id} id={`n-${n.node_id}`} className="sheet scroll-mt-24 p-4">
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
            {tree.edges.some((e) => e.from_node === n.node_id) && (
              <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0 font-sans">
                {tree.edges
                  .filter((e) => e.from_node === n.node_id)
                  .map((e) => (
                    <li key={e.ord}>
                      <a href={`#n-${e.to_node}`} className="inline-flex min-h-11 items-center gap-2 rounded-control border-2 border-line-strong bg-surface px-3 text-small font-semibold text-ink no-underline">
                        {e.label}
                        <span className="text-ink-3">to {tree.nodes.findIndex((m) => m.node_id === e.to_node) + 1}</span>
                      </a>
                    </li>
                  ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </Page>
  );
}
