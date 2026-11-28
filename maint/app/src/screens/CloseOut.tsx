import { useId } from "react";
import { Check, Minus, Plus, X } from "lucide-react";
import type { Lesson, LessonStatus, Outcome, PartUsedInput, ResolutionKind, Run, StepView, TaskView } from "../engine/types.ts";
import { homePath } from "../routes.ts";
import { formatMinutes, formatTime } from "../ui/format.ts";
import { Button, ButtonLink, cx, inputClass } from "../ui/kit.tsx";
import { Guards, ManualSheet, Requirements } from "../ui/manual.tsx";
import { TaskSteps } from "../ui/TaskSteps.tsx";
import { VoiceControl, voiceStatus, type VoicePhase } from "../ui/VoiceControl.tsx";
import type { FieldFrom, PrefillField, ShownProposal } from "../engine/shown.ts";

export type CloseOutPhase = "action" | "verify" | "lesson" | "saved";

export interface LessonDraft {
  cause: string;
  action: string;
  parts: PartUsedInput[];
  minutes: number;
  note: string;
  /** Fields a model filled that the technician has not yet tapped or edited. */
  suggested?: PrefillField[];
  /** Fields the note did not state: empty is fine, saved as "Not stated". */
  notStated?: PrefillField[];
}

/** What an unstated cause or action is saved as. */
export const NOT_STATED = "Not stated";

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
  /** Fill the form from the note (`lesson.prefill`); absent when no model is in use. */
  onPrefill?(): void;
  prefilling: boolean;
  /** Saving with suggested fields untouched: the inline question is open. */
  confirming: boolean;
  onConfirming(open: boolean): void;
  voice: VoicePhase;
  onVoice(): void;
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

/**
 * Lay a proposal over the draft: values from the job or the pack (a model's pick among the
 * listed causes, actions and parts) fill their fields, a model's marked Suggested until
 * confirmed; what the note did not state keeps the draft's value, or stays empty as not stated.
 */
export function applyProposal(d: LessonDraft, s: ShownProposal): LessonDraft {
  const next: LessonDraft = { ...d, suggested: [...(d.suggested ?? [])], notStated: [...(d.notStated ?? [])] };
  const mark = (f: PrefillField, from: FieldFrom, empty: boolean) => {
    next.suggested = next.suggested!.filter((x) => x !== f);
    next.notStated = next.notStated!.filter((x) => x !== f);
    if (from === "model") next.suggested!.push(f);
    if (from === "unknown" && empty) next.notStated!.push(f);
  };
  for (const f of ["cause", "action"] as const) {
    if (s[f].value !== null) next[f] = s[f].value!;
    mark(f, s[f].from, !next[f].trim());
  }
  if (s.parts.value !== null) next.parts = s.parts.value.map((x) => ({ ident: x.ident, text: x.text, qty: x.qty }));
  mark("parts", s.parts.from, next.parts.length === 0);
  if (s.minutes.value !== null) next.minutes = s.minutes.value;
  mark("minutes", s.minutes.from, false);
  return next;
}

const FIELD_LABEL: Record<PrefillField, string> = { cause: "Cause", action: "Action", parts: "Parts", minutes: "Time", note: "Note" };

/** A model's value, not yet confirmed: tapping the mark (or the field) confirms it. */
function SuggestedMark({ field, on, onConfirm }: { field: PrefillField; on: boolean; onConfirm(f: PrefillField): void }) {
  if (!on) return null;
  return (
    <button type="button" onClick={() => onConfirm(field)} aria-label={`Suggested ${FIELD_LABEL[field].toLowerCase()}, tap to confirm`} data-suggested={field} className="ml-2 inline-flex min-h-11 items-center rounded-full px-1 align-middle">
      <span className="rounded-full border border-dashed border-ink-2 px-2 py-0.5 text-meta font-semibold text-ink-2">Suggested</span>
    </button>
  );
}

/** A field's label, with its Suggested mark beside it (outside the label, so the mark is its own control). */
function Label({ id, field, text, d, onConfirm }: { id: string; field: PrefillField; text: string; d: LessonDraft; onConfirm(f: PrefillField): void }) {
  return (
    <div className="mb-1.5 flex min-h-11 flex-wrap items-center text-meta font-semibold text-ink-2">
      <span id={id}>{text}</span>
      <SuggestedMark field={field} on={!!d.suggested?.includes(field)} onConfirm={onConfirm} />
    </div>
  );
}

