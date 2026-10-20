# External configuration as code

AMP depends on configuration that lives outside this repository: a Stripe product, and sign-in apps at Google, Microsoft, GitHub and Apple. Its intended state is declared here, under `amp/infra/`, and changed by pull request. Where a provider has an API, a tool plans the difference against the live state and applies only that difference. Where it has none, the declaration is the checklist, and a drift check catches the common mistakes.

This repository is public. It holds names, public identifiers, URLs and the names of settings, never their secret values, account identifiers or login details. Credentials stay in each environment's secret; the tools read them from the environment and never print them.

## What is declared where

| Declaration | Contents |
|---|---|
| [`src/brand.json`](../src/brand.json) | The product name, expansion, public description, and the Stripe checkout name, description and statement descriptor. |
| [`infra/environments.ts`](../infra/environments.ts) | Each environment's origin, Stripe mode, and the ids of its Stripe product and prices. |
| [`infra/stripe.ts`](../infra/stripe.ts) | The Stripe product's managed fields, and the price set it sells. |

## Stripe catalog

Each environment has one Stripe product with an annual and a monthly price: stage in test mode, prod in live mode. The tool manages the product's name, description, statement descriptor, tax code and the `managed_by` metadata key. It leaves other fields and metadata keys alone.

Prices are verified, never written. Plan and apply never create, edit, activate or archive a price, and never read or change a subscription or customer. If a price's amount, currency, interval or status differs from the declaration, the plan reports an error and apply stops before any write. Changing what AMP charges means a new Stripe price and a reviewed migration ([Stripe](stripe.md)), not an edit to `infra/stripe.ts`.

Before it reads the catalog, the tool checks that the environment is the one declared: `AMP_STRIPE_MODE` and the key's mode, the product and price ids and the amounts in the environment's settings, and the key's account against `AMP_STRIPE_ACCOUNT_ID`. Any mismatch is an error, and nothing is written.

```sh
npm run infra -- stripe desired               # the desired state; needs no credentials
npm run infra -- stripe plan --env stage      # the differences against the live product
npm run infra -- stripe apply --env stage     # plan, apply only the differences, read back
```

`plan` and `apply` read the `AMP_STRIPE_*` settings the API runs with, from the environment. Apply prints the plan first, applies the product changes in one update (with an idempotency key derived from the change), then reads the product back and fails unless the new plan is empty. Running it again changes nothing.

The environment's Stripe key needs **Products: write** in addition to the read permissions listed in [Stripe](stripe.md#merchant-configuration).

On a pull request, `npm test` validates the declarations without credentials (`tests/stripe-catalog.test.ts`): the text comes from the brand, the statement descriptor satisfies Stripe's rules, the prices are $499 a year and $49 a month, and the planner refuses every price mismatch.

The deploy pipeline runs `stripe apply` for each environment before it changes the release, from the API image being deployed, with that environment's settings. A failed apply stops that deploy before anything changes. A rollback of the release does not revert product text.
