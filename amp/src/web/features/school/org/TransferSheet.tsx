import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppError } from "../../../lib/AppError";
import { useLoggedError } from "../../../feedback";
import { Button } from "../../../ui/Button";
import { Select } from "../../../ui/Select";
import { Sheet } from "../../../ui/Sheet";
import { classesOptions, currentSession, refreshSchool } from "../api";
import { FormNote } from "../parts";
import schoolStyles from "../School.module.css";
import { moveStudent, transferOptionsQuery } from "./org-api";

const seatWords = {
  stays: "Their seat stays: the license covers both schools.",
  moves: "Their seat moves: this school’s license has room.",
  needs:
    "This school has no seat open, so they’ll show “needs a seat” until one is.",
} as const;

/** Whether this person can move this student anywhere. */
export function useCanMove(studentId: string, allowed: boolean) {
  const session = currentSession();
  const options = useQuery({
    ...transferOptionsQuery(session, studentId),
    enabled: allowed,
  });
  return allowed && (options.data?.schools.length ?? 0) > 0;
}

/** Moving a student to another school in the district. Same person, same learner:
 * their evidence and frozen grades don't move at all. */
export function TransferSheet({
  studentId,
  name,
  open,
  onOpenChange,
  onMoved,
}: {
  studentId: string;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMoved: (school: { id: string; name: string }) => void;
}) {
  const session = currentSession();
  const options = useQuery(transferOptionsQuery(session, studentId)).data;
  const [to, setTo] = useState("");
  const [classId, setClassId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useLoggedError(error);
  const chosen =
    options?.schools.find((school) => school.id === to) ?? options?.schools[0];
  const classes = useQuery({
    ...classesOptions(session, chosen?.id ?? ""),
    enabled: open && !!chosen,
  }).data;
  const submit = async () => {
    if (!chosen) return;
    setBusy(true);
    setError("");
    try {
      const moved = await moveStudent(session, studentId, {
        to: chosen.id,
        ...(classId ? { classId } : {}),
      });
      await refreshSchool(session);
      onMoved(moved.to);
    } catch (failure) {
      setError(
        failure instanceof AppError
          ? failure.message
          : `${name} didn’t move. Try again.`,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Move ${name}`}
      description={options ? `From ${options.from.name}` : undefined}
    >
      <form
        className={schoolStyles.sheetForm}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className={schoolStyles.field}>
          <span className={schoolStyles.fieldLabel}>New school</span>
          <Select
            aria-label="New school"
            value={chosen?.id ?? ""}
            onValueChange={(value) => {
              setTo(value);
              setClassId("");
            }}
          >
            {options?.schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </Select>
        </div>
        <p className={schoolStyles.fieldHelp}>
          {chosen ? seatWords[chosen.seat] : " "}
        </p>
        <div className={schoolStyles.field}>
          <span className={schoolStyles.fieldLabel}>Class there</span>
          <Select
            aria-label="Class there"
            value={classId}
            onValueChange={setClassId}
          >
            <option value="">Decide later</option>
            {classes?.map((klass) => (
              <option key={klass.id} value={klass.id}>
                {klass.name}
              </option>
            ))}
          </Select>
        </div>
        <p className={schoolStyles.fieldHelp}>
          Their classes here end today. Practice history and final grades stay
          with them and with this school’s records.
        </p>
        <FormNote error={error} />
        <Button
          variant="primary"
          type="submit"
          className={schoolStyles.sheetAction}
          aria-busy={busy}
          disabled={busy || !chosen}
        >
          Move {name}
        </Button>
      </form>
    </Sheet>
  );
}
