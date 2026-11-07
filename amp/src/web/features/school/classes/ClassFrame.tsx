import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { LoadingScreen } from "../../../ui/LoadingScreen";
import type { TabItem } from "../../../ui/Tabs";
import { SchoolFrame } from "../SchoolFrame";
import { classListOptions, orgOptions, useStaffSession } from "./api";

/** A class's tabs. Each tab is a child route under `/school/$org/classes/$class`. */
export function classTabs(org: string, id: string): TabItem[] {
  return [
    {
      id: "workbooks",
      label: "Workbooks",
      path: `school/${org}/classes/${id}/workbooks`,
    },
    {
      id: "roster",
      label: "Roster",
      path: `school/${org}/classes/${id}/roster`,
    },
    {
      id: "experience",
      label: "Student experience",
      path: `school/${org}/classes/${id}/experience`,
    },
    {
      id: "settings",
      label: "Settings",
      path: `school/${org}/classes/${id}/settings`,
    },
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
  /** What this class is called, once it has loaded. */
  className?: string;
  /** The screen's own data is still on its way. The frame waits with it and
   * arrives whole, so its breadcrumb and tabs never push anything down. */
  loading: boolean;
  tab: string;
  children: ReactNode;
}) {
  const session = useStaffSession();
  const school = useQuery(orgOptions(session, org));
  const classes = useQuery(classListOptions(session, org));
  if (loading || school.isPending || classes.isPending)
    return <LoadingScreen />;
  const name = className ?? "";
  return (
    <SchoolFrame
      title={name}
      sections={[
        {
          label: "Classes",
          items: (classes.data?.classes ?? []).map((item) => ({
            id: item.id,
            label: item.name,
            path: `school/${org}/classes/${item.id}/roster`,
          })),
        },
      ]}
      activeNav={classId}
      breadcrumb={
        school.data?.org && name
          ? [{ label: school.data.org.name }, { label: name }]
          : []
      }
      tabs={classTabs(org, classId)}
      activeTab={tab}
    >
      {children}
    </SchoolFrame>
  );
}
