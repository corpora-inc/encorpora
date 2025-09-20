from typing import List, Tuple, Dict, Optional
from django.db import transaction
from corpora_ai.provider_loader import load_llm_provider

from cor.models import Language, Entry, Pack, PackEntry
from cor.utils.split import split_into_utterances
from cor.utils.llm_source import translate_source_to_english_batch
from cor.utils.llm import translate_entry_batch

DEFAULT_BATCH_SIZE = 40


def create_pack_from_text(
    text: str,
    source_lang_code: str,
    title: str = "",
    narrator=None,
    llm_provider: str = "openai",
    default_level: str = "A1",
    batch_size: int = DEFAULT_BATCH_SIZE,
    skip_source_redundant: bool = False,
    dry_run: bool = True,
) -> Optional[Pack]:
    """
    Split → SOURCE→EN (batched) → (optionally) persist Pack/Entries → EN→all fan-out (batched per language).

    - dry_run=True: no DB writes; prints pivot EN and per-language previews. Returns None.
    - dry_run=False: creates Pack, Entries, PackEntries, and writes translations. Returns the Pack.
    """
    langs = list(Language.objects.all().order_by("code"))
    code2lang: Dict[str, Language] = {lng.code: lng for lng in langs}
    if "en" not in code2lang:
        raise ValueError("Language table must include 'en'.")
    if source_lang_code not in code2lang:
        raise ValueError(f"Unknown source language: {source_lang_code}")

    # 0) Split into utterances (language-agnostic splitter)
    utterances = split_into_utterances(text)
    if not utterances:
        raise ValueError("No utterances detected.")
    print(
        f"[create_pack_from_text] Detected {len(utterances)} utterances from source='{source_lang_code}'."
    )

    llm = load_llm_provider(llm_provider)

    # 1) SOURCE -> EN (batched; returns list aligned to input order)
    en_texts: List[str] = []
    for i in range(0, len(utterances), batch_size):
        chunk = utterances[i : i + batch_size]
        chunk_en = translate_source_to_english_batch(
            src_lang_code=source_lang_code,
            src_lang_name=code2lang[source_lang_code].name,
            sentences=chunk,
            llm=llm,
        )
        if len(chunk_en) != len(chunk):
            raise ValueError("Batch size mismatch in SOURCE→EN translation.")
        en_texts.extend([t.strip() for t in chunk_en])

    # Print pivot EN in order
    print("\n[PIVOT ENGLISH]")
    for idx, line in enumerate(en_texts, start=1):
        print(f"{idx:>3}: {line}")

    if dry_run:
        # Preview only: do not write anything
        temp_entries_payload: List[Tuple[int, str]] = [
            (i, s) for i, s in enumerate(en_texts, start=1)
        ]
        target_codes = [lng.code for lng in langs if lng.code != "en"]
        if skip_source_redundant:
            target_codes = [c for c in target_codes if c != source_lang_code]

        for code in target_codes:
            print(
                f"\n[PREVIEW {code}] Translating {len(temp_entries_payload)} items..."
            )
            tresp = translate_entry_batch(
                lang_code=code, entries=temp_entries_payload, llm=llm, dry_run=True
            )
            for item in tresp.translations:
                print(f"{item.entry_id:>3}: {item.translated_text.strip()}")
        print("\n[dry_run] No database changes were made.")
        return None

    # 2) Persist Pack + Entries + PackEntries
    with transaction.atomic():
        pack = Pack.objects.create(title=title, narrator=narrator)
        ordered_entries: List[Entry] = []
        for order, en_text in enumerate(en_texts, start=1):
            entry, _ = Entry.objects.get_or_create(
                en_text=en_text, defaults={"level": default_level}
            )
            ordered_entries.append(entry)
            PackEntry.objects.create(pack=pack, entry=entry, order=order)

    # 3) Fan-out EN -> all targets (reuse existing batch tool)
    entries_payload: List[Tuple[int, str]] = [
        (e.id, e.en_text) for e in ordered_entries
    ]
    target_codes = [lng.code for lng in langs if lng.code != "en"]
    if skip_source_redundant:
        target_codes = [c for c in target_codes if c != source_lang_code]

    for code in target_codes:
        print(
            f"\n[WRITE {code}] Translating and saving {len(entries_payload)} items..."
        )
        tresp = translate_entry_batch(
            lang_code=code, entries=entries_payload, llm=llm, dry_run=False
        )
        for item in tresp.translations:
            print(
                f"{code} saved: entry_id={item.entry_id} text={item.translated_text.strip()}"
            )

    print(
        f"\n[done] Pack '{title or pack.id}' created with {len(ordered_entries)} entries."
    )
    return pack
