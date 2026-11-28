"""The fictional Model 40 utility pump manual: its content, written once.

The machine and its wording come from the engine's fixture (`harvest/core/src/fixture_maint.rs`),
laid out the way real maintenance manuals are: troubleshooting tables as flowcharts on two-page
spreads (question boxes, YES/NO branches, the four facet boxes, a facing-page test procedure
with its own warning, caution and note boxes), an initial-setup block, a symptom index, a
displayed-code table and ordinary numbered tasks. `make_pump40.py` draws the PDF and writes
the S1000D modules from this file, and `expected()` is the answer key: the pack the ingest must
produce, item by item, so precision and recall are exact.

Everything here is invented. No real equipment, organization or document is described.
"""

from __future__ import annotations

TITLE = "Model 40 Utility Pump Field Maintenance Manual"
EDITION = "Revision C, Change 1"

# ---- chapter 1 -------------------------------------------------------------------------------
CH1_TEXT = ("This manual covers the Model 40 utility pump in its diesel and electric variants. "
            "Read each warning and caution before you start a task.")
VARIANT_HEAD = ["Variant", "Model", "Serial numbers", "Drive"]
VARIANTS = [
    ["Model 40 diesel", "P40-D", "P40D-1000 to P40D-4999", "2-cylinder diesel engine"],
    ["Model 40 electric", "P40-E", "P40E-1000 to P40E-4999", "7.5 kW motor"],
]
RATED_FLOW = "Rated flow: 400 L/min."
SUPPLY = "Electric variant supply: 400 V three-phase."

# ---- chapter 3 -------------------------------------------------------------------------------
CH3_TEXT = ("Use the troubleshooting tables in this chapter in order. Answer each question, "
            "then follow the branch for the answer.")
CH3_WARNING = ("Stop the pump and remove the start key or lock out the supply before you open any cover. "
               "Rotating parts can cause serious injury.")
SYMPTOM_HEAD = ["Symptom", "Troubleshooting table", "Page"]
SYMPTOMS = [["Engine will not crank", "Table 3-1", "3-2"], ["Pump overheats", "Table 3-2", "3-6"]]
CODE_HEAD = ["Displayed code", "Meaning", "Perform troubleshooting"]
CODES = [
    ["SPN 110 FMI 0", "Engine coolant temperature above the shutdown limit.", "Table 3-2"],
    ["E21", "Motor winding temperature high.", "Table 3-2, Question 1"],
    ["SPN 168 FMI 1", "Battery voltage below the cranking limit.", "Table 3-1, Question 2"],
]

T1_TITLE = "Engine will not crank"
T1_APPLIES = "Diesel variant only."
T1_SETUP = [
    ("condition", "Equipment condition:", "Pump stopped, start key removed."),
    ("tool", "Tools:", "Digital multimeter, relay tester."),
    ("reference", "References:", "Wiring diagram, Figure 3-1."),
    ("personnel", "Personnel required:", "One technician."),
]
# What the setup lines resolve to, one requirement each (text is a verbatim part of the line).
T1_SETUP_ITEMS = [
    ("condition", "Pump stopped, start key removed."),
    ("tool", "Digital multimeter"),
    ("tool", "relay tester"),
    ("reference", "Wiring diagram, Figure 3-1."),
    ("personnel", "One technician."),
]

SYM1 = "The engine does not crank when the start key is turned to START."
Q1 = "Is the battery switch ON and is the 15 A start fuse F2 good?"
Q1_FACETS = {
    "test_option": ["Look at the switch.", "Pull F2 and check it with the multimeter."],
    "reason": ["A switch left OFF or a blown fuse stops all cranking current."],
    "known": ["The engine does not crank."],
    "possible": ["Battery switch off.", "Start fuse F2 blown.", "Battery discharged.", "Starter relay K1 failed."],
}
A1 = "Turn the battery switch ON or replace fuse F2, then try to start. Does the engine crank now?"
END1 = "The fault is corrected. Return the pump to service."
Q2 = "What is the battery voltage at terminals B+ and B- with the key OFF?"
Q2_FACETS = {
    "test_option": ["Measure at the battery terminals with the multimeter on DC volts."],
    "reason": ["Cranking needs a charged battery; below 11.5 V the starter cannot turn the engine."],
    "known": ["Battery switch ON.", "Fuse F2 good."],
    "possible": ["Battery discharged.", "Starter relay K1 failed.", "Starter motor failed."],
}
Q2_LABELS = ["Below 11.5 V", "11.5 V to 12.5 V", "12.5 V or more"]
A2 = "Replace the battery. Refer to task 4-3."
A3 = "Charge the battery, then repeat the voltage test."
RETRY_LABEL = "Repeat the test"
GO3 = "Go to Question 3, page 3-4."
FROM2 = "From Question 2, page 3-2."

