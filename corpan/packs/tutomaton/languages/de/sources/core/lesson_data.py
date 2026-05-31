"""Lessons for German — first draft, 8 lessons."""

LESSONS = []


def L(topic, title, level, body, related=None, l1_notes=None):
    LESSONS.append({
        "topic": topic, "title": title, "level": level,
        "body": body.strip(), "related": related or [], "l1_notes": l1_notes or {},
    })


L("articles_der_die_das", "Articles: der, die, das", "A1", """
German has three genders + four cases. Articles change for all of them.

## Definite (the) — nominative

- **der** (m.): *der Mann*
- **die** (f.): *die Frau*
- **das** (n.): *das Kind*
- **die** (plural, all genders): *die Kinder*

## Indefinite (a)

- **ein** (m./n.): *ein Mann*, *ein Kind*
- **eine** (f.): *eine Frau*

## Case affects the form

| Case | m. | f. | n. | pl. |
|---|---|---|---|---|
| nom. | der | die | das | die |
| acc. | den | die | das | die |
| dat. | dem | der | dem | den |
| gen. | des | der | des | der |

## Common mistakes

- *das Mädchen* (girl) is NEUTER (not feminine) — diminutive -chen.
- Forgetting case: *Ich sehe der Mann* ❌ → *Ich sehe **den** Mann* ✅.
""", related=["noun_cases"], l1_notes={
    "en": "English has no case marking and no gender. Memorize each noun WITH its gender — *der Tisch*, not just *Tisch*.",
})

L("noun_cases", "The four cases", "A1", """
German has 4 cases that mark a noun's role.

## Nominative — subject

- *Der Hund schläft.*

## Accusative — direct object

- *Ich sehe den Hund.*

## Dative — indirect object + certain prepositions

- *Ich gebe dem Hund Wasser.*
- After: mit, nach, bei, seit, von, zu, aus, gegenüber

## Genitive — possessive

- *Das Haus des Mannes*. (Often replaced by *von + dat* in speech: *Das Haus von dem Mann*.)

## Two-way prepositions (dat/acc by motion vs location)

- in, an, auf, hinter, neben, über, unter, vor, zwischen
- Motion → acc: *Ich gehe **in den** Park.*
- Location → dat: *Ich bin **im** Park.* (im = in dem)

## Common mistakes

- *mit der Hund* ❌ → *mit **dem** Hund* ✅
- Forgetting acc on direct objects.
""", related=["articles_der_die_das"])

L("verbs_sein_haben", "Sein (to be) and haben (to have)", "A1", """
The two most-used German verbs. Both irregular.

## sein (to be)

- ich **bin**, du **bist**, er/sie/es **ist**
- wir **sind**, ihr **seid**, sie/Sie **sind**

## haben (to have)

- ich **habe**, du **hast**, er/sie/es **hat**
- wir **haben**, ihr **habt**, sie/Sie **haben**

## Used together for perfect tense

- *Ich habe gegessen* — I have eaten / I ate.
- *Ich bin gefahren* — I drove (motion verbs use *sein*).

## Special: be vs have for states

German more often uses *be* (not *have*) for states:
- *Ich **bin** hungrig* / *Ich **habe** Hunger* — both work for "I'm hungry"
- *Ich **bin** 25* — I'm 25

## Common mistakes

- *Ich habe gegangen* ❌ → *Ich bin gegangen* ✅
""", related=["verbs_modal"])

L("verbs_modal", "Modal verbs", "A2", """
Six modals essential to everyday German. Position 2; main verb at the END.

## The six modals

| Modal | Meaning |
|---|---|
| **können** | can / be able to |
| **müssen** | must / have to |
| **wollen** | want to |
| **sollen** | should / supposed to |
| **dürfen** | may / be allowed to |
| **mögen** | like (*möchte* = would like) |

## Word order — main verb at the end

- *Ich **kann** Deutsch **sprechen**.*
- *Wir **müssen** morgen früh **aufstehen**.*

## Conjugation pattern

- ich kann, du kannst, er kann, wir können, ihr könnt, sie können
- ich muss, du musst, er muss, wir müssen, ihr müsst, sie müssen

1st and 3rd person singular are the same — typical for modals.

## Common mistakes

- *Ich kann sprechen Deutsch* ❌ → *Ich kann Deutsch sprechen* ✅
- Conjugating the main verb: *Ich kann spricht* ❌ → *Ich kann sprechen* ✅
""", related=["word_order_v2"])

