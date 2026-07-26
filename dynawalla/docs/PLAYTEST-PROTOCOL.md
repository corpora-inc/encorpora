# Dynawalla — Playtest protocol

Three gates use this protocol: **M2** (`T-01`, `T-02`, `T-03`), **M6** (`T-04`), **M8**
(`T-05`). Each produces a committed report — `PLAYTEST-M2.md`, `PLAYTEST-M6.md`,
`PLAYTEST-M8.md` — in this directory. **None may be waived** (`T-06`).

## Why this is the binding instrument

Apple's Kids Category (1.3 / 5.1.4) bars third-party analytics and behavioural
advertising, and the UK Children's Code restricts nudge techniques and using children's
data to keep them on a platform. All Dynawalla instrumentation is on-device and there is
no telemetry endpoint. **The feel therefore cannot be A/B tested remotely.** Direct
observation is the measurement, not a supplement to it.

---

## 1. Who

**One child evaluator: the founder's son, age 10.** The founder observes, and holds
every adult role this protocol calls for — art director, design authority, product owner
and QA. Recorded in [ADR-0017](DECISIONS/ADR-0017-human-evaluation-resourcing.md).

That ADR is the honest account of what a sample of one, in the builder's own household,
can and cannot support. The two-sentence version: it is the highest-signal instrument
available and far better than none, and it licenses **no** generalizable engagement
claim, **no** efficacy claim, and **no** coverage claim for the grade 1–2 end of the
curriculum, which will ship unobserved unless a younger evaluator is added.

**Devices.** Sessions run on the named reference devices — Samsung Galaxy Tab A9
SM-X110 (4 GB), Pixel 6a, iPad 10th gen — from a **TestFlight or Play-internal build**,
never a dev server. A child on a laptop with a hot-reloading dev build is testing a
different product.

**The same child returns at M6 and M8.** Longitudinal comparison is most of the value
this instrument has: did he come back, and does he remember what he was building. The
cohort-attrition hazard the external plan carried does not exist here.

---

## 2. Data handling

The founder is the parent, so there is no consent paperwork, no template and no counsel
review. Ask the child himself, in one sentence, at the start of the first session; a
child who does not want to is not a participant.

The data rules below are stricter than the regulation, and they matter **more** here
rather than less: **this repository is public**, and a child identified by relationship
to a named founder is identified.

- **No video or audio recording of the child.** Written observation only.
- **No child's name in any committed artifact.** The evaluator is `C1` in every report.
- **No age-adjacent detail** that narrows identification beyond what
  [ADR-0017](DECISIONS/ADR-0017-human-evaluation-resourcing.md) already states.
- **No account, no upload, no telemetry.** Sessions use local device state only; the app
  has no server profile.
- **Fresh profile per session-set** so a previous gate's progress never seeds a later
  session's starting difficulty.
- Only two things leave the room: the structured observations in §4, and verbatim quotes
  with no identifying content.

---

## 3. Session protocol

**Two sessions per gate, 20 minutes each, on separate days**, at least one day apart.
Sessions are **unsupervised**: the observer is in the room, not at the child's shoulder.

**Setup (observer, before the session)**

1. Reference device, store build, build number written down.
2. Fresh profile. Sound on, headphones available. Reduced motion off unless the child
   uses it.
3. Note the device and which gate this is.

**Session**

1. **One sentence of framing, identical every time:** "This is a maths thing someone is
   building. You can stop whenever you want. I'm going to sit over there." Then sit
   somewhere the child cannot read your face.
2. **Do not help.** Do not explain the interface. Do not answer "what do I do now?" with
   anything except "whatever you want — or you can stop." Every question the child has to
   ask is a finding.
3. **Do not stop the child at 20 minutes.** The clock is a measurement, not a limit.
   Note the 20-minute mark and let him continue if he wants to.
4. **End when the child stops**, or at 30 minutes, whichever comes first.
5. **One question afterwards, and only one, chosen per gate:**
   - M2: "What happened when you got one wrong?"
   - M6: "What are you building, and why did you pick that one?"
   - M8: "Was there a bit where you figured out what you'd been doing wrong?"

