# Voice test

This measures the speech model the app bundles on crane questions, in crane noise. It is how the model in `../src-tauri/voice-model.json` was chosen, and the numbers are in the PR that chose it.

| File | What |
|---|---|
| `items.json` | 40 spoken items: 36 crane questions full of the terms that matter (kV, outriggers, LMI, rated capacity, wire rope terms, section numbers spoken as "fourteen oh eight"), plus the four procedure words. Each item has the transcript we expect and the key terms, as regular expressions. |
| `prompt.txt` | The vocabulary prompt (whisper `initial_prompt`). The app sends exactly this (`src/voice/prompt.ts`, checked by `voice.test.ts`). |
| `gen-speech.sh` | Speaks every item with six macOS voices (US, UK, Australian, Indian and Scottish English; women and men), as 16 kHz mono WAV. That gives 240 clips. |
| `mix-noise.py` | Adds a running crane (diesel firing harmonics with throttle wobble, rumble, hydraulic whine) at 10 dB and 5 dB SNR, with half a second of noise before and after, as a push-to-talk recording has. |
| `run-eval.py` | Runs whisper.cpp v1.8.4 (the plugin's version) the way the plugin does: greedy, 4 threads, English, no context between calls. It reports key-term accuracy, word error rate, procedure-word accuracy and latency. |
| `summarize.py` | Turns the results into the table in the PR. |

## Run it

macOS generates the speech. The runs go on a Linux box with whisper.cpp built (no models on the Mac).

```sh
voice-eval/gen-speech.sh /tmp/voice                              # macOS
python3 -I voice-eval/mix-noise.py /tmp/voice/clean /tmp/voice 10 5
python3 -I voice-eval/run-eval.py --cli whisper.cpp/build/bin/whisper-cli \
  --models models --audio /tmp/voice --out results.json \
  --model ggml-base.en-q5_1.bin --conditions clean snr10 snr5
python3 -I voice-eval/summarize.py results.json
```

Models come from `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/<file>`.

## What it does not measure

- **Real voices.** These are synthesized voices, not people at a crane. They are cleaner and more regular than a tired operator on a radio-noisy site, so accuracy here is an upper bound.
- **Phone latency.** Latency is measured on a desktop-class ARM CPU limited to 4 threads. A mid-range phone is slower; see the PR for the measured margin.
- **The microphone.** There is no real microphone, gain control or wind noise. The first device test with people in gloves, outdoors, is still to be done.
