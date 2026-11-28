//! MAVLink 2 (and 1) frames from an autopilot: a `.tlog` file (each frame
//! after an 8-byte big-endian microsecond timestamp) or a raw byte stream.
//! Pure decoding: the bytes come in, decoded messages and observations go
//! out. A reader that takes frames from a file or a UDP or TCP address
//! lives outside this module (`harvest mavlink`).
//!
//! A frame is checked with its CRC (X.25 over the header after the start
//! byte and the payload, plus the message's CRC_EXTRA); a MAVLink 2
//! payload is zero-extended to its full length before decoding (senders
//! trim trailing zeros). Signed frames are read, the signature skipped:
//! checking it needs the link's secret key, which a decoder does not hold.
//!
//! Messages decoded: HEARTBEAT (0), SYS_STATUS (1), PARAM_VALUE (22),
//! BATTERY_STATUS (147), AUTOPILOT_VERSION (148), STATUSTEXT (253, chunked
//! texts reassembled by `id` and `chunk_seq`). Others are counted and
//! skipped.

use crate::maint::resolve::Plate;
use crate::maint::search::Observation;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// `(msgid, CRC_EXTRA, full payload length)` of the messages decoded.
const KNOWN: &[(u32, u8, usize)] = &[
    (0, 50, 9),
    (1, 124, 31),
    (22, 220, 25),
    (147, 154, 36),
    (148, 178, 60),
    (253, 83, 54),
];

/// X.25 / MCRF4XX, as MAVLink computes it.
pub fn crc_x25(bytes: &[u8], seed: u16) -> u16 {
    let mut crc = seed;
    for &b in bytes {
        let mut tmp = b ^ (crc & 0xFF) as u8;
        tmp ^= tmp << 4;
        crc = (crc >> 8) ^ ((tmp as u16) << 8) ^ ((tmp as u16) << 3) ^ ((tmp as u16) >> 4);
    }
    crc
}

/// One frame.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Frame {
    pub version: u8,
    pub seq: u8,
    pub sysid: u8,
    pub compid: u8,
    pub msgid: u32,
    /// Zero-extended to the message's full length when it is known.
    pub payload: Vec<u8>,
    pub signed: bool,
}

/// What reading the bytes found.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Stats {
    pub frames: u64,
    pub bad_crc: u64,
    /// Valid-looking frames of messages this decoder does not know (their
    /// CRC cannot be checked without the message's CRC_EXTRA).
    pub unknown: u64,
    pub signed: u64,
    /// Bytes skipped between frames.
    pub skipped_bytes: u64,
}

/// Split a byte stream into frames. `tlog`: each frame follows an 8-byte
/// timestamp (the scan resynchronizes on the start byte either way).
pub fn frames(bytes: &[u8], tlog: bool) -> (Vec<Frame>, Stats) {
    let mut out = Vec::new();
    let mut st = Stats::default();
    let mut i = 0;
    while i < bytes.len() {
        if tlog
            && i + 8 < bytes.len()
            && (bytes[i + 8] == 0xFD || bytes[i + 8] == 0xFE)
            && bytes[i] != 0xFD
            && bytes[i] != 0xFE
        {
            i += 8;
            continue;
        }
        let start = bytes[i];
        if start != 0xFD && start != 0xFE {
            i += 1;
            st.skipped_bytes += 1;
            continue;
        }
        let parsed = if start == 0xFD {
            v2(&bytes[i..])
        } else {
            v1(&bytes[i..])
        };
        match parsed {
            Parsed::Frame(f, used) => {
                st.frames += 1;
                if f.signed {
                    st.signed += 1;
                }
                out.push(f);
                i += used;
            }
            Parsed::Unknown(used) => {
                st.unknown += 1;
                i += used;
            }
            Parsed::BadCrc => {
                st.bad_crc += 1;
                i += 1;
            }
            Parsed::Short => break,
        }
    }
    (out, st)
}

enum Parsed {
    Frame(Frame, usize),
    Unknown(usize),
    BadCrc,
    Short,
}

