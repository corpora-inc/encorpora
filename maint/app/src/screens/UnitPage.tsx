import type { ReactNode } from "react";
import { Cable, ChevronRight, ClipboardList, Repeat2, Search, Table2 } from "lucide-react";
import { Link } from "react-router";
import type { Asset, AssetAttrs, AssetHistory, JobSummary } from "../engine/types.ts";
import { AttrList } from "../ui/applicability.tsx";
import { connectPath, describePath, jobPath, proceduresPath } from "../routes.ts";
import { formatDate, formatNumber, formatTime, unitName } from "../ui/format.ts";
import { ButtonLink, Page, Panel, Skeleton } from "../ui/kit.tsx";

export interface UnitPageProps {
  unit: Asset;
  variant: string;
  /** Null while the engine reads the history. */
  history: AssetHistory | null;
  openJob: JobSummary | null;
  /** The unit's active codes, with what the manual calls each (null: not in this manual). */
  codes: { value: string; title: string | null }[];
  /** What the unit's pack declares about it and the values it has, each with its source (null while read). */
  attrs: AssetAttrs | null;
  attrsSaving: boolean;
  onAttr(attr: string, value: string | null): void;
  /** The unit's manual's reference tables, when it has any. */
  referenceTo: string | null;
}

export const RESOLUTION: Record<string, string> = { fixed: "Fixed", escalated: "Referred", abandoned: "Abandoned", redirected: "Redirected", unresolved: "Not resolved" };

