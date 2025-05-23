import random
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from django.core.management.base import BaseCommand
from cor.models import Entry, Language, Translation
from cor.utils.io import load_wordlist
from cor.utils.llm import translate_entry_batch
from corpora_ai.llm_interface import ChatCompletionTextMessage
from corpora_ai.provider_loader import load_llm_provider
from pydantic import BaseModel
from typing import List

llm = load_llm_provider("xai", completion_model="grok-3-mini-fast")


class SentenceList(BaseModel):
    sentences: List[str]


def generate_a1_sentences(word: str, llm) -> List[str]:
    system = ChatCompletionTextMessage(
        role="system",
        text=(
            "You are a CEFR A1 English sentence generator. "
            "Given a single word, generate exactly 5 simple, natural, "
            "useful English sentences. Return complete, natural sentences, as would be heard in a real conversation. "
            "Be creative and return different types of sentences. "
            "Use 5 words or fewer in each sentence (utterance). "
            "Only output a JSON list of 5 sentences using the given word."
        ),
    )
    user = ChatCompletionTextMessage(
        role="user",
        text=f"Generate 5 CEFR A1 sentences containing the word: \n\n```\n{word}\n```\n\n",
    )
    result = llm.get_data_completion([system, user], SentenceList)
    return result.sentences


def process_word(word: str, langs: List[str], dry_run: bool, llm, stdout=None):
    """Handles one word: sentence generation + translations + DB save (unless dry_run)"""
    output = []
    output.append(f"Processing '{word}'")
    sentences = generate_a1_sentences(word, llm)
    for sent in sentences:
        output.append(f"  S: {sent}")

    word_entry = None
    if not dry_run:
        word_entry, _ = Entry.objects.get_or_create(
            en_text=word, defaults={"level": "A1"}
        )
        for sent in sentences:
            Entry.objects.get_or_create(en_text=sent, defaults={"level": "A1"})

    results = {}
    for lang in langs:
        if lang == "en":
            if not dry_run:
                Translation.objects.get_or_create(
                    entry=word_entry,
                    language=Language.objects.get(code=lang),
                    defaults={"text": word_entry.en_text},
                )
            continue
        # Prepare batch for translation
        batch = []
        for sent in sentences:
            if not dry_run:
                entry = Entry.objects.get(en_text=sent)
                batch.append((entry.id, sent))
            else:
                batch.append((random.randint(1, 10000), sent))

        # Translate the batch
        tresp = translate_entry_batch(
            lang,
            batch,
            dry_run=dry_run,
            llm=llm,
        )
        translated = [t.translated_text for t in tresp.translations]
        output.append(f"    {lang}: {translated}")
        results[lang] = translated

    if stdout:
        for line in output:
            stdout.write(line)
    return {
        "sentences": sentences,
        "translations": results,
        "total_trans": sum(len(v) for v in results.values()),
    }


class Command(BaseCommand):
    help = "Generate A1 sentences for Oxford 3000 A1 words and batch-translate to all target languages (parallelized)."

    def add_arguments(self, parser):
        parser.add_argument("--wordlist", type=str, default="data/oxford-5k.csv")
        parser.add_argument("--dry-run", action="store_true", default=False)
        parser.add_argument("--limit", type=int, default=0)
        parser.add_argument("--max-workers", type=int, default=4)

    def handle(self, *args, **options):
        wordlist_path = options["wordlist"]
        dry_run = options["dry_run"]
        limit = options["limit"]
        max_workers = options["max_workers"]

        words = load_wordlist(wordlist_path)
        a1_words = [word for word, level in words if level.upper() == "A1"]
        random.shuffle(a1_words)
        if limit:
            a1_words = a1_words[:limit]

        langs: List[str] = list(Language.objects.values_list("code", flat=True))
        self.stdout.write(f"Loaded {len(a1_words)} A1 words from {wordlist_path}")
        self.stdout.write(f"Target languages: {', '.join(langs)}")

        start_time = time.time()
        total_sent = total_trans = 0

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Prepare futures: one per word
            futures = [
                executor.submit(process_word, word, langs, dry_run, llm, self.stdout)
                for word in a1_words
            ]
            for i, future in enumerate(as_completed(futures), 1):
                result = future.result()
                total_sent += len(result["sentences"])
                total_trans += result["total_trans"]
                self.stdout.write(
                    f"[{i}/{len(futures)}] done: {len(result['sentences'])} sentences, {result['total_trans']} translations."
                )

        elapsed = time.time() - start_time
        self.stdout.write(
            f"\nDone. {len(a1_words)} words, {total_sent} sentences, {total_trans} translations in {elapsed:.2f}s"
        )
