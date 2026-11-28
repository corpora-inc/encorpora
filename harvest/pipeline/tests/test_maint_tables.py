"""Troubleshooting tables (message | cause | solution): deterministic trees and signal patterns."""

from __future__ import annotations

import json
import re
import sqlite3

from harvest_pipeline.maint.tables import (build_table_pack, example_for, examples_for, html_blocks, message_regex,
                                           pattern_for, sentences)
from harvest_pipeline.pack import write_pack
from harvest_pipeline.stage import Stage

PAGE = b"""<html><body><div itemprop="articleBody"><section><h1>Arming checks<a class="headerlink">x</a></h1>
<p>The vehicle refuses to arm while a check fails.</p>
<div class="admonition warning"><p class="admonition-title">Warning</p><p>Never disable the checks.</p></div>
<table><caption><span class="caption-text">Failure messages</span></caption>
<thead><tr><th class="head"><p>Message</p></th><th class="head"><p>Cause</p></th><th class="head"><p>Solution</p></th></tr></thead>
<tbody>
<tr><td><p>Battery below minimum arming voltage</p></td><td><p>Battery voltage is below BATT_ARM_VOLT</p></td>
<td><p>Replace battery or adjust <a href="#"><span>BATT_ARM_VOLT</span></a>.</p></td></tr>
<tr><td><p>Compass X not healthy</p></td><td><p>Compass X is not providing data</p></td>
<td><p>Check the connection.  If failure continues replace autopilot.</p></td></tr>
<tr><td><p>SERVOx_MAX is less than SERVOx_TRIM</p></td><td><p>PWM output misconfigured</p></td>
<td><p>Set SERVOx_TRIM to be lower than SERVOx_MAX</p></td></tr>
<tr><td><p>FFT config MAXHZ xHz &gt; yHz</p></td><td><p>FFT misconfiguration</p></td><td></td></tr>
</tbody></table></section></div></body></html>"""


def test_blocks_keep_inline_text_without_spaces():
    rows = [b.cells for b in html_blocks(PAGE) if b.kind == "row"]
    assert rows[0] == ["Message", "Cause", "Solution"]
    assert rows[1][2] == "Replace battery or adjust BATT_ARM_VOLT."      # no space before the period
    kinds = [b.kind for b in html_blocks(PAGE)]
    assert "warning" in kinds and "caption" in kinds


def test_patterns_match_what_the_device_sends():
    cases = {
        "Battery below minimum arming voltage": ["PreArm: Battery below minimum arming voltage",
                                                 "Battery below minimum arming voltage",
                                                 "PreArm: Battery 1 below minimum arming voltage",   # the firmware's instance
                                                 "PreArm Battery 2 below minimum arming voltage."],
        "Compass X not healthy": ["PreArm: Compass 2 not healthy"],
        "SERVOx_MAX is less than SERVOx_TRIM": ["PreArm: SERVO3_MAX is less than SERVO3_TRIM"],
        "Board (Xv) out of range 4.3-5.8v": ["PreArm: Board (4.1v) out of range 4.3-5.8v"],
        "Check mag field (xy diff:x>875)": ["PreArm: Check mag field (xy diff:912>875)"],
        "FFT config MAXHZ xHz > yHz": ["PreArm: FFT config MAXHZ 400Hz > 250Hz"],
        "3D Accel calibration needed": ["PreArm: 3D Accel calibration needed"],
    }
    pats = {m: re.compile(pattern_for(m, "PreArm: ")[3:], re.I) for m in cases}
    for m, examples in cases.items():
        for ex in examples + examples_for(m, "PreArm: "):
            assert pats[m].match(ex), (m, ex)
            assert [o for o, p in pats.items() if o != m and p.match(ex)] == [], (m, ex)
    # an axis name is literal, a value after a colon is not
    assert "\\(z\\s+diff\\s*:?" in message_regex("Check mag field (z diff:x>875)")
    assert not pats["Compass X not healthy"].match("PreArm: Compass not healthy")
    # only regex syntax the core's engine takes: no escaped spaces or letters
    assert not re.search(r"\\[ a-zA-Z](?<!\\d)(?<!\\s)", pattern_for("Battery below minimum arming voltage", "PreArm: ")[3:]
                         .replace("\\d", "").replace("\\s", ""))


def test_sentences():
    assert sentences("Check the connection.  If failure continues replace autopilot.") == [
        "Check the connection.", "If failure continues replace autopilot."]
    assert sentences("Move compass. repeat calibration.") == ["Move compass. repeat calibration."]


def test_table_pack(tmp_path):
    stage = Stage(tmp_path / "s.sqlite")
    rec = {"source_id": "t", "title": "Arming checks", "publisher": "p", "url": "u", "edition": "e",
           "retrieved_at": "r", "sha256": "0", "media_type": "text/html", "license": "CC-BY-SA-3.0"}
    stage.add_source(rec)
    rep = build_table_pack(stage, rec, PAGE, {"id_prefix": "t", "signal_kind": "mavlink.statustext",
                                              "signal_prefix": "PreArm: "},
                           {2: {"synonyms": ["compass not working", "compass 7 dead"], "backend": "scripted",
                                "model_id": "x", "created_at": ""}})
    assert rep["rows"] == 4 and rep["trees"] == 3 and len(rep["unfit"]) == 1
    res = write_pack(stage, tmp_path / "pack", "t", "1", "t", None)
    db = sqlite3.connect(res["path"])
    assert db.execute("SELECT COUNT(*) FROM fault_tree").fetchone()[0] == 3
    chain = db.execute("SELECT n.text FROM fault_node n WHERE tree_id LIKE 't-compass%' AND kind='action' "
                       "ORDER BY node_id").fetchall()
    assert [c[0] for c in chain] == ["Check the connection.", "If failure continues replace autopilot."]
    for text, sec in db.execute("SELECT n.text, s.text FROM fault_node n JOIN section s USING (section_id)"):
        assert " ".join(text.split()) in " ".join(sec.split())
    syn = json.loads(db.execute("SELECT synonyms FROM symptom WHERE title LIKE 'Compass%'").fetchone()[0])
    assert syn == ["compass not working"]          # "compass 7 dead" names a number the row does not print
    # a row with a cause and no printed solution: no tree, but its message still resolves to its section
    row = db.execute("SELECT tree_id, node_id, section_id FROM signal_map WHERE title LIKE 'FFT%'").fetchone()
    assert row is not None and row[0] is None and row[1] is None and row[2]
    g = db.execute("SELECT s.kind, s.text FROM xref x JOIN section s ON s.section_id = x.from_id "
                   "WHERE x.kind='guards'").fetchone()
    assert g == ("warning", "Never disable the checks.")
