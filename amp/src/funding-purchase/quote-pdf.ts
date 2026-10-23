import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import {
  FundingPurchaseError,
  studentBillingNameSchema,
  type FundingOffer,
  type FundingRequest,
} from "./contracts.js";

function displayDate(iso: string): string {
  return (
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(iso)) + " UTC"
  );
}

function printedFields(o: FundingOffer): string[] {
  return [
    o.programName,
    o.programYear,
    o.sku,
    o.productTitle,
    o.productDescription,
    o.instructions,
    o.merchant.legalName,
    o.merchant.postalAddress,
    o.merchant.supportEmail,
  ];
}
/** Standard-font coverage is checked before an offer can be shown to a parent. */
export async function validateQuoteFonts(
  offers: readonly FundingOffer[],
): Promise<void> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const offer of offers)
    for (const text of printedFields(offer)) {
      try {
        font.encodeText(text);
      } catch {
        throw new Error(
          `Funding offer ${offer.id} contains text unsupported by the quote font`,
        );
      }
    }
}

/** Reject unsupported text before retaining it; never alter a student's name. */
export async function validateInvoiceStudentName(value: string): Promise<void> {
  studentBillingNameSchema.parse(value);
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  try {
    font.encodeText(value);
  } catch {
    throw new FundingPurchaseError(400, "invoice_name_font_unsupported");
  }
}

export async function renderFundingQuotePdf(
  request:
    | FundingRequest
    | Pick<
        FundingRequest,
        | "id"
        | "offer"
        | "createdAt"
        | "expiresAt"
        | "studentBillingName"
        | "learnerId"
      >,
): Promise<Uint8Array> {
  const o = request.offer;
  const invoice = o.documentPolicy === "named-student-invoice";
  if (invoice) {
    if (!request.studentBillingName)
      throw new FundingPurchaseError(400, "invoice_student_name_required");
    await validateInvoiceStudentName(request.studentBillingName);
  }
  await validateQuoteFonts([o]);
  const document = await PDFDocument.create();
  document.setTitle(
    invoice
      ? "Education purchase invoice"
      : "Education purchase quote — unpaid",
  );
  document.setAuthor(o.merchant.legalName);
  document.setSubject(
    invoice
      ? "Program payment request; not a receipt or confirmation of payment"
      : "Purchase consideration only; not an invoice or receipt",
  );
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.08, 0.22, 0.2),
    muted = rgb(0.28, 0.33, 0.32);
  const margin = 48,
    width = 516;
  let page: PDFPage;
  let y = 0;
  const newPage = () => {
    page = document.addPage([612, 792]);
    page.drawRectangle({
      x: 48,
      y: 746,
      width,
      height: 3,
      color: rgb(0.06, 0.4, 0.34),
    });
    y = 712;
  };
  newPage();
  function wrap(
    text: string,
    font: PDFFont,
    size: number,
    lineWidth = width,
  ): string[] {
    const lines: string[] = [];
    for (const paragraph of text.split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= lineWidth) {
          line = candidate;
          continue;
        }
        if (line) lines.push(line);
        line = "";
        for (const character of word) {
          if (font.widthOfTextAtSize(line + character, size) > lineWidth) {
            lines.push(line);
            line = "";
          }
          line += character;
        }
      }
      lines.push(line);
    }
    return lines;
  }
  function text(
    value: string,
    options: { size?: number; strong?: boolean; gap?: number } = {},
  ) {
    const size = options.size ?? 11,
      font = options.strong ? bold : regular;
    for (const line of wrap(value, font, size)) {
      if (y - size < 64) newPage();
      page.drawText(line, {
        x: margin,
        y,
        size,
        font,
        color: options.strong ? ink : muted,
      });
      y -= size * 1.4;
    }
    y -= options.gap ?? 8;
  }
  function field(label: string, value: string) {
    if (invoice) {
      const indent = 112,
        size = 11,
        leading = 14;
      const lines = wrap(value, regular, size, width - indent);
      if (y < 92) newPage();
      page.drawText(label, { x: margin, y, size: 10, font: bold, color: ink });
      for (const line of lines) {
        if (y - size < 64) newPage();
        page.drawText(line, {
          x: margin + indent,
          y,
          size,
          font: regular,
          color: muted,
        });
        y -= leading;
      }
      y -= 10;
      return;
    }
    // Keep a label with at least the first line of its value.
    if (y < 112) newPage();
    text(label, { strong: true, gap: 2 });
    text(value);
  }
  text(invoice ? "Education purchase invoice" : "Education purchase quote", {
    size: 25,
    strong: true,
    gap: 10,
  });
  text(invoice ? "For program payment request" : "UNPAID — no access granted", {
    size: 13,
    strong: true,
  });
  text(
    invoice
      ? "Unpaid invoice for program review. Access begins after payment is confirmed."
      : "For purchase consideration only. This is not an invoice, receipt, funding approval or promise of reimbursement.",
  );
  field(invoice ? "Invoice number" : "Quote reference", request.id);
  field(
    invoice ? "Issued / submit by" : "Prepared / valid until",
    `${displayDate(request.createdAt)} / ${displayDate(request.expiresAt)}`,
  );
  field(
    "Merchant",
    `${o.merchant.legalName}\n${o.merchant.postalAddress}\n${o.merchant.supportEmail}`,
  );
  field("Program", `${o.programName} · ${o.programYear}`);
  field(
    invoice ? "Student name" : "Student reference",
    invoice ? request.studentBillingName! : request.learnerId,
  );
  field("Product", `${o.productTitle}\nSKU: ${o.sku}\n${o.productDescription}`);
  field(
    "Access term",
    "One learner, 12 months from the day access is activated. Exact start and end dates must be confirmed with the accepted order.",
  );
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: o.currency,
    }).format(n / 100);
  if (y < 158) newPage();
  text(`Subtotal — annual curriculum access × 1: ${money(o.subtotalMinor)}`, {
    strong: true,
  });
  text(`Tax: ${money(o.taxMinor)}`);
  text(`Total (${o.currency}): ${money(o.subtotalMinor + o.taxMinor)}`, {
    size: 16,
    strong: true,
    gap: 16,
  });
  field("Next step", o.instructions);
  text(
    invoice
      ? "Submit once through the program's approved payment route. Do not also pay by card."
      : "Complete the program's required process. Reporting submission here does not verify approval or payment. Do not send payment using this quote.",
  );
  const pages = document.getPages();
  pages.forEach((p, index) =>
    p.drawText(
      `${invoice ? "Invoice" : "Unpaid quote"} | ${request.id} | ${index + 1} / ${pages.length}`,
      { x: margin, y: 32, font: regular, size: 9, color: muted },
    ),
  );
  return document.save();
}
