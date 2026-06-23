"""Lessons for English. Reference-grade, ~300-500 words each."""

LESSONS = []


def L(topic, title, level, body, related=None, l1_notes=None):
    LESSONS.append({
        "topic": topic, "title": title, "level": level,
        "body": body.strip(), "related": related or [], "l1_notes": l1_notes or {},
    })


# ============================================================
# ARTICLES + NOUNS
# ============================================================

L("articles_a_an_the", "Articles: a, an, the, and zero", "A1", """
English has three article choices: **a/an**, **the**, and **no article (zero)**. Choosing among them is the single biggest grammar problem for ESL learners.

## a / an — indefinite, singular, countable

Use **a** before consonant *sounds*, **an** before vowel *sounds* (not letters):
- *a cat*, *a university* (yu-niversity — y sound)
- *an apple*, *an hour* (silent h)

Use *a/an* when introducing a thing for the first time, or when any one of a kind would do:
- *I saw **a** dog in the park.* (some dog, unspecified)
- *She's **an** engineer.* (one of many)

## the — definite, any number, any countability

Use **the** when both speaker and listener know which one:
- *Close **the** door.* (the one we both see)
- *I saw a dog. **The** dog was huge.* (the same dog as before)
- *the sun, the moon, the President* (unique things)

Also for superlatives, ordinals, and "best of its kind":
- *the best, the first, the only one*

## zero (no article) — generic + uncountable + plural-generic

No article for:
- Uncountable nouns in general statements: *Water is wet. Music helps me focus.*
- Plural countables in general statements: *Cats are independent. Books are expensive.*
- Most proper nouns: *I love Paris.* (but: *the Netherlands, the United States*)
- Meals, transport, sports played: *for breakfast, by car, play soccer*

## Common mistakes

- *I am student* ❌ → *I am **a** student* ✅
- *The life is hard* ❌ → *Life is hard* ✅ (general truth)
- *I love the music* ❌ → *I love music* ✅ (music in general)
- *The Mary called* ❌ → *Mary called* ✅ (proper noun, no article)
""", related=["countable_uncountable", "plurals"], l1_notes={
    "es": "En español los artículos van casi siempre (*El agua es buena*, *La vida es difícil*). En inglés, los nombres genéricos no llevan artículo: *Water is good*, *Life is hard*. Quitar el artículo es contraintuitivo pero correcto.",
    "zh": "中文没有冠词,所以英语的 a/an/the 系统对中文母语者来说完全是新概念。规则:第一次提到用 a/an,再提到用 the,泛指(整类)不加冠词。",
    "ja": "日本語には冠詞がないため、英語の a/an/the の使い分けは特に難しいです。初出は a/an、既出は the、一般論は無冠詞、と覚えてください。",
})

L("countable_uncountable", "Countable vs uncountable nouns", "A2", """
Countable nouns have singular and plural forms; uncountable nouns don't. The distinction controls which words can go with them.

## Countable

You can count them: *one book, two books, three books*.
- Take *a/an* in singular: *a book, an idea*
- Form plurals: *books, ideas, children*
- Use *many* / *few* / *several*: *many books, few ideas*

## Uncountable

Treated as a mass, not individual items:
- No plural: *water* (not *waters* in most contexts)
- No *a/an*: *water*, not *a water*
- Use *much* / *little* / *some*: *much water, little hope*

Common uncountables: water, milk, sugar, rice, music, advice, information, news, furniture, luggage, equipment, work, weather, traffic, money.

## Quantifiers

| Quantifier | Countable | Uncountable |
|---|---|---|
| many / few / several | ✓ | — |
| much / little | — | ✓ |
| some / any / a lot of / no | ✓ | ✓ |
| fewer | ✓ | — |
| less | — | ✓ |

- *fewer books* (countable), *less water* (uncountable)
- *much money* (formal), *a lot of money* (everyday)

## Container trick

To count an uncountable, use a container:
- *a glass of water, two cups of coffee, a piece of advice, a slice of bread*

## Common mistakes

- *I need an advice* ❌ → *I need **some** advice* / *a **piece of** advice* ✅
- *Many luggages* ❌ → *A lot of luggage* / *Many bags* ✅
- *I have less books* ❌ → *I have **fewer** books* ✅
""", related=["articles_a_an_the", "plurals"])

L("plurals", "Plurals: regular and irregular", "A1", """
Most English plurals add **-s** or **-es**, but a few common nouns are irregular.

## Regular plurals

- Most: add **-s**: *cat → cats, idea → ideas*
- After s/sh/ch/x/z: **-es**: *bus → buses, box → boxes, watch → watches*
- Consonant + y → **-ies**: *baby → babies, story → stories*
- Vowel + y → just **-s**: *boy → boys, day → days*
- Ending in -f / -fe → **-ves**: *leaf → leaves, knife → knives, life → lives*

## Irregular plurals (memorize)

- *child → children*, *man → men*, *woman → women*
- *foot → feet*, *tooth → teeth*, *mouse → mice*, *goose → geese*
- *person → people* (the regular *persons* exists in legal English only)

## Same singular and plural

- *sheep, fish, deer, aircraft, species, series* — same for one or many

## Latin/Greek origins

- *crisis → crises, analysis → analyses, basis → bases*
- *phenomenon → phenomena, criterion → criteria*
- *datum → data* (often used as uncountable now)

## Common mistakes

- *Childs* ❌ → *children* ✅
- *Two foots* ❌ → *two feet* ✅
- *Three fishes* ❌ → *three fish* ✅
""", related=["countable_uncountable"])

# ============================================================
# VERB TENSES
# ============================================================

L("tense_overview", "English tenses: an overview", "A2", """
English has 12 tense forms, built from combinations of **time** (past, present, future) and **aspect** (simple, continuous, perfect, perfect continuous).

| | Simple | Continuous | Perfect | Perfect Continuous |
|---|---|---|---|---|
| Present | I work | I am working | I have worked | I have been working |
| Past | I worked | I was working | I had worked | I had been working |
| Future | I will work | I will be working | I will have worked | I will have been working |

The top 6 are essential:
- **present simple** — habits, facts, schedules
- **present continuous** — right now, around now
- **present perfect** — past actions with present relevance
- **past simple** — finished past actions
- **past continuous** — actions in progress in the past
- **going to / will** — future plans and predictions

The other 6 are useful for nuance in formal writing and careful storytelling.

## The big idea — "aspect"

English doesn't just mark *when* (time) — it marks *how* the action relates to the moment of reference (aspect):

- **simple**: the action as a whole event (*I work*)
- **continuous**: the action in progress at that moment (*I am working*)
- **perfect**: the action completed before that moment, with consequences still felt (*I have worked*)
- **perfect continuous**: the action ongoing up to that moment (*I have been working*)

This is why *I work in Berlin* and *I am working in Berlin* differ — the first is your normal life, the second is a current temporary arrangement.

## Common mistakes

- *I am living here since 2020* ❌ → *I **have** lived here since 2020* ✅
- *I'm coming from Spain* (origin) ❌ → *I come from Spain* ✅
- *Yesterday I have eaten* ❌ → *Yesterday I **ate*** ✅
""", related=["present_simple", "present_continuous", "present_perfect", "past_simple"])

