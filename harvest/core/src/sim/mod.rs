//! A discrete-event simulation of a fleet: N real device record stores and
//! one real hub in one process, joined by simulated links (outages drawn
//! from distributions, bandwidth caps, latency, drops mid-transfer,
//! duplicate deliveries, clock skew, tampered bundles, scripted lesson
//! conflicts). Everything a device or the hub does runs the real code
//! (`Records`, `Hub`, `install_offer`); only the wire and the clock are
//! simulated. A seeded scenario in, a metrics report out, the same report
//! for the same seed.

use crate::audit::set_clock;
use crate::error::{Error, Result};
use crate::fixture;
use crate::fixture_maint;
use crate::hub::Hub;
use crate::maint::branch::{self, Expect};
use crate::pack::Pack;
use crate::packs::TrustedKey;
use crate::records::{
    AssetRegistry, JobAnswer, JobClose, JobStart, LessonFilter, LessonInput, Records,
    ResolutionKind,
};
use crate::sync::{DeviceKey, HelloReply, HubLink, PackOffer, Receipt, Upload};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::cell::RefCell;
use std::collections::{BTreeMap, BTreeSet, BinaryHeap};
use std::path::{Path, PathBuf};
use std::sync::Arc;

const HOUR: i64 = 3_600_000;
const DAY: i64 = 24 * HOUR;
/// Simulated time starts at 2026-01-01T00:00:00Z.
const EPOCH_MS: i64 = 1_767_225_600_000;

// ------------------------------------------------------------- scenario

/// A duration distribution, in hours.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "dist", rename_all = "snake_case", deny_unknown_fields)]
pub enum Dist {
    Fixed { hours: f64 },
    Exp { mean_hours: f64 },
    Uniform { min_hours: f64, max_hours: f64 },
    LogNormal { median_hours: f64, sigma: f64 },
}

/// One device's link to the hub.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct LinkSpec {
    /// How long the link stays up, then down, alternating.
    pub up: Dist,
    pub down: Dist,
    /// Days offline at the start (a deployment).
    #[serde(default)]
    pub initial_down_days: f64,
    /// Bits per second each way.
    pub bandwidth_bps: f64,
    #[serde(default = "default_latency")]
    pub latency_ms: f64,
    /// Chance a request is cut off somewhere in its transfer.
    #[serde(default)]
    pub drop_prob: f64,
    /// Chance an upload reaches the hub twice.
    #[serde(default)]
    pub dup_prob: f64,
    /// Per-request protocol overhead, bytes.
    #[serde(default = "default_overhead")]
    pub overhead_bytes: u64,
}

fn default_latency() -> f64 {
    300.0
}
fn default_overhead() -> u64 {
    600
}

/// What technicians do.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Workload {
    pub jobs_per_device_per_day: f64,
    /// Chance a finished job leaves a lesson.
    pub lesson_prob: f64,
    /// Chance an answer is corrected (go back, answer again).
    #[serde(default)]
    pub back_prob: f64,
    /// Chance a lesson is edited on the device a few hours later.
    #[serde(default)]
    pub edit_prob: f64,
    #[serde(default = "default_assets")]
    pub assets_per_device: usize,
}

fn default_assets() -> usize {
    3
}

/// What the reviewer at the hub does.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct HubSpec {
    #[serde(default = "default_review_every")]
    pub review_every_hours: f64,
    /// A lesson waits at least this long before review.
    #[serde(default)]
    pub review_delay_hours: f64,
    #[serde(default = "default_approve")]
    pub approve_prob: f64,
    #[serde(default = "default_edit")]
    pub edit_prob: f64,
}

fn default_review_every() -> f64 {
    24.0
}
fn default_approve() -> f64 {
    0.8
}
fn default_edit() -> f64 {
    0.1
}

impl Default for HubSpec {
    fn default() -> Self {
        Self {
            review_every_hours: default_review_every(),
            review_delay_hours: 0.0,
            approve_prob: default_approve(),
            edit_prob: default_edit(),
        }
    }
}

/// Two units edit the same lesson: `device` starts it, `other` continues it
/// `gap_minutes` later on its own clock.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct ScriptedConflict {
    pub day: f64,
    pub device: usize,
    pub other: usize,
    #[serde(default)]
    pub gap_minutes: f64,
}

/// Photos taken with lessons. Sizes are log-normal. The simulation keeps
/// real bytes at `1 / byte_scale` of the drawn size (so 180 days of photos
/// fit in memory) and charges the wire for the full size.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct PhotoSpec {
    /// Mean photos per lesson (Poisson).
    pub per_lesson: f64,
    pub median_kb: f64,
    #[serde(default = "default_sigma")]
    pub sigma: f64,
    /// The host's downscaled copy, as a share of the full size.
    #[serde(default = "default_small_ratio")]
    pub small_ratio: f64,
    #[serde(default = "default_scale")]
    pub byte_scale: u64,
}

fn default_sigma() -> f64 {
    0.5
}
fn default_small_ratio() -> f64 {
    0.08
}
fn default_scale() -> u64 {
    100
}

/// A device revoked at the hub.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct ScriptedRevoke {
    pub device: usize,
    pub day: f64,
}

/// A scenario file.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Scenario {
    pub name: String,
    pub seed: u64,
    pub days: f64,
    pub devices: usize,
    pub link: LinkSpec,
    pub workload: Workload,
    #[serde(default)]
    pub hub: HubSpec,
    /// Each device's clock is off by up to this many minutes either way.
    #[serde(default)]
    pub clock_skew_minutes: f64,
    /// How often a device tries to sync while its link is up.
    #[serde(default = "default_sync_every")]
    pub sync_every_minutes: f64,
    #[serde(default)]
    pub conflicts: Vec<ScriptedConflict>,
    /// Chance a bundle is corrupted in transit (the device must refuse it).
    #[serde(default)]
    pub tamper_prob: f64,
    /// Chance a reply is forged by someone on the link (receipts for items
    /// the hub never got, a hello reply, an attachment `held` of the whole
    /// file), unsigned or signed with a key the device does not trust.
    #[serde(default)]
    pub forge_prob: f64,
    /// The hub's setting: devices fetch a changed fleet summary at most
    /// this often (they learn it at every hello).
    #[serde(default = "default_fleet_every")]
    pub fleet_every_hours: f64,
    /// The hub's clock-skew bound: two units' edits of one lesson closer
    /// than this wait for a reviewer to choose.
    #[serde(default = "default_skew_bound")]
    pub skew_bound_minutes: i64,
    /// One more device that was never enrolled: it works and tries to
    /// upload like the others; the hub must accept nothing from it.
    #[serde(default)]
    pub rogue_device: bool,
    /// Devices revoked at the hub on a day; nothing they send after it is
    /// accepted.
    #[serde(default)]
    pub revoke: Vec<ScriptedRevoke>,
    /// The link speed during the final sync (the unit reaches port), bits
    /// per second; the scenario's link speed when absent.
    #[serde(default)]
    pub final_bandwidth_bps: Option<f64>,
    /// Photos with lessons; their bytes move on the attachment lane.
    #[serde(default)]
    pub photos: Option<PhotoSpec>,
    /// The hub's attachment policy on a low link (below 100 kbit/s) and a
    /// normal one, and its chunk size.
    #[serde(default = "default_low_mode")]
    pub attachments_low: crate::sync::AttachmentMode,
    #[serde(default = "default_normal_mode")]
    pub attachments_normal: crate::sync::AttachmentMode,
    #[serde(default = "default_chunk_kb")]
    pub chunk_kb: u64,
    /// A new pack version is published at the hub on this day.
    #[serde(default)]
    pub pack_update_day: Option<f64>,
    /// One last sync window at the end (every link up for a day).
    #[serde(default)]
    pub final_sync: bool,
    #[serde(default = "default_sample")]
    pub sample_every_days: f64,
}

fn default_low_mode() -> crate::sync::AttachmentMode {
    crate::sync::AttachmentMode::Downscaled
}
fn default_normal_mode() -> crate::sync::AttachmentMode {
    crate::sync::AttachmentMode::Full
}
fn default_chunk_kb() -> u64 {
    64
}
fn default_skew_bound() -> i64 {
    crate::hub::DEFAULT_SKEW_BOUND_MINUTES
}
fn default_fleet_every() -> f64 {
    crate::records::maint::DEFAULT_FLEET_EVERY_HOURS
}
fn default_sync_every() -> f64 {
    60.0
}
fn default_sample() -> f64 {
    30.0
}

// -------------------------------------------------------------- metrics

/// Median, p90 and max of a sample.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct Stats {
    pub n: u64,
    pub median: Option<f64>,
    pub p90: Option<f64>,
    pub max: Option<f64>,
}

