---
title: "AI This Week — May 27, 2026 — The Most-Used Model on Earth"
date: 2026-05-27
hosts:
  - id: vindy
    role: host
  - id: ron
    role: analyst
notes: |
  Episode 3. One sentence per dialog turn (HOST or ANALYST block).
  When Ron has a multi-sentence thought, that's multiple consecutive
  ANALYST segments. Ron going several segments in a row is expected.

  Manuscript uses DISPLAY form (numerals natural). phonetics.spell_out()
  produces the spelled-out tts.text at generate time.

  Editorial voice for Ep 3 (per user): the inside scoop on the OPEN
  world only — open weights, open multimodal, open/indie TTS, inference
  infra, quantization, on-device. NO big-lab product pitches. A big lab
  appears only when it's genuinely DIY-practical (a weights drop, an
  open-sourced tool, a price that changes what you can self-host) or as
  a one-line contrast. Headlines is open/DIY-practical, not a keynote
  recap.

  Spine: a quiet release week where the real news is usage and
  ownership — the most-used model on Earth is an open MIT-licensed
  Chinese MoE, the chip war is why, and 2026 quietly became the year
  open text-to-speech got good enough to own. Top Story is open TTS,
  the engine room of this very show.
---

**HOST:** Welcome to AI This Week.

**HOST:** I am Vindy.

**HOST:** With me, as always, is Ron.

**ANALYST:** Good to be here, Vindy.

**HOST:** Today is Wednesday, May 27, 2026.

**HOST:** And on paper, this was a quiet week.

**HOST:** No big new open model dropped.

**HOST:** But quiet weeks are where the real story hides.

**HOST:** So today we go where the keynotes don't.

**HOST:** Coming up — what actually moved in open weights.

**HOST:** The one leaderboard that matters, and it is not a quality board.

**HOST:** A fast clip of headlines you can act on this weekend.

**HOST:** Our top story, the year open voice got good enough to own.

**HOST:** And the concept of the week is neural audio codecs — how you squeeze a whole voice down to fit on a phone.

**HOST:** Ron, let's start in the open-weights world.

**HOST:** What moved this week?

**ANALYST:** Honestly, no new frontier open model shipped this week.

**ANALYST:** And that is fine.

**ANALYST:** The real open news this week was plumbing and pricing.

**HOST:** Plumbing first — what broke or got fixed?

**ANALYST:** On May 26, the SGLang project shipped a stability patch for serving DeepSeek V4.

**ANALYST:** SGLang is one of the two big open engines you use to actually run a model yourself.

**ANALYST:** The other one is vLLM.

**ANALYST:** This patch fixed garbled output on the newest cards and a crash under heavy load.

**HOST:** Why does a serving patch matter?

**ANALYST:** Because open weights are useless if you cannot serve them reliably.

**ANALYST:** DeepSeek V4 is open and MIT-licensed, but it is a huge model.

**ANALYST:** The engines that make it run in the wild are the unglamorous half of the open ecosystem.

**ANALYST:** A boring patch week is what a healthy project looks like.

**HOST:** And the pricing side?

**ANALYST:** This is the more interesting one.

**ANALYST:** Around May 22, DeepSeek made its 75% price cut on V4-Pro permanent.

**ANALYST:** The output price is now about $0.87 per million tokens.

**ANALYST:** That is roughly a quarter of what it launched at.

**HOST:** So the open model got cheaper to rent.

**ANALYST:** Right, and that flips a question on its head.

**ANALYST:** We usually say open weights means you self-host.

**ANALYST:** But at under a dollar per million tokens on tap, renting is often cheaper than your own electricity.

**ANALYST:** So the new framing is — self-host for privacy and offline, rent the API for cheap bursts.

**ANALYST:** Same open weights, two very different reasons to use them.

**HOST:** What about the on-device crowd?

**ANALYST:** llama.cpp kept doing its thing all week.

**ANALYST:** It does not really do releases — it ships builds almost every day.

**ANALYST:** This week was speed work on Vulkan, Intel, and phone-class chips.

**ANALYST:** That is the engine the on-device world actually runs on.

**ANALYST:** No drama, just faster — exactly what you want from mature plumbing.

**HOST:** Set the bigger scene for us.

**ANALYST:** The open frontier right now is mostly Chinese-led.

**ANALYST:** Back in April there was a wave — DeepSeek V4, Qwen 3.6, Kimi K2.6, and more, all in about two weeks.

**ANALYST:** This week is the quiet aftermath of that wave.

**HOST:** And Qwen — didn't they have news?

**ANALYST:** Yeah, and it is a telling one.

**ANALYST:** Alibaba's new flagship, Qwen 3.7 Max, is API-only — no open weights.

**ANALYST:** The open Qwen line still stops at 3.6.

**ANALYST:** So Alibaba is splitting into a closed flagship and an open mid-tier.

