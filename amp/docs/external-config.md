# External configuration as code

AMP depends on configuration that lives outside this repository: a Stripe product, and sign-in apps at Google, Microsoft, GitHub and Apple. Its intended state is declared here, under `amp/infra/`, and changed by pull request. Where a provider has an API, a tool plans the difference against the live state and applies only that difference. Where it has none, the declaration is the checklist, and a drift check catches the common mistakes.

This repository is public. It holds names, public identifiers, URLs and the names of settings, never their secret values, account identifiers or login details. Credentials stay in each environment's secret; the tools read them from the environment and never print them.

## What is declared where

| Declaration | Contents |
|---|---|
| [`src/brand.json`](../src/brand.json) | The product name, expansion, public description, and the Stripe checkout name, description and statement descriptor. |
| [`infra/environments.ts`](../infra/environments.ts) | Each environment's origin, Stripe mode, and the ids of its Stripe product and prices. |
| [`infra/stripe.ts`](../infra/stripe.ts) | The Stripe product's managed fields, and the price set it sells. |
| [`infra/auth-providers.ts`](../infra/auth-providers.ts) | Each sign-in app's intended state: names, origins, redirect URIs, scopes, claims. |
| [`infra/secrets.ts`](../infra/secrets.ts) | The settings each environment's secret must hold, by name only. |

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

## Settings check

`infra/secrets.ts` lists the settings each environment needs, in groups: server, mail, Stripe, live Stripe, and one group per sign-in provider. Values are never declared, read back or printed.

```sh
npm run infra -- env check --env prod
```

The check fails, naming the missing settings, when a declared group is incomplete or a sign-in provider is only partly configured. The API refuses to start in that state, and the check says so before the release changes. It also checks the public values that must match the declarations: `AMP_ACCOUNTS_URL` and `AMP_STRIPE_APP_ORIGIN` are the environment's origin, `AMP_STRIPE_MODE` is its declared mode, and `AMP_APPLE_CLIENT_ID` is the declared Services ID. A complete provider that is not declared for the environment is a warning.

To add a setting, declare it in `infra/secrets.ts` in the same pull request that makes the API read it. Then add the value to each environment's secret before that commit deploys.

## Sign-in providers

| Provider | Intended state | How it is applied |
|---|---|---|
| Microsoft | One registration for all environments: audience `AzureADandPersonalMicrosoftAccount`, access token version 2, three web redirect URIs, no implicit grant, ID token claims `email` and `xms_edov`, Graph delegated `openid`, `profile`, `email`, `offline_access`, `User.Read` | `entra plan` / `entra apply` through Microsoft Graph |
| Google | Consent screen, plus one web client per environment (the stage client also serves `http://localhost:4310`) | By hand in the Google Cloud console; drift check |
| GitHub | One OAuth App per environment (an app accepts one callback URL) | By hand in the organization's settings; no drift check |
| Apple | One Services ID, `inc.corpora.amp.web`, for both deployed environments (Apple requires HTTPS) | By hand in the Apple Developer portal; drift check |

`npm run infra -- providers desired` prints the full declaration: the checklist for a console with no API.

### Drift check

```sh
npm run infra -- providers check --env stage
```

For each configured provider, the check opens the authorize URL with each redirect URI the environment's app must accept, and reads the page the provider returns. It never signs in. A provider's own rejection page fails the check: Google's `redirect_uri_mismatch`, Microsoft's invalid `redirect_uri`, or Apple's refusal. A network failure or an unfamiliar page is reported as not checked, so an outage or a redesigned page never blocks a deploy. GitHub validates the callback only after sign-in, so it is skipped.

### Microsoft registration

```sh
npm run infra -- entra desired                        # offline
npm run infra -- entra plan --from manifest.json      # offline, against an export
npm run infra -- entra plan                           # live
npm run infra -- entra apply                          # live: plan, PATCH the differences, read back
```