L("word_order_v2", "Word order: V2 rule", "A1", """
German has a strict **V2 (verb-second)** rule for main clauses.

## Default

- *Ich lese ein Buch.*

## Time at the front → inversion

- *Heute **lese** ich ein Buch.* (Time + Verb + Subject)
- *In Berlin **wohne** ich.*

## Subordinate clauses — verb goes to the END

After *weil, dass, wenn, ob*:
- *Ich weiß, dass du Deutsch **sprichst**.*
- *Ich gehe nach Hause, weil ich müde **bin**.*

## Modal + main verb

- Main clause: modal in pos. 2, main verb at end.
- Subordinate clause: both at the end.

## Common mistakes

- Forgetting V2 inversion: *Heute ich lese* ❌ → *Heute lese ich* ✅
""", related=["verbs_modal"])

L("past_tense_perfekt", "Past tense: Perfekt", "A1", """
Most-used past tense in speech is the **Perfekt**.

## Form

**haben/sein (present) + past participle (Partizip II)**

Most verbs use *haben*; motion/change verbs use *sein*.

## Past participles

Regular: *ge- + stem + -t*: *gemacht, gelernt, gespielt*
Irregular: *ge- + stem + -en*: *gegessen, gegangen, gesehen*

## Examples

- *Ich habe Deutsch gelernt.*
- *Wir sind nach Berlin gefahren.*

## Word order

Auxiliary in position 2; participle at the END:
- *Ich habe gestern einen Film **gesehen**.*

## Präteritum (simple past)

Used in writing — but *sein/haben/modal* even in speech:
- *Ich war müde.* / *Ich hatte Hunger.* / *Ich konnte nicht kommen.*

## Common mistakes

- Wrong auxiliary: *Ich habe gegangen* ❌ → *Ich bin gegangen* ✅
- Forgetting ge-: *macht* ❌ → *gemacht* ✅
""", related=["verbs_sein_haben"])

L("negation_nicht_kein", "Negation: nicht vs kein", "A1", """
German has two main negation words.

## kein — negates a noun with *ein* or no article

- *Ich habe **ein** Auto.* → *Ich habe **kein** Auto.*
- *Ich trinke Kaffee.* → *Ich trinke **keinen** Kaffee.*

*kein* changes form like *ein*.

## nicht — negates verbs, adjectives, definite-article nouns

- *Ich gehe **nicht**.*
- *Das Auto ist **nicht** rot.*
- *Ich kenne den Mann **nicht**.*

## Position of *nicht*

- Before adjectives/adverbs/PP: *Das ist **nicht** gut.*
- At the end for verb negation: *Ich gehe **nicht**.*
- Before the emphasized part.

## Common mistakes

- *Ich habe nicht ein Auto* ❌ → *Ich habe **kein** Auto* ✅
""", related=["articles_der_die_das"])

L("greetings_register", "Greetings, du vs Sie, politeness", "A1", """
German has formal/informal forms; choosing matters.

## Greetings

- **Hallo** — hi (universal casual)
- **Guten Tag / Guten Morgen / Guten Abend** — formal greetings
- **Gute Nacht** — goodnight (bedtime only)
- **Tschüss** — bye (casual)
- **Auf Wiedersehen** — goodbye (formal)

## du vs Sie

- **du** — informal singular (friends, family, peers)
- **ihr** — informal plural
- **Sie** — formal (sing. AND plural) — always capitalized

Default with strangers: *Sie*.

## Politeness

- **Bitte** — please / you're welcome
- **Danke** — thanks
- **Vielen Dank** — thanks very much
- **Entschuldigung** — excuse me / sorry
- **Es tut mir leid** — I'm sorry (real apology)

## Asking how someone is

- *Wie geht's?* — casual
- *Wie geht es Ihnen?* — formal
- *Mir geht's gut, danke.*

## Cultural notes

- Germans are direct — less softening than English.
- Greeting strangers/cashiers/etc. is expected.
- *du* with someone older or in authority — wait to be invited.
""", related=["politeness_register"])
