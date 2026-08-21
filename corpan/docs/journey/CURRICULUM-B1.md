# Journey `journey_en` — Arc 3 (CEFR B1) Curriculum Design

Status: authoring-ready (2026-07-06), live census against `dja/release.sqlite3` + 37 on-disk phrases.json.
Companion: `CURRICULUM-A2.md`. Same shipped-YAML discipline: clone `courses/en/units/a1-u10-she-works.yaml`'s
shape. Owner constraint (binding): one EN course consumable from all 54 L1s — everything below the overlay line is
L1-NEUTRAL; the es overlay (§6) is enrichment keyed by node ref.

## 1. Live B1 census

3,400 B1 entries; ES coverage 100% (3,400/3,400; B2 800/800). Domains: everyday 1,565 · social 1,296 ·
business 561 · education 516 · culture 430 · travel 425 · health 310 · technology 270 · environment 244 ·
housing 231 · civic 194 · emergency 164 · numbers 66.

Grammar-shaped pools: passive 189 (healthy) · if-clauses 155 (healthy) · reported speech 120 (healthy; 180 wide) ·
relative where/whose/", which" 34 · wish/If-only 38 wide (noisy) · gerund/infinitive-contrast verbs 25 · would 21
strict (35 wide, THIN) · too…to/so…that 21 (thin) · past perfect 9 strict (56 noisy wide, THIN) · present perfect
continuous 12 (30 wide, THIN) · modal deduction 8 (THIN) · second conditional 7 (STARVED; verified ids 9631,
10165, 11163, 12361, 21260) · used-to/would-past 7 combined (STARVED) · question tags 1 (ABSENT).

Headline: the base corpus is thematically B1 but grammatically conservative. THREE gap packs are on the critical
path (§5 note; they now exist in `corpan/tools/phrase-packs/`): `phrase-life-then-and-now` (past habits;
before/after/by-the-time; how-long durations; life changes), `phrase-life-what-if` (second conditional; wishes;
if-I-were-you; imagined futures), `phrase-social-small-talk` (question tags; so/neither echoes; deduction; polite
indirect inquiries). Each 140 phrases, A2/B1/B2 mixed, 4 facets × 35.

Pack B1 fuel: DEPTH packs 144–145 B1 each (music, mythology, philosophy, learning, cooking, family, festivals,
health, ocean, places); WIDE packs 90 B1 (cinema, geology, economics, camping, night, birds, astronomy,
martial-arts, soccer, tech, travel, vehicles, work-office). CORRECTION: `phrase-professional-*` hold only 12 B1
each (25 construction) — garnish for u26 only.

## 2. Arc definition

```yaml
  - id: en.arc3
    index: 3
    cefr: B1
    title: "Independence"
    gate:
      pass_score: 0.8
      params:
        spacedSampleShare: 0.3
        require: [produce.speak, input.listen]
```

Shape: 27 teach units (`en.b1.u01`–`u27`) + consolidation u28 + integrative production u29 + arc gate u30 = 30
units. Mini-gates ride u09 and u18 bosses. Files `b1-uNN-slug.yaml`, arc `en.arc3`. New-word rank window
2,500–4,500; cumulative `vocab_band.hi` steps 4,300 → 6,000 (~+65/unit). Input share rises: 8 earthgate/
segment-player anchors + dialog-heavy lesson mixes.

## 3. B1 grammar-node graph — 42 nodes (orders 84–125)

`b` ramps −0.8 → −0.1. Briefs L1-neutral, ≤2 sentences.