fn known(msgid: u32) -> Option<(u8, usize)> {
    KNOWN.iter().find(|k| k.0 == msgid).map(|k| (k.1, k.2))
}

fn v2(b: &[u8]) -> Parsed {
    if b.len() < 12 {
        return Parsed::Short;
    }
    let len = b[1] as usize;
    let incompat = b[2];
    let signed = incompat & 0x01 != 0;
    let total = 10 + len + 2 + if signed { 13 } else { 0 };
    if b.len() < total {
        return Parsed::Short;
    }
    let msgid = b[7] as u32 | (b[8] as u32) << 8 | (b[9] as u32) << 16;
    let Some((extra, full)) = known(msgid) else {
        return Parsed::Unknown(total);
    };
    let mut crc = crc_x25(&b[1..10 + len], 0xFFFF);
    crc = crc_x25(&[extra], crc);
    if crc != u16::from_le_bytes([b[10 + len], b[11 + len]]) {
        return Parsed::BadCrc;
    }
    let mut payload = b[10..10 + len].to_vec();
    if payload.len() < full {
        payload.resize(full, 0);
    }
    Parsed::Frame(
        Frame {
            version: 2,
            seq: b[4],
            sysid: b[5],
            compid: b[6],
            msgid,
            payload,
            signed,
        },
        total,
    )
}

fn v1(b: &[u8]) -> Parsed {
    if b.len() < 8 {
        return Parsed::Short;
    }
    let len = b[1] as usize;
    let total = 6 + len + 2;
    if b.len() < total {
        return Parsed::Short;
    }
    let msgid = b[5] as u32;
    let Some((extra, full)) = known(msgid) else {
        return Parsed::Unknown(total);
    };
    let mut crc = crc_x25(&b[1..6 + len], 0xFFFF);
    crc = crc_x25(&[extra], crc);
    if crc != u16::from_le_bytes([b[6 + len], b[7 + len]]) {
        return Parsed::BadCrc;
    }
    let mut payload = b[6..6 + len].to_vec();
    if payload.len() < full {
        payload.resize(full, 0);
    }
    Parsed::Frame(
        Frame {
            version: 1,
            seq: b[2],
            sysid: b[3],
            compid: b[4],
            msgid,
            payload,
            signed: false,
        },
        total,
    )
}

fn u16le(p: &[u8], o: usize) -> u16 {
    u16::from_le_bytes([p[o], p[o + 1]])
}
fn i16le(p: &[u8], o: usize) -> i16 {
    i16::from_le_bytes([p[o], p[o + 1]])
}
fn u32le(p: &[u8], o: usize) -> u32 {
    u32::from_le_bytes([p[o], p[o + 1], p[o + 2], p[o + 3]])
}
fn i32le(p: &[u8], o: usize) -> i32 {
    i32::from_le_bytes([p[o], p[o + 1], p[o + 2], p[o + 3]])
}
fn cstr(p: &[u8]) -> String {
    cstr_raw(p).trim_end().to_string()
}

/// Up to the first NUL, spaces kept (a chunk may end in one).
fn cstr_raw(p: &[u8]) -> String {
    let end = p.iter().position(|&b| b == 0).unwrap_or(p.len());
    String::from_utf8_lossy(&p[..end]).into_owned()
}

/// HEARTBEAT.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Heartbeat {
    pub sysid: u8,
    pub vehicle_type: String,
    pub autopilot: String,
    pub custom_mode: u32,
    pub base_mode: u8,
    pub armed: bool,
    pub system_status: String,
}

/// SYS_STATUS: sensors by name, battery.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct SysStatus {
    pub sysid: u8,
    pub present: Vec<String>,
    pub enabled: Vec<String>,
    /// Present and enabled but not healthy.
    pub unhealthy: Vec<String>,
    /// Volts; `None` when the autopilot does not know.
    pub battery_voltage: Option<f64>,
    /// Amperes.
    pub battery_current: Option<f64>,
    /// Percent.
    pub battery_remaining: Option<i8>,
    pub load_percent: f64,
}

