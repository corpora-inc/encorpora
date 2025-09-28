import time
import random
import multiprocessing as mp
from functools import partial
from typing import List, Tuple, Dict

from django.core.management.base import BaseCommand
from django.db import close_old_connections
from django.db.models import Q

from pydantic import BaseModel

from cor.models import Language, Translation
from corpora_ai.provider_loader import load_llm_provider
from corpora_ai.llm_interface import ChatCompletionTextMessage


# ----------------- Pydantic schemas -----------------


class FaRomanizationItem(BaseModel):
    id: int
    persian: str


class FaRomanizationRespItem(BaseModel):
    id: int
    romanization: str


class FaRomanizationResp(BaseModel):
    romanizations: List[FaRomanizationRespItem]


# ----------------- Prompt -----------------


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


# ----------------- Worker infra -----------------

_LLM = None  # set per-process


def _init_worker(provider: str, model: str | None):
    """Initializer runs once per child. Build LLM client here instead of per-batch."""
    global _LLM
    close_old_connections()
    if provider == "local":
        _LLM = load_llm_provider("local", completion_model=model)
    elif provider == "openai":
        _LLM = load_llm_provider("openai", completion_model=model)
    elif provider == "xai":
        _LLM = load_llm_provider("xai", completion_model=model)
    else:
        raise ValueError(f"Unknown provider: {provider}")


def _romanize_batch(batch: List[Tuple[int, str]], max_retries: int) -> Dict:
    """
    Pure compute in worker: call LLM, return rows to parent.
    No DB writes or prints here (keeps it fast and clean).
    """
    global _LLM
    start = time.time()

    items = [FaRomanizationItem(id=i, persian=text) for i, text in batch]
    messages = build_llm_messages(items)

    tries = 0
    response = None
    while tries < max_retries:
        try:
            response = _LLM.get_data_completion(messages, FaRomanizationResp)
            break
        except Exception:
            tries += 1
            time.sleep(min(1.5 * (2**tries), 8.0))

    elapsed = time.time() - start
    if not response:
        return {"processed": len(batch), "rows": [], "time": elapsed}

    # return pairs only; parent prints/saves
    rows = [
        (obj.id, obj.romanization.strip())
        for obj in response.romanizations
        if obj.romanization.strip()
    ]
    return {"processed": len(batch), "rows": rows, "time": elapsed}


# ----------------- Management command -----------------


