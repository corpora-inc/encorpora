# Hosted deployment requirements

The hosted API requires PostgreSQL, a configured OIDC issuer, and a same-origin HTTPS reverse proxy for the browser application and `/api`. Development authentication must never be exposed publicly. Run migrations before starting a deployment; applied migrations have checksums and must not be edited.

## Identity and enrollment

Set `AMP_AUTH_MODE=oidc`, `AMP_DATABASE_URL`, `AMP_OIDC_ISSUER`, `AMP_OIDC_AUDIENCE`, and `AMP_OIDC_JWKS_URL`. The audience is the API resource, not the browser client. Signed access tokens require issuer, audience, subject, issued-at, and expiration. The default token profile requires `typ=at+jwt`; `AMP_OIDC_TOKEN_PROFILE=token-use-access` instead requires the signed `token_use=access` claim while retaining API audience validation. ID tokens are not API credentials.

Build the browser with `VITE_AMP_AUTHORITY`, `VITE_AMP_CLIENT_ID`, and the API-authorized `VITE_AMP_SCOPES`. Set `VITE_AMP_RESOURCE` when the issuer supports resource indicators. Register the exact HTTPS origin callback. The browser uses a public authorization-code/PKCE client; never embed a client secret.

Hosted mode refuses to start without `AMP_HOSTED_PILOT_READY=true`. This is an operator readiness acknowledgement, not consent or proof of legal compliance. Before setting it, configure support, privacy notices, the verified-parent enrollment procedure, and protected hosting. A valid access token alone does not authorize child profiles: every private learner route requires an unwithdrawn parent-consent record.

For a supervised pilot, an authorized operator records a completed parent verification using `npx tsx scripts/parent-consent.ts <private-record.json>`. The record contains `accountId`, `policyVersion`, `verificationMethod`, `evidenceReference`, and optional `withdraw`. Evidence references point to protected records; do not put actual identity documents or private evidence in this public repository. This command records the result of verification; it does not perform it. Consent withdrawal blocks subsequently authorized requests; a request authorized before withdrawal can finish. Self-service parental verification and account-deletion/export workflows are required before a public family launch.

## Access and commerce

Hosted practice and document downloads require an active student grant. Import reviewed commerce events using the admin-only command documented in [commerce](commerce.md). Client-supplied receipts, order submissions, and marketplace account creation cannot activate access. Live Stripe, Apple, Google, and ESA adapters require verified credentials, provider contracts, notification authentication, and sandbox acceptance before activation.

The preview catalog exposes its reference lessons for exploration. A commercial content-release policy and authenticated paid library must be established before replacing reference content with the paid curriculum.

## Operations

Serve `dist/` and proxy `/api` to the application. The API defaults to loopback; set `AMP_HOST` deliberately for container networking only in hosted mode. Set up TLS, database backups and restore drills, secret storage, monitoring, and alerting before external availability. Keep the database and object storage private. The local PDF delivery adapter reads built artifacts; production distribution needs an immutable object-storage/CDN release and download policy.

Rate limiting uses the direct peer address. A reverse proxy therefore shares one bucket unless trusted proxy addresses are configured in code and tested; do not trust arbitrary forwarded IP headers.

Learner attempts are append-only through the application. Duplicate submissions return the recorded result, and another submission cannot award additional credit for the same problem. Recent adaptation reads are bounded; progress aggregation uses the learner's historical evidence. Large deployments need measured query performance and incremental progress projections.

Retention policy must cover profiles, attempts, consent evidence, generated instances, backups, and financial records separately. Commerce events contain account and learner identifiers and are append-only: deleting a learner does not erase those transaction records. Do not promise complete account erasure until a retention-aware export/deletion workflow is implemented and tested.

Native app distribution, store purchasing, automated provider onboarding, public hosting, and complete curriculum certification are separate release requirements. Local browser tests and PDF generation do not establish those outcomes.