/// STATUSTEXT, chunks joined.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct StatusText {
    pub sysid: u8,
    /// `emergency` … `debug`.
    pub severity: String,
    pub text: String,
}

/// AUTOPILOT_VERSION.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct AutopilotVersion {
    pub sysid: u8,
    /// `major.minor.patch`.
    pub firmware: String,
    /// `official`, `rc`, `beta`, `alpha`, `dev` or a number.
    pub firmware_type: String,
    /// The flight software's custom version (a git hash, as autopilots send it).
    pub git_hash: String,
    pub board_version: u32,
    pub vendor_id: u16,
    pub product_id: u16,
    pub capabilities: u64,
    pub uid: u64,
}

/// BATTERY_STATUS.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Battery {
    pub sysid: u8,
    pub id: u8,
    /// Volts, the sum of the cells reported.
    pub voltage: Option<f64>,
    /// Cell volts, as reported.
    pub cells: Vec<f64>,
    pub current: Option<f64>,
    pub consumed_mah: Option<i32>,
    pub remaining: Option<i8>,
    /// Degrees Celsius.
    pub temperature: Option<f64>,
}

/// Everything decoded from a stream.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Decoded {
    pub stats: Stats,
    /// Newest per system.
    pub heartbeats: Vec<Heartbeat>,
    pub sys_status: Vec<SysStatus>,
    pub autopilot_versions: Vec<AutopilotVersion>,
    /// Newest per system and battery.
    pub batteries: Vec<Battery>,
    /// In order received.
    pub status_texts: Vec<StatusText>,
    /// Newest value of each parameter.
    pub params: BTreeMap<String, f64>,
    /// For `signal.match`.
    pub observations: Vec<Observation>,
    /// For `equip.resolve`: firmware, board and parameters.
    pub plate: Plate,
}

fn vehicle_type(t: u8) -> String {
    const NAMES: &[&str] = &[
        "generic",
        "fixed_wing",
        "quadrotor",
        "coaxial",
        "helicopter",
        "antenna_tracker",
        "gcs",
        "airship",
        "free_balloon",
        "rocket",
        "ground_rover",
        "surface_boat",
        "submarine",
        "hexarotor",
        "octorotor",
        "tricopter",
        "flapping_wing",
        "kite",
        "onboard_controller",
        "vtol_tailsitter_duorotor",
        "vtol_tailsitter_quadrotor",
        "vtol_tiltrotor",
        "vtol_fixedrotor",
        "vtol_tailsitter",
        "vtol_tiltwing",
        "vtol_reserved5",
        "gimbal",
        "adsb",
        "parafoil",
        "dodecarotor",
        "camera",
        "charging_station",
        "flarm",
        "servo",
        "odid",
        "decarotor",
        "battery",
        "parachute",
        "log",
        "osd",
        "imu",
        "gps",
        "winch",
    ];
    NAMES
        .get(t as usize)
        .map_or_else(|| format!("type_{t}"), |n| n.to_string())
}

fn autopilot(a: u8) -> String {
    match a {
        0 => "generic".into(),
        3 => "ardupilotmega".into(),
        8 => "invalid".into(),
        12 => "px4".into(),
        o => format!("autopilot_{o}"),
    }
}

fn system_status(s: u8) -> String {
    [
        "uninit",
        "boot",
        "calibrating",
        "standby",
        "active",
        "critical",
        "emergency",
        "poweroff",
        "flight_termination",
    ]
    .get(s as usize)
    .map_or_else(|| format!("status_{s}"), |n| n.to_string())
}

fn severity(s: u8) -> String {
    [
        "emergency",
        "alert",
        "critical",
        "error",
        "warning",
        "notice",
        "info",
        "debug",
    ]
    .get(s as usize)
    .map_or_else(|| format!("severity_{s}"), |n| n.to_string())
}

