import type { DossierInventory } from "./dossier.js";

/** Research evidence only; blocked document retrieval is explicit, never approval. */
export const moMsTnDossiers: DossierInventory = {
  checkedOn: "2026-10-17",
  sources: [
    {
      id: "mo-provider",
      url: "https://treasurer.mo.gov/moscholars/Providers",
      publisher: "Missouri State Treasurer",
      locator:
        "Current educational-product vendor intake; US entity, business records, related-party and parent-refund restrictions",
      checkedOn: "2026-10-17",
    },
    {
      id: "mo-parent-2026",
      url: "https://treasurer.mo.gov/pdfnew/Parenthandbook.pdf",
      publisher: "Missouri State Treasurer",
      locator:
        "Actual retrieved cover: 2026–27, revised January 5, 2026; printed pp. 3–4 allowable expenses and awarded-school-year service prepayment; seven physical pages",
      checkedOn: "2026-10-17",
    },
    {
      id: "mo-categories",
      url: "https://support.withodyssey.com/hc/en-us/articles/51891552203035-Missouri-Marketplace-Categories-for-Offerings",
      publisher: "Odyssey / MOScholars",
      locator:
        "September 21, 2026; Educational Applications restriction. Provenance: Treasurer provider page links Odyssey vendor intake; article belongs to the separate Odyssey MOScholars vendor help section",
      checkedOn: "2026-10-17",
      authorityLink: "https://treasurer.mo.gov/moscholars/Providers",
    },
    {
      id: "mo-separate",
      url: "https://support.withodyssey.com/hc/en-us/articles/52032964552091-Is-the-MOScholars-Marketplace-the-Same-as-the-School-Portal",
      publisher: "Odyssey / MOScholars",
      locator:
        "June 22, 2026; non-tuition marketplace versus school tuition portal. Administrator provenance follows Treasurer-linked Odyssey intake, not a direct Treasurer article link",
      checkedOn: "2026-10-17",
      authorityLink: "https://treasurer.mo.gov/moscholars/Providers",
    },
    {
      id: "mo-offering",
      url: "https://support.withodyssey.com/hc/en-us/articles/51427028992155-How-to-Upload-Offerings-to-the-Odyssey-Marketplace",
      publisher: "Odyssey / MOScholars",
      locator:
        "June 8, 2026; offering fields. Linked from Odyssey MOScholars vendor help section; Treasurer establishes administrator through its vendor-intake link",
      checkedOn: "2026-10-17",
      authorityLink: "https://treasurer.mo.gov/moscholars/Providers",
    },
    {
      id: "mo-bulk",
      url: "https://support.withodyssey.com/hc/en-us/articles/51285284490651-How-to-Upload-Multiple-Offerings-at-Once-Bulk-Upload-Guide",
      publisher: "Odyssey / MOScholars",
      locator:
        "June 4, 2026; dashboard CSV. Linked from Odyssey MOScholars vendor help section; Treasurer establishes administrator through its vendor-intake link",
      checkedOn: "2026-10-17",
      authorityLink: "https://treasurer.mo.gov/moscholars/Providers",
    },
    {
      id: "mo-purchase",
      url: "https://support.withodyssey.com/hc/en-us/articles/52212935604891-How-to-Use-the-Odyssey-Marketplace",
      publisher: "Odyssey / MOScholars",
      locator:
        "June 30, 2026; family order workflow. Odyssey MOScholars family help section; administrator authority follows Treasurer-linked intake",
      checkedOn: "2026-10-17",
      authorityLink: "https://treasurer.mo.gov/moscholars/Providers",
    },
    {
      id: "ms-current",
      url: "https://mdek12.org/specialeducation/ESA/",
      publisher: "Mississippi Department of Education",
      locator:
        "Current official page text retrieved through search index, not direct PDF access: 2026–27 reimbursement calendar, award packet and linked expense instructions",
      checkedOn: "2026-10-17",
    },
    {
      id: "tn-iea-hub",
      url: "https://www.tn.gov/education/iea/handbooks.html",
      publisher: "Tennessee Department of Education",
      locator:
        "Current hub explicitly links 2026–27 handbook separately from 2025–26; current PDF retrieval failed, no expense claims inferred",
      checkedOn: "2026-10-17",
    },
    {
      id: "tn-iea-resources",
      url: "https://www.tn.gov/education/iea/iea-resources.html",
      publisher: "Tennessee Department of Education",
      locator:
        "Current portal, expense-reporting and courses-of-study resource links; linked PDF content unavailable",
      checkedOn: "2026-10-17",
    },
    {
      id: "tn-esa-current",
      url: "https://www.tn.gov/education/esa.html",
      publisher: "Tennessee Department of Education",
      locator:
        "2026–27 geographic eligibility, quarterly allocation and second-semester application dates",
      checkedOn: "2026-10-17",
    },
    {
      id: "tn-esa-provider",
      url: "https://www.tn.gov/education/esa/schools-service-providers.html",
      publisher: "Tennessee Department of Education",
      locator:
        "Service Providers: 2027 RFA deadline March 31, 2027; distinct school application and marketplace dates; RFA PDF retrieval failed",
      checkedOn: "2026-10-17",
    },
    {
      id: "tn-efs-faq",
      url: "https://www.tn.gov/education/efs/efs-faqs.html",
      publisher: "Tennessee Department of Education",
      locator:
        "Funding Disbursement and Use: tuition first, school/program-linked curricula, standalone software exclusion, marketplace and school refund rules",
      checkedOn: "2026-10-17",
    },
    {
      id: "tn-efs-provider",
      url: "https://www.tn.gov/education/efs/schools-and-service-providers.html",
      publisher: "Tennessee Department of Education",
      locator:
        "School registration and school-admin invoicing are not educational publisher approval",
      checkedOn: "2026-10-17",
    },
    {
      id: "mo-categories-october",
      url: "https://support.withodyssey.com/hc/en-us/articles/51282311836571-Missouri-Marketplace-Categories-for-Offerings",
      publisher: "Odyssey / MOScholars",
      locator:
        "October 7, 2026; taxonomy/tuition inconsistency. Both category articles are linked from Odyssey MOScholars vendor help section; Treasurer links the administrator intake, not these articles",
      checkedOn: "2026-10-17",
      authorityLink: "https://treasurer.mo.gov/moscholars/Providers",
    },
  ],
  dossiers: [
    {
      programId: "mo-moscholars",
      applicationUrl: "https://moscholars-vendors.withodyssey.com",
      requirements: [
        {
          dimension: "vendor",
          finding: "requirement-established",
          summary:
            "Educational-product vendors must be US entities and provide business registration or articles of incorporation; related-party payment restrictions apply. Product classification does not require borrowing tutor credentials.",
          sourceIds: ["mo-provider"],
        },
        {
          dimension: "software-subscription",
          finding: "category-supported",
          summary:
            "Both linked category guides include educational software/subscriptions. The September guide restricts Educational Applications to individual, non-lifetime subscriptions; the October guide uses different category names. Exact AMP category and approval are absent.",
          sourceIds: ["mo-categories", "mo-categories-october"],
        },
        {
          dimension: "digital-curriculum",
          finding: "category-supported",
          summary:
            "Curriculum is an eligible category; vendor and offering review remain separate.",
          sourceIds: ["mo-parent-2026", "mo-categories"],
        },
        {
          dimension: "printable-download",
          finding: "unresolved",
          summary:
            "Textbook/workbook categories do not establish eligibility of these downloadable licenses.",
          sourceIds: ["mo-categories"],
          unresolvedQuestion:
            "Are named PDF editions and personal-printing rights accepted, and what delivery record is required?",
        },
        {
          dimension: "bundle",
          finding: "unresolved",
          summary:
            "No combined software/book package has an eligibility decision. Individual-subscription limits cannot be avoided through a family bundle.",
          sourceIds: ["mo-categories"],
          unresolvedQuestion:
            "Must software and book licenses be separately priced and reviewed?",
        },
        {
          dimension: "term",
          finding: "unresolved",
          summary:
            "The 2026–27 handbook permits service prepayment only within the awarded school year, July 1–June 30. Individual-subscription category support is not approval of a rolling annual term.",
          sourceIds: ["mo-parent-2026", "mo-categories"],
          unresolvedQuestion:
            "Does the service-prepayment limit govern this software SKU, and must its access end by June 30?",
        },
        {
          dimension: "listing",
          finding: "unresolved",
          summary:
            "The June portal article separates marketplace goods from school tuition, but the October category guide lists tuition. Approved vendors submit separately reviewed offerings with SKU, category, duration, age/grade, price, stock and image.",
          sourceIds: ["mo-separate", "mo-offering", "mo-categories-october"],
          unresolvedQuestion:
            "Which current category taxonomy and non-tuition publisher workflow govern AMP? Resolve the conflicting linked guidance before configuring an adapter.",
        },
        {
          dimension: "payment",
          finding: "unresolved",
          summary:
            "Families assign marketplace purchases to a funded student and submit an order. A submitted order is not settled payment or verified activation authority.",
          sourceIds: ["mo-purchase"],
          unresolvedQuestion:
            "Obtain the Missouri vendor agreement covering digital fulfillment, payment trigger, fees and settlement; do not import another state’s terms.",
        },
        {
          dimension: "invoice",
          finding: "unresolved",
          summary:
            "Listing data and current dashboard CSV are documented; neither is a paid receipt or a public webhook/API contract.",
          sourceIds: ["mo-offering", "mo-bulk"],
          unresolvedQuestion:
            "Which order, student-reference, invoice, tax, access-date and delivery fields must be retained, and does the portal generate the accepted receipt?",
        },
        {
          dimension: "refund",
          finding: "unresolved",
          summary:
            "Vendors must not share, refund or rebate scholarship funds with the parent or student. Offering return/cancellation policies appear before purchase.",
          sourceIds: ["mo-provider", "mo-purchase"],
          unresolvedQuestion:
            "Obtain the program-wallet return process, digital cancellation/proration rule and reconciliation deadline before accepting orders.",
        },
      ],
      readinessGaps: [
        "Confirm exact individual software/PDF categories and school-year access boundaries.",
        "Prepare private entity records and reviewed product assets; obtain the actual vendor agreement.",
        "Use a separate Odyssey export adapter only after obtaining its current template; neutral supplier CSV is not a verified upload format.",
        "Do not mark delivery complete before access/download fulfillment, or infer payment settlement from order submission.",
        "Resolve the two linked category taxonomies and tuition-portal inconsistency with the operative dashboard and agreement.",
      ],
      applicationStatus: "unsent",
      offerEnabled: false,
    },
    {
      programId: "tn-efs",
      applicationUrl:
        "https://www.tn.gov/education/efs/schools-and-service-providers.html",
      requirements: [
        {
          dimension: "vendor",
          finding: "unresolved",
          summary:
            "School registration and school invoicing instructions do not establish a publisher intake route.",
          sourceIds: ["tn-efs-provider"],
          unresolvedQuestion:
            "Which approved service-provider category, if any, accepts a standalone publisher?",
        },
        {
          dimension: "software-subscription",
          finding: "unresolved",
          summary:
            "The official FAQ excludes standalone software. Its exception is software included without additional expense in an otherwise approved purchase, not blanket bundle eligibility.",
          sourceIds: ["tn-efs-faq"],
          unresolvedQuestion:
            "Do not offer standalone AMP access through EFS; obtain an actual approved-category decision for any materially different candidate.",
        },
        {
          dimension: "digital-curriculum",
          finding: "unresolved",
          summary:
            "Residual curriculum spending follows tuition and is tied to the enrolled registered school or an approved summer/after-school academic program.",
          sourceIds: ["tn-efs-faq"],
          unresolvedQuestion:
            "Can the exact publisher materials be purchased under an eligible school/program route, rather than independently?",
        },
        {
          dimension: "printable-download",
          finding: "unresolved",
          summary:
            "The FAQ names textbooks/curricula but does not establish personal-printing PDF licenses.",
          sourceIds: ["tn-efs-faq"],
          unresolvedQuestion:
            "Which named PDF editions and delivery/license terms are accepted?",
        },
        {
          dimension: "bundle",
          finding: "unresolved",
          summary:
            "A software exception inside an approved expense does not authorize relabeling standalone app access as a curriculum bundle.",
          sourceIds: ["tn-efs-faq"],
          unresolvedQuestion:
            "What substantive approved expense and no-additional-cost software arrangement, if any, applies?",
        },
        {
          dimension: "term",
          finding: "unresolved",
          summary:
            "Quarterly allocations and rollover provisions are account rules; they do not authorize an annual software term.",
          sourceIds: ["tn-efs-faq"],
          unresolvedQuestion:
            "Determine the permitted term of an eligible materials offering only after its category decision.",
        },
        {
          dimension: "listing",
          finding: "requirement-established",
          summary:
            "Other approved purchases use the portal marketplace; EFS, ESA and IEA have separate systems and approvals.",
          sourceIds: ["tn-efs-faq"],
        },
        {
          dimension: "payment",
          finding: "unresolved",
          summary:
            "Funds are not directly paid to parents or students. School tuition is first; remaining funds and marketplace approval govern other purchases.",
          sourceIds: ["tn-efs-faq"],
          unresolvedQuestion:
            "Obtain the actual publisher fulfillment and settlement contract; school invoicing guidance is insufficient.",
        },
        {
          dimension: "invoice",
          finding: "unresolved",
          summary:
            "The public provider page links school-admin invoicing, not a publisher transaction specification.",
          sourceIds: ["tn-efs-provider"],
          unresolvedQuestion:
            "Which itemized materials invoice, identity, tax and delivery fields are required?",
        },
        {
          dimension: "refund",
          finding: "unresolved",
          summary:
            "The FAQ specifies school tuition proration/refunds on withdrawal; it does not establish digital publisher cancellation terms.",
          sourceIds: ["tn-efs-faq"],
          unresolvedQuestion:
            "Obtain the applicable materials refund destination, timing and reconciliation process.",
        },
      ],
      readinessGaps: [
        "Standalone annual software is excluded by the reviewed FAQ; keep its offer disabled.",
        "Qualify only funded families with residual balances and an eligible school/program-linked materials purchase.",
        "Retrieve the operative handbook/provider agreement before implementing invoice, fulfillment or refund integration.",
      ],
      applicationStatus: "unsent",
      offerEnabled: false,
    },
    {
      programId: "ms-esa",
      applicationUrl: "https://mdek12.org/specialeducation/ESA/",
      requirements: [
        {
          dimension: "vendor",
          finding: "unresolved",
          summary:
            "The current MDE page describes a family reimbursement program and school assurance; it does not establish publisher enrollment.",
          sourceIds: ["ms-current"],
          unresolvedQuestion:
            "Does MDE require product-vendor registration or only qualifying family expense evidence?",
        },
        {
          dimension: "software-subscription",
          finding: "unresolved",
          summary:
            "The current page points to an allowable-expense list, but its operative PDF could not be retrieved.",
          sourceIds: ["ms-current"],
          unresolvedQuestion:
            "Retrieve the current software eligibility, educational-need evidence and subscription restrictions.",
        },
        {
          dimension: "digital-curriculum",
          finding: "unresolved",
          summary:
            "Other educational expenses are referenced without enough reviewed category detail for this curriculum.",
          sourceIds: ["ms-current"],
          unresolvedQuestion:
            "Verify current curriculum category rules and student-specific documentation.",
        },
        {
          dimension: "printable-download",
          finding: "unresolved",
          summary:
            "No retrieved current source resolves PDF licenses or printing rights.",
          sourceIds: ["ms-current"],
          unresolvedQuestion:
            "Are these PDF textbooks/workbooks and license terms reimbursable?",
        },
        {
          dimension: "bundle",
          finding: "unresolved",
          summary:
            "No reviewed current evidence establishes a software/book bundle.",
          sourceIds: ["ms-current"],
          unresolvedQuestion:
            "Must each component be independently eligible and itemized?",
        },
        {
          dimension: "term",
          finding: "unresolved",
          summary:
            "The calendar has quarterly requests and disbursements; those dates do not approve twelve months of access.",
          sourceIds: ["ms-current"],
          unresolvedQuestion:
            "Retrieve annual-fee allocation, purchase dates and award-year limits from the current request instructions.",
        },
        {
          dimension: "listing",
          finding: "unresolved",
          summary:
            "The reviewed current page uses award packets and reimbursement instructions, not a verified marketplace listing process.",
          sourceIds: ["ms-current"],
          unresolvedQuestion:
            "Confirm whether any direct-vendor route exists for publishers.",
        },
        {
          dimension: "payment",
          finding: "unresolved",
          summary:
            "The current calendar lists requests due August 31, November 27, February 26 and May 31, with later disbursements; it is not merchant settlement.",
          sourceIds: ["ms-current"],
          unresolvedQuestion:
            "Verify eligible purchase timing, payer and evidence before choosing any merchant billing adapter.",
        },
        {
          dimension: "invoice",
          finding: "unresolved",
          summary:
            "The 2026–27 reimbursement form is linked but its content was unavailable.",
          sourceIds: ["ms-current"],
          unresolvedQuestion:
            "Obtain the actual receipt, payment-proof, student identity and itemization requirements.",
        },
        {
          dimension: "refund",
          finding: "unresolved",
          summary:
            "No current retrieved refund instructions establish treatment of returned digital licenses.",
          sourceIds: ["ms-current"],
          unresolvedQuestion:
            "Obtain the reimbursement correction and refund destination/deadline rules.",
        },
      ],
      readinessGaps: [
        "Retrieve current operative documents before treating any category, term or transaction route as established.",
        "Do not substitute older handbooks or another program’s rules; keep all proposed offers disabled.",
      ],
      applicationStatus: "unsent",
      offerEnabled: false,
    },
    {
      programId: "tn-iea",
      applicationUrl: "https://www.tn.gov/education/iea/iea-resources.html",
      requirements: [
        {
          dimension: "vendor",
          finding: "unresolved",
          summary:
            "The current IEA hub links the 2026–27 handbook and expense reporting guidance; the PDFs were unavailable.",
          sourceIds: ["tn-iea-hub", "tn-iea-resources"],
          unresolvedQuestion:
            "Which publisher intake, business records and category-specific attestations apply?",
        },
        {
          dimension: "software-subscription",
          finding: "unresolved",
          summary:
            "The current IEA hub links the 2026–27 handbook and expense reporting guidance; the PDFs were unavailable.",
          sourceIds: ["tn-iea-hub", "tn-iea-resources"],
          unresolvedQuestion:
            "Does the operative program allow this standalone educational software subscription?",
        },
        {
          dimension: "digital-curriculum",
          finding: "unresolved",
          summary:
            "The current IEA hub links the 2026–27 handbook and expense reporting guidance; the PDFs were unavailable.",
          sourceIds: ["tn-iea-hub", "tn-iea-resources"],
          unresolvedQuestion:
            "Which curriculum category and school/student requirements govern the exact product?",
        },
        {
          dimension: "printable-download",
          finding: "unresolved",
          summary:
            "The current IEA hub links the 2026–27 handbook and expense reporting guidance; the PDFs were unavailable.",
          sourceIds: ["tn-iea-hub", "tn-iea-resources"],
          unresolvedQuestion:
            "Are named PDF licenses with personal-printing rights eligible?",
        },
        {
          dimension: "bundle",
          finding: "unresolved",
          summary:
            "The current IEA hub links the 2026–27 handbook and expense reporting guidance; the PDFs were unavailable.",
          sourceIds: ["tn-iea-hub", "tn-iea-resources"],
          unresolvedQuestion:
            "Must software and printable components be separately eligible and itemized?",
        },
        {
          dimension: "term",
          finding: "unresolved",
          summary:
            "The current IEA hub links the 2026–27 handbook and expense reporting guidance; the PDFs were unavailable.",
          sourceIds: ["tn-iea-hub", "tn-iea-resources"],
          unresolvedQuestion:
            "What annual, prepaid, purchase-date and cross-award-year limits apply?",
        },
        {
          dimension: "listing",
          finding: "unresolved",
          summary:
            "The current IEA hub links the 2026–27 handbook and expense reporting guidance; the PDFs were unavailable.",
          sourceIds: ["tn-iea-hub", "tn-iea-resources"],
          unresolvedQuestion:
            "Which marketplace or reimbursement route accepts approved publisher offerings?",
        },
        {
          dimension: "payment",
          finding: "unresolved",
          summary:
            "The current IEA hub links the 2026–27 handbook and expense reporting guidance; the PDFs were unavailable.",
          sourceIds: ["tn-iea-hub", "tn-iea-resources"],
          unresolvedQuestion:
            "What payer, digital fulfillment, fees, approval and settlement terms apply?",
        },
        {
          dimension: "invoice",
          finding: "unresolved",
          summary:
            "The current IEA hub links the 2026–27 handbook and expense reporting guidance; the PDFs were unavailable.",
          sourceIds: ["tn-iea-hub", "tn-iea-resources"],
          unresolvedQuestion:
            "Which itemization, identity, payment-proof and access-date fields are required?",
        },
        {
          dimension: "refund",
          finding: "unresolved",
          summary:
            "The current IEA hub links the 2026–27 handbook and expense reporting guidance; the PDFs were unavailable.",
          sourceIds: ["tn-iea-hub", "tn-iea-resources"],
          unresolvedQuestion:
            "What refund destination, deadline, proration and reconciliation evidence apply?",
        },
      ],
      readinessGaps: [
        "Retrieve current operative documents before treating any category, term or transaction route as established.",
        "Do not substitute older handbooks or another program’s rules; keep all proposed offers disabled.",
      ],
      applicationStatus: "unsent",
      offerEnabled: false,
    },
    {
      programId: "tn-esa",
      applicationUrl:
        "https://www.tn.gov/education/esa/schools-service-providers.html",
      requirements: [
        {
          dimension: "vendor",
          finding: "unresolved",
          summary:
            "The ESA page links a 2027 service-provider RFA due March 31, 2027; the RFA was unavailable. School intake is a separate route.",
          sourceIds: ["tn-esa-current", "tn-esa-provider"],
          unresolvedQuestion:
            "Which publisher intake, business records and category-specific attestations apply?",
        },
        {
          dimension: "software-subscription",
          finding: "unresolved",
          summary:
            "The ESA page links a 2027 service-provider RFA due March 31, 2027; the RFA was unavailable. School intake is a separate route.",
          sourceIds: ["tn-esa-current", "tn-esa-provider"],
          unresolvedQuestion:
            "Does the operative program allow this standalone educational software subscription?",
        },
        {
          dimension: "digital-curriculum",
          finding: "unresolved",
          summary:
            "The ESA page links a 2027 service-provider RFA due March 31, 2027; the RFA was unavailable. School intake is a separate route.",
          sourceIds: ["tn-esa-current", "tn-esa-provider"],
          unresolvedQuestion:
            "Which curriculum category and school/student requirements govern the exact product?",
        },
        {
          dimension: "printable-download",
          finding: "unresolved",
          summary:
            "The ESA page links a 2027 service-provider RFA due March 31, 2027; the RFA was unavailable. School intake is a separate route.",
          sourceIds: ["tn-esa-current", "tn-esa-provider"],
          unresolvedQuestion:
            "Are named PDF licenses with personal-printing rights eligible?",
        },
        {
          dimension: "bundle",
          finding: "unresolved",
          summary:
            "The ESA page links a 2027 service-provider RFA due March 31, 2027; the RFA was unavailable. School intake is a separate route.",
          sourceIds: ["tn-esa-current", "tn-esa-provider"],
          unresolvedQuestion:
            "Must software and printable components be separately eligible and itemized?",
        },
        {
          dimension: "term",
          finding: "unresolved",
          summary:
            "The ESA page links a 2027 service-provider RFA due March 31, 2027; the RFA was unavailable. School intake is a separate route.",
          sourceIds: ["tn-esa-current", "tn-esa-provider"],
          unresolvedQuestion:
            "What annual, prepaid, purchase-date and cross-award-year limits apply?",
        },
        {
          dimension: "listing",
          finding: "unresolved",
          summary:
            "The ESA page links a 2027 service-provider RFA due March 31, 2027; the RFA was unavailable. School intake is a separate route.",
          sourceIds: ["tn-esa-current", "tn-esa-provider"],
          unresolvedQuestion:
            "Which marketplace or reimbursement route accepts approved publisher offerings?",
        },
        {
          dimension: "payment",
          finding: "unresolved",
          summary:
            "The ESA page links a 2027 service-provider RFA due March 31, 2027; the RFA was unavailable. School intake is a separate route.",
          sourceIds: ["tn-esa-current", "tn-esa-provider"],
          unresolvedQuestion:
            "What payer, digital fulfillment, fees, approval and settlement terms apply?",
        },
        {
          dimension: "invoice",
          finding: "unresolved",
          summary:
            "The ESA page links a 2027 service-provider RFA due March 31, 2027; the RFA was unavailable. School intake is a separate route.",
          sourceIds: ["tn-esa-current", "tn-esa-provider"],
          unresolvedQuestion:
            "Which itemization, identity, payment-proof and access-date fields are required?",
        },
        {
          dimension: "refund",
          finding: "unresolved",
          summary:
            "The ESA page links a 2027 service-provider RFA due March 31, 2027; the RFA was unavailable. School intake is a separate route.",
          sourceIds: ["tn-esa-current", "tn-esa-provider"],
          unresolvedQuestion:
            "What refund destination, deadline, proration and reconciliation evidence apply?",
        },
      ],
      readinessGaps: [
        "Retrieve current operative documents before treating any category, term or transaction route as established.",
        "Do not substitute older handbooks or another program’s rules; keep all proposed offers disabled.",
      ],
      applicationStatus: "unsent",
      offerEnabled: false,
    },
  ],
};
