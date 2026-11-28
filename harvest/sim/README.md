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
| `underway-two-weeks.json` | 6 units, 42 days, starting 3 days offline. The link averages 1 hour up and 30 down at 2400 bit/s with 1.2 s latency, 15% drops, 5% duplicates and 2% tampered bundles. |
| `disconnected-180.json` | 3 units, 180 days with no link at all, then one sync. Clocks are up to 90 minutes off. |
| `flapping.json` | 4 units, 30 days, a link of minutes on and off at 64 kbit/s with 30% drops, 10% duplicates and 5% tampered bundles. Adds two scripted conflicts, a device that was never enrolled, and a device revoked on day 20. |

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
| `fleet_every_hours` | A changed fleet summary is fetched at most this often (default 24). It moves last, after uploads and bundles. |
| `conflicts` | `[{day, device, other, gap_minutes}]`: `other` edits the lesson `device` started, `gap_minutes` later. |
| `tamper_prob` | Chance a bundle is corrupted in transit. The device must refuse it, and asks for it again on the next pull. |
| `rogue_device` | One extra device that was never enrolled; it works and tries to upload. |
| `revoke` | `[{device, day}]`: devices revoked at the hub. |
| `pack_update_day` | A new pack version (and a delta from the first) is published at the hub. |
| `final_sync` | One last day with every link up, to show what eventually arrives. |
| `sample_every_days` | How often each device's records-store size is sampled (default 30). |

## Report (`metrics.json`)

| Field | Meaning |
|---|---|
| `jobs` | Jobs worked across the fleet. |
| `delivery` | `captured` (items queued for upload), `delivered` (at the hub), `pending` (still queued), `blocked` (of `pending`: held on a refused device), `lost`, and `rate` (delivered over what accepted devices captured). |
| `capture_to_hub_hours` | From capture to the hub storing the item: `n`, `median`, `p90`, `max`. |
| `approval_to_device_hours` | From a reviewer's approval to each device installing the note. |
| `bytes` | `up`, `down`, `total`, `per_job`, `per_lesson`, `per_day`, and the shares for `bundles`, `fleet` and `packs`. |
| `link` | `requests`, `failed_requests`, `lost_replies` (stored at the hub, receipts lost), `duplicates_sent`, `duplicates_suppressed`, `flush_attempts`, and `refused_deliveries` (unenrolled or revoked devices). |
| `conflicts` | Each lesson two units edited: the winning and losing devices, the rule that decided it, and whether the losing version stays visible to the reviewer. |
| `lessons` | `created`, `edited_on_device`, `approved`, `approved_edited`, `rejected`, `pending_at_end`. |
| `bundles` | `published`, `installed` (summed over devices), `tampered_in_transit`, `refused`. |
| `packs` | Whether an update was published, installs per kind (`delta` or `full`), and errors. |
| `growth` | Per device: `(day, bytes)` samples of the records store, and bytes per day. |
| `invariants` | The checks listed below, then `ok` (all of them), then `details` for any that broke. |

The invariants:
- **Nothing lost:** no item the device saw acknowledged is missing at the hub.
- **Nothing applied twice:** the hub holds each item once, and no device installs a bundle twice.
- **No bad bundle installed:** every bundle a device installed is byte-identical to the hub's own.
- **Audit chains intact:** the chain verifies on every device and on the hub.
- **No upload from an unenrolled or revoked device:** the hub holds nothing from the never-enrolled device, and nothing from a revoked device received after its revocation.
