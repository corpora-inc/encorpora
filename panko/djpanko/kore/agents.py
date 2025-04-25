from dataclasses import dataclass
from typing import List, Optional, Literal

from pydantic import BaseModel
from corpora_ai.provider_loader import load_llm_provider
from corpora_ai.llm_interface import ChatCompletionTextMessage


from kore.models import Jamo, HangulSyllable, Word, Definition, Sentence

# ---------------------------------------------------------------------------
# Initialize XAI provider via corpora_ai wrapper
# ---------------------------------------------------------------------------
llm = load_llm_provider("xai")  # uses XAI's grok under the hood


# ---------------------------------------------------------------------------
# Pydantic Schemas for structured agent outputs
# ---------------------------------------------------------------------------
class JamoEntry(BaseModel):
    char: str
    unicode_codepoint: str
    jamo_type: Literal["L", "V", "T"]


class SyllableEntry(BaseModel):
    syllable: str
    codepoint: str
    initial: str
    medial: str
    final: Optional[str]


class VocabEntry(BaseModel):
    text_korean: str
    romanization: str
    pronunciation: str
    part_of_speech: str
    frequency_rank: Optional[int]
    definitions: List[str]


class SentenceEntry(BaseModel):
    text_korean: str
    text_english: str
    word_list: List[str]


# Response wrappers for list outputs
class JamoResponse(BaseModel):
    entries: List[JamoEntry]


class SyllableResponse(BaseModel):
    entries: List[SyllableEntry]


class VocabResponse(BaseModel):
    entries: List[VocabEntry]


class SentenceResponse(BaseModel):
    entries: List[SentenceEntry]


# ---------------------------------------------------------------------------
# KoreanDBService encapsulates ORM persistence
# ---------------------------------------------------------------------------
@dataclass
class KoreanDBService:
    def save_jamo(self, entries: List[JamoEntry]) -> None:
        for e in entries:
            Jamo.objects.update_or_create(
                char=e.char,
                defaults={
                    "unicode_codepoint": e.unicode_codepoint,
                    "jamo_type": e.jamo_type,
                },
            )

    def save_syllables(self, entries: List[SyllableEntry]) -> None:
        for e in entries:
            HangulSyllable.objects.update_or_create(
                syllable=e.syllable,
                defaults={
                    "codepoint": e.codepoint,
                    "initial": Jamo.objects.get(char=e.initial),
                    "medial": Jamo.objects.get(char=e.medial),
                    "final": Jamo.objects.filter(char=e.final).first(),
                },
            )

    def save_vocab(self, entries: List[VocabEntry]) -> None:
        for e in entries:
            w, _ = Word.objects.update_or_create(
                text_korean=e.text_korean,
                defaults={
                    "romanization": e.romanization,
                    "pronunciation": e.pronunciation,
                    "part_of_speech": e.part_of_speech,
                    "frequency_rank": e.frequency_rank,
                },
            )
            w.definitions.all().delete()
            for def_text in e.definitions:
                Definition.objects.create(word=w, language="en", text=def_text)

    def save_sentences(self, level: str, entries: List[SentenceEntry]) -> None:
        for e in entries:
            s, _ = Sentence.objects.get_or_create(
                text_korean=e.text_korean, defaults={"text_english": e.text_english}
            )
            for lemma in e.word_list:
                try:
                    w = Word.objects.get(text_korean=lemma)
                    s.words.add(w)
                except Word.DoesNotExist:
                    continue


# ---------------------------------------------------------------------------
# Fetch functions using corpora_ai wrapper
# ---------------------------------------------------------------------------
def fetch_jamo() -> List[JamoEntry]:
    messages = [
        ChatCompletionTextMessage(
            role="system",
            text="List all modern Korean jamo (initials, medials, finals) with glyph, Unicode codepoint (e.g. U+1100), and type flag L/V/T.",
        ),
        ChatCompletionTextMessage(role="user", text=""),
    ]
    resp = llm.get_data_completion(messages, JamoResponse)
    return resp.entries


def fetch_syllables() -> List[SyllableEntry]:
    messages = [
        ChatCompletionTextMessage(
            role="system",
            text="Generate ~2350 common modern Hangul syllables with glyph, codepoint, and component jamo (initial, medial, final).",
        ),
        ChatCompletionTextMessage(role="user", text=""),
    ]
    resp = llm.get_data_completion(messages, SyllableResponse)
    return resp.entries


def fetch_vocabulary(batch: int) -> List[VocabEntry]:
    start, end = batch * 1000 + 1, (batch + 1) * 1000
    messages = [
        ChatCompletionTextMessage(
            role="system",
            text=f"Return vocabulary entries {start}–{end} by frequency: Korean word, romanization, IPA, POS, rank, definitions.",
        ),
        ChatCompletionTextMessage(role="user", text=""),
    ]
    resp = llm.get_data_completion(messages, VocabResponse)
    return resp.entries


def fetch_sentences(level: str) -> List[SentenceEntry]:
    messages = [
        ChatCompletionTextMessage(
            role="system",
            text=f"Generate 500 CEFR level {level} example sentences: Korean text, English translation, list of headwords.",
        ),
        ChatCompletionTextMessage(role="user", text=""),
    ]
    resp = llm.get_data_completion(messages, SentenceResponse)
    return resp.entries


# ---------------------------------------------------------------------------
# High-level pipelines combining fetch + save
# ---------------------------------------------------------------------------


def run_jamo_pipeline():
    deps = KoreanDBService()
    deps.save_jamo(fetch_jamo())


def run_syllable_pipeline():
    deps = KoreanDBService()
    deps.save_syllables(fetch_syllables())


def run_vocab_pipeline(batch: int):
    deps = KoreanDBService()
    deps.save_vocab(fetch_vocabulary(batch))


def run_sentence_pipeline(level: str):
    deps = KoreanDBService()
    deps.save_sentences(level, fetch_sentences(level))
