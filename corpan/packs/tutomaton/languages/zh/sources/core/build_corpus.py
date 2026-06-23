"""Build mandarin.sqlite3 for the Mandarin tutor pack.

This is the initial Mandarin corpus — proves the architecture handles a
non-IE, non-gendered, tonal language. Schema differs from Spanish in
load-bearing ways:

  - `words`: hanzi (simplified + traditional) + pinyin + tones + translation
  - `classifiers`: measure words (量词) — central to Mandarin grammar
  - `aspect_markers`: 了 / 过 / 着 — what Mandarin has instead of inflection
  - `lessons`: same shape as Spanish
  - `themes`: hanzi + pinyin + english (no gender, no article)

To rebuild:
  python tools/build_corpus.py

Output: data/mandarin.sqlite3 (~5–10 MB for initial corpus; will grow).
"""
from __future__ import annotations
import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "mandarin.sqlite3"

SCHEMA = """
DROP TABLE IF EXISTS words;
CREATE TABLE words (
  hanzi_simp     TEXT NOT NULL,
  hanzi_trad     TEXT,
  pinyin         TEXT NOT NULL,
  tone_marks     TEXT,         -- e.g. "1-3" for tones of multi-syllable word
  pos            TEXT,         -- noun, verb, adjective, classifier, particle, etc.
  translation_en TEXT,
  example_zh     TEXT,
  example_pinyin TEXT,
  example_en     TEXT,
  hsk_level      INTEGER,      -- 1-6 if known
  PRIMARY KEY (hanzi_simp, pinyin)
);
CREATE INDEX words_simp ON words(hanzi_simp);
CREATE INDEX words_translation ON words(translation_en);

DROP TABLE IF EXISTS classifiers;
CREATE TABLE classifiers (
  classifier     TEXT PRIMARY KEY,    -- e.g. 个, 本, 张, 只
  pinyin         TEXT,
  used_for       TEXT,                -- description: "general objects", "flat things", etc.
  examples_zh    TEXT,                -- comma-separated examples
  examples_en    TEXT
);

DROP TABLE IF EXISTS aspect_markers;
CREATE TABLE aspect_markers (
  marker         TEXT PRIMARY KEY,    -- 了, 过, 着, 在 ... 呢, 着 etc.
  pinyin         TEXT,
  aspect         TEXT,                -- "completed", "experienced", "ongoing-state", etc.
  position       TEXT,                -- where in the sentence it goes
  notes          TEXT
);

DROP TABLE IF EXISTS lessons;
CREATE TABLE lessons (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  topic          TEXT UNIQUE NOT NULL,
  title          TEXT NOT NULL,
  hsk_level      TEXT,                -- HSK 1, 2, 3...
  body_markdown  TEXT NOT NULL,
  related_topics TEXT
);
CREATE VIRTUAL TABLE lessons_fts USING fts5(topic, title, body_markdown, content='lessons', content_rowid='id');

DROP TABLE IF EXISTS vocabulary_themes;
CREATE TABLE vocabulary_themes (
  theme          TEXT NOT NULL,
  position       INTEGER NOT NULL,
  hanzi          TEXT NOT NULL,
  pinyin         TEXT NOT NULL,
  english        TEXT NOT NULL,
  classifier     TEXT,                -- preferred measure word for this noun (NULL if N/A)
  PRIMARY KEY (theme, position)
);
CREATE INDEX themes_theme ON vocabulary_themes(theme);
"""

# ============================================================
# LESSONS — initial set (10)
# ============================================================

LESSONS = []
def L(topic, title, hsk, body, related=None):
    LESSONS.append({"topic": topic, "title": title, "hsk": hsk, "body": body.strip(), "related": related or []})

L("tones", "声调 (the four tones)", "HSK1", """
# 声调 (the four tones)

Mandarin is tonal. The same syllable in different tones is a different word entirely.

The four tones (using *ma* as example):

| Tone | Pinyin | Description | Example |
|---|---|---|---|
| 1st (high level) | mā 妈 | high and flat | 妈 mā (mother) |
| 2nd (rising) | má 麻 | rising from mid to high | 麻 má (hemp / numb) |
| 3rd (falling-rising) | mǎ 马 | dips low then rises | 马 mǎ (horse) |
| 4th (falling) | mà 骂 | sharp fall from high to low | 骂 mà (to scold) |
| Neutral (no tone) | ma 吗 | light, unstressed | 吗 ma (question particle) |

Tones change meaning. *Mā mà mǎ* (妈骂马) = "mother scolds horse". Not interchangeable.

## Tone sandhi (changes in connected speech)

- **3rd + 3rd → 2nd + 3rd**: *nǐ hǎo* (你好) is pronounced *ní hǎo*.
- **Half-third tone**: a 3rd-tone syllable before any other tone just dips (no rise).
- **不 (bù)**: changes to *bú* before another 4th tone. *bù shì* → *bú shì* (不是).
- **一 (yī)**: changes to *yí* before 4th tone (*yí gè* 一个), *yì* before other tones (*yì běn* 一本).

## Practice tip

Listen to entire words rather than syllables. Tones live in the contour, not the pitch.
""", related=["pinyin_basics"])

L("word_order", "Basic word order (subject-verb-object)", "HSK1", """
# Basic word order

Mandarin is largely SVO: Subject - Verb - Object.

- 我 喜欢 你 — *wǒ xǐhuān nǐ* — I like you.
- 他 喝 茶 — *tā hē chá* — He drinks tea.
- 我们 学 中文 — *wǒmen xué Zhōngwén* — We study Chinese.

## Time and place go BEFORE the verb

Unlike English, Mandarin places time and location expressions before the verb:

- 我 明天 去 北京 — *wǒ míngtiān qù Běijīng* — I'll go to Beijing tomorrow. (literally: I tomorrow go Beijing)
- 他 在 家 吃饭 — *tā zài jiā chīfàn* — He eats at home.

## Topic-comment structure

Mandarin often fronts the topic, then comments on it:

- 这本书 我 看过 — *zhè běn shū wǒ kànguo* — This book, I've read.
- 中国菜 我 很 喜欢 — *Zhōngguó cài wǒ hěn xǐhuān* — Chinese food, I like very much.

This is extremely common; it's not exotic.

## Common mistakes

- Putting time after the verb (English habit): *我去北京明天* ❌ → *我明天去北京* ✅.
- Forgetting that 在 (zài) "at/in" goes before the verb: *他吃饭在家* ❌ → *他在家吃饭* ✅.
""", related=["ba_construction", "negation_bu_mei"])

L("classifiers", "量词 (measure words / classifiers)", "HSK1", """
# 量词 (measure words / classifiers)

In Mandarin, when you count a noun or point at it ("this/that"), you usually need a classifier between the number/demonstrative and the noun. English has these for some words (*a sheet of paper*, *two head of cattle*) but Mandarin uses them for almost everything.

Pattern: **number + classifier + noun**.

- 一 **个** 人 — *yī gè rén* — one person
- 三 **本** 书 — *sān běn shū* — three books
- 两 **杯** 茶 — *liǎng bēi chá* — two cups of tea (note: 两 not 二 before classifiers)

## The most common classifiers

| Classifier | Pinyin | Used for | Example |
|---|---|---|---|
| 个 | gè | general / default | 一个人, 一个问题 |
| 本 | běn | bound items (books) | 一本书, 一本杂志 |
| 张 | zhāng | flat things | 一张纸, 一张桌子, 一张照片 |
| 只 | zhī | small animals, single of a pair | 一只猫, 一只手 |
| 条 | tiáo | long thin things | 一条鱼, 一条裤子, 一条河 |
| 件 | jiàn | clothing tops, matters | 一件衣服, 一件事 |
| 把 | bǎ | things with handles | 一把伞, 一把椅子 |
| 杯 | bēi | cups / glasses (of liquid) | 一杯水, 一杯咖啡 |
| 瓶 | píng | bottles | 一瓶酒, 一瓶水 |
| 碗 | wǎn | bowls (of food/soup) | 一碗饭, 一碗汤 |
| 辆 | liàng | vehicles | 一辆车, 一辆自行车 |
| 家 | jiā | businesses, families | 一家公司, 一家餐厅 |

If you don't know the specific classifier, **个 (gè)** is the universal default. You won't sound elegant but you'll be understood.

## Demonstratives also take classifiers

- 这 **个** 人 — *zhè ge rén* — this person
- 那 **本** 书 — *nà běn shū* — that book

## 二 vs 两

Before a classifier, use **两 (liǎng)** instead of 二 (èr):
- *两本书* ✅ (NOT *二本书*)
- *两个人* ✅

When counting in sequence (1, 2, 3...), use 二: *一, 二, 三*. For dates and ordinals, also 二: *二月 èryuè* (February), *第二 dì èr* (second).
""", related=["word_order"])

