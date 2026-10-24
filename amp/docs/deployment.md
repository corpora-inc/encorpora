# Hosted deployment requirements

The hosted API requires PostgreSQL, a configured OIDC issuer, and a same-origin HTTPS reverse proxy for the browser application and `/api`. Development authentication must never be exposed publicly. Run migrations before starting a deployment; applied migrations have checksums and must not be edited.

## Database connection budget

`AMP_DATABASE_POOL_MAX` sets the maximum connections for each API or job process. It must be an integer of at least 2. When omitted, it defaults to 3 if `NODE_ENV=production` or `AMP_AUTH_MODE` is `accounts` or `oidc`; otherwise it defaults to 10 for local development. An explicit value overrides either default. Invalid values stop startup. Set it explicitly in hosted deployments, for example `AMP_DATABASE_POOL_MAX=3`.

The API shares one pool across learning, accounts, family exports, consent, billing, funding and payment evidence. A single API process configured with `3` therefore holds at most three database connections in total. Migrations, imports, consent delivery, billing workers and retention jobs each run with their own pool and read the same setting. They are additional processes: budget their connections alongside every API replica and rolling-deployment overlap. This setting is not a deployment-wide cap; enforce a database role connection limit as an additional boundary when sharing a database server.

## Identity and enrollment

### AMP accounts (`AMP_AUTH_MODE=accounts`)

Parent accounts are stored in AMP's own database: migration `0016-accounts.sql`, implemented with Better Auth (`src/server/accounts.ts`). They support email and password, passkeys, TOTP two-factor with backup codes, and Google, Apple, Microsoft and GitHub sign-in, with linked logins. Web sessions use an HttpOnly cookie. The session token also works as `Authorization: Bearer` for the API and native apps. An account id is `amp|<user id>`.

**Required settings**

- `AMP_ACCOUNTS_URL`: the public HTTPS origin. Loopback HTTP is allowed outside production.
- `AMP_ACCOUNTS_SECRET`: at least 32 random characters.

**Email.** `AMP_MAIL_RESEND_API_KEY` and `AMP_MAIL_FROM` send verification and reset emails.

