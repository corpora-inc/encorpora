import type { PITCH_PROGRAMS } from "./events";

/** Public labels come from fixed routes and validated labels, never DOM text,
 * form values or IDs. GA groups reports by these strings: keep them stable. */
export const marketingPageTitles: Readonly<Record<string, string>> = {
  "/": "Corpora · AMP Mathematics",
  "/amp": "Adaptive Math Practice | AMP",
  "/esa": "Education Funding | Corpora",
  "/esa/arkansas-efa": "Arkansas EFA | AMP",
  "/esa/arizona-esa": "Arizona ESA | AMP",
  "/esa/new-hampshire-efa": "New Hampshire EFA | AMP",
  "/samples": "Printable Math Samples | AMP",
  "/about": "About Corpora",
  "/parents": "AMP for Parents | Corpora",
  "/schools": "AMP for Schools | Corpora",
  "/legal/privacy": "Privacy | Corpora",
  "/legal/terms": "Terms | Corpora",
  "/legal/accessibility": "Accessibility | Corpora",
  "/support": "Support | Corpora",
  "/legal/refund": "Refund Policy | Corpora",
};

/** What `/` shows: the signed-out parent pitch, or the signed-in app. */
export type HomeScreen = "pitch" | "app";
export type PitchProgramId = (typeof PITCH_PROGRAMS)[number];

/** Funded programs an ad can name with `?program=`, as the purchase flow names them. */
export const programNames: Readonly<Record<PitchProgramId, string>> = {
  "ar-efa": "Arkansas EFA",
  "az-esa": "Arizona ESA",
  "nh-efa": "New Hampshire EFA",
};

/** The pitch at `/`, by the funded program its link names. Any other
 * `program` value reads as the plain pitch. */
export const pitchTitles: Readonly<Record<PitchProgramId | "default", string>> =
  {
    default: "AMP: Adaptive Math Pathways, a complete math curriculum",
    "ar-efa": "AMP: Adaptive Math Pathways for Arkansas EFA families",
    "az-esa": "AMP: Adaptive Math Pathways for Arizona ESA families",
    "nh-efa": "AMP: Adaptive Math Pathways for New Hampshire EFA families",
  };

/** `/sign-up` by what the parent came to do: the pitch choice in `?entry=`,
 * else `?return=free-practice` (the free-trial entry), else a plain account. */
export const signUpTitles = {
  default: "Create Your Account | AMP",
  "free-practice": "Try AMP Free | AMP",
  "pitch-try": "Try AMP Free | AMP",
  "pitch-workbook": "Get Your Free Workbook | AMP",
  "pitch-buy": "Create Your Account to Buy | AMP",
} as const;
const signUpEntries = ["pitch-try", "pitch-workbook", "pitch-buy"] as const;

export const publicAppPageTitles: Readonly<Record<string, string>> = {
  "/": pitchTitles.default,
  "/sign-up": signUpTitles.default,
  "/sign-in": "Sign In | AMP",
  "/pathways": "Explore Math Skills | AMP Pathways",
  "/plans": "Plans | AMP",
  "/purchase": "Purchase | AMP",
  "/purchase/arkansas-efa": "Pay with Arkansas EFA | AMP",
  "/purchase/arizona-esa": "Pay with Arizona ESA | AMP",
  "/purchase/new-hampshire-efa": "Pay with New Hampshire EFA | AMP",
  "/try/plans": "Choose Your Plan | AMP",
  "/start/plan": "Choose Your Plan | AMP",
  "/start/purchase": "Complete Your Purchase | AMP",
  "/invoice/arkansas-efa": "Request an Arkansas EFA Invoice | AMP",
  "/invoice/arizona-esa": "Request an Arizona ESA Invoice | AMP",
  "/invoice/new-hampshire-efa": "Request a New Hampshire EFA Invoice | AMP",
  "/schools": "AMP for Schools: a complete math curriculum",
  "/schools/scope-and-sequence": "Scope and Sequence | AMP for Schools",
  "/schools/trust": "Student Data | AMP for Schools",
};

/** The signed-in home at `/`: a private screen, so GA never receives it. */
const appHomeTitle = "AMP · Adaptive Math Pathways";

