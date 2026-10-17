/** Blank transaction fields, never an issued financial document or proof of payment. */
export function transactionDocumentTemplates() {
  return ["quote", "invoice", "paid-receipt", "credit"].map((kind) => ({
    kind,
    status: "template-not-issued",
    program: "fl-pep",
    currency: "USD",
    merchant: { legalName: null, address: null, contact: null },
    documentId: null,
    issuedOn: null,
    expiresOn: null,
    administratorOrderReference: null,
    requiredStudentIdentifier: null,
    lines: [
      {
        approvedSku: null,
        titleAndEdition: null,
        quantity: null,
        unitPriceMinor: null,
        discountMinor: null,
        startDate: null,
        endDate: null,
        deliveryReference: null,
      },
    ],
    subtotalMinor: null,
    taxMinor: null,
    permittedFeesMinor: null,
    totalMinor: null,
    settledAmountMinor: null,
    settlementDate: null,
    settlementReference: null,
    originalDocumentReference: null,
    creditReason: null,
    programDirectedCreditReference: null,
    instructions:
      "Use only the channel-required family identifiers in a restricted issued document. A paid receipt requires actual settlement evidence; approval or parent-reported submission is insufficient. Exact platform fields and terms require supplier agreement review.",
  }));
}
