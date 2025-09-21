# tests/test_split.py
from cor.utils.split import split_into_utterances


def T(text, expected, lang="en"):
    assert split_into_utterances(text) == expected


def test_chinese_semicolon():
    # Chinese fullwidth semicolon (； U+FF1B)
    s = "無名天地之始；有名萬物之母。"
    split = ["無名天地之始；", "有名萬物之母。"]
    T(s, split, lang="zh-Hans")


def test_basic_english():
    T("Hello world. How are you?", ["Hello world.", "How are you?"])
    T("Wow! Really?", ["Wow!", "Really?"])


def test_semicolon_global_split():
    # We split on ';' globally (over-splitting preferred)
    T("This; that; those.", ["This;", "that;", "those."])


def test_whitespace_collapse():
    T("Hello   world.  Next\tline?", ["Hello world.", "Next line?"])


def test_no_terminators_single_chunk():
    T("Just a line with no stops", ["Just a line with no stops"])
    T("  lots   of   spaces  ", ["lots of spaces"])


def test_multiple_terminators_stack():
    T("Really?!! Wow!!! Okay...", ["Really?!!", "Wow!!!", "Okay..."])


def test_line_breaks_poetry():
    text = "line one\nline two\n\nline four"
    # blank line is ignored; lines act as boundaries
    T(text, ["line one", "line two", "line four"])


def test_greek_semicolon_question():
    # Greek uses ';' as a question mark — we split globally anyway.
    T("Τι κάνεις; Καλά!", ["Τι κάνεις;", "Καλά!"], lang="el")


def test_cjk():
    # Chinese/Japanese/Korean full stops and marks
    T("你好嗎？我很好。太好了！", ["你好嗎？", "我很好。", "太好了！"], lang="zh-Hans")
    T(
        "今日は良い天気ですね。散歩に行きますか？",
        ["今日は良い天気ですね。", "散歩に行きますか？"],
        lang="ja",
    )
    T(
        "안녕하세요. 만나서 반가워요!",
        ["안녕하세요.", "만나서 반가워요!"],
        lang="ko-polite",
    )


def test_arabic_persian():
    # Arabic question mark (؟) and Arabic semicolon (؛)
    T("كيف حالك؟ أنا بخير.", ["كيف حالك؟", "أنا بخير."])
    T("قال الرجل؛ ثم ذهب.", ["قال الرجل؛", "ثم ذهب."])


def test_devanagari_danda():
    # Danda (।) and double danda (॥)
    T("यह एक वाक्य है। यह दूसरा वाक्य है॥", ["यह एक वाक्य है।", "यह दूसरा वाक्य है॥"], lang="hi")


def test_armenian():
    # Armenian full stop, question, exclamation
    T(
        "Բարեւ ձեզ։ Ինչպե՞ս եք։ Լավ եմ՜",
        ["Բարեւ ձեզ։", "Ինչպե՞ս եք։", "Լավ եմ՜"],
        lang="hy",
    )


def test_khmer():
    T(
        "នេះជាប្រយោគមួយ។ នេះជាប្រយោគទាំងពីរ ៕",
        ["នេះជាប្រយោគមួយ។", "នេះជាប្រយោគទាំងពីរ ៕"],
        lang="km",
    )


def test_myanmar():
    T("မင်္ဂလာပါ။ ကောင်းပါတယ်။", ["မင်္ဂလာပါ။", "ကောင်းပါတယ်။"], lang="my")


def test_tibetan():
    T("བོད་སྐད་ཡིན། དེ་འདྲ༎", ["བོད་སྐད་ཡིན།", "དེ་འདྲ༎"], lang="bo")


def test_ethiopic():
    T("እንዴት ነህ፧ ጥፋት የለም።", ["እንዴት ነህ፧", "ጥፋት የለም።"], lang="am")
