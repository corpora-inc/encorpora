import { useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { HostScope } from "./host-scope";
import { ClassFrame } from "./ClassFrame";
import { classUrl } from "./teacher-shared";
export { keptPerson, offersWholeClass, wholeClass } from "./host-scope";

/**
 * Where a class's record screens (grades, report cards, workbooks, cards) are
 * composed: in the class itself, or in a space that holds the same class
 * under its own address and words (a family's Report cards, say). The screen
 * takes its class, its frame, the addresses of its sibling screens, which of
 * the class's people it shows and what it calls them from here; it never
 * asks which space it is in.
 */
/** Someone of the host's own who isn't in this class (a family's child in
 * another family's group): Time reads them for the same dates and puts them
 * in its rows, totals and export, labelled by their group. */
/** Someone's time over a range, in their own group. */
export type OtherTime = {
  group: string;
  /** When they joined that group, if within reach: weeks before are
   * hatched, as the class's own roster starts are. */
  joined: string | null;
  minutes: number;
  problems: number;
  range: { from: string; to: string };
  days: { day: string; minutes: number; problems: number }[];
};
export type OtherLearner = {
  id: string;
  name: string;
  /** Their own page in this host. */
  page: string;
  /** Their time over the class's period, from its first day (`from`). */
  time: (
    period: "week" | "month" | "term",
    from: string,
  ) => {
    queryKey: readonly unknown[];
    enabled: boolean;
    queryFn: (context: { signal: AbortSignal }) => Promise<OtherTime>;
  };
  /** Their time export's address for the same period and first day. */
  csv: (period: "week" | "month" | "term", from: string) => string;
};

export type ClassHost = HostScope & {
  /** The host's own people outside this class (Time reads them too). */
  others?: readonly OtherLearner[];
  place: { org: string; class: string };
  /** The frame around the page. */
  Frame: (props: {
    loading: boolean;
    tab: string;
    className?: string;
    children: ReactNode;
  }) => ReactNode;
  /** A sibling screen's address, without the leading slash: `gradebook`,
   * `report-cards`, `workbooks/<date>`, `today`, `settings`, `calendar`. */
  href: (leaf: string) => string;
  /** What the host calls them. */
  words: {
    learner: string;
    learners: string;
    Learner: string;
    /** The people as a group: "your students", "your kids". */
    group: string;
    /** Who teaches them, over the names on a report card; a class says
     * "Teacher" or "Teachers". */
    taughtBy?: string;
  };
  /** Who decides a final grade: "the teacher", "you". */
  decider: string;
  /** A person's own page in this host (a family's child page), when it
   * has one: their record opens there, never as a class's student layer. */
  record?: (person: string) => string | null;
};

const STUDENT_WORDS: ClassHost["words"] = {
  learner: "student",
  learners: "students",
  Learner: "Student",
  group: "your students",
};

/** The class's own frame, from its route. A component of its own (never a
 * closure made per render), so the page under it is never remounted. */
function RoutedClassFrame({
  loading,
  tab,
  className,
  children,
}: Parameters<ClassHost["Frame"]>[0]) {
  const params = useParams({ strict: false }) as {
    org?: string;
    class?: string;
  };
  return (
    <ClassFrame
      org={params.org ?? ""}
      classId={params.class ?? ""}
      className={className}
      loading={loading}
      tab={tab}
    >
      {children}
    </ClassFrame>
  );
}

/** The class's own host, from its route: the class's frame and addresses. */
export function useClassHost(given?: ClassHost): ClassHost {
  const params = useParams({ strict: false }) as {
    org?: string;
    class?: string;
  };
  if (given) return given;
  const place = { org: params.org ?? "", class: params.class ?? "" };
  return {
    place,
    Frame: RoutedClassFrame,
    href: (leaf) =>
      leaf === "calendar"
        ? `school/${place.org}/calendar`
        : classUrl(place.org, place.class, leaf as never),
    words: STUDENT_WORDS,
    decider: "the teacher",
  };
}
