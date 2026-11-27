from harvest_pipeline.model import subtree_text
from harvest_pipeline.parsers import parse
from harvest_pipeline.parsers.ecfr import _split_inline


def doc(ecfr_bytes):
    return parse("ecfr", ecfr_bytes, "src", {"title": 99, "part": "1999"})


def test_hierarchy_and_ids(ecfr_bytes):
    d = doc(ecfr_bytes)
    ids = d.by_id()
    assert d.roots[0].section_id == "99cfr1999-subpart-ZZ"
    assert ids["99cfr1999.10"].citation == "§1999.10"
    assert ids["99cfr1999.10"].heading == "Scope"
    assert ids["99cfr1999.10(b)(2)"].parent_id == "99cfr1999.10(b)"
    assert ids["99cfr1999.10(b)"].heading == "Exclusions"
    assert ids["99cfr1999.12(a)(1)"].citation == "§1999.12(a)(1)"
    assert d.warnings == []


def test_inline_heading_chains_split_into_paragraphs(ecfr_bytes):
    ids = doc(ecfr_bytes).by_id()
    # "(a) <I>Clearance.</I> (1) The operator ..."
    assert ids["99cfr1999.12(a)"].own_text == "(a) Clearance."
    assert ids["99cfr1999.12(a)(1)"].own_text.startswith("(1) The operator must keep")
    # "(b) <I>Riggers</I>—(1) <I>Training.</I> (i) A qualified rigger ..."
    assert ids["99cfr1999.12(b)"].heading == "Riggers"
    assert ids["99cfr1999.12(b)(1)"].heading == "Training"
    assert ids["99cfr1999.12(b)(1)(i)"].own_text.startswith("(i) A qualified rigger")
    assert ids["99cfr1999.12(b)(1)(ii)"].parent_id == "99cfr1999.12(b)(1)"


def test_ambiguous_i_resolved_by_sequence(ecfr_bytes):
    ids = doc(ecfr_bytes).by_id()
    # after (h)(1), "(i)" is the next letter because "(j)" follows
    assert "99cfr1999.12(i)" in ids
    assert "99cfr1999.12(h)(1)(i)" not in ids
    # after (k), "(i)" is a roman child because "(ii)" follows
    assert ids["99cfr1999.12(k)(i)"].parent_id == "99cfr1999.12(k)"
    assert ids["99cfr1999.12(k)(ii)(a)"].own_text == "(a) Italic level."


def test_tables_notes_figures_appendix(ecfr_bytes):
    ids = doc(ecfr_bytes).by_id()
    t = ids["99cfr1999.12-table-A"]
    assert t.kind == "table" and t.citation == "Table A to §1999.12"
    assert "over 50 to 200 | 15" in t.own_text
    note = ids["99cfr1999.12-note-1"]
    assert note.kind == "note" and "paint or tag" in note.own_text
    app = ids["99cfr1999-subpart-ZZ-appendix-A"]
    assert app.kind == "appendix"
    fig = ids["99cfr1999-subpart-ZZ-appendix-A-fig-1"]
    assert fig.meta["src"] == "https://www.ecfr.gov/graphics/fig1.gif"
    assert "Figure" not in subtree_text(app)        # figures do not enter ancestor text
    assert ids["99cfr1999-subpart-ZZ-appendix-A(a)"].citation.endswith("(a)")


def test_subtree_text_contains_descendants(ecfr_bytes):
    ids = doc(ecfr_bytes).by_id()
    text = subtree_text(ids["99cfr1999.10(b)"])
    assert text.split("\n") == ["(b) Exclusions. This subpart does not cover:", "(1) Hand-operated lifts.",
                                "(2) Conveyors."]
    assert subtree_text(ids["99cfr1999-subpart-ZZ"]) == "Subpart ZZ—Widget Hoists"   # heading only


def test_unmarked_paragraphs_stay_in_section(ecfr_bytes):
    ids = doc(ecfr_bytes).by_id()
    lines = ids["99cfr1999.11"].own_text.split("\n")
    assert lines[1].startswith("Gadget crane means")
    assert not [k for k in ids if k.startswith("99cfr1999.11(")]


def test_xrefs(ecfr_bytes):
    x = {(r.from_id, r.to_id, r.kind) for r in doc(ecfr_bytes).xrefs}
    assert ("99cfr1999.11", "99cfr1999.12(b)", "cites") in x
    assert ("99cfr1999.12(a)(2)", "99cfr1999.12-table-A", "cites") in x
    assert ("99cfr1999.12(c)", "99cfr1999.12(b)(1)(i)", "cites") in x
    assert ("99cfr1999.12(c)", "99cfr1999.12(b)(1)(ii)", "cites") in x
    assert ("99cfr1999.12(i)", "99cfr1999.10", "cites") in x
    assert ("99cfr1999.12(i)", "99cfr1999.11", "cites") in x
    assert ("99cfr1999.12(j)", "asme:B30.9-2014", "standard") in x
    assert not any(k == "cites" and f == t for f, t, k in x)


def test_split_inline():
    assert _split_inline("(c) Cabs—(1) Cab location. (i) Body text. See (i) here") == [
        "(c) Cabs—", "(1) Cab location.", "(i) Body text. See (i) here"]
    assert _split_inline("(2) Plain sentence with (a) inside") == ["(2) Plain sentence with (a) inside"]
