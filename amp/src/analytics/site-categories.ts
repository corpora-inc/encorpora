/** Parent-site categories, never contact values, URLs, or form contents. */
export const MARKETING_SCREENS = [
  "marketing_home",
  "marketing_amp",
  "marketing_ar",
  "marketing_az",
  "marketing_grades",
  "marketing_workbooks",
  "marketing_lessons",
  "marketing_compare",
  "marketing_approach",
  "marketing_tutors",
  "marketing_adults",
  "marketing_plans",
  "marketing_funding",
  "marketing_resources",
  "marketing_other",
] as const;
export const SITE_ACTIONS = [
  "invoice_open",
  "invoice_close",
  "assessment_click",
  "product_click",
  "support_click",
  "funding_provider_click",
  "navigation_click",
  "workbook_download",
  "video_play",
  "video_complete",
] as const;

export function marketingScreen(
  path: string,
): (typeof MARKETING_SCREENS)[number] {
  const normalized = path.replace(/\/$/, "");
  if (normalized === "") return "marketing_home";
  if (normalized === "/amp") return "marketing_amp";
  if (normalized === "/esa/arkansas-efa") return "marketing_ar";
  if (normalized === "/esa/arizona-esa") return "marketing_az";
  if (/^\/(grades|courses)(\/|$)/.test(normalized)) return "marketing_grades";
  if (/^\/(workbooks|personalized-workbooks)(\/|$)/.test(normalized)) return "marketing_workbooks";
  if (/^\/(lessons|learn|videos)(\/|$)/.test(normalized)) return "marketing_lessons";
  if (normalized.startsWith("/compare")) return "marketing_compare";
  if (/^\/(philosophy|science|how-it-works)(\/|$)/.test(normalized)) return "marketing_approach";
  if (normalized==="/tutors") return "marketing_tutors";
  if (normalized==="/adult-learners") return "marketing_adults";
  if (normalized==="/plans") return "marketing_plans";
  if (normalized==="/resources") return "marketing_resources";
  if (/^\/esa(\/|$)/.test(normalized)) return "marketing_funding";
  return "marketing_other";
}
