#!/usr/bin/env python3
"""Assert every `[patch.*]` in the repo is actually applied.

A Cargo patch that stops matching does not fail a build. Cargo emits

    warning: Patch `foo v1.2.3 (/path)` was not used in the crate graph.

on **stderr**, exits 0, and quietly resolves the upstream crate instead. This
repo has already lost a vendored crash fix that way: the patched crate was
silently dropped, the app compiled, tested and clippied clean, and the
regression only surfaced on a device.

Three assertions, in increasing strength:

1. No tracked `Cargo.lock` contains a `[[patch.unused]]` stanza. Cargo writes
   that section when a declared patch does not apply, so a lock is a durable,
   grep-able record of the failure.
2. `cargo metadata --locked` for every manifest that declares a `[patch]` of
   ANY shape — path, git or version — emits no "was not used in the crate
   graph" warning. Assertion 2 runs on the mere presence of a `[patch]` table,
   never on the shape of its entries: a git patch goes unused exactly as
   silently as a path one, and scoping the run to path patches was a fail-open.
3. Every patched package that declares a `path` resolves in the graph to that
   vendored path, not to a registry copy. Only this assertion is path-specific,
   because only a path patch names a directory to compare against.

Cargo's exit code, measured on cargo 1.93.1 and 1.97.1, depends on the lock:

* lock already carries the `[[patch.unused]]` stanza -> exit **0**, and the
  stderr text is the only signal metadata gives (assertion 1 also fires).
* lock is clean, so `--locked` would have to rewrite it -> exit **101**
  ("cannot update the lock file ... because --locked was passed").

Both are treated as failures. The stderr grep is what makes the first case
visible, which is why it is not optional.

Run with the manifests to inspect, or with no arguments to inspect every
tracked manifest that declares a patch.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tomllib
from pathlib import Path

# Cargo's wording for a patch that resolved to nothing. Matched as a substring
# because the surrounding text (crate name, version, source) varies.
UNUSED_PATCH_MARKER = "was not used in the crate graph"

# Third-party trees we neither format nor own. A vendored fork's own manifest
# is exempt from inspection; the patch that POINTS at it is not.
EXCLUDED_PATH_PARTS = ("vendor", "node_modules", "target")


def has_unused_patch_stanza(lock_text: str) -> bool:
    """True when a Cargo.lock records a patch that did not apply."""
    return re.search(r"^\[\[patch\.unused\]\]", lock_text, re.MULTILINE) is not None


def unused_patch_warnings(stderr: str) -> list[str]:
    """The `cargo` stderr lines reporting a patch that matched nothing."""
    return [line.strip() for line in stderr.splitlines() if UNUSED_PATCH_MARKER in line]


def patch_tables(manifest: Path) -> dict[str, dict]:
    """The `[patch.<registry>]` tables in a manifest, empty ones dropped."""
    data = tomllib.loads(manifest.read_text(encoding="utf-8"))
    return {
        registry: crates
        for registry, crates in (data.get("patch") or {}).items()
        if crates
    }


def has_any_patch(manifest: Path) -> bool:
    """True when the manifest declares a patch of ANY shape.

    This — not :func:`patch_entries` — is what selects a manifest for the
    `cargo metadata` run. A git or version patch that stops matching is just as
    silent as a path one, so keying the run on "has a path patch" would skip
    the assertion for exactly the case nothing else covers.
    """
    return bool(patch_tables(manifest))


def patch_entries(manifest: Path) -> list[tuple[str, str, Path]]:
    """(registry, crate, resolved path) for every path-based patch in a manifest.

    Path-only, and deliberately so: this feeds the "resolves to the vendored
    directory" assertion, and a git or version patch names no directory to
    compare against. Non-path patches are skipped HERE and picked up by
    :func:`has_any_patch`, which is what gates the metadata run.
    """
    out: list[tuple[str, str, Path]] = []
    for registry, crates in patch_tables(manifest).items():
        for crate, spec in crates.items():
            path = spec.get("path") if isinstance(spec, dict) else None
            if path is None:
                continue
            out.append((registry, crate, (manifest.parent / path).resolve()))
    return out


def tracked_files(pattern: str, repo_root: Path) -> list[Path]:
    out = subprocess.run(
        ["git", "ls-files", "-z", pattern],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    paths = [repo_root / p for p in out.split("\0") if p]
    return [
        p for p in paths if not any(part in EXCLUDED_PATH_PARTS for part in p.parts)
    ]


def cargo_metadata(manifest: Path) -> tuple[dict | None, str, int]:
    """Full (dependency-resolving) metadata, cargo's stderr, and its exit code.

    `--no-deps` would skip resolution entirely, which is exactly the step that
    decides whether a patch applies — so it must not be used here.

    A non-zero exit returns ``None`` for the graph rather than raising, so the
    caller can still report the stderr warnings it collected: an unused patch
    against a clean lock produces BOTH the warning and exit 101, and the
    warning is the line that names the crate.
    """
    proc = subprocess.run(
        [
            "cargo",
            "metadata",
            "--locked",
            "--format-version",
            "1",
            "--manifest-path",
            str(manifest),
        ],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        return None, proc.stderr, proc.returncode
    return json.loads(proc.stdout), proc.stderr, 0


def check_locks(repo_root: Path) -> list[str]:
    failures = []
    locks = tracked_files("*Cargo.lock", repo_root)
    for lock in locks:
        rel = lock.relative_to(repo_root)
        if has_unused_patch_stanza(lock.read_text(encoding="utf-8")):
            failures.append(
                f"{rel}: contains a [[patch.unused]] stanza — a declared "
                f"[patch] no longer matches anything in the graph."
            )
        else:
            print(f"  ok  {rel}: no [[patch.unused]]")
    if not locks:
        failures.append("no tracked Cargo.lock found — is this the repo root?")
    return failures


def check_manifest(manifest: Path, repo_root: Path) -> list[str]:
    rel = manifest.relative_to(repo_root)
    failures = []
    # Presence of ANY [patch] table, not of a path-based one — see has_any_patch.
    if not has_any_patch(manifest):
        return failures

    metadata, stderr, code = cargo_metadata(manifest)

    for line in unused_patch_warnings(stderr):
        failures.append(f"{rel}: cargo reported an unapplied patch: {line}")

    if metadata is None:
        failures.append(
            f"{rel}: `cargo metadata --locked` exited {code} — the graph could "
            f"not be resolved against the committed lock. cargo said:\n"
            f"{stderr.strip()}"
        )
        return failures

    # Logged unconditionally so a manifest whose only patches are git-based —
    # which reaches assertion 2 but has nothing for assertion 3 to print —
    # still shows up as inspected rather than as silence.
    declared = sum(len(c) for c in patch_tables(manifest).values())
    print(f"  ok  {rel}: graph resolved, no unused-patch warning ({declared} declared)")

    # Assertion 3 is path-only: a git or version patch names no directory.
    entries = patch_entries(manifest)

    by_name: dict[str, list[dict]] = {}
    for pkg in metadata.get("packages", []):
        by_name.setdefault(pkg["name"], []).append(pkg)

    for registry, crate, path in entries:
        want = (path / "Cargo.toml").resolve()
        candidates = by_name.get(crate, [])
        if not candidates:
            failures.append(
                f"{rel}: [patch.{registry}] declares `{crate}` but no package "
                f"of that name is in the resolved graph."
            )
            continue
        resolved = [Path(p["manifest_path"]).resolve() for p in candidates]
        if want in resolved:
            print(f"  ok  {rel}: {crate} -> {want.relative_to(repo_root)}")
        else:
            failures.append(
                f"{rel}: [patch.{registry}] `{crate}` should resolve to {want} "
                f"but the graph has {', '.join(str(r) for r in resolved)}."
            )
    return failures


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "manifests",
        nargs="*",
        help="Cargo.toml files to inspect (default: every tracked manifest).",
    )
    args = parser.parse_args(argv)

    repo_root = Path(
        subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
    )

    print("Cargo.lock [[patch.unused]] scan:")
    failures = check_locks(repo_root)

    if args.manifests:
        manifests = [Path(m).resolve() for m in args.manifests]
    else:
        manifests = tracked_files("*Cargo.toml", repo_root)

    print("Declared [patch] resolution:")
    patching = [m for m in manifests if has_any_patch(m)]
    if not patching:
        print("  (no manifest declares a [patch])")
    for manifest in patching:
        failures.extend(check_manifest(manifest, repo_root))

    if failures:
        print()
        for f in failures:
            print(f"::error::{f}")
        print(
            "\nA [patch] that stops matching is SILENT: cargo warns on stderr "
            "and exits 0.\nRe-point the patch at the vendored path, or delete "
            "it if the fork is no longer needed.",
            file=sys.stderr,
        )
        return 1

    print("\nAll declared patches apply.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
