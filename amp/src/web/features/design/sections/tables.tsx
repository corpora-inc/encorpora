import { useState } from "react";
import { Avatar, AvatarStack } from "../../../ui/Avatar";
import { DataGrid, type DataGridColumn } from "../../../ui/DataGrid";
import { Meter } from "../../../ui/Meter";
import { ClassMap, MapKey } from "../../school/classes/ClassMap";
import { shortDay, WorkList } from "../../school/classes/teacher-shared";
import { classMap, names, record, roster, type RosterRow } from "../fixtures";
import { Section, Specimen } from "../Gallery";
import styles from "../Design.module.css";

const columns: DataGridColumn<RosterRow>[] = [
  {
    id: "name",
    header: "Student",
    width: 180,
    compare: (a, b) => a.name.localeCompare(b.name, "en"),
    cell: (row) => (
      <span className={styles.person}>
        <Avatar name={row.name} size="small" />
        <span>{row.name}</span>
      </span>
    ),
    cellLabel: (row) => row.name,
  },
  {
    id: "level",
    header: "Level",
    headerDetail: "grade",
    width: 80,
    align: "end",
    firstSort: "descending",
    compare: (a, b) => (a.level ?? -1) - (b.level ?? -1),
    cell: (row) => (row.level === null ? "—" : row.level.toFixed(1)),
  },
  {
    id: "minutes",
    header: "Minutes",
    width: 120,
    firstSort: "descending",
    compare: (a, b) => a.minutes - b.minutes,
    cell: (row) => (
      <Meter value={row.minutes} max={1204} label="Active minutes" />
    ),
  },
  {
    id: "accuracy",
    header: "Correct",
    headerDetail: "% without help",
    width: 120,
    firstSort: "descending",
    compare: (a, b) => a.accuracy - b.accuracy,
    cell: (row) => <Meter value={row.accuracy} label="Percent correct" />,
  },
  {
    id: "seen",
    header: "Last seen",
    width: 110,
    compare: (a, b) => (a.lastSeen ?? "").localeCompare(b.lastSeen ?? ""),
    cell: (row) => (row.lastSeen ? shortDay(row.lastSeen) : "Not yet"),
  },
];

function Roster({ rows }: { rows: RosterRow[] }) {
  const [sort, setSort] = useState<{
    column: string;
    direction: "ascending" | "descending";
  }>({ column: "name", direction: "ascending" });
  return (
    <DataGrid
      label="Students"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      sort={sort}
      onSortChange={setSort}
    />
  );
}

export function TableSections() {
  return (
    <>
      <Section
        id="class-map"
        title="Class map (learner rows)"
        source={[
          "features/school/classes/ClassMap.tsx",
          "features/school/classes/Teacher.module.css",
        ]}
        note="Sort and the phone's strand lens live in the address (useClassSearch), so sorting here changes this page's URL. Names link to records that need a school sign-in."
      >
        <Specimen label="A class against its course" wide>
          <div data-dense>
            <MapKey data={classMap} />
            <ClassMap data={classMap} />
          </div>
        </Specimen>
        <Specimen label="Today's glance: two strands" wide>
          <div data-dense>
            <ClassMap data={classMap} limitStrands={2} />
          </div>
        </Specimen>
      </Section>
      <Section
        id="data-grid"
        title="Data grid and sortable headers"
        source={["ui/DataGrid.tsx", "ui/DataGrid.module.css"]}
        note="Below 640 px each row becomes a card with a sort control above."
      >
        <Specimen label="Sortable columns, meters, a long name" wide>
          <div data-dense>
            <Roster rows={roster} />
          </div>
        </Specimen>
        <Specimen label="One row" wide>
          <div data-dense>
            <Roster rows={roster.slice(0, 1)} />
          </div>
        </Specimen>
        <Specimen label="No rows" wide>
          <div data-dense>
            <Roster rows={[]} />
          </div>
        </Specimen>
      </Section>
      <Section
        id="work-list"
        title="Work list"
        source={["features/school/classes/teacher-shared.tsx"]}
      >
        <Specimen label="Independent, with a hint, missed, on paper" wide>
          <div data-dense>
            <WorkList work={record.work} />
          </div>
        </Specimen>
      </Section>
      <Section
        id="avatar"
        title="Avatar"
        source={["ui/Avatar.tsx", "ui/Avatar.module.css"]}
      >
        {(["small", "regular", "large"] as const).map((size) => (
          <Specimen key={size} label={size[0]!.toUpperCase() + size.slice(1)}>
            <div className={styles.inline}>
              {Object.values(names).map((name) => (
                <Avatar key={name} name={name} size={size} />
              ))}
            </div>
          </Specimen>
        ))}
        <Specimen label="Stack">
          <AvatarStack
            names={roster.slice(0, 5).map((row) => row.name)}
            label="Five students"
          />
        </Specimen>
        <Specimen label="Beside a long name">
          <span className={styles.person}>
            <Avatar name={names.long} size="large" />
            <strong>{names.long}</strong>
          </span>
        </Specimen>
      </Section>
    </>
  );
}
