"""Unit tests for the Cargo [patch] integrity gate.

The gate's failure mode is to PASS wrongly — `cargo metadata` exits 0 whether or
not a patch applied — so the string matching below is the whole signal. These
tests pin it.
"""

from pathlib import Path

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


def test_non_path_patches_are_skipped(tmp_path: Path):
    """Only path patches are asserted; a git patch has no vendored dir to check."""
    manifest = tmp_path / "Cargo.toml"
    manifest.write_text(
        '[package]\nname = "x"\nversion = "0.1.0"\n\n'
        "[patch.crates-io]\n"
        'foo = { git = "https://example.invalid/foo" }\n',
        encoding="utf-8",
    )
    assert pi.patch_entries(manifest) == []
