//! The prompts and output schemas the model interface was measured with
//! (held-out evaluation across nine open-weight models), ported verbatim.
//! An evaluation names the version it ran; changing a prompt here means a
//! new version and a new measurement.

use serde_json::{Value, json};

/// T1, symptom mapping: the strict prompt, candidates with synonyms and the
/// search's match strength.
pub const T1_VERSION: &str = "t1-2026-11-28.1/strict+syn+scores";
/// T2, close-out structuring: the v2 interface (labels C#, A#, P#).
pub const T2_VERSION: &str = "t2-2026-11-28.1/v2";
/// T3, a question about the current step: fixed headings.
pub const T3_VERSION: &str = "t3-2026-11-28.1/tmpl";

/// Candidates the model sees for T1.
pub const T1_K: usize = 12;
/// T1 output budget.
pub const T1_MAX_TOKENS: u32 = 64;
/// T2 and T3 output budget (the measured runs, thinking off).
pub const T2_MAX_TOKENS: u32 = 400;
pub const T3_MAX_TOKENS: u32 = 400;
/// Sentences offered for T3.
pub const T3_MAX_SENTENCES: usize = 48;
/// `manual.search` hits added to the T3 passages.
pub const T3_SEARCH_K: usize = 5;

const T1_SYSTEM: &str = "You are the symptom-matching step of an offline maintenance assistant. A technician described a problem in their own words (possibly with typos or speech-recognition errors). The manual's search returned numbered candidate entries from its troubleshooting index. Decide:
- \"pick\": one candidate clearly matches what the technician described. Give its number.
- \"none\": no candidate matches the problem described (the manual's index does not cover it). Do not pick a candidate just because it shares a word.
- \"clarify\": the description fits two or three candidates about equally and one question would tell them apart. Give their numbers (2 or 3). Use this only when a careful expert could not choose without asking.
Read typos and misheard words generously: \"excel\" may be \"accel\", \"jeepee ess\" may be \"GPS\". Answer with JSON only.";

const T1_STRICT: &str = "The right entry is often NOT among the candidates: the search returns entries that share words with the report, about the same part or system, but a different message or fault. Pick a candidate only if its title or statement matches what the technician actually reports (the message they saw, or the fault they describe). If the report names or describes a different message or fault, answer none. A wrong pick sends the technician down the wrong procedure; none just shows them the list. Answer with JSON only.";

/// `SYSTEM_STRICT`: the T1 system prompt with its last sentence replaced.
pub fn t1_system() -> String {
    T1_SYSTEM.replace("Answer with JSON only.", T1_STRICT)
}

/// `schema(k)`: pick 1..k, none, or clarify between 2 or 3.
pub fn t1_schema(k: usize) -> Value {
    let idx: Vec<usize> = (1..=k).collect();
    let pick = json!({"type": "object", "properties": {"decision": {"const": "pick"}, "candidate": {"type": "integer", "enum": idx}},
            "required": ["decision", "candidate"], "additionalProperties": false});
    let none = json!({"type": "object", "properties": {"decision": {"const": "none"}}, "required": ["decision"],
            "additionalProperties": false});
    let clar = json!({"type": "object", "properties": {"decision": {"const": "clarify"},
            "between": {"type": "array", "items": {"type": "integer", "enum": idx}, "minItems": 2, "maxItems": 3}},
            "required": ["decision", "between"], "additionalProperties": false});
    json!({"anyOf": [pick, none, clar]})
}

/// The header shown before scored candidates.
pub const T1_SCORES_HEAD: &str = "Each candidate shows the search's match strength (0 to 1; above about 0.7 is a strong match, below 0.55 weak). A weak top match often means the right entry is not listed.\n";

