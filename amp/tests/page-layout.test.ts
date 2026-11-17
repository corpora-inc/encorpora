/**
 * Page layout guardrails (ui/Page.tsx; docs/design/ia.md, Layout). A screen's
 * width, gutters and top come from Page and ui/tokens.css only, so pages
 * can't drift back into one width each:
 *
 * 1. No stylesheet outside ui/ sets a width over 400 px, in px or rem (width, max-width,
 *    min-width, their logical forms, flex-basis, or a custom property named
 *    for a width or column), in or out of min()/calc(). Media and container
 *    query conditions are not declarations and never count. The lists below
 *    name every exception with its reason; an entry that no longer matches
 *    fails too, so they only shrink.
 * 2. Every route's screen renders Page, through Page itself or a frame that
 *    does (PageFrame, FamilyFrame, StepFrame, WorkbookFrame), or is listed
 *    with its reason.
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

type Allowed = Record<string, { widths: string[]; why: string }>;

/** Real components, not page containers: sheets, dialogs, popovers, a
 * reading measure or a form's field column inside a page. */
const COMPONENTS: Allowed = {
  "counter-builder.css": { widths: ["36rem"], why: "a practice input" },
  "equal-addends.css": { widths: ["32rem"], why: "a practice input" },
  "line-plot-build.css": { widths: ["36rem"], why: "a practice input" },
  "peg-board.css": { widths: ["40rem"], why: "a practice input" },
  "lesson-reading.css": {
    widths: ["42rem"],
    why: "a lesson's reading measure, inside its sheet or page",
  },
  "features/school/classes/HelpUsed.module.css": {
    widths: ["40rem"],
    why: "a table's measure inside its page",
  },
  "account-security.css": {
    widths: ["420px"],
    why: "the sign-in form's fields",
  },
  "app-shell.css": { widths: ["520px"], why: "the account error toast" },
  "features/account/AccountPages.module.css": {
    widths: ["420px"],
    why: "the rename and add-a-child forms' fields",
  },
  "features/account/DeleteAccount.module.css": {
    widths: ["420px"],
    why: "the typed confirmation's field column",
  },
  "features/family-class/AddChildSheet.module.css": {
    widths: ["480px"],
    why: "a sheet (the fallback of --width-form)",
  },
  "features/films/film-route.css": {
    widths: ["480px"],
    why: "the film player's caption measure",
  },
  "features/onboarding/setup/Setup.module.css": {
    widths: ["420px"],
    why: "a setup step's form fields",
  },
  "features/pitch/Pitch.module.css": {
    widths: ["1180px", "1400px", "46rem"],
    why: "the signed-out pitch: a marketing page with its own art direction",
  },
  "features/schools/PublicFrame.module.css": {
    widths: ["1240px"],
    why: "the signed-out schools site's own frame",
  },
  "features/school/classes/WorkReplay.module.css": {
    widths: ["760px"],
    why: "the full-screen answer replay's column",
  },
  "features/school/join/JoinWays.module.css": {
    widths: ["420px"],
    why: "the join code's field",
  },
  "feedback-sheet.css": {
    widths: ["620px", "680px"],
    why: "the feedback sheet",
  },
  "premium-controls.css": { widths: ["420px"], why: "a popover of options" },
  "problem-flag.css": { widths: ["480px"], why: "the report-a-problem dialog" },
  "shape-composer.css": {
    widths: ["1000px", "30rem"],
    why: "a figure's aspect, from its height",
  },
  "structured-work.css": {
    widths: ["480px", "560px"],
    why: "the work menu and keypad over practice",
  },
  "trend-line-fit.css": { widths: ["520px"], why: "a practice figure" },
  "work-diagram.css": { widths: ["520px"], why: "a practice figure" },
};