TP2_TITLE = "Battery voltage test"
TP2_WARNING = "Batteries give off explosive gas. Keep sparks and flames away from the battery."
TP2_STEPS = ["Set the multimeter to DC volts.", "Place the red lead on B+ and the black lead on B-.",
             "Read the voltage with the key OFF."]
TP2_CAUTION = "Do not let the meter leads touch each other or the frame while they are on the battery terminals."
TP2_NOTE = "A battery that was just charged reads high for about an hour. Wait before you test it."
FIG31 = ("Figure 3-1. Starting circuit wiring: battery, battery switch, fuse F2, key switch, starter relay K1, "
         "starter motor.")

Q3 = "Is more than 10 V present at starter relay K1 terminal 86 when the key is turned to START?"
Q3_FACETS = {
    "reason": ["Voltage at terminal 86 shows the key switch and wiring deliver the start signal."],
    "known": ["Battery OK.", "Fuse OK."],
    "possible": ["Starter relay K1 failed.", "Starter motor failed.", "Key switch or wiring open."],
}
E3 = "Key switch or wiring fault. Refer to field maintenance for wiring repair."
Q4 = "Test starter relay K1 with the relay tester."
Q4_FACETS = {
    "reason": ["A relay that passes the test points to the starter motor."],
    "known": ["Start signal present at K1."],
    "possible": ["Starter relay K1 failed.", "Starter motor failed."],
}
E4P = "Starter motor fault. Send the starter motor to the repair shop."
A4F = "Replace starter relay K1."

TP4_TITLE = "Starter relay test"
TP4_TOOLS = "Relay tester."
TP4_STEPS = ["Remove starter relay K1 from its socket.", "Insert K1 in the relay tester and press TEST.",
             "Read the PASS or FAIL lamp on the tester."]
TP4_CAUTION = "Do not bridge relay terminals with a bare wire. Use the relay tester only."

T2_TITLE = "Pump overheats"
T2_APPLIES = "All variants."
T2_W1 = "Do not open the radiator cap while the engine is hot. Hot coolant can cause burns."
T2_W1_APPLIES = "Diesel variant."
T2_W2 = "Lock out the electrical supply before you open the motor terminal box."
T2_W2_APPLIES = "Electric variant."
SYM2 = "The high temperature lamp is on or the controller shows a high temperature code."
H1 = "Is the intake strainer clear of debris?"
H1_FACETS = {
    "reason": ["A blocked strainer starves the pump and it heats up."],
    "possible": ["Intake strainer blocked.", "Cooling fan belt loose or broken.", "Internal cooling fault."],
}
H1N = "Clean the intake strainer."
H2 = "What is the condition of the cooling fan belt: tight, loose or broken?"
H2_FACETS = {"possible": ["Cooling fan belt loose or broken.", "Internal cooling fault."]}
H2_LABELS = ["TIGHT", "LOOSE", "BROKEN"]
H2T = "Internal cooling fault. Report to the field maintenance shop."
H2L = "Adjust the belt tension."
H2B = "Replace the cooling fan belt."

TPH2_TITLE = "Belt condition check"
TPH2_WARNING = "Stop the pump before you touch the belt. The fan can cut fingers."
TPH2_STEPS = ["Open the fan guard.", "Press the belt midway between the pulleys.",
              "Look for cracks, fraying or missing pieces."]
TPH2_NOTE = "A tight belt moves no more than 15 mm when pressed."
FIG32 = "Figure 3-2. Cooling fan belt: 1 fan pulley, 2 belt, 3 crank pulley."