L("present_simple", "The present simple", "A1", """
**Use it for**: habits, facts, schedules, timeless truths.

## Form

- *I/you/we/they* + base verb: *I work, you eat, they live*
- *He/she/it* + verb + **-s**: *he works, she eats, it lives*
- Negative: *do/does + not + base*: *I don't work, she doesn't eat*
- Question: *Do/does + subject + base?*: *Do you work? Does she eat meat?*

## When to use

**1. Habits and routines** (every day, often, never):
- *I drink coffee every morning.*
- *She **never** eats meat.*

**2. Facts and general truths**:
- *Water **boils** at 100 degrees.*
- *The sun **rises** in the east.*

**3. Scheduled events**:
- *The train **leaves** at 7 AM.*
- *The movie **starts** at 8.*

**4. Stative verbs** (*know, love, want, need, believe, own, seem*) — almost always simple, not continuous:
- *I **know** her.* (not *I am knowing her*)
- *She **wants** coffee.*

## The -s in third person

The famous "third person s" — only tense where the verb changes for he/she/it:
- *I work / you work / **he works** / we work / they work*

Spelling: add -s normally; -es after s/sh/ch/x/z; consonant+y → -ies (*try → tries*); *have → has*, *do → does*, *go → goes*.

## Common mistakes

- *He work in Berlin* ❌ → *He **works*** ✅
- *I am liking this song* ❌ → *I **like** this song* ✅ (stative)
- *She no eats meat* ❌ → *She **doesn't** eat meat* ✅
""", related=["present_continuous", "tense_overview", "questions_do_support"], l1_notes={
    "es": "Spanish-L1 speakers often drop the third-person *-s* because Spanish marks person on the verb. Don't forget *he works*, NOT *he work*. Also: don't use present simple for right-now actions — use present continuous (*estoy trabajando* → *I am working*, not *I work*).",
    "zh": "中文动词不变形,所以英语的第三人称单数 -s 是新规则。每次说 he/she/it 都要记得加 -s:*He likes music*。",
})

L("present_continuous", "The present continuous", "A1", """
**Use it for**: actions right now, temporary situations, definite future plans.

## Form

**am/is/are + verb-ing**:
- *I am working / you are working / he is working*

Contractions: *I'm working, she's working, they're working*.

## When to use

**1. Right now**:
- *I **am writing** an email.*
- *Look! It **is raining**.*

**2. Around now (this week, temporarily)**:
- *I **am reading** a great book.* (this period; not necessarily this second)

**3. Definite future plans** (with another person, arranged):
- *I **am meeting** Sarah tomorrow.*

**4. Changing situations**:
- *Prices **are rising**.*

## -ing spelling rules

- Most: add -ing: *eat → eating*
- -e ending: drop the e: *make → making*
- One-syllable C-V-C: double: *run → running, sit → sitting*
- -ie ending: change to -ying: *die → dying, lie → lying*

## Stative verbs — usually NOT continuous

*Know, love, like, want, need, believe, own, understand, seem, prefer, hate*:
- *I **know** the answer.* (not *am knowing*)
- *She **wants** coffee.* (not *is wanting*)

## Common mistakes

- *I work right now* ❌ → *I **am working** right now* ✅
- *She is wanting coffee* ❌ → *She **wants** coffee* ✅
- *They is working* ❌ → *They **are** working* ✅
""", related=["present_simple", "tense_overview"])

L("present_perfect", "The present perfect", "A2", """
**Use it for**: past actions that have a connection to *now*. This is the tense most ESL learners get wrong.

## Form

**have/has + past participle (V3)**:
- *I have worked / she has seen*
- Contractions: *I've worked, she's seen, they've gone*
- Negative: *haven't / hasn't*
- Question: *Have you...? Has she...?*

## When to use

**1. Past action, present result**:
- *I've **lost** my keys.* (don't have them now)
- *She's **broken** her leg.* (still in a cast)

**2. Experience, at any point in life** (often with *ever / never*):
- *Have you **ever** been to Japan?*
- *I've **never** eaten sushi.*

**3. Unfinished period, up to now** (with *for / since*):
- *I've **lived** here for 10 years.* (still do)
- *She's **worked** at Google since 2020.*

**4. Just / already / yet**:
- *I've **just** finished.*
- *Have you finished **yet**?*

## Present perfect vs past simple

**Past simple** for specific past time (yesterday, last year, in 2010):
- *I **saw** her **yesterday**.*

**Present perfect** for unspecified time or period reaching now:
- *I've **seen** that movie.* (when isn't the point)
- *He **has lived** in Berlin **for years**.* (still does)

## Common mistakes

- *I have seen her yesterday* ❌ → *I **saw** her yesterday* ✅
- *I am living here since 2020* ❌ → *I **have lived** here since 2020* ✅
- *I have ate* ❌ → *I have **eaten*** ✅ (irregular past participle)
""", related=["past_simple", "tense_overview"], l1_notes={
    "es": "El present perfect inglés NO es el equivalente directo del pretérito perfecto compuesto español. *He visto a María hoy* = *I've seen María today* (ok), pero *La vi ayer* es *I saw her yesterday*, NO *I have seen her yesterday*. Regla: si dices CUÁNDO (ayer, en 2020, anoche), usa past simple.",
    "zh": "中文用 *了* 表示完成,但 *了* 不区分 past simple 和 present perfect。英语区分:*I ate yesterday* (具体时间 = past simple) vs *I have eaten* (未指定时间 = present perfect)。",
})

L("present_perfect_continuous", "The present perfect continuous", "B1", """
**Use it for**: actions that started in the past and continue now, emphasizing duration.

## Form

**have/has + been + verb-ing**:
- *I have been working / she has been studying*

## When to use

**1. Action continuing up to now** (with *for / since*):
- *I've been **studying** English for 5 years.*
- *She's been **working** here since March.*

**2. Recent activity with visible result**:
- *Your eyes are red — have you been **crying**?*
- *He's tired because he's been **running**.*

**3. Repeated action up to now**:
- *I've been **calling** you all morning.*

## Continuous vs simple (present perfect)

**Continuous** = emphasis on duration / ongoing nature:
- *I've been **reading** this book for two weeks.* (still reading)

**Simple** = emphasis on completion / quantity:
- *I've **read** three books this month.* (completed count)
- *I've **read** the book.* (finished)

## Stative verbs

Don't use continuous with stative verbs:
- *I've **known** her for years.* ✅
- *I have been knowing her since 2020* ❌

## Common mistakes

- *I am studying English for 5 years* ❌ → *I **have been studying** English for 5 years* ✅
- *I have been knowing her* ❌ → *I **have known** her* ✅
""", related=["present_perfect", "present_continuous"])

L("past_simple", "The past simple", "A1", """
**Use it for**: completed actions in the past with a known or implied time.

## Form

- **Regular verbs**: add **-ed**: *worked, played, watched*
- **Irregular verbs**: memorize: *go → went, see → saw, eat → ate*
- Same for all subjects: *I worked, you worked, he worked*
- Negative: *didn't + base*: *I didn't work*
- Question: *Did + subject + base?*: *Did you work?*

## When to use

**1. Specific finished past action**:
- *I **went** to Paris last summer.*

**2. Past habits** (also: *used to*):
- *When I was young, I **played** football every day.*

**3. Past states**:
- *I **was** tired.*

## -ed spelling rules

- Most: add -ed: *worked, played*
- -e ending: just -d: *liked, danced*
- One-syllable C-V-C: double: *stopped, planned*
- Consonant + y → -ied: *cried, tried*

## Top irregular past forms

| Base | Past | Base | Past |
|---|---|---|---|
| be | was/were | go | went |
| have | had | see | saw |
| do | did | eat | ate |
| say | said | give | gave |
| make | made | take | took |
| come | came | get | got |
| know | knew | think | thought |
| find | found | tell | told |
| feel | felt | leave | left |

## Common mistakes

- *I **goed** to school* ❌ → *I **went*** ✅
- *Yesterday I have seen him* ❌ → *Yesterday I **saw** him* ✅
- *I didn't went* ❌ → *I **didn't go*** ✅ (after didn't, use base)
- *Did you saw it?* ❌ → *Did you **see** it?* ✅
""", related=["present_perfect", "irregular_verbs"])

