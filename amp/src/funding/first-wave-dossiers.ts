import type { DossierInventory } from "./dossier.js";

/** Public research only; no Corpora approval or application submission. */
export const firstWaveDossiers: DossierInventory = {
  checkedOn: "2026-10-17",
  sources: [
    {
      id: "az-handbook",
      url: "https://www.azed.gov/sites/default/files/2025/06/ESA%202025-2026%20Handbook.pdf",
      publisher: "Arizona Department of Education",
      checkedOn: "2026-10-17",
      locator:
        "Current handbook linked on Oct 17; titled2025\u201326; printed pp23\u201324,43; PDF pp30\u201331,50",
      authorityLink: "https://www.azed.gov/esa/parent-handbook",
    },
    {
      id: "az-vendor",
      url: "https://www.azed.gov/esa/classwallet",
      publisher: "Arizona Department of Education",
      checkedOn: "2026-10-17",
      locator:
        "Become an ESA Vendor / Provider; Marketplace and Direct Pay; Reimbursement",
    },
    {
      id: "fl-intake",
      url: "https://survey.alchemer.com/s3/7190874/MyScholarShop-Supplier-Interest-Form",
      publisher: "Step Up For Students",
      checkedOn: "2026-10-17",
      locator:
        "Public first page; high-level onboarding steps; subsequent questions not accessed",
      authorityLink: "https://www.sufs.org/schools-and-providers/vendors/",
    },
    {
      id: "fl-vendor",
      url: "https://www.sufs.org/schools-and-providers/vendors/",
      publisher: "Step Up For Students",
      checkedOn: "2026-10-17",
      locator:
        "Two overlapping How do I Partner sections; Ariba instructions conflict with linked intake",
    },
    {
      id: "fl-pep-guide",
      url: "https://www.stepupforstudents.org/handbook-web/pep-purchasing-guide/",
      publisher: "Step Up For Students",
      checkedOn: "2026-10-17",
      locator:
        "Digital Materials; Educational Software; Curriculum; EMA Marketplace",
    },
    {
      id: "fl-ua-guide",
      url: "https://fcsua.org/docs/fesua/2026-27-purchasing-english.pdf",
      publisher:
        "Florida Center for Students with Unique Abilities, University of Central Florida",
      checkedOn: "2026-10-17",
      locator: "2026\u201327 guide, July 1,2026; printed pp5,12",
      authorityLink: "https://www.stepupforstudents.org/resources/ua/",
    },
    {
      id: "fl-pep-handbook",
      url: "https://www.stepupforstudents.org/handbook-web/pep-family-handbook/",
      publisher: "Step Up For Students",
      checkedOn: "2026-10-17",
      locator:
        "2026\u201327, modified Sep 16,2026; Supporting Documentation; Refunds; Subscriptions",
    },
    {
      id: "fl-ua-handbook",
      url: "https://www.stepupforstudents.org/handbook-web/fes-ua-family-handbook/",
      publisher: "Step Up For Students",
      checkedOn: "2026-10-17",
      locator:
        "2026\u201327, modifiedSep 16,2026; Instructional Materials documentation; MyScholarShop; Subscriptions",
    },
    {
      id: "tx-authority",
      url: "https://educationfreedom.texas.gov/providers-vendors/",
      publisher: "Texas Comptroller",
      checkedOn: "2026-10-17",
      locator:
        "Vendor application; eligibility review; online/out-of-state FAQ",
    },
    {
      id: "tx-eligibility",
      url: "https://support.withodyssey.com/hc/en-us/articles/44035042254875-Who-Can-Become-a-Vendor-and-What-are-the-Requirements",
      publisher: "Odyssey",
      checkedOn: "2026-10-17",
      locator:
        "Updated Jun 30,2026; General Eligibility and Educational Products",
      authorityLink: "https://educationfreedom.texas.gov/providers-vendors/",
    },
    {
      id: "tx-categories",
      url: "https://support.withodyssey.com/hc/en-us/articles/47640100236827-Texas-Marketplace-Categories-for-Offerings",
      publisher: "Odyssey",
      checkedOn: "2026-10-17",
      locator: "Updated Mar 24,2026; TX Subcategories",
      authorityLink: "https://educationfreedom.texas.gov/providers-vendors/",
    },
    {
      id: "tx-caps",
      url: "https://support.withodyssey.com/hc/en-us/articles/52391445784347-What-Are-the-Purchase-Restrictions-for-TEFA",
      publisher: "Odyssey",
      checkedOn: "2026-10-17",
      locator: "Updated Oct 5,2026; collective technology restriction",
      authorityLink: "https://educationfreedom.texas.gov/providers-vendors/",
    },
    {
      id: "odyssey-payment",
      url: "https://support.withodyssey.com/hc/en-us/articles/22601445865883-How-Do-Vendors-Get-Paid",
      publisher: "Odyssey",
      checkedOn: "2026-10-17",
      locator:
        "Updated Sep 12,2025; general marketplace payment and document handling, not TEFA-specific contract",
      authorityLink: "https://educationfreedom.texas.gov/providers-vendors/",
    },
    {
      id: "odyssey-refund",
      url: "https://support.withodyssey.com/hc/en-us/articles/33948374261275-How-To-Report-A-Refund",
      publisher: "Odyssey",
      checkedOn: "2026-10-17",
      locator:
        "General marketplace refund workflow; confirm TEFA contract scope",
      authorityLink: "https://educationfreedom.texas.gov/providers-vendors/",
    },
  ],
  dossiers: [
    {
      programId: "az-esa",
      applicationUrl:
        "https://app.smartsheet.com/b/form/f0dea2798798406fbe43c835cf38fbb3",
      requirements: [
        {
          dimension: "vendor",
          finding: "requirement-established",
          summary:
            "ADE links a ClassWallet service-provider registration form. Registration does not approve every purchase.",
          sourceIds: ["az-vendor"],
        },
        {
          dimension: "software-subscription",
          finding: "category-supported",
          summary:
            "Educational software/apps and online learning are supported categories, subject to student and contract-year rules.",
          sourceIds: ["az-handbook"],
        },
        {
          dimension: "digital-curriculum",
          finding: "category-supported",
          summary:
            "Digital books and educational materials are listed; the exact AMP offering needs classification.",
          sourceIds: ["az-handbook"],
        },
        {
          dimension: "printable-download",
          finding: "unresolved",
          summary:
            "Digital-book category is evidence, not specific approval of perpetual PDF printing rights.",
          sourceIds: ["az-handbook"],
          unresolvedQuestion:
            "Will the separately described download license and personal-print rights qualify?",
        },
        {
          dimension: "bundle",
          finding: "unresolved",
          summary:
            "No specific AMP app-plus-PDF bundle decision is established.",
          sourceIds: ["az-handbook"],
          unresolvedQuestion:
            "Must subscription and download components be separated and priced individually?",
        },
        {
          dimension: "term",
          finding: "requirement-established",
          summary:
            "Online learning/subscriptions are limited to the contract year; family access needs per-student itemization.",
          sourceIds: ["az-handbook"],
        },
        {
          dimension: "listing",
          finding: "requirement-established",
          summary:
            "ADE distinguishes marketplace, Direct Pay email-order vendors and reimbursement.",
          sourceIds: ["az-vendor"],
        },
        {
          dimension: "payment",
          finding: "unresolved",
          summary:
            "ClassWallet registration and route selection precede operational payment setup.",
          sourceIds: ["az-vendor"],
          unresolvedQuestion:
            "What fees, settlement timing and fulfillment evidence apply to this digital-product route?",
        },
        {
          dimension: "invoice",
          finding: "requirement-established",
          summary:
            "Invoice needs provider contact/address, date/number, student name, itemized charges/service dates and total; reimbursement also needs payment proof.",
          sourceIds: ["az-handbook"],
        },
        {
          dimension: "refund",
          finding: "unresolved",
          summary:
            "No provider-specific refund agreement was obtained through the public entry point.",
          sourceIds: ["az-vendor"],
          unresolvedQuestion:
            "What return destination, timing and digital-access revocation rules does the vendor contract require?",
        },
      ],
      readinessGaps: [
        "Reconcile actual Corpora registrations and authorized signer; no private business evidence is in this repository.",
        "Approve exact released-product claims, price, taxes, license, privacy deployment and refund terms.",
        "Obtain separate vendor, exact SKU/term, listing and settlement evidence before configuring any offer.",
        "Current quote uses opaque learner reference and12 months from activation; it cannot satisfy named-student/contract-year requirements.",
        "Obtain confirmation of current handbook applicability; current landing links a 2025\u201326 document.",
      ],
      applicationStatus: "unsent",
      offerEnabled: false,
    },
    {
      programId: "fl-pep",
      applicationUrl:
        "https://survey.alchemer.com/s3/7190874/MyScholarShop-Supplier-Interest-Form",
      requirements: [
        {
          dimension: "vendor",
          finding: "requirement-established",
          summary:
            "Linked intake requires selection, seller/business onboarding, W-9 and bank information; never place these private records in this repo.",
          sourceIds: ["fl-intake"],
        },
        {
          dimension: "listing",
          finding: "unresolved",
          summary:
            "Current intake names Mirakl and catalog/order testing; landing page retains Ariba instructions.",
          sourceIds: ["fl-intake", "fl-vendor"],
          unresolvedQuestion:
            "Which platform, catalog schema and digital-delivery process apply to this supplier invitation?",
        },
        {
          dimension: "payment",
          finding: "unresolved",
          summary:
            "Intake requires secure bank setup and marketplace terms; no negotiated fees or settlement agreement obtained.",
          sourceIds: ["fl-intake"],
          unresolvedQuestion:
            "What fees, payment trigger, settlement schedule and reconciliation fields apply?",
        },
        {
          dimension: "refund",
          finding: "unresolved",
          summary: "No signed supplier return/credit terms obtained.",
          sourceIds: ["fl-intake"],
          unresolvedQuestion:
            "What digital-product cancellation and program-directed credit process is required?",
        },
        {
          dimension: "software-subscription",
          finding: "category-supported",
          summary:
            "Educational apps/subscriptions support a single-student candidate SKU; this is category evidence only.",
          sourceIds: ["fl-pep-guide"],
        },
        {
          dimension: "digital-curriculum",
          finding: "unresolved",
          summary:
            "Curriculum means a complete course of study for a content area or grade; unpublished materials need preauthorization.",
          sourceIds: ["fl-pep-guide"],
          unresolvedQuestion:
            "Does the released focused skill collection qualify as curriculum, or should it be classified as instructional software/materials?",
        },
        {
          dimension: "printable-download",
          finding: "category-supported",
          summary:
            "Digital documents are supported; candidate printable PDFs require exact license/listing review.",
          sourceIds: ["fl-pep-guide"],
        },
        {
          dimension: "bundle",
          finding: "unresolved",
          summary:
            "Separate category support does not establish approval of a combined app/download SKU.",
          sourceIds: ["fl-pep-guide"],
          unresolvedQuestion:
            "Will a separately itemized app plus downloadable-book bundle be accepted and under which category?",
        },
        {
          dimension: "term",
          finding: "unresolved",
          summary:
            "Public category guidance does not settle the proposed activation-based twelve-month term.",
          sourceIds: ["fl-pep-guide"],
          unresolvedQuestion:
            "Can a 12-month license cross award-year boundaries, and what start/end dates must be shown?",
        },
        {
          dimension: "invoice",
          finding: "requirement-established",
          summary:
            "Material reimbursement requires item, full purchase date, price/subtotal/tax/fees/discounts/total and payment method.",
          sourceIds: ["fl-pep-handbook"],
        },
      ],
      readinessGaps: [
        "Reconcile actual Corpora registrations and authorized signer; no private business evidence is in this repository.",
        "Approve exact released-product claims, price, taxes, license, privacy deployment and refund terms.",
        "Obtain separate vendor, exact SKU/term, listing and settlement evidence before configuring any offer.",
        "Resolve Mirakl/Ariba conflict using issued onboarding materials before building an adapter.",
        "Do not describe selected skills/books as a complete K\u201312 curriculum or approved online school.",
      ],
      applicationStatus: "unsent",
      offerEnabled: false,
    },
    {
      programId: "fl-fes-ua",
      applicationUrl:
        "https://survey.alchemer.com/s3/7190874/MyScholarShop-Supplier-Interest-Form",
      requirements: [
        {
          dimension: "vendor",
          finding: "requirement-established",
          summary:
            "Linked intake requires selection, seller/business onboarding, W-9 and bank information; never place these private records in this repo.",
          sourceIds: ["fl-intake"],
        },
        {
          dimension: "listing",
          finding: "unresolved",
          summary:
            "Current intake names Mirakl and catalog/order testing; landing page retains Ariba instructions.",
          sourceIds: ["fl-intake", "fl-vendor"],
          unresolvedQuestion:
            "Which platform, catalog schema and digital-delivery process apply to this supplier invitation?",
        },
        {
          dimension: "payment",
          finding: "unresolved",
          summary:
            "Intake requires secure bank setup and marketplace terms; no negotiated fees or settlement agreement obtained.",
          sourceIds: ["fl-intake"],
          unresolvedQuestion:
            "What fees, payment trigger, settlement schedule and reconciliation fields apply?",
        },
        {
          dimension: "refund",
          finding: "unresolved",
          summary: "No signed supplier return/credit terms obtained.",
          sourceIds: ["fl-intake"],
          unresolvedQuestion:
            "What digital-product cancellation and program-directed credit process is required?",
        },
        {
          dimension: "software-subscription",
          finding: "category-supported",
          summary:
            "Educational apps/subscriptions support a single-student candidate SKU; this is category evidence only.",
          sourceIds: ["fl-ua-guide"],
        },
        {
          dimension: "digital-curriculum",
          finding: "unresolved",
          summary:
            "Curriculum means a complete course of study for a content area or grade; unpublished materials need preauthorization.",
          sourceIds: ["fl-ua-guide"],
          unresolvedQuestion:
            "Does the released focused skill collection qualify as curriculum, or should it be classified as instructional software/materials?",
        },
        {
          dimension: "printable-download",
          finding: "category-supported",
          summary:
            "Digital documents are supported; candidate printable PDFs require exact license/listing review.",
          sourceIds: ["fl-ua-guide"],
        },
        {
          dimension: "bundle",
          finding: "unresolved",
          summary:
            "Separate category support does not establish approval of a combined app/download SKU.",
          sourceIds: ["fl-ua-guide"],
          unresolvedQuestion:
            "Will a separately itemized app plus downloadable-book bundle be accepted and under which category?",
        },
        {
          dimension: "term",
          finding: "unresolved",
          summary:
            "Public category guidance does not settle the proposed activation-based twelve-month term.",
          sourceIds: ["fl-ua-guide"],
          unresolvedQuestion:
            "Can a 12-month license cross award-year boundaries, and what start/end dates must be shown?",
        },
        {
          dimension: "invoice",
          finding: "requirement-established",
          summary:
            "Material reimbursement requires item, full purchase date, price/subtotal/tax/fees/discounts/total and payment method.",
          sourceIds: ["fl-ua-handbook"],
        },
      ],
      readinessGaps: [
        "Reconcile actual Corpora registrations and authorized signer; no private business evidence is in this repository.",
        "Approve exact released-product claims, price, taxes, license, privacy deployment and refund terms.",
        "Obtain separate vendor, exact SKU/term, listing and settlement evidence before configuring any offer.",
        "Resolve Mirakl/Ariba conflict using issued onboarding materials before building an adapter.",
        "Do not describe selected skills/books as a complete K\u201312 curriculum or approved online school.",
      ],
      applicationStatus: "unsent",
      offerEnabled: false,
    },
    {
      programId: "tx-tefa",
      applicationUrl: "https://tefa-vendors.withodyssey.com/",
      requirements: [
        {
          dimension: "vendor",
          finding: "requirement-established",
          summary:
            "Educational Products applicants need US business status, Texas registration documentation and applicable franchise-tax good standing. Tutor credentials must not be inferred for a product publisher.",
          sourceIds: ["tx-eligibility"],
        },
        {
          dimension: "software-subscription",
          finding: "category-supported",
          summary:
            "Software Programs, Online Learning Program and Educational Applications are listed categories; software participates in the collective 10%-of-award technology cap.",
          sourceIds: ["tx-categories", "tx-caps"],
        },
        {
          dimension: "digital-curriculum",
          finding: "category-supported",
          summary:
            "Curriculum is listed, but classification of AMP must be reviewed rather than chosen to evade a cap.",
          sourceIds: ["tx-categories", "tx-caps"],
        },
        {
          dimension: "printable-download",
          finding: "unresolved",
          summary:
            "Textbooks/workbooks are categories; digital download and printing-license treatment is not established.",
          sourceIds: ["tx-categories"],
          unresolvedQuestion:
            "Does a downloadable workbook qualify separately and what fulfillment proof is required?",
        },
        {
          dimension: "bundle",
          finding: "unresolved",
          summary:
            "A combined software/book SKU has no documented classification decision.",
          sourceIds: ["tx-categories", "tx-caps"],
          unresolvedQuestion:
            "How are bundle components classified, priced and counted against technology limits?",
        },
        {
          dimension: "term",
          finding: "unresolved",
          summary:
            "Published onboarding does not establish the proposed annual activation term.",
          sourceIds: ["tx-authority"],
          unresolvedQuestion:
            "What license dates and award-year boundaries may an approved annual offering use?",
        },
        {
          dimension: "listing",
          finding: "requirement-established",
          summary:
            "Vendor applications and offerings are reviewed before marketplace publication; out-of-state online products require acceptance.",
          sourceIds: ["tx-authority"],
        },
        {
          dimension: "payment",
          finding: "requirement-established",
          summary:
            "General Odyssey guidance uses Stripe ACH and Net30 after valid fulfillment tracking/receipt. Digital-product trigger and TEFA contract must be confirmed.",
          sourceIds: ["odyssey-payment"],
        },
        {
          dimension: "invoice",
          finding: "requirement-established",
          summary:
            "General Odyssey guidance keeps invoices, receipts and tracking in its portal and prohibits supplier-consumer transaction-document sharing.",
          sourceIds: ["odyssey-payment"],
        },
        {
          dimension: "refund",
          finding: "unresolved",
          summary:
            "General Odyssey refund instructions require support handling; exact TEFA/digital terms require confirmation.",
          sourceIds: ["odyssey-refund"],
          unresolvedQuestion:
            "What approved refund procedure and license revocation/credit timing apply to TEFA digital orders?",
        },
      ],
      readinessGaps: [
        "Reconcile actual Corpora registrations and authorized signer; no private business evidence is in this repository.",
        "Approve exact released-product claims, price, taxes, license, privacy deployment and refund terms.",
        "Obtain separate vendor, exact SKU/term, listing and settlement evidence before configuring any offer.",
        "No evidence of Corpora Texas registration or franchise-tax status provided.",
        "Parent quote download/submission workflow is unsuitable without a route-specific decision on portal-only transaction documents.",
        "Settlement-after-fulfillment may require approved credit terms; default after-settlement activation cannot be assumed compatible.",
      ],
      applicationStatus: "unsent",
      offerEnabled: false,
    },
  ],
};