/** Screens not on Page yet: phase 2 moves them and deletes their lines. */
const PHASE_2: Allowed = {
  "parent-consent.css": {
    widths: ["52rem"],
    why: "the parent consent centre",
  },
  "features/funding/InvoiceForm.module.css": {
    widths: ["34rem"],
    why: "the signed-out ClassWallet invoice form, with its own brand header",
  },
  "book-reader.css": {
    widths: ["720px", "760px", "800px"],
    why: "the book reader",
  },
  "family-center.css": {
    widths: ["560px", "620px", "720px"],
    why: "the legacy family centre (native) and its dialog",
  },
  "features/design/Design.module.css": {
    widths: ["720px", "1280px"],
    why: "the /design gallery",
  },
  "features/inventory/Inventory.module.css": {
    widths: ["420px", "560px"],
    why: "Inventory's day-0 hero",
  },
  "features/me/Own.module.css": { widths: ["760px"], why: "an adult's /me" },
  "features/pathways/pathways.css": {
    widths: ["660px"],
    why: "Pathways' panels",
  },
  "features/profiles/LevelScreen.module.css": {
    widths: ["560px"],
    why: "Try a level",
  },
  "features/profiles/Profiles.module.css": {
    widths: ["480px", "560px", "720px", "960px"],
    why: "practice profiles",
  },
  "features/school/Import.module.css": {
    widths: ["420px", "880px"],
    why: "a school's import",
  },
  "features/school/School.module.css": {
    widths: ["480px", "520px", "640px", "720px", "880px"],
    why: "school screens",
  },
  "features/school/SchoolFrame.module.css": {
    widths: ["880px"],
    why: "the school frame's narrow content",
  },
  "features/school/Setup.module.css": {
    widths: ["480px", "600px"],
    why: "school setup",
  },
  "features/school/classes/Cards.module.css": {
    widths: ["560px"],
    why: "sign-in cards",
  },
  "features/school/classes/ReportCard.module.css": {
    widths: ["720px"],
    why: "report cards",
  },
  "features/school/classroom/Experience.module.css": {
    widths: ["960px"],
    why: "a class's student experience",
  },
  "features/school/classroom/Stack.module.css": {
    widths: ["640px"],
    why: "the workbook stack",
  },
  "features/school/classroom/Standings.module.css": {
    widths: ["720px"],
    why: "standings",
  },
  "features/school/join/Join.module.css": {
    widths: ["420px", "480px", "620px", "1080px", "1320px"],
    why: "joining a class and a student's sign-in",
  },
  "features/school/org/Org.module.css": {
    widths: ["420px", "720px", "760px"],
    why: "school and district screens",
  },
  "features/schools/Parent.module.css": {
    widths: ["720px"],
    why: "a parent's progress link",
  },
  "native-session.css": { widths: ["640px"], why: "the native session screen" },
  "payment-history.css": {
    widths: ["760px"],
    why: "the native app's payment records",
  },
  "practice-tablet.css": { widths: ["680px"], why: "practice on a tablet" },
  "practice.css": {
    widths: [
      "440px",
      "450px",
      "520px",
      "620px",
      "640px",
      "680px",
      "760px",
      "820px",
      "1240px",
    ],
    why: "practice and its legacy screens",
  },
  "progress-workspace.css": {
    widths: ["680px", "700px"],
    why: "the legacy progress workspace",
  },
  "style.css": {
    widths: ["430px", "440px", "480px", "520px", "560px", "720px", "1240px"],
    why: "legacy global shell rules",
  },
  "theme.css": {
    widths: ["420px", "460px", "640px", "720px", "800px", "832px"],
    why: "legacy global shell rules",
  },
  "features/continue/Continue.module.css": {
    widths: ["520px"],
    why: "the free-allowance pause inside practice",
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
  const found: { line: number; declaration: string; widths: string[] }[] = [];
  // A declaration: a property and a value up to `;` or the block's end. At
  // rules' conditions (`@media (max-width: …) {`) end at `{`, never `;`.
  for (const match of source.matchAll(/([\w-]+)\s*:\s*([^;{}]+)(?=[;}])/g)) {
    const [, property, value] = match;
    if (!WIDTH_PROPERTY.test(property!)) continue;
    const before = source.slice(0, match.index);
    // Inside a selector (`a:hover`) the next brace opens a block.
    if (/^[^;{}]*\{/.test(source.slice(match.index))) continue;
    if (/@(media|container|supports)[^{};]*$/.test(before)) continue;
    // A rem is 16 px here: a container in rem is a container all the same.
    const widths = [...value!.matchAll(/(\d+(?:\.\d+)?)(px|rem)\b/g)]
      .filter(
        ([, size, unit]) => Number(size) * (unit === "rem" ? 16 : 1) > LIMIT,
      )
      .map(([literal]) => literal);
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
      .h { max-width: 34rem; min-width: 2rem; }
    `).map((entry) => entry.widths),
    [["808px"], ["760px"], ["720px"], ["1180px"], ["34rem"]],
  );
});

test("no page container sets its own px width: widths come from Page and its tokens", () => {
  const problems: string[] = [];
  const seen = new Map<string, Set<string>>();
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
            `${name} lists ${file} ${px}, which it no longer sets: delete the entry`,
          );
  assert.deepEqual(problems, []);
});

/* ---------- every route renders Page ---------- */

/** Frames that render Page for the screens inside them. */
const FRAMES: Record<string, string> = {
  Page: "ui/Page.tsx",
  PageFrame: "ui/PageFrame.tsx",
  FamilyFrame: "features/family/FamilyFrame.tsx",
  StepFrame: "features/onboarding/setup/StepFrame.tsx",
  WorkbookFrame: "features/workbooks/WorkbookFrame.tsx",
};

/** Route screens that don't render Page yet, `module#export`, with why. */
const ROUTES_PHASE_2: Record<string, string> = {
  "app/LegacyApp.tsx#LegacyApp":
    "the legacy host: practice (full) and the account centre",
  "features/design/DesignScreen.tsx#DesignScreen": "the /design gallery",
  "features/family-approval/ApprovalScreen.tsx#ApprovalScreen":
    "joining, approvals and links from outside the app",
  "features/family-approval/ApproveLinkScreen.tsx#ApproveLinkScreen":
    "joining, approvals and links from outside the app",
  "features/films/FilmScreen.tsx#FilmScreen": "the immersive film (full)",
  "features/funding/InvoiceForm.tsx#InvoiceForm":
    "the signed-out ClassWallet invoice form, with its own brand header",
  "features/inventory/InventoryScreen.tsx#InventoryScreen":
    "Pathways and Inventory (wide, or full for the 3D map)",
  "features/me/index.ts#OwnRecordScreen": "an adult's own practice",
  "features/me/index.ts#OwnTimeScreen": "an adult's own practice",
  "features/not-found/NotFoundScreen.tsx#NotFoundScreen":
    "the not-found screen",
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
};

/** Route screens that never will: another product's frame, or a
 * development tool. */
const ROUTES_EXEMPT: Record<string, string> = {
  "features/pay/hosts.tsx#ChildPayHost":
    "a child's page (ChildScreen renders Page) with the pay overlay's outlet over it",
  "features/pay/hosts.tsx#TodayPayHost":
    "the family's Today (it renders Page) with the pay overlay's outlet over it",
  "features/pay/hosts.tsx#BillingPayHost":
    "Billing (it renders Page) with the pay overlay's outlet over it",
  "features/pay/hosts.tsx#SettingsHost":
    "a family's Settings (it renders Page) with its overlays' outlet over it",
  "features/account/overlays.tsx#BillingOverlay":
    "an overlay in ui/Sheet over its settings hub, which renders Page",
  "features/account/overlays.tsx#SecurityOverlay":
    "an overlay in ui/Sheet over its settings hub, which renders Page",
  "features/account/overlays.tsx#DeleteAccountOverlay":
    "an overlay in ui/Sheet over its settings hub, which renders Page",
  "features/privacy/PrivacyOverlay.tsx#PrivacyOverlay":
    "an overlay in ui/Sheet over its settings hub, which renders Page",
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
    "app/pay-routes.tsx",
    "app/account-overlays.tsx",
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
    // A family tab: `leaf(path, "FamilyMarkingScreen")`, from `screens`.
    for (const args of calls(source, /\bleaf\(/g))
      if (/^"\w+"$/.test(args[1] ?? "") && loaders.has("screens"))
        add(loaders.get("screens")!, args[1]!.slice(1, -1));
    // A record alias that renders where it stays:
    // `childAlias(path, anchor, { …, component: "FamilyWorkbooksScreen" })`.
    for (const args of calls(source, /\bchildAlias\(/g)) {
      const named = args[2]?.match(/component:\s*"(\w+)"/)?.[1];
      if (named && loaders.has("screens")) add(loaders.get("screens")!, named);
    }
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

/* ---------- no in-page Back ---------- */

/**
 * No in-page Back control (founder, 2026-11-16). Tabs, menus and the
 * browser navigate; a flow shows the shared stepper (ui/FlowSteps), whose
 * done steps link to their own addresses; a contextual screen is an overlay
 * that closes (✕) to the screen behind it (lib/return-to's closeTo). No
 * source draws a "‹" chevron, a control labelled "Back" or "Back to …",
 * a page's own close-click (useCloseClick) or calls history.back(). Older
 * screens that still do are listed with what replaces theirs; an entry that
 * no longer matches fails, so the list only shrinks.
 */
const BACK_DEBT: Record<string, string> = {
  "BookReader.tsx":
    "a legacy screen (phase 2): replaced when its feature migrates",
  "NativeGate.tsx":
    "a legacy screen (phase 2): replaced when its feature migrates",
  "ParentConsentCenter.tsx":
    "a legacy screen (phase 2): replaced when its feature migrates",
  "PracticeWorkspace.tsx":
    "a legacy screen (phase 2): replaced when its feature migrates",
  "ProgressWorkspace.tsx":
    "a legacy screen (phase 2): replaced when its feature migrates",
  "app/LegacyApp.tsx":
    "a legacy screen (phase 2): replaced when its feature migrates",
  "features/auth/SignInScreen.tsx":
    "a sign-in or first-run card step: to move onto the shared stepper (phase 2)",
  "features/design/sections/states.tsx":
    "the /design gallery's sample empty state",
  "features/films/FilmScreen.tsx":
    "the immersive film's return to its problem or lesson: to become its ✕ (phase 2)",
  "features/me/OwnTimeScreen.tsx":
    "an adult's practice time: Progress's tab replaces it (phase 2)",
  "features/onboarding/LearnerSteps.tsx":
    "a sign-in or first-run card step: to move onto the shared stepper (phase 2)",
  "features/pathways/LessonRecovery.tsx":
    "an overlay's failure state names where ✕ returns; to become the overlay's ✕ (phase 2)",
  "features/profiles/api.ts":
    "practice modes' way back to where they started, in the bar and drawer: to become the mode's exit (phase 2)",
  "features/profiles/practice-mode.ts":
    "practice modes' way back to where they started, in the bar and drawer: to become the mode's exit (phase 2)",
  "features/school/ImportScreen.tsx":
    "a school screen (phase 2): tabs and overlays replace its way back",
  "features/school/PlainPage.tsx":
    "a school screen (phase 2): tabs and overlays replace its way back",
  "features/school/SetupScreen.tsx":
    "a school screen (phase 2): tabs and overlays replace its way back",
  "features/school/classes/CardsScreen.tsx":
    "a school screen (phase 2): tabs and overlays replace its way back",
  "features/school/classes/GradebookScreen.tsx":
    "a school screen (phase 2): tabs and overlays replace its way back",
  "features/school/classes/ReportCardScreen.tsx":
    "a school screen (phase 2): tabs and overlays replace its way back",
  "features/school/classes/StartClassScreen.tsx":
    "a school screen (phase 2): tabs and overlays replace its way back",
  "features/school/classes/TimeScreen.tsx":
    "a school screen (phase 2): tabs and overlays replace its way back",
  "features/school/classroom/StandingsScreen.tsx":
    "a school screen (phase 2): tabs and overlays replace its way back",
  "features/school/join/ClassScreen.tsx":
    "a school screen (phase 2): tabs and overlays replace its way back",
  "features/school/join/PicturesScreen.tsx":
    "a school screen (phase 2): tabs and overlays replace its way back",
  "features/school/org/RolloverScreen.tsx":
    "a school screen (phase 2): tabs and overlays replace its way back",
  "features/school/pilots/ClassAccess.tsx":
    "a school screen (phase 2): tabs and overlays replace its way back",
  "features/school/pilots/SchoolStartScreen.tsx":
    "a school screen (phase 2): tabs and overlays replace its way back",
  "features/school/standing/parts.tsx":
    "a school screen (phase 2): tabs and overlays replace its way back",
  "nav/LayerHost.tsx":
    "an overlay's failure state names where ✕ returns; to become the overlay's ✕ (phase 2)",
  "scene/ScenePlayer.tsx":
    "the immersive film's return to its problem or lesson: to become its ✕ (phase 2)",
  "ui/LoadingScreen.tsx":
    "a route error's recovery link names where it goes; to become the tab's own screen (phase 2)",
};

/** A drawn way back, in source with its comments removed. */
const BACK_PATTERNS: [string, RegExp][] = [
  ["a ‹ chevron", /‹/],
  ["a control labelled Back", /(?:>|"|`)\s*Back(?: to [^<"`{]+)?\s*(?:<|"|`)/],
  ["a page's own close-click", /\buseCloseClick\(/],
  ["history.back()", /\bhistory\.back\(\)/],
];
/** Where the one overlay close and its link helper live. */
// The overlay close mechanics, not Back controls: closeTo's return, and a
// sheet popping its own same-URL history entry when it closes (nav/sheet.ts).
const BACK_OWNERS = new Set([
  "lib/return-to.ts",
  "nav/links.tsx",
  "nav/sheet.ts",
]);

const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory())
      return name === "__tests__" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

test("no screen draws an in-page Back", () => {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const path of sourceFiles(WEB)) {
    const file = relative(WEB, path).split("\\").join("/");
    if (BACK_OWNERS.has(file)) continue;
    const source = withoutComments(readFileSync(path, "utf8"));
    const found = BACK_PATTERNS.filter(([, pattern]) => pattern.test(source));
    if (!found.length) continue;
    seen.add(file);
    if (!BACK_DEBT[file])
      problems.push(
        `${file} draws ${found.map(([what]) => what).join(", ")}: no in-page Back. Tabs, menus and the browser navigate; flows use ui/FlowSteps; a contextual screen is an overlay that closes to the screen behind it`,
      );
  }
  for (const file of Object.keys(BACK_DEBT))
    if (!seen.has(file))
      problems.push(`${file} draws no Back now: delete it from BACK_DEBT`);
  assert.deepEqual(problems, []);
});