L("past_continuous", "The past continuous", "A2", """
**Use it for**: actions in progress at a past moment, often interrupted.

## Form

**was/were + verb-ing**:
- *I/he/she/it was working*
- *you/we/they were working*

## When to use

**1. Action in progress at a past moment**:
- *At 8 PM yesterday, I **was watching** TV.*

**2. Background interrupted by another action**:
- *I **was reading** when the phone rang.*
- *While I **was driving**, I saw an accident.*

**3. Two parallel ongoing actions**:
- *I **was working** while she **was sleeping**.*

**4. Setting a scene**:
- *The sun **was shining**, the birds **were singing**, when suddenly...*

## Past simple vs past continuous

- Past simple = complete action: *I read the book.*
- Past continuous = mid-process: *I was reading the book.*

Classic pair (continuous interrupted by simple):
- *I **was walking** home **when** it **started** to rain.*

## Stative verbs — same rule

State verbs usually stay simple:
- *I **knew** her then.* (not *was knowing*)

## Common mistakes

- *Yesterday at 8 I worked* — ambiguous. *I **was working*** is clearer.
- *While I was walking, I have seen him* ❌ → *...I **saw** him* ✅
""", related=["past_simple", "tense_overview"])

L("past_perfect", "The past perfect", "B1", """
**Use it for**: a past action that happened *before* another past action.

## Form

**had + past participle (V3)**: same for all subjects.
- *I had worked, she had seen*
- Contractions: *I'd worked, she'd seen*
- Negative: *I hadn't seen*
- Question: *Had you finished?*

## When to use

**1. Earlier past, before another past**:
- *When I **arrived**, she **had already left**.*
- *By the time we got there, the movie **had started**.*

**2. Reported speech (backshift)**:
- *I have seen it.* → *He said he **had seen** it.*
- *I went home.* → *She said she **had gone** home.*

**3. Third conditional (hypothetical past)**:
- *If I **had known**, I would have helped.*

## Past simple vs past perfect

If two actions happen in order and you tell them in order, past simple works for both:
- *I **finished** dinner and then **went** for a walk.*

Use past perfect only when:
- Telling out of order: *Before I went for a walk, I **had finished** dinner.*
- The earlier-ness is the point: *When I arrived, everyone **had gone** home.*

## Common mistakes

- *Yesterday I **had eaten** at 8* ❌ → *Yesterday I **ate*** ✅
- *If I would have known* ❌ → *If I **had known*** ✅
""", related=["past_simple", "reported_speech", "conditionals_second_third"])

L("future_will_going_to", "Future: will vs going to", "A2", """
English has several ways to talk about the future. **Will** and **going to** dominate everyday speech.

## Form

**will + base verb**: *I will go, she will come*. Contractions: *I'll, she'll*. Negative: *won't*.

**be going to + base verb**: *I am going to go, she is going to come*. Informal speech: *gonna* (don't write).

## When to use *going to*

**1. Pre-decided plans**:
- *I'**m going to** quit my job next month.*
- *We **'re going to** visit Greece in July.*

**2. Predictions based on visible evidence**:
- *Look at those clouds — it'**s going to** rain.*

## When to use *will*

**1. Predictions / opinions about the future**:
- *I think it **will** rain tomorrow.*
- *He **'ll** love this book.*

**2. Spontaneous decisions**:
- *(phone rings)* — *I'**ll** get it.*
- *(restaurant)* — *I **'ll** have the soup.*

**3. Promises, offers, threats**:
- *I'**ll** help you.*
- *I **won't** tell anyone.*

## Side-by-side

| Situation | Use |
|---|---|
| Pre-decided plan | *going to* |
| Decision right now | *will* |
| Prediction with evidence | *going to* |
| General prediction | *will* or *going to* |
| Promise / offer | *will* |

## Present continuous for future

Arranged plans (often with another person) use present continuous:
- *I **'m meeting** Sarah at 7.* (we agreed)
- *They **'re flying** to Rome on Tuesday.* (booked)

## Common mistakes

- *I will to go* ❌ → *I will go* ✅
- *I will going to* ❌ → *I'm going to* ✅
- *He wills come* ❌ → *He will come* ✅ (no -s on modals)
""", related=["future_continuous", "tense_overview"])

L("future_continuous", "The future continuous", "B1", """
**Use it for**: actions in progress at a future moment.

## Form

**will be + verb-ing**: *I will be working*. Contractions: *I'll be working*.

## When to use

**1. Action in progress at a future moment**:
- *At 8 PM tomorrow, I **'ll be watching** the game.*
- *This time next week, we **'ll be flying** to Tokyo.*

**2. Polite questions about plans**:
- *Will you **be using** the car tonight?* (politer than *Will you use*)

**3. Predicting expected events**:
- *Don't call at 9 — I **'ll be having** dinner.*

## Future continuous vs simple future vs going to

- *Tomorrow at 8, I'**ll be watching** the game.* — focus on being mid-action
- *Tomorrow I'**m going to watch** the game.* — focus on the plan
- *Tomorrow I'**ll watch** the game.* — neutral future fact

## Common mistakes

- *I will working at 8* ❌ → *I **will be** working at 8* ✅
""", related=["future_will_going_to", "present_continuous"])

L("future_perfect", "The future perfect", "B2", """
**Use it for**: actions completed *before* a specific future point.

## Form

**will have + past participle (V3)**: *I will have finished*. Contractions: *I'll have finished*.

## When to use

**1. Completed before a future moment** (with *by + time*):
- *By next year, I **will have finished** my degree.*
- *By the time you arrive, I **will have cooked** dinner.*

**2. Looking back from a future point**:
- *In ten years, I **'ll have lived** here for 20 years.*

The keyword *by* almost always signals future perfect.

## Future perfect continuous

Ongoing actions up to a future point:
- *By December, I **'ll have been working** here for 10 years.*

## Common mistakes

- *By next year, I will finish* ❌ → *By next year, I **will have finished*** ✅
""", related=["future_will_going_to", "present_perfect"])

# ============================================================
# MODALS
# ============================================================

L("modals_ability", "Modals of ability: can, could, be able to", "A1", """
*Can* and *could* express ability; *be able to* fills the gaps where modals don't fit.

## can — present ability

- *I **can** swim.*
- *She **can** speak three languages.*

Negative: *can't* / *cannot*. Question: *Can you...?*

## could — past ability OR present possibility

**Past general ability**:
- *When I was 5, I **could** ride a bike.*

**Present possibility / suggestion**:
- *You **could** try calling her.*
- *That **could** be true.*

## be able to — fills modal gaps

For tenses where modals don't work:
- Future: *I **will be able to** drive next week.* (not *will can*)
- Present perfect: *I**'ve been able to** finish.* (not *have can*)
- Infinitive: *I want **to be able to** speak French.*

For one-time past achievements, use *was/were able to*:
- *He **was able to** escape.* ✅ (specific event)
- *He could escape.* ❌ (ambiguous)

## Common mistakes

- *I can to swim* ❌ → *I **can** swim* ✅ (no *to* after modal)
- *She cans dance* ❌ → *She **can** dance* ✅ (no -s on modals)
- *I will can come* ❌ → *I **will be able to** come* ✅
""", related=["modals_deontic", "modals_epistemic"])

L("modals_deontic", "Modals of obligation: must, should, have to, ought to", "A2", """
*Deontic* modals express obligation, advice, prohibition, recommendation.

## must — strong obligation (often internal)

- *I **must** finish this today.* (self-imposed)
- *You **must** wear a helmet.* (rule)

In speech, *have to* is more common. *Must* feels formal or urgent.

## have to — strong obligation (often external)

- *I **have to** work tomorrow.*
- *You **have to** show your passport.*

Changes for person and tense: *had to, will have to, has to*. *Must* doesn't change.

## should / ought to — advice

- *You **should** see a doctor.*
- *You **ought to** try this.* (slightly more formal)

## mustn't vs don't have to — DIFFERENT meanings

- *You **mustn't** smoke here.* = prohibited
- *You **don't have to** smoke here.* = not required (optional)

Frequent source of confusion.

## Past forms

- *had to* (no *musted*): *I **had to** work yesterday.*
- *should have + V3* (regret): *You **should have called** me.*
- *must have + V3* (deduction, not obligation): *He **must have been** tired.*

## Common mistakes

- *I must to go* ❌ → *I **must** go* ✅
- *Yesterday I must work* ❌ → *Yesterday I **had to** work* ✅
- *You mustn't to smoke* ❌ → *You **mustn't** smoke* ✅
""", related=["modals_epistemic", "modals_ability"], l1_notes={
    "es": "Cuidado: *must* en presente, pero NO en pasado. *Ayer tuve que trabajar* es *Yesterday I **had to** work*, no *Yesterday I must work*.",
})

