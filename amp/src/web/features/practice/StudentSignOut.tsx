import { Link, useRouter } from "@tanstack/react-router";
import { signOut } from "../../auth";
import { closesBack, closeTo } from "../../lib/return-to";
import { useAccountOnHand } from "../../lib/session";
import {
  handedHome,
  handedReturnName,
  handedStudentDevice,
} from "../../lib/student-device";
import styles from "./StudentSignOut.module.css";

/** A school device passes to the next student with one tap, from anywhere:
 * in the corner of a page, or `inBar` beside the menu on a problem. A
 * device a parent handed to their child shows the family's way home
 * instead (`HandedHome`). */
export function StudentSignOut({ inBar = false }: { inBar?: boolean }) {
  const account = useAccountOnHand();
  const name =
    account?.account.kind === "student" ? account.learners[0]?.name : null;
  if (handedStudentDevice()) return <HandedHome inBar={inBar} />;
  const label = name ? `Sign out ${name}` : "Sign out";
  return (
    <button
      type="button"
      className={`${styles.signOut} ${inBar ? styles.inBar : ""}`}
      aria-label={label}
      title={label}
      data-student-sign-out
      onClick={() => {
        void signOut().catch((failure) =>
          console.error("Student sign-out failed", failure),
        );
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H10" />
      </svg>
    </button>
  );
}

/**
 * A handed device's way home: the family icon, to the family's Today (or
 * the class it was handed from, by name). A link, never a "Back": the child
 * may have started here without ever seeing the family's screen. Going
 * there hands the device back to the parent on the way
 * (lib/family-practice-history.ts), with no reload, and the icon holds the
 * bar's action slot from the first paint, so nothing moves.
 *
 * Handed over from that very screen a moment ago (the entry before this
 * one), the press goes Back to it, as the browser's Back does: the parent
 * is where they were on it, at the same scroll position, never at its top
 * (QA 2026-11-23). From anywhere else it is the link it says it is.
 */
function HandedHome({ inBar }: { inBar: boolean }) {
  const label = handedReturnName() ?? "Family";
  // The screen itself, by its path: what was open over it (a layer) is
  // the layer store's (nav/layer-store.ts), never carried in an address.
  const home = new URL(handedHome(), "https://amp.invalid").pathname;
  const router = useRouter();
  return (
    <Link
      to="/$"
      params={{ _splat: home.slice(1) }}
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0 ||
          !closesBack(router.history.location, home, home)
        )
          return;
        event.preventDefault();
        closeTo(router, home, home);
      }}
      // Hovering must never load the parent's screen with the child's
      // sign-in; the press itself hands the device back.
      preload={false}
      className={`${styles.signOut} ${inBar ? styles.inBar : ""}`}
      aria-label={label}
      title={label}
      data-student-sign-out
      data-handed-home
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0m1-9a3 3 0 1 0 0-6m2 15a5 5 0 0 0-3.5-4.8" />
      </svg>
    </Link>
  );
}
