#!/usr/bin/env python3
"""
Fix Chinese tts.text fields in segments_zh.json:
  1. Convert all Arabic numerals to Chinese characters
  2. Simplify overly long/complex sentences for TTS clarity

Only modifies tts.text — leaves text and text_markdown unchanged.
"""

import json
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
SEGMENTS_PATH = SCRIPT_DIR.parent / "01-mystery-of-monte-alban" / "pack" / "segments_zh.json"

# ---------------------------------------------------------------------------
# Number conversion
# ---------------------------------------------------------------------------

DIGIT_MAP = {
    "0": "零", "1": "一", "2": "二", "3": "三", "4": "四",
    "5": "五", "6": "六", "7": "七", "8": "八", "9": "九",
}


def digits_to_chinese(s: str) -> str:
    """Convert digit string to Chinese digit-by-digit (for years)."""
    return "".join(DIGIT_MAP[c] for c in s)


def int_to_chinese(n: int) -> str:
    """Convert integer to standard Chinese quantity reading.
    e.g. 260 → 二百六十, 1400 → 一千四百, 52 → 五十二
    """
    if n == 0:
        return "零"

    parts = []

    if n >= 10000:
        wan = n // 10000
        parts.append(int_to_chinese(wan) + "万")
        n %= 10000
        if 0 < n < 1000:
            parts.append("零")

    if n >= 1000:
        qian = n // 1000
        parts.append(DIGIT_MAP[str(qian)] + "千")
        n %= 1000
        if 0 < n < 100:
            parts.append("零")

    if n >= 100:
        bai = n // 100
        parts.append(DIGIT_MAP[str(bai)] + "百")
        n %= 100
        if 0 < n < 10:
            parts.append("零")

    if n >= 10:
        shi = n // 10
        # 十 not 一十 for standalone tens at start
        if shi == 1 and not parts:
            parts.append("十")
        else:
            parts.append(DIGIT_MAP[str(shi)] + "十")
        n %= 10

    if n > 0:
        parts.append(DIGIT_MAP[str(n)])

    return "".join(parts)


def convert_numbers_in_text(text: str) -> str:
    """Apply contextual number-to-Chinese conversion rules."""

    # 1. Year ranges with dash: 1896-1970 → 一八九六至一九七零
    #    Also handles: 公元前500-100年, 公元前100-公元200年
    def replace_year_range(m):
        prefix = m.group(1) or ""
        a = m.group(2)
        mid = m.group(3)  # could be "-公元" or just "-"
        b = m.group(4)
        suffix = m.group(5) or ""

        # Convert mid section
        mid_cn = mid.replace("-", "至").replace("—", "至")

        # Decide reading: if 4-digit, digit-by-digit (year); else quantity
        if len(a) == 4:
            a_cn = digits_to_chinese(a)
        else:
            a_cn = int_to_chinese(int(a))
        if len(b) == 4:
            b_cn = digits_to_chinese(b)
        else:
            b_cn = int_to_chinese(int(b))

        return prefix + a_cn + mid_cn + b_cn + suffix

    # Match ranges like: (公元前?)(\d+)(-公元?|-|—)(\d+)(年|年代)?
    text = re.sub(
        r"(公元前?)(\d+)([-—](?:公元)?)(\d+)(年代|年)?",
        replace_year_range,
        text,
    )

    # 2. Centuries: 20世纪 → 二十世纪, 16世纪 → 十六世纪
    def replace_century(m):
        n = int(m.group(1))
        return int_to_chinese(n) + "世纪"
    text = re.sub(r"(\d+)世纪", replace_century, text)

    # 3. Decades: 50年代 → 五十年代
    def replace_decade(m):
        n = int(m.group(1))
        return int_to_chinese(n) + "年代"
    text = re.sub(r"(\d+)年代", replace_decade, text)

    # 4. Month: 1月 → 一月
    def replace_month(m):
        n = int(m.group(1))
        return int_to_chinese(n) + "月"
    text = re.sub(r"(\d+)月", replace_month, text)

    # 5. Day: 9日 → 九日
    def replace_day(m):
        n = int(m.group(1))
        return int_to_chinese(n) + "日"
    text = re.sub(r"(\d+)日", replace_day, text)

    # 6. 第N号 → 第三十四号
    def replace_ordinal(m):
        n = int(m.group(1))
        return "第" + int_to_chinese(n) + "号"
    text = re.sub(r"第(\d+)号", replace_ordinal, text)

    # 7. N天 → 二百六十天
    def replace_days(m):
        n = int(m.group(1))
        return int_to_chinese(n) + "天"
    text = re.sub(r"(\d+)天", replace_days, text)

    # 8. Years: 1975年 → 一九七五年 (4-digit, digit-by-digit)
    #    and 公元(前?)N年 → quantity reading for historical dates
    def replace_year(m):
        prefix = m.group(1) or ""
        num_str = m.group(2)
        # 4-digit years after 公元/公元前: digit-by-digit
        if len(num_str) == 4:
            return prefix + digits_to_chinese(num_str) + "年"
        else:
            return prefix + int_to_chinese(int(num_str)) + "年"
    text = re.sub(r"(公元前?)?(\d+)年", replace_year, text)

    # 9. Catch any remaining bare numbers (shouldn't be many)
    def replace_remaining(m):
        num_str = m.group(0)
        if len(num_str) >= 4:
            return digits_to_chinese(num_str)
        else:
            return int_to_chinese(int(num_str))
    text = re.sub(r"\d+", replace_remaining, text)

    return text


