import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupplierCatalog } from "./catalog.js";
export interface PacketPreview {
  bookId: string;
  pageId: string;
  title: string;
  image: string;
  sha256: string;
}
export function renderSupplierPacket(
  catalog: SupplierCatalog,
  previews: PacketPreview[],
  asOf: string,
) {
  const pages: React.ReactNode[] = [
    <>
      <p className="eyebrow">Corpora · Product review draft</p>
      <h1>Mathematics that connects practice and understanding.</h1>
      <p className="lead">
        AMP combines self-paced mathematics practice with original illustrated
        lessons, printable tasks and reasoned answers.
      </p>
      <div className="panel">
        <h2>One learner. A focused learning path.</h2>
        <p>
          Learners practice selected skills, review explanations and open
          related reading. A parent can review recent independent and assisted
          attempts. Varied problems connect calculations to explanations and
          related reading.
        </p>
      </div>
      <h2>Proposed MyScholarShop offering</h2>
      <p>
        A single-student software license, with a proposed twelve-month term for
        FTC-PEP review. The term, category, price, activation rules and listing
        require a decision. PDF editions are separate candidate products; no
        bundle approval is implied.
      </p>
      <p className="note">
        This is a product-review draft, not a funded offer. It provides no live
        teacher, school enrollment, accredited credit or guaranteed test score.
        The catalog covers selected skills, not a complete K–12 course.
      </p>
    </>,
    ...Array.from(
      { length: Math.ceil(catalog.products.length / 4) },
      (_, group) => (
        <React.Fragment key={`catalog-${group}`}>
          <p className="eyebrow">Candidate catalog</p>
          <h1>Specific materials. Explicit scope.</h1>
          <p>
            These candidate identifiers are for review. Prices are unset.
            Digital books are downloads, not printed or shipped goods.
          </p>
          {catalog.products.slice(group * 4, group * 4 + 4).map((p) => (
            <section className="catalog-item" key={p.id}>
              <h2>{p.title}</h2>
              <p>{p.format}</p>
              <code>{p.id}</code>
              <p className="small">{p.proposedTerm}</p>
            </section>
          ))}
        </React.Fragment>
      ),
    ),
    <>
      <p className="eyebrow">Learning experience</p>
      <h1>Practice, explain, connect.</h1>
      <ol className="route">
        <li>
          <strong>Attempt a problem.</strong>
          <p>
            The learner submits a response in the supported format for that
            problem. Numeric and selected-choice responses do not assess every
            kind of written reasoning.
          </p>
        </li>
        <li>
          <strong>Study the explanation.</strong>
          <p>
            Feedback connects the calculation to a mathematical idea. Assisted
            work is distinguished from independent attempts.
          </p>
        </li>
        <li>
          <strong>Open a related lesson.</strong>
          <p>
            Original books combine exact diagrams, worked examples, guided
            practice, space for written reasoning and answer keys.
          </p>
        </li>
        <li>
          <strong>Return to practice.</strong>
          <p>
            The practice planner uses recorded evidence to select further work.
            This is not a standardized diagnostic or proof of complete mastery.
          </p>
        </li>
      </ol>
      <p className="note">
        The following pages show source-built sample pages from the editions in
        this packet. They demonstrate authored material, not deployed access or
        administrator acceptance.
      </p>
    </>,
    ...previews.map((p) => (
      <img
        key={p.bookId}
        className="sample"
        src={p.image}
        alt={`${catalog.books.find((b) => b.id === p.bookId)!.title}: ${p.title}. Source page ${p.pageId}. Full-size original sample.`}
      />
    )),
    <>
      <p className="eyebrow">Review boundaries</p>
      <h1>Decisions for this offering.</h1>
      <p>
        Review the single-student software candidate independently from each PDF
        title and from any proposed bundle. Acceptance for FTC-PEP does not
        establish acceptance for FES-UA or another program.
      </p>
      <h2>Term and delivery</h2>
      <p>
        Confirm whether twelve months may cross award years, when access starts,
        the permitted activation process, delivery evidence and what happens to
        downloads after access ends. No automatic funded renewal is proposed.
      </p>
      <h2>Catalog and order handling</h2>
      <p>
        Confirm the invitation-specific platform, required catalog fields, order
        acceptance and rejection tests, digital fulfillment trigger and
        settlement process. The accompanying CSV is a neutral product list, not
        a platform import file.
      </p>
      <h2>Support and returns</h2>
      <p>
        Support contacts, operating hours, refund eligibility and
        program-directed credit procedures require approved operational terms
        before an offer is made.
      </p>
      <p className="note">
        Unsent draft · Evidence reviewed {asOf}. No vendor selection, product
        approval, marketplace listing or payment authorization is asserted.
      </p>
    </>,
  ];
  return (
    "<!doctype html>" +
    renderToStaticMarkup(
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>AMP supplier product review</title>
          <style>{`@page{size:Letter;margin:0}*{box-sizing:border-box}body{margin:0;background:#e8ebe8;color:#163b3b;font:16px/1.5 Arial,sans-serif}.page{width:816px;height:1056px;background:#fffefa;padding:58px 64px;position:relative;break-after:page}.content{height:900px}.eyebrow{font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#506964;font-weight:700;border-top:5px solid #e3ae52;padding-top:18px;margin-top:0}h1{font-family:Georgia,serif;font-size:38px;line-height:1.15;margin:24px 0}h2{font-size:19px;line-height:1.25;margin:22px 0 8px}p{margin:10px 0}.lead{font-size:23px;line-height:1.45}.panel{background:#edf4ef;border-left:5px solid #27796a;padding:18px 24px;margin:28px 0}.panel h2{margin-top:0}.note{background:#f6f1e6;padding:18px;font-size:14px;margin-top:28px}.small,code,.caption{font-size:13px}.catalog-item{border-bottom:1px solid #cdd8d0;padding:8px 0}.catalog-item h2{margin:8px 0}.catalog-item p{margin:5px 0}.route{padding-left:24px}.route li{padding:12px 0}.route strong{font-size:21px}.preview{display:block;height:660px;max-width:100%;object-fit:contain;margin:16px auto;border:1px solid #d8dfd8}.caption{color:#425d58}footer{position:absolute;bottom:28px;left:64px;right:64px;display:flex;justify-content:space-between;font-size:11px;color:#506964}.sample{display:block;width:816px;height:1056px;object-fit:contain}.page:has(.sample){padding:0}.page:has(.sample) .content{height:1056px}.page:has(.sample) footer{display:none}@media screen{.page{margin:24px auto;box-shadow:0 2px 10px #0002}}@media print{body{background:white}.page:last-child{break-after:auto}}`}</style>
        </head>
        <body>
          {pages.map((p, i) => (
            <article className="page" key={i}>
              <div className="content">{p}</div>
              <footer>
                <span>AMP · Corpora · Unsent product-review draft</span>
                <span>
                  {i + 1} / {pages.length}
                </span>
              </footer>
            </article>
          ))}
        </body>
      </html>,
    )
  );
}
