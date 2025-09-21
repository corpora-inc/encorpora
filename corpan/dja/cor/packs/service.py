from typing import List, Tuple, Dict, Optional
from django.db import transaction
from corpora_ai.provider_loader import load_llm_provider

from cor.models import Language, Entry, Pack, PackEntry, Translation
from cor.utils.split import split_into_utterances
from cor.utils.llm_source import translate_source_to_english_batch
from cor.utils.llm import translate_entry_batch  # EN -> target

DEFAULT_BATCH_SIZE = 40


def create_pack_from_text(
    text: str,
    source_lang_code: str,
    title: str = "",
    narrator=None,
    llm_provider: str = "openai",
    default_level: str = "A1",
    batch_size: int = DEFAULT_BATCH_SIZE,
    skip_source_redundant: bool = False,  # kept for API, source is always excluded below
    dry_run: bool = True,
) -> Optional[Pack]:
    """
    Split → SOURCE→EN (batched) → (optionally) persist Pack/Entries + SOURCE translations →
    EN→all other targets (batched per language).

    - dry_run=True: no DB writes; prints pivot EN and previews per-language output.
    - dry_run=False: writes Pack/Entries/PackEntries, saves SOURCE translations, then fan-out to other languages.
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

    # Always exclude EN and SOURCE from fan-out
    target_codes = [
        lng.code for lng in langs if lng.code not in ("en", source_lang_code)
    ]

    if dry_run:
        # Preview only: do not write anything
        print(f"\n[PREVIEW {source_lang_code}] (source texts that would be saved):")
        for idx, src in enumerate(utterances, start=1):
            print(f"{idx:>3}: {src.strip()}")

        temp_entries_payload: List[Tuple[int, str]] = [
            (i, s) for i, s in enumerate(en_texts, start=1)
        ]
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

    # 2) Persist Pack + Entries + PackEntries + SOURCE translations
    source_language = code2lang[source_lang_code]
    with transaction.atomic():
        pack = Pack.objects.create(title=title, narrator=narrator)
        ordered_entries: List[Entry] = []
        for order, (en_text, src_text) in enumerate(zip(en_texts, utterances), start=1):
            entry, _ = Entry.objects.get_or_create(
                en_text=en_text, defaults={"level": default_level}
            )
            # Save/ensure SOURCE translation attached to this Entry
            tr, created_tr = Translation.objects.get_or_create(
                entry=entry,
                language=source_language,
                defaults={"text": src_text.strip()},
            )
            if not created_tr and tr.text != src_text.strip():
                tr.text = src_text.strip()
                tr.save(update_fields=["text"])
            ordered_entries.append(entry)
            PackEntry.objects.create(pack=pack, entry=entry, order=order)

    # 3) Fan-out EN -> all other targets (reuse existing batch tool)
    entries_payload: List[Tuple[int, str]] = [
        (e.id, e.en_text) for e in ordered_entries
    ]
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
        f"\n[done] Pack '{title or pack.id}' created with {len(ordered_entries)} entries; "
        f"source '{source_lang_code}' translations saved and fan-out completed."
    )
    return pack
