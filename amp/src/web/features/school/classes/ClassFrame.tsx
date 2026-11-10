import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Loading } from "../../../ui/Loading";
import { classesOptions, currentSession } from "../api";
import { OrgFrame } from "../OrgFrame";

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
  const classes = useQuery({
    ...classesOptions(currentSession(), org),
    refetchOnMount: false,
  });
  const name =
    className ??
    classes.data?.find((entry) => entry.id === classId)?.name ??
    "Class";
  return (
    <OrgFrame
      orgId={org}
      nav={`class:${classId}`}
      title={name}
      crumbs={[{ label: name }]}
    >
      {loading ? <Loading /> : children}
    </OrgFrame>
  );
}
