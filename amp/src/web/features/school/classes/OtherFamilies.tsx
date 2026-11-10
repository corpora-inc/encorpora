import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ApprovalRowResource } from "../../../../family/approval-contracts";
import { useLoggedError } from "../../../feedback";
import type { AuthSession } from "../../../auth";
import { AppError } from "../../../lib/AppError";
import { Badge } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import { Sheet } from "../../../ui/Sheet";
import { TextField } from "../../../ui/TextField";
import { Toast } from "../../../ui/Toast";
import { approvals, approvalsOptions } from "../../family-approval/api";
import { CopyButton, FormNote } from "../parts";
import { freeProblemsLeft } from "../../../lib/free-allowance";
import { TalkToUsButton } from "../../continue/AllowancePause";
import school from "../School.module.css";
import styles from "./Family.module.css";

const DAY = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});
const failures: Record<string, string> = {
  too_many_approvals:
    "That’s as many links as one day allows. Try again tomorrow.",
  approval_not_found: "That link isn’t here now. Refresh and try again.",
  invalid_family_request: "Check the email address.",
};
const why = (failure: unknown, fallback: string) =>
  (failure instanceof AppError && failure.code && failures[failure.code]) ||
  fallback;
export const statusLine = (row: ApprovalRowResource) =>
  row.status === "unnamed"
    ? row.freeLeft === undefined
      ? "Access active"
      : row.freeLeft > 0
        ? freeProblemsLeft(row.freeLeft)
        : "Used the 100 free problems"
    : row.status === "waiting"
      ? "Waiting for their parent"
      : row.status === "expired"
        ? "The link expired"
        : row.status === "paused"
          ? "Paused by their parent"
          : row.status === "needs-access"
            ? row.freeLeft === undefined
              ? "Approved by their parent"
              : row.freeLeft > 0
                ? freeProblemsLeft(row.freeLeft)
                : "Used the 100 free problems"
            : `Access through ${DAY.format(new Date(row.accessEndsAt!))}`;

/** Children from other families in this family's class (docs/families.md,
 * step 5). Each one's own parent approves by a link, so the teacher sends the
 * link and sees where it stands; they never see the other family's account. */
export function OtherFamilies({ session }: { session: AuthSession }) {
  const list = useQuery(approvalsOptions(session));
  const [adding, setAdding] = useState<
    false | { personId?: string; name?: string }
  >(false);
  const [access, setAccess] = useState<ApprovalRowResource | null>(null);
  const [error, setError] = useState("");
  useLoggedError(error);
  const rows = list.data ?? [];
  return (
    <section className={styles.family} aria-labelledby="other-families">
      <h2 id="other-families" className={styles.heading}>
        From other families
      </h2>
      {rows.length > 0 && (
        <ul className={styles.children}>
          {rows.map((row) => (
            <Row
              key={row.id}
              row={row}
              session={session}
              onAccess={() => setAccess(row)}
              onSend={() =>
                setAdding({ personId: row.personId, name: row.name })
              }
              onError={setError}
            />
          ))}
        </ul>
      )}
      <Button
        variant="secondary"
        className={styles.add}
        onClick={() => setAdding({})}
      >
        Add a child from another family
      </Button>
      {adding && (
        <AddSheet
          session={session}
          rows={rows}
          student={adding.personId ? adding : undefined}
          onClose={() => setAdding(false)}
        />
      )}
      {access && (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open) setAccess(null);
          }}
          title={`Add access for ${access.name}`}
        >
          <div className={school.sheetForm}>
            <p className={styles.sheetText}>
              {access.name}’s parent adds access on their page for {access.name}
              , where they approved. Send them the link to it.
            </p>
            {access.parentPageUrl && (
              <CopyButton
                text={access.parentPageUrl}
                label="Copy the link to their page"
                copied="Link copied"
              />
            )}
          </div>
        </Sheet>
      )}
      <Toast message={error} onDismiss={() => setError("")} />
    </section>
  );
}