L("aspect_le", "了 (le): the completion / change marker", "HSK1", """
# 了 (le): the completion / change marker

Mandarin verbs don't conjugate for tense. Instead, aspect markers like 了 (le) attach to indicate completion or change of state.

There are two uses of 了:

## 1. Verb-了: completed action

Goes immediately after the verb to mark that the action is completed:

- 我 吃 **了** 饭 — *wǒ chī le fàn* — I ate. (I have eaten.)
- 他 来 **了** — *tā lái le* — He came / he's arrived.
- 我们 看 **了** 一个电影 — *wǒmen kàn le yī ge diànyǐng* — We watched a movie.

Be careful: this is **not** a "past tense" marker. It signals *completion of an action*. Future actions can also be marked if they're expected to complete:

- 我吃了饭就走 — *wǒ chī le fàn jiù zǒu* — I'll leave after I've eaten.

## 2. Sentence-final 了: change of state / new situation

Goes at the end of the sentence to mark a new state or development:

- 下雨 **了** — *xià yǔ le* — It's started to rain. (Now it's raining; before it wasn't.)
- 我 累 **了** — *wǒ lèi le* — I'm tired (now). (Implication: I wasn't before.)
- 他 二十岁 **了** — *tā èrshí suì le* — He's turned 20. / He's 20 now.

## Both at once is possible (and common)

- 我 吃 **了** 三 碗 饭 **了** — *wǒ chī le sān wǎn fàn le* — I've eaten three bowls of rice (so far / by now).

## Common mistakes

- Treating 了 as a past tense marker. It's NOT. *我昨天看书* (I read books yesterday — habit, no completion) is correct without 了.
- Adding 了 to negative sentences: *我没吃了饭* ❌ → *我没吃饭* ✅. Negation 没 (méi) already implies non-completion; 了 is redundant.
- Using 了 with state verbs like 是 (to be), 有 (to have), 喜欢 (to like): rarely. *他喜欢了你* is awkward; *他喜欢你* or *他爱上你了* (developed feelings, new state) is more natural.
""", related=["aspect_guo", "aspect_zhe", "negation_bu_mei"])

L("aspect_guo", "过 (guo): the experiential marker", "HSK2", """
# 过 (guo): the experiential marker

The aspect marker 过 (guo) goes after a verb to indicate that the speaker has *experienced* the action at some point in their life.

Structure: **verb + 过**.

- 我 去 **过** 中国 — *wǒ qù guo Zhōngguó* — I've been to China (at some point).
- 你 吃 **过** 北京烤鸭 吗? — *nǐ chī guo Běijīng kǎoyā ma?* — Have you ever eaten Peking duck?
- 他 学 **过** 法语 — *tā xué guo Fǎyǔ* — He has studied French (at some point).

## Difference from 了

- 我吃了北京烤鸭 — *I ate Peking duck* (specific occasion, completed).
- 我吃过北京烤鸭 — *I have eaten Peking duck (at some point in my life)*.

If you want to express "I have eaten it three times in my life", combine: *我吃过三次北京烤鸭*.

## Negation: 没 + verb + 过

- 我 **没** 去 **过** 中国 — I've never been to China.
- 他 **没** 学 **过** 法语 — He's never studied French.

NOT 不去过 (you can't use 不 with 过 — only 没).

## Questions

- 你 去 **过** 中国 吗? — Have you been to China?
- 你 有 **没** 有 去 **过** 中国? — Have you been to China or not? (more colloquial)

## Common mistakes

- Confusing 过 with 了. They overlap in English ("ate" vs "have eaten") but in Mandarin they're distinct.
- Using 不过: *我不去过* ❌ → *我没去过* ✅.
""", related=["aspect_le", "negation_bu_mei"])

L("ba_construction", "把 (bǎ): the disposal / object-fronting construction", "HSK3", """
# 把 (bǎ): the disposal / object-fronting construction

The 把 construction puts the object before the verb, emphasizing what *happens to* the object. It signals that the object is being *handled, moved, or changed* in some specific way.

Structure: **Subject + 把 + Object + Verb + Result/Complement**

- 我 **把** 书 看 完 了 — *wǒ bǎ shū kàn wán le* — I finished reading the book. (Literally: I 把 book read finish 了.)
- 他 **把** 杯子 打 碎 了 — *tā bǎ bēizi dǎ suì le* — He broke the cup.
- 请 **把** 门 关 上 — *qǐng bǎ mén guān shàng* — Please close the door.

## Why use 把 instead of SVO

- *我看完了书* — I finished reading the book. (Fine.)
- *我把书看完了* — I finished the book. (Stronger emphasis that the book was the thing I finished, suggests disposal/completion.)

The 把 construction is required (or strongly preferred) when:
- There's a clear result or change to the object
- The verb has a complement (了, 完, 在, 给, etc.) showing what happened to the object
- The object is definite (the X, that X, not a general "an X")

## What CAN'T go after 把

- Cognitive / perception verbs: 看见 (see), 听见 (hear), 知道 (know) — they don't change the object.
- Verbs of motion without a destination: *我把走了* ❌.
- Bare verbs without a complement: *我把书看* ❌ → must have a result: *我把书看完了* ✅.

## Common mistakes

- Forgetting the complement: *我把饭吃* ❌ → *我把饭吃完了* ✅.
- Using 把 with cognitive verbs: *我把这件事知道了* ❌ → *我知道这件事了* ✅.
- Wrong object position: 把 must come BEFORE the object. *我看完了把书* ❌.
""", related=["bei_construction", "word_order"])

L("bei_construction", "被 (bèi): the passive construction", "HSK3", """
# 被 (bèi): the passive construction

被 (bèi) marks a passive sentence — the subject is the one who *receives* the action.

Structure: **Subject + 被 + Agent + Verb + Result**

- 杯子 **被** 他 打 碎 了 — *bēizi bèi tā dǎ suì le* — The cup was broken by him.
- 我 **被** 老板 骂 了 — *wǒ bèi lǎobǎn mà le* — I got scolded by the boss.
- 钱包 **被** 偷 了 — *qiánbāo bèi tōu le* — The wallet was stolen. (Agent unspecified — also common.)

## The agent can be omitted

If the agent is unknown, irrelevant, or obvious, just skip it:

- 我 **被** 选上 了 — I was chosen / selected.
- 他 **被** 骗 了 — He was deceived.

## 被 vs 把

These are mirror images:

- 我 **把** 杯子 打 碎 了 — I broke the cup. (Agent-focused.)
- 杯子 **被** 我 打 碎 了 — The cup was broken by me. (Object-focused.)

## Negative connotation (often, but not always)

Historically, 被 carried a sense of *suffering* the action. Modern usage is broader but it still leans toward negative or unfortunate outcomes:

- 被打 (be hit), 被骂 (be scolded), 被偷 (be stolen), 被骗 (be deceived) — all natural.
- 被表扬 (be praised), 被选上 (be selected) — also fine, more neutral.

For more neutral passives, alternatives:
- *叫 (jiào)* / *让 (ràng)* + agent + verb: *我叫他骂了* (I was scolded by him).
- Topic-comment without explicit marker: *他打了我* (He hit me) → *我被他打了* OR *他打我了*.

## Common mistakes

- Adding 把 after 被: *我被他把打了* ❌ → *我被他打了* ✅.
- Forgetting the complement: *杯子被他打* ❌ → *杯子被他打碎了* ✅.
""", related=["ba_construction"])

