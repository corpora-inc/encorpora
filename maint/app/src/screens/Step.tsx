import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight, Camera, CornerDownRight, ChevronDown, ChevronUp, MessageCircleQuestion, NotebookPen, OctagonAlert, Printer, Undo2, X } from "lucide-react";
import { Link } from "react-router";
import type { Applicability, AskResponse, Citation, FacetGroup, Job, Level, PackAsset, PathEntry, StepView } from "../engine/types.ts";
import { closeOutPath, jobAskPath, jobPagePath, jobPath, manualPath, printJobPath, procedurePath } from "../routes.ts";
import { Button, cx, Segmented, Skeleton } from "../ui/kit.tsx";
import { useVoiceInput } from "@appkit/voice/useVoiceInput.ts";
import { Keypad } from "../ui/Keypad.tsx";
import { VoiceControl, voiceStatus } from "../ui/VoiceControl.tsx";
import { PageViewer } from "../ui/PageViewer.tsx";
import { citationText, FieldNotes, pageFor, gravest, Guards, markOnly, ManualSheet, Requirements, sectionTitle, useAssetSrc } from "../ui/manual.tsx";

export type StepOverlay = { kind: "page"; asset: PackAsset } | { kind: "ask"; query: string; answer: AskResponse | null } | null;

export type ResultInput = { outcome: string } | { value: number; unit: string };

export interface PendingNote {
  text: string;
}

export interface StepProps {
  job: Job;
  step: StepView;
  /** The pack's levels, most guidance first. */
  levels: Level[];
  /** The manual's own heading for each facet (pack.info.facets), for facets shown apart from their node. */
  facetLabels: Record<string, string>;
  /** "sending": the result is with the engine; the step stays put until the next one arrives. */
  phase: "ready" | "sending";
  /** Typed value for a measurement. */
  draft: string;
  /** The note and photos that go with this answer. */
  note: string;
  photos: number;
  keypadOpen: boolean;
  overlay: StepOverlay;
  /** On-device voice input is installed. */
  voice: boolean;
  onDraft(v: string): void;
  onKeypad(open: boolean): void;
  onAnswer(input: ResultInput): void;
  onLevel(levelId: string): void;
  onBack(): void;
  /** At a goto: continue the job in the table it names. */
  onFollow(): void;
  onPhoto(): void;
  onNote(text: string): void;
  onAskQuery(q: string): void;
  /** The in-place answer for an undetermined applicability (the unit's attribute the manual's statement needs). */
  renderAnswer?: (a: Applicability) => ReactNode;
}

const KIND: Record<string, string> = { symptom: "Symptom", check: "Check", action: "Action", goto: "Continue", escalate: "Refer", end: "End" };
const WARNING_ID = "step-warning";

