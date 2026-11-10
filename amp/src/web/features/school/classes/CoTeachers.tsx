import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { AuthSession } from "../../../auth";
import { useLoggedError } from "../../../feedback";
import { AppError } from "../../../lib/AppError";
import { Badge } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import { Sheet } from "../../../ui/Sheet";
import { TextField } from "../../../ui/TextField";
import { refreshSchool, school as schoolApi, staffOptions } from "../api";
import { CopyButton, FormNote } from "../parts";
import school from "../School.module.css";
import styles from "./Family.module.css";

/** The other adults who teach this family's class, for example the other
 * parent. The invitation is the school's staff invitation with the teacher
 * role, limited to this class. The server decides what a co-teacher may do.
 * Rows only, for the people on Today; nothing while there's no one. */
export function CoTeacherRows({
  session,
  orgId,
  onError,
}: {
  session: AuthSession;
  orgId: string;
  onError: (message: string) => void;
}) {
  const staff = useQuery(staffOptions(session, orgId));
  // The family's second parent has her own row (`SecondParent`).
  const others = (staff.data ?? []).filter(
    (person) => !person.self && !person.secondParent,
  );
  const resend = async (personId: string) => {
    try {
      const sent = await schoolApi.resendInvite(session, orgId, personId);
      await refreshSchool(session);
      if (!sent.mailed)
        onError("The email didn’t send. Copy the link and send it yourself.");
    } catch (failure) {
      console.error("The invitation didn’t send again", failure);
      onError("That didn’t send. Try again in a moment.");
    }
  };
  return (
    <>
      {others.map((person) => (
        <li
          key={person.id}
          className={styles.child}
          data-co-teacher={person.status}
        >
          <span className={styles.who}>
            <span className={styles.name}>{person.email ?? person.name}</span>
            <span className={styles.access}>
              {person.status === "invited" ? (
                <Badge tone="warning">Invited</Badge>
              ) : (
                "Co-teacher"
              )}
            </span>
          </span>
          {person.status === "invited" &&
            (person.inviteUrl ? (
              <span className={styles.rowActions}>
                <CopyButton
                  text={person.inviteUrl}
                  label="Copy link"
                  copied="Link copied"
                />
              </span>
            ) : (
              <span className={styles.rowActions}>
                <Button
                  variant="secondary"
                  onClick={() => void resend(person.id)}
                >
                  Send again
                </Button>
              </span>
            ))}
        </li>
      ))}
    </>
  );
}

/** "Invite a co-teacher": an email, then the invitation. */
export function CoTeacherInviteSheet({
  session,
  orgId,
  classId,
  onClose,
}: {
  session: AuthSession;
  orgId: string;
  classId: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useLoggedError(error);
  const submit = async () => {
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setEmailError("Enter their full email address.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await schoolApi.invite(session, orgId, {
        email: address,
        role: "teacher",
        classIds: [classId],
      });
      await refreshSchool(session);
      onClose();
    } catch (failure) {
      setError(
        failure instanceof AppError
          ? failure.message
          : "That invitation didn’t save. Try again.",
      );
      setBusy(false);
    }
  };
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Invite a co-teacher"
    >
      <form
        className={school.sheetForm}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <p className={styles.sheetText}>
          They see this class and can hand a device to a child. They can’t add
          children from other families or buy access.
        </p>
        <TextField
          label="Email"
          type="email"
          autoComplete="off"
          inputMode="email"
          value={email}
          error={emailError}
          onChange={(event) => {
            setEmail(event.target.value);
            setEmailError("");
          }}
        />
        <FormNote error={error} />
        <Button
          variant="primary"
          type="submit"
          className={school.sheetAction}
          aria-busy={busy}
          disabled={busy}
        >
          Send invitation
        </Button>
      </form>
    </Sheet>
  );
}
