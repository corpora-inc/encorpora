import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { reportError, useToast } from "@appkit/toast.ts";
import { EngineError, hubCall, setHubToken } from "../engine/client.ts";
import type { EnrolledDevice, HubStatus, Principal, ReviewItem } from "../engine/types.ts";
import { reviewPath } from "../routes.ts";
import { HubSignIn, Review, type ReviewDraft } from "../screens/Review.tsx";
import { allEquipment, treeTitles, usePack } from "../store/pack.ts";
import { useSettings } from "../store/settings.ts";

const say = (e: unknown, fallback: string) => (e instanceof EngineError ? e.message : fallback);

export function ReviewPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const packs = usePack((s) => s.packs);
  const { hubToken, setHubToken: keepToken } = useSettings();
  const [me, setMe] = useState<Principal | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [checking, setChecking] = useState(!!hubToken);
  const [status, setStatus] = useState<HubStatus | null>(null);
  const [queue, setQueue] = useState<ReviewItem[] | null>(null);
  const [approved, setApproved] = useState<ReviewItem[]>([]);
  const [devices, setDevices] = useState<EnrolledDevice[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [busy, setBusy] = useState(false);

  const load = async (who: Principal) => {
    try {
      const [s, pending, done] = await Promise.all([hubCall("hub.status", {}), hubCall("hub.queue", { status: "pending" }), hubCall("hub.queue", { status: "approved" })]);
      setStatus(s);
      setQueue(pending);
      setApproved(done);
      if (who.roles.includes("admin")) setDevices(await hubCall("hub.devices", {}));
    } catch (e) {
      setQueue([]);
      reportError("review.load", e, say(e, "The hub did not answer. Check the link to the hub."));
    }
  };
  const signIn = async (token: string | null) => {
    setHubToken(token);
    if (!token) return;
    setChecking(true);
    try {
      const who = await hubCall("hub.whoami", {});
      keepToken(token);
      setMe(who);
      setSignInError(null);
      await load(who);
    } catch (e) {
      setHubToken(null);
      keepToken(null);
      setSignInError(e instanceof EngineError && e.code === "unauthenticated" ? "That token is not known at this hub." : say(e, "The hub did not answer."));
    } finally {
      setChecking(false);
    }
  };
  useEffect(() => {
    void signIn(hubToken);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!me) return checking ? null : <HubSignIn error={signInError} busy={checking} onSignIn={(t) => void signIn(t)} />;

  const selected = queue?.find((q) => q.lesson_id === lessonId) ?? null;
  // The hub's own note for this lesson: the prefill, and what an edit is measured against.
  const suggested = selected?.suggested_note ?? "";
  const draft = selected ? (drafts[selected.lesson_id] ?? { text: suggested, note: "", version: null }) : null;
  const act = async (fn: () => Promise<unknown>, done: string, leave = true) => {
    setBusy(true);
    try {
      await fn();
      useToast.getState().show("info", done);
      await load(me);
      if (leave) navigate(reviewPath(), { replace: true });
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
      titles={treeTitles(packs)}
      variants={Object.fromEntries(allEquipment(packs).map((e) => [e.equip_id, e.name]))}
      draft={draft}
      suggested={suggested}
      me={me}
      devices={me.roles.includes("admin") ? devices : null}
      busy={busy}
      onSignOut={() => {
        setHubToken(null);
        keepToken(null);
        setMe(null);
      }}
      onEnroll={(name, key) => void act(() => hubCall("hub.enroll", { name: name || null, public_key: key }), "Device enrolled.", false)}
      onRevoke={(id, reason) => void act(() => hubCall("hub.revoke", { device_id: id, reason }), "Device revoked. Its uploads are refused from now on.", false)}
      onDraft={(d) => selected && setDrafts({ ...drafts, [selected.lesson_id]: d })}
      onApprove={() =>
        selected &&
        draft &&
        void act(
          () =>
            hubCall("hub.approve", {
              lesson_id: selected.lesson_id,
              note: draft.note.trim() || null,
              version: selected.needs_reviewer ? draft.version : null,
              // Only an edited text is sent; otherwise the hub writes the note from the lesson.
              edit: draft.text.trim() !== suggested.trim() ? { text: draft.text.trim() } : null,
            }),
          "Approved.",
        )
      }
      onReject={() => selected && draft && void act(() => hubCall("hub.reject", { lesson_id: selected.lesson_id, reason: draft.note.trim() }), "Sent back.")}
      onPublish={() => void act(() => hubCall("hub.publish", {}), "Sent to the fleet. Devices receive it at their next sync.", false)}
    />
  );
}
