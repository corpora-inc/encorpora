# Dynawalla — Playtest protocol

This lands in the bootstrap, not at M2, because **recruitment and consent take weeks**.
Starting them at M2 makes the M2 gate unreachable on schedule, and an unreachable gate is
a waived gate.

Three gates use this protocol: **M2** (`T-01`, `T-02`, `T-03`), **M6** (`T-04`), **M8**
(`T-05`). Each produces a committed report — `PLAYTEST-M2.md`, `PLAYTEST-M6.md`,
`PLAYTEST-M8.md` — in this directory. **None may be waived** (`T-06`).

## Why this is the binding instrument

Apple's Kids Category (1.3 / 5.1.4) bars third-party analytics and behavioural
advertising, and the UK Children's Code restricts nudge techniques and using children's
data to keep them on a platform. **The feel cannot be A/B tested remotely.** There is no
substitute instrument, so scheduled in-person sessions are the measurement, not a
supplement to it. See [ADR-0017](DECISIONS/ADR-0017-human-evaluation-resourcing.md).

---

## 1. Cohort

**Minimum 6 children, aged 6–11**, with **at least 2 who dislike math** — self-reported
by the child or reported by the parent. The second condition is not decoration: a cohort
of children who enjoy arithmetic will find almost any competent drill app acceptable and
will tell you nothing about the product's actual claim.

**At least one must be a grade-1 child who cannot yet read.** This is a recruitment
requirement, not a preference. Read-aloud is argued into M2 rather than M9 on exactly
that child's behalf, and `Q-11` is the only item that tests it — a cohort starting at 7
leaves `Q-11` with no instrument, which is how an unwaivable gate gets quietly waived.

Aim for:

- a spread across the age range rather than six 9-year-olds;
- at least one child at each end of fluency (one who counts on fingers, one who recalls);
- at least one child who has used a math app before and can compare.

**The same cohort returns for M6 and M8.** Longitudinal comparison is most of the value:
"did the same child come back, and did they remember what they were building."
Recruit 8 to retain 6.

**Devices.** Sessions run on the named reference devices — Samsung Galaxy Tab A9
SM-X110 (4 GB), Pixel 6a, iPad 10th gen — from a **TestFlight or Play-internal build**,
never a dev server. A child on a laptop with a hot-reloading dev build is testing a
different product.

**Exclusions.** No child of anyone on the program. Not because of ethics theatre — a
child who wants the adult to be pleased produces unusable verbatims.

---

## 2. Consent and data handling

Consent must be documented **before the first session** under COPPA and, for any UK
participant, the UK Children's Code. Template in §6. **Have it reviewed by counsel before
use** — the template below is a starting point, not legal advice.

Data rules, which are stricter than the regulation and deliberately so:

- **No video or audio recording of the child.** Written observation only.
- **No child's name in any committed artifact.** Children are `C1`..`C8` in every report.
  The mapping lives offline with the founder, never in this repository.
- **No account, no upload, no telemetry.** Sessions use local device state only; the app
  has no server profile.
- **Devices are wiped between children** (fresh profile, or app data cleared) so one
  child's progress never seeds another's session.
- **Withdrawal is honoured immediately and retroactively** — on request, that child's
  observations are removed from the report and the report is amended in a normal PR.
- Only two things leave the room: the structured observations in §4, and verbatim quotes
  with no identifying content.

---

## 3. Session protocol

**Two sessions per child per gate, 20 minutes each, on separate days**, at least one day
apart. Sessions are **unsupervised**: the observer is in the room, not at the child's
shoulder.

**Six-year-olds.** Same protocol, three adjustments. The framing sentence is spoken, not
handed over on paper. The session ends at 20 minutes rather than 30 if the child is still
going, because a six-year-old will keep going past the point the measurement means
anything. And the consent conversation happens with the parent present in the room — the
child's own assent is asked for separately, in one sentence, and a "no" ends it. For the
`Q-11` observation, record whether the child ever tapped the read-aloud control
unprompted, and what they did when a prompt they could not read appeared.

**Setup (observer, before the child arrives)**

1. Reference device, store build, build number written down.
2. Fresh profile. Sound on, headphones available. Reduced motion off unless the child
   uses it.
3. Note the child's id, age, and the "likes/dislikes math" flag from recruitment.

**Session**

1. **One sentence of framing, identical every time:** "This is a maths thing someone is
   building. You can stop whenever you want. I'm going to sit over there." Then sit
   somewhere the child cannot read your face.
2. **Do not help.** Do not explain the interface. Do not answer "what do I do now?" with
   anything except "whatever you want — or you can stop." Every question the child has to
   ask is a finding.
3. **Do not stop the child at 20 minutes.** The clock is a measurement, not a limit.
   Note the 20-minute mark and let them continue if they want to.
