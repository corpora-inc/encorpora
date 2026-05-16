---
title: "AI This Week — May 13, 2026 — Rate Cuts and Routers"
date: 2026-05-13
hosts:
  - id: vindy
    role: host
  - id: ron
    role: analyst
notes: |
  Bare dialog. No Style: prefix, no [tag] direction. The pack-level
  director_prompt layer is reserved for a future director-prompt agent;
  for issue 1 we run unstyled to establish a baseline.
  Numbers spelled as words. Acronyms left as written (AI, GPT, MoE
  is avoided — we say "mixture of experts" in full).
---

**HOST:** Welcome to AI This Week. I am Vindy.

**HOST:** With me, as always, is Ron.

**ANALYST:** Good to be here.

**HOST:** Today is Wednesday, May thirteenth, twenty twenty six. Coming up: the models that shipped this week. The leaderboards, and why some of them you should stop trusting. Our concept of the week. And the bigger picture — the U.S. just got a new Federal Reserve chair, and it matters more for AI than you might think.

**HOST:** Ron, what is the biggest model news this week?

**ANALYST:** The default brain inside ChatGPT changed. OpenAI rolled out a new model called GPT five point five Instant to the free tier last week, on Tuesday, May fifth. If a free ChatGPT response has been feeling shorter or less full of emojis, that is why.

**HOST:** Shorter how?

**ANALYST:** OpenAI says the new default writes roughly thirty percent fewer words and thirty percent fewer lines than the model it replaced. They also claim a fifty percent drop in hallucinated claims on the hardest prompts. Things like medical questions, legal questions, and financial questions.

**HOST:** Has anyone outside OpenAI verified those numbers?

**ANALYST:** Not at scale. The independent benchmark people, like Artificial Analysis, have the new model at the top of their overall intelligence index. But hallucination claims are slow to verify. Those tend to surface over weeks, as people actually use the model.

**HOST:** And on the open weights side?

**ANALYST:** Two big things. Moonshot, the Chinese lab behind the Kimi model, raised two billion dollars last week, on May seventh, at a twenty billion dollar valuation. And their latest model, Kimi K two point six, just took the top spot on OpenRouter for token volume.

**HOST:** The top spot? Overall?

**ANALYST:** Overall. That is a Chinese open weights model at number one on a major commercial router. Six months ago, that would have been unthinkable.

**HOST:** Anything else worth flagging?

**ANALYST:** Mistral, the French lab, shipped Medium three point five back in late April. They are collapsing the old split between a chat model, a reasoning model, and a coding model into one product. Same trend OpenAI started with the GPT five family. The whole industry is moving that direction.

**HOST:** And what is coming next?

**ANALYST:** Google I O is on Tuesday. Everyone expects a new Gemini, and there is credible chatter about a video generation model called Gemini Omni. OpenAI has GPT five point six in testing. Anthropic has a model called Mythos in a private preview. We will know a lot more next week.

**HOST:** Okay, let's get to the leaderboards.

**HOST:** Ron, what is moving on the boards this week?

**ANALYST:** The real story this week is not the scores. It is the scores you should stop trusting.

**HOST:** Tell us a little bit more about that, Ron.

**ANALYST:** A group at Berkeley published a paper. They built an automated scanner that scored near perfect on every major AI agent benchmark. Without actually solving a single task. They exploited the way the benchmarks check their own answers.

**HOST:** They cheated, and the benchmarks did not catch it.

**ANALYST:** Right. And the same week, OpenAI announced they are retiring their evaluations on SWE bench Verified. That is a coding benchmark they used to cite all the time. They retired it because more than half of the hard tasks turned out to have broken tests.

**HOST:** So a lot of the numbers we have been hearing for the past year are…

**ANALYST:** At least partly inflated. Not every model. Not every benchmark. But the field is rebuilding its measuring tape in public. Newer evaluations like SWE bench Pro and a project called SWE rebench are trying to fix this by keeping the test code private.

**HOST:** Is anything actually moving up cleanly?

**ANALYST:** Two things, on cleaner boards. Back in mid-April, Anthropic's Claude Opus four point seven became the first model to push cleanly past an Elo of fifteen hundred on the LM Arena coding leaderboard. Opus four point six had touched fifteen hundred a couple weeks earlier. As of this week, Opus four point seven is still on top, around fifteen sixty nine. Anthropic also has a separate model called Mythos in a private partner preview that is leading seventeen of the eighteen agent benchmarks Anthropic measured.