/** One question per screen: the manual's words, its warnings first, and the result always within reach. */
export function Step(p: StepProps) {
  const { step, job } = p;
  const assetSrc = useAssetSrc();
  const page = pageFor(step.assets, step.citation);
  const figure = step.assets.find((a) => a.role === "figure") ?? null;
  const main = step.facets.filter((f) => f.facet !== "known" && f.facet !== "possible");
  const known = step.facets.filter((f) => f.facet === "known");
  const possibleLabel = step.facets.find((f) => f.facet === "possible")?.label ?? p.facetLabels.possible ?? null;
  const needs = [...step.setup, ...step.requirements, ...(step.test_procedure?.requirements ?? [])];
  const busy = p.phase === "sending";
  const pageOpen = p.overlay?.kind === "page" ? p.overlay.asset : null;
  const stepNo = step.path.length + 1;
  const detailed = p.levels[0]?.id === step.level.id;
  // At the most experienced level, blocks the pack does not mark must_show may fold.
  const experienced = p.levels.length > 1 && p.levels[p.levels.length - 1]?.id === step.level.id;
  const grave = gravest(step.guards);
  const [noteOpen, setNoteOpen] = useState(false);
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-4 pb-10 sm:px-6 lg:px-8">
      {grave && <WarningMarker label={grave.label} text={grave.text} />}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-h3 sm:text-h2">{step.tree.title}</h1>
          <p className="text-small text-ink-2">
            Step {stepNo}, {(KIND[step.node.kind] ?? step.node.kind).toLowerCase()}
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Link to={jobAskPath(job.job_id)} className="inline-flex min-h-tap items-center gap-2 rounded-control border-2 border-line-strong bg-surface px-5 text-small font-semibold whitespace-nowrap text-ink no-underline">
            <MessageCircleQuestion aria-hidden size={20} />
            Ask about this step
          </Link>
          <Link to={printJobPath(job.job_id)} aria-label="Print this job" className="inline-flex size-tap items-center justify-center rounded-control border-2 border-line-strong bg-surface text-ink">
            <Printer aria-hidden size={22} />
          </Link>
        </div>
      </header>

      <div className={cx("grid items-start gap-6", pageOpen ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)_380px]")}>
        <article aria-busy={busy} className="flex min-w-0 flex-col gap-4">
          <div className={cx("flex flex-col gap-4", busy && "opacity-60")}>
            <Guards guards={step.guards} firstWarningId={WARNING_ID} collapsible={experienced} answer={p.renderAnswer} />
            {step.tree.applicability?.status === "unknown" && (p.renderAnswer ?? markOnly)(step.tree.applicability)}
            {step.applicability?.status === "unknown" && (p.renderAnswer ?? markOnly)(step.applicability)}

            <ManualSheet citation={step.citation} onPage={page ? jobPagePath(job.job_id, page.asset_id) : undefined}>
              {step.node.text}
            </ManualSheet>

            {!step.target && step.reference && (
              <p className="text-body">
                See <span className="manual-text font-semibold">{step.reference}</span> in the manual.
              </p>
            )}

            {main.length > 0 && <FacetSheet groups={main} />}

            {detailed && step.detail.length > 0 && <Explanation texts={step.detail.map((d) => d.text)} />}

            {step.test_procedure && step.test_procedure.steps.length > 0 && <TestProcedure step={step} collapsible={experienced} renderAnswer={p.renderAnswer} />}

            {figure && !pageOpen && <FigureCard figure={figure} src={assetSrc(step.pack_id, figure)} to={jobPagePath(job.job_id, figure.asset_id)} className="lg:hidden" />}
            {needs.length > 0 && (
              <section className="rounded-panel border border-line bg-surface p-4 lg:hidden">
                <Requirements items={needs} columns />
              </section>
            )}

            {step.record.expect?.kind === "value" && (
              <section className="hidden rounded-panel border-2 border-ink bg-surface p-4 lg:block" aria-label="Measured value">
                <ValueEntry {...p} />
              </section>
            )}
          </div>

          <ResultBar {...p} busy={busy} />

          {!step.terminal && (
            <div className="no-print flex flex-wrap items-center gap-2">
              <Button onClick={p.onPhoto} disabled={busy}>
                <Camera aria-hidden size={22} />
                Photo{p.photos > 0 && <span className="tabular"> ({p.photos})</span>}
              </Button>
              <Button onClick={() => setNoteOpen(true)} disabled={busy}>
                <NotebookPen aria-hidden size={22} />
                Note
              </Button>
              {p.note && <span className="inline-flex min-h-11 max-w-full min-w-0 items-center rounded-control bg-surface-3 px-3 text-meta font-semibold"><span className="truncate">{p.note}</span></span>}
            </div>
          )}

          <div className="no-print border-t border-line pt-4">
            <Segmented label="Detail" value={step.level.id} options={p.levels.map((l) => ({ value: l.id, label: l.label }))} onChange={p.onLevel} />
          </div>
        </article>

        <aside className="flex min-w-0 flex-col gap-4" aria-label="Job">
          {pageOpen ? (
            <PageViewer asset={pageOpen} src={assetSrc(step.pack_id, pageOpen)} citation={step.citation} closeTo={jobPath(job.job_id)} docked />
          ) : (
            page && <PageThumb asset={page} src={assetSrc(step.pack_id, page)} to={jobPagePath(job.job_id, page.asset_id)} label={step.citation.page_label} />
          )}
          {figure && !pageOpen && <FigureCard figure={figure} src={assetSrc(step.pack_id, figure)} to={jobPagePath(job.job_id, figure.asset_id)} className="hidden lg:block" />}
          {needs.length > 0 && (
            <section className="hidden rounded-panel border border-line bg-surface p-4 lg:block">
              <Requirements items={needs} />
            </section>
          )}
          <FieldNotes notes={step.field_notes} compact />
          <PathSoFar path={step.path} step={step} busy={busy} onBack={p.onBack} />
          {known.length > 0 && <FacetSheet groups={known} />}
          {step.possible_open.length > 0 && <PossibleOpen label={possibleLabel} texts={step.possible_open} />}
        </aside>
      </div>

      {pageOpen && (
        <div className="fixed inset-0 z-40 bg-page lg:hidden">
          <PageViewer asset={pageOpen} src={assetSrc(step.pack_id, pageOpen)} citation={step.citation} closeTo={jobPath(job.job_id)} />
        </div>
      )}
      {p.keypadOpen && step.record.expect?.kind === "value" && <KeypadSheet {...p} />}
      {noteOpen && (
        <NoteSheet
          initial={p.note}
          voice={p.voice}
          onClose={() => setNoteOpen(false)}
          onSave={(t) => {
            p.onNote(t);
            setNoteOpen(false);
          }}
        />
      )}
      {p.overlay?.kind === "ask" && <AskSheet packId={step.pack_id} jobId={job.job_id} query={p.overlay.query} answer={p.overlay.answer} onQuery={p.onAskQuery} />}
    </div>
  );
}

