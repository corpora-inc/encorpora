import { useRef, useState } from "react";
import { Cable, FileUp, Plus, Search, X } from "lucide-react";
import type { Decoded, EntryPoint, Format, ObservationInput, SignalHit, SignalKind, SignalMatch, SignalSection, SymptomHit } from "../engine/types.ts";
import { Button, ButtonLink, cx, inputClass, Page, Panel, Segmented, Skeleton } from "../ui/kit.tsx";

export type CodeSource = "live" | "recorded" | "typed";

export interface ConnectProps {
  unitName: string;
  /** Where the active codes come from: three sources of the same list. */
  source: CodeSource;
  /** A vehicle link on this device (native, later). */
  linkAvailable: boolean;
  /** The log formats this unit's manual can read, with labels. */
  formats: { value: Format; label: string }[];
  format: Format;
  signalKinds: SignalKind[];
  codes: ObservationInput[];
  /** What the decoder read from the last log: J1939 codes with occurrence and lamps, J1587 codes, autopilot messages. */
  decoded: Decoded | null;
  /** The engine's reading of the codes: exact entries, entries with no corrective action, and closest entries. */
  match: SignalMatch | null;
  busy: boolean;
  describeTo: string;
  onSource(s: CodeSource): void;
  onFormat(f: Format): void;
  onRead(): void;
  onDecode(input: string): void;
  onType(value: string): void;
  onRemove(i: number): void;
  onClear(): void;
  onStart(e: EntryPoint): void;
  onStartSymptom(symptomId: string): void;
}

const SOURCES = [
  { value: "live", label: "Live" },
  { value: "recorded", label: "Recorded" },
  { value: "typed", label: "Typed" },
] as const;

/**
 * The unit's active codes, from a live link, a recorded log or the unit's
 * display. The engine decodes them and says which the manual knows, which it
 * only names, and what is closest when nothing matches exactly.
 */
export function Connect(p: ConnectProps) {
  return (
    <Page title="Connect to vehicle" kicker={<span className="code">{p.unitName}</span>} wide>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <Segmented label="Codes from" value={p.source} options={SOURCES} onChange={p.onSource} />
          {p.source === "live" && <LivePanel {...p} />}
          {p.source === "recorded" && <RecordedPanel {...p} />}
          {p.source === "typed" && <TypedPanel {...p} />}
          {p.decoded && <DecodedPanel decoded={p.decoded} />}
        </div>
        <Matches {...p} />
      </div>
    </Page>
  );
}

function LivePanel(p: ConnectProps) {
  return (
    <Panel>
      {p.linkAvailable ? (
        <Button variant="primary" size="lg" onClick={p.onRead} className="w-full">
          <Cable aria-hidden size={24} />
          Read codes from the unit
        </Button>
      ) : (
        <p className="text-body text-ink-2">No vehicle link on this device. Use a recorded log, or type what the unit shows.</p>
      )}
    </Panel>
  );
}

function RecordedPanel(p: ConnectProps) {
  const [text, setText] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const binary = p.format.startsWith("mavlink");
  return (
    <Panel>
      <div className="flex flex-col gap-3">
        <Segmented label="Log format" value={p.format} options={p.formats} onChange={p.onFormat} />
        {!binary && <textarea aria-label="Recorded log" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the log here" className={cx(inputClass, "code py-3 text-small")} spellCheck={false} />}
        <div className="flex flex-wrap gap-2">
          {!binary && (
            <Button variant="primary" disabled={p.busy || !text.trim()} onClick={() => p.onDecode(text)}>
              Read the log
            </Button>
          )}
          <Button onClick={() => file.current?.click()} disabled={p.busy}>
            <FileUp aria-hidden size={20} />
            Open a log file
          </Button>
          <input
            ref={file}
            type="file"
            hidden
            aria-label="Log file"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              // MAVLink logs are binary: the engine takes them as base64. Text logs go as they are.
              p.onDecode(binary ? toBase64(new Uint8Array(await f.arrayBuffer())) : await f.text());
            }}
          />
        </div>
      </div>
    </Panel>
  );
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function TypedPanel(p: ConnectProps) {
  const [code, setCode] = useState("");
  const example = p.signalKinds.map((k) => k.example).filter(Boolean).slice(0, 2).join(" or ");
  return (
    <Panel label="What the unit shows">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!code.trim()) return;
          p.onType(code.trim());
          setCode("");
        }}
      >
        <input aria-label="Code or message" placeholder={example ? `e.g. ${example}` : "Code or message"} value={code} onChange={(e) => setCode(e.target.value)} className={cx(inputClass, "code min-w-0 flex-1")} autoComplete="off" spellCheck={false} />
        <Button type="submit" disabled={p.busy || !code.trim()}>
          <Plus aria-hidden size={22} />
          Add
        </Button>
      </form>
    </Panel>
  );
}

