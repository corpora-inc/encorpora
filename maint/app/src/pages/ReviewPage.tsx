import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { reportError, useToast } from "@appkit/toast.ts";
import { EngineError, hubCall } from "../engine/client.ts";
import type { HubStatus, ReviewItem } from "../engine/types.ts";
import { reviewPath } from "../routes.ts";
import { Review, suggestedNote, type ReviewDraft } from "../screens/Review.tsx";
import { usePack } from "../store/pack.ts";
import { useSettings } from "../store/settings.ts";


const say = (e: unknown, fallback: string) => (e instanceof EngineError ? e.message : fallback);

export function ReviewPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { trees, equipment } = usePack();
  const { reviewer, setReviewer } = useSettings();
  const [status, setStatus] = useState<HubStatus | null>(null);
  const [queue, setQueue] = useState<ReviewItem[] | null>(null);
  const [approved, setApproved] = useState<ReviewItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      const [s, pending, done] = await Promise.all([hubCall("hub.status", {}), hubCall("hub.queue", { status: "pending" }), hubCall("hub.queue", { status: "approved" })]);
      setStatus(s);
      setQueue(pending);
      setApproved(done);
    } catch (e) {
      setQueue([]);
      reportError("review.load", e, say(e, "The hub did not answer. Check the link to the hub."));
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const selected = queue?.find((q) => q.lesson_id === lessonId) ?? null;
  const suggested = selected ? suggestedNote(selected.current) : "";
  const draft = selected ? (drafts[selected.lesson_id] ?? { text: suggested, note: "" }) : null;
  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      useToast.getState().show("info", done);
      await load();
      navigate(reviewPath(), { replace: true });
    } catch (e) {
      reportError("review.act", e, say(e, "The hub did not record that. Try again."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Review
      status={status}
      queue={queue}
      approved={approved}
      selected={selected}
      titles={Object.fromEntries(trees.map((t) => [t.tree_id, t.title]))}
      variants={Object.fromEntries(equipment.map((e) => [e.equip_id, e.name]))}
      draft={draft}
      suggested={suggested}
      reviewer={reviewer}
      busy={busy}
      onReviewer={setReviewer}
      onDraft={(d) => selected && setDrafts({ ...drafts, [selected.lesson_id]: d })}
      onApprove={() =>
        selected &&
        draft &&
        void act(
          () =>
            hubCall("hub.approve", {
              lesson_id: selected.lesson_id,
              reviewer: reviewer.trim(),
              note: draft.note.trim() || null,
              // Only an edited text is sent; otherwise the hub writes the note from the lesson.
              edit: draft.text.trim() !== suggested.trim() ? { text: draft.text.trim() } : null,
            }),
          "Approved.",
        )
      }
      onReject={() => selected && draft && void act(() => hubCall("hub.reject", { lesson_id: selected.lesson_id, reviewer: reviewer.trim(), reason: draft.note.trim() }), "Sent back.")}
      onPublish={() => void act(() => hubCall("hub.publish", {}), "Sent to the fleet. Devices receive it at their next sync.")}
    />
  );
}

