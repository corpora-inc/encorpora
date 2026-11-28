"""Maintenance logs: a source's house style induced from the source itself, records read by element,
units, dates and slips resolved only on evidence."""

from __future__ import annotations

import datetime as dt
from types import SimpleNamespace

import pytest


def test_log_columns_induced_and_refused():
    from harvest_pipeline.maint.logschema import SourceNotUnderstood, induce_columns
    fleet = SimpleNamespace(assets={"SV-201": {"serial": "1202"}, "SV-202": {"serial": "1023"}},
                            parts={"40-1234-5": "Filter"})
    rows = [{"Date": "7/2/24", "Unit #": "201", "Complaint": "overheats", "Fix": "replaced thermostat",
             "Part #": "40-1234-5", "Hrs": "5,697"},
            {"Date": "7/13/24", "Unit #": "sv202", "Complaint": "no crank", "Fix": "charged the battery", "Part #": "",
             "Hrs": "5344"}]
    cmap, rep = induce_columns(list(rows[0]), rows, fleet)
    assert cmap["date"] == "Date" and cmap["date_format"] == "%m/%d/%y" and cmap["unit"] == "Unit #"
    assert cmap["hours"] == "Hrs" and cmap["part"] == "Part #" and cmap["symptom"] == "Complaint"
    with pytest.raises(SourceNotUnderstood):
        induce_columns(["a", "b"], [{"a": "x", "b": "y"}], fleet)


def test_log_entries_dates_and_units_from_free_text():
    from harvest_pipeline.maint.logschema import entries, parse_date, unit_index, units_in
    idx = unit_index({"SV-207": {"serial": "1050"}, "SV-212": {"serial": "2001"}})
    aar = ("SITE VISIT REPORT\nVISIT, 13APR26 - 22APR26\n\n2. Findings.\n"
           "   a. Day 2: SV-207 (no start). Hour meter read 8116.\n   b. Day 6: sv 212 (low battery).\n")
    e = entries(aar, idx)
    assert [parse_date(x[3]) for x in e] == [dt.date(2026, 4, 14), dt.date(2026, 4, 18)]
    shift = "== 10JUL24 NIGHT ==\n1810  SV-207 cranks no start. 5718 hrs. - JC\n2200  SV-212 oil leak\n"
    assert [x[3] for x in entries(shift, idx)] == ["10JUL24", "10JUL24"]
    assert units_in("UNIT ¢V-212 HRS 1050", idx) == [("¢V-212", "SV-212")]   # damaged prefix; 1050 is hours



def test_unit_typos_need_exactly_one_unit():
    from harvest_pipeline.maint.logschema import typo_candidates, unit_index
    idx = unit_index({"SV-207": {}, "SS-215": {}, "SV-230": {}, "SV-213": {}})
    assert typo_candidates("SV-2O7", idx) == ["SV-207"]          # O for 0
    assert typo_candidates("S5-215", idx) == ["SS-215"]          # 5 for S
    assert typo_candidates("SV 2300", idx) == ["SV-230"]         # a digit written twice
    assert typo_candidates("SV-308", idx) == []                  # not one slip from any unit


def test_structured_log_sources_one_record_per_element():
    from harvest_pipeline.maint.logstruct import (delimited_records, header_date, json_records, local_date,
                                                   partial_date, xml_records)
    j = json_records('{"log": "1", "unit": {"sn": "9009"}, "items": [{"text": "A"}, {"text": "B"}]}\n'
                     '{"log": "2", "unit": {"sn": "9010"}}\n')
    assert len(j) == 2 and j[0][1]["unit.sn"] == "9009" and j[0][1]["items[].text"] == "A; B" and j[1][0] > 0
    x = xml_records('<E><Rec no="1"><Machine serial="9009"/><Gauge type="HRS" value="12.5"/><Complaint>hot</Complaint>'
                    '</Rec><Rec no="2"><Machine serial="9010"/></Rec></E>')
    assert len(x) == 2 and x[0][1]["Gauge[HRS]@value"] == "12.5" and x[0][1]["Machine@serial"] == "9009"
    d = delimited_records("LOG TITLE\t\t\nUNIT\t\tDATE\nFleet no\tS/N\tdd/mm/yy\nUNIT 23\t52015\t05/05/24\n"
                          "UNIT 03\t5033\t06/05/24\n")
    assert len(d) == 2 and d[0][1]["UNIT / Fleet no"] == "UNIT 23" and d[0][1]["DATE / dd/mm/yy"] == "05/05/24"
    import datetime as _dt
    assert local_date("2024-05-08T23:30:00Z", _dt.timedelta(hours=1)) == "2024-05-09"   # after local midnight
    assert local_date("2024-05-08T23:30:00+01:00", None) == "2024-05-08"
    a = header_date("From: x\nDate: Sat, 18 May 2024 18:25:00 +0800\n")
    assert a == _dt.date(2024, 5, 18) and partial_date("- UNIT 14: 18/5 0650", a) == _dt.date(2024, 5, 18)


def test_role_induction_counts_every_record():
    from harvest_pipeline.maint.logschema import induce_columns
    fleet = SimpleNamespace(assets={"SV-201": {"serial": "1202"}, "SV-202": {"serial": "1023"}}, parts={})
    rows = [{"raised": "2024-05-0%dT10:00:00+01:00" % (k + 1), "due": "", "unit": "SV-201", "hrs": "45%d0.0" % k,
             "time": "2345"} for k in range(5)]
    rows[0]["due"] = "2024-06-01"
    cmap, _ = induce_columns(list(rows[0]), rows, fleet)
    assert cmap["date"] == "raised"            # a column most records leave empty does not read as the date
    assert cmap["hours"] == "hrs"              # "2345" in every record is a time of day, not a meter reading
