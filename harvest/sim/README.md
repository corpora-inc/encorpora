# Fleet simulation scenarios

`harvest simulate <scenario.json> [--out metrics.json] [--pack DIR]` runs a
fleet in one process: N real device record stores and one real hub. The
fleet syncs over simulated links on a virtual clock. Everything a device or
the hub does runs the shipping code: jobs, lessons, the outbox, signed
deliveries, review, signed bundles, the fleet summary, and pack installs.
Only the wire and the clock are simulated.

The same seed gives the same report, byte for byte. The command exits 1
when an invariant breaks. Without `--pack` it uses the fictional pump manual
(`harvest fixture --maint`).

The files here are the named scenarios. A test keeps them equal to
`harvest_core::sim::named`.

| Scenario | What it models |
|---|---|
| `pier-daily.json` | 4 units, 60 days, a 2 to 4 hour link once a day at 2 Mbit/s, a scripted lesson conflict, a pack update on day 20 (delivered as a delta). |
| `underway-two-weeks.json` | 6 units, 42 days, starting 3 days offline. The link averages 1 hour up and 30 down at 2400 bit/s with 1.2 s latency, 15% drops, 5% duplicates and 2% tampered bundles. Lessons carry photos (1.2 per lesson, median 1.5 MB): the downscaled copies move underway, the full files at 2 Mbit/s in port. |
| `disconnected-180.json` | 3 units, 180 days with no link at all, then one sync. Clocks are up to 90 minutes off. |
| `flapping.json` | 4 units, 30 days, a link of minutes on and off at 64 kbit/s with 30% drops, 10% duplicates, 5% tampered bundles and 5% forged replies. Adds two scripted conflicts, a device that was never enrolled, and a device revoked on day 20. |

## Scenario format

Durations are in hours unless the name says otherwise.

| Field | Meaning |
|---|---|
| `name`, `seed` | Report label; the seed of every random draw. |
| `days`, `devices` | Simulated length; number of enrolled units. |
| `link.up`, `link.down` | Distributions of up and down windows, alternating. Each is one of `{"dist": "fixed", "hours"}`, `{"dist": "exp", "mean_hours"}`, `{"dist": "uniform", "min_hours", "max_hours"}` or `{"dist": "log_normal", "median_hours", "sigma"}`. |
| `link.initial_down_days` | Offline from the start (a deployment). |
| `link.bandwidth_bps`, `link.latency_ms`, `link.overhead_bytes` | Bits per second each way (no default); latency per request (default 300 ms); protocol overhead per request (default 600 bytes). |
| `link.drop_prob` | Chance a request is cut at a random point of its transfer. A cut before the hub stored the upload loses nothing; a cut after loses only the receipts, so the device resends and the hub suppresses the duplicate. |
| `link.dup_prob` | Chance an upload reaches the hub twice. |
| `workload.jobs_per_device_per_day` | Poisson arrivals of troubleshooting jobs, walked through the pack's trees with random results (following gotos into other trees). |
| `workload.lesson_prob`, `workload.back_prob`, `workload.edit_prob` | A lesson at close-out; an answer corrected (go back, answer again); a lesson edited on the device a few hours later. |
| `workload.assets_per_device` | Units in each device's slice of the fleet (default 3). |
| `hub.review_every_hours`, `hub.review_delay_hours`, `hub.approve_prob`, `hub.edit_prob` | The reviewer's rhythm. Each pending lesson is approved (some of those edited first) or rejected, then a bundle is published. |
| `clock_skew_minutes` | Each device's clock is off by up to this much, either way. |
| `sync_every_minutes` | How often a device syncs while its link is up (default 60). |
| `fleet_every_hours` | The hub's setting, learned by devices at every hello: a changed fleet summary is fetched at most this often (default 24; 168 in the low-bandwidth scenarios). It moves last, after uploads and bundles. |
| `skew_bound_minutes` | The hub's clock-skew bound for lesson conflicts (default 30). |
| `conflicts` | `[{day, device, other, gap_minutes}]`: `other` edits the lesson `device` started, `gap_minutes` later. |
| `tamper_prob` | Chance a bundle is corrupted in transit. The device must refuse it, and asks for it again on the next pull. |
| `forge_prob` | Chance a reply is forged on the link (receipts, a hello reply, an attachment `held`), unsigned or signed with a key the devices do not trust. |
| `rogue_device` | One extra device that was never enrolled; it works and tries to upload. |
| `revoke` | `[{device, day}]`: devices revoked at the hub. |
| `pack_update_day` | A new pack version (and a delta from the first) is published at the hub. |
| `final_sync` | One last day with every link up, to show what eventually arrives. |
| `sample_every_days` | How often each device's records-store size (and the attachment backlog) is sampled (default 30). |
| `final_bandwidth_bps` | The link speed during the final sync (the unit reaches port). |
| `photos` | `{per_lesson, median_kb, sigma, small_ratio, byte_scale}`: photos per lesson (Poisson mean), a log-normal size (median and sigma), the host's downscaled copy as a share of the full size (default 0.08). The devices store `1 / byte_scale` of each photo's bytes (default 100, so months of photos fit in memory) and the wire is charged the full size. |
| `attachments_low`, `attachments_normal`, `chunk_kb` | The hub's attachment policy on a link below 100 kbit/s and on a faster one (`refs`, `downscaled` or `full`; defaults `downscaled` and `full`), and the chunk size (default 64). |

