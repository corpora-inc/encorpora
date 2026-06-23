---
title: "AI This Week — June 3, 2026 — Frontier on the Countertop"
date: 2026-06-03
hosts:
  - id: vindy
    role: host
  - id: ron
    role: analyst
notes: |
  Episode 4. One sentence per dialog turn (HOST or ANALYST block).
  When Ron has a multi-sentence thought, that's multiple consecutive
  ANALYST segments.

  Manuscript uses DISPLAY form (numerals, dashes, slashes natural).
  phonetics.spell_out() produces the spelled-out tts.text at generate
  time. See scripts/phonetics.py.

  Editorial voice (Ep 4): hardcore DIY tinkerers. Self-hosters,
  fine-tuners, llama.cpp / vLLM / Ollama / MLX folk. Big-co stuff is
  fast clip. We surface the open alternative for every closed product.

  Spine: June 1 was DIY-rig day. NVIDIA shipped an OPEN 550-billion
  MoE, MiniMax dropped M3 with one-million-token context, AMD's
  Strix Halo mini PC opened pre-orders, and GitHub Copilot moved
  to usage-based billing. The full DIY stack — silicon, engine,
  model, fine-tune, agent — is now actually on your desk for the
  price of a used car. Top Story is that rig. Concept is speculative
  decoding, the trick under MiniMax M3's fifteen-times decode and
  llama.cpp's draft-model mode.
---

**HOST:** Welcome to AI This Week.

**HOST:** I am Vindy.

**HOST:** With me, as always, is Ron.

**ANALYST:** Good to be here, Vindy.

**HOST:** Today is Wednesday, June 3, 2026.

**HOST:** This was a quiet week for marketing and a loud week for hardware.

**HOST:** The shape of the headlines was unusual.

**HOST:** A big-lab keynote, a confidential filing, a small computer with a big number on the box.

**HOST:** Coming up — what moved in open weights, led by a new attention architecture and an NVIDIA open model.

**HOST:** Where the leaderboards landed, and the bigger story under them about how we trust scores at all.

**HOST:** A fast clip of headlines you can act on this weekend.

**HOST:** Our top story, the do-it-yourself rig grew up — frontier inference is now a thing on your desk.

**HOST:** And the concept of the week is speculative decoding — the trick that makes a big model on a small card feel fast.

**HOST:** Ron, let's start in the open-weights world.

**HOST:** Where did the week land?

**ANALYST:** This week the open story was about new shapes, not new sizes.

**ANALYST:** Two architecturally interesting models dropped on the same day, June 1.

**HOST:** Walk us through the first.

**ANALYST:** MiniMax shipped M3.

**ANALYST:** It uses a new attention design they are calling MSA, short for MiniMax Sparse Attention.

**ANALYST:** The pitch is a one-million-token context, with about nine times faster prefill and fifteen times faster decode versus their previous model at that length.

**HOST:** Plain-language on what sparse attention actually does.

**ANALYST:** Regular attention compares every token against every other token, which is what makes long context so expensive.

**ANALYST:** Sparse attention pre-filters the context into blocks and only does the full comparison for the blocks that look relevant to the current question.

**ANALYST:** You get most of the quality at a fraction of the compute.

**HOST:** And the benchmark claim?

**ANALYST:** MiniMax says fifty nine percent on SWE-bench Pro, which would put it ahead of GPT-5.5 and Gemini 3.5 Pro on that one board.

**ANALYST:** I will say claims — this is the vendor's own scorecard, not an independent run.

**HOST:** Open weights too?

**ANALYST:** Yes, M3 is positioned as open-weight; the API is live on day one and weights are landing on Hugging Face shortly.

**ANALYST:** For a tinkerer, the interesting bet is the architecture more than the score.

**ANALYST:** If MSA holds up, every other open lab will copy the shape within months.

**HOST:** And the second model?

**ANALYST:** NVIDIA quietly open-sourced Nemotron 3 Ultra.

**ANALYST:** It is a five hundred fifty billion parameter mixture of experts, with about fifty five billion active per token.

**ANALYST:** The backbone is a hybrid Mamba-Transformer, not a pure Transformer.

