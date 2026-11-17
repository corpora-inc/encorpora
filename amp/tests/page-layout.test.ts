/**
 * Page layout guardrails (ui/Page.tsx; docs/design/ia.md, Layout). A screen's
 * width, gutters and top come from Page and ui/tokens.css only, so pages
 * can't drift back into one width each:
 *
 * 1. No stylesheet outside ui/ sets a px width over 400 px (width, max-width,
 *    min-width, their logical forms, flex-basis, or a custom property named
 *    for a width or column), in or out of min()/calc(). Media and container
 *    query conditions are not declarations and never count. The lists below
 *    name every exception with its reason; an entry that no longer matches
 *    fails too, so they only shrink.
 * 2. Every route's screen renders Page, through Page itself or a frame that
 *    does (PageFrame, FamilyFrame, StepFrame), or is listed with its reason.
 *
 * Phase 2 of the layout system (round 2026-11-16) moves the screens listed
 * under PHASE_2 onto Page and deletes their entries.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const WEB = fileURLToPath(new URL("../src/web/", import.meta.url));
const LIMIT = 400;

type Allowed = Record<string, { widths: number[]; why: string }>;

/** Real components, not page containers: sheets, dialogs, popovers, a
 * reading measure or a form's field column inside a page. */
const COMPONENTS: Allowed = {
  "account-security.css": { widths: [420], why: "the sign-in form's fields" },
  "app-shell.css": { widths: [520], why: "the account error toast" },
  "features/account/AccountPages.module.css": {
    widths: [420],
    why: "the rename and add-a-child forms' fields",
  },
  "features/account/DeleteAccount.module.css": {
    widths: [420],
    why: "the typed confirmation's field column",
  },
  "features/family-class/AddChildSheet.module.css": {
    widths: [480],
    why: "a sheet (the fallback of --width-form)",
  },
  "features/films/film-route.css": {
    widths: [480],
    why: "the film player's caption measure",
  },
  "features/onboarding/setup/Setup.module.css": {
    widths: [420],
    why: "a setup step's form fields",
  },
  "features/pitch/Pitch.module.css": {
    widths: [1180, 1400],
    why: "the signed-out pitch: a marketing page with its own art direction",
  },
  "features/schools/PublicFrame.module.css": {
    widths: [1240],
    why: "the signed-out schools site's own frame",
  },
  "features/school/classes/WorkReplay.module.css": {
    widths: [760],
    why: "the full-screen answer replay's column",
  },
  "features/school/join/JoinWays.module.css": {
    widths: [420],
    why: "the join code's field",
  },
  "feedback-sheet.css": { widths: [620, 680], why: "the feedback sheet" },
  "premium-controls.css": { widths: [420], why: "a popover of options" },
  "problem-flag.css": { widths: [480], why: "the report-a-problem dialog" },
  "shape-composer.css": {
    widths: [1000],
    why: "a figure's aspect, from its height",
  },
  "structured-work.css": {
    widths: [480, 560],
    why: "the work menu and keypad over practice",
  },
  "trend-line-fit.css": { widths: [520], why: "a practice figure" },
  "work-diagram.css": { widths: [520], why: "a practice figure" },
};

