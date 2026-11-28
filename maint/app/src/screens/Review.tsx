import { Check, Send, X } from "lucide-react";
import { Link } from "react-router";
import type { HubStatus, Lesson, ReviewItem } from "../engine/types.ts";
import { reviewLessonPath } from "../routes.ts";
import { formatDate, formatTime } from "../ui/format.ts";
import { Button, cx, Field, inputClass, Page, Panel, Skeleton } from "../ui/kit.tsx";

/** The note the hub writes from a lesson when the reviewer does not edit it (harvest hub `approve`). */
export const suggestedNote = (l: Lesson) => `Verified cause: ${l.cause.replace(/\.+$/, "")}. Corrective action: ${l.action.replace(/\.+$/, "")}.`;

export interface ReviewDraft {
  /** The field note other technicians will see. */
  text: string;
  /** To the technician: why it was edited or sent back. Needed to send back. */
  note: string;
}

export interface ReviewProps {
  status: HubStatus | null;
  /** Null while the hub answers; empty when nothing waits. */
  queue: ReviewItem[] | null;
  approved: ReviewItem[];
  selected: ReviewItem | null;
  /** Tree titles and variant names, for display. */
  titles: Record<string, string>;
  variants: Record<string, string>;
  draft: ReviewDraft | null;
  /** The text the hub writes when the reviewer does not edit it. */
  suggested: string;
  reviewer: string;
  busy: boolean;
  onReviewer(name: string): void;
  onDraft(d: ReviewDraft): void;
  onApprove(): void;
  onReject(): void;
  onPublish(): void;
}

/**
 * The hub's review queue: lessons from the fleet, read against what the
 * technician recorded, approved (as written or edited) or sent back. Approved
 * notes go out to the fleet when published.
 */
export function Review(p: ReviewProps) {
  const item = p.selected;
  const l = item?.current ?? null;
  const d = p.draft;
  const edited = !!(d && d.text.trim() !== p.suggested.trim());
  return (
    <Page
      title="Review"
      kicker={p.status ? `${p.status.lessons_pending} waiting, ${p.status.lessons_approved} approved, ${p.status.devices} ${p.status.devices === 1 ? "device" : "devices"}` : "Hub"}
      wide
      actions={
        <Button variant="primary" onClick={p.onPublish} disabled={p.busy || !p.reviewer.trim() || !p.status || p.status.lessons_approved === 0}>
          <Send aria-hidden size={20} />
          Send approved notes to the fleet
        </Button>
      }
    >
      <Panel>
        <Field label="Reviewer">
          <input className={inputClass} value={p.reviewer} onChange={(e) => p.onReviewer(e.target.value)} autoComplete="name" />
        </Field>
      </Panel>
      <div className="grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <nav aria-label="Waiting for review" className="overflow-hidden rounded-panel border border-line bg-surface">
          {p.queue === null ? (
            <Skeleton className="m-3 h-[120px]" />
          ) : p.queue.length === 0 ? (
            <p className="p-4 text-body text-ink-3">Nothing waiting.</p>
          ) : (
            p.queue.map((q) => (
              <Link
                key={q.lesson_id}
                to={reviewLessonPath(q.lesson_id)}
                aria-current={q.lesson_id === item?.lesson_id ? "page" : undefined}
                className={cx("block border-b border-line px-4 py-3 text-ink no-underline last:border-b-0", q.lesson_id === item?.lesson_id ? "bg-surface-3" : "active:bg-surface-2")}
              >
                <span className="block text-meta font-semibold text-ink-3">
                  {formatDate(q.first_received_at)}
                  {q.reopened && ", changed since review"}
                </span>
                <span className="block font-semibold">{(q.current.tree_id && p.titles[q.current.tree_id]) || "Job"}</span>
                <span className="block truncate text-small text-ink-2">{q.current.cause}</span>
              </Link>
            ))
          )}
        </nav>

        {item && l && d ? (
          <section className="flex min-w-0 flex-col gap-4" aria-label="Lesson">
            <Panel label="From the technician">
              <dl className="m-0 grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-body">
                <dt className="text-small text-ink-3">Table</dt>
                <dd className="m-0">{(l.tree_id && p.titles[l.tree_id]) || l.tree_id}</dd>
                <dt className="text-small text-ink-3">Variant</dt>
                <dd className="m-0">{(l.equip_id && p.variants[l.equip_id]) || l.equip_id}</dd>
                <dt className="text-small text-ink-3">Cause</dt>
                <dd className="m-0">{l.cause}</dd>
                <dt className="text-small text-ink-3">Action</dt>
                <dd className="m-0">{l.action}</dd>
                {l.parts.length > 0 && (
                  <>
                    <dt className="text-small text-ink-3">Parts</dt>
                    <dd className="m-0">{l.parts.map((x) => [x.ident, x.text, x.qty && `x${x.qty}`].filter(Boolean).join(" ")).join("; ")}</dd>
                  </>
                )}
                {l.minutes != null && (
                  <>
                    <dt className="text-small text-ink-3">Time</dt>
                    <dd className="m-0">{l.minutes} min</dd>
                  </>
                )}
                {l.note && (
                  <>
                    <dt className="text-small text-ink-3">Note</dt>
                    <dd className="m-0">{l.note}</dd>
                  </>
                )}
                <dt className="text-small text-ink-3">Saved</dt>
                <dd className="m-0 text-small">
                  {formatTime(l.created_at)}, level {l.level}, pack <span className="code">{l.pack_version}</span>
                </dd>
              </dl>
              {item.versions.length > 1 && <p className="mt-3 text-meta text-ink-3">{item.versions.length} versions received; showing the current one.</p>}
            </Panel>
            <section className="field p-4">
              <h2 id="note-out" className="mb-2 text-small font-bold">
                Field note for the fleet
              </h2>
              <textarea aria-labelledby="note-out" rows={3} className={cx(inputClass, "bg-surface py-3")} value={d.text} onChange={(e) => p.onDraft({ ...d, text: e.target.value })} />
              <p className="mt-1 text-meta">Shown to technicians beside the manual, marked as field knowledge.</p>
            </section>
            <Field label="Note back to the technician">
              <textarea rows={2} className={cx(inputClass, "py-3")} value={d.note} onChange={(e) => p.onDraft({ ...d, note: e.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button variant="primary" size="lg" onClick={p.onApprove} disabled={p.busy || !p.reviewer.trim() || !d.text.trim()}>
                <Check aria-hidden size={22} />
                {edited ? "Approve with edits" : "Approve"}
              </Button>
              <Button size="lg" onClick={p.onReject} disabled={p.busy || !p.reviewer.trim() || !d.note.trim()}>
                <X aria-hidden size={22} />
                Send back
              </Button>
            </div>
          </section>
        ) : (
          <p className="text-body text-ink-3">{p.queue && p.queue.length > 0 ? "Pick a lesson to review." : ""}</p>
        )}
      </div>
      {p.approved.length > 0 && (
        <section aria-labelledby="approved">
          <h2 id="approved" className="mb-2 text-h3">
            Approved
          </h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {p.approved.map((a) => {
              const last = a.reviews[a.reviews.length - 1];
              return (
                <li key={a.lesson_id} className="rounded-panel border border-line bg-surface p-4 text-small">
                  <span className="font-semibold">{(a.current.tree_id && p.titles[a.current.tree_id]) || "Job"}:</span> {a.current.cause}
                  {last && (
                    <span className="block text-meta text-ink-3">
                      {last.action} by {last.reviewer}, {formatTime(last.at)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </Page>
  );
}
