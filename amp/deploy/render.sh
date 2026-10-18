#!/usr/bin/env bash
# Prints AMP's manifests for one environment with ${AMP_*} placeholders filled
# from the environment. Usage: deploy/render.sh <stage|prod> [app|ingress]
set -euo pipefail
env=${1:?stage or prod}
part=${2:-app}
dir=$(cd "$(dirname "$0")" && pwd)
names=(AMP_GSA AMP_SQL_INSTANCE AMP_API_IMAGE AMP_WEB_IMAGE AMP_STATIC_IP_NAME
  AMP_HOSTNAME AMP_ACME_EMAIL AMP_INGRESS_IP)
for name in "${names[@]}"; do
  [ -n "${!name:-}" ] || { echo "render: $name is not set" >&2; exit 1; }
done
case "$env" in stage) namespace=amp-stage ;; prod) namespace=amp ;;
  *) echo "render: unknown environment $env" >&2; exit 1 ;; esac
case "$part" in
  app) source=$(kubectl kustomize "$dir/k8s/$env") ;;
  ingress) source=$(sed "s/^metadata:/metadata:\n  namespace: $namespace/" \
    "$dir/k8s/ingress.yaml") ;;
  *) echo "render: unknown part $part" >&2; exit 1 ;;
esac
rendered=$(printf '%s\n' "$source" | envsubst "$(printf '${%s} ' "${names[@]}")")
if grep -n '\${AMP_' <<<"$rendered" >&2; then
  echo "render: unfilled placeholder" >&2
  exit 1
fi
printf '%s\n' "$rendered"
