import type { ReactNode } from "react";
import { practiceFixtures, type PracticeFixtureId } from "./fixtures";
import { ControlSections } from "./sections/controls";
import { LevelSections } from "./sections/levels";
import { NavigationSections } from "./sections/navigation";
import { OverlaySections, overlaySpecimens } from "./sections/overlays";
import { PatternSections } from "./sections/patterns";
import { PracticeSection, PracticeSpecimen } from "./sections/practice";
import { StateSections, stateSpecimens } from "./sections/states";
import { TableSections } from "./sections/tables";
import { WorkbookSections } from "./sections/workbooks";

/** The gallery's table of contents: each group, its sections' anchors and
 * names, in page order. Tests and the inventory (docs/components.md) use
 * the same ids. */
export const contents: {
  group: string;
  sections: { id: string; title: string }[];
}[] = [
  {
    group: "Practice",
    sections: [{ id: "practice", title: "Problem stage and feedback" }],
  },
  {
    group: "Levels",
    sections: [
      { id: "level-track", title: "Level track" },
      { id: "level-band", title: "Level band" },
      { id: "level-trend", title: "Level trend" },
      { id: "level-readout", title: "Level readout" },
      { id: "record-levels", title: "Record parts" },
      { id: "frontier-map", title: "Frontier map" },
    ],
  },
  {
    group: "Rows and tables",
    sections: [
      { id: "class-map", title: "Class map" },
      { id: "data-grid", title: "Data grid" },
      { id: "work-list", title: "Work list" },
      { id: "avatar", title: "Avatar" },
    ],
  },
  {
    group: "Controls",
    sections: [
      { id: "buttons", title: "Buttons" },
      { id: "segmented", title: "Segmented" },
      { id: "stepper", title: "Stepper" },
      { id: "choices", title: "Chips, lists, pickers" },
      { id: "fields", title: "Text fields" },
    ],
  },
  {
    group: "Status",
    sections: [
      { id: "empty-state", title: "Empty state" },
      { id: "loading", title: "Loading" },
      { id: "toast", title: "Toast" },
      { id: "badge", title: "Badge" },
      { id: "meter", title: "Meter and stats" },
    ],
  },
  {
    group: "Workbooks",
    sections: [
      { id: "workbook-card", title: "Workbook card" },
      { id: "workbook-list", title: "Past workbooks" },
    ],
  },
  {
    group: "Frame",
    sections: [
      { id: "overlays", title: "Sheets and dialogs" },
      { id: "navigation", title: "Logo, tabs, codes" },
      { id: "page-parts", title: "Page heads and notes" },
    ],
  },
  {
    group: "Flows",
    sections: [
      { id: "grade-pickers", title: "Grade pickers" },
      { id: "plan-choice", title: "Plan choice" },
      { id: "sign-in-parts", title: "Sign-in parts" },
      { id: "charts", title: "School charts" },
    ],
  },
];

export function GallerySections() {
  return (
    <>
      <PracticeSection />
      <LevelSections />
      <TableSections />
      <ControlSections />
      <StateSections />
      <WorkbookSections />
      <OverlaySections />
      <NavigationSections />
      <PatternSections />
    </>
  );
}

/** Components shown alone, each filling its own document. */
export const specimens: Record<string, () => ReactNode> = {
  ...Object.fromEntries(
    (Object.keys(practiceFixtures) as PracticeFixtureId[]).map((id) => [
      `practice-${id}`,
      () => <PracticeSpecimen id={id} />,
    ]),
  ),
  ...stateSpecimens,
  ...overlaySpecimens,
};
