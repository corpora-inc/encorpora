import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { meOptions, sessionOptions } from "../../lib/query";
import { Button } from "../../ui/Button";
import { TextField } from "../../ui/TextField";
import { Toast } from "../../ui/Toast";
import { saveProfile } from "../family/api";
import styles from "./YourName.module.css";

const NO_SESSION = { accountId: "", token: "" };

/**
 * The adult's own name, in Account (R9, R12): every adult's, with or without
 * a family, as other people see it on an invitation, an approval, a staff
 * list or a report card. First and last name, saved together.
 */
export function YourName() {
  const session = useQuery(sessionOptions).data ?? null;
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
    <section
      className={styles.section}
      aria-labelledby="account-your-name"
      data-account-name={known ? "" : "missing"}
    >
      <h2 id="account-your-name" className={styles.title}>
        Your name
      </h2>
      <div className={styles.row}>
        {editing ? (
          <form
            className={styles.form}
            noValidate
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
          </form>
        ) : (
          <>
            <div className={styles.text}>
              <span className={styles.name}>
                {account ? (known ?? "Not added yet") : " "}
              </span>
              <span className={styles.detail}>
                Others see it when you invite them, and on what you share.
              </span>
            </div>
            <div className={styles.action}>
              <Button
                variant="secondary"
                onClick={start}
                disabled={!account}
                data-change-name=""
              >
                {known ? "Change" : "Add your name"}
              </Button>
            </div>
          </>
        )}
      </div>
      <Toast
        message={notice || error}
        onDismiss={() => (setNotice(""), setError(""))}
      />
    </section>
  );
}
