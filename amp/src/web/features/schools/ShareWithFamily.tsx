import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { AuthSession } from "../../auth";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { TextField } from "../../ui/TextField";
import { Toast } from "../../ui/Toast";
import { CopyButton } from "../school/parts";
import { shareOptions, useShareChange } from "./share-api";
import styles from "./ShareWithFamily.module.css";

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

/** A read-only link for one student's family: make it, copy it, revoke it. It
 * shows only for someone who can, and only for a student a link would show
 * something about. */
export function ShareWithFamily({
  session,
  student,
  first,
}: {
  session: AuthSession | null;
  student: string;
  first: string;
}) {
  const state = useQuery(shareOptions(session, student));
  const change = useShareChange(session, student);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const data = state.data;
  if (!data?.canManage || (!data.available && !data.link)) return null;
  const send = (what: "make" | "revoke") =>
    change.mutate(what, {
      onError: (failure) => {
        console.error("The family link didn’t change", failure);
        setError(
          what === "make"
            ? "The link wasn’t made. Check your connection and try again."
            : "The link is still active. Check your connection and try again.",
        );
      },
    });
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Share with family
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`Share ${first}’s progress`}
      >
        <div className={styles.body}>
          <p>
            A read-only page with {first}’s levels, time, objectives and any
            final grades you’ve entered. Anyone with the link can open it, and
            no sign-in is needed.
          </p>
          {data.link ? (
            <>
              <TextField
                label="Family link"
                readOnly
                value={data.link.url}
                onFocus={(event) => event.target.select()}
              />
              <div className={styles.actions}>
                <CopyButton
                  text={data.link.url}
                  label="Copy link"
                  copied="Link copied"
                />
                <Button
                  variant="quiet"
                  aria-busy={change.isPending}
                  disabled={change.isPending}
                  onClick={() => send("revoke")}
                >
                  Revoke link
                </Button>
              </div>
              {data.link.expiresAt && (
                <p className={styles.note}>
                  It works until {longDate(data.link.expiresAt)}, and stops when
                  you revoke it or {first} leaves the class.
                </p>
              )}
            </>
          ) : (
            <div className={styles.actions}>
              <Button
                variant="primary"
                aria-busy={change.isPending}
                disabled={change.isPending}
                onClick={() => send("make")}
              >
                Make a link
              </Button>
            </div>
          )}
        </div>
      </Dialog>
      <Toast message={error} onDismiss={() => setError("")} />
    </>
  );
}
