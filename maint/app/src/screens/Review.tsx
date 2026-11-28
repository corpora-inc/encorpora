import { Check, X } from "lucide-react";
import { Link } from "react-router";
import type { FieldNote, Lesson } from "../engine/types.ts";
import { reviewLessonPath } from "../routes.ts";
import { formatDate, formatTime } from "../ui/format.ts";
import { Button, cx, Field, inputClass, Page, Panel } from "../ui/kit.tsx";
import { FieldNotes } from "../ui/manual.tsx";

export interface ReviewDraft {
  cause: string;
  action: string;
  note: string;
  /** Why it is sent back; needed to reject. */
  reviewNote: string;
}

export interface ReviewProps {
  queue: Lesson[];
  selected: Lesson | null;
  /** Tree titles and unit names, for display. */
  titles: Record<string, string>;
  units: Record<string, string>;
  /** The manual's words at the step the lesson is about, when known. */
  context: string | null;
  draft: ReviewDraft | null;
  sent: FieldNote[];
  busy: boolean;
  onDraft(d: ReviewDraft): void;
  onApprove(edited: boolean): void;
  onReject(): void;
}

/**
 * The hub's review queue: lessons from the fleet, read against the manual,
 * approved (as written or edited) or sent back. What is approved goes out to
 * the fleet as field notes, shown below as sent.
 */
export function Review(p: ReviewProps) {
  const l = p.selected;
  const d = p.draft;
  const edited = !!(l && d && (d.cause !== l.cause || d.action !== l.action || d.note !== (l.note ?? "")));
  return (
    <Page title="Review" kicker={`${p.queue.length} waiting`} wide>
      <div className="grid items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <nav aria-label="Waiting for review" className="overflow-hidden rounded-panel border border-line bg-surface">
          {p.queue.length === 0 && <p className="p-4 text-body text-ink-3">Nothing waiting.</p>}
          {p.queue.map((q) => (
            <Link
              key={q.lesson_id}
              to={reviewLessonPath(q.lesson_id)}
              aria-current={q.lesson_id === l?.lesson_id ? "page" : undefined}
              className={cx("block border-b border-line px-4 py-3 text-ink no-underline last:border-b-0", q.lesson_id === l?.lesson_id ? "bg-surface-3" : "active:bg-surface-2")}
            >
              <span className="block text-meta font-semibold text-ink-3">
                {(q.asset_id && p.units[q.asset_id]) || q.asset_id}, {formatDate(q.created_at)}
              </span>
              <span className="block font-semibold">{(q.tree_id && p.titles[q.tree_id]) || "Job"}</span>
              <span className="block truncate text-small text-ink-2">{q.cause}</span>
            </Link>
          ))}
        </nav>

        {l && d ? (
          <section className="flex min-w-0 flex-col gap-4" aria-label="Lesson">
            <Panel>
              <dl className="m-0 grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-1 text-small">
                <dt className="text-ink-3">Unit</dt>
                <dd className="m-0">{(l.asset_id && p.units[l.asset_id]) || l.asset_id}</dd>
                <dt className="text-ink-3">Variant</dt>
                <dd className="m-0">{l.equip_id}</dd>
                <dt className="text-ink-3">Table</dt>
                <dd className="m-0">{(l.tree_id && p.titles[l.tree_id]) || l.tree_id}</dd>
                <dt className="text-ink-3">Level</dt>
                <dd className="m-0">{l.level}</dd>
                <dt className="text-ink-3">Saved</dt>
                <dd className="m-0">{formatTime(l.created_at)}</dd>
                <dt className="text-ink-3">Pack</dt>
                <dd className="m-0">
                  <span className="code">{l.pack_version}</span>
                </dd>
              </dl>
            </Panel>
            {p.context && (
              <figure className="sheet m-0 p-4">
                <figcaption className="mb-1 font-sans text-meta font-bold text-ink-2">The manual, where it ended</figcaption>
                <blockquote className="m-0 text-body">{p.context}</blockquote>
              </figure>
            )}
            <Panel label="From the technician">
              <div className="flex flex-col gap-4">
                <Field label="Verified cause">
                  <input className={inputClass} value={d.cause} onChange={(e) => p.onDraft({ ...d, cause: e.target.value })} />
                </Field>
                <Field label="Action taken">
                  <input className={inputClass} value={d.action} onChange={(e) => p.onDraft({ ...d, action: e.target.value })} />
                </Field>
                {l.parts.length > 0 && (
                  <div>
                    <span className="mb-1 block text-meta font-semibold text-ink-2">Parts used</span>
                    <p className="text-small">{l.parts.map((x) => [x.ident, x.text, x.qty && `x${x.qty}`].filter(Boolean).join(" ")).join("; ")}</p>
                  </div>
                )}
                <Field label="Note for other technicians">
                  <textarea rows={3} className={cx(inputClass, "py-3")} value={d.note} onChange={(e) => p.onDraft({ ...d, note: e.target.value })} />
                </Field>
                <Field label="Note back to the technician">
                  <textarea rows={2} className={cx(inputClass, "py-3")} value={d.reviewNote} onChange={(e) => p.onDraft({ ...d, reviewNote: e.target.value })} />
                </Field>
              </div>
            </Panel>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button variant="primary" size="lg" onClick={() => p.onApprove(edited)} disabled={p.busy}>
                <Check aria-hidden size={22} />
                {edited ? "Approve with edits" : "Approve"}
              </Button>
              <Button size="lg" onClick={p.onReject} disabled={p.busy || !d.reviewNote.trim()}>
                <X aria-hidden size={22} />
                Send back
              </Button>
            </div>
          </section>
        ) : (
          <p className="text-body text-ink-3">Pick a lesson to review.</p>
        )}
      </div>
      {p.sent.length > 0 && (
        <section aria-labelledby="sent">
          <h2 id="sent" className="mb-2 text-h3">
            Sent to the fleet
          </h2>
          <FieldNotes notes={p.sent} />
        </section>
      )}
    </Page>
  );
}
