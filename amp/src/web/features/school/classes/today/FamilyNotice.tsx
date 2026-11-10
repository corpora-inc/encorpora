import { z } from "zod";
import type { SignedInMe } from "../../../../../account/contracts";
import type { AuthSession } from "../../../../auth";
import { request } from "../../../../lib/api";
import { meKey, queryClient } from "../../../../lib/query";
import styles from "./Today.module.css";

/** For a family from before families had classes: one line on how the
 * children sign in now, gone on every device once dismissed. */
export function FamilyNotice({
  session,
  me,
}: {
  session: AuthSession;
  me: SignedInMe;
}) {
  const held = me.familyClass;
  if (!held?.notice) return null;
  const dismiss = () => {
    // Gone at once; the server keeps it gone on every device.
    queryClient.setQueryData(meKey(session.accountId), {
      ...me,
      familyClass: { ...held, notice: false },
    });
    void request("/family/class-notice/dismiss", z.unknown(), {
      token: session.token,
      body: {},
    }).catch((failure) =>
      console.error("The sign-in note wasn’t dismissed", failure),
    );
  };
  return (
    <p className={styles.hint}>
      <span>
        Your children now sign in on their own devices with this class’s code
        and three pictures. On this device, choose who’s practicing.
      </span>
      <button
        type="button"
        className={styles.dismiss}
        aria-label="Dismiss"
        onClick={dismiss}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 4 8 8m0-8-8 8" />
        </svg>
      </button>
    </p>
  );
}