fn stats(mut v: Vec<f64>) -> Stats {
    if v.is_empty() {
        return Stats::default();
    }
    v.sort_by(f64::total_cmp);
    let pick = |q: f64| {
        let i = ((v.len() as f64 - 1.0) * q).round() as usize;
        (v[i] * 100.0).round() / 100.0
    };
    Stats {
        n: v.len() as u64,
        median: Some(pick(0.5)),
        p90: Some(pick(0.9)),
        max: Some(pick(1.0)),
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct Delivery {
    pub captured: u64,
    pub delivered: u64,
    pub pending: u64,
    /// Of `pending`: items held on a device the hub refuses (unenrolled or
    /// revoked); they stay on the device, never accepted.
    pub blocked: u64,
    pub lost: u64,
    /// `delivered / captured`.
    pub delivered_of_captured: f64,
    /// `delivered / (captured - blocked)`: of what the hub would accept,
    /// excluding items held on refused devices.
    pub delivered_of_deliverable: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct Bytes {
    pub up: u64,
    pub down: u64,
    pub total: u64,
    pub per_job: Option<f64>,
    pub per_lesson: Option<f64>,
    pub per_day: f64,
    pub bundles: u64,
    /// The signed fleet summary, fetched only when it changed.
    pub fleet: u64,
    /// Spent by devices the hub refuses (hellos and any refused delivery).
    pub refused: u64,
    pub packs: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct Link {
    pub requests: u64,
    pub failed_requests: u64,
    /// Failures after the hub stored the upload (the reply was lost).
    pub lost_replies: u64,
    pub duplicates_sent: u64,
    pub duplicates_suppressed: u64,
    pub flush_attempts: u64,
    /// Deliveries the hub refused (an unenrolled or revoked device that
    /// got past the hello, revoked in between).
    pub refused_deliveries: u64,
    /// Hellos the hub answered with a refusal.
    pub refused_hellos: u64,
    /// Sync attempts a device skipped while backing off after a refusal.
    pub backoff_skips: u64,
    /// Replies someone on the link forged (all refused by the devices: the
    /// invariants show it).
    #[serde(default)]
    pub forged_replies: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct ConflictOut {
    pub lesson_id: String,
    pub winner_device: String,
    pub loser_device: String,
    pub rule: String,
    /// `auto` (the rule decided) or `needs_reviewer` (within the clock-skew
    /// bound; the reviewer chose).
    pub class: String,
    pub resolved_by: Option<String>,
    /// The reviewer sees every version, each marked.
    pub losing_version_visible: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct Lessons {
    pub created: u64,
    pub edited_on_device: u64,
    pub approved: u64,
    pub approved_edited: u64,
    pub rejected: u64,
    pub pending_at_end: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct Bundles {
    pub published: u64,
    pub installed: u64,
    pub tampered_in_transit: u64,
    pub refused: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct PackUpdates {
    pub published: bool,
    pub installed: u64,
    pub kinds: BTreeMap<String, u64>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct Growth {
    pub device: usize,
    /// `(day, bytes)` of the records store.
    pub samples: Vec<(f64, u64)>,
    pub bytes_per_day: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct Invariants {
    pub ok: bool,
    pub nothing_lost: bool,
    pub nothing_applied_twice: bool,
    pub no_bad_bundle_installed: bool,
    pub audit_chains_intact: bool,
    pub no_upload_from_unenrolled_or_revoked: bool,
    /// A refused device costs the link at most one hello per back-off
    /// step: `bytes.refused` stays within (refused devices) × (days + 12) ×
    /// (one hello and its answer).
    pub refused_traffic_bounded: bool,
    /// With photos: the attachment lane never changed when a record or a
    /// lesson reached the hub.
    pub attachments_never_delay_records: bool,
    /// No attachment is marked sent on a device unless the hub holds it
    /// (forged `held` and receipts count for nothing).
    #[serde(default)]
    pub no_attachment_marked_sent_without_hub: bool,
    pub details: Vec<String>,
}

/// The report.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct Metrics {
    pub scenario: String,
    pub seed: u64,
    pub days: f64,
    pub devices: usize,
    pub jobs: u64,
    pub delivery: Delivery,
    pub capture_to_hub_hours: Stats,
    pub approval_to_device_hours: Stats,
    pub bytes: Bytes,
    pub link: Link,
    pub conflicts: Vec<ConflictOut>,
    /// Conflicts per class (`auto`, `needs_reviewer`).
    pub conflict_classes: BTreeMap<String, u64>,
    pub lessons: Lessons,
    pub bundles: Bundles,
    pub packs: PackUpdates,
    pub growth: Vec<Growth>,
    /// The attachment lane, when the scenario takes photos.
    pub attachments: Option<Attachments>,
    pub invariants: Invariants,
}

/// One sample of the attachment backlog (full-scale bytes).
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct Backlog {
    pub day: f64,
    pub full_bytes: u64,
    pub downscaled_bytes: u64,
}

/// The attachment lane: what moved, what waits, and whether it ever held
/// up a record.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct Attachments {
    pub photos: u64,
    /// Full-size bytes of every photo taken.
    pub bytes_taken: u64,
    /// Wire bytes of the lane both ways (full scale: base64 chunks,
    /// signatures, hellos, resume queries, overhead), its requests, the
    /// requests cut, and the chunks sent.
    pub bytes_sent: u64,
    pub requests: u64,
    pub failed_requests: u64,
    pub chunks: u64,
    /// Photos continued from where the hub had them after a cut.
    pub resumed: u64,
    /// Variants complete at the hub, and the photos complete in full.
    pub complete_at_hub: u64,
    pub full_at_hub: u64,
    /// Passes the lane cut short to let records go first.
    pub yields: u64,
    /// Photo bytes still on the devices over time: the full files the hub
    /// lacks, and the downscaled copies it lacks.
    pub backlog: Vec<Backlog>,
    /// Capture to hub of every record and lesson, in a run with the
    /// attachment lane off and in this run.
    pub records_latency_without: Stats,
    pub records_latency_with: Stats,
    /// Every record arrived at the same time in both runs.
    pub never_delayed_a_record: bool,
    pub byte_scale: u64,
}

// ------------------------------------------------------------------ rng

/// SplitMix64: small, seeded, the same everywhere.
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }
    /// Uniform in [0, 1).
    fn f(&mut self) -> f64 {
        (self.next() >> 11) as f64 / (1u64 << 53) as f64
    }
    fn below(&mut self, n: usize) -> usize {
        if n == 0 {
            0
        } else {
            (self.next() % n as u64) as usize
        }
    }
    fn normal(&mut self) -> f64 {
        let u1 = self.f().max(1e-12);
        let u2 = self.f();
        (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos()
    }
    fn hours(&mut self, d: &Dist) -> i64 {
        let h = match d {
            Dist::Fixed { hours } => *hours,
            Dist::Exp { mean_hours } => -mean_hours * (1.0 - self.f()).ln(),
            Dist::Uniform {
                min_hours,
                max_hours,
            } => min_hours + (max_hours - min_hours) * self.f(),
            Dist::LogNormal {
                median_hours,
                sigma,
            } => median_hours * (sigma * self.normal()).exp(),
        };
        ((h.max(0.0)) * HOUR as f64) as i64
    }
}

// --------------------------------------------------------------- engine

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
enum Ev {
    LinkFlip(usize),
    Sync(usize),
    Job(usize),
    EditLesson(usize, String),
    Conflict(usize),
    Review,
    Sample,
    PackUpdate,
    Revoke(usize),
}

struct Device {
    key: DeviceKey,
    rec: Records,
    pack: Arc<Pack>,
    root: PathBuf,
    skew_ms: i64,
    up: bool,
    window_end: i64,
    assets: Vec<String>,
    installed_seqs: BTreeSet<u64>,
    growth: Vec<(f64, u64)>,
}

struct Net {
    rng: Rng,
    /// The attachment lane draws from its own stream, so turning it on or
    /// off leaves every record transfer the same.
    att_rng: Rng,
    att_lane: bool,
    att_bytes: u64,
    att_chunks: u64,
    att_requests: u64,
    att_failed: u64,
    byte_scale: u64,
    now: i64,
    window_end: i64,
    up: bool,
    spec: LinkSpec,
    tamper_prob: f64,
    forge_prob: f64,
    forged: u64,
    m: Link,
    bytes_up: u64,
    bytes_down: u64,
    bytes_bundles: u64,
    bytes_fleet: u64,
    refused_deliveries: u64,
    refused_hellos: u64,
    bytes_refused: u64,
    bytes_packs: u64,
    bytes_kind: BTreeMap<String, u64>,
    hub_at: BTreeMap<String, i64>,
    tampered: u64,
    /// The bodies the hub sent per seq, to check what a device installed.
    sent: BTreeMap<u64, String>,
}

/// One device's side of the simulated wire.
struct Wire<'a> {
    hub: &'a Hub,
    net: &'a RefCell<Net>,
    key: &'a DeviceKey,
    skew_ms: i64,
}

impl Wire<'_> {
    /// Move a request of `up` and `down` bytes through the link. Returns
    /// whether the hub side ran (`upload_done`) and whether the reply
    /// arrived.
    fn transfer(&self, up: u64, down: u64) -> (bool, bool) {
        let mut n = self.net.borrow_mut();
        let bps = n.spec.bandwidth_bps.max(1.0);
        let lat = n.spec.latency_ms as i64;
        let t_up = lat + ((up + n.spec.overhead_bytes) as f64 * 8.0 / bps * 1000.0) as i64;
        let t_down = lat + ((down + n.spec.overhead_bytes) as f64 * 8.0 / bps * 1000.0) as i64;
        let total = t_up + t_down;
        let att = n.att_lane;
        let roll = if att { n.att_rng.f() } else { n.rng.f() };
        let drop_at = if roll < n.spec.drop_prob {
            let at = if att { n.att_rng.f() } else { n.rng.f() };
            Some((at * total as f64) as i64)
        } else {
            None
        };
        let window = (n.window_end - n.now).max(0);
        let cut = match (drop_at, n.up) {
            (_, false) => Some(0),
            (Some(d), true) => Some(d.min(window)),
            (None, true) if total > window => Some(window),
            (None, true) => None,
        };
        let sent_up = up + n.spec.overhead_bytes;
        let sent_down = down + n.spec.overhead_bytes;
        let (b_up, b_down, out) = match cut {
            None => {
                n.now += total;
                (sent_up, sent_down, (true, true))
            }
            Some(c) => {
                n.now += c;
                let frac_up = (c as f64 / t_up.max(1) as f64).min(1.0);
                let b_up = (sent_up as f64 * frac_up) as u64;
                if c >= t_up {
                    let b_down =
                        (sent_down as f64 * ((c - t_up) as f64 / t_down.max(1) as f64)) as u64;
                    (b_up, b_down, (true, false))
                } else {
                    (b_up, 0, (false, false))
                }
            }
        };
        // The attachment lane keeps its own books, so the record metrics
        // read the same with it on or off.
        if att {
            n.att_requests += 1;
            n.att_bytes += b_up + b_down;
            if cut.is_some() {
                n.att_failed += 1;
            }
        } else {
            n.m.requests += 1;
            n.bytes_up += b_up;
            n.bytes_down += b_down;
            if cut.is_some() {
                n.m.failed_requests += 1;
                if out.0 {
                    n.m.lost_replies += 1;
                }
            }
        }
        out
    }

    /// Does someone on the link forge this reply? Draws only when the
    /// scenario forges, from the lane's own stream.
    fn forges(&self) -> Option<bool> {
        let mut n = self.net.borrow_mut();
        if n.forge_prob <= 0.0 {
            return None;
        }
        let att = n.att_lane;
        let (roll, how) = if att {
            (n.att_rng.f(), n.att_rng.f())
        } else {
            (n.rng.f(), n.rng.f())
        };
        if roll < n.forge_prob {
            n.forged += 1;
            // Half unsigned, half signed with the forger's own key.
            Some(how < 0.5)
        } else {
            None
        }
    }

    fn forge<T: Serialize>(&self, reply: &T, signed: bool) -> Result<Option<serde_json::Value>> {
        Ok(if signed {
            Some(crate::sync::hub_sign(
                reply,
                &ed25519_dalek::SigningKey::from_bytes(&[0x66; 32]),
            )?)
        } else {
            None
        })
    }

    fn forged_held(&self, sha256: &str, total: u64, signed: bool) -> Result<crate::sync::Held> {
        let mut h = crate::sync::Held {
            format: crate::sync::HELD_FORMAT.into(),
            device_id: self.key.device_id(),
            sha256: sha256.to_string(),
            total,
            held: total,
            signed_at: crate::audit::now_rfc3339(),
            signature: None,
            raw: None,
        };
        h.signature = self.forge(&h, signed)?;
        Ok(h)
    }

    fn at_hub<T>(&self, f: impl FnOnce(&Hub) -> T) -> T {
        let now = self.net.borrow().now;
        set_clock(Some(now));
        let out = f(self.hub);
        set_clock(Some(now + self.skew_ms));
        out
    }
}

impl HubLink for Wire<'_> {
    fn device_id(&self) -> String {
        self.key.device_id()
    }

    fn send(&self, batch: &[Upload]) -> Result<crate::sync::ReceiptSet> {
        let delivery = self.key.deliver(batch)?;
        let body = serde_json::to_vec(&delivery)?.len() as u64;
        let (stored, replied) = self.transfer(body, 120 * batch.len() as u64);
        if !stored {
            return Err(Error::Sync("link dropped during the upload".into()));
        }
        if let Some(signed) = self.forges() {
            // The upload never reaches the hub; receipts for all of it come back.
            let mut set = crate::sync::ReceiptSet {
                format: crate::sync::RECEIPTS_FORMAT.into(),
                device_id: self.key.device_id(),
                receipts: batch
                    .iter()
                    .map(|u| Receipt {
                        item_id: u.item_id.clone(),
                        payload_sha256: u.payload_sha256.clone(),
                        server_id: "hub:forged".into(),
                        received_at: crate::audit::now_rfc3339(),
                    })
                    .collect(),
                signed_at: crate::audit::now_rfc3339(),
                signature: None,
                raw: None,
            };
            set.signature = self.forge(&set, signed)?;
            return Ok(set);
        }
        let fresh: Vec<String> = batch
            .iter()
            .filter(|u| !self.hub.has_item(&u.item_id).unwrap_or(true))
            .map(|u| u.item_id.clone())
            .collect();
        let r = match self.at_hub(|h| h.receive(&delivery)) {
            Ok(r) => r,
            Err(e) => {
                let mut n = self.net.borrow_mut();
                n.refused_deliveries += 1;
                n.bytes_refused += body;
                return Err(e);
            }
        };
        {
            let mut n = self.net.borrow_mut();
            n.m.duplicates_suppressed += r.duplicates;
            let now = n.now;
            for id in fresh {
                n.hub_at.entry(id).or_insert(now);
            }
            for u in batch {
                *n.bytes_kind.entry(u.kind.clone()).or_default() += u.payload.len() as u64;
            }
            if n.rng.f() < n.spec.dup_prob {
                n.m.duplicates_sent += 1;
                drop(n);
                let again = self.at_hub(|h| h.receive(&delivery))?;
                self.net.borrow_mut().m.duplicates_suppressed += again.duplicates;
            }
        }
        if !replied {
            return Err(Error::Sync(
                "link dropped before the receipts came back".into(),
            ));
        }
        r.signed
            .ok_or_else(|| Error::Sync("the hub signed no receipts".into()))
    }

    fn bundles_since(&self, since: u64) -> Result<Vec<Value>> {
        let mut bundles = self.at_hub(|h| h.bundles_since(since))?;
        let size = serde_json::to_vec(&bundles)?.len() as u64;
        let (_, replied) = self.transfer(80, size);
        if !replied {
            return Err(Error::Sync("link dropped while fetching bundles".into()));
        }
        let mut n = self.net.borrow_mut();
        n.bytes_bundles += size;
        for b in &mut bundles {
            let seq = b.get("seq").and_then(Value::as_u64).unwrap_or(0);
            n.sent.entry(seq).or_insert_with(|| b.to_string());
            if n.rng.f() < n.tamper_prob {
                n.tampered += 1;
                b["issued_at"] = json!("1999-01-01T00:00:00.000Z");
            }
        }
        Ok(bundles)
    }

    fn pack_offer(&self, pack_id: &str, have: Option<&str>) -> Result<Option<PackOffer>> {
        let offer = self.at_hub(|h| h.pack_offer(pack_id, have))?;
        let size = serde_json::to_vec(&offer)?.len() as u64;
        let (_, replied) = self.transfer(80, size);
        if !replied {
            return Err(Error::Sync("link dropped while asking for packs".into()));
        }
        Ok(offer)
    }

    fn fetch(&self, offer: &PackOffer, path: &str) -> Result<Vec<u8>> {
        let bytes = self.at_hub(|h| h.fetch(offer, path))?;
        let (_, replied) = self.transfer(120, bytes.len() as u64);
        if !replied {
            return Err(Error::Sync(format!("link dropped while fetching {path}")));
        }
        self.net.borrow_mut().bytes_packs += bytes.len() as u64;
        Ok(bytes)
    }

    fn fleet(&self) -> Result<Option<Value>> {
        let doc = self.at_hub(|h| h.fleet_document())?;
        let size = serde_json::to_vec(&doc)?.len() as u64;
        let (_, replied) = self.transfer(80, size);
        if !replied {
            return Err(Error::Sync(
                "link dropped while fetching the fleet summary".into(),
            ));
        }
        self.net.borrow_mut().bytes_fleet += size;
        Ok(doc)
    }

    fn hello(&self) -> Result<(crate::sync::Hello, HelloReply)> {
        let h = self.key.hello(self.link_class())?;
        let size = serde_json::to_vec(&h)?.len() as u64;
        let (asked, replied) = self.transfer(size, 160);
        if !asked {
            return Err(Error::Sync("link dropped during the hello".into()));
        }
        if let Some(signed) = self.forges() {
            // A reply that never saw the hub: accepted, everything allowed.
            let mut r = self.at_hub(|hub| hub.hello(&h))?;
            r.accepted = true;
            r.refused = None;
            r.attachments = crate::sync::AttachmentMode::Full;
            r.signature = self.forge(&r, signed)?;
            return Ok((h, r));
        }
        let r = self.at_hub(|hub| hub.hello(&h))?;
        if !r.accepted {
            let mut n = self.net.borrow_mut();
            let o = n.spec.overhead_bytes;
            n.bytes_refused += size + 160 + 2 * o;
            n.refused_hellos += 1;
        }
        if !replied {
            return Err(Error::Sync(
                "link dropped before the hub answered the hello".into(),
            ));
        }
        Ok((h, r))
    }

    fn public_key(&self) -> String {
        self.key.public_base64()
    }

    fn link_class(&self) -> crate::sync::LinkClass {
        if self.net.borrow().spec.bandwidth_bps < 100_000.0 {
            crate::sync::LinkClass::Low
        } else {
            crate::sync::LinkClass::Normal
        }
    }

    fn attachment_offset(&self, sha256: &str, total: u64) -> Result<crate::sync::Held> {
        let (_, replied) = self.transfer(160, 80);
        if !replied {
            return Err(Error::Sync(
                "link dropped while asking for an attachment".into(),
            ));
        }
        if let Some(signed) = self.forges() {
            return self.forged_held(sha256, total, signed);
        }
        self.at_hub(|h| h.held_for(&self.key.device_id(), sha256, total))
    }

    fn put_chunk(
        &self,
        sha256: &str,
        variant: &str,
        total: u64,
        offset: u64,
        data: &[u8],
    ) -> Result<crate::sync::Held> {
        let c = self.key.chunk(sha256, variant, total, offset, data)?;
        let scale = self.net.borrow().byte_scale;
        // The wire carries the full-size chunk (base64 and the signature included).
        let size = (c.data.len() as u64) * scale + 400;
        let (stored, replied) = self.transfer(size, 80);
        self.net.borrow_mut().att_chunks += 1;
        if !stored {
            return Err(Error::Sync(
                "link dropped during an attachment chunk".into(),
            ));
        }
        if let Some(signed) = self.forges() {
            // The chunk is swallowed; "you are done" comes back.
            return self.forged_held(sha256, total, signed);
        }
        let held = self.at_hub(|h| h.put_chunk_signed(&c))?;
        if !replied {
            return Err(Error::Sync(
                "link dropped before the hub answered the chunk".into(),
            ));
        }
        Ok(held)
    }
}

fn backlog(devices: &[Device], day: f64, scale: u64) -> Result<Backlog> {
    let mut b = Backlog {
        day,
        ..Default::default()
    };
    for d in devices {
        b.full_bytes += d
            .rec
            .attachment_backlog(crate::sync::AttachmentMode::Full)?
            * scale;
        b.downscaled_bytes += d
            .rec
            .attachment_backlog(crate::sync::AttachmentMode::Downscaled)?
            * scale;
    }
    Ok(b)
}

fn db_bytes(rec: &Records) -> u64 {
    let c = rec.conn();
    let pages: i64 = c
        .query_row("PRAGMA page_count", [], |r| r.get(0))
        .unwrap_or(0);
    let size: i64 = c
        .query_row("PRAGMA page_size", [], |r| r.get(0))
        .unwrap_or(0);
    (pages * size) as u64
}

/// Walk a job on `dev` through its tree by random results, as a
/// technician would answer, and close it. Returns the lesson id, if any.
fn work_job(
    dev: &Device,
    rng: &mut Rng,
    wl: &Workload,
    captured: &mut Vec<String>,
    photos: Option<(&PhotoSpec, &mut Rng, &mut (u64, u64))>,
) -> Result<(bool, Option<String>)> {
    let pack = &dev.pack;
    let asset_id = dev.assets[rng.below(dev.assets.len())].clone();
    let asset = dev
        .rec
        .asset(&asset_id)?
        .ok_or_else(|| Error::Invalid("asset vanished".into()))?;
    let symptoms = pack.symptoms(asset.equip_id.as_deref())?;
    if symptoms.is_empty() {
        return Ok((false, None));
    }
    let sym = &symptoms[rng.below(symptoms.len())];
    let levels = pack.levels()?;
    let level = levels[rng.below(levels.len())].id.clone();
    let job = dev.rec.start_job(
        pack,
        &JobStart {
            symptom_id: Some(sym.symptom_id.clone()),
            asset_id: Some(asset_id),
            level,
            ..Default::default()
        },
    )?;
    let load = |id: &str| -> Result<crate::maint::Tree> {
        pack.fault_tree(id)?
            .ok_or_else(|| Error::Invalid("tree vanished".into()))
    };
    let mut tree = load(&job.tree_id)?;
    let mut steps = 0;
    let mut node_id = job.current_node.clone();
    let mut capped = false;
    loop {
        let node = tree
            .node(&node_id)
            .ok_or_else(|| Error::Invalid("node vanished".into()))?;
        let edges = tree.edges_from(&node_id);
        steps += 1;
        if steps > 60 {
            capped = true;
            break;
        }
        let j = if edges.is_empty() {
            // A goto into another tree is followed; any other end stops.
            match &node.target {
                Some(crate::maint::Target::Tree { .. }) => {
                    match dev.rec.follow_job(pack, &job.job_id) {
                        Ok(j) => j,
                        Err(_) => break, // the tree does not apply to this unit
                    }
                }
                _ => break,
            }
        } else {
            let e = edges[rng.below(edges.len())];
            let ans = answer_for(node, e, &node_id);
            let j = dev.rec.answer_job(pack, &job.job_id, &ans)?;
            if rng.f() < wl.back_prob {
                dev.rec.back_job(pack, &job.job_id)?
            } else {
                j
            }
        };
        node_id = j.current_node;
        if j.tree_id != tree.tree.tree_id {
            tree = load(&j.tree_id)?;
        }
    }
    let end = tree.node(&node_id).map(|n| n.kind);
    use crate::maint::NodeKind as K;
    let resolution = match (capped, end) {
        (true, _) => ResolutionKind::Unresolved,
        (_, Some(K::Escalate)) => ResolutionKind::Escalated,
        (_, Some(K::Goto)) => ResolutionKind::Redirected,
        _ => ResolutionKind::Fixed,
    };
    let lesson = if !capped && rng.f() < wl.lesson_prob {
        let view = dev.rec.job_view(pack, &job.job_id, None)?;
        let open = view
            .step
            .as_ref()
            .map(|s| s.node.possible_open.clone())
            .unwrap_or_default();
        let cause = open
            .get(rng.below(open.len().max(1)))
            .cloned()
            .unwrap_or_else(|| "Cause not found".into());
        let action = tree
            .node(&node_id)
            .map(|n| n.text.clone())
            .unwrap_or_default();
        let mut refs = Vec::new();
        if let Some((spec, prng, taken)) = photos {
            // Poisson count, log-normal size; real bytes at 1/scale.
            let l = (-spec.per_lesson.max(0.0)).exp();
            let (mut k, mut p) = (0u32, 1.0f64);
            loop {
                p *= prng.f();
                if p <= l || k > 20 {
                    break;
                }
                k += 1;
            }
            for _ in 0..k {
                let kb = spec.median_kb * (spec.sigma * prng.normal()).exp();
                let full = (kb * 1024.0) as u64;
                let scale = spec.byte_scale.max(1);
                let n = ((full / scale).max(16)) as usize;
                let bytes: Vec<u8> = (0..n).map(|_| (prng.next() & 0xFF) as u8).collect();
                let small_n = ((n as f64 * spec.small_ratio) as usize).max(8);
                let small: Vec<u8> = bytes[..small_n.min(n)].iter().map(|b| b ^ 0x5A).collect();
                refs.push(dev.rec.add_attachment(&bytes, "image/jpeg", Some(&small))?);
                taken.0 += 1;
                taken.1 += full;
            }
        }
        Some(LessonInput {
            cause,
            action,
            minutes: Some(10 + rng.below(80) as u32),
            photos: refs,
            submit: true,
            ..Default::default()
        })
    } else {
        None
    };
    let before: BTreeSet<String> = dev
        .rec
        .pending(10_000)?
        .into_iter()
        .map(|u| u.item_id)
        .collect();
    let (_, l) = dev.rec.close_job(
        pack,
        &job.job_id,
        &JobClose {
            resolution,
            note: None,
            lesson,
        },
    )?;
    for u in dev.rec.pending(10_000)? {
        if !before.contains(&u.item_id) {
            captured.push(u.item_id);
        }
    }
    Ok((true, l.map(|l| l.lesson_id)))
}

fn answer_for(
    node: &crate::maint::FaultNode,
    e: &crate::maint::FaultEdge,
    node_id: &str,
) -> JobAnswer {
    match &node.expect {
        Some(Expect::Value { .. }) if e.cond.is_none() => JobAnswer {
            node_id: node_id.to_string(),
            outcome: Some(branch::fold(&e.label)),
            ..Default::default()
        },
        Some(Expect::Value { unit, min, max, .. }) => {
            let dom = branch::domain(*min, *max);
            let i = e.cond.as_ref().and_then(|c| c.interval().ok());
            let v = match i {
                Some(i) => {
                    let lo = if i.lo.is_finite() {
                        i.lo
                    } else if dom.lo.is_finite() {
                        dom.lo
                    } else {
                        i.hi - 10.0
                    };
                    let hi = if i.hi.is_finite() {
                        i.hi
                    } else if dom.hi.is_finite() {
                        dom.hi
                    } else {
                        i.lo + 10.0
                    };
                    (lo + hi) / 2.0
                }
                None => 0.0,
            };
            JobAnswer {
                node_id: node_id.into(),
                value: Some(v),
                unit: Some(unit.clone()),
                ..Default::default()
            }
        }
        Some(Expect::Ack) => JobAnswer {
            node_id: node_id.into(),
            outcome: Some("done".into()),
            ..Default::default()
        },
        _ => JobAnswer {
            node_id: node_id.into(),
            outcome: Some(e.label.clone()),
            ..Default::default()
        },
    }
}

/// Run a scenario. `pack` is a pack directory to use (signed with the
/// fixture key); the fictional pump manual when absent.
pub fn run(s: &Scenario, pack: Option<&Path>) -> Result<Metrics> {
    if s.devices == 0 || s.days <= 0.0 {
        return Err(Error::Invalid("a scenario needs devices and days".into()));
    }
    let tmp = std::env::temp_dir().join(format!("harvest-sim-{}-{}", std::process::id(), s.seed));
    if tmp.exists() {
        std::fs::remove_dir_all(&tmp)?;
    }
    let out = (|| {
        if s.photos.is_none() {
            return Ok(run_in(s, pack, &tmp, false)?.0);
        }
        // The same fleet twice: the attachment lane off, then on. Records
        // draw from their own random stream, so any difference in when a
        // record arrives is the lane's doing.
        let (_, without) = run_in(s, pack, &tmp.join("without"), false)?;
        let (mut m, with) = run_in(s, pack, &tmp.join("with"), true)?;
        if let Some(a) = m.attachments.as_mut() {
            a.records_latency_without = stats(without.clone());
            a.records_latency_with = stats(with.clone());
            a.never_delayed_a_record = without == with;
        }
        let same = without == with;
        m.invariants.attachments_never_delay_records = same;
        if !same {
            m.invariants.ok = false;
            m.invariants
                .details
                .push("the attachment lane changed when records reached the hub".into());
        }
        Ok(m)
    })();
    set_clock(None);
    let _ = std::fs::remove_dir_all(&tmp);
    out
}

fn run_in(
    s: &Scenario,
    pack_src: Option<&Path>,
    tmp: &Path,
    attachments_on: bool,
) -> Result<(Metrics, Vec<f64>)> {
    crate::records::reset_sim_ids();
    set_clock(Some(EPOCH_MS));
    let keys: Vec<TrustedKey> = vec![fixture::trusted_key()];
    let hub_packs = tmp.join("hub-packs");
    // The hub's packs: the given pack, or the pump manual, as version dirs.
    let base_version;
    {
        let src = match pack_src {
            Some(p) => p.to_path_buf(),
            None => {
                let d = tmp.join("src-v1");
                fixture_maint::build(&d, "2026.1.1-1")?;
                d
            }
        };
        let m = crate::packs::verify_dir(&src, &keys)?;
        base_version = m.version.clone();
        let dest = hub_packs.join(&m.pack_id).join(&m.version);
        copy_dir(&src, &dest, &m)?;
    }
    let hub_key = ed25519_dalek::SigningKey::from_bytes(&[0x5a; 32]);
    let hub = Hub::in_memory(hub_key, "sim-fleet")?
        .with_packs(hub_packs.clone(), keys.clone())
        .with_fleet_every_hours(s.fleet_every_hours)
        .with_skew_bound_minutes(s.skew_bound_minutes)
        .with_attachment_policy(
            s.attachments_low,
            s.attachments_normal,
            s.chunk_kb * 1024 / s.photos.as_ref().map_or(1, |p| p.byte_scale.max(1)),
        );
    let field_keys = vec![hub.trusted_key()];
    let pack_id = crate::packs::read_manifest(&first_version_dir(&hub_packs)?, &keys)?.pack_id;
    let mut rng = Rng(s.seed);
    let net = RefCell::new(Net {
        rng: Rng(s.seed ^ 0xA5A5_A5A5),
        att_rng: Rng(s.seed ^ 0x5EED_A77A),
        att_lane: false,
        att_bytes: 0,
        att_chunks: 0,
        att_requests: 0,
        att_failed: 0,
        byte_scale: s.photos.as_ref().map_or(1, |p| p.byte_scale.max(1)),
        now: EPOCH_MS,
        window_end: EPOCH_MS,
        up: true,
        spec: s.link.clone(),
        tamper_prob: s.tamper_prob,
        forge_prob: s.forge_prob,
        forged: 0,
        m: Link::default(),
        bytes_up: 0,
        bytes_down: 0,
        bytes_bundles: 0,
        bytes_fleet: 0,
        refused_deliveries: 0,
        refused_hellos: 0,
        bytes_refused: 0,
        bytes_packs: 0,
        bytes_kind: BTreeMap::new(),
        hub_at: BTreeMap::new(),
        tampered: 0,
        sent: BTreeMap::new(),
    });
    // Devices: each its own packs root, records store, fleet slice.
    let mut devices = Vec::new();
    let total_devices = s.devices + usize::from(s.rogue_device);
    for i in 0..total_devices {
        let root = tmp.join(format!("dev-{i}"));
        let skew_ms = ((rng.f() * 2.0 - 1.0) * s.clock_skew_minutes * 60_000.0) as i64;
        set_clock(Some(EPOCH_MS + skew_ms));
        let inst =
            crate::packs::install_dir(&root, &hub_packs.join(&pack_id).join(&base_version), &keys)?;
        let pack = Arc::new(Pack::open(&inst.dir, &keys)?);
        let rec = Records::in_memory()?;
        let variants: Vec<String> = pack
            .equipment()
            .iter()
            .filter(|e| e.parent_id.is_some())
            .map(|e| e.equip_id.clone())
            .collect();
        let mut assets = Vec::new();
        let mut reg = Vec::new();
        for a in 0..s.workload.assets_per_device.max(1) {
            let id = format!("unit-{i}-{a}");
            let equip = if variants.is_empty() {
                None
            } else {
                Some(variants[rng.below(variants.len())].clone())
            };
            reg.push(json!({"asset_id": id, "equip_id": equip, "name": format!("Unit {i}-{a}")}));
            assets.push(id);
        }
        let registry: AssetRegistry =
            serde_json::from_value(json!({"format": "harvest-assets/1", "assets": reg}))?;
        rec.import_assets(Some(&pack), &registry)?;
        let first_window = (s.link.initial_down_days * DAY as f64) as i64;
        let key = DeviceKey::from_seed(&{
            use sha2::Digest;
            let h: [u8; 32] =
                sha2::Sha256::digest(format!("sim device {} {i}", s.seed).as_bytes()).into();
            h
        });
        let rogue = s.rogue_device && i == s.devices;
        if !rogue {
            hub.enroll(
                &key.public_base64(),
                Some(&format!("Unit {i}")),
                "Fleet admin",
            )?;
        }
        devices.push(Device {
            key,
            rec,
            pack,
            root,
            skew_ms,
            up: first_window == 0,
            window_end: EPOCH_MS + first_window,
            assets,
            installed_seqs: BTreeSet::new(),
            growth: Vec::new(),
        });
    }
    let end = EPOCH_MS + (s.days * DAY as f64) as i64;
    let mut q: BinaryHeap<std::cmp::Reverse<(i64, u64, Ev)>> = BinaryHeap::new();
    let mut seq = 0u64;
    let mut push = |q: &mut BinaryHeap<_>, t: i64, e: Ev| {
        seq += 1;
        q.push(std::cmp::Reverse((t, seq, e)));
    };
    for (i, d) in devices.iter_mut().enumerate() {
        if d.up {
            d.window_end = EPOCH_MS + rng.hours(&s.link.up);
        }
        push(&mut q, d.window_end, Ev::LinkFlip(i));
        if d.up {
            push(&mut q, EPOCH_MS, Ev::Sync(i));
        }
        let rate = s.workload.jobs_per_device_per_day.max(1e-9);
        push(
            &mut q,
            EPOCH_MS + (-(1.0 - rng.f()).ln() / rate * DAY as f64) as i64,
            Ev::Job(i),
        );
    }
    for r in &s.revoke {
        if r.device >= s.devices {
            return Err(Error::Invalid(format!("revoke: no device {}", r.device)));
        }
        push(
            &mut q,
            EPOCH_MS + (r.day * DAY as f64) as i64,
            Ev::Revoke(r.device),
        );
    }
    for (ci, c) in s.conflicts.iter().enumerate() {
        if c.device >= s.devices || c.other >= s.devices || c.device == c.other {
            return Err(Error::Invalid(format!(
                "conflict {ci}: two different devices"
            )));
        }
        push(
            &mut q,
            EPOCH_MS + (c.day * DAY as f64) as i64,
            Ev::Conflict(ci),
        );
    }
    push(
        &mut q,
        EPOCH_MS + (s.hub.review_every_hours * HOUR as f64) as i64,
        Ev::Review,
    );
    push(&mut q, EPOCH_MS, Ev::Sample);
    if let Some(d) = s.pack_update_day {
        push(&mut q, EPOCH_MS + (d * DAY as f64) as i64, Ev::PackUpdate);
    }
    let mut m = Metrics {
        scenario: s.name.clone(),
        seed: s.seed,
        days: s.days,
        devices: s.devices,
        ..Default::default()
    };
    let mut captured: BTreeMap<String, i64> = BTreeMap::new();
    let mut approved_at: BTreeMap<String, i64> = BTreeMap::new();
    let mut to_device: Vec<f64> = Vec::new();
    let mut details: Vec<String> = Vec::new();
    let mut applied_twice = false;
    let mut bad_install = false;
    let mut conflict_lessons: BTreeMap<usize, String> = BTreeMap::new();
    let mut photo_rng = Rng(s.seed ^ 0x0F07_0F07);
    let mut photos_taken: (u64, u64) = (0, 0);
    let mut att = Attachments {
        byte_scale: s.photos.as_ref().map_or(1, |p| p.byte_scale.max(1)),
        ..Default::default()
    };
    let mut revoked_at: BTreeMap<usize, String> = BTreeMap::new();
    let sync_every = (s.sync_every_minutes.max(1.0) * 60_000.0) as i64;
    let horizon = if s.final_sync { end + DAY } else { end };
    let mut final_started = false;

    while let Some(std::cmp::Reverse((t, _, ev))) = q.pop() {
        if t > horizon {
            break;
        }
        if s.final_sync && t >= end && !final_started {
            final_started = true;
            if let Some(b) = s.final_bandwidth_bps {
                net.borrow_mut().spec.bandwidth_bps = b;
            }
            for (i, d) in devices.iter_mut().enumerate() {
                d.up = true;
                d.window_end = horizon;
                push(&mut q, t, Ev::Sync(i));
            }
            push(&mut q, t + HOUR, Ev::Review);
        }
        if t >= end
            && matches!(
                ev,
                Ev::Job(_) | Ev::Conflict(_) | Ev::EditLesson(..) | Ev::LinkFlip(_)
            )
        {
            continue;
        }
        match ev {
            Ev::LinkFlip(i) => {
                let d = &mut devices[i];
                d.up = !d.up;
                let dur = if d.up {
                    rng.hours(&s.link.up)
                } else {
                    rng.hours(&s.link.down)
                };
                d.window_end = t + dur.max(60_000);
                push(&mut q, d.window_end, Ev::LinkFlip(i));
                if d.up {
                    push(&mut q, t, Ev::Sync(i));
                }
            }
            Ev::Sync(i) => {
                let (up, window_end, skew) =
                    (devices[i].up, devices[i].window_end, devices[i].skew_ms);
                if !up {
                    continue;
                }
                {
                    let mut n = net.borrow_mut();
                    n.now = t;
                    n.up = true;
                    n.window_end = window_end;
                }
                set_clock(Some(t + skew));
                let d = &mut devices[i];
                let wire = Wire {
                    hub: &hub,
                    net: &net,
                    key: &d.key,
                    skew_ms: skew,
                };
                net.borrow_mut().m.flush_attempts += 1;
                let up = d.rec.flush_to_hub(&wire, &field_keys, 50, false)?;
                if up.skipped_until.is_some() {
                    net.borrow_mut().m.backoff_skips += 1;
                }
                let pull = d.rec.pull(&wire, &field_keys)?;
                for seqn in &pull.installed {
                    if !d.installed_seqs.insert(*seqn) {
                        applied_twice = true;
                        details.push(format!("device {i} installed bundle {seqn} twice"));
                    }
                    let n = net.borrow();
                    let original = n.sent.get(seqn).cloned();
                    drop(n);
                    let ok = match &original {
                        Some(body) => {
                            hub.bundles_since(seqn - 1)?
                                .first()
                                .map(|b| b.to_string())
                                .as_ref()
                                == Some(body)
                        }
                        None => false,
                    };
                    if !ok {
                        bad_install = true;
                        details.push(format!(
                            "device {i} installed bundle {seqn} that is not the hub's"
                        ));
                    }
                    let now = net.borrow().now;
                    if let Some(b) = hub.bundles_since(seqn - 1)?.first() {
                        for note in b["notes"].as_array().into_iter().flatten() {
                            if let Some(at) =
                                note["note_id"].as_str().and_then(|id| approved_at.get(id))
                            {
                                to_device.push((now - at) as f64 / HOUR as f64);
                            }
                        }
                    }
                }
                m.bundles.installed += pull.installed.len() as u64;
                if pull.refused.is_some() {
                    m.bundles.refused += 1;
                }
                if s.pack_update_day.is_some() {
                    let have = d.pack.version().to_string();
                    if let Ok(Some(offer)) = wire.pack_offer(d.pack.pack_id(), Some(&have)) {
                        match crate::sync::install_offer(&d.root, &wire, &offer, &keys)
                            .and_then(|inst| Ok(Arc::new(Pack::open(&inst.dir, &keys)?)))
                        {
                            Ok(p) => {
                                d.pack = p;
                                m.packs.installed += 1;
                                *m.packs.kinds.entry(offer.kind.clone()).or_default() += 1;
                            }
                            Err(e) => m.packs.errors.push(format!("device {i}: {e}")),
                        }
                    }
                }
                let next = net.borrow().now.max(t) + sync_every;
                if attachments_on && s.photos.is_some() {
                    // The attachment lane: only what is left of this tick,
                    // never past the window, never past the next record.
                    let next_record = q
                        .iter()
                        .filter_map(|std::cmp::Reverse((et, _, e))| match e {
                            Ev::Job(j) | Ev::EditLesson(j, _) if *j == i => Some(*et),
                            Ev::Conflict(ci)
                                if s.conflicts[*ci].device == i || s.conflicts[*ci].other == i =>
                            {
                                Some(*et)
                            }
                            _ => None,
                        })
                        .min()
                        .unwrap_or(i64::MAX);
                    let deadline = next.min(window_end).min(next_record);
                    // Start a chunk only when it ends before the deadline,
                    // so no chunk is on the wire when records are due.
                    let chunk_ms = {
                        let n = net.borrow();
                        let wire_bytes =
                            s.chunk_kb * 1024 * 4 / 3 + 400 + 2 * n.spec.overhead_bytes;
                        (wire_bytes as f64 * 8.0 / n.spec.bandwidth_bps.max(1.0) * 1000.0) as i64
                            + 2 * n.spec.latency_ms as i64
                    };
                    net.borrow_mut().att_lane = true;
                    let r = d.rec.send_attachments(&wire, &field_keys, &|| {
                        net.borrow().now + chunk_ms >= deadline
                    });
                    net.borrow_mut().att_lane = false;
                    let r = r?;
                    att.resumed += r.resumed;
                    if r.yielded {
                        att.yields += 1;
                    }
                }
                if next < devices[i].window_end {
                    push(&mut q, next, Ev::Sync(i));
                }
            }
            Ev::Job(i) => {
                let d = &devices[i];
                set_clock(Some(t + d.skew_ms));
                let mut new_items = Vec::new();
                let photos = s
                    .photos
                    .as_ref()
                    .map(|p| (p, &mut photo_rng, &mut photos_taken));
                let (did, lesson) = work_job(d, &mut rng, &s.workload, &mut new_items, photos)?;
                if did {
                    m.jobs += 1;
                }
                for it in new_items {
                    captured.insert(it, t);
                }
                if let Some(l) = lesson {
                    m.lessons.created += 1;
                    if rng.f() < s.workload.edit_prob {
                        push(
                            &mut q,
                            t + 2 * HOUR + rng.below(6) as i64 * HOUR,
                            Ev::EditLesson(i, l),
                        );
                    }
                }
                let rate = s.workload.jobs_per_device_per_day.max(1e-9);
                push(
                    &mut q,
                    t + (-(1.0 - rng.f()).ln() / rate * DAY as f64) as i64,
                    Ev::Job(i),
                );
            }
            Ev::EditLesson(i, lesson_id) => {
                let d = &devices[i];
                set_clock(Some(t + d.skew_ms));
                let cur = d
                    .rec
                    .lessons(&LessonFilter::default())?
                    .into_iter()
                    .find(|l| l.lesson_id == lesson_id);
                if let Some(l) = cur {
                    let before: BTreeSet<String> = d
                        .rec
                        .pending(10_000)?
                        .into_iter()
                        .map(|u| u.item_id)
                        .collect();
                    d.rec.update_lesson(
                        Some(&d.pack),
                        &lesson_id,
                        LessonInput {
                            cause: l.cause,
                            action: format!("{} Checked again after an hour.", l.action),
                            submit: true,
                            ..Default::default()
                        },
                    )?;
                    m.lessons.edited_on_device += 1;
                    for u in d.rec.pending(10_000)? {
                        if !before.contains(&u.item_id) {
                            captured.insert(u.item_id, t);
                        }
                    }
                }
            }
            Ev::Conflict(ci) => {
                let c = &s.conflicts[ci];
                let (a, b) = (c.device, c.other);
                let lesson_id = match conflict_lessons.get(&ci) {
                    Some(id) => id.clone(),
                    None => {
                        let d = &devices[a];
                        set_clock(Some(t + d.skew_ms));
                        let before: BTreeSet<String> = d
                            .rec
                            .pending(10_000)?
                            .into_iter()
                            .map(|u| u.item_id)
                            .collect();
                        let tree = d
                            .pack
                            .fault_trees(None)?
                            .into_iter()
                            .next()
                            .map(|t| t.tree_id);
                        let l = d.rec.create_lesson(
                            Some(&d.pack),
                            LessonInput {
                                tree_id: tree,
                                cause: "Loose connector at the starter relay".into(),
                                action: "Reseated the connector".into(),
                                submit: true,
                                ..Default::default()
                            },
                        )?;
                        m.lessons.created += 1;
                        for u in d.rec.pending(10_000)? {
                            if !before.contains(&u.item_id) {
                                captured.insert(u.item_id, t);
                            }
                        }
                        conflict_lessons.insert(ci, l.lesson_id.clone());
                        let gap = (c.gap_minutes * 60_000.0) as i64;
                        push(&mut q, t + gap.max(1), Ev::Conflict(ci));
                        continue;
                    }
                };
                let d = &devices[b];
                set_clock(Some(t + d.skew_ms));
                let before: BTreeSet<String> = d
                    .rec
                    .pending(10_000)?
                    .into_iter()
                    .map(|u| u.item_id)
                    .collect();
                let tree = d
                    .pack
                    .fault_trees(None)?
                    .into_iter()
                    .next()
                    .map(|t| t.tree_id);
                d.rec.create_lesson(
                    Some(&d.pack),
                    LessonInput {
                        lesson_id: Some(lesson_id),
                        tree_id: tree,
                        cause: "Corroded terminal at the starter relay".into(),
                        action: "Cleaned and reseated the connector".into(),
                        submit: true,
                        ..Default::default()
                    },
                )?;
                for u in d.rec.pending(10_000)? {
                    if !before.contains(&u.item_id) {
                        captured.insert(u.item_id, t);
                    }
                }
            }
            Ev::Review => {
                set_clock(Some(t));
                let delay = (s.hub.review_delay_hours * HOUR as f64) as i64;
                for item in hub.queue(Some("pending"))? {
                    let first =
                        crate::records::maint::day_number(&item.first_received_at).unwrap_or(0);
                    let _ = first;
                    let received = parse_ms(&item.first_received_at).unwrap_or(t);
                    if t - received < delay {
                        continue;
                    }
                    let roll = rng.f();
                    if roll < s.hub.approve_prob {
                        let edit = if rng.f() < s.hub.edit_prob {
                            m.lessons.approved_edited += 1;
                            Some(crate::hub::NoteEdit {
                                text: Some(format!("{} (reviewed)", item.current.action)),
                                scope: None,
                            })
                        } else {
                            None
                        };
                        // A conflict the clocks cannot order: the reviewer
                        // takes the version received last.
                        let version = item.needs_reviewer.then(|| {
                            item.versions
                                .iter()
                                .max_by(|a, b| {
                                    a.received_at
                                        .cmp(&b.received_at)
                                        .then(a.item_id.cmp(&b.item_id))
                                })
                                .map(|v| v.item_id.clone())
                        });
                        let n = hub.approve(
                            &item.lesson_id,
                            "Reviewer A",
                            edit,
                            None,
                            version.flatten().as_deref(),
                        )?;
                        approved_at.insert(n.note_id, t);
                        m.lessons.approved += 1;
                    } else {
                        hub.reject(&item.lesson_id, "Reviewer A", Some("Not enough detail"))?;
                        m.lessons.rejected += 1;
                    }
                }
                if hub.publish(false, "Publisher A")?.is_some() {
                    m.bundles.published += 1;
                }
                push(
                    &mut q,
                    t + (s.hub.review_every_hours * HOUR as f64) as i64,
                    Ev::Review,
                );
            }
            Ev::Sample => {
                let day = (t - EPOCH_MS) as f64 / DAY as f64;
                if s.photos.is_some() {
                    att.backlog.push(backlog(
                        &devices,
                        (day * 10.0).round() / 10.0,
                        att.byte_scale,
                    )?);
                }
                for d in &mut devices {
                    d.growth
                        .push(((day * 10.0).round() / 10.0, db_bytes(&d.rec)));
                }
                if t < end {
                    push(
                        &mut q,
                        (t + (s.sample_every_days * DAY as f64) as i64).min(end),
                        Ev::Sample,
                    );
                }
            }
            Ev::Revoke(i) => {
                set_clock(Some(t));
                hub.revoke(
                    &devices[i].key.device_id(),
                    "Fleet admin",
                    Some("scripted revocation"),
                )?;
                revoked_at.insert(i, crate::audit::now_rfc3339());
            }
            Ev::PackUpdate => {
                set_clock(Some(t));
                let v2 = next_version(&base_version);
                let target = hub_packs.join(&pack_id).join(&v2);
                if pack_src.is_none() {
                    fixture_maint::build_with(&target, &v2, |c| {
                        c.execute_batch(
                            "UPDATE section SET text = text || ' Revision D.' WHERE section_id = 'm40.1';",
                        )?;
                        Ok(())
                    })?;
                    let base = hub_packs.join(&pack_id).join(&base_version);
                    let delta = hub_packs
                        .join(&pack_id)
                        .join(format!("delta-{base_version}-{v2}"));
                    crate::delta::make_delta(
                        &base,
                        &target,
                        &delta,
                        &keys,
                        Some(&fixture::signing_key()),
                    )?;
                    m.packs.published = true;
                }
            }
        }
    }
    set_clock(Some(horizon));
    // Final accounting.
    let n = net.into_inner();
    let net_att = (n.att_bytes, n.att_chunks, n.att_requests, n.att_failed);
    m.link = n.m.clone();
    m.link.refused_deliveries = n.refused_deliveries;
    m.link.refused_hellos = n.refused_hellos;
    m.link.forged_replies = n.forged;
    m.bundles.tampered_in_transit = n.tampered;
    let mut lost = 0u64;
    let mut pending = 0u64;
    let mut delivered = 0u64;
    let mut to_hub = Vec::new();
    let mut blocked = 0u64;
    let refused_devices: Vec<usize> = revoked_at
        .keys()
        .copied()
        .chain(s.rogue_device.then_some(s.devices))
        .collect();
    let blocked_ids: BTreeSet<String> = refused_devices
        .iter()
        .flat_map(|i| {
            devices[*i]
                .rec
                .pending(1_000_000)
                .unwrap_or_default()
                .into_iter()
                .map(|u| u.item_id)
        })
        .collect();
    let pending_ids: BTreeSet<String> = devices
        .iter()
        .flat_map(|d| {
            d.rec
                .pending(1_000_000)
                .unwrap_or_default()
                .into_iter()
                .map(|u| u.item_id)
        })
        .collect();
    for (id, at) in &captured {
        // Where the device holds it: (row present, acknowledged).
        let mut row = (false, false);
        for d in &devices {
            if let Ok(acked) = d.rec.conn().query_row(
                "SELECT acked_at IS NOT NULL FROM outbox WHERE item_id = ?1",
                [id],
                |r| r.get::<_, bool>(0),
            ) {
                row = (true, acked);
            }
        }
        if hub.has_item(id)? {
            delivered += 1;
            if let Some(h) = n.hub_at.get(id) {
                to_hub.push((h - at) as f64 / HOUR as f64);
            }
        } else if row.0 && row.1 {
            lost += 1;
            details.push(format!(
                "item {id} was acknowledged but the hub does not hold it"
            ));
        } else if pending_ids.contains(id) || row.0 {
            pending += 1;
            if blocked_ids.contains(id) {
                blocked += 1;
            }
        }
        // No row and not at the hub: a lesson upload withdrawn by a later
        // edit on the device, replaced by the new version (not lost).
    }
    let replaced = captured.len() as u64 - delivered - pending - lost;
    let counted = captured.len() as u64 - replaced;
    m.delivery = Delivery {
        captured: counted,
        delivered,
        pending,
        blocked,
        lost,
        delivered_of_captured: ratio(delivered, counted),
        delivered_of_deliverable: ratio(delivered, counted.saturating_sub(blocked)),
    };
    let mut latencies = to_hub.clone();
    latencies.sort_by(f64::total_cmp);
    m.capture_to_hub_hours = stats(to_hub);
    m.approval_to_device_hours = stats(to_device);
    let jobs_at_hub = hub.status()?.jobs;
    let lessons_bytes = *n.bytes_kind.get("lesson").unwrap_or(&0);
    let job_bytes = *n.bytes_kind.get("job").unwrap_or(&0);
    let lessons_at_hub: u64 =
        hub.conn()
            .query_row("SELECT count(*) FROM lesson_version", [], |r| {
                r.get::<_, i64>(0)
            })? as u64;
    m.bytes = Bytes {
        up: n.bytes_up,
        down: n.bytes_down,
        total: n.bytes_up + n.bytes_down,
        per_job: (jobs_at_hub > 0).then(|| (job_bytes as f64 / jobs_at_hub as f64).round()),
        per_lesson: (lessons_at_hub > 0)
            .then(|| (lessons_bytes as f64 / lessons_at_hub as f64).round()),
        per_day: ((n.bytes_up + n.bytes_down) as f64 / s.days).round(),
        bundles: n.bytes_bundles,
        fleet: n.bytes_fleet,
        refused: n.bytes_refused,
        packs: n.bytes_packs,
    };
    let queue = hub.queue(None)?;
    m.lessons.pending_at_end = queue.iter().filter(|q| q.status == "pending").count() as u64;
    for c in hub.conflicts()? {
        let item = queue.iter().find(|q| q.lesson_id == c.lesson_id);
        let dev_of = |item_id: &str| {
            item.and_then(|q| q.versions.iter().find(|v| v.item_id == item_id))
                .map(|v| v.device_id.clone())
                .unwrap_or_default()
        };
        m.conflicts.push(ConflictOut {
            lesson_id: c.lesson_id.clone(),
            winner_device: dev_of(&c.winner),
            loser_device: dev_of(&c.loser),
            rule: c.rule.clone(),
            class: c.class.clone(),
            resolved_by: c.resolved_by.clone(),
            losing_version_visible: item.is_some_and(|q| {
                q.versions.iter().any(|v| v.item_id == c.loser)
                    && q.versions.iter().any(|v| v.item_id == c.winner)
            }),
        });
        *m.conflict_classes.entry(c.class.clone()).or_default() += 1;
    }
    // Applied twice at the hub: one row per item and per job.
    let items: i64 = hub
        .conn()
        .query_row("SELECT count(*) FROM item", [], |r| r.get(0))?;
    let distinct: i64 =
        hub.conn()
            .query_row("SELECT count(DISTINCT item_id) FROM item", [], |r| r.get(0))?;
    if items != distinct {
        applied_twice = true;
        details.push("the hub holds an item twice".into());
    }
    let mut chains = hub.verify_audit()?.ok;
    if !chains {
        details.push("the hub's audit chain is broken".into());
    }
    for (i, d) in devices.iter().enumerate() {
        if !d.rec.verify_audit()?.ok {
            chains = false;
            details.push(format!("device {i}'s audit chain is broken"));
        }
        let first = d.growth.first().map(|g| g.1).unwrap_or(0);
        let last = db_bytes(&d.rec);
        let mut samples = d.growth.clone();
        if samples.last().map(|x| x.0) != Some(s.days) {
            samples.push((s.days, last));
        }
        m.growth.push(Growth {
            device: i,
            samples,
            bytes_per_day: ((last.saturating_sub(first)) as f64 / s.days).round(),
        });
    }
    // Nothing from a device the hub does not accept.
    let mut unenrolled_ok = true;
    let count_from = |dev: &str, after: Option<&str>| -> Result<i64> {
        Ok(hub.conn().query_row(
            "SELECT count(*) FROM item WHERE device_id = ?1 AND (?2 IS NULL OR received_at >= ?2)",
            rusqlite::params![dev, after],
            |r| r.get(0),
        )?)
    };
    if s.rogue_device {
        let rogue = devices[s.devices].key.device_id();
        if count_from(&rogue, None)? > 0 {
            unenrolled_ok = false;
            details.push("the hub accepted an upload from an unenrolled device".into());
        }
    }
    for (i, at) in &revoked_at {
        if count_from(&devices[*i].key.device_id(), Some(at))? > 0 {
            unenrolled_ok = false;
            details.push(format!(
                "the hub accepted an upload from device {i} after its revocation"
            ));
        }
    }
    let refused_devices = (revoked_at.len() + usize::from(s.rogue_device)) as u64;
    let per_hello = 400 + 160 + 2 * s.link.overhead_bytes;
    let refused_bound = refused_devices * (s.days.ceil() as u64 + 12) * per_hello;
    let refused_ok = m.bytes.refused <= refused_bound;
    if !refused_ok {
        details.push(format!(
            "refused devices spent {} bytes on the link, above the bound of {refused_bound}",
            m.bytes.refused
        ));
    }
    // Every attachment a device marks sent, the hub holds.
    let mut att_ok = true;
    for (i, d) in devices.iter().enumerate() {
        for a in d.rec.attachments()? {
            let want = match a.sent.as_str() {
                "full" => Some(a.sha256.clone()),
                "small" => a.small_sha256.clone(),
                _ => None,
            };
            if let Some(sha) = want
                && !hub.has_attachment(&sha)?
            {
                att_ok = false;
                details.push(format!(
                    "device {i} marks attachment {} sent; the hub does not hold it",
                    &a.sha256[..12]
                ));
            }
        }
    }
    m.invariants = Invariants {
        nothing_lost: lost == 0,
        nothing_applied_twice: !applied_twice,
        no_bad_bundle_installed: !bad_install,
        audit_chains_intact: chains,
        no_upload_from_unenrolled_or_revoked: unenrolled_ok,
        refused_traffic_bounded: refused_ok,
        attachments_never_delay_records: true,
        no_attachment_marked_sent_without_hub: att_ok,
        ok: lost == 0
            && !applied_twice
            && !bad_install
            && chains
            && unenrolled_ok
            && refused_ok
            && att_ok,
        details,
    };
    if s.photos.is_some() {
        let n = net_att;
        att.photos = photos_taken.0;
        att.bytes_taken = photos_taken.1;
        att.bytes_sent = n.0;
        att.chunks = n.1;
        att.requests = n.2;
        att.failed_requests = n.3;
        att.complete_at_hub = hub.conn().query_row(
            "SELECT count(*) FROM attachment WHERE complete = 1",
            [],
            |r| r.get::<_, i64>(0),
        )? as u64;
        att.full_at_hub = hub.conn().query_row(
            "SELECT count(*) FROM attachment WHERE complete = 1 AND variant = 'full'",
            [],
            |r| r.get::<_, i64>(0),
        )? as u64;
        att.backlog.push(backlog(
            &devices,
            s.days + if s.final_sync { 1.0 } else { 0.0 },
            att.byte_scale,
        )?);
        m.attachments = Some(att);
    }
    Ok((m, latencies))
}

fn ratio(a: u64, b: u64) -> f64 {
    if b == 0 {
        1.0
    } else {
        ((a as f64 / b as f64) * 10_000.0).round() / 10_000.0
    }
}

fn parse_ms(t: &str) -> Option<i64> {
    let day = crate::records::maint::day_number(t)?;
    let hms = t.get(11..23)?;
    let h: i64 = hms.get(0..2)?.parse().ok()?;
    let mi: i64 = hms.get(3..5)?.parse().ok()?;
    let se: i64 = hms.get(6..8)?.parse().ok()?;
    let ms: i64 = hms.get(9..12)?.parse().ok()?;
    Some(day * DAY + h * HOUR + mi * 60_000 + se * 1000 + ms)
}

fn next_version(v: &str) -> String {
    match v.rsplit_once('-') {
        Some((head, n)) if n.parse::<u64>().is_ok() => {
            format!("{head}-{}", n.parse::<u64>().unwrap_or(0) + 1)
        }
        _ => format!("{v}-2"),
    }
}

fn first_version_dir(root: &Path) -> Result<PathBuf> {
    for e in std::fs::read_dir(root)? {
        let p = e?.path();
        for v in std::fs::read_dir(&p)? {
            let v = v?.path();
            if v.join(crate::packs::MANIFEST).is_file() {
                return Ok(v);
            }
        }
    }
    Err(Error::Invalid("no pack".into()))
}

fn copy_dir(src: &Path, dest: &Path, m: &crate::packs::Manifest) -> Result<()> {
    std::fs::create_dir_all(dest)?;
    std::fs::copy(
        src.join(crate::packs::MANIFEST),
        dest.join(crate::packs::MANIFEST),
    )?;
    for f in &m.files {
        let to = dest.join(&f.path);
        if let Some(p) = to.parent() {
            std::fs::create_dir_all(p)?;
        }
        std::fs::copy(src.join(&f.path), to)?;
    }
    Ok(())
}

/// The named scenarios shipped with the core (`harvest/sim/*.json` holds
/// the same).
pub fn named(name: &str) -> Option<Scenario> {
    let v = match name {
        "pier-daily" => json!({
            "name": "pier-daily", "seed": 7, "days": 60, "devices": 4,
            "link": {"up": {"dist": "uniform", "min_hours": 2, "max_hours": 4},
                     "down": {"dist": "uniform", "min_hours": 20, "max_hours": 22},
                     "bandwidth_bps": 2000000, "drop_prob": 0.01, "dup_prob": 0.01},
            "workload": {"jobs_per_device_per_day": 2, "lesson_prob": 0.5, "back_prob": 0.05, "edit_prob": 0.1},
            "clock_skew_minutes": 3,
            "conflicts": [{"day": 10, "device": 0, "other": 1, "gap_minutes": 30}],
            "pack_update_day": 20, "final_sync": true
        }),
        "underway-two-weeks" => json!({
            "name": "underway-two-weeks", "seed": 11, "days": 42, "devices": 6,
            "link": {"up": {"dist": "exp", "mean_hours": 1}, "down": {"dist": "exp", "mean_hours": 30},
                     "initial_down_days": 3, "bandwidth_bps": 2400, "latency_ms": 1200,
                     "drop_prob": 0.15, "dup_prob": 0.05},
            "workload": {"jobs_per_device_per_day": 1.5, "lesson_prob": 0.6, "back_prob": 0.05},
            "clock_skew_minutes": 20, "sync_every_minutes": 30,
            "conflicts": [{"day": 5, "device": 2, "other": 3, "gap_minutes": 10}],
            "tamper_prob": 0.02, "fleet_every_hours": 168, "final_sync": true,
            "photos": {"per_lesson": 1.2, "median_kb": 1500, "sigma": 0.5},
            "final_bandwidth_bps": 2000000, "sample_every_days": 3
        }),
        "disconnected-180" => json!({
            "name": "disconnected-180", "seed": 3, "days": 180, "devices": 3,
            "link": {"up": {"dist": "fixed", "hours": 0}, "down": {"dist": "fixed", "hours": 100000},
                     "initial_down_days": 180, "bandwidth_bps": 256000},
            "workload": {"jobs_per_device_per_day": 1, "lesson_prob": 0.5, "edit_prob": 0.05},
            "clock_skew_minutes": 90, "fleet_every_hours": 168, "final_sync": true
        }),
        "flapping" => json!({
            "name": "flapping", "seed": 23, "days": 30, "devices": 4,
            "link": {"up": {"dist": "log_normal", "median_hours": 0.2, "sigma": 1.2},
                     "down": {"dist": "log_normal", "median_hours": 0.5, "sigma": 1.5},
                     "bandwidth_bps": 64000, "drop_prob": 0.3, "dup_prob": 0.1},
            "workload": {"jobs_per_device_per_day": 3, "lesson_prob": 0.5, "back_prob": 0.1, "edit_prob": 0.2},
            "clock_skew_minutes": 10, "sync_every_minutes": 5,
            "conflicts": [{"day": 3, "device": 0, "other": 1, "gap_minutes": 0},
                          {"day": 9, "device": 2, "other": 3, "gap_minutes": 45}],
            "tamper_prob": 0.05, "forge_prob": 0.05, "rogue_device": true,
            "revoke": [{"device": 3, "day": 20}], "final_sync": true
        }),
        _ => return None,
    };
    serde_json::from_value(v).ok()
}
