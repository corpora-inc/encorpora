#!/usr/bin/env python3
"""Build segments_zh.json from EN segments + hand-crafted Mandarin translations.

Mirrors the FR build approach:
  - Same IDs, structural metadata, pause_after_ms, repetition_penalty
  - text = natural Mandarin (Arabic numerals OK in display per spec)
  - tts.text = phonetics applied + digits spelled out in Chinese
  - heading segments get only text/text_markdown (no tts), matching EN/FR
"""
import json
import re
from pathlib import Path

EN_SEGMENTS = Path("/home/skyl/encorpora/books/vehicles/motorcycles/01-the-story-of-the-motorcycle/packs/august-chatterbox-v1/segments.json")
OUT_SEGMENTS = Path("/home/skyl/encorpora/books/vehicles/motorcycles/01-the-story-of-the-motorcycle/packs/august-chatterbox-v1/segments_zh.json")
OUT_PHONETICS = Path("/home/skyl/encorpora/books/vehicles/motorcycles/01-the-story-of-the-motorcycle/packs/august-chatterbox-v1/phonetics_zh.json")

# ---------------------------------------------------------------------------
# ZH phonetics — apply to display text to produce tts.text. Brand names are
# expanded to their Chinese equivalent so Chatterbox-zh can pronounce them.
# Display text keeps the Latin brand spelling (Chinese print convention).
# ---------------------------------------------------------------------------
ZH_PHONETICS = {
    # Brand names — official Chinese transliterations
    "BMW R75":          "宝马 R 七十五",
    "BMW GS":           "宝马 GS",
    "BMW":              "宝马",
    "Harley-Davidson":  "哈雷戴维森",
    "Triumph":          "凯旋",
    "Ducati":           "杜卡迪",
    "Yamaha":           "雅马哈",
    "Suzuki":           "铃木",
    "Kawasaki":         "川崎",
    "MV Agusta":        "MV 阿古斯塔",
    "Honda":            "本田",
    "Soichiro Honda":   "本田宗一郎",
    "Indian":           "印第安",
    "Royal Enfield":    "皇家恩菲尔德",
    "Norton":           "诺顿",
    "Gottlieb Daimler": "戴姆勒",
    "Reitwagen":        "莱特瓦根",
    "Super Cub":        "小狼",
    "LiveWire":         "活线",
    "Energica":         "埃涅尔吉卡",
    "Zero":             "零",
    "Hayabusa":         "隼",
    "Siegfried Bettmann": "西格弗里德 贝特曼",
    "William Harley":   "威廉 哈雷",
    "Arthur Davidson":  "亚瑟 戴维森",
    "Milwaukee":        "密尔沃基",
    "Springfield":      "斯普林菲尔德",
    "Massachusetts":    "马萨诸塞州",
    "California":       "加利福尼亚",
    # Model designations
    "CB 750":           "CB 七百五十",
    "ZX-11":            "ZX 十一",
    "WLA":              "W L A",
    "R75":              "R 七十五",
    "GS":               "GS",
    "KTM":              "KTM",
}


# ---------------------------------------------------------------------------
# ZH translations of every segment. Keys are EN segment IDs.
#   "text" — natural Mandarin (display); Arabic numerals allowed.
#   "tts"  — optional override for tts.text (only if phonetic substitution
#             is insufficient; usually we let apply_phonetics build it).
# Heading segments: text only.
# ---------------------------------------------------------------------------

# Year-spelling helper for display text in tts only — Chinese year-form: 一八八五年
_DIGIT_TO_HZ = {
    "0": "零", "1": "一", "2": "二", "3": "三", "4": "四",
    "5": "五", "6": "六", "7": "七", "8": "八", "9": "九",
}

def _spell_year_zh(yyyy: str) -> str:
    """1885 → '一八八五年' (digit-by-digit, the natural Mandarin year form)."""
    return "".join(_DIGIT_TO_HZ[d] for d in yyyy) + "年"


def _spell_decade_zh(prefix: str) -> str:
    """1960s → '一九六零年代' (digit-by-digit + 年代)."""
    return "".join(_DIGIT_TO_HZ[d] for d in prefix) + "年代"


# Cardinal number helper — for non-year integers in tts (miles per hour etc.)
_CARDINAL_HZ = {
    1: "一", 2: "二", 3: "三", 4: "四", 5: "五",
    6: "六", 7: "七", 8: "八", 9: "九", 10: "十",
    100: "一百",
}


