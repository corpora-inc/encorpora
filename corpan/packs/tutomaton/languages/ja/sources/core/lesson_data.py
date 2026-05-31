"""Lessons for Japanese — first draft, 8 lessons."""

LESSONS = []


def L(topic, title, level, body, related=None, l1_notes=None):
    LESSONS.append({
        "topic": topic, "title": title, "level": level,
        "body": body.strip(), "related": related or [], "l1_notes": l1_notes or {},
    })


L("writing_systems", "Three writing systems: hiragana, katakana, kanji", "A1", """
Japanese uses three scripts simultaneously in normal text.

## Hiragana (ひらがな)

46 basic characters representing syllables. Used for:
- Native Japanese words without kanji
- Grammar particles and verb endings
- Words a writer doesn't want to write in kanji

Examples: の (no), が (ga), た (ta), で (de), す (su)

## Katakana (カタカナ)

46 characters — same sounds as hiragana, different shapes. Used for:
- Foreign loanwords: コーヒー (kōhī = coffee), パン (pan = bread)
- Foreign names: ジョン (Jon), マリア (Maria)
- Onomatopoeia, emphasis

## Kanji (漢字)

Chinese characters adopted by Japanese. ~2,136 jōyō (common-use) kanji. Each has multiple readings:
- **Onyomi** (音読み): Chinese-derived reading, used in compounds — 学校 (gakkō, school)
- **Kunyomi** (訓読み): Native Japanese reading — 学ぶ (manabu, to learn)

## Mixed in real text

A sentence mixes all three:
- 私はコーヒーが好きです。 (watashi wa kōhī ga suki desu) — I like coffee.
  - 私 (kanji) は (hiragana) コーヒー (katakana) が (hiragana) 好き (kanji + hiragana) です (hiragana)

## Common mistakes

- Confusing hiragana and katakana — they look similar but distinct.
- Trying to skip kanji entirely — you'll plateau without them.
""", related=["alphabet"])

L("particles_basic", "Basic particles: は, が, を, に, で, と", "A1", """
Japanese marks grammatical roles with particles AFTER nouns.

## は (wa) — topic marker

Spelled ha, pronounced wa as a particle. Marks the topic of the sentence:
- *私 **は** 学生 です。* (Watashi wa gakusei desu.) — I am a student.

## が (ga) — subject marker

Marks the grammatical subject (often new information or focus):
- *誰 **が** 来ました **か**?* (Dare ga kimashita ka?) — Who came?
- *猫 **が** います。* (Neko ga imasu.) — There's a cat.

## を (o) — direct object marker

Spelled wo, pronounced o. Marks what the verb acts on:
- *本 **を** 読みます。* (Hon o yomimasu.) — I read a book.

## に (ni) — destination, time, indirect object

- *学校 **に** 行きます。* (Gakkō ni ikimasu.) — I go to school.
- *7時 **に** 起きます。* — I wake up at 7.
- *友達 **に** 電話します。* — I call a friend.

## で (de) — location of action, by means of

- *レストラン **で** 食べます。* (Resutoran de tabemasu.) — I eat AT a restaurant.
- *バス **で** 行きます。* (Basu de ikimasu.) — I go BY bus.

## と (to) — and, with

- *友達 **と** 行きます。* — I go WITH a friend.
- *りんご **と** バナナ* — apples AND bananas

## Common mistakes

- は vs が — both can mark subjects; は = topic (already known), が = focus (new info).
- に vs で — に = destination/time, で = location where action happens.
""", related=["word_order_sov"])

L("word_order_sov", "Word order: SOV", "A1", """
Japanese is **Subject-Object-Verb** — the verb comes LAST.

## Basic pattern

- *私 は 本 を 読みます。* (Watashi wa hon o yomimasu.) — I read a book.
- (I [topic] book [obj] read.)

## Time often goes first

- *昨日 私 は 寿司 を 食べました。* — Yesterday I ate sushi.

## Modifiers BEFORE the noun

- *赤い 車* (akai kuruma) — a red car (adjective before noun)
- *私 が 買った 本* (watashi ga katta hon) — the book that I bought (clause before noun)

## Particles allow flexibility

Because particles mark roles, you can rearrange:
- *私 は 寿司 を 食べました。* OR *寿司 は 私 が 食べました。* (slightly different emphasis)

But the verb ALWAYS comes last in a clause.

## Subject often dropped

If clear from context, the subject is omitted:
- *寿司 が 好き です。* — (I) like sushi. (no 私 は needed)
- *日本 へ 行きました。* — (I) went to Japan.

## Common mistakes

- English-order: *I read book* in Japanese order is *私 は 本 を 読みます*, not *私 読みます 本*.
- Putting the verb in the middle — it must be last.
""", related=["particles_basic"])

