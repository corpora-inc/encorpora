import { useQuery } from "@tanstack/react-query";
import { useSessionOrNull } from "../../lib/session";
import { useState } from "react";
import { meOptions } from "../../lib/query";
import { Button } from "../../ui/Button";
import { TextField } from "../../ui/TextField";
import { Toast } from "../../ui/Toast";
import { saveProfile } from "../family/api";
import styles from "./YourName.module.css";
import { Form } from "../../ui/Form";

const NO_SESSION = { accountId: "", token: "" };

/**
 * The adult's own name (R9, R12), shown and changed in place: every
 * adult's, with or without a family, as other people see it on an
 * invitation, an approval, a staff list or a report card. First and last
 * name, saved together through the account's profile, which invalidates
 * the account, so the new name shows everywhere at once. No route
 * knowledge: Account and a family's People compose it.
 */
export function NameEditor({
  detail = "Others see it when you invite or share.",
}: {
  /** The line under the name: why it matters where it is shown. */
  detail?: string;
}) {
  const session = useSessionOrNull();
  const me = useQuery({
    ...meOptions(session ?? NO_SESSION),
    enabled: !!session,
  }).data;
  const account =
    me?.signedIn && me.account.id === session?.accountId ? me.account : null;
  const known = account?.displayName?.trim() || null;
  const [editing, setEditing] = useState(false);
  const [given, setGiven] = useState("");
  const [family, setFamily] = useState("");
  const [givenError, setGivenError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const start = () => {
    // A name from before first and last names were asked: split it once.
    const [first = "", ...rest] = (known ?? "").split(" ");
    setGiven(account?.givenName ?? first);
    setFamily(account?.familyName ?? rest.join(" "));
    setGivenError("");
    setEditing(true);
  };
  const save = async () => {
    const first = given.trim();
    if (!first) return setGivenError("Enter your first name.");
    if (!session) return;
    setBusy(true);
    try {
      await saveProfile(session, {
        givenName: first,
        familyName: family.trim() || null,
      });
      setEditing(false);
      setNotice("Your name is saved.");
    } catch (failure) {
      console.error("The adult’s name didn’t save", failure);
      setError("Your name didn’t save. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={styles.editor} data-account-name={known ? "" : "missing"}>
      <div className={styles.row}>
        {editing ? (
          <Form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className={styles.fields}>
              <TextField
                label="First name"
                autoComplete="given-name"
                value={given}
                maxLength={100}
                error={givenError}
                autoFocus
                disabled={busy}
                onChange={(event) => {
                  setGiven(event.target.value);
                  setGivenError("");
                }}
              />
              <TextField
                label="Last name"
                autoComplete="family-name"
                value={family}
                maxLength={100}
                disabled={busy}
                onChange={(event) => setFamily(event.target.value)}
              />
            </div>
            <div className={styles.actions}>
              <Button
                variant="primary"
                disabled={busy}
                aria-busy={busy || undefined}
              >
                Save name
              </Button>
              <Button
                variant="quiet"
                type="button"
                disabled={busy}
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </Form>
        ) : (
          <>
            <div className={styles.text}>
              <span className={styles.name}>
                {/* A no-break space holds the name's line while the account
                    loads; a plain one collapses and the row grows. */}
                {account ? (known ?? "Not added yet") : "\u00a0"}
              </span>
              <span className={styles.detail}>{detail}</span>
            </div>
            <div className={styles.action}>
              <Button
                variant="secondary"
                onClick={start}
                disabled={!account}
                data-change-name=""
              >
                {/* Both labels hold the button's width, so the row's text
                    wraps the same before and after the account loads. */}
                <span className={styles.labels}>
                  {(["Change", "Add your name"] as const).map((label) => (
                    <span
                      key={label}
                      aria-hidden={
                        label !== (known ? "Change" : "Add your name") ||
                        undefined
                      }
                    >
                      {label}
                    </span>
                  ))}
                </span>
              </Button>
            </div>
          </>
        )}
      </div>
      <Toast
        message={notice || error}
        onDismiss={() => (setNotice(""), setError(""))}
      />
    </div>
  );
}
