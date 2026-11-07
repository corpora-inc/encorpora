import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Avatar } from "../../../ui/Avatar";
import { Menu, MenuItem, MenuLabel } from "../../../ui/Menu";
import { SchoolFrame, type SchoolNavSection } from "../SchoolFrame";
import { classInfo, school, teacher } from "./fixture";
import { usePreviewSearch } from "./search";

const base = "school/preview";
export const classTabs = [
  { id: "today", label: "Today", path: `${base}/today` },
  { id: "map", label: "Class map", path: `${base}/map` },
  { id: "gradebook", label: "Gradebook", path: `${base}/gradebook` },
  { id: "time", label: "Time", path: `${base}/time` },
  { id: "workbooks", label: "Workbooks", path: `${base}/workbooks` },
  { id: "roster", label: "Roster", path: `${base}/roster` },
];
const sections: SchoolNavSection[] = [
  {
    label: "Classes",
    items: [
      { id: "class", label: classInfo.name, path: `${base}/today` },
      { id: "support", label: "Math Support", path: `${base}/math-support` },
      { id: "club", label: "Math Club", path: `${base}/math-club` },
    ],
  },
  {
    label: "School",
    items: [
      { id: "overview", label: "Overview", path: `${base}/overview` },
      { id: "students", label: "Students", path: `${base}/students` },
      { id: "staff", label: "Staff", path: `${base}/staff` },
      { id: "calendar", label: "Calendar", path: `${base}/calendar` },
    ],
  },
];

function OrgSwitcher() {
  const navigate = useNavigate();
  return (
    <Menu align="start" label={school.name}>
      <MenuLabel>Your schools</MenuLabel>
      <MenuItem
        onSelect={() =>
          void navigate({ to: "/$", params: { _splat: `${base}/overview` } })
        }
      >
        {school.name}
      </MenuItem>
    </Menu>
  );
}

/** The frame as a real staff member would see it, on the preview's fixtures. */
export function PreviewFrame({
  tab,
  nav = "class",
  title = classInfo.name,
  children,
}: {
  tab?: string;
  nav?: string;
  title?: string;
  children: ReactNode;
}) {
  const [{ lone }] = usePreviewSearch();
  const carry = lone ? { lone: 1 } : undefined;
  return (
    <SchoolFrame
      title={title}
      lone={lone}
      orgSwitcher={<OrgSwitcher />}
      sections={sections}
      activeNav={nav}
      breadcrumb={[
        { label: school.name, path: `${base}/overview` },
        { label: title },
      ]}
      tabs={classTabs.map((item) => ({ ...item, search: carry }))}
      activeTab={tab}
      account={
        <>
          <Avatar name={teacher.name} size="small" />
          <span>{teacher.greeting}</span>
        </>
      }
    >
      {children}
    </SchoolFrame>
  );
}
