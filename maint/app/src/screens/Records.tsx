import { useRef, type ChangeEvent, type ReactNode } from "react";
import { Check, CloudOff, Cloud, FileUp, RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";
import type { AuditRecord, ChainReport, FieldNote, PackInfoView, SyncStatus } from "../engine/types.ts";
import { formatDate, formatTime } from "../ui/format.ts";
import { linkState } from "../ui/link.ts";
import { Button, cx, Page, Panel, Segmented, Skeleton } from "../ui/kit.tsx";
import type { Theme } from "../store/settings.ts";

export interface RecordsProps {
  sync: SyncStatus | null;
  pack: PackInfoView;
  notes: FieldNote[] | null;
  audit: AuditRecord[] | null;
  chain: ChainReport | null;
  /** The on-device model, when one is installed. */
  model: string | null;
  modelOn: boolean;
  theme: Theme;
  busy: "sync" | "chain" | "notes" | "fleet" | null;
  onSync(): void;
  onVerifyChain(): void;
  onInstallNotes(file: File): void;
  onImportFleet(file: File): void;
  onModel(on: boolean): void;
  onTheme(t: Theme): void;
}

const KIND: Record<string, string> = { job: "Jobs", lesson: "Lessons", run: "Task runs", miss: "Unanswered questions", answer: "Answers" };

/** What waits to sync, what came in, the audit trail and its check, the pack and its sources, and the model switch. */
export function Records(p: RecordsProps) {
  const notesFile = useRef<HTMLInputElement>(null);
  const fleetFile = useRef<HTMLInputElement>(null);
  const hub = p.sync?.hub;
  return (
    <Page title="Records" wide>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel label="Sync">
            {!p.sync ? (
              <Skeleton className="h-[140px]" />
            ) : (
              <div className="flex flex-col gap-3">
                {linkState(p.sync) === "refused" && (
                  <p className="rounded-control border-2 border-ink bg-surface-2 p-3 text-body">
                    The hub does not accept uploads from this device yet. An administrator enrolls it at the hub. Everything stays queued here until then.
                  </p>
                )}
                {linkState(p.sync) !== "refused" && (
                  <div className="flex items-center gap-3">
                    {hub?.reachable ? <Cloud aria-hidden size={24} /> : <CloudOff aria-hidden size={24} />}
                    <p className="text-body">
                      {!hub?.configured
                        ? "No hub set up on this device."
                        : hub.reachable
                          ? `${hub.destination === "folder" ? "Sync folder" : "Hub"} reached ${formatTime(hub.last_attempt_at)}.`
                          : hub.last_attempt_at
                            ? `Offline. Last tried ${formatTime(hub.last_attempt_at)}.`
                            : "Offline. Not tried yet."}
                    </p>
                  </div>
                )}
                <p className="text-small text-ink-2">{p.sync.last_synced_at ? `Last sync ${formatTime(p.sync.last_synced_at)}.` : "Nothing synced yet."}</p>
                <dl className="m-0 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-small">
                  {Object.entries(p.sync.pending_by_kind).map(([k, n]) => (
                    <Fragmentish key={k} label={KIND[k] ?? k} value={n} />
                  ))}
                  <Fragmentish label="Waiting in all" value={p.sync.pending} strong />
                  {p.sync.quarantined > 0 && <Fragmentish label="Held back: changed since saved" value={p.sync.quarantined} />}
                </dl>
                {hub?.last_error && linkState(p.sync) !== "refused" && <p className="text-meta text-ink-3">Last error: {hub.last_error}</p>}
                {hub?.configured && (
                  <Button onClick={p.onSync} disabled={p.busy === "sync"} className="self-start">
                    <RefreshCw aria-hidden size={20} className={cx(p.busy === "sync" && "animate-spin")} />
                    Sync now
                  </Button>
                )}
              </div>
            )}
          </Panel>

          <Panel label="Field notes on this device">
            {p.notes === null ? (
              <Skeleton className="h-[80px]" />
            ) : p.notes.length === 0 ? (
              <p className="text-body text-ink-3">None installed.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {p.notes.map((n) => (
                  <li key={n.note_id} className="field p-3 text-small">
                    {n.text}
                    <span className="mt-1 block text-meta opacity-90">
                      Approved {formatDate(n.approved_at)} by {n.approver}.
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Button onClick={() => notesFile.current?.click()} disabled={p.busy === "notes"} className="mt-3">
              <FileUp aria-hidden size={20} />
              Install field notes
            </Button>
            <input ref={notesFile} type="file" accept="application/json,.json" hidden onChange={(e) => pick(e, p.onInstallNotes)} />
          </Panel>

          <Panel label="Fleet file">
            <p className="text-small text-ink-2">Add units and their history from a fleet registry file.</p>
            <Button onClick={() => fleetFile.current?.click()} disabled={p.busy === "fleet"} className="mt-3">
              <FileUp aria-hidden size={20} />
              Import fleet file
            </Button>
            <input ref={fleetFile} type="file" accept="application/json,.json" hidden onChange={(e) => pick(e, p.onImportFleet)} />
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Panel label="Audit trail">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <Button onClick={p.onVerifyChain} disabled={p.busy === "chain"}>
                <ShieldCheck aria-hidden size={20} />
                Check the chain
              </Button>
              {p.chain && (
                <span className={cx("inline-flex min-h-11 items-center gap-2 text-small font-semibold", p.chain.ok ? "text-ok" : "text-error")}>
                  {p.chain.ok ? <Check aria-hidden size={20} /> : <ShieldAlert aria-hidden size={20} />}
                  {p.chain.ok ? `Intact, ${p.chain.entries} entries` : `Broken at entry ${p.chain.first_bad}`}
                </span>
              )}
            </div>
            {p.audit === null ? (
              <Skeleton className="h-[200px]" />
            ) : p.audit.length === 0 ? (
              <p className="text-body text-ink-3">Nothing recorded yet.</p>
            ) : (
              <ol className="m-0 flex max-h-[420px] list-none flex-col overflow-auto p-0">
                {[...p.audit].reverse().map((r) => (
                  <li key={r.seq} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2 border-b border-line py-2 last:border-b-0">
                    <span className="text-meta text-ink-3 tabular">{r.seq}</span>
                    <span className="min-w-0 text-small">
                      {r.type === "event" ? (
                        <>
                          <span className="font-semibold">{EVENT[r.event.event] ?? r.event.event}</span>
                          {r.event.asked && <span className="manual-text block truncate text-ink-2">{r.event.asked}</span>}
                          <span className="block text-meta text-ink-3">{formatTime(r.event.ts)}</span>
                        </>
                      ) : (
                        <>
                          <span className="font-semibold">Question</span>
                          <span className="block truncate text-ink-2">{r.entry.query}</span>
                          <span className="block text-meta text-ink-3">{formatTime(r.entry.ts)}</span>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel label="Manual pack">
            <dl className="m-0 grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-small">
              <dt className="text-ink-3">Pack</dt>
              <dd className="m-0 font-semibold">
                {p.pack.pack_id} <span className="code">{p.pack.version}</span>
              </dd>
              <dt className="text-ink-3">Built</dt>
              <dd className="m-0">{formatDate(p.pack.built_at)}</dd>
              {p.pack.sources.map((s) => (
                <SourceRow key={s.source_id} label="Source" value={`${s.title}, ${s.edition}`} />
              ))}
            </dl>
          </Panel>

          <Panel label="On-device model">
            {p.model ? (
              <Segmented
                label={`Model: ${p.model}`}
                value={p.modelOn ? "on" : "off"}
                options={[
                  { value: "off", label: "Off" },
                  { value: "on", label: "On" },
                ]}
                onChange={(v) => p.onModel(v === "on")}
              />
            ) : (
              <p className="text-body text-ink-2">No model on this device. Everything works without one.</p>
            )}
          </Panel>

          <Panel label="Display">
            <Segmented
              label="Theme"
              hideLabel
              value={p.theme}
              options={[
                { value: "system", label: "Device" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              onChange={p.onTheme}
            />
          </Panel>
        </div>
      </div>
    </Page>
  );
}

const EVENT: Record<string, string> = {
  "job.start": "Job started",
  "job.answer": "Result recorded",
  "job.back": "Answer changed",
  "job.close": "Job closed",
  "lesson.create": "Lesson saved",
  "field.install": "Field notes installed",
};

function pick(e: ChangeEvent<HTMLInputElement>, then: (f: File) => void) {
  const f = e.target.files?.[0];
  e.target.value = "";
  if (f) then(f);
}

function Fragmentish({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <>
      <dt className={cx(strong ? "font-semibold" : "text-ink-2")}>{label}</dt>
      <dd className={cx("m-0 text-right tabular", strong && "font-bold")}>{value}</dd>
    </>
  );
}

function SourceRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt className="text-ink-3">{label}</dt>
      <dd className="m-0">{value}</dd>
    </>
  );
}
