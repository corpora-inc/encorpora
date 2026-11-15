import React from "../react.js";
import { Math, Sample } from "../product.js";
import type { SiteConfig } from "../config.js";
import type { Article, Section, ProductShot as ShotName } from "./types.js";
import { articleByPath } from "./catalog.js";
import { estimateExample } from "./estimate-example.js";

const shots: Record<ShotName, {alt: string; caption: string}> = {
  practice: {alt: "AMP fraction practice with an equal-parts model, answer keypad and Hint and Lesson controls", caption: "One clear problem, with a visual model and help within reach."},
  progress: {alt: "AMP progress showing practice across mathematical areas and individual skills", caption: "Follow the mathematics by area and skill. Example learner data."},
  "practice-profile": {alt: "AMP practice profile controls for grade, pace and mathematical area levels", caption: "Explore different starting levels with a practice profile."},
  "workbook-controls": {alt: "AMP workbook controls for session length, paper size, level and mathematical areas", caption: "Choose the length, paper size and focus of your next workbook."},
};
export function ProductShot({name}: {name: ShotName}) {
  return <figure className="product-shot article-product-shot"><picture>
    <source media="(max-width: 600px)" srcSet={`/product/${name}-mobile.webp`} width="390" height={name === "practice-profile" ? 955 : name === "workbook-controls" ? 943 : 844} />
    <img src={`/product/${name}-desktop.webp`} alt={shots[name].alt} width="1280" height={name === "practice-profile" ? 1047 : 900} loading="lazy" decoding="async" />
  </picture><figcaption>{shots[name].caption}</figcaption></figure>;
}

export function LearningDiagram({ kind }: { kind: NonNullable<Section["diagram"]> }) {
  if (kind === "estimate") return <figure className="learning-diagram estimate-diagram">
    <p className="eyebrow">One synthetic learning history</p>
    {estimateExample.map(point => <div className="estimate-row" key={point.count}>
      <strong>{point.count === 0 ? "Starting picture" : `After ${point.count} answers`}</strong>
      <div className="estimate-axis" role="img" aria-label={`Working level ${point.level.toFixed(1)}, model uncertainty plus or minus ${point.sd.toFixed(1)} level units`}>
        <span className="estimate-range" style={{left: `${(point.level-point.sd)/7*100}%`, width: `${2*point.sd/7*100}%`}} />
        <span className="estimate-dot" style={{left:`${point.level/7*100}%`}} />
      </div>
    </div>)}
    <div className="estimate-labels"><span>Earlier mathematics</span><span>Later mathematics</span></div>
    <figcaption>The dot is the working estimate; the band is one reported uncertainty width on either side. AMP’s actual estimator computes this example from independent answers to Grade 3 tasks, with three correct in each group of four. As the evidence accumulates, the starting picture becomes more focused.</figcaption>
  </figure>;
  if (kind === "discovery") return <figure className="learning-diagram fraction-discovery">
    <div className="fraction-pair">
      {[2, 4].map((parts) => <div key={parts}>
        <div className="fraction-bar" role="img" style={{ gridTemplateColumns: `repeat(${parts},1fr)` }} aria-label={`${parts / 2} of ${parts} equal parts shaded`}>
          {Array.from({ length: parts }, (_, i) => <span key={i} className={i < parts / 2 ? "shaded" : ""} />)}
        </div><strong><Math text={parts === 2 ? "$\\frac{1}{2}$" : "$\\frac{2}{4}$"} /></strong>
      </div>)}
    </div>
    <figcaption>The same length is shaded. Splitting each part changes the names, not the quantity.</figcaption>
  </figure>;
  if (kind === "strands") return <figure className="learning-diagram strand-diagram">
    <p className="eyebrow">An illustrative learner</p>
    {[
      ["Fractions", "Strengthen a foundation", "45%"],
      ["Geometry", "Explore a new connection", "78%"],
      ["Algebra", "Build on a strength", "65%"],
    ].map(([name, action, width]) => <div className="strand-example" key={name}>
      <div><strong>{name}</strong><span>{action}</span></div>
      <div className="strand-track" aria-hidden="true"><span style={{ width }} /></div>
    </div>)}
    <figcaption>Different areas can need different next steps.</figcaption>
  </figure>;
  const steps = kind === "review"
    ? [["Learn", "Understand the relationship"], ["Return", "Retrieve it after a delay"], ["Extend", "Use it in another setting"], ["Remember", "Return as practice develops"]]
    : [["Try", "Work on a meaningful problem"], ["Understand", "Use a hint or explanation"], ["Apply", "Solve a fresh problem"], ["Return", "Keep the idea available"]];
  return <figure className="learning-diagram"><ol className="learning-sequence">
    {steps.map(([title, text], i) => <li key={title}><span className="sequence-number">0{i + 1}</span><strong>{title}</strong><span>{text}</span></li>)}
  </ol><figcaption>{kind === "review" ? "A return to earlier learning belongs inside the path forward." : "Practice, explanation and review form one connected routine."}</figcaption></figure>;
}

