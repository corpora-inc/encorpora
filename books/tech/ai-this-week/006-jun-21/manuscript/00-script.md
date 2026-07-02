---
title: "AI This Week — June 21, 2026 — Megawatts and Market Caps"
date: 2026-06-21
hosts:
  - id: vindy
    role: host
  - id: ron
    role: analyst
notes: |
  Episode 6. One sentence per dialog turn (HOST or ANALYST block).
  When Ron has a multi-sentence thought, that's multiple consecutive
  ANALYST segments.

  Manuscript uses DISPLAY form (numerals, dashes, slashes natural).
  phonetics.spell_out() produces the spelled-out tts.text at generate
  time. See scripts/phonetics.py.

  Editorial voice (Ep 6): MACRO PIVOT. From Ep 5's intimate intro to
  the opposite end — politics, capital, watts, silicon. Skeptical-not-
  cynical. Real figures every time a hand-wave shows up. NO PR voice.
  Frame structural forces, not product news.

  Spine: Anthropic's Mythos/Fable withdrawal as the lead (Commerce
  pulled a US model in 72 hours); Stargate PR-vs-ground-truth (11 GW
  announced, 200 MW operational; Doña Ana $18B with zero shovels);
  Oracle as the visible bag-holder ($553B in promises, $134B in debt,
  one customer); US vs China cliché-killer (HBM is the bottleneck, not
  logic — 13M stacks stockpiled, enough for 1.6M Ascend packages);
  the 72-hour-vs-380-day asymmetry (Commerce moves fast on a model,
  slow on chip exports — SE Asia smuggling corridor); concept of the
  week is Remaining Performance Obligations, the accounting line that
  reveals the bag-holder.

  NO 1-word HOST counter segments (see feedback_no_one_word_host_segments.md).
  NO "flagging" / "worth flagging" (see feedback_avoid_flagging_word.md).
  All quoted figures verified in /tmp/claude-1000/.../w88b32ama.output.
---

**HOST:** Welcome to AI This Week.

**HOST:** I am Vindy.

**HOST:** With me, as always, is Ron.

**ANALYST:** Good to be here, Vindy.

**HOST:** Today is Sunday, June 21, 2026.

**HOST:** Last week we talked about ourselves; today we go the other direction — all the way out to the centers of power.

**HOST:** Who controls AI deployment, who pays for the buildout, who owns the silicon.

**HOST:** Coming up — the U.S. Commerce Department pulled an American model from public use last Friday, and we're going to start there.

**HOST:** Then the data center buildout, where the announcements and the ground truth do not match.

**HOST:** Then the U.S. and China comparison, with the cliché replaced by the actual binding constraint.

**HOST:** And the concept of the week — a single line on Oracle's balance sheet that tells you almost everything.

**HOST:** Ron, let's begin with Anthropic.

**HOST:** What happened on June twelfth.

**ANALYST:** At five twenty-one p.m. Eastern on Friday, June twelfth, Anthropic took its two newest models — Claude Mythos five and Claude Fable five — offline.

**ANALYST:** Not for maintenance, not for a safety review of their own initiative.

**ANALYST:** They took them down because the U.S. Commerce Department issued a directive citing export controls.

**HOST:** What was the technical reason.

**ANALYST:** A jailbreak was demonstrated, reportedly by another company, that produced output Commerce considered export-controlled.

**ANALYST:** Fortune reported that Amazon was the one that alerted the White House to it.

**HOST:** And how did Anthropic respond.

**ANALYST:** Anthropic publicly disputes the rationale.

**ANALYST:** Their statement called the jailbreak — and I am quoting — "narrow, non-universal," and added that the same output is available from other models, including OpenAI's GPT-five-point-five.

**ANALYST:** Their summary line: "the government's action is based on a misunderstanding."

**HOST:** That is an unusually direct disagreement with the U.S. government for an AI lab.

**ANALYST:** It is, and the structural fact underneath it is the headline.

**ANALYST:** Commerce can now order a private American AI lab to take a model offline, citing export controls, and that order lands within seventy-two hours.

**HOST:** Whether or not you think the order was right.

**ANALYST:** Whether or not you think the order was right.

**ANALYST:** The authority itself, the speed, and the precedent are what matter.

