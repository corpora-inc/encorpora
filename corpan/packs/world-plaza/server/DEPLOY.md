# World Plaza (Corpan City) presence server — App Runner deployment runbook

The Colyseus presence server (`server/src/index.ts`, Colyseus 0.16, bare WS on
`$PORT`) deploys as a container to **AWS App Runner** in **us-east-2**. App
Runner terminates TLS for us, so the pack connects with `wss://…` and there is
no cert to manage. The server is stateless presence — **no secrets, no env
credentials**.

> Prep-only note: this doc is the exact runbook for the integrator who holds the
> AWS keys. Nothing here was run against the cloud by the CR that added it. The
> Dockerfile's runtime path (tsx → contracts alias → topology JSON) was verified
> locally by booting `PORT=8080 npx tsx src/index.ts` (logs
> `presence server listening on :8080 (topology plaza-grand)`). `terraform
> validate` passes. The integrator runs `docker build` + `terraform apply`.

Estimated cost: **~$45–60/mo** for a single always-warm 0.25 vCPU / 0.5 GB
instance (`min_size = 1`, required so a presence socket is always live), plus
trivial ECR storage. Scaling out (`max_size = 3`) only adds cost under load.

---

## 0. Prerequisites

```bash
# From the repo root. Set once:
export AWS_REGION=us-east-2
# The `terraform-admin` IAM user has ECR + App Runner perms; its access key
# lives in `encorpora/.env` as AWS_ACCESS_KEY / AWS_SECRET_ACCESS_KEY. Export
# them directly (NOT via AWS_PROFILE) so the SDK picks them up. The
# `corpan-publisher` profile is S3/CloudFront only and CANNOT do this deploy.
export AWS_ACCESS_KEY_ID="<from encorpora/.env AWS_ACCESS_KEY>"
export AWS_SECRET_ACCESS_KEY="<from encorpora/.env AWS_SECRET_ACCESS_KEY>"
unset AWS_PROFILE
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ECR_REPO="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/corpan-plaza-server"
export IMAGE_TAG=$(git rev-parse --short HEAD)   # or "latest"
```

Docker must be running. Terraform >= 1.5.

---

## 1. Provision the ECR repository (first apply, repo only)

App Runner can only pull an image that already exists, so create the ECR repo
**before** pushing. Run terraform from `corpan/infra/terraform` with the plaza
server enabled:

```bash
cd corpan/infra/terraform
terraform init                      # real S3 backend; needs AWS creds
terraform apply \
  -var enable_plaza_server=true \
  -var plaza_server_image_tag="$IMAGE_TAG" \
  -target aws_ecr_repository.plaza_server
```

Capture the repo URL (also available as output `plaza_server_ecr_repository_url`):

```bash
terraform output -raw plaza_server_ecr_repository_url
```

---

## 2. Build, tag, and push the image

**Build context is the PACK ROOT** (`corpan/packs/world-plaza`), not `server/`,
because the image needs the sibling `contracts/src` and `content/topologies`
trees. The Dockerfile lives at `server/Dockerfile` and its ignore rules at
`server/Dockerfile.dockerignore` (BuildKit reads `<dockerfile>.dockerignore`).

```bash
cd corpan/packs/world-plaza

# Login to ECR
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin \
    "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Build for the App Runner platform (linux/amd64 — matters on Apple Silicon)
docker build --platform linux/amd64 \
  -f server/Dockerfile \
  -t "corpan-plaza-server:${IMAGE_TAG}" \
  .

# Tag + push to ECR
docker tag "corpan-plaza-server:${IMAGE_TAG}" "${ECR_REPO}:${IMAGE_TAG}"
docker push "${ECR_REPO}:${IMAGE_TAG}"
```

---

## 3. Create the App Runner service (full apply)

Now the image exists, apply the rest (ECR access role, autoscaling, service):

```bash
cd corpan/infra/terraform
terraform apply \
  -var enable_plaza_server=true \
  -var plaza_server_image_tag="$IMAGE_TAG"
```

Default instance size is `0.25 vCPU` / `0.5 GB`. Bump per load with
`-var plaza_server_cpu="1 vCPU" -var plaza_server_memory="2 GB"`.

Capture the service URL (App Runner provisioning takes a few minutes):

```bash
terraform output -raw plaza_server_url       # https://xxxx.us-east-2.awsapprunner.com
terraform output -raw plaza_server_wss_url   # wss://xxxx.us-east-2.awsapprunner.com  ← use this
```

---

## 4. Bake the URL into the pack build (or inject at runtime)

The client resolves the server URL in `src/multiplayer/initMultiplayer.ts`
`resolveServerUrl()`, precedence: `globalThis.__WP_SERVER_URL` (runtime) →
`?wpServer=`/`?server=` (query) → `import.meta.env.VITE_WP_SERVER_URL`
(build-time bake) → undefined (single-player).

**Build-time bake (recommended for release):**

```bash
cd corpan/packs/world-plaza
VITE_WP_SERVER_URL="wss://xxxx.us-east-2.awsapprunner.com" npm run build
# → dist/ now has the wss:// URL inlined; multiplayer is on by default.
```

**Runtime injection (no rebuild)** — set before the pack boots in the host:

```js
globalThis.__WP_SERVER_URL = "wss://xxxx.us-east-2.awsapprunner.com"
```

---

## 5. Smoke-test two clients (the M1 "wow")

Two browser windows joining at once must land in the SAME plaza and see each
other move in real time.

- **Against a baked build:** serve `dist/` and open it in two windows — they
  connect automatically via the baked `VITE_WP_SERVER_URL`.
- **Against any build (no bake), via query param:** open two windows with

  ```
  https://<pack-url>/?wpServer=wss://xxxx.us-east-2.awsapprunner.com
  ```

In both windows, walk the two avatars near each other: each sees the other's
movement, the nearby-pip count reads `1`, and approaching reveals the safe
profile card. That proves presence end-to-end against the deployed server.

Quick connectivity check from a terminal (HTTP matchmake endpoint over TLS):

```bash
curl -s "https://xxxx.us-east-2.awsapprunner.com/matchmake/joinOrCreate/plaza" \
  -H 'content-type: application/json' -d '{}' | head
# A JSON room/seat reservation (or a Colyseus error body) = the server is live.
```

---

## 6. Updating the server later

```bash
# rebuild + push a new tag, then point the service at it:
docker build --platform linux/amd64 -f server/Dockerfile -t "${ECR_REPO}:<newtag>" .   # from pack root
docker push "${ECR_REPO}:<newtag>"
cd corpan/infra/terraform
terraform apply -var enable_plaza_server=true -var plaza_server_image_tag="<newtag>"
```

`auto_deployments_enabled = false`, so a push alone does NOT redeploy — the
`terraform apply` with the new tag triggers the rollout (explicit + auditable).

## 7. Tear down

```bash
cd corpan/infra/terraform
terraform apply -var enable_plaza_server=false   # destroys service + ECR repo + role
```
