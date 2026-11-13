import { useLocation, useNavigate } from "@tanstack/react-router";
import type { AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { Button } from "../../ui/Button";
import { Toast } from "../../ui/Toast";
import { copiedLabel, useCopyStudent } from "./api";
import { practiceAs } from "./practice-mode";

/** "Try problems as this student", on a student's record: a practice profile
 * of the reader's own, copied once from the student's levels now, then
 * practice as it. The student's own record never changes. */
export function TryAsStudent({
  session,
  personId,
}: {
  session: AuthSession;
  personId: string;
}) {
  const navigate = useNavigate();
  // Practicing as the student is a mode of this place: its way back, Back
  // and a refresh return here (practice-mode.ts).
  const here = useLocation({ select: (location) => location.href });
  const copy = useCopyStudent(session, personId);
  return (
    <>
      <Button
        variant="secondary"
        aria-busy={copy.isPending || undefined}
        disabled={copy.isPending || copy.isSuccess}
        data-try-as-student
        onClick={() =>
          copy.mutate(copiedLabel(), {
            onSuccess: (profile) => void navigate(practiceAs(profile, here)),
          })
        }
      >
        Try problems as this student
      </Button>
      <Toast
        message={
          copy.error
            ? copy.error instanceof AppError && copy.error.kind === "network"
              ? copy.error.message
              : "The student’s levels weren’t copied. Refresh the record, then try again."
            : ""
        }
        onDismiss={() => copy.reset()}
      />
    </>
  );
}
