import { signOut } from "../../auth";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";

/** What a school's student is told when they can't practice yet, in school
 * terms: never a family's free problems, never "your grown-up". */
export function studentWaitingWords(
  gate: "waiting" | "ended" | "seat",
  className?: string,
) {
  if (gate === "waiting")
    return { title: "Your teacher hasn’t started practice yet." };
  if (gate === "ended")
    return {
      title: className
        ? `Practice for ${className} has ended.`
        : "Practice for your class has ended.",
    };
  return {
    title: "Ask your teacher about your seat.",
    detail: "Practice opens here as soon as your teacher has one for you.",
  };
}

/** The student's wait, with the one thing that works: hand the device on. */
export function StudentWaiting({
  gate,
  className,
}: {
  gate: "waiting" | "ended" | "seat";
  className?: string;
}) {
  const words = studentWaitingWords(gate, className);
  return (
    <main className="practice-start" data-student-waiting={gate}>
      <EmptyState
        title={words.title}
        action={
          <Button
            variant="secondary"
            onClick={() =>
              void signOut().catch((failure) =>
                console.error("Student sign-out failed", failure),
              )
            }
          >
            Sign out
          </Button>
        }
      >
        {words.detail}
      </EmptyState>
    </main>
  );
}
