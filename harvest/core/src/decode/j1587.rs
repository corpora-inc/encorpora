//! SAE J1587 diagnostic codes (PID 194) in J1708 messages.
//!
//! A J1708 message is the transmitter's MID, then parameters, then a
//! checksum (the two's complement of the byte sum, so all bytes sum to 0
//! mod 256). A parameter is a PID byte and its data: PIDs 0–127 carry one
//! byte, 128–191 two, 192–253 a length byte and that many bytes; PID 255
//! escapes to page 2 (the next byte is the PID, numbered from 256), with
//! the same length rules by the low byte.
//!
//! PID 194 ("transmitter system diagnostic code and occurrence count
//! table") holds codes of two or three bytes: the code (a PID or a SID),
//! a code character, and the occurrence count when the character says so.
//! The code character: bit 8 occurrence count included; bit 7 1 =
//! previously active (inactive), 0 = active; bit 6 1 = the code is a SID,
//! 0 = a PID; bit 5 1 = the code is on page 2 (add 256); bits 4–1 the FMI.

use crate::maint::search::Observation;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// One diagnostic code.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
pub struct Dtc {
    /// The transmitter (message identifier).
    pub mid: u8,
    /// A PID (`sid` false) or a SID (`sid` true) of the transmitter.
    pub code: u16,
    pub sid: bool,
    pub fmi: u8,
    /// False when the code is previously active.
    pub active: bool,
    pub occurrences: Option<u8>,
}

impl Dtc {
    /// `mid:<n>/pid:<n>/fmi:<n>` or `mid:<n>/sid:<n>/fmi:<n>`.
    pub fn value(&self) -> String {
        format!(
            "mid:{}/{}:{}/fmi:{}",
            self.mid,
            if self.sid { "sid" } else { "pid" },
            self.code,
            self.fmi
        )
    }
}

/// Parse one message of hex bytes. A trailing checksum byte is taken off
/// and checked when the bytes sum to 0 mod 256; otherwise every byte is
/// read as data.
pub fn parse_hex_message(line: &str) -> Result<Vec<Dtc>, String> {
    let mut bytes = super::hex_bytes(line)?;
    if bytes.len() < 2 {
        return Err("a J1708 message has at least a MID and a parameter".into());
    }
    let sum: u8 = bytes.iter().fold(0u8, |a, b| a.wrapping_add(*b));
    if sum == 0 {
        bytes.pop();
    }
    parse_message(&bytes)
}

/// Parse a message without its checksum.
pub fn parse_message(bytes: &[u8]) -> Result<Vec<Dtc>, String> {
    let mid = *bytes.first().ok_or("empty message")?;
    let mut i = 1;
    let mut out = Vec::new();
    while i < bytes.len() {
        let mut pid = bytes[i] as u16;
        i += 1;
        if pid == 255 {
            pid = 256 + *bytes.get(i).ok_or("PID 255 without a page-2 PID")? as u16;
            i += 1;
        }
        let low = (pid & 0xFF) as u8;
        let len = match low {
            0..=127 => 1,
            128..=191 => 2,
            192..=253 => {
                let n = *bytes
                    .get(i)
                    .ok_or(format!("PID {pid} without its length"))?
                    as usize;
                i += 1;
                n
            }
            _ => return Err(format!("PID {pid}: a data link escape is not decoded")),
        };
        let data = bytes.get(i..i + len).ok_or(format!(
            "PID {pid}: {len} bytes announced, {} left",
            bytes.len() - i
        ))?;
        i += len;
        if pid == 194 {
            out.extend(parse_pid194(mid, data)?);
        }
    }
    Ok(out)
}

/// The codes of a PID 194 data field.
pub fn parse_pid194(mid: u8, data: &[u8]) -> Result<Vec<Dtc>, String> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < data.len() {
        let code = data[i] as u16;
        let ch = *data
            .get(i + 1)
            .ok_or("PID 194: a code without its code character")?;
        i += 2;
        let occurrences = if ch & 0x80 != 0 {
            let n = *data
                .get(i)
                .ok_or("PID 194: occurrence count announced, missing")?;
            i += 1;
            Some(n)
        } else {
            None
        };
        out.push(Dtc {
            mid,
            code: code + if ch & 0x10 != 0 { 256 } else { 0 },
            sid: ch & 0x20 != 0,
            fmi: ch & 0x0F,
            active: ch & 0x40 == 0,
            occurrences,
        });
    }
    Ok(out)
}

/// `j1587.dtc` observations for the active codes, each once.
pub fn observations(dtcs: &[Dtc]) -> Vec<Observation> {
    let mut seen = std::collections::BTreeSet::new();
    dtcs.iter()
        .filter(|d| d.active)
        .filter(|d| seen.insert(d.value()))
        .map(|d| Observation {
            signal_kind: Some("j1587.dtc".into()),
            value: d.value(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pid194_codes() {
        // MID 128 (engine): PID 194, 5 bytes: PID 110 FMI 0 active with
        // count 3; SID 20 FMI 3 previously active, no count.
        let msg = [128u8, 194, 5, 110, 0x80, 3, 20, 0x63];
        let d = parse_message(&msg).unwrap();
        assert_eq!(d.len(), 2);
        assert_eq!(
            d[0],
            Dtc {
                mid: 128,
                code: 110,
                sid: false,
                fmi: 0,
                active: true,
                occurrences: Some(3)
            }
        );
        assert_eq!(
            d[1],
            Dtc {
                mid: 128,
                code: 20,
                sid: true,
                fmi: 3,
                active: false,
                occurrences: None
            }
        );
        assert_eq!(observations(&d).len(), 1, "only active codes");
    }

    #[test]
    fn other_parameters_are_skipped_and_checksums_checked() {
        // MID 128; PID 84 (1 byte), PID 190 (2 bytes), PID 194 one code.
        let mut msg = vec![128u8, 84, 0x40, 190, 0x10, 0x27, 194, 2, 100, 0x01];
        let sum: u8 = msg.iter().fold(0u8, |a, b| a.wrapping_add(*b));
        msg.push(0u8.wrapping_sub(sum));
        let hex: String = msg.iter().map(|b| format!("{b:02X} ")).collect();
        let d = parse_hex_message(&hex).unwrap();
        assert_eq!(d[0].value(), "mid:128/pid:100/fmi:1");
        assert!(
            parse_message(&[128, 194, 9, 1]).is_err(),
            "length past the end"
        );
    }
}
