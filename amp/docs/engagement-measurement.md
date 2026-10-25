# First-party engagement measurement

AMP records acquisition context and categorized page engagement to explain where
visitors enter, what they use, and where their observed activity stops. These
records complement server-verified purchase and funded-invoice reports.

Run `npm run report:engagement -- 7` in `amp/` with `AMP_DATABASE_URL` supplied
through the deployment's secret configuration. The output contains aggregate
screen visits, browser counts, first-touch source/campaign, active seconds, and
screen transitions. It never prints visitor or session identifiers. Run
`npm run report:funnel` for product and card-purchase milestones and
`npm run report:campaign` for funded invoice, payment, and activation cohorts.
Do not sum these different reports as if they represented distinct people.

## Collection and interpretation

A document load starts a random session. Navigation inside the application starts
an ordered page visit; reloading starts another document session. This is not a
30-minute marketing-session definition. Routes are reduced to a fixed vocabulary;
raw URLs, query strings, form contents, keystrokes and learner identifiers are not
stored in page records. Source, medium and campaign use the existing constrained
UTM vocabulary. Entry context is captured on every application entry route,
including direct links into practice. The browser's first recorded source wins;
subsequent direct navigation does not replace it.

Each page sends cumulative visible and active milliseconds at entry, every 15
seconds, on navigation, and when hidden or leaving. Visible time requires a
visible, focused document. Active time stops 60 seconds after input; opening a
page starts the initial 60-second interval. Only the presence of an interaction
is measured, never its contents. Timer gaps longer than 60 seconds are excluded
as suspension. Duplicate or out-of-order snapshots take the maximum of each
counter instead of adding time again. Missing delivery can undercount time.
These counters estimate engagement, not attention or learning outcomes.

The production marketing site uses the same random browser identifier as AMP
through a secure first-party cookie scoped to `corpora.inc`. Validated entry
campaign labels are stored alongside it before collection, so a delayed marketing
request cannot turn a paid arrival into an internal referral. No identifier is
placed in links. Existing local identifiers are retained unless the browser
already has a shared cookie. Older records under a different identifier are not
retroactively joined. Cookie refusal can prevent cross-site correlation.

`AMP_CAMPAIGN_SITE_ORIGIN` enables the marketing collector for exactly one HTTPS
origin. It accepts only categorized marketing page snapshots and fixed actions;
it cannot record trial answers or purchases. Previews do not load this collector.
The production site build bundles `/assets/engagement.js` from shared source.

Reports include source, medium, campaign and creative (`utm_content`), marketing
actions, and observed transitions between documents. An action UUID prevents
retries from counting the same action twice. Cross-document order uses the
arrival order of the first snapshot for each page. Delayed requests and concurrent
tabs can change that order; it is not a precise chronological recording.
The older aggregate campaign counters are a separate series and can include tests;
use the engagement report's filtered browser counts for marketing-site activity.

Browser IDs are not unique people. A final observed screen is not necessarily
abandonment. An invoice-form click is not an invoice, and an invoice is not a
paid purchase. Page counters are stored separately from milestone events in
`amp_engagement_pages`, avoiding heartbeat inflation in event funnels.

## Separate tests from customer activity

Automated browsers declaring `navigator.webdriver` are marked `automated`.
For a staff browser, set `localStorage['amp.analytics.traffic'] = 'internal'` on
either the marketing or AMP origin before testing. The next analytics request
shares the marker with the other origin. The marker persists on that browser. It is not a
security credential and is never used to authorize access. Once a browser is
marked internal or automated, retained records for that browser stay excluded
from customer reports even if the marker is removed. A fresh browser profile is
required for a separate customer simulation.

External means not marked as staff or automation; it is not proof of a human.
Older unclassified records have `unknown` traffic kind and may include tests.
The report exposes coverage by traffic kind so uncertainty is visible. Historical
durations and missing acquisition context are not reconstructed.

Collection and optional checkout-attribution headers honor browser Do Not Track
and Global Privacy Control. Native shells
do not send web funnel events. Events and engagement records follow the 90-day
funnel retention policy. Page records expire independently even for browsers that
continue visiting; deleting a visitor also deletes its page records. No page
engagement or learner activity is exported to an advertising platform.

## Verification

- `node --import tsx --test tests/engagement.test.ts`
- `npm exec -- vitest run --environment jsdom src/web/lib/__tests__/analytics.test.ts src/web/lib/__tests__/engagement.test.ts`
- With a dedicated `AMP_TEST_DATABASE_URL`, run
  `node --import tsx --test tests/funnel.integration.ts` and
  `npm run test:engagement-ui`. Never use production or the shared preview
  database as a test target.
- With the same dedicated test database, run
  `node --import tsx --test tests/site-journeys.integration.ts` and
  `npm run test:site-journeys-ui`.
  The browser fixture intercepts every request, exercises both HTTPS origins with
  the actual browser collectors, and sends events only to its isolated database.

The browser check drives the actual application and collector against a temporary
PostgreSQL schema, verifies SPA navigation, attribution and automated-traffic
exclusion, and confirms that Do Not Track suppresses collection.
