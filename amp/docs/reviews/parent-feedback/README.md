# Parent feedback interface

The voluntary parent-feedback sheet opens from the invoice and purchase flows. It keeps the typed message visible when delivery cannot be confirmed; retrying uses the same request identifier. Closing the sheet does not cancel a send already in progress.

These synthetic browser captures show the failed-response state at 320, 390, 768 and 1280 pixels in light and dark themes. No customer, account or payment data is present. The browser verification uses the real feedback API and a disposable local database schema. It deliberately loses the response after the server stores the message, retries, and checks that only one record exists. It also checks validation, dismissal without submission, Escape, support-link visibility, touch targets and horizontal overflow.

Run `AMP_TEST_DATABASE_URL=<dedicated-fixture-database> npm run test:parent-feedback-ui` from `amp/`. The database must be a disposable test target, not the shared preview or production database. Other API responses are synthetic; this script does not verify payment processing.

| Width | Light | Dark |
| --- | --- | --- |
| 320 | [View](320-light-retry.png) | [View](320-dark-retry.png) |
| 390 | [View](390-light-retry.png) | [View](390-dark-retry.png) |
| 768 | [View](768-light-retry.png) | [View](768-dark-retry.png) |
| 1280 | [View](1280-light-retry.png) | [View](1280-dark-retry.png) |