# ---------------------------------------------------------------------------
# Manual rewrites for overly long/complex segments
# ---------------------------------------------------------------------------

# tts.text overrides for segments that need structural simplification
# (not just number conversion). Only the most problematic ones.
MANUAL_TTS_REWRITES = {
    # ch07-458 already rewritten in a previous edit — skip here
    'ch02-117': (
        '另一些人指向墨西哥湾沿岸奥尔梅克地区的雕刻。'
        '其中最著名的是卡斯卡哈尔石板，一块在奥尔梅克核心地带附近发现的蛇纹石碑。'
        '一些研究者认为它的年代在公元前九百年之前。这个问题至今仍未定论。'
    ),
    'ch07-475': (
        '萨波特克文字不像印度河流域文字那样难以破解。'
        '印度河流域文字是古代巴基斯坦和印度西北部的一种未破译文字，'
        '大约存在于公元前二千六百年至一千九百年间。'
        '没有人知道那里的人们说什么语言，'
        '而且留存的文本极短，大多不超过五个符号，几乎无法进行统计分析。'
    ),
    'ch07-478': (
        '萨波特克文字也不像线形文字A那样神秘。'
        '线形文字A是米诺斯克里特岛的文字，大约存在于公元前一千八百年至一千四百五十年间。'
        '它后来被线形文字B取代。一九五二年，迈克尔·文特里斯破译了线形文字B，'
        '证明其记录的是一种早期希腊语。'
    ),
    'ch10-638': (
        '在研究者称为\u201c瓦哈卡街区\u201d的区域，位于这座大城市的西部，'
        '考古学家发现了萨波特克风格的陶器、萨波特克的丧葬习俗，'
        '还有一块刻有萨波特克字符的石板。'
        '这证明有一个瓦哈卡人社区长期居住在特奥蒂瓦坎，他们可能是商人、外交官或使节。'
    ),
    'ch09-578': (
        '二零一八年，墨西哥国家人类学与历史研究所的研究人员宣布了一项重要发现。'
        '他们在阿措姆帕发现了一面刻有萨波特克字符的大型灰泥浮雕壁画。'
        '阿措姆帕是蒙特阿尔班西北约一公里处的一个山顶遗址，'
        '在城市鼎盛时期曾是一个卫星社区。'
    ),
    'ch15-981': (
        '考古学家将蒙特阿尔班的历史划分为几个阶段。'
        '第一期为公元前五百年至一百年。'
        '第二期为公元前一百年至公元二百年。'
        '第三A期为二百年至五百年。'
        '第三B期为五百年至八百年。'
        '第四期为八百年至一千三百年。'
        '第五期为一千三百年至一千五百二十一年。'
    ),
    'ch12-750': (
        '大约在十四或十五世纪，城市被废弃约五百年后，'
        '米斯特克精英重新打开了这座萨波特克墓穴。'
        '他们清除了部分原始葬品，将自己的死者安放其中，'
        '并随葬了美洲考古史上最壮观的陪葬品之一。'
    ),
    'ch13-827': (
        '仔细观察教堂的墙壁，可以看到前哥伦布时期的雕刻石块嵌在殖民时期的砌体中。'
        '一个世界的碎片被用来建造另一个世界。'
        '几个世纪前，萨波特克人自己也曾这样重新利用蒙特阿尔班的\u201c舞者\u201d石板。'
    ),
    'ch04-245': (
        '走过现代瓦哈卡市的贝尼托·华雷斯市场，距蒙特阿尔班仅三十分钟车程。'
        '你会看到成篮的蚂蚱、论勺卖的龙舌兰虫、手工拍打后烤熟的新鲜玉米饼，'
        '还有七种可以追溯数百年的莫莱酱。'
    ),
    'ch09-571': (
        '在书中，乌尔西德提出了该文字的语素-音节模型，确定了阅读顺序为竖列、从上到下。'
        '他还证明铭文遵循一致的组织规则。'
        '符号之间的排列模式暗示着语法结构，尽管具体的解读仍未可知。'
    ),
    'ch05-355': (
        '如果\u201c舞者\u201d代表蒙特阿尔班建城时期击败的敌人，'
        '他们可能包括来自米斯特卡、墨西哥湾沿岸或卡尼亚达地区的俘虏。'
        '正是这些地区的地名字符出现在几个世纪后J号建筑的征服石板上。'
    ),
    'ch02-111': (
        '在死者的双脚之间，雕刻者放置了一个字符。'
        '两个元素组合起来读作\u201c一地震\u201d或\u201c一运动\u201d。'
        '这可能是此人的历法名，也可能是他的死亡日期。中美洲传统中人们常以出生之日来命名。'
    ),
    'ch09-558': (
        '他辨识出历法符号，区分了日名和年号，识别出J号建筑上征服石板的模式。'
        '他还破译了米斯特克古抄本。这项相关但不同的成就，'
        '使他对中美洲文字系统的运作方式获得了无与伦比的洞见。'
    ),
    'ch02-076': (
        '瓦哈卡谷形如一个弯曲的Y字。'
        '三条支谷在中心汇合：西北方的埃特拉支谷、东面的特拉科卢拉支谷，'
        '以及南边的齐马特兰支谷。蒙特阿尔班的山正是在汇合处拔地而起。'
    ),
    'ch06-395': (
        '一位初次到达蒙特阿尔班的访客，无论是海岸的商人、邻近山谷的使节，'
        '还是新被征服的纳贡者，走进大广场后都会看到J号建筑矗立于中央。'
        '上面布满了蒙特阿尔班军事胜利的雕刻记录。'
    ),
    'ch11-720': (
        '对墨西哥南部洞穴石笋的研究揭示，大约公元七百五十年至九百年间经历了一系列严重干旱。'
        '这不是一次持续的干旱，而是反复出现的降雨极少时段，每次持续数年或数十年。'
    ),
    'ch13-801': (
        '萨波特克人称之为\u201c利约巴\u201d，意为\u201c安息之地\u201d。'
        '后来的阿兹特克人称之为\u201c米克特兰\u201d，即\u201c死者之地\u201d。'
        '西班牙人将其简化为米特拉，这个名字沿用至今。'
    ),
    'ch13-821': (
        '西班牙殖民时期的记载描述这里曾住着一位权势强大的大祭司。'
        '这位被称为\u201c乌伊哈-陶\u201d或\u201c大先知\u201d的人物，'
        '在政治权力碎片化的同时仍在整个萨波特克世界行使着精神权威。'
    ),
    'ch15-961': (
        '卡索，阿方索。一八九六年至一九七零年。墨西哥考古学家。'
        '一九三一年开始系统发掘蒙特阿尔班，一九三二年发现七号墓，'
        '奠定了萨波特克和米斯特克铭文学的基础。'
    ),
    'ch15-999': (
        '马库斯，乔伊斯，和肯特·弗兰纳里合著。'
        '《萨波特克文明：城市社会如何在墨西哥瓦哈卡谷演化》。'
        '泰晤士与哈德逊，一九九六年。'
        '这是关于萨波特克历史和考古学最全面、最可读的著作。'
    ),
    'ch15-1000': (
        '弗兰纳里，肯特，和乔伊斯·马库斯合著。'
        '《不平等的创造》。哈佛大学出版社，二零一二年。'
        '虽非专门论述蒙特阿尔班，但将其作为复杂社会发展的关键案例。'
    ),
    'ch15-1001': (
        '科，迈克尔，和雷克斯·孔茨。'
        '《墨西哥：从奥尔梅克到阿兹特克》。泰晤士与哈德逊，第七版，二零一三年。'
        '对所有中美洲文明的出色概述，对瓦哈卡有详细覆盖。'
    ),
    'ch15-1004': (
        '马库斯，乔伊斯。'
        '《中美洲文字系统》。普林斯顿大学出版社，一九九二年。'
        '将萨波特克文字与玛雅、米斯特克和阿兹特克文字进行比较研究。'
    ),
}