| id (`en.gn.`) | ord | title | note-seed | prereqs | b | home |
|---|---|---|---|---|---|---|
| `narrative-tenses` | 84 | Telling a story in the past | Weave past simple (events), past continuous (background), and sequencers (first, then, finally) into one story. | past-simple-vs-cont | −0.8 | u01 |
| `used-to-vs-would` | 85 | used to / would (past habits) | Both mark repeated past actions: "We would swim every summer." Only used to works for past states. | used-to | −0.8 | u01 |
| `past-perfect` | 86 | Past perfect | had + past participle for the earlier of two past events: "The train had left when I arrived." | past-irreg-top25, narrative-tenses | −0.7 | u02 |
| `past-perfect-vs-past` | 87 | Order of past events | Past perfect marks the step before; after before/after/by the time the order is often clear without it. | past-perfect | −0.7 | u02 |
| `pres-perf-cont` | 88 | Present perfect continuous | have/has been + -ing for actions still running or just stopped: "I've been waiting for an hour." | pres-perf-vs-past, for-since | −0.7 | u03 |
| `perf-cont-vs-simple` | 89 | Result or duration? | "I've painted the room" (result) vs "I've been painting" (activity, maybe unfinished). | pres-perf-cont | −0.6 | u03 |
| `superl-perf-ever` | 90 | The best I've ever… | Superlative + present perfect: "It's the best film I have ever seen." | comp-superl, pres-perf-exp | −0.7 | u04 |
| `articles-deep` | 91 | Articles: the finer rules | the + unique/superlatives/rivers; zero article for meals, languages, most streets; a/an for jobs and rates. (late_acquired) | art-the | −0.6 | u04 |
| `future-cont` | 92 | Future continuous | will be + -ing for an action in progress at a future time: "This time tomorrow I'll be flying." | will-predict, pres-cont | −0.6 | u05 |
| `shall-suggest` | 93 | Shall we…? | Suggestions and offers with I/we: "Shall we start? Shall I open the window?" | will-decide-offer | −0.6 | u05 |
| `cond-second` | 94 | Second conditional | if + past, would + verb — imagined present/future: "If I had more time, I would travel." | cond-first, past-reg | −0.6 | u06 |
| `cond-first-vs-second` | 95 | Real or imagined? | First conditional = possible plan; second = imagined. "If it rains…" vs "If I won the lottery…" | cond-second | −0.5 | u06 |
| `wish-past` | 96 | wish + past | Wishes about now use past forms: "I wish I had a garden. I wish I could stay." | cond-second | −0.5 | u07 |
| `if-only` | 97 | If only | A stronger wish: "If only it were warmer." Same past-form machinery as wish. | wish-past | −0.5 | u07 |
| `unless` | 98 | unless | unless = if…not: "We'll miss it unless we leave now." | cond-first | −0.5 | u08 |
| `in-case-as-long-as` | 99 | in case / as long as | in case = preparation for a possibility; as long as = on condition that. | unless | −0.5 | u08 |
| `modal-deduction` | 100 | must / might / can't be | Deduction now: "It must be cold out. She can't be home yet. He might be busy." | might-may, must-mustnt | −0.5 | u09 |
| `had-to` | 101 | had to / will have to | Obligation moves through time: "I had to wear a uniform. You'll have to book early." | have-to, past-reg | −0.5 | u10 |
| `be-allowed-to` | 102 | be allowed to | Permission in any tense: "We weren't allowed to talk in class." | can-request, had-to | −0.4 | u10 |
| `make-let` | 103 | make / let + bare verb | "They made us wait. She let me drive." — object + verb with no to. | infinitive-after-verbs | −0.4 | u11 |
| `verb-obj-inf` | 104 | want someone to do | want/ask/tell/expect + object + to-infinitive: "I want you to listen." | make-let | −0.4 | u11 |
| `passive-present` | 105 | Present passive | be + past participle when the doer matters less: "Rice is grown here." | pres-simple-3sg, past-irreg-top25 | −0.4 | u12 |
| `passive-past` | 106 | Past passive | "The bridge was built in 1900. The letters were sent yesterday." | passive-present, past-be | −0.4 | u13 |
| `passive-by` | 107 | by + doer | Add the doer only when it's the news: "It was painted by my sister." | passive-past | −0.3 | u13 |
| `reported-statements` | 108 | Reported speech: statements | Step the tense back: "I'm tired" → "She said (that) she was tired." | past-quest-neg, pres-perf-vs-past | −0.4 | u14 |
| `say-vs-tell` | 109 | say / tell | tell needs a person (tell me); say doesn't (say that…). | reported-statements | −0.3 | u14 |
| `reported-questions` | 110 | Reported questions | Question order flattens: "Where do you live?" → "He asked where I lived." if/whether for yes-no. | reported-statements, question-words-deep | −0.3 | u15 |
| `reported-commands` | 111 | Reported requests & commands | tell/ask + object + to-infinitive: "She told me to wait. He asked us not to call." | reported-questions, verb-obj-inf | −0.3 | u15 |
| `rel-where-whose` | 112 | Relatives: where / whose | "the town where I grew up", "the writer whose book won". | rel-who-which | −0.3 | u16 |
| `rel-object-omit` | 113 | Dropping the relative | Object relatives can lose who/that: "the film (that) we watched". | rel-where-whose | −0.3 | u16 |
| `verb-patterns-contrast` | 114 | remember / stop / try + -ing or to | Meaning changes with the pattern: "stop smoking" vs "stop to smoke". | gerund-after-verbs, infinitive-after-verbs | −0.3 | u17 |
| `verb-patterns-more` | 115 | suggest / avoid / mind / keep | More -ing-only verbs: "I suggest leaving early. Keep trying. I don't mind waiting." | verb-patterns-contrast | −0.2 | u17 |
| `phrasal-separable` | 116 | Separable phrasal verbs | "Turn the light on / turn it on" — pronouns go in the middle. | phrasal-verbs-1 | −0.3 | u18 |
| `phrasal-verbs-2` | 117 | Phrasal verbs II | find out, give up, carry on, look after, run out of, sort out — meaning lives in the pair. | phrasal-separable | −0.2 | u18 |
| `conn-discourse` | 118 | however / therefore / instead | Linking across sentences: "It was late. However, we kept going." | so-because-although | −0.3 | u19 |
| `in-order-to` | 119 | in order to / so that | Purpose, formal and full: "in order to save time", "so that everyone can hear". | infinitive-purpose | −0.2 | u19 |
| `echo-so-neither` | 120 | So do I / Neither do I | Agree by echoing the helper verb: "I love it." "So do I." | do-quest, can-ability | −0.2 | u20 |
| `question-tags` | 121 | Question tags | Mirror the helper and flip it: "It's cold, isn't it? You don't mind, do you?" (late_acquired) | echo-so-neither | −0.2 | u20 |
| `indef-pronouns` | 122 | somebody / anything / nowhere | some-/any-/no-/every- + body/thing/where, with the some/any polarity rules. | some-any | −0.2 | u21 |
| `adj-ed-ing` | 123 | -ed or -ing adjectives | The thing is boring; the person is bored. The -ing causes, the -ed feels. | adv-degree | −0.2 | u22 |
| `too-to-so-that` | 124 | too…to / so…that | "too tired to drive", "so tired that I slept" — result built into the adjective phrase. | too-enough | −0.1 | u23 |
| `indirect-questions` | 125 | Could you tell me where…? | Inside a polite frame the question un-inverts: "Could you tell me where the station is?" | question-words-deep, reported-questions | −0.1 | u24 |

