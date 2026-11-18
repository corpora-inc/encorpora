# House voices on the Spark

The lesson-film kit voices films with our own voices as well as ElevenLabs.
This directory is the small HTTP service that makes those takes. It runs on
the DGX Spark (`ssh spark-lan`) and the kit calls it from the Mac.

A take goes through four steps on the Spark:

1. **Chatterbox Multilingual V3** (`chatterbox-v3`, Resemble AI, MIT) reads the
   text in a house voice, cloned from that voice's reference clip. It uses the
   generation settings that voiced the Corpán books (ttsctl `narration.yaml`):
   `cfg_weight` 0.85, `exaggeration` 0.3 (0.5 for the learner), `temperature`
   0.3, `top_p` 0.85, `min_p` 0.1, `repetition_penalty` 2.0. Try `k` of a take
   uses seed `1000 + k` and ttsctl's retry stage `k`, so a retake is a new seed.
2. **Trim** ([master.py](master.py)): ttsctl's lead-in, garbage-tail detection,
   length cap, end fade and 300 ms of silence.
3. **Master** ([master.py](master.py)): ttsctl's chain, `volume` (to -18 LUFS)
   → `highpass` 80 Hz → `adeclick` → `afftdn` → `agate` → `acompressor` →
   `alimiter`, written as 44.1 kHz mono 16-bit PCM. There is no final loudness
   pass: the kit brings every take to -23.6 LUFS itself (`even` in
   [../audio.ts](../audio.ts)).
4. **Align** ([align.py](align.py)): forced alignment of the script's words with
   `facebook/mms-1b-all` (English adapter), as ttsctl does. Then the take is
   trimmed once more around its first and last word.

The kit then runs its usual checks on the take: the transcript against the
script, held letters, take tail, clipping and stray sounds. For a house take
the transcript comes from Whisper large-v3-turbo on the Spark (`POST /hear`)
instead of ElevenLabs Scribe, so house voicing spends no ElevenLabs credits at
all; the kit does not need `ELEVEN_LABS_API_KEY` for a film voiced only by
house voices. Takes are cached in
`FILM_VOICES` like ElevenLabs takes, keyed by provider, model, voice and text,
with the seed of each try in the file.

## House voices

| Kit name | Speaker kinds | Service voice | Reference |
|---|---|---|---|
| Rowan | teacher, narrator | `rowan` | `~/voice-lab/refs/house/rowan.wav` |
| Wren | teacher, narrator | `wren` | `~/voice-lab/refs/house/wren.wav` |
| Pip | learner | `pip` | `~/voice-lab/refs/house/pip.wav` |

The references are ours. They were designed from text descriptions by
Qwen3-TTS VoiceDesign or VoxCPM2 voice design and are not recordings or
imitations of any person. `~/voice-lab/refs/house/README.md` records the
prompt, seed and model of each. Never use ElevenLabs audio or a recording of a
real person as a reference.

## Run the service

On the Spark, once:

```sh
~/voice-lab/chatterbox/install.sh      # env at ~/voice-lab/chatterbox/env (torch 2.11 cu130, Chatterbox main)
```

Copy this directory to `~/voice-lab/chatterbox/service/`, then start it bound
to the Spark's LAN or tailnet address, never to all interfaces:

```sh
cd ~/voice-lab/chatterbox/service
nohup nice -n 10 ../env/bin/python server.py --host <spark address> --port 18093 > ../logs/serve.log 2>&1 < /dev/null &
```

The process is named `lf-voice-serve`. It handles one request at a time. It
loads Chatterbox, the aligner and Whisper on first use (under 10 GB of GPU
memory) and unloads them after 15 idle minutes. Before each request it answers
503, and the kit waits and asks again, while an amp-cinema job holds
`gpu.lock` or `workload.lock`, while less than 24 GB of memory is available
for a first load, or while the load average is over 16.

On the Mac:

```sh
export FILM_SPARK_VOICE_URL=http://<spark address>:18093
npx tsx film/make.ts list-all-pairs--sl --voice teacher=rowan --voice learner=pip --check
npx tsx film/make.ts <film-id> --provider spark --check    # every speaker in house voices
```

`--voice teacher=rowan` re-voices one speaker; `--provider spark` gives every
speaker no `--voice` names a house voice (teachers are hashed over Rowan and
Wren by film ID, as Madeline and Paul are). The edition records `house-rowan`
and the others in `timing.json`, so export, the review player and publication
treat it like any other edition.

`GET /health` reports whether the models are loaded. `POST /hear` takes
`{pcm, sample_rate}` and answers what Whisper hears, in Scribe's shape.
`POST /tts` takes `{model, voice, text, words, seed, stage}`: `text` is what to read (numbers
and symbols already spelled as words, see [../spark.ts](../spark.ts)) and
`words` its spoken words in order. It answers a WAV, or with `"align": true`
JSON with base64 PCM and a `{word, start, end}` for each word. `model` is
`chatterbox-v3` (the house voices) or `chatterbox-turbo` (Chatterbox Turbo
350M, faster but less accurate on the comparison: kept as an alternative).
