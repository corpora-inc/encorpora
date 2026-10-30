/** Public labels come from fixed routes, never DOM text, form values or IDs. */
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

export const publicAppPageTitles: Readonly<Record<string, string>> = {
  "/": "AMP · Adaptive Math Pathways",
  "/sign-up": "Create Your Account | AMP",
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
};

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
};

/** Browser-only titles may describe private screens; they do not enable GA. */
export function appPageTitle(path: string): string | undefined {
  const clean = path.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  // The public catalog owns its richer skill-specific metadata.
  if (clean === "/pathways" || clean.startsWith("/pathways/")) return;
  if (Object.hasOwn(publicAppPageTitles, clean))
    return publicAppPageTitles[clean];
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
  ] as const;
  return `${category.find(([pattern]) => pattern.test(clean))?.[1] ?? "Adaptive Math Pathways"} | AMP`;
}