const appScreenTitles: Readonly<Record<string, string>> = {
  "/try": "Start Adaptive Practice | AMP",
  "/try/practice": "Adaptive Practice | AMP",
  "/try/map": "Your Math Map | AMP",
  "/reset-password": "Reset Your Password | AMP",
  "/sign-in/forgot": "Reset Your Password | AMP",
  "/sign-in/check-email": "Check Your Email | AMP",
  "/sign-in/two-factor": "Two-Step Verification | AMP",
  "/start/name": "Set Up Your Learner | AMP",
  "/start/birth-year": "Choose Your Learner’s Birth Year | AMP",
  "/start/consent": "Parent Consent | AMP",
  "/start/verify-email": "Verify Your Email | AMP",
  "/account/ready": "Your Account Is Ready | AMP",
  "/access": "Your Access | AMP",
  "/p": "Progress from School | AMP",
};

/** A path with optional query and fragment, as a normalized path and its query. */
export function splitLocation(location: string): {
  path: string;
  search: URLSearchParams;
} {
  const [beforeHash] = location.split("#");
  const query = beforeHash.indexOf("?");
  const path =
    (query < 0 ? beforeHash : beforeHash.slice(0, query)).replace(/\/$/, "") ||
    "/";
  return {
    path,
    search: new URLSearchParams(query < 0 ? "" : beforeHash.slice(query + 1)),
  };
}

/** A funded program id from a URL value, or undefined for anything else. */
export function pitchProgramId(value: unknown): PitchProgramId | undefined {
  return typeof value === "string" && Object.hasOwn(programNames, value)
    ? (value as PitchProgramId)
    : undefined;
}

/** The GA-visible title of a public amp.corpora.inc route, or undefined for
 * every other screen. The only inputs are the path, validated `program`,
 * `entry` and `return` labels, and which screen `/` shows. */
export function publicAppPageTitle(
  location: string,
  home: HomeScreen,
): string | undefined {
  const { path, search } = splitLocation(location);
  if (path === "/") {
    if (home !== "pitch") return;
    return pitchTitles[pitchProgramId(search.get("program")) ?? "default"];
  }
  if (path === "/sign-up") {
    const entry = signUpEntries.find((name) => name === search.get("entry"));
    if (entry) return signUpTitles[entry];
    return search.get("return") === "free-practice"
      ? signUpTitles["free-practice"]
      : signUpTitles.default;
  }
  return Object.hasOwn(publicAppPageTitles, path)
    ? publicAppPageTitles[path]
    : undefined;
}

/** The document title for any app route. Public routes use exactly the title
 * GA receives; browser-only titles may describe private screens and do not
 * enable GA. */
export function appPageTitle(
  location: string,
  home: HomeScreen = "pitch",
): string | undefined {
  const { path: clean } = splitLocation(location);
  // The public catalog owns its richer skill-specific metadata.
  if (clean === "/pathways" || clean.startsWith("/pathways/")) return;
  if (clean === "/" && home === "app") return appHomeTitle;
  const title = publicAppPageTitle(location, home);
  if (title) return title;
  if (Object.hasOwn(appScreenTitles, clean)) return appScreenTitles[clean];
  const category = [
    [/^\/sign-in(?:\/|$)/, "Sign In"],
    [/^\/family(?:\/|$)/, "Your Learners"],
    [/^\/account(?:\/|$)/, "Your Account"],
    [/^\/practice(?:\/|$)/, "Math Practice"],
    [/^\/(?:lesson|lessons)(?:\/|$)/, "Math Lessons"],
    [/^\/(?:book|books)(?:\/|$)/, "Math Worksheets"],
    [/^\/start(?:\/|$)/, "Learner Setup"],
    [/^\/purchase(?:\/|$)/, "Purchase"],
    [/^\/invoice(?:\/|$)/, "Your Invoice"],
    [/^\/consent(?:\/|$)/, "Parent Consent"],
    [/^\/(?:join|c)(?:\/|$)/, "Join Your Class"],
    [/^\/school(?:\/|$)/, "AMP for Schools"],
  ] as const;
  return `${category.find(([pattern]) => pattern.test(clean))?.[1] ?? "Adaptive Math Pathways"} | AMP`;
}
