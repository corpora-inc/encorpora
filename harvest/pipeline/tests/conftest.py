"""Shared fixtures. All fixture documents are synthetic text written for these tests."""

from __future__ import annotations

import textwrap
from pathlib import Path

import pytest

ECFR_XML = """<?xml version="1.0"?>
<DIV6 N="ZZ" TYPE="SUBPART" hierarchy_metadata="{&quot;path&quot;:&quot;/on/x/title-99/part-1999/subpart-ZZ&quot;}">
<HEAD>Subpart ZZ&#x2014;Widget Hoists</HEAD>
<DIV8 N="1999.10" TYPE="SECTION">
<HEAD>&#xA7; 1999.10 Scope.</HEAD>
<P>(a) This subpart applies to widget hoists and gadget cranes used at a work site.</P>
<P>(b) <I>Exclusions.</I> This subpart does not cover:</P>
<P>(1) Hand-operated lifts.</P>
<P>(2) Conveyors.</P>
<CITA TYPE="N">[1 FR 1, Jan. 1, 2000]</CITA>
</DIV8>
<DIV8 N="1999.11" TYPE="SECTION">
<HEAD>&#xA7; 1999.11 Definitions.</HEAD>
<P><I>Gadget crane</I> means a machine that lifts and swings a suspended load.</P>
<P><I>Qualified rigger</I> means a rigger who meets the criteria in &#xA7; 1999.12(b).</P>
</DIV8>
<DIV8 N="1999.12" TYPE="SECTION">
<HEAD>&#xA7; 1999.12 Clearance and inspection.</HEAD>
<P>(a) <I>Clearance.</I> (1) The operator must keep the boom at least 20 feet from an energized line rated up to 50 kV.</P>
<P>(2) For lines over 50 kV, use the distances in Table A of this section.</P>
<P>(b) <I>Riggers</I>&#x2014;(1) <I>Training.</I> (i) A qualified rigger must complete training every 12 months.</P>
<P>(ii) Training records must be kept.</P>
<P>(c) Equipment inspected under paragraphs (b)(1)(i) and (ii) of this section must be marked.</P>
<P>(d) Reserved.</P>
<P>(e) Reserved.</P>
<P>(f) Reserved.</P>
<P>(g) Reserved.</P>
<P>(h) Each inspection must cover:</P>
<P>(1) The hoist rope.</P>
<P>(i) The hook latch, as required by &#xA7;&#xA7; 1999.10 through 1999.11.</P>
<P>(j) Wire rope meeting ASME B30.9-2014 is acceptable.</P>
<P>(k) Load blocks:</P>
<P>(i) Must be marked with their weight.</P>
<P>(ii) Must be inspected monthly.</P>
<P>(<I>a</I>) Italic level.</P>
<NOTE>
<HED>Note to paragraph (k):</HED>
<P>Marking may be by paint or tag.</P>
</NOTE>
<DIV width="100%"><DIV class="gpotbl_div">
<TABLE border="1">
<CAPTION><P class="title">Table A&#x2014;Distances</P></CAPTION>
<THEAD><TR><TH>Voltage (kV)</TH><TH>Distance (feet)</TH></TR></THEAD>
<TBODY>
<TR><TD>over 50 to 200</TD><TD>15</TD></TR>
<TR><TD>over 200 to 350</TD><TD>20</TD></TR>
</TBODY>
</TABLE>
</DIV></DIV>
</DIV8>
<DIV9 N="Appendix A to Subpart ZZ of Part 1999" TYPE="APPENDIX">
<HEAD>Appendix A to Subpart ZZ of Part 1999&#x2014;Hand Signals</HEAD>
<img src="/graphics/fig1.gif"/>
<P>(a) Signals follow the chart in this appendix.</P>
</DIV9>
</DIV6>
"""


@pytest.fixture
def ecfr_bytes() -> bytes:
    return ECFR_XML.encode()


@pytest.fixture(autouse=True)
def harvest_home(tmp_path, monkeypatch) -> Path:
    home = tmp_path / "harvest-home"
    monkeypatch.setenv("HARVEST_HOME", str(home))
    monkeypatch.setenv("HARVEST_BUILT_AT", "2026-01-01T00:00:00+00:00")
    monkeypatch.setenv("HARVEST_TEST_EMBEDDER", "1")   # the hash-test embedder may write vectors in tests only
    monkeypatch.delenv("HARVEST_SIGNING_KEY", raising=False)
    monkeypatch.delenv("HARVEST_SIGNING_KEY_FILE", raising=False)
    return home


@pytest.fixture
def corpus_dir(tmp_path, ecfr_bytes) -> Path:
    d = tmp_path / "corpus"
    d.mkdir()
    (d / "raw").mkdir()
    (d / "raw" / "zz.xml").write_bytes(ecfr_bytes)
    (d / "corpus.yaml").write_text(textwrap.dedent("""
        corpus_id: test-corpus
        pack_id: test-pack
        version: 2026.01.01-1
        sources:
          - id: ecfr-99-1999-zz
            title: Test Subpart ZZ
            publisher: Test Publisher
            url: https://example.invalid/zz
            license: public-domain-us-gov
            parser: ecfr
            parser_options: {title: 99, part: "1999"}
            fetch: {kind: file, path: raw/zz.xml}
            edition: test-1
        equipment:
          - {id: widget-hoist, name: Widget hoist, aliases: [widget lift]}
          - {id: gadget-crane, name: Gadget crane}
        tasks: [terms, facts]
        profiles:
          test:
            author: {backend: scripted, model: author}
            judge: {backend: scripted, model: judge}
            cache_dir: cache/test
        default_profile: test
        embedder: {kind: hash-test, dim: 64}
    """))
    return d