**ANALYST:** That is the same playbook Mistral ran last year.

**HOST:** Worth watching, then.

**ANALYST:** The open shoe to drop is an open Qwen 3.7 mid-tier.

**ANALYST:** As of this week, nothing is on Hugging Face yet.

**HOST:** Okay, let's get to the leaderboards.

**HOST:** Where did things land this week?

**ANALYST:** Here is the headline, and it is a strange one.

**ANALYST:** The leaderboard that moved this week is not a quality board.

**ANALYST:** It is OpenRouter's usage meter — actual model calls, not opinions.

**HOST:** What does the usage meter say?

**ANALYST:** For the week of May 18 to 24, the single most-used model on Earth was DeepSeek V4-Flash.

**ANALYST:** It served about 3.43 trillion tokens in one week.

**ANALYST:** And it is open weights, MIT-licensed, something you can download and self-host.

**HOST:** The most-used model is open?

**ANALYST:** At the top of the usage chart, yes.

**ANALYST:** And it is not close.

**ANALYST:** Chinese models pulled about 9.2 trillion tokens that week, against about 4.9 trillion for American models.

**ANALYST:** That is the fourth straight week Chinese open models led global usage.

**HOST:** That is a real inversion.

**ANALYST:** It is — on the metric builders actually feel, what is running in production, open is winning at the top.

**HOST:** But be honest about usage charts.

**ANALYST:** Good instinct, and there is a perfect cautionary tale this week.

**ANALYST:** Another model, Tencent's Hy3, shot up the same usage chart.

**ANALYST:** The analyst Max Woolf pulled it apart on May 26.

**HOST:** What did he find?

**ANALYST:** It looks cheap per token, but it has very high cache-read costs.

**ANALYST:** Once you count those, it is nearly double DeepSeek's true price.

**ANALYST:** And the spike looks like one giant app, not broad love.

**ANALYST:** So a usage board tells you who is spending, not what is good.

**HOST:** Trending is not the same as best.

**ANALYST:** That is exactly the lesson to carry.

**HOST:** What about the quality boards?

**ANALYST:** On the hardest boards, closed models still lead.

**ANALYST:** The top of the chat-quality and agent-terminal boards is all closed right now.

**ANALYST:** But on SWE-bench Verified, the coding test, open is basically at parity.

**ANALYST:** Trackers put the best open models around 80%.

**HOST:** Which open models?

**ANALYST:** Kimi K2.6 and MiniMax, with DeepSeek's biggest model claiming similar.

**ANALYST:** I will say claiming, because the trackers disagree with each other.

**ANALYST:** Treat any single benchmark number as a claim, not a fact.

**HOST:** Speaking of which — the benchmark trust problem.

**ANALYST:** Yeah, a sharp paper landed on May 19 on exactly that.

**ANALYST:** The argument is that benchmarks should be contamination-resistant.

**ANALYST:** Meaning the test must not leak into the training data.

**ANALYST:** Otherwise a high score measures memory, not reasoning.

**HOST:** So two ways a board can lie.

**ANALYST:** Right — usage gaming on one side, contamination on the other.

**ANALYST:** Same lesson — read the leaderboard, do not worship it.

**HOST:** Now let's do headlines.

**HOST:** Fast clip, things you can actually use.

**ANALYST:** First, the honest self-hosting math on that number-one model.

**ANALYST:** DeepSeek V4-Flash needs about 170 gigabytes of GPU memory.

**ANALYST:** That is a pair of top-end data-center cards, around seven dollars an hour in the cloud.

**ANALYST:** Below very heavy traffic, the cheap API still wins.

**ANALYST:** Self-host for privacy and control, not to save money — unless you are huge.

**HOST:** Good, what else?

**ANALYST:** Second, on-device speech took a leap this year.

**ANALYST:** There is an open text-to-speech model that runs on a CPU with no GPU at all.

**ANALYST:** Hold that thought — it is our top story.

**HOST:** Tease noted.

**ANALYST:** Third, the community quant layer keeps the open world fed.

**ANALYST:** Groups like Unsloth ship tuned, shrunk versions of new models within days.

**ANALYST:** That is how a giant model becomes something that fits your card.

**HOST:** And on the listening side?

**ANALYST:** Speech-to-text moved too.

**ANALYST:** Moonshine v2 is an open model that beats Whisper on accuracy at a fraction of the size.

**ANALYST:** It is built for a Raspberry Pi or a phone.

**ANALYST:** For bulk transcription on a server, NVIDIA's Parakeet is the speed pick.

**HOST:** One more — the chip story.

**ANALYST:** This one ties the whole episode together.

**ANALYST:** On May 21, Nvidia's Jensen Huang said he has largely conceded China's chip market to Huawei.

**ANALYST:** China is even blocking approved Nvidia imports to push its own silicon.

**HOST:** Why does that matter to a builder?

