# 22. The Spark

## What it is

The Spark is the project's GPU workstation. It is an NVIDIA DGX
Spark, GB10 (Blackwell architecture, compute capability sm_121),
with 128 GB of unified memory, running CUDA 13.0 and PyTorch built
against `cu130`. It is the only piece of hardware in the project's
inventory that runs Chatterbox and Whisper at production scale; the
team's MacBooks can do one-off short runs but not 23-language
renders of a full book.

The Spark lives in a fixed physical location (Skylar's office) and
is reached over the network through Tailscale. There is no
direct public access; the Tailscale tailnet acts as the perimeter.
SSH into the Spark from a tailnet-joined laptop, run a pipeline
job, leave it overnight, come back.

The Spark does not run the encorpora repo. It runs `ttsctl`, the
narration pipeline tool, which is a separate repository at
`~/projects/ttsctl/` on the Spark's disk. The connection between
the two is the file system: the pipeline writes audio files,
alignment files, and audio manifests onto the Spark's disk; from
there they sync to S3 (section 24); from there packs in this repo
or running on a user's device fetch them. The Spark itself is
never the runtime.

## How it fits

The Spark is the producer end of the producer-consumer split that
runs through the rest of the manual. Chatterbox (section 20) runs
there; Whisper forced alignment (section 21) runs there; the
ffmpeg mastering chain (section 18) runs there; the validator and
the convergence loop run there. The encorpora repo is what packs
the output into shipping artifacts; the Spark is what produces the
output.

The Spark also gives us a different kind of state location.
Section 26 walks the four-or-more places state lives; the Spark is
one of them, and the one most easily forgotten because it is
neither code (which lives in git) nor delivery (which lives on S3
and CloudFront). It is the working surface where audio is being
made before anyone else can see it.

## Files and entry points

### In the repo (references only)

- `corpan/NARRATION_SYSTEM.md`: section "Hardware" documents the
  Spark's spec (`GB10, sm_121, 128 GB unified, CUDA 13.0,
  PyTorch cu130`). The per-stage timings (Chatterbox ~2 s,
  Whisper medium ~314 ms, ffmpeg mastering ~100 ms) come from
  there.
- `PIPELINE_STATE.md` (at the repo root): a dated snapshot of
  what was running on the Spark, the in-flight realignment
  state, and the validator calibrations under way. Skylar
  maintains it.
- `corpan/RUNBOOK_QUANTIZE_LARGE_Q8.md`: the runbook for
  quantizing a Whisper checkpoint for on-device use. Run on the
  Spark; output `.bin` ships in the pack zip.
- `corpan/CHANGELOGS.md`: documents that narration packs
  produced on the Spark land in
  `books/<category>/<series>/<book>/packs/<voice>-<engine>-v<n>/`
  with their own per-pack `CHANGELOG.md`.
- `corpan/infra/sync-voices-to-s3.sh`, `hydrate-voices.sh`: the
  scripts that round-trip voice references between local
  machines and S3. The Spark uses the same scripts.

### Outside the repo (lives on the Spark)

- `~/projects/ttsctl/`: the narration pipeline tool itself. Owns
  the Chatterbox invocation, the convergence loop, the
  validator, the mastering chain, the publisher, and the
  per-decision changelog under
  `~/projects/ttsctl/changelog/decisions/`.
- The local copy of the encorpora repo on the Spark, used as the
  source of `segments.json` files and the destination for
  `audio_manifest_<lang>.json` outputs before publication.
- The Hugging Face cache for the Chatterbox weights.
- The whisper model weights for the alignment runs.
- The Spark-side per-book working directories, where intermediate
  WAVs accumulate before mastering and publish.

## How it works

### Hardware envelope

The Spark's specs set what the pipeline can do per night:

| Stage                      | Where it runs | Per-segment time |
|----------------------------|---------------|------------------|
| Chatterbox generation      | GPU (CUDA 13.0) | ~2 s             |
| Whisper medium alignment   | GPU (stable-ts) | ~314 ms          |
| ffmpeg mastering           | CPU (ffmpeg)    | ~100 ms          |
| Validator (alignment + waveform checks) | CPU | small        |

The end-to-end per-segment budget is dominated by Chatterbox.
With 128 GB of unified memory the GPU can hold Chatterbox plus
Whisper medium plus the working buffers for a per-segment loop
without paging; this is what makes the convergence loop's
"generate, align, validate, retry on failure" tractable.

The unified-memory architecture is the GB10's defining feature
for this workload: CPU and GPU share the 128 GB, so there is no
explicit copy across PCIe between Chatterbox output (GPU
tensors) and the whisper alignment (still GPU) and the ffmpeg
mastering (CPU). The cost of moving a 24 kHz mono WAV between
the two is zero.

### Tailscale and access

The Spark is on a Tailscale tailnet. The team's laptops are on
the same tailnet. Access to the Spark is by tailnet name, not by
a public IP, with the tailnet's mesh handling authentication and
encryption. Practically:

```bash
# From a laptop already joined to the tailnet:
ssh spark
# or with the tailscale-suggested name:
ssh ts-spark.<tailnet>.ts.net
```

There is no public SSH port. There is no need to keep a port
open on the office firewall. There is no VPN client beyond
Tailscale's small daemon. A new contributor's first step is to
get added to the tailnet; their second step is `ssh spark`.

The other Tailscale-fronted services on the Spark (for the team
that uses them) include a Jupyter server, an FTP-like sync
target for in-flight book directories, and an internal web UI
for `ttsctl`. None of those is public.

### The "develop locally, run on the Spark" workflow

The shape Jeff and Skylar use most:

1. **Author locally.** Edit `segments.json` in the encorpora repo
   on a laptop. Run the validator in a local Python venv to
   catch the easy mistakes (raw digits in `tts.text`, missing
   `pause_after_ms`, etc.) before the pipeline starts.
2. **Push to the Spark's checkout.** Either by `git push`-pull
   on the Spark (the Spark has its own clone of the repo) or by
   `rsync` over the tailnet (`rsync -avz books/.../pack/
   spark:~/encorpora/books/.../pack/`). The Spark's checkout is
   the pipeline's input.
3. **Kick off the pipeline.** `ssh spark` and run
   `ttsctl generate --book <book-id> --langs en,es,ko ...` (or
   the equivalent per the tool's current CLI). Tail the logs;
   most of the time you walk away.
4. **The Spark renders.** Chatterbox per segment, Whisper
   alignment per segment, validator per segment, ffmpeg per
   segment, retries on failure, optional `tts.text` rewrite via
   a Claude subagent for stubborn segments. Output lands on the
   Spark's disk in the per-pack working directory.
5. **Publish.** `ttsctl publish` zips the pack, uploads the
   audio files to S3 (section 24), invalidates CloudFront, and
   updates `catalog.json`. The catalog refresh is what makes
   the new pack visible to running Corpán apps.
6. **Optional: hydrate locally.** Back on the laptop,
   `./corpan/infra/hydrate-audio.sh <book-id>` pulls the audio
   from S3 into the laptop's local pack directory so the reader
   pack can be iterated against without re-rendering.

Step 4 is what the Spark exists for. Steps 1, 2, 3, 5, 6 happen
elsewhere; the Spark is the GPU at the center.

### What lives on the Spark and only on the Spark

Several artifacts and configs are Spark-resident and have not
been migrated into the repo or to S3:

- The `ttsctl` source tree under `~/projects/ttsctl/`. The
  decision was deliberate: `ttsctl` is the tool, not a part of
  Corpán's shipping surface, and it has its own development
  cadence with Skylar as the primary maintainer.
- `~/projects/ttsctl/changelog/decisions/` (the per-discovery
  decision logs: validator calibrations, model upgrades, the
  language-leak anti-pattern recovery, the soccer-book voice-
  ID natural-key incident). Each is a dated markdown file. The
  catalog of decisions is referenced from `PIPELINE_STATE.md`
  at the encorpora repo root, but the decisions themselves live
  on the Spark.
- The Hugging Face cache of Chatterbox weights and the
  whisper model checkpoints. Reproducible from the package
  versions but cached for the per-job startup cost.
- Per-book intermediate WAVs (before mastering). Not synced to
  S3 because they regenerate; the cost of keeping them is local
  disk only.

The implication for the rest of the manual: when section 26
maps state locations, "the Spark" is genuinely a fourth location
alongside the repo, S3, and the device. Several files of
load-bearing knowledge live only there, and the team's working
practice is to keep them there.

### Failure modes specific to the Spark

A pipeline run on the Spark can fail in ways the encorpora repo
does not see:

- The model cache becomes corrupted after a Hugging Face
  update; the fix is to clear the cache and let the next run
  re-download.
- A long convergence loop hits a `tts.text` rewrite step and
  the Claude subagent's rewrite is itself wrong; the run halts
  pending human review.
- The Spark's disk fills up with intermediate WAVs; `ttsctl`
  has a cleanup mode (`--cleanup-intermediates`) for this.
- A CUDA version mismatch breaks PyTorch's CUDA path;
  the runbook for restoring is currently captured in
  `~/projects/ttsctl/README.md` (on the Spark).

None of these is something the encorpora repo can fix; they are
all Spark-side. Tailscale plus SSH plus the runbook is the
remediation path.

## Common operations

1. **Connect to the Spark.** `ssh spark` from a tailnet-joined
   machine. If `spark` is not a configured short name, fall
   back to the tailnet name (`ssh ts-spark.<tailnet>.ts.net`).
2. **Run a pipeline job.** `ssh spark` and run `ttsctl generate
   --book <book-id> --langs <list>`. Tail the logs; walk away
   for a few hours.
3. **Resync the Spark's repo checkout from upstream.**
   `cd ~/encorpora && git fetch upstream && git checkout main
   && git merge --ff-only upstream/main`. Same fork/upstream
   arrangement as a laptop (section 03).
4. **Move an in-flight book to the Spark.**
   `rsync -avz books/<category>/<series>/<book>/
   spark:~/encorpora/books/<category>/<series>/<book>/`.
5. **Publish a finished narration.** `ttsctl publish --book
   <book-id> --pack <pack-id>` on the Spark; the script zips,
   uploads to S3, invalidates CloudFront, and patches
   `catalog.json`. Verify on encorpora.io that the new
   narration appears in the catalog.
6. **Inspect a decision log.** `ssh spark` and read
   `~/projects/ttsctl/changelog/decisions/<dated-file>.md`.
   These are the canonical history of why a validator threshold
   is the value it is.

## Why we built it this way

A single GPU workstation instead of cloud GPU rentals is the
choice that fits the scale and the budget. The pipeline runs
overnight, several nights a week; renting that throughput on a
cloud GPU at on-demand prices would be expensive, and reserving
it would be inflexible. A Spark in an office, accessed over
Tailscale, pays for itself in months and stays available for as
long as the project needs it.

The GB10's unified-memory architecture is the specific feature
that matters for this workload. Chatterbox and Whisper both run
in GPU memory; the mastering chain is CPU. On a discrete-GPU
machine, the segment WAV would have to move from GPU memory to
host memory (a PCIe transfer) before ffmpeg could see it. On
the GB10, the same address is both. The throughput gain is
material at scale.

Tailscale instead of a public SSH port is the smallest-surface
remote access model. The tailnet is a mesh of authenticated
endpoints; nothing about the Spark is on the public internet;
adding a new contributor is a Tailscale invite, not a firewall
rule. The cost (the Tailscale dependency) has been small
compared to the alternatives.

Keeping `ttsctl` on the Spark and not in encorpora is the
deliberate split between the tool and the project. The
narration pipeline is going to keep evolving (new models, new
validators, new mastering choices) on a cadence that does not
match Corpán app releases. Sharing the repo would force the
two cadences together; keeping them apart lets Skylar move on
`ttsctl` without bumping the app's CI on every change.

The per-decision changelog folder on the Spark is the practice
that earns the "do not relearn the same thing" property of this
project. Every shipped calibration started as a discovery in a
specific dated file; the file documents the symptoms, the
investigation, the fix, and the resulting threshold. Section 36
walks the system's evolution; the discoveries are where the
evolution comes from.

## To go deeper

- `corpan/NARRATION_SYSTEM.md` "Hardware" and "Convergence Loop"
  sections.
- `PIPELINE_STATE.md` at the repo root for the latest dated
  snapshot of Spark-side work in flight.
- `corpan/RUNBOOK_QUANTIZE_LARGE_Q8.md` for one specific
  Spark-run procedure.
- Tailscale's documentation at `tailscale.com/kb` for tailnet
  setup; the project's tailnet config itself is held by Skylar.
- `~/projects/ttsctl/README.md` (on the Spark) for the tool's
  own documentation. Section 24 covers the S3 destination side;
  section 26 maps the Spark as a state location.
