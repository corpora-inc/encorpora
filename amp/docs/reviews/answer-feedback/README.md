# Answer feedback review

Synthetic browser evidence for continuous AMP practice. The correct-answer card shows the practiced skill, earned XP and recent strength. Builds on and Leads to open direct, implemented graph connections. Each choice shows its curriculum grade or course above the skill title and requests one problem; Next resumes adaptive selection. Incorrect feedback offers foundations alongside its explanation.

`npm run test:answer-feedback-ui` verifies signed-in and trial practice at 320, 390, 768 and 1280 pixels in light and dark themes, including keyboard return from the connection picker, progress and navigation failures, and persisted feedback preferences. The API fixtures contain no real learner or account information.

The images below show the actual application with deterministic synthetic problems. Browser vibration availability is simulated for preference verification; physical haptic feel requires a supported device.

| Width | Light | Dark |
| --- | --- | --- |
| 320 | [Correct answer](account-320-light-correct.png) | [Correct answer](account-320-dark-correct.png) |
| 390 | [Correct answer](account-390-light-correct.png) | [Correct answer](account-390-dark-correct.png) |
| 768 | [Correct answer](account-768-light-correct.png) | [Correct answer](account-768-dark-correct.png) |
| 1280 | [Correct answer](account-1280-light-correct.png) | [Correct answer](account-1280-dark-correct.png) |

[Connected skills](trial-390-dark-connections.png) · [Incorrect answer](account-320-light-incorrect.png)

Connection dialogs show grade badges with readable skill titles and descriptions.

| Width | Light | Dark |
| --- | --- | --- |
| 320 | [Connected skills](account-320-light-connections.png) | [Connected skills](account-320-dark-connections.png) |
| 390 | [Connected skills](account-390-light-connections.png) | [Connected skills](account-390-dark-connections.png) |
| 768 | [Connected skills](account-768-light-connections.png) | [Connected skills](account-768-dark-connections.png) |
| 1280 | [Connected skills](account-1280-light-connections.png) | [Connected skills](account-1280-dark-connections.png) |
