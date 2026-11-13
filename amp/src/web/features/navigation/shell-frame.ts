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
  /** `practice`: a learning screen (lessons, books) whose bar keeps the
   * one way to practice, as the Progress tabs do. */
  | { kind: "plain"; practice?: true };

const under = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`);

/** The frame for a signed-in screen at `pathname`, or null for its own. */
export function shellFrame(
  pathname: string,
  /** The class a screen was opened from (`?class=`): a student's record
   * keeps that class's tabs, so opening a student never leaves the class. */
  fromClass?: string,
): ShellFrame | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const record = path.match(/^\/school\/([^/]+)\/students\/([^/]+)$/);
  if (record && fromClass)
    return {
      kind: "class",
      org: record[1]!,
      classId: fromClass,
      active: "map",
      board: false,
    };
  if (path === "/school/new") return null;
  if (["/school/invite", "/school/start", "/school/connect"].includes(path))
    return { kind: "plain" };
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
          import: "roster",
          // A class's own overrides of what students see.
          experience: "settings",
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
          // The drill from the overview's standing curves.
          standing: "overview",
          "sign-in-help": "staff",
          // One configuration home (docs/design/ia.md).
          calendar: "settings",
          license: "settings",
          privacy: "settings",
          experience: "settings",
          integrations: "settings",
          year: "settings",
        } as Record<string, string>
      )[leaf] ?? leaf;
    return { kind: "school", org: school[1]!, active };
  }
  if (path === "/school") return { kind: "plain" };
  // A learner's workbooks belong to their Overview, where Workbooks is a
  // quiet button (docs/design/ia.md): the Progress tabs stay, Overview marked.
  if (/^\/learners\/[^/]+\/workbooks(?:\/|$)/.test(path))
    return { kind: "progress", active: "overview" };
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
  // "Continue with AMP" for one learner is a step of whatever led there
  // (practice, Today, Billing), so it has the plain bar and its own way back.
  if (under(path, "/continue")) return { kind: "plain" };
  // "What brings you to AMP?", each answer's question, and the steps of a
  // parent's or a tutor's setup.
  if (
    path === "/start" ||
    /^\/start\/(myself|parent|tutor|teacher|school)$/.test(path) ||
    /^\/start\/(parent|tutor)\/[a-z-]+$/.test(path)
  )
    return { kind: "plain" };
  if (path === "/practice") return { kind: "practice" };
  // The immersive film route supplies its own return and playback controls.
  if (/^\/lessons\/[^/]+\/watch$/.test(path)) return null;
  if (under(path, "/lessons") || under(path, "/books"))
    return { kind: "plain", practice: true };
  if (path === "/" || path === "/progress") return { kind: "plain" };
  return null;
}

/** Whose progress the Progress tabs show: the adult's own learner, or the
 * chosen child. */
export type ProgressContext = "own" | "learner";

/** The Progress tabs, one URL each. Paths have no leading slash. My
 * practice (`own`, given the adult's learner) adds Workbooks
 * (docs/design/ia.md). */
export function progressTabs(
  context: ProgressContext,
  _ownLearner?: string | null,
): TabItem[] {
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
  { id: "security", label: "Sign-in", path: "family/security" },
  { id: "learners", label: "Learners", path: "family/learners" },
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
 * time. A family's or tutor's class keeps its calendar in Settings, and a
 * small one (six or fewer) has no Grades tab: each learner's grade is a line
 * on the Map, and report cards, export and the weekly target are in
 * Settings. */
export function classTabs(
  org: string,
  id: string,
  past = false,
  family = false,
  learners = Infinity,
): TabItem[] {
  const small = family && learners <= SMALL_CLASS;
  return [
    ["today", "Today"],
    ["map", "Map"],
    ["gradebook", "Grades"],
    ["time", "Time"],
    ["workbooks", "Workbooks"],
    ["roster", "Students"],
    ["settings", "Settings"],
  ]
    .filter(([leaf]) => !small || leaf !== "gradebook")
    .filter(([leaf]) => !past || leaf === "gradebook" || leaf === "time")
    .map(([leaf, label]) => ({
      id: leaf!,
      // A family org's roster holds children, a second parent and
      // co-teachers: People. A school's class lists Students.
      label: leaf === "roster" && family ? "People" : label!,
      path: `school/${org}/classes/${id}/${leaf}`,
    }));
}

/** Settings shows when any of its sections does. */
function settingsPermission(can: Set<string>) {
  return (
    [
      "calendar.read",
      "settings.read",
      "license.read",
      "privacy.read",
      "integrations.read",
    ].find((permission) => can.has(permission)) ?? "calendar.read"
  );
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
      ...(!family && !lone ? [["activity", "Activity", "activity.read"]] : []),
      // Year and terms, student experience, license, privacy, integrations.
      ...(!family ? [["settings", "Settings", settingsPermission(can)]] : []),
    ]
      .filter(([, , permission]) => can.has(permission as never))
      .map(([id, label]) => ({
        id: id!,
        label: label!,
        path: `school/${org.id}/${id}`,
      })),
  ];
}

/** What each frame tab is called, by id (a class's roster is People in a
 * family's class and Students in a school's). */
const TAB_NAMES: Record<string, readonly string[]> = {
  overview: ["Overview"],
  pathways: ["Pathways"],
  inventory: ["Inventory"],
  security: ["Sign-in"],
  learners: ["Learners"],
  access: ["Billing"],
  privacy: ["Privacy"],
  today: ["Today"],
  map: ["Map", "Class map"],
  time: ["Time"],
  workbooks: ["Workbooks"],
  roster: ["Students", "People"],
  settings: ["Settings"],
  classes: ["Classes"],
  staff: ["Staff"],
  activity: ["Activity"],
};

/** Whether the bar's open tab already says what this screen is called, so
 * the screen's own title would only repeat it (docs/design/ia.md). Read
 * from the address, as the bar's own frame is, so it holds at first paint. */
export function namedByTab(pathname: string, title: string) {
  const frame = shellFrame(pathname);
  if (!frame || !("active" in frame)) return false;
  const names = TAB_NAMES[frame.active] ?? [];
  const said = title.trim().toLowerCase();
  return names.some((name) => name.toLowerCase() === said);
}
