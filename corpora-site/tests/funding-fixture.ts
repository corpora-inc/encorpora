export const fundingFixture = {
  state: "AZ",
  program: "Synthetic education funding program",
  kind: "reimbursement",
  instructions: "Confirm the purchase before paying.",
  sourceUrl: "https://program.example.invalid",
  reviewedUntil: "2099-01-01",
  page: {
    slug: "synthetic-program",
    summary: "A test guide to purchase evidence and eligibility.",
    eligibility:
      "Enrolled families must check their individual award conditions.",
    ampStatus:
      "AMP approval has not been confirmed. A receipt does not establish eligibility.",
    steps: [
      "Ask the administrator whether this subscription qualifies.",
      "Keep the paid receipt and submit through the program.",
    ],
    receiptChecklist: [
      "Seller, learner, purchase date, item description and amount paid.",
    ],
    restrictions: ["Check subscription dates against the award year."],
    questions: [
      {
        question: "Does a receipt guarantee repayment?",
        answer: "No. The administrator decides eligibility.",
      },
    ],
    sources: [
      {
        title: "Official program guidance",
        url: "https://program.example.invalid/guidance",
      },
    ],
    reviewedOn: "2026-01-01",
  },
};

export const guidedFundingFixture = {
  ...fundingFixture,
  page: {
    ...fundingFixture.page,
    presentation: {
      headline: "Use your education funds for mathematics",
      statusLabel: "Synthetic reviewed route · Direct payment",
      actionLabel: "Request a curriculum invoice",
      actionSubject: "Curriculum invoice & purchase question",
    },
  },
};