def main():
    with open(SEGMENTS_PATH, "r") as f:
        data = json.load(f)

    changed = 0
    numeral_fixed = 0
    manual_fixed = 0

    for seg in data["segments"]:
        tts = seg.get("tts", {})
        old_text = tts.get("text", "")
        if not old_text:
            continue

        seg_id = seg["id"]
        new_text = old_text

        # Apply manual rewrite if available
        if seg_id in MANUAL_TTS_REWRITES:
            new_text = MANUAL_TTS_REWRITES[seg_id]
            manual_fixed += 1
        # Otherwise, just convert numbers
        elif re.search(r"\d", old_text):
            new_text = convert_numbers_in_text(old_text)
            numeral_fixed += 1

        if new_text != old_text:
            tts["text"] = new_text
            changed += 1

            # Show diff
            old_preview = old_text[:80] + ("..." if len(old_text) > 80 else "")
            new_preview = new_text[:80] + ("..." if len(new_text) > 80 else "")
            print(f"  {seg_id}:")
            print(f"    OLD: {old_preview}")
            print(f"    NEW: {new_preview}")
            print()

    # Verify no Arabic numerals remain in any tts.text
    remaining = []
    for seg in data["segments"]:
        tts_text = seg.get("tts", {}).get("text", "")
        if re.search(r"\d", tts_text):
            remaining.append((seg["id"], tts_text))

    if remaining:
        print(f"\nWARNING: {len(remaining)} segments still have Arabic numerals:")
        for sid, txt in remaining:
            nums = re.findall(r"\d+", txt)
            print(f"  {sid}: {nums}")
        print("\nNot saving — fix these first!")
        sys.exit(1)

    # Save
    tmp = SEGMENTS_PATH.with_suffix(".json.tmp")
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    tmp.replace(SEGMENTS_PATH)

    print(f"Done! {changed} segments updated "
          f"({numeral_fixed} numeral conversions, {manual_fixed} manual rewrites)")
    print(f"Saved to {SEGMENTS_PATH}")


if __name__ == "__main__":
    main()