export function ArticlePage({ article, config }: { article: Article; config: SiteConfig }) {
  const heroDiagram = article.sections.find(s => s.diagram)?.diagram ?? "loop";
  return <article className="library-page">
    <nav className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/how-it-works/">How AMP works</a><span aria-hidden="true">/</span><span>{article.label}</span></nav>
    <header className="article-hero">
      <div><p className="eyebrow">{article.label}</p><h1>{article.title}</h1><p className="article-deck">{article.introduction}</p>
        <div className="actions"><a className="button" href={config.appUrl ?? "/try/"}>Try AMP free <span aria-hidden="true">↗</span></a><a className="text-link" href="#read">Explore the approach <span aria-hidden="true">↓</span></a></div>
      </div>
      <div className="article-visual">{article.image ? <figure className="product-shot"><img src={article.image.src} alt={article.image.alt} width={article.image.width} height={article.image.height} fetchPriority="high" /><figcaption>{article.image.caption}</figcaption></figure> : <LearningDiagram kind={heroDiagram} />}</div>
    </header>
    <div className="article-layout" id="read">
      <aside className="article-contents"><p className="eyebrow">In this guide</p><nav aria-label="On this page">{article.sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}{article.questions && <a href="#questions">Questions</a>}</nav><a className="contents-science" href="/science/">Read the science <span aria-hidden="true">↗</span></a></aside>
      <div className="article-body">{article.sections.map((section, i) => <section className="article-section" id={section.id} key={section.id}>
        <p className="section-index" aria-hidden="true">{String(i + 1).padStart(2, "0")}</p><h2>{section.title}</h2>
        {section.paragraphs.map((text, j) => <p key={j}>{text}</p>)}
        {section.points && <ul className="article-points">{section.points.map(point => <li key={point}>{point}</li>)}</ul>}
        {section.example && <aside className="math-example"><h3>{section.example.title}</h3><p><Math text={section.example.text} /></p></aside>}
        {section.diagram && (article.image || section.diagram !== heroDiagram) && <LearningDiagram kind={section.diagram} />}
        {section.shot && <ProductShot name={section.shot} />}
        {section.sources && <div className="source-notes"><span>Research</span><ul>{section.sources.map(source => <li key={source.url}><a href={source.url}>{source.title} ↗</a></li>)}</ul></div>}
      </section>)}
      {article.sample !== undefined && <section className="article-section"><p className="eyebrow">Inside AMP</p><h2>Try the reasoning.</h2><p>A real AMP problem, with its mathematical explanation. Open the reasoning after thinking through the question.</p><Sample index={article.sample} heading="h3" /></section>}
      {article.questions && <section className="article-section article-faq" id="questions"><h2>Questions, answered.</h2>{article.questions.map(q => <details key={q.question}><summary>{q.question}</summary><p>{q.answer}</p></details>)}</section>}
      </div>
    </div>
    <section className="next-reading"><div><p className="eyebrow">Keep exploring</p><h2>See how the ideas connect.</h2></div><div className="reading-links">{article.related.map(path => {
      const related = articleByPath.get(path);
      return related ? <a href={path} key={path}><span>{related.label}</span><strong>{related.title}</strong><span aria-hidden="true">↗</span></a> : null;
    })}</div></section>
    <section className="library-cta"><div><p className="eyebrow">Put the approach to work</p><h2>Meet your next math problem.</h2><p>Start free with adaptive practice and printable workbooks. No credit card.</p></div><a className="button" href={config.appUrl ?? "/try/"}>Start learning <span aria-hidden="true">↗</span></a></section>
  </article>;
}

export function articleStructuredData(article: Article, config: SiteConfig) {
  if (!config.siteUrl) return undefined;
  const url = new URL(article.path, config.siteUrl).href;
  return { "@context": "https://schema.org", "@graph": [
    { "@type": "Article", "@id": `${url}#article`, url, headline: article.title, description: article.description, inLanguage: "en", author: { "@type": "Organization", name: "Corpora", url: config.siteUrl }, publisher: { "@id": new URL("/#organization", config.siteUrl).href }, mainEntityOfPage: url, citation: [...new Set(article.sections.flatMap(s => s.sources?.map(x => x.url) ?? []))] },
    { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: config.siteUrl }, { "@type": "ListItem", position: 2, name: article.label, item: url }] },
  ] };
}
