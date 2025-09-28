# cor/management/commands/romanize_ar.py
from __future__ import annotations

import time
from typing import List

from django.core.management.base import BaseCommand
from django.db.models import Q
from pydantic import BaseModel

from corpora_ai.provider_loader import load_llm_provider
from corpora_ai.llm_interface import ChatCompletionTextMessage
from cor.models import Language, Translation

# Choose your LLM provider/model
# llm = load_llm_provider("local", completion_model="qwen3-30b-a3b-mlx")
# llm = load_llm_provider("local", completion_model="qwen3-1.7b")
# llm = load_llm_provider("local", completion_model="qwen1.5-7b-chat")
llm = load_llm_provider("openai")


# ---------- Pydantic Schemas ----------


class ArabicRomanizationItem(BaseModel):
    id: int
    arabic: str


class RomanizationResponseItem(BaseModel):
    id: int
    romanization: str


class RomanizationResponse(BaseModel):
    romanizations: List[RomanizationResponseItem]


# ---------- Prompt ----------


def get_system_prompt() -> str:
    return (
        "You are an expert Arabic linguist and educator. Produce Latin-script romanizations of Arabic text "
        "that are easy for beginners to pronounce. No numerals, no unusual symbols, no Arabizi. "
        "Use only regular letters and apostrophes for ʿayn (ع) and glottal stop (ء). "
        "Keep it phrasebook-simple and readable.\n"
        "Examples:\n"
        "حبيبي → habibi; رحلة → rihla; صديق → sadiq; عربي → 'arabi; خالد → khalid; "
        "مستشفى → mustashfa; أستاذ → 'ustadh; سؤال → su'al; المدرسة → al-madrasa."
    )


def build_llm_messages(
    items: List[ArabicRomanizationItem],
) -> List[ChatCompletionTextMessage]:
    user_prompt = (
        "For each item below, return a learner-friendly romanization using the Latin alphabet.\n"
        "Each object has: id, arabic.\n"
        "Return ONLY a single JSON object exactly as:\n"
        '{"romanizations":[{"id":<int>,"romanization":"<string>"} , ... ]}'
    )
    return [
        ChatCompletionTextMessage(role="system", text=get_system_prompt()),
        ChatCompletionTextMessage(role="user", text=user_prompt),
        ChatCompletionTextMessage(
            role="user",
            text=ArabicRomanizationItem.schema_json()
            + "\n"
            + RomanizationResponse.schema_json()
            + "\n\n"
            + str([item.dict() for item in items]),
        ),
    ]


# ---------- Utils ----------


def chunked(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i : i + n]


def show_results(objs: List[Translation], response: RomanizationResponse):
    by_id = {o.id: o for o in objs}
    for obj in response.romanizations:
        t = by_id.get(obj.id)
        print("=" * 60)
        print(f"ID:            {obj.id}")
        print(f"Arabic:        {t.text if t else ''}")
        print(f"LLM Suggested: {obj.romanization}")
    print("=" * 60)
    print("Dry run complete. No changes saved.")


# ---------- Command ----------


class Command(BaseCommand):
    help = "Use an LLM to generate learner-friendly Arabic romanizations."

    def add_arguments(self, parser):
        parser.add_argument("--batch", type=int, default=20, help="Items per LLM call.")
        parser.add_argument(
            "--dry",
            action="store_true",
            default=False,
            help="Preview only; no DB writes.",
        )
        parser.add_argument(
            "--skip",
            type=int,
            default=0,
            help="Number of batches to skip before processing (apply mode).",
        )
        parser.add_argument(
            "--missing-only",
            action="store_true",
            default=False,
            help="Process only rows where romanization is NULL or empty.",
        )

    def handle(self, *args, **opts):
        import datetime

        ar = Language.objects.get(code="ar")
        dry_run: bool = opts["dry"]
        batch_size: int = opts["batch"]
        skip_batches: int = int(opts.get("skip", 0))
        missing_only: bool = bool(opts.get("missing_only", False))

        base_qs = Translation.objects.filter(language=ar)
        if missing_only:
            base_qs = base_qs.filter(
                Q(romanization__isnull=True) | Q(romanization__exact="")
            )

        total_in_scope = base_qs.count()
        scope_label = "missing" if missing_only else "total"
        self.stdout.write(
            f"{scope_label.capitalize()} Arabic translations in scope: {total_in_scope}"
        )
        if total_in_scope == 0:
            self.stdout.write("Nothing to do.")
            return

        # Freeze the target IDs up front so the set doesn't shrink mid-run
        id_list = list(base_qs.order_by("id").values_list("id", flat=True))

        overall_start = time.time()
        sentence_count = 0
        total_llm_time = 0.0

        if dry_run:
            sample_ids = id_list[: min(batch_size, len(id_list))]
            objs = list(Translation.objects.filter(id__in=sample_ids))
            objs.sort(key=lambda o: sample_ids.index(o.id))

            items = [ArabicRomanizationItem(id=o.id, arabic=o.text) for o in objs]

            batch_start = time.time()
            messages = build_llm_messages(items)
            response = llm.get_data_completion(messages, RomanizationResponse)
            batch_elapsed = time.time() - batch_start

            show_results(objs, response)
            self.stdout.write(
                f"⏱️ Batch time: {batch_elapsed:.2f}s | Per sentence: {batch_elapsed/len(objs):.2f}s"
            )
            self.stdout.write("Dry run complete. No changes saved.")
            return

        # Apply mode
        batch_num = 0
        for id_chunk in chunked(id_list, batch_size):
            batch_num += 1
            if batch_num <= skip_batches:
                self.stdout.write(f"⏭️ Skipping batch {batch_num} (as requested)")
                continue

            objs = list(Translation.objects.filter(id__in=id_chunk))
            objs.sort(key=lambda o: id_chunk.index(o.id))

            items = [ArabicRomanizationItem(id=o.id, arabic=o.text) for o in objs]

            # LLM call with retries
            batch_start = time.time()
            tries = 0
            max_retries = 5
            response = None
            while tries < max_retries:
                try:
                    messages = build_llm_messages(items)
                    response = llm.get_data_completion(messages, RomanizationResponse)
                    break
                except Exception as e:
                    tries += 1
                    self.stderr.write(
                        f"Error in batch {batch_num}, attempt {tries}: {e}"
                    )
                    time.sleep(min(1.5 * (2**tries), 8.0))
                    if tries >= max_retries:
                        self.stderr.write("Max retries reached. Skipping this batch.")
                        break

            if response is None:
                continue

            batch_elapsed = time.time() - batch_start
            total_llm_time += batch_elapsed
            sentence_count += len(objs)

            # Apply updates in-memory then bulk_update
            resp_by_id = {
                r.id: (r.romanization or "").strip() for r in response.romanizations
            }
            to_update: List[Translation] = []
            for o in objs:
                rom = resp_by_id.get(o.id, "")
                if rom and rom != (o.romanization or ""):
                    o.romanization = rom
                    to_update.append(o)

            if to_update:
                Translation.objects.bulk_update(to_update, ["romanization"])

            self.stdout.write(
                f"[Batch {batch_num}] {len(objs)} processed, {len(to_update)} updated."
            )

        overall_elapsed = time.time() - overall_start
        avg_per_sentence = total_llm_time / sentence_count if sentence_count else 0
        self.stdout.write(
            f"✅ All batches complete in {str(datetime.timedelta(seconds=overall_elapsed))}"
        )
        self.stdout.write(
            f"LLM processing time: {total_llm_time:.2f}s | {sentence_count} sentences | Avg per sentence: {avg_per_sentence:.2f}s"
        )
