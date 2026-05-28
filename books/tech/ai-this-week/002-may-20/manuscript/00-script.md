---
title: "AI This Week — May 20, 2026 — Magnifica Humanitas"
date: 2026-05-20
hosts:
  - id: vindy
    role: host
  - id: ron
    role: analyst
notes: |
  Episode 2. One sentence per dialog turn (HOST or ANALYST block).
  When Ron has a multi-sentence thought, that's multiple consecutive
  ANALYST segments. Ron going on for several segments in a row is
  expected and good — that's how an analyst talks.

  Manuscript uses DISPLAY form (numerals, dashes, slashes natural).
  phonetics.spell_out() produces the spelled-out tts.text at generate
  time. See scripts/phonetics.py.

  Editorial voice: open-weights / on-device / scrappy DIY. Big-co
  products get covered in Headlines, fast clip. We always surface the
  open alternative.
---

**HOST:** Welcome to AI This Week.

**HOST:** I am Vindy.

**HOST:** With me, as always, is Ron.

**ANALYST:** Good to be here, Vindy.

**HOST:** Today is Wednesday, May 20, 2026.

**HOST:** It was a busy week.

**HOST:** Google ran its developer conference, the Pope finished an encyclical about artificial intelligence, and the open-weights world kept shipping while everyone else had stages.

**HOST:** Coming up — what moved in open weights this week.

**HOST:** Where the leaderboards landed.

**HOST:** A fast clip through the headlines from the bigger labs.

**HOST:** Our top story, the Vatican's first encyclical on artificial intelligence.

**HOST:** And the concept of the week is quantization — how a 7-billion-parameter model fits on your phone.

**HOST:** Ron, let's start with open weights.

**HOST:** What's moving in the community this week?

**ANALYST:** The biggest open-weights story right now is who is training where.

**ANALYST:** Two of the most interesting recent open releases trained on non-NVIDIA silicon.

**HOST:** Walk us through it.

**ANALYST:** Zhipu AI in Beijing shipped the GLM-5 family earlier this year — GLM-5 in February and an update called GLM-5.1 in April.

**ANALYST:** The entire GLM-5 family was trained on roughly 100,000 Huawei Ascend 910B chips, using the MindSpore framework, with zero NVIDIA GPUs in the loop.

**ANALYST:** And Zyphra, an American lab, shipped a model called ZAYA1-8B earlier this month, pre-trained on a cluster of AMD MI300x nodes built with IBM.

**HOST:** Why does the silicon matter?

**ANALYST:** Two reasons.

**ANALYST:** One — for the past three years, every serious frontier training run has needed NVIDIA H100s or H200s.

**ANALYST:** Two — that supply has been the bottleneck, and the assumption was that the open and the Chinese frontier were a generation behind because of it.

**ANALYST:** Once a frontier-class run lands on Huawei Ascend or AMD, every other open lab can copy the recipe.

**ANALYST:** That is what is happening this year.

**HOST:** Anything else from the open side this week?

**ANALYST:** Yeah, three things worth flagging.

**ANALYST:** Moonshot's Kimi K2.6, released back in late April, is still in the top tier on OpenRouter for token volume — it topped the chart in its first week with 1.88 trillion tokens served.

**ANALYST:** That was the first time a Chinese open-weights model had outpaced Claude Sonnet and DeepSeek on the major commercial router.

**ANALYST:** DeepSeek V4-Pro is at 1.6 trillion total parameters with 49 billion active.

**ANALYST:** Their cheaper sibling, V4-Flash, is 284 billion total with 13 billion active.

**ANALYST:** Both are open weights under the MIT license.

**HOST:** Say more about ZAYA1-8B specifically.

**ANALYST:** It is a small mixture-of-experts model — 8.4 billion total parameters, with only about 760 million active per token.

**ANALYST:** Apache 2.0 license, so you can use it commercially.

**ANALYST:** Pre-trained on a cluster of about 1,024 AMD MI300x nodes, with no NVIDIA hardware involved.

**ANALYST:** It scores 89.1 on AIME, the math olympiad benchmark, beating much larger models on math and coding while running on a sub-1-billion active-parameter budget.

**HOST:** Two open-weights labs training without NVIDIA inside two months.

**ANALYST:** Not a coincidence.

**ANALYST:** The plumbing finally caught up — AMD ROCm and Huawei CANN both got usable in 2025, and 2026 is when the open community is shipping real frontier-class runs on them.

**HOST:** What about the infrastructure side?

**ANALYST:** vLLM v0.21 shipped on Friday, May 15.

**ANALYST:** vLLM is the open serving stack — what you actually run when you want to host a model yourself.

**ANALYST:** It handles batching, paging, and KV cache reuse, and it's now the default in production for everyone who isn't on a closed API.