**HOST:** And Amazon's role here.

**ANALYST:** That is the part to watch.

**ANALYST:** Amazon is a major Anthropic investor and also competes with Anthropic in the foundation model market through its own work.

**ANALYST:** If a competitor's warning to government can take a rival's model offline in a long weekend, that is a new shape for industry dynamics.

**HOST:** Let's move to the buildout.

**HOST:** Stargate — the OpenAI, Oracle, SoftBank data center initiative.

**HOST:** What are the actual numbers.

**ANALYST:** Stargate has announced eleven gigawatts of U.S. capacity.

**ANALYST:** As of mid-June, about two hundred megawatts is operational, at the Abilene Texas site, Phase One.

**HOST:** Eleven gigawatts announced, two hundred megawatts plugged in.

**HOST:** That is the entire gap in one line.

**ANALYST:** It is, and the cleanest example sits in New Mexico.

**ANALYST:** The Doña Ana County site is the largest single Stargate campus, slated at four-point-five gigawatts.

**ANALYST:** Eighteen billion dollars of syndicated project financing is in place — Sumitomo Mitsui, BNP Paribas, Goldman Sachs, MUFG — plus a three billion dollar equity check from Blue Owl.

**HOST:** And the construction status on the ground.

**ANALYST:** Zero shovels in the ground so far.

**ANALYST:** The site is waiting on an air-quality permit from the New Mexico Environment Department, originally expected April twenty-second, now pushed to July twenty-first after more than seven thousand public comments.

**HOST:** Eighteen billion dollars committed, zero shovels in the ground, one air-quality permit deadline.

**HOST:** Who is the bag-holder if the numbers do not pencil out.

**ANALYST:** That is where Oracle gets interesting.

**ANALYST:** Oracle's Remaining Performance Obligations — the accounting line that records contracted revenue not yet delivered — hit five hundred fifty-three billion dollars in Q three fiscal twenty-twenty-six.

**ANALYST:** That is up three hundred twenty-five percent year over year, and the majority of that bump is publicly identified with OpenAI and Stargate.

**HOST:** And the debt side.

**ANALYST:** Total borrowings reached one hundred thirty-four-point-six billion dollars as of February twenty-eighth.

**ANALYST:** Oracle raised thirty billion in February alone — investment-grade bonds plus mandatory convertible preferred — and issued forty-three billion dollars of new senior notes over the nine-month period.

**HOST:** So summarize the position.

**ANALYST:** Five hundred fifty-three billion dollars in promises, one hundred thirty-four billion dollars in debt, and one big customer carrying most of the risk.

**HOST:** That is the structure of the buildout in one sentence.

**HOST:** Let's go to the U.S. and China comparison.

**HOST:** The cliché is China is some number of months behind.

**ANALYST:** The cliché is wrong because it measures the wrong thing.

**ANALYST:** On Monday, June ninth, Bloomberg reported a draft Chinese plan from the National Development and Reform Commission — two trillion yuan, roughly two hundred ninety-five billion dollars, for a nationwide AI data center grid by twenty twenty-eight.

**ANALYST:** The plan mandates eighty percent domestic silicon and would be operated as one interconnected compute fabric by China Mobile and China Telecom.

**HOST:** And where is the catch in that plan.

**ANALYST:** Two trillion yuan, eighty percent domestic silicon, twenty twenty-eight deadline — and the catch is that the binding constraint is not logic chips, it is high-bandwidth memory.

**HOST:** Walk us through that.

**ANALYST:** Every AI accelerator needs HBM stacks bolted onto the logic die.

**ANALYST:** Without HBM, the chip is a paperweight.

**ANALYST:** China stockpiled about thirteen million HBM stacks before export controls closed — eleven-point-four million from Samsung alone.

**ANALYST:** At Huawei Ascend nine-ten C packaging ratios, that stockpile is enough for roughly one-point-six million chips.

**HOST:** And then the supply runs out.

**ANALYST:** Then the supply runs out — thirteen million HBM stacks, enough for one-point-six million chips, and that is the ceiling.

**ANALYST:** Domestic Chinese HBM, from CXMT, is on pace for about two million stacks in twenty twenty-six — enough for maybe two hundred fifty to three hundred thousand accelerators.

