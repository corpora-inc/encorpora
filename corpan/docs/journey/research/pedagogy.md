# Journey Mode — Learning-Science Foundations & Pedagogical Charter

**Author:** learning-science lead (research subagent)
**Date:** 2026-07-03
**Status:** Input to chief architect for Journey mode design
**Scope:** Synthesis of second-language-acquisition (SLA) evidence into concrete, opinionated design rules for a prescriptive, adaptive, offline, on-device zero-to-fluency course (any-L1 → any of ~54 target languages).

---

## 0. How to read this document

Sections 1–11 are the evidence base, each ending in **Design implications**. Section 12 converts everything into numeric design rules (strand ratios, activity mixes, review ratios, L1 taper, course-length scaling). Section 13 maps rules onto existing Corpan experiences. Section 14 is the one-page **Journey Pedagogical Charter**. Section 15 lists sources. Section 16 is honest gaps.

The overriding meta-finding: **no single method wins**. The best-evidenced position is Paul Nation's: a *balanced* course where input, output, deliberate study, and fluency work each get sustained time, with vocabulary sequenced by frequency, review scheduled by a memory model, and grammar taught only when the learner is developmentally ready. Journey mode's core differentiator should be that the *feed algorithm enforces the balance* that self-directed learners never maintain.

---

## 1. Paul Nation's Four Strands — the backbone