/** Screens not on Page yet: phase 2 moves them and deletes their lines. */
const PHASE_2: Allowed = {
  "book-reader.css": { widths: [720, 760, 800], why: "the book reader" },
  "family-center.css": {
    widths: [560, 620, 720],
    why: "the legacy family centre (native) and its dialog",
  },
  "features/account/AccountPages.module.css": {
    widths: [720],
    why: "account pages outside the family path (learners)",
  },
  "features/design/Design.module.css": {
    widths: [720, 1280],
    why: "the /design gallery",
  },
  "features/inventory/Inventory.module.css": {
    widths: [420, 560],
    why: "Inventory's day-0 hero",
  },
  "features/me/Own.module.css": { widths: [760], why: "an adult's /me" },
  "features/pathways/pathways.css": {
    widths: [660],
    why: "Pathways' panels",
  },
  "features/profiles/LevelScreen.module.css": {
    widths: [560],
    why: "Try a level",
  },
  "features/profiles/Profiles.module.css": {
    widths: [480, 560, 720, 960],
    why: "practice profiles",
  },
  "features/school/Import.module.css": {
    widths: [420, 880],
    why: "a school's import",
  },
  "features/school/School.module.css": {
    widths: [480, 520, 640, 720, 880],
    why: "school screens",
  },
  "features/school/SchoolFrame.module.css": {
    widths: [880],
    why: "the school frame's narrow content",
  },
  "features/school/Setup.module.css": {
    widths: [480, 600],
    why: "school setup",
  },
  "features/school/classes/Cards.module.css": {
    widths: [560],
    why: "sign-in cards",
  },
  "features/school/classes/ReportCard.module.css": {
    widths: [720],
    why: "report cards",
  },
  "features/school/classroom/Experience.module.css": {
    widths: [960],
    why: "a class's student experience",
  },
  "features/school/classroom/Stack.module.css": {
    widths: [640],
    why: "the workbook stack",
  },
  "features/school/classroom/Standings.module.css": {
    widths: [720],
    why: "standings",
  },
  "features/school/join/Join.module.css": {
    widths: [420, 480, 620, 1080, 1320],
    why: "joining a class and a student's sign-in",
  },
  "features/school/org/Org.module.css": {
    widths: [420, 720, 760],
    why: "school and district screens",
  },
  "features/schools/Parent.module.css": {
    widths: [720],
    why: "a parent's progress link",
  },
  "funding-purchase.css": {
    widths: [900],
    why: "the native app's legacy education-funds centre",
  },
  "native-session.css": { widths: [640], why: "the native session screen" },
  "payment-history.css": {
    widths: [760],
    why: "the native app's payment records",
  },
  "practice-tablet.css": { widths: [680], why: "practice on a tablet" },
  "practice.css": {
    widths: [440, 450, 520, 620, 640, 680, 760, 820, 1240],
    why: "practice and its legacy screens",
  },
  "progress-workspace.css": {
    widths: [680, 700],
    why: "the legacy progress workspace",
  },
  "style.css": {
    widths: [430, 440, 480, 520, 560, 720, 1240],
    why: "legacy global shell rules",
  },
  "theme.css": {
    widths: [420, 460, 640, 720, 800, 832],
    why: "legacy global shell rules",
  },
  "features/continue/Continue.module.css": {
    widths: [520, 808],
    why: "the free-allowance pause inside practice; Continue (family path)",
  },
  "features/account/BillingPage.module.css": {
    widths: [808],
    why: "Billing (family path)",
  },
  "features/funding/FundedPurchasePage.module.css": {
    widths: [760],
    why: "education funds (family path)",
  },
  "features/onboarding/Starter.module.css": {
    widths: [640],
    why: "What brings you to AMP? (family path)",
  },
  "features/onboarding/setup/Setup.module.css": {
    widths: [680],
    why: "a parent's setup (family path)",
  },
};

const WIDTH_PROPERTY =
  /^(width|max-width|min-width|inline-size|max-inline-size|min-inline-size|flex-basis|--[\w-]*(?:width|column)[\w-]*)$/;

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory())
      return name === "__tests__" ? [] : cssFiles(path);
    return name.endsWith(".css") ? [path] : [];
  });
}

/** Every px width over the limit a stylesheet declares, by its widths. */
export function wideDeclarations(css: string) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\n]/g, " "),
  );
  const found: { line: number; declaration: string; widths: number[] }[] = [];
  // A declaration: a property and a value up to `;` or the block's end. At
  // rules' conditions (`@media (max-width: …) {`) end at `{`, never `;`.
  for (const match of source.matchAll(/([\w-]+)\s*:\s*([^;{}]+)(?=[;}])/g)) {
    const [, property, value] = match;
    if (!WIDTH_PROPERTY.test(property!)) continue;
    const before = source.slice(0, match.index);
    // Inside a selector (`a:hover`) the next brace opens a block.
    if (/^[^;{}]*\{/.test(source.slice(match.index))) continue;
    if (/@(media|container|supports)[^{};]*$/.test(before)) continue;
    const widths = [...value!.matchAll(/(\d+(?:\.\d+)?)px/g)]
      .map((px) => Number(px[1]))
      .filter((px) => px > LIMIT);
    if (widths.length)
      found.push({
        line: before.split("\n").length,
        declaration: `${property}: ${value!.trim()}`,
        widths,
      });
  }
  return found;
}

