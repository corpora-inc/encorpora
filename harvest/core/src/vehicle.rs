//! A live vehicle link (CONTRACT "Vehicle link"): MAVLink from a UDP or TCP
//! address, or a recorded `.tlog` replayed through the same path. The
//! reader runs on its own thread; the host reads a snapshot whenever it
//! likes, so nothing it does waits on the vehicle. Nothing touches the
//! network until a person asks for a connection.
//!
//! The link keeps the vehicle's identity (heartbeat, AUTOPILOT_VERSION),
//! its health (SYS_STATUS), the recent status texts, and the active
//! pre-arm failures: a `PreArm:` text is active until it has not been
//! reported for [`PREARM_TTL_MS`] (the autopilot repeats them every 30 s
//! while disarmed), or until SYS_STATUS reports the pre-arm check healthy.

use crate::decode::mavlink::{
    self, AutopilotVersion, Decoder, Heartbeat, Next, StatusText, SysStatus,
};
use crate::error::{Error, Result};
use crate::maint::search::Observation;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, VecDeque};
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

/// A pre-arm failure no longer reported for this long drops off (the
/// autopilot repeats them every 30 s; two periods and some slack).
pub const PREARM_TTL_MS: u64 = 75_000;
/// No heartbeat for this long: the link is `lost`.
pub const HEARTBEAT_TIMEOUT_MS: u64 = 5_000;
/// Status texts kept.
const TEXTS_KEPT: usize = 100;
/// Our identity on the link: a ground station.
const GCS_SYSID: u8 = 255;
const GCS_COMPID: u8 = 190;

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn rfc3339(ms: u64) -> String {
    crate::audit::rfc3339((ms / 1000) as i64, (ms % 1000) as u32)
}

/// Where the vehicle is.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Target {
    /// Connect to a TCP server (`tcp:HOST:PORT`; SITL serves 5760).
    Tcp(String),
    /// Listen on a UDP address (`udp:HOST:PORT`, e.g. `udp:0.0.0.0:14550`)
    /// and answer whoever sends.
    Udp(String),
    /// Replay a recorded `.tlog` (`file:PATH`).
    File(std::path::PathBuf),
}

impl Target {
    pub fn parse(s: &str) -> Result<Self> {
        let s = s.trim();
        let (kind, rest) = s.split_once(':').ok_or_else(|| {
            Error::Invalid(format!(
                "vehicle address {s:?}: tcp:HOST:PORT, udp:HOST:PORT or file:PATH"
            ))
        })?;
        let rest = rest.trim_start_matches("//");
        match kind {
            "tcp" => Ok(Self::Tcp(rest.to_string())),
            "udp" => Ok(Self::Udp(rest.to_string())),
            "file" => Ok(Self::File(rest.into())),
            _ => Err(Error::Invalid(format!(
                "vehicle address {s:?}: tcp:HOST:PORT, udp:HOST:PORT or file:PATH"
            ))),
        }
    }
}

/// The link's state.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LinkState {
    /// Opening, or open with no heartbeat yet.
    Connecting,
    /// Heartbeats arriving.
    Connected,
    /// No heartbeat for a while (the link stays open and recovers).
    Lost,
    /// A recorded file played to its end.
    Finished,
    /// Closed by the host.
    Closed,
    /// It could not be opened, or it broke.
    Failed,
}

/// The vehicle's identity, as it reports it.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Identity {
    pub vehicle_type: Option<String>,
    pub autopilot: Option<String>,
    pub firmware: Option<String>,
    pub firmware_type: Option<String>,
    pub firmware_hash: Option<String>,
    pub board_version: Option<u32>,
    pub vendor_id: Option<u16>,
    pub product_id: Option<u16>,
}

