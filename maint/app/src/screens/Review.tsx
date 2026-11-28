import { useState } from "react";
import { Check, LogOut, Send, X } from "lucide-react";
import { Link } from "react-router";
import type { EnrolledDevice, HubStatus, Principal, ReviewItem } from "../engine/types.ts";
import { reviewLessonPath } from "../routes.ts";
import { formatDate, formatTime } from "../ui/format.ts";
import { Button, cx, Field, inputClass, Page, Panel, Skeleton } from "../ui/kit.tsx";

export interface ReviewDraft {
  /** The field note other technicians will see. */
  text: string;
  /** To the technician: why it was edited or sent back. Needed to send back. */
  note: string;
  /** The version chosen when two units' edits conflict (an item id). */
  version: string | null;
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
  /** Who is signed in at the hub, and what their roles let them do. */
  me: Principal;
  /** Enrolled devices, for an administrator; null for anyone else. */
  devices: EnrolledDevice[] | null;
  busy: boolean;
  onSignOut(): void;
  onEnroll(name: string, publicKey: string): void;
  onRevoke(deviceId: string, reason: string): void;
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
  const mustPick = !!item?.needs_reviewer;
  const can = (r: string) => p.me.roles.includes(r as Principal["roles"][number]);
  return (
    <Page
      title="Review"
      kicker={p.status ? `${p.status.lessons_pending} waiting, ${p.status.lessons_approved} approved, ${p.status.devices} ${p.status.devices === 1 ? "device" : "devices"}` : "Hub"}
      wide
      actions={
        can("publisher") && (
          <Button variant="primary" onClick={p.onPublish} disabled={p.busy || !p.status || p.status.lessons_approved === 0}>
            <Send aria-hidden size={20} />
            Send to the fleet
          </Button>
        )
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line bg-surface px-4 py-2">
        <p className="text-small">
          Signed in as <span className="font-bold">{p.me.name}</span>
          <span className="text-ink-3">, {p.me.roles.join(", ")}</span>
        </p>
        <Button variant="quiet" onClick={p.onSignOut}>
          <LogOut aria-hidden size={20} />
          Sign out
        </Button>
      </div>
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
            {mustPick && d && (
              <section aria-labelledby="versions" className="flex flex-col gap-2">
                <h2 id="versions" className="text-lead font-bold">
                  Two units changed this lesson at nearly the same time
                </h2>
                <p className="text-small text-ink-2">Pick the version to approve.</p>
                <div role="radiogroup" aria-labelledby="versions" className="grid gap-3 sm:grid-cols-2">
                  {item.versions
                    .filter((v) => v.state !== "superseded")
                    .map((v) => {
                      const on = d.version === v.item_id;
                      return (
                        <button
                          key={v.item_id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => p.onDraft({ ...d, version: v.item_id })}
                          className={cx("flex flex-col gap-1 rounded-panel border-2 p-4 text-left", on ? "border-ink bg-surface-3" : "border-line-strong bg-surface")}
                        >
                          <span className="code text-meta text-ink-3">
                            {v.device_id}, {formatTime(v.updated_at)}
                          </span>
                          <span className="text-body">
                            <span className="font-bold">Cause:</span> {v.lesson.cause}
                          </span>
                          <span className="text-body">
                            <span className="font-bold">Action:</span> {v.lesson.action}
                          </span>
                          {v.lesson.note && <span className="text-small text-ink-2">{v.lesson.note}</span>}
                        </button>
                      );
                    })}
                </div>
              </section>
            )}
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
            {can("reviewer") ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Button variant="primary" size="lg" onClick={p.onApprove} disabled={p.busy || !d.text.trim() || (mustPick && !d.version)}>
                  <Check aria-hidden size={22} />
                  {edited ? "Approve with edits" : "Approve"}
                </Button>
                <Button size="lg" onClick={p.onReject} disabled={p.busy || !d.note.trim()}>
                  <X aria-hidden size={22} />
                  Send back
                </Button>
              </div>
            ) : (
              <p className="text-small text-ink-2">Your role does not include review.</p>
            )}
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
      {p.devices && <Devices devices={p.devices} busy={p.busy} onEnroll={p.onEnroll} onRevoke={p.onRevoke} />}
    </Page>
  );
}

/** For an administrator: the devices the hub accepts uploads from; enroll by public key, revoke. */
function Devices({ devices, busy, onEnroll, onRevoke }: { devices: EnrolledDevice[]; busy: boolean; onEnroll(name: string, key: string): void; onRevoke(id: string, reason: string): void }) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [reason, setReason] = useState<Record<string, string>>({});
  return (
    <section aria-labelledby="devices" className="flex flex-col gap-3">
      <h2 id="devices" className="text-h3">
        Devices
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {devices.map((dv) => (
          <li key={dv.device_id} className={cx("rounded-panel border border-line bg-surface p-4", dv.revoked_at && "opacity-70")}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold">{dv.name ?? dv.device_id}</span>
              <span className="code text-meta text-ink-3">{dv.device_id}</span>
            </div>
            <p className="text-meta text-ink-2">
              {dv.revoked_at
                ? `Revoked ${formatTime(dv.revoked_at)} by ${dv.revoked_by ?? "?"}${dv.reason ? `: ${dv.reason}` : ""}.`
                : `Enrolled ${formatTime(dv.enrolled_at)} by ${dv.enrolled_by}. ${dv.items} uploads${dv.last_seen ? `, last ${formatTime(dv.last_seen)}` : ""}.`}
            </p>
            {!dv.revoked_at && (
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  aria-label={`Reason to revoke ${dv.name ?? dv.device_id}`}
                  placeholder="Reason to revoke"
                  value={reason[dv.device_id] ?? ""}
                  onChange={(e) => setReason({ ...reason, [dv.device_id]: e.target.value })}
                  className={cx(inputClass, "min-w-0 flex-1")}
                />
                <Button onClick={() => onRevoke(dv.device_id, reason[dv.device_id] ?? "")} disabled={busy || !(reason[dv.device_id] ?? "").trim()}>
                  Revoke
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <form
        className="flex flex-col gap-3 rounded-panel border border-line bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          onEnroll(name.trim(), key.trim());
          setName("");
          setKey("");
        }}
      >
        <h3 className="text-small font-bold text-ink-2">Enroll a device</h3>
        <Field label="Name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Public key">
          <input className={cx(inputClass, "code")} value={key} onChange={(e) => setKey(e.target.value)} spellCheck={false} autoComplete="off" />
        </Field>
        <Button type="submit" className="self-start" disabled={busy || !key.trim()}>
          Enroll
        </Button>
      </form>
    </section>
  );
}

/** Sign in at the hub (development tokens; a deployment signs in through its gateway). */
export function HubSignIn({ error, busy, onSignIn }: { error: string | null; busy: boolean; onSignIn(token: string): void }) {
  const [token, setToken] = useState("");
  return (
    <Page title="Review">
      <form
        className="flex max-w-[520px] flex-col gap-3 rounded-panel border border-line bg-surface p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSignIn(token.trim());
        }}
      >
        <Field label="Hub sign-in token">
          <input type="password" className={inputClass} value={token} onChange={(e) => setToken(e.target.value)} autoComplete="current-password" />
        </Field>
        <p className="min-h-[1.35em] text-meta text-error" role="alert">
          {error}
        </p>
        <Button type="submit" variant="primary" disabled={busy || !token.trim()}>
          Sign in
        </Button>
      </form>
    </Page>
  );
}
