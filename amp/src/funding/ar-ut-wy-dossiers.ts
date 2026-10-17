import type { DossierInventory } from "./dossier.js";

/** State-specific evidence; shared administrator sources resolve in the combined inventory. */
export const arUtWyDossiers: DossierInventory = {
  checkedOn: "2026-10-17",
  sources: [
    {
      id: "ar-current",
      url: "https://dese.ade.arkansas.gov/Offices/office-of-school-choice-and-parent-empowerment/education-freedom-accounts",
      publisher: "Arkansas Division of Elementary and Secondary Education",
      locator: "2026–27 application calendar and official partner links",
      checkedOn: "2026-10-17",
    },
    {
      id: "ar-provider",
      url: "https://dese.ade.arkansas.gov/Offices/office-of-school-choice-and-parent-empowerment/education-freedom-accounts/information-for-service-providers",
      publisher: "Arkansas Division of Elementary and Secondary Education",
      locator:
        "Open application banner and nonstudent-facing vendor exemption; route ambiguity requires resolution",
      checkedOn: "2026-10-17",
    },
    {
      id: "ar-rules",
      url: "https://dese.ade.arkansas.gov/Files/Educational_Freedom_Account_Program_6CARpt.35_Legal.pdf",
      publisher: "Arkansas Division of Elementary and Secondary Education",
      locator:
        "6 CAR Part 35, March 27, 2026 footer; pp. 4–5 eligible expenses, 22–24 provider duties, 29–31 payments",
      checkedOn: "2026-10-17",
    },
    {
      id: "ar-directpay",
      url: "https://schoolchoicear.org/classwallet",
      publisher: "School Choice Arkansas, official-linked support partner",
      locator: "Direct Pay invoice fields and separate purchases by student",
      checkedOn: "2026-10-17",
      authorityLink:
        "https://dese.ade.arkansas.gov/Offices/office-of-school-choice-and-parent-empowerment/education-freedom-accounts",
    },
    {
      id: "ar-preapproval",
      url: "https://schoolchoicear.org/reimbursement",
      publisher: "School Choice Arkansas, official-linked support partner",
      locator: "One-use preapproval, receipt and payment-proof guidance",
      checkedOn: "2026-10-17",
      authorityLink:
        "https://dese.ade.arkansas.gov/Offices/office-of-school-choice-and-parent-empowerment/education-freedom-accounts",
    },
    {
      id: "ut-authority",
      url: "https://schools.utah.gov/utahfitsallscholarship",
      publisher: "Utah State Board of Education",
      locator:
        "Odyssey administrator transition and official handbook/support links",
      checkedOn: "2026-10-17",
    },
    {
      id: "ut-provider",
      url: "https://support.withodyssey.com/hc/en-us/articles/37494425843611-Who-can-be-a-Utah-Fits-All-Scholarship-provider",
      publisher: "Odyssey",
      locator:
        "Provider and individual offering approval, EIN, direct provision, ownership changes and ACE reapplication",
      checkedOn: "2026-10-17",
      authorityLink: "https://schools.utah.gov/utahfitsallscholarship",
    },
    {
      id: "ut-eligibility",
      url: "https://support.withodyssey.com/hc/en-us/articles/37838842666779-Eligibility-Requirements-for-the-Utah-Fits-All-Scholarship-Program",
      publisher: "Odyssey",
      locator:
        "April 16, 2026; resident K–12 age/enrollment requirements and selection priorities",
      checkedOn: "2026-10-17",
      authorityLink: "https://schools.utah.gov/utahfitsallscholarship",
    },
    {
      id: "ut-funding",
      url: "https://support.withodyssey.com/hc/en-us/articles/53057163439643-2026-27-UFA-Funding-is-Now-Available",
      publisher: "Odyssey",
      locator:
        "July 15, 2026; funded wallet, marketplace/reimbursement and nonbinding eligibility review",
      checkedOn: "2026-10-17",
      authorityLink: "https://schools.utah.gov/utahfitsallscholarship",
    },
    {
      id: "ut-expenses",
      url: "https://support.withodyssey.com/hc/en-us/articles/37894468672283-Eligible-Expense-Guide",
      publisher: "Odyssey",
      locator:
        "April 15, 2026; goods include curriculum, educational software/apps; inherently educational test",
      checkedOn: "2026-10-17",
      authorityLink: "https://schools.utah.gov/utahfitsallscholarship",
    },
    {
      id: "ut-spending",
      url: "https://support.withodyssey.com/hc/en-us/articles/52216257447323-Utah-Fits-All-UFA-Spending-and-Reimbursement-Guide",
      publisher: "Odyssey",
      locator:
        "September 21, 2026; award year, goods/service distinction, individual student use and completed reimbursements",
      checkedOn: "2026-10-17",
      authorityLink: "https://schools.utah.gov/utahfitsallscholarship",
    },
    {
      id: "ut-receipts",
      url: "https://support.withodyssey.com/hc/en-us/articles/51870309021851-UFA-Acceptable-Documentation-for-Reimbursements",
      publisher: "Odyssey",
      locator:
        "August 12, 2026; single file upload, itemized receipt and separate payment proof for word-processor invoices",
      checkedOn: "2026-10-17",
      authorityLink: "https://schools.utah.gov/utahfitsallscholarship",
    },
    {
      id: "wy-current",
      url: "https://edu.wyoming.gov/parents/education-savings-accounts/",
      publisher: "Wyoming Department of Education",
      locator:
        "2026–27 application closure, injunction lifted with litigation continuing, four reimbursement categories",
      checkedOn: "2026-10-17",
    },
    {
      id: "wy-provider",
      url: "https://edu.wyoming.gov/wp-content/uploads/2025/03/ESA-Provider-Handbook.pdf",
      publisher: "Wyoming Department of Education",
      locator:
        "Current linked 2025–26 handbook updated April 2025; pp. 6–12 approval, certification, category, fulfillment and refunds; confirm current terms",
      checkedOn: "2026-10-17",
    },
    {
      id: "wy-family",
      url: "https://edu.wyoming.gov/wp-content/uploads/2025/04/ESA-Family-Handbook.pdf",
      publisher: "Wyoming Department of Education",
      locator:
        "Current linked older handbook; pp. 10–11 receipt and submission rules; current webpage narrows reimbursement categories",
      checkedOn: "2026-10-17",
    },
  ],
  dossiers: [
    {
      programId: "ar-efa",
      applicationUrl:
        "https://app.smartsheet.com/b/form/7f1affe2f7df4794935e87d41c44f4ce",
      requirements: [
        {
          dimension: "vendor",
          finding: "unresolved",
          summary:
            "The provider page links an open vendor application but also exempts nonstudent-facing vendors from service-provider applications. Corpora is a publisher, not an asserted tutoring provider.",
          sourceIds: ["ar-provider"],
          unresolvedQuestion:
            "Which intake and ClassWallet contract apply to a nonstudent-facing software/download publisher?",
        },
        {
          dimension: "software-subscription",
          finding: "unresolved",
          summary:
            "An annual adaptive software license needs its own category decision; online-course tuition is not interchangeable with software.",
          sourceIds: ["ar-rules", "ar-provider"],
          unresolvedQuestion:
            "Is the exact annual license an eligible expense, through which category and route?",
        },
        {
          dimension: "digital-curriculum",
          finding: "category-supported",
          summary:
            "Curriculum is an eligible expense and a preapproval reimbursement category; selective AMP materials do not establish accepted curriculum.",
          sourceIds: ["ar-rules"],
        },
        {
          dimension: "printable-download",
          finding: "unresolved",
          summary:
            "Curriculum and supplemental materials categories do not establish acceptance of the exact downloadable PDF license.",
          sourceIds: ["ar-provider"],
          unresolvedQuestion:
            "Which named downloadable titles and licenses are accepted?",
        },
        {
          dimension: "bundle",
          finding: "unresolved",
          summary:
            "No reviewed evidence approves a combined app and book package.",
          sourceIds: ["ar-provider"],
          unresolvedQuestion:
            "Must software and downloaded books be separate approved line items?",
        },
        {
          dimension: "term",
          finding: "unresolved",
          summary:
            "The program uses quarterly funding; no reviewed source establishes twelve months from activation for this SKU.",
          sourceIds: ["ar-current", "ar-rules"],
          unresolvedQuestion:
            "What purchase/service dates, award-year limits and digital delivery event apply?",
        },
        {
          dimension: "listing",
          finding: "unresolved",
          summary:
            "ClassWallet marketplace, Direct Pay and preapproved reimbursement are different workflows.",
          sourceIds: ["ar-directpay", "ar-preapproval"],
          unresolvedQuestion:
            "Which listing/Direct Pay vendor identifiers and product approvals must Corpora obtain?",
        },
        {
          dimension: "payment",
          finding: "requirement-established",
          summary:
            "Rule 35-111 requires itemized invoices and reviewed parent requests; reimbursement requires approval before incurring a listed eligible expense. Approval is not bank settlement.",
          sourceIds: ["ar-rules"],
        },
        {
          dimension: "invoice",
          finding: "requirement-established",
          summary:
            "Official-linked guidance requires vendor, student name, itemized description/prices, total and service period; the generic opaque learner quote does not meet named-student documentation.",
          sourceIds: ["ar-directpay"],
        },
        {
          dimension: "refund",
          finding: "requirement-established",
          summary:
            "Rule 35-107 prohibits direct parent refunds; return unentitled funds to the EFA or department if closed. Department-required returns are due within ten business days of written notice.",
          sourceIds: ["ar-rules"],
        },
      ],
      readinessGaps: [
        "Resolve the contradictory publisher intake instructions before choosing an application path.",
        "Obtain private entity/tax/payment documents and category-specific obligations; service-provider bond applicability to a publisher is unresolved.",
        "Design a reviewed named-student invoice and one-use preapproval evidence workflow; generic quote is insufficient.",
        "Confirm digital fulfillment, settlement timing, annual term and contract-specific cancellation/refund handling.",
      ],
      applicationStatus: "unsent",
      offerEnabled: false,
    },
    {
      programId: "ut-fits-all",
      applicationUrl: "https://ufa-vendors.withodyssey.com/registration/",
      requirements: [
        {
          dimension: "vendor",
          finding: "requirement-established",
          summary:
            "Odyssey reviews provider and each offering; previous ACE approval does not transfer. Prepare EIN, contact/location, direct product description and requested records.",
          sourceIds: ["ut-authority", "ut-provider"],
        },
        {
          dimension: "software-subscription",
          finding: "unresolved",
          summary:
            "Educational software/apps appear under eligible goods, but this does not approve an annual AMP license or its delivery date.",
          sourceIds: ["ut-expenses"],
          unresolvedQuestion:
            "Is the exact subscription treated as goods or services, and what dates determine eligibility?",
        },
        {
          dimension: "digital-curriculum",
          finding: "category-supported",
          summary:
            "Inherently educational curriculum and instructional materials are supported categories, subject to offering review.",
          sourceIds: ["ut-expenses", "ut-provider"],
        },
        {
          dimension: "printable-download",
          finding: "unresolved",
          summary:
            "Materials category support does not establish this PDF edition or download license.",
          sourceIds: ["ut-expenses"],
          unresolvedQuestion:
            "Are the named PDF titles accepted, and what proves completed delivery?",
        },
        {
          dimension: "bundle",
          finding: "unresolved",
          summary:
            "Student-specific spending and product review apply; a combined package has no approval in this inventory.",
          sourceIds: ["ut-spending", "ut-provider"],
          unresolvedQuestion:
            "How must app and books be listed, priced and allocated to the single student?",
        },
        {
          dimension: "term",
          finding: "unresolved",
          summary:
            "The award year is July 1–June 30. Goods and services have different timing rules, including permitted services crossing years; software is listed as goods in the expense guide.",
          sourceIds: ["ut-spending", "ut-expenses"],
          unresolvedQuestion:
            "Does annual access count as goods, when is it purchased/delivered, and may this exact term cross June 30?",
        },
        {
          dimension: "listing",
          finding: "requirement-established",
          summary:
            "Provider acceptance and individual offering approval precede marketplace availability. Preliminary eligibility requests are not final reimbursement approvals.",
          sourceIds: ["ut-provider", "ut-funding"],
        },
        {
          dimension: "payment",
          finding: "unresolved",
          summary:
            "Funded families can use marketplace or eligible outside purchases. General Odyssey fulfillment/Net 30 guidance requires state-contract confirmation.",
          sourceIds: ["ut-funding", "odyssey-payment"],
          unresolvedQuestion:
            "Which Utah contract controls digital fulfillment, credit exposure, settlement and fees?",
        },
        {
          dimension: "invoice",
          finding: "requirement-established",
          summary:
            "Combine documents into one upload: vendor, date, itemized prices, total and payment method/proof. A word-processor invoice requires separate bank/card or completed-payment evidence.",
          sourceIds: ["ut-receipts"],
        },
        {
          dimension: "refund",
          finding: "unresolved",
          summary:
            "The spending guide says completed reimbursement payments cannot be reversed. This is not a vendor digital-license refund policy.",
          sourceIds: ["ut-spending", "odyssey-returns"],
          unresolvedQuestion:
            "How must a merchant refund reconcile a completed reimbursement or marketplace purchase without double payment?",
        },
      ],
      readinessGaps: [
        "Confirm funded student and available balance; Utah residence alone does not establish an award.",
        "Obtain private onboarding records and exact software/PDF/bundle offering decisions.",
        "Bind approved term and goods/service classification; do not assume an annual service exception applies to software.",
        "Implement portal fulfillment and paid-receipt evidence separately from unpaid quotes; reconcile refunds with the administrator.",
      ],
      applicationStatus: "unsent",
      offerEnabled: false,
    },
    {
      programId: "wy-esa",
      applicationUrl: "https://wyoming-vendors.withodyssey.com",
      requirements: [
        {
          dimension: "vendor",
          finding: "unresolved",
          summary:
            "The linked 2025–26 handbook allows out-of-state virtual/material providers. It distinguishes certification for providers from tangible-goods-only vendors.",
          sourceIds: ["wy-provider"],
          unresolvedQuestion:
            "Which 2026–27 agreement, certification and financial security requirements apply to a digital publisher?",
        },
        {
          dimension: "software-subscription",
          finding: "unresolved",
          summary:
            "Educational software/apps are a technology category in the linked handbook; that does not grant the separate curriculum reimbursement route.",
          sourceIds: ["wy-provider", "wy-current"],
          unresolvedQuestion:
            "Is this annual software SKU accepted in the marketplace and under which category?",
        },
        {
          dimension: "digital-curriculum",
          finding: "category-supported",
          summary:
            "The current webpage permits consideration of K–12 core curriculum reimbursement including math; AMP completeness and exact category are unestablished.",
          sourceIds: ["wy-current"],
        },
        {
          dimension: "printable-download",
          finding: "unresolved",
          summary:
            "The materials category does not establish acceptance of downloadable editions or eligibility for a tangible-goods certification exception.",
          sourceIds: ["wy-provider"],
          unresolvedQuestion:
            "Which PDF licenses are approved and is digital-only delivery subject to certification?",
        },
        {
          dimension: "bundle",
          finding: "unresolved",
          summary:
            "No reviewed source accepts the app/book package or permits software to inherit curriculum reimbursement eligibility.",
          sourceIds: ["wy-current", "wy-provider"],
          unresolvedQuestion:
            "How are bundle components classified and itemized?",
        },
        {
          dimension: "term",
          finding: "unresolved",
          summary:
            "Current funds are distributed quarterly. The reviewed sources do not approve an activation-based annual digital term.",
          sourceIds: ["wy-current", "wy-provider"],
          unresolvedQuestion:
            "What purchase, access and delivery dates and award-year limitations govern this SKU?",
        },
        {
          dimension: "listing",
          finding: "requirement-established",
          summary:
            "The handbook describes application/assurances, marketplace products and review of profile changes; listings do not establish Corpora acceptance.",
          sourceIds: ["wy-provider"],
        },
        {
          dimension: "payment",
          finding: "unresolved",
          summary:
            "The handbook pays after service provision or product shipment, with tuition/enrollment exceptions. General Odyssey Net 30 is not an established Wyoming digital contract.",
          sourceIds: ["wy-provider", "odyssey-payment"],
          unresolvedQuestion:
            "What digital fulfillment evidence starts settlement, and does the current contract require access before payment?",
        },
        {
          dimension: "invoice",
          finding: "unresolved",
          summary:
            "The linked family handbook requires vendor/date/total/itemized description/payment method and rejects handwritten receipts; it states a 30-day submission limit.",
          sourceIds: ["wy-family"],
          unresolvedQuestion:
            "Confirm current-year receipt and submission rules; the separately indexed reimbursement PDF returned 404 on review.",
        },
        {
          dimension: "refund",
          finding: "requirement-established",
          summary:
            "The provider handbook requires return to the student ESA, never the parent, within 30 days of notification of the refund obligation. Confirm the current agreement before selling.",
          sourceIds: ["wy-provider"],
        },
      ],
      readinessGaps: [
        "Verify current contract despite older linked handbooks; litigation continues although payouts are authorized.",
        "Limit reachable buyers to funded eligible families: 2026–27 applications closed August 6, 2026.",
        "Resolve digital certification and surety requirements privately before scaling; handbook threshold wording differs between body and assurances.",
        "Obtain exact listing, term, digital fulfillment and current receipt/refund rules; keep reimbursement narrower than marketplace eligibility.",
      ],
      applicationStatus: "unsent",
      offerEnabled: false,
    },
  ],
};
