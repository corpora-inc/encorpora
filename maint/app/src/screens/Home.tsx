import type { ReactNode } from "react";
import { Cable, ChevronRight, Plus, ScanLine } from "lucide-react";
import { Link } from "react-router";
import type { Asset, JobSummary } from "../engine/types.ts";
import { jobPath, newUnitPath, recordsPath, unitPath } from "../routes.ts";
import { formatNumber, formatTime, unitName } from "../ui/format.ts";
import { ButtonLink, List, Page, Panel, Row, Skeleton } from "../ui/kit.tsx";

export interface HomeProps {
  loading: boolean;
  units: Asset[];
  /** The variant name for each equipment id, from the pack. */
  variants: Record<string, string>;
  openJobs: JobSummary[];
  pending: number;
  lastSync: string | null;
}

/** Fleet: the units on this device, open jobs, what waits to sync. First run goes straight to adding a unit. */
export function Home({ loading, units, variants, openJobs, pending, lastSync }: HomeProps) {
  if (!loading && units.length === 0) return <FirstRun />;
  const names = Object.fromEntries(units.map((u) => [u.asset_id, unitName(u)]));
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
          {(loading || openJobs.length > 0) && (
            <section aria-labelledby="open-jobs">
              <h2 id="open-jobs" className="mb-2 text-h3">
                Open jobs
              </h2>
              <div className="grid gap-3 xl:grid-cols-2">
                {loading ? [0, 1].map((i) => <Skeleton key={i} className="h-[138px]" />) : openJobs.map((j) => <JobCard key={j.job_id} job={j} unit={j.asset_id ? (names[j.asset_id] ?? j.asset_id) : null} />)}
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
                    leading={
                      <span className="plate shrink-0">
                        <span className="code">{unitName(u)}</span>
                      </span>
                    }
                    title={u.equip_id ? (variants[u.equip_id] ?? u.equip_id) : "Variant not set"}
                    meta={[u.serial && `Serial ${u.serial}`, u.hours != null && `${formatNumber(u.hours)} hours`, u.miles != null && `${formatNumber(u.miles)} miles`].filter(Boolean).join(", ")}
                    trailing={openJobs.some((j) => j.asset_id === u.asset_id) ? <span className="hidden shrink-0 rounded-full bg-surface-3 px-3 py-1 text-meta font-semibold sm:inline">Open job</span> : null}
                  />
                ))}
          </List>
        </div>
        <Panel label="Waiting to sync">
          <p className="text-h2 font-bold tabular">{pending}</p>
          <p className="text-small text-ink-2">{pending === 1 ? "record on this device" : "records on this device"}</p>
          <p className="mt-3 text-meta text-ink-3">{lastSync ? `Last sync ${formatTime(lastSync)}` : "Not synced yet"}</p>
          <Link to={recordsPath()} className="mt-3 inline-flex min-h-11 items-center gap-1 font-semibold text-ink no-underline">
            Records
            <ChevronRight aria-hidden size={20} />
          </Link>
        </Panel>
      </div>
    </Page>
  );
}

function JobCard({ job, unit }: { job: JobSummary; unit: string | null }) {
  return (
    <Link to={jobPath(job.job_id)} className="flex min-h-[138px] flex-col justify-between gap-3 rounded-panel border-2 border-ink bg-surface p-4 text-ink no-underline active:bg-surface-2">
      <div className="min-w-0">
        <div className="text-meta font-semibold text-ink-3">
          {unit && <span className="code">{unit}</span>}
          {unit && ", "}
          started {formatTime(job.opened_at)}
        </div>
        <div className="mt-1 text-lead font-bold">{job.tree_title ?? job.tree_id}</div>
      </div>
      <div className="flex items-center justify-end">
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
