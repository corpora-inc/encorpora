import { useEffect, useRef, useState } from "react";
import type { SuggestionResource } from "../../../../schools/teacher-contracts";
import type { AuthSession } from "../../../auth";
import { failureMessage, useSaveFinal, type Place } from "./teacher-api";
import styles from "./Teacher.module.css";

export function Suggested({ suggestion }: { suggestion: SuggestionResource }) {
  // One child alone, or a class of one with no target: nothing to measure a
  // letter against, so its facts stand without one.
  if (suggestion.status === "facts-only")
    return (
      <span
        className={styles.notEnough}
        title="With no one to compare with and no weekly target, AMP shows the facts without a letter."
      >
        Facts only, no letter
      </span>
    );
  if (suggestion.status !== "ready")
    return <span className={styles.notEnough}>Not enough work yet</span>;
  return (
    <span className={styles.suggested}>
      <strong>{suggestion.letters}</strong>, {suggestion.low}–{suggestion.high}
    </span>
  );
}

/** A blank on a gradebook line. Whatever form the school uses, it saves on blur
 * with a quiet check beside it, and nothing around it moves. */
export function FinalField({
  session,
  place,
  student,
  term,
  final,
  editable,
  onError,
  onSaved,
}: {
  session: AuthSession | null;
  place: Place;
  student: { id: string; name: string; first: string };
  term: string;
  final: string | null;
  editable: boolean;
  onError: (message: string) => void;
  onSaved: (message: string) => void;
}) {
  const save = useSaveFinal(session, place);
  const [draft, setDraft] = useState(final ?? "");
  const [state, setState] = useState<"idle" | "saved" | "failed">("idle");
  const editing = useRef(false);
  const fade = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(fade.current), []);
  // A new value from elsewhere (its sheet, a refetch), unless they're typing. A
  // failed save leaves the value as it was, so the typing stays to try again.
  useEffect(() => {
    if (!editing.current) setDraft(final ?? "");
  }, [final]);
  if (!editable)
    return <span className={styles.finalFrozen}>{final || "—"}</span>;
  const commit = () => {
    editing.current = false;
    const value = draft.trim();
    if (value !== draft) setDraft(value);
    if (value === (final ?? "")) return;
    save.mutate(
      { student: student.id, term, value },
      {
        onSuccess: () => {
          setState("saved");
          onSaved(`Saved ${student.first}’s final grade.`);
          clearTimeout(fade.current);
          fade.current = setTimeout(() => setState("idle"), 1800);
        },
        onError: (error) => {
          setState("failed");
          onError(
            `${student.first}’s final grade didn’t save. ${failureMessage(
              error,
              "Check your connection, then leave the field again to retry.",
            )}`,
          );
        },
      },
    );
  };
  return (
    <span className={styles.finalCell} data-state={state}>
      <input
        className={styles.finalInput}
        type="text"
        value={draft}
        maxLength={24}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="next"
        aria-label={`Final grade for ${student.name}`}
        aria-invalid={state === "failed" || undefined}
        onFocus={() => {
          editing.current = true;
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          if (state !== "idle") setState("idle");
        }}
        onKeyDown={(event) => {
          // Escape takes the edit back, then the grid moves focus to the cell.
          if (event.key === "Escape") setDraft(final ?? "");
        }}
        onBlur={commit}
      />
      <svg className={styles.finalMark} viewBox="0 0 16 16" aria-hidden="true">
        <path d="m3.5 8.5 3 3 6-7" />
      </svg>
    </span>
  );
}