impl Identity {
    /// The identity as a plate: what [`crate::records::plate_values`] reads
    /// for the attributes a pack declares with source `vehicle`
    /// (`firmware`, and `firmware_hash`, `firmware_type`, `board_version`,
    /// `vendor_id`, `product_id`, `vehicle_type`, `autopilot` by id).
    pub fn plate(&self) -> crate::maint::resolve::Plate {
        let mut p = crate::maint::resolve::Plate {
            firmware: self.firmware.clone(),
            ..Default::default()
        };
        let mut put = |k: &str, v: Option<String>| {
            if let Some(v) = v.filter(|v| !v.is_empty()) {
                p.params.insert(k.to_string(), v);
            }
        };
        put("firmware_hash", self.firmware_hash.clone());
        put("firmware_type", self.firmware_type.clone());
        put("board_version", self.board_version.map(|v| v.to_string()));
        put("vendor_id", self.vendor_id.map(|v| v.to_string()));
        put("product_id", self.product_id.map(|v| v.to_string()));
        put("vehicle_type", self.vehicle_type.clone());
        put("autopilot", self.autopilot.clone());
        p
    }
}

/// A status text with when it arrived.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct TimedText {
    pub at: String,
    pub severity: String,
    pub text: String,
}

/// An active pre-arm failure.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct PrearmFailure {
    /// As the autopilot sent it.
    pub text: String,
    pub first_seen: String,
    pub last_seen: String,
    /// It drops off at this time unless reported again.
    pub expires_at: String,
}

/// A snapshot of the link.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct VehicleSnapshot {
    pub target: String,
    pub state: LinkState,
    pub error: Option<String>,
    pub opened_at: String,
    pub last_heartbeat_at: Option<String>,
    pub frames: u64,
    pub bytes: u64,
    pub identity: Identity,
    pub armed: Option<bool>,
    pub system_status: Option<String>,
    /// Sensors present and enabled but not healthy.
    pub unhealthy: Vec<String>,
    pub battery_voltage: Option<f64>,
    /// Newest last.
    pub texts: Vec<TimedText>,
    /// The pre-arm failures being reported now.
    pub prearm: Vec<PrearmFailure>,
    /// What `signal.match` reads: the active pre-arm texts, the other status
    /// texts of the last minute, and the unhealthy sensors.
    pub observations: Vec<Observation>,
    pub prearm_ttl_ms: u64,
}

#[derive(Debug)]
struct Shared {
    target: String,
    state: LinkState,
    error: Option<String>,
    opened_at: u64,
    last_heartbeat: Option<u64>,
    frames: u64,
    bytes: u64,
    heartbeat: Option<Heartbeat>,
    sys: Option<SysStatus>,
    version: Option<AutopilotVersion>,
    texts: VecDeque<(u64, StatusText)>,
    prearm: BTreeMap<String, (u64, u64)>,
}

impl Shared {
    fn take_text(&mut self, at: u64, t: StatusText) {
        if t.text.starts_with("PreArm:") {
            let e = self.prearm.entry(t.text.clone()).or_insert((at, at));
            e.1 = at;
        }
        self.texts.push_back((at, t));
        while self.texts.len() > TEXTS_KEPT {
            self.texts.pop_front();
        }
    }

    fn expire(&mut self, now: u64) {
        self.prearm
            .retain(|_, (_, last)| now.saturating_sub(*last) <= PREARM_TTL_MS);
        // The autopilot says the checks pass: nothing is failing.
        if let Some(s) = &self.sys
            && s.present.iter().any(|p| p == "prearm_check")
            && s.enabled.iter().any(|p| p == "prearm_check")
            && !s.unhealthy.iter().any(|p| p == "prearm_check")
        {
            self.prearm.clear();
        }
        if self.state == LinkState::Connected
            && self
                .last_heartbeat
                .is_some_and(|h| now.saturating_sub(h) > HEARTBEAT_TIMEOUT_MS)
        {
            self.state = LinkState::Lost;
        }
    }