/// MAV_SYS_STATUS_SENSOR bit names, bit 0 first.
const SENSORS: &[&str] = &[
    "3d_gyro",
    "3d_accel",
    "3d_mag",
    "absolute_pressure",
    "differential_pressure",
    "gps",
    "optical_flow",
    "vision_position",
    "laser_position",
    "external_ground_truth",
    "angular_rate_control",
    "attitude_stabilization",
    "yaw_position",
    "z_altitude_control",
    "xy_position_control",
    "motor_outputs",
    "rc_receiver",
    "3d_gyro2",
    "3d_accel2",
    "3d_mag2",
    "geofence",
    "ahrs",
    "terrain",
    "reverse_motor",
    "logging",
    "battery",
    "proximity",
    "satcom",
    "prearm_check",
    "obstacle_avoidance",
    "propulsion",
    "extension_used",
];

fn bits(v: u32) -> Vec<String> {
    (0..32)
        .filter(|b| v & (1 << b) != 0)
        .map(|b| SENSORS[b].to_string())
        .collect()
}

fn firmware_type(t: u8) -> String {
    match t {
        0 => "dev".into(),
        64 => "alpha".into(),
        128 => "beta".into(),
        192 => "rc".into(),
        255 => "official".into(),
        o => o.to_string(),
    }
}