/**
 * When the step's WARNING has scrolled out above, a one-line marker stays
 * under the status strip and jumps back to it. It overlays; nothing moves.
 */
function WarningMarker({ label, text }: { label: string; text: string }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const el = document.getElementById(WARNING_ID);
    if (!el) return;
    const strip = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--spacing-strip")) * 16 || 56;
    const io = new IntersectionObserver(([e]) => setGone(!!e && !e.isIntersecting && e.boundingClientRect.top < strip), { rootMargin: `-${strip}px 0px 0px 0px` });
    io.observe(el);
    return () => io.disconnect();
  }, [text]);
  if (!gone) return null;
  return (
    <button
      type="button"
      onClick={() => document.getElementById(WARNING_ID)?.scrollIntoView({ behavior: "smooth", block: "start" })}
      className="no-print fixed inset-x-0 top-[calc(var(--spacing-strip)+env(safe-area-inset-top))] z-30 flex h-11 items-center gap-2 bg-warn px-4 text-left text-warn-ink md:left-rail"
    >
      <OctagonAlert aria-hidden size={20} strokeWidth={2.5} className="shrink-0" />
      <span className="shrink-0 text-small font-bold tracking-[0.14em]">{label}</span>
      <span className="manual-text min-w-0 truncate text-small">{text}</span>
    </button>
  );
}