**Next day (M2 and M6).** The device stays in the house, which it does anyway. Record
whether the child opened the app again **without being asked**. That single fact is worth
more than the rest of the session.

---

## 3a. Bias, and what is actually done about it

The observer built the product and is the child's parent. That is the instrument's
central defect and it cannot be designed away, only contained. What containment looks
like:

- **The framing sentence is fixed and minimal**, delivered identically every time, and
  the observer then sits where the child cannot read his face. Approval leaks through
  expression faster than through words.
- **Praise is not evidence.** A child who wants a parent to be pleased will say the app
  is good. Verbatims of approval are recorded for the record and **may not be cited as
  the pass condition for any gate**. Gates key on behaviour: how long he chose to keep
  going, whether he came back the next day unprompted, and what he did after a wrong
  answer. Those are harder to hand over to please someone.
- **The report states what the sessions falsified**, not what they confirmed (§5). A
  report with no negative finding is treated as a failed observation, not a clean one.
- **Every count is reported as a raw count with n = 1 attached**, never as a rate or a
  proportion. "1 of 1" is not 100%.

---

## 4. What is recorded

Per session. Everything here is observable — no inference, no scoring of the child.

| Field | How |
|---|---|
| `childId` (`C1`) | fixed |
| device, build number, store channel | written before the session |
| session number (1 or 2), date | |
| **time to voluntary quit** | stopwatch from first problem to the child stopping; note if he was still going at 30 min |
| problems attempted / correct | from the on-device Developer Mode summary, not by hand |
| **unprompted verbatims** | written down as spoken, including the boring ones and the discouraging ones |
| moments the child asked the observer a question | with the question |
| moments the child looked away, sighed, or slumped | timestamp + what was on screen |
| **what the child did after each wrong answer** | one of: retried, asked for the answer, studied the contrast, ignored it, quit |
| **what the child skipped or avoided** | including anything he found a way around |
| **next-day voluntary return** | yes / no |
| anything the child did that the design did not anticipate | free text |

**Per gate, additionally:**

- **M2** — the per-wrong-answer breakdown behind `T-02`: for every wrong answer across
  both sessions, which of the five responses above occurred. And the raw response data
  for `T-03`: per-item correctness with the predicted `b()` for each item served,
  exported from Developer Mode. One child's residuals cannot calibrate `b()`; they can
  show a gross mismatch, and that is the whole claim made for them.
- **M6** — whether the child can say, unprompted, **what** he is building and **why he
  chose it**; and whether the chosen-chamber mechanic visibly changed what he did.
- **M8** — the accuracy of his **next attempt at the same mal-rule class** after a LOCATE
  contrast pair, versus after a Stage-1 verify. This is the product's thesis. With one
  child it is an observation, not a measurement, and the report says so in those words.

---

## 5. Reporting and authority

Each gate's report is a committed markdown file in this directory containing: the
per-session records above, the verbatims, the gate verdict, and **an explicit statement
of what the sessions falsified**.

A report that finds nothing wrong is a suspicious report. Write down the thing that
went badly even when the gate passes.

**These gates have kill/revise authority.** If M2 shows the LOCATE contrast pair reading
as punishment, LOCATE is revised before M7 spends on content breadth. If M8 shows no
advantage over a Stage-1 verify, **LOCATE is revised or cut** — that is the whole thesis,
and cutting it is a legitimate outcome of the observation.

A gate is not passed by the observer feeling good about it. It is passed by the recorded
behaviour in `T-01`..`T-05`, with n = 1 stated next to every number.

## 6. What this protocol does not cover

Named here so it is not mistaken for covered:

- **Grade 1–2 content and pre-reader flows.** Read-aloud as a primary input path,
  icon-only affordances and small-hand touch targets will ship with no child
  observation behind them. `Q-11` is an adult-proxy device check for exactly this
  reason. See [ADR-0017](DECISIONS/ADR-0017-human-evaluation-resourcing.md) and
  [RISKS.md](RISKS.md) R-46.
- **Accessibility needs nobody in the household has.** `Q-09` (VoiceOver / TalkBack) and
  `Q-10` (text alternatives, nothing solvable by colour alone) are the instruments there.
- **Anything about a population.** No rate, no proportion, no comparison to other
  products, no learning-gain claim.
