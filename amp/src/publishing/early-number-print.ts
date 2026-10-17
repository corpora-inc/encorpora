/** Scoped learner typography; adult guidance and detailed keys use the base text size. */
export const earlyNumberPrintCss = `
.early-number-page{--number-ink:#184e57;--number-accent:#d28b22}
.early-number-page .page-header{border-color:var(--number-ink);border-radius:12px 0 0;padding-top:14px}
.early-number-page h1{color:var(--number-ink);font-size:32pt;letter-spacing:-.025em}
.early-number-page:not(.guide):not(.solutions){font-family:Arial,sans-serif;font-size:17pt;line-height:1.35}
.early-number-page:not(.guide):not(.solutions) .subtitle{font-size:15pt}
.early-number-page:not(.guide):not(.solutions) h2{font-size:18pt}
.early-number-page:not(.guide):not(.solutions) .callout{border-radius:0 15px 15px 0;padding:12px 16px}
.early-number-page:not(.guide):not(.solutions) .callout-label{font-size:11pt}
.early-number-page:not(.guide):not(.solutions) .book-figure{border:0;margin:20px 0}
.early-number-page:not(.guide):not(.solutions) .book-figure svg{max-height:3in}
.early-number-page:not(.guide):not(.solutions) figcaption{font-size:13pt;line-height:1.3;color:#355c61}
.early-number-page:not(.guide):not(.solutions) .task-header{display:block}
.early-number-page:not(.guide):not(.solutions) .task-label{display:block;font-size:10pt;margin-bottom:6px}
.early-number-page:not(.guide):not(.solutions) .workspace{border-color:#88a9ab}
.early-number-page:not(.guide):not(.solutions) .worked{padding:12px 16px;background:#eef5f3;border-radius:14px;border:0}
.early-number-page:not(.guide):not(.solutions) .worked ol{padding-left:28px}
.early-number-page.workshop .page-header{border-color:var(--number-accent)}
.early-number-page.reflection .page-header{border-color:#895975}
.early-number-page.opening h1{font-size:48pt}
.early-number-page.opening .early-number-art{max-width:6.4in}
.early-number-page.opening{background:linear-gradient(155deg,#f3faf6 0%,#fff 60%)}
.early-number-page#unit-tools .early-number-art{max-width:6.8in}
.early-number-page#unit-tools .book-figure svg{max-height:4in}
.early-number-page:not(.guide):not(.solutions) .early-unit,.early-number-page:not(.guide):not(.solutions) .early-emphasis{font-size:12pt}

.early-number-page.opening .book-figure svg{max-height:3.5in}
.early-number-page.guide h1,.early-number-page.solutions h1{font-size:25pt}
.early-number-page.guide .page-header,.early-number-page.solutions .page-header{border-color:#657f7d}
`;