/** The manual's facets for this node, under the manual's own headings. */
function FacetSheet({ groups }: { groups: FacetGroup[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <section className="sheet flex flex-col gap-3 p-4 sm:p-5">
      {groups.map((g) => {
        const shown = g.expanded || open[g.facet];
        return (
          <div key={g.facet}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-sans text-meta font-bold text-ink-2">{g.label ?? g.facet}</h2>
              {!g.expanded && (
                <button type="button" aria-expanded={shown} onClick={() => setOpen({ ...open, [g.facet]: !shown })} className="-mr-2 inline-flex min-h-11 items-center gap-1 px-2 font-sans text-meta font-semibold text-ink-2">
                  {shown ? "Hide" : "Show"}
                  {shown ? <ChevronUp aria-hidden size={18} /> : <ChevronDown aria-hidden size={18} />}
                </button>
              )}
            </div>
            {shown &&
              g.texts.map((t, i) => (
                <p key={i} className="text-body">
                  {t.text}
                </p>
              ))}
          </div>
        );
      })}
    </section>
  );
}

/** Prepared explanation for the detailed level: app type, marked, never the sheet. */
function Explanation({ texts }: { texts: string[] }) {
  return (
    <section className="rounded-panel border border-line bg-surface-2 p-4" aria-labelledby="explanation">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 id="explanation" className="text-meta font-bold text-ink-2">
          Explanation
        </h2>
        <span className="rounded-full border border-line-strong px-2 text-meta text-ink-3">Not manual text</span>
      </div>
      {texts.map((t, i) => (
        <p key={i} className="text-body">
          {t}
        </p>
      ))}
    </section>
  );
}

function TestProcedure({ step, collapsible, renderAnswer }: { step: StepView; collapsible: boolean; renderAnswer?: (a: Applicability) => ReactNode }) {
  const tp = step.test_procedure!;
  // Blocks the pack marks must_show are never folded away with the procedure.
  const pinned = [...tp.guards, ...tp.steps.flatMap((t) => t.guards)].filter((g) => g.must_show);
  const [open, setOpen] = useState(tp.expanded);
  useEffect(() => setOpen(tp.expanded), [tp.expanded, step.node.node_id]);
  return (
    <section className="sheet">
      <div className="flex min-h-tap items-center justify-between gap-3 px-4 sm:px-5">
        <h2 className="font-sans text-small font-bold">{tp.title}</h2>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="-mr-2 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-control px-2 font-sans text-small font-semibold text-ink-2">
          {open ? "Hide" : `Show ${tp.steps.length} steps`}
          {open ? <ChevronUp aria-hidden size={20} /> : <ChevronDown aria-hidden size={20} />}
        </button>
      </div>
      {tp.applicability?.status === "unknown" && <div className="border-t border-line px-4 py-4 sm:px-5">{(renderAnswer ?? markOnly)(tp.applicability)}</div>}
      {!open && pinned.length > 0 && (
        <div className="border-t border-line px-4 py-4 sm:px-5">
          <Guards guards={pinned} answer={renderAnswer} />
        </div>
      )}
      {open && (
        <ol className="m-0 flex list-none flex-col gap-3 border-t border-line px-4 py-4 sm:px-5">
          {tp.guards.length > 0 && (
            <li>
              <Guards guards={tp.guards} collapsible={collapsible} answer={renderAnswer} />
            </li>
          )}
          {tp.steps.map((t) => (
            <li key={t.ord} className={cx("flex flex-col gap-2", !t.applies && t.applicability?.status !== "unknown" && "opacity-60")}>
              <Guards guards={t.guards} collapsible={collapsible} answer={renderAnswer} />
              {t.applicability?.status === "unknown" && (renderAnswer ?? markOnly)(t.applicability)}
              <div className="flex gap-3">
                <span className="w-6 shrink-0 font-sans text-body font-bold tabular">{t.ord}.</span>
                <span className="text-body">
                  {t.text}
                  {!t.applies && t.applicability?.status !== "unknown" && <span className="ml-2 font-sans text-meta text-ink-3">Not for this variant</span>}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Text the keypad produced is a number. Parsing input, not judging it: the engine branches. */
const isNumber = (s: string) => s !== "" && s !== "-" && s !== "." && Number.isFinite(Number(s));

function ValueEntry(p: StepProps) {
  const e = p.step.record.expect;
  if (e?.kind !== "value") return null;
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Keypad value={p.draft} unit={e.unit} onChange={p.onDraft} label="Measured value" />
      <div className="flex flex-col gap-2">
        <h2 className="text-small font-bold text-ink-2">The manual branches at</h2>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {p.step.record.branches.map((b) => (
            <li key={b.to_node} className="manual-text rounded-control border border-line bg-sheet px-3 py-2 text-body">
              {b.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * The result controls, pinned to the bottom of the viewport (above the phone
 * tab bar) while the step scrolls, in their reading-order place otherwise.
 * Sticky, so pinning never moves anything.
 */
function ResultBar(p: StepProps & { busy: boolean }) {
  const { step, busy, job } = p;
  const e = step.record.expect;
  const bar = "no-print sticky bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom))] z-10 -mx-4 border-t border-line bg-page/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6 md:bottom-[env(safe-area-inset-bottom)] lg:mx-0 lg:rounded-panel lg:border lg:px-3";
  if (step.node.kind === "goto" && step.target?.target.kind === "tree")
    return (
      <div className={bar}>
        <Button variant="primary" size="lg" className="w-full" onClick={p.onFollow} disabled={busy}>
          Continue in {step.target.title ?? "the next table"}
        </Button>
      </div>
    );
  if (step.terminal)
    return (
      <div className={bar}>
        <Link to={closeOutPath(job.job_id)} className="flex min-h-result w-full items-center justify-center rounded-control border-2 border-ink bg-ink px-4 text-lead font-semibold text-surface no-underline">
          {step.node.kind === "escalate" ? "Close as referred" : step.node.kind === "action" ? "Do the corrective action" : "Close the job"}
        </Link>
      </div>
    );
  if (e?.kind === "value")
    return (
      <div className={cx(bar, "grid grid-cols-[minmax(0,1fr)_auto] gap-3")} aria-label="Record the result">
        <button type="button" onClick={() => p.onKeypad(true)} disabled={busy} aria-label={`Measured value ${p.draft || "not entered"} ${e.unit}. Open the keypad.`} className="flex min-h-result min-w-0 items-center justify-end gap-2 rounded-control border-2 border-ink bg-sheet px-4 lg:pointer-events-none">
          <span className={cx("truncate text-h2 font-bold tabular", !p.draft && "text-ink-3")}>{p.draft || "0"}</span>
          <span className="shrink-0 text-lead font-semibold text-ink-2">{e.unit}</span>
        </button>
        <Button variant="primary" size="lg" disabled={busy || !isNumber(p.draft)} onClick={() => p.onAnswer({ value: Number(p.draft), unit: e.unit })}>
          Record
        </Button>
      </div>
    );
  const n = step.record.branches.length;
  return (
    <div className={bar} aria-label="Record the result">
      {step.node.kind === "action" && step.target?.target.kind === "procedure" && (
        <Link to={procedurePath(step.pack_id, step.target.target.id)} className="mb-3 flex min-h-tap items-center justify-between gap-3 rounded-control border-2 border-line-strong bg-surface px-4 text-small font-semibold text-ink no-underline">
          <span className="min-w-0 truncate">Open the task: {step.target.title ?? step.target.target.id}</span>
          <ArrowUpRight aria-hidden size={22} className="shrink-0" />
        </Link>
      )}
      <div className={cx("grid gap-3", n === 1 ? "grid-cols-1" : n === 2 ? "grid-cols-2" : "grid-cols-3")}>
        {step.record.branches.map((b) => (
          <button
            key={b.to_node + b.label}
            type="button"
            disabled={busy || b.outcome === null}
            onClick={() => b.outcome !== null && p.onAnswer({ outcome: b.outcome })}
            className={cx(
              "flex min-h-result min-w-0 items-center justify-center rounded-control border-2 px-2 text-lead font-bold disabled:opacity-40 active:translate-y-px",
              n === 1 ? "border-ink bg-ink text-surface" : "border-ink bg-surface text-ink active:bg-surface-3",
            )}
          >
            <span className="truncate">{b.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** A note that goes with this answer. */
function NoteSheet({ initial, voice, onSave, onClose }: { initial: string; voice: boolean; onSave(t: string): void; onClose(): void }) {
  const [text, setText] = useState(initial);
  // Spoken words land in the box, to read and correct; nothing is kept until "Keep note".
  const mic = useVoiceInput("en", (t) => setText((cur) => (cur.trim() ? `${cur.trim()} ${t}` : t)));
  const status = voiceStatus(voice ? mic.phase : "unavailable");
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[var(--scrim)]" />
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Note"
        className="relative w-full max-w-[560px] rounded-t-panel bg-surface p-4 pb-[calc(16px+env(safe-area-inset-bottom))] sm:rounded-panel"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(text.trim());
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-meta font-semibold text-ink-2">Note with this answer</span>
          <span className="flex items-start gap-2">
            <textarea autoFocus rows={4} value={text} onChange={(e) => setText(e.target.value)} className="block min-w-0 flex-1 rounded-control border-2 border-line-strong bg-surface px-4 py-3 text-body focus:border-ink focus:outline-none" />
            <VoiceControl phase={voice ? mic.phase : "unavailable"} onPress={() => void mic.toggle()} />
          </span>
        </label>
        {voice && (
          <p aria-live="polite" className="mt-1 min-h-[1.35em] text-meta text-ink-2">
            {status}
          </p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            Keep note
          </Button>
        </div>
      </form>
    </div>
  );
}

/** The keypad on narrow screens: a sheet over the step, with the manual's branch points and Record. */
function KeypadSheet(p: StepProps) {
  const e = p.step.record.expect;
  if (e?.kind !== "value") return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center lg:hidden">
      <button type="button" aria-label="Close the keypad" onClick={() => p.onKeypad(false)} className="absolute inset-0 bg-[var(--scrim)]" />
      <section role="dialog" aria-modal="true" aria-label="Measured value" className="relative max-h-full w-full max-w-[560px] overflow-auto rounded-t-panel bg-surface p-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <ValueEntry {...p} />
        <Button variant="primary" size="lg" className="mt-4 w-full" disabled={p.phase === "sending" || !isNumber(p.draft)} onClick={() => p.onAnswer({ value: Number(p.draft), unit: e.unit })}>
          Record {isNumber(p.draft) ? `${p.draft} ${e.unit}` : "value"}
        </Button>
      </section>
    </div>
  );
}

function PathSoFar({ path, step, busy, onBack }: { path: PathEntry[]; step: StepView; busy: boolean; onBack(): void }) {
  return (
    <section className="rounded-panel border border-line bg-surface p-4" aria-labelledby="path">
      <h2 id="path" className="mb-3 text-small font-bold text-ink-2">
        Path so far
      </h2>
      <ol className="m-0 flex list-none flex-col p-0">
        {path.map((e, i) => (
          <li key={e.seq} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2 border-b border-line py-2 last:border-b-0">
            <span className="text-meta font-bold text-ink-3 tabular">{i + 1}</span>
            <span className="min-w-0">
              {e.text && <span className="manual-text block text-small">{e.text}</span>}
              <span className={cx("mt-0.5 inline-flex items-center gap-1 rounded-plate px-2 text-meta font-bold", e.outcome === "goto" ? "border border-ink" : "bg-surface-3")}>
                {e.outcome === "goto" && <CornerDownRight aria-hidden size={14} />}
                {e.value != null ? `${e.value} ${e.unit ?? ""}`.trim() : e.label}
              </span>
            </span>
          </li>
        ))}
        <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2 pt-2">
          <span className="text-meta font-bold tabular">{path.length + 1}</span>
          <span className="text-small font-bold">Now: {(KIND[step.node.kind] ?? step.node.kind).toLowerCase()}</span>
        </li>
      </ol>
      {path.length > 0 && (
        <Button onClick={onBack} disabled={busy} className="no-print mt-3 w-full">
          <Undo2 aria-hidden size={20} />
          Change last answer
        </Button>
      )}
    </section>
  );
}

function PossibleOpen({ label, texts }: { label: string | null; texts: string[] }) {
  return (
    <section className="sheet p-4" aria-label={label ?? "Possible problems"}>
      {label && <h2 className="mb-2 font-sans text-small font-bold text-ink-2">{label}</h2>}
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {texts.map((t) => (
          <li key={t} className="flex gap-2 text-body">
            <span aria-hidden className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-ink" />
            {t}
          </li>
        ))}
      </ul>
    </section>
  );
}

function FigureCard({ figure, src, to, className }: { figure: PackAsset; src: string; to: string; className?: string }) {
  return (
    <Link to={to} className={cx("sheet overflow-hidden no-underline", className)}>
      <img src={src} alt="Figure" width={figure.width ?? undefined} height={figure.height ?? undefined} className="block h-auto max-h-[300px] w-full bg-white object-contain" />
    </Link>
  );
}

function PageThumb({ asset, src, to, label }: { asset: PackAsset; src: string; to: string; label: string | null }) {
  return (
    <Link to={to} className="sheet flex items-center gap-3 p-2 pr-4 no-underline">
      <img src={src} alt="" width={68} height={88} className="h-[88px] w-[68px] shrink-0 border border-line bg-white object-cover object-top" data-asset={asset.asset_id} />
      <span className="min-w-0 flex-1 font-sans">
        <span className="block text-small font-bold text-ink">Original page</span>
        {label && <span className="block text-meta text-ink-3">Page {label}</span>}
      </span>
    </Link>
  );
}

/**
 * A cited answer from the manual, scoped to this job. Quotes are the
 * manual's words, set as the manual; anything else the engine composed is in
 * the app's type. When the manual does not answer, it says so.
 */
function AskSheet({ packId, jobId, query, answer, onQuery }: { packId: string; jobId: string; query: string; answer: AskResponse | null; onQuery(q: string): void }) {
  const [draft, setDraft] = useState(query);
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <Link to={jobPath(jobId)} aria-label="Close" className="absolute inset-0 bg-[var(--scrim)]" />
      <section role="dialog" aria-modal="true" aria-labelledby="ask-title" className="relative flex h-full w-full max-w-[560px] flex-col bg-surface shadow-xl">
        <div className="flex min-h-tap shrink-0 items-center gap-3 border-b border-line px-4 pt-[env(safe-area-inset-top)]">
          <h2 id="ask-title" className="min-w-0 flex-1 text-lead font-bold">
            Ask about this step
          </h2>
          <Link to={jobPath(jobId)} aria-label="Close" className="-mr-2 inline-flex size-11 items-center justify-center rounded-control text-ink">
            <X aria-hidden size={24} />
          </Link>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) onQuery(draft.trim());
            }}
          >
            <input aria-label="Question" value={draft} onChange={(e) => setDraft(e.target.value)} className="block min-h-tap w-full min-w-0 rounded-control border-2 border-line-strong bg-surface px-4 text-body focus:border-ink focus:outline-none" />
            <Button type="submit" variant="primary" disabled={!draft.trim()}>
              Ask
            </Button>
          </form>
          {!query ? null : answer === null ? (
            <div className="flex flex-col gap-3" aria-busy>
              <Skeleton className="h-[132px]" />
              <Skeleton className="h-[96px]" />
            </div>
          ) : (
            <AskBody packId={packId} answer={answer} />
          )}
        </div>
      </section>
    </div>
  );
}

function AskBody({ packId, answer }: { packId: string; answer: AskResponse }) {
  if (answer.mode === "declined" || answer.body.length === 0)
    return (
      <div className="flex flex-col gap-3">
        <p className="text-body">The manual does not answer this for this step.</p>
        {answer.nearest.length > 0 && (
          <div>
            <h3 className="mb-1 text-meta font-bold text-ink-2">Nearest sections</h3>
            <ul className="m-0 flex list-none flex-col p-0">
              {answer.nearest.map((id) => (
                <li key={id}>
                  <Link to={manualPath(packId, id)} className="flex min-h-11 items-center font-semibold text-ink">
                    {id}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      {answer.model && <p className="text-meta text-ink-3">Arranged by the on-device model ({answer.model}). Quotes are checked against the manual.</p>}
      {answer.body.map((s, i) =>
        s.t === "quote" ? (
          <figure key={i} className="sheet m-0">
            <blockquote className="m-0 p-4 text-body">{s.text}</blockquote>
            <figcaption className="border-t border-line px-4 py-2 font-sans">
              <Link to={manualPath(packId, s.section_id)} className="inline-flex min-h-11 items-center text-meta font-semibold text-ink-2">
                {s.section_id}
              </Link>
            </figcaption>
          </figure>
        ) : s.t === "text" ? (
          <p key={i} className="text-body text-ink-2">
            {s.text}
          </p>
        ) : null,
      )}
    </div>
  );
}

