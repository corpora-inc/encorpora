import { useQuery } from "@tanstack/react-query";
import { Suspense, use, useState } from "react";
import type { LiveSnapshot } from "../../../schools/live/contracts";
import { reportError } from "../../lib/report-error";
import { useSession } from "../../lib/session";
import { Toast } from "../../ui/Toast";
import { liveEndedKey, useStartSession } from "../live/api";
import { SessionControl } from "../live/SessionControl";
import { useLiveClass } from "../live/useLiveClass";
import { useLiveLength } from "../school/classes/today/live-sort";
import {
  familyCockpit,
  loadFamilyCockpit,
  warmFamilyCockpit,
} from "./cockpit-chunk";
import type { FamilyCockpitProps } from "./FamilyCockpit";
import styles from "./FamilyLive.module.css";

/**
 * A family's live session on its Today, above the children. At rest: one
 * quiet bar, Start practice with its optional length. Running (started
 * here, by the other parent or on another device), or just ended, or a
 * child asking for something: the cockpit (FamilyCockpit), its bar in the
 * bar's own place, so starting moves nothing above or in it. The roster's
 * code is its own chunk, loaded when a session runs or a parent first
 * touches Start; a family that never starts one never downloads it.
 */
export function FamilyLive(props: FamilyCockpitProps) {
  const { place } = props;
  const session = useSession();
  const live = useLiveClass(place);
  const ended = useQuery({
    queryKey: liveEndedKey(session, place),
    queryFn: () => null,
    enabled: false,
    staleTime: Infinity,
  }).data;
  const snapshot = live.data;
  const wanted =
    !!snapshot?.session || !!ended || (snapshot?.signals.length ?? 0) > 0;
  // Once the cockpit has been needed, it stays for the visit: it shows the
  // resting bar itself, the ended session and the way to its report.
  const [engaged, setEngaged] = useState(false);
  if (wanted && !engaged) setEngaged(true);
  if (!snapshot) return null;
  if (!engaged && !snapshot.can.manage) return null;
  return (
    <div
      className={styles.slot}
      data-family-live={engaged ? "cockpit" : "rest"}
    >
      {engaged ? (
        <Suspense fallback={<div className={styles.held} aria-hidden="true" />}>
          <Cockpit {...props} />
        </Suspense>
      ) : (
        <Rest place={place} snapshot={snapshot} />
      )}
    </div>
  );
}

/** The cockpit, once its chunk is in (the route's loader asks for it when a
 * session runs, so this is usually immediate). */
function Cockpit(props: FamilyCockpitProps) {
  const Loaded = familyCockpit();
  if (!Loaded) {
    use(loadFamilyCockpit());
    return null;
  }
  return <Loaded {...props} />;
}

/** Start practice, quiet, with the length a parent may set. Touching it
 * asks for the cockpit's code, so it is there when the session is. */
function Rest({
  place,
  snapshot,
}: {
  place: FamilyCockpitProps["place"];
  snapshot: LiveSnapshot;
}) {
  const [length, setLength] = useLiveLength(place);
  const start = useStartSession(place);
  const [error, setError] = useState("");
  const ask = warmFamilyCockpit;
  return (
    <div onPointerDown={ask} onFocus={ask} data-family-start="">
      <SessionControl
        live={null}
        now={0}
        length={length}
        onLengthChange={setLength}
        onStart={(minutes) => {
          ask();
          start.mutate(minutes === null ? {} : { minutes }, {
            onError: (failure) =>
              setError(
                reportError(failure, {
                  doing: "start the session",
                  fallback: "The session didn’t start. Try again.",
                }),
              ),
          });
        }}
        onStop={() => undefined}
        starting={start.isPending}
        canManage={snapshot.can.manage}
        startLabel="Start practice"
      />
      <Toast message={error} onDismiss={() => setError("")} />
    </div>
  );
}
