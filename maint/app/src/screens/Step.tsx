import { Camera, ChevronDown, ChevronUp, MessageCircleQuestion, NotebookPen, Printer, Undo2, X, ArrowUpRight, Cpu } from "lucide-react";
import { Link } from "react-router";
import type { AskAnswer, Asset, Attachment, Facet, PathEntry, ResultInput, StepView } from "../engine/types.ts";
import { closeOutPath, jobAskPath, jobPagePath, jobPath, printJobPath, procedurePath } from "../routes.ts";
import { Button, cx, Segmented, Skeleton } from "../ui/kit.tsx";
import { Keypad } from "../ui/Keypad.tsx";
import { citationText, FieldNotes, Guards, ManualSheet, Requirements, sectionTitle } from "../ui/manual.tsx";

export type StepOverlay = { kind: "page"; asset: Asset } | { kind: "ask"; query: string; answer: AskAnswer | null } | null;

export interface StepProps {
  step: StepView;
  /** The symptom this job started from. */
  symptom: string;
  /** "sending": the result is with the engine; the step stays put until the next one arrives. */
  phase: "ready" | "sending";
  /** Typed value for a measurement. */
  draft: string;
  attachments: Attachment[];
  testOpen: boolean;
  overlay: StepOverlay;
  model: boolean;
  onDraft(v: string): void;
  onAnswer(input: ResultInput): void;
  onLevel(levelId: string): void;
  onTestOpen(open: boolean): void;
  onBack(): void;
  onPhoto(): void;
  onNote(): void;
  onAskQuery(q: string): void;
}

const KIND = { symptom: "Symptom", check: "Check", action: "Action", goto: "Continue", escalate: "Refer", end: "End" } as const;

/** One question per screen: the manual's words, its warnings first, and large controls for the result. */
export function Step(p: StepProps) {
  const { step } = p;
  const page = step.assets.find((a) => a.role === "page") ?? null;
  const figure = step.assets.find((a) => a.role === "figure") ?? null;
  const possible = step.facets.find((f) => f.facet === "possible") ?? null;
  const known = step.facets.filter((f) => f.facet === "known");
  const facets = step.facets.filter((f) => f.facet !== "possible" && f.facet !== "known");
  const needs = [...step.setup.conditions, ...step.requirements];
  const busy = p.phase === "sending";
  const pageOpen = p.overlay?.kind === "page" ? p.overlay.asset : null;
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-4 pb-10 sm:px-6 lg:px-8">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-h3 sm:text-h2">{p.symptom}</h1>
          <p className="text-small text-ink-2">
            Step {step.step_no}, {KIND[step.kind].toLowerCase()}
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Link to={jobAskPath(step.job_id)} className="inline-flex min-h-tap items-center gap-2 rounded-control border-2 border-line-strong bg-surface px-5 text-small font-semibold whitespace-nowrap text-ink no-underline">
            <MessageCircleQuestion aria-hidden size={20} />
            Ask about this step
          </Link>
          <Link to={printJobPath(step.job_id)} aria-label="Print this job" className="inline-flex size-tap items-center justify-center rounded-control border-2 border-line-strong bg-surface text-ink">
            <Printer aria-hidden size={22} />
          </Link>
        </div>
      </header>

      <div className={cx("grid items-start gap-6", pageOpen ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)_380px]")}>
        <article aria-busy={busy} className={cx("flex min-w-0 flex-col gap-4", busy && "opacity-60")}>
          <Guards guards={step.guards} />

          <ManualSheet citation={step.citation} onPage={page ? jobPagePath(step.job_id, page.asset_id) : undefined}>
            {step.text}
          </ManualSheet>

          {figure && !pageOpen && <FigureCard figure={figure} jobId={step.job_id} className="lg:hidden" />}

          {facets.length > 0 && <FacetSheet facets={facets} />}

          {step.test_steps.length > 0 && <TestSteps step={step} open={p.testOpen || step.test_steps_fold === "expanded"} folded={step.test_steps_fold === "collapsed"} onOpen={p.onTestOpen} />}

          {needs.length > 0 && (
            <section className="rounded-panel border border-line bg-surface p-4 lg:hidden">
              <Requirements items={needs} columns />
            </section>
          )}

          <ResultControls {...p} busy={busy} />

          <div className="no-print flex flex-wrap items-center gap-2">
            <Button onClick={p.onPhoto} disabled={busy}>
              <Camera aria-hidden size={22} />
              Photo
            </Button>
            <Button onClick={p.onNote} disabled={busy}>
              <NotebookPen aria-hidden size={22} />
              Note
            </Button>
            {p.attachments.map((a) => (
              <span key={a.id} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-control bg-surface-3 px-3 text-meta font-semibold">
                {a.kind === "photo" ? <Camera aria-hidden size={18} className="shrink-0" /> : <NotebookPen aria-hidden size={18} className="shrink-0" />}
                <span className="truncate">{a.kind === "photo" ? "Photo" : a.text}</span>
              </span>
            ))}
          </div>

          <div className="no-print border-t border-line pt-4">
            <Segmented label="Detail" value={step.level} options={step.levels.map((l) => ({ value: l.id, label: l.label }))} onChange={p.onLevel} />
          </div>
        </article>

        <aside className="flex min-w-0 flex-col gap-4" aria-label="Job">
          {pageOpen ? (
            <PageViewer asset={pageOpen} jobId={step.job_id} citation={citationText(step.citation)} docked />
          ) : (
            page && <PageThumb asset={page} jobId={step.job_id} />
          )}
          {figure && !pageOpen && <FigureCard figure={figure} jobId={step.job_id} className="hidden lg:block" />}
          {needs.length > 0 && (
            <section className="hidden rounded-panel border border-line bg-surface p-4 lg:block">
              <Requirements items={needs} />
            </section>
          )}
          <PathSoFar path={step.path} current={step} busy={busy} onBack={p.onBack} />
          {known.length > 0 && <FacetSheet facets={known} />}
          {possible && <PossibleOpen facet={possible} />}
          <FieldNotes notes={step.field_notes} compact />
        </aside>
      </div>

      {pageOpen && (
        <div className="fixed inset-0 z-40 bg-page lg:hidden">
          <PageViewer asset={pageOpen} jobId={step.job_id} citation={citationText(step.citation)} />
        </div>
      )}
      {p.overlay?.kind === "ask" && <AskSheet jobId={step.job_id} query={p.overlay.query} answer={p.overlay.answer} model={p.model} onQuery={p.onAskQuery} />}
    </div>
  );
}

