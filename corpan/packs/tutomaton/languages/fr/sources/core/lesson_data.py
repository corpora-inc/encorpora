"""Lessons for French — first draft, 12 reference-grade lessons."""

LESSONS = []


def L(topic, title, level, body, related=None, l1_notes=None):
    LESSONS.append({
        "topic": topic, "title": title, "level": level,
        "body": body.strip(), "related": related or [], "l1_notes": l1_notes or {},
    })


L("articles_le_la_les", "Articles: le, la, les, un, une, des", "A1", """
French has gendered articles, with definite, indefinite, and partitive forms.

## Definite articles (the)

- **le** (m. singular): *le livre*
- **la** (f. singular): *la table*
- **l'** (before vowel/silent h): *l'eau*, *l'homme*
- **les** (plural): *les livres*, *les tables*

## Indefinite articles (a/some)

- **un** (m.): *un livre*
- **une** (f.): *une table*
- **des** (plural): *des livres*

## Partitive (some — for uncountables)

- **du** (= de + le): *du pain*
- **de la**: *de la viande*
- **de l'**: *de l'eau*
- **des**: *des fruits*

## French uses articles MORE than English

- *J'aime **le** café* — I love coffee (generic — French requires *le*)
- *Il est sept heures* — It's seven o'clock

## Common mistakes

- Wrong gender: *le table* ❌ → *la table* ✅
- Dropping articles: *J'aime café* ❌ → *J'aime le café* ✅
""", related=["nouns_gender"], l1_notes={
    "en": "English drops articles for generics (*I love coffee*); French keeps them (*J'aime le café*).",
})

L("nouns_gender", "Noun gender", "A1", """
Every French noun is masculine or feminine. Fewer reliable endings than Spanish — memorize gender with the word.

## Common patterns

- **Masculine** endings: -age, -ment, -isme, -eau, -er, -on
- **Feminine** endings: -tion, -sion, -té, -ude, -ance, -ence, -ière, -elle, -ette

## Tricky pairs

- *un livre* (book, m.) — *une livre* (pound, f.)
- *le tour* (a tour) — *la tour* (tower)

## Common mistakes

- Defaulting to masculine — feminine -tion/-té words are highly predictable.
- Memorize each noun WITH its article: *la table*, not just *table*.
""", related=["articles_le_la_les"])

L("verbs_etre_avoir", "Être (to be) and avoir (to have)", "A1", """
The two most-used French verbs. Both irregular. Master first.

## être (to be)

- je **suis**, tu **es**, il/elle **est**
- nous **sommes**, vous **êtes**, ils/elles **sont**

## avoir (to have)

- j'**ai**, tu **as**, il/elle **a**
- nous **avons**, vous **avez**, ils/elles **ont**

## Critical: avoir for age, hunger, fear, cold

French uses *avoir* where English uses *be*:
- *J'**ai** 25 ans* — I am 25 (lit. I have 25 years)
- *J'**ai** faim* — I'm hungry
- *J'**ai** soif* — I'm thirsty
- *J'**ai** froid* — I'm cold
- *J'**ai** peur* — I'm scared

## Common mistakes

- *Je suis 25 ans* ❌ → *J'ai 25 ans* ✅
- *Je suis faim* ❌ → *J'ai faim* ✅
""", related=["present_tense"], l1_notes={
    "en": "Don't translate English *be* directly — French uses *avoir* (have) with age/hunger/cold/fear, like Spanish *tener*.",
})

L("present_tense", "The present tense (présent)", "A1", """
Three regular verb groups: -er, -ir, -re.

## -er verbs (~80% of verbs)

**parler**: je parl**e**, tu parl**es**, il parl**e**, nous parl**ons**, vous parl**ez**, ils parl**ent**

The endings -e, -es, -ent are silent — *parle*, *parles*, *parlent* sound identical.

## -ir verbs

**finir**: je fin**is**, tu fin**is**, il fin**it**, nous fin**issons**, vous fin**issez**, ils fin**issent**

## -re verbs

**vendre**: je ven**ds**, tu ven**ds**, il ven**d**, nous vend**ons**, vous vend**ez**, ils vend**ent**

## Stem changes (-er)

- *acheter* → *j'achète*
- *préférer* → *je préfère*
- *manger* → *nous mange**ons*** (-ge before -o)

## Common mistakes

- Pronouncing the silent endings.
- Group confusion: *je finie* ❌ → *je finis* ✅.
""", related=["verbs_etre_avoir", "past_tense"])

