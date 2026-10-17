import type { DossierInventory } from "./dossier.js";

/** Source references include shared evidence in the combined provider inventory. */
export const odysseyStateDossiers: DossierInventory = {
  checkedOn: "2026-10-17",
  sources: [
    {
      id: "ia-current",
      url: "https://educate.iowa.gov/pk-12/educational-choice/education-savings-accounts",
      publisher: "Iowa Department of Education",
      locator:
        "October 2026 update; eligibility, semester tuition-first spending and 2026–27 calendar",
      checkedOn: "2026-10-17",
    },
    {
      id: "ia-expenses",
      url: "https://educate.iowa.gov/media/8595/download?inline=",
      publisher: "Iowa Department of Education",
      locator:
        "Current linked May 25, 2023 PDF; pp. 1–2 vendor verification columns and exclusions",
      checkedOn: "2026-10-17",
    },
    {
      id: "ia-vendor-faq",
      url: "https://educate.iowa.gov/media/8672/download?inline=",
      publisher: "Iowa Department of Education",
      locator:
        "Current linked June 21, 2023 FAQ; payment/invoice section; reconcile older 2–5-day estimate",
      checkedOn: "2026-10-17",
    },
    {
      id: "ga-current",
      url: "https://mygeorgiapromise.org/",
      publisher: "Georgia Education Savings Authority",
      locator:
        "2026–27 eligibility and applications; year-round vendor intake supersedes older handbook windows",
      checkedOn: "2026-10-17",
    },
    {
      id: "ga-provider",
      url: "https://mygeorgiapromise.org/wp-content/uploads/2025/06/Service-Provider-Vendor-Handbook_Updated-June-25-2025.pdf",
      publisher: "Georgia Education Savings Authority",
      locator:
        "Current linked June 25, 2025 handbook; pp. 4–6 categories/accreditation/offerings and p. 8 fulfillment",
      checkedOn: "2026-10-17",
    },
    {
      id: "ga-expenses",
      url: "https://mygeorgiapromise.org/wp-content/uploads/2025/05/5.8.25-Eligible-Expense-List.pdf",
      publisher: "Georgia Education Savings Authority",
      locator:
        "Current linked list titled 2025/26; pp. 1–2; confirm 2026–27 applicability",
      checkedOn: "2026-10-17",
    },
    {
      id: "ga-offering",
      url: "https://mygeorgiapromise.org/wp-content/uploads/2025/06/06.25.25_Georgia-Promise-Scholarship_Offering-Portal-One-Pager.pdf",
      publisher: "Georgia Education Savings Authority",
      locator:
        "Offering preparation, price inflation prohibition, bundles and subject/grade metadata",
      checkedOn: "2026-10-17",
    },
    {
      id: "ga-family",
      url: "https://mygeorgiapromise.org/wp-content/uploads/2026/08/Family-Handbook-Updated-8.12.2026.pdf",
      publisher: "Georgia Education Savings Authority",
      locator:
        "Current linked family handbook; PDF pp. 3–5, 8, 17–18; internal dates vary from filename",
      checkedOn: "2026-10-17",
    },
    {
      id: "ga-categories",
      url: "https://support.withodyssey.com/hc/en-us/articles/36309274113691-Georgia-Marketplace-Categories-for-Offerings",
      publisher: "Odyssey",
      locator:
        "December 1, 2025; learning software, educational applications/subscriptions, math curriculum/workbooks",
      checkedOn: "2026-10-17",
      authorityLink: "https://mygeorgiapromise.org/",
    },
    {
      id: "la-provider",
      url: "https://doe.louisiana.gov/topic-pages/louisiana-school-choice/la-gator/la-gator-service-providers",
      publisher: "Louisiana Department of Education",
      locator:
        "Rolling applications; vendor versus student-facing provider categories",
      checkedOn: "2026-10-17",
    },
    {
      id: "la-policy",
      url: "https://doe.louisiana.gov/topic-pages/louisiana-school-choice/la-gator/la-gator-policy",
      publisher: "Louisiana Department of Education",
      locator:
        "Use of Funds and Service Providers Eligibility: refunds, annual attestations, financial soundness threshold",
      checkedOn: "2026-10-17",
    },
    {
      id: "la-eligibility",
      url: "https://support.withodyssey.com/hc/en-us/articles/31113137913371-Eligibility-Requirements-for-the-2026-2027-LA-GATOR-Program",
      publisher: "Odyssey",
      locator:
        "August 12, 2026; eligibility, educational setting and incompatible home-study registrations",
      checkedOn: "2026-10-17",
      authorityLink:
        "https://doe.louisiana.gov/topic-pages/louisiana-school-choice/la-gator/la-gator-service-providers",
    },
    {
      id: "la-tuition",
      url: "https://louisiana.support.withodyssey.com/hc/en-us/articles/43708277582747-How-to-Confirm-the-Tuition-Fees-Set-by-the-School",
      publisher: "Odyssey",
      locator:
        "December 11, 2025; confirmed tuition does not automatically transfer funds; tuition and/or marketplace allocation",
      checkedOn: "2026-10-17",
      authorityLink:
        "https://doe.louisiana.gov/topic-pages/louisiana-school-choice/la-gator/la-gator-service-providers",
    },
    {
      id: "la-categories",
      url: "https://support.withodyssey.com/hc/en-us/articles/36309591768091-Louisiana-Marketplace-Categories-for-Offerings",
      publisher: "Odyssey",
      locator:
        "January 28, 2026; learning software and educational material subscriptions",
      checkedOn: "2026-10-17",
      authorityLink:
        "https://doe.louisiana.gov/topic-pages/louisiana-school-choice/la-gator/la-gator-service-providers",
    },
    {
      id: "la-books",
      url: "https://support.withodyssey.com/hc/en-us/articles/35905159982747-Approved-Curriculum-Books-for-the-LA-GATOR-Scholarship-Program",
      publisher: "Odyssey",
      locator:
        "February 5, 2026 approved textbook list; exact edition/grade/archive dates, no AMP acceptance",
      checkedOn: "2026-10-17",
      authorityLink:
        "https://doe.louisiana.gov/topic-pages/louisiana-school-choice/la-gator/la-gator-service-providers",
    },
    {
      id: "la-application",
      url: "https://support.withodyssey.com/hc/en-us/articles/33881578753691-How-to-Complete-the-LA-GATOR-Vendor-and-Service-Provider-Application",
      publisher: "Odyssey",
      locator:
        "February 11, 2025; private representative, public business profile and provider-specific attestations",
      checkedOn: "2026-10-17",
      authorityLink:
        "https://doe.louisiana.gov/topic-pages/louisiana-school-choice/la-gator/la-gator-service-providers",
    },
    {
      id: "odyssey-lifecycle",
      url: "https://support.withodyssey.com/hc/en-us/articles/47340139248923-Vendor-Application-Lifecycle",
      publisher: "Odyssey",
      locator:
        "March 16, 2026; state-specific application links, separate offering approval, Stripe and fulfillment",
      checkedOn: "2026-10-17",
      authorityLink:
        "https://educate.iowa.gov/pk-12/educational-choice/education-savings-accounts",
    },
    {
      id: "odyssey-business",
      url: "https://support.withodyssey.com/hc/en-us/articles/24272969415835-How-Can-I-Apply-to-Be-A-Vendor",
      publisher: "Odyssey",
      locator:
        "July 9, 2025; business verification examples and state-specific document caveat",
      checkedOn: "2026-10-17",
      authorityLink:
        "https://educate.iowa.gov/pk-12/educational-choice/education-savings-accounts",
    },
    {
      id: "odyssey-returns",
      url: "https://support.withodyssey.com/hc/en-us/articles/21902731722651-Understanding-Refunds-Returns-and-Cancellations",
      publisher: "Odyssey",
      locator:
        "January 23, 2026; restrictive marketplace returns; digital-license/state exceptions require confirmation",
      checkedOn: "2026-10-17",
      authorityLink:
        "https://educate.iowa.gov/pk-12/educational-choice/education-savings-accounts",
    },
    {
      id: "odyssey-fulfillment",
      url: "https://support.withodyssey.com/hc/en-us/articles/21334947584923-How-to-Fulfill-an-Order",
      publisher: "Odyssey",
      locator:
        "August 28, 2025; confirm/deny order and upload actual delivery/receipt evidence before Net 30",
      checkedOn: "2026-10-17",
      authorityLink:
        "https://educate.iowa.gov/pk-12/educational-choice/education-savings-accounts",
    },
  ],
  dossiers: [
    {
      programId: "ia-students-first",
      applicationUrl: "https://iowa-vendors.withodyssey.com/",
      requirements: [
        {
          dimension: "vendor",
          finding: "requirement-established",
          summary:
            "State-specific vendor application and separate approved offerings are required.",
          sourceIds: ["ia-vendor-faq", "odyssey-lifecycle", "odyssey-business"],
        },
        {
          dimension: "software-subscription",
          finding: "unresolved",
          summary:
            "Vendor learning software needs additional verification; educational subscriptions/memberships are excluded.",
          sourceIds: ["ia-expenses"],
          unresolvedQuestion:
            "How is the exact fixed-term AMP software license classified against the subscription exclusion?",
        },
        {
          dimension: "digital-curriculum",
          finding: "unresolved",
          summary:
            "Curriculum fees are marked eligible only when school-billed; vendor textbooks/software require verification.",
          sourceIds: ["ia-expenses"],
          unresolvedQuestion:
            "Which vendor category and school evidence apply to the proposed digital curriculum?",
        },
        {
          dimension: "printable-download",
          finding: "unresolved",
          summary:
            "Textbook category does not establish standalone PDF-license eligibility.",
          sourceIds: ["ia-expenses"],
          unresolvedQuestion:
            "Is this exact downloadable edition/license accepted and what school verification is needed?",
        },
        {
          dimension: "bundle",
          finding: "unresolved",
          summary:
            "No exact combined software/book offering approval is established.",
          sourceIds: ["ia-expenses"],
          unresolvedQuestion:
            "Must components be independently eligible and separately itemized?",
        },
        {
          dimension: "term",
          finding: "unresolved",
          summary:
            "Annual access and cross-year use are not established by account rollover rules.",
          sourceIds: ["ia-current", "ia-expenses"],
          unresolvedQuestion:
            "What service dates and fixed license term are accepted after category review?",
        },
        {
          dimension: "listing",
          finding: "requirement-established",
          summary:
            "Only approved vendor offerings in Odyssey Marketplace may use ESA funds.",
          sourceIds: ["ia-vendor-faq"],
        },
        {
          dimension: "payment",
          finding: "unresolved",
          summary:
            "Older state FAQ estimates 2–5 business days; general Odyssey guidance uses Net 30 after fulfillment.",
          sourceIds: ["ia-vendor-faq", "odyssey-payment"],
          unresolvedQuestion:
            "Which current Iowa digital-product contract, fee and settlement trigger governs?",
        },
        {
          dimension: "invoice",
          finding: "requirement-established",
          summary:
            "Marketplace-only transactions; portal document management requires route confirmation.",
          sourceIds: ["ia-expenses", "odyssey-payment"],
        },
        {
          dimension: "refund",
          finding: "unresolved",
          summary:
            "Generic return policy is restrictive and does not settle software cancellation/proration.",
          sourceIds: ["odyssey-returns"],
          unresolvedQuestion:
            "What Iowa-specific digital cancellation, refund destination and unused-term rules apply?",
        },
      ],
      readinessGaps: [
        "Reachable buyers must attend accredited nonpublic schools and have remaining funds after semester tuition/fees; this is not a homeschool-wide channel.",
        "Resolve annual software classification before pricing or enabling an offer.",
        "Confirm current applicability of the linked 2023 expense/payment documents and reconcile settlement timing.",
        "Bind state/vendor/SKU/term/delivery approval and private business/Stripe records; no operational offer is enabled.",
      ],
      applicationStatus: "unsent",
      offerEnabled: false,
    },
    {
      programId: "ga-promise",
      applicationUrl: "https://gapromise-vendors.withodyssey.com/",
      requirements: [
        {
          dimension: "vendor",
          finding: "requirement-established",
          summary:
            "Current authority page accepts vendor applications year-round; older handbook windows require reconciliation.",
          sourceIds: ["ga-current", "ga-provider", "odyssey-business"],
        },
        {
          dimension: "software-subscription",
          finding: "category-supported",
          summary:
            "Learning software, educational applications and subscriptions are listed categories, not AMP approval.",
          sourceIds: ["ga-categories"],
        },
        {
          dimension: "digital-curriculum",
          finding: "category-supported",
          summary:
            "Math curriculum is listed; do not confuse a material publisher with accredited online-course tuition.",
          sourceIds: ["ga-provider", "ga-expenses"],
        },
        {
          dimension: "printable-download",
          finding: "unresolved",
          summary:
            "Workbooks are listed; PDF delivery and reproduction license are not resolved.",
          sourceIds: ["ga-expenses"],
          unresolvedQuestion:
            "Will this edition and personal-print license be approved in the selected category?",
        },
        {
          dimension: "bundle",
          finding: "category-supported",
          summary:
            "Offering instructions permit applicable bundles subject to exact approval.",
          sourceIds: ["ga-offering"],
        },
        {
          dimension: "term",
          finding: "unresolved",
          summary:
            "No approved annual AMP or cross-program-year term is established.",
          sourceIds: ["ga-expenses", "ga-family"],
          unresolvedQuestion:
            "Which service dates, renewal conditions and annual term may be listed?",
        },
        {
          dimension: "listing",
          finding: "requirement-established",
          summary:
            "GESA pre-approves each offering; subject/grade metadata and honest prices are required.",
          sourceIds: ["ga-provider", "ga-offering"],
        },
        {
          dimension: "payment",
          finding: "unresolved",
          summary:
            "Handbook links payment to fulfillment; general guidance starts Net 30 after delivery evidence.",
          sourceIds: ["ga-provider", "odyssey-payment"],
          unresolvedQuestion:
            "What digital fulfillment evidence and fee/credit agreement govern this offering?",
        },
        {
          dimension: "invoice",
          finding: "requirement-established",
          summary:
            "Product reimbursement is excluded; general portal-only transaction-document rule needs exact implementation.",
          sourceIds: ["ga-provider", "odyssey-payment"],
        },
        {
          dimension: "refund",
          finding: "unresolved",
          summary:
            "No digital-specific refund agreement is established by generic restrictive return guidance.",
          sourceIds: ["odyssey-returns"],
          unresolvedQuestion:
            "How do GESA rules and the vendor agreement govern cancellation, failed delivery and license refunds?",
        },
      ],
      readinessGaps: [
        "Eligible nonpublic/home-study families are a narrower audience than all Georgia learners; eligibility, opt-in and quarterly funding precede purchases.",
        "Verify current applicability of the linked 2025/26 expense list and obtain exact product approval.",
        "Record subject, grade, components, term and price; do not claim online-program accreditation.",
        "Obtain portal order/fulfillment/settlement/refund contract; generic parent quote is not a reimbursement route.",
      ],
      applicationStatus: "unsent",
      offerEnabled: false,
    },
    {
      programId: "la-gator",
      applicationUrl: "https://lagator-vendors.withodyssey.com/",
      requirements: [
        {
          dimension: "vendor",
          finding: "requirement-established",
          summary:
            "Rolling intake distinguishes non-student-facing vendors; annual attestations and financial soundness requirements apply.",
          sourceIds: ["la-provider", "la-policy", "la-application"],
        },
        {
          dimension: "software-subscription",
          finding: "category-supported",
          summary:
            "Learning software and educational material subscriptions are listing categories.",
          sourceIds: ["la-categories"],
        },
        {
          dimension: "digital-curriculum",
          finding: "unresolved",
          summary:
            "Policy supports instructional materials, but an approved textbook list requires exact classification review.",
          sourceIds: ["la-policy", "la-books"],
          unresolvedQuestion:
            "Does this supplemental digital curriculum require a separate instructional-materials review?",
        },
        {
          dimension: "printable-download",
          finding: "unresolved",
          summary:
            "Published approved textbook list does not establish AMP book acceptance.",
          sourceIds: ["la-books"],
          unresolvedQuestion:
            "Which review path accepts these new downloadable editions and print licenses?",
        },
        {
          dimension: "bundle",
          finding: "unresolved",
          summary:
            "No approval established for the combined software/download offering.",
          sourceIds: ["la-categories", "la-books"],
          unresolvedQuestion:
            "How must the components and price allocations be reviewed and listed?",
        },
        {
          dimension: "term",
          finding: "unresolved",
          summary:
            "Cross-year annual access is not established by student-account rollover.",
          sourceIds: ["la-policy"],
          unresolvedQuestion:
            "What start/end dates, renewal conditions and unused-term refund treatment apply?",
        },
        {
          dimension: "listing",
          finding: "requirement-established",
          summary:
            "Vendor acceptance, offering category and product approval are separate stages.",
          sourceIds: ["la-application", "odyssey-lifecycle"],
        },
        {
          dimension: "payment",
          finding: "unresolved",
          summary:
            "General Odyssey fulfillment-before-Net-30 model needs Louisiana digital-product confirmation.",
          sourceIds: ["odyssey-payment", "odyssey-fulfillment"],
          unresolvedQuestion:
            "What exact evidence, payment schedule and approved credit policy govern this license?",
        },
        {
          dimension: "invoice",
          finding: "requirement-established",
          summary:
            "Use portal transaction references; generic parent-issued quote is not established as the purchase route.",
          sourceIds: ["odyssey-payment", "la-tuition"],
        },
        {
          dimension: "refund",
          finding: "requirement-established",
          summary:
            "Refunds return to the ESA, never parent/student; unused reservation payments have a specific 30-day rule.",
          sourceIds: ["la-policy"],
        },
      ],
      readinessGaps: [
        "Funded eligibility and selected educational setting are prerequisites; LA GATOR home-based education is not concurrent enrollment in either excluded registered home-study route.",
        "Resolve exact material/software classification and approved editions; no inference from category names alone.",
        "If budgeted ESA receipts exceed $100,000, document the applicable operational-history, CPA or bond/credit criterion.",
        "Confirm software-specific refund/proration and fulfillment; retain separate approval, delivery and settlement evidence.",
      ],
      applicationStatus: "unsent",
      offerEnabled: false,
    },
  ],
};
