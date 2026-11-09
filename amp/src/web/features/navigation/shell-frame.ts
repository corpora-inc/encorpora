import type { OrgResource } from "../../../schools/contracts";
import type { TabItem } from "../../ui/Tabs";

/**
 * Which part of the one app frame (`app/AppShell.tsx`) a signed-in screen
 * belongs to. Each group has one link in the drawer and one row of tabs; a
 * screen outside every group gets the bar with the logo alone. `null` means
 * the screen keeps a frame of its own (the pitch, sign-in, first-run steps,
 * the free trial's practice, joining a class, school setup).
 */
export type ProgressTab = "overview" | "pathways" | "inventory";
export type AccountTab = "security" | "learners" | "access" | "privacy";
export type ShellFrame =
  | { kind: "progress"; active: ProgressTab }
  | { kind: "account"; active: AccountTab }
  | {
      kind: "class";
      org: string;
      classId: string;
      active: string;
      board: boolean;
    }
  | { kind: "school"; org: string; active: string }
  | { kind: "practice" }
  | { kind: "plain" };

const under = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`);

/** The frame for a signed-in screen at `pathname`, or null for its own. */
export function shellFrame(pathname: string): ShellFrame | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "/school/new") return null;
  if (path === "/school/invite") return { kind: "plain" };
  const klass = path.match(
    /^\/school\/([^/]+)\/classes\/([^/]+)(?:\/([^/]+))?/,
  );
  if (klass) {
    const leaf = klass[3] ?? "today";
    const active =
      (
        {
          start: "today",
          "report-cards": "gradebook",
          cards: "roster",
          experience: "roster",
        } as Record<string, string>
      )[leaf] ?? leaf;
    return {
      kind: "class",
      org: klass[1]!,
      classId: klass[2]!,
      active,
      board: leaf === "start",
    };
  }
  const school = path.match(/^\/school\/([^/]+)(?:\/([^/]+))?/);
  if (school) {
    const leaf = school[2] ?? "overview";
    const active =
      (
        {
          students: "classes",
          import: "classes",
          experience: "classes",
          "sign-in-help": "staff",
          integrations: "staff",
          year: "calendar",
        } as Record<string, string>
      )[leaf] ?? leaf;
    return { kind: "school", org: school[1]!, active };
  }
  // Workbook URLs identify their learner independently of Progress selection.
  if (path === "/school" || /^\/learners\/[^/]+\/workbooks(?:\/|$)/.test(path))
    return { kind: "plain" };
  if (path === "/overview" || path === "/me" || path === "/try/map")
    return { kind: "progress", active: "overview" };
  // Changing the birth year belongs to the Overview it is opened from.
  if (path === "/profile/birth-year")
    return { kind: "progress", active: "overview" };
  if (under(path, "/pathways")) return { kind: "progress", active: "pathways" };
  if (path === "/inventory") return { kind: "progress", active: "inventory" };
  // A family's approvals and a school's link are screens of their own.
  if (under(path, "/family/approve") || under(path, "/family/approvals"))
    return null;
  if (under(path, "/family/security"))
    return { kind: "account", active: "security" };
  if (under(path, "/family/access"))
    return { kind: "account", active: "access" };
  if (under(path, "/family/privacy"))
    return { kind: "account", active: "privacy" };
  if (under(path, "/family")) return { kind: "account", active: "learners" };
  // Buying and the parent notice are steps of Billing and Privacy. The
  // funded-program entries (`/purchase/arizona-esa`, …) have their own frame.
  if (
    path === "/purchase" ||
    path === "/purchase/choose" ||
    path === "/purchase/annual" ||
    path === "/purchase/funded"
  )
    return { kind: "account", active: "access" };
  if (path === "/consent") return { kind: "account", active: "privacy" };
  if (path === "/practice") return { kind: "practice" };
  if (
    path === "/" ||
    path === "/progress" ||
    under(path, "/lessons") ||
    under(path, "/books")
  )
    return { kind: "plain" };
  return null;
}

/** Whose progress the Progress tabs show: the free assessment, the adult's
 * own learner, or the chosen child. */
export type ProgressContext = "trial" | "own" | "learner";

/** The Progress tabs, one URL each. Paths have no leading slash. */
export function progressTabs(context: ProgressContext): TabItem[] {
  const search = context === "trial" ? { context: "trial" } : undefined;
  return [
    {
      id: "overview",
      label: "Overview",
      path:
        context === "trial" ? "try/map" : context === "own" ? "me" : "overview",
    },
    { id: "pathways", label: "Pathways", path: "pathways", search },
    { id: "inventory", label: "Inventory", path: "inventory", search },
  ];
}

/** Account and family settings: one group of four tabs. */
export const accountTabs: readonly TabItem[] = [
  { id: "security", label: "Profile & sign-in", path: "family/security" },
  { id: "learners", label: "Family", path: "family/learners" },
  { id: "access", label: "Billing", path: "family/access" },
  { id: "privacy", label: "Privacy", path: "family/privacy" },
];

/** Where the Progress group opens for each context. */
export function overviewPath(context: ProgressContext) {
  return `/${progressTabs(context)[0]!.path}`;
}

/** Class sub-screens keep their parent tab selected. Past years retain grades and time. */
export function classTabs(
  org: string,
  id: string,
  past = false,
  familyCalendar = false,
): TabItem[] {
  const tabs = [
    ["today", "Today"],
    ["map", "Map"],
    ["gradebook", "Grades"],
    ["time", "Time"],
    ["workbooks", "Workbooks"],
    ["roster", "Students"],
    ["settings", "Settings"],
  ]
    .filter(([leaf]) => !past || leaf === "gradebook" || leaf === "time")
    .map(([leaf, label]) => ({
      id: leaf!,
      label: label!,
      path: `school/${org}/classes/${id}/${leaf}`,
    }));
  if (familyCalendar && !past)
    tabs.push({
      id: "calendar",
      label: "Calendar",
      path: `school/${org}/calendar`,
    });
  return tabs;
}

/** The school's navigation follows exactly the capabilities supplied by its API. */
export function schoolTabs(org: OrgResource, classCount: number): TabItem[] {
  const can = new Set(org.can ?? []);
  const family = org.kind === "family";
  const lone = org.solo === true && classCount <= 1;
  return [
    ...(!family && !lone && can.has("overview.read")
      ? [{ id: "overview", label: "Overview", path: `school/${org.id}` }]
      : []),
    ...((org.kind === "district" || org.kind === "network") &&
    can.has("overview.read")
      ? [{ id: "schools", label: "Schools", path: `school/${org.id}/schools` }]
      : []),
    ...[
      ["classes", "Classes", "classes.read"],
      ...(!family && !lone ? [["staff", "Staff", "staff.read"]] : []),
      ["calendar", "Calendar", "calendar.read"],
      ...(!family
        ? [
            ["license", "License", "license.read"],
            ["privacy", "Privacy", "privacy.read"],
            ...(!lone ? [["activity", "Activity", "activity.read"]] : []),
          ]
        : []),
    ]
      .filter(([, , permission]) => can.has(permission as never))
      .map(([id, label]) => ({
        id: id!,
        label: label!,
        path: `school/${org.id}/${id}`,
      })),
  ];
}