/// Decode a stream.
pub fn decode(bytes: &[u8], tlog: bool) -> Decoded {
    let (frames, stats) = frames(bytes, tlog);
    let mut d = Decoded {
        stats,
        ..Default::default()
    };
    // Chunked STATUSTEXT: (sysid, id) → chunks so far.
    type Chunks = BTreeMap<(u8, u16), (u8, Vec<(u8, String)>)>;
    let mut chunks: Chunks = BTreeMap::new();
    let mut heartbeats: BTreeMap<u8, Heartbeat> = BTreeMap::new();
    let mut sys: BTreeMap<u8, SysStatus> = BTreeMap::new();
    let mut versions: BTreeMap<u8, AutopilotVersion> = BTreeMap::new();
    let mut batteries: BTreeMap<(u8, u8), Battery> = BTreeMap::new();
    for f in &frames {
        let p = &f.payload;
        match f.msgid {
            0 => {
                let base = p[6];
                heartbeats.insert(
                    f.sysid,
                    Heartbeat {
                        sysid: f.sysid,
                        custom_mode: u32le(p, 0),
                        vehicle_type: vehicle_type(p[4]),
                        autopilot: autopilot(p[5]),
                        base_mode: base,
                        armed: base & 0x80 != 0,
                        system_status: system_status(p[7]),
                    },
                );
            }
            1 => {
                let present = u32le(p, 0);
                let enabled = u32le(p, 4);
                let health = u32le(p, 8);
                let mv = u16le(p, 14);
                let ca = i16le(p, 16);
                sys.insert(
                    f.sysid,
                    SysStatus {
                        sysid: f.sysid,
                        present: bits(present),
                        enabled: bits(enabled),
                        unhealthy: bits(present & enabled & !health),
                        battery_voltage: (mv != u16::MAX).then(|| mv as f64 / 1000.0),
                        battery_current: (ca != -1).then(|| ca as f64 / 100.0),
                        battery_remaining: (p[30] as i8 != -1).then_some(p[30] as i8),
                        load_percent: u16le(p, 12) as f64 / 10.0,
                    },
                );
            }
            22 => {
                let v = f32::from_le_bytes([p[0], p[1], p[2], p[3]]) as f64;
                let name = cstr(&p[8..24]);
                if !name.is_empty() {
                    d.params.insert(name, (v * 1e6).round() / 1e6);
                }
            }
            147 => {
                let cells: Vec<f64> = (0..10)
                    .map(|i| u16le(p, 10 + 2 * i))
                    .filter(|&c| c != u16::MAX)
                    .map(|c| c as f64 / 1000.0)
                    .collect();
                let ca = i16le(p, 30);
                let t = i16le(p, 8);
                let consumed = i32le(p, 0);
                batteries.insert(
                    (f.sysid, p[32]),
                    Battery {
                        sysid: f.sysid,
                        id: p[32],
                        voltage: (!cells.is_empty())
                            .then(|| (cells.iter().sum::<f64>() * 1000.0).round() / 1000.0),
                        cells,
                        current: (ca != -1).then(|| ca as f64 / 100.0),
                        consumed_mah: (consumed != -1).then_some(consumed),
                        remaining: (p[35] as i8 != -1).then_some(p[35] as i8),
                        temperature: (t != i16::MAX).then(|| t as f64 / 100.0),
                    },
                );
            }
            148 => {
                let v = u32le(p, 16);
                let custom = &p[36..44];
                versions.insert(
                    f.sysid,
                    AutopilotVersion {
                        sysid: f.sysid,
                        capabilities: u64::from_le_bytes(p[0..8].try_into().expect("8")),
                        uid: u64::from_le_bytes(p[8..16].try_into().expect("8")),
                        firmware: format!("{}.{}.{}", v >> 24, (v >> 16) & 0xFF, (v >> 8) & 0xFF),
                        firmware_type: firmware_type((v & 0xFF) as u8),
                        git_hash: if custom.iter().all(|c| c.is_ascii_hexdigit() || *c == 0) {
                            cstr(custom)
                        } else {
                            custom.iter().map(|b| format!("{b:02x}")).collect()
                        },
                        board_version: u32le(p, 28),
                        vendor_id: u16le(p, 32),
                        product_id: u16le(p, 34),
                    },
                );
            }
            253 => {
                let sev = p[0];
                let piece = cstr_raw(&p[1..51]);
                let id = u16le(p, 51);
                let seq = p[53];
                if id == 0 {
                    d.status_texts.push(StatusText {
                        sysid: f.sysid,
                        severity: severity(sev),
                        text: piece.trim_end().to_string(),
                    });
                } else {
                    let full = p[1..51].iter().all(|&b| b != 0);
                    let e = chunks.entry((f.sysid, id)).or_insert((sev, Vec::new()));
                    e.1.push((seq, piece));
                    // The last chunk is the one shorter than 50 characters.
                    if !full {
                        let (sev, mut parts) = chunks.remove(&(f.sysid, id)).expect("present");
                        parts.sort_by_key(|(s, _)| *s);
                        parts.dedup_by_key(|(s, _)| *s);
                        d.status_texts.push(StatusText {
                            sysid: f.sysid,
                            severity: severity(sev),
                            text: parts
                                .into_iter()
                                .map(|(_, t)| t)
                                .collect::<String>()
                                .trim_end()
                                .to_string(),
                        });
                    }
                }
            }
            _ => {}
        }
    }
    // Chunk runs that never ended: keep what arrived.
    for ((sysid, _), (sev, mut parts)) in chunks {
        parts.sort_by_key(|(s, _)| *s);
        d.status_texts.push(StatusText {
            sysid,
            severity: severity(sev),
            text: parts
                .into_iter()
                .map(|(_, t)| t)
                .collect::<String>()
                .trim_end()
                .to_string(),
        });
    }
    d.heartbeats = heartbeats.into_values().collect();
    d.sys_status = sys.into_values().collect();
    d.autopilot_versions = versions.into_values().collect();
    d.batteries = batteries.into_values().collect();
    d.observations = observations(&d);
    d.plate = plate(&d);
    d
}

fn obs(kind: &str, value: String) -> Observation {
    Observation {
        signal_kind: Some(kind.into()),
        value,
    }
}

