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
import { pageCopy } from "./page-copy.js";
import { cardHeight, cardWidth } from "./social-card.js";
import { Contact, Legal, legalTitles, type LegalPage } from "./legal.js";
import { formatPrice, type SiteConfig } from "./config.js";
import {
  FundingPage,
  fundingForPath,
  fundingLabels,
  fundingPath,
  fundingStructuredData,
} from "./funding.js";
import { darkSurface, lightSurface, siteStructuredData } from "./icons.js";
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
  "/amp/": "AMP Mathematics · A complete math curriculum",
  "/esa/": "Pay with education funds · Corpora",
  "/parents/": "Parents’ questions · AMP Mathematics",
  "/schools/": "Mathematics curriculum for schools and districts · Corpora",
  "/support/": "Support · Corpora",
  "/try/": "Try AMP Mathematics",
  "/samples/": "AMP · Printable practice sample",
};
/** What a search result says about each page, in the page's own words. */
const descriptions: Record<string, string> = {
  "/": "A complete math curriculum, from counting to precalculus. AMP finds your child’s level and chooses each next problem, with lessons and printable workbooks.",
  "/amp/":
    "AMP moves at your child’s pace, from counting to precalculus: ahead as fast as they’re ready, back to fill every gap. Thirty minutes a day, nothing to plan.",
  "/esa/":
    "Education savings accounts (ESAs), scholarships and family savings can pay for AMP. See each program’s route and rules.",
  "/parents/":
    "What the free assessment involves, what AMP covers, how problems are chosen, education funds, cancellation and refunds, and the devices you need.",
  "/schools/":
    "Review AMP Mathematics for your school or district: a complete math curriculum, from counting to precalculus, with adaptive practice, lessons and printable worksheets.",
  "/support/":
    "Get help with AMP: access, billing, a problem in the mathematics, or an accessibility barrier.",
  "/try/":
    "Create your free parent account, choose your child’s birth year and begin. Free assessment, adaptive practice and printable workbooks. No credit card.",
  "/samples/":
    "Three AMP practice problems to print and work on paper, with a separate solution key.",
  "/legal/terms/": "The terms of use for AMP and Corpora.",
  "/legal/privacy/": "How Corpora handles privacy and children’s data in AMP.",
  "/legal/refund/":
    "AMP’s refund policy: the 30-day money-back guarantee, and how refunds work for education-fund purchases.",
  "/legal/accessibility/":
    "Corpora’s accessibility statement for AMP, and how to report a barrier.",
};
export const title = (route: string, config?: SiteConfig) => {
  const funding = config && fundingForPath(route, config);
  if (funding) {
    // Search results cut titles at about 60 characters: drop words, not meaning.
    const full = `${funding.program} and AMP Mathematics · Corpora`;
    const shorter = `${funding.program} and AMP`;
    return full.length <= 60
      ? full
      : shorter.length <= 60
        ? shorter
        : funding.program;
  }
  return (
    titles[route] ??
    `${legalTitles[route.split("/")[2] as LegalPage]} · Corpora`
  );
};
export const tryUrl = (config: SiteConfig) => config.appUrl ?? "/try/";
// Matches the supporting line under "Try it free" on AMP's pitch.
const tryFreeNote =
  "Free assessment, adaptive practice and printable workbooks. No credit card.";
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
          <h3>Find your child’s level.</h3>
          <p>
            A short assessment adapts to every answer and places your child
            separately in each area of math, so a strength never hides a gap.
          </p>
        </div>
      </li>
      <li>
        <span className="step-number">02</span>
        <div>
          <h3>Work at the edge of understanding.</h3>
          <p>
            AMP builds each next problem from what your child knows now, and
            brings earlier ideas back until they stick.
          </p>
        </div>
      </li>
      <li>
        <span className="step-number">03</span>
        <div>
          <h3>See why it works.</h3>
          <p>
            Every problem has a hint, a lesson and a step-by-step explanation.
            Print a workbook made from where your child is.
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
          Choose your plan in the parent account. Checkout confirms taxes,
          renewal and the full amount before you pay.
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
              {/* Renewal terms stay: they must be disclosed before purchase
                  (ROSCA, 15 U.S.C. § 8403). */}
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
          {/* Refund terms stay: programs dictate where refunded funds go.
              Citations: amp/src/funding-purchase/refund-terms.ts. */}
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
const count = (value: number) => value.toLocaleString("en-US");
function Coverage() {
  return (
    <section className="section" id="coverage">
      <div className="section-heading">
        <p className="eyebrow">The full curriculum</p>
        <h2>See everything your child can learn.</h2>
        <p>
          AMP runs from first counting through fractions, algebra, geometry,
          statistics and precalculus. Open a grade band to see every problem
          type.
        </p>
      </div>
      <div className="coverage-summary">
        <div>
          <strong>{count(product.summary.templatesPresent)}</strong>
          <span>problem types</span>
        </div>
        <div>
          <strong>{count(product.skillsWithProblems)}</strong>
          <span>skills</span>
        </div>
        <div>
          <strong>{count(product.summary.lessonsPresent)}</strong>
          <span>lessons</span>
        </div>
      </div>
      <div className="coverage-list">
        {product.bands.map((group) => (
          <details key={group.band}>
            <summary>
              Grades {group.band}
              <span>{count(group.templates.length)} problem types</span>
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
      <p>
        <a href="/coverage.json">Open the coverage data ↗</a>
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
            <span className="dot" /> {pageCopy["/"].label}
          </p>
          <h1>
            {pageCopy["/"].heading}
            <br />
            <em>{pageCopy["/"].emphasis}</em>
          </h1>
          <p className="lead">
            AMP is a complete math curriculum, from counting to precalculus,
            that moves at your child’s pace: ahead as fast as they’re ready,
            back to fill every gap. Thirty minutes a day, nothing to plan.
          </p>
          <div className="actions">
            <Try config={config} />
            <a className="text-link" href="/amp/">
              Explore AMP <span aria-hidden="true">→</span>
            </a>
          </div>
          <p className="fine">{tryFreeNote}</p>
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
            Your child presses Next. AMP builds the best next problem every
            time, with the lesson and the paper work attached.
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
        <p className="eyebrow">Free assessment</p>
        <h2>
          Find your child’s level
          <br />
          in every area of math.
        </h2>
        <p>A short adaptive assessment, then practice from exactly there.</p>
        <Try config={config} />
        <a href="/amp/#coverage">See the full curriculum</a>
      </section>
    </>
  );
}
function Amp({ config }: { config: SiteConfig }) {
  return (
    <>
      <Intro
        label={pageCopy["/amp/"].label}
        heading={pageCopy["/amp/"].heading}
      >
        <p className="lead">
          AMP moves at your child’s pace: ahead as fast as they’re ready, back
          to fill every gap. Thirty minutes a day, nothing to plan.
        </p>
        <Try config={config} />
        <p className="fine">{tryFreeNote}</p>
      </Intro>
      <section className="section split">
        <div className="section-heading">
          <h2>
            It starts where
            <br />
            your child is.
          </h2>
          <p>
            A short assessment finds your child’s level in each area of math.
            Every answer after that sharpens the picture, so practice keeps up
            as they grow.
          </p>
        </div>
        <Steps />
      </section>
      <section className="section" id="examples">
        <div className="section-heading">
          <p className="eyebrow">Inside the product</p>
          <h2>Look at the mathematics.</h2>
          <p>
            These are real AMP problems, with the same figures and step-by-step
            explanations your child will see. Open the reasoning on any of them.
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
        label={pageCopy["/esa/"].label}
        heading={pageCopy["/esa/"].heading}
      >
        <p className="lead">
          Education savings accounts (ESAs), scholarships and family savings can
          pay for AMP. Each program sets its own route and rules.
        </p>
        <p>
          Find your program below for the purchase steps, the documents to keep
          and AMP’s status with that program.
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
              <span>Each guide shows the purchase route and AMP’s status with that program.</span>
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
                      {/* Eligibility line stays: administrators, not vendors,
                          approve each purchase (amp/docs/funded-purchases.md). */}
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
    "What happens in the free assessment?",
    "Your child answers a short adaptive sequence, and AMP finds their level in each area of math. You create a free parent account to begin. No credit card.",
  ],
  [
    "What does AMP cover?",
    "AMP is a complete math curriculum, from counting to precalculus, with practice, lessons, step-by-step explanations and printable workbooks throughout. Ready children can cover years of material. The curriculum list on the AMP page shows every problem type by grade.",
  ],
  [
    "How are the next problems chosen?",
    "AMP tracks your child’s level in every area of math, builds each problem at the edge of what they can do, and brings earlier ideas back. Mastery takes more than one right answer, so ideas return until they stick.",
  ],
  [
    "Do we have to read a book first?",
    "No. Your child starts practicing right away. Every problem has a hint, a lesson and a step-by-step explanation attached. Printable workbooks are there for work on paper.",
  ],
  [
    "Who manages the account?",
    "A parent or guardian signs in, manages learner profiles and purchases, and completes the applicable consent process. Use a nickname for the learner.",
  ],
  // Program review stays: administrators, not vendors, approve each purchase
  // (amp/docs/funded-purchases.md).
  [
    "Can I use education funds?",
    "Yes, where your program allows it. Your state’s guide under Education funds gives the purchase route and the documents to keep. Each program reviews its own purchases, so check its rules before you pay.",
  ],
  // Refund terms stay: programs dictate where refunded funds go. Citations:
  // amp/src/funding-purchase/refund-terms.ts.
  [
    "How do cancellation and refunds work?",
    "Cancel renewal in the parent billing portal. For personal payments, request a full refund within 30 days, including if you later seek reimbursement. Direct program and marketplace payments follow the administrator’s disclosed rules where they differ. Refunds return through the original payment route. See the refund policy.",
  ],
  [
    "What device do we need?",
    "Any current web browser with internet access, on a phone, tablet or computer. A printer is optional; your child can do everything in the app.",
  ],
];
function Parents({ config }: { config: SiteConfig }) {
  return (
    <>
      <Intro label={pageCopy["/parents/"].label} heading={pageCopy["/parents/"].heading} />
      <section className="faq">
        {faq.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
      <section className="section closing">
        <h2>Start with the free assessment.</h2>
        <Try config={config} />
        <a href="/amp/#coverage">See the full curriculum</a>
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
        label={pageCopy["/schools/"].label}
        heading={pageCopy["/schools/"].heading}
      >
        <p className="lead">
          A complete math curriculum, from counting to precalculus, built around
          adaptive mixed practice, with lessons and printable worksheets.
          Explore the materials, then tell us the licenses your learners need.
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
                Compare the <a href="/amp/#coverage">full curriculum</a> with
                your grade range and requirements. Share the skills you want
                students to develop.
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
        label={pageCopy["/samples/"].label}
        heading={pageCopy["/samples/"].heading}
      >
        <p>
          Work on paper, then check each answer with the separate solution key.
          In AMP, every workbook is made from where your child is.
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
export type SocialImage = { path: string; alt: string };
export function Page({
  route,
  config,
  socialImage,
}: {
  route: string;
  config: SiteConfig;
  socialImage?: SocialImage;
}) {
  const funding = fundingForPath(route, config);
  const structuredData = funding
    ? fundingStructuredData(funding, config)
    : route === "/"
      ? siteStructuredData(config)
      : undefined;
  const description =
    funding?.page?.summary ?? descriptions[route] ?? descriptions["/"]!;
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
        <Intro label={pageCopy["/support/"].label} heading={pageCopy["/support/"].heading}>
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
        <Intro label={pageCopy["/try/"].label} heading={pageCopy["/try/"].heading}>
          <p className="lead">
            Create your free parent account, choose your child’s birth year and
            begin. {tryFreeNote}
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
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content={lightSurface}
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content={darkSurface}
        />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        {config.mode === "preview" && (
          <meta name="robots" content="noindex, nofollow" />
        )}
        {config.siteUrl && (
          <link rel="canonical" href={new URL(route, config.siteUrl).href} />
        )}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Corpora" />
        <meta property="og:title" content={title(route, config)} />
        <meta property="og:description" content={description} />
        {config.siteUrl && (
          <meta property="og:url" content={new URL(route, config.siteUrl).href} />
        )}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title(route, config)} />
        <meta name="twitter:description" content={description} />
        {/* Crawlers need an absolute image URL, so previews without a site origin omit it. */}
        {config.siteUrl && socialImage && (
          <>
            <meta
              property="og:image"
              content={new URL(socialImage.path, config.siteUrl).href}
            />
            <meta property="og:image:type" content="image/png" />
            <meta property="og:image:width" content={String(cardWidth)} />
            <meta property="og:image:height" content={String(cardHeight)} />
            <meta property="og:image:alt" content={socialImage.alt} />
            <meta
              name="twitter:image"
              content={new URL(socialImage.path, config.siteUrl).href}
            />
            <meta name="twitter:image:alt" content={socialImage.alt} />
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
        <link rel="icon" href="/favicon.ico" sizes="48x48" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="stylesheet" href="/assets/site.css" />
        <link rel="stylesheet" href="/assets/katex.min.css" />
        {fundingForPath(route, config)?.page?.presentation?.invoiceForm && <script src="/assets/invoice.js" defer />}
        {route === "/samples/" && <script src="/assets/print.js" defer />}
        {config.mode === "production" && config.appUrl && ["/esa/arkansas-efa/", "/esa/arizona-esa/", "/esa/new-hampshire-efa/"].includes(route) && (
          <>
          <script src="/assets/campaign.js" data-campaign-endpoint={new URL("/api/v1/campaign-events", config.appUrl).href} defer />
          </>
        )}
        {config.mode === "production" && config.appUrl && ["/amp/", "/esa/arkansas-efa/", "/esa/arizona-esa/", "/esa/new-hampshire-efa/"].includes(route) && (
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
