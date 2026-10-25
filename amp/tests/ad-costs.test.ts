import test from "node:test";
import assert from "node:assert/strict";
import { adCostsSchema, costTotals } from "../src/analytics/ad-costs.js";
const source = {
  platform: "google",
  observedAt: "2026-10-25T05:00:00Z",
  from: "2026-10-22",
  through: "2026-10-24",
  timeZone: "America/New_York",
  currency: "USD",
  clickMetric: "ad_clicks",
  rows: [
    {
      id: "campaign-1",
      label: "Fixture campaign",
      utmSource: "google",
      utmCampaign: "ar-efa-launch",
      impressions: 100,
      clicks: 5,
      spendMicros: 4540000,
    },
  ],
};
test("cost snapshots preserve native windows and exact reported spend", () => {
  const totals = costTotals(adCostsSchema.parse({ sources: [source] }));
  assert.equal(totals[0].spendMicros, 4540000);
  assert.equal(totals[0].costPerClickMicros, 908000);
  assert.equal(totals[0].timeZone, "America/New_York");
  assert.equal(
    costTotals(adCostsSchema.parse({ sources: [{ ...source, rows: [] }] }))[0]
      .costPerClickMicros,
    null,
  );
  assert.deepEqual(costTotals({ sources: [] }), []);
});
test("duplicate or ambiguous cost input is rejected instead of double-counted", () => {
  for (const input of [
    { sources: [source, source] },
    { sources: [{ ...source, rows: [source.rows[0], source.rows[0]] }] },
    { sources: [{ ...source, through: "2026-10-01" }] },
    { sources: [{ ...source, timeZone: "not-a-zone" }] },
    {
      sources: [
        { ...source, rows: [{ ...source.rows[0], utmCampaign: undefined }] },
      ],
    },
  ])
    assert.equal(adCostsSchema.safeParse(input).success, false);
});

test("unreconciled campaign cost never becomes zero or a partial total", () => {
  const unresolved = {
    ...source,
    note: "Campaign spend conflicts with account billing.",
    billing: { amountMicros: 18140000, label: "Outstanding balance" },
    rows: [
      ...source.rows,
      { ...source.rows[0], id: "campaign-2", spendMicros: null },
    ],
  };
  const result = costTotals(adCostsSchema.parse({ sources: [unresolved] }))[0];
  assert.equal(result.spendMicros, null);
  assert.equal(result.costPerClickMicros, null);
  assert.equal(result.clicks, 10);
  assert.equal(result.billing?.amountMicros, 18140000);
  assert.equal(
    adCostsSchema.safeParse({ sources: [{ ...unresolved, note: undefined }] })
      .success,
    false,
  );
});
