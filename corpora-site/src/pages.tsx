import { StateIdentity, stateNames } from "./state-identity.js";
import React from "./react.js";
import type { ReactNode } from "react";
import {
  Sample,
  SampleFigure,
  Math,
  product,
  samples,
  sampleLesson,
} from "./product.js";
import { Contact, Legal, legalTitles, type LegalPage } from "./legal.js";
import { formatPrice, type SiteConfig } from "./config.js";
import {
  FundingPage,
  fundingForPath,
  fundingLabels,
  fundingPath,
  fundingStructuredData,
} from "./funding.js";
export const routes = [
  "/",
  "/amp/",
  "/esa/",
  "/parents/",
  "/schools/",
  "/support/",
  "/try/",
  "/samples/",
  ...Object.keys(legalTitles).map((p) => `/legal/${p}/`),
];
export const routesFor = (config: SiteConfig) => [
  ...routes,
  ...config.funding.flatMap((r) => (r.page ? [fundingPath(r.page.slug)] : [])),
];
const titles: Record<string, string> = {
  "/": "Corpora · AMP Mathematics",
  "/amp/": "AMP Mathematics · Practice that follows your understanding",
  "/esa/": "Pay with education funds · Corpora",
  "/parents/": "Parents’ questions · AMP Mathematics",
  "/schools/": "Mathematics curriculum for schools and districts · Corpora",
  "/support/": "Support · Corpora",
  "/try/": "Try AMP Mathematics",
  "/samples/": "AMP · Printable practice sample",
};
export const title = (route: string, config?: SiteConfig) => {
  const funding = config && fundingForPath(route, config);
  return funding
    ? `${funding.program} and AMP Mathematics · Corpora`
    : (titles[route] ??
        `${legalTitles[route.split("/")[2] as LegalPage]} · Corpora`);
};
export const tryUrl = (config: SiteConfig) => config.appUrl ?? "/try/";
function Try({
  config,
  label = "Try free",
}: {
  config: SiteConfig;
  label?: string;
}) {
  return (
    <a className="button" href={tryUrl(config)}>
      {label}
      <span aria-hidden="true">↗</span>
    </a>
  );
}
function Intro({
  label,
  heading,
  children,
}: {
  label: string;
  heading: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-intro">
      <p className="eyebrow">{label}</p>
      <h1>{heading}</h1>
      {children}
    </div>
  );
}
function Steps() {
  return (
    <ol className="steps">
      <li>
        <span className="step-number">01</span>
        <div>
          <h3>Find a starting point.</h3>
          <p>
            A short placement adapts to the answers. Separate estimates for
            different areas keep a strong skill from hiding a gap.
          </p>
        </div>
      </li>
      <li>
        <span className="step-number">02</span>
        <div>
          <h3>Work at the edge of understanding.</h3>
          <p>
            Mixed practice selects problems from the learner’s skill estimates
            and revisits earlier work.
          </p>
        </div>
      </li>
      <li>
        <span className="step-number">03</span>
        <div>
          <h3>See why it works.</h3>
          <p>
            Open the explanation or lesson when needed. Use a printable for work
            on paper.
          </p>
        </div>
      </li>
    </ol>
  );
}
function Plans({ config }: { config: SiteConfig }) {
  return (
    <section className="section" id="plans">
      <div className="section-heading">
        <p className="eyebrow">One learner, connected practice</p>
        <h2>App. Explanations. Printables.</h2>
        <p>
          Choose the available term in the parent account. The checkout confirms
          taxes, renewal, and the full amount before payment.
        </p>
      </div>
      <div className="plans">
        {config.plans.length ? (
          config.plans.map((plan) => (
            <article className="plan" key={plan.interval}>
              <h3>
                {plan.interval === "year" ? "Annual license" : "Monthly plan"}
              </h3>
              <p className="price">
                {formatPrice(plan)}
                <span> / {plan.interval}</span>
              </p>
              <p>
                Per learner.{" "}
                {plan.renews
                  ? `Renews each ${plan.interval} until cancelled.`
                  : `One ${plan.interval} of access. Does not automatically renew.`}
              </p>
              <Try config={config} label="Start with free practice" />
            </article>
          ))
        ) : (
          <div className="plan">
            <h3>Explore before you purchase.</h3>
            <p>
              Available plans and current prices are shown in AMP before
              checkout.
            </p>
            <Try config={config} />
          </div>
        )}
        <aside className="plan-note">
          <p>
            <strong>30-day full refund for personal payments.</strong>
            <br />
            Program and marketplace payment rules may differ. Refunds return
            through the original payment route.
          </p>
          <a href="/legal/refund/">
            {config.legalReviewed ? "Read the policy" : "Read the draft policy"}{" "}
            ↗
          </a>
          <p>Using education funds?</p>
          <a href="/esa/">Check your route ↗</a>
        </aside>
      </div>
    </section>
  );
}
function Coverage() {
  return (
    <section className="section" id="coverage">
      <div className="section-heading">
        <p className="eyebrow">Coverage, stated precisely</p>
        <h2>See what your learner can practice.</h2>
        <p>
          AMP includes selected skills from early number work through
          high-school mathematics. It is not a complete K–12 course or a
          complete SAT preparation program.
        </p>
      </div>
      <div className="coverage-list">
        {product.bands.map((group) => (
          <details key={group.band}>
            <summary>
              Grades {group.band}
              <span>{group.templates.length} problem types</span>
            </summary>
            <ul>
              {group.templates.map((t) => (
                <li key={t.id}>
                  <strong>{t.title}.</strong> {t.description}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
      <details className="inventory">
        <summary>Catalog inventory and limitations</summary>
        <div className="coverage-summary">
          <div>
            <strong>{product.summary.templatesPresent}</strong>
            <span>problem types in the catalog</span>
          </div>
          <div>
            <strong>{product.skillsWithProblems}</strong>
            <span>skills with a problem type</span>
          </div>
          <div>
            <strong>{product.summary.lessonsPresent}</strong>
            <span>lessons in the catalog</span>
          </div>
        </div>
        <p className="fine">
          These are content inventory counts, not evidence of learning outcomes
          or complete standards coverage. Some practice is taught through
          book-page bindings. The coverage audit does not certify full coverage
          of any standard.
        </p>
        <p className="fine">
          The catalog lesson count excludes the per-problem lessons attached by
          the practice interface.
        </p>
      </details>
      <p>
        <a href="/coverage.json">
          Read the machine-readable coverage summary ↗
        </a>
      </p>
    </section>
  );
}
function Home({ config }: { config: SiteConfig }) {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="dot" /> AMP Mathematics
          </p>
          <h1>
            Math practice
            <br />
            <em>that adapts.</em>
          </h1>
          <p className="lead">
            Math practice that follows what your learner understands. Find a
            starting point, work through a problem, and see the reasoning.
          </p>
          <div className="actions">
            <Try config={config} />
            <a className="text-link" href="/amp/">
              Explore AMP <span aria-hidden="true">→</span>
            </a>
          </div>
          <p className="fine">Free assessment with a parent account. No card required.</p>
        </div>
        <div className="hero-demo">
          <div className="demo-top">
            <span className="amp-wordmark">
              AMP
              <span className="dot" />
            </span>
            <span>Mathematics, made visible</span>
          </div>
          <Sample heading="h2" />
          <p className="demo-caption">
            An actual AMP problem. Open the reasoning to look inside.
          </p>
        </div>
      </section>
      <section className="section split">
        <div className="section-heading">
          <p className="eyebrow">The learning loop</p>
          <h2>
            Understanding sets
            <br />
            the pace.
          </h2>
          <p>
            Practice is the center. Lessons and paper support the problem in
            front of the learner.
          </p>
          <a href="/amp/">How AMP works ↗</a>
        </div>
        <Steps />
      </section>
      <section className="section split paper-section">
        <div className="section-heading">
          <p className="eyebrow">From screen to paper</p>
          <h2>
            The same mathematics.
            <br />
            Room to work.
          </h2>
          <p>
            Preview a short lesson, then open a printable sample with a separate
            solution key.
          </p>
          <a className="button secondary" href="/samples/">
            Open printable sample <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div className="lesson-excerpt" id="sample-lesson">
          <p className="eyebrow">Lesson excerpt · {sampleLesson.title}</p>
          <h3>{sampleLesson.sections[0]!.title}</h3>
          {sampleLesson.sections[0]!.paragraphs.map((p) => (
            <p key={p}>
              <Math text={p} />
            </p>
          ))}
          <a href="/amp/#examples">See more problems ↗</a>
        </div>
      </section>
      <section className="section closing">
        <p className="eyebrow">Free placement</p>
        <h2>
          Find a starting point
          <br />
          in mathematics.
        </h2>
        <p>Answer a short sequence. See estimated levels by area.</p>
        <Try config={config} />
        <a href="/amp/#coverage">Review current coverage</a>
      </section>
    </>
  );
}
function Amp({ config }: { config: SiteConfig }) {
  return (
    <>
      <Intro
        label="AMP Mathematics"
        heading="Practice with a reason for every step."
      >
        <p className="lead">
          Placement estimates a starting point. Mixed practice responds to the
          learner’s work. Explanations make the mathematics visible.
        </p>
        <Try config={config} />
      </Intro>
      <section className="section split">
        <div className="section-heading">
          <h2>
            A starting point,
            <br />
            not a label.
          </h2>
          <p>
            A short placement cannot prove mastery. AMP uses the answers as
            initial evidence and updates its estimates through practice.
          </p>
        </div>
        <Steps />
      </section>
      <section className="section" id="examples">
        <div className="section-heading">
          <p className="eyebrow">Inside the product</p>
          <h2>Look at the mathematics.</h2>
          <p>
            These worked examples use AMP’s problem generator, figures, and
            explanations. They are samples, not a placement assessment.
          </p>
        </div>
        <div className="sample-grid">
          {samples.map((_, index) => (
            <Sample index={index} key={index} />
          ))}
        </div>
        <p>
          <a href="/samples/">Open these examples as a printable ↗</a>
        </p>
      </section>
      <Coverage />
      <Plans config={config} />
    </>
  );
}
function Esa({ config }: { config: SiteConfig }) {
  const groups = [...new Set(config.funding.map((r) => r.state))].sort();
  const states = groups.filter((state) => state !== "US");
  const orderedGroups = groups.includes("US") ? ["US", ...states] : states;
  return (
    <>
      <Intro
        label="Education funds"
        heading="Explore education funding and savings."
      >
        <p className="lead">
          An education savings account (ESA) or scholarship may pay through a
          marketplace or reimburse an eligible purchase. Rules depend on the
          program and the student.
        </p>
        <p>
          Tax credits and school purchasing have different rules. Find your
          program below to check the route, documents and AMP availability.
        </p>
      </Intro>
      <section className="section">
        <h2>State programs and nationwide savings</h2>
        {orderedGroups.length ? (
          <>
            <nav
              className="state-links"
              aria-label="Funding and savings guidance"
            >
              {orderedGroups.map((s) => (
                <a href={`#state-${s}`} key={s}>
                  <StateIdentity state={s} compact />
                  <span>{stateNames[s] ?? s}<small>{config.funding.filter((r) => r.state === s).length} {config.funding.filter((r) => r.state === s).length === 1 ? "route" : "routes"}</small></span>
                </a>
              ))}
            </nav>
            <p className="directory-count">
              <strong>{config.funding.filter((r) => r.page).length} parent guides</strong>
              {states.length > 0 && <>{" · "}{states.length} {states.length === 1 ? "state" : "states"}</>}
              {groups.includes("US") && <> · Nationwide savings guidance</>}
              <span>Guides explain purchase routes; inclusion does not mean vendor approval.</span>
            </p>
            {orderedGroups.map((state) => (
              <section className="state" id={`state-${state}`} key={state}>
                <h3 className="state-heading"><StateIdentity state={state} compact />{stateNames[state] ?? state}</h3>
                <div className="program-grid">
                {config.funding
                  .filter((r) => r.state === state)
                  .map((route, i) => (
                    <article className="program-card" key={i}>
                      <p className="eyebrow">{fundingLabels[route.kind]}</p>
                      <h4>
                        {route.page ? (
                          <a href={fundingPath(route.page.slug)}>
                            {route.program}
                          </a>
                        ) : (
                          route.program
                        )}
                      </h4>
                      <p>{route.page?.summary ?? route.instructions}</p>
                      {route.page && <div className="program-card-status"><strong>AMP purchase status</strong><p>{route.page.ampStatus}</p></div>}
                      {route.page && (
                        <p>
                          <a href={fundingPath(route.page.slug)}>
                            Purchase steps and receipt checklist ↗
                          </a>
                        </p>
                      )}
                      <a href={route.sourceUrl}>
                        Official program requirements ↗
                      </a>
                      <p className="fine">
                        Guidance review valid through {route.reviewedUntil}.
                        Your program decides eligibility.
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </>
        ) : (
          <p>
            Funding guidance is not published here yet. Check the
            program’s official purchase rules before buying, or{" "}
            <a href="/support/">contact support</a> with your state and program
            name.
          </p>
        )}
        <div className="notice">
          <h3>Keep your documents.</h3>
          <p>
            Save the itemized receipt, service dates, and the program’s purchase
            instructions. Use the purchaser and student details your program
            requires. Submit documents through the program’s own secure channel.
          </p>
        </div>
        <a href={tryUrl(config)}>
          Open AMP to review available purchasing routes ↗
        </a>
      </section>
    </>
  );
}
const faq = [
  [
    "What happens in the free placement?",
    "The learner answers a short adaptive sequence. AMP estimates levels in different mathematical areas. No parent account or payment card is required to begin. The result is an estimate, not a diagnostic evaluation.",
  ],
  [
    "Does AMP cover every grade or standard?",
    "No. AMP has selected skills across early and high-school mathematics. The coverage list identifies the current problem types. A grade band describes where a problem fits; it does not establish a complete course.",
  ],
  [
    "How are the next problems chosen?",
    "AMP maintains estimates across mathematical strands, selects work near the learner’s current level, and revisits earlier work. A correct answer adds evidence; one answer does not prove mastery.",
  ],
  [
    "Do we have to read a book first?",
    "No. Practice is the primary experience. Use the attached explanation or lesson when a problem needs more context. Printables support work on paper.",
  ],
  [
    "Who manages the account?",
    "A parent or guardian signs in, manages learner profiles and purchases, and completes the applicable consent process. Use a nickname for the learner.",
  ],
  [
    "Can I use education funds?",
    "It depends on the specific program, student eligibility, approved purchase route, and product. Check the official program rules before paying. Neither a receipt nor a general provider listing guarantees reimbursement.",
  ],
  [
    "How do cancellation and refunds work?",
    "Cancel renewal in the parent billing portal. For personal payments, request a full refund within 30 days, including if you later seek reimbursement. Direct program and marketplace payments follow the administrator’s disclosed rules where they differ. Refunds return through the original payment route. See the refund policy.",
  ],
  [
    "What device do we need?",
    "Use a current web browser with internet access. The site and web app support small screens. A printer is optional; the learner can work in the app.",
  ],
];
function Parents({ config }: { config: SiteConfig }) {
  return (
    <>
      <Intro label="For parents" heading="Know what you’re choosing." />
      <section className="faq">
        {faq.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
      <section className="section closing">
        <h2>Start with a sample.</h2>
        <Try config={config} />
        <a href="/amp/#coverage">Check the coverage</a>
      </section>
    </>
  );
}
function Schools({ config }: { config: SiteConfig }) {
  const subject = "AMP Mathematics school inquiry";
  const body = [
    "School or district:",
    "Your role:",
    "Grade range and mathematics topics:",
    "Approximate number of learners:",
    "Desired start date:",
    "Curriculum review or purchasing requirements:",
    "",
    "Please do not include student names or records.",
  ].join("\n");
  return (
    <>
      <Intro
        label="Schools · Districts · Private schools"
        heading="Review AMP for your school."
      >
        <p className="lead">
          A digital mathematics curriculum built around adaptive mixed practice,
          with lessons and printable worksheets. Explore the materials, then
          discuss the scope and licenses your learners need.
        </p>
        <div className="actions">
          {config.supportEmail ? (
            <a
              className="button"
              href={`mailto:${config.supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
            >
              Ask about school licenses <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <p>
              School inquiries will open when contact details are published.
            </p>
          )}
          <a className="text-link" href="/samples/">
            View printable samples →
          </a>
        </div>
      </Intro>
      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Curriculum review</p>
          <h2>Start with the mathematics.</h2>
        </div>
        <ol className="steps">
          <li>
            <span className="step-number">01</span>
            <div>
              <h3>Match your learning goals.</h3>
              <p>
                Check the <a href="/amp/#coverage">current topic coverage</a>{" "}
                against your grade range and curriculum requirements. Share the
                skills you want students to develop.
              </p>
            </div>
          </li>
          <li>
            <span className="step-number">02</span>
            <div>
              <h3>Examine the instruction.</h3>
              <p>
                Explore <a href="/amp/">worked problems and lesson examples</a>,
                then print a{" "}
                <a href="/samples/">worksheet with its solution key</a>. Review
                how the explanations and practice fit your teaching.
              </p>
            </div>
          </li>
          <li>
            <span className="step-number">03</span>
            <div>
              <h3>Define the purchase.</h3>
              <p>
                Tell us your approximate learner count, desired start date and
                purchasing process. Confirm license scope, pricing, access and
                support in a written proposal before placing an order.
              </p>
            </div>
          </li>
        </ol>
      </section>
      <section className="section prose">
        <h2>Bring your review requirements.</h2>
        <p>
          Share curriculum criteria, accessibility questions, data-agreement
          requirements and vendor forms. Include any required account-management
          or integration capabilities so their availability can be confirmed.
        </p>
        <p>
          Read our <a href="/legal/privacy/">privacy notice</a>,{" "}
          <a href="/legal/accessibility/">accessibility statement</a>,{" "}
          <a href="/legal/terms/">terms</a> and{" "}
          <a href="/legal/refund/">refund policy</a> as part of your review.
          Your school or district determines its purchasing and funding
          requirements.
        </p>
        <h2>Tell us about your school.</h2>
        <p>
          Include your school or district, your role, grade range, approximate
          seat count and desired start date. Use your work contact details;
          student names, records and login credentials are not needed for an
          inquiry.
        </p>
        <Contact config={config} />
      </section>
    </>
  );
}
function Printable() {
  return (
    <>
      <Intro
        label="AMP · Printable sample"
        heading="Three problems. Space to think."
      >
        <p>
          Work on paper, then use the separate solution key. These are samples
          of different topics, not a placement test.
        </p>
        <button type="button" data-print>
          Print practice & solutions
        </button>
      </Intro>
      <section className="worksheet">
        {samples.map((sample, i) => (
          <article className="worksheet-problem" key={i}>
            <h2>
              {i + 1}. {sample.title}
            </h2>
            <p>
              <Math text={sample.public.prompt} />
            </p>
            <div className="print-figure">
              <SampleFigure index={i} />
            </div>
            <div className="working-space" aria-hidden="true" />
          </article>
        ))}
      </section>
      <section className="answer-key">
        <h2>Solution key</h2>
        {samples.map((sample, i) => (
          <article key={i}>
            <h3>
              {i + 1}. {sample.title}
            </h3>
            <ol>
              {sample.explanation.map((step, j) => (
                <li key={j}>
                  <Math text={step} />
                </li>
              ))}
            </ol>
            <p>
              <strong>Answer: </strong>
              <Math text={sample.answer} />
            </p>
          </article>
        ))}
      </section>
    </>
  );
}
export function Page({ route, config }: { route: string; config: SiteConfig }) {
  const funding = fundingForPath(route, config);
  const structuredData = funding && fundingStructuredData(funding, config);
  const description =
    funding?.page?.summary ??
    (route === "/schools/"
      ? "Review AMP Mathematics for your school or district: adaptive practice, lessons, printable samples and school-license inquiries."
      : "Explore AMP Mathematics from Corpora: adaptive mixed practice, clear mathematical explanations, and optional printables. Try free placement and review current coverage.");
  let content: ReactNode;
  if (route === "/") content = <Home config={config} />;
  else if (route === "/amp/") content = <Amp config={config} />;
  else if (route === "/esa/") content = <Esa config={config} />;
  else if (funding) content = <FundingPage funding={funding} supportEmail={config.supportEmail} appUrl={config.appUrl} plans={config.plans} />;
  else if (route === "/parents/") content = <Parents config={config} />;
  else if (route === "/schools/") content = <Schools config={config} />;
  else if (route === "/support/")
    content = (
      <>
        <Intro label="Corpora support" heading="Get help with AMP.">
          <p className="lead">
            For access, billing, a problem in the mathematics, or an
            accessibility barrier: <Contact config={config} />
          </p>
        </Intro>
        <div className="prose">
          <h2>Tell us about your experience</h2>
          <p>What’s working well? What would make AMP better for your family? Share your thoughts with <Contact config={config} />. We use your feedback to improve the lessons, practice and purchase experience.</p>
          <h2>Help us find the issue</h2>
          <p>
            Include the page or feature, what happened, and what you expected.
            For billing, include an order or receipt reference. Do not send
            passwords, full card numbers, or a child’s full name.
          </p>
          <h2>Common requests</h2>
          <ul>
            <li>
              <a href="/parents/">Product and account questions</a>
            </li>
            <li>
              <a href="/legal/refund/">Request a refund</a>
            </li>
            <li>
              <a href="/legal/privacy/">
                Review or delete learning information
              </a>
            </li>
            <li>
              <a href="/legal/accessibility/">
                Report an accessibility barrier
              </a>
            </li>
          </ul>
        </div>
      </>
    );
  else if (route === "/try/")
    content = (
      <>
        <Intro label="Try AMP" heading="Start with free practice.">
          <p className="lead">
            Open AMP, then choose “Try free” to begin placement without an
            account or card.
          </p>
          {config.appUrl ? (
            <Try config={config} label="Open AMP" />
          ) : (
            <p className="notice">
              Practice is not available from this preview. You can explore
              worked examples and print the sample.
            </p>
          )}
        </Intro>
        <div className="actions">
          <a href="/amp/#examples">Explore examples ↗</a>
          <a href="/samples/">Printable sample ↗</a>
        </div>
      </>
    );
  else if (route === "/samples/") content = <Printable />;
  else {
    const page = route.split("/")[2] as LegalPage;
    content = (
      <>
        <Intro label="Corpora policies" heading={legalTitles[page]} />
        <Legal page={page} config={config} />
      </>
    );
  }
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title(route, config)}</title>
        <meta name="description" content={description} />
        <meta name="theme-color" content="#f7f6f0" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        {config.mode === "preview" && (
          <meta name="robots" content="noindex, nofollow" />
        )}
        {config.siteUrl && (
          <link rel="canonical" href={new URL(route, config.siteUrl).href} />
        )}
        {funding && (
          <>
            <meta property="og:type" content="website" />
            <meta property="og:title" content={title(route, config)} />
            <meta property="og:description" content={description} />
            {config.siteUrl && (
              <meta
                property="og:url"
                content={new URL(route, config.siteUrl).href}
              />
            )}
          </>
        )}
        {structuredData && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(structuredData)
                .replaceAll("<", "\\u003c")
                .replaceAll("\u2028", "\\u2028")
                .replaceAll("\u2029", "\\u2029"),
            }}
          />
        )}
        {config.mode === "production" && config.appUrl && <script src="/assets/engagement.js" data-engagement-endpoint={new URL("/api/v1/site-events", config.appUrl).href} defer />}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="stylesheet" href="/assets/site.css" />
        <link rel="stylesheet" href="/assets/katex.min.css" />
        {fundingForPath(route, config)?.page?.presentation?.invoiceForm && <script src="/assets/invoice.js" defer />}
        {route === "/samples/" && <script src="/assets/print.js" defer />}
        {config.mode === "production" && config.appUrl && ["/esa/arkansas-efa/", "/esa/arizona-esa/"].includes(route) && (
          <>
          <script src="/assets/campaign.js" data-campaign-endpoint={new URL("/api/v1/campaign-events", config.appUrl).href} defer />
          </>
        )}
        {config.mode === "production" && config.appUrl && ["/amp/", "/esa/arkansas-efa/", "/esa/arizona-esa/"].includes(route) && (
          <script src="/assets/acquisition.js" data-acquisition-endpoint={new URL("/api/v1/advertising/acquisition", config.appUrl).href} defer />
        )}
      </head>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <a className="brand" href="/" aria-label="Corpora home">
            corpora<span aria-hidden="true">.</span>
          </a>
          <nav aria-label="Main navigation">
            <a
              href="/amp/"
              aria-current={route === "/amp/" ? "page" : undefined}
            >
              AMP
            </a>
            <a className="nav-secondary" href="/esa/">
              Education funds
            </a>
            <a className="nav-secondary" href="/parents/">
              Parents
            </a>
            <a className="nav-secondary" href="/schools/">
              Schools
            </a>
            <Try config={config} />
          </nav>
        </header>
        <main id="main">{content}</main>
        <footer>
          <div className="footer-lead">
            <a className="brand" href="/">
              corpora.
            </a>
            <p>Mathematics, with understanding.</p>
          </div>
          <nav aria-label="Footer navigation">
            <a href="/amp/">AMP Mathematics</a>
            <a href="/esa/">Education funds</a>
            <a href="/parents/">Parents FAQ</a>
            <a href="/schools/">Schools & districts</a>
            <a href="/support/">Support</a>
            {config.supportEmail && <a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a>}
            {Object.entries(legalTitles).map(([slug, label]) => (
              <a key={slug} href={`/legal/${slug}/`}>
                {label}
              </a>
            ))}
          </nav>
          <p className="fine">
            © {new Date().getUTCFullYear()}{" "}
            {config.operator?.legalName ?? "Corpora Inc"}
            {config.mode === "preview" ? " · Preview" : ""}
          </p>
        </footer>
      </body>
    </html>
  );
}