# ---- chapter 4 -------------------------------------------------------------------------------
CH4_TEXT = "Chapter 4 lists the maintenance tasks for the Model 40 utility pump."
T43_TITLE = "Battery replacement"
T43_APPLIES = "Diesel variant only."
T43_SETUP = [
    ("tool", "Tools:", "10 mm wrench, battery lifting strap."),
    ("part", "Parts:", "Battery, 12 V, 100 Ah (P40-118), quantity 1."),
    ("consumable", "Consumables:", "Terminal grease."),
    ("personnel", "Personnel required:", "Two technicians."),
]
T43_SETUP_ITEMS = [
    ("tool", "10 mm wrench"), ("tool", "battery lifting strap"),
    ("part", "Battery, 12 V, 100 Ah"), ("consumable", "Terminal grease."), ("personnel", "Two technicians."),
]
T43_STEPS = [
    "Turn the battery switch OFF.",
    "Disconnect the negative cable first, then the positive cable.",
    "Remove the hold-down clamp and lift out the battery.",
    "Install the new battery. Connect the positive cable first, then the negative cable.",
    "Tighten the terminal nuts to 6 N.m. Coat the terminals with terminal grease.",
    "Record the date code of the new battery.",
]
T43_CAUTION = "Disconnect the negative cable first to prevent a short circuit."
T43_WARNING = "The battery weighs 28 kg. Use two people and the lifting strap to lift it."

FACET_HEADINGS = {"test_option": "TEST OPTIONS", "reason": "REASON FOR QUESTION", "known": "KNOWN INFO",
                  "possible": "POSSIBLE PROBLEMS"}