    fn snapshot(&mut self, now: u64) -> VehicleSnapshot {
        self.expire(now);
        let identity = Identity {
            vehicle_type: self.heartbeat.as_ref().map(|h| h.vehicle_type.clone()),
            autopilot: self.heartbeat.as_ref().map(|h| h.autopilot.clone()),
            firmware: self.version.as_ref().map(|v| v.firmware.clone()),
            firmware_type: self.version.as_ref().map(|v| v.firmware_type.clone()),
            firmware_hash: self
                .version
                .as_ref()
                .map(|v| v.git_hash.clone())
                .filter(|h| !h.is_empty()),
            board_version: self.version.as_ref().map(|v| v.board_version),
            vendor_id: self.version.as_ref().map(|v| v.vendor_id),
            product_id: self.version.as_ref().map(|v| v.product_id),
        };
        let mut prearm: Vec<PrearmFailure> = self
            .prearm
            .iter()
            .map(|(text, (first, last))| PrearmFailure {
                text: text.clone(),
                first_seen: rfc3339(*first),
                last_seen: rfc3339(*last),
                expires_at: rfc3339(last + PREARM_TTL_MS),
            })
            .collect();
        prearm.sort_by(|a, b| a.first_seen.cmp(&b.first_seen).then(a.text.cmp(&b.text)));
        let unhealthy = self
            .sys
            .as_ref()
            .map(|s| s.unhealthy.clone())
            .unwrap_or_default();
        let mut observations: Vec<Observation> = Vec::new();
        let mut seen = std::collections::BTreeSet::new();
        let mut push = |kind: &str, value: &str| {
            if seen.insert((kind.to_string(), value.to_string())) {
                observations.push(Observation {
                    signal_kind: Some(kind.to_string()),
                    value: value.to_string(),
                });
            }
        };
        for p in &prearm {
            push("mavlink.statustext", &p.text);
        }
        for (at, t) in &self.texts {
            if now.saturating_sub(*at) <= 60_000 && !t.text.starts_with("PreArm:") {
                push("mavlink.statustext", &t.text);
            }
        }
        for u in &unhealthy {
            push("mavlink.sensor_unhealthy", u);
        }
        VehicleSnapshot {
            target: self.target.clone(),
            state: self.state,
            error: self.error.clone(),
            opened_at: rfc3339(self.opened_at),
            last_heartbeat_at: self.last_heartbeat.map(rfc3339),
            frames: self.frames,
            bytes: self.bytes,
            identity,
            armed: self.heartbeat.as_ref().map(|h| h.armed),
            system_status: self.heartbeat.as_ref().map(|h| h.system_status.clone()),
            unhealthy,
            battery_voltage: self.sys.as_ref().and_then(|s| s.battery_voltage),
            texts: self
                .texts
                .iter()
                .map(|(at, t)| TimedText {
                    at: rfc3339(*at),
                    severity: t.severity.clone(),
                    text: t.text.clone(),
                })
                .collect(),
            prearm,
            observations,
            prearm_ttl_ms: PREARM_TTL_MS,
        }
    }
}

/// An open link. Dropping it (or [`VehicleLink::close`]) stops the reader.
pub struct VehicleLink {
    shared: Arc<Mutex<Shared>>,
    stop: Arc<AtomicBool>,
    thread: Option<std::thread::JoinHandle<()>>,
}

/// The ways the reader gets bytes and sends requests.
enum Conn {
    Tcp(std::net::TcpStream),
    Udp(std::net::UdpSocket, Option<std::net::SocketAddr>),
    /// A recording, read whole: a `.tlog` (timestamped frames) or a raw
    /// capture.
    File(Vec<u8>, bool),
}

impl Conn {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<Option<usize>> {
        match self {
            Conn::Tcp(s) => match s.read(buf) {
                Ok(0) => Err(std::io::Error::new(
                    std::io::ErrorKind::UnexpectedEof,
                    "the vehicle closed the connection",
                )),
                Ok(n) => Ok(Some(n)),
                Err(e)
                    if matches!(
                        e.kind(),
                        std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                    ) =>
                {
                    Ok(None)
                }
                Err(e) => Err(e),
            },
            Conn::Udp(s, peer) => match s.recv_from(buf) {
                Ok((n, from)) => {
                    *peer = Some(from);
                    Ok(Some(n))
                }
                Err(e)
                    if matches!(
                        e.kind(),
                        std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                    ) =>
                {
                    Ok(None)
                }
                Err(e) => Err(e),
            },
            Conn::File(..) => Ok(Some(0)),
        }
    }

    fn send(&mut self, frame: &[u8]) {
        let _ = match self {
            Conn::Tcp(s) => s.write_all(frame).map(|_| ()),
            Conn::Udp(s, Some(peer)) => s.send_to(frame, *peer).map(|_| ()),
            _ => Ok(()),
        };
    }
}

