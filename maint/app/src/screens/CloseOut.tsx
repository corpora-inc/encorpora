import { Check, Minus, Plus, X } from "lucide-react";
import type { Lesson, LessonStatus, Outcome, PartUsedInput, ResolutionKind, Run, StepView, TaskView } from "../engine/types.ts";
import { homePath } from "../routes.ts";
import { formatMinutes, formatTime } from "../ui/format.ts";
import { Button, ButtonLink, cx, Field, inputClass } from "../ui/kit.tsx";
import { Guards, ManualSheet, Requirements } from "../ui/manual.tsx";
import { TaskSteps } from "../ui/TaskSteps.tsx";

export type CloseOutPhase = "action" | "verify" | "lesson" | "saved";

export interface LessonDraft {
  cause: string;
  action: string;
  parts: PartUsedInput[];
  minutes: number;
  note: string;
}

export interface CloseOutProps {
  phase: CloseOutPhase;
  /** The step the tree ended on: an action, a referral or the end. */
  step: StepView;
  resolution: ResolutionKind;
  task: TaskView | null;
  run: Run | null;
  draft: LessonDraft;
  saved: Lesson | null;
  busy: boolean;
  onRecord(ord: number, outcome: Outcome, value?: string): void;
  onActionDone(): void;
  onVerified(fixed: boolean): void;
  onDraft(d: LessonDraft): void;
  onSave(): void;
}

/** Corrective action, the check that it fixed it, and the lesson for the next technician. */
export function CloseOut(p: CloseOutProps) {
  const phases: { id: CloseOutPhase; label: string }[] =
    p.step.node.kind === "action"
      ? [
          { id: "action", label: "Corrective action" },
          { id: "verify", label: "Check the fix" },
          { id: "lesson", label: "Lesson" },
        ]
      : [
          { id: "lesson", label: p.resolution === "escalated" ? "Referral" : "Lesson" },
          { id: "saved", label: "Saved" },
        ];
  const at = phases.findIndex((x) => x.id === p.phase);
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pt-4 pb-10 sm:px-6 lg:px-8">
      <header className="mb-5">
        <h1 className="text-h3 sm:text-h2">{p.step.tree.title}</h1>
        <ol className={cx("m-0 mt-3 grid list-none gap-2 p-0", phases.length === 3 ? "grid-cols-3" : "grid-cols-2")} aria-label="Close-out steps">
          {phases.map((x, i) => {
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
      {p.phase === "action" && <ActionPhase {...p} />}
      {p.phase === "verify" && <VerifyPhase {...p} />}
      {p.phase === "lesson" && <LessonPhase {...p} />}
      {p.phase === "saved" && p.saved && <SavedPhase lesson={p.saved} resolution={p.resolution} />}
    </div>
  );
}

function ActionPhase(p: CloseOutProps) {
  const t = p.task;
  const applicable = t?.steps.filter((s) => s.applies) ?? [];
  const recorded = p.run?.steps.length ?? 0;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Guards guards={p.step.guards} />
        <ManualSheet citation={p.step.citation}>{p.step.node.text}</ManualSheet>
        {t && (
          <section className="sheet" aria-labelledby="task">
            <h2 id="task" className="flex min-h-tap items-center px-4 font-sans text-small font-bold sm:px-5">
              {t.title}
            </h2>
            <TaskSteps task={t} records={p.run?.steps ?? []} busy={p.busy} onRecord={p.onRecord} />
          </section>
        )}
        <Button variant="primary" size="lg" className="w-full" onClick={p.onActionDone} disabled={p.busy || (!!t && recorded < applicable.length)}>
          Corrective action done
        </Button>
      </div>
      <aside className="rounded-panel border border-line bg-surface p-4">
        <Requirements items={t ? t.requirements : p.step.requirements} />
      </aside>
    </div>
  );
}

function VerifyPhase(p: CloseOutProps) {
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4">
      <h2 className="text-h2">Did it fix it?</h2>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => p.onVerified(true)} disabled={p.busy} className="min-h-result rounded-control border-2 border-ink bg-surface text-lead font-bold active:bg-surface-3">
          Fixed
        </button>
        <button type="button" onClick={() => p.onVerified(false)} disabled={p.busy} className="min-h-result rounded-control border-2 border-ink bg-surface text-lead font-bold active:bg-surface-3">
          Not fixed
        </button>
      </div>
      <p className="text-meta text-ink-3">Not fixed goes back to the last question, so you can take the next branch.</p>
    </div>
  );
}

