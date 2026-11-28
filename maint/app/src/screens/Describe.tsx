import { useState } from "react";
import { Cable, ChevronRight, Plus, Search, X } from "lucide-react";
import type { EntryPoint, FaultTree, ObservationInput, SignalKind, SignalMatch, SymptomHit, SymptomSearch, Why } from "../engine/types.ts";
import { Button, ButtonLink, cx, inputClass, Page, Skeleton } from "../ui/kit.tsx";
import { HitCard } from "../ui/SignalCard.tsx";
import { VoiceControl, voiceStatus, type VoicePhase } from "../ui/VoiceControl.tsx";

export interface IndexGroup {
  system: string;
  trees: FaultTree[];
}

export interface DescribeProps {
  unitName: string;
  /** Where the unit's codes are read over a link, typed or pasted. */
  connectTo: string;
  query: string;
  /** "searching": a search is out; the previous results stay until it returns. */
  phase: "empty" | "searching" | "results";
  search: SymptomSearch | null;
  /** Codes read off the unit or typed from its display. */
  codes: ObservationInput[];
  signalKinds: SignalKind[];
  /** The pack's troubleshooting trees, by system, for browsing. */
  index: IndexGroup[];
  voice: VoicePhase;
  onQuery(q: string): void;
  onAddCode(code: string): void;
  onRemoveCode(i: number): void;
  onVoice(): void;
  onStartSymptom(symptomId: string): void;
  onStartTree(treeId: string): void;
  onStartSignal(entry: EntryPoint): void;
}