/// Requests a ground station makes: a heartbeat, the streams, the version,
/// and a pre-arm check run (so failures are reported now, not in 30 s).
struct Requests {
    seq: u8,
    last_heartbeat: Option<Instant>,
    last_streams: Option<Instant>,
    last_version: Option<Instant>,
    last_prearm: Option<Instant>,
}

impl Requests {
    fn frame(&mut self, msgid: u32, payload: &[u8]) -> Vec<u8> {
        self.seq = self.seq.wrapping_add(1);
        mavlink::encode_v2(self.seq, GCS_SYSID, GCS_COMPID, msgid, payload)
    }

    fn command_long(&mut self, target: (u8, u8), command: u16, params: [f32; 7]) -> Vec<u8> {
        let mut p = Vec::with_capacity(33);
        for v in params {
            p.extend_from_slice(&v.to_le_bytes());
        }
        p.extend_from_slice(&command.to_le_bytes());
        p.push(target.0);
        p.push(target.1);
        p.push(0); // confirmation
        self.frame(76, &p)
    }

    fn due(t: Option<Instant>, every: Duration) -> bool {
        t.is_none_or(|t| t.elapsed() >= every)
    }

    fn run(&mut self, conn: &mut Conn, target: Option<(u8, u8)>, have_version: bool) {
        if Self::due(self.last_heartbeat, Duration::from_secs(1)) {
            self.last_heartbeat = Some(Instant::now());
            // type GCS (6), autopilot invalid (8), mavlink version 3.
            let f = self.frame(0, &[0, 0, 0, 0, 6, 8, 0, 0, 3]);
            conn.send(&f);
        }
        let Some(t) = target else { return };
        if Self::due(self.last_streams, Duration::from_secs(10)) {
            self.last_streams = Some(Instant::now());
            // REQUEST_DATA_STREAM: all streams at 2 Hz.
            let mut p = Vec::new();
            p.extend_from_slice(&2u16.to_le_bytes());
            p.extend_from_slice(&[t.0, t.1, 0, 1]);
            let f = self.frame(66, &p);
            conn.send(&f);
        }
        if !have_version && Self::due(self.last_version, Duration::from_secs(3)) {
            self.last_version = Some(Instant::now());
            // MAV_CMD_REQUEST_MESSAGE AUTOPILOT_VERSION.
            let f = self.command_long(t, 512, [148.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]);
            conn.send(&f);
        }
        if Self::due(self.last_prearm, Duration::from_secs(15)) {
            self.last_prearm = Some(Instant::now());
            // MAV_CMD_RUN_PREARM_CHECKS.
            let f = self.command_long(t, 401, [0.0; 7]);
            conn.send(&f);
        }
    }
}

fn open(target: &Target) -> Result<Conn> {
    match target {
        Target::Tcp(addr) => {
            let addrs: Vec<std::net::SocketAddr> =
                std::net::ToSocketAddrs::to_socket_addrs(addr.as_str())
                    .map_err(|e| Error::Invalid(format!("tcp:{addr}: {e}")))?
                    .collect();
            let first = addrs
                .first()
                .ok_or_else(|| Error::Invalid(format!("tcp:{addr}: no address")))?;
            let s = std::net::TcpStream::connect_timeout(first, Duration::from_secs(5))
                .map_err(|e| Error::Sync(format!("tcp:{addr}: {e}")))?;
            s.set_read_timeout(Some(Duration::from_millis(200)))?;
            s.set_nodelay(true)?;
            Ok(Conn::Tcp(s))
        }
        Target::Udp(addr) => {
            let s = std::net::UdpSocket::bind(addr.as_str())
                .map_err(|e| Error::Sync(format!("udp:{addr}: {e}")))?;
            s.set_read_timeout(Some(Duration::from_millis(200)))?;
            Ok(Conn::Udp(s, None))
        }
        Target::File(path) => {
            let bytes = std::fs::read(path)
                .map_err(|e| Error::Invalid(format!("file:{}: {e}", path.display())))?;
            let tlog = path
                .extension()
                .is_some_and(|e| e.eq_ignore_ascii_case("tlog"));
            Ok(Conn::File(bytes, tlog))
        }
    }
}

