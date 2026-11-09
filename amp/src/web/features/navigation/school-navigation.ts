import { useQuery } from "@tanstack/react-query";
import { sessionOptions } from "../../lib/query";
import { classesOptions, orgOptions } from "../school/api";
import { classYearOptions } from "../school/org/org-api";
import { classTabs, schoolTabs, type ShellFrame } from "./shell-frame";

/** Route loaders fill these account-scoped resources before the bar changes. */
export function useSchoolNavigation(frame: ShellFrame) {
  const session = useQuery(sessionOptions).data;
  const active = frame.kind === "class" || frame.kind === "school";
  const auth = session ?? { accountId: "", token: "" };
  const orgId = active ? frame.org : "";
  const org = useQuery({
    ...orgOptions(auth, orgId),
    enabled: active && !!session,
    refetchOnMount: false,
  }).data;
  const classes = useQuery({
    ...classesOptions(auth, orgId),
    enabled: active && !!session,
    refetchOnMount: false,
  }).data;
  const year = useQuery({
    ...classYearOptions(auth, frame.kind === "class" ? frame.classId : ""),
    enabled: frame.kind === "class" && !!session,
    refetchOnMount: false,
  }).data;
  // The year endpoint authorizes past classes absent from the current roster.
  // That roster includes aides as well as teachers and org-wide readers.
  const available =
    frame.kind === "class" &&
    (year?.past === true ||
      classes?.some((entry) => entry.id === frame.classId));
  return {
    tabs: !org
      ? []
      : frame.kind === "class"
        ? available
          ? classTabs(frame.org, frame.classId, year?.past === true)
          : []
        : schoolTabs(org, classes?.length ?? 0),
    start: frame.kind === "class" && available && !year?.past,
  };
}