`both/either/neither` rides u25 as pinned lexical items (no node).

## 4. Skill DAG (rooted in A2 terminals)

u01 `storytelling` grammar −0.8 ← past-vs-perfect · u02 `before-that` −0.7 ← storytelling · u03 `duration` −0.7 ←
past-vs-perfect · u04 `life-highlights` function −0.7 ← duration, comparison-adv · u05 `future-detail` −0.6 ←
arrangements · u06 `hypotheticals` −0.6 ← conditions · u07 `wishes` −0.5 ← hypotheticals · u08 `contingency` −0.5
← conditions · u09 `deduction` −0.5 ← possibility · u10 `obligation-time` −0.5 ← obligation · u11
`getting-people-to` −0.4 ← infinitives · u12 `processes` −0.4 ← phrasal-verbs · u13 `history-passive` −0.4 ←
processes · u14 `reporting` −0.4 ← questions-adv, before-that · u15 `reporting-questions` −0.3 ← reporting · u16
`defining-things` −0.3 ← relative-clauses · u17 `verb-patterns` −0.3 ← gerunds, infinitives · u18
`phrasal-mastery` −0.3 ← phrasal-verbs · u19 `discourse` −0.3 ← connectors-adv · u20 `small-talk` function −0.2 ←
questions-adv · u21 `indefinites` −0.2 ← quantity-fine · u22 `reactions` −0.2 ← adverbs · u23 `results` −0.1 ←
quantity-fine, comparison-adv · u24 `polite-inquiry` function −0.1 ← polite-requests, reporting-questions · u25
`pairs-and-choices` −0.1 ← quantity · u26 `work-life` function −0.1 ← obligation-time, verb-patterns, reporting ·
u27 `big-questions` function −0.1 ← hypotheticals, discourse. All kinds `grammar` unless marked function.