L("past_tense", "Past tenses: passé composé and imparfait", "A2", """
French has two main past tenses used together.

## Passé composé — completed action

**avoir/être (present) + past participle**:
- *J'ai mangé* — I ate / I have eaten

Most verbs use *avoir*. ~15 verbs use *être* (motion verbs): aller, venir, partir, arriver, entrer, sortir, monter, descendre, naître, mourir, rester, retourner + reflexives.

With *être*, the past participle agrees with subject:
- *Elle est parti**e***
- *Ils sont parti**s***

## Imparfait — ongoing / habitual

Stem (from nous form, minus -ons) + -ais, -ais, -ait, -ions, -iez, -aient.

Uses:
- Habits: *Je jouais au foot*
- Descriptions: *Il faisait beau*
- Actions in progress: *Je lisais quand il est arrivé*

## Choosing between them

- Specific completed → passé composé
- Background, habit → imparfait
- Often together: imparfait sets the scene, passé composé delivers the event.

## Common mistakes

- Wrong auxiliary: *J'ai allé* ❌ → *Je suis allé* ✅
- Forgetting agreement: *Elle est arrivé* ❌ → *Elle est arrivée* ✅
""", related=["present_tense"], l1_notes={
    "es": "Passé composé ≈ pretérito perfecto compuesto; imparfait ≈ imperfecto. Pero el passé composé también cubre el pretérito simple español (*comí ayer* = *j'ai mangé hier*).",
})

L("future_tense", "Future: futur simple and futur proche", "A2", """
Two futures, like English *will* vs *going to*.

## Futur proche — near future

**aller (present) + infinitive**:
- *Je vais manger* — I'm going to eat
- *Nous allons partir*

## Futur simple

Stem (infinitive for -er/-ir; -re drops final -e) + -ai, -as, -a, -ons, -ez, -ont:
- *je mangerai, tu mangeras, il mangera, nous mangerons, vous mangerez, ils mangeront*

## Irregular stems

- aller → **ir**ai
- avoir → **aur**ai
- être → **ser**ai
- faire → **fer**ai
- venir → **viendr**ai
- pouvoir → **pourr**ai
- voir → **verr**ai

Endings always regular.

## After "quand" — use futur simple

Unlike English (uses present):
- *Quand je **serai** grand...* — When I am grown up...

## Common mistakes

- Using present after *quand* for future actions.
""", related=["past_tense"])

L("negation_ne_pas", "Negation: ne...pas, ne...rien, ne...jamais", "A1", """
French negation uses TWO words around the verb.

## Basic: ne + verb + pas

- *Je **ne** parle **pas** français*
- *Il **n**'aime **pas** le café* (ne → n' before vowel)

## Other negative pairs

- *ne...rien* — nothing
- *ne...jamais* — never
- *ne...personne* — nobody
- *ne...plus* — no longer / no more
- *ne...pas encore* — not yet
- *ne...que* — only

## In compound tenses (passé composé)

Both parts surround the auxiliary:
- *Je **n'**ai **pas** mangé*
- *Elle **n'**est **jamais** venue*

## With infinitives

Both parts BEFORE the infinitive:
- *J'essaye de **ne pas** fumer*

## Spoken French often drops *ne*

In casual speech: *Je sais pas*, *J'ai pas faim*. Don't drop it in writing.

## Common mistakes

- Forgetting *ne* in writing.
- Multiple negatives stack: *ne...jamais personne* = "never anyone".
""", related=["present_tense"])

L("questions", "Asking questions", "A1", """
Three ways to form a question, ranked by formality.

## 1. Intonation (casual)

Raise voice at end:
- *Tu parles français?*

## 2. Est-ce que (everyday)

- *Est-ce que tu parles français?*
- *Est-ce qu'il vient?* (que → qu' before vowel)

## 3. Inversion (formal)

Flip subject + verb:
- *Parlez-vous français?*
- *Y a-t-il du pain?* (-t- inserted for pronunciation)

## Question words

- qui (who), que / qu'est-ce que (what), où (where), quand (when), pourquoi (why), comment (how), combien (how much/many), quel/quelle (which — agrees with noun)

Examples:
- *Où habites-tu?* / *Tu habites où?* / *Où est-ce que tu habites?*
- *Quelle heure est-il?* — What time is it?

## Common mistakes

- Missing hyphen in inversion: *parlez vous* ❌ → *parlez-vous* ✅
- Wrong word order with *est-ce que*: keep subject-verb.
""", related=["word_order"])