L("modals_epistemic", "Modals of deduction: must, might, could, can't", "B1", """
*Epistemic* modals express how certain you are. Not obligation — *probability*.

## Present scale of certainty

| Modal | Meaning |
|---|---|
| **must** | I'm sure (positive): *He **must** be tired.* |
| **may / might / could** | maybe: *She **might** be at home.* |
| **can't** | I'm sure (negative): *That **can't** be true.* |

Notice: negative certainty uses **can't**, NOT *mustn't* (which means "forbidden").

## Past scale (modal + have + V3)

| Modal | Meaning |
|---|---|
| **must have V3** | sure it happened: *He **must have left** already.* |
| **might/could have V3** | maybe it happened: *She **might have forgotten**.* |
| **can't have V3** | sure it didn't: *He **can't have seen** us — he was asleep.* |

## must (obligation vs deduction)

Same form, two meanings:
- *He **must** work hard.* = obligation OR deduction
- Context tells you which.

## Common mistakes

- *He mustn't be Italian* (deduction) ❌ → *He **can't** be Italian* ✅
- *She must to be tired* ❌ → *She **must** be tired* ✅
- *He could fell* ❌ → *He **could have fallen*** ✅
""", related=["modals_deontic"], l1_notes={
    "es": "Cuidado: en español *no debe ser cierto*, pero en inglés la deducción negativa NO usa *mustn't*. Usa *can't*: *That can't be true*. *Mustn't* significa *está prohibido*.",
})

# ============================================================
# CONDITIONALS
# ============================================================

L("conditionals_zero_first", "Conditionals: zero and first", "A2", """
Conditionals express *if-then* relationships. There are four main types; the first two are everyday.

## Zero conditional — general truths

**if + present, present**

- *If you **heat** water to 100°C, it **boils**.*
- *Plants **die** if they **don't get** water.*

*If* and *when* are interchangeable here.

## First conditional — real future possibilities

**if + present, will + base**

- *If it **rains** tomorrow, we **'ll stay** home.*
- *I'**ll** call you if I **'m** late.*
- *She **won't** pass if she **doesn't** study.*

Critical: the *if-clause* uses PRESENT, even though it refers to future. The result clause uses *will*.

## Alternative modals in the result

- *If it rains, we **can** stay home.* (possibility)
- *If you finish early, you **could** help me.* (request)
- *If you see her, **tell** her hi.* (imperative)
- *If she asks, you **should** tell the truth.* (advice)

## Punctuation

When *if* comes first, use a comma:
- *If it rains, we'll stay home.*
- *We'll stay home if it rains.*

## Common mistakes

- *If it will rain, we will stay home* ❌ → *If it **rains**, we will stay home* ✅
- *If I would have time, I would help* ❌ → *If I **have** time, I'll help* ✅
""", related=["conditionals_second_third"], l1_notes={
    "es": "En español se usa el futuro en la cláusula *si* (*Si tendrás tiempo, ven*). En inglés NO — siempre presente: *If you **have** time, come*.",
})

L("conditionals_second_third", "Conditionals: second and third", "B1", """
**Second conditional** for unreal present/future; **third** for unreal past.

## Second conditional — unreal present / future

**if + past simple, would + base**

Hypothetical or untrue:
- *If I **had** more money, I **would buy** a house.* (I don't have it)
- *If she **were** here, she **would help** us.* (she isn't)
- *What **would** you do if you **won** the lottery?*

Formal English uses *were* for all subjects with *be*: *if I were you*. Casual speech also allows *was*.

## Third conditional — unreal past

**if + past perfect, would have + V3**

About the past — what would have happened if:
- *If I **had known**, I **would have helped**.* (I didn't know)
- *She **would have passed** if she **had studied**.*

## Mixed conditionals

Past condition with present result, or vice versa:
- *If I **had studied** law (past), I **would be** a lawyer now (present).*

## Would / could / might in the result

Swap *would* for *could* (possibility) or *might* (less certain):
- *If I won, I **could** travel the world.*
- *If she had called, we **might** have come.*

## Common mistakes

- *If I would have time* ❌ → *If I **had** time* ✅ (second conditional uses past simple)
- *If I would have known* ❌ → *If I **had known*** ✅ (third uses past perfect)
- *I would helped if I knew* ❌ → *I would **have** helped if I **had** known* ✅
""", related=["conditionals_zero_first"], l1_notes={
    "es": "Cuidado: la cláusula *if* del tercer condicional NO lleva *would*. *Si hubiera sabido* = *If I **had known***, no *If I would have known*.",
    "zh": "中文里假设句没有时态变化(*要是我有钱*),但英语的 second conditional 必须用过去式表示与现在事实相反:*If I **had** money*。",
})

# ============================================================
# PASSIVE + REPORTED SPEECH + RELATIVES
# ============================================================

L("passive_voice", "The passive voice", "B1", """
The passive flips who's doing what — the action's *target* becomes the grammatical *subject*.

## Form

**be (in the right tense) + past participle (V3)**

| Tense | Active | Passive |
|---|---|---|
| Present simple | Sam writes the report. | The report **is written**. |
| Present continuous | Sam is writing it. | It **is being written**. |
| Present perfect | Sam has written it. | It **has been written**. |
| Past simple | Sam wrote it. | It **was written**. |
| Past perfect | Sam had written it. | It **had been written**. |
| Future | Sam will write it. | It **will be written**. |
| Modal | Sam should write it. | It **should be written**. |

## When to use the passive

**1. Doer unknown or unimportant**: *My car **was stolen**.*
**2. Doer obvious**: *He **was arrested** last night.* (by the police)
**3. Result matters more than actor**: *The bridge **was built** in 1898.*
**4. Avoid blaming**: *A mistake **has been made**.*

## by + agent — only when relevant

- *The thief was caught.* (by police — obvious, leave it out)
- *The book was written **by Tolstoy**.* (the agent matters)

## Verbs that can't be passive

Intransitive verbs (no object): *go, come, sleep, die, fall, arrive*. You can't *was gone* / *was slept*.

## Common mistakes

- *The report **is wrote*** ❌ → *The report **is written*** ✅
- *It **was happened*** ❌ → *It **happened*** ✅ (intransitive)
- *The book **was wrote** by him* ❌ → *The book **was written** by him* ✅
""", related=["past_simple"])

L("reported_speech", "Reported speech", "B1", """
Reported speech describes what someone said without quoting them directly.

## Direct vs reported

- Direct: *She said, "I am tired."*
- Reported: *She said (that) **she was** tired.*

When the reporting verb is past, the reported verb usually shifts one step back — **backshift**.

## Backshift

| Direct | Reported |
|---|---|
| present simple → | past simple |
| present continuous → | past continuous |
| present perfect → | past perfect |
| past simple → | past perfect |
| will → | would |
| can → | could |
| must (obligation) → | had to |
| may → | might |

## Pronoun + time + place shifts

- Pronouns: *I → he/she*, *my → his/her*
- Time: *now → then, today → that day, tomorrow → the next day*
- Place: *here → there, this → that*

Example:
- Direct: *"I'm leaving tomorrow,"* she said.
- Reported: *She said she **was leaving the next day**.*

## say vs tell

- *say*: no direct person object: *She said hello. She said to me.*
- *tell*: needs a person object: *She told me.*

## Questions in reported speech

Yes/no → *if* or *whether*:
- *"Do you like it?"* → *He asked **if** I liked it.*

Wh-questions → keep wh-word, statement order:
- *"Where do you live?"* → *He asked **where I lived**.* (NOT *where do I live*)

## No backshift when

- Fact still true: *He said he **lives** in Berlin.* (still does)
- Reporting verb is present: *She says she **is** tired.*

## Common mistakes

- *She said me* ❌ → *She **told** me* ✅
- *He asked where do I live* ❌ → *He asked where I **lived*** ✅
""", related=["past_simple", "questions_do_support"])

