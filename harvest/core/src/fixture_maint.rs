//! A fictional maintenance manual as a signed pack, for tests and for app
//! development with no real manual (`harvest fixture <dir> --maint`).
//!
//! The machine is invented: a "Model 40 utility pump" in a diesel and an
//! electric variant. Two fault trees (one with a measured-value branch, one
//! entered from a machine signal), warnings, cautions and notes guarding
//! steps, a test procedure on a node, a maintenance task with tools and
//! parts, tree-level setup, facets, depth levels, page and figure labels,
//! fleet history and failure modes. The signing key is the public fixture
//! key: never trust it outside tests.

use crate::embed::{Embedder, HashingEmbedder};
use crate::error::Result;
use crate::fixture::{EMBED_DIM, seal, signing_key, write_manifest};
use crate::maint::SCHEMA_MAINT;
use crate::pack::SCHEMA_V1;
use rusqlite::{Connection, params};
use serde_json::{Value, json};
use std::fs;
use std::path::Path;

pub const PACK_ID: &str = "pump40";
pub const DB_FILE: &str = "pump40.sqlite";
const SRC: &str = "m40-manual";
const PROV: &str = "prov-pump40";

/// Sections: (id, parent, kind, citation, heading, text, page, figure).
type Sec = (
    &'static str,
    Option<&'static str>,
    &'static str,
    &'static str,
    Option<&'static str>,
    &'static str,
    Option<&'static str>,
    Option<&'static str>,
);

