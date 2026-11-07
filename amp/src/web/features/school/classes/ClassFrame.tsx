import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Loading } from "../../../ui/Loading";
import type { TabItem } from "../../../ui/Tabs";
import { classesOptions, currentSession } from "../api";
import { OrgFrame } from "../OrgFrame";
import { classYearOptions } from "../org/org-api";

/** A class's tabs. Each tab is a child route under `/school/$org/classes/$class`. */
export function classTabs(org: string, id: string): TabItem[] {
  const tab = (leaf: string, label: string): TabItem => ({
    id: leaf,
    label,
    path: `school/${org}/classes/${id}/${leaf}`,
  });
  return [
    tab("today", "Today"),
    tab("map", "Class map"),
    tab("gradebook", "Gradebook"),
    tab("time", "Time"),
    tab("roster", "Roster"),
    tab("settings", "Settings"),
  ];
}

/** The staff frame around one class, with the real school and classes. */
export function ClassFrame({
  org,
  classId,
  className,
  loading,
  tab,
  children,
}: {
  org: string;
  classId: string;
  /** What this class is called, if the screen knows before the frame does. */
  className?: string;
  /** The screen's own data is still on its way. The frame is already whole, so
   * the wait sits inside it and nothing above it moves. */
  loading: boolean;
  tab: string;
  children: ReactNode;
}) {
  const classes = useQuery(classesOptions(currentSession(), org));
  const name =
    className ??
    classes.data?.find((entry) => entry.id === classId)?.name ??
    "Class";
  // A class from a year that's over keeps its grades and time, not today's to-dos.
  const past =
    useQuery(classYearOptions(currentSession(), classId)).data?.past === true;
  const tabs = classTabs(org, classId).filter(
    (entry) => !past || entry.id === "gradebook" || entry.id === "time",
  );
  return (
    <OrgFrame
      orgId={org}
      nav={`class:${classId}`}
      title={name}
      crumbs={[{ label: name }]}
      tabs={tabs}
      activeTab={tab}
    >
      {loading ? <Loading /> : children}
    </OrgFrame>
  );
}
