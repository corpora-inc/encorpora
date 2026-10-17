# AMP product and supplier application draft

**Unsent draft.** Complete bracketed fields in a restricted copy. Do not publish private tax, banking or signer records. This draft describes candidate offerings, not an accepted price, funded SKU, provider approval or guarantee of learning outcomes.

## Product description for review

AMP is a parent-managed mathematics practice and reading product from Corpora. Learners answer generated problems, receive explanations and practice selected skills at an adjusted level. A parent can review recent independent and assisted attempts. Original downloadable books combine worked examples, diagrams, practice space and reasoned answers. The catalog includes *Fraction Field Guide* and *The Equal Groups Workshop*; verify the exact included editions against the release manifest supplied with the application.

The product is self-paced software and instructional material. It does not provide a live teacher, private-school enrollment, therapy, accredited course credit or proctored testing. The released catalog covers selected skills; it must not be marketed as complete K–12 coverage, a complete grade-level course, or a guarantee of a perfect SAT score. Proposed future content is excluded from the evidence packet.

## Candidate products to classify separately

| Candidate identifier (not a live SKU) | Deliverable | Required decision |
| --- | --- | --- |
| AMP-PRACTICE-STUDENT | One learner's access to the listed released practice catalog | Approved category, fixed term or contract-year term, price, activation date, renewal behavior |
| AMP-BOOK-FRACTIONS | Specified edition of the Fraction Field Guide PDF | Download and personal-print rights, access/delivery proof, post-term retention policy, price |
| AMP-BOOK-GROUPS | Specified edition of The Equal Groups Workshop PDF | Same rights and delivery decisions for this separate title |
| AMP-PRACTICE-BOOKS | Explicitly itemized combination of approved components | Bundle approval, component price allocation and category/cap treatment |

Physical printing, binding, shipping, devices, tokens and unrelated credits are excluded. Do not imply that a PDF is a shipped printed book. Do not call an included component free merely to disguise its allocation. The same offering's public and funded prices require an approved pricing policy; no final price is supplied here.

The proposed annual access term requires channel review. Arizona's evidence requires contract-year handling; Florida and Texas activation-based terms are unresolved. No automatic renewal charge is proposed for a funded order. Parent and student access, downloadable-book retention, transferability and refund/revocation terms must be approved before an application promises them.

## Reusable application answers

| Field | Draft answer or private placeholder |
| --- | --- |
| Organization | Corpora Inc — [confirm exact legal spelling and entity record] |
| DBA/product brand | [confirm AMP / ¡AHA! brand and any DBA registration] |
| Principal address and telephone | [verified legal business address and operating support telephone] |
| Authorized contact/signatory | [name, role, authority evidence, work email] |
| Tax evidence | [restricted W-9/EIN record identifier; never insert tax ID into this repo] |
| Banking | [restricted verified account record; provide only through authenticated administrator onboarding] |
| State registration | [jurisdiction, registration/certificate identifier, effective date, private document reference] |
| Website and sample access | [deployed HTTPS product page, privacy notice, terms, support page, read-only reviewer demo] |
| Product/service category | Educational software or instructional products, subject to the program's exact classification; not tutoring |
| Educational purpose | Practice selected mathematics skills with explicit explanations, representations and original written lessons |
| Delivery | [reviewed parent activation instructions and exact downloadable edition; channel-specific delivery evidence] |
| Pricing and taxes | [approved SKU, price, discounts, tax determination, fees and effective date] |
| Support and refunds | [published operating hours, response target, complaint path and channel-approved refund terms] |
| Accessibility | [dated test report and actual supported limitations; do not claim an unaudited certification] |
| Privacy/security | [deployed data-flow inventory, notices, verified parent-consent method, processor/retention review] |

## Reproducible product evidence

From `amp/`, run:

```sh
npx tsx scripts/provider-dossier.ts 2026-10-17 > /tmp/amp-provider-evidence.json
```

Use the actual review date for a new submission. The default is today's UTC date and evidence older than 90 days fails. The output inventories actual template identifiers/versions/skill links and authored book editions/page counts/content hashes. It is an unsent draft, not a statement that every file is deployed or every template has every desired response type. Attach the output with the source commit SHA, actual deployed PDF manifest and independently reviewed sample artifact hashes; do not replace missing deployment evidence with source counts.

Provide a sample learner journey for each product: one independent problem, an incorrect answer with explanation, a related original book page, a printable task and its reasoned answer. Attach standards/skill mappings with partial coverage labeled and evidence of content review. Have the reviewer reproduce the sample against the same release. Preserve numeric-response limitations and unassessed reasoning requirements from the coverage audit instead of turning a mapping into a mastery claim.

## Program-specific application questions to resolve

Arizona: obtain the full registration form; confirm digital-product category, exact contract-year dates, named-student invoice transmission, marketplace versus Direct Pay, fees and refunds.

Florida: provide the selected product list and reviewer demo; obtain the actual Mirakl/Ariba onboarding invitation, catalog schema, PEP and FES-UA decisions separately, digital delivery and credit procedures. Do not use the service-provider route for this self-paced product.

Texas: use Educational Products registration evidence; confirm the exact software/application/curriculum category and cap treatment, downloadable-license eligibility, digital fulfillment proof, portal-only document policy and settlement/credit arrangement.

The evidence supporting these questions and application entry points is in the [program dossiers](README.md). No application has been submitted through this workflow.