**HOST:** So Huawei's silicon plans look like what.

**ANALYST:** Bloomberg, citing Huawei's plans, put twenty twenty-six output at six hundred thousand nine-ten C chips, with the broader Ascend product line reaching up to one-point-six million dies total.

**ANALYST:** That number, six hundred thousand, is a target, not shipped output.

**ANALYST:** And separately, before export controls cut them off, Huawei accumulated more than two-point-nine million Ascend dies fabbed at TSMC through Sophgo and Bitmain shell companies.

**ANALYST:** The export-controls-work narrative has a two-point-nine-million-die hole in it.

**HOST:** Let's run the headlines, fast clip.

**HOST:** First headline this week, Broadcom.

**ANALYST:** Broadcom's market capitalization is right around two trillion dollars.

**ANALYST:** Their CEO, Hock Tan, reiterated a one hundred billion dollar A.I. semiconductor revenue target for fiscal twenty-twenty-seven on the June third earnings call, backed by about seventy-three billion dollars in A.I. backlog and long-term agreements with Alphabet and Meta extending to twenty thirty-one.

**ANALYST:** Two trillion dollar market cap, hundred-billion-dollar A.I. revenue target, almost no retail brand recognition.

**HOST:** Second headline this week, ASML.

**ANALYST:** ASML, the Dutch company that builds the lithography machines all leading-edge logic depends on, sells its High-N.A. E.U.V. system for about three hundred seventy million dollars.

**ANALYST:** Global production capacity is fewer than twenty units per year.

**ANALYST:** Three hundred seventy million dollars a machine, fewer than twenty machines a year, one company makes them — that is the actual chokepoint on global silicon, not policy.

**HOST:** Third headline this week, export controls.

**ANALYST:** Commerce rescinded the Biden-era A.I. Diffusion Rule on May thirteenth, twenty twenty-five, and did not issue new B.I.S. enforcement clarification until May thirty-first, twenty twenty-six.

**ANALYST:** That is a roughly year-long window where the licensing requirements were not actively enforced.

**HOST:** So count the days.

**ANALYST:** Seventy-two hours to shut down a U.S. model, three hundred eighty days to enforce a chip export rule — that asymmetry is the show.

**HOST:** And where did the chips go in those three hundred eighty days.

**ANALYST:** Southeast Asia is where most of them went.

**ANALYST:** The Justice Department unsealed indictments in late March alleging Nvidia H one-hundred and A one-hundred chips were routed through Malaysian and Singaporean intermediaries.

**ANALYST:** Fortune published encrypted texts in May showing the logistics, and Super Micro is implicated in a two-and-a-half-billion-dollar shell-company case.

**ANALYST:** The Trump administration is reportedly drafting new chip-export curbs aimed specifically at Malaysia and Thailand.

**HOST:** So the picture in one line.

**ANALYST:** The chips do not fly to Shenzhen — they fly to Penang and Singapore first.

**HOST:** Concept of the week — Remaining Performance Obligations.

**ANALYST:** R.P.O. is an accounting line that records the dollar value of contracts a company has signed but has not yet delivered against.

**ANALYST:** It is forward-looking — it tells you about future revenue, not money in the bank today.

**HOST:** And why does it matter for Oracle.

**ANALYST:** Because five hundred fifty-three billion dollars of R.P.O., concentrated heavily in one customer for one buildout, means Oracle has promised to deliver an enormous amount of compute over the next several years against a customer whose own revenue model is still being argued over.

**ANALYST:** If those contracts deliver, Oracle has the deal of the decade.

**ANALYST:** If they slip — or get renegotiated — Oracle is carrying the debt while the contracts shrink.

**HOST:** So when you see an R.P.O. number in a tech filing.

**ANALYST:** Read who the customers are, how concentrated the obligations are, and what would have to happen for the company to actually deliver them.

**ANALYST:** R.P.O. is where the bag-holders show up in the footnotes.

**HOST:** Good place to land.

**HOST:** Ron, thank you for the rundown.

**ANALYST:** Anytime, Vindy — good to be here.

**HOST:** That was AI This Week for June twenty-first, twenty twenty-six.

**HOST:** Next week, back to the open-weights and small-lab beat.

**HOST:** Until next Sunday, take care.
