# Journey `journey_en` — Arc 2 (CEFR A2) Curriculum Design

Status: authoring-ready design for parallel per-unit agents (2026-07-06). Grounded in a live census of
`dja/release.sqlite3` and the shipped v0.1 pack format. Companion: `CURRICULUM-B1.md` (Arc 3).

**Format note (critical):** shipped units use a SIMPLER YAML shape than authoring.md §1.1 — follow the real files
(`courses/en/units/a1-u10-she-works.yaml`), not the spec's aspirational superset. Real fields: `id, arc, theme,
cando[{key,text}], vocab_band{lo,hi}, phrase_domains[], skills[{id,kind,title,b,prereqs}], grammar_nodes[],
items[{ref,skills,importance,probe,b,substitutable} | {auto:{kind,source,domains,level,count,skills,importance,substitutable}}],
lessons[], boss{pass_score,params}, anchor{provider,config}`. Item refs: `phrase:base:<cor_entry.id>`,
`phrase:<packId>:<0-based-index-in-phrases.json>`, `word:en:<surface>`.

## 1. Corpus census (live, 2026-07-06)

Base corpus (10,000 entries; language_id 13=en, 14=es). Levels: A0 380 · A1 2,500 · **A2 2,800** · B1 3,400 ·
B2 800 · C1 100 · C2 20. **ES translation coverage at A2: 100% (2,800/2,800).**

A2 domain distribution (overlapping): everyday 1,768 · social 929 · travel 369 · health 306 · education 294 ·
business 255 · housing 251 · culture 243 · technology 211 · environment 198 · numbers 103 · emergency 100 · civic 86.

Grammar-shaped A2 pools: present-perfect-shaped 112; going to/will 133; comparatives 71; obligation modals
(should/have to/must/could) 41; past-continuous/while 40.

Phrase packs (37 on disk; ref index = 0-based position in phrases.json): DEPTH packs ~280 A2 each
(family-and-friends, cooking-basics, health-and-body, festivals-world, places-geography, music-fundamentals,
mythology, philosophy, learning, ocean); WIDE packs ~175 A2 (travel-essentials, work-office, camping,
sports-soccer, sports-martial-arts, night-sky, birds, cinema, tech-computers, vehicles, geology, economics).
`phrase-professional-*` are 10–20 A2 (do NOT map A2 units to them). New gap pack `phrase-life-then-and-now`
(A2:30/B1:80/B2:30) serves a2-u02 (see §8.1 blocker).

## 2. Arc definition

Append to `course.yaml` arcs:

```yaml
  - id: en.arc2
    index: 2
    cefr: A2
    title: "Everyday"
    gate:
      pass_score: 0.8
      params:
        spacedSampleShare: 0.3
        require: [produce.speak, input.listen]