impl VehicleLink {
    /// Start a reader thread for `target`. It opens the address itself, so
    /// this returns at once (`connecting`); a failure to open shows as
    /// `failed` with the error.
    pub fn connect(target: &Target, label: &str) -> Result<Self> {
        let target = target.clone();
        let shared = Arc::new(Mutex::new(Shared {
            target: label.to_string(),
            state: LinkState::Connecting,
            error: None,
            opened_at: now_ms(),
            last_heartbeat: None,
            frames: 0,
            bytes: 0,
            heartbeat: None,
            sys: None,
            version: None,
            texts: VecDeque::new(),
            prearm: BTreeMap::new(),
        }));
        let stop = Arc::new(AtomicBool::new(false));
        let (sh, st) = (shared.clone(), stop.clone());
        let thread = std::thread::Builder::new()
            .name("harvest-vehicle".into())
            .spawn(move || match open(&target) {
                Ok(conn) => reader(conn, sh, st),
                Err(e) => {
                    let mut s = sh.lock().unwrap_or_else(|p| p.into_inner());
                    s.state = LinkState::Failed;
                    s.error = Some(e.to_string());
                }
            })
            .map_err(|e| Error::Invalid(format!("vehicle reader: {e}")))?;
        Ok(Self {
            shared,
            stop,
            thread: Some(thread),
        })
    }

    /// What the link knows now.
    pub fn snapshot(&self) -> VehicleSnapshot {
        let mut s = self.shared.lock().unwrap_or_else(|p| p.into_inner());
        s.snapshot(now_ms())
    }

    /// Stop reading and close.
    pub fn close(mut self) -> VehicleSnapshot {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
        let mut s = self.shared.lock().unwrap_or_else(|p| p.into_inner());
        s.state = LinkState::Closed;
        s.snapshot(now_ms())
    }
}

impl Drop for VehicleLink {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
    }
}

/// Take one frame into the shared state.
fn take_frame(
    s: &mut Shared,
    dec: &mut Decoder,
    target: &mut Option<(u8, u8)>,
    f: &mavlink::Frame,
    now: u64,
) {
    s.frames += 1;
    // The autopilot (component 1) of the first vehicle heard.
    if f.msgid == 0 && f.compid == 1 && f.sysid != GCS_SYSID {
        target.get_or_insert((f.sysid, f.compid));
        s.last_heartbeat = Some(now);
        if !matches!(s.state, LinkState::Closed | LinkState::Finished) {
            s.state = LinkState::Connected;
        }
    }
    if let Some(t) = dec.push(f) {
        s.take_text(now, t);
    }
    s.heartbeat = dec.heartbeat().cloned();
    s.sys = dec.sys_status().cloned();
    s.version = dec.version().cloned();
}