L("relative_clauses", "Relative clauses: who, which, that, whose", "B1", """
**Relative clauses** add information about a noun, using **who, which, that, whose, where, when**.

## Choosing the right word

- **who** — for people: *The woman **who** called...*
- **which** — for things and animals: *The book **which** I read...*
- **that** — for people, things, or animals (informal): *The book **that** I read...*
- **whose** — possessive: *The man **whose** car broke down...*
- **where** — for places: *The town **where** I grew up...*
- **when** — for times: *The day **when** we met...*

## Defining (restrictive) — no commas

Essential information:
- *The man **who lives next door** is a doctor.*

You CAN drop *who/that/which* when it's the OBJECT:
- *The book (that) I read* — *that* optional
- *The man (who) I met* — *who* optional

You CANNOT drop them when SUBJECT:
- *The man **who** lives next door* — required

## Non-defining (non-restrictive) — with commas

Extra information; sentence works without it:
- *My brother, **who lives in Berlin**, is visiting.*

In non-defining clauses, *that* is NOT allowed:
- *My brother, **who** lives in Berlin...* ✅
- *My brother, **that** lives in Berlin...* ❌

## Common mistakes

- *The man what I saw* ❌ → *The man **who/that** I saw* ✅
- *The woman, that called* ❌ → *The woman, **who** called* ✅
- *The book who I read* ❌ → *The book **which/that** I read* ✅
""", related=["pronouns_overview"])

# ============================================================
# WORD ORDER + QUESTIONS + NEGATION
# ============================================================

L("questions_do_support", "Questions: do-support and word order", "A1", """
English has a unique grammar rule: in questions and negatives, we use **do/does/did** with most verbs. No other major European language does this exactly the same way.

## Why "do"?

Statements are SVO:
- *You **eat** sushi.*

To make a question or negative, add **do**:
- Question: ***Do** you eat sushi?* (not *Eat you sushi?*)
- Negative: *You **don't** eat sushi.*

## Form

| | Present | Past |
|---|---|---|
| Statement | I work | I worked |
| Negative | I **don't** work | I **didn't** work |
| Question | **Do** I work? | **Did** I work? |
| He/she negative | He **doesn't** work | He **didn't** work |
| He/she question | **Does** he work? | **Did** he work? |

After *do/does/did*, the main verb is in **base form**:
- *Does he **work**?* (not *Does he works?*)
- *Did you **see** it?* (not *Did you saw it?*)

## When you DON'T need *do*

**1. Be**: *Are you happy? She isn't tired.*
**2. Modals**: *Can you help? She won't come.*
**3. Have** as auxiliary: *Have you finished?* (British style)

## Wh-questions

**Subject question** — wh-word IS the subject — no *do*:
- *Who **broke** it?*

**Object/other question** — use *do/does/did*:
- *What **did** you eat?*
- *Where **does** she live?*

## Common mistakes

- *What you want?* ❌ → *What **do** you want?* ✅
- *Did you saw him?* ❌ → *Did you **see** him?* ✅
- *I no like it* ❌ → *I **don't** like it* ✅
""", related=["word_order", "present_simple"], l1_notes={
    "es": "Esto es una de las diferencias clave entre inglés y español. *¿Tú comes sushi?* es *Do you eat sushi?* (no *Eat you sushi?*). El *do* parece extraño pero es obligatorio.",
    "zh": "中文用 *吗* 问问题:*你吃寿司吗?* 英语用 *do*:*Do you eat sushi?* 这个 *do* 在陈述句里不需要,但问句和否定句必须有。",
    "ja": "日本語の *〜ですか?* に当たる英語の疑問は do を使います。*Do you eat sushi?* の do を忘れがちですが、必須です。",
})

L("word_order", "Word order in English", "A1", """
English is **subject-verb-object (SVO)** — word order matters much more than in languages with case marking.

## Basic order

**Subject + Verb + Object**:
- *I eat sushi.*
- *Sarah loves her dog.*

## Where adverbs go

**1. Front** (emphasis or time):
- *Yesterday, I went to the park.*

**2. Mid** (between subject and main verb; frequency, certainty):
- *I **always** drink coffee.*
- *She **probably** knows.*

For *be*, adverb comes AFTER: *I **am always** late.*

**3. After the object** (manner — how):
- *She speaks French **fluently**.*

**4. End** (time, place):
- *I'll see you **tomorrow**.*

## Adjective order

Stack adjectives in this order before a noun:
**Opinion → Size → Age → Shape → Color → Origin → Material → Purpose → Noun**

- *a big red car* ✅ (size → color)
- *a red big car* ❌

## Place before time

When listing both, place comes first:
- *I went **to the park yesterday**.*
- *He's flying **to Tokyo tomorrow**.*

## Common mistakes

- *I drink always coffee* ❌ → *I **always** drink coffee* ✅
- *I went yesterday to the park* ❌ → *I went to the park yesterday* ✅
- *She speaks fluently English* ❌ → *She speaks English **fluently*** ✅
- *A red big car* ❌ → *A **big red** car* ✅
""", related=["questions_do_support"])

L("negation", "Negation in English", "A1", """
English negates verbs using **not** (or **n't**), almost always with an auxiliary.

## With *be*

Add *not* after *be*:
- *I'**m not** tired.*
- *She **isn't** here.*

## With other verbs — do-support

- *I **don't** eat meat.*
- *She **doesn't** know.*
- *We **didn't** see him.*

## With modals — just add *not*

- *I **can't** come.*
- *She **won't** help.*
- *You **mustn't** smoke here.*

## NO double negatives in standard English

Unlike Spanish (*no veo nada*), use ONE negative per clause:
- *I don't see **anything**.* ✅
- *I don't see **nothing**.* ❌ (non-standard)

## Negative imperatives

- *Don't touch that.*
- *Never give up.*

## Common contractions

*don't, doesn't, didn't, isn't, aren't, wasn't, weren't, won't (NOT willn't), wouldn't, can't, couldn't, shouldn't, mustn't, haven't, hasn't, hadn't*

## Common mistakes

- *I no like it* ❌ → *I **don't** like it* ✅
- *She not happy* ❌ → *She **isn't** happy* ✅
- *I don't see nothing* ❌ (standard) → *I don't see **anything*** ✅
- *Willn't* ❌ → ***Won't*** ✅
""", related=["questions_do_support", "present_simple"])

# ============================================================
# PHRASAL VERBS + PREPOSITIONS
# ============================================================

L("phrasal_verbs_overview", "Phrasal verbs: an overview", "A2", """
A **phrasal verb** is a verb + a particle (preposition or adverb) that together mean something the words alone don't suggest.

- *put up with* = tolerate
- *get away with* = avoid punishment
- *look after* = take care of
- *give up* = quit
- *run into* = meet by chance

Phrasal verbs are everywhere in spoken English.

## Separable vs inseparable

**Separable** — object can go between or after:
- *Turn **off** the light.* / *Turn the light **off**.*
- BUT pronouns MUST go between: *Turn **it** off* ✅, NOT *Turn off it* ❌

**Inseparable** — verb + particle stay together:
- *Look **after** my cat.* ✅
- *Run **into** an old friend.* ✅

Three-part phrasal verbs (*put up with*) are always inseparable.

## Literal vs idiomatic

Some are literal (*sit down, stand up, come in*).
Some are idiomatic (*give up* = quit, *break up* = end a relationship, *take after* = resemble).

## Multiple meanings

The same phrasal verb can mean different things:
- *make up*: invent / apply cosmetics / reconcile after a fight / form (the team)
- *pick up*: lift / collect / learn casually / improve

Context disambiguates.

## How to learn them

1. **In sentences, not lists.** Context sticks.
2. **One verb at a time.** Learn *get's* top 10 phrasals (*get up, get on, get off, get over, get into, get out of, get back, get along, get away, get rid of*).
3. **Watch native input.** Movies, podcasts.

## Common mistakes

- *Turn off it* ❌ → *Turn **it** off* ✅
- *Look at after the dog* ❌ → *Look **after** the dog* ✅
""", related=["confusables_do_make"], l1_notes={
    "es": "Los phrasal verbs son lo más difícil del inglés para hispanohablantes. *Quitar* puede ser *take off, take away, take out, remove*... depende del contexto. Apréndelos en frases, no en listas.",
    "zh": "动词短语对学习者最难。比如 *put up with* = 忍受,*get over* = 克服,字面意思猜不出来。必须从语境中学习。",
})

