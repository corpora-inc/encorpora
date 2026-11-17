import type { FundingRequest } from "./contracts.js";
import { documentPalette, fundingDocument } from "./quote-pdf.js";
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const lines = (values: readonly string[]) => values.map(escape).join("<br>");

/** The funding document as a page: the same content as the PDF
 * (`fundingDocument`), in the app's type and colours. */
export function renderFundingQuote(request: FundingRequest): string {
  const d = fundingDocument(request);
  const cell = ([label, value]: readonly [string, string]) =>
    `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(d.title)} ${escape(request.id)}</title><style>
:root{${Object.entries(documentPalette)
    .map(([token, value]) => `--${token}:${value}`)
    .join(";")}}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--color-on-surface);font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,system-ui,sans-serif;font-variant-numeric:tabular-nums lining-nums}
main{max-width:760px;margin:0 auto;padding:48px 24px}
header{display:flex;justify-content:space-between;align-items:baseline;gap:16px}
.mark{display:flex;align-items:center;gap:8px;color:var(--color-primary);font-weight:700;font-size:18px}
.mark svg{width:30px;height:19px;stroke:currentColor;stroke-width:4;stroke-linecap:round}
h1{margin:0;font-size:34px;line-height:1.1}
.status{margin:4px 0 0;text-align:right;font-weight:700}
address{font-style:normal;color:var(--color-muted-text);margin:32px 0 0;font-size:14px}
address strong{display:block;color:var(--color-on-surface);font-size:15px}
dl{margin:0;display:grid;gap:16px 24px;grid-template-columns:2fr 1fr 1fr}
dl.parties{margin-top:24px}
dl.parties div+div{grid-column:span 2}
dt{color:var(--color-subtle-text);font-size:12.5px}
dd{margin:2px 0 0;overflow-wrap:anywhere}
.refs{border-top:1px solid var(--color-border);margin-top:24px;padding-top:16px}
table{width:100%;border-collapse:collapse;margin-top:32px}
th{color:var(--color-subtle-text);font-size:12.5px;font-weight:400;text-align:left;padding:0 0 8px;border-bottom:1px solid var(--color-border-strong)}
td{vertical-align:top;padding:14px 0;border-bottom:1px solid var(--color-border);overflow-wrap:anywhere}
th+th,td+td{padding-left:16px}
.num,.dates{text-align:right;white-space:nowrap}
.dates{text-align:left}
.item{font-weight:700}
.details{color:var(--color-muted-text);font-size:13px;margin-top:4px}
.service{display:none;margin-top:6px;font-size:13px}
.totals{margin:16px 0 0 auto;width:min(100%,300px)}
.totals div{display:flex;justify-content:space-between;padding:4px 0;color:var(--color-muted-text)}
.totals div span+span{color:var(--color-on-surface)}
.totals .due{border-top:1px solid var(--color-border-strong);margin-top:6px;padding-top:10px;color:var(--color-on-surface);font-weight:700;font-size:17px}
.notes{margin-top:40px;color:var(--color-muted-text);font-size:14px}
footer{margin-top:48px;padding-top:12px;border-top:1px solid var(--color-border);display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;color:var(--color-subtle-text);font-size:12px}
@media (max-width:560px){dl{grid-template-columns:1fr 1fr}dl div:first-child{grid-column:1/-1}th:nth-child(2),td:nth-child(2){display:none}.service{display:block}}
@media print{main{padding:0}}
</style><main><header><div class="mark"><svg viewBox="0 0 44 28" fill="none" aria-hidden="true"><path d="M1 14C5 0 9 0 13 14S21 28 25 14S33 0 37 14S41 28 43 14"/></svg>AMP</div><div><h1>${escape(d.title)}</h1>${d.status ? `<p class="status">${escape(d.status)}</p>` : ""}</div></header>
<address><strong>${escape(d.seller.name)}</strong>${lines([...d.seller.address, d.seller.email])}</address>
<dl class="refs">${d.references.map(cell).join("")}</dl>
<dl class="parties"><div><dt>Bill to</dt><dd>${lines(d.billTo)}</dd></div>${cell([d.student.label, d.student.value])}</dl>
<table><thead><tr><th>Description</th><th class="dates">Service dates</th><th class="num">Qty</th><th class="num">Amount</th></tr></thead><tbody><tr><td><div class="item">${escape(d.item.title)}</div><div class="details">${lines(d.item.details)}</div><div class="service">Service dates: ${escape(d.item.service)}</div></td><td class="dates">${escape(d.item.service)}</td><td class="num">${escape(d.item.quantity)}</td><td class="num">${escape(d.item.amount)}</td></tr></tbody></table>
<div class="totals">${d.totals.map(([label, value]) => `<div><span>${escape(label)}</span><span>${escape(value)}</span></div>`).join("")}<div class="due"><span>${escape(d.total[0])}</span><span>${escape(d.total[1])}</span></div></div>
${d.notes.length ? `<section class="notes">${d.notes.map((note) => `<p>${escape(note)}</p>`).join("")}</section>` : ""}
<footer><span>${escape(d.footer)}</span><span>${escape(d.title)} ${escape(request.id)}</span></footer></main></html>`;
}
