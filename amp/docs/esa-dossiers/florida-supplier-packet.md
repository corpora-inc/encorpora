# Florida supplier product-review packet

AMP is a self-paced mathematics product from Corpora. The MyScholarShop candidate is one student's software access; individual original PDF titles are separate candidates. This packet supports a supplier/product review for FTC-PEP. It is an unsent draft, not a supplier selection, product approval, funded offer or marketplace import file.

The proposed software term is twelve months without an automatic funded renewal. Its category, activation date and award-year treatment require an administrator decision. PDF download, personal-print and post-term retention rights require separate decisions. FES-UA eligibility must be reviewed independently. Selected mathematics skills and original books do not constitute a complete K–12 course or a test-score guarantee.

## Generate the review copy

From `amp/`, first publish every registered title into a new artifact directory using the existing publisher. For example:

```sh
npx tsx scripts/publish-book.ts --book fraction-field-guide --output /tmp/amp-supplier-publications/fraction-field-guide
npx tsx scripts/publish-book.ts --book equal-groups-workshop --output /tmp/amp-supplier-publications/equal-groups-workshop
npx tsx scripts/publish-book.ts --book balance-and-change --output /tmp/amp-supplier-publications/balance-and-change
npx tsx scripts/supplier-packet.ts --publications /tmp/amp-supplier-publications --output /tmp/amp-supplier-packet
```

Use the registered catalog in `src/books/catalog.ts` for the complete title list; the builder requires a current-source publication for every registered title. Additional titles require publication before packet generation. Preserve historical edition artifacts instead of replacing their evidence. A PDF with older publisher hashes can be a valid released edition; this packet's stronger requirement establishes a reproducible current-source sample set.

The CLI requires Node dependencies, Playwright Chromium, `pdfinfo` and `pdftotext`. It performs no network requests or submissions. Its browser blocks remote requests. Input publications must match the registered edition, complete current source manifest, generated HTML and PDF hash. Output belongs in a separate directory. The HTML is a fixed Letter print preview, not a responsive product site.

Outputs:

- `supplier-product-review.pdf` and `index.html`: standalone candidate-facing brief, catalog and actual lesson previews.
- `catalog.json` and `catalog.csv`: neutral unpriced candidate catalog, never a Mirakl upload contract.
- `program-evidence.json`: sourced Florida research and unresolved decisions.
- `transaction-document-templates.json` and `operations-draft.md`: blank unissued document fields and support/fulfillment/refund decisions.
- `readiness.json`: internal missing-evidence report; exclude this from the candidate-facing brief as appropriate.
- `validation.json`, page screenshots and `samples/`: source/content/PDF/sample hashes and automated layout evidence.

The sample images reproduce original source pages. They are not independently selectable PDF text; full-size source PDFs supply selectable text. Automated geometry and PDF checks do not replace independent mathematical, accessibility or visual review. The manifest identifies the source commit and exact publication source files; uncommitted source changes require a fresh final build after commit.

## Primary evidence and decision boundary

The [Step Up vendor entry](https://www.sufs.org/schools-and-providers/vendors/) links the [supplier interest form](https://survey.alchemer.com/s3/7190874/MyScholarShop-Supplier-Interest-Form). Its public opening page describes selection, seller setup, private business/tax/bank records, catalog maintenance and order testing. It names Mirakl; the vendor page also carries Ariba instructions. Use the actual supplier invitation to resolve the platform and contract. Do not infer an API or settlement adapter from either brand name.

The [FTC-PEP purchasing guide](https://www.stepupforstudents.org/handbook-web/pep-purchasing-guide/) supports educational-software and digital-material categories. That category evidence does not establish AMP approval or the proposed annual term. The [family handbook](https://www.stepupforstudents.org/handbook-web/pep-family-handbook/) describes transaction documentation; supplier-specific fulfillment, credit and settlement obligations need the issued agreement. Evidence was checked October 17, 2026. A 90-day refresh threshold is an internal review policy, not a program rule.

## Internal evidence index

Without `--evidence PRIVATE_JSON`, generation produces an explicitly incomplete readiness report. No placeholder satisfies a requirement. A restricted JSON index may use the schema in `src/funding/supplier-packet/evidence.ts`; pass only opaque record/reviewer references, dates and exact catalog hashes. Never pass tax identifiers, bank details, signatures, student names or document contents. Restricted records belong in a controlled business system, not this public repository.

Every accepted record binds to the exact catalog SHA-256 and canonical proposal digest, including program, candidate, public URLs, price and term. Preparation requires legal entity/signatory, tax/bank readiness, deployment, privacy/consent, accessibility, support, pricing/tax, license, fulfillment and refund-policy evidence. Public HTTPS product/demo/privacy/terms/support URLs and an accepted USD price are separate required inputs. An automated check verifies the index's structure, scope and freshness; it cannot authenticate the underlying evidence or certify compliance.

`preparationEvidenceComplete` means the index contains the required reviewed preparation records. `listingEvidenceComplete` adds supplier selection, category, annual term, catalog, contract, order-test and settlement records for **AMP-PRACTICE-STUDENT in FTC-PEP only**. The generated draft always reports `submissionReady: false`: evidence completeness does not make an unpriced candidate document ready to submit. Neither status submits an application, enables an offer or approves the separately listed PDFs. Each PDF or bundle needs its own product decision and commercial evidence before sale. Generated candidate prose and catalogs deliberately stay unpriced and unapproved; publishing an accepted offer is a separate operation.

## Documents and operational handoff

Use [transaction and support drafts](florida-operations-draft.md) to prepare actual operational decisions. The deployed product, reviewer demo, parent-consent method, support service and merchant terms require dated verification. Repository functionality and local samples do not establish deployment or staffing. Keep funded offers disabled while any required runtime approval evidence is absent.