L("prepositions_time", "Prepositions of time: in, on, at", "A1", """
**In, on, at** for time — choice depends on how specific.

## at — specific points

- *at 3 o'clock, at noon, at midnight*
- *at lunchtime, at the weekend* (UK)
- *at Christmas* (the holiday period)
- *at night*

## on — days and dates

- *on Monday, on Tuesday*
- *on January 15, on the 5th of June*
- *on my birthday*
- *on the weekend* (US)

## in — longer periods

- *in the morning, in the afternoon, in the evening* (BUT *at night*)
- *in January, in spring, in 2026*
- *in the 1990s, in the 21st century*
- *in two hours* (after a period)

## Special / no preposition

- *next/last/this/every + time* → NO preposition: *next Monday, last year, this morning*
- *yesterday, today, tomorrow* — no preposition

## Common pairs that trip people up

- *in time* (early enough) vs *on time* (punctual):
  - *I arrived **in time** for the meeting.*
  - *The train was **on time**.*

## Common mistakes

- *On 3 o'clock* ❌ → *At 3 o'clock* ✅
- *In Monday* ❌ → *On Monday* ✅
- *At January* ❌ → *In January* ✅
- *I'll see you in next Monday* ❌ → *I'll see you next Monday* ✅
- *At the night* ❌ → *At night* ✅
""", related=["prepositions_place", "articles_a_an_the"])

L("prepositions_place", "Prepositions of place: in, on, at", "A1", """
**In, on, at** for place — *at* is most specific, *in* is most enclosed.

## at — specific points

- *at the door, at the bus stop, at the corner*
- *at home, at work, at school* (institutions)
- *at the party, at the meeting* (events)
- *at 23 Oak Street* (street addresses)

## on — surfaces and lines

- *on the table, on the wall, on the floor*
- *on the bus, on the train, on the plane* (but *in the car*)
- *on Oak Street* (street as a line)
- *on TV, on the internet, on the radio*

## in — enclosed spaces and large areas

- *in the box, in the room*
- *in Berlin, in Germany, in Europe*
- *in the car* (but *on the bus/plane*)
- *in the newspaper, in a book*

## The car/bus split

- ***in** a car / taxi* — sit in an enclosed small space
- ***on** a bus / train / plane / boat* — walk on board, can stand

This is convention, not strict logic.

## Common mistakes

- *In the door* ❌ → *At the door* ✅
- *On the car* ❌ → *In the car* ✅
- *In the bus* ❌ → *On the bus* ✅
- *At Berlin* ❌ → *In Berlin* ✅
- *In the TV* ❌ → *On TV* ✅
""", related=["prepositions_time"])

# ============================================================
# COMPARISON
# ============================================================

L("comparison", "Comparatives and superlatives", "A2", """
**Comparatives** compare two; **superlatives** identify the extreme.

## Form rules

**1 syllable** → **-er / -est**:
- *tall → taller → tallest*
- C-V-C double: *big → bigger → biggest*

**2 syllables -y** → **-ier / -iest**:
- *happy → happier → happiest*

**2+ syllables (most others)** → **more / most**:
- *interesting → more interesting → most interesting*

## Irregulars

- *good → better → best*
- *bad → worse → worst*
- *far → farther/further → farthest/furthest*
- *little → less → least*
- *much/many → more → most*

## Structures

- **than**: *I'm taller **than** you.*
- **as ... as** (equal): *She's **as** tall **as** her brother.*
- **not as ... as** (less than): *He's **not as** fast **as** her.*
- **the + comparative... the + comparative** (proportional): *The **harder** you work, the **more** you earn.*

## Superlatives — usually with *the*

- *He's **the** tallest in the family.*
- *This is **the** best book I've read.*

## Modifying

- Intensify: *much taller, far better, a lot more*
- Smaller diff: *slightly taller, a bit better*

## Common mistakes

- *More tall* ❌ → *Taller* ✅
- *Most happy* ❌ → *Happiest* ✅
- *More better* ❌ → *Better* ✅ (don't double-mark)
- *I'm taller that you* ❌ → *I'm taller **than** you* ✅
""", related=["adjectives_order"])

# ============================================================
# CONFUSABLES
# ============================================================

L("confusables_do_make", "Confusables: do vs make", "A2", """
*Do* and *make* both translate to "do" in many languages, but English uses them differently.

## do — tasks, activities, jobs

- *do homework, do the dishes, do exercise, do business*
- *do your best, do a good job*
- *do the laundry, do the cleaning*

Mnemonic: **do** = duty / daily task.

## make — create, produce

- *make a cake, make breakfast, make coffee*
- *make a mistake, make a decision, make a choice*
- *make money, make progress, make plans*
- *make friends, make an effort*
- *make noise, make a call*

Mnemonic: **make** = manufacture / produce a result.

## Top collocations

| With **do** | With **make** |
|---|---|
| do homework | make a mistake |
| do the dishes | make a decision |
| do exercise | make breakfast |
| do business | make a phone call |
| do laundry | make plans |
| do nothing | make money |
| do well | make friends |
| do a favor | make sense |
| do research | make progress |

## Common mistakes

- *Make your homework* ❌ → *Do your homework* ✅
- *Do a mistake* ❌ → *Make a mistake* ✅
- *Make the dishes* ❌ → *Do the dishes* ✅
- *Do a decision* ❌ → *Make a decision* ✅
""", related=["confusables_say_tell"], l1_notes={
    "es": "Tanto *hacer* del español como *fare* del italiano cubren ambos. Memoriza colocaciones (do business, make money) más que reglas.",
    "zh": "中文 *做* 涵盖 do 和 make。英语区分:具体生产 = make (*make a cake*),日常任务 = do (*do homework*)。",
})

L("confusables_say_tell", "Confusables: say vs tell", "A2", """
*Say* and *tell* both report speech, but they need different grammar.

## tell — needs a person object

- *Tell **me** the truth.*
- *She told **him** the news.*
- *Don't tell **anyone**.*

Without a person, *tell* sounds wrong.

## say — does NOT take a person as direct object

- *She **said** hello.* ✅
- *She said hello **to me**.* ✅ (person with *to*)
- *She said **me** hello* ❌

## Patterns

| say | tell |
|---|---|
| say something (to someone) | tell someone something |
| say hello | tell a story |
| say sorry | tell the truth |
| say a few words | tell a lie |
| say goodbye | tell a joke |

## Special "tell" expressions

- *tell the truth / a lie* (fixed)
- *tell a story / joke / secret*
- *tell the time* (read a clock)
- *tell the difference* (distinguish)
- *tell someone off* (scold)

## Special "say" expressions

- *say a prayer, say a few words*
- *let's say* (for example)
- *they say (that)* (people say)
- *I'd say* (my opinion)

## Reported speech

- *He **said** (that) he was tired.* (no person)
- *He **told me** (that) he was tired.* (person required)

## Common mistakes

- *She said me she was tired* ❌ → *She **told** me...* ✅
""", related=["confusables_do_make", "reported_speech"])

