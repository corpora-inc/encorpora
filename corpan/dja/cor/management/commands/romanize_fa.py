import time
import multiprocessing
from functools import partial
from typing import List, Tuple

from django.core.management.base import BaseCommand
from django.db import close_old_connections
from django.db.models import Q
from pydantic import BaseModel

from cor.models import Language, Translation
from corpora_ai.provider_loader import load_llm_provider
from corpora_ai.llm_interface import ChatCompletionTextMessage


# Pydantic schemas
class FaRomanizationItem(BaseModel):
    id: int
    persian: str


class FaRomanizationRespItem(BaseModel):
    id: int
    romanization: str


class FaRomanizationResp(BaseModel):
    romanizations: List[FaRomanizationRespItem]


# LLM prompt construction


def get_system_prompt() -> str:
    return (
        "You are an expert Persian linguist. Provide clear, beginner-friendly romanizations of "
        "Persian sentences using Latin letters. No numerals or special symbols. Use ā, ī, ū for long vowels. "
        "Use ’ for hamza (ء) and ʿ for ayn (ع) as needed. Make results readable by English speakers."
    )


def build_llm_messages(
    items: List[FaRomanizationItem],
) -> List[ChatCompletionTextMessage]:
    user_prompt = (
        "For each item below, return a JSON object with 'romanizations': a list of {id, romanization}. "
        "Example: سلام → salām. Output ONLY the JSON."
    )
    return [
        ChatCompletionTextMessage(role="system", text=get_system_prompt()),
        ChatCompletionTextMessage(role="user", text=user_prompt),
        ChatCompletionTextMessage(
            role="user",
            text=FaRomanizationItem.schema_json()
            + "\n"
            + FaRomanizationResp.schema_json()
            + "\n"
            + str([item.dict() for item in items]),
        ),
    ]


# Worker invoked in parallel for each batch


def romanize_batch(
    batch: List[Tuple[int, str]],
    provider: str,
    model: str,
    dry_run: bool,
    max_retries: int,
) -> dict:
    close_old_connections()
    start = time.time()

    # Load LLM provider
    if provider == "local":
        llm = load_llm_provider("local", completion_model=model)
    elif provider == "openai":
        llm = load_llm_provider("openai", completion_model=model)
    elif provider == "xai":
        llm = load_llm_provider("xai", completion_model=model)
    else:
        raise ValueError(f"Unknown provider: {provider}")

    items = [FaRomanizationItem(id=i, persian=text) for i, text in batch]
    messages = build_llm_messages(items)

    # Retry on failure
    tries = 0
    response = None
    while tries < max_retries:
        try:
            response = llm.get_data_completion(messages, FaRomanizationResp)
            break
        except Exception:
            tries += 1
            time.sleep(2**tries)

    processed = len(batch)
    updated = 0
    elapsed = time.time() - start

    if not response:
        return {"processed": processed, "updated": updated, "time": elapsed}

    if dry_run:
        for obj in response.romanizations:
            orig = next((t for t in batch if t[0] == obj.id), None)
            print(f"[dry] ID {obj.id}: '{orig[1]}' → '{obj.romanization}'")
    else:
        for obj in response.romanizations:
            try:
                t = Translation.objects.get(id=obj.id)
                roman = obj.romanization.strip()
                if roman:
                    t.romanization = roman
                    t.save(update_fields=["romanization"])
                    updated += 1
            except Translation.DoesNotExist:
                continue

    return {"processed": processed, "updated": updated, "time": elapsed}


# Management command
class Command(BaseCommand):
    help = "Romanize Persian translations using an LLM."

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=20,
            help="Number of strings per LLM batch.",
        )
        parser.add_argument(
            "--processes",
            type=int,
            default=multiprocessing.cpu_count(),
            help="Number of parallel worker processes.",
        )
        parser.add_argument(
            "--provider",
            type=str,
            default="local",
            help="LLM backend: local, openai, xai.",
        )
        parser.add_argument(
            "--model",
            type=str,
            default="gpt-4o",
            help="Completion model name for the chosen provider.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Show sample output without saving changes.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Max number of strings to process (0 = all).",
        )
        parser.add_argument(
            "--only-level",
            type=str,
            default="",
            help="Process only entries with this CEFR level (e.g. 'A1').",
        )
        parser.add_argument(
            "--max-retries",
            type=int,
            default=5,
            help="Number of retry attempts on LLM API errors.",
        )

    def handle(self, *args, **opts):
        batch_size: int = opts["batch_size"]
        processes: int = opts["processes"]
        provider: str = opts["provider"]
        model: str = opts["model"]
        dry_run: bool = opts["dry_run"]
        limit: int = opts["limit"]
        only_level: str = opts["only_level"]
        max_retries: int = opts["max_retries"]

        fa_lang = Language.objects.get(code="fa")
        qs = Translation.objects.filter(language=fa_lang).filter(
            Q(romanization__isnull=True) | Q(romanization__exact="")
        )
        if only_level:
            qs = qs.filter(entry__level=only_level)

        total = qs.count()
        self.stdout.write(f"Total missing Persian romanizations: {total}")
        if total == 0:
            return

        # Randomize order and apply limit
        qs = qs.order_by("?")
        if limit > 0:
            qs = qs[:limit]

        pairs: List[Tuple[int, str]] = [(t.id, t.text) for t in qs]
        batches = [pairs[i : i + batch_size] for i in range(0, len(pairs), batch_size)]
        self.stdout.write(f"Processing {len(batches)} batches of size {batch_size}...")

        worker = partial(
            romanize_batch,
            provider=provider,
            model=model,
            dry_run=dry_run,
            max_retries=max_retries,
        )

        pool = multiprocessing.Pool(processes=processes)
        start_time = time.time()

        total_processed = 0
        total_updated = 0
        total_llm_time = 0.0

        for result in pool.imap(worker, batches):
            total_processed += result["processed"]
            total_updated += result["updated"]
            total_llm_time += result["time"]
            self.stdout.write(
                f"[Batch] processed {result['processed']}, updated {result['updated']} "
                f"in {result['time']:.2f}s (avg {result['time']/result['processed']:.2f}s/s)."
            )

        pool.close()
        pool.join()

        overall = time.time() - start_time
        avg_time = total_llm_time / total_processed if total_processed else 0
        self.stdout.write(
            f"✅ Completed: {total_processed} sentences, {total_updated} saved."
        )
        self.stdout.write(
            f"LLM wall-clock: {total_llm_time:.2f}s, avg {avg_time:.2f}s/s, overall elapsed {overall:.2f}s."
        )
