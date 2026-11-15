import React from "../react.js";
import { formatPrice, type SiteConfig } from "../config.js";
import {
  FREE_ONLINE_PROBLEMS,
  freeAllowance,
} from "../../../amp/src/learning/free-allowance.js";
import { Breadcrumbs, ResourceHero, LibraryCTA, appEntry } from "./shared.js";
export const plansMeta = {
  path: "/plans/",
  label: "AMP plans and access",
  title: "One connected mathematics curriculum.",
  description:
    "Explore AMP’s free practice, individual and family access, unlimited personalized workbooks, tutor profiles and school plans.",
};
export function PlansPage({ config }: { config: SiteConfig }) {
  return (
    <article className="resource-page">
      <Breadcrumbs items={[{ label: "Plans and access" }]} />
      <ResourceHero meta={plansMeta}>
        <p>
          Adaptive mixed practice, clear explanations and personalized paper
          work belong together. Choose the access that fits your learner, family
          or teaching.
        </p>
      </ResourceHero>
      <section className="feature-band">
        <p className="eyebrow">Start with real mathematics</p>
        <h2>Try AMP free. No credit card.</h2>
        <p>
          Your free access includes {FREE_ONLINE_PROBLEMS} online answers or
          skips and {freeAllowance(0, 0).workbooks.total} personalized
          workbooks. Hints, lessons and worked explanations are part of the
          experience. Recording results from an issued workbook uses neither
          allowance.
        </p>
        <a className="button" href={appEntry(config)}>
          Start free practice ↗
        </a>
      </section>
      <section className="resource-section">
        <p className="eyebrow">Continue the whole learning path</p>
        <h2>Unlimited practice. Unlimited fresh workbooks.</h2>
        <div className="plans">
          {config.plans.length ? (
            config.plans.map((plan) => (
              <article className="plan" key={plan.interval}>
                <h3>
                  {plan.interval === "year"
                    ? "Annual access"
                    : "Monthly access"}
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
                <ul>
                  <li>Adaptive mixed practice across the curriculum</li>
                  <li>Hints, lessons and worked explanations</li>
                  <li>Unlimited personalized workbooks</li>
                  <li>Progress by mathematical area and skill</li>
                </ul>
                <a className="button" href={appEntry(config)}>
                  Choose in AMP ↗
                </a>
              </article>
            ))
          ) : (
            <article className="plan">
              <h3>Choose your access in AMP.</h3>
              <p>Current plans and prices are shown before checkout.</p>
              <a className="button" href={appEntry(config)}>
                Explore plans ↗
              </a>
            </article>
          )}
          <aside className="plan-note">
            <p>
              <strong>30-day full refund for personal payments.</strong>{" "}
              Education-fund refunds follow the original purchase route.
            </p>
            <a href="/legal/refund/">Read the refund policy ↗</a>
            <p>Use an approved education-fund route for your state.</p>
            <a href="/esa/">Find your program ↗</a>
          </aside>
        </div>
      </section>
      <section className="resource-section">
        <h2>Access that fits the people learning.</h2>
        <div className="level-cards">
          <section className="level-card">
            <p className="eyebrow">Families</p>
            <h3>A child’s learning. Both parents’ practice.</h3>
            <p>
              A paid child license covers that learner and adult practice for
              the purchasing parent and one invited second parent. Additional
              children use their own learner access.
            </p>
            <a href="/parents/">Explore family questions ↗</a>
          </section>
          <section className="level-card">
            <p className="eyebrow">Independent adults</p>
            <h3>Your own path through mathematics.</h3>
            <p>
              An individual adult license covers your personal learner and your
              practice profiles. Keep your own progress while exploring other
              starting points.
            </p>
            <a href="/adult-learners/">Explore adult learning ↗</a>
          </section>
          <section className="level-card">
            <p className="eyebrow">Tutors and co-ops</p>
            <h3>Simulate different learners.</h3>
            <p>
              One adult license covers tutor-led practice profiles at different
              levels and their workbooks. Students with independent logins and
              progress use their own learner access.
            </p>
            <a href="/tutors/">Explore tutor profiles ↗</a>
          </section>
          <section className="level-card">
            <p className="eyebrow">Schools</p>
            <h3>One curriculum across the classroom.</h3>
            <p>
              School access covers licensed learners and teachers’ adult
              practice. Explore classes, progress and the purchasing route for
              your school.
            </p>
            <a href="/schools/">Explore school access ↗</a>
          </section>
        </div>
      </section>
      <LibraryCTA config={config} />
    </article>
  );
}