L("confusables_overview", "Other common confusables", "B1", """
A grab-bag of pairs that trip up intermediate learners.

## fewer vs less

- *fewer* with countable plurals: ***fewer** books, **fewer** mistakes*
- *less* with uncountables: ***less** water, **less** time*

(Many natives mix these; supermarket "10 items or less" should be *fewer*.)

## who vs whom

- *who* = subject: *Who called?*
- *whom* = object: *Whom did you call?*

In modern English, *whom* is fading. *Who did you call?* is fine in speech.

## who's vs whose

- *who's* = *who is* or *who has*
- *whose* = possessive

## its vs it's

- *it's* = *it is* or *it has*
- *its* = possessive: *The dog wagged **its** tail.* (no apostrophe)

## affect vs effect

- *affect* = verb, "to influence"
- *effect* = noun, "the result"

## lie vs lay

- *lie* (intransitive) = recline: *I **lie** down. I **lay** down (yesterday). I have **lain** down.*
- *lay* (transitive) = put: *I **lay** the book down. I **laid** it.*
- *lie* (deceive): *He **lies**. He **lied**.*

Even natives confuse them.

## bring vs take

- *bring*: toward speaker — *Bring me the book.*
- *take*: away from speaker — *Take it to her.*

## borrow vs lend

- *borrow* (from): *Can I **borrow** your pen?*
- *lend* (to): *Can you **lend** me your pen?*

## remember vs remind

- *remember*: I do it myself
- *remind*: cause someone else to remember

## then vs than

- *then* = at that time / next
- *than* = comparison
""", related=["confusables_do_make", "confusables_say_tell"])

# ============================================================
# GERUNDS + INFINITIVES
# ============================================================

L("gerund_vs_infinitive", "Gerunds vs infinitives", "B1", """
After certain verbs, you use **-ing** (gerund); after others, **to + verb** (infinitive). Sometimes either, sometimes with different meanings.

## Verbs followed by gerund (-ing)

*enjoy, finish, avoid, mind, suggest, recommend, consider, miss, deny, practice, keep, postpone, admit, discuss, imagine, risk, dislike, can't help, give up, look forward to*

- *I enjoy **swimming**.*
- *She finished **reading**.*
- *Would you mind **opening** the window?*

After prepositions, always -ing:
- *I'm interested **in learning** more.*
- *Thanks **for coming**.*

## Verbs followed by infinitive (to + V)

*want, need, hope, plan, decide, expect, refuse, promise, agree, learn, manage, offer, choose, seem, appear, pretend, fail, afford, prepare, intend, mean*

- *I want **to leave**.*
- *She decided **to stay**.*
- *I can't afford **to buy** it.*

After most adjectives, use infinitive:
- *It's important **to study**.*
- *Nice **to meet** you.*

## Both — same meaning

*start, begin, continue, prefer, love, like, hate, can't stand*:
- *I love **swimming**.* = *I love **to swim**.*

## Both — DIFFERENT meaning

**stop**:
- *I stopped **smoking**.* = I quit.
- *I stopped **to smoke**.* = I paused in order to smoke.

**remember/forget**:
- *I remembered **to lock** the door.* = I didn't forget.
- *I remembered **locking** the door.* = I recall doing it.

**try**:
- *Try **to call** her.* = make an effort
- *Try **calling** her.* = experiment

## Common mistakes

- *I enjoy to swim* ❌ → *I enjoy **swimming*** ✅
- *I want swim* ❌ → *I want **to swim*** ✅
- *I'm interested in to learn* ❌ → *I'm interested **in learning*** ✅
""", related=["phrasal_verbs_overview"])

# ============================================================
# PRONUNCIATION
# ============================================================

L("silent_letters", "Silent letters in English", "A2", """
English spelling preserves history — many letters are silent. Knowing the patterns helps.

## Silent K — before N

*know, knee, knife, knight, knit, knock, knot, knowledge*

## Silent W — before R

*write, wrong, wrap, wrist, wrestler, wreck*

## Silent B — after M (in -mb endings)

*climb, comb, lamb, thumb, dumb, bomb, tomb*

Also: *debt, doubt, subtle*

## Silent L — before D, F, K, M

- *could, would, should* (before D)
- *half, calf* (before F)
- *talk, walk, chalk, folk* (before K)
- *calm, palm, salmon* (before M)

## Silent T — in specific words

*castle, listen, whistle, fasten, often* (silent or pronounced)

## Silent H

Word-initial: *hour, honest, honor, herb* (American English)

## Silent GH

- Silent: *night, light, sight, right, though, through*
- Pronounced /f/: *enough, tough, rough, cough, laugh*

## Silent N — after M

*autumn, column, hymn* — N silent in endings. Comes back in derived words: *autumnal, columnist*.

## Silent P — in PS-, PN-, PT- starts

*psychology, psalm, pneumonia, pterodactyl*

## Common mistakes

- Pronouncing the silent K in *know* — should be /noʊ/
- Pronouncing the B in *climb* — /klaɪm/
""", related=["alphabet"])

L("stress_intonation", "Word stress and sentence intonation", "B1", """
**Stress** carries meaning in English. Native listeners use stress to chunk speech.

## Word stress

Every 2+ syllable word has one main stressed syllable:
- **TA**-ble (not ta-BLE)
- be-**LIEVE** (not BE-lieve)

## Noun-verb stress shift

Many 2-syllable words have the same spelling for noun and verb, with stress distinguishing them:

| Noun (1st) | Verb (2nd) |
|---|---|
| **RE**cord | re**CORD** |
| **PRES**ent | pre**SENT** |
| **OBJ**ect | ob**JECT** |
| **PRO**duce | pro**DUCE** |
| **CON**duct | con**DUCT** |

Rule: nouns stress earlier; verbs stress later.

## Sentence stress

English stresses **content words** (nouns, main verbs, adjectives, adverbs) and de-stresses **function words** (articles, prepositions, auxiliaries, pronouns):

- *I'm **GO**ing to the **STORE** to **BUY** some **BREAD**.*

Unstressed words get reduced — *to* sounds like /tə/, *some* like /səm/.

## Schwa — the most common English sound

The unstressed vowel reduces to /ə/ (schwa):
- *banana* = b-NAH-nə
- *the* (unstressed) = /ðə/

## Intonation

**Falling** = statement, completed thought:
- *I'm going home. ↓*
- Wh-questions also fall: *Where do you live? ↓*

**Rising** = yes/no question, uncertainty:
- *Are you ready? ↑*

**Rise-fall** = lists, with the last item falling:
- *I bought apples ↑, oranges ↑, and bananas. ↓*

## Why it matters

A correctly-pronounced word with WRONG stress is often less intelligible than the wrong word with right stress.

## Common mistakes

- Equal stress on every syllable (robotic)
- Pronouncing function words clearly instead of reducing them
- Forgetting noun-verb shift
""", related=["alphabet", "silent_letters"])

# ============================================================
# GREETINGS + NUMBERS + CULTURE
# ============================================================

L("greetings_register", "Greetings: formal and informal", "A1", """
English has many greetings — choosing depends on who you're talking to.

## Casual

- *Hi! Hey!*
- *What's up? Sup?* (very casual; doesn't need a real answer)
- *How's it going? How are you doing?*
- *How are you?*

Casual responses:
- *Good. You? / Pretty good. / Not bad. / Fine, thanks.*

## Formal

- *Hello.*
- *Good morning / afternoon / evening.*
- *How do you do?* (very formal, almost archaic)
- *Pleased to meet you. / Nice to meet you.*

## Goodbyes

- Casual: *Bye! See you! See ya! Later! Take care!*
- Formal: *Goodbye. Have a good day.*
- Time-specific: *See you tomorrow / next week.*

*Good night* = parting at night OR going to bed — never a greeting.

## Email greetings

| Formal | Informal |
|---|---|
| Dear Mr./Ms. Smith, | Hi John, |
| Dear Sir/Madam, | Hey Sarah, |

## Email sign-offs

| Formal | Friendly | Casual |
|---|---|---|
| Sincerely, | Best, | Cheers, |
| Best regards, | Best wishes, | Thanks, |
| Kind regards, | Take care, | Talk soon, |

## Cultural notes

- "How are you?" is often a ritual greeting. *Fine, thanks* is the expected answer.
- *Goodnight* is for parting at night or going to bed.
- British English uses *cheers* for both "thanks" and "bye" in casual contexts.

## Common mistakes

- *Good night* used as greeting in the evening ❌ → *Good evening* ✅
""", related=["politeness_register"])

