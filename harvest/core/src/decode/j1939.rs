//! SAE J1939 DM1 (active diagnostic trouble codes, PGN 65226).
//!
//! A 29-bit CAN identifier is priority (3 bits), extended data page,
//! data page, PDU format (PF), PDU specific (PS) and source address. PF
//! below 240 is PDU1: PS is a destination and not part of the PGN. A DM1
//! longer than 8 bytes travels as a transport-protocol session: a
//! connection-management frame (TP.CM, PGN 60416: BAM to all, or RTS to
//! one node) announces the size, packet count and PGN, then TP.DT frames
//! (PGN 60160) carry 7 bytes each, numbered from 1.
//!
//! DM1 data: lamp status (byte 1: MIL, red stop, amber warning,
//! protect, 2 bits each; byte 2: their flash states), then 4 bytes per
//! DTC: SPN (19 bits: byte 3, byte 4, and the top 3 bits of byte 5), FMI
//! (low 5 bits of byte 5), conversion method (top bit of byte 6) and
//! occurrence count (low 7 bits of byte 6). A DM1 with SPN 0 and FMI 0 is
//! "no active codes".

use crate::maint::search::Observation;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const PGN_DM1: u32 = 0xFECA;
pub const PGN_TP_CM: u32 = 0xEC00;
pub const PGN_TP_DT: u32 = 0xEB00;

/// One CAN frame with a 29-bit identifier.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Frame {
    pub id: u32,
    pub data: Vec<u8>,
}

impl Frame {
    pub fn priority(&self) -> u8 {
        ((self.id >> 26) & 0x7) as u8
    }
    pub fn source(&self) -> u8 {
        (self.id & 0xFF) as u8
    }
    fn pf(&self) -> u8 {
        ((self.id >> 16) & 0xFF) as u8
    }
    fn ps(&self) -> u8 {
        ((self.id >> 8) & 0xFF) as u8
    }
    /// The parameter group number.
    pub fn pgn(&self) -> u32 {
        let dp = (self.id >> 24) & 0x3;
        let pf = self.pf() as u32;
        let ps = if pf >= 240 { self.ps() as u32 } else { 0 };
        (dp << 16) | (pf << 8) | ps
    }
    /// The destination of a PDU1 frame (`None` for PDU2, broadcast).
    pub fn destination(&self) -> Option<u8> {
        (self.pf() < 240).then(|| self.ps())
    }
}

/// `(1609459200.000000) can0 18FECA00#0400D20A12000000` or
/// `can0  18FECA00   [8]  04 00 D2 0A 12 00 00 00`.
pub fn parse_candump(line: &str) -> Result<Frame, String> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    if let Some(p) = parts.iter().find(|p| p.contains('#')) {
        let (id, data) = p.split_once('#').expect("has #");
        return frame(id, &super::hex_bytes(data)?);
    }
    // can0 ID [n] b0 b1 …
    let i = parts
        .iter()
        .position(|p| p.starts_with('[') && p.ends_with(']'))
        .ok_or_else(|| format!("not a candump line: {line:?}"))?;
    if i == 0 {
        return Err(format!("no identifier in {line:?}"));
    }
    let n: usize = parts[i]
        .trim_matches(|c| c == '[' || c == ']')
        .parse()
        .map_err(|_| format!("bad length in {line:?}"))?;
    let data = super::hex_bytes(&parts[i + 1..].join(""))?;
    if data.len() != n {
        return Err(format!("{line:?}: length {n} but {} bytes", data.len()));
    }
    frame(parts[i - 1], &data)
}

/// `<id hex> <data hex>`.
pub fn parse_frame_line(line: &str) -> Result<Frame, String> {
    let (id, data) = line
        .trim()
        .split_once(char::is_whitespace)
        .ok_or_else(|| format!("not `<id> <data>`: {line:?}"))?;
    frame(id, &super::hex_bytes(data)?)
}

fn frame(id: &str, data: &[u8]) -> Result<Frame, String> {
    let id = u32::from_str_radix(id.trim().trim_start_matches("0x"), 16)
        .map_err(|_| format!("bad CAN id {id:?}"))?;
    if id > 0x1FFF_FFFF {
        return Err(format!("CAN id {id:#x} is wider than 29 bits"));
    }
    if data.len() > 8 {
        return Err(format!("{} data bytes: classic CAN carries at most 8", data.len()));
    }
    Ok(Frame {
        id,
        data: data.to_vec(),
    })
}

/// A complete J1939 message (single frame, or reassembled).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Message {
    pub pgn: u32,
    pub source: u8,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone)]
struct Session {
    pgn: u32,
    size: usize,
    packets: u8,
    next: u8,
    data: Vec<u8>,
}

/// Reassembles transport-protocol sessions per source and destination.
#[derive(Debug, Default)]
pub struct Reassembler {
    sessions: BTreeMap<(u8, u8), Session>,
}