**HOST:** Plain-language on Mamba.

**ANALYST:** Mamba layers handle long sequences with sub-quadratic scaling, which is a fancy way of saying they get cheaper per token as the context grows.

**ANALYST:** NVIDIA kept a few attention layers in the stack to preserve precise recall for things like long-document question answering.

**ANALYST:** It's the kind of hybrid that has been winning quietly in research for a year.

**HOST:** What about the license?

**ANALYST:** NVIDIA's own Open Model License, commercial use permitted.

**ANALYST:** Weights, post-trained checkpoints, NVFP4 quantization, and the training recipes all dropped together.

**ANALYST:** That is a more generous package than most open releases.

**HOST:** And the scoreboard placement?

**ANALYST:** On the Artificial Analysis Intelligence Index, Nemotron 3 Ultra lands at forty eight.

**ANALYST:** That puts it ninth out of the eighty nine models they track, and ahead of every other US open model.

**ANALYST:** It also trails Moonshot's Kimi K2.6, which is at fifty four.

**HOST:** So even with all that, China still leads open.

**ANALYST:** On that one composite, yes, by six points.

**ANALYST:** That is the smaller story under the bigger one.

**HOST:** Anything sibling-wise?

**ANALYST:** Yes, NVIDIA also dropped a Nemotron 3 Nano Omni.

**ANALYST:** That one is a unified vision, audio, and language model, claimed to be about nine times more efficient than peer open omni models.

**ANALYST:** It is aimed at on-device agents — phones, laptops, small workstations.

**HOST:** What else from the open side?

**ANALYST:** Mistral Medium 3.5 showed up inside Microsoft's Copilot Studio on May 28.

**ANALYST:** It is a one hundred twenty eight billion parameter dense model with a two hundred fifty six thousand token context.

**HOST:** Why is that placement interesting?

**ANALYST:** Because Microsoft is now distributing a non-OpenAI European model through its own platform, with EU data residency built in.

**ANALYST:** Two years ago that sentence would have been unthinkable.

**HOST:** And Alibaba?

**ANALYST:** Qwen 3.7 Plus landed on June 2, but it is API-only on the Bailian platform.

**ANALYST:** The open Qwen line still stops at three point six.

**ANALYST:** That confirms the split we flagged last week — closed flagship, open mid-tier.

**ANALYST:** Same playbook as Mistral has been running for a year.

**HOST:** Two quick context lines before we move on?

**ANALYST:** Sure.

**ANALYST:** Chinese open models still lead OpenRouter token volume — same beat as last week, no change.

**ANALYST:** And DeepSeek V4 went live on Microsoft's Foundry platform on May 28, which just means more places to call it.

**HOST:** Okay, let's get to the leaderboards.

**HOST:** Was there one big mover this week?

**ANALYST:** There was, and it is closed — Claude Opus 4.8, which Anthropic shipped on May 28.

**ANALYST:** It hits eighty eight point six percent on SWE-bench Verified and sixty nine point two percent on SWE-bench Pro.

**ANALYST:** And it now leads the Artificial Analysis Intelligence Index on the composite score.

**HOST:** First time Anthropic has led that one.

**ANALYST:** That is right.

**ANALYST:** GPT-5.5 is one point behind, and Gemini 3.5 Pro is a few points behind that.

**ANALYST:** Very tight at the top of the closed pack.

**HOST:** But the real eval story this week was something else.

**ANALYST:** Yeah, the real story is integrity.

**ANALYST:** OpenAI has effectively stopped reporting on SWE-bench Verified.

**ANALYST:** A contamination audit found that roughly fifty nine percent of the hard tasks have flawed unit tests, and models can recall correct patches from the training data verbatim.

**HOST:** So a high score was measuring memory.

**ANALYST:** Often, yes.

**ANALYST:** Pro is the version with new tasks and harder scaffolding — that is the new signal.

**ANALYST:** This is the institutional confirmation of the contamination concern we hedged last week.

**HOST:** Was there a methodology paper too?

**ANALYST:** There was a sharp report from a group called Kili Technology.

**ANALYST:** They ran identical model weights through five common evaluation harnesses.

