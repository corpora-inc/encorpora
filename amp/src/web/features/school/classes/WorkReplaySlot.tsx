import { lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { Loading } from "../../../ui/Loading";
import styles from "./WorkReplay.module.css";

/* The replay and the practice screen it draws with load on the way in, so a
   record never carries them. Until they arrive, the replay's own layer holds
   the wait: the record below never shows through and nothing moves. */
const Replay = lazy(() =>
  import("./WorkReplay").then((module) => ({ default: module.WorkReplay })),
);

/** A `?skill=` from the address bar, or nothing. */
export const workSkill = (raw: unknown) =>
  typeof raw === "string" && /^[\w.:-]{1,100}$/.test(raw) ? raw : undefined;

export function WorkReplaySlot(props: Parameters<typeof Replay>[0]) {
  return (
    <Suspense
      fallback={createPortal(
        <div className={styles.layer} aria-busy="true">
          <div className={styles.wait}>
            <Loading />
          </div>
        </div>,
        document.body,
      )}
    >
      <Replay {...props} />
    </Suspense>
  );
}
