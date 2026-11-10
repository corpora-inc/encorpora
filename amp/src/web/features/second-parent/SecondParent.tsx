import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { AuthSession } from "../../auth";
import { useLoggedError } from "../../feedback";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Sheet } from "../../ui/Sheet";
import { TextField } from "../../ui/TextField";
import { Toast } from "../../ui/Toast";
import { CopyButton, FormNote } from "../school/parts";
import school from "../school/School.module.css";
import styles from "../school/classes/Family.module.css";
import {
  secondParent,
  secondParentFailure,
  secondParentOptions,
  type SecondParent as SecondParentView,
} from "./api";

/** The family's second parent (docs/families.md), for its account holder:
 * invite one, see where it stands, send again or remove. A paid family covers
 * both parents, so one invitation is all there is: once she has one, the
 * action is gone. On Today and in Account → Family alike. */
export function SecondParent({
  session,
  className = styles.family,
  headingClassName = styles.heading,
}: {
  session: AuthSession;
  /** Account → Family sets it among its own sections and headings. */
  className?: string;
  headingClassName?: string;
}) {
  const query = useQuery(secondParentOptions(session));
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  useLoggedError(error);
  const current = query.data;
  return (
    <section
      className={className}
      aria-labelledby="second-parent"
      data-second-parent={current?.status ?? (query.isPending ? "" : "none")}
    >
      <h2 id="second-parent" className={headingClassName}>
        Second parent
      </h2>
      {query.isPending ? (
        // The row's place, held until it's known.
        <div className={`amp-skeleton ${styles.reserve}`} aria-busy="true">
          <span />
        </div>
      ) : query.isError ? (
        <p className={styles.access} role="alert">
          The second parent didn’t load.{" "}
          <button
            type="button"
            className={school.inlineAction}
            onClick={() => void query.refetch()}
          >
            Try again
          </button>
        </p>
      ) : current ? (
        <ul className={styles.children}>
          <SecondParentRow
            session={session}
            parent={current}
            onError={setError}
          />
        </ul>
      ) : (
        <Button
          variant="secondary"
          className={styles.add}
          onClick={() => setInviting(true)}
        >
          Add a second parent
        </Button>
      )}
      {inviting && (
        <SecondParentInviteSheet
          session={session}
          onClose={() => setInviting(false)}
        />
      )}
      <Toast message={error} onDismiss={() => setError("")} />
    </section>
  );
}

/** The second parent's row: who, where it stands, and its actions. */
export function SecondParentRow({
  session,
  parent,
  onError,
}: {
  session: AuthSession;
  parent: SecondParentView;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState<"resend" | "remove" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sent, setSent] = useState(false);
  const invited = parent.status === "invited";
  const who = invited ? parent.emailHint : (parent.name ?? parent.emailHint);
  const run = async (kind: "resend" | "remove") => {
    setBusy(kind);
    try {
      if (kind === "resend") {
        const result = await secondParent.resend(session);
        setSent(result.mailed);
        if (!result.mailed)
          onError("The email didn’t send. Copy the link and send it yourself.");
      } else await secondParent.remove(session);
    } catch (failure) {
      console.error(`The second parent ${kind} didn’t go through`, failure);
      onError(
        secondParentFailure(
          failure,
          kind === "resend"
            ? "That didn’t send. Try again in a moment."
            : "They weren’t removed. Try again in a moment.",
        ),
      );
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  };
  return (
    <li className={styles.child} data-second-parent-row={parent.status}>
      <span className={styles.who}>
        <span className={styles.name}>
          {invited ? `Waiting for ${who}` : who}{" "}
          {invited && <Badge tone="warning">Invited</Badge>}
        </span>
        <span className={styles.access}>
          {invited
            ? "They join when they accept with that address."
            : "Sees the class and the children’s progress. Practices free."}
        </span>
      </span>
      <span className={styles.rowActions}>
        {confirming ? (
          <>
            <button
              type="button"
              className={school.danger}
              aria-busy={busy === "remove"}
              disabled={!!busy}
              onClick={() => void run("remove")}
            >
              {invited ? "Withdraw the invitation" : `Remove ${who}`}
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
            {invited && parent.inviteUrl && (
              <CopyButton
                text={parent.inviteUrl}
                label="Copy link"
                copied="Link copied"
              />
            )}
            {invited && (
              <Button
                variant="secondary"
                aria-busy={busy === "resend"}
                disabled={!!busy}
                onClick={() => void run("resend")}
              >
                {sent ? "Sent" : "Send again"}
              </Button>
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

/** "Add a second parent": an email, then the invitation. */
export function SecondParentInviteSheet({
  session,
  onClose,
}: {
  session: AuthSession;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ mailed: boolean } | null>(null);
  const link = useQuery({
    ...secondParentOptions(session),
    enabled: !!done,
  }).data?.inviteUrl;
  useLoggedError(error);
  const send = async () => {
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setEmailError("Enter their full email address.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setDone(await secondParent.invite(session, address));
    } catch (failure) {
      console.error("The second parent invitation wasn’t sent", failure);
      setError(
        secondParentFailure(
          failure,
          "The invitation wasn’t sent. Try again in a moment.",
        ),
      );
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
      title="Add a second parent"
    >
      {done ? (
        <div className={school.sheetForm}>
          <p className={styles.sheetText}>
            {done.mailed
              ? `We sent ${email.trim()} an invitation. They join once they accept with that address.`
              : `The email didn’t send. Copy the link and send it to ${email.trim()} yourself.`}
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
            They see the class and the children’s progress, can let a child
            practice on their device, and practice free themselves. Billing,
            consent and the children’s names stay yours.
          </p>
          <TextField
            label="Their email"
            type="email"
            autoComplete="off"
            inputMode="email"
            value={email}
            maxLength={254}
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
            Send
          </Button>
        </form>
      )}
    </Sheet>
  );
}