L("negation_bu_mei", "不 vs 没: which negation to use", "HSK1", """
# 不 vs 没: which negation to use

Mandarin has two main negation words. Choosing the right one is one of the biggest sources of confusion for learners.

## 不 (bù) — for present, future, habitual, and state verbs

- 我 **不** 吃 肉 — *wǒ bù chī ròu* — I don't eat meat. (habit)
- 他 **不** 来 — *tā bù lái* — He's not coming.
- 这 **不** 是 我的 — *zhè bù shì wǒ de* — This isn't mine.
- 我 **不** 想 去 — *wǒ bù xiǎng qù* — I don't want to go.

## 没 (méi) / 没有 (méi yǒu) — for completed past actions and 有

For negating completed actions (where you'd use 了 in the affirmative):

- 我 **没** 吃 — *wǒ méi chī* — I didn't eat / haven't eaten.
- 他 **没** 来 — *tā méi lái* — He didn't come / hasn't come.
- 我 **没** 看 这本书 — I haven't read this book.

For negating 有 (to have):

- 我 **没有** 钱 — *wǒ méi yǒu qián* — I don't have money. (Cannot be *我不有钱*.)
- 他 **没** 朋友 — *tā méi péngyou* — He has no friends. (有 often omitted in negation.)

## The quick rule

| Affirmative | Negative |
|---|---|
| 我吃饭 (I eat) | 我**不**吃饭 (I don't eat) |
| 我吃了饭 (I ate) | 我**没**吃饭 (I didn't eat) |
| 我有钱 (I have money) | 我**没**有钱 (I don't have money) |
| 我喜欢 (I like) | 我**不**喜欢 (I don't like) |
| 我去过 (I've been) | 我**没**去过 (I've never been) |

So: future / habit / state / desire → 不. Completed / experiential / 有 → 没.

## Common mistakes

- *我不去了* ❌ if you mean "I didn't go" — should be *我没去*.
- *我不有时间* ❌ → *我没有时间* ✅.
- *我没喜欢他* ❌ if you mean "I don't like him" — should be *我不喜欢他*.
- *我不吃过* ❌ → *我没吃过* ✅ (with 过, always 没).
""", related=["aspect_le", "aspect_guo"])

L("questions", "Asking questions: 吗, 呢, what/where/who", "HSK1", """
# Asking questions

Mandarin has clean, predictable question-formation rules.

## 吗 (ma) — yes/no questions

Add 吗 to the end of a statement to make it a yes/no question. The rest of the sentence doesn't change.

- 你 是 中国人 → 你 是 中国人 **吗**? — *nǐ shì Zhōngguórén ma?* — Are you Chinese?
- 他 来 → 他 来 **吗**? — *tā lái ma?* — Is he coming?
- 你 喜欢 茶 → 你 喜欢 茶 **吗**? — Do you like tea?

## A-not-A questions

A more colloquial way to ask yes/no:

- 你 是 不 是 中国人? — *nǐ shì bu shì Zhōngguórén?* — Are you Chinese (or not)?
- 你 喜欢 不 喜欢 茶? — Do you like tea (or not)?
- 你 来 不 来? — Are you coming (or not)?

## 呢 (ne) — follow-up "and you?" / "what about ...?"

- 我 很 好, 你 **呢**? — *wǒ hěn hǎo, nǐ ne?* — I'm well, and you?
- 我 是 学生, 他 **呢**? — I'm a student, what about him?

## Question words

These replace what would be the answer:

| Question word | Pinyin | English |
|---|---|---|
| 什么 | shénme | what |
| 哪 (+classifier) | nǎ | which |
| 哪里 / 哪儿 | nǎlǐ / nǎr | where |
| 谁 | shéi (or shuí) | who |
| 什么时候 | shénme shíhou | when |
| 为什么 | wèishénme | why |
| 怎么 | zěnme | how |
| 多少 | duōshao | how much/many (large quantities) |
| 几 | jǐ | how many (small quantities) |

## Key rule: question words stay in their natural position

Unlike English, you don't move the question word to the front. It stays where the answer would go:

- 你 吃 **什么**? — *nǐ chī shénme?* — What are you eating? (literally: you eat what?)
- 他 是 **谁**? — Who is he? (literally: he is who?)
- 你 去 **哪儿**? — Where are you going?

## Common mistakes

- Adding 吗 to a sentence with another question word: *你吃什么吗?* ❌ → *你吃什么?* ✅.
- Moving the question word: *什么你吃?* ❌ → *你吃什么?* ✅.
- Using 几 for large numbers: *你住在几楼?* asks "which (small-number) floor?" (OK for floors). *你有几个钱?* sounds like "how many small-coins?" — use 多少 for money: *你有多少钱?*
""", related=["word_order"])

L("comparison_bi", "Comparing things with 比 (bǐ)", "HSK1", """
# Comparing with 比 (bǐ)

To compare two things, Mandarin uses 比.

Structure: **A + 比 + B + adjective**

- 他 比 我 高 — *tā bǐ wǒ gāo* — He's taller than me.
- 这本书 比 那本书 有意思 — This book is more interesting than that book.
- 中国 比 美国 大 — China is bigger than the US.

**Important**: don't use 很 (very) in 比 comparisons. *他比我很高* ❌ → *他比我高* ✅.

## Specifying the difference

After the adjective, you can say by how much:

- 他 比 我 高 一 点 — *tā bǐ wǒ gāo yīdiǎn* — He's a little taller than me.
- 他 比 我 高 五厘米 — He's 5 cm taller than me.
- 他 比 我 高 得多 — He's much taller than me.

## Negation: 没有 + B + (有) + A + adjective

To say "A is NOT as X as B", flip it: use *没有*.

- 我 没有 他 高 — *wǒ méiyǒu tā gāo* — I'm not as tall as he is.
- 这本书 没有 那本书 有意思 — This book isn't as interesting as that one.

## Equivalence: A 跟 B 一样

For "A is the same as B":

- 我 跟 他 一样 高 — *wǒ gēn tā yīyàng gāo* — He and I are the same height.
- 这两本书 一样 贵 — These two books cost the same.

## Common mistakes

- Adding 很 / 非常 / 太: *他比我很高* ❌ → *他比我高* ✅.
- Putting the adjective before B: *他高比我* ❌ → *他比我高* ✅.
- Using 不 instead of 没有 for negation: *我不比他高* (literally "I'm not taller than him") is grammatical but means "I'm not MORE tall than him" — better is *我没有他高* for "I'm not as tall".
""", related=["word_order"])

L("aspect_zhe", "着 (zhe): the ongoing-state marker", "HSK2", """
# 着 (zhe): the ongoing-state marker

着 marks a state that's ongoing — not a continuing action like English *-ing*, but a static state that persists.

## Form

**Verb + 着**:
- 门 **开着**。 (mén kāi-zhe) — The door is open. (state: open)
- 他 **站着** 说话。 (tā zhàn-zhe shuō huà) — He's standing (and) talking.
- 桌上 **放着** 一本书。 (zhuō shàng fàng-zhe yì běn shū) — A book is placed on the table.

## 着 vs 在 (the two "continuous" markers)

- **在** + verb: an action in progress: *我在吃饭* — I'm eating (right now).
- Verb + **着**: a state that holds: *我穿着外套* — I'm wearing a coat (state of having coat on).

For activities, use 在. For states, use 着.

## Common verb-着 patterns

- 拿着, 带着, 穿着, 戴着 — holding, carrying, wearing
- 坐着, 站着, 躺着 — sitting, standing, lying (posture)
- 开着, 关着 — open, closed

## 着 + V2 — concurrent actions

- 他 **听着** 音乐 **看书**。 — He's reading while listening to music.
- 别 **看着** 手机 **吃饭**。 — Don't eat while looking at your phone.

## Common mistakes

- *我吃着饭* in the sense "I'm eating" — wrong, use *我在吃饭*. *吃着饭* means "while eating".
""", related=["aspect_le", "aspect_guo"])

