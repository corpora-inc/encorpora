import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { PaymentHistoryItem } from "./contracts.js";
import { BillingError } from "../stripe/config.js";
export const paymentMoney = (minor: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    minor / 100,
  );
function date(value: string | number) {
  return (
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(typeof value === "number" ? value * 1000 : value)) +
    " UTC"
  );
}
export async function paymentPdf(
  record: PaymentHistoryItem,
  adjustmentId?: string,
): Promise<Uint8Array> {
  const b = record.baseline;
  if (!b || record.status !== "verified")
    throw new BillingError("payment_record_requires_review");
  const selected = adjustmentId
    ? record.observations.findIndex((item) => item.id === adjustmentId)
    : -1;
  if (
    adjustmentId &&
    (selected < 0 ||
      (selected === 0 && !record.observations[0]?.refunds.length))
  )
    throw new BillingError("adjustment_not_found", 404);
  const document = await PDFDocument.create();
  document.setTitle(
    adjustmentId ? "Payment refund adjustment" : "Paid purchase record",
  );
  document.setAuthor(b.profile.seller.legalName);
  document.setCreationDate(new Date(b.paidAt * 1000));
  document.setModificationDate(new Date(record.observedAt));
  const regular = await document.embedFont(StandardFonts.Helvetica),
    bold = await document.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.07, 0.22, 0.2),
    muted = rgb(0.3, 0.35, 0.34);
  let page: PDFPage;
  let y = 0;
  const margin = 48,
    width = 508;
  function newPage() {
    if (document.getPageCount() >= 30)
      throw new BillingError("payment_document_too_large", 413);
    page = document.addPage([612, 792]);
    page.drawRectangle({
      x: margin,
      y: 748,
      width,
      height: 3,
      color: rgb(0.08, 0.43, 0.36),
    });
    y = 720;
    if (!b!.profile.livemode) {
      page.drawText("TEST PAYMENT — NO MONEY MOVED", {
        x: margin,
        y,
        size: 11,
        font: bold,
        color: ink,
      });
      y -= 28;
    }
  }
  function wrap(value: string, font: PDFFont, size: number) {
    const lines: string[] = [];
    for (const paragraph of value.split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        if (font.widthOfTextAtSize(word, size) > width) {
          if (line) {
            lines.push(line);
            line = "";
          }
          let piece = "";
          for (const character of word) {
            if (font.widthOfTextAtSize(piece + character, size) > width) {
              lines.push(piece);
              piece = "";
            }
            piece += character;
          }
          line = piece;
        } else if (
          font.widthOfTextAtSize(line ? line + " " + word : word, size) > width
        ) {
          lines.push(line);
          line = word;
        } else line = line ? line + " " + word : word;
      }
      lines.push(line);
    }
    return lines;
  }
  function text(value: string, size = 11, strong = false, gap = 4) {
    const font = strong ? bold : regular;
    for (const line of wrap(value, font, size)) {
      if (y - size < 64) newPage();
      page.drawText(line, {
        x: margin,
        y,
        size,
        font,
        color: strong ? ink : muted,
      });
      y -= size * 1.2;
    }
    y -= gap;
  }
  function field(label: string, value: string) {
    if (y < 112) newPage();
    text(label, 10, true, 1);
    text(value);
  }
  newPage();
  text(
    adjustmentId ? "Refund adjustment" : "Paid purchase record",
    25,
    true,
    12,
  );
  text(
    "A record of verified payment facts. Not a tax form, funding approval, or guarantee of reimbursement.",
    10,
    false,
    12,
  );
  field(
    "Seller",
    [
      b.profile.seller.legalName,
      ...b.profile.seller.address,
      b.profile.seller.supportEmail,
    ].join("\n"),
  );
  field(
    "Purchase",
    `${b.profile.product.title}\n${b.profile.product.description}\nSKU: ${b.profile.sku} · Quantity: 1`,
  );
  field(
    "References",
    `Payment record: ${record.id}\nInvoice: ${b.invoiceId}\nLearner reference: ${record.learnerReference}`,
  );
  field(
    "Paid / purchased term",
    `${date(b.paidAt)}\n${date(b.periodStart)} to ${date(b.periodEnd)} (end exclusive)`,
  );
  text(
    "The purchased term records the invoice period. Permission to learn also requires active parent consent and an eligible learner profile.",
    10,
  );
  if (y < 190) newPage();
  text(`Amount before tax: ${paymentMoney(b.preTaxMinor)}`, 11, true);
  text(
    `Tax: ${paymentMoney(b.tax.reduce((sum, item) => sum + item.amountMinor, 0))}`,
    11,
  );
  text(`Total paid (USD): ${paymentMoney(b.paidMinor)}`, 17, true, 12);
  if (adjustmentId) {
    const observation = record.observations[selected]!,
      prior = record.observations[selected - 1] ?? { refunds: [] };
    field(
      "Linked adjustment",
      `${observation.id}\nOriginal payment record: ${record.id}\nObserved ${date(observation.observedAt)}`,
    );
    const changed = observation.refunds.filter(
      (item) =>
        JSON.stringify(prior.refunds.find((old) => old.id === item.id)) !==
        JSON.stringify(item),
    );
    for (const refund of changed) {
      const old = prior.refunds.find((item) => item.id === refund.id);
      field(
        `Refund ${refund.id}`,
        `${paymentMoney(refund.amountMinor)} · ${old ? old.status + " to " : ""}${refund.status}\nProvider created: ${date(refund.created)}`,
      );
    }
    text(
      "Only refunds marked succeeded reduce net payment. A later failure is a correction to the earlier observation, not a second charge. Provider creation time is not the time funds reached a bank. No proportional tax refund is inferred.",
      10,
    );
  } else {
    text(
      `Successful refunds: ${paymentMoney(record.successfulRefundMinor!)}`,
      11,
      true,
    );
    text(
      `Net recorded payment: ${paymentMoney(record.netPaidMinor!)}`,
      15,
      true,
    );
    field("Last verified", date(record.observedAt));
    const refunds = record.observations.at(-1)?.refunds ?? [];
    for (const refund of refunds)
      field(
        `Refund ${refund.id}`,
        `${paymentMoney(refund.amountMinor)} · ${refund.status}\nProvider created: ${date(refund.created)}`,
      );
    if (refunds.length)
      text(
        "Refund statuses reflect the last verified observation, not a promise of bank settlement. Linked adjustment documents are available in purchase history.",
        10,
      );
  }
  field(
    "Support / privacy",
    `${b.profile.seller.supportUrl}\n${b.profile.seller.privacyUrl}`,
  );
  text(
    "Program administrators and tax authorities set their own documentation and eligibility requirements. This record does not certify that this product qualifies.",
    10,
  );
  document
    .getPages()
    .forEach((p, index) =>
      p.drawText(
        `${adjustmentId ? "Adjustment" : "Payment"} | ${record.id} | ${index + 1}/${document.getPageCount()}`,
        { x: margin, y: 32, size: 8, font: regular, color: muted },
      ),
    );
  return document.save();
}
