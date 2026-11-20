# Complimentary AMP access

An access gift reserves one month or one year of full practice for an email address. The recipient does not need an AMP account or learner profile when the gift is issued. Share `https://amp.corpora.inc/access`; the link contains no recipient information or secret code.

The recipient signs in with the invited address and confirms ownership of that address. AMP finds the reservation and asks who is learning; there is no consent step. Creating the first learner activates the gift in the same database transaction. If they have assessment progress on the device, adopting that assessment preserves its learner identity and progress. An existing account can choose a learner without active access.

The term starts on activation, not on issuance or sign-in. A year means 12 calendar months; dates at the end of a month are clamped to the destination month’s final day. There is no automatic renewal or payment collection for a gift. A gift covers one learner, not every learner in an account, unless it is a family gift. A learner gift the parent took for their own practice before adding any child also covers the first child added without access, with its own `email-gift:<gift>:<learner>` grant to the same end; the parent keeps theirs. It happens once per gift, through any route that adds a child, and revoking the gift ends both grants. A gift the parent chose while a child already existed stays theirs alone.

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

Add `"covers": "family"` for a family gift; the default is `"learner"`. A family gift covers every child of the account that activates it, each with its own `email-gift:<gift>:<learner>` grant for the same term, and any child added while it lasts gets a grant to its end in the transaction that adds them, unless a paid enrollment is waiting to be assigned. The parent's own practice is free while a child has access, so it covers them too. `/access` activates it without a learner choice; with no child yet, adding the first one starts it. A child's existing grant is kept, never shortened. The gift row records the learner it was activated for (the first child when none was chosen) and that learner's grant. Revoking it ends every grant it made. Changing `covers` on a retry is a reference conflict.

To revoke a pending or activated gift, supply a private file containing:

```json
{
  "action": "revoke",
  "id": "b24d441b-38d5-42ec-ae99-dbe186b1ffba"
}
```

Revocation disables only that gift’s access. It does not cancel paid subscriptions or withdraw consent.

## Access and consent are separate

A gift is not a purchase, proof of consent, or permission to collect more learner information. It is access, so it needs no consent of its own: the learner takes it on the basis they already learn on, through `purchaseConsentSatisfied` in `src/server/account-access.ts`. That is the account's own adult, a learner 13 or older (outside COPPA, [16 CFR 312.2](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312/section-312.2)), a child on the restricted internal-operations basis ([16 CFR 312.5(c)(7)](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312/section-312.5)), or verified consent. A family gift starts for every child the same way. Only a withdrawn consent for a named child under 13 refuses it ([16 CFR 312.6(a)(2)](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312/section-312.6)).

Gift matching uses the verified email in AMP’s account identity store. It compares lowercase addresses without removing dots or `+` suffixes. An unverified account cannot discover or activate an invitation: the gift is found by its address, so confirming the address is what binds it to its recipient. Without it, signing up with someone else's address would take their gift. This is a binding, not a consent step. Caller-supplied email addresses never authorize activation. Legacy OIDC identities without an AMP account email are not eligible for email matching.

The authenticated account owns an activated gift even if its email later changes. Activation is idempotent: retries return the original learner and dates. Reassigning it to another learner is rejected. Deleting the learner removes the learner/grant references while retaining the consumed award record, so deletion cannot restart the term. The account data export includes its activated gifts and reservations for its currently verified email.

## Paid plans and future giveaways

Gifts stay reserved for learners who already have active or future access, or an open Stripe checkout/subscription. An unassigned paid enrollment completes its own assignment before a new learner can automatically consume a gift. The welcome page identifies that paid setup explicitly. Complimentary activation writes a `pilot` grant with an `email-gift:` reference; it creates no payment, paid enrollment, or advertising purchase event.

A future giveaway can issue the same records after selecting winners, using a campaign identifier and a stable award reference per winner. Entry collection, eligibility, selection and notification are separate concerns. The access system does not implement a contest or send invitation emails.
