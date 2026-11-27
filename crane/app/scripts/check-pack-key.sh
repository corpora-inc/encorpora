#!/usr/bin/env bash
# Pack signing keys for the crane app. Never prints private key material.
#
#   check-pack-key.sh secret        HARVEST_SIGNING_KEY (base64 32-byte ed25519 seed, the
#                                   format harvest_pipeline/sign.py reads) must derive a
#                                   key the release app trusts (src-tauri/keys/pack-production.pub).
#   check-pack-key.sh pub FILE      FILE (e.g. build-pack.sh's pack.pub) must hold that key.
#   check-pack-key.sh derive        print the PUBLIC key HARVEST_SIGNING_KEY derives (for
#                                   rotation; the seed itself is never printed).
#
# OPENSSL overrides the openssl binary. It must support ed25519 (OpenSSL 1.1.1+ / 3.x;
# macOS's /usr/bin/openssl is LibreSSL: use Homebrew's).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
want="$(tr -d '[:space:]' < "$here/../src-tauri/keys/pack-production.pub")"
openssl="${OPENSSL:-openssl}"

# The public key of HARVEST_SIGNING_KEY, base64. The seed only ever passes through a
# pipe: printf is a shell builtin, so it never appears in a process's arguments.
derive() {
  if [ -z "${HARVEST_SIGNING_KEY:-}" ]; then
    echo "check-pack-key: HARVEST_SIGNING_KEY is not set" >&2
    return 1
  fi
  # Same shape sign.py's base64.b64decode accepts for a 32-byte seed: 43 characters,
  # one '=' of padding, nothing else (a trailing newline is tolerated).
  local seed="${HARVEST_SIGNING_KEY%$'\n'}"
  if ! [[ "$seed" =~ ^[A-Za-z0-9+/]{43}=$ ]]; then
    echo "check-pack-key: HARVEST_SIGNING_KEY is not a base64 32-byte seed" >&2
    return 1
  fi
  # RFC 8410 PKCS#8 of a raw ed25519 seed: a fixed 16-byte prefix, then the 32-byte seed.
  # The DER public key (SubjectPublicKeyInfo) ends with the 32 raw public key bytes.
  { printf '\x30\x2e\x02\x01\x00\x30\x05\x06\x03\x2b\x65\x70\x04\x22\x04\x20'
    printf '%s' "$seed" | base64 -d; } \
    | "$openssl" pkey -inform DER -pubout -outform DER \
    | tail -c 32 | base64 | tr -d '[:space:]'
}

case "${1:-}" in
  secret) got="$(derive)" ;;
  pub) got="$(tr -d '[:space:]' < "${2:?usage: check-pack-key.sh pub FILE}")" ;;
  derive) derive; echo; exit 0 ;;
  *)
    echo "usage: check-pack-key.sh secret | pub FILE | derive" >&2
    exit 2
    ;;
esac

if [ "$got" != "$want" ]; then
  echo "check-pack-key: the signing key is not the production key the app trusts (src-tauri/keys/pack-production.pub)." >&2
  echo "check-pack-key: see crane/app/RELEASE_SETUP.md, 'Pack signing key'." >&2
  exit 1
fi
echo "check-pack-key: matches the production pack key"
