# School onboarding browser evidence

These screenshots use disposable local schools, accounts and learners. They show direct classroom setup, explicit pilot activation, the aggregate buyer handoff and Clever connection states and district roster matching. Clever responses in the connection-state browser test are fixtures; this evidence does not establish provider certification.

Run from `amp/` with `AMP_TEST_DATABASE_URL` pointing to a dedicated test database:

```sh
npm run test:school-onboarding-ui
```

The browser suite exercises real account creation and email verification, setup and import retries, pilot expiry and partial coverage, administrator versus teacher actions, Excel uploads, AnySchool requests, provider sessions and shared-device handoffs. It also covers signer reuse with explicit class authorization, scoped buyer-link recovery and editing, and district adoption with distinguishable roster matches. Screenshots and overflow checks cover 320, 390, 768 and 1280 pixels in light and dark themes. Generated captures are in `artifacts/school-pilot`, `artifacts/school-connect` and `artifacts/school-adoption`.

| Setup width | Light | Dark |
| --- | --- | --- |
| 320 | [View](school-pilot-setup-320-light.png) | [View](school-pilot-setup-320-dark.png) |
| 390 | [View](school-pilot-setup-390-light.png) | [View](school-pilot-setup-390-dark.png) |
| 768 | [View](school-pilot-setup-768-light.png) | [View](school-pilot-setup-768-dark.png) |
| 1280 | [View](school-pilot-setup-1280-light.png) | [View](school-pilot-setup-1280-dark.png) |

| Moment | Evidence |
| --- | --- |
| Class ready to start | [Phone](school-pilot-ready-320-dark.png), [desktop](school-pilot-ready-1280-light.png) |
| Connected roster | [Phone](school-connect-ready-390-light.png) |

| Connection and adoption moment | Evidence |
| --- | --- |
| Delayed roster import | [Phone](school-connect-import-delayed-390-light.png) |
| AnySchool request recorded | [Phone](school-connect-anyschool-requested-390-light.png), [desktop](school-connect-anyschool-requested-1280-dark.png) |
| Paused connection recovery | [Phone](school-connect-paused-proof-390-dark.png) |
| District reviews a school's request | [Phone](school-adoption-district-review-390-dark.png) |
| Same-name learners and classes | [Phone](school-adoption-duplicate-name-matching-390-dark.png), [desktop](school-adoption-duplicate-name-matching-1280-light.png) |

The [50,000-student worker measurement](clever-worker-50000.json) records source fingerprints, query counts, memory observations and identity/access checks. Its fixture and limitations are explained in the [performance guide](../../clever-performance.md).
