/**
 * Where a signed-in screen sits in the one app frame (`app/AppShell.tsx`),
 * read from its address alone: which row of tabs it belongs to and which tab
 * is open, practice's bar, or the bar with the logo alone. `null` means the
 * screen keeps a frame of its own (the pitch, sign-in, first-run steps,
 * joining a class, school setup). Which tabs the row holds, and in whose
 * words, is the space's (features/spaces/resolve.ts): this only places the
 * screen.
 */
export type ProgressTab = "overview" | "pathways" | "inventory" | "profiles";
export type AccountTab = "security" | "learners" | "access" | "privacy";
export type ShellFrame =
  | { kind: "progress"; active: ProgressTab }
  | { kind: "account"; active: AccountTab }
  | {
      kind: "class";
      org: string;
      classId: string;
      active: string;
      /** The class screen itself (`report-cards` under Grades, say). */
      leaf: string;
      board: boolean;
    }
  | { kind: "school"; org: string; active: string }
  /** A family's own screens, `/family/<family>/…`: the family is its id. */
  | {
      kind: "family";
      family: string;
      active: string;
      /** The rest of the address (`map`, `kids/<learner>`, `reports/grades`). */
      leaf: string;
    }
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
      leaf: "map",
      board: false,
    };
  if (path === "/school/new") return null;
  if (
    [
      "/school/invite",
      "/school/start",
      "/school/connect",
      "/school/adopt",
    ].includes(path)
  )
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
      leaf,
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
          // The year's rollover and what students see are Settings'.
          experience: "settings",
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
  // Practicing as someone else: the profiles are a tab of their own; a new
  // profile and a profile's levels are steps with their own way back.
  if (path === "/me/profiles") return { kind: "progress", active: "profiles" };
  // Practice at a level: one step, then practice; its way back is the bar's.
  if (path === "/me/level") return { kind: "plain" };
  if (under(path, "/me/profiles")) return { kind: "plain" };
  if (path === "/overview" || path === "/me")
    return { kind: "progress", active: "overview" };
  // Changing the birth year belongs to the Overview it is opened from.
  if (path === "/profile/birth-year")
    return { kind: "progress", active: "overview" };
  if (under(path, "/pathways")) return { kind: "progress", active: "pathways" };
  if (path === "/inventory") return { kind: "progress", active: "inventory" };
  // A family's own screens: Today at its root, a child's page, and its tabs.
  const family = path.match(
    /^\/family\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/(.*))?$/i,
  );
  if (family) {
    const leaf = family[2] ?? "";
    const first = leaf.split("/")[0] ?? "";
    const active =
      (
        {
          "": "today",
          // A child's page is reached from Today, where each child is a row.
          kids: "today",
          cards: "people",
          reports: "reports",
        } as Record<string, string>
      )[first] ?? first;
    return { kind: "family", family: family[1]!.toLowerCase(), active, leaf };
  }
  // The landing alias, while it decides which family to open.
  if (path === "/family") return { kind: "plain" };
  // A family's approvals and a school's link are screens of their own.
  if (under(path, "/family/approve") || under(path, "/family/approvals"))
    return null;
  // The account's own settings, at their own addresses and their older ones.
  if (under(path, "/account/security"))
    return { kind: "account", active: "security" };
  if (under(path, "/account/billing"))
    return { kind: "account", active: "access" };
  if (under(path, "/account/privacy"))
    return { kind: "account", active: "privacy" };
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

/** A family's class of this size or smaller has no Grades tab. */
export { SMALL_CLASS } from "../spaces/tabs";

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
  schools: ["Schools"],
  license: ["License"],
  calendar: ["Calendar"],
  integrations: ["Integrations"],
  "report-cards": ["Report cards"],
  reports: ["Report cards"],
  people: ["People"],
  levels: ["Levels"],
  profiles: ["Profiles"],
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