**ANALYST:** This release adds KV offload with a hybrid memory allocator, and a new attention backend tuned for DeepSeek-R1 and Kimi K2.5 prefill on Blackwell GPUs.

**ANALYST:** The open serving stack keeps shipping while the big labs do keynotes.

**HOST:** Okay, let's move to leaderboards.

**HOST:** Ron, what's holding and what moved?

**ANALYST:** Mostly holding.

**ANALYST:** Anthropic's Claude Opus 4.7 is still number one on the LM Arena coding leaderboard, around an Elo of 1569.

**ANALYST:** OpenAI's GPT-5.5 in high-reasoning mode sits at number seven on the same board.

**ANALYST:** And on the WebDev coding sub-board, GPT-5.5 is at number nine.

**HOST:** Where does the new Google model land?

**ANALYST:** Gemini 3.5 Flash shipped on Tuesday at Google I/O, so it is not on the boards yet.

**ANALYST:** Arena needs a few thousand head-to-head votes before a model gets a stable Elo.

**ANALYST:** Expect Gemini 3.5 Flash to show up next week and Gemini 3.5 Pro to land in June.

**HOST:** Anything on the eval-quality front?

**ANALYST:** Yes, a callback to last week.

**ANALYST:** SWE-bench Verified is still retired — the coding benchmark OpenAI used to cite, where more than half of the hard tasks had broken tests.

**ANALYST:** The boards to watch now are SWE-bench Pro and a project called SWE-rebench.

**ANALYST:** Both keep the test code private so models can't be trained against it.

**HOST:** And the open versus closed gap?

**ANALYST:** Per Artificial Analysis, the gap is now 5 to 15 points on the cross-evaluation intelligence index.

**ANALYST:** That was 30 to 40 points 18 months ago.

**ANALYST:** Kimi K2.6 and DeepSeek V4-Pro are sitting within that band against GPT-5.5 and Opus 4.7.

**HOST:** Now let's move to headlines.

**HOST:** Ron, what's in the fast clip this week?

**ANALYST:** Google I/O was Tuesday and Wednesday.

**ANALYST:** The headline drops were Gemini 3.5 Flash, Gemini Omni for conversational video editing, and Gemini Spark, an agent that runs 24/7 on a cloud virtual machine you don't own.

**ANALYST:** Worth noting that the same pattern — an agent that runs on its own machine and does multi-step work — is something you can already do today with open tools like Aider or OpenCode pointed at a local model.

**ANALYST:** Google AI Ultra dropped its starter tier from $250 a month to $100 a month, and Samsung announced extended-reality glasses with Gemini built in.

**ANALYST:** Daily prompt limits were replaced with a compute budget that refreshes every five hours.

**HOST:** And on the personnel side?

**ANALYST:** Andrej Karpathy joined Anthropic on Tuesday.

**ANALYST:** He's on the pre-training team, leading a group focused on using Claude to accelerate pre-training research.

**ANALYST:** Karpathy was a founding member of OpenAI, then ran Tesla's AI work, then started Eureka Labs for AI education.

**HOST:** What about Apple?

**ANALYST:** Google Cloud CEO Thomas Kurian confirmed this week that Gemini will power a version of Siri later in 2026.

**ANALYST:** The deal runs through Apple's Foundation Models framework, so Apple still owns the integration layer.

**HOST:** And the Musk lawsuit?

**ANALYST:** A nine-member California jury rejected Elon Musk's lawsuit against OpenAI on Monday, May 18.

**ANALYST:** They deliberated for less than two hours.

**ANALYST:** The jury found Musk had filed past the statute of limitations, and the judge tossed the case.

**HOST:** Anything from policy?

**ANALYST:** Treasury Secretary Scott Bessent announced at the Trump-Xi summit in Beijing on May 14 that the U.S. and China will set up a formal protocol on AI safety.

**ANALYST:** It is framed as best practices to keep frontier models out of the hands of non-state actors — not a binding regime, just an agreement to talk.

**ANALYST:** First time the two sides have framed AI safety as bilateral instead of a pure competition.

**HOST:** Now let's pull back to the top story.

**HOST:** Ron, the Pope wrote about us last week.

**ANALYST:** Pope Leo XIV has finished his first encyclical.

**ANALYST:** It is titled Magnifica Humanitas.

**ANALYST:** That translates as "the magnificence of humanity".

**ANALYST:** The Vatican is publishing it on Monday, May 25.

**ANALYST:** It addresses artificial intelligence and the protection of human dignity.

**HOST:** When did the Pope sign it?

**ANALYST:** May 15.

**ANALYST:** That date was chosen on purpose.

**ANALYST:** It is exactly 135 years to the day after Pope Leo XIII signed Rerum Novarum.

**HOST:** What was Rerum Novarum?

