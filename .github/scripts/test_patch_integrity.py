"""Unit tests for the Cargo [patch] integrity gate.

The gate's failure mode is to PASS wrongly — `cargo metadata` exits 0 whether or
not a patch applied — so the string matching below is the whole signal. These
tests pin it.
"""

from pathlib import Path

import pytest

import patch_integrity as pi


def test_unused_stanza_detected():
    lock = """
version = 3

[[package]]
name = "llama-cpp-sys-2"
version = "0.1.146"

[[patch.unused]]
name = "llama-cpp-sys-2"
version = "0.1.146"
"""
    assert pi.has_unused_patch_stanza(lock) is True


def test_clean_lock_has_no_unused_stanza():
    lock = '\nversion = 3\n\n[[package]]\nname = "serde"\nversion = "1.0.0"\n'
    assert pi.has_unused_patch_stanza(lock) is False


def test_unused_stanza_must_start_a_line():
    """A mention inside a comment or a name is not a stanza."""
    lock = '# see [[patch.unused]] in the cargo book\nname = "x"\n'
    assert pi.has_unused_patch_stanza(lock) is False


def test_unused_patch_warning_is_read_from_stderr():
    stderr = (
        "    Updating crates.io index\n"
        "warning: Patch `llama-cpp-sys-2 v0.1.146 (/repo/vendor/llama-cpp-sys-2)` "
        "was not used in the crate graph.\n"
        "Check that the patched package version and available features are "
        "compatible\n"
    )
    hits = pi.unused_patch_warnings(stderr)
    assert len(hits) == 1
    assert "llama-cpp-sys-2" in hits[0]


def test_unused_patch_warning_matches_current_cargo_wording():
    """Verbatim from cargo 1.93 — lowercase `patch`, no trailing period.

    The wording has drifted (older cargo capitalised it and ended with a full
    stop), which is why the matcher keys on the invariant phrase alone.
    """
    stderr = (
        "warning: patch `libc v0.1.0 (/repo/vendor/libc)` was not used in the "
        "crate graph\n"
    )
    assert len(pi.unused_patch_warnings(stderr)) == 1


def test_quiet_stderr_yields_no_warning():
    assert pi.unused_patch_warnings("    Updating crates.io index\n") == []


def test_patch_entries_resolves_relative_paths(tmp_path: Path):
    manifest = tmp_path / "src-tauri" / "Cargo.toml"
    manifest.parent.mkdir(parents=True)
    manifest.write_text(
        '[package]\nname = "app"\nversion = "0.1.0"\n\n'
        "[patch.crates-io]\n"
        'llama-cpp-sys-2 = { path = "vendor/llama-cpp-sys-2" }\n',
        encoding="utf-8",
    )
    entries = pi.patch_entries(manifest)
    assert entries == [
        (
            "crates-io",
            "llama-cpp-sys-2",
            (tmp_path / "src-tauri" / "vendor" / "llama-cpp-sys-2").resolve(),
        )
    ]


def test_patch_entries_empty_without_a_patch_section(tmp_path: Path):
    manifest = tmp_path / "Cargo.toml"
    manifest.write_text('[package]\nname = "x"\nversion = "0.1.0"\n', encoding="utf-8")
    assert pi.patch_entries(manifest) == []


def _write(manifest: Path, patch_body: str) -> Path:
    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text(
        '[package]\nname = "x"\nversion = "0.1.0"\n\n' + patch_body, encoding="utf-8"
    )
    return manifest


GIT_PATCH = '[patch.crates-io]\nfoo = { git = "https://example.invalid/foo" }\n'


def test_patch_entries_skips_non_path_specs(tmp_path: Path):
    """Assertion 3 is path-only — a git patch names no vendored dir to compare."""
    manifest = _write(tmp_path / "Cargo.toml", GIT_PATCH)
    assert pi.patch_entries(manifest) == []


def test_has_any_patch_sees_a_git_patch(tmp_path: Path):
    """The metadata run is gated on this, NOT on patch_entries."""
    assert pi.has_any_patch(_write(tmp_path / "Cargo.toml", GIT_PATCH)) is True


def test_has_any_patch_sees_a_version_only_patch(tmp_path: Path):
    body = '[patch.crates-io]\nfoo = { version = "1.0.0" }\n'
    assert pi.has_any_patch(_write(tmp_path / "Cargo.toml", body)) is True


def test_has_any_patch_false_without_a_patch_section(tmp_path: Path):
    assert pi.has_any_patch(_write(tmp_path / "Cargo.toml", "")) is False


def test_has_any_patch_false_for_an_empty_patch_table(tmp_path: Path):
    assert pi.has_any_patch(_write(tmp_path / "Cargo.toml", "[patch.crates-io]\n")) is False


def test_git_only_patch_still_gets_a_metadata_run(tmp_path: Path, monkeypatch):
    """The fail-open this gate exists to prevent: a git patch skipped entirely.

    `check_manifest` used to return before running `cargo metadata` whenever no
    PATH patch was declared, so a git patch that stopped applying passed
    silently — the same outcome as having no gate.
    """
    manifest = _write(tmp_path / "src-tauri" / "Cargo.toml", GIT_PATCH)
    calls = []

    def fake_metadata(path):
        calls.append(path)
        return (
            {"packages": []},
            "warning: patch `foo v1.0.0 (https://example.invalid/foo)` was not "
            "used in the crate graph\n",
            0,
        )

    monkeypatch.setattr(pi, "cargo_metadata", fake_metadata)
    failures = pi.check_manifest(manifest, tmp_path)

    assert calls == [manifest], "cargo metadata must run for a git-only patch"
    assert len(failures) == 1
    assert "unapplied patch" in failures[0]


def test_no_patch_section_runs_no_metadata(tmp_path: Path, monkeypatch):
    """The early return still applies when there is genuinely nothing to check."""
    manifest = _write(tmp_path / "Cargo.toml", "")
    monkeypatch.setattr(
        pi, "cargo_metadata", lambda p: pytest.fail("metadata must not run")
    )
    assert pi.check_manifest(manifest, tmp_path) == []


def test_locked_failure_is_reported_not_swallowed(tmp_path: Path, monkeypatch):
    """`cargo metadata --locked` exits 101 when the lock would have to move.

    Measured on cargo 1.93.1: an unused patch against a clean lock emits the
    stderr warning AND exits 101. Both lines must surface.
    """
    manifest = _write(tmp_path / "Cargo.toml", GIT_PATCH)
    monkeypatch.setattr(
        pi,
        "cargo_metadata",
        lambda p: (
            None,
            "warning: patch `foo v1.0.0 (https://example.invalid/foo)` was not "
            "used in the crate graph\n"
            "error: cannot update the lock file ... because --locked was passed\n",
            101,
        ),
    )
    failures = pi.check_manifest(manifest, tmp_path)
    assert len(failures) == 2
    assert "unapplied patch" in failures[0]
    assert "exited 101" in failures[1]