The registration is found by `AMP_MICROSOFT_CLIENT_ID`, the client id the environments already use. The offline plan reads the portal's manifest export (**Entra admin center → App registrations → AMP → Manifest → Download**, Microsoft Graph format). Apply changes only the managed properties. It sets the access token version before the sign-in audience, because personal accounts require version 2, and it never reads or changes client secrets.

**One-time credential step (owner of the registration).** Live plan and apply need Microsoft Graph access as a user or service principal that owns the app:

1. Install the Azure CLI (`brew install azure-cli`).
2. Run `az login --allow-no-subscriptions` with the Microsoft account that owns the registration. Use `--tenant <directory id>` if the account has several directories.
3. Run, with the client id taken from an environment's settings:

   ```sh
   AMP_MICROSOFT_CLIENT_ID=<client id> npm run infra -- entra plan
   ```

   The tool takes its token from `az account get-access-token`. `AMP_GRAPH_TOKEN` overrides it, for example with a token for a service principal that has `Application.ReadWrite.OwnedBy` and is an owner of the app. To run it unattended, store that service principal's credentials as a deploy secret.

## In the deploy

The deploy pipeline (in the hosting repository) runs these steps for each environment from the API image it is about to deploy, with that environment's settings, before it changes the release:

1. `env check`: an incomplete group or a partial provider stops the deploy.
2. `stripe apply`: the plan is logged, then the differences are applied. A price mismatch stops the deploy before any write.
3. `providers check`: a provider rejecting a declared redirect URI stops the deploy, with the URI named.

A failure in any of these changes nothing in the cluster. Entra is applied by hand until Graph credentials exist for the pipeline.

## Manual steps that remain

- **Google, GitHub and Apple:** create or edit their apps by hand from `infra/auth-providers.ts`, then put the client values in the environment's secret.
- **Microsoft:** the one-time credential step above. After that, run `entra plan` and `entra apply`.
- **Stripe keys and prices:** creating a restricted key, and any change to what AMP charges, stay in the Stripe Dashboard. A price change is a new price and a reviewed migration.

## Public campaign counts

`AMP_CAMPAIGN_SITE_ORIGIN` is an optional HTTPS origin for the public marketing
site. Without it, `/api/v1/campaign-events` is not registered. Set the exact
marketing origin in the existing external environment configuration, run
`npm run infra -- env check --env <env>`, and deploy the API with migration
`0026-campaign-counts.sql` before publishing the campaign client. This setting
is not an authentication credential and must not include a path or wildcard.

The endpoint accepts only a fixed Arkansas campaign vocabulary. It writes daily
aggregate counts without browser, learner or account identifiers. CORS accepts
only the configured origin; requests omit credentials. Browser Global Privacy
Control and Do Not Track suppress collection and campaign-label forwarding.
Normal request handling still receives the connection address; measurement does
not write that address into the campaign table.

Use `npm run report:campaign -- 30` with the deployment's existing database
configuration to inspect the last 30 UTC days. The report rejects windows beyond
the existing funnel-event retention period, so older campaign counts cannot be
compared against deleted conversion events. Page views are page loads, not
unique people. An invoice-link click is not an invoice request, approved order
or sale. Existing AMP campaign-attributed trial milestones and server-verified
Stripe purchases are reported separately. Arkansas ESA order totals use only
funding requests whose retained operator offer identifies `ar-efa` and `AR`,
joined to imported ESA order states. These are program totals, not campaign
attribution. Email-only invoices and unlinked imports are excluded; a click
does not create a funding-request record. Approved, settled, issued and
refunded counts overlap and must not be added as sales. No cross-domain visitor identifier is sent,
so counts cannot establish an individual page-to-purchase journey. Reloads,
bots and browser/network blocking affect counts.

Permitted launch tags are `utm_campaign=ar-efa-launch`; source `facebook`,
`instagram`, `google`, `email` or `youtube`; and medium `paid-social`, `cpc`,
`email` or `organic-social`. Unrecognized labels are discarded. The static
client sends only state, program, campaign, source, medium and action, never
full URLs, arbitrary query parameters, answers, names, birth dates or emails.