**ANALYST:** Rerum Novarum was the foundational Catholic teaching on labor and capital.

**ANALYST:** It came out in 1891, in the middle of the industrial revolution.

**ANALYST:** It defined how the Church thinks about workers, owners, wages, and the dignity of work — and that framing has held for over a century.

**ANALYST:** Pope Leo XIV is positioning artificial intelligence as the same kind of epochal question for our generation.

**HOST:** That's a deliberate echo.

**ANALYST:** Very deliberate.

**ANALYST:** Even the choice of regnal name — Leo — signals it.

**ANALYST:** This Pope is saying out loud that AI is to our century what industrialization was to the nineteenth.

**HOST:** Who is presenting alongside him?

**ANALYST:** Chris Olah, co-founder of Anthropic, will be on the stage at the Vatican Synod Hall.

**ANALYST:** Olah runs interpretability research at Anthropic.

**ANALYST:** That is the field that tries to figure out what is actually happening inside a neural network.

**HOST:** Why an interpretability researcher and not an executive?

**ANALYST:** Because the encyclical's central question is "what is this thing we are building, and can we understand it?"

**ANALYST:** That is exactly the interpretability question, mapped onto a moral frame.

**ANALYST:** It is not a sales pitch and they did not pick a sales pitch person.

**HOST:** Who else is on stage?

**ANALYST:** Cardinal Pietro Parolin will give the concluding remarks.

**ANALYST:** Also presenting: Cardinal Víctor Manuel Fernández and Cardinal Michael Czerny.

**ANALYST:** And two theology professors — Anna Rowlands from Durham University in the UK, and Léocadie Lushombo from the Jesuit School of Theology at Santa Clara University — will be on the panel.

**HOST:** Why does this matter beyond the room?

**ANALYST:** Because there are 1.4 billion Catholics in the world.

**ANALYST:** When the Pope writes an encyclical, it shapes how a huge population thinks about a topic for a generation.

**ANALYST:** Rerum Novarum still shapes Catholic social policy on labor, 135 years later.

**ANALYST:** Magnifica Humanitas is positioned to do the same on AI.

**HOST:** And the angle going the other direction?

**ANALYST:** An institution from outside the AI industry is taking a serious teaching position on what we're building.

**ANALYST:** And the industry side is showing up, at the table, with the right kind of researcher.

**ANALYST:** That is not the usual stance — it's usually either "we know best, leave us alone" or a lobbying posture.

**ANALYST:** This is a different posture.

**HOST:** Good time to land the section.

**HOST:** Now let's move to the concept of the week.

**HOST:** The concept this week is quantization.

**HOST:** Ron, walk us through it.

**ANALYST:** Quantization is how a 7-billion-parameter model fits on your phone.

**ANALYST:** Start with the basic problem.

**ANALYST:** Each weight in a model is normally a 16-bit floating-point number.

**ANALYST:** A 7-billion-parameter model in 16-bit is about 14 gigabytes on disk.

**ANALYST:** That does not fit on a phone.

**HOST:** So you shrink the numbers.

**ANALYST:** Right.

**ANALYST:** You round each weight to fewer bits.

**ANALYST:** Eight bits per weight cuts the model in half.

**ANALYST:** Four bits per weight cuts it to a quarter.

**ANALYST:** That same 7-billion-parameter model at four bits is 3.5 gigabytes.

**ANALYST:** Now it fits.

**HOST:** Does the model still work?

**ANALYST:** Usually yes, with a small quality drop.

**ANALYST:** The trick is choosing where in the model to lose precision.

**ANALYST:** AWQ — activation-aware weight quantization — keeps the channels that matter most in higher precision and squeezes the rest.

**ANALYST:** GGUF, which is what llama.cpp uses, has formats like Q4_K_M that mix precisions inside a single model file.

**HOST:** How small can you get?

**ANALYST:** Apple's on-device foundation model goes to 2 bits per weight.

**ANALYST:** They use Quantization-Aware Training, where the model is trained from the start knowing it will be 2-bit at inference.

**ANALYST:** That's a much better outcome than naive rounding after the fact.

**ANALYST:** About 3 billion parameters at 2 bits comes out to roughly 750 megabytes.

**ANALYST:** That fits on a phone with room to spare.

**HOST:** So that's why on-device AI is finally usable this year.

**ANALYST:** That's the main reason.

**ANALYST:** Three words to take with you — AWQ, GGUF, and Quantization-Aware Training.

**ANALYST:** If a model ships those three things, it ships on phones.

**HOST:** Good place to land.

**HOST:** Ron, thank you.

**ANALYST:** Anytime, Vindy.

**HOST:** That was AI This Week for May 20, 2026.

**HOST:** New issue next Wednesday.

**HOST:** Until then, take care.
