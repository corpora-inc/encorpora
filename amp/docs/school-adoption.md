# Bring an existing AMP school into a district

School adoption moves a standalone school's existing records under a district. Learners keep their IDs, work and progress. Classes keep their IDs, join codes and pilot associations. Licenses and pilot deadlines do not restart.

Both institutions authorize the move. The district must have an active school data agreement and an AMP administrator. The school approves through its administrator. A teacher may approve their own standalone pilot school only if they created it and all its classes, teach every active class and student, and no other staff member has access. A school name or email domain never establishes ownership.

## Approval and review

1. A district administrator opens **School connections**, selects the district and copies its invitation link.
2. The school owner opens that link, chooses the school and approves sharing its records with the named district.
3. The owner shares the resulting approval link with a district administrator. It expires after seven days and can be withdrawn before acceptance.
4. The district administrator opens the approval, reviews the counts and resolves any eligible staff matches, then selects **Add school to district**.

The server checks both parties' current authority again when accepting. If the receiving administrator's role comes only from Clever, AMP verifies the current provider role before displaying the school's records and again when accepting. A school approval cannot move records to another district. An approval link does not grant administrator access.

Staff records may be combined only when they belong to the same signed-in AMP account and neither record holds a learner. The district must confirm each pair. Learners are never combined by name or email. Conflicting source identifiers, unrelated existing identities, cross-institution memberships or an existing source connection require review before anything moves.

## Match a staged Clever connection

When connecting Clever for a school that already uses AMP, prepare the connection without importing its roster. Complete the school approval before the first import.

The district review offers the actual schools, people and sections shared by Clever. Select the school's Clever record, then explicitly match each existing active person and class. Matching choices show available grade, class, teacher and course names. If two choices are indistinguishable, correct the roster names or context before selecting a match. AMP checks roles, class membership, unique matches and existing identity bindings against a fresh provider snapshot when accepting.

Every active source person and class must be matched for this route. If a record is missing from Clever, correct the district's sharing settings or move the school while keeping its existing manual roster. A Clever connection that has already imported a different school or learner record requires separate review; the adoption operation does not guess which records should be combined.

After acceptance, open the Clever connection and import the roster. The reviewed school, person and class IDs are reused. Clever maintains the matched memberships, including ending them when the provider removes them. Unmatched manual memberships remain independently managed. Existing learning evidence is preserved.

## Implementation and verification

- `src/schools/adoption.ts`: current-authority checks, transaction locks, conflict review and record moves.
- `src/schools/adoption-routes.ts`: authenticated API; approval capabilities travel in request bodies.
- `src/web/features/school/AdoptionScreen.tsx`: owner approval, district review and Clever matches.
- `tests/school-adoption.integration.ts`: authorization, revocation, concurrency guards, preserved records, source collisions and first Clever sync.
- `scripts/verify-school-adoption-ui.ts`: real-account approval and acceptance, reload, failed-request recovery and responsive screenshots.

The approval is stored as a hash. The browser removes its fragment before sign-in and keeps it only in tab-scoped session storage for the handoff. Source names and approval tokens do not belong in logs. Account deletion removes its approval grants; deleting an institution removes grants that refer to it.
