# Parent consent enrollment

AMP provides a bounded email-plus workflow for deployments whose reviewed practices qualify for that method. Enrollment is disabled without an enabled, current database policy, matching server configuration, a private cryptographic secret and an explicitly supplied mail adapter. The repository includes no live mail provider, approved deployment policy or legal determination. Tests deliver only to an in-memory fixture.

A parent signs in, reviews the notice and supplies their own email address. The first message contains the complete notice and a link. An authenticated affirmative response schedules a second complete notice at least 24 hours later. A second affirmative response activates consent. Opening a link, provider acceptance, elapsed time and payment do not activate consent. No child profile is collected during this process. Creating learners and purchasing access remain separate actions.

The 24-hour delay is a product safeguard, not a statutory minimum or safe harbor. The additional affirmative response is also a product safeguard. Applicable law and the actual deployment's practices require independent assessment before enabling this method.

## Supported legal boundary

Research checked October 17, 2026 against the amended rule; eCFR displayed Title 16 through October 15. Email-plus is listed only for operators that do not disclose children's personal information within the rule's definition. An ordinary login, checkbox or email-verification flag is not the evidence implemented here. Material changes require renewed notice and consent. [16 CFR 312.5](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312/section-312.5)

A qualifying internal-operations provider is different from a recipient with independent uses. Calling a vendor a processor does not establish eligibility. Public profiles, advertising, independent-use analytics and other unsupported disclosure are outside this workflow. Separate consent for disclosure does not make email-plus an eligible method for that disclosure. [16 CFR 312.2](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312/section-312.2)

The FTC describes a delayed confirming message and a revocation notice but does not specify a numerical delay. The current rule controls if older FAQ wording differs. [FTC COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)

## Notice and deployment review

This notice contract supports a single operator; joint-operator deployments require a separately reviewed expanded notice contract. The strict policy contract requires actual operator name, postal address, telephone and email; public privacy and parent-account URLs; child-data categories, purposes and retention; service-provider identities, data, purposes and retention; review/deletion instructions; pending-contact and evidence periods. Both emails repeat that notice and explain withdrawal. The public privacy notice must also be published prominently at the relevant collection points; a configured URL alone does not prove publication. [16 CFR 312.4](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312/section-312.4)

Deployment review must inventory all operational flows, not just the application source:

| Flow | Application behavior | Required operational review |
| --- | --- | --- |
| Parent authentication | OIDC authorization-code login; access tokens in session storage; API verifies issuer/audience and remote JWKS | Actual identity provider, account/contact retention, terms, subprocessors and separation from child use |
| Learning service | First-party API stores account-linked learner nickname, generated problems, attempts and derived skill evidence | Hosting/database/backups, access logs, IP/device identifiers, staff access, deletion and security safeguards |
| Math and books | Local deterministic math generation and first-party book delivery; no per-question inference in this service | Hosting/CDN logs and any deployment-added scripts or telemetry |
| Consent email | Only parent recipient, complete notice and short-lived challenge; no child name or learning data | Selected provider's purpose restrictions, retention, security assurances, idempotency and delivery behavior |
| Stripe | Checkout sends an opaque checkout ID as metadata and client reference; AMP internally links it to a learner; provider collects adult billing data | Whether linked identifiers and provider uses meet the applicable disclosure boundary; do not assume eligibility from an opaque ID |
| Funded purchase | Parent downloads a quote with opaque learner reference and chooses how to submit it; no agency submission API | Actual program workflow and recipient uses; distinguish parent-directed submission from operator disclosure |
| Analytics/support | Reviewed web source has no external analytics request | Confirm deployed tags, error capture, support tools and log exports; unreviewed additions invalidate the inventory |

A reviewer must substantiate the contract assertions with private evidence. Code does not verify those assertions. Written security practices, designated responsibility, periodic risk assessment and service-provider assurances are operational prerequisites beyond these tests. [16 CFR 312.8](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312/section-312.8)

## Configuration and adapter integration

Apply migration `0009-parent-enrollment.sql`. A private policy file can be validated and installed with `AMP_DATABASE_URL=… npx tsx scripts/consent-policy.ts <private-file>`. This is an administrative state change, not an email-sending command. API startup never installs a policy: an obsolete server cannot re-enable a replaced database policy.

Load the matching file with `loadConsentPolicy`, construct `ConsentSecrets` from exactly 32 cryptographically random bytes kept outside the database, and create `ConsentRepository(pool, policy, secrets, transportEnabled)`. Missing configuration or a false transport flag rejects enrollment. Register `registerConsentRoutes` with the production authenticator. A worker calls `deliverConsentMail(repository, transport)` through a reviewed adapter implementing `ConsentTransport`. No provider endpoint or API is invented by this interface; provider selection and integration are separate deployment work.