function LessonPhase(p: CloseOutProps) {
  const d = p.draft;
  const suggested = d.suggested ?? [];
  const notStated = d.notStated ?? [];
  const confirm = (f: PrefillField) => suggested.includes(f) && p.onDraft({ ...d, suggested: suggested.filter((x) => x !== f) });
  // An edit is a confirmation of that field.
  const set = (f: PrefillField, patch: Partial<LessonDraft>) => p.onDraft({ ...d, ...patch, suggested: suggested.filter((x) => x !== f), notStated: notStated.filter((x) => x !== f) });
  const causes = p.step.possible_open;
  const ok = (f: "cause" | "action") => !!d[f].trim() || notStated.includes(f);
  const status = voiceStatus(p.voice);
  const uid = useId();
  return (
    <form
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
      onSubmit={(e) => {
        e.preventDefault();
        if (suggested.length > 0) p.onConfirming(true);
        else p.onSave();
      }}
    >
      <div className="flex min-w-0 flex-col gap-4 rounded-panel border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-h3">{p.resolution === "escalated" ? "What you found" : "What fixed it"}</h2>
        <div>
          <span className="mb-1.5 block text-meta font-semibold text-ink-2">Your note</span>
          <div className="flex gap-2">
            <textarea rows={3} aria-label="Your note" className={cx(inputClass, "min-w-0 flex-1 py-3")} value={d.note} onChange={(e) => p.onDraft({ ...d, note: e.target.value })} />
            <VoiceControl phase={p.voice} onPress={p.onVoice} />
          </div>
          <p aria-live="polite" className="min-h-[1.45em] text-meta text-ink-2">
            {status}
          </p>
          {p.onPrefill && (
            <Button onClick={p.onPrefill} disabled={p.prefilling || !d.note.trim()} className="mt-1">
              Fill the form from my note
            </Button>
          )}
        </div>
        <div>
          <Label id={`${uid}-cause`} field="cause" text="Verified cause" d={d} onConfirm={confirm} />
          <input aria-labelledby={`${uid}-cause`} className={inputClass} value={d.cause} placeholder={notStated.includes("cause") ? NOT_STATED : undefined} onClick={() => confirm("cause")} onChange={(e) => set("cause", { cause: e.target.value })} />
        </div>
        {causes.length > 0 && (
          <div className="-mt-2 flex flex-wrap gap-2" role="group" aria-label="Possible problems from the manual">
            {causes.map((c) => (
              <button key={c} type="button" aria-pressed={d.cause === c} onClick={() => set("cause", { cause: c })} className={cx("manual-text inline-flex min-h-11 items-center rounded-full border-2 px-3 text-small", d.cause === c ? "border-ink bg-ink text-surface" : "border-line-strong bg-sheet")}>
                {c}
              </button>
            ))}
          </div>
        )}
        <div>
          <Label id={`${uid}-action`} field="action" text="Action taken" d={d} onConfirm={confirm} />
          <input aria-labelledby={`${uid}-action`} className={inputClass} value={d.action} placeholder={notStated.includes("action") ? NOT_STATED : undefined} onClick={() => confirm("action")} onChange={(e) => set("action", { action: e.target.value })} />
        </div>
        <div>
          <Label id={`${uid}-parts`} field="parts" text="Parts used" d={d} onConfirm={confirm} />
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {d.parts.map((part, i) => (
              <li key={i} className="flex min-h-tap items-center gap-3 rounded-control border-2 border-line bg-surface-2 pl-4">
                {part.ident && <span className="code shrink-0 text-small">{part.ident}</span>}
                <span className="min-w-0 flex-1 truncate text-small">{part.text}</span>
                {part.qty && <span className="shrink-0 text-small font-semibold tabular">x{part.qty}</span>}
                <button type="button" aria-label={`Remove ${part.text}`} onClick={() => set("parts", { parts: d.parts.filter((_, j) => j !== i) })} className="inline-flex size-12 shrink-0 items-center justify-center">
                  <X aria-hidden size={20} />
                </button>
              </li>
            ))}
            {d.parts.length === 0 && <li className="text-small text-ink-3">{notStated.includes("parts") ? NOT_STATED : "None"}</li>}
          </ul>
        </div>
        <div>
          <Label id={`${uid}-minutes`} field="minutes" text="Time on the job" d={d} onConfirm={confirm} />
          <div className="inline-flex items-stretch overflow-hidden rounded-control border-2 border-line-strong bg-surface">
            <button type="button" aria-label="Five minutes less" onClick={() => set("minutes", { minutes: Math.max(0, d.minutes - 5) })} className="flex min-h-tap w-14 items-center justify-center">
              <Minus aria-hidden size={22} />
            </button>
            <output className="flex min-w-[8.5rem] items-center justify-center border-x-2 border-line-strong text-lead font-bold tabular">{formatMinutes(d.minutes)}</output>
            <button type="button" aria-label="Five minutes more" onClick={() => set("minutes", { minutes: d.minutes + 5 })} className="flex min-h-tap w-14 items-center justify-center">
              <Plus aria-hidden size={22} />
            </button>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {p.confirming && suggested.length > 0 ? (
          <section role="group" aria-label="Confirm the suggested fields" className="flex flex-col gap-3 rounded-panel border-2 border-dashed border-ink-2 bg-surface p-4">
            <p className="text-body">
              Suggested, not yet confirmed: <span className="font-semibold">{suggested.map((f) => FIELD_LABEL[f]).join(", ")}</span>. Are they right?
            </p>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={p.busy}
              onClick={() => {
                p.onDraft({ ...d, suggested: [] });
                p.onConfirming(false);
                p.onSave();
              }}
            >
              Confirm and save
            </Button>
            <Button className="w-full" onClick={() => p.onConfirming(false)}>
              Check them first
            </Button>
          </section>
        ) : (
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={p.busy || !ok("cause") || !ok("action")}>
            {p.resolution === "escalated" ? "Save and close as referred" : "Save lesson and close"}
          </Button>
        )}
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