def _spell_cardinal_zh(n: int) -> str:
    """Generic 0..999 cardinal in standard Mandarin (place-value, not digit-by-digit).

    7 → 七
    120 → 一百二十
    175 → 一百七十五
    194 → 一百九十四
    200 → 二百
    750 → 七百五十
    """
    if n == 0:
        return "零"
    if n < 10:
        return _DIGIT_TO_HZ[str(n)]
    if n < 20:
        if n == 10:
            return "十"
        return "十" + _DIGIT_TO_HZ[str(n - 10)]
    if n < 100:
        tens, ones = divmod(n, 10)
        head = _DIGIT_TO_HZ[str(tens)] + "十"
        return head if ones == 0 else head + _DIGIT_TO_HZ[str(ones)]
    if n < 1000:
        hundreds, rest = divmod(n, 100)
        head = _DIGIT_TO_HZ[str(hundreds)] + "百"
        if rest == 0:
            return head
        if rest < 10:
            return head + "零" + _DIGIT_TO_HZ[str(rest)]
        # 10..99
        if rest < 20:
            # e.g. 110 → 一百一十, 119 → 一百一十九
            ones = rest - 10
            mid = "一十"
            return head + mid if ones == 0 else head + mid + _DIGIT_TO_HZ[str(ones)]
        tens, ones = divmod(rest, 10)
        mid = _DIGIT_TO_HZ[str(tens)] + "十"
        return head + mid if ones == 0 else head + mid + _DIGIT_TO_HZ[str(ones)]
    return str(n)  # not used in this book


# ---------------------------------------------------------------------------
# Per-segment translations
#   key = EN id
#   value = {"text": <display zh>, "tts": <optional explicit tts override>}
# ---------------------------------------------------------------------------