pub const SECTIONS: &[Sec] = &[
    (
        "m40.1",
        None,
        "chapter",
        "Chapter 1",
        Some("General"),
        "This manual covers the Model 40 utility pump in its diesel and electric variants. Read each warning and caution before you start a task.",
        Some("1-1"),
        None,
    ),
    (
        "m40.3",
        None,
        "chapter",
        "Chapter 3",
        Some("Troubleshooting"),
        "Use the troubleshooting tables in this chapter in order. Answer each question, then follow the branch for the answer.",
        Some("3-1"),
        None,
    ),
    (
        "m40.3.w1",
        Some("m40.3"),
        "warning",
        "Chapter 3, Warning",
        Some("WARNING"),
        "Stop the pump and remove the start key or lock out the supply before you open any cover. Rotating parts can cause serious injury.",
        Some("3-1"),
        None,
    ),
    // Tree 1: engine will not crank (diesel).
    (
        "m40.3-1",
        Some("m40.3"),
        "section",
        "Table 3-1",
        Some("Engine will not crank"),
        "Table 3-1. Engine will not crank. Diesel variant only.",
        Some("3-2"),
        None,
    ),
    (
        "m40.3-1.setup",
        Some("m40.3-1"),
        "paragraph",
        "Table 3-1, Initial setup",
        Some("INITIAL SETUP"),
        "Equipment condition: Pump stopped, start key removed. Tools: Digital multimeter, relay tester. References: Wiring diagram, Figure 3-1. Personnel required: One technician.",
        Some("3-2"),
        None,
    ),
    (
        "m40.3-1.f1",
        Some("m40.3-1"),
        "figure",
        "Figure 3-1",
        Some("Starting circuit"),
        "Figure 3-1. Starting circuit wiring: battery, battery switch, fuse F2, key switch, starter relay K1, starter motor.",
        Some("3-3"),
        Some("Figure 3-1"),
    ),
    (
        "m40.3-1.q0",
        Some("m40.3-1"),
        "step",
        "Table 3-1, Symptom",
        None,
        "The engine does not crank when the start key is turned to START.",
        Some("3-2"),
        None,
    ),
    (
        "m40.3-1.q1",
        Some("m40.3-1"),
        "step",
        "Table 3-1, Question 1",
        None,
        "Is the battery switch ON and is the 15 A start fuse F2 good? TEST OPTIONS: Look at the switch. Pull F2 and check it with the multimeter. REASON FOR QUESTION: A switch left OFF or a blown fuse stops all cranking current. KNOWN INFO: The engine does not crank. POSSIBLE PROBLEMS: Battery switch off. Start fuse F2 blown. Battery discharged. Starter relay K1 failed. If NO: Turn the battery switch ON or replace fuse F2, then try to start. Does the engine crank now? If it cranks but the temperature lamp comes on: go to Table 3-2, question 1.",
        Some("3-2"),
        None,
    ),
    (
        "m40.3-1.q2",
        Some("m40.3-1"),
        "step",
        "Table 3-1, Question 2",
        None,
        "What is the battery voltage at terminals B+ and B- with the key OFF? TEST OPTIONS: Measure at the battery terminals with the multimeter on DC volts. REASON FOR QUESTION: Cranking needs a charged battery; below 11.5 V the starter cannot turn the engine. KNOWN INFO: Battery switch ON. Fuse F2 good. POSSIBLE PROBLEMS: Battery discharged. Starter relay K1 failed. Starter motor failed. Below 11.5 V: Replace the battery. Refer to task 4-3. From 11.5 V to 12.5 V: Charge the battery, then repeat the voltage test. 12.5 V or more: go to question 3.",
        Some("3-2"),
        None,
    ),
    (
        "m40.3-1.q3",
        Some("m40.3-1"),
        "step",
        "Table 3-1, Question 3",
        None,
        "Is more than 10 V present at starter relay K1 terminal 86 when the key is turned to START? REASON FOR QUESTION: Voltage at terminal 86 shows the key switch and wiring deliver the start signal. KNOWN INFO: Battery OK. Fuse OK. POSSIBLE PROBLEMS: Starter relay K1 failed. Starter motor failed. Key switch or wiring open. If NO: Key switch or wiring fault. Refer to field maintenance for wiring repair.",
        Some("3-3"),
        None,
    ),
    (
        "m40.3-1.q4",
        Some("m40.3-1"),
        "step",
        "Table 3-1, Question 4",
        None,
        "Test starter relay K1 with the relay tester. REASON FOR QUESTION: A relay that passes the test points to the starter motor. KNOWN INFO: Battery OK. Start signal present at K1. POSSIBLE PROBLEMS: Starter relay K1 failed. Starter motor failed. If FAIL: Replace starter relay K1. If PASS: Starter motor fault. Send the starter motor to the repair shop.",
        Some("3-3"),
        None,
    ),
    (
        "m40.3-1.c1",
        Some("m40.3-1.q4"),
        "caution",
        "Table 3-1, Caution",
        Some("CAUTION"),
        "Do not bridge relay terminals with a bare wire. Use the relay tester only.",
        Some("3-3"),
        None,
    ),
    (
        "m40.3-1.end",
        Some("m40.3-1"),
        "step",
        "Table 3-1, End",
        None,
        "The fault is corrected. Return the pump to service.",
        Some("3-3"),
        None,
    ),
    // Tree 2: pump overheats (all variants), entered from signals.
    (
        "m40.3-2",
        Some("m40.3"),
        "section",
        "Table 3-2",
        Some("Pump overheats"),
        "Table 3-2. Pump overheats or shows a high temperature code.",
        Some("3-4"),
        None,
    ),
    (
        "m40.3-2.codes",
        Some("m40.3-2"),
        "table",
        "Table 3-2, Codes",
        Some("Fault codes"),
        "Code SPN 110 FMI 0: engine coolant temperature above the shutdown limit. Code E21: motor winding temperature high. Code SPN 168 FMI 1: battery voltage below the cranking limit. Code E40: suction pressure below the warning limit.",
        Some("3-4"),
        None,
    ),
    (
        "m40.3-2.w1",
        Some("m40.3-2"),
        "warning",
        "Table 3-2, Warning",
        Some("WARNING"),
        "Do not open the radiator cap while the engine is hot. Hot coolant can cause burns.",
        Some("3-4"),
        None,
    ),
    (
        "m40.3-2.w2",
        Some("m40.3-2"),
        "warning",
        "Table 3-2, Warning",
        Some("WARNING"),
        "Lock out the electrical supply before you open the motor terminal box.",
        Some("3-4"),
        None,
    ),
    (
        "m40.3-2.q0",
        Some("m40.3-2"),
        "step",
        "Table 3-2, Symptom",
        None,
        "The high temperature lamp is on or the controller shows a high temperature code.",
        Some("3-4"),
        None,
    ),
    (
        "m40.3-2.q1",
        Some("m40.3-2"),
        "step",
        "Table 3-2, Question 1",
        None,
        "Is the intake strainer clear of debris? REASON FOR QUESTION: A blocked strainer starves the pump and it heats up. POSSIBLE PROBLEMS: Intake strainer blocked. Cooling fan belt loose or broken. Internal cooling fault. If NO: Clean the intake strainer.",
        Some("3-4"),
        None,
    ),
    (
        "m40.3-2.q2",
        Some("m40.3-2"),
        "step",
        "Table 3-2, Question 2",
        None,
        "What is the condition of the cooling fan belt: tight, loose or broken? POSSIBLE PROBLEMS: Cooling fan belt loose or broken. Internal cooling fault. If LOOSE: Adjust the belt tension. If BROKEN: Replace the cooling fan belt. If TIGHT: Internal cooling fault. Report to the field maintenance shop.",
        Some("3-5"),
        None,
    ),
    // Chapter 4: maintenance tasks.
    (
        "m40.4",
        None,
        "chapter",
        "Chapter 4",
        Some("Maintenance tasks"),
        "Chapter 4 lists the maintenance tasks for the Model 40 utility pump.",
        Some("4-1"),
        None,
    ),
    (
        "m40.4-2",
        Some("m40.4"),
        "section",
        "Task 4-2",
        Some("Battery voltage test"),
        "Task 4-2. Battery voltage test.",
        Some("4-2"),
        None,
    ),
    (
        "m40.4-2.w1",
        Some("m40.4-2"),
        "warning",
        "Task 4-2, Warning",
        Some("WARNING"),
        "Batteries give off explosive gas. Keep sparks and flames away from the battery.",
        Some("4-2"),
        None,
    ),
    (
        "m40.4-2.s1",
        Some("m40.4-2"),
        "step",
        "Task 4-2, Step 1",
        None,
        "Set the multimeter to DC volts.",
        Some("4-2"),
        None,
    ),
    (
        "m40.4-2.s2",
        Some("m40.4-2"),
        "step",
        "Task 4-2, Step 2",
        None,
        "Place the red lead on B+ and the black lead on B-.",
        Some("4-2"),
        None,
    ),
    (
        "m40.4-2.c1",
        Some("m40.4-2"),
        "caution",
        "Task 4-2, Caution",
        Some("CAUTION"),
        "Do not let the meter leads touch each other or the frame while they are on the battery terminals.",
        Some("4-2"),
        None,
    ),
    (
        "m40.4-2.s3",
        Some("m40.4-2"),
        "step",
        "Task 4-2, Step 3",
        None,
        "Read the voltage with the key OFF.",
        Some("4-2"),
        None,
    ),
    (
        "m40.4-2.n1",
        Some("m40.4-2"),
        "note",
        "Task 4-2, Note",
        Some("NOTE"),
        "A battery that was just charged reads high for about an hour. Wait before you test it.",
        Some("4-2"),
        None,
    ),
    (
        "m40.4-3",
        Some("m40.4"),
        "section",
        "Task 4-3",
        Some("Battery replacement"),
        "Task 4-3. Battery replacement. Diesel variant only.",
        Some("4-3"),
        None,
    ),
    (
        "m40.4-3.req",
        Some("m40.4-3"),
        "paragraph",
        "Task 4-3, Requirements",
        Some("INITIAL SETUP"),
        "Tools: 10 mm wrench, battery lifting strap. Parts: Battery, 12 V, 100 Ah (P40-118), quantity 1. Consumables: terminal grease. Personnel: two technicians.",
        Some("4-3"),
        None,
    ),
    (
        "m40.4-3.s1",
        Some("m40.4-3"),
        "step",
        "Task 4-3, Step 1",
        None,
        "Turn the battery switch OFF.",
        Some("4-3"),
        None,
    ),
    (
        "m40.4-3.s2",
        Some("m40.4-3"),
        "step",
        "Task 4-3, Step 2",
        None,
        "Disconnect the negative cable first, then the positive cable.",
        Some("4-3"),
        None,
    ),
    (
        "m40.4-3.c1",
        Some("m40.4-3"),
        "caution",
        "Task 4-3, Caution",
        Some("CAUTION"),
        "Disconnect the negative cable first to prevent a short circuit.",
        Some("4-3"),
        None,
    ),
    (
        "m40.4-3.s3",
        Some("m40.4-3"),
        "step",
        "Task 4-3, Step 3",
        None,
        "Remove the hold-down clamp and lift out the battery.",
        Some("4-3"),
        None,
    ),
    (
        "m40.4-3.w1",
        Some("m40.4-3"),
        "warning",
        "Task 4-3, Warning",
        Some("WARNING"),
        "The battery weighs 28 kg. Use two people and the lifting strap to lift it.",
        Some("4-3"),
        None,
    ),
    (
        "m40.4-3.s4",
        Some("m40.4-3"),
        "step",
        "Task 4-3, Step 4",
        None,
        "Install the new battery. Connect the positive cable first, then the negative cable. Coat the terminals with terminal grease.",
        Some("4-4"),
        None,
    ),
    (
        "m40.4-3.s5",
        Some("m40.4-3"),
        "step",
        "Task 4-3, Step 5",
        None,
        "Record the date code of the new battery.",
        Some("4-4"),
        None,
    ),
];