test("the width check reads declarations, never query conditions", () => {
  assert.deepEqual(
    wideDeclarations(`
      @media (max-width: 639px) { .a { padding: 0; } }
      @container (min-width: 720px) { .b { display: grid; } }
      .c { max-width: 808px; }
      .d { width: min(100%, 760px); }
      .e { width: 400px; max-width: calc(720px + 2 * var(--gutter)); }
      .f:hover { color: red }
      /* width: 900px; */
      .g { --pitch-width: 1180px; --space: 480px; }
    `).map((entry) => entry.widths),
    [[808], [760], [720], [1180]],
  );
});

test("no page container sets its own px width: widths come from Page and its tokens", () => {
  const problems: string[] = [];
  const seen = new Map<string, Set<number>>();
  for (const path of cssFiles(WEB)) {
    const file = relative(WEB, path).split("\\").join("/");
    if (file.startsWith("ui/")) continue;
    for (const entry of wideDeclarations(readFileSync(path, "utf8")))
      for (const px of entry.widths) {
        const allowed =
          COMPONENTS[file]?.widths.includes(px) ||
          PHASE_2[file]?.widths.includes(px);
        if (allowed) {
          if (!seen.has(file)) seen.set(file, new Set());
          seen.get(file)!.add(px);
        } else
          problems.push(
            `${file}:${entry.line} ${entry.declaration}: use <Page width="narrow|standard|wide|full"> (ui/Page.tsx) or a token in ui/tokens.css`,
          );
      }
  }
  for (const [name, list] of [
    ["COMPONENTS", COMPONENTS],
    ["PHASE_2", PHASE_2],
  ] as const)
    for (const [file, entry] of Object.entries(list))
      for (const px of entry.widths)
        if (!seen.get(file)?.has(px))
          problems.push(
            `${name} lists ${file} ${px}px, which it no longer sets: delete the entry`,
          );
  assert.deepEqual(problems, []);
});

/* ---------- every route renders Page ---------- */

/** Frames that render Page for the screens inside them. */
const FRAMES: Record<string, string> = {
  Page: "ui/Page.tsx",
  PageFrame: "ui/PageFrame.tsx",
};