## 5. Per-unit specs

Standing conventions identical to CURRICULUM-A2.md §5 (3 probes + 4 substitutable + 5 words + 1–2 auto blocks
`level: B1, count: 10`; boss/lessons/anchor rules; probe zipf ≥ 4.3; base pins commented with english text; pack
pins record index + text). Probe levels default `('B1')`, widened to `('A2','B1','B2')` where §1 marks THIN.

- **u01 "Once upon a time"** (storytelling) — cando: tell a story with background + sequenced events; describe past habits (used to/would). band hi 4300; domains `[culture, social]` + packs mythology + festivals (auto 8 each); nodes `[narrative-tenses, used-to-vs-would]`; anchor `earthgate`; boss "Three-part story: how things used to be, what was happening, what happened." used-to pool STARVED → probes from `phrase-life-then-and-now` facet "past habits". Patterns `'%was %ing%'|'% while %'|'%used to %'|'%would always%'|'When I was%'`. Words: story, once, suddenly, meanwhile, childhood.
- **u02 "Before that"** (past perfect) — cando: order two past events; what had happened before. band hi 4360; domains `[travel, everyday]` + travel pack; nodes `[past-perfect, past-perfect-vs-past]`; anchor `earthgate`; boss "Travel mishap: what had happened before you noticed." THIN: levels `('B1','B2')`, patterns `'% had %ed%'|'% had been%'|'%had already%'|'%had left%'|'%by the time%'|'%before I%'` filtered for real participles (drop "had lunch"); top up from then-and-now facet "before/after/by the time". Words: before, after, luggage, realize, missed.
- **u03 "How long?"** (duration) — cando: how long something has been going on; result vs activity. band hi 4420; domains `[health, everyday]` + health pack; nodes `[pres-perf-cont, perf-cont-vs-simple]`; anchor `cap-pronounce`; boss "Describe symptoms/situations to a doctor: how long you've been feeling/waiting." THIN: levels `('A2','B1','B2')`, patterns `'%have been %ing%'|'%has been %ing%'|"%'ve been %"|'%been waiting%'|'%been working%'`; top up then-and-now facet "how long have you been". Words: lately, recently, ache, appointment, stress.
- **u04 "The best ever"** (life highlights) — nodes `[superl-perf-ever, articles-deep]`; band hi 4480; domains `[culture, social]` + cinema pack; anchor `lingo_hero`; boss "Personal top three: best, worst, most surprising — with reasons." Patterns `'%ever%'|'%the best%'|'%the worst%'|'%the most%'`. Words: favorite, ever, incredible, review, scene.
- **u05 "This time tomorrow"** (future detail) — nodes `[future-cont, shall-suggest]`; band hi 4540; domains `[business, education]` + work-office pack; anchor `cap-squeeze`; boss "Tomorrow's schedule: what you'll be doing when; propose one change." Patterns `'%will be %ing%'|"%'ll be %"|'Shall we%'|'Shall I%'` (thin — widen with `%tomorrow%|%next week%` frames). Words: schedule, deadline, meeting, suggest, available.
- **u06 "What would you do?"** (hypotheticals) — nodes `[cond-second, cond-first-vs-second]`; band hi 4600; domains `[everyday, social]` + gap pack `phrase-life-what-if` (PRIMARY — auto 8+); anchor `lingo_hero`; boss "Answer three what-would-you-do-if dilemmas with reasons." Base STARVED (7 hits: 9631, 10165, 11163, 12361, 21260); probes from the gap pack. Words: imagine, million, dilemma, choice, honest.
- **u07 "I wish"** (wishes) — nodes `[wish-past, if-only]`; band hi 4660; domains `[social, everyday]` + what-if pack facet "wishes" (PRIMARY); anchor `cap-pronounce`; boss "Three realistic wishes about your life now, each with a because." Patterns `'%wish %'|'If only%'` filtered `NOT LIKE '%best wishes%' AND NOT LIKE '%wish you%'`. Words: wish, regret, different, garden, quiet.
- **u08 "Just in case"** (contingency) — nodes `[unless, in-case-as-long-as]`; band hi 4720; domains `[emergency, travel]` + camping pack; anchor `corpan_city`; boss "Plan a trip with contingencies." Patterns `'%unless%'|'%in case%'|'%as long as%'` + broad `'If %'` pool recast; levels `('B1','B2')`. Words: emergency, spare, insurance, warn, prepare.
- **u09 "It must be…"** (deduction) — **MINI-GATE 1 (u01–u09)**, boss gauntlet `spacedSampleShare: 0.4`: "Solve a small mystery aloud: what must/might/can't be true and why." nodes `[modal-deduction]`; band hi 4780; domains `[social, everyday]` + packs the-night + mythology; anchor `earthgate`. THIN (8): levels `('A2','B1','B2')` + `phrase-social-small-talk` facet "guessing & deduction". Patterns `'%must be%'|"%can't be%"|'%might be%'|'%could be%'`. Words: probably, definitely, strange, guess, clue.
- **u10 "School days"** (obligation through time) — nodes `[had-to, be-allowed-to]`; band hi 4840; domains `[education]` + learning pack; anchor `lingo_hero`; boss "School then vs now: what you had to do, what students are allowed to do." Patterns `'%had to %'|'%allowed to%'|'%will have to%'|"%weren't allowed%"`. Words: uniform, strict, permission, rule, allowed.
- **u11 "Let me help"** (getting people to) — nodes `[make-let, verb-obj-inf]`; band hi 4900; domains `[social]` + family pack; anchor `corpan_city`; boss "Negotiate chores: what parents make kids do, what you want each person to do." Patterns `'%made me %'|'%let me %'|'%want you to%'|'%asked her to%'|'%told him to%'`. Words: chore, convince, expect, permission, promise.
- **u12 "How it's made"** (processes) — nodes `[passive-present]`; band hi 4960; domains `[technology, environment, everyday]` + packs economics + tech (auto 8 each); anchor `earthgate`; boss "Explain how something is made/used/produced." Pool HEALTHY (189; verified 3836). Patterns `'%is made%'|'%are made%'|'%is used%'|'%are used%'|'%is produced%'|'%is grown%'|'%is called%'`. Words: process, material, factory, produce, recycle.
- **u13 "It was built"** (history passive) — nodes `[passive-past, passive-by]`; band hi 5020; domains `[culture, travel]` + packs places + geology; anchor `earthgate`; boss "Mini-tour: when things were built, what they were used for, who designed them." (Verified 15259, 18557.) Patterns `'%was built%'|'%was made%'|'%were built%'|'%was written%'|'%was invented%'|'%was founded%'|'%was discovered%'`. Words: century, ancient, monument, discover, founded.
- **u14 "He said that…"** (reporting statements) — nodes `[reported-statements, say-vs-tell]`; band hi 5080; domains `[social, everyday]` (pool 120; verified 9193, 1727, 7371); anchor `lingo_hero`; boss "Message chain: report three people's statements accurately." Patterns `'%said that%'|'%told me%'|'%told us%'|'%said he%'|'%said she%'`. Words: message, mention, secret, promise, truth.
- **u15 "She asked me…"** (reporting questions & requests) — nodes `[reported-questions, reported-commands]`; band hi 5140; domains `[business, civic, social]`; anchor `corpan_city`; boss "Debrief an interview: what they asked, what they told you to do." Patterns `'%asked me%'|'%asked if%'|'%asked whether%'|'%asked where%'|'%told me to%'|'%asked us to%'`. Words: interview, apply, form, request, instructions.
- **u16 "The place where…"** (defining things) — nodes `[rel-where-whose, rel-object-omit]`; band hi 5200; domains `[housing, everyday]`; anchor `native` (`flip_recall`, fallback match_pairs); boss "Ideal home/neighborhood in defined pieces: the street where…, a neighbor whose…" Patterns `'% where %'|'%whose %'|'The % I %'`. Words: neighborhood, landlord, view, whose, own.
- **u17 "Stop to think"** (verb patterns) — nodes `[verb-patterns-contrast, verb-patterns-more]`; band hi 5260; domains `[education, everyday]` + learning pack; anchor `cap-squeeze`; boss "Study advice using five different verb patterns." Patterns `'%stopped %ing%'|'%remember %ing%'|'%forgot to%'|'%tried to%'|'%keep %ing%'|'%avoid %ing%'|'%suggest%'`; levels `('B1','B2')`. Words: remember, forget, avoid, suggest, habit.
- **u18 "Figure it out"** (phrasal mastery) — **MINI-GATE 2 (u10–u18)**, boss gauntlet: "Solve an everyday problem narrative using phrasal verbs." nodes `[phrasal-separable, phrasal-verbs-2]`; band hi 5320; domains `[everyday, technology]`; anchor `lingo_hero`. Levels `('A2','B1','B2')` (A2 phrasal pool recycles). Patterns `'%give up%'|'%find out%'|'%pick up%'|'%look after%'|'%run out%'|'%turn % on%'|'%put % away%'`. Words: figure, manage, solution, battery, broken.
- **u19 "On the other hand"** (discourse) — nodes `[conn-discourse, in-order-to]`; band hi 5380; domains `[civic, environment]` + economics pack; anchor `earthgate`; boss "Argue a local issue: position, however-counterpoint, therefore-conclusion." Patterns `'%However%'|'%therefore%'|'%in order to%'|'%so that%'|'%instead%'`; levels `('B1','B2')`; top up from economics/philosophy packs (connector-rich; verify at build). Words: however, therefore, argument, issue, solution.
- **u20 "Isn't it?"** (small talk) — nodes `[echo-so-neither, question-tags]`; band hi 5440; domains `[social]` + gap pack `phrase-social-small-talk` (PRIMARY — base pool ABSENT); anchor `cap-pronounce` (tag intonation: rising = real question, falling = confirmation); boss "Two-minute small-talk exchange: three tags, two echoes, natural follow-ups." Words: weather, agree, exactly, suppose, chat.
- **u21 "Somebody, somewhere"** (indefinites) — nodes `[indef-pronouns]`; band hi 5500; domains `[emergency, everyday]`; anchor `corpan_city`; boss "Report a problem: someone took something, nobody saw anything." Patterns `'%someone%'|'%anyone%'|'%nobody%'|'%anything%'|'%everything%'|'%somewhere%'`. Words: somebody, anybody, nothing, everywhere, missing.
- **u22 "Bored or boring?"** (reactions) — nodes `[adj-ed-ing]`; band hi 5560; domains `[culture, social]` + packs cinema + music; anchor `lingo_hero`; boss "Review something you watched/heard: what was exciting/disappointing, why you were excited/disappointed." Patterns `'%boring%'|'%bored%'|'%interesting%'|'%interested%'|'%exciting%'|'%excited%'|'%surprised%'|'%disappointing%'`; levels `('B1','B2')`. Words: disappointed, surprising, plot, performance, amazing.
- **u23 "Too good to miss"** (results) — nodes `[too-to-so-that]`; band hi 5620; domains `[everyday]` + packs soccer + martial-arts; anchor `cap-squeeze`; boss "Commentate a match/attempt: too slow to…, so strong that…, such a save." Patterns `'%too %to %'|'%so %that%'|'%such a%'` (21 B1) + sports packs for theme. Words: effort, exhausted, impossible, incredible, achieve.
- **u24 "Could you tell me…?"** (polite inquiry) — nodes `[indirect-questions]`; band hi 5680; domains `[travel, civic]` + travel pack; anchor `corpan_city`; boss "Get three pieces of information at a station/office using indirect questions only." Patterns `'Could you tell me%'|'Do you know %'|'%I was wondering%'|"%I'd like to know%"`; top up from small-talk pack facet "polite inquiries"; levels `('B1','B2')`. Words: wonder, information, office, platform, department.
- **u25 "Both or neither"** (pairs & choices) — `grammar_nodes: []`, review `much-many-alot, count-uncount`; skill `pairs-and-choices` carries pinned both/either/neither items; band hi 5740; domains `[everyday]` + cooking pack; anchor `native` (match_pairs); boss "Plan a menu for two people with different tastes." Patterns `'%both%'|'%either%'|'%neither%'|'%none of%'`. Words: both, neither, either, none, prefer.
- **u26 "Nine to five"** (work life; themed review-teach) — `grammar_nodes: []`, review `reported-questions, had-to, verb-obj-inf, passive-present`; band hi 5800; domains `[business]` + work-office pack + professional GARNISH (one auto block sampling ≥3 `phrase-professional-*` packs at B1 — 12 each; hospitality + sales + education recommended); anchor `corpan_city`; boss "Job interview both ways: answer, then report what you were asked and told." Patterns `'%job%'|'%interview%'|'%experience%'|'%responsible%'|'%apply%'`; levels `('B1','B2')`. Words: salary, experience, responsibility, colleague, career.
- **u27 "Big questions"** (opinions capstone; themed review-teach) — `grammar_nodes: []`, review `cond-second, conn-discourse, wish-past, modal-deduction`; band hi 5860; domains `[culture, civic]` + philosophy pack (B1 rows only — band-fit check); anchor `earthgate`; boss "Take a stance on a big question: if things were different…, however…, it must be…" Words: believe, society, freedom, argue, ethics.
- **u28 "The story so far"** — `kind: consolidate`; FSRS harvest of weakest nodes (expected cond-second vs first, backshift, question-tags, verb-pattern contrasts); `lessons: [review, review, dialog, review]`; anchor `native`; no new items.
- **u29 "Five stories"** — integrative production: spoken AND written portfolio — (1) past narrative with one past perfect, (2) a hypothetical, (3) a reported conversation, (4) a process description in passive, (5) an opinion with discourse connectors. Review lists those five node clusters; anchor `cap-pronounce`; boss `pass_score: 0.8` graded on tense control + structure variety.
- **u30 "Arc gate: B1 exam"** — `kind: gate`; adaptive checklist across all 42 B1 nodes (b −0.8…−0.1) + can-do set; PET-style task shapes; speaking rubric via STT + on-device LLM. θ̂ > 0.0 → above-content until Arc 4.

