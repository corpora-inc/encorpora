import { useQuery } from "@tanstack/react-query";
import { sessionOptions } from "../../lib/query";
import { classesOptions, orgOptions } from "../school/api";
import { classYearOptions } from "../school/org/org-api";
import { pilotOptions } from "../school/pilots/api";
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
  // The year endpoint authorizes this class independently of the paginated roster.
  const available = frame.kind === "class" && year !== undefined;
  const family = org?.kind === "family";
  const access = useQuery({
    ...pilotOptions(auth, frame.kind === "class" ? frame.classId : ""),
    enabled:
      frame.kind === "class" &&
      !!session &&
      org?.kind === "school" &&
      !org.demo,
    refetchOnMount: false,
  }).data;
  // A family has one class: on any of its org's screens (an old link to its
  // calendar, say) the row stays the class's own.
  const familyClass =
    family && frame.kind === "school" && classes?.length === 1
      ? classes[0]
      : undefined;
  return {
    tabs: !org
      ? []
      : frame.kind === "class"
        ? available
          ? classTabs(
              frame.org,
              frame.classId,
              year?.past === true,
              family,
              classes?.find((entry) => entry.id === frame.classId)
                ?.studentCount,
            )
          : []
        : familyClass
          ? classTabs(
              org.id,
              familyClass.id,
              false,
              true,
              familyClass.studentCount,
            )
          : schoolTabs(org, classes?.length ?? 0),
    // A family's Today has its children and the code itself: no class to
    // start.
    start:
      frame.kind === "class" &&
      available &&
      !year?.past &&
      org?.kind !== "family" &&
      (org?.demo === true || (access?.coverage?.covered ?? 0) > 0),
    /** A demo place (docs/schools.md#demo-places), and whether it is a demo
     * class ("Just my class") rather than a demo school. */
    demo: active && org?.demo === true,
    solo: org?.solo === true,
  };
}
