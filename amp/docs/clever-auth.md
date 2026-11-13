# Clever sign-in

Clever staff sign in with their provider identity even when Clever supplies no email address. Their canonical AMP account is `amp|<uuid>`, the same account identifier shape used for mailbox accounts. The provider principal adapter leaves Better Auth users and their existing IDs intact. A Clever profile email is neither mailbox proof nor an account-linking key.

Register Clever OAuth with the exact AMP origin and `/api/v1/school/sso/clever/callback` redirect path. The server requires a client ID, client secret and explicit sandbox or production environment. Credentials belong in deployment secret storage. The authorization code is exchanged only after a single-use, browser-bound state record is claimed. A Portal callback without AMP state restarts authorization; its original code is discarded. User access tokens are used to read `/v3.0/me` and that user's profile, then discarded.

Teacher, staff and district administrator identities can enter onboarding before a roster exists. Contacts receive no staff authority. An imported student must already resolve to an active school learner and receives the ordinary isolated student token. Imported staff attach to their canonical account by provider subject on login or the next session check after sync. Existing AMP role checks determine which schools and classes staff can access; provider roles do not grant blanket district authority.

Staff sessions last two hours. Disconnects, archived provider bindings and ended AMP staff roles stop bound access on the next request. OAuth completion replaces a previous adult login on that browser. A verified completion fragment also clears a previous student capability; a guessed marker cannot reveal an older adult session. Signing in with a mailbox explicitly revokes the previous provider session. The browser keeps provider session tokens in memory, while the server cookie is HttpOnly, SameSite=Lax and Secure on HTTPS.

Linking a new Clever identity to an existing mailbox account requires an explicit same-origin request, a verified mailbox and the same recently authenticated session at both ends of OAuth. Independently populated accounts are not merged. A school-only account does not need mailbox confirmation to teach; parent consent and purchase operations still require a verified mailbox.

Account deletion requires a sign-in within ten minutes. It erases the provider principal, provider identity, all sessions and pending account-link proofs. The separate school pilot ledger retains a one-way eligibility reference derived from provider, environment, district and subject, so recreating an account cannot restart a pilot. That reference grants no access and is never used to merge accounts.

Validation: `npm run tsc`, `npm run test:core`, `AMP_TEST_DATABASE_URL=<fixture-url> npx tsx --test tests/clever-auth.integration.ts tests/accounts.integration.ts`, and `npx tsx scripts/verify-clever-session-ui.ts`.