## 6. es→en overlay additions (enrichment; spine stays L1-neutral)

Contrastive notes (grammarNode refs): narrative-tenses (preterite/imperfect → past simple/continuous — the split
you already own) · used-to-vs-would (imperfect covers both; used to for states, would for repeated actions only) ·
past-perfect ("había comido" → "had eaten" — positive transfer) · pres-perf-cont ("llevo dos años viviendo aquí" →
"I have been living here for two years" — no llevar) · perf-cont-vs-simple (ES doesn't force result-vs-activity) ·
superl-perf-ever (add "ever") · articles-deep (ES uses articles with languages/general nouns; EN drops: "English
is useful") · future-cont ("I'll be flying" is normal speech in EN) · cond-second ("si tuviera… compraría" →
if + past, would; never would in the if-clause) · wish-past ("ojalá tuviera" → "I wish I had") · unless ("a menos
que" + subjunctive → unless + plain present) · in-case-as-long-as ("por si acaso" → in case + present; "siempre
que" → as long as) · modal-deduction ("debe de estar cansado" → must be; negative deduction is can't be, not
mustn't be) · had-to (did carries the past in questions) · be-allowed-to ("no me dejaban salir" → "I wasn't
allowed to go out") · make-let (make/let + object + BARE verb — no to) · verb-obj-inf ("quiero que vengas" →
"I want you to come" — subjunctive becomes object + infinitive) · passive-present (ES prefers se-passive; EN uses
be-passive: "Spanish is spoken") · passive-past ("fue construido" → "was built" — positive transfer) ·
reported-statements (backshift works like ES — the trap is word order, which stays flat) · say-vs-tell (decir
covers both; tell needs a person; "explain TO me") · reported-questions (keepin question inversion is the error:
"asked where I lived", never "asked where did I live") · reported-commands ("me dijo que esperara" → "told me to
wait") · rel-where-whose (cuyo is fading in ES speech; whose is required in EN) · rel-object-omit (ES never drops
que; EN drops object relatives freely) · verb-patterns-contrast ("dejar de fumar" → "stop smoking"; "acordarse de
hacer" → "remember to do") · phrasal-separable (no ES counterpart; "turn it on", never "turn on it") ·
conn-discourse (sin embargo/por lo tanto → however/therefore with comma) · echo-so-neither ("yo también/tampoco" →
match the helper verb: "So am I", "Neither can I") · question-tags ("¿no?/¿verdad?" is invariable; EN tags mirror
and flip the helper — hardest B1 habit, drill it) · indef-pronouns (one negative only: "I didn't see anybody") ·
adj-ed-ing (aburrido covers both; -ing causes, -ed feels) · too-to-so-that (demasiado…para → too…to; tan…que →
so…that) · indirect-questions (the question un-inverts inside the polite frame — the classic es→en slip).

Unit-thematic false-friend notes (ref_kind: unit): u26 — realizar≠realize (carry out), soportar≠support (put up
with), solicitud = job application, compromiso≠compromise (commitment); u22 — argumento≠argument (plot),
suceso≠success (event), sensible≠sensible (sensitive); u03 — constipado≠constipated (a cold), molestar≠molest
(bother), embarazada≠embarrassed.

Cognate credits (seed_form 0, transform-rule-clean only): society, responsibility, century, monument, material,
process, solution, ethics, dilemma, colleague. Phoneme additions (drilled via phonology lessons in u03/u19/u22):
`ʃ-ʒ` ([["pressure","pleasure"],["mission","vision"],["shore","genre"]] — es lacks /ʒ/; drill words usually,
decision, television); `stress-pairs` noun/verb shift ([["REcord","reCORD"],["PREsent","preSENT"],["OBject","obJECT"]]);
`əʊ-ɔː` ([["boat","bought"],["coat","caught"],["woke","walk"]]).

## 7. Sequencing + placement

Spines: Retrospective u01–u04 · Hypothetical u05–u08 · Modality/agency u09–u11 · Voice & report u12–u15 ·
Structure & discourse u16–u25. u26 needs spines 3+4; u27 needs 2+5; u29 needs all five. Mini-gate 1 (u09) blocks
spines 1–2 exit; mini-gate 2 (u18) blocks 3–4 exit.

| θ̂ | entry |
|---|---|
| −1.1 … −0.8 | late A2 |
| −0.8 … −0.55 | early B1 — en.b1.u01 |
| −0.55 … −0.3 | mid B1 — u10–u18 |
| −0.3 … 0.0 | late B1 — u19–u27 |
| > 0.0 | above-content (until Arc 4) |

## 8. Blockers

1. Second conditional starved (7; one is actually 3rd-cond) → what-if gap pack is a hard prerequisite for u06/u07.
2. Question tags absent (1 hit) → small-talk gap pack is a hard prerequisite for u20 (echoes too).
3. Past perfect / perf-cont / deduction thin (9/12/8 strict) → widened levels + gap-pack facets; build report must
   show ≥40 resolved candidates each (V-POOL-1).
4. `phrase-professional-*` = 12 B1 each — u26 garnish only, combine ≥3 packs.
5. A2 retrofit: a2-u02 (used to) pools from `phrase-life-then-and-now` (7 base hits total).
6. ES coverage: not a blocker (100%).
7. Pack-index fragility: positional refs — pin with `# english` comments against currently shipped phrases.json.

## 9. B2/C1/C2 honesty assessment

Partial B2: defensible at ~half size (~12–15 units; base 800 entries concentrated everyday/social/business/culture
+ packs ~2,400 B2) but B2 grammar payload (third conditional, perfect modals, have-sth-done, reported II,
non-defining relatives) is thinner than B1's thin structures — needs a grammar-shaped authoring pass or 3–5 more
gap packs first. C1/C2: requires corpus growth, full stop — base C1 = 100, C2 = 20; a C1 arc needs ~3,600
candidates vs ~2,000–2,500 shortfall. Growth program: +~2,500 C1 base entries (business/civic/culture/education
weighted), professional DEPTH packs rebuilt at 500–800 entries each, and a register/discourse pack kind. C2 needs
the literature/wild-grammar content program.
