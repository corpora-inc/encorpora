# Plan-page support

The plan card offers voluntary parent feedback. The shared footer provides one support email, including when plans are loading or unavailable. Payment and advertising preferences keep their existing behavior.

These screenshots use synthetic parent and payment fixtures. They are not real customer records or evidence of a live payment. The browser check uses the actual permission API and a local test database to exercise checkout without optional advertising permission, failed preference saves, retry, withdrawal and account isolation.

| Width | Light | Dark |
| --- | --- | --- |
| 320px | [Phone](closed-320-light.png) | [Phone](closed-320-dark.png) |
| 390px | [Phone](closed-390-light.png) | [Phone](closed-390-dark.png) |
| 768px | [Tablet](closed-768-light.png) | [Tablet](closed-768-dark.png) |
| 1280px | [Desktop](closed-1280-light.png) | [Desktop](closed-1280-dark.png) |

Run `AMP_TEST_DATABASE_URL=<local-test-database> npx tsx scripts/verify-checkout-privacy-ui.ts` from `amp/`. The command requires installed dependencies, Playwright Chromium and a disposable local PostgreSQL database accepted by the test database guard. It creates and removes its own schema; screenshots are written under `amp/artifacts/checkout-privacy-review/`.