Nation (1996, 2007) divides all course time into four strands, each ~25% of total time ([Nation 2007 PDF, Victoria University](https://www.victoria.ac.nz/__data/assets/pdf_file/0019/1626121/2007-Four-strands.pdf); [TESL Ontario summary](http://contact.teslontario.org/applying-the-four-strands-framework-in-linc-classrooms/)):

1. **Meaning-focused input** — listening/reading for the message, ~98% of running words known (i.e., very easy material).
2. **Meaning-focused output** — speaking/writing to communicate, pushing slightly beyond comfort.
3. **Language-focused learning** — deliberate study: flashcards, pronunciation drills, grammar explanation, dictation. Nation caps this at 25%; more is counterproductive.
4. **Fluency development** — using only *already-known* language under time pressure (speed reading, timed retellings, rhythm games). Zero new items. This strand is the most neglected in apps and classrooms.

The strands are defined by *conditions*, not activity names: the same audio clip is "input" when new words appear, and "fluency" when everything is already known. This is the key insight for a modular activity contract — **each activity instance must declare which strand it is serving given the learner's current known-item set**, not have a strand hard-coded per activity type.

**Design implications**
- The Journey scheduler's top-level invariant is a rolling 25/25/25/25 time budget across the four strands, measured over a ~2-week window, not per session (single sessions can be lopsided; the window cannot).
- Strand assignment is computed per activity instance: `strand = f(activity_type, item_set ∩ learner_known_set)`.
- Fluency-strand content is *recycled* content: yesterday's input passages become next week's speed drills. This makes the content budget go 2–3× further — critical for 54×54 course pairs.

---

## 2. Comprehensible input (Krashen i+1) and extensive reading

Krashen's Input Hypothesis: acquisition happens when learners understand messages slightly above their level ("i+1"); affective stress blocks acquisition ([Krashen, *Principles and Practice*](https://www.sdkrashen.com/content/books/principles_and_practice.pdf); [The Case for Comprehensible Input](https://www.sdkrashen.com/content/articles/case_for_comprehensible_input.pdf)). The strong claim ("input is sufficient; output and grammar study contribute nothing") is **not** supported — Canadian immersion students with massive input still fossilize grammatically, and neuro-ecological critiques note active production recruits distinct brain networks ([Frontiers 2025 critique](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1636777/full)). But the weak claim — large volumes of understood input are *necessary* and drive most vocabulary/collocation growth — is among the best-supported findings in SLA. A 2025 meta-analysis of extensive reading confirms significant positive effects on L2 learning ([Educational Psychology Review](https://link.springer.com/article/10.1007/s10648-025-10068-6)).

The operational definition of "comprehensible": **95–98% lexical coverage** (see §5). "i+1" is fuzzy in Krashen but implementable precisely: text where 95–98% of tokens are known and the unknown 2–5% are the learner's next-due frequency-band items.

**Design implications**
- Every input activity (earthgate/stargate readers, narration packs, listening cards) must be *coverage-gated*: Journey computes token coverage against the learner's known-word model and only feeds material in the 95–98% band (90–95% allowed if glosses/L1 tap-to-translate available).
- Because Corpan has ~25k translated phrases and full narrated books, coverage computation over segments is cheap and offline. This is Corpan's single biggest structural advantage: **exact i+1 targeting from the learner model**, which classrooms can't do.
- Volume matters more than cleverness: the input strand should be the *largest raw-minute* consumer at every level.

---

## 3. Retrieval practice, spacing, and FSRS

- Retrieval practice beats restudy with mean effect **g ≈ 0.50** across meta-analyses ([MedCrave synthesis](https://medcraveonline.com/AHOAJ/retrieval-repetition-and-retention-unveilingvocabulary-acquisition-strategies-for-esl-learners.html)).
- Spacing beats massing; the optimal inter-study interval *grows with the retention interval* (Cepeda et al.; [Kim & Webb 2022 L2 meta-analysis, 48 experiments, N=3,411](https://onlinelibrary.wiley.com/doi/abs/10.1111/lang.12479)).
- **FSRS** (Free Spaced Repetition Scheduler) is the current best-in-class open scheduler: a memory model fit to ~700M reviews, predicting per-item recall probability and scheduling at a target desired-retention. Benchmarks on 20k+ Anki collections: FSRS beats SM-2 in ~99.6% of collections and achieves the **same 90% retention with ~20–30% fewer reviews** ([open benchmark](https://expertium.github.io/Benchmark.html); [Anki FAQ](https://faqs.ankiweb.net/what-spaced-repetition-algorithm)). Anki made it default in 23.10.
- Duolingo's half-life regression validated memory-model scheduling at scale: 45% lower recall-prediction error vs Leitner, +12% daily activity in A/B ([Settles & Meeder, ACL 2016](https://research.duolingo.com/papers/settles.acl16.pdf); [HLR repo](https://github.com/duolingo/halflife-regression)).
- Interleaving (mixing skills/categories within a session) generally beats blocking ([MDPI 2025](https://www.mdpi.com/2076-328X/15/5/692)).
- One nuance from Kim & Webb: massing is roughly as good as spacing for *tacit/semantic* knowledge in contextual learning; spacing wins for explicit form knowledge. So don't space-out *everything* — a new grammar pattern can be massed within one session, then spaced afterwards.

**Design implications**
- **FSRS is the memory spine of Journey.** Every learnable item (word sense, phrase, grammar pattern, phoneme contrast, character/hanzi) gets an FSRS memory state. It's open-source, small, and runs trivially on-device — perfect fit for offline-first.
- Target desired-retention **0.90** for core vocabulary; 0.85 for long-tail items (cheaper); 0.95 only for safety-critical confusables.
- **Implicit grading**: most reviews should NOT be flashcards. Any activity that touches an item (tapped word in reader, hit note in lingo-hero, correct STT match in pronunciation-coach) emits a graded review event into the same FSRS state. Flashcard-style explicit review is the fallback for items no scheduled activity will cover in time.
- Interleave item types within a session; never serve 20 consecutive reviews of one category.

---

## 4. Output hypothesis and corrective feedback

Swain's output hypothesis: producing language forces syntactic processing, reveals gaps ("noticing"), and enables hypothesis-testing — comprehension alone lets learners skate on semantics ([overview & critique](https://www.academia.edu/62489869/A_Critique_of_Merrill_Swain_s_Output_Hypothesis_in_Language_Learning_and_Teaching)). Corrective-feedback meta-analysis ([Li 2010, Language Learning, 33 studies](https://www.researchgate.net/publication/229940242_The_Effectiveness_of_Corrective_Feedback_in_SLA_A_Meta-Analysis)): CF works (medium effect, durable); **explicit feedback beats implicit recasts** on delayed measures; feedback types that *push the learner to self-repair* (prompts, clarification requests, elicitation) outperform recasts, which learners often don't even notice ([Lyster 2004 via integrated-loop review](https://files.eric.ed.gov/fulltext/EJ1140434.pdf)). Pushed-output studies show accuracy and fluency gains ([EJ1127288](https://files.eric.ed.gov/fulltext/EJ1127288.pdf)).

**Design implications**
- Output activities must *push*: cloze-with-production, "say the sentence" with STT, type-the-translation — not just recognition taps.
- Feedback pattern (the "prompt-first loop"): on error → (1) signal error + locate it, (2) give the learner ONE self-repair attempt, (3) then show the correct form explicitly, (4) require one successful reproduction. Never silently show the answer; never make them guess more than once (frustration).
- The on-device Qwen3 tutor (tutomaton) is the corrective-feedback engine for free-form output: it should be prompted to *prompt* ("almost — check your verb ending") before revealing.
- Errors are gold: every diagnosed error type feeds the learner model and schedules a targeted language-focused micro-lesson.

---

## 5. Frequency-based vocabulary ordering — the coverage math

Coverage of English running text by frequency-ranked word families ([Nation & Waring 1997](https://www.lextutor.ca/research/nation_waring_97.html); [Nation 2006 via ResearchGate](https://www.researchgate.net/publication/239928724_How_Large_a_Vocabulary_Is_Needed_for_Reading_and_Listening); [Webb & Nation 2008](https://www.wgtn.ac.nz/lals/resources/paul-nations-resources/paul-nations-publications/publications/documents/2008-Webb-Evaluating-vocabulary-load.pdf)):

| Word families known | Coverage (written) | Coverage (spoken) |
|---|---|---|
| 1,000 | ~75–80% | ~80–85% |
| 2,000 | ~80–85% | ~87–90% |
| 3,000 | ~85–90% (+ proper nouns ≈ 95%) | ~93–95% |
| 5,000 | ~95% (incl. proper nouns) | ~96%+ |
| 6,000–9,000 | ~98% (reading novels/newspapers) | — |

Comprehension thresholds: **98% coverage** for comfortable unassisted reading, **95%** minimum acceptable (Hu & Nation 2000). For *listening*, the bar is lower: **95% coverage suffices**, reachable with **2,000–3,000 word families** ([van Zeeland & Schmitt 2013; replication Cambridge](https://www.cambridge.org/core/journals/language-teaching/article/how-much-vocabulary-is-needed-to-use-english-replication-of-van-zeeland-schmitt-2012-nation-2006-and-cobb-2007/1D217A56A2E0056E67802A6A8360FDDE)).

The brutal Zipfian asymmetry: the first 1,000 families buy ~80%; the next 8,000 buy the last ~18%. Incidental learning needs **~6–20+ encounters per word** in context before durable knowledge forms ([Webb 2008](https://www2.hawaii.edu/~readfl/rfl/October2008/webb/webb.pdf); [Uchihara et al. 2019 meta-analysis](https://www.researchgate.net/publication/330774796_The_Effects_of_Repetition_on_Incidental_Vocabulary_Learning_A_Meta-Analysis_of_Correlational_Studies); [EAP Foundation summary](https://www.eapfoundation.com/vocab/learn/incidental/)). Deliberate paired-associate study (flashcards/word cards) is *highly* efficient and its knowledge transfers to context ([word-cards research synthesis, Frontiers 2022](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2022.984211/full)).

**Design implications**
- **The course spine is a frequency-ranked lemma list per target language** (spoken-corpus-weighted for the first 3k, since listening is primary early). Every unit's new-vocab budget draws from the next frequency band. No themed vocab dumps ("20 zoo animals") that ignore frequency — theme units may only *sample* from within the current band plus a small "personal relevance" quota (~15% learner-chosen off-band words).
- Milestones expressed as coverage, not word counts: "You now understand ~90% of everyday speech" is both honest and motivating.
- Deliberate flashcard-style learning front-loads the first 1,000 families FAST (weeks, not months) because nothing else unlocks comprehensible input. After ~2–3k, incidental learning through coverage-gated input takes over as the main vocab channel, with FSRS mopping up leeches.
- Journey must guarantee the 6–20 encounter budget: after an item is introduced, the content selector *biases* subsequent input passages to contain it (encounter-injection), rather than relying on luck.

---

## 6. Grammar: acquisition orders, teachability, explicit vs implicit

- Morpheme-order studies and Pienemann's **Processability Theory** show grammar emerges in fixed developmental stages constrained by processing capacity (e.g., ES-of-English: single words → SVO → fronting → inversion → subordinate clauses). The **Teachability Hypothesis**: instruction only sticks when the learner is at stage n−1 for a stage-n structure; teaching ahead of readiness is wasted or harmful ([Wikipedia overview](https://en.wikipedia.org/wiki/Teachability_Hypothesis); [Pienemann 2015, Language Learning](https://onlinelibrary.wiley.com/doi/10.1111/lang.12095); [Conti's practical sequencing summary](https://gianfrancoconti.com/2025/02/12/in-which-order-should-we-teach-grammar-structures-manfred-pienemanns-answer/)).
- **Explicit instruction works**: Norris & Ortega's landmark meta-analysis (49 studies) found focused L2 instruction yields large durable gains and **explicit > implicit** instruction ([Norris & Ortega 2000](https://onlinelibrary.wiley.com/doi/abs/10.1111/0023-8333.00136)); replicated and extended by Goo et al. (34 studies, [2015 update](https://benjamins.com/catalog/sibil.48.18goo)) and Spada & Tomita ([2010](https://onlinelibrary.wiley.com/doi/10.1111/j.1467-9922.2010.00562.x)), who found explicit instruction better for both simple AND complex features.
- Reconciliation with Krashen: explicit rule knowledge doesn't *become* acquisition directly, but it accelerates noticing in subsequent input, and brief explicit episodes embedded in meaning-focused work (focus-on-form) are as effective as standalone grammar lessons.

**Design implications**
- Per target language, define a **staged grammar graph** (nodes = structures, edges = processability prerequisites). The scheduler introduces a structure only when its prerequisites show ≥~80% accuracy in production. This is exactly the "auto-adjusts to performance" requirement — readiness-gated, not calendar-gated.
- Grammar teaching format: **short explicit rule card (≤60 seconds, in L1 early on) → immediate input flood featuring the structure → pushed-output practice → FSRS-scheduled review of the pattern itself**. Grammar patterns are SRS items, like words.
- Never block progress on grammar accuracy of late-acquired features (e.g., English 3rd-person -s is famously late regardless of teaching). Track it, gently recycle it, don't gate on it. Gate only on processability-order features.
- Expect and tolerate developmental errors; the error classifier should distinguish "developmental (ignore/recycle)" from "fossilization risk (target with CF)".

---

## 7. Pronunciation: HVPT and shadowing

- **High Variability Phonetic Training** (perception training on difficult phoneme contrasts, many talkers, varied contexts, trial-by-trial feedback) is "the most empirically supported phonetic training paradigm": meta-analysis of 79 studies shows **g = 0.92** pre/post and **g = 0.67** vs control, with long-term retention and generalization to new voices/words ([SSLA meta-analysis](https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/high-variability-phonetic-training-hvpt-a-metaanalysis-of-l2-perceptual-training-studies/6ABB8C1F32D88D53EA8D05A4565E76F6); [Thomson 2018](https://benjamins.com/catalog/jslp.17038.tho)). Crucially, perception training improves *production* too.
- **Shadowing** (simultaneous repetition over audio) reliably improves comprehensibility, fluency, prosody/rhythm, and listening; evidence on individual segmentals is inconclusive ([2025 systematic review](https://www.tandfonline.com/doi/full/10.1080/29984475.2025.2546827); [Oxford systematic review](https://ora.ox.ac.uk/objects/uuid:3104cae1-3a6b-400a-b173-de44384238d2/files/r1z40kv86w)). Pronunciation instruction generally shows medium-to-large effects (d ≈ 0.8–0.89, Lee/Jang/Plonsky via the shadowing review).
- Perception precedes production: you cannot reliably produce a contrast you cannot hear.

**Design implications**
- Week-1 content includes an **L1-specific phoneme-contrast diagnostic** (e.g., ES→EN: /ɪ–iː/, /b–v/; JA→EN: /l–r/). Corpan has multi-voice TTS across backends (Chatterbox voices + Gemini voices) = the *talker variability* HVPT needs, generated offline into packs. This is a rare structural advantage: build a dedicated HVPT minimal-pair activity (perceive → tap which word) with per-contrast FSRS states.
- Shadowing is a first-class activity type over existing narration packs (play segment → record → on-device Whisper scores word-match + timing). Slot in fluency strand once text is known; language-focused strand when new.
- Pronunciation work starts **day 1** (perception) — early phonological categories resist later relearning — but production accuracy targets stay lenient: target *comprehensibility*, not nativeness.

---

## 8. Listening-first vs reading-first

Evidence for listening/comprehension-first (TPR, Winitz, ALG): early listening focus builds phonology and parsing without forcing error-laden early speech; comprehension-priority approaches outperform speak-from-day-1 in several classic studies ([EJ1066407](https://files.eric.ed.gov/fulltext/EJ1066407.pdf)). But strict long "silent periods" have weak modern support, and output research (§4) shows production drives syntax. Reading gives better form-noticing and self-pacing; listening gives phonology and is where coverage thresholds are cheapest (95% at 2–3k families, §5). Script languages (ZH, JA, AR) invert the economics: reading is *expensive* early, listening is not.

**Resolution: modality follows the script and the stage, not ideology.**

**Design implications**
- Stage 0–A1: **listening-primary** (~60/40 listen:read for Latin-script pairs). Every new item is *heard before it is seen*. Output in week 1 is imitative (shadow/repeat), not generative.
- For opaque-script targets (ZH/JA/AR/KO...): decouple the script track from the language track. Speech/listening runs ahead on romanization/pinyin + audio; script literacy is its own FSRS-driven strand (hanzipan already exists for this). Don't hold spoken progress hostage to characters.
- Generative output (constructing own sentences) begins ~week 2–4, not month 3: short, pushed, low-stakes, machine-graded. The "silent period" in Journey is days, not months — but *pressure-free*: speech tasks are skippable without breaking the feed (affective filter, §2).

---

## 9. Task-based learning

TBLT meta-analysis: long-term task-based programs show a strong overall effect **d = 0.93** across 52 studies ([Bryfonski & McKay 2019](https://journals.sagepub.com/doi/abs/10.1177/1362168817744389)) — with a legitimate methodological critique (loose inclusion, effect-size handling; [Xuan et al. 2025](https://journals.sagepub.com/doi/abs/10.1177/13621688221131127)), so treat the magnitude, not the direction, with caution. Core TBLT insight regardless: language sticks when used to *achieve a non-linguistic goal* with a concrete success criterion (order the food, find the platform, win the round).

**Design implications**
- Every Journey **unit boss** is a task, not a test: a scenario with a goal ("get the taxi to the hotel and negotiate the price") executed against the on-device LLM tutor in role-play mode, or a game round (corpan-city errand). Success = task outcome achieved + comprehensibility, not zero errors.
- Mini-games ARE tasks — this legitimizes lingo-hero/juice-squeeze/hover-runner pedagogically, provided their item sets are wired to the learner model (fluency strand: known items under time pressure).
- Task-first, teach-second option for stronger learners: attempt the task cold, then get the micro-lessons the attempt showed you need (task-based, not task-supported).

---

## 10. Time to fluency: FSI hours and language distance

FSI classroom-hour estimates to ILR-3 (~B2/C1) for L1-English learners ([FSI ranking](https://www.fsi-language-courses.org/blog/fsi-language-difficulty/); [Atlas & Boots table](https://www.atlasandboots.com/travel-blog/foreign-service-institute-language-difficulty/)):

| Category | Class hours | Examples |
|---|---|---|
| I | 600–750 | ES, FR, IT, PT, NL, DA, NO, SV, RO, Afrikaans |
| II | ~900 | DE, Indonesian/MS, Swahili, Haitian Creole |
| III | ~1,100 | RU, HI, EL, HE, PL, TR, VI, TH, FI, most others |
| IV (V in some schemes) | ~2,200 | ZH (Mandarin/Cantonese), JA, KO, AR |

CEFR guided-learning-hours (cumulative, English): A1 ≈ 90–100, A2 ≈ 180–200, B1 ≈ 350–400, B2 ≈ 500–600, C1 ≈ 700–800, C2 ≈ 1,000–1,200 ([Cambridge](https://support.cambridgeenglish.org/hc/en-gb/articles/202838506-Guided-learning-hours); [LanguageCert](https://www.languagecert.org/en/guided-learning-hours)). Note FSI hours are *intensive classroom* hours (plus roughly equal self-study); app-hours convert worse than classroom hours, but relative ratios hold.

The critical structural fact for Journey: difficulty is a property of the **L1→L2 pair**, not the L2. Mandarin is Cat-IV from English but far closer from Cantonese; Spanish is Cat-I from English and near-free from Portuguese. FSI's table only covers L1=English; for 54×54 pairs we must generalize (typology/lexical-distance metrics like ASJP/lang2vec, shared script, cognate density).

**Design implications**
- **Course length is parameterized by pair distance.** A distance multiplier `D(L1,L2) ∈ [~0.6, ~3.5]` (normalized to Cat-I=1.0) scales: number of units per CEFR band, encounter budgets (cognates need fewer encounters; unrelated forms need more), grammar-graph depth, and honest time-estimates shown to users ("B1 in Spanish ≈ 180 Journey hours; B1 in Mandarin ≈ 550").
- Cognate-aware sequencing: for close pairs, cognate vocabulary is fast-tracked (recognition-only introduction, minimal SRS load) — a PT→ES course should sprint through shared lexicon and spend its time on false friends and phonology.
- Never show a single universal "day 300 = fluent" promise. Honesty about pair distance is a differentiator and prevents churn from betrayed expectations.

---

## 11. L1 scaffolding, motivation, and engagement mechanics

- **L1 use is evidence-positive, not a sin**: L1 glosses/translation are efficient for vocabulary meaning, reduce anxiety, and scaffold comprehension, especially at low proficiency ([Sanako review](https://sanako.com/effective-l1-use-in-language-classrooms); [NYSED brief](https://www.nysed.gov/bilingual-ed/topic-brief-5-dispelling-myth-english-only-understanding-importance-first-language); [ScienceDirect, L1 as scaffolding in EFL reading](https://www.sciencedirect.com/science/article/pii/S1877042814015419)). Bilingual (L1↔L2) flashcards outperform L2-only definitions for beginners. The failure mode is *permanent* reliance, so scaffolding must taper.
- Engagement: Duolingo's memory-model scheduling itself improved engagement (+12% daily activity — good scheduling *feels* good; [ACL 2016](https://research.duolingo.com/papers/settles.acl16.pdf)). Krashen's affective filter and self-determination theory converge on: protect feelings of competence (success rate high), autonomy (choices within the feed), and progress visibility. Desirable-difficulty targets from retrieval-practice literature suggest keeping in-session success around 80–90% (FSRS desired-retention 0.90 aligns).

**Design implications** — see §12.4 for the numeric L1 taper.
- "Addictive" must be earned via *visible competence growth* (coverage %, task wins, fluency speed graphs), not only streak guilt. Streaks measure showing up; Journey should also surface *memory wealth* ("2,340 words stable in memory, +58 this week" — FSRS gives this for free).
- Sessions must always end on a success (schedule an easy fluency item last — peak-end rule).

---

## 12. Concrete design rules (opinionated, numeric)

### 12.1 Strand ratios by stage (rolling 2-week window)

| Stage (CEFR) | MF Input | MF Output | Language-focused | Fluency |
|---|---|---|---|---|
| 0 → A1 | 30% | 10% (imitative→short pushed) | **40%** | 20% |
| A2 | 30% | 20% | 30% | 20% |
| B1 | 30% | 25% | 20% | 25% |
| B2 | 30% | 25% | 15% | 30% |
| C1–C2 | 35% | 25% | 10% (collocation, register, rare grammar) | 30% |

Rationale: Nation's equal-25% is the steady-state; beginners need extra deliberate learning to bootstrap the first 1k families (nothing is comprehensible yet), and advanced learners need extra fluency/input because the remaining gains are automatization and rare-item coverage.

### 12.2 Session shape (default 8–15 min "feed run")

1. **Warm-up retrieval** (1–2 min): 6–12 due FSRS items, interleaved types.
2. **Core block** (4–8 min): 2–3 activities selected by the strand-deficit scheduler (whichever strand is furthest below its window target), coverage-gated, encounter-injected.
3. **Push** (1–3 min): one output or task item at the learner's edge (the one activity allowed to feel hard).
4. **Cool-down fluency win** (1–2 min): known-material game round or speed drill. Always ends green.

Review-to-new ratio inside deliberate learning: **~4:1 at steady state** (of ~30 item-touches in a session, ≤6 are brand-new introductions); first-week honeymoon may run 2:1; if the FSRS due-queue exceeds ~1.5× daily capacity, new-item introduction pauses automatically (debt brake). New-word introduction rate: ~8–12/day Cat-I pairs, ~5–8/day Cat-IV pairs (encounter budget is the binding constraint, not introduction).

### 12.3 Activity mix / modality by stage

- 0→A1: listening-primary (hear before see), imitative speech from day 1–3, generative micro-output from week 2. Perception HVPT from day 1. No free reading of un-gated text.
- A2: dialogs, first LLM role-play tasks with heavy scaffolds (suggested replies), script strand ramps for opaque scripts.
- B1+: extensive listening/reading of real pack content (books/podcasts) becomes the primary input; tasks lose scaffolds; writing appears.
- B2+: fluency pressure everywhere (timers, WPM targets), register/genre variety, rare-grammar units gated by the grammar graph.

### 12.4 L1 scaffolding taper

| Stage | L1 in instructions/UI | L1 glosses | Grammar explanations |
|---|---|---|---|
| 0–A1 | 100% | tap-anything, auto-shown for new items | in L1 |
| A2 | mixed (recycled instruction phrases go L2) | tap-to-reveal only | L1 with L2 examples |
| B1 | L2 default, L1 fallback tap | tap-to-reveal, monolingual-first option | L2-simple, L1 fallback |
| B2+ | L2 | L2 definitions first, L1 second tap | L2 |

Never remove the L1 escape hatch entirely (affective filter); just add friction as proficiency grows.

### 12.5 Feedback rules

- All errors get feedback; prompt-first loop (§4): locate → one self-repair attempt → explicit correct form → one successful reproduction.
- Pronunciation graded on comprehensibility (STT match), not nativeness; never hard-fail a speech item.
- Developmental-stage errors (grammar graph says "not ready") are *not* corrected prominently — recycled as input instead.

### 12.6 Adaptivity levers (what "auto-adjusts" means, precisely)

1. FSRS memory states per item → review timing (retention target 0.90).
2. Known-set coverage computation → which input content is eligible (95–98% band).
3. Grammar-graph readiness (≥80% production accuracy on prerequisites) → which structures unlock.
4. Strand-deficit accounting over 2-week window → which activity *type* is served next.
5. Rolling in-session success rate → difficulty trim (keep 80–90%; below 75% → inject easy fluency items; above 95% → advance new-item rate).
6. Pair-distance multiplier D(L1,L2) → course length, encounter budgets, cognate fast-track.

---

## 13. Mapping to existing Corpan experiences (retrofit contract)

The abstract activity contract needs, per activity instance: `items_exercised[] (with skill facet: form/meaning/use × recognition/recall × modality)`, `strand_served (computed)`, `est_minutes`, `difficulty/coverage requirement`, `emits: graded review events per item + error diagnostics`. Under that contract:

- **Readers (earthgate/stargate) + narration packs** → meaning-focused input (coverage-gated selection; tap-gloss events = implicit reviews).
- **lingo-hero / juice-squeeze / hover-runner / beatlounge** → fluency strand *iff* item sets drawn from learner's stable-known set; language-focused if used for new-item drilling.
- **pronunciation-coach (STT)** → language-focused (HVPT + shadowing home); needs minimal-pair perception mode added.
- **tutomaton (Qwen3)** → meaning-focused output + task engine (unit bosses, role-plays, prompt-first CF).
- **wordpan / hanzipan** → language-focused deliberate learning; hanzipan = the decoupled script strand (§8).
- **Phrase corpus (~25k × 54)** → the item bank + encounter-injection reservoir; needs per-language frequency-rank annotation to become the spine (§5).

Gap experiences worth building: HVPT minimal-pair drill; timed re-reading/re-listening (fluency); dictation (transcribe what you hear — strong all-round evidence, cheap to build on existing audio+text alignment).

---

## 14. THE JOURNEY PEDAGOGICAL CHARTER (non-negotiable principles)

1. **Balance is the algorithm's job.** Every learner's rolling 2-week history satisfies the four-strand ratios for their stage (§12.1). The feed enforces it; the user never has to plan.
2. **Frequency is the spine.** New vocabulary enters in corpus-frequency order (spoken-weighted first 3k); themed content samples from the current band. Milestones are stated as coverage percentages.
3. **One memory model to rule them all.** Every learnable item has an FSRS state at 0.90 desired retention; every activity emits graded review events into it. No activity is pedagogically "off the books."
4. **Input must be 95–98% comprehensible.** No un-gated content in the input strand. Glosses buy down to 90%. Volume of understood input is the largest minute-budget at every level.
5. **Hear it before you see it; use it before you're tested on it.** Listening-primary early sequencing; every new item gets ≥6 scheduled encounters (more for distant pairs) before it may become a leech.
6. **Output early, pushed, and safe.** Imitative speech from day 1, generative output from week 2; always skippable, never publicly scored, graded on comprehensibility.
7. **Prompt-first feedback.** Every error: locate → one self-repair chance → explicit correction → successful reproduction. Recasts alone are banned.
8. **Teach grammar explicitly, briefly, and only when ready.** ≤60-second rule cards gated by the processability graph; late-acquired features are recycled, never gates.
9. **Ears before mouth on sounds.** L1-pair-specific HVPT perception training from day 1; production targets comprehensibility, not nativeness.
10. **Fluency work uses zero new items.** A quarter-ish of all time is known-material under gentle time pressure; recycled content is a feature, not a compromise.
11. **Every unit ends in a task, not a test.** Success = goal achieved + comprehensible language, evaluated on-device.
12. **L1 is scaffolding, not sin.** Full L1 support at zero, tapered by stage per §12.4; the escape hatch never fully disappears.
13. **Course length scales with L1→L2 distance.** All budgets (units, encounters, time estimates) multiply by D(L1,L2); cognates fast-track; no universal fluency promises.
14. **The review debt brake.** When due-reviews exceed 1.5× daily capacity, new material pauses. Retention beats coverage-theater.
15. **Sessions end green.** Every session closes with a success the learner can feel; in-session success stays in the 80–90% band.
16. **Addiction through competence.** Progress surfaces are memory-wealth, coverage %, and task wins — streaks are seasoning, not the meal.
17. **Everything on-device.** All of the above — FSRS, coverage computation, STT grading, LLM tutoring, adaptivity — runs offline. No principle may be implemented in a way that requires a server.

---

## 15. Sources

- Nation, [The Four Strands (2007)](https://www.victoria.ac.nz/__data/assets/pdf_file/0019/1626121/2007-Four-strands.pdf); [TESL Ontario](http://contact.teslontario.org/applying-the-four-strands-framework-in-linc-classrooms/); [Hacking Chinese four-strands analysis](https://www.hackingchinese.com/analyse-and-balance-your-chinese-learning-with-paul-nations-four-strands/)
- Krashen, [Principles and Practice in SLA](https://www.sdkrashen.com/content/books/principles_and_practice.pdf); [Case for CI](https://www.sdkrashen.com/content/articles/case_for_comprehensible_input.pdf); [Frontiers 2025 neuro-ecological critique](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1636777/full); [Extensive reading meta-analysis, Educ Psych Review 2025](https://link.springer.com/article/10.1007/s10648-025-10068-6)
- FSRS: [open SRS benchmark](https://expertium.github.io/Benchmark.html); [Anki FAQ](https://faqs.ankiweb.net/what-spaced-repetition-algorithm); Kim & Webb, [Spaced Practice in L2, Language Learning 2022](https://onlinelibrary.wiley.com/doi/abs/10.1111/lang.12479); [Cepeda et al. distributed practice meta](http://www.lscp.net/persons/ramus/docs/EPR20.pdf); Duolingo [HLR, ACL 2016](https://research.duolingo.com/papers/settles.acl16.pdf)
- Output/CF: [Li 2010 CF meta-analysis](https://www.researchgate.net/publication/229940242_The_Effectiveness_of_Corrective_Feedback_in_SLA_A_Meta-Analysis); [integrated loop model, EJ1140434](https://files.eric.ed.gov/fulltext/EJ1140434.pdf); [pushed output study, EJ1127288](https://files.eric.ed.gov/fulltext/EJ1127288.pdf)
- Vocabulary coverage: [Nation & Waring 1997](https://www.lextutor.ca/research/nation_waring_97.html); [Nation 2006](https://www.researchgate.net/publication/239928724_How_Large_a_Vocabulary_Is_Needed_for_Reading_and_Listening); [Webb & Nation 2008](https://www.wgtn.ac.nz/lals/resources/paul-nations-resources/paul-nations-publications/publications/documents/2008-Webb-Evaluating-vocabulary-load.pdf); [van Zeeland & Schmitt replication](https://www.cambridge.org/core/journals/language-teaching/article/how-much-vocabulary-is-needed-to-use-english-replication-of-van-zeeland-schmitt-2012-nation-2006-and-cobb-2007/1D217A56A2E0056E67802A6A8360FDDE); [Webb 2008 incidental learning](https://www2.hawaii.edu/~readfl/rfl/October2008/webb/webb.pdf); [Uchihara et al. repetition meta](https://www.researchgate.net/publication/330774796_The_Effects_of_Repetition_on_Incidental_Vocabulary_Learning_A_Meta-Analysis_of_Correlational_Studies); [word-cards synthesis, Frontiers 2022](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2022.984211/full)
- Grammar: [Norris & Ortega 2000](https://onlinelibrary.wiley.com/doi/abs/10.1111/0023-8333.00136); [Goo et al. 2015 update](https://benjamins.com/catalog/sibil.48.18goo); [Spada & Tomita 2010](https://onlinelibrary.wiley.com/doi/10.1111/j.1467-9922.2010.00562.x); [Teachability Hypothesis](https://en.wikipedia.org/wiki/Teachability_Hypothesis); [Pienemann 2015](https://onlinelibrary.wiley.com/doi/10.1111/lang.12095); [Conti on PT sequencing](https://gianfrancoconti.com/2025/02/12/in-which-order-should-we-teach-grammar-structures-manfred-pienemanns-answer/)
- Pronunciation: [HVPT meta-analysis, SSLA](https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/high-variability-phonetic-training-hvpt-a-metaanalysis-of-l2-perceptual-training-studies/6ABB8C1F32D88D53EA8D05A4565E76F6); [Thomson 2018 HVPT](https://benjamins.com/catalog/jslp.17038.tho); [shadowing systematic review 2025](https://www.tandfonline.com/doi/full/10.1080/29984475.2025.2546827); [Oxford shadowing review](https://ora.ox.ac.uk/objects/uuid:3104cae1-3a6b-400a-b173-de44384238d2/files/r1z40kv86w)
- Listening-first: [Priority of Listening Comprehension, EJ1066407](https://files.eric.ed.gov/fulltext/EJ1066407.pdf)
- TBLT: [Bryfonski & McKay 2019](https://journals.sagepub.com/doi/abs/10.1177/1362168817744389); [Xuan et al. 2025 critique](https://journals.sagepub.com/doi/abs/10.1177/13621688221131127)
- Hours: [FSI difficulty ranking](https://www.fsi-language-courses.org/blog/fsi-language-difficulty/); [Atlas & Boots FSI table](https://www.atlasandboots.com/travel-blog/foreign-service-institute-language-difficulty/); [Cambridge GLH](https://support.cambridgeenglish.org/hc/en-gb/articles/202838506-Guided-learning-hours); [LanguageCert GLH](https://www.languagecert.org/en/guided-learning-hours)
- L1 scaffolding: [Sanako review](https://sanako.com/effective-l1-use-in-language-classrooms); [NYSED topic brief](https://www.nysed.gov/bilingual-ed/topic-brief-5-dispelling-myth-english-only-understanding-importance-first-language); [L1 scaffolding in EFL reading, ScienceDirect](https://www.sciencedirect.com/science/article/pii/S1877042814015419)

## 16. Gaps and open questions (honest)

1. **Frequency lists for 54 target languages** don't yet exist in-repo; the phrase corpus needs per-language lemma frequency-rank annotation (OpenSubtitles/wordfreq-style lists are viable offline inputs; quality varies by language).
2. **D(L1,L2) matrix**: FSI covers only L1=English. A defensible 54×54 distance function (lang2vec/ASJP + script + cognate density) must be built and calibrated; initial version can be coarse (5 buckets mirrored/adjusted from FSI).
3. **Processability grammar graphs exist in the literature for few languages** (EN, DE, JA, ES, AR partially). For the rest we must approximate from pedagogical grammars (CEFR reference-level descriptions) — document as heuristic, not evidence.
4. **FSRS grading from implicit events** (game hits, tap-glosses, STT matches) has no published calibration; grade-mapping (event→Again/Hard/Good/Easy) will need in-app tuning. Treat as a data pipeline (log everything from day 1).
5. **Word families vs lemmas**: coverage research uses English word families; for morphologically rich languages (TR, FI, RU) lemma/flemma-based counting is required and thresholds shift — the 95/98% principle holds, the k-counts don't transfer literally.
6. App-hours→FSI-classroom-hours conversion factor is unknown; time estimates should be presented as ranges and re-fit from real learner telemetry (on-device, privacy-safe aggregates).
7. Effect sizes cited (esp. TBLT d=0.93) come from classroom research; transfer to app microlearning is plausible but unproven — another reason to instrument outcomes, not vibes.