The adapter must bound network time below the two-minute lease, protect message contents from logs, return `accepted` only after provider acceptance, classify definitive rejection separately, and return `unknown` on ambiguous network outcomes. It must preserve the supplied idempotency key across retries and establish provider behavior for deduplication. Workers retry ambiguity after five minutes, at most eight attempts within the request lifetime. Provider acceptance is not a delivery guarantee. A second affirmative response is required even after acceptance.

The API routes are authenticated `GET /api/v1/consent`, `POST /api/v1/consent/requests` and `POST /api/v1/consent/acknowledge`. They use strict request schemas, account ownership, bounded bodies and no-store responses. GET cannot consume consent authority. Per-account request limits and route limits bound accidental resend and abuse; operational abuse monitoring is still required.

`ParentConsentCenter` is an isolated workspace with `token`, stable `identity`, `onClose`, optional `onChanged`, and an optional `ConsentChallenge`. Call `takeConsentChallenge` before authentication/telemetry initialization: it removes the fragment immediately and returns an in-memory challenge. Do not persist it or put it in query parameters. If an external sign-in discards the challenge, sign in first and reopen the email link. The component requires an explicit response; it never submits on arrival. App mounting and sign-in return behavior must be verified by the integrating application.

## Evidence, concurrency and withdrawal

Each request binds its account, recipient hash, random nonce, complete notice, notice digest and deployment-policy digest. Separate derived keys protect recipient ciphertext, address binding and challenge generation. Tokens are recoverable from a private HMAC key and stored nonce for reliable delivery; this is not a hash-only storage design. Database records alone cannot recover the token or recipient. For secret rotation, disable the installed policy before changing the key and explicitly reinstall it afterward, creating a fresh policy generation that permanently retires pending links; active evidence does not require the delivery key.

Account advisory locks serialize initial/final responses, request replacement, withdrawal and privacy deletion. Exact consumed-token retries cannot create another transition. Replacement or withdrawal invalidates older challenges. The worker checks request and policy both while claiming and immediately before sending. A network send already in flight cannot be recalled; a late email can arrive after withdrawal, but its link cannot activate consent. A stale lease cannot overwrite a newer delivery result.

Effective learning authorization joins email-plus evidence to a completed request and the exact enabled, unexpired policy and its installation generation. Re-enabling an earlier policy does not revive requests invalidated by an intervening change. Policy disablement or replacement blocks learning and new annual/funded purchases through this method, including servers with stale configuration. Existing separately verified manual-consent records retain their own path. Annual billing also requires `AMP_STRIPE_CONSENT_POLICY_VERSION` to match the accepted notice version; a mismatch rejects a new purchase. The staff consent importer cannot fabricate the reserved self-service method.

Withdrawal and account-wide learning deletion cancel pending enrollment within the same account transaction. Parents retain account access to export, review, withdraw and request deletion without granting fresh learning consent. Export omits challenge material, encrypted recipient, address hash and private deployment-review references. [16 CFR 312.6](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312/section-312.6)

## Retention

The configured pending period is bounded to 2–14 days and must exceed the confirmation delay with room to respond. Recipient ciphertext is erased on completion, replacement or withdrawal. Expired uncompleted requests and their outbox records are deleted by `privacy:retention`. Completed evidence is kept while consent is active; withdrawal or policy invalidation starts its explicitly configured 1–730-day evidence period. After evidence deletion, the matching email-plus record becomes a minimal account-level do-not-collect preference: it retains no request pointer, consent notice version or verification proof. That preference lasts while the parent account exists so cleanup cannot accidentally restore collection. Existing manual evidence is not rewritten. These bounds are product limits, not legally mandated periods. The policy must state the concrete purpose and selected duration; schedule the cleanup job and review provider/back-up deletion too.

Policy invalidation is recognized by the retention job, which closes ineffective completed requests and starts their evidence period. The job processes bounded batches; operators must run it frequently enough to clear the backlog. A linked hash is not anonymous merely because it omits the address. The rule requires purpose-limited, documented retention, not indefinite storage. [16 CFR 312.10](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312/section-312.10)

## Future transaction-notification method

Annual checkout requires existing consent and a learner. Breaking that circularity requires a separate adult-only pre-enrollment purchase intent with no child profile or learning collection, a complete direct notice and a reviewed verification adapter. Evidence must establish that the supported payment system notifies the primary account holder of each discrete transaction. A generic Stripe success event, merchant receipt, zero-dollar trial or ESA transfer is not automatically that evidence. Only verified consent would permit learner creation; paid fulfillment would remain a separate ledger decision. This method is not implemented by the email-plus workflow. [16 CFR 312.5(b)(2)(ii)](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312/section-312.5)
