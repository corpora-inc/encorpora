# Checkout without advertising prompts

The plan screen presents pricing, the parent notice and payment. It does not ask for Google or Meta advertising permission, create a permission, or wait for advertising-preference saves. Existing choices and withdrawal controls are available in Family → Privacy. Provider delivery continues to require valid permission covering the purchase; purchasing alone does not authorize sharing.

Run `AMP_TEST_DATABASE_URL=<dedicated-test-database> npx tsx scripts/verify-checkout-privacy-ui.ts` from `amp/`. The check uses the real PlanStep, registered privacy API and a disposable PostgreSQL schema with synthetic accounts. Offers, payment responses and the Stripe destination are fixtures; it does not charge a card or contact an advertising provider.

The check verifies absent advertising prompts and preference requests, no permission creation, required parent acknowledgement, payment failure and retry, account isolation, touch targets and overflow.

| Width | Light | Dark |
| --- | --- | --- |
| 320 | [Phone](closed-320-light.png) | [Phone](closed-320-dark.png) |
| 390 | [Phone](closed-390-light.png) | [Phone](closed-390-dark.png) |
| 768 | [Tablet](closed-768-light.png) | [Tablet](closed-768-dark.png) |
| 1280 | [Desktop](closed-1280-light.png) | [Desktop](closed-1280-dark.png) |
