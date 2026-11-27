#!/usr/bin/env bash
# Prove that pack signing uses the key the app trusts in release builds
# (crane/app/src-tauri/keys/pack-production.pub). Never prints key material.
#
#   check-pack-key.sh secret        HARVEST_SIGNING_KEY (base64 32-byte ed25519 seed, the
#                                   format harvest_pipeline/sign.py reads) must derive the
#                                   production public key.
#   check-pack-key.sh pub FILE      FILE (e.g. build-pack.sh's pack.pub) must hold the
#                                   production public key.
#
# OPENSSL overrides the openssl binary (it must support ed25519: OpenSSL 1.1.1+ / 3.x).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
want="$(tr -d '[:space:]' < "$here/../src-tauri/keys/pack-production.pub")"
openssl="${OPENSSL:-openssl}"

case "${1:-}" in
  secret)
    if [ -z "${HARVEST_SIGNING_KEY:-}" ]; then
      echo "check-pack-key: HARVEST_SIGNING_KEY is not set" >&2
      exit 1
    fi
    umask 077
    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' EXIT
    # RFC 8410 PKCS#8 wrapping of a raw ed25519 seed: fixed 16-byte prefix + 32-byte seed.
    { printf '\x30\x2e\x02\x01\x00\x30\x05\x06\x03\x2b\x65\x70\x04\x22\x04\x20'
      printf '%s' "$HARVEST_SIGNING_KEY" | base64 -d; } > "$tmp/key.der"
    if [ "$(wc -c < "$tmp/key.der" | tr -d ' ')" != 48 ]; then
      echo "check-pack-key: HARVEST_SIGNING_KEY is not a base64 32-byte seed" >&2
      exit 1
    fi
    # The DER public key ends with the 32 raw public key bytes.
    got="$("$openssl" pkey -inform DER -in "$tmp/key.der" -pubout -outform DER | tail -c 32 | base64 | tr -d '[:space:]')"
    ;;
  pub)
    got="$(tr -d '[:space:]' < "${2:?usage: check-pack-key.sh pub FILE}")"
    ;;
  *)
    echo "usage: check-pack-key.sh secret | pub FILE" >&2
    exit 2
    ;;
esac

if [ "$got" != "$want" ]; then
  echo "check-pack-key: the signing key is not the production key the app trusts (src-tauri/keys/pack-production.pub)." >&2
  echo "check-pack-key: see crane/app/RELEASE_SETUP.md, 'Pack signing key'." >&2
  exit 1
fi
echo "check-pack-key: matches the production pack key"
