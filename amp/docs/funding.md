# Public funding and pricing research

This internal operating document describes how Corpora can sell an annual,
per-student math curriculum through public education purchasing programs. The
inventory review date is October 17, 2026; individual source dates are recorded separately. It is not an eligibility determination, provider
approval, application submission, or promise that a family will be reimbursed.

The machine-readable inventory in `src/funding/registry.ts` covers all 50 states
and DC. It contains 86 researched channel records with program-authority or administrator evidence, including parent curriculum purchases, tuition-first programs, tuition-only school scholarships, family tax benefits and institutional purchasing routes. These are not 86 marketplaces. All six platform-discovered leads have program-specific authority evidence. Every jurisdiction remains partially researched: the records establish named routes, not exhaustive local coverage or the absence of other programs. See [the national review](national-funding-review.md) for scope, purchasing distinctions and operating limitations.
All Corpora vendor, SKU and listing stages are `not-applied`, and payment setup is
`not-configured`. These are project workflow defaults, not an investigation of
Corpora's historic registrations; reconcile existing business records first.

## Initial channels and approval gates

Pursue Arizona ESA, Florida PEP and FES-UA, and Texas TEFA as the first wave.
This is a prioritization hypothesis based on product/channel fit, not a measured
forecast of revenue. Prepare Alabama, North Carolina and West Virginia next.
Each program requires four independent records: vendor approval, specific SKU
approval, marketplace listing, and payment capability. Platform registration
cannot substitute for any of these approvals.

| Channel | Verified fact | Required next action |
| --- | --- | --- |
| Arizona ESA | ADE distinguishes Marketplace, Direct Pay and reimbursement and links vendor registration. | Verify annual curriculum classification and whether Direct Pay can precede ecommerce integration. |
| Florida PEP | Educational app subscriptions are permitted; a multi-user purchase can be prorated when a single-user option exists. | Confirm a one-student, 12-month SKU and approved term boundaries. |
| Florida MyScholarShop | Instructional products use the supplier channel; Find Providers serves services such as tutoring. | Seek product supplier onboarding and separate PEP/FES-UA product eligibility. |
| Texas TEFA | Applications are rolling; vendors and offerings are reviewed. Online/out-of-state providers can participate after approval. | Confirm business-registration requirements and submit the curriculum through Odyssey. |
| Alabama CHOOSE | ALDOR approval precedes ClassWallet registration; software and curriculum are expense categories. | Confirm annual digital license terms and required provider attestations. |
| NC ESA+ | Products must be purchased in its ClassWallet marketplace; not every marketplace item is allowable. | Obtain the curriculum product path; do not offer reimbursement as a universal fallback. |
| West Virginia Hope | Public provider listings require approved marketplace offerings. | Verify current platform and full product application/payment rules. |

