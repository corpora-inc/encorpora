//! Protocol decoders: raw vehicle data in, the normalized observations
//! [`crate::maint::search::signal_match`] takes out. Pure functions, no
//! I/O; the host reads the bus or the log and hands the bytes here.
//!
//! - [`j1939`]: SAE J1939 DM1 active trouble codes from CAN frames
//!   (candump log lines or raw frames), single frame or multi-packet (TP.CM
//!   BAM and RTS/CTS data transfer), with lamp status and occurrence counts.
//! - [`j1587`]: SAE J1587 (on J1708) PID 194 diagnostic codes: PID or SID,
//!   FMI, active or previously active, occurrence count.
//! - [`display`]: a two-part code (main, sub) read off a display and typed
//!   by hand.

pub mod display;
pub mod j1587;
pub mod j1939;

use crate::maint::search::Observation;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// What a decode produced.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Decoded {
    /// Ready for `signal.match` / `symptom.search` / `job.start`.
    pub observations: Vec<Observation>,
    /// J1939 DM1 messages, one per source address and message.
    pub dm1: Vec<j1939::Dm1>,
    /// J1587 diagnostic codes.
    pub j1587: Vec<j1587::Dtc>,
    /// Input lines or frames that could not be read, and why (decoding
    /// goes on past them).
    pub errors: Vec<String>,
}

/// The input formats.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Format {
    /// candump log lines (`(t) can0 18FECA00#…` or `can0 18FECA00 [8] …`).
    J1939Candump,
    /// One frame per line: `<29-bit id hex> <data hex>` (`18FECA00 0400D20A12000000`).
    J1939Frames,
    /// J1708 messages as hex bytes, one per line (MID first; a trailing
    /// checksum byte is checked when present).
    J1587,
    /// A display code typed by hand (`E21-3`, `21.3`, `21 / 3`).
    Display,
}

/// Decode `input` in `format`. `kind` names the signal kind for display
/// codes (`pump40.code`); other formats have their own.
pub fn decode(format: Format, input: &str, kind: Option<&str>) -> Decoded {
    let mut out = Decoded::default();
    match format {
        Format::J1939Candump | Format::J1939Frames => {
            let mut asm = j1939::Reassembler::default();
            for (n, line) in input.lines().enumerate() {
                let line = line.trim();
                if line.is_empty() || line.starts_with('#') {
                    continue;
                }
                let frame = if format == Format::J1939Candump {
                    j1939::parse_candump(line)
                } else {
                    j1939::parse_frame_line(line)
                };
                match frame {
                    Ok(f) => match asm.feed(&f) {
                        Ok(Some(msg)) if msg.pgn == j1939::PGN_DM1 => match j1939::parse_dm1(msg.source, &msg.data) {
                            Ok(d) => out.dm1.push(d),
                            Err(e) => out.errors.push(format!("line {}: {e}", n + 1)),
                        },
                        Ok(_) => {}
                        Err(e) => out.errors.push(format!("line {}: {e}", n + 1)),
                    },
                    Err(e) => out.errors.push(format!("line {}: {e}", n + 1)),
                }
            }
            out.observations = j1939::observations(&out.dm1);
        }
        Format::J1587 => {
            for (n, line) in input.lines().enumerate() {
                let line = line.trim();
                if line.is_empty() || line.starts_with('#') {
                    continue;
                }
                match j1587::parse_hex_message(line) {
                    Ok(dtcs) => out.j1587.extend(dtcs),
                    Err(e) => out.errors.push(format!("line {}: {e}", n + 1)),
                }
            }
            out.observations = j1587::observations(&out.j1587);
        }
        Format::Display => match display::parse(input) {
            Ok(code) => out.observations.push(Observation {
                signal_kind: kind.map(str::to_string),
                value: code.normalized(),
            }),
            Err(e) => out.errors.push(e),
        },
    }
    out
}

/// Hex text (spaces, colons or nothing between bytes) to bytes.
pub(crate) fn hex_bytes(s: &str) -> Result<Vec<u8>, String> {
    let digits: String = s
        .chars()
        .filter(|c| !c.is_whitespace() && *c != ':' && *c != ',')
        .collect();
    let digits = digits.trim_start_matches("0x");
    if digits.len() % 2 != 0 {
        return Err(format!("odd number of hex digits in {s:?}"));
    }
    (0..digits.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&digits[i..i + 2], 16).map_err(|_| format!("not hex: {s:?}")))
        .collect()
}
