import type { DossierInventory } from "./dossier.js";

/** Parent tax claims and one district PO route; no vendor or SKU approval. */
export const idOkAkDossiers: DossierInventory = {
  checkedOn: "2026-10-17",
  sources: [
    {
      id: "id-current-code",
      url: "https://legislature.idaho.gov/statutesrules/idstat/Title63/T63CH30/SECT63-3029N/",
      publisher: "Idaho Legislature",
      locator:
        "Current code with 2026 chapter 302 amendment; subsections 2(a)/(f), 4, 10 and 16; retrieved directly, not inferred from amendment markup",
      checkedOn: "2026-10-17",
    },
    {
      id: "id-tax-proof",
      url: "https://tax.idaho.gov/taxes/income-tax/individual-income/popular-credits-and-deductions/parental-choice-tax-credit-and-advance-payment/",
      publisher: "Idaho State Tax Commission",
      locator:
        "Qualifying expenses and Proof of expenses: multiple developers from 2026, paid invoice fields, no expense prequalification; award is not expense approval",
      checkedOn: "2026-10-17",
    },
    {
      id: "id-next-window",
      url: "https://myschoolchoice.idaho.gov/how-to-apply/",
      publisher: "State of Idaho / My School Choice",
      locator:
        "Step 6 identifies January 15–March 15, 2027 for 2026 credit or 2027 advance; earlier Form 40 steps describe the prior cycle",
      checkedOn: "2026-10-17",
      authorityLink:
        "https://tax.idaho.gov/taxes/income-tax/individual-income/popular-credits-and-deductions/parental-choice-tax-credit-and-advance-payment/",
    },
    {
      id: "id-family-faq",
      url: "https://myschoolchoice.idaho.gov/faqs/",
      publisher: "State of Idaho / My School Choice",
      locator:
        "Program Basics and Application Process: award versus expense approval, one advance per child, 2026 advance reconciliation, public enrollment distinctions",
      checkedOn: "2026-10-17",
      authorityLink:
        "https://tax.idaho.gov/taxes/income-tax/individual-income/popular-credits-and-deductions/parental-choice-tax-credit-and-advance-payment/",
    },
    {
      id: "ok-homeschool-rules",
      url: "https://oklahoma.gov/content/dam/ok/en/tax/documents/resources/publications/individuals/pctc/710-Chapter-50-TEXT-PCTC.pdf",
      publisher: "Oklahoma Tax Commission",
      locator:
        "Current linked rules PDF, 15 physical pages; printed pp. 1–2 definitions and pp. 8–9 section 710:50-15-173, including shared subscription example; private-school rules are separate",
      checkedOn: "2026-10-17",
    },
    {
      id: "ok-homeschool-faq",
      url: "https://oklahoma.gov/tax/individuals/parental-choice-tax-credit/pctc-taxpayers.html",
      publisher: "Oklahoma Tax Commission",
      locator:
        "HOMESCHOOL TAX CREDIT and homeschool FAQ only: no application, claim on tax return with receipts; private-school EVN/window does not govern this route",
      checkedOn: "2026-10-17",
    },
    {
      id: "ok-homeschool-form-2025",
      url: "https://oklahoma.gov/content/dam/ok/en/tax/documents/forms/tax-credits/591-D.pdf",
      publisher: "Oklahoma Tax Commission",
      locator:
        "Actual retrieved two-page PDF is Form 591-D 2025 although landing link says 2024; Part 3 vendor/description/date/amount and per-student receipts. Not a verified 2026 form",
      checkedOn: "2026-10-17",
    },
    {
      id: "ak-district-directory",
      url: "https://education.alaska.gov/alaskan_schools/corres/correspondence-directory",
      publisher: "Alaska Department of Education and Early Development",
      locator:
        "Galena City School District – IDEA entry identifies a statewide district correspondence program and links its website; not statewide vendor approval",
      checkedOn: "2026-10-17",
    },
    {
      id: "ak-correspondence-scope",
      url: "https://education.alaska.gov/alaskan_schools/corres",
      publisher: "Alaska Department of Education and Early Development",
      locator:
        "District-supported correspondence versus independent homeschooling; district directory entry point",
      checkedOn: "2026-10-17",
    },
    {
      id: "ak-idea-vendor",
      url: "https://www.ideahomeschool.org/contact-locations/vendor-info/curriculum",
      publisher: "Galena City School District / IDEA",
      locator:
        "Curriculum Provider Info: PO-list review/W-9, invoice and Net 30 terms, fiscal and order windows; list explicitly is not vendor endorsement",
      checkedOn: "2026-10-17",
      authorityLink:
        "https://education.alaska.gov/alaskan_schools/corres/correspondence-directory",
    },
    {
      id: "ak-idea-allotment",
      url: "https://www.ideahomeschool.org/about/allotment",
      publisher: "Galena City School District / IDEA",
      locator:
        "Current undated allotment page lists textbooks/workbooks, apps and online courses; no exact AMP decision or annual term",
      checkedOn: "2026-10-17",
      authorityLink:
        "https://education.alaska.gov/alaskan_schools/corres/correspondence-directory",
    },
  ],
  dossiers: [
    {
      programId: "id-parental-choice",
      applicationUrl: "https://myschoolchoice.idaho.gov/how-to-apply/",
      requirements: [
        {
          dimension: "vendor",
          finding: "requirement-established",
          summary:
            "This is a parent tax-credit/advance route. The reviewed process establishes parent application and award requirements, not a Corpora marketplace listing or vendor approval.",
          sourceIds: ["id-tax-proof", "id-next-window"],
        },
        {
          dimension: "software-subscription",
          finding: "unresolved",
          summary:
            "Software is not separately established by the reviewed qualifying-expense guidance.",
          sourceIds: ["id-tax-proof"],
          unresolvedQuestion:
            "Does this exact adaptive math license qualify as an instructional curriculum component or another statutory expense?",
        },
        {
          dimension: "digital-curriculum",
          finding: "category-supported",
          summary:
            "For 2026 onward, curricula may come from multiple developers, with the required four-core academic instruction considered together. A math product alone does not satisfy that complete instruction requirement.",
          sourceIds: ["id-current-code", "id-tax-proof"],
        },
        {
          dimension: "printable-download",
          finding: "unresolved",
          summary:
            "Textbooks are listed, but downloaded PDF editions and personal-printing licenses have no specific determination.",
          sourceIds: ["id-tax-proof"],
          unresolvedQuestion:
            "How are the named digital books classified and documented as part of the eligible instruction?",
        },
        {
          dimension: "bundle",
          finding: "unresolved",
          summary:
            "A software/book bundle has no exact classification; a parent award does not preapprove its contents.",
          sourceIds: ["id-tax-proof"],
          unresolvedQuestion:
            "Which components qualify, and must their prices be itemized separately?",
        },
        {
          dimension: "term",
          finding: "unresolved",
          summary:
            "The statute restricts claims during public-school enrollment semesters; a rolling annual license has no verified allocation rule.",
          sourceIds: ["id-current-code", "id-family-faq"],
          unresolvedQuestion:
            "How must a license spanning tax years or eligible/ineligible semesters be allocated?",
        },
        {
          dimension: "listing",
          finding: "requirement-established",
          summary:
            "The cited URL is parent application guidance, not a vendor application. The 2026 credit/2027 advance window is January 15–March 15, 2027.",
          sourceIds: ["id-next-window"],
        },
        {
          dimension: "payment",
          finding: "requirement-established",
          summary:
            "The family purchases; its credit or advance is a separate state process. Award notification does not establish product eligibility or merchant settlement.",
          sourceIds: ["id-tax-proof", "id-family-faq"],
        },
        {
          dimension: "invoice",
          finding: "requirement-established",
          summary:
            "Paid documentation identifies provider, expense, amount, payment status and payment date. An unpaid AMP quote is not this evidence.",
          sourceIds: ["id-tax-proof"],
        },
        {
          dimension: "refund",
          finding: "unresolved",
          summary:
            "No merchant-specific refund or partial-license tax-allocation rule was established.",
          sourceIds: ["id-family-faq"],
          unresolvedQuestion:
            "What corrected paid evidence must accompany a refund or shortened term, and how does the family reconcile it?",
        },
      ],
      readinessGaps: [
        "Confirm exact software, PDF and bundle classifications without representing math-only materials as four-core instruction.",
        "Define eligible term allocation and an itemized paid receipt/credit-note workflow; do not treat a quote or tax award as payment.",
        "Verify the applicable 2026 return/2027 award instructions before providing a submission checklist. No tax returns, SSNs or family tax eligibility evidence belong in the public supplier packet.",
      ],
      applicationStatus: "unsent",
      offerEnabled: false,
    },
    {
      programId: "ok-homeschool-credit",
      applicationUrl:
        "https://oklahoma.gov/tax/individuals/parental-choice-tax-credit/pctc-taxpayers.html",
      requirements: [
        {
          dimension: "vendor",
          finding: "requirement-established",
          summary:
            "The homeschool route is claimed on the parent tax return without an application. Education service provider includes a business supplying educational goods/services; private-school registration is a different route.",
          sourceIds: ["ok-homeschool-rules", "ok-homeschool-faq"],
        },
        {
          dimension: "software-subscription",
          finding: "category-supported",
          summary:
            "The homeschool rule explicitly uses an online-learning subscription as an example: a shared purchase cost can be claimed only once, even if two students benefit. This is not an AMP decision.",
          sourceIds: ["ok-homeschool-rules"],
        },
        {
          dimension: "digital-curriculum",
          finding: "category-supported",
          summary:
            "Eligible categories include curriculum and instructional materials. Curriculum means a complete course for a content area or grade; bounded AMP books must not be advertised as complete K–12 coverage.",
          sourceIds: ["ok-homeschool-rules"],
        },
        {
          dimension: "printable-download",
          finding: "unresolved",
          summary:
            "Instructional materials are supported as a category, but these downloadable licenses have no exact eligibility determination.",
          sourceIds: ["ok-homeschool-rules"],
          unresolvedQuestion:
            "Does each named PDF edition qualify as instructional material, with what purchase/delivery evidence?",
        },
        {
          dimension: "bundle",
          finding: "unresolved",
          summary:
            "Shared-cost anti-duplication applies; no product-specific bundle allocation is established.",
          sourceIds: ["ok-homeschool-rules"],
          unresolvedQuestion:
            "How should software/book components and any shared family license be itemized without duplicate student claims?",
        },
        {
          dimension: "term",
          finding: "unresolved",
          summary:
            "Expenses must be incurred and paid in the claimed tax year; public/private enrolled semesters and their breaks are excluded. Excess costs cannot move to another year.",
          sourceIds: ["ok-homeschool-rules"],
          unresolvedQuestion:
            "How is an annual license crossing tax years or excluded semesters treated?",
        },
        {
          dimension: "listing",
          finding: "requirement-established",
          summary:
            "No homeschool credit application is required. The information URL is not vendor onboarding, and private-school EVN requirements must not be applied to this route.",
          sourceIds: ["ok-homeschool-faq"],
        },
        {
          dimension: "payment",
          finding: "requirement-established",
          summary:
            "The family pays the seller and separately claims the credit; there is no merchant remittance schedule here. The per-student maximum and aggregate cap do not guarantee reimbursement.",
          sourceIds: ["ok-homeschool-rules"],
        },
        {
          dimension: "invoice",
          finding: "requirement-established",
          summary:
            "Legible receipts accompany each student claim. Retrieved Form 591-D is the 2025 edition and records vendor, description, date and amount; a 2026 edition was not verified.",
          sourceIds: ["ok-homeschool-rules", "ok-homeschool-form-2025"],
        },
        {
          dimension: "refund",
          finding: "unresolved",
          summary:
            "The rules authorize recapture of invalid claims, but do not establish the seller’s digital refund contract.",
          sourceIds: ["ok-homeschool-rules"],
          unresolvedQuestion:
            "How should refunded or partially used licenses be reflected in the family’s expense record and claim?",
        },
      ],
      readinessGaps: [
        "Obtain exact product/category and annual-term interpretation; maintain a bounded materials claim.",
        "Prepare actual paid receipts and refund adjustments without allocating the same shared expense to multiple children.",
        "Retrieve the applicable tax-year form before supplying filing instructions. Do not promise the maximum credit or collect tax returns as purchase evidence.",
      ],
      applicationStatus: "unsent",
      offerEnabled: false,
    },
    {
      programId: "ak-correspondence",
      applicationUrl:
        "https://www.ideahomeschool.org/contact-locations/vendor-info/curriculum",
      requirements: [
        {
          dimension: "vendor",
          finding: "requirement-established",
          summary:
            "This dossier qualifies only Galena/IDEA. Its curricular vendor form leads to applicability review and W-9 collection for inclusion on its PO list.",
          sourceIds: ["ak-district-directory", "ak-idea-vendor"],
        },
        {
          dimension: "software-subscription",
          finding: "category-supported",
          summary:
            "IDEA lists educational apps and online courses among allotment uses; exact AMP access, account and term approval are absent.",
          sourceIds: ["ak-idea-allotment"],
        },
        {
          dimension: "digital-curriculum",
          finding: "category-supported",
          summary:
            "Secular materials supporting the learner’s individual learning plan may be purchased or reimbursed through IDEA. Exact digital licenses need local review.",
          sourceIds: ["ak-idea-vendor"],
        },
        {
          dimension: "printable-download",
          finding: "unresolved",
          summary:
            "Textbooks/workbooks are listed; downloaded files and personal-printing rights are not explicitly established.",
          sourceIds: ["ak-idea-allotment"],
          unresolvedQuestion:
            "Will IDEA accept the named PDF editions and what delivery/printing-license evidence is required?",
        },
        {
          dimension: "bundle",
          finding: "unresolved",
          summary:
            "No combined software/book price or delivery arrangement has been reviewed.",
          sourceIds: ["ak-idea-vendor"],
          unresolvedQuestion:
            "Must access and downloads be separate PO line items?",
        },
        {
          dimension: "term",
          finding: "unresolved",
          summary:
            "IDEA accepts materials orders July 1–March 31 and invoices within its July–June fiscal year. This does not establish allowable digital access dates.",
          sourceIds: ["ak-idea-vendor"],
          unresolvedQuestion:
            "Can access extend past June 30, and is activation before a PO permitted for this SKU?",
        },
        {
          dimension: "listing",
          finding: "requirement-established",
          summary:
            "PO-list inclusion is expressly not vendor approval or endorsement. It does not qualify Corpora for other Alaska districts.",
          sourceIds: ["ak-idea-vendor", "ak-correspondence-scope"],
        },
        {
          dimension: "payment",
          finding: "requirement-established",
          summary:
            "For IDEA direct orders, its published sequence is PO, delivery, invoice, then Net 30 after invoice receipt. Digital delivery acceptance remains unconfirmed.",
          sourceIds: ["ak-idea-vendor"],
        },
        {
          dimension: "invoice",
          finding: "requirement-established",
          summary:
            "IDEA requires seller contact, PO number, family names and per-family item titles/prices/shipping. A PO may include several families.",
          sourceIds: ["ak-idea-vendor"],
        },
        {
          dimension: "refund",
          finding: "unresolved",
          summary:
            "The public curriculum-vendor page does not establish digital cancellations or refund recipient/reconciliation.",
          sourceIds: ["ak-idea-vendor"],
          unresolvedQuestion:
            "What refund, undelivered-access and district-versus-parent reimbursement rules apply to the exact digital order?",
        },
      ],
      readinessGaps: [
        "Limit preparation to Galena/IDEA; obtain current district digital procurement, privacy and student learning-plan requirements.",
        "Prepare private business/W-9 records and exact SKU/price/term/delivery evidence. The embedded intake form was not retrievable; its exact fields are unverified.",
        "Implement a district PO/invoice mapping and approved digital fulfillment receipt before claiming supported checkout. Net 30 is not a promise of payment for an unaccepted digital order.",
      ],
      applicationStatus: "unsent",
      offerEnabled: false,
    },
  ],
};
