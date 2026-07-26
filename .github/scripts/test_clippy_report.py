"""Unit tests for the clippy diagnostic renderer / counter."""

import io
import json

import clippy_report as cr


def _msg(level, code, file_name, line, text, rendered=None):
    return json.dumps(
        {
            "reason": "compiler-message",
            "message": {
                "level": level,
                "code": {"code": code} if code else None,
                "message": text,
                "rendered": rendered or f"{level}: {text}\n",
                "spans": [
                    {
                        "is_primary": True,
                        "file_name": file_name,
                        "line_start": line,
                        "column_start": 1,
                    }
                ],
            },
        }
    )


def test_same_warning_from_two_targets_counts_once():
    """`--all-targets` re-emits a lib warning for the lib-test target."""
    stream = io.StringIO(
        "\n".join(
            [
                _msg("warning", "unused_imports", "src/lib.rs", 3, "unused import"),
                _msg("warning", "unused_imports", "src/lib.rs", 3, "unused import"),
            ]
        )
    )
    out = io.StringIO()
    assert cr.process(stream, out) == (1, 0)
    assert out.getvalue().count("unused import") == 1


def test_distinct_warnings_are_counted_separately():
    stream = io.StringIO(
        "\n".join(
            [
                _msg("warning", "unused_imports", "src/lib.rs", 3, "unused import"),
                _msg("warning", "dead_code", "src/net.rs", 49, "field never read"),
            ]
        )
    )
    assert cr.process(stream, io.StringIO()) == (2, 0)


def test_errors_are_counted_apart_from_warnings():
    stream = io.StringIO(
        _msg("error", "E0308", "src/lib.rs", 10, "mismatched types")
        + "\n"
        + _msg("warning", "dead_code", "src/lib.rs", 20, "never read")
    )
    assert cr.process(stream, io.StringIO()) == (1, 1)


def test_non_diagnostic_records_are_ignored():
    stream = io.StringIO(
        json.dumps({"reason": "compiler-artifact", "target": {"name": "corpan"}})
        + "\n"
        + json.dumps({"reason": "build-finished", "success": True})
    )
    assert cr.process(stream, io.StringIO()) == (0, 0)


def test_interleaved_non_json_lines_do_not_abort_the_stream():
    """Cargo progress on a merged stream must not stop the count."""
    stream = io.StringIO(
        "   Compiling corpan v0.20.6\n"
        + _msg("warning", "dead_code", "src/lib.rs", 20, "never read")
        + "\nnot json at all\n"
        + _msg("warning", "unused_mut", "src/lib.rs", 30, "unused mut")
        + "\n"
    )
    assert cr.process(stream, io.StringIO()) == (2, 0)


def test_note_level_is_not_counted():
    stream = io.StringIO(_msg("note", None, "src/lib.rs", 1, "an aside"))
    assert cr.process(stream, io.StringIO()) == (0, 0)
