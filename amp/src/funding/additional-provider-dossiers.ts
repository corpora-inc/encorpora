import type { DossierInventory } from "./dossier.js";

/** Additional researched routes; neither exhaustive second-wave coverage nor approval. */
export const additionalProviderDossiers: DossierInventory = {
  checkedOn: "2026-10-17",
  sources: [
    {
      id: "al-guide",
      url: "https://classwallet.com/alchoose/assets/CHOOSE_ACT_education_service_provider_guide_2026-2027.pdf",
      publisher: "Alabama Department of Revenue / ClassWallet",
      locator:
        "2026–27 provider guide, updated July 27, 2026; pp. 4–8 and 9–12",
      checkedOn: "2026-10-17",
      authorityLink:
        "https://www.revenue.alabama.gov/tax-policy/the-choose-act/",
    },
    {
      id: "al-authority",
      url: "https://www.revenue.alabama.gov/tax-policy/the-choose-act/",
      publisher: "Alabama Department of Revenue",
      locator:
        "Program administration and family application window; distinguish provider intake",
      checkedOn: "2026-10-17",
    },
    {
      id: "cw-ecommerce",
      url: "https://classwallet.com/ecommerce-vendor-integration/",
      publisher: "ClassWallet",
      locator:
        "Marketplace Ecommerce Integration; transaction sequence, integrations and fees",
      checkedOn: "2026-10-17",
      authorityLink:
        "https://k12.ncseaa.edu/the-education-student-accounts/current-families/allowable-expenses/curriculum/",
    },
    {
      id: "nc-curriculum-route",
      url: "https://k12.ncseaa.edu/the-education-student-accounts/current-families/allowable-expenses/curriculum/",
      publisher: "North Carolina State Education Assistance Authority",
      locator:
        "What Are Curricula; new vendor requirement; existing Product Provider List Pay Vendor steps",
      checkedOn: "2026-10-17",
    },
    {
      id: "nc-mobile-exception",
      url: "https://k12.ncseaa.edu/media/wi0miksa/educational-apps.pdf",
      publisher: "North Carolina State Education Assistance Authority",
      locator: "Educational Apps, effective 2026–27; pp. 1–2",
      checkedOn: "2026-10-17",
    },
    {
      id: "nc-service-scope",
      url: "https://k12.ncseaa.edu/the-education-student-accounts/current-families/service-providers/",
      publisher: "North Carolina State Education Assistance Authority",
      locator:
        "Credentialed tutor, therapist and transportation provider scope; fee FAQ is not a product contract",
      checkedOn: "2026-10-17",
    },
    {
      id: "wv-entry",
      url: "https://hopescholarshipwv.gov/Home/Service-Providers",
      publisher: "West Virginia Hope Scholarship",
      locator:
        "New Provider Request Form, ESP Handbook, bank and provider portal guides",
      checkedOn: "2026-10-17",
    },
    {
      id: "wv-handbook",
      url: "https://hopescholarshipwv.gov/Portals/HopeScholarship/content/Documents/Forms/ESP/WV%20Hope%20Service%20Providers%20Handbook.pdf",
      publisher: "West Virginia Hope Scholarship Board / State Treasurer",
      locator:
        "Updated August 10, 2026; pp. 4–10, 13–15 and provider agreement appendix",
      checkedOn: "2026-10-17",
    },
    {
      id: "wv-portal",
      url: "https://hopescholarshipwv.gov/Home/Service-Providers/Portal-User-Instructions.aspx",
      publisher: "West Virginia Hope Scholarship",
      locator:
        "Provider portal guide; PDF pp. 16–22 purchase/invoice/payment/completion stages",
      checkedOn: "2026-10-17",
    },
    {
      id: "wv-bank",
      url: "https://hopescholarshipwv.gov/Home/Service-Providers/Connect-Your-Bank-Account.aspx",
      publisher: "West Virginia Hope Scholarship",
      locator:
        "Bank connection guide; separate payment configuration prerequisite",
      checkedOn: "2026-10-17",
    },
  ],
  dossiers: [
    {
      programId: "al-choose",
      applicationUrl:
        "https://app.smartsheet.com/b/form/8fe31b08167e4b028e1082fdae9141f1",
      requirements: [
        {
          dimension: "vendor",
          finding: "requirement-established",
          summary:
            "Year-round ALDOR application and attestation precede ClassWallet registration.",
          sourceIds: ["al-guide"],
        },
        {
          dimension: "software-subscription",
          finding: "category-supported",
          summary:
            "K5–12 math software/apps are an approved category; exact AMP classification needs review.",
          sourceIds: ["al-guide"],
        },
        {
          dimension: "digital-curriculum",
          finding: "category-supported",
          summary:
            "Individual-student curriculum and supplemental reading are supported categories.",
          sourceIds: ["al-guide"],
        },
        {
          dimension: "printable-download",
          finding: "unresolved",
          summary:
            "Textbooks are supported; standalone PDF licensing is not specifically resolved.",
          sourceIds: ["al-guide"],
          unresolvedQuestion:
            "Will the exact downloadable edition and personal-print license qualify?",
        },
        {
          dimension: "bundle",
          finding: "unresolved",
          summary:
            "Multiple expense categories can be selected, but this does not approve an AMP bundle.",
          sourceIds: ["al-guide"],
          unresolvedQuestion:
            "Must software and PDF components be itemized and priced separately?",
        },
        {
          dimension: "term",
          finding: "requirement-established",
          summary:
            "Service invoices pertain to the funded academic year; the online-learning-program category restricts educational subscriptions to 2026–27. Exact software-category treatment requires confirmation.",
          sourceIds: ["al-guide"],
        },
        {
          dimension: "listing",
          finding: "requirement-established",
          summary:
            "Approved ESPs register and maintain their own ClassWallet profiles; marketplace products and Pay Vendor are distinct.",
          sourceIds: ["al-guide"],
        },
        {
          dimension: "payment",
          finding: "unresolved",
          summary:
            "ClassWallet receives approved-provider payments; digital-product fees and settlement terms are unresolved.",
          sourceIds: ["al-guide"],
          unresolvedQuestion:
            "Which exact route, fulfillment trigger, fee and settlement schedule applies?",
        },
        {
          dimension: "invoice",
          finding: "requirement-established",
          summary:
            "Typed invoice: provider/address, parent/student names, invoice/service dates, service type and total; must not mention CHOOSE Act or ClassWallet.",
          sourceIds: ["al-guide"],
        },
        {
          dimension: "refund",
          finding: "unresolved",
          summary:
            "Public provider guidance does not establish a complete digital-license refund agreement.",
          sourceIds: ["al-guide"],
          unresolvedQuestion:
            "What refund destination, deadline and partial-term policy applies to this product?",
        },
      ],
      readinessGaps: [
        "Reconcile private entity, signer, tax/banking and historic registration records before submitting anything.",
        "Obtain vendor, exact SKU/term, listing and payment evidence; all offers stay disabled.",
        "Implement reviewed private parent/student identity documents without program branding before using an invoice route.",
        "Generic quote names a program and uses an activation-based annual term; it does not meet the documented invoice/term rules.",
        "Obtain complete application fields and product refund/settlement terms; public guide is not a signed agreement.",
      ],
      applicationStatus: "unsent",
      offerEnabled: false,
    },
    {
      programId: "nc-esa-plus",
      applicationUrl: "https://classwallet.com/ecommerce-vendor-integration/",
      requirements: [
        {
          dimension: "vendor",
          finding: "requirement-established",
          summary:
            "New product/curriculum vendors must join ClassWallet Marketplace; SEAA service-provider enrollment is not their route.",
          sourceIds: ["nc-curriculum-route", "nc-service-scope"],
        },
        {
          dimension: "software-subscription",
          finding: "unresolved",
          summary:
            "Approved mobile app-store purchases have a narrow reimbursement exception; third-party subscription receipts are excluded.",
          sourceIds: ["nc-mobile-exception"],
          unresolvedQuestion:
            "Which web-software or online-curriculum category applies to AMP? Is any native SKU separately approved?",
        },
        {
          dimension: "digital-curriculum",
          finding: "category-supported",
          summary:
            "Online curricula must provide academic instruction; math is a supported core subject.",
          sourceIds: ["nc-curriculum-route"],
        },
        {
          dimension: "printable-download",
          finding: "unresolved",
          summary:
            "Workbooks/lesson resources support the category, not exact PDF license approval.",
          sourceIds: ["nc-curriculum-route"],
          unresolvedQuestion:
            "Can a downloadable edition with personal-print rights be listed as this curriculum material?",
        },
        {
          dimension: "bundle",
          finding: "unresolved",
          summary:
            "Marketplace inclusion does not establish eligibility of all bundled items.",
          sourceIds: ["nc-curriculum-route"],
          unresolvedQuestion:
            "Which components and price allocations may this proposed bundle include?",
        },
        {
          dimension: "term",
          finding: "unresolved",
          summary:
            "No accepted annual AMP term established in reviewed curriculum rules.",
          sourceIds: ["nc-curriculum-route"],
          unresolvedQuestion:
            "May the license cross program years, and which purchase/service dates govern eligibility?",
        },
        {
          dimension: "listing",
          finding: "requirement-established",
          summary:
            "ClassWallet ecommerce integration is distinct from existing listed providers using Pay Vendor.",
          sourceIds: ["nc-curriculum-route", "cw-ecommerce"],
        },
        {
          dimension: "payment",
          finding: "unresolved",
          summary:
            "ClassWallet publishes integration options and a percentage fee; negotiated product terms are unavailable.",
          sourceIds: ["cw-ecommerce"],
          unresolvedQuestion:
            "What product-vendor contract, fee and settlement trigger applies? Do not substitute service-provider fee guidance.",
        },
        {
          dimension: "invoice",
          finding: "requirement-established",
          summary:
            "Existing listed-provider Pay Vendor accepts an exact-item/final-price cart screenshot or invoice/quote/PO; SEAA reviews before transfer.",
          sourceIds: ["nc-curriculum-route"],
        },
        {
          dimension: "refund",
          finding: "unresolved",
          summary:
            "Reviewed curriculum and app pages do not establish product-vendor refund terms.",
          sourceIds: ["nc-curriculum-route", "nc-mobile-exception"],
          unresolvedQuestion:
            "What original-channel refund, cancellation and digital-license rules apply to the approved route?",
        },
      ],
      readinessGaps: [
        "Reconcile private entity, signer, tax/banking and historic registration records before submitting anything.",
        "Obtain vendor, exact SKU/term, listing and payment evidence; all offers stay disabled.",
        "Do not use the existing-provider Pay Vendor workflow without proof Corpora is on the relevant list.",
        "No approved native AMP app or eligible app-store receipt route is established; web Stripe receipts do not satisfy the mobile exception.",
        "Mobile guidance routes unlisted-app reconsideration to annual June changes; do not promise immediate acceptance.",
      ],
      applicationStatus: "unsent",
      offerEnabled: false,
    },
    {
      programId: "wv-hope",
      applicationUrl: "https://hopescholarshipwv.gov/Home/Service-Providers",
      requirements: [
        {
          dimension: "vendor",
          finding: "requirement-established",
          summary:
            "New-provider request, coordinator review and provider agreement precede participation; assess background checks for all student contact, including virtual support.",
          sourceIds: ["wv-entry", "wv-handbook"],
        },
        {
          dimension: "software-subscription",
          finding: "category-supported",
          summary:
            "Nonpublic online programs and required educational software are categories; exact subscription classification is unresolved.",
          sourceIds: ["wv-handbook"],
        },
        {
          dimension: "digital-curriculum",
          finding: "category-supported",
          summary:
            "Math curriculum/supplemental materials are categories; curriculum means a complete course within its content area or grade.",
          sourceIds: ["wv-handbook"],
        },
        {
          dimension: "printable-download",
          finding: "unresolved",
          summary:
            "Material category support does not determine this PDF license.",
          sourceIds: ["wv-handbook"],
          unresolvedQuestion:
            "Will this edition and personal-print license be accepted as a standalone offering?",
        },
        {
          dimension: "bundle",
          finding: "unresolved",
          summary:
            "No approval for a combined software/download offering is established.",
          sourceIds: ["wv-handbook"],
          unresolvedQuestion:
            "How should each component, price and delivery evidence be represented in the offering?",
        },
        {
          dimension: "term",
          finding: "unresolved",
          summary: "No accepted activation-based annual term is established.",
          sourceIds: ["wv-handbook"],
          unresolvedQuestion:
            "Can this subscription cross academic years and what unused-period refund calculation applies?",
        },
        {
          dimension: "listing",
          finding: "requirement-established",
          summary:
            "Offerings require review in the Hope portal; account creation alone is insufficient.",
          sourceIds: ["wv-handbook", "wv-portal"],
        },
        {
          dimension: "payment",
          finding: "requirement-established",
          summary:
            "Portal stages separate requested, review, approved, processing, paid and completed; bank deposits identify THEODOREPMT.",
          sourceIds: ["wv-portal", "wv-bank"],
        },
        {
          dimension: "invoice",
          finding: "requirement-established",
          summary:
            "Provider creates invoices from requested purchases, reviews student/order details and submits for review; completed marking follows paid status.",
          sourceIds: ["wv-portal"],
        },
        {
          dimension: "refund",
          finding: "requirement-established",
          summary:
            "Unprovided services/overcharges require return to the student Hope account, generally within 30 days; no direct parent refund.",
          sourceIds: ["wv-handbook"],
        },
      ],
      readinessGaps: [
        "Reconcile private entity, signer, tax/banking and historic registration records before submitting anything.",
        "Obtain vendor, exact SKU/term, listing and payment evidence; all offers stay disabled.",
        "Confirm exact New Provider Request Form fields, corporate registrations and scope of required student-contact background certifications.",
        "Use portal-generated transactions; generic parent quote is not a substitute for a Hope invoice.",
        "Review price parity, partial-term refunds and conditional control-employee disclosures in the actual agreement.",
      ],
      applicationStatus: "unsent",
      offerEnabled: false,
    },
  ],
};
