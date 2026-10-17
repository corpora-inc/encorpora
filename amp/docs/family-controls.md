# Parent family controls

AMP provides authenticated parent controls for learner names, consent withdrawal, learning-data deletion and a downloadable family data export. The controls use the same parent identity as practice and billing. They are accessible after consent withdrawal; a child or another parent cannot select an account ID in the request to act on someone else's records.

`FamilyCenter` is a standalone React component. The application supplies `token`, `onChanged(summary)`, `onLearningInvalidated()` and `onClose`. Immediately after confirmed withdrawal/deletion, `onLearningInvalidated()` runs before any refresh. The host must clear any active question and cached learning results, use the returned non-deleted learners, and keep the family center available when consent is withdrawn. The component does not change the browser's identity-provider account or claim to cancel a subscription.

## Parent choices

- **Edit name** updates the display name without duplicating the learner, changing access or rewriting past mathematical evidence. A parent may correct a name after consent withdrawal.
- **Download family data** exports the account's learners, generated problem records, answers, licenses, commerce orders/events, linked Stripe purchase identifiers and recent privacy activity. Private verification evidence and other families' records are excluded. The file is NDJSON: one JSON record per line, with an initial manifest and a final `complete` record. It is a data portability file, not a printable curriculum book.
- **Withdraw consent** prevents further learning transactions and learner creation. Existing records remain available to the parent for review/export/deletion. It does not cancel renewal or automatically delete learning data. Verified re-consent uses the documented consent-administration process; a generic browser checkbox does not replace parental verification.
- **Delete learner learning data** removes the learner's name, generated problems and attempts from the live database. Other learners are unaffected. If financial references exist, an opaque learner ID remains with the display label “Deleted learner,” allowing billing and refund reconciliation. The deleted profile cannot practice or start a new purchase.
- **Delete all learning data** performs that removal for all learners and withdraws consent. Parent authentication and necessary financial references remain available. This is deliberately labeled learning-data deletion, not account erasure.

A linked Stripe purchase displays a billing-management action and an explicit renewal warning before and after deletion. The family center does not infer that a subscription is canceled from an expired grant or a deleted learning profile. Stripe's portal provides authoritative renewal management. Other purchase channels require their provider's management process. Account recovery, identity-provider erasure, external payment-provider deletion and automated consent verification are outside these controls.

## Server integration and transaction guarantees

`registerFamilyRoutes(app, {pool, authenticate, development})` queues the family routes before Fastify starts listening. `authenticate` verifies parent identity without imposing a consent gate. The API exposes:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/v1/family` | Consent, owned learners and billing-reference summary |
| POST | `/api/v1/family/learners/:learnerId/rename` | `{name}` |
| POST | `/api/v1/family/consent/withdraw` | Empty JSON object |
| POST | `/api/v1/family/learners/:learnerId/delete-learning-data` | `{confirmation:"delete-learning-data"}` |
| POST | `/api/v1/family/delete-learning-data` | Same explicit confirmation |
| POST | `/api/v1/family/export-ticket` | Request a browser download ticket |
| GET | `/api/v1/family/export` | Stream an authorized export |
| POST | `/api/v1/family/export/revoke` | Revoke the browser cookie capability, including after sign-out |

All learning writers acquire `pg_advisory_xact_lock_shared(hashtextextended(accountId,0))` before learner locks and recheck consent inside the transaction. Parent privacy mutations and the consent-administration command acquire the corresponding exclusive account lock, then learner locks in sorted ID order. A transaction that started first can finish before withdrawal commits; no new learning write can pass the consent check after withdrawal commits. Deleted learners are excluded from practice and purchase authorization even after later re-consent.

Financial reconciliation may write to a deleted learner's opaque reference. It cannot restore their name, problems or history, and a paid grant cannot bypass the deleted-profile guard. Deletion retains payment evidence rather than silently orphaning a renewal or refund. The underlying commerce ledger is append-only; it is not rewritten to pretend a financial event never occurred.

## Streaming export

The browser first authenticates a POST to obtain a one-use download ticket. The server stores only a SHA-256 digest and sets a 60-second HttpOnly, SameSite=Strict cookie scoped to the export path. Hosted cookies require HTTPS. Export credentials never appear in a URL, DOM attribute or local storage. The native browser download then consumes the ticket atomically. Bearer-authenticated GET is also supported for tooling. The host must revoke pending export cookies on sign-out or account changes using the revoke endpoint; no bearer token is required to remove this capability. The component also revokes a ticket response that arrives after it unmounts or its account changes. Revocation cannot recall a file already delivered to the browser.

A repeatable-read PostgreSQL snapshot and cursors fetch at most 100 records at a time. The application does not collect the complete history in memory or build a browser Blob. Download aborts close the cursor transaction and release the connection. Individual statements have a 15-second timeout; an idle snapshot expires after 30 seconds and the whole download is bounded to two minutes. The final `complete` record is written only after successful traversal. An interrupted or exceptionally large export can be retried; bulk archival delivery beyond these limits needs a separately authorized asynchronous export job.

The commerce ledger's JSON projection is a separate scaling limit: cursor batching bounds application memory but does not make that projection suitable for millions of financial records. Normalize the ledger before high-volume deployment. Do not advertise unlimited-size exports based only on the cursor implementation.

## Retention and deletion boundaries

Privacy audit rows record account ID, action, opaque learner ID where applicable, count and time. They do not copy names, answers or verification documents. They expire after 90 days. Export ticket digests expire after 60 seconds. Schedule `npm run privacy:retention` daily to remove expired audit rows and tickets, and monitor successful completion. The command does not delete financial evidence or modify learning histories.

Learning deletion removes live database rows. A deployment must separately define and publish its backup retention, external processor deletion, financial retention and identity-provider erasure procedures. Do not represent this API as immediate erasure from backups or payment processors. On backup restoration, reapply deletion/withdrawal records before serving learning traffic; a restored backup must not resurrect deleted profiles. A documented restoration/reconciliation process and operator ownership are public-launch requirements, not capabilities implemented by this API.

The FTC describes parental rights to review/delete children's information and refuse further collection, and requires a written retention/deletion policy. These controls support those rights; they do not certify legal compliance or establish that a particular retention period is required by law. See the [FTC six-step guidance](https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business) and [COPPA frequently asked questions](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions).

## Verification

Run `npm test`, `npm run tsc`, `npm run build`, and `npm run test:family-ui`. With `AMP_TEST_DATABASE_URL` set to a development database, run `npm run test:db`. The family integration test creates an isolated schema and verifies cross-account rejection, a 205-record cursor export, private-evidence exclusion, consumed/expired tickets, concurrent withdrawal and learning writes, deletion with paid billing references, and access after withdrawal. Browser verification checks 320/390/1280-pixel layouts, confirmation focus, rename, native download, withdrawal and retained billing controls using synthetic responses.

Production acceptance also requires a real parent identity/recovery journey, a real merchant billing portal, scheduled retention with alerts, documented backup behavior, and a support process for identity/account deletion and financial disputes. Keep the hosted-launch guard in place until those deployment-specific flows are verified.

The browser regression also holds a rename refresh while the component unmounts or the token changes, proving that a late response cannot notify the host with another account's state. It forces a refresh failure after confirmed withdrawal and verifies that the success message and immediate learning invalidation survive that failure. The database test executes the retention purge and verifies that financial grants remain intact.