function Row({
  row,
  session,
  onAccess,
  onSend,
  onError,
}: {
  row: ApprovalRowResource;
  session: AuthSession;
  onAccess: () => void;
  /** An unnamed student: send their parent the link that names them. */
  onSend: () => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState<"resend" | "remove" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sent, setSent] = useState(false);
  const run = async (kind: "resend" | "remove") => {
    setBusy(kind);
    try {
      if (kind === "resend") {
        const result = await approvals.resend(session, row.id);
        setSent(result.mailed);
        if (!result.mailed)
          onError("The email didn’t send. Copy the link and send it yourself.");
      } else await approvals.remove(session, row.id);
    } catch (failure) {
      console.error(`The ${kind} didn’t go through`, failure);
      onError(why(failure, "That didn’t go through. Try again in a moment."));
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  };
  const waiting = row.status === "waiting" || row.status === "expired";
  return (
    <li className={styles.child} data-approval={row.status}>
      <span className={styles.who}>
        <span className={styles.name}>
          {row.name}{" "}
          {row.status === "needs-access" && row.freeLeft === undefined && (
            <Badge tone="warning">Needs access</Badge>
          )}
          {row.status === "paused" && <Badge tone="warning">Paused</Badge>}
        </span>
        <span className={styles.access}>{statusLine(row)}</span>
        {row.status === "waiting" && row.parentEmail && (
          <span className={styles.access}>{row.parentEmail}</span>
        )}
      </span>
      <span className={styles.rowActions}>
        {row.status === "unnamed" ? (
          <>
            <Button variant="secondary" onClick={onSend}>
              Send to their parent
            </Button>
            {/* Their free problems are used: a class's access is set up
                with us. */}
            {row.freeLeft === 0 && <TalkToUsButton />}
          </>
        ) : confirming ? (
          <>
            <button
              type="button"
              className={school.danger}
              aria-busy={busy === "remove"}
              disabled={!!busy}
              onClick={() => void run("remove")}
            >
              {waiting ? "Withdraw the link" : `Remove ${row.name}`}
            </button>
            <Button
              variant="quiet"
              disabled={!!busy}
              onClick={() => setConfirming(false)}
            >
              Keep
            </Button>
          </>
        ) : (
          <>
            {row.status === "waiting" && row.inviteUrl && (
              <CopyButton
                text={row.inviteUrl}
                label="Copy link"
                copied="Link copied"
              />
            )}
            {waiting && (
              <Button
                variant="secondary"
                aria-busy={busy === "resend"}
                disabled={!!busy}
                onClick={() => void run("resend")}
              >
                {sent ? "Sent" : "Send again"}
              </Button>
            )}
            {row.status === "needs-access" && row.freeLeft === undefined && (
              <Button variant="secondary" onClick={onAccess}>
                Add access
              </Button>
            )}
            {/* Their free problems are used: a class's access is set up
                with us. */}
            {row.status === "needs-access" && row.freeLeft === 0 && (
              <TalkToUsButton variant="secondary" />
            )}
            <Button
              variant="quiet"
              disabled={!!busy}
              onClick={() => setConfirming(true)}
            >
              Remove
            </Button>
          </>
        )}
      </span>
    </li>
  );
}

function AddSheet({
  session,
  rows,
  student,
  onClose,
}: {
  session: AuthSession;
  rows: ApprovalRowResource[];
  /** An unnamed student of the class whose parent the link is for. */
  student?: { personId?: string; name?: string };
  onClose: () => void;
}) {
  const [parentEmail, setParentEmail] = useState("");
  const [errors, setErrors] = useState<{ email?: string }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ id: string; mailed: boolean } | null>(
    null,
  );
  useLoggedError(error);
  const link = done ? rows.find((row) => row.id === done.id)?.inviteUrl : null;
  const send = async () => {
    const next = {
      ...(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail.trim())
        ? {}
        : { email: "Enter their parent’s email address." }),
    };
    setErrors(next);
    if (next.email) return;
    setBusy(true);
    setError("");
    try {
      const result = await approvals.send(session, {
        ...(student?.personId ? { personId: student.personId } : {}),
        parentEmail: parentEmail.trim(),
      });
      setDone({ id: result.id!, mailed: result.mailed });
    } catch (failure) {
      console.error("The approval link wasn’t sent", failure);
      setError(why(failure, "The link wasn’t sent. Try again in a moment."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={
        student?.name
          ? `Send ${student.name}’s parent a link`
          : "Add a child from another family"
      }
    >
      {done ? (
        <div className={school.sheetForm}>
          <p className={styles.sheetText}>
            {done.mailed
              ? student?.name
                ? `We sent ${parentEmail.trim()} a link. ${student.name}’s name shows here once they approve.`
                : `We sent ${parentEmail.trim()} a link. Their child joins your class once they approve.`
              : `The email didn’t send. Copy the link and send it to ${parentEmail.trim()} yourself.`}
          </p>
          {link && (
            <CopyButton text={link} label="Copy link" copied="Link copied" />
          )}
          <Button
            variant="primary"
            className={school.sheetAction}
            onClick={onClose}
          >
            Done
          </Button>
        </div>
      ) : (
        <form
          className={school.sheetForm}
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <p className={styles.sheetText}>
            {student?.name
              ? `${student.name}’s parent gets a link to approve and add ${student.name}’s name. ${student.name} keeps practicing meanwhile.`
              : "Their parent gets a link to approve. The child can sign in and practice once they do."}
          </p>
          <TextField
            label="Their parent’s email"
            type="email"
            autoComplete="off"
            value={parentEmail}
            maxLength={254}
            error={errors.email}
            onChange={(event) => {
              setParentEmail(event.target.value);
              setErrors((prior) => ({ ...prior, email: undefined }));
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
            Send approval link
          </Button>
        </form>
      )}
    </Sheet>
  );
}
