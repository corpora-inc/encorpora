# Purchase privacy before checkout

The plan screen offers independent Google and Meta adult purchase-sharing choices in a collapsed section below the checkout action. Neither is required to buy. The disclosures and preference API are shared with Family → Privacy. An explicitly requested preference save finishes before checkout opens; a failed save leaves checkout available. Preference controls are disabled while checkout opens.

Run `AMP_TEST_DATABASE_URL=<dedicated-test-database> npx tsx scripts/verify-checkout-privacy-ui.ts` from `amp/`. The script uses the real PlanStep, preference API and PostgreSQL persistence with synthetic parent accounts. Billing offers, enrollment responses and the Stripe destination are fixtures: this does not verify a real charge or advertising-provider delivery.

The script checks purchase without opt-in, unchecked independent choices, failure/retry, persisted grants, withdrawal, refresh, account isolation and checkout locking. It measures overflow, touch-target height and save-control geometry during pending/error states. No customer information appears in the screenshots.

| Width | Light: collapsed / failed Meta save | Dark: collapsed / failed Meta save |
| --- | --- | --- |
| 320 | [Collapsed](closed-320-light.png) · [Error](error-meta-320-light.png) | [Collapsed](closed-320-dark.png) · [Error](error-meta-320-dark.png) |
| 390 | [Collapsed](closed-390-light.png) · [Error](error-meta-390-light.png) | [Collapsed](closed-390-dark.png) · [Error](error-meta-390-dark.png) |
| 768 | [Collapsed](closed-768-light.png) · [Error](error-meta-768-light.png) | [Collapsed](closed-768-dark.png) · [Error](error-meta-768-dark.png) |
| 1280 | [Collapsed](closed-1280-light.png) · [Error](error-meta-1280-light.png) | [Collapsed](closed-1280-dark.png) · [Error](error-meta-1280-dark.png) |
