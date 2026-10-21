# CI trust bootstrap

`ci_trust.py` selects a checksum-verified public CA bundle for subsequent CI
clients. It runs on GitHub-hosted runners, before checkout or JavaScript actions.
The workflow must set `NODE_OPTIONS: --use-openssl-ca` in its YAML environment;
GitHub forbids setting that variable through `GITHUB_ENV`.

The bootstrap downloads the maintained CA asset from an immutable repository
commit and checks its independently committed SHA-256 before activation. It
writes the selected bundle and an exclusive empty fallback directory under the
stable `RUNNER_TEMP/corpora-ci-trust-v1` path, then publishes explicit OpenSSL,
Node, curl, Git, Python package-tooling, AWS, Google CLI and Cargo trust settings
through `GITHUB_ENV`. Rustup selects curl. Existing state, additional Node roots,
conflicting Node trust selection and verification-bypass settings are refused.
Java keystores, embedded application stores and browser verification require
separate controls.

On Ubuntu hosts, the helper checks the root-owned distribution CA source tree.
It removes group/other write permission from `/usr/share` itself and that bounded
CA subtree before reading sources, preserving certificate bytes, other mode bits
and unrelated `/usr/share` children. Unknown owners, symlinks, special files and
hard-linked files require review. Containers must supply protected source
permissions. The helper disables exact distrusted distribution roots,
quarantines local files containing only distrusted roots, preserves ordinary
custom roots and refreshes the system CA store. Mixed custom bundles require
review. A Docker daemon is restarted only when no containers exist, including stopped containers. Its
actual registry transport must then reject all twelve incident hosts with issuer
errors and accept a valid registry control. Start test services after this
bootstrap. macOS keychains and signing identities are not changed.

On fresh hosted Windows, Python default TLS contexts import Windows CA and
ROOT collections before applying OpenSSL default paths. The Windows repair
removes only reviewed affected public certificate identities from attributed
backing stores and maintains their exact Disallowed entries. It preserves
ordinary positive certificates, unrelated Disallowed entries, existing entry
properties, and update, revocation and enrollment configuration. A protected
public-certificate backup and an unchanged fresh inventory are required before
writes. A fully protected store passes without further changes.

The inventory covers the system-location flags attempted by CPython for the
current selected user and their readable physical backing stores. Unprefixed
Services and Users collections can be unavailable; every Python-enumerated X509
identity must match the attributed native collection. Unknown affected-key
variants, policy or unsupported origins, incomplete attribution and unsafe
backup paths stop the bootstrap. Arbitrary user- or service-prefixed stores
require separate audits. Complete host inventories stay internal; public output
contains aggregate results. Windows requires Python 3.12 or newer.

Windows loaders must pass `--source-commit` with the same full immutable commit
used to download the checksum-verified helper. The helper retrieves its two
Windows modules and public certificate manifest from that commit, using the
explicit verified CA file with proxies disabled. Each asset has an independent
size limit and SHA-256; all assets are verified before any module executes.
HTTP redirects are refused before following them.
Modules execute from those verified bytes in memory. A mutable branch name or
an inferred helper revision is not accepted. Existing Unix callers can omit the
argument. Update a Windows loader's invocation together with its helper pin:

```python
subprocess.run([sys.executable, '-I', name, '--source-commit', commit], check=True)
```

Validate actual native TLS and fresh default-Python contexts, including valid
connections and hostname failures, before promoting a helper revision. Existing
Python contexts and provider processes need separate verification.

Job containers use the explicit `--clients-only` mode. On Linux it repairs the container default store as container root, including
compiled curl fallback paths; environment variables alone cannot exclude those
paths. It never refreshes or makes a protection claim about the host daemon.
An already clean image retains its exact published bundle and directory layout. The image
must provide Python 3. A pre-checkout loader must verify the helper's own hash
before executing a real temporary file; the Ubuntu root sub-action needs that
file path. Pin both the helper's immutable commit and its SHA-256. Override job
working-directory defaults so the loader runs in an existing runner directory.

These controls cannot protect runner initialization, action downloads or
container pulls that happen before the first workflow step. A verified provider
bootstrap or a separately controlled runner architecture is required for those
paths. A source merge or a clean CA file alone does not prove every live client
uses it; verify actual transports on each supported runner platform.

When updating trust data, review the source and checksum, publish the helper
through the normal PR gates, and update consuming loader pins together.

References:

- [Incident test chains and package tracker](https://emudhra.we-have-a-problem.com/)
- [GitHub environment-file restrictions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands#setting-an-environment-variable)
- [GitHub runner environment variables](https://docs.github.com/en/actions/reference/workflows-and-actions/variables)
- [Python Windows certificate enumeration](https://docs.python.org/3/library/ssl.html#ssl.enum_certificates)
- [Windows system-store locations](https://learn.microsoft.com/en-us/windows/win32/seccrypto/system-store-locations)
- [Cargo HTTP CA configuration](https://doc.rust-lang.org/cargo/reference/environment-variables.html)

Workflow loaders are generated by `sync_ci_trust.py`. After reviewing a merged
helper revision, update its commit and checksum in that script, then run
`python3 .github/scripts/sync_ci_trust.py --write`. The workflow tests require
an unconditional loader as the first step in every runnable job, an explicit
existing temporary working directory, and exclusive Node trust. PostgreSQL test
containers start after the bootstrap and are removed by their exact recorded ID.
