import type { TabItem } from "../../ui/Tabs";

/**
 * Which part of the one app frame (`app/AppShell.tsx`) a signed-in screen
 * belongs to. Each group has one link in the drawer and one row of tabs; a
 * screen outside every group gets the bar with the logo alone. `null` means
 * the screen keeps a frame of its own (the pitch, sign-in, first-run steps,
 * the free trial's practice, joining a class, school screens).
 */
export type ProgressTab = "overview" | "pathways" | "inventory";
export type AccountTab = "security" | "learners" | "access" | "privacy";
export type ShellFrame =
  | { kind: "progress"; active: ProgressTab }
  | { kind: "account"; active: AccountTab }
  | { kind: "practice" }
  | { kind: "plain" };

const under = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`);

/** The frame for a signed-in screen at `pathname`, or null for its own. */
export function shellFrame(pathname: string): ShellFrame | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
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
  // "Continue with AMP" for one learner is a step of Billing.
  if (under(path, "/continue")) return { kind: "account", active: "access" };
  // "What brings you to AMP?" and each answer's question.
  if (
    path === "/start" ||
    /^\/start\/(myself|parent|tutor|teacher|school)$/.test(path)
  )
    return { kind: "plain" };
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