4. **End when the child stops**, or at 30 minutes, whichever comes first.
5. **One question afterwards, and only one, chosen per gate:**
   - M2: "What happened when you got one wrong?"
   - M6: "What are you building, and why did you pick that one?"
   - M8: "Was there a bit where you figured out what you'd been doing wrong?"

**Next day (M2 and M6 only).** The device is left with the family overnight where
possible. Record whether the child opened the app again **without being asked**. That
single number is worth more than the rest of the session.

---

## 4. What is recorded

Per child, per session. Everything here is observable — no inference, no scoring of the
child.

| Field | How |
|---|---|
| `childId`, age, dislikes-math flag | from recruitment |
| device, build number, store channel | written before the session |
| session number (1 or 2), date | |
| **time to voluntary quit** | stopwatch from first problem to the child stopping; note if they were still going at 30 min |
| problems attempted / correct | from the on-device Developer Mode summary, not by hand |
| **unprompted verbatims** | written down as spoken, including the boring ones |
| moments the child asked the observer a question | with the question |
| moments the child looked away, sighed, or slumped | timestamp + what was on screen |
| **what the child did after each wrong answer** | one of: retried, asked for the answer, studied the contrast, ignored it, quit |
| **next-day voluntary return** | yes / no |
| anything the child did that the design did not anticipate | free text |

**Per gate, additionally:**

- **M2** — the specific counts behind `T-02`: how many of the six children, unprompted,
  did something after a wrong answer *other than* ask for the answer. And the raw
  response data needed for `T-03`: per-item correctness with the predicted `b()` for each
  item served, exported from Developer Mode, so residuals can be fitted against predicted
  difficulty and committed as an engine fixture.
- **M6** — whether each child can say, unprompted, **what** they are building and **why
  they chose it**; and whether the chosen-chamber mechanic visibly changed what they did.
- **M8** — for each child, the accuracy of their **next attempt at the same mal-rule
  class** after a LOCATE contrast pair, versus after a Stage-1 verify. This is the
  product's thesis and it is measured, not assumed.

## 5. Reporting and authority

Each gate's report is a committed markdown file in this directory containing: the cohort
table (ids only), the raw per-session records above, the verbatims, the gate verdict, and
**an explicit statement of what the sessions falsified**.

A report that finds nothing wrong is a suspicious report. Write down the thing that
went badly even when the gate passes.

**These gates have kill/revise authority.** If M2's cohort shows the LOCATE contrast pair
reading as punishment, LOCATE is revised before M7 spends on content breadth. If M8 shows
no advantage over a Stage-1 verify, **LOCATE is revised or cut** — that is the whole
thesis, and cutting it is a legitimate outcome of the measurement.

A gate is not passed by a majority of observers feeling good about it. It is passed by
the numbers in `T-01`..`T-05`.

---

## 6. Parental consent template

**Draft. Review with counsel before use.** Placeholders in `[brackets]` must be filled;
do not ship the template with a placeholder in it.

> **Consent for a child to try a maths app in development**
>
> **What this is.** `[Organisation]` is building a maths practice app for children. We
> would like your child to try it and tell us what they think. It is not a test of your
> child, and nothing about their performance is reported to you, to a school, or to
> anyone else.
>
> **What happens.** Your child uses the app on a tablet or phone we provide, for about
> 20 minutes, on two separate days. An adult stays in the room but does not help or
> watch over their shoulder. Your child can stop at any time, for any reason, without
> giving one.
>
> **What we write down.** How long your child chose to keep playing, what they said out
> loud, what they did after they got a question wrong, and how many questions they
> answered. We do **not** record video or audio. We do **not** write down your child's
> name — they are identified only by a code in our notes.
>
> **What we do not collect.** No account, no email address, no location, no advertising
> identifier, no photographs. The app sends nothing to any server. There is no
> third-party analytics or advertising in it, and there never will be.
>
> **Where it goes.** The written observations are used to decide how to build the app.
> Anonymised summaries and quotes may appear in our public development notes. Nothing
> that could identify your child ever appears anywhere.
>
> **Withdrawal.** You or your child can withdraw at any time, including after the
> session. Email `[contact]` and we will delete your child's observations and correct
> any published summary. You do not have to give a reason.
>
> **How long we keep it.** Written observations are kept for `[retention period]` and
> then destroyed. The code-to-name mapping is held only by `[named person]`, offline, and
> is destroyed at the end of the study.
>
> **Contact.** `[named person]`, `[contact]`.
>
> ---
>
> I am the parent or legal guardian of `[child's name]`, aged `[age]`.
> I have read the above and I consent to my child taking part.
>
> Parent/guardian name · Signature · Date
>
> `[  ]` I also consent to anonymised quotes from my child appearing in public
> development notes. *(Optional — participation does not depend on this.)*

Ask the child too, in their own words, at the start of the first session. A child who
does not want to is not a participant, whatever the form says.
