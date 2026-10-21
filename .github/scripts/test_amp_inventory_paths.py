from amp_inventory_paths import requires_inventory


def test_receipt_and_application_changes_do_not_run_inventory():
    assert not requires_inventory([
        'amp/src/billing/evidence/pdf.ts',
        'amp/tests/payment-evidence.test.ts',
        'amp/docs/billing.md',
    ])
    assert not requires_inventory(['amp/src/server/auth.ts'])
    assert not requires_inventory(['amp/src/web/features/family/Family.tsx'])


def test_math_and_unknown_inputs_run_inventory():
    for path in (
        'amp/src/math/engine.ts', 'amp/src/content/lessons.ts',
        'amp/src/curriculum/catalog.ts', 'amp/src/books/catalog.ts',
        'amp/src/publishing/book.tsx', 'amp/src/web/FractionFigure.tsx',
        'amp/scripts/fraction_math_oracle.py', 'amp/scripts/export-math-cases.ts',
        'amp/tests/independent-review.test.ts', 'amp/books/book.json',
        'amp/package.json', 'amp/package-lock.json', 'amp/tsconfig.json',
        'amp/src/new-shared-area/value.ts', '.github/workflows/ci.yml',
        '.github/scripts/amp_inventory_paths.py',
    ):
        assert requires_inventory([path]), path


def test_mixed_changes_cannot_hide_inventory_input():
    assert requires_inventory(['amp/src/billing/evidence/pdf.ts', 'amp/src/math/engine.ts'])
    assert not requires_inventory(['corpora-site/src/legal.tsx'])