/** Route screens that don't render Page yet, `module#export`, with why. */
const ROUTES_PHASE_2: Record<string, string> = {
  "app/LegacyApp.tsx#LegacyApp":
    "the legacy host: practice (full) and the account centre",
  "features/account/BillingPage.tsx#BillingPage": "family path (phase 1)",
  "features/billing/CardPurchasePage.tsx#CardPurchasePage":
    "family path (phase 1)",
  "features/continue/ContinueScreen.tsx#ContinueScreen":
    "family path (phase 1)",
  "features/design/DesignScreen.tsx#DesignScreen": "the /design gallery",
  "features/family-approval/ApprovalScreen.tsx#ApprovalScreen":
    "joining, approvals and links from outside the app",
  "features/family-approval/ApproveLinkScreen.tsx#ApproveLinkScreen":
    "joining, approvals and links from outside the app",
  "features/family/screens.tsx#ChildScreen":
    "a family screen (family path, phase 1)",
  "features/family/screens.tsx#FamilyCardsScreen":
    "a family screen (family path, phase 1)",
  "features/family/screens.tsx#FamilyChooserScreen":
    "a family screen (family path, phase 1)",
  "features/family/screens.tsx#FamilyGradesScreen":
    "a family screen (family path, phase 1)",
  "features/family/screens.tsx#FamilyMapScreen":
    "a family screen (family path, phase 1)",
  "features/family/screens.tsx#FamilyMarkingScreen":
    "a family screen (family path, phase 1)",
  "features/family/screens.tsx#FamilyMissingScreen":
    "a family screen (family path, phase 1)",
  "features/family/screens.tsx#FamilyPeopleScreen":
    "a family screen (family path, phase 1)",
  "features/family/screens.tsx#FamilyReportsScreen":
    "a family screen (family path, phase 1)",
  "features/family/screens.tsx#FamilySettingsScreen":
    "a family screen (family path, phase 1)",
  "features/family/screens.tsx#FamilyTimeScreen":
    "a family screen (family path, phase 1)",
  "features/family/screens.tsx#FamilyTodayScreen":
    "a family screen (family path, phase 1)",
  "features/family/screens.tsx#FamilyWorkbooksScreen":
    "a family screen (family path, phase 1)",
  "features/family/screens.tsx#TutoringGroupScreen":
    "a family screen (family path, phase 1)",
  "features/films/FilmScreen.tsx#FilmScreen": "the immersive film (full)",
  "features/funding/FundedEntry.tsx#FundedEntry": "family path (phase 1)",
  "features/funding/FundedPurchasePage.tsx#FundedPurchasePage":
    "family path (phase 1)",
  "features/funding/InvoiceForm.tsx#InvoiceForm": "family path (phase 1)",
  "features/inventory/InventoryScreen.tsx#InventoryScreen":
    "Pathways and Inventory (wide, or full for the 3D map)",
  "features/me/index.ts#OwnRecordScreen": "an adult's own practice",
  "features/me/index.ts#OwnTimeScreen": "an adult's own practice",
  "features/not-found/NotFoundScreen.tsx#NotFoundScreen":
    "the not-found screen",
  "features/onboarding/Starter.tsx#Starter": "family path (phase 1)",
  "features/onboarding/Starter.tsx#StarterStep": "family path (phase 1)",
  "features/pathways/PathwaysScreen.tsx#PathwaysScreen":
    "Pathways and Inventory (wide, or full for the 3D map)",
  "features/profiles/index.ts#EditProfileScreen": "an adult's own practice",
  "features/profiles/index.ts#LevelScreen": "an adult's own practice",
  "features/profiles/index.ts#NewProfileScreen": "an adult's own practice",
  "features/profiles/index.ts#ProfilesScreen": "an adult's own practice",
  "features/school/AdoptionScreen.tsx#AdoptionScreen":
    "a school, class or setup screen",
  "features/school/CalendarScreen.tsx#CalendarScreen":
    "a school, class or setup screen",
  "features/school/ChooserScreen.tsx#ChooserScreen":
    "a school, class or setup screen",
  "features/school/ClassesScreen.tsx#ClassScreen":
    "a school, class or setup screen",
  "features/school/ClassesScreen.tsx#ClassesScreen":
    "a school, class or setup screen",
  "features/school/ImportScreen.tsx#ImportScreen":
    "a school, class or setup screen",
  "features/school/InviteScreen.tsx#InviteScreen":
    "a school, class or setup screen",
  "features/school/LicenseScreen.tsx#LicenseScreen":
    "a school, class or setup screen",
  "features/school/MissingScreen.tsx#SchoolMissingScreen":
    "a school, class or setup screen",
  "features/school/SettingsScreen.tsx#OrgSettingsScreen":
    "a school, class or setup screen",
  "features/school/SetupScreen.tsx#SetupScreen":
    "a school, class or setup screen",
  "features/school/StaffScreen.tsx#SignInHelpScreen":
    "a school, class or setup screen",
  "features/school/StaffScreen.tsx#StaffScreen":
    "a school, class or setup screen",
  "features/school/StudentsScreen.tsx#StudentsScreen":
    "a school, class or setup screen",
  "features/school/classes/index.ts#CardsScreen":
    "a school, class or setup screen",
  "features/school/classes/index.ts#GradebookScreen":
    "a school, class or setup screen",
  "features/school/classes/index.ts#MapScreen":
    "a school, class or setup screen",
  "features/school/classes/index.ts#ReportCardScreen":
    "a school, class or setup screen",
  "features/school/classes/index.ts#RosterScreen":
    "a school, class or setup screen",
  "features/school/classes/index.ts#StartClassScreen":
    "a school, class or setup screen",
  "features/school/classes/index.ts#TimeScreen":
    "a school, class or setup screen",
  "features/school/classes/index.ts#TodayScreen":
    "a school, class or setup screen",
  "features/school/classroom/StandingsScreen.tsx#StandingsScreen":
    "a school, class or setup screen",
  "features/school/classroom/index.ts#ClassExperienceScreen":
    "a school, class or setup screen",
  "features/school/classroom/index.ts#MarkingScreen":
    "a school, class or setup screen",
  "features/school/classroom/index.ts#WorkbookStackScreen":
    "a school, class or setup screen",
  "features/school/clever/ConnectionScreen.tsx#ConnectionScreen":
    "a school, class or setup screen",
  "features/school/join/index.ts#CardScreen":
    "joining, approvals and links from outside the app",
  "features/school/join/index.ts#ClassScreen":
    "joining, approvals and links from outside the app",
  "features/school/join/index.ts#ContinueScreen":
    "joining, approvals and links from outside the app",
  "features/school/join/index.ts#JoinScreen":
    "joining, approvals and links from outside the app",
  "features/school/join/index.ts#PicturesScreen":
    "joining, approvals and links from outside the app",
  "features/school/org/index.ts#ActivityScreen":
    "a school, class or setup screen",
  "features/school/org/index.ts#IntegrationsScreen":
    "a school, class or setup screen",
  "features/school/org/index.ts#OverviewScreen":
    "a school, class or setup screen",
  "features/school/org/index.ts#PrivacyScreen":
    "a school, class or setup screen",
  "features/school/org/index.ts#RolloverScreen":
    "a school, class or setup screen",
  "features/school/org/index.ts#SchoolsScreen":
    "a school, class or setup screen",
  "features/school/pilots/BuyerHandoffScreen.tsx#BuyerHandoffScreen":
    "a school, class or setup screen",
  "features/school/pilots/SchoolCreateScreen.tsx#SchoolCreateScreen":
    "a school, class or setup screen",
  "features/school/pilots/SchoolStartScreen.tsx#SchoolStartScreen":
    "a school, class or setup screen",
  "features/school/standing/index.ts#ClassStandingScreen":
    "a school, class or setup screen",
  "features/school/standing/index.ts#StandingScreen":
    "a school, class or setup screen",
  "features/schools/ParentScreen.tsx#ParentScreen":
    "joining, approvals and links from outside the app",
  "features/workbooks/WorkbookDayScreen.tsx#WorkbookDayScreen":
    "an adult's workbooks",
  "features/workbooks/WorkbookHistoryScreen.tsx#WorkbookHistoryScreen":
    "an adult's workbooks",
  "features/workbooks/WorkbookResultsScreen.tsx#WorkbookResultsScreen":
    "an adult's workbooks",
};