/// `SYSTEM_V2`.
pub const T2_SYSTEM: &str = "You fill in the close-out record of a maintenance job from the technician's own note (typed or dictated, possibly with errors). You see the job's context: the steps recorded, the causes (C1, C2, ...) and actions (A1, A2, ...) the manual lists, and the parts it lists (P1, P2, ...).
- cause: the verified cause. If what the note says the cause was matches a listed cause in meaning (even in other words, or as a more specific instance of it), give that label. Use \"other\" only for a cause that no listed cause covers, and put its short text in cause_text. Use \"unknown\" when the note does not say or imply what the cause was. Never guess.
- action: the corrective action actually taken, the same way (a listed label when it matches in meaning, else \"other\" with action_text, or \"unknown\").
- parts: the labels of listed parts or consumables the note says were used; for a part the list lacks, add \"other\" and its short name in parts_other. Empty when none were used.
- minutes: the time spent if the note states it (hours to minutes), else null.
- note: anything else worth keeping, short; empty if nothing.
cause_text and action_text are empty unless the choice is \"other\". Answer with JSON only.";

/// `schema_v2(ctx)`.
pub fn t2_schema(causes: usize, actions: usize, parts: usize) -> Value {
    let mut cs: Vec<String> = (1..=causes).map(|i| format!("C{i}")).collect();
    cs.extend(["other".into(), "unknown".into()]);
    let mut as_: Vec<String> = (1..=actions).map(|i| format!("A{i}")).collect();
    as_.extend(["other".into(), "unknown".into()]);
    let mut ps: Vec<String> = (1..=parts).map(|i| format!("P{i}")).collect();
    ps.push("other".into());
    json!({"type": "object", "properties": {
        "cause": {"type": "string", "enum": cs}, "cause_text": {"type": "string", "maxLength": 100},
        "action": {"type": "string", "enum": as_}, "action_text": {"type": "string", "maxLength": 100},
        "parts": {"type": "array", "items": {"type": "string", "enum": ps}, "maxItems": 6},
        "parts_other": {"type": "array", "items": {"type": "string", "maxLength": 60}, "maxItems": 3},
        "minutes": {"type": ["integer", "null"]},
        "note": {"type": "string", "maxLength": 200}},
        "required": ["cause", "cause_text", "action", "action_text", "parts", "parts_other", "minutes", "note"],
        "additionalProperties": false})
}

const T3_SYSTEM: &str = "You answer a technician's question about the maintenance step they are on, using ONLY the manual's sentences shown. Each sentence has a handle (S1, S2, ...).
- If some of the sentences answer the question, choose the fewest that fully answer it (1 to 4), by handle. You may add one short connecting line in plain words (at most 20 words) to tie them to the question. The connecting line must not state any number, measurement, step, instruction or requirement of its own: those come only from the chosen sentences. Leave it empty if not needed.
- If the sentences do not answer the question, decline. Do not choose sentences that are merely related.
Answer with JSON only.";

/// The fixed headings (the first is "none").
pub const T3_TEMPLATES: [&str; 10] = [
    "",
    "The manual says:",
    "The reason the manual gives:",
    "What the manual says to do:",
    "The manual's test for this:",
    "What you need:",
    "Safety first:",
    "Where the manual points:",
    "What this message means:",
    "If that does not fix it:",
];

/// `SYSTEM_TMPL`.
pub fn t3_system() -> String {
    T3_SYSTEM.replace(
        "You may add one short connecting line in plain words (at most 20 words) to tie them to the question. The connecting line must not state any number, measurement, step, instruction or requirement of its own: those come only from the chosen sentences. Leave it empty if not needed.",
        "Choose a heading for them from the list given (or the empty one).",
    )
}

/// `schema(n, templates=True)`.
pub fn t3_schema(n: usize) -> Value {
    let handles: Vec<String> = (1..=n).map(|i| format!("S{i}")).collect();
    let ans = json!({"type": "object", "properties": {"kind": {"const": "answer"},
        "sentences": {"type": "array", "items": {"type": "string", "enum": handles}, "minItems": 1, "maxItems": 4},
        "connector": {"type": "string", "enum": T3_TEMPLATES}},
        "required": ["kind", "sentences", "connector"], "additionalProperties": false});
    let dec = json!({"type": "object", "properties": {"kind": {"const": "decline"}}, "required": ["kind"],
        "additionalProperties": false});
    json!({"anyOf": [ans, dec]})
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_variants_replace_what_the_measured_ones_replaced() {
        assert!(t1_system().ends_with("none just shows them the list. Answer with JSON only."));
        assert_eq!(t1_system().matches("Answer with JSON only.").count(), 1);
        assert!(
            t3_system()
                .contains("Choose a heading for them from the list given (or the empty one).")
        );
        assert!(!t3_system().contains("connecting line"));
        assert_eq!(
            t1_schema(12)["anyOf"][0]["properties"]["candidate"]["enum"]
                .as_array()
                .unwrap()
                .len(),
            12
        );
    }
}