L("chengyu_intro", "成语 (chengyu): four-character idioms", "HSK3", """
# 成语 (chengyu): four-character idioms

成语 are fixed four-character phrases from classical Chinese, used constantly in modern writing and speech to signal cultivation. Knowing 50-100 is intermediate; knowing 500+ is fluent.

## Structure

Almost always exactly 4 characters. Many compress a whole story or moral into 4 chars.

## Top everyday chengyu

- **马马虎虎** (mǎmǎhūhū) — so-so / careless. *他做事马马虎虎* — He's careless.
- **乱七八糟** (luànqībāzāo) — messy, chaotic. *房间乱七八糟* — The room's a mess.
- **一举两得** (yìjǔliǎngdé) — kill two birds with one stone. (lit. one action, two gains)
- **入乡随俗** (rùxiāngsuísú) — when in Rome do as the Romans (lit. enter village, follow customs)
- **画蛇添足** (huàshétiānzú) — overdo it (lit. draw snake, add feet)
- **百闻不如一见** (bǎiwénbùrúyíjiàn) — seeing once is worth hearing 100 times
- **众所周知** (zhòngsuǒzhōuzhī) — as everyone knows (formal)

## How to use them

- Sprinkle into writing or careful speech — sounds cultivated.
- Don't overuse — sounds pretentious.
- Memorize in context (with the situation that calls for it), not as lists.

## Common mistakes

- Using chengyu in casual chat with friends — overkill.
- Mixing chengyu characters — *乱七吧糟* ❌ → *乱七八糟* ✅. Memorize the exact 4 chars.
""", related=["common_idioms"])

L("directional_complements", "Directional complements: V + 来/去/上/下/进/出", "HSK3", """
# Directional complements

Adding 来 (come, toward speaker) or 去 (go, away from speaker) — and 上/下/进/出/回/过 (up/down/in/out/back/across) — after a verb specifies direction.

## Form

**Verb + direction**:
- 走 **进来** (zǒu jìnlái) — walk in (toward me)
- 走 **进去** (zǒu jìnqù) — walk in (away from me)
- 跑 **出来** — run out (toward me)
- 拿 **上去** — take up (away)
- 带 **回来** — bring back (toward)

## Direction logic

| Direction | Toward speaker | Away from speaker |
|---|---|---|
| up | 上来 | 上去 |
| down | 下来 | 下去 |
| in | 进来 | 进去 |
| out | 出来 | 出去 |
| back | 回来 | 回去 |
| across/over | 过来 | 过去 |

## With an object

The object usually goes between the verb and the direction:
- 把 书 拿 **过来** — Bring the book over.
- 我 带 一个 朋友 **来** 了。 — I brought a friend over.

## Extended (figurative) meanings

- **听不出来** — can't tell (by listening)
- **想出来** — figure out (lit. think-out)
- **吃下去** — eat it down (sometimes implying it's hard to swallow)
- **看下去** — keep watching/reading

## Common mistakes

- Wrong direction (来 vs 去): tied to speaker's location. If the listener is the destination, use 去.
- Forgetting that 出来 / 进去 etc. are tightly bound: *走来进去* ❌ → *走进去* ✅.
""", related=["word_order"])

L("resultative_complements", "Resultative complements: V + 完/到/好/见/懂", "HSK2", """
# Resultative complements

Mandarin attaches a result word after the verb to specify HOW the action concluded — completion, success, perception, understanding.

## Common result complements

| Complement | Meaning |
|---|---|
| 完 (wán) | finished, completed |
| 到 (dào) | reached, arrived at the result |
| 好 (hǎo) | done well, done satisfactorily |
| 见 (jiàn) | perceived (saw, heard) |
| 懂 (dǒng) | understood |
| 错 (cuò) | wrong (mistakenly done) |
| 清楚 (qīngchu) | clearly |

## Examples

- 吃 **完** 了 (chī wán le) — finished eating
- 看 **到** 了 (kàn dào le) — saw (it / there it is)
- 听 **见** 了 — heard (it)
- 学 **好** 中文 — master Chinese (lit. study-well)
- 听 **懂** 了 — understood (by listening)
- 写 **错** 了 — wrote wrong
- 说 **清楚** — speak clearly

## Negation: 没 + V + complement

- 没 看 **到** — didn't see (it)
- 没 听 **懂** — didn't understand

## Potential form: V + 得/不 + complement

- 听 **得** 懂 (tīngdedǒng) — can understand (by hearing)
- 听 **不** 懂 — can't understand
- 吃 **得** 完 — can finish eating
- 吃 **不** 完 — can't finish eating

This is the standard way to say "can do X" with specific results.

## Common mistakes

- Forgetting the result complement: *我吃了* (I ate / am eating) vs *我吃完了* (I finished eating). The complement adds the "all-the-way-through" sense.
- Using *能* (can) with potential complement: usually pick one — *我能听懂* OR *我听得懂*, not both stacked redundantly.
""", related=["aspect_le"])

L("shi_de_construction", "是…的 construction (focusing past details)", "HSK3", """
# 是…的 construction

是…的 emphasizes a specific detail — *when*, *where*, *how*, *with whom*, *why* — about a past action.

## Form

**Subject + 是 + [time/place/manner/agent] + V + 的**

The 是 is sometimes optional in spoken Mandarin, but the 的 at the end is mandatory.

## Examples

- 我 **是** 昨天 来 **的**。 (I came yesterday — yesterday is the focus.)
- 我 **是** 坐 火车 来 **的**。 (I came by train.)
- 你 **是** 从 哪儿 来 **的**？ (Where did you come from?)
- 是 我 做 **的**。 (I did it — emphasizing the doer.)
- 他 **是** 怎么 知道 **的**？ (How did he find out?)

## Compare with simple past

- *我昨天来了* — I came yesterday. (neutral past statement)
- *我是昨天来的* — I came **yesterday**. (the WHEN is the focus)

## Object positioning

Often the object goes between the verb and 的:
- 我 **是** 在 那个 餐厅 吃 饭 **的**。 — I ate at that restaurant.
- 我 **是** 跟 朋友 一起 来 **的**。 — I came with friends.

## When NOT to use

- For current/future actions — 是…的 is for past events.
- For pure existence statements — *我是学生* (I am a student) is plain 是, not the construction.

## Common mistakes

- Forgetting the final 的: *我是昨天来* ❌ → *我是昨天来的* ✅.
- Using 是…的 for general statements: *我是喜欢中文的* sounds awkward; *我喜欢中文* is fine.
""", related=["aspect_le", "past_simple"])

L("reduplication", "Reduplication: verb-verb, adj-adj", "HSK2", """
# Reduplication

Mandarin repeats verbs and adjectives to soften or emphasize. It's everywhere in casual speech.

## Verb reduplication = "try it / a little"

Softens the verb, makes the action feel brief or tentative:
- 看 → **看看** (kànkan) — take a look
- 听 → **听听** (tīngting) — have a listen
- 试 → **试试** (shìshi) — give it a try
- 想 → **想想** (xiǎngxiang) — think about it
- 等 → **等等** (děngdeng) — wait a moment

For two-syllable verbs, the pattern is ABAB:
- 休息 → **休息休息** — rest a bit
- 讨论 → **讨论讨论** — discuss it briefly

You can also add 一下 with similar effect:
- 看 **一下** = 看看 — have a look

## Adjective reduplication = intensify / vivid

For single-syllable adjectives: ABAB or AA:
- 红 → **红红** (the / 红红的) — bright red, very red
- 慢 → **慢慢** (慢慢地) — slowly slowly
- 远 → **远远** — far far away

For two-syllable adjectives: AABB:
- 漂亮 → **漂漂亮亮** — beautifully, all dolled up
- 干净 → **干干净净** — squeaky clean
- 高兴 → **高高兴兴** — happily

The reduplicated form often pairs with 的 (adjective) or 地 (adverbially).

## Common mistakes

- Reduplicating wrong-syllable two-syllable verbs: *讨讨论论* ❌ → *讨论讨论* ✅.
- Reduplicating where it doesn't fit (formal writing) — sounds too casual.
""", related=["adjectives"])

