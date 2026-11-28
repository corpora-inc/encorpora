import type { ReactNode } from "react";
import { Plus, ScanLine, Cable, ChevronRight } from "lucide-react";
import { Link } from "react-router";
import type { JobSummary, Unit } from "../engine/types.ts";
import { jobPath, newUnitPath, recordsPath, unitPath } from "../routes.ts";
import { ButtonLink, List, Page, Panel, Row, Skeleton } from "../ui/kit.tsx";

export interface HomeProps {
  loading: boolean;
  units: Unit[];
  jobs: JobSummary[];
  queued: number;
  lastSync: string | null;
}

/** Fleet: the units on this device, open jobs, what waits to sync. First run goes straight to adding a unit. */
export function Home({ loading, units, jobs, queued, lastSync }: HomeProps) {
  if (!loading && units.length === 0) return <FirstRun />;
  return (
    <Page
      title="Fleet"
      wide
      actions={
        <ButtonLink to={newUnitPath("type")}>
          <Plus aria-hidden size={22} />
          Add unit
        </ButtonLink>
      }
    >
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          {(loading || jobs.length > 0) && (
            <section aria-labelledby="open-jobs">
              <h2 id="open-jobs" className="mb-2 text-h3">
                Open jobs
              </h2>
              <div className="grid gap-3 xl:grid-cols-2">
                {loading ? [0, 1].map((i) => <Skeleton key={i} className="h-[138px]" />) : jobs.map((j) => <JobCard key={j.job_id} job={j} />)}
              </div>
            </section>
          )}
          <List label="Units">
            {loading
              ? [0, 1, 2].map((i) => (
                  <div key={i} className="flex min-h-[76px] items-center border-b border-line px-4 last:border-b-0">
                    <Skeleton className="h-10 w-48" />
                  </div>
                ))
              : units.map((u) => (
                  <Row
                    key={u.asset_id}
                    to={unitPath(u.asset_id)}
                    leading={<UnitTag unit={u} />}
                    title={<span className="sr-only">{u.name}</span>}
                    meta={[u.variant.title, u.meter && `${u.meter.value.toLocaleString("en-US")} ${u.meter.unit}`, u.location].filter(Boolean).join(", ")}
                    trailing={jobs.some((j) => j.asset_id === u.asset_id) ? <span className="shrink-0 rounded-full bg-surface-3 px-3 py-1 text-meta font-semibold">Open job</span> : null}
                  />
                ))}
          </List>
        </div>
        <Panel label="Waiting to sync">
          <p className="text-h2 font-bold tabular">{queued}</p>
          <p className="text-small text-ink-2">{queued === 1 ? "record on this device" : "records on this device"}</p>
          <p className="mt-3 text-meta text-ink-3">{lastSync ? `Last sync ${lastSync}` : "Never synced"}</p>
          <Link to={recordsPath()} className="mt-3 inline-flex min-h-11 items-center gap-1 font-semibold text-ink no-underline">
            Records
            <ChevronRight aria-hidden size={20} />
          </Link>
        </Panel>
      </div>
    </Page>
  );
}

function UnitTag({ unit }: { unit: Unit }) {
  return (
    <span className="plate shrink-0">
      <span className="code">{unit.name}</span>
      <span aria-hidden className="h-5 w-px bg-current opacity-40" />
      <span>{unit.variant.short}</span>
    </span>
  );
}

function JobCard({ job }: { job: JobSummary }) {
  return (
    <Link to={jobPath(job.job_id)} className="flex min-h-[138px] flex-col justify-between gap-3 rounded-panel border-2 border-ink bg-surface p-4 text-ink no-underline active:bg-surface-2">
      <div className="min-w-0">
        <div className="text-meta font-semibold text-ink-3">
          <span className="code">{job.unit_name}</span>, started {job.started_at}
        </div>
        <div className="mt-1 text-lead font-bold">{job.symptom}</div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-small text-ink-2">Step {job.step_no}</span>
        <span className="inline-flex min-h-11 items-center gap-1 rounded-control bg-ink px-4 text-small font-semibold whitespace-nowrap text-surface">
          Continue
          <ChevronRight aria-hidden size={20} />
        </span>
      </div>
    </Link>
  );
}

function FirstRun() {
  return (
    <Page title="Add the unit you are working on">
      <p className="-mt-2 max-w-[56ch] text-lead text-ink-2">Start with its data plate. Everything after is filtered to its exact variant.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <StartTile to={newUnitPath("type")} icon={<Plus aria-hidden size={30} />} title="Type the plate" />
        <StartTile to={newUnitPath("scan")} icon={<ScanLine aria-hidden size={30} />} title="Scan the plate" />
        <StartTile to={newUnitPath("connect")} icon={<Cable aria-hidden size={30} />} title="Connect to the unit" />
      </div>
    </Page>
  );
}

function StartTile({ to, icon, title }: { to: string; icon: ReactNode; title: string }) {
  return (
    <Link to={to} className="flex min-h-[132px] flex-col justify-between rounded-panel border-2 border-ink bg-surface p-4 text-ink no-underline active:bg-surface-2">
      {icon}
      <span className="text-lead font-bold">{title}</span>
    </Link>
  );
}
