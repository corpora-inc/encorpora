# Parent signup and assessment emails

Parents create a free AMP account before the assessment. Google, Microsoft, GitHub and Apple appear when configured; passkey and email options provide alternatives. No payment is required. The next screen asks for a starting birth year, then opens adaptive practice with the configured free allowance (100 problems by default).

Use `/sign-up?return=free-practice&program=ar-efa` for Arkansas ads and `program=az-esa` for Arizona. The signup page explains the free assessment, funding availability and email follow-up. Authentication preserves validated campaign labels and the funding program. Device practice resumes after signup; saving progress to a learner profile uses the parent-consent and adoption flow.

Ads targeting both states can use the fixed entry labels `openai-math-path` and `openai-math-plans`. These identify the creative without assigning a state. A campaign's target state is acquisition context, not proof of the parent's residence or funding eligibility.

The parent’s verified identity owns the acquisition record. Original ad click references remain in the existing first-party attribution store. A later purchase can use that reference when the parent returns without the original browser cookie. Signup method comes from the completed authentication flow. A selected starting birth year is a parent’s demo choice, not a verified household age. Learner answers and progress are not included in signup measurement.

## Email choices

The signup page shows one line under the form: “We’ll email you about AMP. Unsubscribe anytime.” with a link to the privacy policy. Signing up opts the parent in to the welcome email, the next-day reminder and occasional math problems, tips, videos and AMP news. There is no checkbox. The intent records notice `free-parent-account-v2`; records from the earlier unchecked-box page keep `free-parent-account-v1`. Opting in does not start a bulk mailing or grant a scholarship. A scholarship invitation requires an actual license grant.

A later sign-in never re-subscribes a parent who unsubscribed. Only an explicit v1 checkbox opt-in, sent by a page loaded before the change, can do that.

Only verified addresses receive mail. Unsubscribe links stop optional mail without changing learning access or account-security messages. Purchases and activated scholarships suppress the trial sequence. Repeated sign-ins do not restart it. Unknown delivery outcomes retry the same immutable message with the same provider idempotency key; unresolved outcomes stop before that key expires.

## Operations

Set `AMP_PARENT_FOLLOWUP=enabled`, the existing `AMP_ACCOUNTS_URL`, `AMP_MAIL_FROM`, `AMP_MAIL_RESEND_API_KEY`, and the company’s deliverable `AMP_PARENT_FOLLOWUP_POSTAL_ADDRESS` in private runtime configuration. Schedule `npm run parent:followup` every minute. The job sends at most 20 due messages per run and removes expired signup intents. Run only one production schedule; stage uses synthetic recipients and transport stubs.

Google signup measurement uses `npm run advertising:signup` with private `AMP_GOOGLE_SIGNUP_CONFIG` and the existing `AMP_GOOGLE_MEASUREMENT_CREDENTIALS`. The signup destination must be a separate registration conversion action, with no purchase value. The job records new, verified parent registrations only, deduplicates them, retries with a stable transaction reference and checks provider processing status. Accepted ingestion is not proof of ad attribution. Ad collection withdrawals and expiry remove the associated export payloads. Purchases keep their separate measurement path.

The optional newsletter is a stored preference. This implementation does not send newsletters, problems, scholarship offers or social videos automatically.