T = {
    # Frontmatter
    "ch00-001": {"text": "给读者的话"},
    "ch00-002": {"text": "这是摩托车的故事。"},
    "ch00-003": {"text": "这是一个真实的故事。"},
    "ch00-004": {"text": "很久以前，没有人有摩托车。"},
    "ch00-005": {"text": "现在，摩托车有几百万辆。"},
    "ch00-006": {"text": "它们很响，很快，也很亮。"},
    "ch00-007": {"text": "我们要从最开始讲起。"},
    "ch00-008": {"text": "我们会认识第一位制造者，第一批骑手，还有第一批比赛。"},
    "ch00-009": {"text": "然后我们会看一看今天的世界。"},
    "ch00-010": {"text": "到最后，你会知道这台小机器是怎样永远改变了道路的。"},

    # Chapter 1
    "ch01-011": {"text": "第一章 — 第一台会响的两轮车"},
    "ch01-012": {"text": "摩托车是一辆带发动机的自行车。"},
    "ch01-013": {"text": "发动机推动车轮。"},
    "ch01-014": {"text": "骑手不用踩脚蹬。"},
    "ch01-015": {"text": "很久以前，没有摩托车。"},
    "ch01-016": {"text": "人们骑马。"},
    "ch01-017": {"text": "人们骑自行车。"},
    "ch01-018": {"text": "自行车有两个轮子，没有发动机。"},
    "ch01-019": {"text": "你得用脚踩脚蹬。"},
    "ch01-020": {"text": "1885年，德国一个人有了一个大想法。"},
    "ch01-021": {"text": "他叫戈特利布·戴姆勒。"},
    "ch01-022": {"text": "他把一台小汽油发动机装到了一辆木头自行车上。"},
    "ch01-023": {"text": "他把这台机器叫做 Reitwagen。"},
    "ch01-024": {"text": "这个词在德语里的意思是“骑乘的车”。",
                 "tts": "这个词在德语里的意思是 骑乘的车。"},
    "ch01-025": {"text": "它是世界上第一辆摩托车。"},
    "ch01-026": {"text": "Reitwagen 很响。"},
    "ch01-027": {"text": "它很颠。"},
    "ch01-028": {"text": "它只有一个速度。"},
    "ch01-029": {"text": "它的速度大约是每小时7英里。"},
    "ch01-030": {"text": "这比今天骑自行车的人还慢。"},
    "ch01-031": {"text": "但它能不靠马走，也能不踩脚蹬走。",
                 "tts": "但它能不靠马走，也能不踩脚蹬走。"},
    "ch01-032": {"text": "摩托车诞生了。"},

    # Chapter 2
    "ch02-033": {"text": "第二章 — 最早的公司"},
    "ch02-034": {"text": "戴姆勒之后，其他人也想造摩托车。"},
    "ch02-035": {"text": "很快，世界各地都开了小工坊。"},
    "ch02-036": {"text": "在英国，一个叫西格弗里德·贝特曼的人创办了一家公司，名字叫 Triumph。"},
    "ch02-037": {"text": "第一辆 Triumph 摩托车是在1902年造出来的。"},
    "ch02-038": {"text": "在美国，两个朋友威廉·哈雷和亚瑟·戴维森，在一个小木屋里造出了他们的第一辆车。"},
    "ch02-039": {"text": "这个木屋在密尔沃基城。"},
    "ch02-040": {"text": "那一年是1903年。"},
    "ch02-041": {"text": "他们把公司叫做 Harley-Davidson。",
                 "tts": "他们把公司叫做 哈雷戴维森。"},
    "ch02-042": {"text": "另一家美国公司更早几年就开始了。"},
    "ch02-043": {"text": "马萨诸塞州斯普林菲尔德的两个人，在1901年造出了他们的第一台机器。"},
    "ch02-044": {"text": "他们把它叫做 Indian。",
                 "tts": "他们把它叫做 印第安。"},
    "ch02-045": {"text": "在印度，一家叫 Royal Enfield 的公司也在1901年开始造摩托车。"},
    "ch02-046": {"text": "今天，Royal Enfield 是世界上最古老的、还在造摩托车的公司。"},
    "ch02-047": {"text": "在德国，BMW 公司开始造摩托车要稍晚一些，是在1923年。"},
    "ch02-048": {"text": "BMW 在德语里的意思是“巴伐利亚发动机厂”。",
                 "tts": "宝马 在德语里的意思是 巴伐利亚发动机厂。"},
    "ch02-049": {"text": "到了1910年，摩托车到处都是。"},
    "ch02-050": {"text": "它们出现在城市的街道上和乡间的小路上。"},
    "ch02-051": {"text": "摩托车的时代真的开始了。"},

    # Chapter 3
    "ch03-052": {"text": "第三章 — 摩托车上战场"},
    "ch03-053": {"text": "摩托车很快。"},
    "ch03-054": {"text": "它们能走小路。"},
    "ch03-055": {"text": "它们能在营地之间送信。"},
    "ch03-056": {"text": "所以打仗的时候，军队想要摩托车。"},
    "ch03-057": {"text": "第一次世界大战在1914年开始了。"},
    "ch03-058": {"text": "士兵们用 Triumph 摩托车送命令。"},
    "ch03-059": {"text": "Triumph H 型车又结实又安静。"},
    "ch03-060": {"text": "它能去马去不了的地方。"},
    "ch03-061": {"text": "第二次世界大战在1939年开始了。"},
    "ch03-062": {"text": "那时候，摩托车更快、更结实了。"},
    "ch03-063": {"text": "美国士兵骑 Harley-Davidson WLA。"},
    "ch03-064": {"text": "德国士兵骑 BMW R75。"},
    "ch03-065": {"text": "R75 有一个边斗，多一个轮子，多一个座位，可以再坐一个士兵。"},
    "ch03-066": {"text": "战争结束后，士兵们回家了。"},
    "ch03-067": {"text": "他们把摩托车也带了回来。"},
    "ch03-068": {"text": "他们中很多人想继续骑车。"},
    "ch03-069": {"text": "他们中有些人办起了自己的摩托车俱乐部。"},
    "ch03-070": {"text": "战争让摩托车出了名。"},
    "ch03-071": {"text": "几百万人是第一次见到摩托车。"},
    "ch03-072": {"text": "很多人都想自己也有一辆。"},

    # Chapter 4
    "ch04-073": {"text": "第四章 — 日本的崛起"},
    "ch04-074": {"text": "第二次世界大战之后，日本很穷。"},
    "ch04-075": {"text": "大多数汽车太贵了。"},
    "ch04-076": {"text": "人们需要一种小一点、便宜一点的出行方式。"},
    "ch04-077": {"text": "一个年轻的日本人看到了机会。"},
    "ch04-078": {"text": "他叫本田宗一郎。"},
    "ch04-079": {"text": "他在1948年办了一家小公司。"},
    "ch04-080": {"text": "他给公司起名叫 Honda。",
                 "tts": "他给公司起名叫 本田。"},
    "ch04-081": {"text": "1958年，Honda 造出了一辆很小的摩托车，叫 Super Cub。"},
    "ch04-082": {"text": "Super Cub 很好骑。"},
    "ch04-083": {"text": "它很容易修。"},
    "ch04-084": {"text": "它非常非常便宜。"},
    "ch04-085": {"text": "全世界的人都买 Super Cub。"},
    "ch04-086": {"text": "到今天，Super Cub 已经卖出了一亿多辆。"},
    "ch04-087": {"text": "它是有史以来卖得最多的机动车。"},
    "ch04-088": {"text": "很快，又有三家日本公司跟着 Honda 一起做了起来。"},
    "ch04-089": {"text": "它们是 Yamaha、Suzuki 和 Kawasaki。"},
    "ch04-090": {"text": "加上 Honda，它们被叫做“四大家”。",
                 "tts": "加上 本田，它们被叫做 四大家。"},
    "ch04-091": {"text": "四大家造的摩托车又快又便宜，还很好骑。"},
    "ch04-092": {"text": "到了1960年代，日本摩托车到处都是。"},
    "ch04-093": {"text": "它们成了路上新的王。"},

    # Chapter 5
    "ch05-094": {"text": "第五章 — 更快，更快，更快"},
    "ch05-095": {"text": "1960年代，骑手们想要骑得更快。"},
    "ch05-096": {"text": "制造商们开始比赛，看谁能造出世界上最快的摩托车。"},
    "ch05-097": {"text": "在意大利，一家叫 MV Agusta 的小公司造出了漂亮的红色摩托车，一场比赛接一场地赢。"},
    "ch05-098": {"text": "在英国，Triumph 和 Norton 也造出了很厉害的车。"},
    "ch05-099": {"text": "然后，1969年，Honda 做了一件了不起的事。"},
    "ch05-100": {"text": "他们造出了一辆叫 CB 750 的摩托车。"},
    "ch05-101": {"text": "它有四个气缸和一台大发动机。"},
    "ch05-102": {"text": "它的速度可以超过每小时120英里。"},
    "ch05-103": {"text": "它是真正意义上的第一辆超级摩托车。"},
    "ch05-104": {"text": "CB 750 之后，每家公司都想造一辆超级摩托车。"},
    "ch05-105": {"text": "摩托车越来越快。"},
    "ch05-106": {"text": "很快，它们装上了亮亮的整流罩，就是那种光滑的塑料外壳，可以划开风。"},
    "ch05-107": {"text": "1990年，一辆叫 Kawasaki ZX-11 的日本摩托车成了世界上最快的摩托车。"},
    "ch05-108": {"text": "它的速度可以接近每小时175英里。"},
    "ch05-109": {"text": "几年后，Suzuki Hayabusa 跑得更快。"},
    "ch05-110": {"text": "它跑到了每小时194英里。"},
    "ch05-111": {"text": "这比今天路上大多数汽车都快。"},

    # Chapter 6
    "ch06-112": {"text": "第六章 — 各种各样的摩托车"},
    "ch06-113": {"text": "今天的摩托车有很多样子。"},
    "ch06-114": {"text": "每一种都是为不同的活儿造的。"},
    "ch06-115": {"text": "运动摩托车是为开得很快造的。"},
    "ch06-116": {"text": "它又轻又低。"},
    "ch06-117": {"text": "骑手身体往前趴。"},
    "ch06-118": {"text": "运动摩托车是为光滑的路和赛道造的。"},
    "ch06-119": {"text": "越野摩托车是为泥地和土路造的。"},
    "ch06-120": {"text": "它的轮子很高，轮胎很大。"},
    "ch06-121": {"text": "越野摩托车可以跳过小山包。"},
    "ch06-122": {"text": "很多年轻骑手是先在越野摩托车上学的。"},
    "ch06-123": {"text": "巡航摩托车又长又低。"},
    "ch06-124": {"text": "骑手坐得直直的，慢慢地骑。"},
    "ch06-125": {"text": "Harley-Davidson 以巡航摩托车出名。",
                 "tts": "哈雷戴维森 以巡航摩托车出名。"},
    "ch06-126": {"text": "Indian 也是。",
                 "tts": "印第安 也是。"},
    "ch06-127": {"text": "冒险摩托车是为长途旅行造的。"},
    "ch06-128": {"text": "它能在公路上骑，也能在土路上骑。"},
    "ch06-129": {"text": "BMW GS 是一辆很有名的冒险摩托车。"},
    "ch06-130": {"text": "KTM 也是。"},
    "ch06-131": {"text": "还有斩车、踏板车、赛车和电动摩托车。"},
    "ch06-132": {"text": "几乎每一种路，都有一种摩托车。"},
    "ch06-133": {"text": "今天，世界上每一个国家都能找到摩托车。"},

    # Chapter 7
    "ch07-134": {"text": "第七章 — 一条新路"},
    "ch07-135": {"text": "今天，摩托车有了一种新的发动机。"},
    "ch07-136": {"text": "那就是电动机。"},
    "ch07-137": {"text": "电动摩托车是安静的。"},
    "ch07-138": {"text": "它不需要汽油。"},
    "ch07-139": {"text": "它只需要像手机一样插上电。"},
    "ch07-140": {"text": "一家叫 Zero 的公司在加利福尼亚造电动摩托车。",
                 "tts": "一家叫 零 的公司在加利福尼亚造电动摩托车。"},
    "ch07-141": {"text": "Harley-Davidson 现在也造一种电动摩托车，叫 LiveWire。",
                 "tts": "哈雷戴维森 现在也造一种电动摩托车，叫 活线。"},
    "ch07-142": {"text": "一家叫 Energica 的意大利公司造电动赛车。",
                 "tts": "一家叫 埃涅尔吉卡 的意大利公司造电动赛车。"},
    "ch07-143": {"text": "它们非常快。"},
    "ch07-144": {"text": "第一辆摩托车 Reitwagen，速度只有每小时7英里。"},
    "ch07-145": {"text": "今天的电动摩托车，速度可以超过每小时200英里。"},
    "ch07-146": {"text": "这就是到目前为止摩托车的故事。"},
    "ch07-147": {"text": "这是大故事。"},
    "ch07-148": {"text": "接下来的十一本书，会讲一些小故事。"},
    "ch07-149": {"text": "每一本都讲摩托车世界里的一个部分。"},
    "ch07-150": {"text": "第二册讲 Harley-Davidson。",
                 "tts": "第二册讲 哈雷戴维森。"},
    "ch07-151": {"text": "第三册讲 Honda。",
                 "tts": "第三册讲 本田。"},
    "ch07-152": {"text": "第四册讲意大利的 Ducati。",
                 "tts": "第四册讲意大利的 杜卡迪。"},
    "ch07-153": {"text": "第五册讲德国的 BMW。",
                 "tts": "第五册讲德国的 宝马。"},
    "ch07-154": {"text": "第六册讲英国的 Triumph。",
                 "tts": "第六册讲英国的 凯旋。"},
    "ch07-155": {"text": "第七册讲越野摩托车。"},
    "ch07-156": {"text": "第八册讲运动摩托车。"},
    "ch07-157": {"text": "第九册讲巡航车和斩车。"},
    "ch07-158": {"text": "第十册讲冒险摩托车。"},
    "ch07-159": {"text": "第十一册讲赛车。"},
    "ch07-160": {"text": "第十二册讲电动摩托车和未来。"},
    "ch07-161": {"text": "选一本你觉得最好玩的。"},
    "ch07-162": {"text": "然后跟着一起来骑车吧。"},

    # Backmatter
    "ch07-163": {"text": "关于这本书"},
    "ch07-164": {"text": "这是“摩托车”系列的第一本书。"},
    "ch07-165": {"text": "由 August 朗读。"},
    "ch07-166": {"text": "每一句话都很短、很清楚，所以你可以用任何语言一边读一边听。"},
    "ch07-167": {"text": "如果你想听一句话用别的语言怎么说，就听同一本书的另一种语言版本。"},
    "ch07-168": {"text": "纸上的字会和你听到的对上。"},
    "ch07-169": {"text": "这就是学语言的方法。"},
    "ch07-170": {"text": "现在去找一辆摩托车，听一听它“呜呜”地响吧。",
                 "tts": "现在去找一辆摩托车，听一听它 呜呜 地响吧。"},
}


