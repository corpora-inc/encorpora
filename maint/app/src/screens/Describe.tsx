import { Search, ChevronRight, X, Cpu } from "lucide-react";
import type { ActiveCode, SignalMatch, SymptomHit, Unit } from "../engine/types.ts";
import { Button, CodeChip, cx, inputClass, Page, Skeleton } from "../ui/kit.tsx";
import { sectionTitle } from "../ui/manual.tsx";
import { VoiceControl, voiceStatus, type VoicePhase } from "../ui/VoiceControl.tsx";

export interface IndexGroup {
  system: string;
  symptoms: { symptom_id: string; title: string }[];
}

export interface DescribeProps {
  unit: Unit;
  query: string;
  phase: "empty" | "searching" | "results" | "none";
  hits: SymptomHit[];
  /** Codes the unit reports (null: not connected), and which are in the search. */
  codes: ActiveCode[] | null;
  usedCodes: string[];
  /** The manual's entry point for the codes in use, when one exists. */
  signal: SignalMatch | null;
  /** The symptom index, for browsing when nothing is typed. */
  index: IndexGroup[];
  voice: VoicePhase;
  /** With the on-device model on: one question that splits the top results, with the symptom each answer leads to. */
  clarify: { question: string; options: { label: string; symptom_id: string }[] } | null;
  onQuery(q: string): void;
  onToggleCode(code: string): void;
  onVoice(): void;
  onStart(symptomId: string): void;
  onStartSignal(): void;
}

/** Describe the problem: a search over the manual's own symptom index. Never a blank chat. */
export function Describe(p: DescribeProps) {
  const status = voiceStatus(p.voice);
  return (
    <Page title="What is wrong?" kicker={<span className="code">{p.unit.name}</span>} wide>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <form role="search" className="flex flex-col gap-1" onSubmit={(e) => e.preventDefault()}>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search aria-hidden size={24} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3" />
                <input
                  type="search"
                  aria-label="Describe the problem"
                  placeholder="Describe the problem"
                  value={p.query}
                  onChange={(e) => p.onQuery(e.target.value)}
                  className={cx(inputClass, "pl-13 text-lead")}
                  autoComplete="off"
                />
              </div>
              <VoiceControl phase={p.voice} onPress={p.onVoice} />
            </div>
            <p aria-live="polite" className="min-h-[1.45em] text-meta text-ink-2">
              {status}
            </p>
          </form>

          {p.codes && p.codes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Active codes">
              <span className="text-meta font-semibold text-ink-2">Codes from the unit</span>
              {p.codes.map((c) => {
                const on = p.usedCodes.includes(c.code);
                return (
                  <button key={c.code} type="button" aria-pressed={on} onClick={() => p.onToggleCode(c.code)} className={cx("inline-flex min-h-11 items-center gap-2 rounded-plate border-2 px-3", on ? "border-ink bg-ink text-surface" : "border-line-strong bg-surface")}>
                    <span className="code text-small">{c.code}</span>
                    <span className="text-meta">{c.title}</span>
                    {on && <X aria-hidden size={16} />}
                  </button>
                );
              })}
            </div>
          )}

          {p.signal && <SignalEntry signal={p.signal} onStart={p.onStartSignal} />}

          {p.clarify && p.phase === "results" && (
            <section className="rounded-panel border-2 border-line-strong bg-surface p-4" aria-labelledby="clarify">
              <div className="mb-3 flex items-start gap-2.5">
                <Cpu aria-hidden size={20} className="mt-1 shrink-0 text-ink-3" />
                <h2 id="clarify" className="text-lead font-bold">
                  {p.clarify.question}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {p.clarify.options.map((o) => (
                  <Button key={o.symptom_id} onClick={() => p.onStart(o.symptom_id)}>
                    {o.label}
                  </Button>
                ))}
              </div>
            </section>
          )}

          <Results {...p} />
        </div>

        <aside aria-labelledby="index" className="min-w-0">
          <h2 id="index" className="mb-2 text-h3">
            Symptom index
          </h2>
          <div className="overflow-hidden rounded-panel border border-line bg-surface">
            {p.index.map((g) => (
              <div key={g.system} className="border-b border-line last:border-b-0">
                <h3 className="px-4 pt-3 text-meta font-bold text-ink-3">{g.system}</h3>
                <ul className="m-0 list-none p-0">
                  {g.symptoms.map((s) => (
                    <li key={s.symptom_id}>
                      <button type="button" onClick={() => p.onStart(s.symptom_id)} className="flex min-h-12 w-full items-center gap-2 px-4 text-left text-small">
                        <span className="manual-text min-w-0 flex-1">{s.title}</span>
                        <ChevronRight aria-hidden size={18} className="shrink-0 text-ink-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </Page>
  );
}

function SignalEntry({ signal, onStart }: { signal: SignalMatch; onStart(): void }) {
  return (
    <section className="sheet flex flex-col gap-3 p-4 sm:flex-row sm:items-center" aria-label={`Code ${signal.code}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 font-sans">
          <CodeChip code={signal.code} />
          <span className="text-small font-semibold">{signal.title}</span>
        </div>
        {signal.quote && <p className="mt-2 text-body">{signal.quote}</p>}
        {signal.citation && <p className="mt-1 font-sans text-meta text-ink-3">{sectionTitle(signal.citation)}{signal.citation.page && `, page ${signal.citation.page}`}</p>}
      </div>
      <Button variant="primary" onClick={onStart} className="shrink-0 font-sans">
        Start here
      </Button>
    </section>
  );
}

const WHY = { words: "Words", synonym: "Also called", code: "Code", history: "History" } as const;

function Results(p: DescribeProps) {
  if (p.phase === "empty") return null;
  if (p.phase === "none")
    return (
      <div className="rounded-panel border-2 border-dashed border-line-strong p-5">
        <p className="text-lead font-semibold">No symptom in this manual matches.</p>
        <p className="mt-1 text-body text-ink-2">Try the words on the work order, or pick from the symptom index.</p>
      </div>
    );
  return (
    <section aria-label="Matching symptoms" aria-busy={p.phase === "searching"}>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {p.phase === "searching"
          ? [0, 1, 2].map((i) => (
              <li key={i}>
                <Skeleton className="h-[112px]" />
              </li>
            ))
          : p.hits.map((h) => (
              <li key={h.symptom_id}>
                <button type="button" onClick={() => p.onStart(h.symptom_id)} className="flex min-h-[112px] w-full items-center gap-3 rounded-panel border border-line bg-surface p-4 text-left active:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="manual-text block text-lead font-semibold">{h.title}</span>
                    <span className="mt-1 block text-meta text-ink-3">
                      {h.system && `${h.system}. `}
                      {sectionTitle(h.citation)}
                      {h.citation.page && `, page ${h.citation.page}`}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {h.why.map((w, i) => (
                        <span key={i} className="inline-flex min-h-7 items-center gap-1 rounded-full bg-surface-2 px-2.5 text-meta">
                          <span className="text-ink-3">{WHY[w.kind]}</span>
                          <span className={cx("font-semibold", w.kind === "code" && "code")}>{w.text}</span>
                        </span>
                      ))}
                    </span>
                  </span>
                  <ChevronRight aria-hidden size={24} className="shrink-0 text-ink-3" />
                </button>
              </li>
            ))}
      </ol>
    </section>
  );
}
