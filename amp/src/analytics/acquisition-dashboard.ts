import type { engagementReport } from "./engagement-report.js";
import type { fundedJourneyReport } from "./funded-journey-report.js";
import type { fundedCohortSummary } from "./funded-cohort.js";
import type { FunnelReport } from "./report.js";
import type { InsightsReport } from "./insights.js";
import { costTotals, type AdCosts } from "./ad-costs.js";

export type AcquisitionSnapshot = {
  generatedAt: string;
  days: number;
  engagement: Awaited<ReturnType<typeof engagementReport>>;
  funded: Awaited<ReturnType<typeof fundedJourneyReport>>;
  funnel: FunnelReport;
  learning: InsightsReport;
  fulfillment: Awaited<ReturnType<typeof fundedCohortSummary>>[];
  feedback: { context: string; program: string | null; count: number }[];
  costs: AdCosts;
};
const esc = (v: unknown) =>
  String(v ?? "—").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const number = (v: unknown) =>
  Number(v ?? 0).toLocaleString("en-US", { maximumFractionDigits: 1 });
const money = (micros: number | null, currency: string) =>
  micros === null
    ? "Unreconciled"
    : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
        micros / 1e6,
      );
function table(headers: string[], rows: unknown[][]) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}" class="empty">No recorded data in this window.</td></tr>`}</tbody></table></div>`;
}
function section(id: string, title: string, note: string, content: string) {
  return `<section id="${id}"><h2>${esc(title)}</h2><p class="note">${esc(note)}</p>${content}</section>`;
}

