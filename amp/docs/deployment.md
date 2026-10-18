# Hosted deployment requirements

The hosted API requires PostgreSQL, a configured OIDC issuer, and a same-origin HTTPS reverse proxy for the browser application and `/api`. Development authentication must never be exposed publicly. Run migrations before starting a deployment; applied migrations have checksums and must not be edited.

## Identity and enrollment

### AMP accounts (`AMP_AUTH_MODE=accounts`)

Parent accounts are stored in AMP's own database: migration `0016-accounts.sql`, implemented with Better Auth (`src/server/accounts.ts`). They support email and password, passkeys, TOTP two-factor with backup codes, and Google, Apple, Microsoft and GitHub sign-in, with linked logins. Web sessions use an HttpOnly cookie. The session token also works as `Authorization: Bearer` for the API and native apps. An account id is `amp|<user id>`.

**Required settings**
- `AMP_ACCOUNTS_URL`: the public HTTPS origin. Loopback HTTP is allowed outside production.
- `AMP_ACCOUNTS_SECRET`: at least 32 random characters.

**Email.** `AMP_MAIL_RESEND_API_KEY` and `AMP_MAIL_FROM` send verification and reset emails.
- In production without mail, email and password sign-in is off.
- With mail, new password accounts must confirm their email before signing in.
- In development, links are printed to the server log.

**Providers.** Each provider is enabled only when all of its settings are present.
- Google: `AMP_GOOGLE_CLIENT_ID` and `AMP_GOOGLE_CLIENT_SECRET`.
- GitHub: `AMP_GITHUB_CLIENT_ID` and `AMP_GITHUB_CLIENT_SECRET`.
- Microsoft: `AMP_MICROSOFT_CLIENT_ID` and `AMP_MICROSOFT_CLIENT_SECRET`, plus optional `AMP_MICROSOFT_TENANT_ID` (default `common`).
- Apple: `AMP_APPLE_CLIENT_ID` (the Services ID), `AMP_APPLE_TEAM_ID`, `AMP_APPLE_KEY_ID` and `AMP_APPLE_PRIVATE_KEY` (the .p8 PEM; `\n` escapes are accepted), plus optional `AMP_APPLE_BUNDLE_ID`. The Apple client secret is minted at startup and is valid for 150 days, so a deploy refreshes it.
- Register each provider's redirect URI as `<AMP_ACCOUNTS_URL>/api/auth/callback/<google|apple|microsoft|github>`.

`AMP_ACCOUNTS_TRUSTED_ORIGINS` lists extra allowed origins, such as native app schemes.

**Linking.**
- A sign-in with the same email links to an existing account only when the provider has verified the email.
- A signed-in parent may link a login that uses a different email.
- Each provider identity belongs to one account.

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

## Operations

Serve `dist/` and proxy `/api` to the application. `Dockerfile` builds both: target `api` (the server, migrations and scheduled jobs; non-root, read-only root filesystem compatible) and target `web` (nginx serving `dist/` with a single-page fallback, `docker/nginx.conf`). Each listens on port 8080. Deployment configuration for a particular host lives outside this repository. The API defaults to loopback; set `AMP_HOST` deliberately for container networking only in hosted mode. Set up TLS, database backups and restore drills, secret storage, monitoring, and alerting before external availability. Keep the database and object storage private. The local PDF delivery adapter reads built artifacts; production distribution needs an immutable object-storage/CDN release and download policy.

Requests with credentials are limited per credential (600 a minute), so one household or co-op behind a single address is not limited as one client. Anonymous requests, including trial creation (20 an hour), are limited per client address. The client address is by default the direct peer, and `X-Forwarded-For` is ignored. Behind a load balancer, set `AMP_TRUSTED_PROXIES` to a comma-separated list of the proxy CIDRs. On Google Cloud that means the load-balancer ranges `35.191.0.0/16` and `130.211.0.0/22` plus the ingress address as a `/32`. Each visitor then has their own limit instead of all visitors sharing one bucket. A forged leading `X-Forwarded-For` entry does not change the client address (`tests/trusted-proxy.test.ts`). List only addresses that are actually proxies.

Learner attempts are append-only through the application. Duplicate submissions return the recorded result, and another submission cannot award additional credit for the same problem. Adaptation and progress use durable per-skill evidence projections updated in the same transaction as each immutable attempt. Indexed recency queries provide bounded recent attempts; monotonic ingestion sequence preserves order when timestamps coincide. Historical replay constructs those projections from available facts without inferring ancestor mastery. These mechanisms do not establish production capacity: large deployments require representative load tests, query-plan checks and measured contention, latency and storage growth.

Retention policy must cover profiles, attempts, consent evidence, generated instances, backups, and financial records separately. Commerce events contain account and learner identifiers and are append-only: deleting a learner does not erase those transaction records. Family deletion removes live learning records and names, while retaining necessary opaque billing references, consent records, and minimal privacy audit events. Identity-provider accounts, payment-processor records, and backups have separate retention and deletion procedures. Do not describe learning-data deletion as complete account erasure.

Schedule `npm run privacy:retention` daily with `AMP_DATABASE_URL` in protected job configuration. The job deletes expired 60-second export tickets, privacy audit events after their 90-day retention period, eligible expired consent and funding records, and offline packs 30 days after their expiry; it does not delete commerce records. The database integration suite runs the actual purge implementation and verifies that financial grants survive. Monitor job failures and verify restored backups reapply deletion and consent restrictions before serving requests.

Family exports stream bounded cursor batches with a two-minute limit. The export pool needs at least two connections: export audit writes use a connection separate from the snapshot cursor. Concurrent exports can exhaust a shared pool; production capacity requires a separately sized export pool or a bounded global concurrency quota, plus per-account request quotas. The existing peer-address limiter does not establish that capacity. Browser exports use a one-time, 60-second capability held only in memory and submitted in a native POST form body, never a URL or ambient cookie. Account and component-generation guards suppress stale download responses. Downloads already delivered to the browser cannot be recalled.

Native app distribution, store purchasing, automated provider onboarding, public hosting, and complete curriculum certification are separate release requirements. Local browser tests and PDF generation do not establish those outcomes.

Optional [finite offline packs](offline-packs.md) require separately provisioned signing and identity-binding keys. Their server API records provisional activity without independent progress credit. Native pack storage, local practice and synchronization are not implemented by that API.
