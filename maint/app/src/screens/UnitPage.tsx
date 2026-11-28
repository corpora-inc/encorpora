import type { ReactNode } from "react";
import { ClipboardList, Repeat2, Search, ChevronRight } from "lucide-react";
import { Link } from "react-router";
import type { ActiveCode, JobSummary, Unit, UnitHistory } from "../engine/types.ts";
import { describePath, jobPath, proceduresPath } from "../routes.ts";
import { ButtonLink, CodeChip, Page, Panel, Skeleton } from "../ui/kit.tsx";

export interface UnitPageProps {
  unit: Unit;
  /** Null while the engine reads the history. */
  history: UnitHistory | null;
  /** Null when no vehicle link is connected. */
  codes: ActiveCode[] | null;
  openJob: JobSummary | null;
}

/** One unit: what it is, what it has been through, and the two ways to start work. */
export function UnitPage({ unit, history, codes, openJob }: UnitPageProps) {
  return (
    <Page title={<span className="code">{unit.name}</span>} kicker={unit.variant.title} wide>
      <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-3 rounded-panel border border-line bg-surface p-4 sm:grid-cols-4 sm:p-5">
        <Fact label="Variant" value={unit.variant.short} />
        <Fact label="Serial" value={<span className="code">{unit.serial}</span>} />
        <Fact label={unit.meter ? capital(unit.meter.unit) : "Meter"} value={unit.meter ? unit.meter.value.toLocaleString("en-US") : "Not recorded"} />
        <Fact label="Location" value={unit.location ?? "Not recorded"} />
      </dl>

      {openJob && (
        <Link to={jobPath(openJob.job_id)} className="flex min-h-tap items-center gap-3 rounded-panel border-2 border-ink bg-surface px-4 py-3 text-ink no-underline">
          <span className="min-w-0 flex-1">
            <span className="block text-meta font-semibold text-ink-3">Open job, step {openJob.step_no}</span>
            <span className="block text-lead font-bold">{openJob.symptom}</span>
          </span>
          <span className="inline-flex min-h-11 items-center gap-1 rounded-control bg-ink px-4 text-small font-semibold whitespace-nowrap text-surface">
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

      {codes && (
        <Panel label="Active codes">
          {codes.length === 0 ? (
            <p className="text-body text-ink-2">The unit reports no active codes.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {codes.map((c) => (
                <li key={c.code} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <CodeChip code={c.code} />
                  <span className="text-body">{c.title}</span>
                  <span className="text-meta text-ink-3">{c.source}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {history === null ? <HistorySkeleton /> : <HistoryBlocks history={history} variant={unit.variant.short} />}
    </Page>
  );
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-meta font-semibold text-ink-3">{label}</dt>
      <dd className="m-0 truncate text-lead font-bold">{value}</dd>
    </div>
  );
}

function HistoryBlocks({ history, variant }: { history: UnitHistory; variant: string }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-6">
        {history.repeats.map((r) => (
          <section key={r.symptom} className="flex gap-3 rounded-panel border-2 border-ink bg-surface-2 p-4">
            <Repeat2 aria-hidden size={26} className="mt-0.5 shrink-0" />
            <div>
              <h2 className="text-lead font-bold">Repeat: {r.symptom}</h2>
              <p className="text-body text-ink-2">
                {r.count} reports in {r.window_days} days. Last on {r.last}.
              </p>
            </div>
          </section>
        ))}
        <Panel label="Open discrepancies">
          {history.open_discrepancies.length === 0 ? (
            <p className="text-body text-ink-3">None open.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {history.open_discrepancies.map((d) => (
                <li key={d.id} className="text-body">
                  <span className="block">{d.text}</span>
                  <span className="block text-meta text-ink-3 tabular">Opened {d.opened_at}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel label="This unit">
          {history.unit.length === 0 ? (
            <p className="text-body text-ink-3">No jobs recorded yet.</p>
          ) : (
            <ol className="m-0 flex list-none flex-col p-0">
              {history.unit.map((h) => (
                <li key={h.event_id} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 border-b border-line py-2.5 last:border-b-0">
                  <span className="text-meta text-ink-3 tabular">{h.date}</span>
                  <span className="text-small">{h.text}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
      <Panel label={`Fleet, ${variant}`}>
        {history.fleet.reports === 0 ? (
          <p className="text-body text-ink-3">No fleet reports for this variant yet.</p>
        ) : (
          <>
            <p className="mb-4 text-body">
              <span className="font-bold tabular">{history.fleet.reports}</span> similar reports. Causes found:
            </p>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {history.fleet.modes.map((m) => (
                <li key={m.mode_id}>
                  <div className="flex items-baseline justify-between gap-3 text-small">
                    <span className="font-semibold">{m.title}</span>
                    <span className="shrink-0 text-ink-2 tabular">{m.count}</span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                    <div className="h-full rounded-full bg-ink" style={{ width: `${Math.round((m.share ?? 0) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-[120px]" />
        <Skeleton className="h-[220px]" />
      </div>
      <Skeleton className="h-[240px]" />
    </div>
  );
}