Official references: [Arizona](https://www.azed.gov/esa/classwallet),
[Florida PEP purchasing guide](https://www.stepupforstudents.org/handbook-web/pep-purchasing-guide/),
[MyScholarShop](https://www.stepupforstudents.org/scholarships/myscholarshop/),
[Texas TEFA](https://educationfreedom.texas.gov/providers-vendors/),
[Alabama provider guide](https://classwallet.com/alchoose/assets/CHOOSE_ACT_education_service_provider_guide_2026-2027.pdf),
[NC ESA+](https://k12.ncseaa.edu/the-education-student-accounts/current-families/allowable-expenses/),
[West Virginia directory](https://hopescholarshipwv.gov/Home/Schools/Participating-Schools/portalid/7).

Step Up describes supplier interest, vetting, an onboarding call, Ariba setup,
questionnaire, test catalog, test orders/invoices/credit memos, and live catalog
publication. Its page contains overlapping process descriptions: obtain the
current onboarding checklist before implementing the integration.
[Step Up supplier onboarding](https://www.sufs.org/schools-and-providers/vendors/)

ClassWallet supports ecommerce plugins, cXML and Pay by ClassWallet API, with a
percentage processing fee. The actual contracted fee must be obtained;
program administrators determine whether purchases qualify.
[Integration](https://classwallet.com/ecommerce-vendor-integration/),
[approval authority](https://classwallet.com/frequently-asked-questions/)

Texas PDSES is a separate one-time $1,500 grant for eligible public-school
students receiving special education, with an educational goods/services
marketplace. It belongs in the inventory alongside ESAs.
[TEA resources](https://spedtex.tea.texas.gov/resources/pdses-resources)

The national records distinguish a program's operating status from the availability of a family application window. Closed programs have no purchasing routes; uncertain current-year operation is retained as a research task. Annual digital-license eligibility is unconfirmed unless the cited authority supports the category, and even then the specific term and Corpora SKU require confirmation.

## Application dossier and fulfillment design

Prepare the following reusable dossier; the application for each program decides
which items are required. Keep financial identifiers and signed documents in a
restricted system, not this public repository.

- Legal entity name, business address, EIN/W-9, authorized signer, relevant
  business registrations, and secure bank settlement details.
- Product title, SKU/version, actual released grade/skill coverage, annual term,
  per-student license, price, included PDF rights, device and offline requirements.
- Curriculum scope/sequence and standards crosswalk; representative lessons,
  problem explanations, printable workbook and answer key; content review process.
- Privacy and security materials, parent account/consent flow, accessibility
  statement with tested limitations, support channels and delivery instructions.
- Invoice/receipt examples, tax treatment, channel-specific refund and renewal
  policies, fulfillment evidence, reconciliation and reporting procedures.

Recommended SKU: one named learner's 12-month access to the released math
curriculum and its listed downloadable materials, managed by a guardian account.
Use precise released coverage rather than promising an unbuilt K–12 catalog.
Document whether downloaded PDFs can be retained after the subscription ends;
confirm that license policy with each purchasing program before listing.
Do not include transferable tokens, in-game credits, family-wide pooled balances,
or unrelated benefits in a publicly funded SKU.

For each order retain program/year, approved SKU/version, purchaser and learner
references, external order ID, license dates, line amounts/tax, approval evidence,
fulfillment and activation timestamps, settlement identifiers and refund history.
Minimize student information and retain only the documentation the program and
business require. A submitted or reserved order is not settled cash. Use reviewed
manual import/fulfillment until the supplier contract and technical interface are
available; do not invent a universal ESA checkout API.

Issue guardian activation instructions and record delivery/redemption. MyScholarShop
instructs families to expect supplier access instructions at their primary email.
[Digital subscription FAQ](https://www.sufs.org/faq/)
Refunds must follow the originating program and payment channel. Odyssey requires
refund approval through its support process; do not return scholarship funds as
cash or credits to a family by default.
[Odyssey vendor refunds](https://support.withodyssey.com/hc/en-us/articles/33948374261275-How-To-Report-A-Refund)

## Pricing experiment proposal

No final price is set. Evaluate a single annual student SKU against products
parents can actually buy; public funding is a purchasing channel, not a reason
to inflate the same offering's price.

As checked October 16, 2026, ALEKS lists a 12-month individual subscription at
$179.95 and a monthly option at $19.95. Its subscription permits course switching
but one active course at a time. Beast Academy's help page lists online access at
$99.99/year and an online-plus-one-level-printed-books bundle at $160. These are
reference points with different coverage and formats, not equivalent products or
recommended ¡AHA! prices. Recheck checkout prices before using them in a study.
[ALEKS pricing](https://www.aleks.com/buy_aleks_now),
[Beast Academy bundles](https://help.beastacademy.com/a/1792549-ways-to-save-on-subscriptions-and-books)

1. Interview 24 parents: six in each of AZ ESA, Florida PEP/FES-UA, Texas TEFA,
   and self-pay. Recruit across remediation and acceleration needs. Show the
   same working sample and one printable lesson; ask what they currently use,
   their actual annual spending, the hardest purchasing step, and what would
   justify switching. Record the alternative they would choose, not only praise.
2. Ask each parent for too-cheap, good-value, expensive-but-considerable and
   prohibitively-expensive annual prices before revealing benchmarks. Separate
   publicly funded and self-pay responses. This small sample discovers objections;
   it does not establish population willingness to pay.
3. Derive three candidate prices from the observed acceptable range, bounded
   below by contribution costs. Model platform fees, app-store fees where relevant,
   support time, content QA amortization, hosting, refunds and acquisition cost.
   Keep ESA and IAP economics separate. Reject any option requiring implausible
   renewal or unsupported enrollment volume to break even.
4. Offer the same released product and benefits to a consented pilot, presenting
   the three candidate prices as research before selecting one published pilot
   price. Do not charge an ESA or claim reimbursement while approval is absent.
   Once an eligible channel is operational, record paid conversion and actual
   time from purchase to activation and settlement.
5. Measure activation within seven days, four-week practice retention, parent
   support minutes, invoice rejection, refunds, and contribution per paid learner.
   Treat subscription intent and funded-wallet balances as separate from sales.
   Set scale thresholds from observed pilot economics before buying acquisition.

The research owner must report sample selection, unsuccessful purchases, parent
objections, costs, and uncertainty along with conversion. Do not launch a
perfect-score guarantee: measure learning outcomes and substantiate claims
against the released curriculum and assessment evidence.

## National inventory maintenance

For every jurisdiction research ESA/scholarship programs, special-needs grants,
public and charter-school purchasing, homeschool-charter curriculum purchasing,
and district/library group licenses. Tuition-only and inactive programs should
be documented as inapplicable with evidence, not silently deleted. District
procurement is a separate sales motion and does not confer parent reimbursement.

Add source-linked facts and explicit unknowns, with checked and effective dates
where available. The registry stores source-check dates, purchase models, operating status and separate onboarding evidence. Effective policy periods are recorded in source-linked facts. Recheck before
any application, public eligibility claim or purchase; audit warnings after 90
days are maintenance reminders, not a safe-harbor period. Keep all approved SKUs,
written approval evidence, expiration dates, actual listings and payment tests in
the operating system of record. The registry audit detects broken references,
missing states, unsupported approval metadata and stale sources. It cannot prove
legal eligibility, source accuracy or completeness of national research.