# ---------------------------------------------------------------------------
# tts.text builder
# ---------------------------------------------------------------------------

def apply_zh_phonetics(text: str, phonetics: dict[str, str]) -> str:
    """Replace brand names + spell out every digit run for tts.text."""
    out = text

    # 1. Brand-name substitutions, longest first
    for key in sorted(phonetics.keys(), key=len, reverse=True):
        # Word-boundary aware: avoid replacing inside an existing match.
        # Latin keys: ensure no surrounding letters.
        if any(c.isascii() and c.isalpha() for c in key):
            pattern = re.compile(rf"(?<![A-Za-z0-9]){re.escape(key)}(?![A-Za-z0-9])")
        else:
            pattern = re.compile(re.escape(key))
        out = pattern.sub(phonetics[key], out)

    # 2. Decades: 1960年代 → 一九六零年代
    out = re.sub(
        r"(1[89]\d{2}|20\d{2})年代",
        lambda m: _spell_decade_zh(m.group(1)),
        out,
    )

    # 3. Years: 1885年 → 一八八五年
    out = re.sub(
        r"(1[789]\d{2}|20\d{2})年",
        lambda m: _spell_year_zh(m.group(1)),
        out,
    )

    # 4. Bare integers — 7, 120, 175, 194, 200, 750
    out = re.sub(
        r"\d+",
        lambda m: _spell_cardinal_zh(int(m.group(0))),
        out,
    )

    # 5. Strip ASCII dashes and em-dashes from tts only
    out = out.replace("—", " ").replace("-", " ")

    # 6. Collapse multiple spaces
    out = re.sub(r"\s+", " ", out).strip()
    return out


