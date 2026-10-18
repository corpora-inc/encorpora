import React from "./react.js";
import { TRIAL_DAYS } from "../../amp/src/server/trials.js";
import type { SiteConfig } from "./config.js";
export const legalTitles = {
  terms: "Terms of use",
  privacy: "Privacy & children’s data",
  refund: "Refund policy",
  accessibility: "Accessibility",
} as const;
export type LegalPage = keyof typeof legalTitles;
export function Contact({ config }: { config: SiteConfig }) {
  return config.supportEmail ? (
    <a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a>
  ) : (
    <span>Contact details will be provided before this service opens.</span>
  );
}
export function Legal({
  page,
  config,
}: {
  page: LegalPage;
  config: SiteConfig;
}) {
  return (
    <div className="prose legal">
      {!config.legalReviewed && (
        <p className="notice">
          <strong>Draft for counsel review.</strong> These terms and notices are
          proposed for review before public launch.
        </p>
      )}
      {page === "terms" && (
        <>
          <p>
            AMP Mathematics is a learning service from{" "}
            {config.operator?.legalName ?? "Corpora Inc"}. These terms cover the
            Corpora website, AMP practice, and materials supplied with a
            license.
          </p>
          <h2>Who may purchase</h2>
          <p>
            A parent or legal guardian must manage the account, purchase access,
            and complete the applicable consent process before creating a
            child’s learning profile. Keep sign-in details private. Use a
            learner nickname rather than a full legal name.
          </p>
          <h2>What a license includes</h2>
          <p>
            A license provides one learner with the app and the printable
            materials offered with that plan for its stated term. You may print
            materials for that learner’s personal education. You may not resell
            materials, share account access outside your family, or redistribute
            the materials publicly.
          </p>
          <h2>Price, term, and renewal</h2>
          <p>
            The checkout shows the price, currency, taxes, access period, and
            whether the selected plan renews. An automatically renewing
            subscription continues until cancelled. Manage cancellation in the
            parent account’s billing portal. Cancelling stops future renewal; a
            refund is a separate request under the{" "}
            <a href="/legal/refund/">refund policy</a>. Education-fund purchases
            follow the approved program route and stated term.
          </p>
          <h2>Learning and availability</h2>
          <p>
            AMP offers the{" "}
            <a href="/amp/#coverage">
              skills listed in its coverage description
            </a>
            . Placement is an estimate from a limited set of answers, not a
            diagnosis, accredited qualification, or guaranteed score. We do not
            promise complete grade-level coverage or a particular rate of
            progress. Internet access and a supported modern browser are
            required for the web service.
          </p>
          <h2>Responsible use</h2>
          <p>
            Do not attempt unauthorized access, interfere with the service,
            automate abusive requests, or upload material you do not have
            permission to use. We may restrict access to protect accounts or the
            service. Contact support if you believe a restriction is mistaken.
          </p>
          <h2>Problems and changes</h2>
          <p>
            Report incorrect content or a service problem to{" "}
            <Contact config={config} />. We may update features and these terms.
            Material changes will be explained before they apply to an existing
            purchase where required. Nothing in these terms removes rights that
            applicable consumer law gives you.
          </p>
        </>
      )}
      {page === "privacy" && (
        <>
          <p>
            This notice describes the website and AMP’s learning service. A
            parent manages the family account; a learner uses a separate
            learning profile.
          </p>
          <h2>Who operates the service</h2>
          <p>
            {config.operator?.legalName ?? "Corpora Inc"}.{" "}
            <Contact config={config} />
          </p>
          {config.operator && (
            <p>
              {config.operator.postalAddress}
              <br />
              {config.operator.telephone}
            </p>
          )}
          <h2>This website</h2>
          <p>
            The site does not set advertising or analytics cookies, load
            advertising pixels, or send answers to an analytics service. Opening
            a worked example does not submit an answer. The hosting service can
            receive an IP address, requested URL, and browser information to
            deliver pages and protect the service. Links to the AMP app and
            external program websites take you to separate services.
          </p>
          <h2>Free placement</h2>
          <p>
            Placement does not require a parent account or a learner’s name. The
            app stores the supplied birth year, a derived starting-level
            estimate, a random identifier stored in the browser, generated
            problems, and answer history to estimate levels and resume the
            session. Random identifiers and activity records can be personal
            information even without a name. Unclaimed placement sessions expire
            after {TRIAL_DAYS} days and are removed by the retention process. A
            parent may save the placement into their family account; it then
            follows the family’s learning-data policy.
          </p>
          {config.privacy ? (
            <p>{config.privacy.placementBasis}</p>
          ) : (
            <p className="notice">
              Counsel review must establish the legal basis for collecting birth
              year, persistent identifiers, and answer history during
              account-free placement, including use by children under 13. Family
              enrollment consent does not authorize that earlier collection.
              This draft does not establish an exception or permission to
              collect it.
            </p>
          )}
          <h2>Trial milestones</h2>
          <p>
            AMP records its own trial milestones to understand how families move
            from starting practice to a purchase. Each record contains a random
            identifier, an event type, and a timestamp. The events are starting
            a trial, completing placement, completing the teaching sequence,
            opening the plan screen, and purchasing access. These are individual
            event records, not summarized totals.
          </p>
          <p>
            The trial record links that identifier to a learner while the trial
            record exists. A trial saved into a family account keeps this link
            until the learner is deleted. Removing an expired, unclaimed trial
            during cleanup, or deleting its learner, removes that link. The
            event records themselves remain. The {TRIAL_DAYS}-day trial cleanup
            does not delete them, and the service does not automatically expire
            them.
          </p>
          <p className="notice">
            The retention review must establish a purpose-limited deletion
            schedule for these event records and confirm the legal basis for
            collecting them, including during placement by children under 13.
            Removing a learner link is not the same as deleting the records.
          </p>
          <h2>Parent accounts and learning records</h2>
          <p>
            The account service processes a parent’s email, sign-in information,
            and sessions. Optional linked sign-in providers receive the
            information needed for their sign-in process. AMP stores learner
            nicknames, problems, answers, and derived skill estimates to provide
            practice, feedback, and family progress. Consent records establish
            the permission that applies to collection.
          </p>
          <h2>Payments and support</h2>
          <p>
            The payment processor handles card and billing details. AMP keeps
            order, license, refund, and receipt records. Payment references
            connect a purchase with access; they are not a substitute for
            parental consent. If you contact support, we use your message to
            address the request. Do not send passwords, full card details, or
            unnecessary information about a child.
          </p>
          <h2>Children under 13 and COPPA</h2>
          <p>
            The Children’s Online Privacy Protection Act (COPPA) regulates
            collection of personal information from children under 13. The
            family enrollment process provides a direct notice to the parent and
            requires the applicable verified consent before a family learner
            profile is created. An ordinary login, payment, or checkbox alone
            does not establish that consent. The free placement flow is separate
            from family enrollment; the absence of an account does not make its
            activity records anonymous.
          </p>
          <p>
            Parents can review and export learning records, withdraw consent,
            and request learning-data deletion from the family’s privacy
            controls. Withdrawal stops further consent-dependent learning.
            Contact us for help reviewing or deleting account information.
            Learning-data deletion does not necessarily erase purchase records
            that must be retained for accounting, refunds, or legal obligations.
          </p>
          <h2>Providers, retention, and safeguards</h2>
          <p>
            Data is used to provide the service, secure accounts, process
            purchases, and respond to requests. This site contains no
            advertising integration or sale-of-data mechanism. Hosting,
            database, email, authentication, and payment providers may process
            data to perform their roles.
          </p>
          {config.privacy ? (
            <>
              <p>{config.privacy.retention}</p>
              <ul>
                {config.privacy.providers.map((p) => (
                  <li key={p.name}>
                    <strong>{p.name}:</strong> {p.purpose} {p.retention}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="notice">
              Before launch, the final notice must identify the deployed
              providers, their purposes and retention, and the actual schedules
              for account, learning, consent, support, log, and backup data.
              This draft does not certify deployment practices.
            </p>
          )}
          <h2>Changes and questions</h2>
          <p>
            Material changes to children’s data practices require renewed notice
            and consent where applicable. Questions or privacy requests:{" "}
            <Contact config={config} />
          </p>
          <p className="fine">
            For the legal requirements, see the{" "}
            <a href="https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business">
              FTC’s COPPA guidance
            </a>
            . This notice does not assert certification by the FTC or a
            safe-harbor program.
          </p>
        </>
      )}
      {page === "refund" && (
        <>
          <p>
            Request a full refund within 30 days of a payment for AMP access.
            Tell us the parent account email and the order or receipt reference.
            You do not need to explain why.
          </p>
          <h2>How to request it</h2>
          <p>
            Contact <Contact config={config} />. Do not include card numbers or
            a child’s learning records. We will confirm the request and process
            an eligible refund to the original payment method. Bank and
            payment-provider processing times vary.
          </p>
          <h2>Access and renewal</h2>
          <p>
            Refunded access ends when the refund is processed. Cancel any
            renewing plan through the parent billing portal to prevent another
            charge; requesting a refund and cancelling renewal are distinct
            actions. If you cannot access the portal, tell support to cancel
            renewal as part of your request.
          </p>
          <h2>Education funds</h2>
          <p>
            A refund for a program-funded purchase goes back through the
            original payment route, not to a different personal account. If you
            paid by card and received reimbursement, inform your program of the
            refund and follow its reconciliation rules. Program restrictions and
            applicable consumer rights continue to apply.
          </p>
        </>
      )}
      {page === "accessibility" && (
        <>
          <p>
            We design the Corpora site for keyboard access, readable contrast,
            small screens, text zoom, and reduced motion. Figures have text
            descriptions; mathematical notation includes MathML for compatible
            assistive technology.
          </p>
          <h2>What to expect</h2>
          <p>
            Use Tab to move between links and controls, Enter or Space to open
            worked solutions, and the skip link to reach the main content. Pages
            reflow on narrow screens. Printable examples have a dedicated print
            layout and a text-based solution key.
          </p>
          <h2>Scope and limitations</h2>
          <p>
            Our target is{" "}
            <a href="https://www.w3.org/TR/WCAG22/">WCAG 2.2 Level AA</a>.
            Automated checks cover only part of accessibility. This is not a
            conformance certification. Mathematical figures, screen-reader
            pronunciation, printable PDFs, the AMP app, and third-party payment
            or sign-in pages may need different accommodations.
          </p>
          <h2>Report a barrier</h2>
          <p>
            Contact <Contact config={config} />. Include the page, the action
            you were trying to complete, and any browser or assistive technology
            details you want to share. Do not include private learner
            information. We will work with you on an accessible way to obtain
            the material or complete the task.
          </p>
        </>
      )}
    </div>
  );
}
