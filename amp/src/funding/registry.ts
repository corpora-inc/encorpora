import { expandFundingRegistry } from "./expand-registry.js";
import type { BaseFundingRegistry } from "./types.js";

/** Internal research inventory. No Corpora vendor or product approval is asserted. */
const baseFundingRegistry: BaseFundingRegistry = {
  version: 1,
  checkedOn: "2026-10-16",
  sources: [
    {
      id: "az",
      title: "Arizona ESA ClassWallet information",
      url: "https://www.azed.gov/esa/classwallet",
      publisher: "program-authority",
      checkedOn: "2026-10-16",
    },
    {
      id: "fl-pep",
      title: "Florida PEP purchasing guide",
      url: "https://www.stepupforstudents.org/handbook-web/pep-purchasing-guide/",
      publisher: "program-administrator",
      checkedOn: "2026-10-16",
    },
    {
      id: "fl-shop",
      title: "MyScholarShop",
      url: "https://www.stepupforstudents.org/scholarships/myscholarshop/",
      publisher: "program-administrator",
      checkedOn: "2026-10-16",
    },
    {
      id: "fl-vendor",
      title: "Step Up supplier onboarding",
      url: "https://www.sufs.org/schools-and-providers/vendors/",
      publisher: "program-administrator",
      checkedOn: "2026-10-16",
    },
    {
      id: "tx",
      title: "TEFA providers and vendors",
      url: "https://educationfreedom.texas.gov/providers-vendors/",
      publisher: "program-authority",
      checkedOn: "2026-10-16",
    },
    {
      id: "pdses",
      title: "Texas PDSES resources",
      url: "https://spedtex.tea.texas.gov/resources/pdses-resources",
      publisher: "program-authority",
      checkedOn: "2026-10-16",
    },
    {
      id: "al",
      title: "Alabama 2026–27 provider guide",
      url: "https://classwallet.com/alchoose/assets/CHOOSE_ACT_education_service_provider_guide_2026-2027.pdf",
      publisher: "program-administrator",
      checkedOn: "2026-10-16",
    },
    {
      id: "nc",
      title: "NC ESA+ allowable expenses",
      url: "https://k12.ncseaa.edu/the-education-student-accounts/current-families/allowable-expenses/",
      publisher: "program-authority",
      checkedOn: "2026-10-16",
    },
    {
      id: "nc-curriculum",
      title: "NC ESA+ curriculum purchasing and vendor routes",
      url: "https://k12.ncseaa.edu/the-education-student-accounts/current-families/allowable-expenses/curriculum/",
      publisher: "program-authority",
      checkedOn: "2026-10-17",
    },
    {
      id: "nc-apps-2026",
      title: "NC ESA+ educational apps, effective 2026–27",
      url: "https://k12.ncseaa.edu/media/wi0miksa/educational-apps.pdf",
      publisher: "program-authority",
      checkedOn: "2026-10-17",
    },
    {
      id: "wv",
      title: "West Virginia approved school and provider directory",
      url: "https://hopescholarshipwv.gov/Home/Schools/Participating-Schools/portalid/7",
      publisher: "program-authority",
      checkedOn: "2026-10-16",
    },
    {
      id: "odyssey",
      title: "Odyssey vendor registration channels",
      url: "https://withodyssey.com/en/solutions/vendors",
      publisher: "payment-platform",
      checkedOn: "2026-10-16",
    },
    {
      id: "cw",
      title: "ClassWallet ecommerce integration",
      url: "https://classwallet.com/ecommerce-vendor-integration/",
      publisher: "payment-platform",
      checkedOn: "2026-10-16",
    },
    {
      id: "cw-faq",
      title: "ClassWallet spending authority FAQ",
      url: "https://classwallet.com/frequently-asked-questions/",
      publisher: "payment-platform",
      checkedOn: "2026-10-16",
    },
    {
      id: "az-handbook-checked-2026",
      title: "ADE-linked current handbook, titled 2025–2026",
      url: "https://www.azed.gov/sites/default/files/2025/06/ESA%202025-2026%20Handbook.pdf",
      publisher: "program-authority",
      checkedOn: "2026-10-17",
    },
    {
      id: "fl-supplier-intake-2026",
      title: "MyScholarShop supplier interest form, public onboarding steps",
      url: "https://survey.alchemer.com/s3/7190874/MyScholarShop-Supplier-Interest-Form",
      publisher: "program-administrator",
      checkedOn: "2026-10-17",
    },
    {
      id: "tx-software-cap-2026",
      title: "TEFA purchase restrictions, updated October 5, 2026",
      url: "https://support.withodyssey.com/hc/en-us/articles/52391445784347-What-Are-the-Purchase-Restrictions-for-TEFA",
      publisher: "program-administrator",
      checkedOn: "2026-10-17",
    },
  ],
  jurisdictions: [
    {
      code: "AL",
      name: "Alabama",
      researchStatus: "partial",
      programIds: ["al-choose"],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "AK",
      name: "Alaska",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "AZ",
      name: "Arizona",
      researchStatus: "partial",
      programIds: ["az-esa"],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "AR",
      name: "Arkansas",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "CA",
      name: "California",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "CO",
      name: "Colorado",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "CT",
      name: "Connecticut",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "DE",
      name: "Delaware",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "DC",
      name: "District of Columbia",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "FL",
      name: "Florida",
      researchStatus: "partial",
      programIds: ["fl-pep", "fl-fes-ua"],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "GA",
      name: "Georgia",
      researchStatus: "partial",
      programIds: ["ga-promise"],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "HI",
      name: "Hawaii",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "ID",
      name: "Idaho",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "IL",
      name: "Illinois",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "IN",
      name: "Indiana",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "IA",
      name: "Iowa",
      researchStatus: "partial",
      programIds: ["ia-students-first"],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "KS",
      name: "Kansas",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "KY",
      name: "Kentucky",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "LA",
      name: "Louisiana",
      researchStatus: "partial",
      programIds: ["la-gator"],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "ME",
      name: "Maine",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "MD",
      name: "Maryland",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "MA",
      name: "Massachusetts",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "MI",
      name: "Michigan",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "MN",
      name: "Minnesota",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "MS",
      name: "Mississippi",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "MO",
      name: "Missouri",
      researchStatus: "partial",
      programIds: ["mo-moscholars"],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "MT",
      name: "Montana",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "NE",
      name: "Nebraska",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "NV",
      name: "Nevada",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "NH",
      name: "New Hampshire",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "NJ",
      name: "New Jersey",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "NM",
      name: "New Mexico",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "NY",
      name: "New York",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "NC",
      name: "North Carolina",
      researchStatus: "partial",
      programIds: ["nc-esa-plus"],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "ND",
      name: "North Dakota",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "OH",
      name: "Ohio",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "OK",
      name: "Oklahoma",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "OR",
      name: "Oregon",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "PA",
      name: "Pennsylvania",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "RI",
      name: "Rhode Island",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "SC",
      name: "South Carolina",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "SD",
      name: "South Dakota",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "TN",
      name: "Tennessee",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "TX",
      name: "Texas",
      researchStatus: "partial",
      programIds: ["tx-tefa", "tx-pdses"],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "UT",
      name: "Utah",
      researchStatus: "partial",
      programIds: ["ut-fits-all"],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "VT",
      name: "Vermont",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "VA",
      name: "Virginia",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "WA",
      name: "Washington",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "WV",
      name: "West Virginia",
      researchStatus: "partial",
      programIds: ["wv-hope"],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "WI",
      name: "Wisconsin",
      researchStatus: "not-researched",
      programIds: [],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
    {
      code: "WY",
      name: "Wyoming",
      researchStatus: "partial",
      programIds: ["wy-esa"],
      nextAction:
        "Inventory official ESA, scholarship, special-education grant, district and charter purchasing channels; verify current-year operation and product eligibility.",
    },
  ],
  programs: [
    {
      id: "az-esa",
      jurisdiction: "AZ",
      name: "Empowerment Scholarship Account",
      kind: "esa",
      researchStatus: "official-sources-reviewed",
      priority: "first-wave",
      administrator: "Arizona Department of Education",
      platform: "ClassWallet",
      facts: [
        {
          statement:
            "The currently linked handbook limits online subscriptions to the contract year and requires student name and service dates on invoices; its title is 2025–2026, so confirm current-year applicability.",
          sourceIds: ["az-handbook-checked-2026"],
        },
        {
          statement:
            "ADE provides a vendor registration link and distinguishes Marketplace, Direct Pay and reimbursement.",
          sourceIds: ["az"],
        },
        {
          statement:
            "ClassWallet processes payments; program administrators decide whether transactions are allowable.",
          sourceIds: ["cw-faq"],
        },
      ],
      annualSubscription: "unconfirmed",
      purchasingRoutes: ["marketplace", "direct-pay", "reimbursement"],
      corpora: {
        vendor: {
          status: "not-applied",
        },
        sku: {
          status: "not-applied",
        },
        listing: {
          status: "not-applied",
        },
        payment: "not-configured",
      },
      unknowns: [
        "Exact annual student SKU eligibility and license dates across program years.",
        "Current vendor documentation, fees, settlement and digital fulfillment requirements.",
        "Refund and renewal rules for downloaded materials and subscriptions.",
      ],
      nextAction:
        "Review current program rules and obtain written requirements for the annual math curriculum SKU before submitting an application.",
    },
    {
      id: "fl-pep",
      jurisdiction: "FL",
      name: "Personalized Education Program (FTC-PEP)",
      kind: "scholarship",
      researchStatus: "official-sources-reviewed",
      priority: "first-wave",
      administrator: "Step Up For Students",
      platform: "Step Up / MyScholarShop",
      facts: [
        {
          statement:
            "The linked supplier intake names Mirakl while the landing page retains Ariba instructions; obtain the issued onboarding packet before choosing an integration.",
          sourceIds: ["fl-supplier-intake-2026"],
        },
        {
          statement:
            "PEP permits educational application subscriptions; when a single-user subscription exists, a multi-user purchase is prorated to the student portion.",
          sourceIds: ["fl-pep"],
        },
        {
          statement:
            "MyScholarShop sells instructional materials and curriculum; Find Providers is the separate service channel.",
          sourceIds: ["fl-pep"],
        },
        {
          statement:
            "Supplier onboarding includes vetting, an onboarding call and catalog/order testing.",
          sourceIds: ["fl-vendor"],
        },
      ],
      annualSubscription: "category-supported-term-unconfirmed",
      purchasingRoutes: ["marketplace", "reimbursement"],
      corpora: {
        vendor: {
          status: "not-applied",
        },
        sku: {
          status: "not-applied",
        },
        listing: {
          status: "not-applied",
        },
        payment: "not-configured",
      },
      unknowns: [
        "Exact annual student SKU eligibility and license dates across program years.",
        "Current vendor documentation, fees, settlement and digital fulfillment requirements.",
        "Refund and renewal rules for downloaded materials and subscriptions.",
      ],
      nextAction:
        "Review current program rules and obtain written requirements for the annual math curriculum SKU before submitting an application.",
    },
    {
      id: "fl-fes-ua",
      jurisdiction: "FL",
      name: "Family Empowerment Scholarship for Students with Unique Abilities",
      kind: "esa",
      researchStatus: "official-sources-reviewed",
      priority: "first-wave",
      administrator: "Step Up For Students",
      platform: "Step Up / MyScholarShop",
      facts: [
        {
          statement:
            "The linked supplier intake names Mirakl while the landing page retains Ariba instructions; obtain the issued onboarding packet before choosing an integration.",
          sourceIds: ["fl-supplier-intake-2026"],
        },
        {
          statement:
            "MyScholarShop offers eligible instructional materials and curriculum with direct scholarship payment and supports families with FES-UA funds.",
          sourceIds: ["fl-shop"],
        },
        {
          statement:
            "Product supplier onboarding requires review; it is distinct from service-provider registration.",
          sourceIds: ["fl-vendor"],
        },
      ],
      annualSubscription: "unconfirmed",
      purchasingRoutes: ["marketplace", "reimbursement"],
      corpora: {
        vendor: {
          status: "not-applied",
        },
        sku: {
          status: "not-applied",
        },
        listing: {
          status: "not-applied",
        },
        payment: "not-configured",
      },
      unknowns: [
        "Exact annual student SKU eligibility and license dates across program years.",
        "Current vendor documentation, fees, settlement and digital fulfillment requirements.",
        "Refund and renewal rules for downloaded materials and subscriptions.",
      ],
      nextAction:
        "Review current program rules and obtain written requirements for the annual math curriculum SKU before submitting an application.",
    },
    {
      id: "tx-tefa",
      jurisdiction: "TX",
      name: "Texas Education Freedom Accounts",
      kind: "esa",
      researchStatus: "official-sources-reviewed",
      priority: "first-wave",
      administrator: "Texas Comptroller of Public Accounts",
      platform: "Odyssey",
      facts: [
        {
          statement:
            "Software Programs share the collective technology purchase limit of ten percent of the annual award; exact SKU classification requires review.",
          sourceIds: ["tx-software-cap-2026"],
        },
        {
          statement:
            "Vendor applications are rolling; the Comptroller reviews vendors and offerings for marketplace eligibility.",
          sourceIds: ["tx"],
        },
        {
          statement:
            "Approved vendors need the right to transact business in Texas; online and out-of-state providers can participate after approval.",
          sourceIds: ["tx"],
        },
        {
          statement:
            "Existing PDSES vendors in good standing have a streamlined path subject to Texas business registration.",
          sourceIds: ["tx"],
        },
      ],
      annualSubscription: "unconfirmed",
      purchasingRoutes: ["marketplace"],
      corpora: {
        vendor: {
          status: "not-applied",
        },
        sku: {
          status: "not-applied",
        },
        listing: {
          status: "not-applied",
        },
        payment: "not-configured",
      },
      unknowns: [
        "Exact annual student SKU eligibility and license dates across program years.",
        "Current vendor documentation, fees, settlement and digital fulfillment requirements.",
        "Refund and renewal rules for downloaded materials and subscriptions.",
      ],
      nextAction:
        "Review current program rules and obtain written requirements for the annual math curriculum SKU before submitting an application.",
    },
    {
      id: "tx-pdses",
      jurisdiction: "TX",
      name: "Parent-Directed Special Education Services",
      kind: "special-education-grant",
      researchStatus: "official-sources-reviewed",
      priority: "second-wave",
      administrator: "Texas Education Agency",
      platform: "ClassWallet",
      facts: [
        {
          statement:
            "PDSES provides a one-time $1,500 grant to eligible public-school students receiving special education; its marketplace supports educational goods and services.",
          sourceIds: ["pdses"],
        },
      ],
      annualSubscription: "unconfirmed",
      purchasingRoutes: ["marketplace"],
      corpora: {
        vendor: {
          status: "not-applied",
        },
        sku: {
          status: "not-applied",
        },
        listing: {
          status: "not-applied",
        },
        payment: "not-configured",
      },
      unknowns: [
        "Exact annual student SKU eligibility and license dates across program years.",
        "Current vendor documentation, fees, settlement and digital fulfillment requirements.",
        "Refund and renewal rules for downloaded materials and subscriptions.",
      ],
      nextAction:
        "Review current program rules and obtain written requirements for the annual math curriculum SKU before submitting an application.",
    },
    {
      id: "al-choose",
      jurisdiction: "AL",
      name: "CHOOSE Act",
      kind: "esa",
      researchStatus: "official-sources-reviewed",
      priority: "second-wave",
      administrator: "Alabama Department of Revenue",
      platform: "ClassWallet",
      facts: [
        {
          statement:
            "ESP applications are available year-round; ALDOR approval precedes ClassWallet registration.",
          sourceIds: ["al"],
        },
        {
          statement:
            "Listed expense categories include curriculum, textbooks, and educational software and applications.",
          sourceIds: ["al"],
        },
      ],
      annualSubscription: "unconfirmed",
      purchasingRoutes: ["marketplace", "direct-pay"],
      corpora: {
        vendor: {
          status: "not-applied",
        },
        sku: {
          status: "not-applied",
        },
        listing: {
          status: "not-applied",
        },
        payment: "not-configured",
      },
      unknowns: [
        "Exact annual student SKU eligibility and license dates across program years.",
        "Current vendor documentation, fees, settlement and digital fulfillment requirements.",
        "Refund and renewal rules for downloaded materials and subscriptions.",
      ],
      nextAction:
        "Review current program rules and obtain written requirements for the annual math curriculum SKU before submitting an application.",
    },
    {
      id: "nc-esa-plus",
      jurisdiction: "NC",
      name: "Education Student Accounts (ESA+)",
      kind: "esa",
      researchStatus: "official-sources-reviewed",
      priority: "second-wave",
      administrator: "North Carolina State Education Assistance Authority",
      platform: "ClassWallet",
      facts: [
        {
          statement:
            "New curriculum vendors must join ClassWallet Marketplace. Existing Product Provider List vendors use Pay Vendor with exact-item, final-price documentation and SEAA review; marketplace presence alone does not establish eligibility.",
          sourceIds: ["nc-curriculum"],
        },
        {
          statement:
            "Curricular products include lesson plans, learning kits and workbooks; service providers follow a separate enrollment path.",
          sourceIds: ["nc-curriculum"],
        },
        {
          statement:
            "For 2026–27, prior-approved mobile educational apps and app-store in-app subscriptions may be reimbursed. Third-party subscription receipts and desktop-designed apps are excluded; AMP approval is unestablished.",
          sourceIds: ["nc-apps-2026"],
        },
      ],
      annualSubscription: "unconfirmed",
      purchasingRoutes: ["marketplace", "direct-pay", "reimbursement"],
      corpora: {
        vendor: {
          status: "not-applied",
        },
        sku: {
          status: "not-applied",
        },
        listing: {
          status: "not-applied",
        },
        payment: "not-configured",
      },
      unknowns: [
        "Exact annual student SKU eligibility and license dates across program years.",
        "Current vendor documentation, fees, settlement and digital fulfillment requirements.",
        "Refund and renewal rules for downloaded materials and subscriptions.",
      ],
      nextAction:
        "Review current program rules and obtain written requirements for the annual math curriculum SKU before submitting an application.",
    },
    {
      id: "wv-hope",
      jurisdiction: "WV",
      name: "Hope Scholarship",
      kind: "scholarship",
      researchStatus: "official-sources-reviewed",
      priority: "second-wave",
      administrator: "West Virginia Hope Scholarship program",
      platform: "unverified",
      facts: [
        {
          statement:
            "The official directory lists providers after their marketplace services are submitted and approved; account creation alone is insufficient.",
          sourceIds: ["wv"],
        },
      ],
      annualSubscription: "unconfirmed",
      purchasingRoutes: ["marketplace"],
      corpora: {
        vendor: {
          status: "not-applied",
        },
        sku: {
          status: "not-applied",
        },
        listing: {
          status: "not-applied",
        },
        payment: "not-configured",
      },
      unknowns: [
        "Current payment platform and complete provider onboarding procedure.",
        "Annual digital curriculum SKU eligibility, purchasing routes, fulfillment and refund requirements.",
        "Current program-year funding, eligibility and legal status.",
      ],
      nextAction:
        "Review current program rules and obtain written requirements for the annual math curriculum SKU before submitting an application.",
    },
    {
      id: "ia-students-first",
      jurisdiction: "IA",
      name: "Students First ESA",
      kind: "esa",
      researchStatus: "platform-discovered",
      priority: "research",
      administrator: "Unverified: consult program authority",
      platform: "Odyssey",
      facts: [
        {
          statement:
            "Odyssey lists a vendor registration channel for Students First ESA; current legal operation and curriculum purchasing rules require authority verification.",
          sourceIds: ["odyssey"],
        },
      ],
      annualSubscription: "unconfirmed",
      purchasingRoutes: [],
      corpora: {
        vendor: {
          status: "not-applied",
        },
        sku: {
          status: "not-applied",
        },
        listing: {
          status: "not-applied",
        },
        payment: "not-configured",
      },
      unknowns: [
        "Program authority, current operation and legal status, and current year eligibility.",
        "Whether this program can pay for a standalone annual digital math curriculum.",
        "Vendor and product approval, payment routes, fees and settlement requirements.",
      ],
      nextAction:
        "Review current program rules and obtain written requirements for the annual math curriculum SKU before submitting an application.",
    },
    {
      id: "ga-promise",
      jurisdiction: "GA",
      name: "Georgia Promise Scholarship",
      kind: "scholarship",
      researchStatus: "platform-discovered",
      priority: "research",
      administrator: "Unverified: consult program authority",
      platform: "Odyssey",
      facts: [
        {
          statement:
            "Odyssey lists a vendor registration channel for Georgia Promise Scholarship; current legal operation and curriculum purchasing rules require authority verification.",
          sourceIds: ["odyssey"],
        },
      ],
      annualSubscription: "unconfirmed",
      purchasingRoutes: [],
      corpora: {
        vendor: {
          status: "not-applied",
        },
        sku: {
          status: "not-applied",
        },
        listing: {
          status: "not-applied",
        },
        payment: "not-configured",
      },
      unknowns: [
        "Program authority, current operation and legal status, and current year eligibility.",
        "Whether this program can pay for a standalone annual digital math curriculum.",
        "Vendor and product approval, payment routes, fees and settlement requirements.",
      ],
      nextAction:
        "Review current program rules and obtain written requirements for the annual math curriculum SKU before submitting an application.",
    },
    {
      id: "la-gator",
      jurisdiction: "LA",
      name: "Louisiana GATOR",
      kind: "esa",
      researchStatus: "platform-discovered",
      priority: "research",
      administrator: "Unverified: consult program authority",
      platform: "Odyssey",
      facts: [
        {
          statement:
            "Odyssey lists a vendor registration channel for Louisiana GATOR; current legal operation and curriculum purchasing rules require authority verification.",
          sourceIds: ["odyssey"],
        },
      ],
      annualSubscription: "unconfirmed",
      purchasingRoutes: [],
      corpora: {
        vendor: {
          status: "not-applied",
        },
        sku: {
          status: "not-applied",
        },
        listing: {
          status: "not-applied",
        },
        payment: "not-configured",
      },
      unknowns: [
        "Program authority, current operation and legal status, and current year eligibility.",
        "Whether this program can pay for a standalone annual digital math curriculum.",
        "Vendor and product approval, payment routes, fees and settlement requirements.",
      ],
      nextAction:
        "Review current program rules and obtain written requirements for the annual math curriculum SKU before submitting an application.",
    },
    {
      id: "mo-moscholars",
      jurisdiction: "MO",
      name: "MOScholars",
      kind: "scholarship",
      researchStatus: "platform-discovered",
      priority: "research",
      administrator: "Unverified: consult program authority",
      platform: "Odyssey",
      facts: [
        {
          statement:
            "Odyssey lists a vendor registration channel for MOScholars; current legal operation and curriculum purchasing rules require authority verification.",
          sourceIds: ["odyssey"],
        },
      ],
      annualSubscription: "unconfirmed",
      purchasingRoutes: [],
      corpora: {
        vendor: {
          status: "not-applied",
        },
        sku: {
          status: "not-applied",
        },
        listing: {
          status: "not-applied",
        },
        payment: "not-configured",
      },
      unknowns: [
        "Program authority, current operation and legal status, and current year eligibility.",
        "Whether this program can pay for a standalone annual digital math curriculum.",
        "Vendor and product approval, payment routes, fees and settlement requirements.",
      ],
      nextAction:
        "Review current program rules and obtain written requirements for the annual math curriculum SKU before submitting an application.",
    },
    {
      id: "wy-esa",
      jurisdiction: "WY",
      name: "Wyoming ESA",
      kind: "esa",
      researchStatus: "platform-discovered",
      priority: "research",
      administrator: "Unverified: consult program authority",
      platform: "Odyssey",
      facts: [
        {
          statement:
            "Odyssey lists a vendor registration channel for Wyoming ESA; current legal operation and curriculum purchasing rules require authority verification.",
          sourceIds: ["odyssey"],
        },
      ],
      annualSubscription: "unconfirmed",
      purchasingRoutes: [],
      corpora: {
        vendor: {
          status: "not-applied",
        },
        sku: {
          status: "not-applied",
        },
        listing: {
          status: "not-applied",
        },
        payment: "not-configured",
      },
      unknowns: [
        "Program authority, current operation and legal status, and current year eligibility.",
        "Whether this program can pay for a standalone annual digital math curriculum.",
        "Vendor and product approval, payment routes, fees and settlement requirements.",
      ],
      nextAction:
        "Review current program rules and obtain written requirements for the annual math curriculum SKU before submitting an application.",
    },
    {
      id: "ut-fits-all",
      jurisdiction: "UT",
      name: "Utah Fits All",
      kind: "scholarship",
      researchStatus: "platform-discovered",
      priority: "research",
      administrator: "Unverified: consult program authority",
      platform: "Odyssey",
      facts: [
        {
          statement:
            "Odyssey lists a vendor registration channel for Utah Fits All; current legal operation and curriculum purchasing rules require authority verification.",
          sourceIds: ["odyssey"],
        },
      ],
      annualSubscription: "unconfirmed",
      purchasingRoutes: [],
      corpora: {
        vendor: {
          status: "not-applied",
        },
        sku: {
          status: "not-applied",
        },
        listing: {
          status: "not-applied",
        },
        payment: "not-configured",
      },
      unknowns: [
        "Program authority, current operation and legal status, and current year eligibility.",
        "Whether this program can pay for a standalone annual digital math curriculum.",
        "Vendor and product approval, payment routes, fees and settlement requirements.",
      ],
      nextAction:
        "Review current program rules and obtain written requirements for the annual math curriculum SKU before submitting an application.",
    },
  ],
};

export const fundingRegistry = expandFundingRegistry(baseFundingRegistry);
