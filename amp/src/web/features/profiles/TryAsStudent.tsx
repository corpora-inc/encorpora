import { useNavigate } from "@tanstack/react-router";
import type { AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { Button } from "../../ui/Button";
import { Toast } from "../../ui/Toast";
import { copiedLabel, useCopyStudent } from "./api";

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
            onSuccess: () =>
              void navigate({ to: "/$", params: { _splat: "practice" } }),
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