## Report (`metrics.json`)

| Field | Meaning |
|---|---|
| `jobs` | Jobs worked across the fleet. |
| `delivery` | `captured` (items queued for upload), `delivered` (at the hub), `pending` (still queued), `blocked` (of `pending`: held on a device the hub refuses), `lost`, `delivered_of_captured` (delivered / captured), and `delivered_of_deliverable` (delivered / (captured − blocked)). |
| `capture_to_hub_hours` | From capture to the hub storing the item: `n`, `median`, `p90`, `max`. |
| `approval_to_device_hours` | From a reviewer's approval to each device installing the note. |
| `bytes` | `up`, `down`, `total`, `per_job`, `per_lesson`, `per_day`; the shares for `bundles`, `fleet` and `packs`; and `refused`, the bytes spent by devices the hub refuses (their hellos, and any delivery refused after a revocation). |
| `link` | `requests`, `failed_requests`, `lost_replies` (stored at the hub, receipts lost), `duplicates_sent`, `duplicates_suppressed`, `flush_attempts`, `refused_hellos`, `refused_deliveries` (a delivery from a device revoked after its hello), and `backoff_skips` (sync attempts a refused device skipped). |
| `conflicts` | Each lesson two units edited: the winning and losing devices, the rule, the class (`auto`, or `needs_reviewer` when the edits are within the hub's clock-skew bound and the reviewer chose), who chose, and whether both versions stay visible. |
| `conflict_classes` | Conflicts per class. |
| `lessons` | `created`, `edited_on_device`, `approved`, `approved_edited`, `rejected`, `pending_at_end`. |
| `bundles` | `published`, `installed` (summed over devices), `tampered_in_transit`, `refused`. |
| `packs` | Whether an update was published, installs per kind (`delta` or `full`), and errors. |
| `growth` | Per device: `(day, bytes)` samples of the records store, and bytes per day. |
| `attachments` | With `photos`: photos taken and their bytes; the lane's own wire bytes, requests, cut requests and chunks (kept apart from `bytes` and `link`, which count records only); photos resumed after a cut; variants and full files complete at the hub; passes cut short for records; `backlog` (`day`, `full_bytes`, `downscaled_bytes` still on the devices); and capture-to-hub hours of every record and lesson with the lane off (`records_latency_without`) and on (`records_latency_with`). |
| `invariants` | The checks listed below, then `ok` (all of them), then `details` for any that broke. |

The invariants:
- **Nothing lost:** no item the device saw acknowledged is missing at the hub.
- **Nothing applied twice:** the hub holds each item once, and no device installs a bundle twice.
- **No bad bundle installed:** every bundle a device installed is byte-identical to the hub's own.
- **Audit chains intact:** the chain verifies on every device and on the hub.
- **No upload from an unenrolled or revoked device:** the hub holds nothing from the never-enrolled device, and nothing from a revoked device received after its revocation.
- **Attachments never delay records:** with `photos`, every record and lesson reaches the hub at the same moment with the attachment lane on as with it off.
- **No attachment marked sent without the hub:** every photo a device marks sent (full or downscaled), the hub holds.
- **Refused traffic bounded:** `bytes.refused` stays within (refused devices) × (days + 12) × (one hello and its answer), which is what the back-off allows.

## Simulated boat (`boat.py`)

A development vehicle for the app's live link: ArduPilot Rover
software-in-the-loop with the `motorboat` frame, headless. The simulator is
a separate process built from the ArduPilot source (GPLv3); nothing in
harvest links or ships it. Build it once from a checkout (`./waf configure
--board sitl && ./waf rover`), then, with a Python that has `pymavlink`:

| Command | What it does |
|---|---|
| `boat.py start` | Starts the boat and waits until it runs. The app connects to `tcp:127.0.0.1:5760`. |
| `boat.py inject compass` | Compass 1 fails (`SIM_MAG1_FAIL 1`). |
| `boat.py inject rc` | The radio is lost (`SIM_RC_FAIL 1`). |
| `boat.py inject gps` | GPS 1 off (`SIM_GPS1_ENABLE 0`), with `ARMING_NEED_LOC 1` so the boat checks for a position in Manual. |
| `boat.py inject battery [VOLTS]` | The battery reads 9 V or `VOLTS` (`SIM_BATT_VOLTAGE`), with `BATT_ARM_VOLT 11` so the arming check has a threshold. |
| `boat.py clear [NAME]` | Restores what was injected (all of it with no name). |
| `boat.py status` | Asks for the pre-arm checks and prints the texts that come back. |
| `boat.py stop` | Stops it. |

The tool talks on the simulator's second port (5762) and leaves 5760 for
the app. `HARVEST_ARDUPILOT` names the source checkout and
`HARVEST_BOAT_DIR` the working folder (defaults under
`~/.cache/harvest/`).