function FigureCard({ figure, jobId, className }: { figure: Asset; jobId: string; className?: string }) {
  return (
    <Link to={jobPagePath(jobId, figure.asset_id)} className={cx("sheet overflow-hidden no-underline", className)}>
      <img src={figure.url} alt={figure.label ?? "Figure"} width={figure.width ?? undefined} height={figure.height ?? undefined} className="block h-auto max-h-[300px] w-full bg-white object-contain" />
      <span className="block border-t border-line px-4 py-2 font-sans text-meta text-ink-3">{figure.label}</span>
    </Link>
  );
}

function FacetSheet({ facets }: { facets: Facet[] }) {
  const shown = facets.filter((f) => f.shown);
  if (shown.length === 0) return null;
  return (
    <section className="sheet flex flex-col gap-3 p-4 sm:p-5">
      {shown.map((f) => (
        <div key={f.facet}>
          <h2 className="font-sans text-meta font-bold text-ink-2">{f.label}</h2>
          {f.texts.map((t, i) => (
            <p key={i} className="text-body">
              {t}
            </p>
          ))}
        </div>
      ))}
    </section>
  );
}

function TestSteps({ step, open, folded, onOpen }: { step: StepView; open: boolean; folded: boolean; onOpen(o: boolean): void }) {
  return (
    <section className="sheet">
      <div className="flex min-h-tap items-center justify-between gap-3 px-4 sm:px-5">
        <h2 className="font-sans text-small font-bold">Test procedure</h2>
        {folded && (
          <button type="button" onClick={() => onOpen(!open)} aria-expanded={open} className="-mr-2 inline-flex min-h-11 items-center gap-1 rounded-control px-2 font-sans text-small font-semibold text-ink-2">
            {open ? "Hide" : `Show ${step.test_steps.length} steps`}
            {open ? <ChevronUp aria-hidden size={20} /> : <ChevronDown aria-hidden size={20} />}
          </button>
        )}
      </div>
      {open && (
        <ol className="m-0 flex list-none flex-col gap-3 border-t border-line px-4 py-4 sm:px-5">
          {step.test_steps.map((t) => (
            <li key={t.n} className="flex flex-col gap-2">
              <Guards guards={t.guards} />
              <div className="flex gap-3">
                <span className="w-6 shrink-0 font-sans text-body font-bold tabular">{t.n}.</span>
                <span className="text-body">{t.text}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ResultControls(p: StepProps & { busy: boolean }) {
  const { step, busy } = p;
  const e = step.expect;
  if (step.kind === "escalate" || step.kind === "end")
    return (
      <div className="no-print">
        <Link to={closeOutPath(step.job_id)} className="flex min-h-result w-full items-center justify-center rounded-control border-2 border-ink bg-ink text-lead font-semibold text-surface no-underline">
          {step.kind === "escalate" ? "Close as referred" : "Close the job"}
        </Link>
      </div>
    );
  if (!e) return null;
  if (e.kind === "value")
    return (
      <section className="no-print flex flex-col gap-3 rounded-panel border-2 border-ink bg-surface p-4" aria-label="Record the result">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Keypad value={p.draft} unit={e.unit} onChange={p.onDraft} label="Measured value" />
          <div className="flex flex-col gap-3">
            <h2 className="text-small font-bold text-ink-2">The manual branches at</h2>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {step.branches.map((b) => (
                <li key={b.outcome} className="manual-text rounded-control border border-line bg-sheet px-3 py-2 text-body">
                  {b.label}
                </li>
              ))}
            </ul>
            <div className="flex-1" />
            <Button variant="primary" size="lg" className="w-full" disabled={busy || !isNumber(p.draft)} onClick={() => p.onAnswer({ value: Number(p.draft), unit: e.unit })}>
              Record {p.draft && isNumber(p.draft) ? `${p.draft} ${e.unit}` : "value"}
            </Button>
          </div>
        </div>
      </section>
    );
  return (
    <section className="no-print flex flex-col gap-3" aria-label="Record the result">
      {step.kind === "action" && step.target?.kind === "procedure" && (
        <Link to={procedurePath(step.target.id)} className="flex min-h-tap items-center justify-between gap-3 rounded-control border-2 border-line-strong bg-surface px-4 text-small font-semibold text-ink no-underline">
          <span className="min-w-0 truncate">Open the procedure: {step.target.title}</span>
          <ArrowUpRight aria-hidden size={22} className="shrink-0" />
        </Link>
      )}
      <div className={cx("grid gap-3", step.branches.length === 1 ? "grid-cols-1" : step.branches.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
        {step.branches.map((b) => (
          <button
            key={b.outcome}
            type="button"
            disabled={busy}
            onClick={() => p.onAnswer({ outcome: b.outcome })}
            className={cx(
              "flex min-h-result items-center justify-center rounded-control border-2 px-4 text-lead font-bold disabled:opacity-40 active:translate-y-px",
              step.branches.length === 1 ? "border-ink bg-ink text-surface" : "border-ink bg-surface text-ink active:bg-surface-3",
            )}
          >
            {b.label}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Text the keypad produced is a number. Parsing input, not judging it: the engine branches. */
const isNumber = (s: string) => s !== "" && s !== "-" && s !== "." && Number.isFinite(Number(s));

function PathSoFar({ path, current, busy, onBack }: { path: PathEntry[]; current: StepView; busy: boolean; onBack(): void }) {
  return (
    <section className="rounded-panel border border-line bg-surface p-4" aria-labelledby="path">
      <h2 id="path" className="mb-3 text-small font-bold text-ink-2">
        Path so far
      </h2>
      <ol className="m-0 flex list-none flex-col p-0">
        {path.map((e, i) => (
          <li key={e.node_id} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2 border-b border-line py-2 last:border-b-0">
            <span className="text-meta font-bold text-ink-3 tabular">{i + 1}</span>
            <span className="min-w-0">
              <span className="manual-text block text-small">{e.text}</span>
              {e.result && <span className="mt-0.5 inline-block rounded-plate bg-surface-3 px-2 text-meta font-bold">{e.result}</span>}
            </span>
          </li>
        ))}
        <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2 pt-2">
          <span className="text-meta font-bold tabular">{path.length + 1}</span>
          <span className="text-small font-bold">Now: {KIND[current.kind].toLowerCase()}, {sectionTitle(current.citation)}</span>
        </li>
      </ol>
      {current.step_no > 1 && (
        <Button onClick={onBack} disabled={busy} className="no-print mt-3 w-full">
          <Undo2 aria-hidden size={20} />
          Change last answer
        </Button>
      )}
    </section>
  );
}

function PossibleOpen({ facet }: { facet: Facet }) {
  return (
    <section className="sheet p-4" aria-labelledby="possible">
      <h2 id="possible" className="mb-2 font-sans text-small font-bold text-ink-2">
        {facet.label}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {facet.texts.map((t) => (
          <li key={t} className="flex gap-2 text-body">
            <span aria-hidden className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-ink" />
            {t}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PageThumb({ asset, jobId }: { asset: Asset; jobId: string }) {
  return (
    <Link to={jobPagePath(jobId, asset.asset_id)} className="sheet flex items-center gap-3 p-2 pr-4 no-underline">
      <img src={asset.url} alt="" width={68} height={88} className="h-[88px] w-[68px] shrink-0 border border-line bg-white object-cover object-top" />
      <span className="min-w-0 flex-1 font-sans">
        <span className="block text-small font-bold text-ink">Original page</span>
        <span className="block text-meta text-ink-3">{asset.label}</span>
      </span>
    </Link>
  );
}

/** The original page, beside the step on wide screens and over it on narrow ones. */
function PageViewer({ asset, jobId, citation, docked = false }: { asset: Asset; jobId: string; citation: string; docked?: boolean }) {
  return (
    <section className={cx("flex flex-col", docked ? "sheet sticky top-[calc(var(--spacing-strip)+16px)] hidden max-h-[calc(100dvh-var(--spacing-strip)-32px)] lg:flex" : "h-full")} aria-label={asset.label ?? "Original page"}>
      <div className="flex min-h-tap shrink-0 items-center gap-3 border-b border-line bg-sheet px-4 pt-[env(safe-area-inset-top)]">
        <span className="min-w-0 flex-1 truncate font-sans text-small font-bold">{asset.label}</span>
        <Link to={jobPath(jobId)} aria-label="Close the page" className="-mr-2 inline-flex size-11 items-center justify-center rounded-control text-ink">
          <X aria-hidden size={24} />
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-surface-3 p-3">
        <img src={asset.url} alt={asset.label ?? "Original page"} width={asset.width ?? undefined} height={asset.height ?? undefined} className="mx-auto block h-auto w-full max-w-[850px] bg-white shadow-sm" />
      </div>
      <p className="shrink-0 border-t border-line bg-sheet px-4 py-2 font-sans text-meta text-ink-3">{citation}</p>
    </section>
  );
}

/** A cited answer from the manual, scoped to this job. Every sentence is the manual's. */
function AskSheet({ jobId, query, answer, model, onQuery }: { jobId: string; query: string; answer: AskAnswer | null; model: boolean; onQuery(q: string): void }) {
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
          <form onSubmit={(e) => e.preventDefault()}>
            <input aria-label="Question" value={query} onChange={(e) => onQuery(e.target.value)} className="block min-h-tap w-full rounded-control border-2 border-line-strong bg-surface px-4 text-body focus:border-ink focus:outline-none" />
          </form>
          {answer === null ? (
            <div className="flex flex-col gap-3" aria-busy>
              <Skeleton className="h-[132px]" />
              <Skeleton className="h-[132px]" />
            </div>
          ) : (
            <>
              {model && answer.summary && (
                <div className="flex gap-2.5 rounded-control border-2 border-line-strong p-3">
                  <Cpu aria-hidden size={20} className="mt-0.5 shrink-0 text-ink-3" />
                  <div>
                    <p className="text-body">{answer.summary}</p>
                    <p className="mt-1 text-meta text-ink-3">On-device model. The manual's words follow.</p>
                  </div>
                </div>
              )}
              {answer.passages.map((a, i) => (
                <ManualSheet key={i} citation={a.citation} size="body">
                  {a.text}
                </ManualSheet>
              ))}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
