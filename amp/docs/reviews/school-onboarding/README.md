# School onboarding browser evidence

These screenshots use disposable local schools, accounts and learners. They show direct classroom setup, explicit pilot activation, the aggregate buyer handoff and Clever connection states. Clever responses in the connection-state browser test are fixtures; this evidence does not establish provider certification.

Run from `amp/` with `AMP_TEST_DATABASE_URL` pointing to a dedicated test database:

```sh
npm run test:school-onboarding-ui
```

The browser suite exercises setup and import retries, pilot expiry, administrator versus teacher actions, Excel uploads, provider sessions, staged district adoption, buyer activation and failed-request recovery. Screenshots and overflow checks cover 320, 390, 768 and 1280 pixels in light and dark themes. Generated captures are in `artifacts/school-pilot`, `artifacts/school-connect` and `artifacts/school-adoption`.

| Setup width | Light | Dark |
| --- | --- | --- |
| 320 | [View](school-pilot-setup-320-light.png) | [View](school-pilot-setup-320-dark.png) |
| 390 | [View](school-pilot-setup-390-light.png) | [View](school-pilot-setup-390-dark.png) |
| 768 | [View](school-pilot-setup-768-light.png) | [View](school-pilot-setup-768-dark.png) |
| 1280 | [View](school-pilot-setup-1280-light.png) | [View](school-pilot-setup-1280-dark.png) |

| Moment | Evidence |
| --- | --- |
| Class ready to start | [Phone](school-pilot-ready-320-dark.png), [desktop](school-pilot-ready-1280-light.png) |
| Buyer handoff | [Phone](school-pilot-buyer-page-390-light.png), [desktop](school-pilot-buyer-page-1280-dark.png) |
| Connected roster | [Phone](school-connect-ready-390-light.png) |
| Provider invitation requested | [Desktop](school-connect-provider-invitation-1280-dark.png) |