/** Describe the problem: a search over the manual's own symptom index. Never a blank chat. */
export function Describe(p: DescribeProps) {
  const status = voiceStatus(p.voice);
  return (
    <Page title="What is wrong?" kicker={<span className="code">{p.unitName}</span>} wide>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <form role="search" className="flex flex-col gap-1" onSubmit={(e) => e.preventDefault()}>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search aria-hidden size={24} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3" />
                <input
                  type="text"
                  enterKeyHint="search"
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

          <Codes {...p} />

          {p.search?.signals && p.search.signals.hits.length > 0 && <Signals match={p.search.signals} onStart={p.onStartSignal} />}

          <Results {...p} />
        </div>

        <aside aria-labelledby="index" className="min-w-0">
          <h2 id="index" className="mb-2 text-h3">
            Troubleshooting tables
          </h2>
          <div className="overflow-hidden rounded-panel border border-line bg-surface">
            {p.index.map((g) => (
              <div key={g.system} className="border-b border-line last:border-b-0">
                <h3 className="px-4 pt-3 text-meta font-bold text-ink-3">{g.system}</h3>
                <ul className="m-0 list-none p-0">
                  {g.trees.map((t) => (
                    <li key={t.tree_id}>
                      <button type="button" onClick={() => p.onStartTree(t.tree_id)} className="flex min-h-12 w-full items-center gap-2 px-4 text-left text-small">
                        <span className="manual-text min-w-0 flex-1">{t.title}</span>
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

/** Fault codes: added as read off the unit's display; the engine matches them against every kind it knows. */
function Codes(p: DescribeProps) {
  const [draft, setDraft] = useState("");
  const examples = p.signalKinds.map((k) => k.example).filter(Boolean).slice(0, 2).join(" or ");
  if (p.signalKinds.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          p.onAddCode(draft.trim());
          setDraft("");
        }}
      >
        <input aria-label="Fault code" placeholder={examples ? `Fault code, e.g. ${examples}` : "Fault code"} value={draft} onChange={(e) => setDraft(e.target.value)} className={cx(inputClass, "code min-w-0 flex-1")} autoComplete="off" spellCheck={false} autoCapitalize="characters" />
        <Button type="submit" disabled={!draft.trim()}>
          <Plus aria-hidden size={22} />
          Add code
        </Button>
        <span className="hidden sm:contents">
          <ButtonLink to={p.connectTo}>
            <Cable aria-hidden size={20} />
            Connect
          </ButtonLink>
        </span>
      </form>
      {p.codes.length > 0 && (
        <div className="flex flex-wrap gap-2" role="list" aria-label="Codes">
          {p.codes.map((c, i) => (
            <span role="listitem" key={`${c.value}-${i}`} className="inline-flex min-h-11 items-center gap-1 rounded-plate border-2 border-ink bg-ink pl-3 text-surface">
              <span className="code text-small">{c.value}</span>
              <button type="button" onClick={() => p.onRemoveCode(i)} aria-label={`Remove ${c.value}`} className="inline-flex size-11 items-center justify-center">
                <X aria-hidden size={18} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Signals({ match, onStart }: { match: SignalMatch; onStart(e: EntryPoint): void }) {
  return (
    <div className="flex flex-col gap-2">
      {match.hits.map((h, i) => (
        <HitCard key={i} hit={h} onStart={onStart} />
      ))}
    </div>
  );
}

/** Why it matched, as the engine says: the manual's phrase the words met, the code, or meaning. */
const whyText = (w: Why) => (w.kind === "words" ? { k: "Matched", v: w.phrase } : w.kind === "signal" ? { k: "Code", v: w.value } : { k: "Similar meaning", v: "" });

/**
 * Ranked symptoms. A confident match is offered as one; anything weaker is
 * shown as the closest entries in the manual, never as the answer.
 */
function Results(p: DescribeProps) {
  const s = p.search;
  if (p.phase === "empty" || (!s && p.phase !== "searching")) return null;
  if (!s)
    return (
      <div aria-busy className="flex flex-col gap-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-[112px]" />
        ))}
      </div>
    );
  const sure = s.hits.filter((h) => h.confidence === "confident");
  const near = s.hits.filter((h) => h.confidence !== "confident");
  return (
    <section aria-label="Matching symptoms" aria-busy={p.phase === "searching"} className={cx("flex flex-col gap-4", p.phase === "searching" && "opacity-60")}>
      {s.hits.length === 0 && (
        <div className="rounded-panel border-2 border-dashed border-line-strong p-5">
          <p className="text-lead font-semibold">No symptom in this manual matches.</p>
          <p className="mt-1 text-body text-ink-2">Try the words on the work order, or pick a troubleshooting table.</p>
        </div>
      )}
      {sure.length > 0 && <HitList hits={sure} onStart={p.onStartSymptom} strong />}
      {near.length > 0 && (
        <div>
          <h2 className="mb-1 text-small font-bold text-ink-2">{sure.length > 0 ? "Other entries" : "Closest entries in this manual"}</h2>
          {sure.length === 0 && <p className="mb-2 text-meta text-ink-3">None of these is a sure match. Check the wording against the unit.</p>}
          <HitList hits={near} onStart={p.onStartSymptom} />
        </div>
      )}
    </section>
  );
}

function HitList({ hits, onStart, strong = false }: { hits: SymptomHit[]; onStart(id: string): void; strong?: boolean }) {
  return (
    <ol className="m-0 flex list-none flex-col gap-2 p-0">
      {hits.map((h) => (
        <li key={h.symptom.symptom_id}>
          <button type="button" onClick={() => onStart(h.symptom.symptom_id)} className={cx("flex min-h-[96px] w-full items-center gap-3 rounded-panel bg-surface p-4 text-left active:bg-surface-2", strong ? "border-2 border-ink" : "border border-line")}>
            <span className="min-w-0 flex-1">
              <span className="manual-text block text-lead font-semibold">{h.symptom.title}</span>
              {h.symptom.system && <span className="mt-0.5 block text-meta text-ink-3">{h.symptom.system}</span>}
              <span className="mt-2 flex flex-wrap gap-1.5">
                {h.why.map((w, i) => {
                  const t = whyText(w);
                  return (
                    <span key={i} className="inline-flex min-h-7 items-center gap-1 rounded-full bg-surface-2 px-2.5 text-meta">
                      <span className="text-ink-3">{t.k}</span>
                      {t.v && <span className={cx("font-semibold", w.kind === "signal" && "code")}>{t.v}</span>}
                    </span>
                  );
                })}
              </span>
            </span>
            <ChevronRight aria-hidden size={24} className="shrink-0 text-ink-3" />
          </button>
        </li>
      ))}
    </ol>
  );
}
