# House voices on the Spark

The lesson-film kit voices films with our own voices as well as ElevenLabs.
This directory is the small HTTP service that makes those takes. It runs on
the DGX Spark (`ssh spark-lan`) and the kit calls it from the Mac.

A take goes through these steps on the Spark:

1. **Chatterbox Multilingual V3** (`chatterbox-v3`, Resemble AI, MIT) reads the
   text in a house voice, cloned from that voice's reference clip. It uses the
   generation settings that voiced the Corpán books (ttsctl `narration.yaml`):
   `cfg_weight` 0.85, `exaggeration` 0.3 (0.5 for the learner), `temperature`
   0.3, `top_p` 0.85, `min_p` 0.1, `repetition_penalty` 2.0. Try `k` of a take
   uses seed `1000 + k` and ttsctl's retry stage `k`, so a retake is a new seed.
   V3 has no end-of-text guard, so speech tokens are capped at a slow reading
   of the text (25 tokens a second, 0.1 s a character plus 1.5 s).
2. **Trim and master** ([master.py](master.py)): ttsctl's lead-in, garbage-tail
   detection and length cap, then ttsctl's chain, `volume` (to -18 LUFS) →
   `highpass` 80 Hz → `adeclick` → `afftdn` → `agate` → `acompressor` →
   `alimiter`, written as 44.1 kHz mono 16-bit PCM. There is no final loudness
   pass: the kit brings every take to -23.6 LUFS itself (`even` in
   [../audio.ts](../audio.ts)).
3. **Align** ([align.py](align.py)): forced alignment of the script's words with
   `facebook/mms-1b-all` (English adapter), as ttsctl does.
4. **Find the speech** ([quality.py](quality.py)). The take starts at the first
   word's own onset, found in the audio (the aligner puts a word's start at its
   vowel, after a leading "T" or "B"), with a 20 ms fade inside the silence
   before it. It ends where the last word's sound ends, at most 0.35 s after
   its aligned end, and never later than the word could last (0.2 s plus 0.11 s
   a letter): Chatterbox V3 often keeps making a low drone after its last
   word, and the aligner stretches the last word over it. A seeded -72 dBFS
   room tone keeps the take free of exact digital silence.
5. **Report what is no word** ([quality.py](quality.py) `noises`): a sound in a
   pause that is quieter than speech (a breath, a drone; louder is a word the
   aligner placed badly, which the transcript check judges), sound after the
   last word has decayed, or a word stretched past its length. The kit treats
   each as a fault of the take and makes it again.
6. **Best of `n`** ([score.py](score.py)): with `n` > 1 the service makes `n`
   candidates (seed `seed + 7919 j`, retry stage `stage + j`) and answers the
   best: a word Whisper hears wrong or a reported noise loses first, then
   UTMOS22 naturalness (tarepan/SpeechMOS), likeness to the reference (the
   Chatterbox voice encoder) and pace decide. The kit asks for 3
   (`FILM_SPARK_CANDIDATES`). Chatterbox takes no neighbouring text, so a line
   gets no prosody context from the lines around it.

The kit then runs its usual checks on the take: the transcript against the
script, held letters, take tail, clipping and stray sounds. For a house take
the transcript comes from Whisper large-v3-turbo on the Spark (`POST /hear`)
instead of ElevenLabs Scribe, so house voicing spends no ElevenLabs credits at
all; the kit does not need `ELEVEN_LABS_API_KEY` for a film voiced only by
house voices. Takes are cached in
`FILM_VOICES` like ElevenLabs takes, keyed by provider, model, voice, text and
the service recipe (`p2n3`: processing version 2, three candidates), with the
seed of each try, its faults and its candidates' measurements in the file.

## House voices

| Kit name | Speaker kinds | Service voice | Reference |
|---|---|---|---|
| Ellis | teacher, narrator | `ellis` | `~/voice-lab/refs/house/ellis.wav` |
| Hazel | teacher, narrator | `hazel` | `~/voice-lab/refs/house/hazel.wav` |
| Remy | learner | `remy` | `~/voice-lab/refs/house/remy.wav` |
| Rowan, Wren, Pip | retired (round 1) | `rowan`, `wren`, `pip` | `~/voice-lab/refs/house/` |

Round 2 (2026-11-18) replaced round 1 after the founder's review: plainer
briefs ("not a narrator, not dramatic"; a child "not high and not squeaky"),
23-30 s design samples, and the choice of 5 candidates per role by
measurement on the same excerpt: no wrong words or noises first, then UTMOS22
and likeness to the reference. On those lines Ellis scored UTMOS 4.36 and
Hazel 4.17 against ElevenLabs Paul's 4.25; Remy 3.57 against Champ's 3.03.
Retired voices still play and publish editions that recorded them; the kit
never picks them.

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
export FILM_SPARK_VOICE_URL=http://<spark IPv4 address>:18093   # the address the service binds; a .local name may resolve to IPv6 and be refused
npx tsx film/make.ts list-all-pairs--sl --voice teacher=ellis --voice learner=remy --check
npx tsx film/make.ts <film-id> --provider spark --check    # every speaker in house voices
```

`--voice teacher=ellis` re-voices one speaker; `--provider spark` gives every
speaker no `--voice` names a house voice (teachers are hashed over Ellis and
Hazel by film ID, as Madeline and Paul are). The edition records `house-ellis`
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