L("verbs_present", "Present tense / non-past verbs", "A1", """
Japanese verbs have two main forms: non-past (= present/future) and past.

## The two verb groups

**Group 1 (godan, -u verbs)** — most verbs end in u-sound (う, く, す, つ, ぬ, ぶ, む, る):
- 飲む (nomu, drink), 書く (kaku, write), 行く (iku, go)

**Group 2 (ichidan, -ru verbs)** — end in -iru or -eru:
- 食べる (taberu, eat), 見る (miru, see), 寝る (neru, sleep)

**Irregulars**: する (suru, do), 来る (kuru, come)

## Polite form (-ます)

Replace dictionary form with -masu (-ます):
- 飲む → 飲みます (nomimasu)
- 食べる → 食べます (tabemasu)
- 行く → 行きます (ikimasu)
- する → します (shimasu)
- 来る → 来ます (kimasu)

## Negative

- Polite: -ません: 飲みません (don't drink), 食べません, 行きません.
- Plain: -ない: 飲まない, 食べない, 行かない.

## Past

- Polite past: -ました: 飲みました (drank), 食べました.
- Polite past negative: -ませんでした: 飲みませんでした (didn't drink).

## Examples

- *コーヒー を 飲みます。* — I drink coffee. / I'll drink coffee.
- *寿司 を 食べません。* — I don't eat sushi.
- *日本 へ 行きました。* — I went to Japan.
- *学校 に 来ませんでした。* — I didn't come to school.

## Common mistakes

- Conjugating -ru verbs as -u verbs: *食べりません* ❌ → *食べません* ✅.
- Forgetting tense covers both present and future.
""", related=["particles_basic"])

L("politeness_keigo", "Politeness: plain, polite, honorific", "A2", """
Japanese has multiple politeness levels. Choosing correctly is essential.

## Three main levels

**1. Plain (普通形 futsūkei)** — friends, family, internal thoughts:
- 食べる (taberu) — eat
- 行く (iku) — go

**2. Polite (丁寧語 teineigo)** — strangers, work, classroom default:
- 食べます (tabemasu)
- 行きます (ikimasu)
- です・ます forms.

**3. Honorific/Humble (敬語 keigo)** — customers, very senior people, formal business:
- いらっしゃる (irassharu) for 行く/来る/いる (go/come/be) — used about someone respected
- まいる (mairu) — humble "go/come" — used about oneself or in-group

## Honorific verb examples

| Plain | Polite | Honorific (about other) | Humble (about self) |
|---|---|---|---|
| する | します | なさる | いたす |
| 食べる | 食べます | 召し上がる | いただく |
| 行く・来る・いる | 行きます | いらっしゃる | まいる・おる |
| 言う | 言います | おっしゃる | 申す・申し上げる |

## When to use each

- Friends, peers, close family → **plain**
- Default for most everyday interaction → **polite**
- Service / customer-facing / very formal → **keigo**
- Business with senior people / important guests → **keigo**

## Cultural note

Japanese society is hierarchical — keigo is constantly negotiated based on age, position, relationship. Foreigners are usually given a pass for using polite form everywhere; using keigo correctly is a sign of advanced fluency.

## Common mistakes

- Using plain form with strangers — sounds rude.
- Using keigo with friends — sounds distant or odd.
""", related=["verbs_present", "greetings_register"])