L("numbers_dates_times", "Numbers, dates, and times", "A1", """
English numbers are mostly regular, with a few quirks.

## Cardinal numbers

- 0-12: zero, one ... twelve
- 13-19: thirTEEN, fourTEEN, fifTEEN, sixTEEN, sevenTEEN, eighTEEN, nineTEEN (stress on -teen)
- 20-90: twenty, thirty, forty (NOT *fourty*), fifty, sixty, seventy, eighty, ninety
- Compound: twenty-one ... ninety-nine
- 100 = a hundred / one hundred
- 1,000 = a thousand
- 1,000,000 = a million

## Large numbers

- 213 = *two hundred (and) thirteen*
- Phone numbers: digit-by-digit
- Years: 1995 = *nineteen ninety-five*; 2024 = *twenty twenty-four*

## Ordinals

1st first, 2nd second, 3rd third, 4th fourth, 5th fifth ... 20th twentieth, 21st twenty-first.

Suffix rule: after 1 → -st, after 2 → -nd, after 3 → -rd, else -th. Exceptions: 11th, 12th, 13th end in -th.

## Dates

- US: month/day/year — *June 5, 2024* / *6/5/2024*
- UK: day/month/year — *5 June 2024* / *5/6/2024*

Read: *June (the) fifth* / *the 5th of June*

Days/months: capitalized.

## Times

- *3:00* = *three o'clock*
- *3:15* = *quarter past three* / *three fifteen*
- *3:30* = *half past three* / *three thirty*
- *3:45* = *quarter to four* / *three forty-five*

AM = morning; PM = afternoon+evening. *Noon* = 12 PM; *midnight* = 12 AM.

## Decimals + fractions

- 0.5 = *point five*
- 3.14 = *three point one four*
- 1/2 = *a half*, 1/3 = *a third*, 2/3 = *two thirds*, 3/4 = *three quarters*

## Money

- $5.00 = *five dollars*
- $5.50 = *five dollars (and) fifty cents* / *five-fifty*

## Common mistakes

- *Fourty* ❌ → ***Forty*** ✅
- *Twenty hundred* ❌ → ***Two thousand*** ✅
- *The 23 of May* ❌ → *The 23**rd** of May* ✅
""", related=["greetings_register"])

L("politeness_register", "Politeness and register", "A2", """
English doesn't have a formal/informal pronoun split, but it shows politeness through word choice, modals, and indirectness.

## Modals soften requests

- ***Can*** you help? — neutral
- ***Could*** you help? — politer
- ***Would you mind*** helping? — even politer
- ***I was wondering if*** you could help — very polite

Longer + more indirect = politer.

## Please and thank you

- *Please* with requests: *Could you please open the window?*
- *Thank you / Thanks* — universal
- *Cheers* = thanks (UK casual)
- *Much appreciated* — formal

## Saying no politely

- *I'm afraid I can't.*
- *Unfortunately, no.*
- *I'd love to, but...*
- *Sorry, I'm not able to.*

## Apologies (range)

- *Sorry.* — universal
- *I'm sorry.* — slightly more formal
- *I apologize.* — formal
- *Excuse me.* — for small interruptions
- *Pardon (me)?* — for asking someone to repeat

## Register signals

More formal: full forms (*I will* not *I'll*), *would like* not *want*, Latin-origin words (*commence, purchase, assist*).

More casual: contractions, phrasal verbs (*find out* not *discover*), slang.

## Sir / Madam / Ma'am

- *Sir / Madam* — formal service contexts
- *Ma'am* — US polite for an older woman
- Don't use *Madam* casually — sarcastic.

## Titles

Mr. / Mrs. / Miss / Ms. / Dr. — use with LAST name: *Mr. Smith*, NOT *Mr. John*.

## Cultural notes

- Americans use first names quickly in business; Britons stay formal longer.
- Don't ask about age, salary, or weight directly.

## Common mistakes

- *Give me the salt!* ❌ → *Could you pass me the salt, please?* ✅
- *I want a coffee* in a café → *I'd like a coffee, please*
""", related=["greetings_register", "modals_deontic"])

L("common_idioms", "Common English idioms", "B1", """
Idioms are phrases whose meaning isn't predictable from the parts. Top 30 to know.

## Time + frequency

- *once in a blue moon* — very rarely
- *out of the blue* — unexpectedly
- *in the nick of time* — just in time
- *24/7* — all the time

## Effort + achievement

- *hit the nail on the head* — exactly right
- *break the ice* — start an awkward conversation
- *piece of cake* — very easy
- *cut corners* — do sloppily
- *go the extra mile* — do more than required
- *bite the bullet* — endure something painful
- *call it a day* — stop working

## Emotion + state

- *over the moon* — very happy
- *under the weather* — slightly sick
- *on cloud nine* — extremely happy
- *down in the dumps* — sad
- *in hot water* — in trouble

## Money

- *cost an arm and a leg* — very expensive
- *break the bank* — cost too much
- *make ends meet* — barely afford basic life

## Communication

- *spill the beans* — reveal a secret
- *the elephant in the room* — obvious problem nobody mentions
- *beat around the bush* — avoid the point
- *long story short* — to summarize

## Decision + risk

- *take a rain check* — postpone a plan
- *play it by ear* — improvise
- *jump the gun* — act prematurely
- *get cold feet* — lose courage at the last minute

## How to use them

- Start with the top 20-30. Don't try 500 — most are rare.
- Casual conversation, not formal writing.
- Don't translate idioms from your L1 — they almost never carry over.

## Common mistakes

- Overusing idioms (sounds unnatural)
- Mixing metaphors: *grab the bull by the horns and hit the nail on the head*
- Wrong word: *piece of pie* ❌ → *piece of **cake*** ✅
""", related=["phrasal_verbs_overview"])

L("culture_usage_notes", "Cultural usage notes", "B1", """
Quirks that aren't obvious from grammar but matter for sounding natural.

## Small talk is normal

In US/UK, brief chat with strangers (cashiers, neighbors) is expected:
- *How's it going? — Good, you?*
- *Nice weather, isn't it?*

Don't take *How are you?* literally with strangers.

## Compliments — accept, don't deflect

The polite response to a compliment is *Thank you*, not denial:
- *You look great today!* → *Thank you!* ✅
- *Oh no, I look terrible* ❌

You can soften: *Thanks — I tried!*

## "Sorry" is overused (esp. UK)

British English uses *sorry* for tiny things (bumping into someone, asking to pass):
- *Sorry, could I just squeeze past?*

It's a politeness cushion, not a real apology.

## Direct vs indirect cultures

US/UK lean indirect for requests:
- ***I was wondering if** you could possibly help me?* — very polite
- *Help me with this.* — sounds rude unless you know the person well

In email, brusque commands feel rude. *Could you send the report by 5, please?* is the norm.

## Sense of humor

British English uses understatement, sarcasm, self-deprecation:
- *It's not bad* = it's actually great
- *I'm a bit busy* = I'm completely swamped
- *Could be worse* = it's fine

Taking these literally misses the point.

## Tip culture

- US: 15-20% in restaurants, $1-2 for coffee/bar. Not tipping = rude.
- UK: optional, smaller (~10%).
- Varies wildly by country.

## Personal space

US/UK stand ~1 meter apart; closer can feel intrusive (vs Latin America / southern Europe at ~60 cm).

## Topics to avoid initially

- Salary, age, weight — too personal
- Politics, religion — risky with new acquaintances
- *How much do you make?* — never ask outside close friends

## Common mistakes

- Asking *How old are you?* casually — can feel intrusive
- Saying *I'm fine* when someone asks *What's wrong?* — sounds passive-aggressive
- Not saying *thanks* for a small favor (door held, change handed back)
""", related=["greetings_register", "politeness_register"])
