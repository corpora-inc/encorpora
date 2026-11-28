import { Play, Printer } from "lucide-react";
import { Link } from "react-router";
import type { Guidance, Run, RunReport, TaskSummary, TaskView } from "../engine/types.ts";
import { printProcedurePath, procedurePath } from "../routes.ts";
import { formatTime } from "../ui/format.ts";
import { Button, List, Page, Row, Skeleton } from "../ui/kit.tsx";
import { Requirements } from "../ui/manual.tsx";
import { TaskSteps } from "../ui/TaskSteps.tsx";

const KIND: Record<string, string> = { maintenance: "Maintenance", test: "Tests", inspection: "Inspections", service: "Service" };

export interface TaskGroup {
  packId: string;
  /** The manual the tasks come from. */
  title: string;
  tasks: TaskSummary[];
}

export interface TaskListProps {
  /** The variant the list is filtered to (the engine filters; this only names it). */
  variant: string | null;
  /** One group per manual: one when a unit is chosen, every pack's otherwise. */
  groups: TaskGroup[] | null;
}

/** Maintenance tasks for the active variant, grouped as the manual groups them. */
export function TaskList({ variant, groups }: TaskListProps) {
  return (
    <Page title="Maintenance tasks" kicker={variant ?? "All manuals on this device"}>
      {groups === null ? (
        <Skeleton className="h-[240px]" />
      ) : groups.every((g) => g.tasks.length === 0) ? (
        <p className="text-body text-ink-2">No tasks in these manuals for this variant.</p>
      ) : (
        groups
          .filter((g) => g.tasks.length > 0)
          .map((g) => (
            <div key={g.packId} className="flex flex-col gap-4">
              {groups.length > 1 && <h2 className="manual-text text-h3">{g.title}</h2>}
              {[...new Set(g.tasks.map((t) => t.kind))].map((k) => (
                <List key={k} label={KIND[k] ?? k}>
                  {g.tasks
                    .filter((t) => t.kind === k)
                    .map((t) => (
                      <Row key={t.proc_id} to={procedurePath(g.packId, t.proc_id)} title={<span className="manual-text">{t.title}</span>} meta={t.summary} />
                    ))}
                </List>
              ))}
            </div>
          ))
      )}
    </Page>
  );
}

export interface TaskPageProps {
  packId: string;
  task: TaskView;
  /** An open run of this task on this device, if any. */
  run: Run | null;
  /** The pack's guidance after a failed step, shown under the steps. */
  guidance: Guidance | null;
  report: RunReport | null;
  busy: boolean;
  /** No unit chosen: a run can still start, recorded against no unit. */
  unitName: string | null;
  onStart(): void;
  onRecord(ord: number, outcome: "pass" | "fail" | "note" | "value", value?: string): void;
  onFinish(): void;
  onAbandon(): void;
}

/** One task: requirements, then its steps with their guards; started, it records each step. */
export function TaskPage(p: TaskPageProps) {
  const t = p.task;
  const applicable = t.steps.filter((s) => s.applies).length;
  const recorded = p.run?.steps.length ?? 0;
  return (
    <Page
      title={<span className="manual-text">{t.title}</span>}
      kicker={t.summary}
      wide
      actions={
        <Link to={printProcedurePath(p.packId, t.proc_id)} className="inline-flex min-h-tap items-center gap-2 rounded-control border-2 border-line-strong bg-surface px-5 text-small font-semibold text-ink no-underline">
          <Printer aria-hidden size={20} />
          Print
        </Link>
      }
    >
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="sheet" aria-label="Steps">
            <TaskSteps task={t} records={p.run ? p.run.steps : null} busy={p.busy} onRecord={p.onRecord} />
          </section>
          {p.guidance && (
            <section className="rounded-panel border-2 border-ink bg-surface p-4" aria-label="After a failed step">
              <h2 className="mb-1 text-small font-bold text-ink-2">After a failed step</h2>
              <p className={p.guidance.basis === "rule" ? "manual-text text-body" : "text-body"}>{p.guidance.guidance}</p>
              {p.guidance.quote && p.guidance.quote_verified && <p className="manual-text mt-2 border-l-4 border-sheet-line pl-3 text-body">{p.guidance.quote}</p>}
              {p.guidance.citation && <p className="mt-1 text-meta text-ink-3">{p.guidance.citation}</p>}
            </section>
          )}
          {p.report ? (
            <p className="text-body">
              Run {p.report.status === "complete" ? "finished" : "abandoned"} {formatTime(p.report.finished_at)}. Waiting to sync.
            </p>
          ) : p.run ? (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Button variant="primary" size="lg" onClick={p.onFinish} disabled={p.busy || recorded < applicable}>
                Finish the task
              </Button>
              <Button size="lg" onClick={p.onAbandon} disabled={p.busy}>
                Stop without finishing
              </Button>
            </div>
          ) : (
            <Button variant="primary" size="lg" onClick={p.onStart} disabled={p.busy}>
              <Play aria-hidden size={22} />
              {p.unitName ? `Start on ${p.unitName}` : "Start"}
            </Button>
          )}
        </div>
        <aside className="rounded-panel border border-line bg-surface p-4">
          <Requirements items={t.requirements} />
        </aside>
      </div>
    </Page>
  );
}
