import {
  LineCapStyle,
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import {
  FundingPurchaseError,
  studentBillingNameSchema,
  type FundingOffer,
  type FundingRequest,
} from "./contracts.js";
import { fundedInvoiceTerm } from "./term.js";

/** Every date the document prints is the UTC calendar date: the same day a
 * fixed service period counts from, so an invoice dated Nov 16 starts its
 * service on Nov 16. */
export function documentDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function fundedServicePeriod(request: {
  createdAt: string;
  offer: Pick<FundingOffer, "termMonths" | "termPolicy">;
}): string | null {
  const term = fundedInvoiceTerm(request);
  if (!term) return null;
  return `${documentDate(term.startsAt)} – ${documentDate(term.endsAt)}`;
}

/** The purchased term excludes temporary access while payment is pending.
 * Both monthly and annual renewals follow the existing paid term. */
export function fundedTermText(o: Pick<FundingOffer, "termMonths">) {
  return o.termMonths === 1
    ? {
        access:
          "One learner, 1 calendar month from license activation, or from the end of existing paid access if later. Temporary access while payment is pending is separate.",
        subtotal: "monthly curriculum access",
      }
    : {
        access:
          "One learner, 12 calendar months from license activation, or from the end of existing paid access if later. Temporary access while payment is pending is separate.",
        subtotal: "annual curriculum access",
      };
}

type DocumentRequest =
  | FundingRequest
  | Pick<
      FundingRequest,
      | "id"
      | "offer"
      | "createdAt"
      | "expiresAt"
      | "studentBillingName"
      | "learnerId"
    >;

/**
 * What a funding document says, shared by the PDF and the HTML view.
 *
 * A named invoice is the document a program reviewer reads, so it carries the
 * fields the programs' invoice rules list and nothing else:
 * - Arkansas EFA Invoicing & Payment Guide (v1.0, April 2026,
 *   https://efavendoronboardingchecklist.my.canva.site/efa-vendor-invoicing-and-payment-guide):
 *   vendor name, purchase/service dates, itemized description and cost, total
 *   due, and the student's name for services.
 * - Arizona ESA Parent Handbook 2026–27, p. 43
 *   (https://www.azed.gov/sites/default/files/2026-11/ESA%202026-2027%20Parent%20Handbook.pdf#page=43):
 *   seller name, address and contact, invoice date and number, student name,
 *   itemized charges with service dates, and total.
 * - New Hampshire EFA Provider Handbook, p. 12
 *   (https://nh.scholarshipfund.org/wp-content/uploads/2025/08/Provider-Handbook-August-2025.pdf#page=12):
 *   invoice date and dates of service.
 * How to submit it (the offer's `instructions`) is the parent's next step, not
 * part of the invoice: the invoice page and the invoice email show it once.
 */
export function fundingDocument(request: DocumentRequest) {
  const o = request.offer;
  const invoice = o.documentPolicy === "named-student-invoice";
  if (invoice && !request.studentBillingName)
    throw new FundingPurchaseError(400, "invoice_student_name_required");
  const servicePeriod = fundedServicePeriod(request);
  const money = (minor: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: o.currency,
    }).format(minor / 100);
  const comma = o.merchant.postalAddress.indexOf(", ");
  return {
    invoice,
    title: invoice ? "Invoice" : "Quote",
    /** The quote's status line. An invoice states its amount due instead. */
    status: invoice ? null : "UNPAID — no access granted",
    references: [
      [invoice ? "Invoice number" : "Quote reference", request.id],
      [invoice ? "Issue date" : "Prepared", documentDate(request.createdAt)],
      ["Valid until", documentDate(request.expiresAt)],
    ] as [string, string][],
    seller: {
      name: o.merchant.legalName,
      address:
        comma > 0
          ? [
              o.merchant.postalAddress.slice(0, comma),
              o.merchant.postalAddress.slice(comma + 2),
            ]
          : [o.merchant.postalAddress],
      email: o.merchant.supportEmail,
    },
    billTo: [o.programName, `Program year ${o.programYear}`],
    student: invoice
      ? { label: "Student", value: request.studentBillingName! }
      : { label: "Student reference", value: request.learnerId },
    item: {
      title: o.productTitle,
      details: [
        o.productDescription,
        // A legacy activation-based term has no dates to print; say what it is.
        ...(servicePeriod ? [] : [fundedTermText(o).access]),
        `SKU ${o.sku}`,
      ],
      service:
        servicePeriod ??
        `${o.termMonths} ${o.termMonths === 1 ? "month" : "months"} from activation`,
      quantity: "1",
      amount: money(o.subtotalMinor),
    },
    totals: [
      ["Subtotal", money(o.subtotalMinor)],
      ["Tax", money(o.taxMinor)],
    ] as [string, string][],
    total: [
      invoice ? `Amount due (${o.currency})` : `Total (${o.currency})`,
      money(o.subtotalMinor + o.taxMinor),
    ] as [string, string],
    notes: invoice
      ? []
      : [
          "For purchase consideration only. This is not an invoice, receipt, funding approval or promise of reimbursement.",
          o.instructions,
          "Complete the program's required process. Reporting submission here does not verify approval or payment. Do not send payment using this quote.",
        ],
    footer: `${o.merchant.legalName} · ${o.merchant.supportEmail}`,
  };
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

const hex = (value: string): RGB =>
  rgb(
    parseInt(value.slice(1, 3), 16) / 255,
    parseInt(value.slice(3, 5), 16) / 255,
    parseInt(value.slice(5, 7), 16) / 255,
  );
/** The app's light-theme colours, by their token in src/web/ui/tokens.css
 * (a test holds them equal). The PDF and the HTML page use only these. */
export const documentPalette = {
  "color-on-surface": "#183e3a",
  "color-primary": "#1f5f55",
  "color-muted-text": "#4c625b",
  "color-subtle-text": "#5d6b63",
  "color-border": "#e2e5da",
  "color-border-strong": "#78887f",
} as const;
const color = {
  ink: hex(documentPalette["color-on-surface"]),
  primary: hex(documentPalette["color-primary"]),
  muted: hex(documentPalette["color-muted-text"]),
  subtle: hex(documentPalette["color-subtle-text"]),
  rule: hex(documentPalette["color-border"]),
  ruleStrong: hex(documentPalette["color-border-strong"]),
};
/** The AMP wave (src/web/ui/WaveMark.tsx), on a 44 × 28 grid. */
const WAVE = "M1 14C5 0 9 0 13 14S21 28 25 14S33 0 37 14S41 28 43 14";

/**
 * US Letter. The content box keeps 60 pt side margins so the same page also
 * prints whole on A4 at actual size (A4 is 17 pt narrower, so each side keeps
 * about 51 pt) and when scaled to fit.
 */
const PAGE = { width: 612, height: 792 };
const LEFT = 60,
  RIGHT = PAGE.width - 60,
  TOP = PAGE.height - 60,
  BOTTOM = 76;
/** One column grid for references, parties and the item table. */
const COLUMN = { second: 300, third: 432, quantity: 474 };

export async function renderFundingQuotePdf(
  request: DocumentRequest,
): Promise<Uint8Array> {
  const content = fundingDocument(request);
  if (content.invoice)
    await validateInvoiceStudentName(request.studentBillingName!);
  await validateQuoteFonts([request.offer]);
  const document = await PDFDocument.create();
  document.setTitle(`${content.title} ${request.id}`);
  document.setAuthor(content.seller.name);
  document.setSubject(
    content.invoice
      ? `${request.offer.programName} invoice`
      : "Purchase consideration only; not an invoice or receipt",
  );
  const issued = new Date(request.createdAt);
  if (!Number.isNaN(issued.getTime())) {
    document.setCreationDate(issued);
    document.setModificationDate(issued);
  }
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  let page = document.addPage([PAGE.width, PAGE.height]);
  let y = TOP;
  /** Start a new page when the next block would run into the footer. */
  const need = (height: number) => {
    if (y - height >= BOTTOM) return;
    page = document.addPage([PAGE.width, PAGE.height]);
    y = TOP;
  };
  function wrap(text: string, font: PDFFont, size: number, width: number) {
    const lines: string[] = [];
    for (const paragraph of text.split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= width) {
          line = candidate;
          continue;
        }
        if (line) lines.push(line);
        line = "";
        for (const character of word) {
          if (font.widthOfTextAtSize(line + character, size) > width) {
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
  type Run = {
    text: string;
    x: number;
    width: number;
    size?: number;
    font?: PDFFont;
    color?: RGB;
    align?: "left" | "right";
  };
  /** Wrapped lines from a top baseline; returns the height used. */
  function draw(run: Run, top: number, leading = 1.4): number {
    const size = run.size ?? 10,
      font = run.font ?? regular;
    const lines = wrap(run.text, font, size, run.width);
    lines.forEach((line, index) =>
      page.drawText(line, {
        x:
          run.align === "right"
            ? run.x + run.width - font.widthOfTextAtSize(line, size)
            : run.x,
        y: top - index * size * leading,
        size,
        font,
        color: run.color ?? color.ink,
      }),
    );
    return lines.length * size * leading;
  }
  const measure = (run: Run, leading = 1.4) =>
    wrap(run.text, run.font ?? regular, run.size ?? 10, run.width).length *
    (run.size ?? 10) *
    leading;
  const label = (text: string, x: number, top: number, width: number) =>
    draw({ text, x, width, size: 8.5, color: color.subtle }, top);
  const rule = (at: number, from = LEFT, to = RIGHT, strong = false) =>
    page.drawLine({
      start: { x: from, y: at },
      end: { x: to, y: at },
      thickness: strong ? 0.75 : 0.5,
      color: strong ? color.ruleStrong : color.rule,
    });

  // Letterhead: the AMP mark at left, the document's title at right.
  page.drawSvgPath(WAVE, {
    x: LEFT,
    y: TOP + 15,
    scale: 0.6,
    borderColor: color.primary,
    borderWidth: 4,
    borderLineCap: LineCapStyle.Round,
  });
  page.drawText("AMP", {
    x: LEFT + 32,
    y: TOP,
    size: 14,
    font: bold,
    color: color.primary,
  });
  page.drawText(content.title, {
    x: RIGHT - bold.widthOfTextAtSize(content.title, 26),
    y: TOP - 4,
    size: 26,
    font: bold,
    color: color.ink,
  });
  if (content.status)
    draw(
      {
        text: content.status,
        x: COLUMN.second,
        width: RIGHT - COLUMN.second,
        size: 10,
        font: bold,
        align: "right",
      },
      TOP - 24,
    );
  y = TOP - 48;

  // Seller.
  y -= draw(
    {
      text: content.seller.name,
      x: LEFT,
      width: COLUMN.second - LEFT - 24,
      size: 11,
      font: bold,
    },
    y,
  );
  for (const line of [...content.seller.address, content.seller.email])
    y -= draw(
      {
        text: line,
        x: LEFT,
        width: COLUMN.second - LEFT - 24,
        size: 9.5,
        color: color.muted,
      },
      y,
    );
  y -= 14;
  rule(y + 6);
  y -= 16;

  // References: number and dates on one row.
  const referenceX = [LEFT, COLUMN.second, COLUMN.third];
  const referenceWidth = [
    COLUMN.second - LEFT - 16,
    COLUMN.third - COLUMN.second - 16,
    RIGHT - COLUMN.third,
  ];
  const referenceValues = content.references.map(([, value], index) => ({
    text: value,
    x: referenceX[index]!,
    width: referenceWidth[index]!,
    size: 10,
  }));
  need(14 + Math.max(...referenceValues.map((run) => measure(run))));
  content.references.forEach(([name], index) =>
    label(name, referenceX[index]!, y, referenceWidth[index]!),
  );
  y -= 14;
  y -= Math.max(...referenceValues.map((run) => draw(run, y)));
  y -= 18;

  // Parties: who is billed, and the student the service is for.
  const billTo = {
    text: content.billTo.join("\n"),
    x: LEFT,
    width: COLUMN.second - LEFT - 16,
    size: 10,
  };
  const student = {
    text: content.student.value,
    x: COLUMN.second,
    width: RIGHT - COLUMN.second,
    size: 10,
  };
  need(14 + Math.max(measure(billTo), measure(student)));
  label("Bill to", LEFT, y, billTo.width);
  label(content.student.label, COLUMN.second, y, student.width);
  y -= 14;
  y -= Math.max(draw(billTo, y), draw(student, y));
  y -= 26;

  // The item table.
  const description = {
    x: LEFT,
    width: COLUMN.second - LEFT - 16,
  };
  const head = (top: number) => {
    label("Description", LEFT, top, description.width);
    label(
      "Service dates",
      COLUMN.second,
      top,
      COLUMN.quantity - 34 - COLUMN.second,
    );
    draw(
      {
        text: "Qty",
        x: COLUMN.quantity - 40,
        width: 40,
        size: 8.5,
        color: color.subtle,
        align: "right",
      },
      top,
    );
    draw(
      {
        text: "Amount",
        x: COLUMN.quantity,
        width: RIGHT - COLUMN.quantity,
        size: 8.5,
        color: color.subtle,
        align: "right",
      },
      top,
    );
    rule(top - 7, LEFT, RIGHT, true);
  };
  const title = {
    ...description,
    text: content.item.title,
    size: 10,
    font: bold,
  };
  const details = content.item.details.map((text) => ({
    ...description,
    text,
    size: 9,
    color: color.muted,
  }));
  const service = {
    text: content.item.service,
    x: COLUMN.second,
    width: COLUMN.quantity - 34 - COLUMN.second,
    size: 10,
  };
  const rowHeight =
    measure(title) +
    details.reduce((sum, run) => sum + measure(run, 1.35) + 2, 0);
  need(26 + rowHeight);
  head(y);
  y -= 26;
  const rowTop = y;
  y -= draw(title, y) + 2;
  for (const run of details) y -= draw(run, y, 1.35) + 2;
  draw(service, rowTop);
  draw(
    {
      text: content.item.quantity,
      x: COLUMN.quantity - 40,
      width: 40,
      size: 10,
      align: "right",
    },
    rowTop,
  );
  draw(
    {
      text: content.item.amount,
      x: COLUMN.quantity,
      width: RIGHT - COLUMN.quantity,
      size: 10,
      align: "right",
    },
    rowTop,
  );
  y = Math.min(y, rowTop - measure(service)) - 4;
  rule(y);
  y -= 22;

  // Totals, aligned under the amount column.
  const totalsX = COLUMN.second + 60;
  need(3 * 18 + 30);
  for (const [name, value] of content.totals) {
    draw(
      { text: name, x: totalsX, width: 120, size: 10, color: color.muted },
      y,
    );
    draw(
      {
        text: value,
        x: totalsX,
        width: RIGHT - totalsX,
        size: 10,
        align: "right",
      },
      y,
    );
    y -= 18;
  }
  rule(y + 6, totalsX, RIGHT, true);
  y -= 14;
  draw(
    { text: content.total[0], x: totalsX, width: 140, size: 11, font: bold },
    y,
  );
  draw(
    {
      text: content.total[1],
      x: totalsX,
      width: RIGHT - totalsX,
      size: 14,
      font: bold,
      align: "right",
    },
    y,
  );
  y -= 40;

  // A quote's notes. An invoice has none: its facts are above.
  if (content.notes.length) {
    const notes = content.notes.map((text) => ({
      text,
      x: LEFT,
      width: RIGHT - LEFT,
      size: 9.5,
      color: color.muted,
    }));
    need(14 + measure(notes[0]!));
    label("Notes", LEFT, y, RIGHT - LEFT);
    y -= 14;
    for (const run of notes) {
      need(measure(run));
      y -= draw(run, y) + 6;
    }
  }

  const pages = document.getPages();
  pages.forEach((p, index) => {
    p.drawLine({
      start: { x: LEFT, y: 52 },
      end: { x: RIGHT, y: 52 },
      thickness: 0.5,
      color: color.rule,
    });
    const folio = `${content.title} ${request.id} · Page ${index + 1} of ${pages.length}`;
    // The seller's contact is already in the letterhead; it repeats here only
    // where it fits beside the folio.
    if (
      regular.widthOfTextAtSize(content.footer, 8) +
        regular.widthOfTextAtSize(folio, 8) +
        24 <=
      RIGHT - LEFT
    )
      p.drawText(content.footer, {
        x: LEFT,
        y: 38,
        size: 8,
        font: regular,
        color: color.subtle,
      });
    p.drawText(folio, {
      x: RIGHT - regular.widthOfTextAtSize(folio, 8),
      y: 38,
      size: 8,
      font: regular,
      color: color.subtle,
    });
  });
  return document.save();
}