- In production without mail, email and password sign-in is off.
- With mail, new password accounts must confirm their email before signing in.
- A new parent can instead create the account with a passkey and sign in at once; the email is confirmed later, before consent or purchase ([account security](account-security.md#passkey-sign-up)). Passkey sign-up needs mail (or development) and a domain origin: WebAuthn rejects IP-address origins, so use `localhost`, not `127.0.0.1`, to try it locally.
- In development, links are printed to the server log.

**Providers.** Each provider is enabled only when all of its settings are present. `/api/v1/auth-config` lists the enabled providers, and the sign-in screens show a button only for those.

- Google: `AMP_GOOGLE_CLIENT_ID` and `AMP_GOOGLE_CLIENT_SECRET`.
- GitHub: `AMP_GITHUB_CLIENT_ID` and `AMP_GITHUB_CLIENT_SECRET`.
- Microsoft: `AMP_MICROSOFT_CLIENT_ID` and `AMP_MICROSOFT_CLIENT_SECRET`, plus optional `AMP_MICROSOFT_TENANT_ID` (default `common`). The ID token must carry the optional claims `email` and `xms_edov`. Microsoft's `email` claim alone does not prove ownership, so AMP treats it as verified only when `xms_edov` is true or the address is listed in `verified_primary_email` or `verified_secondary_email`.
- Apple: `AMP_APPLE_CLIENT_ID` (the Services ID), `AMP_APPLE_TEAM_ID`, `AMP_APPLE_KEY_ID` and `AMP_APPLE_PRIVATE_KEY` (the .p8 PEM; `\n` escapes are accepted), plus optional `AMP_APPLE_BUNDLE_ID`. The Apple client secret is minted at startup and is valid for 150 days, so a deploy refreshes it.
- Register each provider's redirect URI as `<AMP_ACCOUNTS_URL>/api/auth/callback/<google|apple|microsoft|github>`. Each environment (production, stage, local) has its own URI; a GitHub OAuth App accepts one callback URL, so each environment needs its own GitHub app. Apple accepts only HTTPS return URLs, so Apple cannot be tested on a loopback origin.
- Apple's private relay addresses (`…@privaterelay.appleid.com`) receive mail only from senders registered for Sign in with Apple's email relay. Register the domain of `AMP_MAIL_FROM`.
- Apple sends the parent's name only on the first authorization. AMP stores it then and never requires it.
- The authorization request uses `state` and, where the provider supports it, PKCE (S256); Better Auth stores both server-side.

`AMP_ACCOUNTS_TRUSTED_ORIGINS` lists extra allowed origins, such as native app schemes.

**Linking.**

- A provider sign-in links to an existing parent with the same email only when the provider verified that email and the parent's own address is confirmed. No provider is trusted past its verification flag.
- A parent who removed that identity, or who protects password sign-in with an authenticator, links it from **Security** instead (migration `0023`).
- A signed-in parent may link a login that uses a different email.
- Each provider identity belongs to one account.

**New parents.** A provider sign-up creates the account with the provider's verified email and continues at `/start`, the same guided first run as an email or passkey sign-up: no consent, plan or learner step is skipped. A provider that has not verified the email cannot create an account.

**Rate limits.** Sign-in attempts are throttled per client. The server uses the client address that `AMP_TRUSTED_PROXIES` resolves and ignores forwarded headers from untrusted peers.

### External OIDC (`AMP_AUTH_MODE=oidc`)

Set `AMP_AUTH_MODE=oidc`, `AMP_DATABASE_URL`, `AMP_OIDC_ISSUER`, `AMP_OIDC_AUDIENCE`, and `AMP_OIDC_JWKS_URL`. The audience is the API resource, not the browser client. Signed access tokens require issuer, audience, subject, issued-at, and expiration. The default token profile requires `typ=at+jwt`; `AMP_OIDC_TOKEN_PROFILE=token-use-access` instead requires the signed `token_use=access` claim while retaining API audience validation. ID tokens are not API credentials.

Build the browser with `VITE_AMP_AUTHORITY`, `VITE_AMP_CLIENT_ID`, and the API-authorized `VITE_AMP_SCOPES`. Set `VITE_AMP_RESOURCE` when the issuer supports resource indicators. Register the exact HTTPS origin callback. The browser uses a public authorization-code/PKCE client; never embed a client secret.

Hosted mode refuses to start without `AMP_HOSTED_PILOT_READY=true`. This is an operator readiness acknowledgement, not consent or proof of legal compliance. Before setting it, configure support, privacy notices, the verified-parent enrollment procedure, and protected hosting. A valid access token alone does not authorize child profiles: every private learner route requires effective parent consent. Email-plus records also require the exact enabled, current reviewed policy and completed request evidence.

For a supervised pilot, an authorized operator records a completed parent verification using `npx tsx scripts/parent-consent.ts <private-record.json>`. The record contains `accountId`, `policyVersion`, `verificationMethod`, `evidenceReference`, and optional `withdraw`. Evidence references point to protected records; do not put actual identity documents or private evidence in this public repository. This command records the result of verification; it does not perform it. Learning writes acquire a shared account lock and check consent inside their database transaction. Withdrawal and learning-data deletion acquire the exclusive account lock, then any learner locks in a stable order. A learning write already holding the shared lock commits before withdrawal completes; after withdrawal commits, new learning writes fail. This ordering also applies to checkout creation and the operator consent command. Requests do not retain write permission merely because their access token was accepted earlier.

Authenticated parents can export family records, rename learners, withdraw consent, and delete learning data through [family controls](family-controls.md), including after consent withdrawal. Financially linked learners become anonymous billing-reference tombstones; deletion does not cancel subscriptions or erase transaction records. Billing management stays available. The parent workspace links Family → Privacy → Learning consent to the conditional [email-plus enrollment workflow](parent-consent.md). The API registers that workflow without installing policy. Optional `AMP_CONSENT_POLICY_FILE` and `AMP_CONSENT_SECRET_BASE64` supply private configuration; the secret must be canonical base64 encoding of exactly 32 random bytes. The opt-in Resend adapter requires explicit production sender, credential and tracking configuration; delivery is disabled by default. A separately scheduled bounded worker sends notices. Transport configuration does not install or approve the reviewed policy. Existing effective consent can be reviewed when new enrollment is unavailable. A reviewed method appropriate to the actual data practices, an operational verified delivery adapter, and acceptance testing are public-launch requirements; the operator command is not a substitute for performing verification.

## Access and commerce

Hosted practice and document downloads require an active student grant. Import reviewed commerce events using the admin-only command documented in [commerce](commerce.md). Client-supplied receipts, order submissions, and marketplace account creation cannot activate access. Live Stripe, Apple, Google, and ESA adapters require verified credentials, provider contracts, notification authentication, and sandbox acceptance before activation.

The preview catalog exposes its reference lessons for exploration. A commercial content-release policy and authenticated paid library must be established before replacing reference content with the paid curriculum.

## Releases

A merge to `main` that touches `amp/` becomes deployable after its focused CI checks pass. The automatic deploy poll is scheduled every five minutes; GitHub may delay scheduled runs. An authorized operator can dispatch deployment immediately after CI succeeds. The routine merge-to-live target is under eight minutes, including queue and scheduler delays. Scheduled polling alone cannot guarantee that target; measure a real release and report any remaining delay.

1. **Merge.** CI runs on the `main` commit.
2. **Green.** Some run of the `CI` workflow on that commit concluded `amp` and `ci-gate` successful, at their latest attempt. A failed, cancelled, skipped or missing check is not green. A run cancelled because a newer push superseded it is not green either. PRs and queue candidates run fast checks; broad affected regression checks run asynchronously on main, with failures fixed forward. Selected unit, database and build jobs run in parallel behind `amp`. Browser and inventory checks run separately in `AMP deep checks`; scheduled and manual deep runs cover the complete suites. Deep-check failures open a follow-up issue and do not hold the routine release.
3. **Deploy.** Every five minutes the hosting repository's deploy workflow (`deploy-corpora-amp`, outside this repository) deploys the newest green `main` commit touching `amp/` wherever it is not already live. When the newest commit is red or still running, it deploys the newest earlier green one, and its log says so: `newest X is red (amp failure); deploying last green Y`. The poll only moves forward: it never replaces a live release with an older commit, so a CI re-run cannot bring back a replaced release. A poll with nothing new succeeds quietly. Stage and production deploy in parallel. Each must pass smoke checks, including that `/api/v1/health` reports the commit just deployed, or it rolls back automatically.

The validation plan is produced by `.github/scripts/amp_ci_plan.py` and recorded in the AMP job summary. The same path classification drives routine and deep checks:

| Change | PR and merge queue | Main |
| --- | --- | --- |
| Isolated unit/database test | Changed entrypoints and typecheck | Same entrypoints; no unrelated build or deep sweep |
| Browser verification entrypoint | Typecheck | That browser script in the deep workflow |
| Application screens (`src/web/app`, `src/web/features`) | Build and contract smoke tests | Full core tests, build and browser checks; no database or print inventory |
| Shared runtime/server code | Build, contract smoke tests, changed tests; focused database checks for API and protected paths | Full core/database checks; affected browser/content suites |
| Helpers, fixtures, migrations, dependencies, unknown inputs | Build and smoke tests; focused database checks for migrations | Broad validation, with fresh content checks |
| Documentation | No expensive validation jobs | No expensive validation jobs |

A deleted test falls back to broad main validation. Test catalogs are discovered from the filesystem, so new tests join their suite automatically. A selected job must succeed; only jobs the planner deliberately omitted may be skipped. Existing required statuses remain `ci-gate`, `adversarial-review` and `hygiene`.

For launch acceptance, dispatch both `CI` and `AMP deep checks` on the candidate commit. These full runs bypass narrow selection; manual deep checks also bypass content-result reuse. Routine main CI must pass before automatic deployment, even though broad tests do not block feature merges.

**What is live.** `amp/scripts/release-status.sh` prints `main`'s head and its CI verdict, the newest green commit, the commit stage and production run, and how far production is behind `main` and behind green. It uses only the public GitHub API and the health endpoints. Directly:

- `curl https://amp.corpora.inc/api/v1/health` returns `commit` (the full source commit) and `builtAt` (UTC);
- the web serves the same at `/version.json`.

Both are `null` for an image built without the pipeline's `SOURCE_COMMIT` and `BUILT_AT` build arguments.

**Production is held** when no recent commit is green, so the poll deploys nothing. Fix `main` forward until CI is green; the next poll deploys it. A commit that failed its deploy (rollout or smoke checks) is rolled back and held until a newer green commit arrives.

**Force or roll back.** Run the deploy workflow manually with an explicit `ref` (a commit, short commit, branch or tag). An explicit ref deploys exactly that commit, green or not; this is the founder's override, and it works even when CI status cannot be read. It also holds the poll's current candidate, so the poll does not immediately replace the forced release; the next green commit resumes normal deploys. With `ref` empty, a manual run deploys the newest green commit. To undo a change for good, revert it on `main`; the revert ships when it is green.

## Operations

Serve `dist/` and proxy `/api` to the application. `Dockerfile` builds both: target `api` (the server, migrations and scheduled jobs; non-root, read-only root filesystem compatible) and target `web` (nginx serving `dist/` with a single-page fallback, `docker/nginx.conf`). Each listens on port 8080. Deployment configuration for a particular host lives outside this repository. The API defaults to loopback; set `AMP_HOST` deliberately for container networking only in hosted mode. Set up TLS, database backups and restore drills, secret storage, monitoring, and alerting before external availability. Keep the database and object storage private. The API image includes immutable, catalog-matched PDFs generated in a separate Docker build stage. Lesson, workbook, and solution downloads include Letter and A4 editions; book downloads include their validated Letter edition. The build stage installs Chromium and Poppler, renders the current catalog, verifies publication hashes and book content/page-count manifests, and copies only delivery files into the API image. Browser binaries and development dependencies are excluded from the runtime. A locked BuildKit cache reuses PDFs only with a matching source/toolchain fingerprint and verified file bytes. Download routes retain parent authentication, consent, learner ownership, and active-license checks; no public PDF directory or external storage mount is required. A later object-storage adapter must preserve those checks and bind files to the deployed content version.

`AMP_FREE_PROBLEMS` sets how many problems an anonymous visitor answers before the paywall: placement (a fifth of the allowance, at most 20), then adaptive practice with lessons, hints and review. It must be a whole number from 1 to 1000 and defaults to 100. Invalid values stop startup.

Requests with credentials are limited per credential (600 a minute), so one household or co-op behind a single address is not limited as one client. Anonymous requests, including trial creation (20 an hour), are limited per client address. The client address is by default the direct peer, and `X-Forwarded-For` is ignored. Behind a load balancer, set `AMP_TRUSTED_PROXIES` to a comma-separated list of the proxy CIDRs. On Google Cloud that means the load-balancer ranges `35.191.0.0/16` and `130.211.0.0/22` plus the ingress address as a `/32`. Each visitor then has their own limit instead of all visitors sharing one bucket. A forged leading `X-Forwarded-For` entry does not change the client address (`tests/trusted-proxy.test.ts`). List only addresses that are actually proxies.

Learner attempts are append-only through the application. Duplicate submissions return the recorded result, and another submission cannot award additional credit for the same problem. Adaptation and progress use durable per-skill evidence projections updated in the same transaction as each immutable attempt. Indexed recency queries provide bounded recent attempts; monotonic ingestion sequence preserves order when timestamps coincide. Historical replay constructs those projections from available facts without inferring ancestor mastery. These mechanisms do not establish production capacity: large deployments require representative load tests, query-plan checks and measured contention, latency and storage growth.

Retention policy must cover profiles, attempts, consent evidence, generated instances, backups, and financial records separately. Commerce events contain account and learner identifiers and are append-only for the application: deleting a learner does not erase those transaction records until financial retention ends. Family deletion removes live learning records and profile names, while retaining necessary billing records, consent records, and minimal privacy audit events. A student name required on an invoice linked to a verified order remains with that invoice until financial retention ends; unconverted invoice requests are deleted. Identity-provider accounts, payment-processor records, and backups have separate retention and deletion procedures. Do not describe learning-data deletion as complete account erasure.

Schedule `npm run privacy:retention` daily with `AMP_DATABASE_URL` in protected job configuration. The job enforces the [retention schedule](parent-consent.md#retention): inactive learners' learning data, trial records, consent and funding records, offline packs, privacy events, export tickets and, after 7 years, financial records. `tests/retention.integration.ts` runs the actual purges against each period boundary. Monitor job failures and verify restored backups reapply deletion and consent restrictions before serving requests.

### Insights report

`npm run report:insights` reads the production database and reports, for a window (`--days`, default 30):

- per problem family: served, answered, right, wrong, skipped, served-and-left, helped by a hint or lesson, median seconds from serving to the answer, and reports with their top reasons;
- per strand and skill: learners practicing and review-ready;
- the free trial: how many trials answered at least 1, 5, 10, 20, 30, 50, 75 and 100 problems, and how many reached placement, the paywall and a family;
- placed grade bands, family starting points and the newest reports (problem, seed, outcome, answer and reasons).

Output is plain text, `--json`, or one CSV per section with `--csv <dir>`. It carries counts and generated content only: no names, account, learner or trial identifiers, or report notes. `--notes` adds notes to the newest reports for the operator. It runs only in an interactive terminal or with `--csv`, so notes never go to log storage.

There is no web page or route for it. Run it as a one-off job from the `api` image (the same image and protected `AMP_DATABASE_URL` configuration as `privacy:retention`) and read the job's output. For notes, run it in an interactive session in that image. `npm run report:funnel` remains the anonymous visitor funnel.

Family exports stream bounded cursor batches with a two-minute limit. The shared API pool requires at least two connections so a snapshot export can hold one while other requests use another. Export audit writes use the snapshot connection before and after its read-only transaction. Concurrent exports can occupy the entire pool and queue other requests; production capacity requires a bounded global concurrency quota plus per-account request quotas. The existing peer-address limiter does not establish that capacity. Browser exports use a one-time, 60-second capability held only in memory and submitted in a native POST form body, never a URL or ambient cookie. Account and component-generation guards suppress stale download responses. Downloads already delivered to the browser cannot be recalled.

Native app distribution, store purchasing, automated provider onboarding, public hosting, and complete curriculum certification are separate release requirements. Local browser tests and PDF generation do not establish those outcomes.

Optional [finite offline packs](offline-packs.md) require separately provisioned signing and identity-binding keys. Their server API records provisional activity without independent progress credit. Native pack storage, local practice and synchronization are not implemented by that API.

### PDF image acceptance

Build the API target, then run its delivery check without network or database access:

```sh
docker build --target api -t amp-api:pdf-check amp
docker run --rm --network none --read-only --tmpfs /tmp amp-api:pdf-check \
  node_modules/.bin/tsx scripts/verify-pdf-delivery.ts
```

The check runs as the image’s unprivileged user. It validates the complete catalog’s artifact inventory and hashes, requests representative Letter/A4 publications and every book through the actual Fastify routes, and checks authentication, consent, license, and ownership rejection using synthetic in-memory fixtures. It does not create a listener or access learner records. The publisher logs PDF counts, byte totals, cache status, and elapsed generation time.