/** Route screens that never will: another product's frame, or a
 * development tool. */
const ROUTES_EXEMPT: Record<string, string> = {
  "features/pitch/PitchScreen.tsx#PitchScreen":
    "the signed-out pitch: a marketing page with its own art direction",
  "features/schools/index.ts#SchoolsScreen":
    "the signed-out schools site, in its own PublicFrame",
  "features/schools/index.ts#ScopeScreen":
    "the signed-out schools site, in its own PublicFrame",
  "features/schools/index.ts#TrustScreen":
    "the signed-out schools site, in its own PublicFrame",
  "features/dev/PersonaSwitcher.tsx#PersonaSwitcher":
    "development only; never in a production bundle",
};

const read = (file: string) => readFileSync(join(WEB, file), "utf8");

/** A module path as the router imports it, to its file under src/web. */
function moduleFile(from: string, specifier: string) {
  const base = resolve(dirname(join(WEB, from)), specifier);
  for (const candidate of [
    `${base}.tsx`,
    `${base}.ts`,
    join(base, "index.tsx"),
    join(base, "index.ts"),
  ])
    if (existsSync(candidate))
      return relative(WEB, candidate).split("\\").join("/");
  throw new Error(`${from}: cannot resolve ${specifier}`);
}

/** The file that defines `name`, following re-exports. */
function definingFile(file: string, name: string, depth = 0): string {
  const source = read(file);
  if (
    new RegExp(
      `export\\s+(default\\s+)?(async\\s+)?(function|const|class)\\s+${name}\\b`,
    ).test(source) ||
    (name === "default" && /export\s+default\b/.test(source))
  )
    return file;
  assert.ok(depth < 4, `${file}: ${name} not found`);
  for (const match of source.matchAll(
    /export\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g,
  )) {
    const names = match[1]!.split(",").map((part) => part.trim());
    const entry = names.find(
      (part) => part === name || part.endsWith(` as ${name}`),
    );
    if (entry)
      return definingFile(
        moduleFile(file, match[2]!),
        entry.split(" as ")[0]!.trim(),
        depth + 1,
      );
  }
  for (const match of source.matchAll(/export\s*\*\s*from\s*"([^"]+)"/g)) {
    try {
      return definingFile(moduleFile(file, match[1]!), name, depth + 1);
    } catch {
      // Not in this one.
    }
  }
  throw new Error(`${file}: ${name} is not exported`);
}

/** The arguments of each call to `callee(` in a source, split at top level. */
function calls(source: string, callee: RegExp) {
  const found: string[][] = [];
  for (const match of source.matchAll(callee)) {
    let depth = 0;
    let at = match.index! + match[0].length;
    const args: string[] = [];
    let current = "";
    for (; at < source.length; at++) {
      const char = source[at]!;
      if ("([{".includes(char)) depth++;
      if (")]}".includes(char)) {
        if (depth === 0) break;
        depth--;
      }
      if (char === "," && depth === 0) {
        args.push(current.trim());
        current = "";
      } else current += char;
    }
    if (current.trim()) args.push(current.trim());
    found.push(args);
  }
  return found;
}

