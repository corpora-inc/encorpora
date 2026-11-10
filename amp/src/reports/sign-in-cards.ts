import {
  esc,
  MARK,
  pageFooter,
  printDocument,
  qrSvg,
  type Paper,
} from "./print";

/** Sign-in cards to cut apart: eight to a page, each with a student's name,
 * their class and the QR code that signs them in. A card is a credential:
 * the document exists only for the request that made it. */
export type SignInCardsInput = {
  paper: Paper;
  className: string;
  /** Where a card's link points: the app's public origin. */
  origin: string;
  cards: { name: string; token: string }[];
};

const PER_PAGE = 8;
/** Long names step down so a word never breaks inside the card. */
const nameSize = (name: string) => {
  const longest = Math.max(...name.split(/[\s-]+/).map((w) => w.length));
  return longest > 15 || name.length > 34
    ? " longer"
    : longest > 11 || name.length > 22
      ? " long"
      : "";
};

const CSS = `
.sheet { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(4, 1fr); height: 9.86in; border-top: 0.8pt dashed var(--rule-strong); border-left: 0.8pt dashed var(--rule-strong); break-after: page; }
.paper-A4 .sheet { height: 10.6in; }
.sheet:last-child { break-after: auto; }
.card { position: relative; display: flex; align-items: center; gap: 0.18in; padding: 0.22in 0.24in; border-right: 0.8pt dashed var(--rule-strong); border-bottom: 0.8pt dashed var(--rule-strong); min-width: 0; }
.text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; height: 100%; }
.brand { gap: 6px; }
.mark { width: 0.3in; height: 0.22in; }
.brandName { font-size: 13pt; }
.name { margin-top: auto; font-family: "WB Display", Georgia, serif; font-variation-settings: "SOFT" 100, "WONK" 0; font-weight: 600; font-size: 20pt; line-height: 1.08; overflow-wrap: break-word; }
.name.long { font-size: 16pt; }
.name.longer { font-size: 13pt; }
.class { margin-top: 3px; font-size: 9.5pt; color: var(--muted); overflow-wrap: anywhere; }
.how { margin-top: auto; padding-top: 0.08in; font-size: 8.5pt; line-height: 1.35; }
.qr { flex: none; width: 1.35in; height: 1.35in; }
`;

export function signInCardsHtml(input: SignInCardsInput) {
  const pages: SignInCardsInput["cards"][] = [];
  for (let at = 0; at < input.cards.length; at += PER_PAGE)
    pages.push(input.cards.slice(at, at + PER_PAGE));
  const card = (c: SignInCardsInput["cards"][number]) =>
    `<article class="card"><div class="text"><span class="brand">${MARK}<span class="brandName">AMP</span></span><h2 class="name${nameSize(c.name)}">${esc(c.name)}</h2><p class="class">${esc(input.className)}</p><p class="how">Point a camera at the square to start math.</p></div>${qrSvg(`${input.origin}/c#${c.token}`, `Sign-in code for ${c.name}`)}</article>`;
  const html = printDocument({
    title: `${input.className}: sign-in cards`,
    paper: input.paper,
    css: CSS,
    body: `<div class="paper-${input.paper}">${pages.map((page) => `<section class="sheet">${page.map(card).join("")}</section>`).join("")}</div>`,
  });
  return {
    html,
    footer: pageFooter(
      `AMP · Sign-in cards · ${input.className} · Cut along the dashed lines. Each card signs in one student.`,
    ),
  };
}
