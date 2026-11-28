import { Camera, Check, Minus, Plus } from "lucide-react";
import type { Citation, Lesson, LessonStatus, Procedure, StepView } from "../engine/types.ts";
import { homePath } from "../routes.ts";
import { Button, ButtonLink, cx, Field, inputClass, StatusBadge } from "../ui/kit.tsx";
import { Guards, ManualSheet, Requirements } from "../ui/manual.tsx";

export type CloseOutPhase = "procedure" | "verify" | "lesson" | "saved";

export interface CloseOutProps {
  phase: CloseOutPhase;
  symptom: string;
  /** The corrective action step the tree ended on. */
  action: StepView;
  procedure: Procedure | null;
  /** The manual's operating check that proves the fix, when it names one. */
  verify: { text: string; citation: Citation } | null;
  /** Procedure steps marked done. */
  done: number[];
  lesson: Lesson;
  onStepDone(n: number): void;
  onProcedureDone(): void;
  onVerified(fixed: boolean): void;
  onLesson(l: Lesson): void;
  onSave(): void;
}

const PHASES: { id: CloseOutPhase; label: string }[] = [
  { id: "procedure", label: "Corrective action" },
  { id: "verify", label: "Check the fix" },
  { id: "lesson", label: "Lesson" },
];

/** Corrective action, the check that it fixed it, and the lesson for the next technician. */
export function CloseOut(p: CloseOutProps) {
  const at = PHASES.findIndex((x) => x.id === p.phase);
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pt-4 pb-10 sm:px-6 lg:px-8">
      <header className="mb-5">
        <h1 className="text-h3 sm:text-h2">{p.symptom}</h1>
        <ol className="m-0 mt-3 grid list-none grid-cols-3 gap-2 p-0" aria-label="Close-out steps">
          {PHASES.map((x, i) => {
            const state = p.phase === "saved" || i < at ? "done" : i === at ? "now" : "next";
            return (
              <li key={x.id} aria-current={state === "now" ? "step" : undefined} className={cx("flex min-h-12 items-center gap-2 border-t-4 pt-2 text-meta font-semibold", state === "next" ? "border-line text-ink-3" : "border-ink text-ink")}>
                {state === "done" && <Check aria-hidden size={18} className="shrink-0" />}
                <span>{x.label}</span>
              </li>
            );
          })}
        </ol>
      </header>
      {p.phase === "procedure" && <ProcedurePhase {...p} />}
      {p.phase === "verify" && <VerifyPhase {...p} />}
      {p.phase === "lesson" && <LessonPhase {...p} />}
      {p.phase === "saved" && <SavedPhase lesson={p.lesson} />}
    </div>
  );
}

