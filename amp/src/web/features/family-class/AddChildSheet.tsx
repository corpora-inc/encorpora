import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import type { OrgResource } from "../../../schools/contracts";
import {
  CHILD_NAME_MAX,
  childNameProblem,
  NICKNAME_MAX,
  PARENT_ENTRY_LINE,
} from "../../../learning/nickname";
import type { AuthSession } from "../../auth";
import { useLoggedError } from "../../feedback";
import { request } from "../../lib/api";
import { AppError } from "../../lib/AppError";
import { invalidateAccount, meOptions } from "../../lib/query";
import { Button } from "../../ui/Button";
import { BirthYearPicker } from "../../ui/Select";
import { Sheet } from "../../ui/Sheet";
import { TextField } from "../../ui/TextField";
import styles from "./AddChildSheet.module.css";

/* Adding a child to a family's class (docs/product-model.md). A family's class
   is never a school: it has no school roster form and no grades. Its account
   holder adds either their own child (a name and a birth year, the family
   endpoint) or, in a tutor's class, a student from another family (a
   nickname or initials and a birth year). */

/** What this person can add to a family org's class, if anything: their own
 * child, a tutor's student, or nothing (a school org, a second parent, a
 * co-teacher). */
export type FamilyAdd = "child" | "student";
export function useFamilyAdd(
  session: AuthSession | null,
  org: Pick<OrgResource, "id" | "kind" | "demo"> | undefined,
): FamilyAdd | null {
  const me = useQuery({
    ...meOptions(session ?? { accountId: "", token: "" }),
    enabled: !!session,
  }).data;
  if (!org || org.kind !== "family" || org.demo || !me?.signedIn) return null;
  // Only the account holder adds: their family is the one this org holds.
  if (me.familyClass?.orgId !== org.id) return null;
  return me.learners.length > 0 ? "child" : "student";
}

export const familyAddLabel = (kind: FamilyAdd) =>
  kind === "child" ? "Add a child" : "Add a student";

const created = z.object({ name: z.string().optional() }).passthrough();

export function AddChildSheet({
  session,
  kind,
  open,
  onOpenChange,
}: {
  session: AuthSession;
  kind: FamilyAdd;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const child = kind === "child";
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [nameError, setNameError] = useState("");
  const [yearError, setYearError] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  useLoggedError(error);
  const submit = async () => {
    const value = name.trim();
    const problem = childNameProblem(value, child ? CHILD_NAME_MAX : NICKNAME_MAX);
    if (problem) setNameError(problem);
    if (!year) setYearError("Choose the year they were born.");
    if (problem || !year) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const body = child
        ? { ...(value ? { name: value } : {}), birthYear: Number(year) }
        : { ...(value ? { nickname: value } : {}), birthYear: Number(year) };
      const added = await request(
        child ? "/learners" : "/family/class/students",
        created,
        { token: session.token, body },
      );
      // `/me`, Today, the map and the roster all read it again.
      await invalidateAccount(session.accountId);
      setStatus(
        child
          ? `${added.name ?? (value || "Your child")} is in your family.`
          : `${added.name ?? (value || "The student")} is in your class.`,
      );
      setName("");
      setYear("");
    } catch (failure) {
      console.error("The child wasn’t added", failure);
      setError(
        failure instanceof AppError && failure.message
          ? failure.message
          : "That didn’t save. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setStatus("");
          setError("");
        }
        onOpenChange(next);
      }}
      title={child ? "Add a child" : "Add a student"}
    >
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <TextField
          label={child ? "Name" : "Nickname or initials"}
          placeholder={child ? "First name or nickname" : "Optional"}
          value={name}
          maxLength={child ? CHILD_NAME_MAX : NICKNAME_MAX}
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          error={nameError}
          onChange={(event) => {
            setName(event.target.value);
            setNameError("");
            setStatus("");
          }}
        />
        <div className={styles.field}>
          <span className={styles.label} aria-hidden="true">
            Birth year
          </span>
          <BirthYearPicker
            label="Birth year"
            adult={false}
            value={year}
            disabled={busy}
            onChange={(next) => {
              setYear(next);
              setYearError("");
              setStatus("");
            }}
          />
          <span className={styles.error} aria-live="polite">
            {yearError}
          </span>
        </div>
        <p className={styles.note}>
          {child
            ? PARENT_ENTRY_LINE
            : "Their own parent adds their name through a link you send."}
        </p>
        <p
          className={error ? styles.failed : styles.done}
          role={error ? "alert" : "status"}
        >
          {error || status}
        </p>
        <Button
          variant="primary"
          type="submit"
          aria-busy={busy || undefined}
          disabled={busy}
          className={styles.action}
        >
          {child ? "Add child" : "Add student"}
        </Button>
      </form>
    </Sheet>
  );
}
