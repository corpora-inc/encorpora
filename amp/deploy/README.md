# Deploying AMP

AMP runs as a separate tenant on a shared GKE cluster: its own namespaces, Google service account, database user, secrets, address and certificate. It can be moved to another cluster by changing the deployment configuration, without code changes. Nothing here depends on another tenant's code, identities or deploy pipeline.

| Piece | Where |
|---|---|
| Images | `Dockerfile`: target `api` (Fastify, migrations, jobs) and target `web` (nginx serving `dist/`) |
| Manifests | `k8s/base` + overlays `k8s/stage` (namespace `amp-stage`) and `k8s/prod` (namespace `amp`) |
| Ingress | `k8s/ingress.yaml`. It is created once and never re-applied, because cert-manager edits it while renewing certificates |
| Rendering | `render.sh <stage\|prod> [app\|ingress]` fills `${AMP_*}` placeholders and fails on any left unfilled |
| Pipeline | `.github/workflows/deploy-amp.yml`. Run it manually, choosing `stage` or `prod` |

On each pod start, migrations run in the API's init container. They hold an advisory lock, so they apply once per release, and they must stay additive because old pods keep serving during a rollout. Scheduled jobs:
- privacy retention: daily;
- Stripe worker: every minute;
- consent delivery: every five minutes.

The Stripe worker and consent delivery stay suspended until an overlay enables them. The `ResourceQuota` caps what AMP can take from the cluster.

## One-time setup (per environment)

These steps create cloud resources and need an operator with the right access. The real names and identifiers go in the GitHub environment variables (`amp-stage`, `amp-prod`), never in this repository.

1. **Database.** Create a database `amp` and a dedicated user (a separate Postgres instance, or the shared one; see below). Size the pool well below the instance's connection limit.
2. **Identity.**
   - A Google service account for AMP. Grant it Cloud SQL Client, plus Secret Accessor on AMP's secret only. Bind it to the Kubernetes service account `amp` in the namespace with Workload Identity.
   - A deployer service account for GitHub Actions through Workload Identity Federation, limited to this repository. Grant it push access to AMP's Artifact Registry repository, deploy access to the AMP namespaces, and read access to AMP's secret.
3. **Registry.** An Artifact Registry Docker repository for AMP.
4. **Network.** A global static IP per environment, and a DNS `A` record for the hostname pointing to it.
5. **Secret.** One Secret Manager secret per environment, holding an env file with:
   - always: `AMP_DATABASE_URL` (through the in-namespace proxy: host `amp-sql-proxy`, port 5432), the OIDC settings, and `AMP_HOSTED_PILOT_READY=true` once the deployment checklist in `docs/deployment.md` is met;
   - when enabled: Stripe, consent and offline-pack settings.

   The API refuses to start without that acknowledgement.
6. **GitHub environment variables:**
   - `AMP_GCP_PROJECT`, `AMP_CLUSTER`, `AMP_CLUSTER_ZONE`
   - `AMP_WIF_PROVIDER`, `AMP_DEPLOYER_SA`, `AMP_GSA`
   - `AMP_REGISTRY`, `AMP_SQL_INSTANCE`, `AMP_ENV_SECRET`
   - `AMP_STATIC_IP_NAME`, `AMP_INGRESS_IP`, `AMP_HOSTNAME`, `AMP_ACME_EMAIL`
   - `VITE_AMP_AUTHORITY`, `VITE_AMP_CLIENT_ID`, `VITE_AMP_SCOPES`, `VITE_AMP_RESOURCE`

The first deploy creates the Ingress, and cert-manager then issues the certificate. Smoke checks: `/api/v1/health` and `/`.

## Database placement

- **Shared instance, own database and user.** No extra cost, and backups and HA are inherited. AMP's load and maintenance windows are coupled to the other tenants, and instance-level changes (version upgrades, flags) affect everyone.
- **Own instance.** Full isolation and its own upgrade schedule, at the cost of a second instance.

Either way, AMP can move later with `pg_dump`/restore and a change to `AMP_SQL_INSTANCE` and `AMP_DATABASE_URL`.

## Not yet covered

- **Printable PDFs.** Worksheets and books are read from `artifacts/`, which is not in the image, so downloads are unavailable until publications are built into immutable storage.
- **Monitoring.** Add an uptime check on `/api/v1/health` and alerting before external availability.