L("separable_verbs", "Separable verbs: 洗澡, 睡觉, 帮忙", "HSK2", """
# Separable verbs (离合词)

Some Mandarin "verbs" are actually verb + noun pairs that look like one word but split when modified.

## Common separable verbs

- 洗澡 (xǐzǎo) — take a bath/shower (lit. wash-bath)
- 睡觉 (shuìjiào) — sleep (lit. sleep-sleep)
- 帮忙 (bāngmáng) — help (lit. help-busy)
- 走路 (zǒulù) — walk (lit. walk-road)
- 跳舞 (tiàowǔ) — dance (lit. jump-dance)
- 吃饭 (chīfàn) — eat (a meal)
- 唱歌 (chànggē) — sing (lit. sing-song)
- 见面 (jiànmiàn) — meet (lit. see-face)
- 上班 (shàngbān) — go to work
- 结婚 (jiéhūn) — get married

## How they split

When you add a duration, modifier, or aspect marker, the parts SEPARATE:

- 我 睡 **了** 觉 (not *我睡觉了* in the strict sense — the 了 sits between split parts when emphasizing completion)
- 我 洗 **了** 一个 澡 (lit. "I washed one bath" — wash an actual bath)
- 我 帮 **了** 他 一个 忙 — I helped him (out)
- 他 睡 **了** 八个小时 觉 — He slept for 8 hours.

## Tricky: you don't put an object after a separable verb

Because the "verb" already contains a noun, you can't add another:
- *我帮忙你* ❌ → *我帮你的忙* ✅ OR *我帮你* ✅
- *我见面你* ❌ → *我跟你见面* ✅

## Common mistakes

- Treating separable verbs like English compounds — adding objects directly: *I help-busy you* doesn't work.
- Putting aspect markers wrong: 帮了忙 / 见了面 / 洗了澡 — split.
""", related=["aspect_le"])

L("de_modifier", "的 + relative clauses (noun modification)", "HSK2", """
# 的 + modifier

In Mandarin, modifiers (adjectives, clauses) come BEFORE the noun, joined by 的. This is how Mandarin builds "relative clauses."

## Adjective + 的 + noun

- 红 **的** 车 — a red car
- 好看 **的** 电影 — a good-looking movie / a movie that looks good
- 漂亮 **的** 衣服 — beautiful clothes

Some single-syllable adjective-noun pairs DON'T need 的:
- 红车 (also fine), 好书, 大房子

But two-syllable adjectives usually require 的:
- 漂亮的衣服 ✅ (not *漂亮衣服*)

## Relative clauses

Mandarin doesn't have separate relative pronouns like *who/which/that*. The whole modifying clause goes before the noun + 的:

- **我昨天买的** 书 (the book I bought yesterday) — lit. "I yesterday buy 的 book"
- **他给我的** 礼物 (the gift he gave me) — lit. "he give me 的 gift"
- **会说中文的** 学生 (the student who speaks Chinese) — lit. "able-speak-Chinese 的 student"

## Compare with English

- *the man who lives next door* → **住在隔壁的** 人 (lit. "live at next door 的 person")
- *the book I read* → **我看过的** 书 (lit. "I read 的 book")

## When 的 is dropped

- With family / close relationships: *我哥哥*, not *我的哥哥* (though both are OK)
- With nationalities: *中国人*, not *中国的人*
- In fixed compounds

## Common mistakes

- Forgetting 的 with longer modifiers: *我昨天买书* (I yesterday bought books) vs *我昨天买的书* (the books I bought yesterday). The 的 is what makes it a noun phrase.
- Putting modifiers AFTER the noun (English order): *书我昨天买* ❌ → *我昨天买的书* ✅.
""", related=["word_order", "relative_clauses"])

L("politeness_formal_zh", "Politeness: 您, 请, 麻烦", "HSK1", """
# Politeness in Mandarin

Mandarin signals formality through pronoun choice and request softeners.

## 您 (nín) vs 你 (nǐ)

- 你 — informal you
- **您** — formal/respectful you (older people, customers, professional contexts)

Use 您 with:
- Elders, teachers, customers
- Strangers in formal contexts
- People you want to show respect to

In casual peer conversation, 你 is fine.

## 请 (qǐng) — please

Goes BEFORE the verb:
- **请** 进 — please come in
- **请** 坐 — please sit down
- **请** 等一下 — please wait a moment
- **请问**, 厕所在哪儿？ — Excuse me, where's the bathroom? (formal question opener)

## 麻烦 (máfan) — softener for requests

Literally "bother/trouble." Use to politely ask for a favor:
- **麻烦** 你 帮 我 一下。 — Could I trouble you to help me?
- **麻烦** 你 帮 我 拿 一下。 — Could you grab that for me?

## 能不能 / 可以…吗

Softer than imperatives:
- **能不能** 帮 我? — Can you help me?
- 我 **可以** 进来 **吗**? — Can I come in?
- 您 **能不能** 再 说 一遍? — Could you say that again?

## Saying thank you

- 谢谢 (xièxie) — thanks (universal)
- 谢谢 您 — formal thanks
- 不客气 / 不用谢 — you're welcome

## Apologies

- 不好意思 (bù hǎoyìsi) — excuse me / sorry (light)
- 对不起 (duìbuqǐ) — I'm sorry (real apology)
- 抱歉 (bàoqiàn) — apologies (formal)

## Common mistakes

- Using 你 with elders or professional contacts — sounds rude; use 您.
- Direct imperatives without 请: *坐下* (sit down) → *请坐* (please sit).
""", related=["greetings_register"])

L("simplified_vs_traditional", "Simplified vs Traditional characters", "HSK1", """
# Simplified vs Traditional characters

Mandarin uses two character sets — Simplified (简体字, mainland China + Singapore) and Traditional (繁體字, Taiwan + Hong Kong + Macao + most overseas communities).

## When each is used

| Region | System |
|---|---|
| Mainland China | Simplified |
| Singapore | Simplified |
| Taiwan | Traditional |
| Hong Kong / Macao | Traditional |
| Overseas Chinatown communities (older diaspora) | Often Traditional |

## Examples

| Simplified | Traditional | Meaning |
|---|---|---|
| 国 | 國 | country |
| 学 | 學 | study/learn |
| 见 | 見 | see |
| 体 | 體 | body |
| 后 | 後 | back/after |
| 发 | 發 | send/develop |
| 写 | 寫 | write |
| 龙 | 龍 | dragon |

## How they differ

Simplified characters were officially introduced in 1956-1964 to boost literacy. Most simplifications:
- Reduce strokes (国 has 8 strokes; 國 has 11)
- Merge multiple characters into one
- Keep the pronunciation the same

## Pronunciation and grammar

**Identical** — only the writing differs. A Taiwanese person and a mainland person speak the same Mandarin (apart from regional vocabulary).

## Which to learn

- Mainland focus or unsure → Simplified. Roughly 80% of Mandarin learners.
- Taiwan / Hong Kong focus → Traditional.
- Heritage or academic study (classical Chinese) → Traditional.

Most resources (textbooks, apps, dictionaries) let you toggle.

## Common mistakes

- Mixing both in the same text — looks unprofessional.
- Assuming pinyin is system-specific — it isn't; pinyin is the same regardless.
""", related=["alphabet"])


THEMES = {}
def T(theme, items):
    """items: list of (hanzi, pinyin, english, classifier|None)."""
    THEMES[theme] = items

T("food", [
    ("食物", "shíwù", "food", None),
    ("米饭", "mǐfàn", "rice (cooked)", "碗"),
    ("面条", "miàntiáo", "noodles", "碗"),
    ("饺子", "jiǎozi", "dumplings", "个"),
    ("包子", "bāozi", "steamed bun", "个"),
    ("馒头", "mántou", "plain steamed bun", "个"),
    ("面包", "miànbāo", "bread", "块"),
    ("鸡蛋", "jīdàn", "egg", "个"),
    ("肉", "ròu", "meat", None),
    ("猪肉", "zhūròu", "pork", None),
    ("牛肉", "niúròu", "beef", None),
    ("鸡肉", "jīròu", "chicken (food)", None),
    ("鱼", "yú", "fish", "条"),
    ("虾", "xiā", "shrimp", "只"),
    ("青菜", "qīngcài", "leafy vegetables", None),
    ("水果", "shuǐguǒ", "fruit", None),
    ("苹果", "píngguǒ", "apple", "个"),
    ("香蕉", "xiāngjiāo", "banana", "根"),
    ("橙子", "chéngzi", "orange", "个"),
    ("汤", "tāng", "soup", "碗"),
    ("早饭", "zǎofàn", "breakfast", None),
    ("午饭", "wǔfàn", "lunch", None),
    ("晚饭", "wǎnfàn", "dinner", None),
    ("吃", "chī", "to eat", None),
    ("喝", "hē", "to drink", None),
    ("做饭", "zuòfàn", "to cook", None),
])

