# Corpora website

The Corpora site introduces AMP Mathematics with actual problem figures, worked solutions, a lesson excerpt, and a printable sample. It includes product coverage, education-fund guidance, parent questions, support, and draft Terms, Privacy, Refund, and Accessibility pages.

The output is static HTML and local assets. It needs no running AMP server or database to build or preview. There is no client framework bundle, analytics, ad integration, or external font request. A small first-party script opens the browser print dialog on the printable page; native disclosure controls work without JavaScript.

## Build and preview

Use Node 22 and install both packages from the repository root:

```sh
npm ci --prefix amp
npm ci --prefix corpora-site
cd corpora-site
npm test
npm run tsc
npm run build
npm run preview
```

The preview server listens only on loopback and chooses an available port. Build output is `dist/`. Deploy that directory through the project's approved hosting workflow with directory-index routing. The preview server is a development utility, not a production server. Hosting credentials, domain configuration, and operational instructions belong in the private infrastructure repository.

## Product sources

`src/product.tsx` imports AMP's deterministic problem generator, lesson content, figure components, and mathematical typesetting. These execute at build time. Samples deliberately include their solutions; they are public worked examples, not live assessment payloads. No grading engine or active assessment secrets are shipped as browser code.

The build extracts the `:root` token block from `amp/src/web/theme.css` and copies local KaTeX assets. `coverage.json` and the coverage section are computed from the AMP curriculum and content audit. A mapped or cataloged skill does not imply full standards coverage, reviewed efficacy, or a published course. CI rebuilds the site when `corpora-site/` or its imported AMP source and dependency files change and reports through the existing `ci-gate` aggregate.

## Public presentation configuration

Without configuration, the build produces a non-indexable preview with legal drafts, no merchant prices, and no claim that a funding route is approved. The Try free link opens a local availability page. Set `CORPORA_SITE_CONFIG` to an external JSON file to supply the public presentation subset. Never commit actual commercial amounts, account/resource identifiers, credentials, or operational files.

The strict schema in `src/config.ts` rejects unknown keys. Its fields are:

| Field               | Meaning                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`              | `preview` (default) or `production`                                                                                                               |
| `siteUrl`, `appUrl` | HTTPS site origin and AMP entry URL; Try free opens the app, where the visitor selects its account-free practice flow                             |
| `supportEmail`      | Published support and privacy contact                                                                                                             |
| `operator`          | Public legal name, postal address, telephone                                                                                                      |
| `legalReviewed`     | Operator acknowledgement that these drafts were reviewed against actual practices; not a compliance certification                                 |
| `privacy`           | Reviewed placement collection basis (`placementBasis`), concrete retention description, and provider list (`name`, `purpose`, `retention`)        |
| `plans`             | At most one annual and one monthly entry, each with `interval` (`year`/`month`), `amountMinor`, two-decimal ISO `currency`, and explicit `renews` |
| `funding`           | State guidance: `state`, `program`, `kind` (`marketplace`/`reimbursement`), `instructions`, official `sourceUrl`, and `reviewedUntil` (ISO date)  |

Production mode requires the two URLs, operator contacts, privacy details, and the legal acknowledgement. The configured prices are presentation data, not checkout authority: keep them synchronized with the merchant's active offer. AMP checkout is authoritative. Missing prices send visitors to AMP to review plans. Guidance with an expired review date fails the build. Schedule rebuilds before review expiry; static output does not update itself. An empty funding list states that guidance is unavailable and makes no eligibility claim.

No analytics or advertising capability is enabled by configuration. Adding either requires implementation, data-flow review, and a matching privacy notice. Do not inject scripts around the built site and assume its privacy statement remains accurate.

## Validation

```sh
npx playwright install chromium
npm run test:ui
```

The browser suite starts its own ephemeral loopback server. It checks every page at 320, 390, and 1280 pixels for overflow, automated accessibility violations, broken internal links, and JavaScript errors. It checks keyboard disclosure and skip-link access, produces screenshots and a printable PDF, and records mobile Lighthouse reports for the home and AMP pages. Lighthouse scores are advisory because shared-runner timing varies; deterministic layout, accessibility, and link checks are required. The product target is at least 95 in each Lighthouse category. Lighthouse uses a separate production build with synthetic configuration; this checks indexing without publishing real merchant data. Actual production indexing needs separate deployment verification. Reports are written to ignored `artifacts/`.

Automated checks are not an accessibility certification. Review screen-reader math, browser zoom, print output, and the deployed app separately.

## Legal drafts and launch boundary

The draft refund policy offers a full refund within 30 days of payment to the original payment route. The privacy draft distinguishes the static site, free placement identifiers and activity, parent authentication, consented learner records, commerce, and support. Trial milestone records contain a random identifier, event type and timestamp. The link to a learner is removed when an expired, unclaimed trial is purged or the learner is deleted. A trial saved into a family account keeps the link until learner deletion. The event rows persist without an automatic deletion period. The final deployment review must establish their collection basis and a purpose-limited retention schedule. Privacy claims must be checked against the deployed providers, logs, retention jobs, and support operations before publication. A boolean acknowledgement cannot establish compliance or authorize a deployment.

Primary references used when drafting: [FTC COPPA compliance plan](https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business), [FTC amended COPPA rule](https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa), and [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/). AMP's implementation boundary is documented in `amp/docs/parent-consent.md`; account-free placement and consented enrollment are distinct flows.

This package supplies a reviewable site and build artifact. It does not configure DNS, publish a public domain, create merchant products, enable child-data collection, or establish program approval.
