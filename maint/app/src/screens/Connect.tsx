import { useState } from "react";
import { Cable, ClipboardPaste, Plus, Search, X } from "lucide-react";
import type { EntryPoint, ObservationInput, SignalKind, SignalMatch } from "../engine/types.ts";
import { Button, ButtonLink, cx, inputClass, Page, Panel, Skeleton } from "../ui/kit.tsx";

export interface ConnectProps {
  unitName: string;
  /** A vehicle link on this device (native, later): read the codes from the unit itself. */
  linkAvailable: boolean;
  signalKinds: SignalKind[];
  codes: ObservationInput[];
  /** The engine's reading of the codes: what each means in this manual, and where to start. */
  match: SignalMatch | null;
  matching: boolean;
  describeTo: string;
  onRead(): void;
  onAddCode(value: string): void;
  onPasteLog(text: string): void;
  onRemove(i: number): void;
  onClear(): void;
  onStart(e: EntryPoint): void;
}

/**
 * The unit's active codes: read from its controller over a vehicle link, typed
 * off its display, or pasted from a diagnostic log. The engine says which the
 * manual knows and where its troubleshooting starts.
 */
export function Connect(p: ConnectProps) {
  const [code, setCode] = useState("");
  const [log, setLog] = useState("");
  const example = p.signalKinds.map((k) => k.example).filter(Boolean).slice(0, 2).join(" or ");
  const known = new Set(p.match?.hits.map((h) => `${h.observed.signal_kind ?? ""}|${h.observed.value}`) ?? []);
  const isKnown = (c: ObservationInput) => [...known].some((k) => k.endsWith(`|${c.value}`));
  return (
    <Page title="Connect to vehicle" kicker={<span className="code">{p.unitName}</span>} wide>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel label="Vehicle link">
            {p.linkAvailable ? (
              <Button variant="primary" size="lg" onClick={p.onRead} className="w-full">
                <Cable aria-hidden size={24} />
                Read codes from the unit
              </Button>
            ) : (
              <p className="text-body text-ink-2">No vehicle link on this device. Type the codes from the unit's display, or paste a diagnostic log.</p>
            )}
          </Panel>
          <Panel label="Type what the unit reports">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!code.trim()) return;
                p.onAddCode(code.trim());
                setCode("");
              }}
            >
              <input aria-label="Code or message" placeholder={example ? `e.g. ${example}` : "Code or message"} value={code} onChange={(e) => setCode(e.target.value)} className={cx(inputClass, "code min-w-0 flex-1")} autoComplete="off" spellCheck={false} />
              <Button type="submit" disabled={!code.trim()}>
                <Plus aria-hidden size={22} />
                Add
              </Button>
            </form>
          </Panel>
          <Panel label="Paste a log">
            <textarea aria-label="Diagnostic log" rows={5} value={log} onChange={(e) => setLog(e.target.value)} placeholder="One code or message per line" className={cx(inputClass, "code py-3")} spellCheck={false} />
            <Button
              className="mt-3"
              disabled={!log.trim()}
              onClick={() => {
                p.onPasteLog(log);
                setLog("");
              }}
            >
              <ClipboardPaste aria-hidden size={20} />
              Add the codes
            </Button>
          </Panel>
        </div>

        <section className="flex min-w-0 flex-col gap-3" aria-labelledby="active" aria-busy={p.matching}>
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
                  <span className="code shrink-0 text-small font-semibold">{c.value}</span>
                  <span className="min-w-0 flex-1 text-small text-ink-2">{p.match === null ? "" : isKnown(c) ? "In the manual" : "Not in this manual"}</span>
                  <button type="button" onClick={() => p.onRemove(i)} aria-label={`Remove ${c.value}`} className="inline-flex size-12 shrink-0 items-center justify-center">
                    <X aria-hidden size={20} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {p.matching && !p.match && <Skeleton className="h-[120px]" />}
          {p.match && p.codes.length > 0 && p.match.hits.length === 0 && (
            <p className="rounded-panel border-2 border-dashed border-line-strong p-4 text-body">This manual has no entry for {p.codes.length === 1 ? "this code" : "these codes"}. Describe the problem instead.</p>
          )}
          {p.match && p.match.hits.length > 1 && <p className="text-small text-ink-2">{p.match.hits.length} entries in the manual match. Start with the one that fits.</p>}
          {p.match?.hits.map((h, i) => (
            <section key={i} className="sheet flex flex-col gap-3 p-4 sm:flex-row sm:items-center" aria-label={`Code ${h.observed.value}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 font-sans">
                  <span className="inline-flex min-h-10 items-center rounded-plate border-2 border-ink px-2.5">
                    <span className="code text-small">{h.observed.value}</span>
                  </span>
                  <span className="text-small font-semibold">{h.rule.title}</span>
                </div>
                {h.rule.quote && h.rule.quote_verified && <p className="mt-2 text-body">{h.rule.quote}</p>}
                {h.citation && <p className="mt-1 font-sans text-meta text-ink-3">{h.citation}</p>}
              </div>
              <Button variant="primary" onClick={() => p.onStart({ tree_id: h.rule.tree_id, node_id: h.rule.node_id ?? "" })} className="shrink-0 font-sans">
                Start here
              </Button>
            </section>
          ))}
          {p.codes.length > 0 && (
            <ButtonLink to={p.describeTo} className="self-start">
              <Search aria-hidden size={20} />
              Describe the problem too
            </ButtonLink>
          )}
        </section>
      </div>
    </Page>
  );
}