L("verbs_reflexive", "Reflexive verbs", "A2", """
Reflexive verbs describe actions done to oneself.

## Form

**Reflexive pronoun + verb**:
- je **me** lave
- tu **te** laves
- il/elle **se** lave
- nous **nous** lavons
- vous **vous** lavez
- ils/elles **se** lavent

Before vowel: m', t', s' (*Je m'appelle*).

## Common reflexive verbs

*se lever, se coucher, se laver, se brosser, s'habiller, se reposer, se sentir, se souvenir, s'appeler, s'amuser, se réveiller*.

## In passé composé — use être + agreement

- *Je me suis levé(e)*
- *Elle s'est lavée*
- *Nous nous sommes amusés*

## Reflexive ≠ "myself"

Many "reflexives" don't mean doing something to yourself:
- *se réveiller* — wake up
- *se passer* — happen

## Common mistakes

- Forgetting reflexive pronoun: *je lave* ❌ → *je me lave* ✅
""", related=["past_tense"])

L("politeness_tu_vous", "Tu vs vous", "A1", """
French has two "you" words; choosing matters socially.

## tu — informal singular

Family, friends, peers, children, pets.

## vous — formal singular OR plural

- Strangers, especially older / in authority
- Professional contacts
- ANY group (always *vous* for 2+ people)

## Verb forms

*tu* takes singular; *vous* takes plural — even for one person.

## When in doubt: vous

Senior person initiates switch to *tu*:
- *On peut se tutoyer?*

## Cultural notes

- Québec is more *tu*-leaning.
- Younger French speakers use *tu* more freely.
- Service workers say *vous* to customers.

## Common mistakes

- Defaulting to *tu* with anyone — can feel rude.
- *Vous* with friends — feels distant.
""", related=["greetings_register"])

L("greetings_register", "Greetings and politeness", "A1", """
French has strict social conventions for greetings.

## Greetings

- **Bonjour** — hello (universal; takes over after sunrise)
- **Bonsoir** — good evening (after ~6 PM)
- **Salut** — hi / bye (informal only)
- **Bonne nuit** — goodnight (going to bed only)

## How are you?

- **Ça va?** — casual
- **Comment allez-vous?** — formal
- *Ça va, merci.* / *Pas mal.* / *Très bien.*

## Goodbye

- **Au revoir** — goodbye
- **À bientôt** — see you soon
- **À demain** — see you tomorrow
- **Bonne journée!** / **Bonne soirée!** — standard parting

## Politeness

- **S'il vous plaît** / **S'il te plaît** — please
- **Merci** — thank you
- **De rien** / **Je vous en prie** — you're welcome
- **Excusez-moi** / **Pardon** — excuse me

## Cultural rules

- Always greet shopkeepers, cashiers, neighbors with *Bonjour* — skipping is rude.
- *Bonne nuit* is ONLY for going to bed.
- Use *Salut* only with peers.

## Common mistakes

- Asking a question without first saying *Bonjour* — feels abrupt.
""", related=["politeness_tu_vous"])

L("liaison", "Liaison: linking pronunciation", "A2", """
**Liaison**: a normally-silent final consonant becomes pronounced before a vowel.

## Required liaisons

- *les enfants* → /lez‿ɑ̃fɑ̃/
- *vous avez* → /vuz‿ave/
- *un homme* → /œ̃n‿ɔm/

## Where required

- After plural articles: *les amis, des enfants*
- After possessives: *mon ami, vos enfants*
- After pronouns: *nous avons, ils ont*
- After short prepositions: *en avion*
- After preposed adjectives: *grand homme*

## Where forbidden

- After singular noun: *un étudiant intelligent* — no link.
- After *et*: *un homme et un femme* — no link.
- Before aspirated h: *les héros* — /le ero/.

## Pronunciation in liaison

- *s/x* → /z/: *les enfants* → /lez/
- *d* → /t/: *un grand homme* → /ɡʁɑ̃t/
- *f* → /v/: *neuf ans* → /nœv/

## Common mistakes

- Liaising before aspirated h: *les héros* should NOT link.
- Missing liaisons sound choppy.
""", related=["alphabet"])