fn reader(mut conn: Conn, shared: Arc<Mutex<Shared>>, stop: Arc<AtomicBool>) {
    let mut dec = Decoder::default();
    let mut target: Option<(u8, u8)> = None;
    // A recording goes through the same frame path, all at once.
    if let Conn::File(bytes, tlog) = &conn {
        let (frames, _) = mavlink::frames(bytes, *tlog);
        let now = now_ms();
        let mut s = shared.lock().unwrap_or_else(|p| p.into_inner());
        s.bytes = bytes.len() as u64;
        for f in &frames {
            take_frame(&mut s, &mut dec, &mut target, f, now);
        }
        s.state = LinkState::Finished;
        return;
    }
    let mut buf: Vec<u8> = Vec::new();
    let mut chunk = vec![0u8; 4096];
    let mut req = Requests {
        seq: 0,
        last_heartbeat: None,
        last_streams: None,
        last_version: None,
        last_prearm: None,
    };
    while !stop.load(Ordering::SeqCst) {
        let have_version = dec.version().is_some();
        req.run(&mut conn, target, have_version);
        let n = match conn.read(&mut chunk) {
            Ok(Some(n)) if n > 0 => n,
            Ok(_) => {
                let mut s = shared.lock().unwrap_or_else(|p| p.into_inner());
                s.expire(now_ms());
                continue;
            }
            Err(e) => {
                let mut s = shared.lock().unwrap_or_else(|p| p.into_inner());
                s.state = LinkState::Failed;
                s.error = Some(e.to_string());
                return;
            }
        };
        buf.extend_from_slice(&chunk[..n]);
        let now = now_ms();
        let mut s = shared.lock().unwrap_or_else(|p| p.into_inner());
        s.bytes += n as u64;
        loop {
            match mavlink::next_frame(&buf) {
                Next::Need => break,
                Next::Skip(k) => {
                    buf.drain(..k.max(1).min(buf.len()));
                }
                Next::Frame(f, used) => {
                    buf.drain(..used);
                    take_frame(&mut s, &mut dec, &mut target, &f, now);
                }
            }
        }
        // A buffer that never resolves is noise: keep it bounded.
        if buf.len() > 65_536 {
            buf.clear();
        }
        s.expire(now);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn addresses() {
        assert_eq!(
            Target::parse("tcp:127.0.0.1:5760").unwrap(),
            Target::Tcp("127.0.0.1:5760".into())
        );
        assert_eq!(
            Target::parse("udp://0.0.0.0:14550").unwrap(),
            Target::Udp("0.0.0.0:14550".into())
        );
        assert!(matches!(
            Target::parse("file:/tmp/x.tlog").unwrap(),
            Target::File(_)
        ));
        assert!(Target::parse("serial:/dev/ttyUSB0").is_err());
        assert!(Target::parse("nonsense").is_err());
    }

    fn shared() -> Shared {
        Shared {
            target: "test".into(),
            state: LinkState::Connected,
            error: None,
            opened_at: 0,
            last_heartbeat: Some(0),
            frames: 0,
            bytes: 0,
            heartbeat: None,
            sys: None,
            version: None,
            texts: VecDeque::new(),
            prearm: BTreeMap::new(),
        }
    }

    fn text(t: &str) -> StatusText {
        StatusText {
            sysid: 1,
            severity: "critical".into(),
            text: t.into(),
        }
    }

    #[test]
    fn a_prearm_failure_drops_off_when_no_longer_reported() {
        let mut s = shared();
        s.take_text(1_000, text("PreArm: Compass 1 not healthy"));
        s.take_text(2_000, text("PreArm: Radio failsafe on"));
        s.take_text(2_500, text("EKF3 IMU0 is using GPS"));
        // Reported again 30 s later: kept, first seen unchanged.
        s.take_text(31_000, text("PreArm: Compass 1 not healthy"));
        let snap = s.snapshot(31_000 + PREARM_TTL_MS);
        let texts: Vec<&str> = snap.prearm.iter().map(|p| p.text.as_str()).collect();
        assert_eq!(texts, ["PreArm: Compass 1 not healthy"]);
        assert_eq!(snap.prearm[0].first_seen, rfc3339(1_000));
        assert_eq!(snap.prearm[0].expires_at, rfc3339(31_000 + PREARM_TTL_MS));
        // Only the active failure is an observation; old other texts are not.
        assert_eq!(snap.observations.len(), 1);
        // No heartbeat for longer than the timeout: lost.
        assert_eq!(snap.state, LinkState::Lost);
        let later = s.snapshot(31_001 + PREARM_TTL_MS);
        assert!(later.prearm.is_empty());
    }

    #[test]
    fn the_autopilot_saying_the_checks_pass_clears_the_list() {
        let mut s = shared();
        s.take_text(1_000, text("PreArm: Compass 1 not healthy"));
        let mut sys = SysStatus {
            sysid: 1,
            present: vec!["prearm_check".into()],
            enabled: vec!["prearm_check".into()],
            unhealthy: vec!["prearm_check".into()],
            battery_voltage: None,
            battery_current: None,
            battery_remaining: None,
            load_percent: 0.0,
        };
        s.sys = Some(sys.clone());
        assert_eq!(s.snapshot(2_000).prearm.len(), 1);
        sys.unhealthy.clear();
        s.sys = Some(sys);
        assert!(s.snapshot(2_000).prearm.is_empty());
    }
}
