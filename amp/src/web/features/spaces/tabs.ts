import type { OrgResource } from "../../../schools/contracts";
import type { TabItem } from "../../ui/Tabs";

/**
 * Each space's tabs, one URL each (docs/architecture/spaces.md, "Shell").
 * A phone shows the ones marked `phone` and puts the rest under More; a wider
 * screen shows every tab inline, in the same order. Paths have no leading
 * slash.
 */
const tab = (
  id: string,
  label: string,
  path: string,
  phone = false,
): TabItem => ({ id, label, path, ...(phone ? { phone: true } : {}) });

/** A class this size or smaller, in a family, has no Grades tab: each
 * child's grade is a line on the Map, and report cards are their own tab. */
export const SMALL_CLASS = 6;

/** A family's class: its children's day-to-day on a phone, the rest under
 * More. A past year keeps its records: report cards and time. */
export function familyTabs(
  org: string,
  classId: string,
  { past = false, learners = 0 }: { past?: boolean; learners?: number } = {},
): TabItem[] {
  const at = (leaf: string) => `school/${org}/classes/${classId}/${leaf}`;
  const items = [
    tab("today", "Today", at("today"), true),
    tab("map", "Map", at("map"), true),
    tab("workbooks", "Workbooks", at("workbooks"), true),
    tab("time", "Time", at("time"), true),
    tab("report-cards", "Report cards", at("report-cards")),
    // A tutor's larger group keeps the gradebook it uses.
    ...(learners > SMALL_CLASS
      ? [tab("gradebook", "Grades", at("gradebook"))]
      : []),
    tab("roster", "People", at("roster")),
    tab("settings", "Settings", at("settings")),
  ];
  return past
    ? items.filter((item) =>
        ["report-cards", "gradebook", "time"].includes(item.id),
      )
    : items;
}

/** A family's own screens (`/family/<family>/…`): its children's
 * day-to-day on a phone, their records, its people and its settings under
 * More. Workbooks show where this reader may make them. */
export function familyPlaceTabs(
  family: string,
  { workbooks = true }: { workbooks?: boolean } = {},
): TabItem[] {
  const at = (leaf: string) =>
    leaf ? `family/${family}/${leaf}` : `family/${family}`;
  return [
    tab("today", "Today", at(""), true),
    tab("map", "Map", at("map"), true),
    ...(workbooks ? [tab("workbooks", "Workbooks", at("workbooks"), true)] : []),
    tab("time", "Time", at("time"), true),
    tab("reports", "Report cards", at("reports")),
    tab("people", "People", at("people")),
    tab("settings", "Settings", at("settings")),
  ];
}

/** A school's class: a teacher's day-to-day on a phone. A past year keeps
 * its grades and time. */
export function classroomTabs(
  org: string,
  classId: string,
  { past = false }: { past?: boolean } = {},
): TabItem[] {
  const at = (leaf: string) => `school/${org}/classes/${classId}/${leaf}`;
  const items = [
    tab("today", "Today", at("today"), true),
    tab("map", "Map", at("map"), true),
    tab("gradebook", "Grades", at("gradebook"), true),
    tab("roster", "Students", at("roster"), true),
    tab("time", "Time", at("time")),
    tab("workbooks", "Workbooks", at("workbooks")),
    tab("settings", "Settings", at("settings")),
  ];
  return past
    ? items.filter((item) => item.id === "gradebook" || item.id === "time")
    : items;
}

/** A school, network or district: exactly what its API says this person may
 * read. A one-class school is that class, without the admin weight. */
export function schoolTabs(
  org: Pick<OrgResource, "id" | "kind" | "can">,
  { lone = false }: { lone?: boolean } = {},
): TabItem[] {
  const can = new Set<string>(org.can ?? []);
  const at = (leaf: string) =>
    leaf === "overview" ? `school/${org.id}` : `school/${org.id}/${leaf}`;
  const district = org.kind === "district" || org.kind === "network";
  return (
    [
      ["overview", "Overview", "overview.read", true, !lone],
      ["schools", "Schools", "overview.read", false, district && !lone],
      ["classes", "Classes", "classes.read", true, true],
      ["staff", "Staff", "staff.read", true, !lone],
      ["license", "License", "license.read", true, true],
      ["calendar", "Calendar", "calendar.read", false, true],
      ["privacy", "Privacy", "privacy.read", false, true],
      ["activity", "Activity", "activity.read", false, !lone],
      ["settings", "Settings", "settings.read", false, true],
      ["integrations", "Integrations", "integrations.read", false, true],
    ] as const
  )
    .filter(([, , permission, , shown]) => shown && can.has(permission))
    .map(([id, label, , phone]) => tab(id, label, at(id), phone));
}

/** A learner's record: their level, the map of what they know, and the
 * inventory of their work. */
export function learnerTabs(): TabItem[] {
  return [
    tab("overview", "Overview", "overview"),
    tab("pathways", "Pathways", "pathways"),
    tab("inventory", "Inventory", "inventory"),
  ];
}

/** An adult's own practice: practice, where they are, and their workbooks on
 * a phone; their map, inventory and practice profiles under More. Their own
 * learner's screens need that learner. */
export function meTabs(ownLearner: string | null): TabItem[] {
  // Their own learner, in the address of every shared learning screen.
  const own = ownLearner ? { search: { learner: ownLearner } } : {};
  return [
    ...(ownLearner
      ? [
          { ...tab("practice", "Practice", "practice", true), ...own },
          tab("levels", "Levels", "me", true),
          tab(
            "workbooks",
            "Workbooks",
            `learners/${ownLearner}/workbooks`,
            true,
          ),
        ]
      : []),
    { ...tab("pathways", "Pathways", "pathways"), ...own },
    { ...tab("inventory", "Inventory", "inventory"), ...own },
    tab("profiles", "Profiles", "me/profiles"),
  ];
}

/** Where the account opens: its sign-in and security. */
export const ACCOUNT_HOME = "account/security";

/** The account: sign-in, learners, billing and privacy. The account's own
 * settings have neutral addresses (`/account/…`); the old `/family/…` ones
 * still open the same screens. */
export const accountTabs: readonly TabItem[] = [
  tab("security", "Sign-in", "account/security"),
  tab("learners", "Learners", "family/learners"),
  tab("access", "Billing", "account/billing"),
  tab("privacy", "Privacy", "account/privacy"),
];