def expected() -> dict:
    """The answer key: what a correct ingest of the PDF yields, by text (ids are the pipeline's)."""
    def facets(node: str, groups: dict) -> list[dict]:
        return [{"node": node, "facet": f, "ord": i, "text": t}
                for f, texts in groups.items() for i, t in enumerate(texts, 1)]

    trees = [
        {
            "title": T1_TITLE, "entry": SYM1, "applies": ["Model 40 diesel"],
            "nodes": [
                {"text": SYM1, "kind": "symptom", "expect": {"kind": "ack"}},
                {"text": Q1, "kind": "check", "expect": {"kind": "yes_no"}},
                {"text": A1, "kind": "action", "expect": {"kind": "yes_no"}},
                {"text": END1, "kind": "end", "expect": None},
                {"text": Q2, "kind": "check", "expect": {"kind": "value", "unit": "V"}, "proc": TP2_TITLE},
                {"text": A2, "kind": "action", "expect": None, "target": "procedure:" + T43_TITLE},
                {"text": A3, "kind": "action", "expect": {"kind": "ack"}},
                {"text": Q3, "kind": "check", "expect": {"kind": "yes_no"}},
                {"text": E3, "kind": "escalate", "expect": None},
                {"text": Q4, "kind": "check", "expect": {"kind": "pass_fail"}, "proc": TP4_TITLE},
                {"text": E4P, "kind": "escalate", "expect": None},
                {"text": A4F, "kind": "action", "expect": None},
            ],
            "edges": [
                {"from": SYM1, "label": "continue", "to": Q1},
                {"from": Q1, "label": "yes", "to": Q2}, {"from": Q1, "label": "no", "to": A1},
                {"from": A1, "label": "yes", "to": END1}, {"from": A1, "label": "no", "to": Q2},
                {"from": Q2, "label": "<11.5", "to": A2}, {"from": Q2, "label": "11.5..12.5", "to": A3},
                {"from": Q2, "label": ">=12.5", "to": Q3},
                {"from": A3, "label": "retry", "to": Q2, "retry": True},
                {"from": Q3, "label": "yes", "to": Q4}, {"from": Q3, "label": "no", "to": E3},
                {"from": Q4, "label": "pass", "to": E4P}, {"from": Q4, "label": "fail", "to": A4F},
            ],
            "facets": facets(Q1, Q1_FACETS) + facets(Q2, Q2_FACETS) + facets(Q3, Q3_FACETS)
            + facets(Q4, Q4_FACETS),
            "setup": [{"kind": k, "text": t} for k, t in T1_SETUP_ITEMS],
        },
        {
            "title": T2_TITLE, "entry": SYM2, "applies": [],
            "nodes": [
                {"text": SYM2, "kind": "symptom", "expect": {"kind": "ack"}},
                {"text": H1, "kind": "check", "expect": {"kind": "yes_no"}},
                {"text": H1N, "kind": "action", "expect": None},
                {"text": H2, "kind": "check", "expect": {"kind": "choice", "options": ["tight", "loose", "broken"]},
                 "proc": TPH2_TITLE},
                {"text": H2T, "kind": "escalate", "expect": None},
                {"text": H2L, "kind": "action", "expect": None},
                {"text": H2B, "kind": "action", "expect": None},
            ],
            "edges": [
                {"from": SYM2, "label": "continue", "to": H1},
                {"from": H1, "label": "yes", "to": H2}, {"from": H1, "label": "no", "to": H1N},
                {"from": H2, "label": "tight", "to": H2T}, {"from": H2, "label": "loose", "to": H2L},
                {"from": H2, "label": "broken", "to": H2B},
            ],
            "facets": facets(H1, H1_FACETS) + facets(H2, H2_FACETS),
            "setup": [],
        },
    ]
    procedures = [
        {"title": TP2_TITLE, "steps": TP2_STEPS, "requirements": []},
        {"title": TP4_TITLE, "steps": TP4_STEPS, "requirements": [{"kind": "tool", "text": "Relay tester."}]},
        {"title": TPH2_TITLE, "steps": TPH2_STEPS, "requirements": []},
        {"title": T43_TITLE, "steps": T43_STEPS, "requirements": [{"kind": k, "text": t} for k, t in T43_SETUP_ITEMS],
         "applies": ["Model 40 diesel"]},
    ]
    # guard text -> the text of what it guards (a step, a procedure title, a tree title, a node, a chapter)
    guards = [
        {"kind": "warning", "text": CH3_WARNING, "guards": "heading:CHAPTER 3. TROUBLESHOOTING"},
        {"kind": "warning", "text": TP2_WARNING, "guards": "procedure:" + TP2_TITLE},
        {"kind": "caution", "text": TP2_CAUTION, "guards": "step:" + TP2_STEPS[1]},
        {"kind": "note", "text": TP2_NOTE, "guards": "step:" + TP2_STEPS[2]},
        {"kind": "caution", "text": TP4_CAUTION, "guards": "step:" + TP4_STEPS[1]},
        {"kind": "warning", "text": T2_W1, "guards": "tree:" + T2_TITLE, "applies": ["Model 40 diesel"]},
        {"kind": "warning", "text": T2_W2, "guards": "tree:" + T2_TITLE, "applies": ["Model 40 electric"]},
        {"kind": "warning", "text": TPH2_WARNING, "guards": "procedure:" + TPH2_TITLE},
        {"kind": "note", "text": TPH2_NOTE, "guards": "step:" + TPH2_STEPS[1]},
        {"kind": "caution", "text": T43_CAUTION, "guards": "step:" + T43_STEPS[1]},
        {"kind": "warning", "text": T43_WARNING, "guards": "step:" + T43_STEPS[2]},
    ]
    symptoms = [{"title": s, "tree": t} for s, t in ((SYMPTOMS[0][0], T1_TITLE), (SYMPTOMS[1][0], T2_TITLE))]
    signals = [
        {"kind": "j1939.dm1", "pattern": "spn:110/fmi:0", "tree": T2_TITLE, "node": None},
        {"kind": "display", "pattern": "E21", "tree": T2_TITLE, "node": H1},
        {"kind": "j1939.dm1", "pattern": "spn:168/fmi:1", "tree": T1_TITLE, "node": Q2},
    ]
    equipment = [
        {"name": "Model 40 utility pump", "parent": None},
        {"name": "Model 40 diesel", "parent": "Model 40 utility pump",
         "ident": [("model", "P40-D"), ("serial_range", "P40D-1000..P40D-4999")]},
        {"name": "Model 40 electric", "parent": "Model 40 utility pump",
         "ident": [("model", "P40-E"), ("serial_range", "P40E-1000..P40E-4999")]},
    ]
    return {"format": "maint-expected/1", "trees": trees, "procedures": procedures, "guards": guards,
            "symptoms": symptoms, "signals": signals, "equipment": equipment}