/** One unit: what it is, what it has been through, and the two ways to start work. */
export function UnitPage({ unit, variant, history, openJob, codes, attrs, attrsSaving, onAttr, referenceTo }: UnitPageProps) {
  const location = typeof unit.attrs.location === "string" ? unit.attrs.location : null;
  return (
    <Page title={<span className="code">{unitName(unit)}</span>} kicker={variant} wide>
      <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-3 rounded-panel border border-line bg-surface p-4 sm:grid-cols-4 sm:p-5">
        <Fact label="Variant" value={variant} />
        <Fact label="Serial" value={unit.serial ? <span className="code">{unit.serial}</span> : "Not recorded"} />
        <Fact label={unit.miles != null ? "Miles" : "Hours"} value={unit.miles != null ? formatNumber(unit.miles) : unit.hours != null ? formatNumber(unit.hours) : "Not recorded"} />
        <Fact label="Location" value={location ?? "Not recorded"} />
      </dl>

      {openJob && (
        <Link to={jobPath(openJob.job_id)} className="flex min-h-tap items-center gap-3 rounded-panel border-2 border-ink bg-surface px-4 py-3 text-ink no-underline">
          <span className="min-w-0 flex-1">
            <span className="block text-meta font-semibold text-ink-3">Open job, started {formatTime(openJob.opened_at)}</span>
            <span className="block text-lead font-bold">{openJob.tree_title ?? openJob.tree_id}</span>
          </span>
          <span className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-control bg-ink px-4 text-small font-semibold whitespace-nowrap text-surface">
            Continue
            <ChevronRight aria-hidden size={20} />
          </span>
        </Link>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <ButtonLink to={describePath(unit.asset_id)} variant="primary" size="lg" className="w-full">
          <Search aria-hidden size={24} />
          Troubleshoot
        </ButtonLink>
        <ButtonLink to={proceduresPath()} size="lg" className="w-full">
          <ClipboardList aria-hidden size={24} />
          Maintenance tasks
        </ButtonLink>
      </div>

      <section className="flex flex-col gap-3 rounded-panel border border-line bg-surface p-4 sm:flex-row sm:items-center sm:p-5" aria-labelledby="codes">
        <div className="min-w-0 flex-1">
          <h2 id="codes" className="mb-1 text-small font-bold text-ink-2">
            Active codes
          </h2>
          {codes.length === 0 ? (
            <p className="text-body text-ink-3">None read.</p>
          ) : (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {codes.map((c) => (
                <li key={c.value} className="inline-flex min-h-10 items-center gap-2 rounded-plate border-2 border-ink px-2.5">
                  <span className="code text-small font-semibold">{c.value}</span>
                  <span className="text-meta text-ink-2">{c.title ?? "Not in this manual"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <ButtonLink to={connectPath(unit.asset_id)} className="shrink-0">
          <Cable aria-hidden size={20} />
          Connect to vehicle
        </ButtonLink>
      </section>

      {(attrs === null || attrs.declared.length > 0) && (
        <section className="rounded-panel border border-line bg-surface px-4 pt-3 pb-1 sm:px-5" aria-labelledby="attrs">
          <h2 id="attrs" className="text-small font-bold text-ink-2">
            What the manual asks about this unit
          </h2>
          {attrs === null ? <Skeleton className="my-3 h-[120px]" /> : <AttrList declared={attrs.declared} values={attrs.values} saving={attrsSaving} onChange={onAttr} />}
        </section>
      )}

      {referenceTo && (
        <Link to={referenceTo} className="flex min-h-tap items-center gap-3 rounded-panel border border-line bg-surface px-4 py-2.5 text-ink no-underline">
          <Table2 aria-hidden size={22} className="shrink-0 text-ink-2" />
          <span className="min-w-0 flex-1 text-body font-semibold">Reference tables</span>
          <ChevronRight aria-hidden size={20} className="shrink-0 text-ink-3" />
        </Link>
      )}

      {history === null ? <HistorySkeleton /> : <HistoryBlocks history={history} variant={variant} />}
    </Page>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-meta font-semibold text-ink-3">{label}</dt>
      <dd className="m-0 truncate text-lead font-bold">{value}</dd>
    </div>
  );
}

function HistoryBlocks({ history, variant }: { history: AssetHistory; variant: string }) {
  const newest = history.jobs[0];
  const repeat = newest?.repeat.flag ? newest.repeat : null;
  // One timeline: this unit's jobs and its registry events, newest first.
  const rows = [
    ...history.jobs.map((j) => ({ key: j.job_id, date: j.opened_at, text: `${j.tree_title ?? j.tree_id}. ${j.resolution ? (RESOLUTION[j.resolution] ?? j.resolution) : j.status === "open" ? "Open" : "Closed"}.` })),
    ...history.events.map((e, i) => ({ key: `e${i}`, date: e.date, text: e.text ?? e.system ?? "" })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-6">
        {repeat && (
          <section className="flex gap-3 rounded-panel border-2 border-ink bg-surface-2 p-4">
            <Repeat2 aria-hidden size={26} className="mt-0.5 shrink-0" />
            <div>
              <h2 className="text-lead font-bold">Repeat discrepancy</h2>
              <p className="text-body text-ink-2">
                {newest?.tree_title ?? "The same fault"}: {repeat.matches.length} earlier {repeat.matches.length === 1 ? "report" : "reports"} in {repeat.window_days} days. Last on {formatDate(repeat.matches[0]?.date)}.
              </p>
            </div>
          </section>
        )}
        <Panel label="This unit">
          {rows.length === 0 ? (
            <p className="text-body text-ink-3">No jobs recorded yet.</p>
          ) : (
            <ol className="m-0 flex list-none flex-col p-0">
              {rows.map((r) => (
                <li key={r.key} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 border-b border-line py-2.5 last:border-b-0">
                  <span className="text-meta text-ink-3 tabular">{formatDate(r.date)}</span>
                  <span className="text-small">{r.text}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
      <Panel label={`Fleet, ${variant}`}>
        {history.failure_modes.length === 0 && history.fleet_history.length === 0 ? (
          <p className="text-body text-ink-3">No fleet reports for this variant yet.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {history.failure_modes.length > 0 && (
              <div>
                <h3 className="mb-3 text-meta font-bold text-ink-2">Causes found across the fleet</h3>
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {history.failure_modes.map((m) => (
                    <li key={m.mode_id}>
                      <div className="flex items-baseline justify-between gap-3 text-small">
                        <span className="font-semibold">{m.title}</span>
                        <span className="shrink-0 text-ink-2 tabular">{m.count} reports</span>
                      </div>
                      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                        <div className="h-full rounded-full bg-ink" style={{ width: `${Math.round((m.share ?? 0) * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {history.fleet_history.length > 0 && (
              <div>
                <h3 className="mb-1 text-meta font-bold text-ink-2">Fleet history</h3>
                <ol className="m-0 flex list-none flex-col p-0">
                  {history.fleet_history.map((h) => (
                    <li key={h.event_id} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 border-b border-line py-2.5 last:border-b-0">
                      <span className="text-meta text-ink-3 tabular">{formatDate(h.date)}</span>
                      <span className="text-small">{h.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Skeleton className="h-[220px]" />
      <Skeleton className="h-[240px]" />
    </div>
  );
}