def main():
    en_data = json.loads(EN_SEGMENTS.read_text(encoding="utf-8"))

    out_segments = []
    missing = []
    divergent_count = 0
    divergent_breakdown = {"year": 0, "decade": 0, "cardinal": 0, "brand": 0, "punctuation": 0}

    for en_seg in en_data["segments"]:
        sid = en_seg["id"]
        if sid not in T:
            missing.append(sid)
            continue

        zh = T[sid]
        seg = {
            "id": en_seg["id"],
            "part": en_seg.get("part", 0),
            "chapter": en_seg.get("chapter", 0),
            "title": zh["text"] if en_seg.get("block_type") == "heading" and en_seg.get("heading_level") in (1, 2, 3) else en_seg.get("title", ""),
            "paragraph_id": en_seg["paragraph_id"],
            "sentence_index": en_seg["sentence_index"],
            "block_type": en_seg["block_type"],
        }
        if "heading_level" in en_seg:
            seg["heading_level"] = en_seg["heading_level"]

        seg["text"] = zh["text"]
        seg["text_markdown"] = zh["text"]

        # Headings: no tts block, matching EN/FR convention
        if en_seg.get("block_type") == "heading":
            out_segments.append(seg)
            continue

        # Build tts.text
        if "tts" in zh:
            tts_text = zh["tts"]
            # Still apply the digit spell-out to override-supplied tts
            tts_text = apply_zh_phonetics(tts_text, ZH_PHONETICS)
        else:
            tts_text = apply_zh_phonetics(zh["text"], ZH_PHONETICS)

        # Track divergence
        if tts_text != zh["text"]:
            divergent_count += 1
            display = zh["text"]
            if re.search(r"\d{4}年代", display):
                divergent_breakdown["decade"] += 1
            elif re.search(r"\d{4}年", display):
                divergent_breakdown["year"] += 1
            elif re.search(r"\d", display):
                divergent_breakdown["cardinal"] += 1
            elif any(b in display for b in ("BMW", "Harley", "Honda", "Triumph", "Ducati", "Yamaha", "Suzuki", "Kawasaki", "MV Agusta", "Indian", "LiveWire", "Energica", "Reitwagen", "Zero", "GS", "WLA", "KTM", "Norton", "Royal Enfield")):
                divergent_breakdown["brand"] += 1
            else:
                divergent_breakdown["punctuation"] += 1

        seg["tts"] = {
            "text": tts_text,
            "pause_after_ms": en_seg["tts"]["pause_after_ms"],
            "repetition_penalty": en_seg["tts"]["repetition_penalty"],
        }

        out_segments.append(seg)

    if missing:
        raise RuntimeError(f"Missing translations for: {missing}")

    out_data = {
        "version": en_data["version"],
        "book_id": en_data["book_id"],
        "language": "zh",
        "total_segments": len(out_segments),
        "segments": out_segments,
    }

    OUT_SEGMENTS.write_text(
        json.dumps(out_data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    OUT_PHONETICS.write_text(
        json.dumps(ZH_PHONETICS, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(f"Wrote {len(out_segments)} segments to {OUT_SEGMENTS}")
    print(f"Wrote {len(ZH_PHONETICS)} phonetics entries to {OUT_PHONETICS}")
    print(f"Divergent (tts != text): {divergent_count}")
    print(f"Divergent breakdown: {divergent_breakdown}")


if __name__ == "__main__":
    main()