class Command(BaseCommand):
    help = "Romanize Persian translations using an LLM (fast + chatty). Dry-run streams suggestions quickly."

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size", type=int, default=20, help="Strings per LLM batch."
        )
        parser.add_argument(
            "--processes",
            type=int,
            default=max(1, mp.cpu_count() // 2),
            help="Parallel workers.",
        )
        parser.add_argument(
            "--provider",
            type=str,
            default="openai",
            help="LLM backend: local, openai, xai.",
        )
        parser.add_argument(
            "--model",
            type=str,
            default="gpt-4.1",
            help="Completion model name for the provider.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Preview output without saving.",
        )
        parser.add_argument(
            "--limit", type=int, default=0, help="Max number to process (0 = all)."
        )
        parser.add_argument(
            "--only-level",
            type=str,
            default="",
            help="Only entries with this CEFR level (e.g. 'A1').",
        )
        parser.add_argument(
            "--max-retries", type=int, default=5, help="LLM retry attempts."
        )
        parser.add_argument(
            "--seed", type=int, default=42, help="RNG seed for sampling."
        )
        parser.add_argument(
            "--preview-first",
            type=int,
            default=10,
            help="Do a tiny synchronous preview before parallel run.",
        )

    def handle(self, *args, **opts):
        batch_size = opts["batch_size"]
        processes = max(1, opts["processes"])
        provider = opts["provider"]
        model = opts["model"]
        dry_run = opts["dry_run"]
        limit = opts["limit"]
        only_level = opts["only_level"]
        max_retries = opts["max_retries"]
        seed = int(opts["seed"])
        preview_first = max(0, int(opts["preview_first"]))

        # -------- build target set (fast random sample without ORDER BY RANDOM()) --------
        fa_lang = Language.objects.get(code="fa")
        base_qs = Translation.objects.filter(language=fa_lang).filter(
            Q(romanization__isnull=True) | Q(romanization__exact="")
        )
        if only_level:
            base_qs = base_qs.filter(entry__level=only_level)

        total_missing = base_qs.count()
        self.stdout.write(
            self.style.NOTICE(f"Missing Persian romanizations: {total_missing}")
        )

        if total_missing == 0:
            return

        # get all candidate IDs first (cheap), then sample in Python
        id_text = list(base_qs.values_list("id", "text"))
        if limit and limit < len(id_text):
            random.Random(seed).shuffle(id_text)
            id_text = id_text[:limit]

        # partition into batches
        pairs: List[Tuple[int, str]] = id_text
        batches = [pairs[i : i + batch_size] for i in range(0, len(pairs), batch_size)]
        self.stdout.write(
            self.style.NOTICE(
                f"Batches: {len(batches)}  (batch_size={batch_size}, processes={processes})"
            )
        )

        total_processed = 0
        total_updated = 0
        total_llm_time = 0.0
        t0 = time.time()

        # -------- instant mini-preview (synchronous) --------
        if dry_run and preview_first > 0 and pairs:
            mini = pairs[: min(preview_first, len(pairs))]
            self.stdout.write(self.style.WARNING(f"Preview {len(mini)} items…"))
            # init local LLM once
            llm = (
                load_llm_provider(provider, completion_model=model)
                if model
                else load_llm_provider(provider)
            )
            items = [FaRomanizationItem(id=i, persian=txt) for i, txt in mini]
            messages = build_llm_messages(items)
            try:
                resp = llm.get_data_completion(messages, FaRomanizationResp)
                for obj in resp.romanizations:
                    orig = next((t for t in mini if t[0] == obj.id), None)
                    if orig:
                        print(f"[dry] ID {obj.id}: '{orig[1]}' → '{obj.romanization}'")
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Preview failed: {e}"))
            # continue with the full run (will include these again; dry-run so fine)

        # -------- parallel compute; parent prints and writes --------
        ctx = mp.get_context(
            "fork" if hasattr(mp, "get_context") else None
        )  # faster startup on unix
        with ctx.Pool(
            processes=processes,
            initializer=_init_worker,
            initargs=(provider, model),
            maxtasksperchild=100,  # keep workers fresh
        ) as pool:
            worker = partial(_romanize_batch, max_retries=max_retries)
            # chunksize=1 ensures quick first results; adjust if you want fewer callbacks
            for idx, result in enumerate(
                pool.imap_unordered(worker, batches, chunksize=1), start=1
            ):
                total_processed += result["processed"]
                total_llm_time += result["time"]

                if dry_run:
                    # print every suggestion as it comes back
                    for tid, roman in result["rows"]:
                        # find original text quickly via dict
                        # build a small lookup only once
                        # (for big runs you can prebuild a dict outside the loop)
                        pass
                    # quick lookup map (build once lazily)
                    if not hasattr(self, "_lookup"):
                        self._lookup = {i: t for i, t in pairs}
                    for tid, roman in result["rows"]:
                        orig = self._lookup.get(tid, "")
                        print(f"[dry] ID {tid}: '{orig}' → '{roman}'")
                else:
                    # bulk update in parent for this batch
                    rows = result["rows"]
                    if rows:
                        id_list = [tid for tid, _ in rows]
                        objs = list(Translation.objects.filter(id__in=id_list))
                        rom_by_id = {tid: roman for tid, roman in rows}
                        for o in objs:
                            r = rom_by_id.get(o.id, "").strip()
                            if r and r != o.romanization:
                                o.romanization = r
                        if objs:
                            Translation.objects.bulk_update(objs, ["romanization"])
                            total_updated += len(rows)

                # chatty progress line
                avg = (
                    (result["time"] / result["processed"]) if result["processed"] else 0
                )
                self.stdout.write(
                    f"[batch {idx}/{len(batches)}] processed={result['processed']} "
                    f"rows={len(result['rows'])} time={result['time']:.2f}s avg={avg:.2f}s/s",
                )

        elapsed = time.time() - t0
        self.stdout.write(
            self.style.SUCCESS(
                f"✅ Completed: {total_processed} sentences; saved={total_updated if not dry_run else 0}."
            )
        )
        per = (total_llm_time / total_processed) if total_processed else 0
        self.stdout.write(
            self.style.NOTICE(
                f"LLM wall-clock: {total_llm_time:.2f}s  avg={per:.2f}s/s  overall={elapsed:.2f}s"
            )
        )
