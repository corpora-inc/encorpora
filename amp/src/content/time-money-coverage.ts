import type { FacetMapping } from "./coverage";

const scope = (templateIds: string[], facetId: string, rationale: string) =>
  templateIds.map((templateId) => ({
    templateId,
    facetId,
    extent: "partial" as const,
    rationale,
  }));
export const timeMoneyFacetMappings: readonly FacetMapping[] = [
  ...scope(
    ["read-clock-hour-half", "clock-hour-read", "match-clock-half-hour"],
    "clock-half-hours.hour-half-hour-reading",
    "Choices and numeric responses assess reading given analog clocks on the hour and half hour. Digital clocks and setting the hands require separate assessment.",
  ),
  ...scope(
    [
      "read-clock-five-minutes",
      "minutes-past-hour",
      "match-clock-five-minutes",
      "clock-am-pm",
    ],
    "clock-five-minutes.five-minute-reading",
    "Choices and numeric responses assess reading given analog clocks to five minutes and a.m. or p.m. from context. Digital clocks require separate assessment.",
  ),
  ...scope(
    [
      "coin-total",
      "money-total-dollars",
      "make-a-dollar",
      "pay-exact-coins",
      "money-left-story",
    ],
    "money-values.coin-bill-totals",
    "Numeric responses and choices assess totals, differences and exact payment with drawn coins and bills. Handling real money and making change from bills require separate assessment.",
  ),
];
