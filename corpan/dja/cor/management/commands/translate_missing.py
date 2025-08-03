import time
import multiprocessing
from typing import List, Tuple

from django.core.management.base import BaseCommand
from django.db import close_old_connections

from cor.models import Entry, Language, Translation
from cor.utils.llm import translate_entry_batch
from corpora_ai.provider_loader import load_llm_provider


BATCH_SIZE = 10  # Default


def translate_and_save(
    lang: str, batch: List[Tuple[int, str]], dry_run: bool, provider: str
):
    close_old_connections()
    batch_start = time.time()

    if provider == "local":
        llm = load_llm_provider("local", completion_model="qwen3-30b-a3b-mlx")
    elif provider == "xai":
        llm = load_llm_provider("xai", completion_model="grok-3-mini")
    elif provider == "openai":
        llm = load_llm_provider("openai", completion_model="gpt-4o")
    else:
        raise ValueError(f"Unknown provider: {provider}")

    print(f"  Translating {len(batch)} entries to '{lang}'...")
    tresp = translate_entry_batch(lang, batch, dry_run=dry_run, llm=llm)
    batch_elapsed = time.time() - batch_start

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

    print(f"    Batch completed in {batch_elapsed:.2f}s\n")


class Command(BaseCommand):
    help = "Fill in missing translations for all entries/languages using batch translation."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", default=False)
        parser.add_argument("--limit", type=int, default=0)
        parser.add_argument("--batch-size", type=int, default=BATCH_SIZE)
        parser.add_argument("--only-a1", action="store_true", default=False)
        parser.add_argument("--max-langs", type=int, default=0)
        parser.add_argument("--lang", type=str, default="")
        parser.add_argument("--random", action="store_true", default=False)
        parser.add_argument("--provider", type=str, default="local")
        parser.add_argument(
            "--processes", type=int, default=multiprocessing.cpu_count()
        )

    def handle(self, *args, **opts):
        dry_run = opts["dry_run"]
        limit = opts["limit"]
        batch_size = opts["batch_size"]
        only_a1 = opts["only_a1"]
        language_code = opts["lang"]
        provider = opts["provider"]
        processes = opts["processes"]

        langs: List[str] = list(Language.objects.values_list("code", flat=True))
        if language_code:
            langs = [lang for lang in langs if lang.startswith(language_code)]

        self.stdout.write(
            f"Checking for missing translations for {len(langs)} languages."
        )

        entries = Entry.objects.all().order_by("?" if opts["random"] else "id")
        if only_a1:
            entries = entries.filter(level="A1")
        if limit:
            entries = entries[:limit]

        print(len(entries), "entries to process")

        total_translated = 0
        start_time = time.time()
        pool = multiprocessing.Pool(processes=processes)

        for lang in langs:
            language = Language.objects.get(code=lang)
            missing: List[Tuple[int, str]] = []

            for entry in entries:
                if Translation.objects.filter(entry=entry, language=language).exists():
                    continue
                missing.append((entry.id, entry.en_text))
                if len(missing) >= batch_size:
                    self.stdout.write(
                        f"  Found {len(missing)} missing translations for '{lang}'\n"
                        f"{[e for e in missing]}..."
                    )
                    pool.apply_async(
                        translate_and_save,
                        args=(lang, missing.copy(), dry_run, provider),
                    )
                    total_translated += len(missing)
                    missing.clear()

            if missing:
                self.stdout.write(
                    f"  Found {len(missing)} missing translations for '{lang}'\n"
                    f"{[e for e in missing]}..."
                )
                pool.apply_async(
                    translate_and_save,
                    args=(lang, missing.copy(), dry_run, provider),
                )
                total_translated += len(missing)

        pool.close()
        pool.join()

        elapsed = time.time() - start_time
        self.stdout.write(
            f"\nDone. Filled {total_translated} missing translations in {elapsed:.2f}s"
        )