```

Shape: 25 teach units (`en.a2.u01`–`u25`) + consolidation (`u26`) + integrative production (`u27`) + arc gate
(`u28`) = 28 units. One mini-gate rides u09's boss (cumulative gauntlet u01–u09). Files `a2-uNN-slug.yaml`.
Vocab bands cumulative `{lo:1, hi:N}`, `hi` stepping 3000→4200 (~+50/unit); new-word rank window 1,000–2,500
(thematic words may reach into the 2,500–4,000 shoulder within `vocab_band.hi`).

## 3. A2 grammar-node graph — 40 nodes (orders 44–83)

Continue `grammar.yaml` after A1's order 43. Briefs L1-NEUTRAL, paraphrase-only, ≤2 sentences, house copy rules
(no absolutes). `b` ramps −2.0 → −0.9.

| id (`en.gn.`) | ord | title | note-seed | prereqs | b | home |
|---|---|---|---|---|---|---|
| `past-cont` | 44 | Past continuous | was/were + -ing for an action in progress in the past: "I was cooking." | past-be, pres-cont | −2.0 | u01 |
| `past-simple-vs-cont` | 45 | Interrupted past | Long action (were -ing) cut by a short one (past simple), joined by when/while. | past-cont, past-reg | −1.9 | u01 |
| `used-to` | 46 | used to | Past habits/states now over: "I used to live in Lima." Bare verb after. | past-reg | −1.8 | u02 |
| `pres-perf-exp` | 47 | Present perfect: experience | have/has + past participle for life experience, no time said: "I have visited Rome." | past-irreg-top25 | −1.8 | u03 |
| `pres-perf-been-gone` | 48 | been vs gone | "has been to" = went and came back; "has gone to" = still there. | pres-perf-exp | −1.6 | u03 |
| `pres-perf-yet-already` | 49 | already / yet / just | already (+), yet (?/−), just (recent): "I've just eaten. Have you finished yet?" | pres-perf-exp | −1.6 | u04 |
| `for-since` | 50 | for / since | for + length (for two years), since + start point (since 2020). | pres-perf-exp | −1.5 | u04 |
| `pres-perf-vs-past` | 51 | Present perfect vs past simple | Finished time → past simple (yesterday); unfinished/no time → present perfect. | pres-perf-yet-already, past-quest-neg | −1.4 | u05 |
| `will-predict` | 52 | will (predictions) | will + bare verb for predictions/facts about the future: "It will rain." | going-to | −1.7 | u06 |
| `will-decide-offer` | 53 | will (decisions & offers) | Decide/offer/promise at the moment of speaking: "I'll help you." | will-predict | −1.6 | u06 |
| `will-vs-going-to` | 54 | will vs going to | going to = plan/evidence; will = prediction/spontaneous decision. | will-decide-offer | −1.4 | u07 |
| `pres-cont-future` | 55 | Present continuous for arrangements | Fixed arrangements with a time: "I'm meeting Ana at six." | will-vs-going-to | −1.3 | u07 |
| `time-clauses` | 56 | Future time clauses | Present tense after when/as soon as/before/after for the future: "When I arrive, I'll call." | will-predict | −1.4 | u08 |
| `cond-zero` | 57 | Zero conditional | if + present, present — general truths: "If you heat ice, it melts." | pres-simple-base | −1.5 | u08 |
| `cond-first` | 58 | First conditional | if + present, will — real future possibility: "If it rains, we'll stay in." | cond-zero, will-predict | −1.3 | u08 |
| `should-advice` | 59 | should / shouldn't | Advice and opinion: "You should rest. You shouldn't smoke." Bare verb. | can-ability | −1.6 | u09 |
| `have-to` | 60 | have to / don't have to | Obligation (have to) vs no obligation (don't have to): "I have to work." | should-advice, pres-simple-3sg | −1.4 | u10 |
| `must-mustnt` | 61 | must / mustn't | Strong rule (must) vs prohibition (mustn't ≠ don't have to): "You mustn't park here." | have-to | −1.3 | u10 |
| `could-past-polite` | 62 | could | Past ability ("I could swim at five") and polite requests ("Could you help?"). | can-request | −1.5 | u11 |
| `would-like-offers` | 63 | would you like…? | Offers and wants: "Would you like a coffee? I'd like to book a table." | would-like | −1.4 | u11 |
| `might-may` | 64 | might / may | Possibility, not certainty: "It might rain. She may be late." | will-predict | −1.3 | u12 |
| `count-uncount` | 65 | Countable & uncountable | Some nouns don't count (water, money, rice) — no plural, no "a". | plural-reg, some-any | −1.5 | u13 |
| `much-many-alot` | 66 | much / many / a lot of | many + countable, much + uncountable, a lot of + both. | count-uncount, how-much-many | −1.4 | u13 |
| `few-little` | 67 | (a) few / (a) little | a few + countable, a little + uncountable; "few/little" = not enough. | count-uncount | −1.2 | u14 |
| `too-enough` | 68 | too / enough | too + adj (too hot), enough after adj / before noun (warm enough, enough time). | much-many-alot | −1.2 | u14 |
| `as-as` | 69 | as … as | Equality (as tall as) and its negative (not as cheap as). | comp-superl | −1.3 | u15 |
| `comp-adverbs` | 70 | Comparative adverbs | more quickly, faster, better than — comparing how, not what. | comp-superl, as-as | −1.1 | u15 |
| `adv-manner` | 71 | Adverbs of manner | -ly on the verb to say how: "She speaks slowly." Irregulars: well, fast, hard. | pres-simple-base | −1.4 | u16 |
| `adv-degree` | 72 | Adverbs of degree | very/really/quite/too before adjectives to turn them up or down. | adv-manner | −1.2 | u16 |
| `gerund-after-verbs` | 73 | verb + -ing | After like/love/hate/enjoy/mind/stop the next verb takes -ing: "I enjoy cooking." | pres-cont | −1.3 | u17 |
| `infinitive-after-verbs` | 74 | verb + to-infinitive | After want/need/hope/decide/would like the next verb takes "to": "I want to go." | gerund-after-verbs | −1.2 | u18 |
| `infinitive-purpose` | 75 | Infinitive of purpose | "to + verb" answers why: "I came to help." (= in order to) | infinitive-after-verbs | −1.1 | u18 |
| `phrasal-verbs-1` | 76 | Phrasal verbs I | Verb + particle changes meaning: get up, turn on, look for, put on. | pres-simple-base | −1.2 | u19 |
| `verb-prep-collocations` | 77 | verb + preposition | Fixed pairs: listen TO, wait FOR, look AT, depend ON. | prep-place | −1.1 | u19 |
| `rel-who-which` | 78 | Relative clauses (defining) | who for people, which/that for things: "the man who lives here." | obj-pron | −1.1 | u20 |
| `poss-pron` | 79 | Possessive pronouns | mine, yours, his, hers, ours, theirs — no noun after: "That's mine." | poss-adj | −1.4 | u21 |
| `reflexive` | 80 | Reflexive pronouns | myself, yourself, herself for same subject+object: "I hurt myself." | obj-pron | −1.2 | u21 |
| `so-because-although` | 81 | so / because / although | Result (so), reason (because), contrast (although/but). | conn-basic | −1.2 | u22 |
| `prep-movement` | 82 | Prepositions of movement | into, out of, through, across, along, past, over — direction, not place. | prep-place, imperatives | −1.3 | u23 |
| `question-words-deep` | 83 | Subject vs object questions | "Who called you?" (no do) vs "Who did you call?" (do); "What happened?" | do-quest, wh-quest-be | −1.0 | u24 |

## 4. Skill DAG (one skill per teach unit)

| unit | skill id (`en.skill.`) | kind | b | prereqs |
|---|---|---|---|---|
| u01 | `past-narration` | grammar | −2.0 | past-irregular |
| u02 | `used-to` | grammar | −1.9 | past-narration |
| u03 | `experiences` | grammar | −1.8 | past-irregular |
| u04 | `completion` | grammar | −1.6 | experiences |
| u05 | `past-vs-perfect` | grammar | −1.4 | completion, past-narration |
| u06 | `predictions` | grammar | −1.7 | plans |
| u07 | `arrangements` | grammar | −1.4 | predictions, plans |
| u08 | `conditions` | grammar | −1.4 | arrangements |
| u09 | `advice` | function | −1.6 | can |
| u10 | `obligation` | grammar | −1.4 | advice, jobs |
| u11 | `polite-requests` | function | −1.5 | can, eating-out |
| u12 | `possibility` | grammar | −1.3 | predictions |
| u13 | `quantity` | grammar | −1.5 | shopping |
| u14 | `quantity-fine` | grammar | −1.2 | quantity |
| u15 | `comparison-adv` | grammar | −1.2 | comparison |
| u16 | `adverbs` | grammar | −1.3 | routines |
| u17 | `gerunds` | grammar | −1.3 | right-now |
| u18 | `infinitives` | grammar | −1.2 | gerunds |
| u19 | `phrasal-verbs` | grammar | −1.2 | routines, places |
| u20 | `relative-clauses` | grammar | −1.1 | describing-people |
| u21 | `possession-adv` | grammar | −1.3 | family-possession |
| u22 | `connectors-adv` | grammar | −1.2 | connectors |
| u23 | `navigation` | function | −1.3 | directions, places |
| u24 | `questions-adv` | grammar | −1.0 | be-questions, jobs |
| u25 | `celebrations` | function | −1.1 | experiences, comparison-adv |

## 5. Per-unit specs

**Standing conventions for every teach unit** (match `a1-u07`/`a1-u10`): 3 probe pinned phrases
(`importance: 3, probe: true, b: <skill.b>`) + 4 substitutable pinned phrases (`importance: 3, substitutable: true`)
+ 5 pinned words (`importance: 2`) + 1 auto block (`kind: phrase, source: base, level: A2, count: 10,
importance: 2, substitutable: true`); a 2nd auto block (or pack block) when the unit spans two domains or draws a
pack. Probe recipe (base):

```sql
SELECT e.id, en.text, es.text
FROM cor_entry e
JOIN cor_entry_domains ed ON ed.entry_id=e.id
JOIN cor_domain d ON d.id=ed.domain_id
JOIN cor_translation en ON en.entry_id=e.id AND en.language_id=13
JOIN cor_translation es ON es.entry_id=e.id AND es.language_id=14
WHERE e.level IN (<levels>) AND d.code IN (<domains>) AND (<grammar LIKE patterns>)
ORDER BY LENGTH(en.text);   -- take the 3 shortest clean structure-clear hits as probes
```

Default levels `('A2')`; widen to `('A1','A2','B1')` for modal/perfect/past-continuous units. Probe content words
zipf ≥ 4.3. Boss: `pass_score: 0.8`, `params:{spacedSampleShare:0.3, require:[produce.speak, input.listen]}`.
Lessons: `[core, grammar-focus, (grammar-focus|dialog), core, review]`; 2-node units add a second grammar-focus.
Anchors: only `lingo_hero`, `earthgate`/`cap-segment-player`, `corpan_city`, `cap-pronounce`, `cap-squeeze`,
`native`; `config:{itemset:unit}`; native anchors carry a fallback.

- **u01 `en.a2.u01` "Back then"** (past narration) — cando: narrate what was happening at a past moment; contrast ongoing vs interrupting action. band `{lo:1,hi:3000}`; domains `[everyday, social, culture]`; nodes `[past-cont, past-simple-vs-cont]`; skill `past-narration`; anchor `earthgate`; boss "Tell what you were doing yesterday evening when something happened." Sourcing: levels `('A1','A2','B1')`, patterns `'%was %ing%'|'%were %ing%'|'% while %'|'When % %ed%'`. 2 auto blocks (everyday, social). Words: yesterday, evening, suddenly, happen, moment.
- **u02 `en.a2.u02` "The way things were"** (used to) — cando: describe past habits/states no longer true; compare then vs now. band hi 3050; domains `[everyday, environment, social]`; nodes `[used-to]`; anchor `lingo_hero`; boss "Describe three things you used to do as a child." Sourcing: `'%used to %'|"%didn't use to%"` is STARVED in base (7 hits) — pin probes from gap pack `phrase-life-then-and-now` (facet "past habits"), plus "When I was a child…"-shaped base hits. Words: child, before, change, past, ago.
- **u03 `en.a2.u03` "Have you ever?"** (experiences) — cando: ask/talk about life experiences without a time; been vs gone. band hi 3100; domains `[travel, culture, social]` + pack `phrase-places-geography-world` (auto count 8); nodes `[pres-perf-exp, pres-perf-been-gone]`; anchor `lingo_hero`; boss "Interview a partner about places they have visited." Patterns `'Have you ever%'|'%have been to%'|'%has been to%'|'%have never%'|'%have visited%'` (verified hits incl. ids 9258, 10134); levels `('A2','B1')`. Words: abroad, visited, experience, foreign, ever.
- **u04 `en.a2.u04` "So far"** (completion) — cando: already/yet/just; for/since duration. band hi 3150; domains `[everyday, housing, business]`; nodes `[pres-perf-yet-already, for-since]`; anchor `cap-squeeze`; boss "Report progress on a to-do list." Patterns `'%already%'|'% yet%'|'%have just%'|'% since %'|'% for %years%'` (verified 9089, 9141, 10061). Words: already, yet, finished, ready, list.
- **u05 `en.a2.u05` "Then and now"** (perfect vs past) — cando: choose by finished-time; narrate a change and its origin. band hi 3200; domains `[everyday, social, environment]`; nodes `[pres-perf-vs-past]`; anchor `earthgate`; boss "What has changed in your town, and when each change happened." Levels `('A1','A2','B1')`; mix perfect hits + past-simple hits (`%yesterday%|%last %|% ago%`). Words: recently, still, become, grow, since.
- **u06 `en.a2.u06` "What will happen"** (predictions & offers) — nodes `[will-predict, will-decide-offer]`; band hi 3250; domains `[environment, everyday, social]`; anchor `cap-squeeze`; boss "Weather forecast + offer to help." Patterns `'%will %'|"%won't%"|"I'll%"|"%'ll %"`. Words: future, forecast, probably, promise, offer.
- **u07 `en.a2.u07` "Making plans"** (arrangements) — nodes `[will-vs-going-to, pres-cont-future]`; band hi 3300; domains `[everyday, business, social]`; anchor `corpan_city`; boss "Arrange to meet: propose, agree a time, confirm." Patterns `'%going to%'|'%am meeting%'|'%are meeting%'|'%next week%'|'%tomorrow%'`. Words: plan, appointment, meeting, weekend, tonight.
- **u08 `en.a2.u08` "When and if"** (conditions) — nodes `[time-clauses, cond-zero, cond-first]` (3 nodes → 2× grammar-focus); band hi 3350; domains `[everyday, environment, travel]`; anchor `lingo_hero`; boss "Plan an outing conditional on the weather." Patterns `'If %'|'%if you%'|'When %will%'|'%as soon as%'`. Words: if, when, weather, sunny, plan.
- **u09 `en.a2.u09` "Good advice"** (advice) — **MINI-GATE**: boss = cumulative gauntlet u01–u09, `spacedSampleShare: 0.4`. nodes `[should-advice]`; band hi 3400; domains `[health, everyday]` + pack `phrase-life-health-and-body` (auto 8); anchor `cap-pronounce`; boss "A friend describes three problems; give advice." Levels `('A1','A2','B1')`; patterns `'%should %'|"%shouldn't%"|'You should%'`. Words: advice, problem, tired, rest, better.
- **u10 `en.a2.u10` "Rules and obligations"** — nodes `[have-to, must-mustnt]`; band hi 3450; domains `[business, civic, education]` + pack `phrase-work-office-basics` (auto 8); anchor `corpan_city`; boss "Explain the rules of a place: must / mustn't / don't have to." Levels `('A1','A2','B1')`; patterns `'%have to %'|'%must %'|"%mustn't%"|"%don't have to%"`. Words: rule, must, allowed, sign, office.
- **u11 `en.a2.u11` "Could you help?"** (polite requests) — nodes `[could-past-polite, would-like-offers]`; band hi 3500; domains `[travel, social, everyday]` + pack `phrase-travel-essentials` (auto 8); anchor `corpan_city`; boss "Hotel/restaurant exchange: request, offer, thank." Levels `('A1','A2','B1')`; patterns `'Could you%'|'%could %'|'Would you like%'|"I'd like to%"`. Words: could, would, please, help, mind.
- **u12 `en.a2.u12` "It might rain"** (possibility) — nodes `[might-may]`; band hi 3550; domains `[environment, everyday]` + pack `phrase-life-camping-basics` OR `phrase-sciences-astronomy-night-sky` (auto 8); anchor `earthgate`; boss "What you might do this weekend and why it's not certain." Patterns `'%might %'|'%may %'|'%maybe%'|'%perhaps%'`. Words: maybe, perhaps, possible, chance, might.
- **u13 `en.a2.u13` "How much? How many?"** (quantity) — nodes `[count-uncount, much-many-alot]`; band hi 3600; domains `[everyday, travel]` + pack `phrase-life-cooking-basics` (auto 8); anchor `lingo_hero`; boss "Market shop: ask how much/how many, request quantities." Patterns `'How much%'|'How many%'|'%a lot of%'|'%some %'`. Words: money, water, rice, few, enough.
- **u14 `en.a2.u14` "A little more"** (fine quantity) — nodes `[few-little, too-enough]`; band hi 3650; domains `[everyday, health]` + cooking pack; anchor `native` (`activityType:match_pairs` fallback); boss "Adjust a recipe: too much, too little, enough." Patterns `'%too %'|'%enough%'|'%a little%'|'%a few%'`. Words: little, few, too, enough, extra.
- **u15 `en.a2.u15` "As good as it gets"** (comparison deep) — nodes `[as-as, comp-adverbs]`; band hi 3700; domains `[social, culture]` + pack `phrase-sports-soccer-basics` (auto 8, PRIMARY for sports vocab — no base sports domain); anchor `lingo_hero`; boss "Compare two teams/players." Patterns `'%as % as%'|'% than %'|'%better than%'|'%more %ly%'`. Words: same, better, faster, worse, team.
- **u16 `en.a2.u16` "Doing it well"** (adverbs) — nodes `[adv-manner, adv-degree]`; band hi 3750; domains `[everyday, education]`; anchor `cap-pronounce`; boss "Give feedback: how they did, how well/badly." Patterns `'% quickly%'|'% slowly%'|'% carefully%'|'%really %'|'%very %'`. Words: quickly, slowly, carefully, really, well.
- **u17 `en.a2.u17` "I love cooking"** (gerunds) — nodes `[gerund-after-verbs]`; band hi 3800; domains `[everyday, culture]` + pack `phrase-arts-music-fundamentals` (auto 8); anchor `lingo_hero`; boss "Free-time activities: enjoy / don't mind / hate doing." Patterns `'%enjoy %ing%'|'%like %ing%'|'%love %ing%'|'%hate %ing%'|'%stop %ing%'`. Words: hobby, cooking, reading, dancing, enjoy.
- **u18 `en.a2.u18` "I want to learn"** (infinitives) — nodes `[infinitive-after-verbs, infinitive-purpose]`; band hi 3850; domains `[education, everyday]`; anchor `cap-squeeze`; boss "Why you're learning English and what you want to do with it." Patterns `'%want to %'|'%need to %'|'%hope to %'|'%decided to %'|'% to learn%'`. Words: want, need, learn, decide, goal.
- **u19 `en.a2.u19` "Turn it on"** (phrasal verbs; technology) — nodes `[phrasal-verbs-1, verb-prep-collocations]`; band hi 3900; domains `[technology, everyday]` + pack `phrase-tech-computers-basics` (auto 8); anchor `corpan_city`; boss "Explain how to use a device." Patterns `'%get up%'|'%turn on%'|'%turn off%'|'%look for%'|'%wait for%'|'%listen to%'`. Words: phone, screen, button, turn, switch.
- **u20 `en.a2.u20` "The one that works"** (relative clauses) — nodes `[rel-who-which]`; band hi 3950; domains `[everyday, technology, social]`; anchor `native` (`flip_recall`, fallback match_pairs); boss "Describe an object/person to guess: 'the one that/who…'." Patterns `'%who %'|'%which %'|'%that is%'|'The person who%'|'The thing that%'`. Words: person, thing, place, one, which.
- **u21 `en.a2.u21` "Mine and yours"** (possession & self) — nodes `[poss-pron, reflexive]`; band hi 4000; domains `[everyday, social]`; anchor `native` (`choice_pick`, fallback match_pairs); boss "Sort belongings; describe hurting/enjoying yourself." Patterns `'%mine%'|'%yours%'|'%hers%'|'%myself%'|'%yourself%'`. Words: mine, yours, own, myself, self.
- **u22 `en.a2.u22` "Because and although"** (connectors & opinions) — nodes `[so-because-although]`; band hi 4050; domains `[social, culture]` + pack `phrase-humanities-philosophy-basics` (use SPARINGLY — band-fit check; prefer base social/culture); anchor `earthgate`; boss "An opinion with a reason and a contrast." Patterns `'%because%'|'%although%'|'%so %'|'%but %'|'I think%'`. Words: because, although, opinion, agree, reason.
- **u23 `en.a2.u23` "Getting around"** (navigation & movement) — nodes `[prep-movement]`; band hi 4100; domains `[travel, everyday]` + pack `phrase-vehicles-cars-and-driving` (auto 8); anchor `corpan_city`; boss "Direct someone across town: into, through, across, past." Patterns `'%through%'|'%across%'|'%into%'|'%along%'|'%past the%'|'%over the%'`. Words: across, through, corner, straight, bridge.
- **u24 `en.a2.u24` "Who did what?"** (advanced questions) — nodes `[question-words-deep]`; band hi 4150; domains `[social, civic]`; anchor `lingo_hero`; boss "Interview about a recent event: who did what, what happened, why." Patterns `'Who %'|'What happened%'|'Who did%'|'Whose%'|'How many people%'`. Words: news, happen, who, someone, everyone.
- **u25 `en.a2.u25` "Celebrate!"** (celebrations; review-rich) — `grammar_nodes: []`, review recycles `pres-perf-exp, comp-superl, gerund-after-verbs`; skill `celebrations`; band hi 4200; domains `[culture]` + pack `phrase-life-festivals-world` (auto 12, PRIMARY); anchor `earthgate`; boss "Present a celebration from your country." Words: festival, celebrate, tradition, gift, holiday.
- **u26 `en.a2.u26` "The story so far"** — `kind: consolidate`. FSRS harvest over the arc's weakest nodes (esp. pres-perf-vs-past, have-to/must-mustnt, gerund vs infinitive). No new grammar/items. `lessons: [review, review, dialog, review]`, anchor `native`, light mixed review boss or none.
- **u27 `en.a2.u27` "My year"** — integrative production. Review recycles `past-narration, pres-perf-vs-past, will-vs-going-to, so-because-although`; no new skill (reuse `past-vs-perfect`); anchor `cap-pronounce`; boss: 4–5 sentence spoken AND written self-narrative graded on tense control, `pass_score: 0.8`.
- **u28 `en.a2.u28` "Arc gate: A2 exam"** — `kind: gate`. Adaptive checklist across all 40 A2 nodes + can-do set; probes span b −2.0…−0.9; gate params `{spacedSampleShare:0.3, require:[produce.speak, input.listen]}`. Until Arc 3 ships, passing → above-content (R10).

## 6. es→en overlay additions (append to `overlays/es.yaml`; enrichment only — spine stays L1-neutral)

Contrastive notes (`ref_kind: grammarNode`, ≤2 sentences each; es copy → `strings/es.json` `ovl.es.*` keys):
past-cont ("estaba comiendo" maps cleanly; -ing does the -ando/-iendo job) · past-simple-vs-cont (imperfect/preterite
split becomes was -ing vs -ed; interrupted action takes was -ing) · used-to ("solía"/imperfect of habit → used to +
bare verb) · pres-perf-exp (looks like "he visitado" but EN forbids it with ayer/last year) · pres-perf-been-gone
(ha ido/ha estado → gone = still there, been = returned) · pres-perf-yet-already ("ya" → already/yet by polarity;
"acabo de" → have just) · for-since ("desde hace/desde" splits into for + length, since + start) ·
pres-perf-vs-past (**#1 A2 interference**: "hoy he comido" is fine in ES, "I have eaten at two" is wrong — finished
time → past simple) · will-predict ("lloverá"/"va a llover" both exist; will never conjugates) · will-decide-offer
(ES present "te ayudo" for offers → "I'll help you") · will-vs-going-to (voy a = going to; spontaneous decision
switches to will — a split ES doesn't force) · pres-cont-future ("quedo con Ana a las seis" → "I'm meeting Ana at
six") · time-clauses ("cuando llegue" subjunctive → "when I arrive" present; never "when I will arrive") ·
cond-zero (direct positive transfer) · cond-first ("si llueve, nos quedaremos" → if + present, will; no will in
the if-clause) · should-advice ("deberías" → should + bare verb, no "to") · have-to ("no tienes que" = don't have
to = no obligation, NOT prohibition) · must-mustnt ("no debes" = mustn't; mustn't ≠ don't have to — deber blurs
them) · could-past-polite (poder splits past ability vs polite request; English uses could for both) ·
would-like-offers ("¿Quieres…?" sounds blunt; use "Would you like…?"; "quisiera" → "I'd like") · might-may
("puede que llueva"/"a lo mejor" → might/may = uncertainty, unlike poder = ability) · count-uncount
(information/furniture/money/bread/advice are uncountable in EN though countable in ES — no plural, no "a") ·
much-many-alot (mucho/muchos is one idea; EN splits much/many; a lot of covers both in positives) · few-little
(poco/pocos → little/few; a little/a few = some vs little/few = not enough) · too-enough (demasiado → too;
suficiente → enough, AFTER adjectives but BEFORE nouns) · as-as (tan…como → as…as) · gerund-after-verbs (after
enjoy/mind English needs -ing: "me gusta cocinar" → "I like cooking") · infinitive-after-verbs ("quiero ir" →
"I want TO go" — to is obligatory) · infinitive-purpose ("para + infinitivo" → "to + verb", not "for + -ing") ·
so-because-although (como/porque/aunque → so/because/although; because ≠ because of; no "aunque…pero" doubling).

Cognate credits (append `word:en:*`, seed_form 0): festival, tradition, experience, opinion, possible, decide,
future, appointment, forecast, comparison. False-friend notes ride u18 (pretender≠pretend, intentar=try) and u22
(discutir≠discuss-only). Phoneme contrasts (append `phoneme_pairs`, home `en.a0.u01`): `θ-s` (think/sink, thin/sin,
mouth/mouse, path/pass); `θ-t` (thing/ting, three/tree, thin/tin); `ð-d` (they/day, then/den, breathe/breed,
other/udder) — A1 shipped no /θ/ /ð/ pairs; th-dense units u02/u16/u22 carry `phonology_focus: auto`.

## 7. Placement θ bands

| θ̂ | entry |
|---|---|
| < −3.2 | Launchpad / early A1 |
| −3.2 … −2.2 | mid–late A1 (u10–u26) |
| −2.2 … −1.6 | early A2 — en.a2.u01 |
| −1.6 … −1.1 | mid A2 — u10–u16 |
| −1.1 … −0.8 | late A2 — u20–u25 |
| > −0.8 | B1 (see CURRICULUM-B1.md) |

## 8. Blockers / mitigations

1. Obligation modals thin (41 A2): u09/u10/u11 widen levels to `('A1','A2','B1')` + lean on health/work packs; if
   V-POOL-1 still fails at build, `phrase-life-then-and-now`-style gap authoring is the fallback (flag, don't silently ship thin).
2. Past continuous thin (40 A2): u01 pulls `('A1','A2','B1')`; verify resolved counts in build report.
3. `phrase-professional-*` unusable at A2 — no A2 unit maps to them.
4. used-to STARVED in base (7 hits total): a2-u02 pins from gap pack `phrase-life-then-and-now`.
5. No base domain for sports/music/food/camping/astronomy — themed units pull thematic vocab from packs
   (`phrase:<packId>:<index>`, filter phrases.json `level=='A2'`); base supplies grammar-shaped probes.
6. ES coverage: NOT a blocker (100%).
7. Pack-index fragility: positional refs — pin against currently shipped phrases.json and record english text in a
   trailing `# comment` (as A1 does).