**ANALYST:** Scores diverged by ten to twenty percentage points purely from harness choice.

**HOST:** Same weights, different number.

**ANALYST:** Exactly.

**ANALYST:** Their takeaway was that leaderboard rank is no longer a buyer-grade signal for procurement.

**ANALYST:** For a do-it-yourself builder, the takeaway is sharper — run your own evals on your own prompts.

**HOST:** That actually loops back to MSA and Nemotron Ultra.

**ANALYST:** It does.

**ANALYST:** Trust the architecture and your own tests, not somebody else's chart.

**HOST:** Good place to leave the boards.

**HOST:** Now let's do headlines.

**HOST:** Fast clip, open-ecosystem lens.

**ANALYST:** First, Microsoft Build was on June 2.

**ANALYST:** Microsoft showed off two first-party models — MAI-Thinking-1 and MAI-Code-1-Flash.

**HOST:** What is interesting about those?

**ANALYST:** Thinking-1 is a thirty five billion active parameter sparse mixture of experts, with a two hundred fifty six thousand token context window.

**ANALYST:** And Microsoft specifically says it was trained on commercially licensed data with no distillation from any third party model.

**HOST:** That is unusual.

**ANALYST:** Very unusual, given how much the rest of the field leans on synthetic data from frontier models.

**ANALYST:** Code-1-Flash is the cheaper one — it started rolling out to all GitHub Copilot tiers on June 2.

**ANALYST:** So Microsoft now ships Mistral, DeepSeek, OpenAI, and its own MAI side by side in Copilot Studio.

**HOST:** Second headline?

**ANALYST:** Anthropic confidentially filed an S-1 with the SEC on June 1.

**ANALYST:** That is the paperwork that begins the road to a public listing.

**ANALYST:** Their stated revenue run rate is around forty seven billion dollars, up from about ten billion a year ago.

**ANALYST:** No ticker, no price range, no date yet — just the paperwork.

**HOST:** Third.

**ANALYST:** GitHub Copilot moved to usage-based billing on June 1.

**ANALYST:** Every plan now meters input, output, and cached tokens at the same rates as the underlying model API.

**ANALYST:** They softened the landing with an allotment of credits per tier and a new Copilot Max plan at one hundred dollars a month for heavy agentic users.

**HOST:** And how did developers take that?

**ANALYST:** Some takes were quite spicy.

**ANALYST:** Heavy users with agent loops reported projected bills several times higher than the old flat fee.

**ANALYST:** This will matter for our top story — hold that thought.

**HOST:** Fourth, anything to patch this weekend?

**ANALYST:** Yes, SGLang versions up to zero point five point eleven have a cache denial-of-service flaw disclosed on June 3.

**ANALYST:** The identifier is CVE-2026-10775, severity is low, exploitation is local only — but if you serve from SGLang, you patch on Monday.

**HOST:** One more.

**ANALYST:** Unsloth Studio rolled an update that exports a full fine-tune straight to GGUF — not just adapter weights.

**ANALYST:** A twenty four gigabyte consumer card is now enough for useful runs.

**ANALYST:** That is the unfussy plumbing that makes the rest of this episode real.

**HOST:** Now let's pull back to the top story.

**HOST:** You teased a rig.

**ANALYST:** I did, and the spine of it is this — the do-it-yourself rig grew up this week.

**HOST:** Start with the hardware.

**ANALYST:** Two boxes are now actually shipping at consumer prices.

**ANALYST:** AMD opened pre-orders on the Ryzen AI Halo mini PC in June at three thousand nine hundred ninety nine dollars.

**ANALYST:** It runs the Ryzen AI Max Plus 395, with one hundred twenty eight gigabytes of unified LPDDR5x memory, and it sits exclusively at Micro Center for now.

**HOST:** And the NVIDIA side?

**ANALYST:** NVIDIA's DGX Spark is the comparable box.

**ANALYST:** It has the GB10 Grace Blackwell chip and the same one hundred twenty eight gigabytes of unified memory.

**ANALYST:** Price recently went from three thousand nine hundred ninety nine to four thousand six hundred ninety nine, blamed on the global memory squeeze.

