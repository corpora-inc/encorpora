---
title: "AI This Week — June 14, 2026 — Sundays, and Who We Are"
date: 2026-06-14
hosts:
  - id: vindy
    role: host
  - id: ron
    role: analyst
notes: |
  Episode 5. One sentence per dialog turn (HOST or ANALYST block).
  When Ron has a multi-sentence thought, that's multiple consecutive
  ANALYST segments.

  Manuscript uses DISPLAY form (numerals, dashes, slashes natural).
  phonetics.spell_out() produces the spelled-out tts.text at generate
  time. See scripts/phonetics.py.

  Editorial voice (Ep 5): SPECIAL EPISODE. We move to Sundays, and for
  the first time on-mic we say who makes the show — Corpora Inc., the
  small independent team behind the Corpán app. NO absolute marketing
  claims allowed: "on-device-first" not "fully on-device"; "ad-free
  today, working to stay that way" not "no ads ever"; "generous free
  tier" not "free forever"; "no billion dollars of capital" not "no
  investors." See ~/.claude/projects/-home-skyl/memory/feedback_no_absolutes_in_marketing.md.

  Spine: schedule move to Sundays (Wednesday cuts didn't land), Corpora
  reveal (on-device-first stack — Qwen3-4B + Whisper large-v3 + Chatterbox
  + SD3.5 + LoRA — small team, no big capital), top story is beatlounge
  launching in Corpán 0.18.0 — a sequencer where the samples are sentences.
  Open weights: DiffusionGemma (Apache 2.0, diffusion text LM), dots.tts
  (Apache 2.0, RedNote / Chinese social-network research lab), Higgs Audio
  v3 (102 langs, non-commercial), Nemotron 3 Ultra (550B + training recipes
  under OpenMDW). Headlines: Kimi K2.7-Code with benchmark skepticism,
  Cohere shipped real Apache 2.0 North Mini Code, Apple WWDC on-device
  pitch with Gemini-distillation footnote, Qwen 3.7-Plus API-only. Small
  lab: Kog, 11 people in Paris, contrarian AMD inference bet. Hardware:
  Raspberry Pi AI HAT+ 2, Jetson Orin Nano Super. Concept: diffusion vs
  autoregressive — the trick under DiffusionGemma's throughput.
---

**HOST:** Welcome to AI This Week.

**HOST:** I am Vindy.

**HOST:** With me, as always, is Ron.

**ANALYST:** Good to be here, Vindy.

**HOST:** Today is Sunday, June 14, 2026.

**HOST:** Two things are different about today.

**HOST:** We are moving to Sundays, and for the first time we are going to tell you who actually makes this show.

**HOST:** Then back to the regular programming — open weights, small labs, and the wider AI week.

**HOST:** Coming up — the schedule move and why.

**HOST:** A first look at Corpora Inc., the small team behind the Corpán app and this podcast.

**HOST:** A top story on beatlounge, our new music pack launching in Corpán 0.18.0.

**HOST:** Open weights of the week, led by Google's first open diffusion text model.

**HOST:** A fast clip of headlines through the open-ecosystem lens.

**HOST:** A small lab of the week — eleven people in Paris making a contrarian bet on AMD silicon.

**HOST:** And our concept of the week — diffusion versus autoregressive, the trick behind this week's lead release.

**HOST:** Ron, let's start with the schedule.

**HOST:** Why are we moving off Wednesdays?

**ANALYST:** Wednesday was Odin's day, and Odin was busy ruling Asgard.

**ANALYST:** We are a small team with day jobs, and a midweek cut never really landed clean.

**ANALYST:** Sundays end the week and start the next, which felt like the right rhythm for a news show.

**HOST:** What does the rollout actually look like?

**ANALYST:** It starts Saturday in English and rolls through Monday morning, language by language, as each translation and audio pass finishes.

**ANALYST:** By Monday coffee, we should be near fifty languages.

**HOST:** Which brings us to the second new thing.

**HOST:** Who makes this show.

**ANALYST:** Corpora Inc., a small independent team, builds the Corpán app and produces this podcast.

**HOST:** What is Corpán.

**ANALYST:** A language, music, and learning playground built on-device-first.

**HOST:** Unpack on-device-first — what does that mean in practice.

**ANALYST:** It means we prioritize running locally whenever the feature allows.

**ANALYST:** Qwen3-4B for the assistant, Whisper large-v3 for speech recognition, Chatterbox for voice synthesis, Stable Diffusion three-and-a-half for images, LoRA pipelines for character tutors.

**ANALYST:** All of that runs on your phone or tablet, offline, in airplane mode, in the middle of nowhere.

**ANALYST:** Features that genuinely need the network — world radio, multiplayer — use the network, and we don't pretend otherwise.

**HOST:** And the business side.

**ANALYST:** Lean independent team, no billion dollars of capital behind us, ad-free in the app today, with a generous free tier and an optional premium subscription for people who want to support the work.

**ANALYST:** We would like to stay ad-free as long as we can — no promises forever, but that is the direction.

**HOST:** What is the proof you actually ship.

**ANALYST:** Most weeks we ship something — a book narration, a pack, an app release, this show — across thirty-five-plus languages today, and climbing.

**HOST:** Why do this at all.

**ANALYST:** That is the pitch — proving a frontier-quality, on-device-first, multilingual learning experience can come from a small team without big capital, while keeping the app ad-free as long as we can.

**HOST:** Which brings us to the top story — beatlounge.

**HOST:** It launches in Corpán 0.18.0 this week.

**ANALYST:** beatlounge is a beat sequencer and a language tool in one box.

**ANALYST:** A tick-addressed sequencer at nine hundred sixty pulses per quarter, a harmony engine that speaks Western modes, Indian thaats, Carnatic melakartas, and Arabic maqamat, and a phrase corpus of more than ten million real language phrases across over fifty languages.

**ANALYST:** All pitch-performable, and playable offline once the pack is on your device.

**HOST:** So the instrument is the language.

**ANALYST:** You play phrases the way you would play notes.

**ANALYST:** A Hindi phrase on beat one, an Arabic interjection on the back of two, a Mandarin syllable as a ribbon swell.

**ANALYST:** It is a DAW where the samples are sentences, voiced by on-device TTS.

**HOST:** No music theory required.

**ANALYST:** None.

**ANALYST:** The harmony engine handles the rules; you point at sounds you like and the modes stay clean.

**HOST:** What else is in 0.18.0.

**ANALYST:** Three engineering pieces under the hood — host seams for content packs went live with beatlounge as the pilot.

**ANALYST:** Android now captures native-fault breadcrumbs so llama and ggml crashes get properly diagnosed.

**ANALYST:** And we fixed the multi-gigabyte model install that used to OOM iOS — now it streams to disk instead of buffering two-and-a-half gigabytes of Qwen3-4B in RAM.

**HOST:** Boring underneath, fun on top.

**ANALYST:** Which is roughly the whole company brief.

**HOST:** Okay, let's move to open weights.

**HOST:** What was the big one this week.

**ANALYST:** Google shipped DiffusionGemma.

**ANALYST:** A twenty-six billion parameter mixture of experts with three point eight billion active, Apache 2.0 on Hugging Face, that generates text by diffusion instead of autoregression.

**HOST:** Plain-language — what does diffusion-for-text actually mean.

**ANALYST:** Instead of predicting one token at a time, it denoises a two hundred fifty six token block in parallel.

**ANALYST:** Over a thousand tokens a second on a single H100, roughly four times faster than the comparable autoregressive Gemma.

**HOST:** And the catch.

**ANALYST:** Lower scores on MMLU and coding — Google says it themselves; this release is for speed-critical work, not leaderboard climbing.

**HOST:** And open voice models — anything.

**ANALYST:** Two dropped in the same week.

**ANALYST:** RedNote, the Chinese social network, open-sourced dots-dot-tts — two billion parameters, fully continuous with no discrete tokens anywhere in the pipeline, fifty-four millisecond first-token latency, Apache 2.0.

**ANALYST:** And Boson AI shipped Higgs Audio version three — four billion parameters, one hundred and two languages, twenty-one emotion control tokens, streaming output, non-commercial license; that last part is the asterisk.

**HOST:** Voice cloning is officially a commodity.

**ANALYST:** It is.

**HOST:** One more on the open side.

**ANALYST:** NVIDIA quietly released Nemotron 3 Ultra — a five hundred fifty billion parameter hybrid Mamba-attention model.

**ANALYST:** Weights and the full training recipe under the Linux Foundation OpenMDW license — the most actually-open release of the month.

**HOST:** And nobody covered it.

**ANALYST:** Because we file NVIDIA under silicon, not lab.

**ANALYST:** But this week they shipped reproducible-open at frontier scale.

**HOST:** Headlines, fast clip.

**HOST:** First.

**ANALYST:** Moonshot released Kimi K2-point-seven-Code — one trillion parameters, thirty-two billion active, claims to beat Claude Opus 4.8 on Moonshot's own benchmark.

**ANALYST:** Practitioners ran the numbers and say the benchmarks don't check out; the self-hosted weights are five hundred ninety-five gigabytes, thinking mode can't be turned off.

**ANALYST:** Open is doing a lot of work in that sentence.

**HOST:** Second.

**ANALYST:** Cohere, a Western lab that almost never releases weights, actually released weights — North Mini Code, thirty billion total, three billion active, Apache 2.0, runs on a single H100 at four-bit.

**ANALYST:** A Western lab shipping real Apache 2.0 in 2026 is news on its own.

**HOST:** Third.

**ANALYST:** Apple leaned hard at WWDC on on-device AI as the strategic story.

**ANALYST:** But the new Siri model is reportedly a distillation of Google's Gemini that Apple licenses and shrinks.

**ANALYST:** Local inference, complicated supply chain.

**HOST:** And fourth.

**ANALYST:** Alibaba pushed Qwen 3.7-Plus to general availability — multimodal, drives GUIs from screenshots, around forty cents per million input tokens.

**ANALYST:** Despite the Qwen brand, this one is API-only, not open weights.

**ANALYST:** Worth knowing, because listeners conflate Qwen with open; this one is not.

**HOST:** Small lab of the week.

**ANALYST:** Kog.

**ANALYST:** Eleven people in Paris, claiming three thousand output tokens per second per request on eight AMD MI300X GPUs.

**ANALYST:** Their pitch — the industry overspent on custom inference silicon when the bottleneck was software all along.

**HOST:** Eleven people, and AMD instead of NVIDIA.

**ANALYST:** Right after a custom-silicon IPO, perfect contrarian timing.

**HOST:** What about hardware on the bench.

**ANALYST:** Raspberry Pi shipped the AI HAT+ 2 — forty TOPS bolted onto a Pi 5.

**ANALYST:** NVIDIA's Jetson Orin Nano Super does sixty-seven TOPS for under three hundred dollars.

**HOST:** On-device used to mean a Mac.

**ANALYST:** Now it means a board you can hide in a drawer.

**HOST:** Concept of the week — diffusion versus autoregressive.

**ANALYST:** Same destination, different routes.

**ANALYST:** Autoregressive models, most of the LLMs you know, generate one token at a time, condition on it, generate the next, repeat — sequential by design.

**ANALYST:** Diffusion models start with a block of pure noise and denoise it all at once over a fixed number of steps.

**ANALYST:** You trade some quality for parallelism, and at small step counts you get those eye-popping throughput numbers.

**HOST:** So DiffusionGemma is the first time we have open weights to actually feel the difference.

**ANALYST:** First time at this scale, yes.

**ANALYST:** And that is why the open-source inference teams matter this week — llama-dot-cpp, vLLM, MLX — they are who will learn to make it sing on real hardware.

**HOST:** Good place to land.

**HOST:** Ron, thank you.

**ANALYST:** Anytime, Vindy.

**HOST:** That was AI This Week for June 14, 2026.

**HOST:** Same scrappy show, new Sunday slot.

**HOST:** Languages will keep dropping through Monday morning; Corpán 0.18.0 is wherever you get apps — try beatlounge.

**HOST:** Until next Sunday, take care.