**HOST:** A model the public cannot use is on top of the boards.

**ANALYST:** That is where we are. The other big trend is the open versus closed gap. It is the narrowest it has ever been. DeepSeek V four Pro and Kimi K two point six are within striking distance of GPT five point five on the cross evaluation intelligence index. That gap used to be huge. It is now small.

**HOST:** Okay, let's get into the concept of the week.

**HOST:** Ron, the concept of the week is mixture of experts. Why is it the concept this week?

**ANALYST:** Because the open weights model we just talked about, Kimi K two point six, has one trillion parameters total. But only thirty two billion of those parameters run at any given moment. That is mixture of experts.

**HOST:** Walk us through it for the folks tuning in.

**ANALYST:** A regular AI model is like one giant brain. Every word it generates uses every part of the brain. A mixture of experts model is more like a building full of specialists. With a receptionist at the door. For each word, the receptionist picks two or three specialists to consult, and the rest of the building stays quiet.

**HOST:** So the model is huge on paper but cheap to run.

**ANALYST:** Exactly. One trillion parameters of capacity. But only thirty two billion parameters of compute per word. That is the trick. The receptionist is a tiny piece of code called a router. The specialists are sub networks called experts. The model trains the router and the experts together, end to end.

**HOST:** Is every major frontier model doing this?

**ANALYST:** Most of them, yes. Though the labs do not always confirm it. GPT four was a mixture of experts model. The flagship from DeepSeek is mixture of experts. Mistral has been shipping mixture of experts models since twenty twenty three. The new wave from China has pushed this design to extremes.

**HOST:** Why does it matter for someone who just uses ChatGPT?

**ANALYST:** Two reasons. One. It is the main reason an open weights lab in China can run at frontier class quality on a fraction of the budget. Two. It is the main reason a single API call costs cents, not dollars. When you see prices drop and quality stay high, mixture of experts is usually why.

**HOST:** Mixture of experts. Router. Experts. Sparse activation. Three words to take with you. Now let's pull back to the bigger picture.

**HOST:** Ron, the big story outside our world this week is the Fed.

**ANALYST:** Today, the U.S. Senate confirmed Kevin Warsh as the next chair of the Federal Reserve. The vote was fifty four to forty five. The narrowest vote for a Fed chair in modern American history. Only one Democrat crossed the aisle.

**HOST:** Why does that matter for AI?

**ANALYST:** Because the AI buildout right now is constrained by two things. Electricity, and the cost of capital. The Fed sets the cost of capital. And the new chair is on record saying he wants to cut rates faster than his predecessor would have.

**HOST:** Faster rate cuts make AI investment cheaper.

**ANALYST:** Yes. The hyperscalers — Microsoft, Google, Amazon, Meta — are on track to spend roughly seven hundred billion dollars on capital expenditure this year. Most of that is GPUs and data centers. A lower discount rate makes those multi year buildouts pencil out at higher valuations.

**HOST:** And the other direction. How does AI affect what the Fed has to decide?

**ANALYST:** This is the interesting part. AI capital spending is now big enough that it is a macro number. Not a sector story. Wall Street analysts say AI related construction and equipment spending has been the majority of U.S. economic growth for the past several quarters.

**HOST:** The majority of growth.

**ANALYST:** The majority. And it cuts in two directions for the Fed. Long term, AI is a productivity tailwind. That is deflationary. It gives the Fed room to cut. Short term, it is a demand shock on power, on copper, on skilled labor, on water for cooling. That is inflationary. Especially in places like Virginia and Texas, where the data centers are concentrated.

**HOST:** So the new chair has to decide whether AI is the answer to inflation, or the cause of it.

**ANALYST:** Both, simultaneously. And whatever he says in his first public speeches is going to move every AI capital expenditure model on Wall Street.

**HOST:** Microsoft has eighty billion dollars of unfulfilled cloud orders because of power. Is that the right number?

**ANALYST:** That is the number Microsoft has reported. Azure customers are waiting in line for capacity. The bottleneck is not chips anymore. It is the electrical grid. Power markets cannot build new capacity as fast as the data centers want it.

**HOST:** When is Warsh's first meeting?

**ANALYST:** The sixteenth and seventeenth of June. We will know a lot more about the rate path after that.

**HOST:** Good place to land. Ron, thank you.

**ANALYST:** Anytime, Vindy.

**HOST:** That was AI This Week for May thirteenth, twenty twenty six. New issue next Wednesday. Until then, take care.