T("drinks", [
    ("水", "shuǐ", "water", "杯"),
    ("茶", "chá", "tea", "杯"),
    ("绿茶", "lǜchá", "green tea", "杯"),
    ("红茶", "hóngchá", "black tea (literally 'red tea')", "杯"),
    ("咖啡", "kāfēi", "coffee", "杯"),
    ("牛奶", "niúnǎi", "milk", "杯"),
    ("酸奶", "suānnǎi", "yogurt drink", "杯"),
    ("果汁", "guǒzhī", "juice", "杯"),
    ("可乐", "kělè", "cola", "瓶"),
    ("啤酒", "píjiǔ", "beer", "瓶"),
    ("白酒", "báijiǔ", "Chinese liquor", "瓶"),
    ("葡萄酒", "pútáojiǔ", "wine", "杯"),
    ("奶茶", "nǎichá", "milk tea / bubble tea", "杯"),
    ("热水", "rèshuǐ", "hot water", "杯"),
    ("冰水", "bīngshuǐ", "ice water", "杯"),
    ("白开水", "báikāishuǐ", "plain boiled water", "杯"),
])

T("family", [
    ("家", "jiā", "family / home", None),
    ("爸爸", "bàba", "dad", None),
    ("妈妈", "māma", "mom", None),
    ("父亲", "fùqīn", "father (formal)", None),
    ("母亲", "mǔqīn", "mother (formal)", None),
    ("哥哥", "gēge", "older brother", None),
    ("弟弟", "dìdi", "younger brother", None),
    ("姐姐", "jiějie", "older sister", None),
    ("妹妹", "mèimei", "younger sister", None),
    ("儿子", "érzi", "son", None),
    ("女儿", "nǚ'ér", "daughter", None),
    ("爷爷", "yéye", "paternal grandfather", None),
    ("奶奶", "nǎinai", "paternal grandmother", None),
    ("外公", "wàigōng", "maternal grandfather", None),
    ("外婆", "wàipó", "maternal grandmother", None),
    ("叔叔", "shūshu", "uncle (father's younger brother)", None),
    ("阿姨", "āyí", "aunt (general; also nanny / older female)", None),
    ("丈夫", "zhàngfu", "husband", None),
    ("妻子", "qīzi", "wife", None),
    ("老公", "lǎogōng", "husband (colloquial)", None),
    ("老婆", "lǎopó", "wife (colloquial)", None),
    ("孩子", "háizi", "child", "个"),
    ("朋友", "péngyou", "friend", "个"),
    ("男朋友", "nánpéngyou", "boyfriend", "个"),
    ("女朋友", "nǚpéngyou", "girlfriend", "个"),
])

T("body", [
    ("身体", "shēntǐ", "body", None),
    ("头", "tóu", "head", "个"),
    ("脸", "liǎn", "face", "张"),
    ("眼睛", "yǎnjing", "eye", "只"),
    ("鼻子", "bízi", "nose", "个"),
    ("嘴", "zuǐ", "mouth", "张"),
    ("耳朵", "ěrduo", "ear", "只"),
    ("头发", "tóufa", "hair (on head)", None),
    ("脖子", "bózi", "neck", None),
    ("肩膀", "jiānbǎng", "shoulder", None),
    ("胳膊", "gēbo", "arm", "条"),
    ("手", "shǒu", "hand", "只"),
    ("手指", "shǒuzhǐ", "finger", "根"),
    ("腿", "tuǐ", "leg", "条"),
    ("脚", "jiǎo", "foot", "只"),
    ("心", "xīn", "heart (often metaphorical)", None),
    ("肚子", "dùzi", "belly / stomach", None),
    ("背", "bèi", "back", None),
    ("牙齿", "yáchǐ", "tooth", "颗"),
    ("舌头", "shétou", "tongue", None),
])

T("weather", [
    ("天气", "tiānqì", "weather", None),
    ("晴天", "qíngtiān", "sunny day", None),
    ("阴天", "yīntiān", "cloudy / overcast day", None),
    ("下雨", "xiàyǔ", "to rain", None),
    ("下雪", "xiàxuě", "to snow", None),
    ("刮风", "guāfēng", "to be windy", None),
    ("晴", "qíng", "clear / sunny", None),
    ("阴", "yīn", "overcast", None),
    ("雨", "yǔ", "rain", "场"),
    ("雪", "xuě", "snow", "场"),
    ("风", "fēng", "wind", "阵"),
    ("云", "yún", "cloud", "朵"),
    ("太阳", "tàiyáng", "sun", None),
    ("月亮", "yuèliang", "moon", None),
    ("星星", "xīngxing", "star", "颗"),
    ("热", "rè", "hot", None),
    ("冷", "lěng", "cold", None),
    ("凉快", "liángkuai", "pleasantly cool", None),
    ("暖和", "nuǎnhuo", "warm", None),
    ("春天", "chūntiān", "spring", None),
    ("夏天", "xiàtiān", "summer", None),
    ("秋天", "qiūtiān", "autumn", None),
    ("冬天", "dōngtiān", "winter", None),
])

T("greetings", [
    ("你好", "nǐ hǎo", "hello (general, informal)", None),
    ("您好", "nín hǎo", "hello (formal/polite)", None),
    ("大家好", "dàjiā hǎo", "hello everyone", None),
    ("早上好", "zǎoshang hǎo", "good morning", None),
    ("中午好", "zhōngwǔ hǎo", "good afternoon (noon)", None),
    ("晚上好", "wǎnshang hǎo", "good evening", None),
    ("晚安", "wǎn'ān", "goodnight", None),
    ("再见", "zàijiàn", "goodbye", None),
    ("拜拜", "báibái", "bye-bye (very casual)", None),
    ("回头见", "huítóu jiàn", "see you later", None),
    ("明天见", "míngtiān jiàn", "see you tomorrow", None),
    ("最近怎么样?", "zuìjìn zěnmeyàng?", "how have you been?", None),
    ("你好吗?", "nǐ hǎo ma?", "how are you? (slightly textbook-y)", None),
    ("你叫什么名字?", "nǐ jiào shénme míngzi?", "what's your name?", None),
    ("我叫...", "wǒ jiào ...", "my name is ...", None),
    ("很高兴认识你", "hěn gāoxìng rènshi nǐ", "nice to meet you", None),
    ("请问...", "qǐng wèn ...", "excuse me, may I ask...", None),
    ("谢谢", "xièxie", "thank you", None),
    ("不客气", "bú kèqi", "you're welcome", None),
    ("不用谢", "búyòng xiè", "no need to thank me", None),
    ("对不起", "duìbuqǐ", "sorry", None),
    ("没关系", "méi guānxi", "it's fine / no problem", None),
    ("不好意思", "bù hǎoyìsi", "embarrassed / excuse me", None),
])

T("numbers", [
    ("零", "líng", "0", None),
    ("一", "yī", "1", None),
    ("二", "èr", "2 (in counting sequence)", None),
    ("两", "liǎng", "2 (before classifiers, e.g. 两个)", None),
    ("三", "sān", "3", None),
    ("四", "sì", "4", None),
    ("五", "wǔ", "5", None),
    ("六", "liù", "6", None),
    ("七", "qī", "7", None),
    ("八", "bā", "8", None),
    ("九", "jiǔ", "9", None),
    ("十", "shí", "10", None),
    ("十一", "shíyī", "11", None),
    ("二十", "èrshí", "20", None),
    ("二十一", "èrshíyī", "21", None),
    ("三十", "sānshí", "30", None),
    ("一百", "yìbǎi", "100", None),
    ("一千", "yìqiān", "1,000", None),
    ("一万", "yíwàn", "10,000 (NOT 'ten thousand' as a single unit — Chinese counts in 万 万)", None),
    ("十万", "shíwàn", "100,000", None),
    ("一百万", "yìbǎiwàn", "1,000,000", None),
    ("一亿", "yíyì", "100,000,000", None),
    ("第一", "dì-yī", "first (ordinal — 第 + number)", None),
    ("第二", "dì-èr", "second", None),
])