**HOST:** How big a model do these actually hold?

**ANALYST:** Up to about two hundred billion parameters at four-bit quantization, with room for context.

**ANALYST:** Pair two DGX Sparks together over ConnectX-7 and you get into roughly four hundred billion territory.

**ANALYST:** That is genuinely a frontier-class footprint on a countertop.

**HOST:** Now the software stack.

**ANALYST:** This is what changed under our feet.

**ANALYST:** For inference you have vLLM, SGLang, llama.cpp, Ollama, and MLX on Apple Silicon — all maintained, all fast.

**ANALYST:** For the model itself you have Nemotron 3 Ultra weights this week, plus Kimi K2.6, DeepSeek V4-Flash, GLM-5.1, and the MiniMax M3 weights coming.

**ANALYST:** For fine-tuning, Unsloth Studio is now a one-click full tune to GGUF.

**ANALYST:** And for agents, you have Aider, Continue, and LangGraph version one running local thirty two billion parameter models at usable reliability.

**HOST:** That is the whole loop.

**ANALYST:** That is the whole loop.

**ANALYST:** Silicon, engine, model, fine-tune, agent — every layer has a credible open option, and the bottom layer is now a desk-side mini PC.

**HOST:** And the economics?

**ANALYST:** The economics flipped this week, in a way that is hard to miss.

**ANALYST:** Token-metered Copilot, an Anthropic S-1 that signals pricing pressure to come, and grid warnings out of Texas, Virginia, and Ohio about a tight summer.

**ANALYST:** The case for self-host used to be ideological.

**ANALYST:** This week it became a spreadsheet.

**HOST:** Be honest about what hasn't changed.

**ANALYST:** Important caveat — your countertop does not beat the cloud at the top of the quality chart.

**ANALYST:** Opus 4.8 still leads the composite, and GPT-5.5 still owns BrowseComp.

**ANALYST:** What changed this week is the floor.

**ANALYST:** Capable, agent-grade, fine-tunable models, on your own hardware, with open weights.

**HOST:** That's the story.

**ANALYST:** It used to take a data center.

**ANALYST:** This week, it takes a countertop.

**HOST:** Let's do the concept of the week.

**HOST:** You picked speculative decoding.

**ANALYST:** I did, because it is the trick that makes everything we just talked about feel fast.

**ANALYST:** MiniMax's fifteen-times decode claim leans on a relative.

**ANALYST:** Llama.cpp's draft model mode is exactly this idea.

**HOST:** Walk us through it.

**ANALYST:** You run two models side by side.

**ANALYST:** A small, fast model called the drafter, and the big, slow model called the verifier.

**ANALYST:** The drafter guesses, say, the next four tokens in a single shot.

**ANALYST:** The verifier checks all four in parallel.

**HOST:** And then?

**ANALYST:** If the verifier agrees, you keep all four and move on — you just did four tokens for the cost of about one.

**ANALYST:** If it disagrees, you accept up to the first mismatch and let the big model take over from there.

**HOST:** So the answer is identical.

**ANALYST:** Right, that's the elegant part.

**ANALYST:** The output is exactly what the big model would have produced on its own.

**ANALYST:** You just paid for fewer of its forward passes.

**HOST:** Why does that matter for a tinkerer?

**ANALYST:** Because it turns a seventy billion parameter model on a single card from a novelty into a usable conversation.

**ANALYST:** And on a phone, it is part of how a real on-device assistant feels responsive.

**ANALYST:** Last week's concept, neural audio codecs, was the audio version of the same trick — fewer expensive steps for the same quality.

**HOST:** Where should the curious go from here?

**ANALYST:** Look up EAGLE-3, Medusa, and lookahead decoding.

**ANALYST:** They are the modern cousins of the original drafter-verifier idea, and they are what your inference engine is actually running under the hood.

**HOST:** Good place to land.

**HOST:** Ron, thank you.

**ANALYST:** Anytime, Vindy.

**HOST:** That was AI This Week for June 3, 2026.

**HOST:** New issue next Wednesday.

**HOST:** Until then, take care.
