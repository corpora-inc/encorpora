/** Official-source research checked 2026-10-17. Evidence is not purchase approval. */
export type PurchaseModel =
  | "parent-curriculum"
  | "tuition-first"
  | "school-tuition"
  | "family-tax-benefit"
  | "institutional"
  | "approved-specialist";
export type OperatingStatus =
  | "operating"
  | "existing-balances-only"
  | "current-year-unconfirmed"
  | "closed";
export interface NationalProgramReview {
  id: string;
  jurisdiction: string;
  name: string;
  purchaseModel: PurchaseModel;
  operatingStatus: OperatingStatus;
  platform:
    "ClassWallet" | "Step Up / MyScholarShop" | "Odyssey" | "unverified";
  evidence: readonly { url: string; statement: string }[];
  onboarding: { url: string; requirements: string };
  unknowns: readonly string[];
}
export const nationalReviewCheckedOn = "2026-10-17";
export const nationalProgramReviews: readonly NationalProgramReview[] = [
  {
    id: "ia-students-first",
    jurisdiction: "IA",
    name: "Students First ESA",
    purchaseModel: "tuition-first",
    operatingStatus: "operating",
    platform: "Odyssey",
    evidence: [
      {
        url: "https://educate.iowa.gov/pk-12/educational-choice/education-savings-accounts",
        statement:
          "Participants attend accredited Iowa nonpublic schools. Each semester tuition and fees are paid before remaining funds become available for approved marketplace expenses. Awards are student-specific.",
      },
    ],
    onboarding: {
      url: "https://educate.iowa.gov/pk-12/educational-choice/education-savings-accounts",
      requirements:
        "Apply through the vendor registration linked by Iowa DOE; vendor and offerings must be approved. Confirm current settlement terms because the linked vendor FAQ dates to 2023.",
    },
    unknowns: [
      "Confirm the released annual student SKU, eligible term, refund rules and current purchasing approval before offering funded checkout.",
    ],
  },
  {
    id: "ga-promise",
    jurisdiction: "GA",
    name: "Georgia Promise Scholarship",
    purchaseModel: "parent-curriculum",
    operatingStatus: "operating",
    platform: "Odyssey",
    evidence: [
      {
        url: "https://mygeorgiapromise.org/",
        statement:
          "The program accepts service provider and vendor applications year-round; approved expense categories include curricula and supplemental materials.",
      },
    ],
    onboarding: {
      url: "https://mygeorgiapromise.org/",
      requirements:
        "Use the official provider/vendor application and obtain offering approval; confirm educational-product documentation in the current provider handbook.",
    },
    unknowns: [
      "Confirm the released annual student SKU, eligible term, refund rules and current purchasing approval before offering funded checkout.",
    ],
  },
  {
    id: "la-gator",
    jurisdiction: "LA",
    name: "LA GATOR Scholarship",
    purchaseModel: "parent-curriculum",
    operatingStatus: "operating",
    platform: "Odyssey",
    evidence: [
      {
        url: "https://doe.louisiana.gov/topic-pages/louisiana-school-choice/la-gator/la-gator-policy",
        statement:
          "LA GATOR provides K–12 education savings accounts; provider applications require LDOE consideration. Participation excludes concurrent BESE-approved home study or registered nonpublic home study not seeking approval.",
      },
    ],
    onboarding: {
      url: "https://doe.louisiana.gov/topic-pages/louisiana-school-choice/la-gator/la-gator-service-providers",
      requirements:
        "Use LDOE service-provider instructions and Odyssey setup. Confirm curriculum category, catalog price limits and provider documentation.",
    },
    unknowns: [
      "Confirm the released annual student SKU, eligible term, refund rules and current purchasing approval before offering funded checkout.",
    ],
  },
  {
    id: "mo-moscholars",
    jurisdiction: "MO",
    name: "MOScholars",
    purchaseModel: "parent-curriculum",
    operatingStatus: "operating",
    platform: "Odyssey",
    evidence: [
      {
        url: "https://treasurer.mo.gov/moscholars/Providers",
        statement:
          "The Treasurer links Odyssey vendor applications. Educational-products vendors supply business registration or articles of incorporation.",
      },
    ],
    onboarding: {
      url: "https://treasurer.mo.gov/moscholars/Providers",
      requirements:
        "Operate as a US entity; offer eligible products; comply with related-party restrictions; do not share, refund or rebate scholarship funds to a parent/student.",
    },
    unknowns: [
      "Confirm the released annual student SKU, eligible term, refund rules and current purchasing approval before offering funded checkout.",
    ],
  },
  {
    id: "wy-esa",
    jurisdiction: "WY",
    name: "Steamboat Legacy Scholarship / Wyoming ESA",
    purchaseModel: "parent-curriculum",
    operatingStatus: "operating",
    platform: "Odyssey",
    evidence: [
      {
        url: "https://edu.wyoming.gov/parents/education-savings-accounts/",
        statement:
          "The authority reports distribution authorized after the Supreme Court lifted an injunction. Curriculum is eligible; K–12 core curriculum is among specified reimbursement categories. Broader litigation continues.",
      },
    ],
    onboarding: {
      url: "https://wyoming-vendors.withodyssey.com",
      requirements:
        "Use the linked education service provider application and handbook. Verify product approval and that a requested reimbursement fits the specifically permitted category.",
    },
    unknowns: [
      "Confirm the released annual student SKU, eligible term, refund rules and current purchasing approval before offering funded checkout.",
    ],
  },
  {
    id: "ut-fits-all",
    jurisdiction: "UT",
    name: "Utah Fits All Scholarship",
    purchaseModel: "parent-curriculum",
    operatingStatus: "operating",
    platform: "Odyssey",
    evidence: [
      {
        url: "https://schools.utah.gov/utahfitsallscholarship",
        statement:
          "USBE identifies Odyssey as program manager effective May 16, 2025.",
      },
    ],
    onboarding: {
      url: "https://support.withodyssey.com/hc/en-us/articles/37494425843611-Who-can-be-a-Utah-Fits-All-Scholarship-provider",
      requirements:
        "Provide EIN, address, contacts and offering descriptions; provider and each offering are reviewed separately. Direct delivery is required; ownership changes require reapplication.",
    },
    unknowns: [
      "Confirm the released annual student SKU, eligible term, refund rules and current purchasing approval before offering funded checkout.",
    ],
  },
  {
    id: "ar-efa",
    jurisdiction: "AR",
    name: "Education Freedom Accounts",
    purchaseModel: "parent-curriculum",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://dese.ade.arkansas.gov/Offices/office-of-school-choice-and-parent-empowerment/education-freedom-accounts/information-for-service-providers",
        statement:
          "The authority accepts new service-provider/vendor applications for persons or entities supplying qualifying goods and services.",
      },
    ],
    onboarding: {
      url: "https://learns.ade.arkansas.gov/",
      requirements:
        "Apply through the linked EFA vendor/service-provider process. Product vendors must establish eligible goods; tutoring credentials are a separate service category.",
    },
    unknowns: [
      "Confirm the released annual student SKU, eligible term, refund rules and current purchasing approval before offering funded checkout.",
    ],
  },
  {
    id: "in-esa",
    jurisdiction: "IN",
    name: "Education Scholarship Account",
    purchaseModel: "parent-curriculum",
    operatingStatus: "operating",
    platform: "ClassWallet",
    evidence: [
      {
        url: "https://www.in.gov/doe/eoq/esa",
        statement:
          "IDOE administers the disability-and-sibling ESA in 2026–27. Subscriptions qualify when sold by approved vendors in ClassWallet Marketplace.",
      },
    ],
    onboarding: {
      url: "https://www.in.gov/doe/eoq/esa",
      requirements:
        "Apply through Access Indiana and ClassWallet; approval is communicated by email. The authority identifies quarterly invoice processing through ClassWallet.",
    },
    unknowns: [
      "Confirm the released annual student SKU, eligible term, refund rules and current purchasing approval before offering funded checkout.",
    ],
  },
  {
    id: "nh-efa",
    jurisdiction: "NH",
    name: "Education Freedom Accounts",
    purchaseModel: "parent-curriculum",
    operatingStatus: "operating",
    platform: "ClassWallet",
    evidence: [
      {
        url: "https://nh.scholarshipfund.org/apply/nh-education-freedom-accounts/",
        statement:
          "The administrator describes approved tuition, online learning, tutoring and educational-material purchases through EFA funds.",
      },
    ],
    onboarding: {
      url: "https://nh.scholarshipfund.org/contact/",
      requirements:
        "Apply through CSF education-provider registration. Verify the product-vendor path and ClassWallet setup separately from credentials for direct instructional services.",
    },
    unknowns: [
      "Confirm the released annual student SKU, eligible term, refund rules and current purchasing approval before offering funded checkout.",
    ],
  },
  {
    id: "mt-special-needs-esa",
    jurisdiction: "MT",
    name: "Special Needs Equal Opportunity ESA",
    purchaseModel: "parent-curriculum",
    operatingStatus: "current-year-unconfirmed",
    platform: "unverified",
    evidence: [
      {
        url: "https://opi.mt.gov/Families-Students/Parent-Resources/Education-Savings-Account",
        statement:
          "OPI describes reimbursement for eligible children with disabilities and a litigation stay through the end of a school year; its linked announcement is December 18, 2025.",
      },
    ],
    onboarding: {
      url: "https://opi.mt.gov/Families-Students/Parent-Resources/Education-Savings-Account",
      requirements:
        "Prepare itemized proof of purchase for parent reimbursement under the OPI handbook; verify current operation before accepting any funded order.",
    },
    unknowns: [
      "The reviewed authority notice does not establish litigation or operating status for the 2026–27 year; obtain current written confirmation. Confirm digital curriculum eligibility.",
    ],
  },
  {
    id: "ms-esa",
    jurisdiction: "MS",
    name: "Education Scholarship Account",
    purchaseModel: "parent-curriculum",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.mdek12.org/specialeducation/esa/",
        statement:
          "MDE publishes 2026–27 application, school-assurance and reimbursement forms for eligible students with special needs who leave public school.",
      },
    ],
    onboarding: {
      url: "https://www.mdek12.org/specialeducation/esa/",
      requirements:
        "Use the current MDE allowable-expenses list and reimbursement documentation. A school-assurance application is not a general product-vendor approval.",
    },
    unknowns: [
      "Confirm online math curriculum within the current allowable list and whether a vendor approval is needed for product reimbursement; do not infer it from private-school eligibility.",
    ],
  },
  {
    id: "sc-estf",
    jurisdiction: "SC",
    name: "Education Scholarship Trust Fund",
    purchaseModel: "parent-curriculum",
    operatingStatus: "operating",
    platform: "ClassWallet",
    evidence: [
      {
        url: "https://ed.sc.gov/newsroom/estf-faq/",
        statement:
          "SCDE describes direct account purchases/payments; enrollment in Option 1–3 homeschool associations is not eligible for ESTF.",
      },
    ],
    onboarding: {
      url: "https://www.ed.sc.gov/newsroom/strategic-engagement/education-scholarship-trust-fund-program/",
      requirements:
        "Apply as an education service provider through SCDE. Verify the curriculum supplier category and listing after approval.",
    },
    unknowns: [
      "Confirm the released annual student SKU, eligible term, refund rules and current purchasing approval before offering funded checkout.",
    ],
  },
  {
    id: "tn-iea",
    jurisdiction: "TN",
    name: "Individualized Education Account",
    purchaseModel: "parent-curriculum",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.tn.gov/education/iea/iea-parents-students.html.html",
        statement:
          "Approved expenses include homeschool curricula and approved online programs for eligible students with disabilities.",
      },
    ],
    onboarding: {
      url: "https://www.tn.gov/education/iea/iea-parents-students.html.html",
      requirements:
        "Use the current IEA account-holder handbook for eligible curriculum and documentation; service-provider credentials must not be substituted for product rules.",
    },
    unknowns: [
      "Confirm the released annual student SKU, eligible term, refund rules and current purchasing approval before offering funded checkout.",
    ],
  },
  {
    id: "tn-efs",
    jurisdiction: "TN",
    name: "Education Freedom Scholarship",
    purchaseModel: "tuition-first",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.tn.gov/education/efs/efs-faqs.html",
        statement:
          "Students enroll in registered Tennessee nonpublic schools. Tuition and fees take priority; remaining scholarship funds may pay specified approved educational expenses.",
      },
    ],
    onboarding: {
      url: "https://www.tn.gov/education/efs/efs-faqs.html",
      requirements:
        "Verify the digital curriculum category with current EFS rules. School registration alone is not a standalone subscription-vendor application.",
    },
    unknowns: [
      "Confirm whether standalone adaptive software qualifies; residual-funds categories and bundled-software rules must be checked before listing.",
    ],
  },
  {
    id: "tn-esa",
    jurisdiction: "TN",
    name: "Education Savings Account",
    purchaseModel: "tuition-first",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.tn.gov/education/esa/parents-and-students.html",
        statement:
          "Tennessee maintains a separate ESA program from IEA and EFS with its own parent and student requirements.",
      },
    ],
    onboarding: {
      url: "https://www.tn.gov/education/esa/parents-and-students.html",
      requirements:
        "Review the ESA-specific provider application and purchasing handbook; do not reuse an EFS or IEA approval.",
    },
    unknowns: [
      "Verify current county/student eligibility, residual expense categories, annual subscription terms and vendor payment route.",
    ],
  },
  {
    id: "ut-csos",
    jurisdiction: "UT",
    name: "Carson Smith Opportunity Scholarship",
    purchaseModel: "parent-curriculum",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://scholarship.cfe-fund.org/2026/07/20/scholarship-fund-use-guide/",
        statement:
          "The administrator distinguishes approved curriculum providers from subscription product providers, which may be subject to a 20% product cap.",
      },
    ],
    onboarding: {
      url: "https://serviceprovider.cfe-fund.org/",
      requirements:
        "Apply through Children First Education Fund as the appropriate product provider. Obtain written classification of the curriculum plus digital subscription bundle.",
    },
    unknowns: [
      "Resolve curriculum-versus-subscription classification and associated spending cap; confirm current annual term and payment process.",
    ],
  },
  {
    id: "fl-new-worlds",
    jurisdiction: "FL",
    name: "New Worlds Scholarship Accounts",
    purchaseModel: "parent-curriculum",
    operatingStatus: "existing-balances-only",
    platform: "Step Up / MyScholarShop",
    evidence: [
      {
        url: "https://www.fldoe.org/schools/school-choice/k-12-scholarship-programs/reading/",
        statement:
          "No further accounts are awarded effective July 1, 2025; existing balances can purchase literacy and mathematics goods and services.",
      },
    ],
    onboarding: {
      url: "https://www.fldoe.org/schools/school-choice/k-12-scholarship-programs/reading/",
      requirements:
        "Confirm Step Up product eligibility for existing-balance purchases only; do not advertise new scholarship enrollment.",
    },
    unknowns: [
      "Confirm the released annual student SKU, eligible term, refund rules and current purchasing approval before offering funded checkout.",
    ],
  },
  {
    id: "id-parental-choice",
    jurisdiction: "ID",
    name: "Parental Choice Tax Credit / Advance Payment",
    purchaseModel: "family-tax-benefit",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://tax.idaho.gov/taxes/income-tax/individual-income/popular-credits-and-deductions/parental-choice-tax-credit-and-advance-payment/",
        statement:
          "For 2026 onward qualifying nonpublic curriculum can come from multiple developers but must collectively cover four core subjects. The Tax Commission cannot prequalify expenses.",
      },
    ],
    onboarding: {
      url: "https://tax.idaho.gov/taxes/income-tax/individual-income/popular-credits-and-deductions/parental-choice-tax-credit-and-advance-payment/",
      requirements:
        "Issue paid invoices identifying provider, item, amount and payment date. Families apply for an award; this is not vendor marketplace onboarding.",
    },
    unknowns: [
      "Determine how this math-only SKU fits a family’s qualifying four-subject curriculum; no automatic credit or advance-payment eligibility claim.",
    ],
  },
  {
    id: "ok-homeschool-credit",
    jurisdiction: "OK",
    name: "Homeschool Parental Choice Tax Credit",
    purchaseModel: "family-tax-benefit",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://oklahoma.gov/tax/helpcenter/income-tax.html",
        statement:
          "Oklahoma describes a refundable homeschool credit based on qualified annual expenses, capped at $1,000 per eligible student.",
      },
    ],
    onboarding: {
      url: "https://oklahoma.gov/tax/helpcenter/income-tax.html",
      requirements:
        "Provide itemized paid curriculum receipts; parents claim the credit under current tax instructions, rather than purchasing with a vendor wallet.",
    },
    unknowns: [
      "Confirm subscription classification and tax-year documentation; do not apply private-school EVN procedures to homeschool purchases.",
    ],
  },
  {
    id: "oh-home-credit",
    jurisdiction: "OH",
    name: "Home School Expenses Credit",
    purchaseModel: "family-tax-benefit",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://tax.ohio.gov/individual/file-now/ohio-tax-credits-and-their-required-documentation",
        statement:
          "Qualifying home-education expenses include subscriptions, software and applications. The cap is $250 per qualifying student from tax year 2025.",
      },
    ],
    onboarding: {
      url: "https://tax.ohio.gov/individual/file-now/ohio-tax-credits-and-their-required-documentation",
      requirements:
        "Provide paid itemized receipts. The parent claims the tax credit; Corpora does not receive approval or settlement from a scholarship marketplace.",
    },
    unknowns: [
      "Confirm the learner qualifies for parent-directed home education and retain current tax-year documentation; do not promise tax savings.",
    ],
  },
  {
    id: "mn-k12-credit-subtraction",
    jurisdiction: "MN",
    name: "K–12 Education Credit and Subtraction",
    purchaseModel: "family-tax-benefit",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.revenue.state.mn.us/qualifying-expenses",
        statement:
          "Educational software used at home can qualify subject to computer/software limits; records of actual paid expenses are required.",
      },
    ],
    onboarding: {
      url: "https://www.revenue.state.mn.us/qualifying-expenses",
      requirements:
        "Supply itemized paid invoices with educational product description; families assess credit/subtraction eligibility under current tax guidance.",
    },
    unknowns: [
      "Confirm SaaS subscription treatment, applicable family limits and the separate credit/subtraction eligibility rules.",
    ],
  },
  {
    id: "la-school-deduction",
    jurisdiction: "LA",
    name: "School Expense Deduction",
    purchaseModel: "family-tax-benefit",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://revenue.louisiana.gov/individuals/general-resources/school-expense-deduction/",
        statement:
          "Louisiana allows deductions for specified school and homeschool expenses, including necessary textbooks and curricula; deductions are not credits.",
      },
    ],
    onboarding: {
      url: "https://revenue.louisiana.gov/individuals/general-resources/school-expense-deduction/",
      requirements:
        "Supply itemized paid curriculum receipts. Families retain evidence and claim the deduction on applicable Louisiana returns.",
    },
    unknowns: [
      "Confirm subscription treatment and relevant homeschool or school-required category; do not treat deduction amounts as funds available to spend.",
    ],
  },
  {
    id: "il-education-credit",
    jurisdiction: "IL",
    name: "Education Expense Credit",
    purchaseModel: "family-tax-benefit",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://tax.illinois.gov/research/publications/pubs/education-expense-credit-general-rules.html",
        statement:
          "Illinois publishes rules for qualifying K–12 education expenses and documentation.",
      },
    ],
    onboarding: {
      url: "https://tax.illinois.gov/research/publications/pubs/education-expense-credit-general-rules.html",
      requirements:
        "Use current Publication 112 and homeschool-specific instructions before describing any purchase as qualifying.",
    },
    unknowns: [
      "Establish whether digital subscriptions or downloadable workbooks meet the qualifying book/lab-fee rules; do not assume software qualifies.",
    ],
  },
  {
    id: "nc-opportunity",
    jurisdiction: "NC",
    name: "Opportunity Scholarship",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://k12.ncseaa.edu/opportunity-scholarship/faq/",
        statement:
          "Funds can only pay tuition and fees at registered private schools.",
      },
    ],
    onboarding: {
      url: "https://k12.ncseaa.edu/opportunity-scholarship/faq/",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "az-sto",
    jurisdiction: "AZ",
    name: "School Tuition Organization scholarships (four tax-credit channels)",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://azdor.gov/reports-statistics-and-legal-research/report-school-tuition-organization-income-tax-credits",
        statement:
          "Arizona identifies four tax credits supporting STO scholarships for attendance at Arizona private schools.",
      },
    ],
    onboarding: {
      url: "https://azdor.gov/reports-statistics-and-legal-research/report-school-tuition-organization-income-tax-credits",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "al-accountability",
    jurisdiction: "AL",
    name: "Alabama Accountability Act scholarships",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.revenue.alabama.gov/individual-corporate/alabama-accountability-act/",
        statement:
          "Scholarship granting organizations support eligible low-income students attending public or private schools.",
      },
    ],
    onboarding: {
      url: "https://www.revenue.alabama.gov/individual-corporate/alabama-accountability-act/",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "ga-special-needs",
    jurisdiction: "GA",
    name: "Georgia Special Needs Scholarship",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://apps.gadoe.org/sboe/SBOE%20Rules/160-5-1-.34.pdf",
        statement:
          "Participating private schools require a completed application and State Board authorization under program rules.",
      },
    ],
    onboarding: {
      url: "https://apps.gadoe.org/sboe/SBOE%20Rules/160-5-1-.34.pdf",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "ga-qee",
    jurisdiction: "GA",
    name: "Qualified Education Expense tax-credit scholarships",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://dor.georgia.gov/qualified-education-expense-tax-credit",
        statement:
          "Georgia publishes a separate qualified education expense donation tax-credit program; it must not be confused with Georgia Promise.",
      },
    ],
    onboarding: {
      url: "https://dor.georgia.gov/qualified-education-expense-tax-credit",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "ia-sto",
    jurisdiction: "IA",
    name: "School Tuition Organization scholarships",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://educate.iowa.gov/pk-12/educational-choice/school-tuition-organizations",
        statement:
          "Iowa STOs fund tuition grants; this is separate from Students First ESA marketplace purchases.",
      },
    ],
    onboarding: {
      url: "https://educate.iowa.gov/pk-12/educational-choice/school-tuition-organizations",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "ks-low-income",
    jurisdiction: "KS",
    name: "Tax Credit for Low Income Students Scholarship",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.ksrevenue.gov/prtaxcredits-lowincomestudents.html",
        statement:
          "Eligible scholarships pay all or part of tuition at qualified Kansas schools.",
      },
    ],
    onboarding: {
      url: "https://www.ksrevenue.gov/prtaxcredits-lowincomestudents.html",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "md-boost",
    jurisdiction: "MD",
    name: "BOOST Scholarship",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://marylandpublicschools.org/pages/boost/index.aspx",
        statement:
          "The program serves participating registered nonpublic schools; awards may be reduced to tuition owed.",
      },
    ],
    onboarding: {
      url: "https://marylandpublicschools.org/pages/boost/index.aspx",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "nv-opportunity",
    jurisdiction: "NV",
    name: "Educational Choice / Opportunity Scholarship",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://doe.nv.gov/offices/office-of-student-and-school-supports/private-schools/nevada-educational-choice-scholarship-program-opportunity-scholarship",
        statement:
          "Income-eligible private-school students apply through SGOs for tuition, fees and transportation associated with attendance.",
      },
    ],
    onboarding: {
      url: "https://doe.nv.gov/offices/office-of-student-and-school-supports/private-schools/nevada-educational-choice-scholarship-program-opportunity-scholarship",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "mt-sso",
    jurisdiction: "MT",
    name: "Student Scholarship Organization scholarships",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://revenue.mt.gov/taxes/tax-credits/student-scholarship-org-credit",
        statement:
          "Approved SSOs receive donations to support instruction at qualified education providers.",
      },
    ],
    onboarding: {
      url: "https://revenue.mt.gov/taxes/tax-credits/student-scholarship-org-credit",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "pa-eitc",
    jurisdiction: "PA",
    name: "Educational Improvement Tax Credit scholarships",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.pa.gov/agencies/revenue/business-tax-credits-and-economic-development-programs/business-tax-credits-and-incentives/educational-tax-credits",
        statement:
          "EITC supports scholarship and educational-improvement organizations through business contribution tax credits.",
      },
    ],
    onboarding: {
      url: "https://www.pa.gov/agencies/revenue/business-tax-credits-and-economic-development-programs/business-tax-credits-and-incentives/educational-tax-credits",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "pa-ostc",
    jurisdiction: "PA",
    name: "Opportunity Scholarship Tax Credit",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.pa.gov/agencies/education/programs-and-services/schools/school-services/opportunity-scholarship-tax-credit-program",
        statement:
          "Eligible students apply through approved organizations to attend participating public or nonpublic schools; school participation information is updated annually.",
      },
    ],
    onboarding: {
      url: "https://www.pa.gov/agencies/education/programs-and-services/schools/school-services/opportunity-scholarship-tax-credit-program",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "ri-sgo",
    jurisdiction: "RI",
    name: "Tax Credit for Contributions to Scholarship Organizations",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://tax.ri.gov/tax-sections/credits/scholarship-credit",
        statement:
          "Rhode Island publishes the scholarship-organization contribution credit and organization reporting process.",
      },
    ],
    onboarding: {
      url: "https://tax.ri.gov/tax-sections/credits/scholarship-credit",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "sd-partners",
    jurisdiction: "SD",
    name: "Partners in Education Tax Credit scholarships",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://dlr.sd.gov/insurance/tax_credit_program/sgo_information.aspx",
        statement:
          "South Dakota administers a scholarship granting organization tax-credit program under Chapter 13-65.",
      },
    ],
    onboarding: {
      url: "https://dlr.sd.gov/insurance/tax_credit_program/sgo_information.aspx",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "va-eistc",
    jurisdiction: "VA",
    name: "Education Improvement Scholarships Tax Credits",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.doe.virginia.gov/data-policy-funding/school-finance/education-improvement-scholarships-tax-credits-program",
        statement:
          "Approved foundations pay eligible schools directly for qualifying students.",
      },
    ],
    onboarding: {
      url: "https://www.doe.virginia.gov/data-policy-funding/school-finance/education-improvement-scholarships-tax-credits-program",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "wi-choice",
    jurisdiction: "WI",
    name: "Milwaukee, Racine and Wisconsin Parental Choice Programs",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://sms.dpi.wi.gov/choiceparent/",
        statement:
          "Wisconsin offers applications for participating private-school choice programs, with distinct program school lists.",
      },
    ],
    onboarding: {
      url: "https://sms.dpi.wi.gov/choiceparent/",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "wi-special-needs",
    jurisdiction: "WI",
    name: "Special Needs Scholarship Program",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://dpi.wi.gov/sites/default/files/imce/parental-education-options/SNSP/snsp_faq_rev._june_2022_parent.pdf",
        statement:
          "DPI parent guidance describes eligible students attending participating private schools; the reviewed FAQ is dated June 2022.",
      },
    ],
    onboarding: {
      url: "https://dpi.wi.gov/sites/default/files/imce/parental-education-options/SNSP/snsp_faq_rev._june_2022_parent.pdf",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "dc-osp",
    jurisdiction: "DC",
    name: "DC Opportunity Scholarship Program",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.ed.gov/grants-and-programs/grants-special-populations/grants-economically-disadvantaged-students/dc-school-choice-scholarships-opportunity-and-results-act",
        statement:
          "The federally funded DC program enables eligible students to attend participating private schools.",
      },
    ],
    onboarding: {
      url: "https://www.ed.gov/grants-and-programs/grants-special-populations/grants-economically-disadvantaged-students/dc-school-choice-scholarships-opportunity-and-results-act",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "me-town-tuition",
    jurisdiction: "ME",
    name: "Town tuitioning",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.maine.gov/doe/funding/reports/tuition/faqs",
        statement:
          "Sending local school units pay tuition to approved schools when they do not operate the relevant grades; this is not a state parent voucher.",
      },
    ],
    onboarding: {
      url: "https://www.maine.gov/doe/funding/reports/tuition/faqs",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "vt-town-tuition",
    jurisdiction: "VT",
    name: "Town and district tuitioning",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://education.vermont.gov/accountability-data/financial-reports/tuition-rates",
        statement:
          "Eligible districts pay public-school tuition or tuition up to specified limits to approved independent schools.",
      },
    ],
    onboarding: {
      url: "https://education.vermont.gov/accountability-data/financial-reports/tuition-rates",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "ok-lnh",
    jurisdiction: "OK",
    name: "Lindsey Nicole Henry Scholarship",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.oklahoma.gov/education/services/school-choice/lnh-scholarship.html",
        statement:
          "Eligible students with special needs use scholarships toward tuition and eligible expenses at participating private schools.",
      },
    ],
    onboarding: {
      url: "https://www.oklahoma.gov/education/services/school-choice/lnh-scholarship.html",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "ok-private-credit",
    jurisdiction: "OK",
    name: "Private-school Parental Choice Tax Credit",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://oklahoma.gov/tax/individuals/parental-choice-tax-credit.html",
        statement:
          "Participating private schools register with the Tax Commission and supply student enrollment verification numbers for family applications.",
      },
    ],
    onboarding: {
      url: "https://oklahoma.gov/tax/individuals/parental-choice-tax-credit.html",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "ok-equal-opportunity",
    jurisdiction: "OK",
    name: "Equal Opportunity scholarships",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://oklahoma.gov/education/services/school-choice.html",
        statement:
          "The authority identifies tuition scholarships through the Equal Opportunity scholarship program.",
      },
    ],
    onboarding: {
      url: "https://oklahoma.gov/education/services/school-choice.html",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "la-tuition-donation",
    jurisdiction: "LA",
    name: "Tuition Donation Credit scholarships",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://doe.louisiana.gov/topic-pages/louisiana-school-choice/tuition-donation-credit-program",
        statement:
          "Families apply for scholarships through participating school tuition organizations.",
      },
    ],
    onboarding: {
      url: "https://doe.louisiana.gov/topic-pages/louisiana-school-choice/tuition-donation-credit-program",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "in-sgo",
    jurisdiction: "IN",
    name: "School Scholarship / SGO scholarships",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.in.gov/doe/students/indiana-choice-scholarship-program/school-scholarships/",
        statement:
          "IDOE provides school scholarship information separately from the Education Scholarship Account program.",
      },
    ],
    onboarding: {
      url: "https://www.in.gov/doe/students/indiana-choice-scholarship-program/school-scholarships/",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "ak-correspondence",
    jurisdiction: "AK",
    name: "Public correspondence school allotments",
    purchaseModel: "institutional",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://educ.state.ak.us/alaskan_schools/corres",
        statement:
          "Alaska DEED lists statewide correspondence schools and guidance on correspondence allotments.",
      },
    ],
    onboarding: {
      url: "https://educ.state.ak.us/alaskan_schools/corres",
      requirements:
        "Approach individual public correspondence programs using their vendor and learning-plan approval procedures; verify current law and local purchasing policy.",
    },
    unknowns: [
      "Identify a budget owner and applicable solicitation; verify digital license, accessibility, student-data and purchasing terms. This does not establish parent reimbursement eligibility.",
    ],
  },
  {
    id: "ca-independent-study",
    jurisdiction: "CA",
    name: "Public independent-study and charter purchasing",
    purchaseModel: "institutional",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.cde.ca.gov/sp/eo/is/faq.asp",
        statement:
          "Independent study operates through LEAs and their curriculum policies; public funds cannot provide benefits solely to independent-study families contrary to statutory parity rules.",
      },
    ],
    onboarding: {
      url: "https://www.cde.ca.gov/sp/eo/is/faq.asp",
      requirements:
        "Qualify with the individual district or charter purchaser. No statewide homeschool parent wallet or automatic vendor approval is established.",
    },
    unknowns: [
      "Identify a budget owner and applicable solicitation; verify digital license, accessibility, student-data and purchasing terms. This does not establish parent reimbursement eligibility.",
    ],
  },
  {
    id: "co-district-curriculum",
    jurisdiction: "CO",
    name: "District curriculum procurement",
    purchaseModel: "institutional",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://ed.cde.state.co.us/standardsandinstruction/support/curriculum-adoption-and-implementation",
        statement:
          "CDE guidance directs schools to work with district procurement teams to purchase selected curriculum.",
      },
    ],
    onboarding: {
      url: "https://ed.cde.state.co.us/standardsandinstruction/support/curriculum-adoption-and-implementation",
      requirements:
        "Prepare standards alignment and accessible samples for local curriculum review; follow the purchaser’s contracting procedure.",
    },
    unknowns: [
      "Identify a budget owner and applicable solicitation; verify digital license, accessibility, student-data and purchasing terms. This does not establish parent reimbursement eligibility.",
    ],
  },
  {
    id: "ct-title-i",
    jurisdiction: "CT",
    name: "Title I local education agency purchasing",
    purchaseModel: "institutional",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://portal.ct.gov/sde/academic-office/federal-programs/title-i",
        statement: "Connecticut awards Title I subgrants to LEAs.",
      },
    ],
    onboarding: {
      url: "https://portal.ct.gov/sde/academic-office/federal-programs/title-i",
      requirements:
        "Sell through an LEA procurement aligned to its approved program and allowable costs; Title I is not a family voucher.",
    },
    unknowns: [
      "Identify a budget owner and applicable solicitation; verify digital license, accessibility, student-data and purchasing terms. This does not establish parent reimbursement eligibility.",
    ],
  },
  {
    id: "de-procurement",
    jurisdiction: "DE",
    name: "State and school procurement",
    purchaseModel: "institutional",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://mymarketplace.delaware.gov/vendors/procurement-education.shtml",
        statement:
          "Delaware publishes vendor procurement methods and contract requirements.",
      },
    ],
    onboarding: {
      url: "https://mymarketplace.delaware.gov/vendors/procurement-education.shtml",
      requirements:
        "Use the vendor learning center and relevant bid notices. Contract holders may have reporting obligations; registration alone is not a contract.",
    },
    unknowns: [
      "Identify a budget owner and applicable solicitation; verify digital license, accessibility, student-data and purchasing terms. This does not establish parent reimbursement eligibility.",
    ],
  },
  {
    id: "hi-hidoe",
    jurisdiction: "HI",
    name: "HIDOE school and office purchasing",
    purchaseModel: "institutional",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://hawaiipublicschools.org/useful-links/vendors-working-with-hidoe/",
        statement:
          "Schools and offices make purchasing decisions subject to procurement laws and department rules.",
      },
    ],
    onboarding: {
      url: "https://hawaiipublicschools.org/useful-links/vendors-working-with-hidoe/",
      requirements:
        "Follow HIDOE vendor instructions and applicable HANDS/HIePRO notices; confirm current solicitation thresholds.",
    },
    unknowns: [
      "Identify a budget owner and applicable solicitation; verify digital license, accessibility, student-data and purchasing terms. This does not establish parent reimbursement eligibility.",
    ],
  },
  {
    id: "ky-curriculum",
    jurisdiction: "KY",
    name: "District instructional-resource procurement",
    purchaseModel: "institutional",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.education.ky.gov/districts/business/Pages/default.aspx",
        statement:
          "KDE publishes bid/proposal opportunities and directs new vendors to Vendor Self Service.",
      },
    ],
    onboarding: {
      url: "https://www.education.ky.gov/districts/business/Pages/default.aspx",
      requirements:
        "Register through Commonwealth eProcurement and follow district instructional-resource review requirements.",
    },
    unknowns: [
      "Identify a budget owner and applicable solicitation; verify digital license, accessibility, student-data and purchasing terms. This does not establish parent reimbursement eligibility.",
    ],
  },
  {
    id: "ma-commbuys",
    jurisdiction: "MA",
    name: "Public education procurement",
    purchaseModel: "institutional",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.mass.gov/how-to/find-grant-and-contract-opportunities-on-commbuys-procurement-system",
        statement: "COMMBUYS provides state grant and contract opportunities.",
      },
    ],
    onboarding: {
      url: "https://www.mass.gov/how-to/find-grant-and-contract-opportunities-on-commbuys-procurement-system",
      requirements:
        "Register/search applicable solicitations and school purchasing channels; a portal account does not establish an education contract.",
    },
    unknowns: [
      "Identify a budget owner and applicable solicitation; verify digital license, accessibility, student-data and purchasing terms. This does not establish parent reimbursement eligibility.",
    ],
  },
  {
    id: "mi-tutoring",
    jurisdiction: "MI",
    name: "Section 35p tutoring partnerships",
    purchaseModel: "institutional",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.michigan.gov/mde/services/financial-management/grants/section-35p",
        statement:
          "MDE identifies Section 35p tutoring grants and requires district support letters for applicant partnerships.",
      },
    ],
    onboarding: {
      url: "https://www.michigan.gov/mde/services/financial-management/grants/section-35p",
      requirements:
        "Assess provider eligibility and evidence requirements against the current grant; a standalone app must not be presented as staffed tutoring.",
    },
    unknowns: [
      "Identify a budget owner and applicable solicitation; verify digital license, accessibility, student-data and purchasing terms. This does not establish parent reimbursement eligibility.",
    ],
  },
  {
    id: "nj-materials",
    jurisdiction: "NJ",
    name: "Nonpublic textbook and technology programs",
    purchaseModel: "institutional",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.nj.gov/education/nonpublic/state/tech/guidelines.shtml",
        statement:
          "Public district boards provide technology to qualifying nonpublic schools within appropriated funding.",
      },
    ],
    onboarding: {
      url: "https://www.nj.gov/education/nonpublic/state/tech/guidelines.shtml",
      requirements:
        "Work through district and nonpublic-school consultation and procurement; verify subscription eligibility under current program rules.",
    },
    unknowns: [
      "Identify a budget owner and applicable solicitation; verify digital license, accessibility, student-data and purchasing terms. This does not establish parent reimbursement eligibility.",
    ],
  },
  {
    id: "nm-instructional-materials",
    jurisdiction: "NM",
    name: "Instructional Materials Bureau adoption",
    purchaseModel: "institutional",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://web.ped.nm.gov/bureaus/instructional-materials/publishers/",
        statement:
          "NMPED publishes publisher requests for applications, adoption forms and submission guidance.",
      },
    ],
    onboarding: {
      url: "https://web.ped.nm.gov/bureaus/instructional-materials/publishers/",
      requirements:
        "Follow the applicable subject/grade adoption RFA or establish the separate supplemental-material procurement route.",
    },
    unknowns: [
      "Identify a budget owner and applicable solicitation; verify digital license, accessibility, student-data and purchasing terms. This does not establish parent reimbursement eligibility.",
    ],
  },
  {
    id: "ny-materials-loans",
    jurisdiction: "NY",
    name: "Instructional materials and software loans",
    purchaseModel: "institutional",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.nysed.gov/nonpublic-schools/handbook-services-pupils-attending-nonpublic-schools",
        statement:
          "Districts purchase and loan software for public and nonpublic pupils; software leases are paid annually rather than prepaid as a multiyear lump sum.",
      },
    ],
    onboarding: {
      url: "https://www.nysed.gov/nonpublic-schools/handbook-services-pupils-attending-nonpublic-schools",
      requirements:
        "Qualify the SKU with the school/district materials administrator and contract purchaser; students do not receive a cash wallet.",
    },
    unknowns: [
      "Identify a budget owner and applicable solicitation; verify digital license, accessibility, student-data and purchasing terms. This does not establish parent reimbursement eligibility.",
    ],
  },
  {
    id: "nd-virtual-courses",
    jurisdiction: "ND",
    name: "District-approved virtual course purchasing",
    purchaseModel: "institutional",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.cde.nd.gov/information/resources/how-enroll-resources",
        statement:
          "From August 2026 families requesting district payment for NDCDE courses use a prescribed or district-equivalent enrollment form.",
      },
    ],
    onboarding: {
      url: "https://www.cde.nd.gov/information/resources/how-enroll-resources",
      requirements:
        "Treat this as a district course channel, not permission to bill a generic app; investigate course/provider approval separately.",
    },
    unknowns: [
      "Identify a budget owner and applicable solicitation; verify digital license, accessibility, student-data and purchasing terms. This does not establish parent reimbursement eligibility.",
    ],
  },
  {
    id: "or-materials",
    jurisdiction: "OR",
    name: "Instructional material adoption and district purchasing",
    purchaseModel: "institutional",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.oregon.gov/ode/educator-resources/teachingcontent/instructional-materials/pages/adopted-instructional-materials.aspx",
        statement:
          "ODE publishes adopted instructional materials and related district guidance.",
      },
    ],
    onboarding: {
      url: "https://www.oregon.gov/ode/educator-resources/teachingcontent/instructional-materials/pages/adopted-instructional-materials.aspx",
      requirements:
        "Follow current publisher adoption requirements or district independent/supplemental material purchasing procedures.",
    },
    unknowns: [
      "Identify a budget owner and applicable solicitation; verify digital license, accessibility, student-data and purchasing terms. This does not establish parent reimbursement eligibility.",
    ],
  },
  {
    id: "wa-ale",
    jurisdiction: "WA",
    name: "Alternative Learning Experience / district purchasing",
    purchaseModel: "institutional",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://ospi.k12.wa.us/student-success/learning-alternatives",
        statement:
          "OSPI describes ALE and online learning as public K–12 educational options.",
      },
    ],
    onboarding: {
      url: "https://ospi.k12.wa.us/student-success/learning-alternatives",
      requirements:
        "Work through the district’s learning plan, materials and vendor review; online-course provider approval is a separate process from supplemental software.",
    },
    unknowns: [
      "Identify a budget owner and applicable solicitation; verify digital license, accessibility, student-data and purchasing terms. This does not establish parent reimbursement eligibility.",
    ],
  },
  {
    id: "ne-opportunity-closed",
    jurisdiction: "NE",
    name: "Opportunity Scholarships Act",
    purchaseModel: "school-tuition",
    operatingStatus: "closed",
    platform: "unverified",
    evidence: [
      {
        url: "https://revenue.nebraska.gov/tax-credits/opportunity-scholarship-act",
        statement:
          "The Act was repealed effective October 31, 2024; DOR no longer accepts its SGO certification or tax-credit reservation applications.",
      },
    ],
    onboarding: {
      url: "https://revenue.nebraska.gov/tax-credits/opportunity-scholarship-act",
      requirements:
        "Do not apply under this repealed program. Review the separate federal 2027 scholarship channel.",
    },
    unknowns: [
      "Do not confuse legacy scholarships or the repealed LB1402 state program with new federal participation.",
    ],
  },
  {
    id: "oh-ace-closed",
    jurisdiction: "OH",
    name: "Afterschool Child Enrichment (ACE)",
    purchaseModel: "parent-curriculum",
    operatingStatus: "closed",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.aceohio.org/",
        statement:
          "The program administrator states the ACE program closed October 15, 2025.",
      },
    ],
    onboarding: {
      url: "https://www.aceohio.org/",
      requirements:
        "Do not build a new ACE payment integration or advertise available awards.",
    },
    unknowns: [
      "Legacy reimbursements or disputes are not evidence of an operating purchasing program.",
    ],
  },
  {
    id: "in-choice",
    jurisdiction: "IN",
    name: "Choice Scholarship",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.in.gov/doe/students/indiana-choice-scholarship-program/",
        statement:
          "Eligible K–12 students use Choice Scholarships to offset tuition at participating schools.",
      },
    ],
    onboarding: {
      url: "https://www.in.gov/doe/students/indiana-choice-scholarship-program/",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "oh-edchoice",
    jurisdiction: "OH",
    name: "EdChoice, EdChoice Expansion and Cleveland Scholarships",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://education.ohio.gov/Topics/Other-Resources/Scholarships/",
        statement:
          "Ohio lists three school scholarships separately from its Autism and Jon Peterson special-needs provider programs.",
      },
    ],
    onboarding: {
      url: "https://education.ohio.gov/Topics/Other-Resources/Scholarships/",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "oh-autism",
    jurisdiction: "OH",
    name: "Autism Scholarship",
    purchaseModel: "approved-specialist",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://education.ohio.gov/Topics/Other-Resources/Scholarships/Autism-Scholarship/How-to-Apply-for-an-Autism-Scholarship",
        statement:
          "Families select a participating approved provider to serve their child’s educational needs.",
      },
    ],
    onboarding: {
      url: "https://education.ohio.gov/Topics/Other-Resources/Scholarships/Autism-Scholarship/How-to-Apply-for-an-Autism-Scholarship",
      requirements:
        "Review provider registration and service-plan requirements; a curriculum publisher must not claim approval as a special-education provider.",
    },
    unknowns: [
      "Determine whether the product can be purchased by an approved provider within the student plan; direct parent software reimbursement is not established.",
    ],
  },
  {
    id: "oh-jon-peterson",
    jurisdiction: "OH",
    name: "Jon Peterson Special Needs Scholarship",
    purchaseModel: "approved-specialist",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://codes.ohio.gov/ohio-revised-code/section-3310.58/9-30-2025",
        statement:
          "Private schools or entities must register with DEW before receiving payments for qualifying special-education services.",
      },
    ],
    onboarding: {
      url: "https://codes.ohio.gov/ohio-revised-code/section-3310.58/9-30-2025",
      requirements:
        "Assess approved-provider qualifications and student-plan requirements; pursue school/provider purchasing if the app does not qualify as a service.",
    },
    unknowns: [
      "No standalone curriculum entitlement established; confirm eligible service scope and actual provider contracting.",
    ],
  },
  {
    id: "nh-etc",
    jurisdiction: "NH",
    name: "Education Tax Credit scholarships",
    purchaseModel: "parent-curriculum",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://nh.scholarshipfund.org/apply/nh-education-tax-credit-scholarships/",
        statement:
          "CSF describes a separate tax-credit scholarship program supporting private, online and homeschool education.",
      },
    ],
    onboarding: {
      url: "https://nh.scholarshipfund.org/apply/nh-education-tax-credit-scholarships/",
      requirements:
        "Confirm CSF’s ETC-specific curriculum purchase and receipt process; EFA vendor approval does not establish ETC purchase eligibility.",
    },
    unknowns: [
      "Confirm homeschool expense limits, annual subscription terms and how ETC awards interact with EFA awards.",
    ],
  },
  {
    id: "fl-ftc-fes-eo",
    jurisdiction: "FL",
    name: "Florida Tax Credit / Family Empowerment Educational Options",
    purchaseModel: "tuition-first",
    operatingStatus: "operating",
    platform: "Step Up / MyScholarShop",
    evidence: [
      {
        url: "https://www.fldoe.org/file/20902/10-2.pdf",
        statement:
          "The authority publishes a joint FTC/FES-EO purchasing guide; private-school scholarship purchases follow rules distinct from PEP and FES-UA.",
      },
    ],
    onboarding: {
      url: "https://www.fldoe.org/file/20902/10-2.pdf",
      requirements:
        "Use Step Up supplier onboarding and verify current-year FTC/FES-EO residual-fund curriculum rules.",
    },
    unknowns: [
      "The reviewed guide is 2025–26; confirm the 2026–27 guide, tuition priority, remaining funds and annual license eligibility.",
    ],
  },
  {
    id: "in-csa",
    jurisdiction: "IN",
    name: "Career Scholarship Account",
    purchaseModel: "approved-specialist",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.in.gov/doe/eoq/csa",
        statement:
          "IDOE administers career scholarship accounts with approved career learning providers.",
      },
    ],
    onboarding: {
      url: "https://www.in.gov/doe/eoq/csa",
      requirements:
        "Review career-provider eligibility and the all-inclusive approved program process; do not substitute generic math practice for a qualifying career program.",
    },
    unknowns: [
      "Confirm whether any released offering meets career-program requirements; no general K–12 curriculum wallet eligibility is established.",
    ],
  },
  {
    id: "la-exceptionalities",
    jurisdiction: "LA",
    name: "School Choice Program for Certain Students with Exceptionalities",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://doe.louisiana.gov/topic-pages/louisiana-school-choice/school-choice-program-for-certain-students-with-exceptionalities",
        statement:
          "Qualifying families receive tuition assistance at eligible BESE-approved private schools with special-needs programs in specified parishes.",
      },
    ],
    onboarding: {
      url: "https://doe.louisiana.gov/topic-pages/louisiana-school-choice/school-choice-program-for-certain-students-with-exceptionalities",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "ms-dyslexia",
    jurisdiction: "MS",
    name: "Dyslexia Therapy Scholarship",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.mdek12.org/elementaryedu/dyslexia/",
        statement:
          "MDE lists its Dyslexia Therapy Scholarship and participating specialized schools.",
      },
    ],
    onboarding: {
      url: "https://www.mdek12.org/elementaryedu/dyslexia/",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "ms-nate-rogers",
    jurisdiction: "MS",
    name: "Nate Rogers Speech/Language Scholarship",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://mdek12.org/specialeducation/scholarship-information/",
        statement:
          "MDE lists the Nate Rogers scholarship among its K–12 private-school scholarship programs.",
      },
    ],
    onboarding: {
      url: "https://mdek12.org/specialeducation/scholarship-information/",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "sc-exceptional",
    jurisdiction: "SC",
    name: "Exceptional SC scholarships and parental tuition credit",
    purchaseModel: "school-tuition",
    operatingStatus: "operating",
    platform: "unverified",
    evidence: [
      {
        url: "https://www.dor.sc.gov/tax-credits/ecenc-program-credits",
        statement:
          "SCDOR describes Exceptional SC grants and a parental refundable credit for qualifying exceptional-needs education; these are separate from ESTF.",
      },
    ],
    onboarding: {
      url: "https://www.dor.sc.gov/tax-credits/ecenc-program-credits",
      requirements:
        "Sell curriculum to participating schools under their purchasing rules. School/SGO qualification is not a product-vendor application.",
    },
    unknowns: [
      "No direct parent purchase of this standalone curriculum established by the reviewed source. Confirm school procurement and budget authority.",
    ],
  },
  {
    id: "id-empowering-parents",
    jurisdiction: "ID",
    name: "Empowering Parents",
    purchaseModel: "parent-curriculum",
    operatingStatus: "existing-balances-only",
    platform: "ClassWallet",
    evidence: [
      {
        url: "https://empoweringparents.idaho.gov/faqs",
        statement:
          "New grants ended under 2025 legislation. Existing awards expire three years after issuance and use ClassWallet; the FAQ rejects service payments beyond three months and limits reimbursement to home internet.",
      },
    ],
    onboarding: {
      url: "https://empoweringparents.idaho.gov/faqs",
      requirements:
        "Confirm curriculum vendor registration and product classification for existing balances; do not offer annual service invoices without a written eligibility decision.",
    },
    unknowns: [
      "Confirm whether the annual digital curriculum SKU is treated as a product or prohibited service prepayment; no new grant applications.",
    ],
  },
  {
    id: "il-invest-in-kids",
    jurisdiction: "IL",
    name: "Invest in Kids",
    purchaseModel: "school-tuition",
    operatingStatus: "closed",
    platform: "unverified",
    evidence: [
      {
        url: "https://tax.illinois.gov/programs/investinkids",
        statement:
          "The scholarship tax-credit program expired December 31, 2023; later contributions do not receive the credit.",
      },
    ],
    onboarding: {
      url: "https://tax.illinois.gov/programs/investinkids",
      requirements:
        "Do not pursue new vendor access under this expired program.",
    },
    unknowns: [
      "Legacy tax-credit carryforwards do not establish an active curriculum purchasing channel.",
    ],
  },
];

/** Federal overlay, not a vendor approval, SGO designation or available family balance. */
export const federalScholarshipTaxCredit = {
  id: "us-section-25f",
  name: "Federal Scholarship Tax Credit",
  startsOn: "2027-01-01",
  electionListAsOf: "2026-09-14",
  checkedOn: nationalReviewCheckedOn,
  sourceUrl:
    "https://www.irs.gov/government-entities/federal-state-local-governments/federal-scholarship-tax-credit-fstc",
  advanceElectionStates:
    "AL AK AR CO FL GA ID IN IA KS KY LA MS MO MT NE NV NH ND NC OH OK SC SD TN TX UT VA WV WY".split(
      " ",
    ),
  readiness: "future-sgo-channel-unverified" as const,
  nextAction:
    "Verify current state election, IRS SGO list, scholarship expense rules and SGO purchasing requirements before making any eligibility claim.",
};