impl Reassembler {
    /// Feed one frame; returns a message when one completes.
    pub fn feed(&mut self, f: &Frame) -> Result<Option<Message>, String> {
        let dest = f.destination().unwrap_or(0xFF);
        match f.pgn() & 0x3FF00 {
            PGN_TP_CM => {
                let d = &f.data;
                if d.len() < 8 {
                    return Err("TP.CM shorter than 8 bytes".into());
                }
                match d[0] {
                    // BAM (32) and RTS (16) open a session.
                    32 | 16 => {
                        let size = u16::from_le_bytes([d[1], d[2]]) as usize;
                        let packets = d[3];
                        let pgn = u32::from_le_bytes([d[5], d[6], d[7], 0]);
                        if size < 9 || size > 1785 || packets as usize != size.div_ceil(7) {
                            return Err(format!("TP.CM: {size} bytes in {packets} packets"));
                        }
                        self.sessions.insert(
                            (f.source(), dest),
                            Session {
                                pgn,
                                size,
                                packets,
                                next: 1,
                                data: Vec::with_capacity(size),
                            },
                        );
                        Ok(None)
                    }
                    // Abort.
                    255 => {
                        self.sessions.remove(&(f.source(), dest));
                        Ok(None)
                    }
                    _ => Ok(None), // CTS, end of message ack: no data
                }
            }
            PGN_TP_DT => {
                let key = (f.source(), dest);
                let Some(s) = self.sessions.get_mut(&key) else {
                    return Err(format!("TP.DT from {:#04x} with no open session", f.source()));
                };
                if f.data.len() < 8 {
                    return Err("TP.DT shorter than 8 bytes".into());
                }
                if f.data[0] != s.next {
                    self.sessions.remove(&key);
                    return Err("TP.DT out of sequence; session dropped".into());
                }
                s.data.extend_from_slice(&f.data[1..8]);
                s.next += 1;
                if s.next > s.packets {
                    let s = self.sessions.remove(&key).expect("present");
                    let mut data = s.data;
                    data.truncate(s.size);
                    return Ok(Some(Message {
                        pgn: s.pgn,
                        source: f.source(),
                        data,
                    }));
                }
                Ok(None)
            }
            _ => Ok(Some(Message {
                pgn: f.pgn(),
                source: f.source(),
                data: f.data.clone(),
            })),
        }
    }
}

/// A lamp's state.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Lamp {
    Off,
    On,
    Error,
    NotAvailable,
}

fn lamp(bits: u8) -> Lamp {
    match bits & 0x3 {
        0 => Lamp::Off,
        1 => Lamp::On,
        2 => Lamp::Error,
        _ => Lamp::NotAvailable,
    }
}

/// The four DM1 lamps.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
pub struct Lamps {
    pub malfunction: Lamp,
    pub red_stop: Lamp,
    pub amber_warning: Lamp,
    pub protect: Lamp,
}

/// One active trouble code.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
pub struct Dtc {
    pub spn: u32,
    pub fmi: u8,
    pub occurrences: u8,
    /// The SPN conversion method bit (1: an older byte order; read as
    /// sent, flagged so the host can tell).
    pub conversion_method: bool,
}

/// A DM1 message from one source.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
pub struct Dm1 {
    pub source: u8,
    pub lamps: Lamps,
    /// Empty when the source reports no active codes.
    pub dtcs: Vec<Dtc>,
}

/// Decode a DM1 payload from `source`.
pub fn parse_dm1(source: u8, data: &[u8]) -> Result<Dm1, String> {
    if data.len() < 6 {
        return Err(format!("DM1 of {} bytes: at least 6", data.len()));
    }
    let b = data[0];
    let lamps = Lamps {
        malfunction: lamp(b >> 6),
        red_stop: lamp(b >> 4),
        amber_warning: lamp(b >> 2),
        protect: lamp(b),
    };
    let mut dtcs = Vec::new();
    for c in data[2..].chunks(4) {
        if c.len() < 4 {
            break; // padding
        }
        if c == [0xFF, 0xFF, 0xFF, 0xFF] {
            continue; // unused
        }
        let spn = c[0] as u32 | (c[1] as u32) << 8 | ((c[2] as u32 & 0xE0) << 11);
        let fmi = c[2] & 0x1F;
        if spn == 0 && fmi == 0 {
            continue; // no active codes
        }
        dtcs.push(Dtc {
            spn,
            fmi,
            occurrences: c[3] & 0x7F,
            conversion_method: c[3] & 0x80 != 0,
        });
    }
    Ok(Dm1 { source, lamps, dtcs })
}

/// `j1939.dm1` observations (`spn:<n>/fmi:<n>`), one per distinct code.
pub fn observations(dm1: &[Dm1]) -> Vec<Observation> {
    let mut seen = std::collections::BTreeSet::new();
    let mut out = Vec::new();
    for d in dm1 {
        for c in &d.dtcs {
            let v = format!("spn:{}/fmi:{}", c.spn, c.fmi);
            if seen.insert(v.clone()) {
                out.push(Observation {
                    signal_kind: Some("j1939.dm1".into()),
                    value: v,
                });
            }
        }
    }
    out
}

/// Encode one DTC (tests and sample generation).
pub fn encode_dtc(spn: u32, fmi: u8, oc: u8) -> [u8; 4] {
    [
        (spn & 0xFF) as u8,
        ((spn >> 8) & 0xFF) as u8,
        (((spn >> 11) & 0xE0) as u8) | (fmi & 0x1F),
        oc & 0x7F,
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pgn_of_pdu1_and_pdu2() {
        let dm1 = Frame { id: 0x18FECA00, data: vec![] };
        assert_eq!((dm1.pgn(), dm1.source(), dm1.priority()), (PGN_DM1, 0, 6));
        assert_eq!(dm1.destination(), None);
        let cm = Frame { id: 0x1CECFF00, data: vec![] };
        assert_eq!(cm.pgn(), PGN_TP_CM);
        assert_eq!(cm.destination(), Some(0xFF));
    }

    #[test]
    fn dtc_round_trip() {
        for (spn, fmi, oc) in [(110, 0, 1), (524287, 31, 127), (100, 1, 3), (65535, 18, 0), (70000, 4, 9)] {
            let b = encode_dtc(spn, fmi, oc);
            let mut data = vec![0x40, 0xFF];
            data.extend_from_slice(&b);
            let d = parse_dm1(0, &data).unwrap();
            assert_eq!((d.dtcs[0].spn, d.dtcs[0].fmi, d.dtcs[0].occurrences), (spn, fmi, oc));
        }
    }
}
