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

The build extracts the `:root` token block from `amp/src/web/ui/tokens.css` and copies local KaTeX assets. `coverage.json` and the coverage section are computed from the AMP curriculum and content audit. A mapped or cataloged skill does not imply full standards coverage, reviewed efficacy, or a published course. CI rebuilds the site when `corpora-site/` or its imported AMP source and dependency files change and reports through the existing `ci-gate` aggregate.

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
| `funding`           | State guidance: `state`, `program`, `kind` (`marketplace`/`reimbursement`/`tax-benefit`/`school-purchase`/`information`), `instructions`, official `sourceUrl`, and `reviewedUntil` (ISO date)  |

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

The refund policy offers a full refund within 30 days for personal payments, including purchases later submitted for reimbursement. Direct program and marketplace payments follow the administrator’s disclosed rules where they differ. Refunds return through the original payment route; purchase-time promises and applicable legal rights are preserved. The privacy draft distinguishes the static site, free placement identifiers and activity, parent authentication, consented learner records, commerce, and support. Trial milestone records contain a random identifier, event type and timestamp. Trial records and milestone events are scheduled for deletion 90 days after creation, including saved trials. Unsaved placement sessions have a separate 14-day expiry; deleting the placement link does not itself delete the event rows. Learning records saved to an account follow the learning-data schedule. The page imports the implemented trial retention period to keep its description aligned with the service. Privacy claims must be checked against the deployed providers, logs, retention jobs, and support operations before publication. A boolean acknowledgement cannot establish compliance or authorize a deployment.

Primary references used when drafting: [FTC COPPA compliance plan](https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business), [FTC amended COPPA rule](https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa), and [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/). AMP's implementation boundary is documented in `amp/docs/parent-consent.md`; account-free placement and consented enrollment are distinct flows.

This package supplies a reviewable site and build artifact. It does not configure DNS, publish a public domain, create merchant products, enable child-data collection, or establish program approval.

## Individual funding guides

A funding entry may include a `page` object to publish `/esa/<slug>/`. Entries without a page appear only in the funding index. Each page requires:

- `slug`: a unique lowercase path segment containing letters, numbers and single hyphens.
- `summary`: a description of at most 240 characters, also used in search metadata.
- `eligibility`, `ampStatus`: who can use the program and the verified status of AMP purchases. Program existence does not establish AMP eligibility.
- `steps`, `receiptChecklist`: ordered purchase/submission steps and documents to retain.
- `sources`: official references, each with `title` and HTTPS `url`.
- `reviewedOn`: the date the sources were checked, no later than `reviewedUntil` or the build date.
- Optional `restrictions` and `questions` (each with `question` and `answer`).

Use program-specific facts and distinguish tax benefits from reimbursement or direct payment. Do not publish a purchase recommendation while eligibility is unresolved. Omit unsupported outcomes and approval claims. All text is rendered as plain text, not HTML. Program pages include canonical URLs, descriptive titles, WebPage and breadcrumb structured data, and sitemap entries. This makes the information accessible to readers and crawlers; it does not guarantee indexing or search placement.

The funding directory groups program cards by state and displays the number of published parent guides separately from AMP purchase-status text. Inclusion in the directory does not imply vendor approval. Each card repeats its guide’s purchase status so readers see unresolved eligibility before following a purchase route. State navigation and program links work without JavaScript.
