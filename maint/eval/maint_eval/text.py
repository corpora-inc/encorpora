"""Small text helpers: content stems for overlap measures, sentence splitting, number/step/requirement tests."""
from __future__ import annotations

import re

STOP = set("""a an the and or but if then else of to in on at by for with from into onto over under is are was were be been
being it its it's this that these those there here i me my we our you your he she they them his her their what which who
whom when where why how not no nor do does did done have has had can could would should will shall may might must just so
than too very up down out off again also only own same such both each few more most other some any all as about after
before while because until keep keeps kept get gets got im i'm dont don't doesnt doesn't wont won't cant can't isnt isn't
thing stuff like says said say saying showing shows show""".split())

WORD_RE = re.compile(r"[a-z0-9]+(?:'[a-z]+)?")


def stem(w: str) -> str:
    for suf in ("ations", "ation", "ings", "ing", "edly", "ed", "es", "s", "ly"):
        if len(w) > len(suf) + 2 and w.endswith(suf):
            return w[: -len(suf)]
    return w


def content_stems(text: str) -> list[str]:
    return [stem(w) for w in WORD_RE.findall((text or "").lower()) if w not in STOP and len(w) > 1]


def jaccard(a: str, b: str) -> float:
    x, y = set(content_stems(a)), set(content_stems(b))
    if not x or not y:
        return 0.0
    return len(x & y) / len(x | y)


def containment(a: str, b: str) -> float:
    """Share of a's content stems that appear in b."""
    x, y = set(content_stems(a)), set(content_stems(b))
    return len(x & y) / len(x) if x else 0.0


def bigrams(text: str) -> set[tuple[str, str]]:
    s = content_stems(text)
    return set(zip(s, s[1:]))


SENT_SPLIT = re.compile(r"(?<=[.!?:])\s+(?=[A-Z0-9(\"'“])")
LIST_MARK = re.compile(r"^(?:\(?\d{1,2}[.)]|\(?[a-z][.)]|[-*•])\s+")


def sentences(text: str) -> list[str]:
    """Sentences of a manual text. Lines are joined first (PDF text breaks mid-sentence); a list
    number alone ('1.') is dropped; a list marker at a sentence's start is removed."""
    flat = " ".join((text or "").split())
    out = []
    for s in SENT_SPLIT.split(flat):
        s = LIST_MARK.sub("", s.strip())
        if len(s) >= 4 and re.search(r"[A-Za-z]", s):
            out.append(s)
    return out


def norm_sentence(s: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", (s or "").lower()))


NUM_WORDS = r"(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|thousand|half|quarter|once|twice)"
HAS_NUMBER = re.compile(rf"\d|\b{NUM_WORDS}\b", re.I)
REQUIREMENT = re.compile(r"\b(must|shall|should|required|requires?|need(?:s|ed)? to|have to|has to|never|always|do not|don't|make sure|ensure)\b", re.I)
# A connecting line that tells the technician to do something states a step.
STEP_VERBS = re.compile(r"^(?:then\s+|next,?\s+|first,?\s+|now\s+)?(check|measure|replace|remove|install|set|turn|disconnect|connect|"
                        r"tighten|loosen|adjust|clean|test|inspect|calibrate|reboot|restart|update|charge|press|pull|push|open|close|"
                        r"apply|verify|ensure|make|go|use|try|run|switch|move|reset|repeat|re-?do|do|perform|start|stop)\b", re.I)


def states_number(s: str) -> bool:
    return bool(HAS_NUMBER.search(s or ""))


def states_requirement(s: str) -> bool:
    return bool(REQUIREMENT.search(s or ""))


def states_step(s: str) -> bool:
    s = (s or "").strip()
    if STEP_VERBS.search(s):
        return True
    return bool(re.search(r"\b(you (?:should|need to|must|can|could|have to)|step \w+|first|then|next)\b", s, re.I))
