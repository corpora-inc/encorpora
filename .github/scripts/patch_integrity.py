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
2. `cargo metadata` for each patching manifest emits no "was not used in the
   crate graph" warning. This is the load-bearing one — `cargo metadata` exits
   0 either way, so the *only* signal is the stderr text.
3. Every patched package resolves in the graph to the vendored path the patch
   declares, not to a registry copy.

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


def patch_entries(manifest: Path) -> list[tuple[str, str, Path]]:
    """(registry, crate, resolved path) for every path-based patch in a manifest.

    Patches that are not path-based (git, version-only) are returned with a
    path of ``None`` by the caller's contract — none exist in this repo today,
    so they are skipped rather than guessed at.
    """
    data = tomllib.loads(manifest.read_text(encoding="utf-8"))
    out: list[tuple[str, str, Path]] = []
    for registry, crates in (data.get("patch") or {}).items():
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


def cargo_metadata(manifest: Path) -> tuple[dict, str]:
    """Full (dependency-resolving) metadata plus cargo's stderr.

    `--no-deps` would skip resolution entirely, which is exactly the step that
    decides whether a patch applies — so it must not be used here.
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
        raise SystemExit(
            f"cargo metadata failed for {manifest} (exit {proc.returncode}):\n"
            f"{proc.stderr}"
        )
    return json.loads(proc.stdout), proc.stderr


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
    entries = patch_entries(manifest)
    if not entries:
        return failures

    metadata, stderr = cargo_metadata(manifest)

    for line in unused_patch_warnings(stderr):
        failures.append(f"{rel}: cargo reported an unapplied patch: {line}")

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
    patching = [m for m in manifests if patch_entries(m)]
    if not patching:
        print("  (no manifest declares a path-based [patch])")
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