/// The observations a pack's signal map matches against:
/// `mavlink.statustext` (the text), `mavlink.sensor_unhealthy` (a sensor
/// name), `mavlink.armed` (`true`/`false`), `mavlink.vehicle_type`,
/// `mavlink.mode` (`<autopilot>:<custom_mode>`), `mavlink.firmware`.
pub fn observations(d: &Decoded) -> Vec<Observation> {
    let mut out = Vec::new();
    let mut seen = std::collections::BTreeSet::new();
    let mut push = |o: Observation| {
        if seen.insert((o.signal_kind.clone(), o.value.clone())) {
            out.push(o);
        }
    };
    for t in &d.status_texts {
        push(obs("mavlink.statustext", t.text.clone()));
    }
    for s in &d.sys_status {
        for u in &s.unhealthy {
            push(obs("mavlink.sensor_unhealthy", u.clone()));
        }
    }
    for h in &d.heartbeats {
        push(obs("mavlink.armed", h.armed.to_string()));
        push(obs("mavlink.vehicle_type", h.vehicle_type.clone()));
        push(obs(
            "mavlink.mode",
            format!("{}:{}", h.autopilot, h.custom_mode),
        ));
    }
    for v in &d.autopilot_versions {
        push(obs("mavlink.firmware", v.firmware.clone()));
    }
    out
}

/// What `equip.resolve` reads: the firmware version, and as parameters the
/// board, vendor, product, vehicle type and every PARAM_VALUE.
pub fn plate(d: &Decoded) -> Plate {
    let mut p = Plate::default();
    if let Some(v) = d.autopilot_versions.first() {
        p.firmware = Some(v.firmware.clone());
        p.params
            .insert("board_version".into(), v.board_version.to_string());
        p.params.insert("vendor_id".into(), v.vendor_id.to_string());
        p.params
            .insert("product_id".into(), v.product_id.to_string());
        p.params.insert("git_hash".into(), v.git_hash.clone());
    }
    if let Some(h) = d.heartbeats.first() {
        p.params
            .insert("vehicle_type".into(), h.vehicle_type.clone());
        p.params.insert("autopilot".into(), h.autopilot.clone());
    }
    for (k, v) in &d.params {
        p.params.insert(k.clone(), trim_float(*v));
    }
    p
}

fn trim_float(v: f64) -> String {
    if v.fract() == 0.0 && v.abs() < 1e15 {
        format!("{}", v as i64)
    } else {
        format!("{v}")
    }
}

/// Encode a MAVLink 2 frame (tests and sample generation; unsigned).
pub fn encode_v2(seq: u8, sysid: u8, compid: u8, msgid: u32, payload: &[u8]) -> Vec<u8> {
    let mut p = payload.to_vec();
    while p.last() == Some(&0) && p.len() > 1 {
        p.pop();
    }
    let mut out = vec![
        0xFD,
        p.len() as u8,
        0,
        0,
        seq,
        sysid,
        compid,
        (msgid & 0xFF) as u8,
        ((msgid >> 8) & 0xFF) as u8,
        ((msgid >> 16) & 0xFF) as u8,
    ];
    out.extend_from_slice(&p);
    let extra = known(msgid).map_or(0, |k| k.0);
    let mut c = crc_x25(&out[1..], 0xFFFF);
    c = crc_x25(&[extra], c);
    out.extend_from_slice(&c.to_le_bytes());
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crc_reference() {
        // CRC-16/MCRF4XX check value over "123456789".
        assert_eq!(crc_x25(b"123456789", 0xFFFF), 0x6F91);
    }

    #[test]
    fn heartbeat_round_trip_and_bad_crc() {
        let mut p = vec![0u8; 9];
        p[0..4].copy_from_slice(&4u32.to_le_bytes());
        p[4] = 2; // quadrotor
        p[5] = 3; // ArduPilot
        p[6] = 0x81; // armed, custom mode
        p[7] = 4; // active
        p[8] = 3;
        let f = encode_v2(0, 1, 1, 0, &p);
        let d = decode(&f, false);
        assert_eq!(d.stats.frames, 1);
        let h = &d.heartbeats[0];
        assert_eq!(
            (
                h.vehicle_type.as_str(),
                h.autopilot.as_str(),
                h.armed,
                h.custom_mode
            ),
            ("quadrotor", "ardupilotmega", true, 4)
        );
        let mut bad = f.clone();
        let n = bad.len();
        bad[n - 1] ^= 0xFF;
        assert_eq!(decode(&bad, false).stats.bad_crc, 1);
    }
}