function LessonPhase(p: CloseOutProps) {
  const d = p.draft;
  const set = (patch: Partial<LessonDraft>) => p.onDraft({ ...d, ...patch });
  const causes = p.step.possible_open;
  return (
    <form
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
      onSubmit={(e) => {
        e.preventDefault();
        p.onSave();
      }}
    >
      <div className="flex min-w-0 flex-col gap-4 rounded-panel border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-h3">{p.resolution === "escalated" ? "What you found" : "What fixed it"}</h2>
        <Field label="Verified cause">
          <input className={inputClass} value={d.cause} onChange={(e) => set({ cause: e.target.value })} />
        </Field>
        {causes.length > 0 && (
          <div className="-mt-2 flex flex-wrap gap-2" role="group" aria-label="Possible problems from the manual">
            {causes.map((c) => (
              <button key={c} type="button" aria-pressed={d.cause === c} onClick={() => set({ cause: c })} className={cx("manual-text inline-flex min-h-11 items-center rounded-full border-2 px-3 text-small", d.cause === c ? "border-ink bg-ink text-surface" : "border-line-strong bg-sheet")}>
                {c}
              </button>
            ))}
          </div>
        )}
        <Field label="Action taken">
          <input className={inputClass} value={d.action} onChange={(e) => set({ action: e.target.value })} />
        </Field>
        <div>
          <span className="mb-1.5 block text-meta font-semibold text-ink-2">Parts used</span>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {d.parts.map((part, i) => (
              <li key={i} className="flex min-h-tap items-center gap-3 rounded-control border-2 border-line bg-surface-2 pl-4">
                {part.ident && <span className="code shrink-0 text-small">{part.ident}</span>}
                <span className="min-w-0 flex-1 truncate text-small">{part.text}</span>
                {part.qty && <span className="shrink-0 text-small font-semibold tabular">x{part.qty}</span>}
                <button type="button" aria-label={`Remove ${part.text}`} onClick={() => set({ parts: d.parts.filter((_, j) => j !== i) })} className="inline-flex size-12 shrink-0 items-center justify-center">
                  <X aria-hidden size={20} />
                </button>
              </li>
            ))}
            {d.parts.length === 0 && <li className="text-small text-ink-3">None</li>}
          </ul>
        </div>
        <div>
          <span className="mb-1.5 block text-meta font-semibold text-ink-2">Time on the job</span>
          <div className="inline-flex items-stretch overflow-hidden rounded-control border-2 border-line-strong bg-surface">
            <button type="button" aria-label="Five minutes less" onClick={() => set({ minutes: Math.max(0, d.minutes - 5) })} className="flex min-h-tap w-14 items-center justify-center">
              <Minus aria-hidden size={22} />
            </button>
            <output className="flex min-w-[8.5rem] items-center justify-center border-x-2 border-line-strong text-lead font-bold tabular">{formatMinutes(d.minutes)}</output>
            <button type="button" aria-label="Five minutes more" onClick={() => set({ minutes: d.minutes + 5 })} className="flex min-h-tap w-14 items-center justify-center">
              <Plus aria-hidden size={22} />
            </button>
          </div>
        </div>
        <Field label="Note for the next technician">
          <textarea rows={3} className={cx(inputClass, "py-3")} value={d.note} onChange={(e) => set({ note: e.target.value })} />
        </Field>
      </div>
      <div className="flex flex-col gap-4">
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={p.busy || !d.cause.trim() || !d.action.trim()}>
          {p.resolution === "escalated" ? "Save and close as referred" : "Save lesson and close"}
        </Button>
        <p className="text-meta text-ink-3">Saved on this device at once. It syncs to the hub when a link returns, and reaches other technicians after review.</p>
      </div>
    </form>
  );
}

const TRACK: { id: LessonStatus; label: string }[] = [
  { id: "local", label: "Saved on this device" },
  { id: "queued", label: "Waiting to sync" },
  { id: "uploaded", label: "Sent to hub" },
  { id: "approved", label: "Approved for the fleet" },
];

export function SavedPhase({ lesson, resolution }: { lesson: Lesson; resolution: ResolutionKind }) {
  const at = Math.max(
    0,
    TRACK.findIndex((t) => t.id === (lesson.status === "edited" ? "approved" : lesson.status)),
  );
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-5">
      <h2 className="text-h2">{resolution === "escalated" ? "Job closed as referred" : "Job closed"}</h2>
      {lesson.status === "rejected" ? (
        <p className="text-body">The reviewer did not approve this lesson.{lesson.review_note && ` ${lesson.review_note}`}</p>
      ) : (
        <ol className="m-0 flex list-none flex-col p-0" aria-label="Lesson status">
          {TRACK.map((t, i) => {
            const reached = i <= at;
            return (
              <li key={t.id} aria-current={i === at ? "step" : undefined} className="grid min-h-14 grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3">
                <span className={cx("flex size-9 items-center justify-center rounded-full border-2", reached ? "border-ink bg-ink text-surface" : "border-line-strong text-ink-3")}>{reached ? <Check aria-hidden size={20} /> : <span className="text-meta font-bold">{i + 1}</span>}</span>
                <span className={cx("text-body", reached ? "font-bold" : "text-ink-3")}>
                  {t.label}
                  {t.id === "local" && <span className="font-normal text-ink-3"> {formatTime(lesson.created_at)}</span>}
                  {t.id === "approved" && lesson.status === "edited" && <span className="font-normal text-ink-3"> with edits</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
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
