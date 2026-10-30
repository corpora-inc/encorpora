# Acquisition and founder correspondence

AMP's private operator pipeline joins signup attribution, trial starts, observed
activity, invoice preparation, checkouts, verified payments and personal email
history. PostgreSQL owns the contact queue and correspondence state. Gmail owns
the actual messages. A sent receipt means the sender's mailbox accepted a send;
it does not establish delivery, reading or conversion.

This is an operator tool, with no public HTTP endpoint, tracking pixel, frontend
bundle or mail scheduler. It requires privileged database access. All output
contains personal information and belongs in private storage, never in public
issues, CI logs, screenshots or source control.

## Contact coverage and timing

Each new acquisition signup creates an `amp_acquisition_contacts` row in the
signup transaction. Existing acquisition signups are backfilled by migration.
`report` exposes the count of signups missing a contact; this should be zero.
Returning users and staff accounts without an acquisition signup are excluded.
Authentication accounts outside that cohort appear as `unclassifiedAccounts`.
Review that list for missing enrollment or internal accounts; those addresses
are never automatically eligible for outreach.

Operator-confirmed account categories distinguish `friends_family`, `internal`
and `prospect` accounts independently of paid or complimentary access. Use
`classify-account` with `email`, a stable `eventKey`, `category` and a concise
`note` recording the basis. It works for accounts outside the acquisition cohort
without enrolling them in marketing or changing their access. Do not infer a
relationship from a name, address or free grant.

`classifiedAccounts` lists those decisions separately from `unclassifiedAccounts`.
The `acquisition_signups`, `missing_contacts` and `prospect_contacts` counts exclude
friends-and-family and internal accounts. Contact rows retain their history and
classification; non-prospects cannot claim welcome or follow-up outreach.
Explicitly approved replies retain the existing mailbox and eligibility checks.
An outstanding send must be reconciled before changing the account category.
Classification changes have an idempotent audit history; replaying an old command
does not restore its old category. They do not rewrite advertising attribution.
Active pilot grants, including older operator-issued grants, count as existing
complimentary access in the report and prevent prospect outreach.

The first review becomes due at noon on the day after verified signup. Arizona and Arkansas
campaigns provisionally use Phoenix and Chicago time; other sources use New York
time. The report labels these assumptions. Due time is a review target, not a
scheduled send. Unverified addresses, opt-outs, bounces, manual holds, changed
addresses and unresolved sends prevent sending. Replies require conversation
review. No second email is automatically scheduled when someone stays silent.

Founder-managed contacts are excluded from the generic welcome/reminder sequence,
including after an accidental restart of that worker. Authentication, security,
consent and purchase email are separate.

## Operator commands

Use `AMP_DATABASE_URL` from approved secret storage. Pass private JSON through
stdin, keeping addresses and bodies out of shell history:

```sh
npm run acquisition:pipeline -- report > /private/pipeline.json
npm run acquisition:pipeline -- apply < /private/command.json
```

Commands are validated by `pipelineCommandSchema` in
`src/acquisition/pipeline.ts`. Each mutation requires `email` and a stable
`eventKey`. Repeating the same command is idempotent. Reusing its key for different
evidence fails. The database records the command and its result in the contact's
audit history. Never fabricate mail evidence or an approval reference.

1. Reconcile the sender's complete relevant sent-mail and inbound searches,
   including archived mail and existing threads. Follow pagination. Import each
   historical sent receipt using `import-sent`: sender, recipient, subject,
   sentAt, messageId, threadId, purpose and intentKey. A first founder email uses
   purpose and intentKey `welcome`. Existing generic provider mail appears
   separately so reviewers can see both.
2. Record observed replies, opt-outs and bounces with `record-event`, including
   occurredAt, mailbox, messageId and threadId. A request for no further email
   suppresses outreach and the parent follow-up subscription. Import only the
   contact's evidence, not unrelated mailbox contents. After completing the
   check, record `mailbox_checked` with mailbox, occurredAt and `complete: true`.
   The database does not poll Gmail; repeat this reconciliation during each inbox
   review and immediately before sending. Its check timestamp makes staleness
   visible.
3. Prepare one single-recipient, plain-text Gmail draft with no CC, BCC or
   attachments. `save-draft` records its exact sender, recipient, subject, body,
   draftId, purpose and intentKey. Updating it clears prior approval. Present the
   complete message to the owner, then use `approve` with its ID, contentHash and
   a reference to the explicit approval. A hold or due date is not approval.
4. Read back the Gmail draft and verify that it exactly matches the database,
   including recipients and attachments. `claim` requires the approved ID and
   contentHash, a mailbox reconciliation within the last hour, a verified current
   address and contact eligibility. One concurrent claimant succeeds. A reply
   may bypass the first-welcome timing gate but still needs explicit approval.
5. Send the claimed draft once using the mail connector. Record `confirm-sent`
   with its ID, claimId and the actual sender, recipient, subject, sentAt,
   messageId and threadId. If the send result is uncertain, inspect Gmail before
   doing anything else. A claimed message stays in `sending`, blocks another
   send, and appears as `reconcile_send`. Replaying a claim does not authorize a
   retry. There is no expiring lease that silently sends it twice. After a
   complete mailbox check made after the claim, `reconcile-sent` can record the
   verified receipt without the lost claimId; include an investigation reference.
   If provider evidence establishes that the draft was never sent and no request
   remains in flight, `reconcile-unsent` takes that reference and the unchanged
   contentHash. It returns the message to draft and requires fresh approval.
   Absence from a partial search or a timeout is insufficient evidence.

`record-event` with `hold` or `release` requires a reason and can set
nextContactAt. A release removes only a manual hold; it cannot reverse opt-outs
or bounces. `cancel` is available for unsent, unclaimed drafts. A claimed send
cannot be cancelled without provider reconciliation; an operator must investigate
its receipt instead of replacing it with another welcome.

For follow-ups, use a deliberate unique intentKey and explicit approval. Sent
welcomes cannot be overwritten. Imported messages retain provider evidence;
imports do not invent missing draft content or historical approval records.

## Evidence and privacy

Attribution and funnel stages are read from their existing tables. Unknown
sources stay unknown. A campaign does not establish a recipient's residence,
funding eligibility, profession or age. Product activity is not sent to Gmail or
advertising platforms. This pipeline adds no per-page work.

Contact, message and audit rows cascade when the owning authentication account
is deleted. Parent data exports include correspondence state. Learning-data
deletion does not erase adult communication records or their suppression state.
Account classifications and their history are included in account exports and
cascade on authentication-account deletion.
Mailbox records follow the mailbox's own retention process; deleting a database
row does not delete a Gmail message. Private JSON snapshots are operator exports,
not the live queue.
