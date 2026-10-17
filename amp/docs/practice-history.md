# Practice history

Your progress shows the learner's recorded work across the implemented mathematical ideas. Practiced lists ideas with answers on record; Review lists ideas whose suggested review time has arrived; Explore offers implemented ideas the learner has not tried. The area selector narrows any of these lists. Planned curriculum skills without an implemented problem family are not presented as available practice.

Each idea shows problems tried, answers correct independently, and up to five recent observations in recorded order. A check means independently correct; a diamond means help was used, including an answer that was incorrect; a circular arrow means an independent answer was incorrect. These counts describe observed work. They do not certify mastery, grade completion, or a standardized-test score.

Opening an idea offers one focused problem and related instruction. The next generated batch returns to the learner's mixed practice. Opening instruction that supports an unanswered problem records assistance. A related book opens at its remembered reading position; a reference lesson returns directly to the selected idea. Filters and position survive these reading visits.

Review suggestions use the same durable evidence as mixed practice. Several answers in one sitting do not count as several spaced recalls. Successful independent retrievals at least six hours apart can extend the suggested interval; an incorrect or assisted answer brings the idea back for practice. A suggested time is an invitation, not a deadline or a diagnosis of forgetting. The information panel shows that time and the history update time.

The normal phone interface uses bounded pages of cards and a focused detail view. Text enlargement uses a scrollable reading surface when the content exceeds the physical display. Keyboard focus returns to the invoking card or reading control. A failed refresh retains the last available history, labels its update time, and provides a retry. Switching accounts or learners clears the prior learner's view; delayed responses cannot restore it.

The existing authenticated progress endpoint returns an additive `asOf` timestamp and a minimal projection of recent observations. Internal problem and attempt identifiers are excluded. Ownership, consent, and learner deletion checks apply to this endpoint just as they do to practice.

Run `npm run test:progress-ui` with `AMP_TEST_DATABASE_URL` pointing to an isolated migrated test database. The browser check seeds synthetic evidence, exercises the actual application and API, and deletes its learners afterward. `AMP_BROWSER=webkit` selects WebKit. The check uses local ports 4400 and 4401; it must not run against a live family database. The database integration suite separately verifies the evidence projection and ownership boundaries.
