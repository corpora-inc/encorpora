import type { PilotState } from "../../../../schools/pilot-contracts";
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(new Date(value))
    : "";
export function pilotPresentation(pilot: PilotState, students: number) {
  const paid = students > 0 && (pilot.coverage?.paid ?? 0) >= students;
  if (paid)
    return {
      title: "Your class has seats",
      detail: `All ${students} students have access to practice.`,
      action: null,
    };
  if (pilot.status === "active")
    return {
      title: "Your pilot is active",
      detail: `Practice continues through ${date(pilot.endsAt)}. Share a buyer link when your school is ready to discuss seats.`,
      action: null,
    };
  if (pilot.status === "grace")
    return {
      title: "Arrange seats for your class",
      detail: `Practice continues through ${date(pilot.graceEndsAt)} while you arrange seats.`,
      action: null,
    };
  if (pilot.status === "expired" || !pilot.eligible)
    return {
      title: "Your pilot has ended",
      detail:
        "Request seats to continue practice with your existing students and their learning records.",
      action: null,
    };
  if (!students)
    return {
      title: "Get your class ready",
      detail:
        "Add students or import a roster. Start the pilot when you are ready for them to practice.",
      action: null,
    };
  if (pilot.startedAt)
    return {
      title: "Add this class to your pilot",
      detail: `This class shares your existing pilot dates, through ${date(pilot.endsAt)}${pilot.graceEndsAt && new Date(pilot.endsAt ?? 0) < new Date() ? `, with continued access through ${date(pilot.graceEndsAt)}` : ""}.`,
      action: "Add class to pilot",
    };
  return {
    title: "Ready for your students",
    detail:
      "Start 30 days of practice for this class. Your pilot begins when you choose Start.",
    action: "Start 30-day pilot",
  };
}
