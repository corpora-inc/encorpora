import type { OrgResource } from "../../../schools/contracts";
import type { TabItem } from "../../ui/Tabs";

/**
 * Which part of the one app frame (`app/AppShell.tsx`) a signed-in screen
 * belongs to. Each group has one link in the drawer and one row of tabs; a
 * screen outside every group gets the bar with the logo alone. `null` means
 * the screen keeps a frame of its own (the pitch, sign-in, first-run steps,
 * joining a class, school setup).
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
  // Practicing as someone else: "Try a level…" and a profile's levels.
  if (under(path, "/me/profiles")) return { kind: "plain" };
  if (path === "/overview" || path === "/me")
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
  // "Continue with AMP" for one learner is a step of Billing.
  if (under(path, "/continue")) return { kind: "account", active: "access" };
  // "What brings you to AMP?" and each answer's question.
  if (
    path === "/start" ||
    /^\/start\/(myself|parent|tutor|teacher|school)$/.test(path)
  )
    return { kind: "plain" };
  if (path === "/practice") return { kind: "practice" };
  // The immersive film route supplies its own return and playback controls.
  if (/^\/lessons\/[^/]+\/watch$/.test(path)) return null;
  if (
    path === "/" ||
    path === "/progress" ||
    under(path, "/lessons") ||
    under(path, "/books")
  )
    return { kind: "plain" };
  return null;
}

/** Whose progress the Progress tabs show: the adult's own learner, or the
 * chosen child. */
export type ProgressContext = "own" | "learner";

/** The Progress tabs, one URL each. Paths have no leading slash. */
export function progressTabs(context: ProgressContext): TabItem[] {
  return [
    {
      id: "overview",
      label: "Overview",
      path: context === "own" ? "me" : "overview",
    },
    { id: "pathways", label: "Pathways", path: "pathways" },
    { id: "inventory", label: "Inventory", path: "inventory" },
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

/** A class this size or smaller, in a family's org (a family or a tutor),
 * has no Grades tab: each learner's grade is a line on the Map, and report
 * cards and exports are in Settings. */
export const SMALL_CLASS = 6;

/** The one place a class's tabs are decided (docs/design/ia.md). Class
 * sub-screens keep their parent tab selected; past years retain grades and
 * time. A family's class puts Workbooks after Map, calls its people People
 * and keeps its calendar in Settings; a small one also drops Grades. */
export function classTabs(
  org: string,
  id: string,
  past = false,
  family = false,
  learners = Infinity,
): TabItem[] {
  const small = family && learners <= SMALL_CLASS;
  const tabs = family
    ? [
        ["today", "Today"],
        ["map", "Map"],
        ["workbooks", "Workbooks"],
        ["gradebook", "Grades"],
        ["time", "Time"],
        ["roster", "People"],
        ["settings", "Settings"],
      ]
    : [
        ["today", "Today"],
        ["map", "Map"],
        ["gradebook", "Grades"],
        ["time", "Time"],
        ["workbooks", "Workbooks"],
        ["roster", "Students"],
        ["settings", "Settings"],
      ];
  return tabs
    .filter(([leaf]) => !small || leaf !== "gradebook")
    .filter(([leaf]) => !past || leaf === "gradebook" || leaf === "time")
    .map(([leaf, label]) => ({
      id: leaf!,
      label: label!,
      path: `school/${org}/classes/${id}/${leaf}`,
    }));
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
