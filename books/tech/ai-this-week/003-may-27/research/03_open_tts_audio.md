# AI This Week — Episode 3 (drops Wed 2026-05-27)
## Open / Indie TTS, Voice Cloning & Audio AI — Window: 2026-05-21 → 2026-05-27
Compiled 2026-05-29 (Fri). Editorial lean: open-weights / on-device / indie audio. This is the podcast's home beat — likely Top Story.

> **Headline reality check:** The window itself (May 21–27) was QUIET for *open* TTS — no shipped open-weights TTS release found dated inside it. The real story is the 2026 landscape, which is best framed as context for a Top Story deep dive. All major open TTS drops this year landed Jan–April. See NEGATIVE FINDINGS.

---

## SHIPPED THIS WEEK (2026-05-21 → 2026-05-27)

**Nothing open-weights and downloadable confirmed dated inside the window.** Closest items below are either just-before-window or closed/product news. Treat as "quiet week" honestly.

### (Adjacent, closed) OpenAI realtime voice trio — NOT in window, NOT open
- **Date:** 2026-05-07 (two weeks BEFORE window — was last episode's news). Some aggregators mis-dated it "May 21"; primary source is May 7.
- **What:** GPT-Realtime-2 (GPT-5-class reasoning voice), GPT-Realtime-Translate (70+ in → 13 out langs), GPT-Realtime-Whisper (streaming STT). API-only, closed weights. Translate $0.034/min, Whisper $0.017/min.
- **Why it matters (builder angle):** Sets the closed-API bar our open stack is measured against. NOT runnable on-device, NOT free. Useful only as the foil: "this is what you rent; here's what you can own."
- **Status:** context-from-earlier (closed)
- **Source:** https://openai.com/index/advancing-voice-intelligence-with-new-models-in-the-api/
- **Source:** https://techcrunch.com/2026/05/07/openai-launches-new-voice-intelligence-features-in-its-api/

### (Adjacent, product) Resemble AI — DramaBox TTS
- **Date:** "May 2026" per vendor pages (no precise day confirmed; could not pin inside window). Treat as month-level, low-confidence date.
- **What:** Expressive multi-character TTS aimed at serialized short-video; longer audio context, finer emotion params. This is a hosted Resemble *product*, distinct from the open Chatterbox weights.
- **Why it matters:** Resemble (the lab behind our production engine Chatterbox) is monetizing closed products on top of the open base — watch for whether multi-speaker ever lands in open Chatterbox.
- **Status:** context / unverified-date — do NOT assert as in-window on air.
- **Source:** https://www.resemble.ai/chatterbox/

---

## STATE OF OPEN TTS (context — Top Story spine)

The open TTS field exploded in the first half of 2026. Ordered roughly by builder relevance:

### Chatterbox-Turbo (Resemble AI) — our production lineage
- **Date:** 2026-03-26. (Base multilingual Chatterbox = 23 langs, MIT; the v0.1.2 GitHub tag is old June 2025 — Turbo ships via HF, not a GH release.)
- **What:** 350M-param distilled architecture; 10-step→1-step mel decoder (big speed/VRAM win); native paralinguistic tags ([cough],[laugh],[chuckle]). Vendor blind test: 65.3% preferred Turbo vs 24.5% ElevenLabs (vendor-run — grain of salt).
- **License:** MIT (open weights).
- **Why it matters:** This is OUR engine's lineage. Turbo's 1-step decoder is the on-device story — less compute for the same 23-lang MIT coverage. Directly relevant to the pipeline running this podcast.
- **Source:** https://www.resemble.ai/chatterbox-turbo/  •  https://huggingface.co/ResembleAI/chatterbox-turbo

### OmniVoice (k2-fsa / Daniel Povey's group) — the breadth play
- **Date:** First release early April 2026; latest GitHub release **0.1.5 on 2026-04-28**. Repo had active issues/commits ~May 15–21 (maintenance, not a release).
- **What:** Diffusion-LM-style zero-shot TTS, **600+ languages**, voice cloning + attribute control (gender/age/pitch/accent/whisper). RTF as low as 0.025 (~40× real-time). ~460k HF downloads in 3 weeks.
- **License:** Apache 2.0.
- **Why it matters (language-learning angle):** Broadest open language coverage on earth — far past Chatterbox's 23. Huge for long-tail / low-resource langs an on-device app wants. Caveat: 600-lang *coverage* ≠ 600-lang *quality*; needs ear-test per lang before trusting it over Gemini for our tail langs.
- **Source:** https://github.com/k2-fsa/OmniVoice  •  https://huggingface.co/k2-fsa/OmniVoice

### VoxCPM2 (OpenBMB) — tokenizer-free, studio quality
- **Date:** v2.0.0 **2026-04-06**; latest v2.0.3 **2026-05-11** (fine-tuning/streaming fixes — before window).
- **What:** 2B params on MiniCPM-4 backbone, tokenizer-free, **30 languages**, 48kHz output, voice design + controllable cloning, LoRA fine-tuning. Beats ElevenLabs on speaker *similarity* in one benchmark (but loses on the full benchmark — be skeptical).
- **License:** Apache 2.0.
- **Why it matters:** 48kHz + LoRA finetune + Apache-2.0 = the most "productizable" mid-size open model. The honest benchmark caveat is a good on-air skepticism beat.
- **Source:** https://github.com/OpenBMB/VoxCPM  •  https://huggingface.co/openbmb/VoxCPM2

### MOSS-TTS-Nano (OpenMOSS / MOSI.AI) — the CPU-only flex
- **Date:** **2026-04-10**; ONNX CPU build **2026-04-17**.
- **What:** 0.1B params, **runs on CPU with no GPU** (streams on 4 cores; ONNX runs on a single core on a MacBook Air M4). 20 languages, 48kHz, multilingual voice cloning.
- **License:** open-source (Apache-family per repo).
- **Why it matters (on-device angle):** This is the purest "ship it to a phone" story of 2026 — no GPU at all. Direct relevance to a Tauri on-device app. Quality vs Chatterbox is the open question to ear-test.
- **Source:** https://github.com/OpenMOSS/MOSS-TTS-Nano  •  https://huggingface.co/OpenMOSS-Team/MOSS-TTS-Nano-100M

### Mistral Voxtral TTS — the license trap
- **Date:** **2026-03-26**.
- **What:** 4B streaming TTS, 9 langs, <5s voice clone, runs on consumer hardware. Vendor: preferred 68.4% vs ElevenLabs Flash v2.5 in zero-shot cloning.
- **License:** **CC BY-NC 4.0 — NON-COMMERCIAL.** Open weights, but you cannot drop it into a paid product without a Mistral deal.
- **Why it matters:** The cautionary tale. "Open weights" ≠ "usable in product." For a millions-of-users app this is a non-starter without licensing — exactly the gotcha builders miss.
- **Source:** https://mistral.ai/news/voxtral-tts/  •  https://techcrunch.com/2026/03/26/mistral-releases-a-new-open-source-model-for-speech-generation/

### Qwen3-TTS (Alibaba) — the big-lab open entry
- **Date:** open-sourced **2026-01-21/22**.
- **What:** 3s voice clone, 10+ langs, real-time streaming (~97ms latency claimed), trained on 5M+ hrs.
- **License:** Apache 2.0.
- **Why it matters:** Notable that Qwen open-sourced TTS while going *closed* on its 3.7 flagship LLM (see 01_model_releases.md). Audio stayed open; text didn't.
- **Source:** https://simonwillison.net/2026/Jan/22/qwen3-tts/  •  https://www.marktechpost.com/2026/01/22/...

### Carryover staples (still the workhorses, all pre-2026)
- **F5-TTS** — flow-matching, well-rounded quality/control. (2024 lineage; still a top pick.)
- **Kokoro-82M** — sub-0.3s, Apache 2.0, tiny + fast; the speed king.
- **Fish Speech V1.5** — Apache 2.0, 8 langs, MOS ~4.1; the practical commercial-cloning pick.
- **IndexTTS-2** — open-sourced **2025-09-08**, Apache 2.0; first AR zero-shot TTS with millisecond *duration control* + emotion control. Relevant to alignment/sync work.
- **NeuTTS Air (Neuphonic)** — released **Oct 2025**, Apache 2.0, 0.5B on-device LLM-backbone, 3s clone. The original "on-device" poster child before MOSS-Nano.
- **XTTS-v2 (Coqui lineage)** — 6s clone, still widely deployed.
- Sources: https://www.bentoml.com/blog/exploring-the-world-of-open-source-text-to-speech-models  •  https://index-tts2.org/  •  https://github.com/neuphonic/neutts

---

## ASR & ALIGNMENT (for the TTS pipeline)

### Moonshine v2 (Useful Sensors) — edge ASR
- **Date:** announced **Feb 2026** (lineup v0.0.49). arXiv "Moonshine v2: Ergodic Streaming Encoder ASR" (arXiv:2602.12241).
- **What:** Open-weights STT beating Whisper Large-v3 accuracy at far fewer params. Smallest model 27MB; English Tiny 26MB @ 12.66% WER up to Medium Streaming 245MB @ 6.65% WER. Built for Raspberry Pi / mobile.
- **Why it matters:** Edge ASR for live captioning / on-device align. Wins on *latency*; English-centric vs Whisper's 99 langs.
- **Source:** https://github.com/moonshine-ai/moonshine  •  https://arxiv.org/html/2602.12241v1

### NVIDIA Parakeet — bulk-transcription accuracy leader
- **What:** GPU ASR, sub-5% WER, tops HF OpenASR leaderboard; "1 hr of audio in 19s." Wins bulk-cloud; loses to Moonshine on live-edge.
- **Why it matters:** If you batch-transcribe a corpus for alignment QA, Parakeet is the speed/accuracy pick. Not edge-friendly (GPU).
- **Source:** https://www.gladia.io/blog/best-open-source-speech-to-text-models

### Forced alignment — MFA still wins on precision
- **What:** Comparative work (arXiv:2406.19363) confirms **Montreal Forced Aligner (Kaldi-based) beats WhisperX and MMS** at tight tolerances (≤10ms). WhisperX is 12× faster but only ~52.7% word-accuracy @ 20ms on TIMIT.
- **New:** "BFA: Real-Time Multilingual TTS Forced Alignment" (arXiv:2509.23147, Sept 2025) — a real-time multilingual aligner aimed exactly at TTS pipelines.
- **Why it matters (our pipeline):** Validates our memory note that free-form Whisper onset is unreliable; MFA-grade precision matters for word-level reader sync. BFA worth evaluating as a faster multilingual alternative.
- **Source:** https://arxiv.org/pdf/2406.19363  •  https://arxiv.org/html/2509.23147v1

---

## CODECS & AUDIO

No notable in-window codec release found. Standing landscape (all pre-window context):
- **Mimi (Kyutai)** — open-source, 24kHz → 1.1 kbps @ 12.5 fps, 8 quantizers, fully causal, 80ms latency. Powers speech-LLMs (Moshi-lineage). The codec under most modern streaming speech models.
- **SNAC** — multi-scale RVQ, sub-1 kbps with quality near reference; weights open (github.com/hubertsiuzdak/snac). Powers Orpheus.
- **DAC (Descript)** — RVQGAN + multi-scale mel loss; the durable general-purpose pick.
- **Why it matters:** Codec choice = the latency/bitrate floor for any streaming on-device TTS. Mimi/SNAC are what new open speech LLMs build on.
- **Source:** https://huggingface.co/kyutai/mimi  •  https://github.com/hubertsiuzdak/snac

---

## LICENSE NOTES (the builder's minefield)
- **MIT:** Chatterbox / Chatterbox-Turbo (our engine). Cleanest for product.
- **Apache 2.0:** OmniVoice, VoxCPM2, Qwen3-TTS, Kokoro, Fish Speech, IndexTTS-2, NeuTTS Air, MOSS-TTS-Nano. Commercial-safe.
- **CC BY-NC 4.0 (NON-COMMERCIAL):** **Mistral Voxtral TTS** — open weights you legally cannot ship in a paid app. The trap.
- **Closed/API-only:** OpenAI realtime trio, Resemble DramaBox, ElevenLabs. Rent, don't own.
- **Takeaway for on-device app:** MIT + Apache models only. Voxtral's quality is tempting but the license disqualifies it for a millions-of-users product.

---

## NEGATIVE FINDINGS (what did NOT ship / be skeptical of)
- **No open-weights TTS release dated inside 2026-05-21 → 2026-05-27.** The window is genuinely quiet for our beat — every major 2026 open TTS drop (Voxtral, OmniVoice, VoxCPM2, MOSS-Nano, Chatterbox-Turbo, Qwen3-TTS) is Jan–Apr. Report this honestly; do not inflate maintenance commits into "releases."
- **OmniVoice "May 19 update"** = repo activity / issues, NOT a versioned release (latest release 0.1.5 = Apr 28). Don't call it a launch.
- **VoxCPM2 v2.0.3 (May 11)** = bugfix, before window.
- **OpenAI voice trio** = May 7 (prior episode), closed. Some blogs mis-dated to May 21 — primary source corrects this.
- **DramaBox TTS** date is month-level ("May 2026"), unverified to a day; do NOT assert in-window on air.
- **"Beats ElevenLabs" claims** (Chatterbox 65.3%, Voxtral 68.4%, VoxCPM2 similarity) are all VENDOR-RUN blind tests. VoxCPM2 reportedly *loses* on the full benchmark despite winning similarity. State as vendor claims, not facts.
- **600 langs (OmniVoice)** = coverage breadth, not per-lang quality parity. Unverified for our tail langs without ear-test.
- No new Whisper-successor from OpenAI open-weights this window. No Sesame/CSM, Zonos, Parler-TTS, Orpheus, MeloTTS, or Piper release found in-window.

---

## EDITORIAL TAKE (one-liner)
"The window was quiet for open voice — which is the perfect excuse to step back: 2026 quietly became the year open TTS got *good enough to own*, with Chatterbox-Turbo (MIT, 1-step decoder), OmniVoice (600 langs, Apache), and MOSS-TTS-Nano (runs on a CPU with no GPU) — while Mistral's Voxtral is the cautionary 'open weights you can't actually ship' footnote; the question isn't whether you can run a great voice on-device anymore, it's which license lets you keep it."
