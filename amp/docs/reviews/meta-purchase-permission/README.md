# Meta purchase preference review

These screenshots use synthetic accounts and a deliberately failed save request. The inline error retains the selected attestation and offers a retry without moving the controls. No real parent, learner, purchase or credential appears.

`npm run test:advertising-ui` exercises the real API and isolated PostgreSQL schema for both providers, including independent opt-in and withdrawal, a failed request followed by retry, reload/history, account switching during a request, and persistent withdrawal from browser privacy signals. It checks overflow and minimum control height at each viewport. The complete local output includes off/active/error views for both providers.

| Width | Light | Dark |
| --- | --- | --- |
| 320 | [View](error-320-light.png) | [View](error-320-dark.png) |
| 390 | [View](error-390-light.png) | [View](error-390-dark.png) |
| 768 | [View](error-768-light.png) | [View](error-768-dark.png) |
| 1280 | [View](error-1280-light.png) | [View](error-1280-dark.png) |

The transport uses mocked HTTP in these checks. This evidence does not establish live Meta ingestion or authorize advertising spend.