T("colors", [
    ("颜色", "yánsè", "color", None),
    ("红色", "hóngsè", "red", None),
    ("橙色", "chéngsè", "orange", None),
    ("黄色", "huángsè", "yellow", None),
    ("绿色", "lǜsè", "green", None),
    ("蓝色", "lánsè", "blue", None),
    ("紫色", "zǐsè", "purple", None),
    ("黑色", "hēisè", "black", None),
    ("白色", "báisè", "white", None),
    ("灰色", "huīsè", "grey", None),
    ("棕色", "zōngsè", "brown", None),
    ("粉色", "fěnsè", "pink", None),
    ("金色", "jīnsè", "gold (color)", None),
    ("银色", "yínsè", "silver (color)", None),
    ("彩色", "cǎisè", "multicolored", None),
])

T("clothes", [
    ("衣服", "yīfu", "clothes", "件"),
    ("衬衫", "chènshān", "shirt", "件"),
    ("T恤", "T-xù", "t-shirt", "件"),
    ("裤子", "kùzi", "pants/trousers", "条"),
    ("牛仔裤", "niúzǎikù", "jeans", "条"),
    ("短裤", "duǎnkù", "shorts", "条"),
    ("裙子", "qúnzi", "skirt", "条"),
    ("外套", "wàitào", "coat / jacket", "件"),
    ("毛衣", "máoyī", "sweater", "件"),
    ("鞋", "xié", "shoes", "双"),
    ("鞋子", "xiézi", "shoes (colloquial)", "双"),
    ("袜子", "wàzi", "socks", "双"),
    ("帽子", "màozi", "hat", "顶"),
    ("围巾", "wéijīn", "scarf", "条"),
    ("手套", "shǒutào", "gloves", "副"),
    ("眼镜", "yǎnjìng", "glasses", "副"),
    ("包", "bāo", "bag", "个"),
    ("书包", "shūbāo", "school bag / backpack", "个"),
])

T("transportation", [
    ("交通", "jiāotōng", "transportation / traffic", None),
    ("车", "chē", "vehicle (general)", "辆"),
    ("汽车", "qìchē", "car", "辆"),
    ("出租车", "chūzūchē", "taxi (mainland)", "辆"),
    ("的士", "dīshì", "taxi (Hong Kong / Cantonese-influenced)", "辆"),
    ("公交车", "gōngjiāochē", "public bus", "辆"),
    ("地铁", "dìtiě", "subway / metro", None),
    ("火车", "huǒchē", "train", "列"),
    ("高铁", "gāotiě", "high-speed rail", None),
    ("飞机", "fēijī", "airplane", "架"),
    ("自行车", "zìxíngchē", "bicycle", "辆"),
    ("摩托车", "mótuōchē", "motorcycle", "辆"),
    ("电动车", "diàndòngchē", "e-bike / electric scooter", "辆"),
    ("船", "chuán", "boat / ship", "艘"),
    ("机场", "jīchǎng", "airport", "个"),
    ("车站", "chēzhàn", "station", "个"),
    ("地铁站", "dìtiězhàn", "subway station", "个"),
    ("火车站", "huǒchēzhàn", "train station", "个"),
    ("票", "piào", "ticket", "张"),
])

T("kitchen", [
    ("厨房", "chúfáng", "kitchen", "个"),
    ("锅", "guō", "pot/wok", "口"),
    ("碗", "wǎn", "bowl", "个"),
    ("筷子", "kuàizi", "chopsticks", "双"),
    ("勺子", "sháozi", "spoon", "把"),
    ("叉子", "chāzi", "fork", "把"),
    ("刀", "dāo", "knife", "把"),
    ("盘子", "pánzi", "plate", "个"),
    ("杯子", "bēizi", "cup", "个"),
    ("冰箱", "bīngxiāng", "refrigerator", "台"),
    ("炉子", "lúzi", "stove", "个"),
    ("微波炉", "wēibōlú", "microwave", "台"),
    ("水池", "shuǐchí", "sink", "个"),
    ("做饭", "zuòfàn", "to cook", None),
    ("切", "qiē", "to cut/chop", None),
    ("炒", "chǎo", "to stir-fry", None),
    ("煮", "zhǔ", "to boil", None),
    ("烤", "kǎo", "to bake/roast", None),
    ("蒸", "zhēng", "to steam", None),
    ("洗", "xǐ", "to wash", None),
])

T("home", [
    ("家", "jiā", "home/family", None),
    ("房子", "fángzi", "house", "栋"),
    ("公寓", "gōngyù", "apartment", "套"),
    ("房间", "fángjiān", "room", "间"),
    ("卧室", "wòshì", "bedroom", "间"),
    ("客厅", "kètīng", "living room", "个"),
    ("浴室", "yùshì", "bathroom", "间"),
    ("厕所", "cèsuǒ", "toilet/restroom", "个"),
    ("门", "mén", "door", "扇"),
    ("窗户", "chuānghu", "window", "扇"),
    ("墙", "qiáng", "wall", "面"),
    ("地板", "dìbǎn", "floor", None),
    ("天花板", "tiānhuābǎn", "ceiling", "面"),
    ("楼梯", "lóutī", "stairs", None),
    ("床", "chuáng", "bed", "张"),
    ("桌子", "zhuōzi", "table", "张"),
    ("椅子", "yǐzi", "chair", "把"),
    ("沙发", "shāfā", "sofa", "个"),
    ("灯", "dēng", "lamp", "盏"),
    ("电视", "diànshì", "TV", "台"),
])

T("animals", [
    ("动物", "dòngwù", "animal", "只"),
    ("狗", "gǒu", "dog", "只"),
    ("猫", "māo", "cat", "只"),
    ("鸟", "niǎo", "bird", "只"),
    ("鱼", "yú", "fish", "条"),
    ("马", "mǎ", "horse", "匹"),
    ("牛", "niú", "cow/ox", "头"),
    ("猪", "zhū", "pig", "头"),
    ("羊", "yáng", "sheep", "只"),
    ("鸡", "jī", "chicken", "只"),
    ("鸭", "yā", "duck", "只"),
    ("兔子", "tùzi", "rabbit", "只"),
    ("老鼠", "lǎoshǔ", "mouse/rat", "只"),
    ("大象", "dàxiàng", "elephant", "头"),
    ("老虎", "lǎohǔ", "tiger", "只"),
    ("狮子", "shīzi", "lion", "只"),
    ("熊", "xióng", "bear", "只"),
    ("猴子", "hóuzi", "monkey", "只"),
    ("蛇", "shé", "snake", "条"),
    ("龙", "lóng", "dragon", "条"),
])

T("emotions", [
    ("感情", "gǎnqíng", "emotion/feeling", None),
    ("高兴", "gāoxìng", "happy", None),
    ("快乐", "kuàilè", "joyful", None),
    ("伤心", "shāngxīn", "sad", None),
    ("难过", "nánguò", "upset/sad", None),
    ("生气", "shēngqì", "angry", None),
    ("害怕", "hàipà", "scared", None),
    ("紧张", "jǐnzhāng", "nervous", None),
    ("担心", "dānxīn", "worried", None),
    ("惊讶", "jīngyà", "surprised", None),
    ("无聊", "wúliáo", "bored", None),
    ("累", "lèi", "tired", None),
    ("兴奋", "xīngfèn", "excited", None),
    ("骄傲", "jiāo'ào", "proud", None),
    ("孤独", "gūdú", "lonely", None),
    ("感激", "gǎnjī", "grateful", None),
    ("爱", "ài", "love", None),
    ("恨", "hèn", "hate", None),
    ("笑", "xiào", "to laugh/smile", None),
    ("哭", "kū", "to cry", None),
])

T("restaurant", [
    ("餐厅", "cāntīng", "restaurant", "家"),
    ("饭店", "fàndiàn", "restaurant", "家"),
    ("菜单", "càidān", "menu", "份"),
    ("服务员", "fúwùyuán", "waiter", "个"),
    ("点菜", "diǎncài", "to order food", None),
    ("付钱", "fùqián", "to pay", None),
    ("买单", "mǎidān", "to pay the bill", None),
    ("小费", "xiǎofèi", "tip", None),
    ("预订", "yùdìng", "reservation", None),
    ("特价", "tèjià", "special offer", None),
    ("菜", "cài", "dish/cuisine", "道"),
    ("主菜", "zhǔcài", "main course", "道"),
    ("甜点", "tiándiǎn", "dessert", "份"),
    ("饮料", "yǐnliào", "beverage", "杯"),
    ("酒水", "jiǔshuǐ", "drinks (alcoholic)", None),
    ("辣", "là", "spicy", None),
    ("咸", "xián", "salty", None),
    ("酸", "suān", "sour", None),
    ("好吃", "hǎochī", "delicious", None),
    ("素食", "sùshí", "vegetarian food", None),
])