const LAMP: Record<string, string> = { malfunction: "Malfunction", red_stop: "Red stop", amber_warning: "Amber warning", protect: "Protect" };

/** What the decoder read, as the vehicle reported it. */
function DecodedPanel({ decoded }: { decoded: Decoded }) {
  const dm1 = decoded.dm1.filter((m) => m.dtcs.length > 0);
  return (
    <Panel label="Read from the log">
      <div className="flex flex-col gap-3 text-small">
        {dm1.map((m, i) => {
          const on = Object.entries(m.lamps).filter(([, v]) => v === "on").map(([k]) => LAMP[k] ?? k);
          return (
            <div key={i}>
              <p className="text-meta text-ink-3">
                J1939 source {m.source}
                {on.length > 0 && `, lamps on: ${on.join(", ")}`}
              </p>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {m.dtcs.map((d, j) => (
                  <li key={j} className="flex flex-wrap gap-x-4">
                    <span className="code font-semibold">SPN {d.spn}</span>
                    <span className="code">FMI {d.fmi}</span>
                    <span className="text-ink-2">seen {d.occurrences} {d.occurrences === 1 ? "time" : "times"}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {decoded.j1587.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {decoded.j1587.map((d, i) => (
              <li key={i} className="flex flex-wrap gap-x-4">
                <span className="code font-semibold">
                  MID {d.mid} {d.sid ? "SID" : "PID"} {d.code}
                </span>
                <span className="code">FMI {d.fmi}</span>
                <span className="text-ink-2">{d.active ? "active" : "previously active"}</span>
              </li>
            ))}
          </ul>
        )}
        {decoded.mavlink && decoded.mavlink.status_texts.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {decoded.mavlink.status_texts.map((s, i) => (
              <li key={i} className="code">
                {s.text} <span className="font-sans text-ink-3">({s.severity})</span>
              </li>
            ))}
          </ul>
        )}
        {decoded.observations.length === 0 && <p className="text-ink-2">No active codes in this log.</p>}
        {decoded.errors.length > 0 && (
          <p className="text-meta text-ink-3">
            {decoded.errors.length} {decoded.errors.length === 1 ? "line" : "lines"} could not be read: {decoded.errors[0]}
          </p>
        )}
      </div>
    </Panel>
  );
}

const sameObs = (a: { signal_kind?: string | null; value: string }, b: { signal_kind?: string | null; value: string }) => a.value === b.value && (!a.signal_kind || !b.signal_kind || a.signal_kind === b.signal_kind);

function Matches(p: ConnectProps) {
  const m = p.match;
  const status = (c: ObservationInput) => {
    if (!m) return "";
    if (m.hits.some((h) => sameObs(h.observed, c))) return "In the manual";
    if (m.closest.some((x) => sameObs(x.observed, c))) return "No exact entry";
    return "Not in this manual";
  };
  const none = m ? m.unmatched.filter((u) => !m.closest.some((x) => sameObs(x.observed, u))) : [];
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="active" aria-busy={p.busy}>
      <div className="flex min-h-11 items-end justify-between gap-3">
        <h2 id="active" className="text-h3">
          Active codes
        </h2>
        {p.codes.length > 0 && (
          <Button variant="quiet" onClick={p.onClear}>
            Clear all
          </Button>
        )}
      </div>
      {p.codes.length === 0 ? (
        <p className="text-body text-ink-3">None yet.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {p.codes.map((c, i) => (
            <li key={`${c.value}-${i}`} className="flex min-h-tap items-center gap-3 rounded-control border border-line bg-surface pl-4">
              <span className="code min-w-0 shrink text-small font-semibold break-all">{c.value}</span>
              <span className="min-w-0 flex-1 text-small text-ink-2">{status(c)}</span>
              <button type="button" onClick={() => p.onRemove(i)} aria-label={`Remove ${c.value}`} className="inline-flex size-12 shrink-0 items-center justify-center">
                <X aria-hidden size={20} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {p.busy && !m && <Skeleton className="h-[120px]" />}
      {m && m.hits.length > 1 && <p className="text-small text-ink-2">{m.hits.length} entries in the manual match. Start with the one that fits.</p>}
      {m?.hits.map((h, i) => <HitCard key={i} hit={h} onStart={p.onStart} />)}
      {m?.closest.map((c, i) => (
        <section key={`c${i}`} className="flex flex-col gap-2 rounded-panel border-2 border-dashed border-line-strong p-4" aria-label={`Closest entries for ${c.observed.value}`}>
          <p className="text-body">
            No exact entry for <span className="code font-semibold">{c.observed.value}</span>. Closest entries in this manual:
          </p>
          {c.signals.map((s, j) => (
            <EntryCard key={`s${j}`} title={s.rule.title} quote={s.rule.quote_verified ? s.rule.quote : null} section={s.has_tree ? null : s.section} citation={s.citation} start={s.has_tree && s.rule.tree_id ? () => p.onStart({ tree_id: s.rule.tree_id!, node_id: s.rule.node_id ?? "" }) : null} />
          ))}
          {c.symptoms.map((s: SymptomHit) => (
            <EntryCard key={s.symptom.symptom_id} title={s.symptom.title} quote={null} section={null} citation={s.symptom.system} start={() => p.onStartSymptom(s.symptom.symptom_id)} />
          ))}
        </section>
      ))}
      {none.length > 0 && (
        <p className="rounded-panel border-2 border-dashed border-line-strong p-4 text-body">
          This manual has no entry for {none.map((u) => u.value).join(", ")}. Describe the problem instead.
        </p>
      )}
      {p.codes.length > 0 && (
        <ButtonLink to={p.describeTo} className="self-start">
          <Search aria-hidden size={20} />
          Describe the problem too
        </ButtonLink>
      )}
    </section>
  );
}

function HitCard({ hit, onStart }: { hit: SignalHit; onStart(e: EntryPoint): void }) {
  return (
    <EntryCard
      code={hit.observed.value}
      title={hit.rule.title}
      quote={hit.rule.quote_verified ? hit.rule.quote : null}
      section={hit.has_tree ? null : hit.section}
      citation={hit.citation}
      start={hit.has_tree && hit.rule.tree_id ? () => onStart({ tree_id: hit.rule.tree_id!, node_id: hit.rule.node_id ?? "" }) : null}
    />
  );
}

/**
 * One entry of the manual. With a tree it starts troubleshooting there; with
 * none it shows all the manual says and says plainly that it gives no
 * corrective action.
 */
function EntryCard({ code, title, quote, section, citation, start }: { code?: string; title: string; quote: string | null; section: SignalSection | null; citation: string | null; start: (() => void) | null }) {
  return (
    <section className="sheet flex flex-col gap-3 p-4 sm:flex-row sm:items-center" aria-label={title}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 font-sans">
          {code && (
            <span className="inline-flex min-h-10 max-w-full items-center rounded-plate border-2 border-ink px-2.5">
              <span className="code truncate text-small">{code}</span>
            </span>
          )}
          <span className="text-small font-semibold">{title}</span>
        </div>
        {quote && <p className="mt-2 text-body">{quote}</p>}
        {section && <p className="mt-2 text-body">{section.text}</p>}
        {citation && <p className="mt-1 font-sans text-meta text-ink-3">{section?.citation ?? citation}</p>}
        {!start && <p className="mt-2 font-sans text-small text-ink-2">The manual gives no corrective action for this.</p>}
      </div>
      {start && (
        <Button variant="primary" onClick={start} className="shrink-0 font-sans">
          Start here
        </Button>
      )}
    </section>
  );
}