**ANALYST:** Because those open Chinese models topping the usage chart are increasingly trained and served on Huawei chips.

**ANALYST:** Export controls were meant to slow China's AI.

**ANALYST:** Instead they bootstrapped a parallel open stack — chips and weights both.

**ANALYST:** The leaderboard story and the chip story are the same story.

**HOST:** Now let's pull back to the top story.

**HOST:** You promised us open voice.

**ANALYST:** I did, and this is the engine room of this very show.

**HOST:** Say more about that.

**ANALYST:** The voice you are hearing rides on a stack of open and hosted speech models.

**ANALYST:** And 2026 is the year the open ones got good enough to own.

**HOST:** Start with the one closest to home.

**ANALYST:** That is Chatterbox, from Resemble AI.

**ANALYST:** It is MIT-licensed, it covers 23 languages, and it runs on-device.

**ANALYST:** A version called Turbo came out in March.

**ANALYST:** It uses a trick that makes the audio decoder a single step instead of ten.

**HOST:** Plain language on that trick?

**ANALYST:** It means far less compute for the same voice.

**ANALYST:** That is what makes a good voice realistic on a phone.

**HOST:** What if you need more languages?

**ANALYST:** There is an open model called OmniVoice.

**ANALYST:** It claims over 600 languages, and it is fast.

**ANALYST:** It is Apache-licensed, so it is safe to use commercially.

**HOST:** 600 languages sounds too good.

**ANALYST:** It is a fair worry.

**ANALYST:** Covering a language is not the same as sounding good in it.

**ANALYST:** You still have to listen, language by language, before you trust it.

**HOST:** What about studio quality?

**ANALYST:** For that, look at VoxCPM2.

**ANALYST:** It is about 2 billion parameters, Apache-licensed, and outputs in high fidelity.

**ANALYST:** It covers 30 languages and you can fine-tune it on a small voice sample.

**ANALYST:** That mix makes it the most productizable mid-size open voice.

**HOST:** And the on-device flex you teased?

**ANALYST:** That is MOSS-TTS-Nano.

**ANALYST:** It is tiny, about 100 million parameters.

**ANALYST:** It runs on a CPU with no GPU — even on a laptop, on a single core.

**ANALYST:** For anyone shipping a voice to a phone, that is the dream.

**HOST:** So it is all upside?

**ANALYST:** No — and here is the trap everyone misses.

**ANALYST:** Mistral released a lovely voice model called Voxtral.

**ANALYST:** The weights are open and the quality is great.

**ANALYST:** But the license is non-commercial.

**HOST:** Meaning you cannot ship it.

**ANALYST:** Not in a paid product, not without a deal.

**ANALYST:** Open weights do not always mean you are allowed to use them.

**ANALYST:** For a real app, you read the license before you fall in love.

**HOST:** And the benchmark claims around these?

**ANALYST:** Be skeptical.

**ANALYST:** Every beats-the-leader claim here is a vendor running its own blind test.

**ANALYST:** Trust your own ears, not their chart.

**HOST:** So where does that leave us?

**ANALYST:** It leaves us somewhere genuinely new.

**ANALYST:** You can run a great voice on your own device today.

**ANALYST:** The hard question is no longer can you — it is which license lets you keep it.

**HOST:** That is a good note to land the story on.

**HOST:** Let's do the concept of the week.

**HOST:** You picked neural audio codecs.

**ANALYST:** I did, because it is the hidden trick behind every on-device voice.

**ANALYST:** Raw audio is huge — a few seconds is millions of numbers.

**ANALYST:** A phone cannot stream all of that to a model in real time.

**HOST:** So what does a codec do?

**ANALYST:** It learns to crush that audio into a tiny stream of tokens.

**ANALYST:** Think of it as a smart zip file for sound.

**ANALYST:** The open one called Mimi gets down to about one kilobit per second.

**HOST:** How small is that, really?

**ANALYST:** A few hundred little numbers a second, instead of millions.

**ANALYST:** And it still rebuilds the voice so it sounds natural.

**HOST:** Why does that matter for a voice model?

**ANALYST:** Because the model speaks in those tokens, not in raw sound.

**ANALYST:** Fewer tokens means less compute for every word.

**ANALYST:** That is what lets a good voice run on a phone, offline.

**HOST:** So the codec sets the floor.

**ANALYST:** Exactly, it sets the latency and the bitrate everything else lives under.

**ANALYST:** The open ones, Mimi and a cousin called SNAC, are what new speech models build on.

**ANALYST:** When you meet a tiny on-device voice, a codec like that is underneath it.

**ANALYST:** Compression you can hear through — that is the quiet breakthrough.

**HOST:** Good place to land.

**HOST:** Ron, thank you.

**ANALYST:** Anytime, Vindy.

**HOST:** That was AI This Week for May 27, 2026.

**HOST:** New issue next Wednesday.

**HOST:** Until then, take care.
