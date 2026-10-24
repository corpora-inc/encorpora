# Complimentary AMP access

An access gift reserves one month or one year of full practice for an email address. The recipient does not need an AMP account or learner profile when the gift is issued. Share `https://amp.corpora.inc/access`; the link contains no recipient information or secret code.

The recipient signs in with the invited address and confirms ownership of that address. AMP finds the reservation, guides them through the existing consent requirements, and asks who is learning. Creating the first learner activates the gift in the same database transaction. If they have assessment progress on the device, adopting that assessment preserves its learner identity and progress. An existing account can choose a learner without active access.

The term starts on activation, not on issuance or sign-in. A year means 12 calendar months; dates at the end of a month are clamped to the destination month’s final day. There is no automatic renewal or payment collection for a gift. A gift covers one learner, not every learner in an account.

## Issuing a gift

Use the operator command with a private JSON file and the deployment’s configured database connection. Recipient addresses and operational connection details must not be committed, pasted into public issues, or included in screenshots.

```json
{
  "email": "recipient@example.test",
  "months": 12,
  "source": "manual",
  "reference": "invitation-unique-reference"
}
```

```sh
npm run access:grant -- /private/path/access-gift.json
```

`months` accepts `1` or `12`. `source` defaults to `manual`. The combination of `source` and `reference` identifies one award: retrying identical input returns that award; changing its recipient or terms is rejected. Reuse the reference when retrying an import. Use a new reference only for an intentional additional gift.

Optional `campaign` records the origin of an award. Optional `claimBy` is an ISO timestamp after which an unused gift cannot be activated. Omitting it leaves the reservation available until activation or revocation. The command prints the gift ID, status and invitation path, without printing the email address.

To revoke a pending or activated gift, supply a private file containing:

```json
{
  "action": "revoke",
  "id": "b24d441b-38d5-42ec-ae99-dbe186b1ffba"
}
```

Revocation disables only that gift’s access. It does not cancel paid subscriptions or withdraw consent.

## Access and consent are separate

A gift is not a purchase, proof of consent, or permission to collect learner information. All existing server consent checks apply before learner creation, adoption and activation. If the configured consent workflow requires email confirmation or a waiting period, that requirement applies; the gift remains reserved during that time. A disabled consent workflow cannot be bypassed by issuing a gift.

Gift matching uses the verified email in AMP’s account identity store. It compares lowercase addresses without removing dots or `+` suffixes. An unverified account cannot discover or activate an invitation. Caller-supplied email addresses never authorize activation. Legacy OIDC identities without an AMP account email are not eligible for email matching.

The authenticated account owns an activated gift even if its email later changes. Activation is idempotent: retries return the original learner and dates. Reassigning it to another learner is rejected. Deleting the learner removes the learner/grant references while retaining the consumed award record, so deletion cannot restart the term. The account data export includes its activated gifts and reservations for its currently verified email.

## Paid plans and future giveaways

Gifts stay reserved for learners who already have active or future access, or an open Stripe checkout/subscription. An unassigned paid enrollment completes its own assignment before a new learner can automatically consume a gift. The welcome page identifies that paid setup explicitly. Complimentary activation writes a `pilot` grant with an `email-gift:` reference; it creates no payment, paid enrollment, or advertising purchase event.

A future giveaway can issue the same records after selecting winners, using a campaign identifier and a stable award reference per winner. Entry collection, eligibility, selection and notification are separate concerns. The access system does not implement a contest or send invitation emails.