T("travel", [
    ("旅行", "lǚxíng", "travel/trip", None),
    ("假期", "jiàqī", "vacation", None),
    ("护照", "hùzhào", "passport", "本"),
    ("签证", "qiānzhèng", "visa", "个"),
    ("行李", "xíngli", "luggage", "件"),
    ("行李箱", "xínglixiāng", "suitcase", "个"),
    ("酒店", "jiǔdiàn", "hotel", "家"),
    ("宾馆", "bīnguǎn", "guesthouse", "家"),
    ("机场", "jīchǎng", "airport", "个"),
    ("航班", "hángbān", "flight", "次"),
    ("地图", "dìtú", "map", "张"),
    ("游客", "yóukè", "tourist", "个"),
    ("观光", "guānguāng", "sightseeing", None),
    ("景点", "jǐngdiǎn", "scenic spot", "个"),
    ("海滩", "hǎitān", "beach", "个"),
    ("山", "shān", "mountain", "座"),
    ("城市", "chéngshì", "city", "座"),
    ("国家", "guójiā", "country", "个"),
    ("国外", "guówài", "abroad", None),
    ("语言", "yǔyán", "language", "门"),
])

T("school", [
    ("学校", "xuéxiào", "school", "所"),
    ("学生", "xuésheng", "student", "个"),
    ("老师", "lǎoshī", "teacher", "位"),
    ("教室", "jiàoshì", "classroom", "间"),
    ("课", "kè", "class/lesson", "节"),
    ("作业", "zuòyè", "homework", "份"),
    ("考试", "kǎoshì", "exam", "场"),
    ("成绩", "chéngjì", "grades/score", None),
    ("书", "shū", "book", "本"),
    ("笔记本", "bǐjìběn", "notebook", "个"),
    ("铅笔", "qiānbǐ", "pencil", "支"),
    ("钢笔", "gāngbǐ", "pen", "支"),
    ("纸", "zhǐ", "paper", "张"),
    ("黑板", "hēibǎn", "blackboard", "块"),
    ("图书馆", "túshūguǎn", "library", "个"),
    ("学习", "xuéxí", "to study", None),
    ("教", "jiāo", "to teach", None),
    ("毕业", "bìyè", "to graduate", None),
    ("大学", "dàxué", "university", "所"),
    ("中学", "zhōngxué", "middle/high school", "所"),
])

T("health", [
    ("健康", "jiànkāng", "health", None),
    ("生病", "shēngbìng", "to be sick", None),
    ("医生", "yīshēng", "doctor", "位"),
    ("护士", "hùshi", "nurse", "位"),
    ("医院", "yīyuàn", "hospital", "家"),
    ("药", "yào", "medicine", "种"),
    ("药店", "yàodiàn", "pharmacy", "家"),
    ("头疼", "tóuténg", "headache", None),
    ("肚子疼", "dùziténg", "stomachache", None),
    ("发烧", "fāshāo", "fever", None),
    ("感冒", "gǎnmào", "cold (illness)", None),
    ("咳嗽", "késou", "cough", None),
    ("疼", "téng", "pain/hurt", None),
    ("受伤", "shòushāng", "to be injured", None),
    ("运动", "yùndòng", "exercise/sport", None),
    ("减肥", "jiǎnféi", "to lose weight", None),
    ("睡眠", "shuìmián", "sleep", None),
    ("抽烟", "chōuyān", "to smoke", None),
    ("喝酒", "hējiǔ", "to drink alcohol", None),
    ("预约", "yùyuē", "appointment", "个"),
])

T("technology", [
    ("电脑", "diànnǎo", "computer", "台"),
    ("手机", "shǒujī", "cellphone", "部"),
    ("智能手机", "zhìnéng shǒujī", "smartphone", "部"),
    ("笔记本", "bǐjìběn", "laptop", "台"),
    ("平板", "píngbǎn", "tablet", "台"),
    ("网络", "wǎngluò", "internet/network", None),
    ("互联网", "hùliánwǎng", "the Internet", None),
    ("无线网", "wúxiànwǎng", "wifi", None),
    ("电子邮件", "diànzǐ yóujiàn", "email", "封"),
    ("密码", "mìmǎ", "password", "个"),
    ("屏幕", "píngmù", "screen", "个"),
    ("键盘", "jiànpán", "keyboard", "个"),
    ("应用", "yìngyòng", "app", "个"),
    ("网站", "wǎngzhàn", "website", "个"),
    ("文件", "wénjiàn", "file", "份"),
    ("电池", "diànchí", "battery", "个"),
    ("充电器", "chōngdiànqì", "charger", "个"),
    ("下载", "xiàzài", "to download", None),
    ("视频", "shìpín", "video", "个"),
    ("照片", "zhàopiàn", "photo", "张"),
])

T("useful_phrases", [
    ("我不明白", "wǒ bù míngbai", "I don't understand", None),
    ("请再说一遍", "qǐng zài shuō yí biàn", "please say it again", None),
    ("请说慢一点", "qǐng shuō màn yìdiǎn", "please speak slower", None),
    ("...用中文怎么说?", "yòng Zhōngwén zěnme shuō", "how do you say... in Chinese?", None),
    ("这是什么意思?", "zhè shì shénme yìsi", "what does this mean?", None),
    ("...在哪儿?", "zài nǎr", "where is...?", None),
    ("多少钱?", "duōshao qián", "how much?", None),
    ("我想要...", "wǒ xiǎng yào", "I want...", None),
    ("能不能帮我?", "néng bu néng bāng wǒ", "can you help me?", None),
    ("我需要帮助", "wǒ xūyào bāngzhù", "I need help", None),
    ("我迷路了", "wǒ mí lù le", "I'm lost", None),
    ("你会说英语吗?", "nǐ huì shuō Yīngyǔ ma", "do you speak English?", None),
    ("现在几点?", "xiànzài jǐ diǎn", "what time is it?", None),
    ("我叫...", "wǒ jiào", "my name is...", None),
    ("你叫什么名字?", "nǐ jiào shénme míngzi", "what's your name?", None),
    ("没问题", "méi wèntí", "no problem", None),
    ("当然", "dāngrán", "of course", None),
    ("也许", "yěxǔ", "maybe", None),
    ("我不知道", "wǒ bù zhīdào", "I don't know", None),
    ("真的吗?", "zhēn de ma", "really?", None),
])

# ============================================================
# WRITE DB
# ============================================================

def main():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)

    # Lessons
    for l in LESSONS:
        conn.execute(
            "INSERT INTO lessons(topic, title, hsk_level, body_markdown, related_topics) VALUES (?,?,?,?,?)",
            (l["topic"], l["title"], l["hsk"], l["body"], ",".join(l.get("related", []))),
        )
    conn.execute("INSERT INTO lessons_fts(lessons_fts) VALUES('rebuild')")

    # Themes
    for theme, items in THEMES.items():
        for pos, (hz, py, en, cl) in enumerate(items):
            conn.execute(
                "INSERT INTO vocabulary_themes(theme, position, hanzi, pinyin, english, classifier) VALUES (?,?,?,?,?,?)",
                (theme, pos, hz, py, en, cl),
            )

    conn.commit()
    n_l = conn.execute("SELECT COUNT(*) FROM lessons").fetchone()[0]
    n_th = conn.execute("SELECT COUNT(DISTINCT theme) FROM vocabulary_themes").fetchone()[0]
    n_it = conn.execute("SELECT COUNT(*) FROM vocabulary_themes").fetchone()[0]
    print(f"lessons: {n_l}, themes: {n_th} ({n_it} items)")
    print(f"db: {DB_PATH}; size: {DB_PATH.stat().st_size/1024:.1f} KB")
    conn.close()


if __name__ == "__main__":
    main()
