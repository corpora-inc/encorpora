import type { ReactNode } from "react";
import join from "../school/join/Join.module.css";

/** What a school's student is told when they can't practice yet, in school
 * terms: never a family's free problems, never "your grown-up". A class's
 * name stays on one line. */
export function studentWaitingWords(
  gate: "waiting" | "ended" | "seat",
  className?: string,
): { title: ReactNode; detail?: string } {
  if (gate === "waiting")
    return { title: "Your teacher hasn’t started practice yet." };
  if (gate === "ended")
    return {
      title: className ? (
        <>
          Practice for <span className={join.nowrap}>{className}</span> has
          ended.
        </>
      ) : (
        "Practice for your class has ended."
      ),
    };
  return {
    title: "Ask your teacher about your seat.",
    detail: "Practice opens here as soon as your teacher has one for you.",
  };
}

/** The one gate, on /join and for a student already signed in: the message
 * centred in the display face. Signing out is the bar's, beside it. */
export function PracticeGate({
  gate,
  className,
  heading = "h1",
}: {
  gate: "waiting" | "ended" | "seat";
  className?: string;
  heading?: "h1" | "h2";
}) {
  const words = studentWaitingWords(gate, className);
  const Heading = heading;
  return (
    <div className={join.column} data-centered data-student-waiting={gate}>
      <Heading className={join.title}>{words.title}</Heading>
      {words.detail && <p className={join.subtitle}>{words.detail}</p>}
    </div>
  );
}

/** A signed-in student's wait, where practice would be. */
export function StudentWaiting({
  gate,
  className,
}: {
  gate: "waiting" | "ended" | "seat";
  className?: string;
}) {
  return (
    <main className={join.gateMain}>
      <div className={join.gateFill}>
        <PracticeGate gate={gate} className={className} />
      </div>
    </main>
  );
}
