# Journey Curriculum Spine — Research + Proposal

**Status:** Phase-1 research foundation, v1 draft (2026-07-03).
**Scope:** How the best courses structure zero→mastery; a concrete Journey spine proposal with granularity math; first 20 units of `journey-en` in detail; coarse outline to C2; `journey-zh` instantiation sketch.
**Inputs:** Web research (cited inline), `docs/journey/NORTH_STAR.md`, existing phrase-pack domains (`corpan/tools/phrase-packs/phrase-*`).

---

## Part 1 — What the field actually does (research findings)

### 1.1 CEFR: the reference frame everyone maps to

- Six levels A1–C2 plus Pre-A1 (added in the 2020 Companion Volume). The Companion Volume is the canonical source of **can-do descriptors** — 80+ illustrative scales across reception, production, interaction, and (new in 2020) **mediation** (19 activity scales + 5 strategy scales), online interaction, and plurilingual competence. Descriptors exist per level per scale ("Can introduce him/herself…", "Can summarise information from different sources…"). Source: [Council of Europe CEFR descriptors](https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors), [Companion Volume 2020 PDF](https://rm.coe.int/cefr-companion-volume-with-new-descriptors-2020/16809ea0d4).
- **Cumulative guided learning hours (Cambridge estimates):** A2 ≈ 180–200 h, B1 ≈ 350–400 h, B2 ≈ 500–600 h, C1 ≈ 700–800 h, C2 ≈ 1,000–1,200 h. (A1 is conventionally ~90–100 h.) These are cumulative-from-zero, guideline-only. Source: [Cambridge English guided learning hours](https://support.cambridgeenglish.org/hc/en-gb/articles/202838506-Guided-learning-hours), corroborated by [LanguageCert](https://www.languagecert.org/en/guided-learning-hours).
- **Design takeaway:** the CEFR gives us (a) a level ladder with public credibility, (b) a machine-usable goal taxonomy (descriptor IDs as unit metadata), (c) hour budgets to calibrate total course volume.

### 1.2 ACTFL / ILR

- ACTFL: Novice / Intermediate / Advanced (each with Low-Mid-High sublevels) + Superior + Distinguished = 11 rungs. Function-oriented — "what can the person *do* in live communication," heavily speaking-weighted. One ACTFL band can straddle CEFR levels depending on skill profile. Sources: [ACTFL↔CEFR crosswalk (actfl.org)](https://www.actfl.org/uploads/files/general/Assigning_CEFR_Ratings_To_ACTFL_Assessments.pdf), [Cathoven comparison](https://www.cathoven.com/blog/comparing-actfl-the-american-standard-with-cefr-the-european-standard/).
- **Design takeaway:** use CEFR as the spine's public ladder, but borrow ACTFL's *performance rubric* style for speaking checkpoints (our STT + LLM can grade "sustains narration in past time across paragraphs" better than a multiple-choice proxy).

### 1.3 FSI: the honest hour budget

- Difficulty categories (to ILR 3 / ≈C1, professional working proficiency), **classroom hours**: Cat I (es, fr, pt, nl, sv, no, da, it, ro, af…) 575–600 h; Cat II (de, id, sw…) ~750 h; Cat III/IV (ru, el, hi, th, tr, vi, pl, he, fi, hu…) ~1,100 h; Cat V (zh, ja, ko, ar) ~2,200 h. FSI students *also* do roughly matching private study, so real totals are ~2× classroom. Sources: [state.gov foreign language training](https://www.state.gov/national-foreign-affairs-training-center/foreign-language-training), [fsi-language-courses.org](https://www.fsi-language-courses.org/blog/fsi-language-difficulty/).
- FSI Basic Course structure (e.g., Spanish): **55 units**, 4 volumes, ~59 h audio + 2,496 pages; each unit = dialogue → pronunciation drills → pattern drills → variation/translation drills → conversation practice, built on *guided imitation* and *overlearning* (massive controlled repetition). Source: [FSI Spanish Basic Course](https://www.fsi-language-courses.org/fsi-spanish-basic-course/).
- **Design takeaways:** (1) total-hours must scale with L1→L2 distance — one spine shape, a **difficulty multiplier** per (L1, L2) pair; (2) overlearning works — high-rep low-stakes drills are respectable pedagogy when the reps are varied and spaced, which is exactly what a feed does well.

### 1.4 Duolingo: the feed-shaped competitor (real numbers)

- Path hierarchy: **Course → Sections → Units → Levels → Lessons** (lesson ≈ 3–5 min, ~15 exercises).
- Visible path (duocorner, 2025): Spanish **8 sections / 286 units**, French 8/272, Japanese 6/221, German 5/156; small courses 1–2 sections. Sections named Rookie/Explorer/Traveler/Trailblazer/… and CEFR-tagged (S1 intro, S2–3 A1, S4 A2, S5–6 B1, S7–8 B2). Source: [duocorner](https://duocorner.com/how-many-sections-in-duolingo/).
- Internal course data ([duolingodata.com](https://duolingodata.com/)): Spanish-for-English "B2" course = **991 units, 8,346 lessons, 1,128 stories**; English-for-Spanish = 1,005 units / 8,409 lessons; French = 994/8,379. (Discrepancy vs. 286 "path units" — the internal count includes per-level lesson rows and legendary/review variants; treat 8k+ lessons as the *rendered* volume, ~286 as the *authored* topic units.)
- Duolingo tops out at **B2** even for flagship courses; their English course only recently added B2 sections ([Duolingo blog](https://blog.duolingo.com/how-duolingo-teaches-english/)).
- **Design takeaways:** (1) authored-vs-rendered distinction is the key to feasibility — author ~hundreds of unit specs, render tens of thousands of activity instances; (2) B2 ceiling is the industry gap — Journey going to C2 "wildest grammar" is a genuine differentiator; (3) ~15 exercises/lesson, 3–5 min is a proven mobile atom size.

### 1.5 Busuu

- CEFR-aligned A1–C1 (C1 only for en/fr/de/es; most languages stop at B2). Each level = **10–20 chapters**, each chapter a handful of lessons + a **checkpoint**. Lessons: vocab-in-context → native-speaker video → mixed exercise battery → community/AI speaking feedback. Source: [Busuu courses](https://www.busuu.com/en/it-works/courses), [talkreal review](https://talkreal.org/en/blog/busuu-review/).
- **Design takeaway:** chapter+checkpoint granularity (10–20 per level) is a sane authored-unit count per CEFR level; their weakness (thin C-band, no C2) is again our opening.

### 1.6 Pimsleur

- Up to **5 levels × 30 lessons × 30 min** (= 75 h audio for a full language). Method pillars: **graduated interval recall** (1967 schedule: 5 s, 25 s, 2 min, 10 min, 1 h, 5 h, 1 d, 5 d, 25 d, 4 mo, 2 y), **principle of anticipation** (forced recall before the answer is given), core high-frequency vocabulary, organic grammar. Sources: [Wikipedia](https://en.wikipedia.org/wiki/Pimsleur_Language_Programs), [pimsleur.com method](https://www.pimsleur.com/the-pimsleur-method/).
- **Design takeaways:** (1) anticipation = every audio card should demand recall *before* revealing; (2) their fixed intervals are 1967 tech — FSRS supersedes it, but the *in-lesson* micro-spacing (re-test a new item 3× within the same lesson at growing gaps) is a lesson-recipe rule worth copying; (3) 75 h gets you to ~A2/B1 listening-speaking only — audio-only ceilings low, which validates multi-modality.

### 1.7 Assimil

- ~**100 lessons** per course, one/day. **Passive wave** (lessons 1–49: listen + read + understand only, respecting the silent period) then **active wave** (from lesson 50: each day one new passive lesson + re-do lesson n−49 productively, translating L1→L2). Claims B2 and 2,000–3,000 words in ~5 months. Sources: [assimil.com method](https://www.assimil.com/en/articles/5-the-assimil-method), [Wikipedia](https://en.wikipedia.org/wiki/Assimil).
- **Design takeaway:** the **two-wave structure is a scheduling pattern, not a course pattern** — Journey can implement it *per item*: material is first met receptively (listen/read cards), and only re-surfaces as production (speak/write cards) after a maturity delay. This falls out naturally from FSRS if item cards carry a `modality ladder: recognize → recall → produce`.

### 1.8 Language Transfer

- Complete Spanish = **90 audio tracks × ~10–15 min** (~18 h total). Zero memorization; the entire course is *L1 leverage*: cognate rules ("-tion → -ción"), shared Latin roots, contrastive reasoning — "think" the word rather than memorize it. Source: [languagetransfer.org](https://www.languagetransfer.org/complete-spanish).
- **Design takeaway:** this is the strongest existing model for our **L1-specific scaffolding slots**. An 18-hour course produces startling speaking ability *purely from contrastive/cognate knowledge*. Journey should treat the (L1, L2) cognate map and transfer-trap list as first-class content that can compress early units dramatically for related pairs (es→en learner already "owns" thousands of -tion/-al/-ble words; the engine should credit them and fast-forward).

### 1.9 Refold

- Originally 4 stages, now **7 phases**: 1 Foundations (tools + ~1k words + basic grammar), 2 Reading, 3 Listening, 4 Speaking, 5 Writing, 6 Fluency, 7 Beyond — an input-first (comprehensible-input/immersion) pipeline where output is deliberately delayed until comprehension is strong. Source: [refold.la/roadmap](https://refold.la/roadmap).
- **Design takeaway:** the strand *mix shifts along the course*: input-share of the feed should rise steeply in B-band (readers, narration books, stories) while A-band is drill-heavy and C-band is production/mediation-heavy. Journey's existing readers + narration packs are exactly the Refold mid-game fuel.

### 1.10 Vocabulary frequency milestones

- Coverage is logarithmic: top **1,000** lemmas ≈ 72–80 % of running text; **2,000** ≈ 90 % of narrative text (78 % academic); **5,000** ≈ 95 %; **8,000–9,000 word families** needed for **98 %** coverage of written text (6,000–7,000 for spoken) — the unassisted-comprehension threshold. Sources: [Nation 2006](https://www.scienceguide.nl/wp-content/uploads/2017/11/nation-2006-vocabulary.pdf), [Nation & Waring 1997](https://www.lextutor.ca/research/nation_waring_97.html).
- **Design takeaway:** vocab bands per level (below) should be stated in frequency ranks, and the course's reading material must be **coverage-controlled**: a B1 reader card should hit ≥95 % known-token coverage for that learner (computable on-device from their FSRS item states — a genuinely differentiating feature).

### 1.11 HSK 3.0 (for the ZH instantiation)

- 2021 standard: **9 bands** ("three stages, nine levels"). Words cumulative: L1 500, L2 1,272, L3 2,245, L4 3,245, L5 4,316, L6 5,456, L7–9 11,092. Characters: 300 new per band for L1–6 (1,800), +1,200 across L7–9 = **3,000 chars total**. Sources: [chinesefor.us HSK 3.0](https://chinesefor.us/new-hsk-2021-requirements-levels-3-0-standards/), [mandarinzone](https://www.mandarinzone.com/new-hsk-test/).

### 1.12 Synthesis: what the best structures share

| System | Atom | Mid unit | Macro | Ceiling | Killer idea to steal |
|---|---|---|---|---|---|
| Duolingo | lesson 3–5 min | unit (theme+grammar) | CEFR-tagged section | B2 | rendered≠authored; feed atom size |
| Busuu | lesson | chapter + checkpoint | CEFR level | B2/C1 | checkpoint cadence, 10–20 chapters/level |
| Pimsleur | 30-min audio | level (30 lessons) | 5 levels | ~B1 | anticipation; in-lesson micro-spacing |
| Assimil | daily lesson | wave | 100 lessons | B2 | passive→active modality ladder |
| Language Transfer | 10-min track | — | 90 tracks | ~A2/B1 prod. | L1 leverage as content |
| FSI | drill block | unit (55/course) | volume | C1 (ILR 3) | overlearning; honest hour math |
| Refold | immersion session | phase | 7 phases | C2/native | input-share curve; delayed output |

Nobody ships: adaptive C2, coverage-controlled readers, or a modular activity contract. That's Journey's territory.

---

## Part 2 — The Journey spine (proposal)

### 2.1 Hierarchy and naming

```
Course (per target language, e.g. journey-en)
└── Arc (7)                 — macro level, CEFR-anchored, has a gate exam
    └── Unit (~190–200)     — theme × grammar × vocab band, has a boss
        └── Lesson (12–18)  — 5–8 min, one sitting, has a recipe
            └── Step (12–16)— one full-screen feed card, 20–40 s
```

- **Step** = the atomic feed card (the "activity" of the modular contract).
- **Lesson** = one scroll session; the smallest unit of completion/celebration.
- **Unit** = the authored artifact; the thing content teams (and generation pipelines in `dja`) actually write.
- **Arc** = the motivational macro-chapter; maps 1:1 to a CEFR level (with Arc 0 = Pre-A1 and Arc 6 = C2-and-beyond).

### 2.2 The seven arcs (baseline: Category-I-ish pairing, e.g. es→en)

| Arc | Name (wk. title) | CEFR | Units | Lessons | Cum. engaged hours | Vocab (cum. freq. ranks) |
|---|---|---|---|---|---|---|
| 0 | Launchpad | Pre-A1 | 2–4 | ~30 | 5 | 150 |
| 1 | Foundations | A1 | 20 | ~260 | 100 | 1,000 |
| 2 | Everyday | A2 | 22 | ~300 | 210 | 2,000 |
| 3 | Independence | B1 | 32 | ~480 | 400 | 3,500 |
| 4 | Confidence | B2 | 36 | ~560 | 600 | 5,500 |
| 5 | Command | C1 | 40 | ~660 | 830 | 8,000 |
| 6 | Summit | C2+ | 40 | ~700 | 1,100+ | 12,000+ |
| **Total** | | | **~192** | **~3,000** | **~1,100** | |

### 2.3 Granularity math (justification)

**Atom sizes.** Step ≈ 30 s median (20–40 s). Lesson = 12–16 steps ≈ 6.5 min engaged. Unit = 12–18 lessons + 1 boss ≈ 1.5–2.5 h of *first-pass* time.

**First-pass volume.** ~3,000 lessons × 6.5 min ≈ **325 h** of first-pass lesson time. (Sanity check: Duolingo renders 8,346 lessons ≈ 500+ h just to B2 — we're leaner per level because review is *woven*, not baked into duplicated lesson rows.)

**Review volume.** Under FSRS, each item is retrieved ~8–12 times over its lifetime; woven-review cards (30–40 % of feed cards after the first weeks) add ≈ **1.4× first-pass ≈ 450 h** across the course.

**Fluency/immersion volume.** Mini-game rounds, readers, narration listening, tutomaton conversations — the Four-Strands "meaning-focused input + fluency development" half — budgeted at **300–350 h**, rising share by arc (≈10 % of A1 feed time → ≈50 % of Summit feed time, per the Refold curve).

**Total ≈ 1,075–1,125 h to C2**, matching Cambridge's 1,000–1,200 GLH estimate for C2 and sitting honestly against FSI: FSI reaches ILR 3 (≈C1) in ~600 classroom + ~600 study hours for Cat I; our C1 cum. estimate of ~830 h is within that band. **We should not claim app-efficiency miracles** — the math is designed to be defensible, not flattering.

**Authoring feasibility.** The authored surface is ~192 unit specs per target language (not 3,000 lessons, and definitely not 3,000 × 54). Lessons are *rendered* from unit specs: recipe templates × item pools (phrases, words, grammar exercises) generated in `dja` and assembled on-device. This is the wordpan/phrase-pack precedent applied to curriculum.

**Difficulty multiplier.** Total hours scale per (L1, L2) via FSI-style categories: ×1.0 (Cat I), ×1.25 (Cat II), ×1.6 (Cat III/IV), ×1.9–2.1 (Cat V). The multiplier is realized **without changing the spine shape**: (a) longer Launchpad (script/phonology arcs), (b) an added parallel Script Track lane (ZH/JA/AR), (c) higher review-injection rate, (d) lower new-items-per-lesson. The unit list stays recognizable across all 54 courses; only pacing and lanes flex.

### 2.4 Anatomy of a LESSON (the recipe)

A lesson is a **recipe**: an ordered list of slot types the renderer fills from pools. Canonical "core teaching lesson" recipe (14 steps ≈ 6–7 min):

| # | Phase | Steps | Slot type (activity contract) | Notes |
|---|---|---|---|---|
| 1–2 | Warm-up | 2 | `review.retrieve` | FSRS-due items, any modality; success primes momentum |
| 3–5 | Present | 3 | `input.listen`, `input.read`, `input.picture` | comprehensible input; new items appear ≥2× receptively before any production (Assimil wave, per-item) |
| 6–10 | Controlled practice | 5 | `practice.pick`, `practice.match`, `practice.order`, `practice.cloze`, `practice.minimal-pair` | Pimsleur micro-spacing: each new item re-tested ~3× at growing in-lesson gaps |
| 11–12 | Production | 2 | `produce.speak` (STT-scored), `produce.write`/`produce.translate` | anticipation: prompt precedes any model answer |
| 13 | Fluency spike | 1 | `fluency.game-round` \| `fluency.shadow` \| `fluency.timed-review` | a lingo-hero/juice-squeeze round scoped to this unit's items |
| 14 | Wrap | 1 | `meta.recap` | what you learned + tease of next card; celebration |

Other lesson recipes (same 12–16-step envelope): **story lesson** (reader chapter split into cards with embedded checks), **dialog lesson** (multi-voice audio + role-play with STT), **grammar-focus lesson** (Language-Transfer-style guided-discovery cards then drills), **phonology lesson** (minimal pairs + pronunciation-coach), **review lesson** (pure FSRS harvest, auto-inserted), **boss lesson** (below), **gem lesson** (wordpan etymology / culture — variable-reward rare card).

Mix guidance per unit: ~60 % core, 1–2 story/dialog, 1–2 grammar-focus, 1 phonology (L1-conditioned), 1+ auto-review, 1 boss. Four Strands audit rule: across a unit, step time within ±10 % of 25/25/25/25 (input/output/language-focus/fluency) at B-band; A-band skews language-focus, C-band skews input+output.

### 2.5 Anatomy of a UNIT

A unit spec declares (this is effectively the course-pack schema seed):

```yaml
unit:
  id: en.a1.u07
  arc: 1
  theme: "Every day"                # human theme
  cando:                            # CEFR Companion Volume descriptor refs
    - "Can describe daily routines" # (store official descriptor IDs)
  grammar: [present-simple-1st-2nd, adverbs-of-frequency, time-prepositions]
  vocab_band: {ranks: [400, 480], domains: [daily-life, time]}
  phrase_domains: [phrase-learning, phrase-life-family-and-friends]  # existing packs
  lessons: [core, core, grammar-focus, core, story, core, phonology,
            core, dialog, review, core, boss]
  anchor_experience: {provider: lingo-hero, config: {itemset: unit}}
  l1_slots:                         # filled per native language at render time
    contrastive_note: transfer-matrix[L1][present-simple]
    cognate_pass: auto
    phonology_focus: phoneme-diff[L1]
```

- **Theme** = a life/content domain (travel, food, work, the ocean…) that motivates the vocab and dialogs. Grammar rides inside themes, Duolingo-style, but is *also* a first-class node graph (so the adaptive engine can rewind "past simple" specifically).
- **Anchor experience**: every unit nominates one existing mini-experience as its fluency centerpiece — this is how lingo-hero, juice-squeeze, hover-runner, beatlounge, corpan-city, readers, tutomaton get bolted into the spine retroactively via the activity contract.
- **Phrase-domain mapping**: the ~25 k-phrase corpus already spans 33 domains (`phrase-travel-essentials`, `phrase-life-cooking-basics`, `phrase-life-health-and-body`, `phrase-work-office-basics`, `phrase-professional-*`, `phrase-nature-*`, `phrase-humanities-*`, …). Units cite domains; the renderer pulls level-appropriate phrases (Entries already carry CEFR levels in `dja/cor/models.py`).

### 2.6 Checkpoints and bosses

- **Unit boss** (every unit, ~8 min): mixed-skill gauntlet over the unit's items + a spaced sample of older material — must include ≥1 `produce.speak` and ≥1 pure-listening step. Pass ≈ 80 % → celebration + next unit unlocks in the feed. Fail → engine prescribes 1–2 targeted remedial lessons (specific grammar nodes / item clusters), then a rematch. Boss difficulty is where **adaptivity is visible**; the rest of the adaptation (item selection, pacing) stays invisible.
- **Arc gate** (7 total): a placement-grade adaptive assessment mapped to the arc's can-do checklist; ACTFL-style rubric for the speaking part (STT + on-device LLM grading against descriptor rubrics). Passing grants a shareable arc badge with the honest CEFR framing ("A2 listening/reading demonstrated in-app"). **Gates double as test-out**: any gate can be attempted from the map at any time to fast-forward (placement = attempting gates in sequence during onboarding, minutes not hours).
- **Cadence check**: bosses every ~1.5–2.5 h, gates every ~100–250 h — consistent with Busuu's chapter-checkpoint density at the bottom and exam-prep density at the top.

### 2.7 How the spine parameterizes (per target × per L1)

**Per TARGET language (authored once per course):** unit list + themes, grammar node graph (language-specific: EN gets tense/aspect/articles; ZH gets aspect particles/measure words/把/被; ES gets subjunctive…), frequency list + vocab bands, script/phonology track config, coverage-controlled reading pool, exam-style gate content.

**Per L1 (injected, mostly generated):**
1. **Instruction language** — all step prompts/explanations render in L1 (existing i18n muscle, 54 locales already in `corpan-app/public/locales/`).
2. **Contrastive note slot** (1–2 cards/unit) — from a **transfer-trap matrix** keyed (L1, grammar-node): "Spanish speakers: English present simple ≠ *estar* + gerund…", "Japanese speakers: English articles have no equivalent — here's the 3-rule scaffold." Generated offline per (L1, node) pair; ~54 × ~300 nodes, LLM-generated + spot-audited, shipped inside the L1 layer of the course pack.
3. **Cognate accelerator** — auto-computed cognate lists per (L1, L2). For related pairs the engine pre-credits cognate vocabulary (Language-Transfer move): es→en learners see a "you already know 2,000 words" unit-0 card and their vocab FSRS seeds at `recognize` maturity; unrelated pairs get zero credit. This is the single biggest legitimate personalization win.
4. **Phonology selector** — minimal-pair drills chosen from a phoneme-inventory diff (ja→en: /r–l/, /b–v/; es→en: /iː–ɪ/, initial s-clusters; zh→en: final consonants; →ZH from atonal L1s: tone pairs). The pronunciation-coach experience is the provider.
5. **Translation-direction exercises** — L1↔L2 translate cards draw the L1 side from the existing 54-language phrase corpus: the same Entry row already has both translations. **This is why Journey is buildable at all: the bilingual item bank for all 54×54 pairs already exists.**

Everything else — the spine, item pools, recipes, bosses — is L1-agnostic. 54 courses, not 2,862.

---

## Part 3 — journey-en, Arc 0 + Arc 1: the first 20 units in detail

Assumptions: vocab ranks from an EN frequency list (e.g. COCA/SUBTLEX lemmas); ~45–50 new words/unit in Arc 1; phrase domains cite existing packs where they fit and name gaps where they don't.

**Arc 0 — Launchpad (Pre-A1, 2 units for EN):**
- **U0.1 The sounds of English** — alphabet & phonics vs L1 script (Latin-script L1s skim this in 1 lesson; ar/zh/ja/th/ko L1s get the full ramp), word stress, the L1-conditioned killer sounds (θ/ð, w/v, r). Providers: pronunciation-coach, `input.picture`. No grammar.
- **U0.2 Survival kit** — hello/bye/please/thanks/yes/no, numbers 1–10, "I don't understand / more slowly, please," name-spelling. Embedded placement probes; strong learners are offered the Arc-1 gate immediately (test-out).

**Arc 1 — Foundations (A1, units 1–20):**

| # | Unit theme | Grammar points | Can-do (CEFR A1 descriptors) | Vocab band (ranks) | Phrase domains / assets | Anchor experience |
|---|---|---|---|---|---|---|
| 1 | **Hello!** | *be* (I/you), subject pronouns, basic word order | introduce self, greet | 1–60 | `phrase-learning` (greetings) | juice-squeeze (greetings set) |
| 2 | **Who are you?** | *be* (all persons), yes/no questions, a/an, countries & nationalities | ask/answer who someone is | 60–120 | GAP: nationalities set | lingo-hero |
| 3 | **My people** | possessive adjectives, possessive *'s*, this/that | describe family simply | 120–170 | `phrase-life-family-and-friends` | picture-card match |
| 4 | **Numbers & time** | numbers to 100, *it's* + time, days, prepositions *at/on* | tell time, dates | 170–210 | GAP: time/number drills (generable) | beatlounge (number rhythm) |
| 5 | **Food & drink** | *like/want* + noun, *some/any* (lexical intro), ordering formulas | order food & drink | 210–260 | `phrase-life-cooking-basics`, `phrase-travel-essentials` | juice-squeeze |
| 6 | **My town** | *there is/are*, prepositions of place, *the* | describe where things are, ask for places | 260–320 | `phrase-travel-essentials`, `phrase-places-geography-world` | corpan-city (navigate scene) |
| 7 | **Every day** | present simple (I/you/we/they), adverbs of frequency | describe routines | 320–400 | `phrase-learning` | hover-runner (verb set) |
| 8 | **She works** | 3rd-person *-s* (the trap — extra drill mass), jobs, *What does…?* | say what people do | 400–450 | `phrase-work-office-basics`, `phrase-professional-education-teaching` | lingo-hero |
| 9 | **My stuff** | *have/has (got)*, plurals incl. irregular, colors, demonstratives pl. | describe possessions | 450–500 | `phrase-tech-computers-basics` (objects subset) | picture cards |
| 10 | **Can you?** + Mini-gate | *can/can't* (ability, request, permission) | make simple requests | 500–540 | `phrase-learning` | **boss+: cumulative gauntlet u1–10** |
| 11 | **Right now** | present continuous, simple-vs-continuous contrast, weather | describe what's happening | 540–590 | `phrase-life-the-night`, `phrase-nature-birds-everyday` (scene vocab) | stargate reader (scene descriptions) |
| 12 | **Getting around** | imperatives, directions, *How do I get to…* | follow/give directions | 590–640 | `phrase-travel-essentials`, `phrase-vehicles-cars-and-driving` | corpan-city |
| 13 | **Shopping & money** | *How much/many*, uncountables properly, *this/these* in transactions | handle simple purchases | 640–690 | `phrase-travel-essentials`; GAP: dedicated shopping set | dialog lesson (shop role-play) |
| 14 | **Yesterday** | past simple *was/were* + regular *-ed*, time markers | say where you were, what happened | 690–740 | `phrase-life-festivals-world` (events) | story lesson |
| 15 | **Went, saw, did** | irregular past (top 25 verbs), negatives/questions with *did* | tell a simple story of the past | 740–790 | narration micro-stories (existing book assets, graded) | earthgate reader |
| 16 | **Plans** | *going to*, tomorrow/next-week markers, invitations (*Do you want to…*) | make plans & invitations | 790–840 | `phrase-life-family-and-friends` | dialog + tutomaton (scripted chat) |
| 17 | **Feeling good, feeling bad** | *feel/hurt*, *should* (advice, lexical), body parts | describe health, get help | 840–890 | `phrase-life-health-and-body` | pronunciation-coach focus |
| 18 | **House & home** | rooms/furniture, *whose/mine/yours*, prepositions review | describe home | 890–940 | GAP: home/furniture set (generable) | picture cards |
| 19 | **Better, best** | comparatives & superlatives (incl. good/bad), *than* | compare things simply | 940–990 | `phrase-sports-soccer-basics` (comparison-rich) | lingo-hero |
| 20 | **My story (A1 finale)** | integrative review; connectors *and/but/because* | 3-sentence self-narrative, spoken + written | consolidation to 1,000 | all of Arc 1 | **Arc gate: A1 exam** — adaptive checklist across all A1 can-dos, ACTFL-style rubric on the spoken narrative |

Notes: (1) content gaps found: nationalities, time/numbers, shopping, home — all small, generable via the existing `dja` phrase pipeline; (2) unit 8 deliberately isolates 3rd-person *-s* (highest-frequency A1 fossilization error in EN); (3) L1 slots fire per unit — e.g. u11 contrastive card for es (present continuous overlap), u2 article scaffold for ja/ru/zh/ko, u1 cognate accelerator for Romance/Germanic L1s.

---

## Part 4 — Coarse outline, Arcs 2–6 (to C2 and the wildest grammar)

**Arc 2 — Everyday (A2, 22 units, cum. ~210 h, ranks →2,000).** Present perfect (intro, vs past simple), past continuous, *will* vs *going to*, first conditional, obligation modals (*must/have to/should*), phrasal verbs I, adverbs, gerund/infinitive first patterns. Themes: travel deep-dive, work & school, technology basics, celebrations (`phrase-life-festivals-world`), sports (`phrase-sports-*`), nature & weather (`phrase-nature-*`), camping (`phrase-life-camping-basics`), the night sky (`phrase-sciences-astronomy-night-sky`). Reading share of feed rises to ~20 %; first coverage-controlled graded readers. Gate: A2 exam (KET-style task shapes).

**Arc 3 — Independence (B1, 32 units, cum. ~400 h, →3,500).** Full tense system incl. present perfect continuous & past perfect; second conditional; passive (present/past); reported speech I; relative clauses (defining); gerund/infinitive system; phrasal verbs II; connectors (*although, however, in order to*). Themes broaden into content domains — music (`phrase-arts-music-fundamentals`), film (`phrase-arts-cinema-and-film`), computers (`phrase-tech-computers-basics`), economics basics (`phrase-humanities-economics-basics`), geography (`phrase-places-geography-world`), the ocean (`phrase-nature-the-ocean`). Input share ~35 %: narration-book chapters become recurring story-lesson lanes; tutomaton graduates from scripted to semi-open dialog with correction. Gate: B1 (PET-style).

**Arc 4 — Confidence (B2, 36 units, cum. ~600 h, →5,500 = 95 % coverage).** Third & mixed conditionals; perfect modals (*must have been*); full passive incl. *have sth done*; reported speech II; non-defining relatives & reduced clauses; speculation & deduction; discourse markers; register (formal/informal); collocation as an explicit object of study; phrasal verbs III (separability, register). Themes go professional & abstract: `phrase-professional-hospitality-service`, `-sales-customer-success`, `-logistics-supply-chain`, `-construction-trades`, mythology (`phrase-humanities-mythology-world`), geology (`phrase-geology-basics`), martial arts (`phrase-sports-martial-arts`). Input share ~45 %; wordpan etymology gems become standard reward cards. Gate: B2 (FCE-style) — **the Duolingo/Busuu ceiling; everything after is open water.**

**Arc 5 — Command (C1, 40 units, cum. ~830 h, →8,000).** Inversion after negative adverbials (*Never have I…*, *Hardly had she…*); cleft sentences (*It was X that…*, *What I need is…*); mandative subjunctive (*insist that he be…*); ellipsis & substitution; hedging & stance (*arguably, it would appear that*); nominalization (academic register); advanced connectives; idiom families; regional variation intro (US/UK/AU); humor & understatement. Mediation enters (CEFR CV): summarize, paraphrase, explain-to-someone cards graded by the on-device LLM. Themes: `phrase-professional-legal-services`, `-healthcare-clinical`, `-finance-accounting`, `-lab-research`, `-software-engineering`, philosophy (`phrase-humanities-philosophy-basics`). Input share ~50 %: full narration books, long-form readers. Gate: C1 (CAE-style + rubric-graded production portfolio).

**Arc 6 — Summit (C2+, 40 units, cum. ~1,100 h, →12,000+, incl. 98 %-coverage reading).** The wildest grammar the language has, treated as first-class curriculum, not trivia:
- **Syntax at the edge:** *were*-inversion conditionals (*Were she to ask…*), *should*-inversion, fronting & topicalization, pseudo-clefts, tails/dislocation in speech, whiz-deletion, gapping, comparative correlatives (*the more…, the more…*), *as/though*-fronted concessives (*Strange though it may seem…*).
- **Formal/literary morphology:** *whom/whomever*, *whence/whither/hither* (recognition), archaic 2nd person (*thou/thee/thy* — for reading King James/Shakespeare), *-eth/-est* (recognition), subjunctive relics (*be that as it may, suffice it to say, come what may*).
- **Register mastery:** legalese (*hereinafter, notwithstanding*), academic hedging, journalism vs fiction vs bureaucratese; irony, sarcasm, litotes; dialect & sociolect (AAVE features, Scots, Indian English) — receptive competence, taught respectfully.
- **Prosody & pragmatics:** contrastive stress changing meaning, implicature, politeness strategies, discourse-level cohesion.
- **Literature lane:** graded ascent from contemporary fiction → 19th-c. prose → Shakespeare excerpts → poetry; wordpan etymology corpus (11,757 words × 54 langs) as the lexical-depth engine.
- Units here are input/production-heavy (60 %+), boss = mediation & production portfolios (write a parody in register X; explain a legal clause in plain English), graded by LLM rubric. Gate: Summit exam (CPE-style) + "wild grammar gauntlet" as the endgame boss.

**Vocab-milestone alignment check:** A2 gate = 2,000 (90 % narrative coverage → graded readers unlock); B2 gate = 5,500 (95 % — authentic-with-support unlocks); C1→C2 crosses 8–9 k word families (98 % — unassisted authentic text). The reading lane's difficulty is driven by the learner's *measured* coverage, not the arc label.

---

## Part 5 — Proof of generality: journey-zh sketch

Same 7-arc spine, same recipes, same contract. What the parameters change:

1. **Launchpad expands 2 → ~10 units** (the difficulty multiplier made visible): pinyin system; the 4 tones + neutral; tone-pair drills (the 20 combinations); syllable inventory; stroke order & radicals; first 100 characters; typing (pinyin IME). Providers: **hanzipan** is the anchor experience of the whole arc; pronunciation-coach does tone scoring (STT pitch-contour grading).
2. **A parallel Script Track lane** runs the length of the course — interleaved character lessons woven into the feed (never a separate app-mode): 3,000 characters over the course, banded to HSK 3.0 (300/level through band 6, +1,200 across 7–9). Each character card: form (stroke animation + trace), sound (+tone), meaning, components/etymology (hanzipan data), then FSRS like any item. Feed share of script cards ≈ 20 % at A-band, tapering to ~8 % at C-band.
3. **Romanization fade:** pinyin displayed on every word at Arc 1, then per-word removal once that word's character form is FSRS-mature (the same mechanism as translation-crutch fade in journey-en; existing narration packs already carry romanization fields).
4. **Grammar graph is swapped, spine shape isn't.** No tense morphology; instead: aspect particles 了/过/着; measure words (the classifier system, drip-fed for the whole course like EN articles-in-reverse); 是…的 focus; resultative & directional complements (说完, 走进来); 把 and 被 constructions; topic-prominence & pro-drop; comparatives with 比; question particles 吗/呢/吧. Unit themes stay ~identical to journey-en Arc 1 (Hello → Who are you → Family → Numbers/time → Food…) — **theme list is spine-level, grammar payload is course-level.**
5. **Vocab bands re-anchor to HSK 3.0:** Arc 1 ≈ HSK 1–2 (→1,272 words), Arc 2 ≈ HSK 3 (→2,245), Arc 3 ≈ HSK 4–5 (→4,316), Arc 4 ≈ HSK 6 (→5,456), Arc 5 ≈ HSK 7–8, Arc 6 ≈ HSK 9 (→11,092) + chengyu + 文言文.
6. **Summit content (the wildest grammar of ZH):** chengyu (四字成语) families and their classical allusions; formal written register (书面语) vs speech; 文言文 (Classical Chinese) reading track — 之乎者也, classical particles, Tang poetry, Analects excerpts; topic-chain discourse; regional register awareness. The literature lane ascends: modern prose → 鲁迅 → classical poetry.
7. **L1 slots work identically:** en→zh learners get contrastive cards on tones-vs-intonation and measure-words-vs-articles; ja→zh learners get a *huge* cognate accelerator (kanji→hanzi mapping pre-credits ~1,500 characters at `recognize` maturity — the Language-Transfer move, script edition); vi/th→zh learners get tone-system *mapping* drills instead of tone *introduction*.
8. **Hour math:** ×~1.9 multiplier → ~2,100 h to C2-equivalent, consistent with FSI Cat V (2,200 classroom hours to ILR 3). Unit count grows only ~192 → ~240 (Launchpad + script-track lessons); the rest of the multiplier is pacing (fewer new items/lesson, more review injection), not more authored units.

Generality claim: the spine schema needs exactly four language-conditional features to cover both EN and ZH — (a) variable-length Launchpad, (b) optional parallel Script Track lane, (c) per-course grammar node graph, (d) per-course vocab-band source (frequency list vs HSK-style standard). Arabic (script+diglossia), Japanese (two-lane script), Korean (speech levels), Russian (case morphology) all fit inside the same four knobs plus grammar-graph content.

---

## Part 6 — Open questions / gaps (honest)

1. **Grammar node graphs are the big authoring lift** — ~300 nodes × 54 target languages, each with ordering constraints. EN/ES/FR/DE/ZH have rich public syllabi to mine (Cambridge/CEFR grammar profiles, HSK standards); long-tail languages (sw, ms, da…) will need LLM-drafted graphs + native-speaker audit. Recommend: ship journey-en and journey-es first; the graph schema matters more than 54 instances now.
2. **CEFR descriptor licensing**: Council of Europe descriptors are © CoE, reproduced widely with attribution — verify the exact reuse terms before embedding official text in packs (paraphrased can-dos are safe).
3. **Phrase corpus CEFR-level coverage per domain is unaudited** — Entries carry CEFR levels (`dja/cor/models.py`), but whether e.g. `phrase-professional-legal-services` has enough A2-band items (it shouldn't need them) vs whether A1 travel items exist in volume needs a quick census query before unit→domain mapping is finalized.
4. **Frequency lists per target language**: need a licensed/open frequency list per 54 languages (SUBTLEX/OpenSubtitles-derived lists exist for most; long tail again).
5. **Speaking assessment validity**: whisper + LLM rubric grading for arc gates is plausible but uncalibrated; needs a calibration pass (this codebase's own calibration-pipeline discipline applies).
6. **Exact review-multiplier (1.4×) is an estimate** — should be re-derived from FSRS simulator runs with our item volumes before we commit UX copy about total course length.
7. **Duolingo internal numbers** (991 units / 8,346 lessons) vs visible path (286 units) are reconciled by interpretation, not documentation — treat as order-of-magnitude only.

## Sources

- [Cambridge English — Guided learning hours](https://support.cambridgeenglish.org/hc/en-gb/articles/202838506-Guided-learning-hours) · [LanguageCert GLH](https://www.languagecert.org/en/guided-learning-hours)
- [Council of Europe — CEFR descriptors](https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors) · [CEFR Companion Volume 2020](https://rm.coe.int/cefr-companion-volume-with-new-descriptors-2020/16809ea0d4)
- [ACTFL — Assigning CEFR ratings to ACTFL assessments](https://www.actfl.org/uploads/files/general/Assigning_CEFR_Ratings_To_ACTFL_Assessments.pdf) · [Cathoven ACTFL vs CEFR](https://www.cathoven.com/blog/comparing-actfl-the-american-standard-with-cefr-the-european-standard/)
- [US State Dept — Foreign language training](https://www.state.gov/national-foreign-affairs-training-center/foreign-language-training) · [FSI language difficulty](https://www.fsi-language-courses.org/blog/fsi-language-difficulty/) · [FSI Spanish Basic Course](https://www.fsi-language-courses.org/fsi-spanish-basic-course/)
- [duolingodata.com](https://duolingodata.com/) · [duocorner — sections guide](https://duocorner.com/how-many-sections-in-duolingo/) · [Duolingo blog — teaching English](https://blog.duolingo.com/how-duolingo-teaches-english/) · [duoplanet — learning path](https://duoplanet.com/duolingo-learning-path/)
- [Busuu — courses](https://www.busuu.com/en/it-works/courses) · [talkreal Busuu review](https://talkreal.org/en/blog/busuu-review/)
- [Pimsleur — method](https://www.pimsleur.com/the-pimsleur-method/) · [Wikipedia — Pimsleur Language Programs](https://en.wikipedia.org/wiki/Pimsleur_Language_Programs)
- [Assimil — the method](https://www.assimil.com/en/articles/5-the-assimil-method) · [Wikipedia — Assimil](https://en.wikipedia.org/wiki/Assimil)
- [Language Transfer — Complete Spanish](https://www.languagetransfer.org/complete-spanish)
- [Refold roadmap](https://refold.la/roadmap)
- [Nation 2006 — How large a vocabulary is needed](https://www.scienceguide.nl/wp-content/uploads/2017/11/nation-2006-vocabulary.pdf) · [Nation & Waring 1997](https://www.lextutor.ca/research/nation_waring_97.html)
- [HSK 3.0 levels (chinesefor.us)](https://chinesefor.us/new-hsk-2021-requirements-levels-3-0-standards/) · [mandarinzone HSK 3.0](https://www.mandarinzone.com/new-hsk-test/)
