# cor/management/commands/translate_missing.py
import time
import random
import multiprocessing
from typing import List, Tuple, Iterable

from django.core.management.base import BaseCommand
from django.db import close_old_connections

from cor.models import Entry, Language, Translation
from cor.utils.llm import translate_entry_batch
from corpora_ai.provider_loader import load_llm_provider


BATCH_SIZE = 10  # default


def translate_and_save(
    lang: str,
    batch: List[Tuple[int, str]],
    dry_run: bool,
    provider: str,
):
    """
    Worker: translate a (entry_id, en_text) batch to `lang`, then optionally save.
    """
    close_old_connections()
    batch_start = time.time()

    if provider == "local":
        # llm = load_llm_provider("local", completion_model="qwen3-30b-a3b-mlx")
        llm = load_llm_provider("local", completion_model="google/gemma-3-27b")
    elif provider == "xai":
        llm = load_llm_provider("xai")
    elif provider == "openai":
        llm = load_llm_provider("openai")
    elif provider == "claude":
        llm = load_llm_provider("claude")
    else:
        raise ValueError(f"Unknown provider: {provider}")

    print(f"  Translating {len(batch)} entries → '{lang}'...")
    tresp = translate_entry_batch(lang, batch, dry_run=dry_run, llm=llm)
    elapsed = time.time() - batch_start

    for t in tresp.translations:
        print(f'    [{lang}] "{t.translated_text.strip()}" (entry {t.entry_id})')

    if not dry_run:
        language = Language.objects.get(code=lang)
        for t in tresp.translations:
            Translation.objects.get_or_create(
                entry_id=t.entry_id,
                language=language,
                defaults={"text": t.translated_text.strip()},
            )

    print(f"    Batch completed in {elapsed:.2f}s\n")


def _resolve_langs(
    include_en: bool,
    lang: str,
    langs_csv: str,
    max_langs: int,
) -> List[str]:
    """
    Build the language list:
    - default: all languages except 'en'
    - --lang xx : prefix match (keeps old behavior, e.g. 'pt' → 'pt-BR')
    - --langs a,b,c : exact list
    - --include-en to include 'en'
    - --max-langs N to cap the list
    """
    all_codes: List[str] = list(Language.objects.values_list("code", flat=True))
    if not include_en:
        all_codes = [c for c in all_codes if c != "en"]

    if langs_csv:
        wanted = [c.strip() for c in langs_csv.split(",") if c.strip()]
        result = [c for c in all_codes if c in wanted]
    elif lang:
        result = [c for c in all_codes if c.startswith(lang)]
    else:
        result = all_codes

    if max_langs and max_langs > 0:
        result = result[:max_langs]
    return result


def _batched(
    seq: Iterable[Tuple[int, str]], size: int
) -> Iterable[List[Tuple[int, str]]]:
    buf: List[Tuple[int, str]] = []
    for item in seq:
        buf.append(item)
        if len(buf) >= size:
            yield buf
            buf = []
    if buf:
        yield buf


class Command(BaseCommand):
    help = "Fill in missing translations using batch LLM translation. Defaults to all languages (except en)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", default=False)
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Cap how many MISSING translations to process PER LANGUAGE (0 = no cap).",
        )
        parser.add_argument("--batch-size", type=int, default=BATCH_SIZE)
        parser.add_argument("--only-a1", action="store_true", default=False)
        parser.add_argument(
            "--max-langs",
            type=int,
            default=0,
            help="Cap how many languages to process.",
        )
        parser.add_argument(
            "--lang",
            type=str,
            default="",
            help="Single prefix filter (old behavior). Example: --lang pt",
        )
        parser.add_argument(
            "--langs",
            type=str,
            default="",
            help="Comma-separated exact codes. Example: --langs ar,ru,fr",
        )
        parser.add_argument(
            "--include-en",
            action="store_true",
            default=False,
            help="Include English translations (off by default).",
        )
        parser.add_argument("--random", action="store_true", default=False)
        parser.add_argument("--provider", type=str, default="local")
        parser.add_argument(
            "--processes", type=int, default=multiprocessing.cpu_count()
        )

    def handle(self, *args, **opts):
        dry_run = opts["dry_run"]
        limit_per_lang = opts["limit"]
        batch_size = opts["batch_size"]
        only_a1 = opts["only_a1"]
        provider = opts["provider"]
        processes = opts["processes"]
        randomize = opts["random"]

        # Language resolution
        langs = _resolve_langs(
            include_en=opts["include_en"],
            lang=opts["lang"],
            langs_csv=opts["langs"],
            max_langs=opts["max_langs"],
        )
        if not langs:
            self.stdout.write(
                self.style.WARNING("No languages matched. Nothing to do.")
            )
            return

        # Entry scope (global list used for missing detection per language)
        entries_qs = (
            Entry.objects.all().order_by("?")
            if randomize
            else Entry.objects.all().order_by("id")
        )
        if only_a1:
            entries_qs = entries_qs.filter(level="A1")

        # NOTE: We no longer cap entries_qs with --limit here.
        # We need the full scope to count *missing* and then apply --limit to the number of missing per language.
        entries_list: List[Tuple[int, str]] = list(
            entries_qs.values_list("id", "en_text")
        )

        self.stdout.write(
            f"Scope: {len(entries_list)} entries | Languages: {len(langs)} → {langs}"
        )

        total_scheduled = 0
        start_time = time.time()
        pool = multiprocessing.Pool(processes=processes)

        for lang_code in langs:
            language = Language.objects.get(code=lang_code)

            # One query per language to get existing translations for the scoped entries
            existing_ids = set(
                Translation.objects.filter(
                    language=language,
                    entry_id__in=[eid for eid, _ in entries_list],
                ).values_list("entry_id", flat=True)
            )

            # Compute missing pairs for this language
            missing_pairs: List[Tuple[int, str]] = [
                (eid, text) for (eid, text) in entries_list if eid not in existing_ids
            ]

            if not missing_pairs:
                self.stdout.write(f"'{lang_code}': nothing missing.")
                continue

            # Randomize the missing set before limiting, if requested
            if randomize:
                random.shuffle(missing_pairs)

            total_missing = len(missing_pairs)
            if limit_per_lang and limit_per_lang > 0:
                missing_pairs = missing_pairs[:limit_per_lang]

            self.stdout.write(
                self.style.NOTICE(
                    f"'{lang_code}': {total_missing} missing → processing {len(missing_pairs)} "
                    f"(batch size {batch_size})"
                )
            )

            for batch in _batched(missing_pairs, batch_size):
                pool.apply_async(
                    translate_and_save,
                    args=(lang_code, batch, dry_run, provider),
                )
                total_scheduled += len(batch)

        pool.close()
        pool.join()

        elapsed = time.time() - start_time
        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone. Scheduled {total_scheduled} translations across {len(langs)} language(s) in {elapsed:.2f}s"
            )
        )