/** Standalone private operator report: no external assets or individual records. */
export function acquisitionDashboard(s: AcquisitionSnapshot): string {
  const e = s.engagement,
    f = s.funded;
  const traffic = (kind: string) =>
    e.coverage.find((r) => r.traffic_kind === kind)?.browsers ?? 0;
  const sum = (key: string) =>
    f.sources.reduce((n, r) => n + Number(r[key] ?? 0), 0);
  const totals = costTotals(s.costs);
  const cards = [
    [
      number(traffic("external")),
      "Observed external browsers",
      "Not verified people; active in the selected UTC days.",
    ],
    [
      number(traffic("unknown")),
      "Unclassified browsers",
      "Legacy traffic may include staff and testing.",
    ],
    [
      number(sum("prepared")),
      "Funded invoices / requests",
      "One guest invoice and its account claim count once.",
    ],
    [
      number(sum("paid")),
      "Verified funded payments",
      "Settled money, including payments awaiting account claim.",
    ],
    [
      number(s.funnel.refunds.purchases),
      "Recorded card purchases",
      "Server-verified Stripe purchase events in the window.",
    ],
    [
      number(traffic("internal") + traffic("automated")),
      "Excluded test browsers",
      "Staff and automation excluded from customer reporting.",
    ],
  ];
  const sources = table(
    ["Source", "Medium", "Campaign", "Creative", "Browsers", "Active minutes"],
    e.sources.map((r) => [
      r.source,
      r.medium,
      r.campaign,
      r.creative,
      number(r.browsers),
      number(r.active_seconds / 60),
    ]),
  );
  const recordedSources = table(
    [
      "Source label",
      "Browser IDs",
      "Browsers clicking Try",
      "Browsers with card purchase",
    ],
    s.funnel.breakdowns.source.map((r) => [
      r.key,
      number(r.visitors),
      number(r.tried),
      number(r.purchased),
    ]),
  );
  const cardPurchases = table(
    [
      "Source",
      "Medium",
      "Campaign",
      "Creative",
      "Plan",
      "Purchases",
      "Linked browsers",
    ],
    (e.cardPurchases ?? []).map((r) => [
      r.source,
      r.medium,
      r.campaign,
      r.creative,
      r.interval,
      number(r.purchases),
      number(r.browsers),
    ]),
  );
  const screens = table(
    [
      "Screen",
      "Page visits",
      "Browsers",
      "Visible minutes",
      "Active minutes",
      "Mean active seconds",
    ],
    e.screens.map((r) => [
      r.screen,
      number(r.page_visits),
      number(r.browsers),
      number(r.visible_seconds / 60),
      number(r.active_seconds / 60),
      number(r.mean_active_seconds_per_page),
    ]),
  );
  const paths = table(
    ["From", "Next observed screen", "Transitions"],
    e.journeys.map((r) => [r.screen, r.next_screen, number(r.transitions)]),
  );
  const actions = table(
    [
      "Screen",
      "Action",
      "Source",
      "Medium",
      "Campaign",
      "Creative",
      "Actions",
      "Browsers",
    ],
    e.actions.map((r) => [
      r.screen,
      r.action,
      r.source,
      r.medium,
      r.campaign,
      r.creative,
      number(r.actions),
      number(r.browsers),
    ]),
  );
  const purchase = table(
    [
      "State",
      "Attribution basis",
      "Source",
      "Medium",
      "Campaign",
      "Creative",
      "Prepared",
      "Submitted¹",
      "Paid",
      "Paid awaiting access",
      "Mail accepted",
      "Gross paid",
      "Refunded",
    ],
    f.sources.map((r) => [
      r.jurisdiction,
      r.attribution_basis,
      r.source,
      r.medium,
      r.campaign,
      r.creative,
      number(r.prepared),
      number(r.parent_submitted),
      number(r.paid),
      number(r.paid_awaiting_access),
      number(r.activation_email_accepted),
      money(r.gross_paid_minor * 10000, r.currency),
      money(r.refunded_minor * 10000, r.currency),
    ]),
  );
  const progress = table(
    ["Milestone", "Browsers reaching it"],
    s.funnel.steps.map((r) => [r.event, number(r.visitors)]),
  );
  const purchaseAttempts = table(
    [
      "Stage",
      "Outcome",
      "Failure",
      "Source",
      "Medium",
      "Campaign",
      "Creative",
      "Attempts",
      "Browsers",
    ],
    (e.purchaseAttempts ?? []).map((r) => [
      r.stage,
      r.outcome,
      r.failure,
      r.source,
      r.medium,
      r.campaign,
      r.creative,
      number(r.attempts),
      number(r.browsers),
    ]),
  );
  const purchaseActions = table(
    [
      "Action",
      "Source",
      "Medium",
      "Campaign",
      "Creative",
      "Clicks",
      "Browsers",
    ],
    (e.purchaseActions ?? []).map((r) => [
      r.action,
      r.source,
      r.medium,
      r.campaign,
      r.creative,
      number(r.clicks),
      number(r.browsers),
    ]),
  );
  const delivery = table(
    [
      "Program",
      "Usable access",
      "Observed practice",
      "Settled with practice",
      "Pending mail",
      "Stopped mail",
      "Oldest unclaimed (hours)",
    ],
    s.fulfillment.map((r) => [
      r.program,
      number(r.counts.current_usable_access),
      number(r.counts.observed_use_during_grant),
      number(r.counts.settled_with_observed_use),
      number(r.counts.activation_mail_pending),
      number(r.counts.activation_mail_stopped),
      r.waiting.oldest_unclaimed_hours,
    ]),
  );
  const spend = totals.length
    ? totals
        .map(
          (t) =>
            `<article class="cost"><h3>${esc(t.platform)} · ${esc(money(t.spendMicros, t.currency))}</h3><p class="note">${esc(t.from)} through ${esc(t.through)} · ${esc(t.timeZone)} · ${esc(t.clickMetric.replaceAll("_", " "))} · checked ${esc(t.observedAt)}</p><p class="note">${esc(number(t.impressions))} impressions · ${esc(number(t.clicks))} clicks · ${esc(t.costPerClickMicros === null ? "Cost per click unavailable" : `${money(t.costPerClickMicros, t.currency)} per click`)}</p>${t.note ? `<p class="warning">${esc(t.note)}</p>` : ""}${t.billing ? `<p class="note">${esc(t.billing.label)}: ${esc(money(t.billing.amountMicros, t.currency))}. Account-level billing evidence is separate from campaign costs.</p>` : ""}${table(
              [
                "Campaign",
                "Impressions",
                "Clicks",
                "Spend",
                "Cost / click",
                "UTM source / campaign",
              ],
              t.rows
                .filter((r) => r.impressions || r.clicks || r.spendMicros !== 0)
                .map((r) => [
                  r.label,
                  number(r.impressions),
                  number(r.clicks),
                  money(r.spendMicros, t.currency),
                  r.clicks && r.spendMicros !== null
                    ? money(r.spendMicros / r.clicks, t.currency)
                    : "—",
                  r.utmCampaign
                    ? `${r.utmSources?.join(", ")} / ${r.utmCampaign}`
                    : "Unmapped",
                ]),
            )}<p class="note">Campaign rows with zero impressions, clicks and spend are omitted from this table; the JSON snapshot retains all ${t.rows.length} campaign rows.</p></article>`,
        )
        .join("")
    : '<p class="empty">Ad costs have not been imported. This does not mean zero spend.</p>';
  const missing = ["google", "meta", "openai"].filter(
    (p) => !totals.some((t) => t.platform === p),
  );
  const feedback = table(
    ["Context", "Program", "Responses"],
    s.feedback.map((r) => [r.context, r.program, number(r.count)]),
  );
  const dismissal = table(
    ["Reason", "Responses"],
    s.funnel.paywallDismissReasons.map((r) => [r.reason, number(r.count)]),
  );
  const problemReports = table(
    ["Problem template", "Flags", "Answered", "Skip rate", "Common reasons"],
    s.learning.templates
      .filter((r) => r.flags > 0)
      .sort((a, b) => b.flags - a.flags)
      .slice(0, 20)
      .map((r) => [
        r.title,
        number(r.flags),
        number(r.answered),
        r.skipped === null ? "—" : `${(r.skipped * 100).toFixed(1)}%`,
        r.topReasons
          .map((reason) => `${reason.reason}: ${reason.count}`)
          .join(", "),
      ]),
  );
  const trialDepth = table(
    ["Answers reached", "Trials", "Share of started trials"],
    s.learning.trial.reached.map((r) => [
      number(r.answers),
      number(r.trials),
      r.share === null ? "—" : `${(r.share * 100).toFixed(1)}%`,
    ]),
  );
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>AMP acquisition and purchases</title><style>
  :root{font-family:Inter,system-ui,sans-serif;color:#172c3c;background:#edf2f6;font-synthesis:none}*{box-sizing:border-box}body{margin:0}main{max-width:1440px;margin:auto;padding:36px 24px 70px}header{margin-bottom:26px}h1{font-size:clamp(28px,4vw,44px);line-height:1.1;margin:8px 0 14px;letter-spacing:-.035em}h2{font-size:23px;margin:0 0 8px}h3{font-size:19px;margin:0 0 6px}.eyebrow{color:#236958;font-weight:750;letter-spacing:.09em;font-size:12px}.note{font-size:14px;color:#526574;line-height:1.6;margin:8px 0 18px}nav{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0}nav a{color:#164e63;background:white;border:1px solid #ccdae2;padding:9px 13px;border-radius:8px;text-decoration:none;font-size:14px}section{background:white;border:1px solid #d9e2e8;border-radius:14px;padding:24px;margin:20px 0;scroll-margin-top:16px}.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.card{padding:22px;background:#163e44;color:white;border-radius:12px}.card strong{display:block;font-size:36px;line-height:1.2}.card span{display:block;font-weight:600;margin-top:9px}.card small{display:block;font-size:12px;color:#cde2e3;line-height:1.5;margin-top:8px}.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13px}th{text-align:left;background:#f2f6f8;color:#46606e;font-size:12px;white-space:nowrap}th,td{padding:12px;border-bottom:1px solid #e6edf1;vertical-align:top}td{max-width:240px;overflow-wrap:anywhere}tbody tr:hover{background:#f7fafb}.empty{color:#657681;padding:20px 12px}.cost+.cost{border-top:1px solid #d9e2e8;margin-top:24px;padding-top:22px}.warning{background:#fff6df;padding:14px 18px;border-radius:9px;color:#72561d;font-size:14px;line-height:1.6}details{margin-top:18px;font-size:13px;line-height:1.6}summary{cursor:pointer;font-weight:650}@media(max-width:700px){main{padding:24px 14px}.cards{grid-template-columns:repeat(2,minmax(0,1fr))}.card{padding:16px}.card strong{font-size:30px}section{padding:18px 14px}th,td{padding:10px 8px}}@media print{body{background:white}nav{display:none}section{break-inside:avoid}main{padding:0}.cards{grid-template-columns:repeat(3,1fr)}}
  </style></head><body><main><header><div class="eyebrow">CORPORA · AMP</div><h1>Visits, ad costs and purchases.</h1><p class="note">Last ${s.days} UTC days through ${esc(s.generatedAt)}. Private aggregate report; refresh by regenerating the snapshot.</p><nav>${[
    ["traffic", "Traffic"],
    ["behavior", "Behavior"],
    ["purchases", "Purchases"],
    ["spend", "Ad costs"],
    ["feedback", "Feedback"],
  ]
    .map(([id, name]) => `<a href="#${id}">${name}</a>`)
    .join(
      "",
    )}</nav></header><div class="cards">${cards.map(([value, label, note]) => `<div class="card"><strong>${value}</strong><span>${label}</span><small>${note}</small></div>`).join("")}</div>
  <p class="warning">Browser IDs are not people. Unknown historical traffic may include testing. Invoice creation, parent submission and license activation are not proof of payment. The card and funded-payment totals measure different cohorts; they are not a single conversion rate.</p>
  ${section("traffic", "Where visits come from", "First-touch campaign and creative labels for browsers with recorded page activity. Existing visitors can retain an earlier campaign.", sources + '<h3>Recorded source labels</h3><p class="note">Browser IDs first seen in the selected window, including older records without page-time tracking. Unclassified traffic may include staff and testing; these are not verified customer counts.</p>' + recordedSources)}
  ${section("behavior", "What visitors do", "Active time stops after 60 seconds without input; hidden or unfocused pages do not accumulate visible time. Last observed screen does not prove abandonment.", screens + "<h3>Observed paths</h3>" + paths + "<h3>Marketing actions</h3>" + actions)}
  ${section("milestones", "Assessment and card-checkout milestones", "Counts show visitors who reached each milestone, not a compulsory sequence. Direct-entry visits can skip earlier screens. The visitor cohort starts in the selected UTC window.", progress)}
  ${section("card-purchases", "Card purchases by campaign", "Server-verified purchase events in the selected UTC days, using first-touch source, campaign and creative. Marked staff and automation are excluded. Unattributed purchases remain visible; unknown historical traffic can include tests. These are purchase counts, not net revenue or active licenses. Campaign-level refunds are unavailable in these anonymous records.", cardPurchases)}
  ${section("purchase-attempts", "Purchase attempts and errors", "Client-observed invoice creation/claim, funded request creation/status, ClassWallet checkout, card checkout and paid-plan claim requests. Repeated delivery of the same attempt and outcome counts once. A successful request is not proof of payment; missing final events do not establish abandonment. Polling requests are excluded.", purchaseAttempts + '<h3>Invoice and payment handoff</h3><p class="note">These are clicks on downloads, the funding provider, AMP setup or invoice correction. They do not prove a file was saved or that a program payment request was submitted.</p>' + purchaseActions)}
  ${section("purchases", "Funded purchase progress", "Invoices prepared in the selected UTC window, followed through the report snapshot. ¹Submission is parent-reported. Paid requires verified settlement. Mail accepted means accepted by the mail provider, not read by the parent.", purchase + '<h3>Access and actual use</h3><p class="note">Operational state cohorts include invoices created in the selected window, including testing and unattributed records. They are diagnostic counts, not campaign conversion totals.</p>' + delivery)}
  ${section("spend", "Advertising costs", "Provider-reported ad spend; credits and billing adjustments are not reconciled here. Each provider’s date window, timezone and click definition are shown. Cost per click uses that provider’s reported clicks, not website visitors. Missing or unmapped costs are not assigned to campaigns by guesswork.", spend + (missing.length ? `<p class="warning">Not imported: ${esc(missing.join(", "))}.</p>` : "") + '<p class="note">Compare these costs with the campaign and paid-payment tables above. No ROAS or customer-acquisition-cost claim is made when cost windows and purchase cohorts differ.</p>')}
  ${section("feedback", "Parent feedback and purchase hesitation", "Operational counts include testing. No individual messages, answers or learner identities appear here. Parent feedback is limited to the selected report window; problem and trial metrics follow their own report definitions.", feedback + "<h3>Reasons for dismissing purchase</h3>" + dismissal + "<h3>Reported problems</h3>" + problemReports + "<h3>How far trials get</h3>" + trialDepth)}
  <details><summary>Measurement definitions and coverage</summary>${[...e.definitions, ...f.definitions].map((d) => `<p>${esc(d)}</p>`).join("")}${table(
    ["Traffic class", "Browsers"],
    e.coverage.map((r) => [r.traffic_kind, number(r.browsers)]),
  )}${table(
    ["Purchase attribution", "Traffic class", "Prepared"],
    f.coverage.map((r) => [
      r.attribution_basis,
      r.traffic_kind,
      number(r.prepared),
    ]),
  )}</details>
  </main></body></html>`;
}