function ProcedurePhase(p: CloseOutProps) {
  const proc = p.procedure;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-4">
        <ManualSheet citation={p.action.citation}>{p.action.text}</ManualSheet>
        {proc && (
          <>
            <Guards guards={proc.guards} />
            <section className="sheet" aria-labelledby="proc">
              <h2 id="proc" className="flex min-h-tap items-center px-4 font-sans text-small font-bold sm:px-5">
                {proc.title}
              </h2>
              <ol className="m-0 list-none border-t border-line p-0">
                {proc.steps.map((s) => {
                  const on = p.done.includes(s.n);
                  return (
                    <li key={s.n} className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-b-0 sm:px-5">
                      <Guards guards={s.guards} />
                      <div className="flex items-start gap-3">
                        <span className="w-7 shrink-0 pt-0.5 font-sans text-body font-bold tabular">{s.n}.</span>
                        <p className="min-w-0 flex-1 text-body">{s.text}</p>
                        <button
                          type="button"
                          aria-pressed={on}
                          aria-label={`Step ${s.n} done`}
                          onClick={() => p.onStepDone(s.n)}
                          className={cx("inline-flex size-tap shrink-0 items-center justify-center rounded-control border-2 font-sans", on ? "border-ink bg-ink text-surface" : "border-line-strong bg-surface text-ink-3")}
                        >
                          <Check aria-hidden size={26} strokeWidth={on ? 3 : 2} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          </>
        )}
        <Button variant="primary" size="lg" className="w-full" onClick={p.onProcedureDone} disabled={!!proc && p.done.length < proc.steps.length}>
          Corrective action done
        </Button>
      </div>
      <aside className="rounded-panel border border-line bg-surface p-4">
        <Requirements items={proc ? [...proc.setup.conditions, ...proc.requirements] : p.action.requirements} />
      </aside>
    </div>
  );
}

function VerifyPhase(p: CloseOutProps) {
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4">
      <h2 className="text-h2">Did it fix it?</h2>
      {p.verify && <ManualSheet citation={p.verify.citation} size="body">{p.verify.text}</ManualSheet>}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => p.onVerified(true)} className="min-h-result rounded-control border-2 border-ink bg-surface text-lead font-bold active:bg-surface-3">
          Fixed
        </button>
        <button type="button" onClick={() => p.onVerified(false)} className="min-h-result rounded-control border-2 border-ink bg-surface text-lead font-bold active:bg-surface-3">
          Not fixed
        </button>
      </div>
      <p className="text-meta text-ink-3">Not fixed goes back to troubleshooting.</p>
    </div>
  );
}

function LessonPhase(p: CloseOutProps) {
  const l = p.lesson;
  const set = (patch: Partial<Lesson>) => p.onLesson({ ...l, ...patch });
  return (
    <form
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
      onSubmit={(e) => {
        e.preventDefault();
        p.onSave();
      }}
    >
      <div className="flex min-w-0 flex-col gap-4 rounded-panel border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-h3">What fixed it</h2>
        <Field label="Verified cause">
          <input className={inputClass} value={l.cause} onChange={(e) => set({ cause: e.target.value })} />
        </Field>
        <Field label="Action taken">
          <input className={inputClass} value={l.action} onChange={(e) => set({ action: e.target.value })} />
        </Field>
        <div>
          <span className="mb-1.5 block text-meta font-semibold text-ink-2">Parts used</span>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {l.parts.map((part, i) => (
              <li key={i} className="flex min-h-tap items-center gap-3 rounded-control border-2 border-line bg-surface-2 px-4">
                <span className="code shrink-0 text-small">{part.ident}</span>
                <span className="min-w-0 flex-1 truncate text-small">{part.text}</span>
                <span className="shrink-0 text-small font-semibold tabular">x{part.qty}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <span className="mb-1.5 block text-meta font-semibold text-ink-2">Time on the job</span>
          <div className="inline-flex items-stretch overflow-hidden rounded-control border-2 border-line-strong bg-surface">
            <button type="button" aria-label="Five minutes less" onClick={() => set({ minutes: Math.max(0, (l.minutes ?? 0) - 5) })} className="flex min-h-tap w-14 items-center justify-center">
              <Minus aria-hidden size={22} />
            </button>
            <output className="flex min-w-[8.5rem] items-center justify-center border-x-2 border-line-strong text-lead font-bold tabular">{formatMinutes(l.minutes ?? 0)}</output>
            <button type="button" aria-label="Five minutes more" onClick={() => set({ minutes: (l.minutes ?? 0) + 5 })} className="flex min-h-tap w-14 items-center justify-center">
              <Plus aria-hidden size={22} />
            </button>
          </div>
        </div>
        <Field label="Note for the next technician">
          <textarea rows={3} className={cx(inputClass, "py-3")} value={l.note} onChange={(e) => set({ note: e.target.value })} />
        </Field>
      </div>
      <div className="flex flex-col gap-4">
        <section className="rounded-panel border border-line bg-surface p-4" aria-label="Photos">
          <h2 className="mb-3 text-small font-bold text-ink-2">Photos</h2>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: l.photos }, (_, i) => (
              <div key={i} className="flex aspect-square items-center justify-center rounded-control bg-surface-3 text-ink-3">
                <Camera aria-hidden size={24} />
              </div>
            ))}
            <button type="button" aria-label="Add a photo" className="flex aspect-square items-center justify-center rounded-control border-2 border-dashed border-line-strong text-ink-2">
              <Plus aria-hidden size={26} />
            </button>
          </div>
        </section>
        <Button type="submit" variant="primary" size="lg" className="w-full">
          Save lesson
        </Button>
        <p className="text-meta text-ink-3">Saved on this device at once. It syncs to the hub when a link returns, and appears for others after review.</p>
      </div>
    </form>
  );
}

const formatMinutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min` : `${m} min`);

const TRACK: { id: LessonStatus; label: string }[] = [
  { id: "local", label: "Saved on this device" },
  { id: "queued", label: "Waiting to sync" },
  { id: "uploaded", label: "Sent to hub" },
  { id: "approved", label: "Approved for the fleet" },
];

function SavedPhase({ lesson }: { lesson: Lesson }) {
  const at = TRACK.findIndex((t) => t.id === lesson.status);
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-h2">Lesson saved</h2>
        {lesson.status !== "local" && <StatusBadge status={lesson.status} />}
      </div>
      <ol className="m-0 flex list-none flex-col p-0" aria-label="Lesson status">
        {TRACK.map((t, i) => {
          const reached = i <= at;
          return (
            <li key={t.id} className="grid min-h-14 grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3">
              <span className={cx("flex size-9 items-center justify-center rounded-full border-2", reached ? "border-ink bg-ink text-surface" : "border-line-strong text-ink-3")}>{reached ? <Check aria-hidden size={20} /> : <span className="text-meta font-bold">{i + 1}</span>}</span>
              <span className={cx("text-body", reached ? "font-bold" : "text-ink-3")}>
                {t.label}
                {t.id === "local" && <span className="font-normal text-ink-3"> {lesson.saved_at}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      <section className="rounded-panel border border-line bg-surface p-4">
        <p className="text-body">
          <span className="font-bold">Cause:</span> {lesson.cause}
        </p>
        <p className="text-body">
          <span className="font-bold">Action:</span> {lesson.action}
        </p>
      </section>
      <ButtonLink to={homePath()} variant="primary" size="lg" className="w-full">
        Done
      </ButtonLink>
    </div>
  );
}