/** Every lazily loaded route screen of the router, as `module#export`. */
export function routeScreens() {
  const screens = new Map<string, string>();
  for (const from of [
    "app/router.tsx",
    "app/family-routes.tsx",
    "app/school-routes.tsx",
  ]) {
    const source = read(from);
    const loaders = new Map<string, string>();
    for (const match of source.matchAll(
      /const\s+(\w+)\s*=\s*\(\)\s*=>\s*import\(\s*"([^"]+)"\s*\)/g,
    ))
      loaders.set(match[1]!, match[2]!);
    const loaderOf = (arg: string) => {
      const clean = arg.replace(/\s+as\s+never$/, "").trim();
      const inline = clean.match(/^\(\)\s*=>\s*import\(\s*"([^"]+)"\s*\)/);
      return inline ? inline[1]! : loaders.get(clean);
    };
    const nameOf = (arg: string | undefined) =>
      arg?.match(/^"(\w+)"/)?.[1] ?? (arg === undefined ? "default" : null);
    const add = (specifier: string, name: string) => {
      const module = moduleFile(from, specifier);
      screens.set(`${module}#${name}`, definingFile(module, name));
    };
    for (const args of calls(source, /\b(?:lazyRouteComponent|screen)\(/g)) {
      const specifier = loaderOf(args[0] ?? "");
      const name = nameOf(args[1]);
      if (specifier && name) add(specifier, name);
      // A family screen by its name alone: `screen("FamilyTodayScreen")`
      // loads the family's `screens` module.
      else if (
        args.length === 1 &&
        /^"\w+"$/.test(args[0]!) &&
        loaders.has("screens")
      )
        add(loaders.get("screens")!, args[0]!.slice(1, -1));
    }
    // A family tab: `leaf(path, "FamilyTimeScreen")`, from `screens`.
    for (const args of calls(source, /\bleaf\(/g))
      if (/^"\w+"$/.test(args[1] ?? "") && loaders.has("screens"))
        add(loaders.get("screens")!, args[1]!.slice(1, -1));
    // A child's learning screen: `childScreen(path, () => import(…), name)`.
    for (const args of calls(source, /\bchildScreen\(/g)) {
      const specifier = loaderOf(args[1] ?? "");
      const name = nameOf(args[2]);
      if (specifier && name) add(specifier, name);
    }
  }
  return screens;
}

/** Whether a screen's file renders Page or a frame that does: it imports
 * that component from its own file and renders it. */
export function rendersPage(file: string) {
  const source = read(file);
  return Object.entries(FRAMES).some(([name, frameFile]) => {
    const module = frameFile.replace(/\.tsx$/, "");
    const imported = [
      ...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g),
    ].some(
      (match) =>
        match[1]!.split(",").some((part) => part.trim() === name) &&
        moduleFile(file, match[2]!) === frameFile,
    );
    return (
      (imported || file === frameFile) &&
      new RegExp(`<${name}[\\s>]`).test(source) &&
      module.length > 0
    );
  });
}

test("the frames that stand in for Page render it", () => {
  for (const [name, file] of Object.entries(FRAMES))
    if (name !== "Page")
      assert.match(read(file), /<Page[\s>]/, `${file} renders <Page>`);
});

test("every route's screen renders Page, or is listed with its reason", () => {
  const screens = routeScreens();
  assert.ok(
    screens.size > 60,
    `the router's screens were found (${screens.size})`,
  );
  const problems: string[] = [];
  for (const [screen, file] of screens) {
    const renders = rendersPage(file);
    const listed = ROUTES_PHASE_2[screen] ?? ROUTES_EXEMPT[screen];
    if (!renders && !listed)
      problems.push(
        `${screen} (${file}) renders no <Page>: wrap the screen in <Page> (ui/Page.tsx)`,
      );
    if (renders && ROUTES_PHASE_2[screen])
      problems.push(
        `${screen} renders Page now: delete it from ROUTES_PHASE_2`,
      );
  }
  for (const screen of [
    ...Object.keys(ROUTES_PHASE_2),
    ...Object.keys(ROUTES_EXEMPT),
  ])
    if (!screens.has(screen))
      problems.push(
        `${screen} is no longer a route's screen: delete its entry`,
      );
  assert.deepEqual(problems, []);
});