L("counters", "Counters: 個, 本, 人, 枚, 杯, 匹", "A2", """
Like Mandarin, Japanese requires a counter word between a number and a noun.

## Common counters

| Counter | Used for |
|---|---|
| 個 (こ, ko) | small round things (general default) |
| 本 (ほん, hon) | long thin things (pens, bottles, trees) |
| 人 (にん, nin) | people (with irregular: 一人 hitori, 二人 futari) |
| 枚 (まい, mai) | flat thin things (paper, plates, shirts) |
| 杯 (はい, hai) | cups, glasses of liquid |
| 匹 (ひき, hiki) | small animals (cats, dogs, fish) |
| 頭 (とう, tō) | large animals (cows, horses) |
| 冊 (さつ, satsu) | books, magazines |
| 台 (だい, dai) | machines (cars, computers, TVs) |
| 着 (ちゃく, chaku) | clothing items |

## Pattern

**Number + counter + (の) + noun** OR **noun + を + number + counter + verb**:
- *本 を 三冊 買いました。* — I bought three books.
- *りんご を 二つ ください。* — Two apples, please.

## Numbers + counter changes

Many counters cause sound changes:
- 一本 (ippon), 二本 (nihon), 三本 (sanbon), 四本 (yonhon), 六本 (roppon), 八本 (happon)
- 一個 (ikko), 三個 (sanko), 六個 (rokko)

## Fallback: つ (tsu) for general counting

For ambiguous things, use the native Japanese counter つ (1-10):
- 一つ (hitotsu), 二つ (futatsu), 三つ (mittsu), 四つ (yottsu)...

## Common mistakes

- Skipping the counter: *本 三* ❌ → *本 三冊* ✅.
- Wrong counter for the object: *人 二本* ❌ (a person isn't long+thin) → *二人* ✅.
""", related=["numbers"])

L("verbs_te_form", "The て form (te-form)", "A2", """
The て form is essential — it connects clauses, makes requests, forms the continuous tense.

## How to make te-form

**Group 1 (-u verbs)** — depends on the final sound:
- -う/つ/る → -って: 買う → 買って, 待つ → 待って, 取る → 取って
- -ぬ/ぶ/む → -んで: 死ぬ → 死んで, 遊ぶ → 遊んで, 飲む → 飲んで
- -く → -いて: 書く → 書いて (exception: 行く → 行って)
- -ぐ → -いで: 泳ぐ → 泳いで
- -す → -して: 話す → 話して

**Group 2 (-ru verbs)** — replace る with て:
- 食べる → 食べて
- 見る → 見て

**Irregulars**:
- する → して
- 来る → 来て

## Common uses

**1. Connecting actions** (sequential):
- *朝 起きて、ご飯を 食べて、学校に行きます。* — I wake up, eat breakfast, and go to school.

**2. Requests (-てください)**:
- *待って ください。* (matte kudasai) — Please wait.
- *本を 開いて ください。* — Please open the book.

**3. Continuous (-ている)**:
- *食べて います。* (tabete imasu) — I am eating.
- *住んで います。* (sunde imasu) — I am living / I live.

**4. Permission (-てもいいです)**:
- *ここで 食べても いいですか?* — May I eat here?

**5. Prohibition (-てはいけません)**:
- *ここで 走って はいけません。* — You must not run here.

## Common mistakes

- Wrong te-form ending for the verb group.
- Forgetting the exception: 行く → 行って (not *行いて*).
""", related=["verbs_present"])

L("greetings_register", "Greetings and politeness", "A1", """
Japanese greetings vary by time of day and politeness level.

## Basic greetings

- **おはよう** (ohayō) — morning, casual
- **おはよう ございます** (ohayō gozaimasu) — morning, polite
- **こんにちは** (konnichiwa) — afternoon greeting (universal "hello")
- **こんばんは** (konbanwa) — good evening
- **おやすみなさい** (oyasuminasai) — goodnight (bedtime)

## Goodbyes

- **じゃあね / じゃあ** (jā ne / jā) — bye (casual)
- **さようなら** (sayōnara) — goodbye (a bit formal/final)
- **また 明日** (mata ashita) — see you tomorrow
- **また 来週** (mata raishū) — see you next week
- **失礼します** (shitsurei shimasu) — excuse me / leaving (very polite, e.g. leaving work)

## Politeness staples

- **すみません** (sumimasen) — sorry / excuse me (very versatile)
- **ありがとう ございます** (arigatō gozaimasu) — thank you (polite)
- **ありがとう** (arigatō) — thanks (casual)
- **どう いたしまして** (dō itashimashite) — you're welcome
- **お願い します** (onegai shimasu) — please / I request

## Asking how someone is

Not as fixed as Western "how are you":
- **お元気 ですか?** (o-genki desu ka?) — Are you well?
- Response: **はい、元気です。** — Yes, I'm well.

## Cultural notes

- Bowing accompanies most greetings (depth = formality).
- **おつかれさま** (otsukaresama) — "you must be tired" — said to coworkers when they leave or finish.
- **いただきます** before eating, **ごちそうさま** after — ritual food-thanks.
- Names: use last name + さん (-san). *Yamada-san*, not *Yamada* alone.

## Common mistakes

- Using *こんばんは* before evening.
- Calling people by first name with new acquaintances — too familiar.
""", related=["politeness_keigo"])
