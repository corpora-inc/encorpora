import React from "./react.js";
import { TRIAL_DAYS } from "../../amp/src/server/trials.js";
import { RETENTION } from "../../amp/src/privacy/retention-periods.js";
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
          <p>
            When your subscription expires, app access and new downloads end. You
            may continue using and printing worksheets you downloaded during that
            subscription for the licensed learner’s personal education. The
            restrictions on resale and public redistribution continue to apply.
          </p>
          <h2>Price, term, and renewal</h2>
          <p>
            The checkout shows the price, currency, taxes, access period, and
            whether the selected plan renews. An automatically renewing
            subscription continues until cancelled. Manage cancellation in the
            parent account’s billing portal. Cancelling stops future renewal; a
            refund is a separate request under the{" "}
            <a href="/legal/refund/">refund policy</a>. Education-fund purchases
            follow the approved program route and stated term. Program-funded
            renewals are not automatic unless the program expressly permits the
            process and the renewal has been authorized.
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
            The site does not load advertising pixels or send learning answers
            to advertising platforms. On the
            Arkansas and Arizona funding pages, our own server counts page views, trial-link
            clicks and invoice-email-link clicks by day and fixed campaign
            labels. These counts contain no visitor identifier, name, email,
            learning answer, or full page URL. An invoice-link click does not
            establish an invoice request or purchase. We honor browser Global
            Privacy Control and Do Not Track signals for this measurement.
            Campaign labels may accompany the trial link; the app's separate
            trial measurement is described below. Opening
            a worked example does not submit an answer. The hosting service can
            receive an IP address, requested URL, and browser information to
            deliver pages and protect the service. Links to the AMP app and
            external program websites take you to separate services.
          </p>
          <h2>Ad clicks and purchases</h2>
          <p>
            When you follow an ad to the AMP overview or an Arkansas or Arizona funding page, our server may
            retain its Google or Meta click identifier, existing Meta browser
            identifiers, the observation time and fixed campaign labels for up
            to 90 days. A secure, host-only browser cookie contains a random
            reference, not the ad identifiers. It lets AMP associate the visit
            with the signed-in parent’s invoice or checkout without adding a
            tracking step. These records are separate from learner profiles,
            assessment answers and progress. Ad identifiers are removed from
            the page’s address before links are shared.
          </p>
          <p>
            Global Privacy Control and Do Not Track prevent this collection
            and clear the browser reference. Identified purchase attribution
            appears in the parent’s data export. Withdrawing a provider’s
            purchase-sharing preference deletes that provider’s associated
            click evidence; learning-consent withdrawal and learning-data
            deletion remove both providers’ associated evidence. Unassociated
            visits expire after at most 90 days. Collection does not itself
            send a purchase or identifiers to Google or Meta; external sharing
            requires the separate applicable permission described below.
          </p>
          <h2>Education-fund purchase documents</h2>
          <p>
            When a funding program requires a student name on an invoice, the
            parent supplies that name for the purchase document. It is stored
            with the funding request, included in the parent’s export, and
            retained with verified financial transactions. It does not change
            the learner’s profile or enter campaign reports. Unconverted
            requests are removed under the request-retention rules; linked
            invoices follow financial-record retention. The parent submits the
            invoice through the program’s payment service.
          </p>
          <h2>Education-fund purchase measurement</h2>
          <p>
            When campaign labels accompany an Arkansas or Arizona funding purchase request,
            we retain the fixed campaign, source, medium and, when supplied,
            an allowlisted ad creative label with that request
            and count verified order, payment and refund transitions in daily
            totals. These totals contain no parent, learner or order identifier.
            Unconverted requests expire; linked request labels follow the
            financial-record retention period and appear in the parent’s family
            export. We do not send these records to an advertising platform.
            Global Privacy Control and Do Not Track prevent capturing new
            campaign labels with a request.
          </p>
          <p>
            To resume an Arkansas purchase after parent-consent emails, AMP
            saves a pending purchase in this browser with a seven-day expiration,
            scoped to the signed-in parent account. It contains permitted
            campaign labels and an expiration time, not consent tokens or
            learner details. Preparing a quote or leaving that consent flow
            clears it. Privacy signals remove its campaign labels. This
            continuation works across tabs on the same device; it is not sent
            to an advertising platform.
          </p>
          <h2>Optional adult purchase sharing</h2>
          <p>
            In AMP’s Family privacy controls, an adult with a confirmed account
            email can independently allow Google or Meta purchase sharing. For Google, with that
            permission, AMP may share an encoded version of the adult’s email,
            a random purchase reference, purchase date, amount and currency.
            When available, this includes the saved Google ad click identifier.
            Google can match the click identifier and encoded email with its records; it is not
            anonymous. Learner names, ages, answers, lessons and progress are
            excluded. AMP requests measurement without ad personalization.
          </p>
          <p>
            For Meta (Facebook and Instagram), the separate permission covers an
            encoded version of the adult’s email, a random purchase reference,
            purchase date, amount and currency. An eligible website purchase
            also includes its purchase-page address and the browser’s user agent.
            When available, this includes saved Meta ad click and browser identifiers.
            Meta can match these identifiers and the email with its records and use this information for
            ad measurement, ad delivery and audience creation. Encoding does not
            make it anonymous. Learner names, ages, answers, lessons and progress
            are excluded.
          </p>
          <p>
            Each optional permission lasts one year and does not affect pricing,
            purchasing or learning access. Each can be withdrawn independently.
            Withdrawal stops future sharing; it does not recall information
            already received by the provider. Learning-data deletion,
            learning-consent withdrawal, and Global Privacy Control or Do Not
            Track received on an authenticated AMP request withdraw both
            preferences. AMP retains permission evidence for its duration and up to
            90 days after withdrawal or expiry. A minimal opt-out setting stays
            until you change it, so expiry of that evidence cannot resume
            collection. The family export includes these settings and
            preferences without their email binding digests. Local
            purchase-measurement records are retained for up to 90 days after
            the purchase and included in the family export. Withdrawal cancels
            unsent preparations. Providers handle received information under
            their own privacy policies:{" "}
            <a href="https://policies.google.com/privacy">Google</a> and{" "}
            <a href="https://www.facebook.com/privacy/policy/">Meta</a>.
          </p>
          <h2>Free practice</h2>
          <p>
            Free practice, a short placement followed by adaptive practice up to
            the free allowance, does not require a parent account or a learner’s
            name. The app stores the supplied birth year, a derived
            starting-level estimate, a random identifier stored in the browser,
            generated problems, answer history, and whether a hint or lesson was
            opened, to estimate levels, choose the next problem and resume the
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
            a trial, completing placement, opening the plan screen, and
            purchasing access. These are individual
            event records, not summarized totals.
          </p>
          <p>
            The trial record links that identifier to a learner while the record
            exists. Trial records and milestone events are scheduled for
            deletion {RETENTION.trialRecordDays} days after creation, including
            trials saved into a family account. Deleting a learner also removes
            its trial link. The shorter {TRIAL_DAYS}-day cleanup for unsaved
            placements does not itself delete milestone events; they follow the
            separate {RETENTION.trialRecordDays}-day schedule. Saved learning
            records follow the learning-data retention policy below.
          </p>
          <p>
            Removing a learner link is not the same as deleting an event record.
            Random identifiers and event histories are included in the privacy
            review even when they do not contain a learner’s name.
          </p>
          <h2>First-party practice and purchase measurement</h2>
          <p>
            AMP also measures practice and purchase steps using a random browser
            visitor identifier, fixed event types and counts, campaign source,
            referrer and device categories, grade band and coarse age band.
            Event dates are whole UTC days. Events contain no account, learner,
            trial, email, checkout or invoice identifiers or free-text answers.
            These records stay in AMP; they are not advertising-platform events.
            A purchase date can still identify a buyer when compared with billing
            records on a day with few purchases.
          </p>
          <p>
            Events are deleted after {RETENTION.funnelEventDays} days; visitor
            records expire {RETENTION.funnelEventDays} days after their last
            event. The checkout link to a visitor is erased when the purchase is
            recorded or after {RETENTION.funnelEventDays} days. Converted visits
            leave monthly aggregate counts without visitor identifiers.
          </p>
          <h2>Problem reports</h2>
          <p>
            “Report a problem” records selected reasons, the learner reference,
            the problem and recorded answer and outcome, software version,
            device type and viewport size so we can correct errors. Anonymous
            learners and children under 13 choose fixed reasons only. A learner
            aged 13 or older in a consented family account may add a note of up
            to 280 characters. Reports stay in AMP and appear in parent exports.
          </p>
          <p>
            Notes are erased after {RETENTION.problemFlagNoteDays} days and
            reports are deleted after {RETENTION.problemFlagDays} days. Deleting
            learning data removes the learner link and erases notes sooner.
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
          <h2>Parent feedback</h2>
          <p>
            Parents and adult learners can voluntarily send written product
            feedback. We store the message, purchase-flow section and selected
            funding program for {RETENTION.parentFeedbackDays} days to improve
            AMP. We do not attach account, learner, payment or advertising
            identifiers, or send these messages to advertising platforms. Please
            leave out names and other private information. For a reply or help
            with your account, contact <Contact config={config} />.
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
            Pay directly with your own money and request a full refund within
            30 days of payment for AMP access. You do not need to explain why.
            Purchases paid through an education program or marketplace may have
            different rules, explained below.
          </p>
          <h2>How to request it</h2>
          <p>
            Contact <Contact config={config} /> with the parent account email and
            order or receipt reference. Do not include card numbers or a child’s
            learning records. We will confirm the request and process
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
          <h2>Personal payments and reimbursement</h2>
          <p>
            Our 30-day full-refund policy applies when you pay personally,
            including when you later request or receive reimbursement. Tell us
            and your program about the refund, correct any pending claim, and
            follow the program’s instructions to return reimbursed funds. Do not
            retain reimbursement for a refunded purchase.
          </p>
          <h2>Arkansas EFA DirectPay purchases</h2>
          <p>
            For Arkansas EFA purchases paid through ClassWallet DirectPay,
            request a full refund within 30 days of payment; no reason is
            required. The full amount returns through the program to the
            original EFA funding source, not to you personally. We follow
            ClassWallet and Arkansas refund instructions. Required program
            refunds and applicable consumer rights continue to apply;
            processing times vary.
          </p>
          <h2>Program and marketplace payments</h2>
          <p>
            For purchases paid directly through an education program or
            marketplace, the administrator’s refund and cancellation rules
            disclosed for that purchase take precedence over our 30-day policy
            where they differ. A change-of-mind refund may not be available.
            Check those rules before ordering. Contact us for help with access
            or delivery problems and any required refund authorization.
          </p>
          <p>
            Approved refunds return through the original program payment route
            to the original funding source, never to a different personal
            account, cash, or unrelated credit. Administrator approval and
            processing times may apply.
          </p>
          <h2>Your purchase terms and rights</h2>
          <p>
            We honor the refund terms promised when you purchased. Later policy
            changes do not reduce those promises. Nothing in this policy limits
            your rights or remedies under applicable law.
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