/// Passage boxes on the page images: (section, json boxes).
pub const BOXES: &[(&str, &str)] = &[
    ("m40.3-1", r#"[{"x0":0.08,"y0":0.06,"x1":0.92,"y1":0.12}]"#),
    (
        "m40.3-1.q1",
        r#"[{"x0":0.08,"y0":0.18,"x1":0.92,"y1":0.30},{"x0":0.08,"y0":0.30,"x1":0.50,"y1":0.34}]"#,
    ),
    (
        "m40.3-1.q2",
        r#"[{"x0":0.08,"y0":0.36,"x1":0.92,"y1":0.52}]"#,
    ),
];

/// Guards: (warning/caution/note section, the section it guards).
pub const GUARDS: &[(&str, &str)] = &[
    ("m40.3.w1", "m40.3"),
    ("m40.3-1.c1", "m40.3-1.q4"),
    ("m40.3-2.w1", "m40.3-2"),
    ("m40.3-2.w2", "m40.3-2"),
    ("m40.4-2.w1", "m40.4-2"),
    ("m40.4-2.c1", "m40.4-2.s2"),
    ("m40.4-2.n1", "m40.4-2.s3"),
    ("m40.4-3.c1", "m40.4-3.s2"),
    ("m40.4-3.w1", "m40.4-3.s3"),
];

/// Nodes: (id, tree, kind, text, section, expect, target, proc_id).
type Node = (
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    Option<&'static str>,
    Option<&'static str>,
    Option<&'static str>,
);

pub const NODES: &[Node] = &[
    (
        "nc.0",
        "t-nocrank",
        "symptom",
        "The engine does not crank when the start key is turned to START.",
        "m40.3-1.q0",
        Some(r#"{"kind":"ack"}"#),
        None,
        None,
    ),
    (
        "nc.1",
        "t-nocrank",
        "check",
        "Is the battery switch ON and is the 15 A start fuse F2 good?",
        "m40.3-1.q1",
        Some(r#"{"kind":"yes_no"}"#),
        None,
        None,
    ),
    (
        "nc.1a",
        "t-nocrank",
        "action",
        "Turn the battery switch ON or replace fuse F2, then try to start. Does the engine crank now?",
        "m40.3-1.q1",
        Some(r#"{"kind":"choice","options":["Cranks","Temperature lamp on","Does not crank"]}"#),
        None,
        None,
    ),
    (
        "nc.1g",
        "t-nocrank",
        "goto",
        "go to Table 3-2, question 1.",
        "m40.3-1.q1",
        None,
        Some("tree:t-hot#oh.1"),
        None,
    ),
    (
        "nc.2",
        "t-nocrank",
        "check",
        "What is the battery voltage at terminals B+ and B- with the key OFF?",
        "m40.3-1.q2",
        Some(r#"{"kind":"value","unit":"V","min":0,"max":30}"#),
        None,
        Some("proc-battv"),
    ),
    (
        "nc.2a",
        "t-nocrank",
        "action",
        "Replace the battery. Refer to task 4-3.",
        "m40.3-1.q2",
        None,
        Some("procedure:proc-battery"),
        None,
    ),
    (
        "nc.2b",
        "t-nocrank",
        "action",
        "Charge the battery, then repeat the voltage test.",
        "m40.3-1.q2",
        Some(r#"{"kind":"ack"}"#),
        None,
        None,
    ),
    (
        "nc.3",
        "t-nocrank",
        "check",
        "Is more than 10 V present at starter relay K1 terminal 86 when the key is turned to START?",
        "m40.3-1.q3",
        Some(r#"{"kind":"yes_no"}"#),
        None,
        None,
    ),
    (
        "nc.3n",
        "t-nocrank",
        "escalate",
        "Key switch or wiring fault. Refer to field maintenance for wiring repair.",
        "m40.3-1.q3",
        None,
        None,
        None,
    ),
    (
        "nc.4",
        "t-nocrank",
        "check",
        "Test starter relay K1 with the relay tester.",
        "m40.3-1.q4",
        Some(r#"{"kind":"pass_fail"}"#),
        None,
        None,
    ),
    (
        "nc.4f",
        "t-nocrank",
        "action",
        "Replace starter relay K1.",
        "m40.3-1.q4",
        None,
        None,
        None,
    ),
    (
        "nc.4p",
        "t-nocrank",
        "escalate",
        "Starter motor fault. Send the starter motor to the repair shop.",
        "m40.3-1.q4",
        None,
        None,
        None,
    ),
    (
        "nc.end",
        "t-nocrank",
        "end",
        "The fault is corrected. Return the pump to service.",
        "m40.3-1.end",
        None,
        None,
        None,
    ),
    (
        "oh.0",
        "t-hot",
        "symptom",
        "The high temperature lamp is on or the controller shows a high temperature code.",
        "m40.3-2.q0",
        Some(r#"{"kind":"ack"}"#),
        None,
        None,
    ),
    (
        "oh.1",
        "t-hot",
        "check",
        "Is the intake strainer clear of debris?",
        "m40.3-2.q1",
        Some(r#"{"kind":"yes_no"}"#),
        None,
        None,
    ),
    (
        "oh.1n",
        "t-hot",
        "action",
        "Clean the intake strainer.",
        "m40.3-2.q1",
        None,
        None,
        None,
    ),
    (
        "oh.2",
        "t-hot",
        "check",
        "What is the condition of the cooling fan belt: tight, loose or broken?",
        "m40.3-2.q2",
        Some(r#"{"kind":"choice","options":["Tight","Loose","Broken"]}"#),
        None,
        None,
    ),
    (
        "oh.2l",
        "t-hot",
        "action",
        "Adjust the belt tension.",
        "m40.3-2.q2",
        None,
        None,
        None,
    ),
    (
        "oh.2b",
        "t-hot",
        "action",
        "Replace the cooling fan belt.",
        "m40.3-2.q2",
        None,
        None,
        None,
    ),
    (
        "oh.2t",
        "t-hot",
        "escalate",
        "Internal cooling fault. Report to the field maintenance shop.",
        "m40.3-2.q2",
        None,
        None,
        None,
    ),
];

/// Edges: (from, ord, label, cond, to, retry).
/// Edge rows: (from, ord, label, cond, to, retry).
type Edge = (
    &'static str,
    i64,
    &'static str,
    Option<&'static str>,
    &'static str,
    bool,
);

pub const EDGES: &[Edge] = &[
    ("nc.0", 1, "Continue", None, "nc.1", false),
    ("nc.1", 1, "Yes", None, "nc.2", false),
    ("nc.1", 2, "No", None, "nc.1a", false),
    ("nc.1a", 1, "Cranks", None, "nc.end", false),
    ("nc.1a", 2, "Temperature lamp on", None, "nc.1g", false),
    ("nc.1a", 3, "Does not crank", None, "nc.2", false),
    (
        "nc.2",
        1,
        "Below 11.5 V",
        Some(r#"{"op":"<","value":11.5}"#),
        "nc.2a",
        false,
    ),
    (
        "nc.2",
        2,
        "11.5 V to 12.5 V",
        Some(r#"{"op":"between","min":11.5,"max":12.5}"#),
        "nc.2b",
        false,
    ),
    (
        "nc.2",
        3,
        "12.5 V or more",
        Some(r#"{"op":">=","value":12.5}"#),
        "nc.3",
        false,
    ),
    ("nc.2b", 1, "Repeat the test", None, "nc.2", true),
    ("nc.3", 1, "Yes", None, "nc.4", false),
    ("nc.3", 2, "No", None, "nc.3n", false),
    ("nc.4", 1, "Pass", None, "nc.4p", false),
    ("nc.4", 2, "Fail", None, "nc.4f", false),
    ("oh.0", 1, "Continue", None, "oh.1", false),
    ("oh.1", 1, "Yes", None, "oh.2", false),
    ("oh.1", 2, "No", None, "oh.1n", false),
    ("oh.2", 1, "Tight", None, "oh.2t", false),
    ("oh.2", 2, "Loose", None, "oh.2l", false),
    ("oh.2", 3, "Broken", None, "oh.2b", false),
];

/// Printed cross-references, verbatim: (node, reference). The second names
/// nothing this pack holds, so the node keeps the text and no target.
pub const REFERENCES: &[(&str, &str)] = &[
    ("nc.2a", "Refer to task 4-3."),
    ("nc.3n", "Refer to field maintenance for wiring repair."),
    ("nc.1g", "go to Table 3-2, question 1."),
];

/// Facets: (node, facet, ord, text, section).
pub const FACETS: &[(&str, &str, i64, &str, &str)] = &[
    (
        "nc.1",
        "test_option",
        1,
        "Look at the switch. Pull F2 and check it with the multimeter.",
        "m40.3-1.q1",
    ),
    (
        "nc.1",
        "reason",
        1,
        "A switch left OFF or a blown fuse stops all cranking current.",
        "m40.3-1.q1",
    ),
    (
        "nc.1",
        "known",
        1,
        "The engine does not crank.",
        "m40.3-1.q1",
    ),
    ("nc.1", "possible", 1, "Battery switch off.", "m40.3-1.q1"),
    ("nc.1", "possible", 2, "Start fuse F2 blown.", "m40.3-1.q1"),
    ("nc.1", "possible", 3, "Battery discharged.", "m40.3-1.q1"),
    (
        "nc.1",
        "possible",
        4,
        "Starter relay K1 failed.",
        "m40.3-1.q1",
    ),
    (
        "nc.2",
        "test_option",
        1,
        "Measure at the battery terminals with the multimeter on DC volts.",
        "m40.3-1.q2",
    ),
    (
        "nc.2",
        "reason",
        1,
        "Cranking needs a charged battery; below 11.5 V the starter cannot turn the engine.",
        "m40.3-1.q2",
    ),
    ("nc.2", "known", 1, "Battery switch ON.", "m40.3-1.q2"),
    ("nc.2", "known", 2, "Fuse F2 good.", "m40.3-1.q2"),
    ("nc.2", "possible", 1, "Battery discharged.", "m40.3-1.q2"),
    (
        "nc.2",
        "possible",
        2,
        "Starter relay K1 failed.",
        "m40.3-1.q2",
    ),
    ("nc.2", "possible", 3, "Starter motor failed.", "m40.3-1.q2"),
    (
        "nc.3",
        "reason",
        1,
        "Voltage at terminal 86 shows the key switch and wiring deliver the start signal.",
        "m40.3-1.q3",
    ),
    ("nc.3", "known", 1, "Battery OK.", "m40.3-1.q3"),
    ("nc.3", "known", 2, "Fuse OK.", "m40.3-1.q3"),
    (
        "nc.3",
        "possible",
        1,
        "Starter relay K1 failed.",
        "m40.3-1.q3",
    ),
    ("nc.3", "possible", 2, "Starter motor failed.", "m40.3-1.q3"),
    (
        "nc.3",
        "possible",
        3,
        "Key switch or wiring open.",
        "m40.3-1.q3",
    ),
    (
        "nc.4",
        "reason",
        1,
        "A relay that passes the test points to the starter motor.",
        "m40.3-1.q4",
    ),
    (
        "nc.4",
        "known",
        1,
        "Start signal present at K1.",
        "m40.3-1.q4",
    ),
    (
        "nc.4",
        "possible",
        1,
        "Starter relay K1 failed.",
        "m40.3-1.q4",
    ),
    ("nc.4", "possible", 2, "Starter motor failed.", "m40.3-1.q4"),
    (
        "oh.1",
        "reason",
        1,
        "A blocked strainer starves the pump and it heats up.",
        "m40.3-2.q1",
    ),
    (
        "oh.1",
        "possible",
        1,
        "Intake strainer blocked.",
        "m40.3-2.q1",
    ),
    (
        "oh.1",
        "possible",
        2,
        "Cooling fan belt loose or broken.",
        "m40.3-2.q1",
    ),
    (
        "oh.1",
        "possible",
        3,
        "Internal cooling fault.",
        "m40.3-2.q1",
    ),
    (
        "oh.2",
        "possible",
        1,
        "Cooling fan belt loose or broken.",
        "m40.3-2.q2",
    ),
    (
        "oh.2",
        "possible",
        2,
        "Internal cooling fault.",
        "m40.3-2.q2",
    ),
];

/// Facet headings, in the manual's order.
pub fn facets() -> Value {
    json!([
        {"id": "test_option", "label": "Test options"},
        {"id": "reason", "label": "Reason for question"},
        {"id": "known", "label": "Known info"},
        {"id": "possible", "label": "Possible problems"}
    ])
}

/// Depth levels: the most guidance first.
pub fn levels() -> Value {
    json!([
        {"id": "apprentice", "label": "Apprentice", "test_steps": "expanded"},
        {"id": "technician", "label": "Technician", "facets": ["possible", "test_option"], "test_steps": "collapsed"},
        {"id": "expert", "label": "Expert", "facets": [], "test_steps": "collapsed"}
    ])
}

const FIGURE_SVG: &str = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"320\" height=\"120\" viewBox=\"0 0 320 120\"><rect x=\"10\" y=\"40\" width=\"60\" height=\"40\" fill=\"none\" stroke=\"black\"/><text x=\"18\" y=\"65\" font-size=\"12\">Battery</text><line x1=\"70\" y1=\"60\" x2=\"130\" y2=\"60\" stroke=\"black\"/><rect x=\"130\" y=\"40\" width=\"60\" height=\"40\" fill=\"none\" stroke=\"black\"/><text x=\"148\" y=\"65\" font-size=\"12\">K1</text><line x1=\"190\" y1=\"60\" x2=\"250\" y2=\"60\" stroke=\"black\"/><circle cx=\"280\" cy=\"60\" r=\"25\" fill=\"none\" stroke=\"black\"/><text x=\"265\" y=\"65\" font-size=\"12\">Starter</text></svg>\n";
const PAGE_SVG: &str = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"210\" height=\"297\" viewBox=\"0 0 210 297\"><rect width=\"210\" height=\"297\" fill=\"white\" stroke=\"black\"/><text x=\"20\" y=\"30\" font-size=\"10\">Table 3-1. Engine will not crank.</text><text x=\"95\" y=\"285\" font-size=\"8\">3-2</text></svg>\n";

/// Asset files: (asset_id, path, content, media_type, width, height, section, role).
/// Asset rows: (asset_id, path, content, media_type, width, height, section, role).
type AssetRow = (
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    i64,
    i64,
    &'static str,
    &'static str,
);

const ASSETS: &[AssetRow] = &[
    (
        "fig-3-1",
        "assets/fig-3-1.svg",
        FIGURE_SVG,
        "image/svg+xml",
        320,
        120,
        "m40.3-1.f1",
        "figure",
    ),
    (
        "page-3-2",
        "assets/page-3-2.svg",
        PAGE_SVG,
        "image/svg+xml",
        210,
        297,
        "m40.3-1",
        "page",
    ),
];

/// Build the maintenance fixture pack at `dir`.
pub fn build(dir: &Path, version: &str) -> Result<crate::fixture::Fixture> {
    build_with(dir, version, |_| Ok(()))
}

/// Build, letting `edit` change the database before it is sealed and signed.
pub fn build_with(
    dir: &Path,
    version: &str,
    edit: impl FnOnce(&Connection) -> Result<()>,
) -> Result<crate::fixture::Fixture> {
    fs::create_dir_all(dir.join("assets"))?;
    let db = dir.join(DB_FILE);
    if db.exists() {
        fs::remove_file(&db)?;
    }
    let mut files: Vec<&str> = vec![DB_FILE];
    for (_, path, content, ..) in ASSETS {
        fs::write(dir.join(path), content)?;
        files.push(*path);
    }
    {
        let conn = Connection::open(&db)?;
        conn.pragma_update(None, "journal_mode", "DELETE")?;
        conn.execute_batch(SCHEMA_V1)?;
        conn.execute_batch(SCHEMA_MAINT)?;
        populate(&conn, version)?;
        edit(&conn)?;
        seal(&conn)?;
    }
    write_manifest(dir, PACK_ID, version, &files, None, &signing_key())?;
    Ok(crate::fixture::Fixture {
        dir: dir.to_path_buf(),
        version: version.to_string(),
    })
}

fn sha(s: &str) -> String {
    use sha2::{Digest, Sha256};
    crate::packs::hex_encode(&Sha256::digest(s.as_bytes()))
}

fn populate(conn: &Connection, version: &str) -> Result<()> {
    let meta: Vec<(&str, String)> = vec![
        ("pack_id", PACK_ID.into()),
        ("version", version.into()),
        ("schema_version", "1".into()),
        ("built_at", "2026-03-01T00:00:00Z".into()),
        ("corpus_id", "model-40-manual".into()),
        (
            "embedder_id",
            HashingEmbedder::new(EMBED_DIM).id().to_string(),
        ),
        ("embed_dim", EMBED_DIM.to_string()),
        ("bake_backends", "[\"deterministic\"]".into()),
        ("source_count", "1".into()),
        ("levels", levels().to_string()),
        ("facets", facets().to_string()),
        (
            "signal_kinds",
            json!([
                {"kind": "j1939.dm1", "label": "Engine fault code (SPN/FMI)", "example": "spn:110/fmi:0"},
                {"kind": "pump40.code", "label": "Controller display code", "example": "E21"}
            ])
            .to_string(),
        ),
        ("repeat_window_days", "30".into()),
        ("row_counts", json!({"section": SECTIONS.len()}).to_string()),
    ];
    for (k, v) in meta {
        conn.execute(
            "INSERT INTO pack_meta (key, value) VALUES (?1, ?2)",
            params![k, v],
        )?;
    }
    conn.execute(
        "INSERT INTO provenance VALUES (?1, 'human', 'none', 'fixture', '1', ?2, ?2, ?2,
         '2026-03-01T00:00:00Z', 'fixture', 'pass', NULL)",
        params![PROV, sha("pump40")],
    )?;
    conn.execute(
        "INSERT INTO source VALUES (?1, 'Model 40 Utility Pump Field Maintenance Manual',
         'Harvest test fixture', 'https://example.invalid/model-40', 'Revision C, 2026-03-01',
         '2026-03-01T00:00:00Z', ?2, 'text/plain', 'fixture')",
        params![SRC, sha(SRC)],
    )?;
    for (ord, (id, parent, kind, citation, heading, text, page, figure)) in
        SECTIONS.iter().enumerate()
    {
        let depth = match parent {
            None => 1,
            Some(p) if SECTIONS.iter().any(|s| s.0 == *p && s.1.is_none()) => 2,
            Some(_) => 3,
        };
        conn.execute(
            "INSERT INTO section VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'en')",
            params![
                id,
                SRC,
                parent,
                ord as i64,
                depth,
                kind,
                citation,
                heading,
                text,
                sha(text)
            ],
        )?;
        let boxes = BOXES
            .iter()
            .find(|(s, _)| s == id)
            .map(|(_, b)| b.to_string());
        conn.execute(
            "INSERT INTO section_loc VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, page, page.map(page_index), figure, boxes],
        )?;
        conn.execute(
            "INSERT INTO chunk VALUES (?1, 'section', ?2, ?3, 'en')",
            params![
                format!("c-{id}"),
                id,
                format!("{}. {text}", heading.unwrap_or(citation))
            ],
        )?;
    }
    for (from, to) in GUARDS {
        conn.execute(
            "INSERT INTO xref VALUES (?1, ?2, 'guards')",
            params![from, to],
        )?;
    }
    for (asset_id, path, content, media, w, h, section, role) in ASSETS {
        conn.execute(
            "INSERT INTO asset VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                asset_id,
                path,
                sha(content),
                media,
                content.len() as i64,
                w,
                h
            ],
        )?;
        conn.execute(
            "INSERT INTO section_asset VALUES (?1, ?2, ?3)",
            params![section, asset_id, role],
        )?;
    }
    conn.execute_batch(
        r#"
        INSERT INTO equipment VALUES ('pump40', NULL, 'Model 40 utility pump', '["model 40","m40"]');
        INSERT INTO equipment VALUES ('pump40-diesel', 'pump40', 'Model 40 diesel', '["diesel pump","p40-d"]');
        INSERT INTO equipment VALUES ('pump40-electric', 'pump40', 'Model 40 electric', '["electric pump","p40-e"]');
        INSERT INTO equip_attr VALUES ('pump40', 'rated_flow', '400 L/min');
        INSERT INTO equip_attr VALUES ('pump40', 'drive', 'unknown');
        INSERT INTO equip_attr VALUES ('pump40-diesel', 'drive', '2-cylinder diesel engine');
        INSERT INTO equip_attr VALUES ('pump40-electric', 'drive', '7.5 kW motor');
        INSERT INTO equip_attr VALUES ('pump40-electric', 'supply', '400 V three-phase');
        INSERT INTO equip_ident VALUES ('pump40', 'text', 'model 40');
        INSERT INTO equip_ident VALUES ('pump40-diesel', 'model', 'P40-D');
        INSERT INTO equip_ident VALUES ('pump40-diesel', 'serial_range', 'P40D-1000..P40D-4999');
        INSERT INTO equip_ident VALUES ('pump40-electric', 'model', 'P40-E');
        INSERT INTO equip_ident VALUES ('pump40-electric', 'serial_range', 'P40E-1000..P40E-4999');
        INSERT INTO equip_ident VALUES ('pump40-electric', 'firmware', 'MC-2.*');
        INSERT INTO applies_to VALUES ('section', 'm40.3-1', 'pump40-diesel');
        INSERT INTO applies_to VALUES ('section', 'm40.4-3', 'pump40-diesel');
        INSERT INTO applies_to VALUES ('section', 'm40.3-2.w1', 'pump40-diesel');
        INSERT INTO applies_to VALUES ('section', 'm40.3-2.w2', 'pump40-electric');
        INSERT INTO applies_to VALUES ('fault_tree', 't-nocrank', 'pump40-diesel');
        INSERT INTO applies_to VALUES ('procedure', 'proc-battery', 'pump40-diesel');
        INSERT INTO applies_to VALUES ('procedure', 'proc-battv', 'pump40-diesel');
        INSERT INTO fault_tree VALUES ('t-nocrank', 'Engine will not crank', 'starting', 'nc.0', '["m40.3-1"]', 'en', 'prov-pump40');
        INSERT INTO fault_tree VALUES ('t-hot', 'Pump overheats', 'cooling', 'oh.0', '["m40.3-2"]', 'en', 'prov-pump40');
        INSERT INTO requirement VALUES ('fault_tree', 't-nocrank', 1, 'condition', 'Pump stopped, start key removed.', NULL, NULL, 'm40.3-1.setup', 'prov-pump40');
        INSERT INTO requirement VALUES ('fault_tree', 't-nocrank', 2, 'tool', 'Digital multimeter', NULL, NULL, 'm40.3-1.setup', 'prov-pump40');
        INSERT INTO requirement VALUES ('fault_tree', 't-nocrank', 3, 'tool', 'relay tester', NULL, NULL, 'm40.3-1.setup', 'prov-pump40');
        INSERT INTO requirement VALUES ('fault_tree', 't-nocrank', 4, 'reference', 'Wiring diagram, Figure 3-1.', NULL, NULL, 'm40.3-1.setup', 'prov-pump40');
        INSERT INTO requirement VALUES ('fault_tree', 't-nocrank', 5, 'personnel', 'One technician.', NULL, '1', 'm40.3-1.setup', 'prov-pump40');
        INSERT INTO requirement VALUES ('fault_node', 'nc.4', 1, 'tool', 'relay tester', NULL, NULL, 'm40.3-1.q4', 'prov-pump40');
        INSERT INTO requirement VALUES ('procedure', 'proc-battery', 1, 'tool', '10 mm wrench', NULL, NULL, 'm40.4-3.req', 'prov-pump40');
        INSERT INTO requirement VALUES ('procedure', 'proc-battery', 2, 'tool', 'battery lifting strap', NULL, NULL, 'm40.4-3.req', 'prov-pump40');
        INSERT INTO requirement VALUES ('procedure', 'proc-battery', 3, 'part', 'Battery, 12 V, 100 Ah', 'P40-118', '1', 'm40.4-3.req', 'prov-pump40');
        INSERT INTO requirement VALUES ('procedure', 'proc-battery', 4, 'consumable', 'terminal grease', NULL, NULL, 'm40.4-3.req', 'prov-pump40');
        INSERT INTO requirement VALUES ('procedure', 'proc-battery', 5, 'personnel', 'two technicians', NULL, '2', 'm40.4-3.req', 'prov-pump40');
        INSERT INTO symptom VALUES ('s-nocrank', 't-nocrank', 'Engine will not crank', 'starting',
          '["engine won''t start","no crank","starter does nothing","nothing happens when I turn the key"]', 'en', 'prov-pump40');
        INSERT INTO symptom VALUES ('s-hot', 't-hot', 'Pump overheats', 'cooling',
          '["running hot","high temperature","temperature light on","overheating"]', 'en', 'prov-pump40');
        INSERT INTO chunk VALUES ('c-sym-nocrank', 'symptom', 's-nocrank', 'Engine will not crank. Engine won''t start, no crank, starter does nothing, nothing happens when I turn the key.', 'en');
        INSERT INTO chunk VALUES ('c-sym-hot', 'symptom', 's-hot', 'Pump overheats. Running hot, high temperature, temperature light on, overheating.', 'en');
        INSERT INTO signal_map VALUES ('j1939.dm1', 'spn:110/fmi:0', 'Engine coolant temperature high', 't-hot', 'oh.0', 'm40.3-2.codes', 'Code SPN 110 FMI 0: engine coolant temperature above the shutdown limit.', 'prov-pump40');
        INSERT INTO signal_map VALUES ('j1939.dm1', 'glob:spn:110/fmi:*', 'Engine coolant temperature fault', 't-hot', NULL, 'm40.3-2.codes', NULL, 'prov-pump40');
        INSERT INTO signal_map VALUES ('pump40.code', 'E21', 'Motor winding temperature high', 't-hot', 'oh.1', 'm40.3-2.codes', 'Code E21: motor winding temperature high.', 'prov-pump40');
        INSERT INTO signal_map VALUES ('j1939.dm1', 'spn:168/fmi:1', 'Battery voltage low', 't-nocrank', 'nc.2', 'm40.3-2.codes', 'Code SPN 168 FMI 1: battery voltage below the cranking limit.', 'prov-pump40');
        INSERT INTO signal_map VALUES ('pump40.code', 'E40', 'Suction pressure low', NULL, NULL, 'm40.3-2.codes', 'Code E40: suction pressure below the warning limit.', 'prov-pump40');
        INSERT INTO history VALUES ('h-relay-2026', 'pump40-diesel', 'starting', '2026-02-10', 'Starter relay K1 replaced on three units after no-crank reports.', NULL, '{"units":3}');
        INSERT INTO history VALUES ('h-strainer-2025', 'pump40', 'cooling', '2025-11-03', 'Intake strainers found clogged after a flood response; cleaning interval shortened.', NULL, '{}');
        INSERT INTO history VALUES ('h-winding-2025', 'pump40-electric', 'cooling', '2025-08-21', 'Motor winding temperature code E21 cleared after the motor fan cover was cleaned.', NULL, '{}');
        INSERT INTO failure_mode VALUES ('fm-strainer', 'pump40', 'cooling', 'Clogged intake strainer', 22, 0.4, 't-hot', '["Lamp on after two hours in silty water."]');
        INSERT INTO failure_mode VALUES ('fm-relay', 'pump40-diesel', 'starting', 'Starter relay K1 failure', 14, 0.35, 't-nocrank', '["Relay clicks but the starter does not turn."]');
        INSERT INTO procedure VALUES ('proc-battv', 'Battery voltage test (task 4-2)', 'test', 'Measure the battery voltage.', '["apprentice","technician","expert"]', 'en', 'prov-pump40');
        INSERT INTO proc_step VALUES ('proc-battv', 1, 'Set the multimeter to DC volts.', '{}', 'pass_fail', '["m40.4-2.s1"]', NULL, 'en', 'prov-pump40');
        INSERT INTO proc_step VALUES ('proc-battv', 2, 'Place the red lead on B+ and the black lead on B-.', '{}', 'pass_fail', '["m40.4-2.s2"]', NULL, 'en', 'prov-pump40');
        INSERT INTO proc_step VALUES ('proc-battv', 3, 'Read the voltage with the key OFF.', '{"apprentice":"Hold the leads still and wait for the reading to settle."}', 'value', '["m40.4-2.s3"]', NULL, 'en', 'prov-pump40');
        INSERT INTO procedure VALUES ('proc-battery', 'Battery replacement (task 4-3)', 'maintenance', 'Replace the starting battery.', '["apprentice","technician","expert"]', 'en', 'prov-pump40');
        INSERT INTO proc_step VALUES ('proc-battery', 1, 'Turn the battery switch OFF.', '{}', 'pass_fail', '["m40.4-3.s1"]', NULL, 'en', 'prov-pump40');
        INSERT INTO proc_step VALUES ('proc-battery', 2, 'Disconnect the negative cable first, then the positive cable.', '{}', 'pass_fail', '["m40.4-3.s2"]', NULL, 'en', 'prov-pump40');
        INSERT INTO proc_step VALUES ('proc-battery', 3, 'Remove the hold-down clamp and lift out the battery.', '{}', 'pass_fail', '["m40.4-3.s3"]', NULL, 'en', 'prov-pump40');
        INSERT INTO proc_step VALUES ('proc-battery', 4, 'Install the new battery. Connect the positive cable first, then the negative cable. Coat the terminals with terminal grease.', '{}', 'pass_fail', '["m40.4-3.s4"]', NULL, 'en', 'prov-pump40');
        INSERT INTO proc_step VALUES ('proc-battery', 5, 'Record the date code of the new battery.', '{}', 'note', '["m40.4-3.s5"]', NULL, 'en', 'prov-pump40');
        INSERT INTO chunk VALUES ('c-step-battery-3', 'proc_step', 'proc-battery#3', 'Battery replacement: remove the hold-down clamp and lift out the battery.', 'en');
        INSERT INTO explanation VALUES ('m40.3-1.q2', 'apprentice', 'A healthy battery at rest reads about 12.6 volts. Measure with the key off so nothing draws current.', 'en', 'prov-pump40');
        INSERT INTO explanation VALUES ('m40.3-1.q2', 'technician', 'Resting voltage under 12.5 V means the battery is not fully charged.', 'en', 'prov-pump40');
        "#,
    )?;
    for (id, tree, kind, text, section, expect, target, proc_id) in NODES {
        let reference = REFERENCES.iter().find(|(n, _)| n == id).map(|(_, r)| *r);
        conn.execute(
            "INSERT INTO fault_node (node_id, tree_id, kind, text, section_id, expect, target, proc_id,
                                     lang, prov_id, reference)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'en', ?9, ?10)",
            params![id, tree, kind, text, section, expect, target, proc_id, PROV, reference],
        )?;
    }
    for (from, ord, label, cond, to, retry) in EDGES {
        conn.execute(
            "INSERT INTO fault_edge VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![from, ord, label, cond, to, *retry as i64],
        )?;
    }
    for (node, facet, ord, text, section) in FACETS {
        conn.execute(
            "INSERT INTO fault_facet VALUES (?1, ?2, ?3, ?4, ?5)",
            params![node, facet, ord, text, section],
        )?;
    }
    Ok(())
}

/// The fictional manual's physical pages, in file order: the printed
/// label of each (CONTRACT: `page_index` is 1-based in the source file).
const PAGES: &[&str] = &[
    "1-1", "3-1", "3-2", "3-3", "3-4", "3-5", "4-1", "4-2", "4-3", "4-4",
];

/// The 1-based physical page of a printed label.
fn page_index(label: &str) -> i64 {
    PAGES
        .iter()
        .position(|p| *p == label)
        .map_or(0, |i| i as i64 + 1)
}

/// A field-note bundle (`harvest-field/1`) for the fixture pack, signed with
/// the fixture key, as a hub would send it. Test and development use only.
pub fn field_bundle(seq: u64) -> Result<Value> {
    let mut b = json!({
        "format": "harvest-field/1",
        "stream": "pump40-fleet",
        "pack_id": PACK_ID,
        "seq": seq,
        "issued_at": "2026-03-10T08:00:00.000Z",
        "notes": [
            {
                "note_id": "fn-relay-bracket",
                "scope": {"equip_id": "pump40-diesel", "node_id": "nc.4"},
                "text": "On units from serial P40D-3000 the relay sits behind the fuel filter bracket. Remove the bracket first.",
                "counts": {"units": 9, "resolved": 7, "attempts": 9},
                "approver": "Fleet maintenance reviewer",
                "approved_at": "2026-03-09"
            },
            {
                "note_id": "fn-strainer-silt",
                "scope": {"tree_id": "t-hot"},
                "text": "After work in silty water, check the strainer first: it was the cause in most reports.",
                "counts": {"units": 22, "resolved": 18, "attempts": 22},
                "approver": "Fleet maintenance reviewer",
                "approved_at": "2026-03-09"
            }
        ]
    });
    crate::packs::sign_manifest(&mut b, &signing_key())?;
    Ok(b)
}

/// An asset registry (`harvest-assets/1`) for the fixture fleet.
pub fn asset_registry() -> Value {
    json!({
        "format": "harvest-assets/1",
        "assets": [
            {"asset_id": "unit-101", "equip_id": "pump40-diesel", "serial": "P40D-2310", "name": "Pump 101",
             "attrs": {"location": "North yard"}, "hours": 1840.5,
             "events": [{"date": "2026-02-20", "system": "starting", "symptom_id": "s-nocrank", "tree_id": "t-nocrank",
                         "text": "Would not crank; battery charged."}]},
            {"asset_id": "unit-102", "equip_id": "pump40-diesel", "serial": "P40D-3115", "name": "Pump 102",
             "attrs": {}, "hours": 920.0, "events": []},
            {"asset_id": "unit-201", "equip_id": "pump40-electric", "serial": "P40E-1450", "name": "Pump 201",
             "attrs": {"location": "Pump station 2"}, "hours": 4410.0,
             "events": [{"date": "2025-12-01", "system": "cooling", "symptom_id": "s-hot", "tree_id": "t-hot",
                         "text": "E21 code; strainer cleaned."}]}
        ]
    })
}
